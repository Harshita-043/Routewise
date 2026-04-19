import { buildFareBreakdown } from "./fareEngine.js";
import { searchWeb } from "./webSearchService.js";
import { extractStructuredData } from "./llmService.js";

const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCacheKey(trainNo, date, classType) {
  return `${trainNo}:${date}:${classType}`;
}

function getCachedValue(key) {
  const cached = cache.get(key);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }

  return cached.value;
}

function setCachedValue(key, value) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function calculateSimulatedAvailability(train, date, classType) {
  const seed = `${train.trainNo}${date}${classType}`.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const fareBreakdown = buildFareBreakdown({ train, classType, date });
  const seatsLeft = seed % 37;

  return {
    available: seatsLeft > 0,
    seatsLeft,
    currentFare: fareBreakdown.total,
    tatkalSurcharge: fareBreakdown.tatkalSurcharge,
    quota: seatsLeft > 10 ? "GN" : "WL",
    source: "simulated",
  };
}

export async function getTrainAvailability(train, date, classType = "SL") {
  const key = getCacheKey(train.trainNo, date, classType);
  const cachedValue = getCachedValue(key);

  if (cachedValue) {
    return cachedValue;
  }

  const fareBreakdown = buildFareBreakdown({ train, classType, date });

  console.log(`[Availability] RAG fetch for train ${train.trainNo} class ${classType} on ${date}`);
  const query = `train ${train.trainNo} seat availability ${classType} class on ${date} fare tatkal`;
  const webContext = await searchWeb(query);

  let value = null;

  if (webContext) {
    const SYSTEM_PROMPT = `You are a strict data extraction engine for Indian Railways seat availability and fares.
Extract the current seat availability and ticket price from the web context for the given train, class, and date.
Return a JSON object strictly matching this schema:
{
  "available": true, // false if Waitlisted or Unavailable
  "seatsLeft": 15, // number of seats left, or 0 if WL/REGRET
  "currentFare": 450, // total fare in INR
  "quota": "GN" // GN for General, WL for Waitlist, TQ for Tatkal
}
Rules:
- If Waitlisted (WL) or RAC, set available: false, seatsLeft: 0, quota: "WL".
- If data is completely missing or unclear, return null.
- Do NOT hallucinate.`;

    try {
      const extracted = await extractStructuredData(
        SYSTEM_PROMPT,
        `Train: ${train.trainNo}\nClass: ${classType}\nDate: ${date}\nContext:\n${webContext}`
      );

      if (extracted && typeof extracted.available === "boolean") {
        console.log(`[Availability] RAG extraction success for ${train.trainNo} ${classType}`);
        value = {
          available: extracted.available,
          seatsLeft: Number(extracted.seatsLeft || 0),
          currentFare: Number(extracted.currentFare || fareBreakdown.total),
          tatkalSurcharge: fareBreakdown.tatkalSurcharge, // Keep derived tatkal calculation
          quota: extracted.quota || "GN",
          source: "rag",
        };
      }
    } catch (err) {
      console.error("[Availability] RAG extraction failed:", err.message);
    }
  }

  if (!value) {
    console.warn(`[Availability] RAG returned null for ${train.trainNo} ${classType}. Falling back to simulation.`);
    value = calculateSimulatedAvailability(train, date, classType);
  }

  setCachedValue(key, value);
  return value;
}

export async function attachAvailability(trains, date, classType = "SL", limit = 5) {
  const head = await Promise.all(
    trains.slice(0, limit).map(async (train) => ({
      ...train,
      availability: await getTrainAvailability(train, date, classType),
    })),
  );

  return [
    ...head,
    ...trains.slice(limit).map((train) => ({
      ...train,
      availability: null,
    })),
  ];
}
