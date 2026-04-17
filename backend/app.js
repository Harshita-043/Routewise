import "dotenv/config";
import cors from "cors";
import express from "express";
import { connectDatabase } from "./config/db.js";
import authRoutes from "./routes/authRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import driverRoutes from "./routes/driverRoutes.js";
import searchRoutes from "./routes/searchRoutes.js";
import seedRoutes from "./routes/seedRoutes.js";
import trainRoutes from "./routes/trains.js";
import { seedDatabase } from "./services/seedService.js";
import { initializeTrainData, startTrainScheduler } from "./services/trainScheduler.js";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRoutes);
app.use("/api", searchRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api", driverRoutes);
app.use("/api/admin", seedRoutes);
app.use("/api/trains", trainRoutes);

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Internal server error" });
});

export async function initializeBackend() {
  await connectDatabase();
  await seedDatabase();
  await initializeTrainData();
  startTrainScheduler();
  return app;
}

export default app;
