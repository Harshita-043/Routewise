import crypto from "crypto";
import { TrainSchedule } from "../models/TrainSchedule.js";
import { RagCache } from "../models/RagCache.js";
import { embedText, cosineSimilarity } from "./embeddingService.js";
import { buildFareBreakdown } from "./fareEngine.js";
import { attachAvailability } from "./trainAvailabilityService.js";
import { getWeekdayForDate, isPlaceMatch, normalizePlace, scorePlaceSimilarity } from "../utils/utils.js";
import { callLLM, extractStructuredData, generateChatResponse } from "./llmService.js";
import { searchWeb } from "./webSearchService.js";

// Common Indian Railway station mappings for entity resolution & disambiguation
const KNOWN_STATION_MAP = {
  delhi: { code: "NDLS", name: "New Delhi", aliases: ["delhi", "new delhi", "dli", "ndls"] },
  mumbai: { code: "BCT", name: "Mumbai Central", aliases: ["mumbai", "bombay", "bct", "csmt", "dadar"] },
  kolkata: { code: "HWH", name: "Howrah Jn", aliases: ["kolkata", "calcutta", "howrah", "hwh", "sealdah", "sdah"] },
  chennai: { code: "MAS", name: "Chennai Central", aliases: ["chennai", "madras", "mas"] },
  bengaluru: { code: "SBC", name: "KSR Bengaluru", aliases: ["bengaluru", "bangalore", "sbc", "ypr"] },
  hyderabad: { code: "HYB", name: "Hyderabad Deccan", aliases: ["hyderabad", "secunderabad", "sc", "hyb"] },
  ahmedabad: { code: "ADI", name: "Ahmedabad Jn", aliases: ["ahmedabad", "adi"] },
  pune: { code: "PUNE", name: "Pune Jn", aliases: ["pune", "pune jn"] },
  jaipur: { code: "JP", name: "Jaipur Jn", aliases: ["jaipur", "jp"] },
  lucknow: { code: "LKO", name: "Lucknow Charbagh", aliases: ["lucknow", "lko", "ljn"] },
  kanpur: { code: "CNB", name: "Kanpur Central", aliases: ["kanpur", "cnb"] },
  varanasi: { code: "BSB", name: "Varanasi Jn", aliases: ["varanasi", "banaras", "bsb"] },
  patna: { code: "PNBE", name: "Patna Jn", aliases: ["patna", "pnbe"] },
  bhopal: { code: "BPL", name: "Bhopal Jn", aliases: ["bhopal", "bpl", "rkmp", "habibganj"] },
  indore: { code: "INDB", name: "Indore Jn", aliases: ["indore", "indb"] },
  chandigarh: { code: "CDG", name: "Chandigarh", aliases: ["chandigarh", "cdg"] },
  amritsar: { code: "ASR", name: "Amritsar Jn", aliases: ["amritsar", "asr"] },
  agra: { code: "AGC", name: "Agra Cantt", aliases: ["agra", "agc", "af"] },
  surat: { code: "ST", name: "Surat", aliases: ["surat", "st"] },
  vadodara: { code: "BRC", name: "Vadodara Jn", aliases: ["vadodara", "baroda", "brc"] },
};

/**
 * Resolves and disambiguates station / location names.
 */
export function resolveStation(input = "") {
  if (!input || typeof input !== "string") {
    return { name: input, code: null };
  }

  const normalized = normalizePlace(input).toLowerCase();

  for (const [key, data] of Object.entries(KNOWN_STATION_MAP)) {
    if (data.aliases.some((alias) => normalized.includes(alias) || alias.includes(normalized))) {
      return { name: data.name, code: data.code };
    }
  }

  return {
    name: input.trim(),
    code: input.trim().length <= 4 && input === input.toUpperCase() ? input.trim() : null,
  };
}

/**
 * 4.1 Query Understanding: Intent Classification & Entity Extraction
 */
