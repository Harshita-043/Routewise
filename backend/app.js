
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
import ragRoutes from "./routes/ragRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import seedRoutes from "./routes/seedRoutes.js";
import trainRoutes from "./routes/trains.js";

import { seedDatabase } from "./services/seedService.js";
import {
  initializeTrainData,
  startTrainScheduler,
} from "./services/trainScheduler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();

// Trust the reverse proxy used by Render.
app.set("trust proxy", 1);

// --------------------------------------------------
// CORS CONFIGURATION
// --------------------------------------------------

const defaultOrigins = [
  "https://routewise-six.vercel.app",
  "http://localhost:5173",
  "http://localhost:3000",
];

const environmentOrigins = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const allowedOrigins = [
  ...new Set([...defaultOrigins, ...environmentOrigins]),
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests without an Origin header.
    // Examples: Postman and server-to-server requests.
    if (!origin) {
      return callback(null, true);
    }

    const normalizedOrigin = origin.replace(/\/+$/, "");

    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    console.warn(`[CORS] Blocked origin: ${origin}`);

    return callback(new Error("Origin not allowed by CORS"));
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
  ],

  optionsSuccessStatus: 204,
};

// Register CORS before all other middleware and routes.
// This also handles preflight OPTIONS requests.
app.use(cors(corsOptions));

// --------------------------------------------------
// SECURITY AND BODY PARSING
// --------------------------------------------------

app.use(
  helmet({
    // Allow Vite-built assets and inline scripts
    // when serving the SPA.
    contentSecurityPolicy: false,
  })
);

app.use(express.json());

// --------------------------------------------------
// REQUEST LOGGING
// --------------------------------------------------

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.path}`
    );
  }

  next();
});

// --------------------------------------------------
// HEALTH CHECK
// --------------------------------------------------

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "RouteWise API",
  });
});

// --------------------------------------------------
// IN-MEMORY RATE LIMITER
// --------------------------------------------------

function makeRateLimiter(maxRequests, windowMs, message) {
  const hits = new Map();

  return (req, res, next) => {
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    const now = Date.now();

    const entry = hits.get(ip);

    if (!entry || now > entry.resetAt) {
      hits.set(ip, {
        count: 1,
        resetAt: now + windowMs,
      });

      return next();
    }

    entry.count += 1;

    if (entry.count > maxRequests) {
      res.setHeader(
        "Retry-After",
        Math.ceil((entry.resetAt - now) / 1000)
      );

      return res.status(429).json({
        error: message,
      });
    }

    next();
  };
}

// Auth: 10 attempts per minute per IP.
const authLimiter = makeRateLimiter(
  10,
  60_000,
  "Too many auth attempts. Please wait 1 minute."
);

// Geocode: 60 requests per minute per IP.
const geocodeLimiter = makeRateLimiter(
  60,
  60_000,
  "Too many geocode requests. Please slow down."
);

// --------------------------------------------------
// API ROUTES
// --------------------------------------------------

app.use("/api/auth", authLimiter, authRoutes);

app.use("/api", geocodeLimiter, searchRoutes);

app.use("/api/bookings", bookingRoutes);

app.use("/api/carpool", carpoolRoutes);

app.use("/api", driverRoutes);

app.use("/api/admin", seedRoutes);

app.use("/api/trains", trainRoutes);

app.use("/api/rag", ragRoutes);

// --------------------------------------------------
// PRODUCTION STATIC FILE SERVING
// --------------------------------------------------

const distDir = path.resolve(__dirname, "../dist");

app.use(express.static(distDir));

// React Router SPA fallback.
// Exclude API requests from the frontend fallback.
app.get(/^(?!\/api\/).*/, (req, res) => {
  const indexFile = path.join(distDir, "index.html");

  res.sendFile(indexFile, (err) => {
    if (err) {
      console.error("[SPA] Frontend build not found:", err);

      res.status(404).json({
        error: "Frontend build not found. Run npm run build first.",
      });
    }
  });
});

// --------------------------------------------------
// GLOBAL ERROR HANDLER
// --------------------------------------------------

app.use((error, req, res, next) => {
  console.error("[Global Error Handler]", error);

  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({
    error: "Internal server error",
  });
});

// --------------------------------------------------
// BACKEND INITIALIZATION
// --------------------------------------------------

export async function initializeBackend() {
  await connectDatabase();

  await seedDatabase();

  await initializeTrainData();

  startTrainScheduler();

  console.log("[RouteWise] Backend initialized successfully.");

  return app;
}

// --------------------------------------------------
// PROCESS ERROR HANDLING
// --------------------------------------------------

process.on("unhandledRejection", (reason) => {
  console.error("[FATAL] Unhandled Promise Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("[FATAL] Uncaught Exception:", error);
});

// --------------------------------------------------
// EXPORT
// --------------------------------------------------

export default app;
