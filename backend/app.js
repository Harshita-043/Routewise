import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
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

const app = express();

const CORS_ORIGIN = process.env.CORS_ORIGIN;
app.use(
  cors({
    origin: CORS_ORIGIN
      ? CORS_ORIGIN.split(",").map((o) => o.trim())
      : true, // permissive in dev when CORS_ORIGIN is not set
    credentials: true,
  }),
);
app.use(helmet());
app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many auth requests, please try again later." }
});

const searchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many search requests, please try again later." }
});

// Request logging for debugging
app.use((req, _res, next) => {
  if (req.path.startsWith("/api")) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  }
  next();
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/auth", /* authLimiter, */ authRoutes);
app.use("/api", searchRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/carpool", carpoolRoutes);
app.use("/api", driverRoutes);
app.use("/api/admin", seedRoutes);
app.use("/api/trains/search", searchLimiter);
app.use("/api/trains", trainRoutes);

app.use((req, res) => {
  return res.status(404).json({
    error: "Route not found"
  });
});

// Global error handler — must have 4 parameters for Express to recognise it
app.use((error, _req, res, _next) => {
  console.error("[Global Error Handler]", error);
  if (res.headersSent) {
    return;
  }
  res.status(500).json({ error: "Internal server error" });
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
  // Don't exit — let the process stay alive in dev mode
});

export default app;
