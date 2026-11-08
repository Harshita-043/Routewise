import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

import { connectDatabase } from "../backend/config/db.js";
import { embedText, fallbackEmbedding, cosineSimilarity, isEmbeddingCompatible } from "../backend/services/embeddingService.js";
import { cleanAndParseJson, callLLM } from "../backend/services/llmService.js";
import { searchWeb } from "../backend/services/webSearchService.js";
import { resolveStation, searchTrains, processRagQuery } from "../backend/services/ragService.js";
import { searchTransportOptions } from "../backend/services/searchService.js";
import { getTrainAvailability } from "../backend/services/trainAvailabilityService.js";
import { getPnrStatus, getTrainLiveStatus } from "../backend/services/trainStatusService.js";
import { haversineDistanceKm, normalizePlace } from "../backend/utils/utils.js";
import { getFallbackLocationSuggestions } from "../backend/utils/fallbackModule.js";
import { signupUser, loginUser } from "../backend/services/authService.js";
import { User } from "../backend/models/User.js";
import { RagCache } from "../backend/models/RagCache.js";

test("Suite 1: Database Connection", async (t) => {
  await t.test("MongoDB connection succeeds", async () => {
    const conn = await connectDatabase();
    assert.ok(conn, "Database connection should exist");
    assert.strictEqual(mongoose.connection.readyState, 1, "Mongoose state should be connected (1)");
  });
});

test("Suite 2: Embedding Service & Vector Mathematics", async (t) => {
  await t.test("fallbackEmbedding produces 256-dimensional normalized vector", () => {
    const vector = fallbackEmbedding("New Delhi to Mumbai Central Superfast");
    assert.strictEqual(vector.length, 256, "Vector must be 256 dimensions");
    const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    assert.ok(Math.abs(magnitude - 1.0) < 0.001, "Vector must be unit normalized");
  });

  await t.test("cosineSimilarity calculates exact similarity for identical vectors", () => {
    const vecA = fallbackEmbedding("Delhi Jaipur Express");
    const sim = cosineSimilarity(vecA, vecA);
    assert.ok(Math.abs(sim - 1.0) < 0.001, "Identical vector cosine similarity should be 1.0");
  });

  await t.test("cosineSimilarity strictly rejects mismatched dimensions", () => {
    const vec256 = new Array(256).fill(0.1);
    const vec1536 = new Array(1536).fill(0.1);
    const sim = cosineSimilarity(vec256, vec1536);
    assert.strictEqual(sim, 0, "Mismatched vector lengths must return 0 similarity");
    assert.strictEqual(isEmbeddingCompatible(vec256, vec1536), false, "Incompatible dimensions detected");
  });
});

test("Suite 3: LLM Resilience, JSON Parsing & Multi-Provider Fallback", async (t) => {
  await t.test("cleanAndParseJson extracts JSON from raw text and markdown fences", () => {
    const fenced = "```json\n{\"status\": \"ok\", \"count\": 42}\n```";
    assert.deepStrictEqual(cleanAndParseJson(fenced), { status: "ok", count: 42 });

    const withPreamble = "Here is your requested JSON object:\n{\"city\": \"Delhi\"}\nHope this helps!";
    assert.deepStrictEqual(cleanAndParseJson(withPreamble), { city: "Delhi" });

    assert.strictEqual(cleanAndParseJson("Not JSON at all"), null);
  });

  await t.test("callLLM recovers through provider fallback (Groq)", async () => {
    const res = await callLLM({
      systemPrompt: "You are a test harness assistant. Return JSON only.",
      userPrompt: "Output valid JSON: {\"testPassed\": true}",
      json: true,
      temperature: 0.1,
    });

    assert.ok(res, "LLM must return a response");
    assert.ok(res.data, "Parsed JSON data must exist");
    assert.strictEqual(res.data.testPassed, true, "Extracted testPassed field must match");
    assert.ok(res.provider, "Provider name must be identified");
  });
});