export async function understandQuery(query) {
  const normalizedQuery = String(query || "").trim();

  // Fast heuristic classification
  const lower = normalizedQuery.toLowerCase();

  const isTatkal = lower.includes("tatkal") || lower.includes("tq");
  const isWaitlist = lower.includes("waitlist") || lower.includes("wl") || lower.includes("rac") || lower.includes("confirmation chance");
  const isAvailability = lower.includes("seat") || lower.includes("availability") || lower.includes("available");
  const isPnr = lower.includes("pnr");
  const isRunningStatus = lower.includes("live status") || lower.includes("running status") || lower.includes("where is");
  const isFare = lower.includes("fare") || lower.includes("price") || lower.includes("cost") || lower.includes("ticket");
  const isUnrelated =
    lower.includes("neural network") ||
    lower.includes("recipe") ||
    lower.includes("quantum") ||
    lower.includes("write a poem") ||
    (!lower.includes("train") && !lower.includes("travel") && !lower.includes("fare") && !lower.includes("route") && !lower.includes("station") && !lower.includes("bus") && !lower.includes("delhi") && !lower.includes("mumbai") && !lower.includes("ticket") && !lower.includes("pnr"));

  // Structured extraction prompt
  const systemPrompt = `You are an expert NLP Query Understanding engine for RouteWise, an Indian transport discovery and route optimization platform.
Analyze the user's query and extract the intent and entities.

Possible intents:
- "train_schedule": searching for trains running between two places or train timings
- "train_availability": asking for available seats or seat status
- "tatkal_availability": asking specifically about Tatkal quota rules, availability or booking
- "waitlist_rac": asking about waitlist confirmation probability, RAC rules or status
- "train_route": asking for intermediate stops or route path of a train
- "pnr_status": asking to check a 10-digit PNR status
- "train_live_status": asking where a train currently is or delay
- "fare_comparison": comparing fares between travel options or modes
- "general_travel": general travel recommendations between cities in India
- "unrelated": questions completely unrelated to Indian travel or transport

Return a JSON strictly matching this schema:
{
  "intent": "train_schedule",
  "entities": {
    "source": "Origin Station or City (or null)",
    "destination": "Destination Station or City (or null)",
    "stationCode": "Station Code e.g. NDLS (or null)",
    "date": "YYYY-MM-DD (or null)",
    "trainNumber": "Train number e.g. 12952 (or null)",
    "trainName": "Train name (or null)",
    "classType": "SL, 3A, 2A, 1A, CC, 2S (or null)",
    "quota": "GN, TQ, PT, LD (or null)"
  }
}`;

  let parsed = await extractStructuredData(systemPrompt, `Query: "${normalizedQuery}"`);

  if (!parsed || !parsed.intent) {
    let intent = "general_travel";
    if (isUnrelated) intent = "unrelated";
    else if (isTatkal) intent = "tatkal_availability";
    else if (isWaitlist) intent = "waitlist_rac";
    else if (isAvailability) intent = "train_availability";
    else if (isPnr) intent = "pnr_status";
    else if (isRunningStatus) intent = "train_live_status";
    else if (isFare) intent = "fare_comparison";
    else if (lower.includes("train")) intent = "train_schedule";

    parsed = {
      intent,
      entities: {
        source: null,
        destination: null,
        stationCode: null,
        date: null,
        trainNumber: null,
        trainName: null,
        classType: null,
        quota: isTatkal ? "TQ" : "GN",
      },
    };
  }

  // Station disambiguation
  if (parsed.entities?.source) {
    const resolved = resolveStation(parsed.entities.source);
    parsed.entities.source = resolved.name;
    if (resolved.code && !parsed.entities.stationCode) {
      parsed.entities.stationCode = resolved.code;
    }
  }

  if (parsed.entities?.destination) {
    const resolved = resolveStation(parsed.entities.destination);
    parsed.entities.destination = resolved.name;
  }

  return parsed;
}

