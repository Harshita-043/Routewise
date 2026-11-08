import { Router } from "express";
import { processRagQuery, understandQuery } from "../services/ragService.js";

const router = Router();

/**
 * POST /api/rag/query
 * Main entry point for Retrieval-Augmented Generation (RAG) query processing.
 */
router.post("/query", async (req, res) => {
  const { query, options = {} } = req.body || {};

  if (!query || typeof query !== "string" || !query.trim()) {
    return res.status(400).json({
      success: false,
      message: "A non-empty query string is required in the request body.",
      code: "INVALID_QUERY",
    });
  }

  try {
    const result = await processRagQuery(query.trim(), options);
    return res.json(result);
  } catch (error) {
    console.error("[rag/query] Error processing query:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while processing the RAG query.",
      code: "RAG_PROCESSING_ERROR",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/**
 * POST /api/rag/understand
 * Intent classification and entity extraction endpoint.
 */
router.post("/understand", async (req, res) => {
  const { query } = req.body || {};

  if (!query || typeof query !== "string") {
    return res.status(400).json({ error: "query string is required" });
  }

  try {
    const result = await understandQuery(query.trim());
    return res.json(result);
  } catch (error) {
    return res.status(500).json({ error: "Intent extraction failed" });
  }
});

/**
 * GET /api/rag/capabilities
 * Returns documented RAG capabilities, supported intents, and active providers.
 */
router.get("/capabilities", (_req, res) => {
  res.json({
    intents: [
      "train_schedule",
      "train_availability",
      "tatkal_availability",
      "waitlist_rac",
      "train_route",
      "pnr_status",
      "train_live_status",
      "fare_comparison",
      "general_travel",
      "unrelated",
    ],
    providers: {
      primary: "openai",
      fallback1: "groq",
      fallback2: "together",
    },
    searchEngine: "serper",
    database: "mongodb_vector",
  });
});

export default router;
