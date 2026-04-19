import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { TrainSchedule } from "../models/TrainSchedule.js";
import { buildFareBreakdown } from "../services/fareEngine.js";
import { createPriceAlert, listUserRoutes, saveUserRoute } from "../services/routeMemoryService.js";
import { findNearbyStations } from "../services/stationService.js";
import { getPnrStatus, getTrainLiveStatus } from "../services/trainStatusService.js";
import { getTrainSchedule, searchTrains } from "../services/ragService.js";

const router = Router();

router.post("/search", async (req, res) => {
  const { from, to, date, classType = "SL" } = req.body || {};

  if (!from || !to || !date) {
    return res.status(400).json({ error: "from, to, and date are required" });
  }

  try {
    const { results, aiSummary } = await searchTrains({ from, to, date, classType });
    return res.json({
      query: { from, to, date, classType },
      results,
      aiSummary
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Train search failed",
    });
  }
});

router.get("/stations/nearby", async (req, res) => {
  const lat = req.query.lat ?? req.body?.lat;
  const lng = req.query.lng ?? req.body?.lng;
  const radiusKm = req.query.radiusKm ?? req.body?.radiusKm ?? 25;
  const destination = req.query.destination ?? req.body?.destination;

  if (lat == null || lng == null) {
    return res.status(400).json({ error: "lat and lng are required" });
  }

  const stations = await findNearbyStations({ lat, lng, radiusKm, destination });
  return res.json(stations);
});

router.get("/pnr-status/:pnr", async (req, res) => {
  try {
    const status = await getPnrStatus(req.params.pnr);
    return res.json(status);
  } catch {
    return res.status(502).json({ error: "Could not fetch PNR status" });
  }
});

router.get("/train-live-status/:trainNo/:date", async (req, res) => {
  try {
    const status = await getTrainLiveStatus(req.params.trainNo, req.params.date);
    return res.json(status);
  } catch {
    return res.status(502).json({ error: "Could not fetch live train status" });
  }
});

router.post("/alerts", async (req, res) => {
  const { email, trainNo, date, classType, targetFare, notifyOnSeatOpen } = req.body || {};

  if (!email || !trainNo || !date || !classType || targetFare == null) {
    return res.status(400).json({ error: "email, trainNo, date, classType, and targetFare are required" });
  }

  const alert = await createPriceAlert({
    email,
    trainNo,
    date,
    classType,
    targetFare,
    notifyOnSeatOpen,
  });

  return res.status(201).json(alert);
});

router.post("/saved-routes", requireAuth, async (req, res) => {
  const { from, to, date, classType } = req.body || {};

  if (!from || !to) {
    return res.status(400).json({ error: "from and to are required" });
  }

  const route = await saveUserRoute({
    userId: req.user.id,
    from,
    to,
    date,
    classType,
  });

  return res.status(201).json(route);
});

router.get("/saved-routes", requireAuth, async (req, res) => {
  const routes = await listUserRoutes(req.user.id);
  return res.json(routes);
});

router.post("/journey-planner", async (req, res) => {
  const { from, to, date, classType = "SL" } = req.body || {};

  if (!from || !to) {
    return res.status(400).json({ error: "from and to are required" });
  }

  const { results: trains } = await searchTrains({ from, to, date, classType, limit: 3 });
  return res.json({
    from,
    to,
    date,
    suggestions: trains.map((train) => ({
      train,
      metro: {
        mode: "metro",
        fare: 45,
        durationMinutes: 18,
      },
      auto: {
        mode: "auto",
        fare: 120,
        durationMinutes: 22,
      },
    })),
  });
});

router.get("/:trainNo/schedule", async (req, res) => {
  const train = await getTrainSchedule(req.params.trainNo);

  if (!train) {
    return res.status(404).json({ error: "Train not found" });
  }

  return res.json(train);
});

router.get("/:trainNo/fare", async (req, res) => {
  const train = await TrainSchedule.findOne({ trainNo: req.params.trainNo }).lean();

  if (!train) {
    return res.status(404).json({ error: "Train not found" });
  }

  const date = String(req.query.date || new Date().toISOString().split("T")[0]);
  const classType = String(req.query.classType || "SL");
  return res.json(buildFareBreakdown({ train, classType, date }));
});

import { getTrainAvailability } from "../services/trainAvailabilityService.js";

/**
 * POST /api/trains/fare/calculate
 * Computes fare breakdown from inline train data (no DB lookup).
 * Used for RAG/web-sourced trains that are not stored in TrainSchedule.
 * Body: { trainNo, trainName, classes: [{type, baseFare, reservationCharge, dynamicMultiplier}], date, classType }
 */
router.post("/fare/calculate", async (req, res) => {
  const { trainNo, trainName, classes, date, classType = "SL" } = req.body || {};

  if (!trainNo || !trainName || !Array.isArray(classes) || classes.length === 0) {
    return res.status(400).json({ error: "trainNo, trainName, and classes[] are required" });
  }

  const syntheticTrain = { trainNo, trainName, classes };
  const journeyDate = String(date || new Date().toISOString().split("T")[0]);

  const availability = await getTrainAvailability(syntheticTrain, journeyDate, classType);
  const breakdown = buildFareBreakdown({ train: syntheticTrain, classType, date: journeyDate, availability });

  return res.json(breakdown);
});

export default router;
