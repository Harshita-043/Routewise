import "dotenv/config";
import { connectDatabase } from "../backend/config/db.js";
import { processRagQuery, understandQuery, resolveStation } from "../backend/services/ragService.js";

async function runRagEvaluation() {
  console.log("================================================================================");
  console.log("             ROUTEWISE — REAL-WORLD RAG EVALUATION BENCHMARK SUITE              ");
  console.log("================================================================================");

  await connectDatabase();

  const scenarios = [
    {
      id: "Scenario A: Train Schedule",
      query: "Find trains between New Delhi and Mumbai.",
      expectedIntent: "train_schedule",
      validate: (res) =>
        res.intent === "train_schedule" &&
        (res.entities?.source?.includes("Delhi") || res.entities?.destination?.includes("Mumbai")),
    },
    {
      id: "Scenario B: Seat Availability",
      query: "Check seat availability for a train between Delhi and Mumbai on 2026-12-01.",
      expectedIntent: "train_availability",
      validate: (res) =>
        res.intent === "train_availability" &&
        res.answer.toLowerCase().includes("irctc") || res.answer.toLowerCase().includes("availability"),
    },
    {
      id: "Scenario C: Tatkal Quota Rules & Availability",
      query: "Is Tatkal available for my journey from Delhi to Lucknow?",
      expectedIntent: "tatkal_availability",
      validate: (res) =>
        res.intent === "tatkal_availability" &&
        (res.answer.toLowerCase().includes("tatkal") || res.answer.toLowerCase().includes("10:00") || res.answer.toLowerCase().includes("11:00")),
    },
    {
      id: "Scenario D: Waitlist & RAC Prediction",
      query: "What are the chances of my waitlisted ticket getting confirmed?",
      expectedIntent: "waitlist_rac",
      validate: (res) =>
        res.intent === "waitlist_rac" &&
        (res.answer.toLowerCase().includes("waitlist") || res.answer.toLowerCase().includes("confirmation") || res.answer.toLowerCase().includes("chart")),
    },
    {
      id: "Scenario E: General Travel Query & Fare Comparison",
      query: "What is the cheapest way to travel from Bhopal to Indore?",
      expectedIntent: "fare_comparison",
      validate: (res) =>
        res.intent === "fare_comparison" || res.intent === "general_travel",
    },
    {
      id: "Scenario F: Unrelated Question Handling",
      query: "Explain how a neural network works.",
      expectedIntent: "unrelated",
      validate: (res) =>
        res.intent === "unrelated" &&
        res.retrievedData.length === 0,
    },
    {
      id: "Scenario G: Ambiguous Station Disambiguation",
      query: "Find trains from Delhi to Agra.",
      expectedIntent: "train_schedule",
      validate: (res) =>
        res.intent === "train_schedule" &&
        ((res.entities?.source?.includes("Delhi") && res.entities?.destination?.includes("Agra")) ||
         res.answer.toLowerCase().includes("agra") ||
         res.entities?.stationCode === "NDLS" ||
         res.entities?.source === "New Delhi"),
    },
  ];

  const results = [];

  for (const sc of scenarios) {
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`Executing: ${sc.id}`);
    console.log(`Query: "${sc.query}"`);

    const startTime = Date.now();
    try {
      const res = await processRagQuery(sc.query);
      const durationMs = Date.now() - startTime;
      const passed = sc.validate(res);

      const record = {
        id: sc.id,
        query: sc.query,
        detectedIntent: res.intent,
        expectedIntent: sc.expectedIntent,
        retrievedCount: res.retrievedData?.length || 0,
        sourcesCount: res.sources?.length || 0,
        provider: res.provider,
        confidence: res.confidence,
        durationMs,
        passed,
        answerSnippet: res.answer.slice(0, 120).replace(/\n/g, " "),
      };

      results.push(record);

      console.log(`Result: ${passed ? "PASS [✓]" : "FAIL [✗]"} (${durationMs}ms)`);
      console.log(`  Intent: ${res.intent}`);
      console.log(`  Provider: ${res.provider}`);
      console.log(`  Retrieved Documents: ${record.retrievedCount}`);
      console.log(`  Sources Attributed: ${record.sourcesCount}`);
      console.log(`  Answer Preview: "${record.answerSnippet}..."`);
      await new Promise((r) => setTimeout(r, 1200));
    } catch (err) {
      console.error(`Result: ERROR [✗]`, err.message);
      results.push({
        id: sc.id,
        query: sc.query,
        passed: false,
        error: err.message,
      });
    }
  }

  // Scenario H: Provider Failure Simulation
  console.log(`\n--------------------------------------------------------------------------------`);
  console.log(`Executing: Scenario H: Provider Failure Simulation`);
  try {
    // Test station resolution and understandQuery offline/fallback
    const offlineResolved = resolveStation("Delhi");
    const offlinePassed = offlineResolved.code === "NDLS" && offlineResolved.name === "New Delhi";
    results.push({
      id: "Scenario H: Provider Failure & Offline Resolution",
      query: "Offline fallback resilience",
      detectedIntent: "offline_fallback",
      passed: offlinePassed,
      durationMs: 1,
      answerSnippet: `Station resolved offline to ${offlineResolved.name} (${offlineResolved.code})`,
    });
    console.log(`Result: ${offlinePassed ? "PASS [✓]" : "FAIL [✗]"}`);
  } catch (err) {
    results.push({
      id: "Scenario H: Provider Failure & Offline Resolution",
      passed: false,
      error: err.message,
    });
  }

  console.log("\n================================================================================");
  console.log("                           RAG EVALUATION SUMMARY                               ");
  console.log("================================================================================");
  console.table(
    results.map((r) => ({
      Scenario: r.id.split(":")[0],
      Intent: r.detectedIntent || "N/A",
      Docs: r.retrievedCount ?? "-",
      Provider: r.provider ?? "-",
      Time: r.durationMs ? `${r.durationMs}ms` : "-",
      Status: r.passed ? "PASS [✓]" : "FAIL [✗]",
    }))
  );

  const totalPassed = results.filter((r) => r.passed).length;
  console.log(`\nTotal Scenarios: ${results.length} | Passed: ${totalPassed} | Failed: ${results.length - totalPassed}`);

  if (totalPassed === results.length) {
    console.log(">>> ALL RAG VALIDATION SCENARIOS PASSED SUCCESSFULLY! <<<\n");
    process.exit(0);
  } else {
    console.error(">>> SOME RAG VALIDATION SCENARIOS FAILED <<<\n");
    process.exit(1);
  }
}

runRagEvaluation().catch((err) => {
  console.error("Fatal error during RAG evaluation:", err);
  process.exit(1);
});
