import { TrainSchedule } from "../models/TrainSchedule.js";
import { embedText, cosineSimilarity } from "./embeddingService.js";
import { buildFareBreakdown } from "./fareEngine.js";
import { attachAvailability } from "./trainAvailabilityService.js";
import { getWeekdayForDate, isPlaceMatch, normalizePlace, scorePlaceSimilarity } from "../utils/utils.js";

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

  if (train.classes.some((item) => item.type === classType)) {
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
  irctcUrl.searchParams.set("trainNo", train.trainNo);
  irctcUrl.searchParams.set("from", train.sourceCode || normalizePlace(train.source).toUpperCase().slice(0, 4));
  irctcUrl.searchParams.set("to", train.destinationCode || normalizePlace(train.destination).toUpperCase().slice(0, 4));
  irctcUrl.searchParams.set("doj", date || "");
  irctcUrl.searchParams.set("class", fareBreakdown.classType);

  return {
    trainNo: train.trainNo,
    trainName: train.trainName,
    source: train.source,
    destination: train.destination,
    sourceCode: train.sourceCode,
    destinationCode: train.destinationCode,
    departureTime: train.departureTime,
    arrivalTime: train.arrivalTime,
    duration: train.duration,
    runningDays: train.runningDays,
    distanceKm: train.distanceKm,
    classType: fareBreakdown.classType,
    fare: fareBreakdown.total,
    fareBreakdown,
    classes: train.classes,
    intermediateStations: train.intermediateStations,
    routePolyline: train.routePolyline,
    score: Number(score.toFixed(3)),
    bookingUrl: irctcUrl.toString(),
  };
}

import { generateChatResponse, extractStructuredData } from "./openaiService.js";
import { searchWeb } from "./webSearchService.js";

export async function searchTrains({ from, to, date, classType = "SL", limit = 10 }) {
  // 1. Attempt Live Web RAG Search
  console.log(`[RAG] Searching web for trains from ${from} to ${to} on ${date}...`);
  const query = `live train schedule from ${from} to ${to} ${date || ""}`;
  const webContext = await searchWeb(query);
  
  let liveTrains = [];
  
  if (webContext) {
    const systemPrompt = `You are a real-time data extraction engine for Indian Railways.
The user provides you with raw text snippets from a live web search.
Extract a list of trains running between the given stations.
Return a JSON object strictly matching this schema:
{
  "trains": [
    {
      "trainNo": "12345",
      "trainName": "Sample Express",
      "source": "Origin Station",
      "destination": "Dest Station",
      "departureTime": "08:00",
      "arrivalTime": "14:30",
      "duration": "6h 30m",
      "distanceKm": 500,
      "classes": [{"type": "SL", "baseFare": 300, "reservationCharge": 20, "dynamicMultiplier": 1}]
    }
  ]
}
If no trains are found, return {"trains": []}. Be as accurate as possible using the search context.`;
    
    try {
      const extracted = await extractStructuredData(systemPrompt, `Snippets:\n${webContext}`);
      if (extracted && Array.isArray(extracted.trains) && extracted.trains.length > 0) {
        liveTrains = extracted.trains.map((t, idx) => {
          const score = 100 - idx; // Rank them in order of extraction
          return buildTrainResult({
            ...t,
            runningDays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
            intermediateStations: [],
            routePolyline: []
          }, classType, date, score);
        });
        console.log(`[RAG] Successfully extracted ${liveTrains.length} live trains from web!`);
      }
    } catch (err) {
      console.error("[RAG] Web extraction failed:", err);
    }
  }

  // 2. Fallback to Local MongoDB Seed Data if Web RAG fails
  let finalTrains = liveTrains;
  if (finalTrains.length === 0) {
    console.log("[RAG] Falling back to local MongoDB seed data...");
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
  } else {
    // Limit live trains
    finalTrains = finalTrains.slice(0, limit);
  }

  // Attach availability (this will use our simulated provider now)
  finalTrains = await attachAvailability(finalTrains, date, classType);

  // 3. Build AI Summary Context
  let aiSummary = "";
  if (finalTrains.length > 0) {
    const contextLines = finalTrains.slice(0, 3).map(
      (t) => `- ${t.trainName} (${t.trainNo}) departs ${t.source} at ${t.departureTime}, arrives ${t.destination} at ${t.arrivalTime}. Fare: ₹${t.fare}. Available: ${t.availability?.available ? "Yes" : "No"}`
    );
    const context = `Available Trains:\n${contextLines.join("\n")}`;
    const systemPrompt = "You are a helpful travel assistant for RouteWise. Summarize the best train options for the user based ONLY on the provided context. Keep it under 3 sentences, be conversational and helpful.";
    const userPrompt = `User is looking for a train from ${from} to ${to} on ${date}.\n\nContext:\n${context}`;
    
    try {
      aiSummary = await generateChatResponse(systemPrompt, userPrompt);
    } catch (err) {
      console.error("OpenAI summary generation failed:", err);
      aiSummary = "Here are the top trains we found for your route.";
    }
  } else {
    aiSummary = `We couldn't find any direct trains from ${from} to ${to} for this date.`;
  }

  return { results: finalTrains, aiSummary };
}

export async function getTrainSchedule(trainNo) {
  return TrainSchedule.findOne({ trainNo }).lean();
}
