import { searchWeb } from "./webSearchService.js";
import { extractStructuredData } from "./llmService.js";

// ─── RAG-based live status extraction ────────────────────────────────────────
const LIVE_STATUS_SYSTEM_PROMPT = `You are a strict data extraction engine for Indian Railways live train running status.
Extract the current running status of the given train based ONLY on the provided web context.
Return a JSON object strictly matching this schema:
{
  "currentStation": "Name of the station the train is currently at or recently passed",
  "delayMinutes": 0,
  "status": "One-line human-readable status e.g. 'Running on time' or 'Running 25 min late'",
  "lat": 22.5,
  "lng": 78.5,
  "actualDate": "YYYY-MM-DD"
}
Rules:
- If the train is on time, set delayMinutes to 0.
- lat/lng should be approximate coordinates of the currentStation (India range: lat 8-37, lng 68-98).
- actualDate should be the journey date the search results are tracking. If unclear, use today's date.
- If no reliable data is found, return null.
- Do NOT hallucinate. Only use data present in the context.`;

/**
 * Retrieves train live running status via RAG web search.
 * When official GPS/RTIS API is unconfigured and web search yields no verified status,
 * returns an honest unverified state rather than fabricated simulation.
 */
export async function getTrainLiveStatus(trainNo, date) {
  console.log(`[LiveStatus] RAG fetch for train ${trainNo} on ${date}`);

  const query = `train ${trainNo} live running status today current station India`;
  const webContext = await searchWeb(query);

  if (webContext) {
    try {
      const extracted = await extractStructuredData(
        LIVE_STATUS_SYSTEM_PROMPT,
        `Train Number: ${trainNo}\nDate: ${date}\n\nContext:\n${webContext}`
      );

      if (
        extracted &&
        typeof extracted.currentStation === "string" &&
        extracted.currentStation.trim().length > 1 &&
        extracted.currentStation.toLowerCase() !== "null"
      ) {
        console.log(`[LiveStatus] RAG extracted station: ${extracted.currentStation}`);
        
        const todayStr = new Date().toISOString().split("T")[0];
        const displayDate = extracted.actualDate || todayStr;

        return {
          trainNo,
          date: displayDate,
          delayMinutes: Number(extracted.delayMinutes ?? 0),
          currentStation: extracted.currentStation.trim(),
          currentLocation: {
            lat: Number(extracted.lat ?? 22.5),
            lng: Number(extracted.lng ?? 78.5),
          },
          status: extracted.status ?? "Status extracted via web",
          source: "rag",
        };
      }
    } catch (err) {
      console.warn("[LiveStatus] RAG extraction failed:", err.message);
    }
  }

  // Honest unavailable state when neither direct GPS gateway nor web evidence exists
  const todayStr = new Date().toISOString().split("T")[0];
  return {
    trainNo,
    date: date || todayStr,
    delayMinutes: 0,
    currentStation: "Live status currently unavailable",
    currentLocation: {
      lat: 28.6139,
      lng: 77.209,
    },
    status: "Direct NTES / CRIS GPS tracking requires authorized railway gateway access.",
    source: "unavailable",
  };
}

/**
 * PNR status check.
 * Indian Railways IRCTC PNR status is gated by CAPTCHAs and authorized enterprise credentials.
 * We honestly report integration status rather than fabricating fake passenger berths.
 */
export async function getPnrStatus(pnr) {
  const sanitizedPnr = String(pnr || "").replace(/\D/g, "");

  if (sanitizedPnr.length !== 10) {
    throw new Error("Invalid PNR. Please provide a 10-digit PNR number.");
  }

  // Check if an authorized railway PNR provider is configured
  const pnrApiKey = process.env.IRCTC_PNR_API_KEY || process.env.RAPIDAPI_KEY;
  if (!pnrApiKey) {
    return {
      pnr: sanitizedPnr,
      trainNo: "N/A",
      passengers: [],
      chartPrepared: false,
      status: "unavailable",
      message: "Official IRCTC PNR enquiry requires direct CRIS / IRCTC API credentials. Live lookup unavailable without authorized gateway.",
      source: "unavailable",
    };
  }

  // If a provider adapter is configured, query the gateway
  try {
    const res = await fetch(`https://irctc-live-pnr-service.p.rapidapi.com/pnr/${sanitizedPnr}`, {
      headers: {
        "X-RapidAPI-Key": pnrApiKey,
        "X-RapidAPI-Host": "irctc-live-pnr-service.p.rapidapi.com",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      const data = await res.json();
      return {
        pnr: sanitizedPnr,
        trainNo: data.trainNo || data.train_number || "N/A",
        passengers: data.passengers || [],
        chartPrepared: Boolean(data.chartPrepared),
        source: "gateway",
      };
    }
  } catch (err) {
    console.warn("[PNR] Gateway fetch failed:", err.message);
  }

  return {
    pnr: sanitizedPnr,
    trainNo: "N/A",
    passengers: [],
    chartPrepared: false,
    status: "unavailable",
    message: "Could not reach PNR gateway. Please check official IRCTC portal.",
    source: "unavailable",
  };
}
