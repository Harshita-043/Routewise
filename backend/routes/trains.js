import { Router } from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { TrainSchedule } from "../models/TrainSchedule.js";
import { buildFareBreakdown } from "../services/fareEngine.js";
import { createPriceAlert, listUserRoutes, saveUserRoute } from "../services/routeMemoryService.js";
import { findNearbyStations } from "../services/stationService.js";
import { getPnrStatus, getTrainLiveStatus } from "../services/trainStatusService.js";
import { getTrainSchedule, searchTrains } from "../services/ragService.js";
import { getTrainAvailability } from "../services/trainAvailabilityService.js";

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
    console.error("[trains/search] Error:", error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Train search failed",
    });
  }
});

router.get("/stations/nearby", async (req, res) => {
  try {
    const lat = req.query.lat ?? req.body?.lat;
    const lng = req.query.lng ?? req.body?.lng;
    const radiusKm = req.query.radiusKm ?? req.body?.radiusKm ?? 25;
    const destination = req.query.destination ?? req.body?.destination;

    if (lat == null || lng == null) {
      return res.status(400).json({ error: "lat and lng are required" });
    }

    const stations = await findNearbyStations({ lat, lng, radiusKm, destination });
    return res.json(stations);
  } catch (error) {
    console.error("[trains/stations/nearby] Error:", error);
    return res.status(500).json({ error: "Failed to fetch nearby stations" });
  }
});

router.get("/pnr-status/:pnr", async (req, res) => {
  try {
    const status = await getPnrStatus(req.params.pnr);
    return res.json(status);
  } catch (error) {
    console.error("[trains/pnr-status] Error:", error);
    return res.status(502).json({ error: "Could not fetch PNR status" });
  }
});

router.get("/train-live-status/:trainNo/:date", async (req, res) => {
  try {
    const status = await getTrainLiveStatus(req.params.trainNo, req.params.date);
    return res.json(status);
  } catch (error) {
    console.error("[trains/train-live-status] Error:", error);
    return res.status(502).json({ error: "Could not fetch live train status" });
  }
});

router.post("/alerts", async (req, res) => {
  try {
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
  } catch (error) {
    console.error("[trains/alerts] Error:", error);
    return res.status(500).json({ error: "Could not create train alert" });
  }
});

router.post("/saved-routes", requireAuth, async (req, res) => {
  try {
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
  } catch (error) {
    console.error("[trains/saved-routes POST] Error:", error);
    return res.status(500).json({ error: "Could not save route" });
  }
});

router.get("/saved-routes", requireAuth, async (req, res) => {
  try {
    const routes = await listUserRoutes(req.user.id);
    return res.json(routes);
  } catch (error) {
    console.error("[trains/saved-routes GET] Error:", error);
    return res.status(500).json({ error: "Could not fetch saved routes" });
  }
});

router.post("/journey-planner", async (req, res) => {
  try {
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
  } catch (error) {
    console.error("[trains/journey-planner] Error:", error);
    return res.status(500).json({ error: "Journey planning failed" });
  }
});

router.get("/:trainNo/schedule", async (req, res) => {
  try {
    const train = await getTrainSchedule(req.params.trainNo);

    if (!train) {
      return res.status(404).json({ error: "Train not found" });
    }

    return res.json(train);
  } catch (error) {
    console.error("[trains/:trainNo/schedule] Error:", error);
    return res.status(500).json({ error: "Could not fetch train schedule" });
  }
});

router.get("/:trainNo/fare", async (req, res) => {
  try {
    const train = await TrainSchedule.findOne({ trainNo: req.params.trainNo }).lean();

    if (!train) {
      return res.status(404).json({ error: "Train not found" });
    }

    const date = String(req.query.date || new Date().toISOString().split("T")[0]);
    const classType = String(req.query.classType || "SL");
    return res.json(buildFareBreakdown({ train, classType, date }));
  } catch (error) {
    console.error("[trains/:trainNo/fare] Error:", error);
    return res.status(500).json({ error: "Could not fetch train fare" });
  }
});

/**
 * POST /api/trains/fare/calculate
 * Computes fare breakdown from inline train data (no DB lookup).
 * Used for RAG/web-sourced trains that are not stored in TrainSchedule.
 * Body: { trainNo, trainName, classes: [{type, baseFare, reservationCharge, dynamicMultiplier}], date, classType }
 */
router.post("/fare/calculate", async (req, res) => {
  try {
    const { trainNo, trainName, classes, date, classType = "SL" } = req.body || {};

    if (!trainNo || !trainName || !Array.isArray(classes) || classes.length === 0) {
      return res.status(400).json({ error: "trainNo, trainName, and classes[] are required" });
    }

    const syntheticTrain = { trainNo, trainName, classes };
    const journeyDate = String(date || new Date().toISOString().split("T")[0]);

    const availability = await getTrainAvailability(syntheticTrain, journeyDate, classType);
    const breakdown = buildFareBreakdown({ train: syntheticTrain, classType, date: journeyDate, availability });

    return res.json(breakdown);
  } catch (error) {
    console.error("[trains/fare/calculate] Error:", error);
    return res.status(500).json({ error: "Could not calculate train fare" });
  }
});

export default router;
