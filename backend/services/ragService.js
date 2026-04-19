import { TrainSchedule } from "../models/TrainSchedule.js";
import { RagCache } from "../models/RagCache.js";
import { embedText, cosineSimilarity } from "./embeddingService.js";
import { buildFareBreakdown } from "./fareEngine.js";
import { attachAvailability } from "./trainAvailabilityService.js";
import { getWeekdayForDate, isPlaceMatch, normalizePlace, scorePlaceSimilarity } from "../utils/utils.js";
import { generateChatResponse, extractStructuredData } from "./llmService.js";
import { searchWeb } from "./webSearchService.js";

function minutesFromTime(value) {
  const [hours = "0", minutes = "0"] = String(value).split(":");
  return Number(hours) * 60 + Number(minutes);
}

function buildSearchText({ from, to, date, classType }) {
  return `${from} ${to} ${date || ""} ${classType || ""}`.trim();
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
  irctcUrl.searchParams.set("trainNo", train.trainNo || train.trainNumber);
  irctcUrl.searchParams.set("from", train.sourceCode || normalizePlace(train.source).toUpperCase().slice(0, 4));
  irctcUrl.searchParams.set("to", train.destinationCode || normalizePlace(train.destination).toUpperCase().slice(0, 4));
  irctcUrl.searchParams.set("doj", date || "");
  irctcUrl.searchParams.set("class", fareBreakdown.classType);

  const standardClasses = ["1A", "2A", "3A", "SL"];
  let finalClasses = [...(train.classes || [])];
  
  // If the train only has 1 or 0 classes (e.g. from a lazy RAG extraction), auto-populate standard ones
  if (finalClasses.length <= 1) {
    const baseSL = finalClasses.find(c => c.type === "SL")?.baseFare || 300;
    standardClasses.forEach(cls => {
      if (!finalClasses.some(c => c.type === cls)) {
        // Multipliers: 3A=2.6, 2A=3.8, 1A=6.5
        const mult = cls === "3A" ? 2.6 : cls === "2A" ? 3.8 : cls === "1A" ? 6.5 : 1.0;
        finalClasses.push({
          type: cls,
          baseFare: Math.round(baseSL * mult),
          reservationCharge: cls === "SL" ? 25 : cls === "3A" ? 45 : cls === "2A" ? 60 : 75,
          dynamicMultiplier: 1
        });
      }
    });
    // Sort by class hierarchy (1A -> 2A -> 3A -> SL)
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

export async function searchTrains({ from, to, date, classType = "SL", limit = 10 }) {
  // 1. Check MongoDB RagCache
  console.log(`[RAG] Checking cache for trains from ${from} to ${to} on ${date}...`);
  const normalizedFrom = normalizePlace(from);
  const normalizedTo = normalizePlace(to);

  const cached = await RagCache.findOne({
    from: normalizedFrom,
    to: normalizedTo,
    date,
    classType
  }).lean();

  if (cached && Array.isArray(cached.trains) && cached.trains.length > 0) {
    console.log("[RAG] Cache hit! Returning instant results.");
    let finalTrains = cached.trains.slice(0, limit);
    finalTrains = await attachAvailability(finalTrains, date, classType);
    const aiSummary = await buildSummary(finalTrains, from, to, date);
    return { results: finalTrains, aiSummary };
  }

  // 2. Attempt Live Web RAG Search
  console.log(`[RAG] Cache miss. Searching web for trains from ${from} to ${to} on ${date}...`);
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
- Extract ALL available travel classes (e.g., SL, 3A, 2A, 1A, CC) and their respective fares if present in the context. If not present, try to estimate reasonably based on standard Indian Railway fares for the distance.
- If unsure or no valid trains found, return {"trains": []}.`;
    
    try {
      const extracted = await extractStructuredData(systemPrompt, `Context:\n${webContext}`);
      if (extracted && Array.isArray(extracted.trains)) {
        liveTrains = extracted.trains.filter(t => t.trainNumber && t.departureTime && t.arrivalTime).map((t, idx) => {
          const score = 100 - idx; // Rank them in order of extraction
          return buildTrainResult({
            ...t,
            runningDays: t.days && t.days.length ? t.days : ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
            classes: t.classes || [{type: classType, baseFare: 300, reservationCharge: 20, dynamicMultiplier: 1}]
          }, classType, date, score);
        });
        console.log(`[RAG] Successfully extracted ${liveTrains.length} valid live trains from web!`);
      }
    } catch (err) {
      console.error("[RAG] Web extraction failed:", err);
    }
  }

  let finalTrains = liveTrains;

  // 3. Fallback to Local MongoDB Data if Web RAG completely fails
  if (finalTrains.length === 0) {
    console.log("[RAG] Web Search/Extraction failed or returned 0 results. Falling back to high-coverage local MongoDB data...");
    try {
      const queryEmbedding = await embedText(buildSearchText({ from, to, date, classType }));
      const trains = await TrainSchedule.find().lean();

      finalTrains = trains
        .map((train) => {
          const semanticScore = cosineSimilarity(queryEmbedding, train.embedding || []);
          const rerankScore = rankTrain(train, { from, to, date, classType });
          const totalScore = semanticScore * 100 + rerankScore;
          return buildTrainResult(train, classType, date, totalScore);
        })
        .filter((train) => train.score > 40 || (isPlaceMatch(train.source, from, 65) && isPlaceMatch(train.destination, to, 65)))
        .sort((left, right) => right.score - left.score)
        .slice(0, limit);
    } catch(err) {
      console.error("[RAG] Fallback MongoDB search failed:", err);
    }
  } else {
    // 4. Save successful RAG result to cache
    finalTrains = finalTrains.slice(0, limit);
    try {
      await RagCache.create({
        from: normalizedFrom,
        to: normalizedTo,
        date,
        classType,
        trains: finalTrains
      });
      console.log("[RAG] Saved live results to cache.");
    } catch (err) {
      console.error("[RAG] Failed to cache results:", err);
    }
  }

  // 5. Build Final Output
  finalTrains = await attachAvailability(finalTrains, date, classType);
  const aiSummary = await buildSummary(finalTrains, from, to, date);

  return { results: finalTrains, aiSummary };
}

async function buildSummary(finalTrains, from, to, date) {
  let aiSummary = "";
  if (finalTrains.length > 0) {
    const contextLines = finalTrains.slice(0, 3).map(
      (t) => `- ${t.trainName} (${t.trainNo || t.trainNumber}) departs ${t.source} at ${t.departureTime}, arrives ${t.destination} at ${t.arrivalTime}. Fare: ₹${t.fare}. Available: ${t.availability?.available ? "Yes" : "No"}`
    );
    const context = `Available Trains:\n${contextLines.join("\n")}`;
    const systemPrompt = "You are a helpful travel assistant for RouteWise. Summarize the best train options for the user based ONLY on the provided context. Keep it under 3 sentences, be conversational and helpful.";
    const userPrompt = `User is looking for a train from ${from} to ${to} on ${date}.\n\nContext:\n${context}`;
    
    try {
      aiSummary = await generateChatResponse(systemPrompt, userPrompt);
    } catch (err) {
      console.error("[RAG] Summary generation failed:", err);
      aiSummary = "Here are the top trains we found for your route.";
    }
  } else {
    aiSummary = `We couldn't find any direct trains from ${from} to ${to} for this date.`;
  }
  return aiSummary;
}

export async function getTrainSchedule(trainNo) {
  return TrainSchedule.findOne({ trainNo }).lean();
}
