import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { connectDatabase } from "./config/db.js";

import authRoutes from "./routes/authRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import carpoolRoutes from "./routes/carpoolRoutes.js";
import driverRoutes from "./routes/driverRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import seedRoutes from "./routes/seedRoutes.js";
import trainRoutes from "./routes/trains.js";

import { seedDatabase } from "./services/seedService.js";
import { initializeTrainData, startTrainScheduler } from "./services/trainScheduler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

const CORS_ORIGIN = process.env.CORS_ORIGIN;

app.use(
  cors({
    origin: CORS_ORIGIN
      ? CORS_ORIGIN.split(",").map((o) => o.trim())
      : true,
    credentials: true,
  }),
);

app.use(helmet({
  // Allow Vite-built assets and inline scripts when serving the SPA
  contentSecurityPolicy: false,
}));
app.use(express.json());

// Request logging for debugging
app.use((req, _res, next) => {
  if (req.path.startsWith("/api")) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// ── In-memory rate limiter (no extra package required) ───────────────────────
// Prevents brute-force on auth and excessive geocode scraping.
function makeRateLimiter(maxRequests, windowMs, message) {
  const hits = new Map(); // ip → { count, resetAt }

  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    const entry = hits.get(ip);

    if (!entry || now > entry.resetAt) {
      hits.set(ip, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > maxRequests) {
      res.setHeader("Retry-After", Math.ceil((entry.resetAt - now) / 1000));
      return res.status(429).json({ error: message });
    }

    next();
  };
}

// Auth: 10 attempts per minute per IP
const authLimiter = makeRateLimiter(10, 60_000, "Too many auth attempts. Please wait 1 minute.");
// Geocode: 60 requests per minute per IP
const geocodeLimiter = makeRateLimiter(60, 60_000, "Too many geocode requests. Please slow down.");


// Routes
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api", geocodeLimiter, searchRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/carpool", carpoolRoutes);
app.use("/api", driverRoutes);
app.use("/api/admin", seedRoutes);
app.use("/api/trains", trainRoutes);

// ── Production static file serving ─────────────────────────────────────────
// When NODE_ENV=production (or the dist/ folder exists), serve the Vite build
// from the project root so that the frontend's relative /api/* calls resolve
// to this same Express server — eliminating any cross-origin issues and making
// the fallback geocoding work without VITE_API_BASE_URL configuration.
const distDir = path.resolve(__dirname, "../dist");

app.use(express.static(distDir));

// SPA catch-all: return index.html for any non-API route so React Router works
app.get(/^(?!\/api\/).*/, (_req, res) => {
  const indexFile = path.join(distDir, "index.html");
  res.sendFile(indexFile, (err) => {
    if (err) {
      // dist/ not built yet (dev mode fallback)
      res.status(404).json({ error: "Frontend build not found. Run `npm run build` first." });
    }
  });
});

// Global error handler
app.use((error, _req, res, _next) => {
  console.error("[Global Error Handler]", error);

  if (res.headersSent) {
    return;
  }

  res.status(500).json({
    error: "Internal server error",
  });
});

export async function initializeBackend() {
  await connectDatabase();
  await seedDatabase();
  await initializeTrainData();
  startTrainScheduler();

  return app;
}

// Prevent process crashes from unhandled promise rejections
process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[FATAL] Uncaught Exception:", error);
});

export default app;