function minutesFromTime(value) {
  if (!value) return 0;
  const match = String(value).match(/(\d{1,2})[\D]*:[\D]*(\d{2})/);
  if (!match) return 0;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (String(value).toLowerCase().includes("pm") && hours < 12) hours += 12;
  if (String(value).toLowerCase().includes("am") && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function rankTrain(train, { from, to, date, classType }) {
  let score = 0;
  const weekday = date ? getWeekdayForDate(date) : null;

  score += scorePlaceSimilarity(train.source, from);
  score += scorePlaceSimilarity(train.destination, to);

  if (weekday && Array.isArray(train.runningDays) && train.runningDays.includes(weekday)) {
    score += 60;
  }

  if (train.classes && train.classes.some((item) => item.type === classType)) {
    score += 25;
  }

  score += Math.max(0, 30 - Math.abs(minutesFromTime(train.departureTime) - 480) / 30);

  if (isPlaceMatch(train.source, from)) {
    score += 30;
  }

  if (isPlaceMatch(train.destination, to)) {
    score += 30;
  }

  return score;
}

function buildTrainResult(train, classType, date, score) {
  const fareBreakdown = buildFareBreakdown({ train, classType, date });
  const irctcUrl = new URL("https://www.irctc.co.in/nget/train-search");
  irctcUrl.searchParams.set("trainNo", train.trainNo || train.trainNumber || "");
  irctcUrl.searchParams.set("from", train.sourceCode || normalizePlace(train.source).toUpperCase().slice(0, 4));
  irctcUrl.searchParams.set("to", train.destinationCode || normalizePlace(train.destination).toUpperCase().slice(0, 4));
  irctcUrl.searchParams.set("doj", date || "");
  irctcUrl.searchParams.set("class", fareBreakdown.classType);

  const standardClasses = ["1A", "2A", "3A", "SL"];
  let finalClasses = [...(train.classes || [])];

  if (finalClasses.length <= 1) {
    const baseSL = finalClasses.find((c) => c.type === "SL")?.baseFare || 300;
    standardClasses.forEach((cls) => {
      if (!finalClasses.some((c) => c.type === cls)) {
        const mult = cls === "3A" ? 2.6 : cls === "2A" ? 3.8 : cls === "1A" ? 6.5 : 1.0;
        finalClasses.push({
          type: cls,
          baseFare: Math.round(baseSL * mult),
          reservationCharge: cls === "SL" ? 25 : cls === "3A" ? 45 : cls === "2A" ? 60 : 75,
          dynamicMultiplier: 1,
        });
      }
    });
    finalClasses.sort((a, b) => standardClasses.indexOf(a.type) - standardClasses.indexOf(b.type));
  }

  return {
    trainNo: train.trainNo || train.trainNumber,
    trainName: train.trainName,
    source: train.source,
    destination: train.destination,
    sourceCode: train.sourceCode,
    destinationCode: train.destinationCode,
    departureTime: train.departureTime,
    arrivalTime: train.arrivalTime,
    duration: train.duration,
    runningDays: train.runningDays || train.days || [],
    distanceKm: train.distanceKm || 500,
    classType: fareBreakdown.classType,
    fare: fareBreakdown.total,
    fareBreakdown,
    classes: finalClasses,
    intermediateStations: train.intermediateStations || [],
    routePolyline: train.routePolyline || [],
    score: Number((score || 0).toFixed(3)),
    bookingUrl: irctcUrl.toString(),
  };
}

/**
 * 4.3 MongoDB Retrieval + Semantic Vector Search
 */
export async function retrieveLocalTrains({ from, to, date, classType = "SL", trainNumber = null, limit = 10 }) {
  try {
    let trains = [];

    if (trainNumber) {
      trains = await TrainSchedule.find({ trainNo: String(trainNumber).trim() }).lean();
    }

    if (!trains.length && (from || to)) {
      const allTrains = await TrainSchedule.find().lean();
      const queryText = `${from || ""} ${to || ""} ${date || ""} ${classType || ""}`.trim();
      const queryEmbedding = await embedText(queryText);

      trains = allTrains
        .map((train) => {
          let semanticScore = 0;
          if (Array.isArray(train.embedding) && train.embedding.length === queryEmbedding.length) {
            semanticScore = cosineSimilarity(queryEmbedding, train.embedding);
          }
          const rerankScore = rankTrain(train, { from, to, date, classType });
          const totalScore = semanticScore * 100 + rerankScore;
          return buildTrainResult(train, classType, date, totalScore);
        })
        .filter(
          (train) =>
            train.score > 35 ||
            (from && isPlaceMatch(train.source, from, 60)) ||
            (to && isPlaceMatch(train.destination, to, 60))
        )
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    }

    return trains;
  } catch (err) {
    console.warn("[RAG] Local DB retrieval error:", err.message);
    return [];
  }
}

/**
 * Core Train Search Endpoint Handler (preserving backward compatibility)
 */
export async function searchTrains({ from, to, date, classType = "SL", limit = 10 }) {
  const normalizedFrom = normalizePlace(from);
  const normalizedTo = normalizePlace(to);

  // 1. Check MongoDB RagCache
  try {
    const cached = await RagCache.findOne({
      from: normalizedFrom,
      to: normalizedTo,
      date,
      classType,
    }).lean();

    if (cached && Array.isArray(cached.trains) && cached.trains.length > 0) {
      let finalTrains = cached.trains.slice(0, limit);
      finalTrains = await attachAvailability(finalTrains, date, classType);
      const aiSummary = await buildSummary(finalTrains, from, to, date);
      return { results: finalTrains, aiSummary };
    }
  } catch (err) {
    console.warn("[RAG] Cache lookup failed:", err.message);
  }

  // 2. Attempt Live Web RAG Search
  const query = `trains from ${from} to ${to} on ${date} india`;
  const webContext = await searchWeb(query);

  let liveTrains = [];

  if (webContext) {
    const systemPrompt = `You are a strict data extraction engine for Indian Railways.
Extract a list of trains running between the given stations based ONLY on the provided context.
Return a JSON object strictly matching this schema:
{
  "trains": [
    {
      "trainNumber": "12345",
      "trainName": "Sample Express",
      "source": "Origin Station",
      "destination": "Dest Station",
      "departureTime": "08:00",
      "arrivalTime": "14:30",
      "duration": "6h 30m",
      "classes": [
        {"type": "SL", "baseFare": 300, "reservationCharge": 20, "dynamicMultiplier": 1},
        {"type": "3A", "baseFare": 800, "reservationCharge": 40, "dynamicMultiplier": 1},
        {"type": "2A", "baseFare": 1200, "reservationCharge": 50, "dynamicMultiplier": 1}
      ],
      "days": ["monday", "tuesday"]
    }
  ]
}
Rules:
- Do NOT hallucinate.
- Filter invalid results. Ensure trainNumber, departureTime, and arrivalTime exist.
- If unsure or no valid trains found, return {"trains": []}.`;

    try {
      const extracted = await extractStructuredData(systemPrompt, `Context:\n${webContext}`);
      if (extracted && Array.isArray(extracted.trains)) {
        liveTrains = extracted.trains
          .filter((t) => t.trainNumber && t.departureTime && t.arrivalTime)
          .map((t, idx) => {
            const score = 100 - idx;
            return buildTrainResult(
              {
                ...t,
                runningDays:
                  t.days && t.days.length
                    ? t.days
                    : ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
                classes:
                  t.classes || [{ type: classType, baseFare: 300, reservationCharge: 20, dynamicMultiplier: 1 }],
              },
              classType,
              date,
              score
            );
          });
      }
    } catch (err) {
      console.warn("[RAG] Web extraction failed:", err.message);
    }
  }

  let finalTrains = liveTrains;

  // 3. Fallback to Local MongoDB Data
  if (finalTrains.length === 0) {
    finalTrains = await retrieveLocalTrains({ from, to, date, classType, limit });
  } else {
    // Save live results to cache
    try {
      await RagCache.create({
        from: normalizedFrom,
        to: normalizedTo,
        date,
        classType,
        trains: finalTrains.slice(0, limit),
      });
    } catch (err) {
      console.warn("[RAG] Failed to cache live results:", err.message);
    }
  }

  // 4. Attach Availability & AI Summary
  finalTrains = await attachAvailability(finalTrains, date, classType);
  const aiSummary = await buildSummary(finalTrains, from, to, date);

  return { results: finalTrains, aiSummary };
}

async function buildSummary(finalTrains, from, to, date) {
  let aiSummary = "";
  if (finalTrains.length > 0) {
    const contextLines = finalTrains.slice(0, 3).map(
      (t) =>
        `- ${t.trainName} (${t.trainNo || t.trainNumber}) departs ${t.source} at ${t.departureTime}, arrives ${t.destination} at ${t.arrivalTime}. Fare: ₹${t.fare}. Available: ${t.availability?.available ? "Yes" : "Live seat status unverified"}`
    );
    const context = `Available Trains:\n${contextLines.join("\n")}`;
    const systemPrompt =
      "You are a helpful travel assistant for RouteWise. Summarize the best train options for the user based ONLY on the provided context. Keep it under 3 sentences, be conversational and helpful.";
    const userPrompt = `User is looking for a train from ${from} to ${to} on ${date}.\n\nContext:\n${context}`;

    try {
      aiSummary = await generateChatResponse(systemPrompt, userPrompt);
    } catch {
      aiSummary = "Here are the top trains we found for your route.";
    }
  } else {
    aiSummary = `We couldn't find any direct trains from ${from} to ${to} for this date.`;
  }
  return aiSummary;
}

/**
 * 4.4 - 4.9: Comprehensive RAG Query Answering Pipeline
 * Handles any user travel question, intent classification, entity extraction,
 * multi-source retrieval (live Serper web search + local MongoDB train database),
 * grounding validation, hallucination prevention, and structured output.
 */
export async function processRagQuery(userQuery, options = {}) {
  const query = String(userQuery || "").trim();
  if (!query) {
    return {
      success: false,
      message: "Query cannot be empty",
      answer: "Please ask a question regarding trains, routes, or transport in India.",
      intent: "unknown",
      entities: {},
      retrievedData: [],
      sources: [],
      confidence: "low",
      dataFreshness: { retrievedAt: new Date().toISOString(), isLive: false },
      provider: "none",
      cached: false,
    };
  }

  // 1. Check cache for exact question
  const queryHash = crypto.createHash("md5").update(query.toLowerCase()).digest("hex");
  try {
    const cachedEntry = await RagCache.findOne({ queryHash }).lean();
    if (cachedEntry && cachedEntry.response) {
      return {
        ...cachedEntry.response,
        cached: true,
      };
    }
  } catch (err) {
    console.warn("[RAG] Cache lookup failed:", err.message);
  }

  // 2. Query Understanding & Entity Extraction
  const { intent, entities } = await understandQuery(query);

  // If query is unrelated to travel/transport, answer politely without fetching trains
  if (intent === "unrelated") {
    const generalResponse = await callLLM({
      systemPrompt:
        "You are RouteWise AI, a helpful assistant specializing in Indian transport, trains, and routes. Answer general questions politely, then remind the user that your primary expertise is Indian railway and route optimization.",
      userPrompt: query,
      json: false,
      temperature: 0.7,
    });

    const result = {
      success: true,
      answer: generalResponse?.rawContent?.trim() || "I am RouteWise AI, specialized in Indian transport, fares, and route optimization.",
      intent: "unrelated",
      entities,
      retrievedData: [],
      sources: [],
      confidence: "high",
      dataFreshness: { retrievedAt: new Date().toISOString(), isLive: false },
      provider: generalResponse?.provider || "fallback",
      cached: false,
    };

    return result;
  }

  // 3. Multi-Source Retrieval: Web (Serper) + MongoDB Train Database
  const sources = [];
  let webSnippets = "";
  let retrievedTrains = [];

  // Live web search targeted to query & entities
  const webSearchQuery = [
    entities?.trainNumber ? `train ${entities.trainNumber}` : "",
    entities?.source && entities?.destination ? `trains from ${entities.source} to ${entities.destination}` : "",
    entities?.quota === "TQ" ? "tatkal quota rules booking" : "",
    entities?.date ? `on ${entities.date}` : "",
    "indian railways",
  ]
    .filter(Boolean)
    .join(" ") || query;

  try {
    const webData = await searchWeb(webSearchQuery);
    if (webData) {
      webSnippets = webData.slice(0, 3000);
      sources.push({
        title: "Indian Railways / Serper Web Search Results",
        url: "https://www.irctc.co.in",
        snippet: webData.slice(0, 300),
      });
    }
  } catch (err) {
    console.warn("[RAG] Web search error:", err.message);
  }

  // MongoDB train database retrieval
  if (entities?.source || entities?.destination || entities?.trainNumber) {
    retrievedTrains = await retrieveLocalTrains({
      from: entities.source,
      to: entities.destination,
      date: entities.date,
      classType: entities.classType || "SL",
      trainNumber: entities.trainNumber,
      limit: 5,
    });

    if (retrievedTrains.length > 0) {
      sources.push({
        title: "RouteWise Master Indian Railway Database",
        url: "/api/trains",
        snippet: `Retrieved ${retrievedTrains.length} matching train schedules: ${retrievedTrains.map((t) => `${t.trainName} (${t.trainNo})`).join(", ")}`,
      });
    }
  }

  // 4. Grounded Context Construction
  const contextParts = [];

  if (entities?.source || entities?.destination) {
    contextParts.push(`Extracted Journey: ${entities.source || "Any"} → ${entities.destination || "Any"} (${entities.date || "Date unselected"})`);
  }

  if (retrievedTrains.length > 0) {
    contextParts.push("Verified Database Trains:\n" + retrievedTrains.map((t) => `- ${t.trainName} (${t.trainNo}): Departs ${t.source} (${t.departureTime}) → Arrives ${t.destination} (${t.arrivalTime}), Duration ${t.duration}, Base Fare ₹${t.fare}, Classes: ${t.classes.map((c) => c.type).join(", ")}`).join("\n"));
  }

  if (webSnippets) {
    contextParts.push(`Web Search Context:\n${webSnippets}`);
  }

  const combinedContext = contextParts.join("\n\n");

  // 5. LLM Grounded Generation & Validation
  const systemPrompt = `You are RouteWise AI, the premier verified Indian transport and railway advisor.
Answer the user's travel question using ONLY the provided context and verified Indian Railway rules.

STRICT GROUNDING & ACCURACY RULES:
1. Ground every train number, schedule, station, and fare directly in the provided context.
2. NEVER invent fake train numbers, seat counts, confirmation percentages, or berth numbers.
3. If seat availability or confirmation status is not verified in the context, explicitly explain: "Live seat availability requires direct IRCTC credentials or official booking portal access."
4. If asked about Tatkal, explain the official rules: Tatkal opens at 10:00 AM for AC classes (1A, 2A, 3A, CC) and 11:00 AM for Non-AC classes (SL) 1 day prior to the train journey originating station date. Premium Tatkal uses dynamic pricing.
5. If asked about Waitlist (WL/RAC) confirmation chances, explain that confirmation depends on cancellations, quota release, and chart preparation (4 hours prior to departure); never promise 100% confirmation.
6. Clearly distinguish verified database schedules from estimated travel fares.
7. If critical information is missing to answer the user's specific request (e.g. missing date or class), state what information is needed.
8. Be concise, structured, professional, and directly useful.`;

  const userPrompt = `User Question: "${query}"\nIntent: ${intent}\n\nContext:\n${combinedContext || "No direct train records or web snippets found for this specific query."}`;

  let generated = await callLLM({
    systemPrompt,
    userPrompt,
    json: false,
    temperature: 0.2,
  });

  let answerText = generated?.rawContent?.trim();
  if (!answerText) {
    answerText = "Reliable information is currently unavailable for this query. Please verify details on the official IRCTC portal.";
  }

  const confidence = retrievedTrains.length > 0 || webSnippets.length > 0 ? "high" : "medium";
  const isLive = Boolean(webSnippets && sources.length > 0);

  const responsePayload = {
    success: true,
    answer: answerText,
    intent,
    entities,
    retrievedData: retrievedTrains,
    sources,
    confidence,
    dataFreshness: {
      retrievedAt: new Date().toISOString(),
      isLive,
    },
    provider: generated?.provider || "fallback",
    cached: false,
  };

  // Cache response for future queries if provider succeeded
  if (generated && generated.provider && answerText.length > 30) {
    try {
      await RagCache.create({
        queryHash,
        query,
        intent,
        entities,
        response: responsePayload,
      });
    } catch (err) {
      console.warn("[RAG] Failed to cache query response:", err.message);
    }
  }

  return responsePayload;
}

export async function getTrainSchedule(trainNo) {
  return TrainSchedule.findOne({ trainNo }).lean();
}
