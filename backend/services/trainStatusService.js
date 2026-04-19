import { searchWeb } from "./webSearchService.js";
import { extractStructuredData } from "./llmService.js";

// ─── Deterministic simulation fallback ───────────────────────────────────────
function createSeedNumber(input) {
  return String(input)
    .split("")
    .reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

const FALLBACK_STATIONS = [
  "Kanpur Central", "Agra Cantt", "Mathura Jn", "Jhansi Jn",
  "Bhopal Jn", "Nagpur", "Itarsi Jn", "Allahabad Jn", "Varanasi Jn",
  "Gwalior", "Surat", "Vadodara Jn", "Ratlam Jn", "Kota Jn",
];

function simulateLiveStatus(trainNo, date) {
  const seed = createSeedNumber(`${trainNo}${date}`);
  return {
    trainNo,
    date,
    delayMinutes: seed % 48,
    currentStation: FALLBACK_STATIONS[seed % FALLBACK_STATIONS.length],
    currentLocation: {
      lat: 22.5 + (seed % 15) * 0.6,
      lng: 76.5 + (seed % 15) * 0.55,
    },
    status: seed % 3 === 0 ? "Running right time" : "Running with minor delay",
    source: "simulated",
  };
}

// ─── RAG-based live status extraction ────────────────────────────────────────
const SYSTEM_PROMPT = `You are a strict data extraction engine for Indian Railways live train status.
Extract the current running status of the given train based ONLY on the provided web context.
Return a JSON object strictly matching this schema:
{
  "currentStation": "Name of the station the train is currently at or recently passed",
  "delayMinutes": 0,
  "status": "One-line human-readable status e.g. 'Running on time' or 'Running 25 min late'",
  "lat": 22.5,
  "lng": 78.5
}
Rules:
- If the train is on time, set delayMinutes to 0.
- lat/lng should be approximate coordinates of the currentStation (India range: lat 8-37, lng 68-98).
- If no reliable data is found, return null.
- Do NOT hallucinate. Only use data present in the context.`;

export async function getTrainLiveStatus(trainNo, date) {
  console.log(`[LiveStatus] RAG fetch for train ${trainNo} on ${date}`);

  // 1. Web search
  const query = `train ${trainNo} live running status today current station India`;
  const webContext = await searchWeb(query);

  if (webContext) {
    try {
      const extracted = await extractStructuredData(
        SYSTEM_PROMPT,
        `Train Number: ${trainNo}\nDate: ${date}\n\nContext:\n${webContext}`
      );

      if (
        extracted &&
        typeof extracted.currentStation === "string" &&
        extracted.currentStation.length > 1
      ) {
        console.log(`[LiveStatus] RAG extracted station: ${extracted.currentStation}`);
        return {
          trainNo,
          date,
          delayMinutes: Number(extracted.delayMinutes ?? 0),
          currentStation: extracted.currentStation,
          currentLocation: {
            lat: Number(extracted.lat ?? 22.5),
            lng: Number(extracted.lng ?? 78.5),
          },
          status: extracted.status ?? "Status extracted via web",
          source: "rag",
        };
      }

      console.warn("[LiveStatus] RAG returned null or incomplete data — using simulation.");
    } catch (err) {
      console.error("[LiveStatus] RAG extraction failed:", err.message);
    }
  } else {
    console.warn("[LiveStatus] No web context available — using simulation.");
  }

  // 2. Deterministic simulation fallback
  return simulateLiveStatus(trainNo, date);
}

// ─── PNR status (simulation — live IRCTC PNR APIs are auth-gated) ─────────────
export async function getPnrStatus(pnr) {
  const seed = createSeedNumber(pnr);
  const confirmed = seed % 2 === 0;

  return {
    pnr,
    trainNo: `12${String(seed % 900).padStart(3, "0")}`,
    passengers: [
      {
        passenger: 1,
        bookingStatus: confirmed ? "CNF" : "WL/4",
        currentStatus: confirmed ? "CNF" : "RAC/1",
        coach: confirmed ? "S3" : null,
        berth: confirmed ? `4${seed % 10}` : null,
      },
    ],
    chartPrepared: confirmed,
    source: "simulated",
  };
}
