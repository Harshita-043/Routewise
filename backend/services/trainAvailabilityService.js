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

export async function getTrainAvailability(train, date, classType = "SL") {
  const trainNumber = train.trainNo || train.trainNumber || train.code || "";
  const key = getCacheKey(trainNumber, date, classType);
  const cachedValue = getCachedValue(key);

  if (cachedValue) {
    return cachedValue;
  }

  const fareBreakdown = buildFareBreakdown({ train, classType, date });

  console.log(`[Availability] RAG fetch for train ${trainNumber} class ${classType} on ${date}`);
  const query = `train ${trainNumber} seat availability ${classType} class on ${date} fare tatkal`;
  const webContext = await searchWeb(query);

  let value = null;

  if (webContext) {
    const SYSTEM_PROMPT = `You are a strict data extraction engine for Indian Railways seat availability and fares.
Extract the current seat availability and ticket price from the web context for the given train, class, and date.
Return a JSON object strictly matching this schema:
{
  "available": true,
  "seatsLeft": 15,
  "currentFare": 450,
  "quota": "GN"
}
Rules:
- If Waitlisted (WL) or RAC, set available: false, seatsLeft: 0, quota: "WL".
- If data is completely missing or unclear, return null.
- Do NOT hallucinate.`;

    try {
      const extracted = await extractStructuredData(
        SYSTEM_PROMPT,
        `Train: ${trainNumber}\nClass: ${classType}\nDate: ${date}\nContext:\n${webContext}`
      );

      if (extracted && typeof extracted.available === "boolean") {
        console.log(`[Availability] RAG extraction success for ${trainNumber} ${classType}`);
        value = {
          available: extracted.available,
          seatsLeft: Number(extracted.seatsLeft || 0),
          currentFare: Number(extracted.currentFare || fareBreakdown.total),
          tatkalSurcharge: fareBreakdown.tatkalSurcharge,
          quota: extracted.quota || "GN",
          source: "rag",
        };
      }
    } catch (err) {
      console.warn("[Availability] RAG extraction failed:", err.message);
    }
  }

  // When live web retrieval yields no verified data, return honest unverified state
  if (!value) {
    value = {
      available: false,
      seatsLeft: null,
      currentFare: fareBreakdown.total,
      tatkalSurcharge: fareBreakdown.tatkalSurcharge,
      quota: "GN",
      source: "unverified",
      message: "Live seat availability requires direct IRCTC/CRIS API gateway integration.",
    };
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