test("Suite 4: Station Normalization & Geocoding", async (t) => {
  await t.test("resolveStation disambiguates major Indian railway hubs", () => {
    const delhi = resolveStation("delhi");
    assert.strictEqual(delhi.name, "New Delhi");
    assert.strictEqual(delhi.code, "NDLS");

    const mumbai = resolveStation("mumbai central");
    assert.strictEqual(mumbai.name, "Mumbai Central");
    assert.strictEqual(mumbai.code, "BCT");
  });

  await t.test("getFallbackLocationSuggestions returns coordinates for Indian cities", () => {
    const results = getFallbackLocationSuggestions("Delhi");
    assert.ok(results.length > 0, "Should return at least one suggestion for Delhi");
    assert.ok(results[0].lat !== undefined && results[0].lon !== undefined, "Suggestions must include lat and lon");
  });

  await t.test("haversineDistanceKm computes distance between known coordinates", () => {
    // Delhi (28.6139, 77.2090) to Jaipur (26.9124, 75.7873) is ~240 km straight line
    const dist = haversineDistanceKm({ lat: 28.6139, lng: 77.2090 }, { lat: 26.9124, lng: 75.7873 });
    assert.ok(dist > 220 && dist < 260, `Distance was ${dist}, expected ~240km`);
  });
});

test("Suite 5: Multi-Modal Transport Search", async (t) => {
  await t.test("searchTransportOptions returns categorized results for Delhi to Jaipur", async () => {
    const res = await searchTransportOptions({ from: "Delhi", to: "Jaipur", date: "2026-11-20" });
    assert.ok(res.results, "Results map must exist");
    assert.ok(Array.isArray(res.results.train), "Train options array must exist");
    assert.ok(Array.isArray(res.results.bus), "Bus options array must exist");
    assert.ok(Array.isArray(res.results.taxi), "Taxi options array must exist");
    assert.ok(Array.isArray(res.results.carpool), "Carpool options array must exist");
    assert.ok(res.results.train.length > 0, "Should find at least 1 train between Delhi and Jaipur");
    assert.ok(res.results.taxi.length > 0, "Should find at least 1 taxi option");
  });
});

test("Suite 6: Train Availability & PNR Status", async (t) => {
  await t.test("getTrainAvailability returns structured availability and honest status", async () => {
    const avail = await getTrainAvailability(
      { trainNo: "12002", trainName: "Bhopal Shatabdi", classes: [{ type: "CC", baseFare: 800 }] },
      "2026-11-20",
      "CC"
    );
    assert.ok(avail, "Availability record must be returned");
    assert.ok(avail.currentFare > 0, "Current fare must be computed");
    assert.ok(["rag", "unverified"].includes(avail.source), "Source must be rag or unverified");
  });

  await t.test("getPnrStatus validates PNR length and reports honest gateway integration state", async () => {
    await assert.rejects(async () => {
      await getPnrStatus("123");
    }, /10-digit PNR/);

    const validPnrCheck = await getPnrStatus("1234567890");
    assert.strictEqual(validPnrCheck.pnr, "1234567890");
    assert.strictEqual(validPnrCheck.status, "unavailable");
    assert.ok(validPnrCheck.message.includes("IRCTC"), "Must explain IRCTC gateway dependency");
  });
});

test("Suite 7: Authentication & Authorization Flow", async (t) => {
  const testEmail = `test_runner_${Date.now()}@routewise.in`;

  await t.test("signupUser registers user and returns valid JWT", async () => {
    const auth = await signupUser({
      name: "Test Runner",
      email: testEmail,
      phone: "9999988888",
      password: "StrongPassword123!",
    });

    assert.ok(auth.token, "JWT token must be returned");
    assert.strictEqual(auth.user.email, testEmail);
  });

  await t.test("loginUser verifies password and issues JWT", async () => {
    const auth = await loginUser({
      email: testEmail,
      password: "StrongPassword123!",
    });

    assert.ok(auth.token, "JWT token must be returned upon login");
    assert.strictEqual(auth.user.name, "Test Runner");
  });

  await t.test("loginUser rejects invalid password", async () => {
    await assert.rejects(async () => {
      await loginUser({
        email: testEmail,
        password: "WrongPassword!",
      });
    }, /Invalid email or password/);
  });

  // Cleanup test user
  await User.deleteOne({ email: testEmail });
});

test("Suite 8: RAG Query Processing & Caching", async (t) => {
  await t.test("processRagQuery handles general query and caches response", async () => {
    const query = `What is the best way to travel from Bhopal to Indore? (${Date.now()})`;
    const res1 = await processRagQuery(query);

    assert.strictEqual(res1.success, true);
    assert.ok(res1.answer.length > 20, "Answer must be generated");
    assert.ok(res1.intent, "Intent must be classified");
    assert.strictEqual(res1.cached, false, "First call should not be cached");

    // Second call with same query should hit cache
    const res2 = await processRagQuery(query);
    assert.strictEqual(res2.cached, true, "Subsequent call must be returned from cache");
    assert.strictEqual(res2.answer, res1.answer, "Cached answer must match");
  });
});

test.after(async () => {
  await mongoose.disconnect();
});
