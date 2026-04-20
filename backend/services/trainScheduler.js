import { TrainAlert } from "../models/TrainAlert.js";
import { TrainSchedule } from "../models/TrainSchedule.js";
import { getTrainAvailability } from "./trainAvailabilityService.js";
import { ingestTrainSchedules } from "./trainIngestionService.js";
import { seedStations } from "./stationService.js";

let schedulerStarted = false;

async function checkTrainAlerts() {
  const alerts = await TrainAlert.find().lean();

  for (const alert of alerts) {
    try {
      const train = await TrainSchedule.findOne({ trainNo: alert.trainNo }).lean();

      if (!train) {
        continue;
      }

      const availability = await getTrainAvailability(train, alert.date, alert.classType);
      const shouldNotify =
        availability.currentFare <= alert.targetFare ||
        (alert.notifyOnSeatOpen && availability.available);

      if (!shouldNotify) {
        continue;
      }

      console.info(
        `[Train Alert] ${alert.email}: ${alert.trainNo} ${alert.date} ${alert.classType} fare ${availability.currentFare} seats ${availability.seatsLeft}`,
      );

      await TrainAlert.updateOne(
        { _id: alert._id },
        { $set: { lastNotifiedAt: new Date() } },
      );
    } catch (alertErr) {
      console.error(`[Train Alert] Failed to process alert ${alert._id} (${alert.trainNo}):`, alertErr.message);
    }
  }
}

export async function initializeTrainData() {
  await ingestTrainSchedules();
  await seedStations();
}

export function startTrainScheduler() {
  if (schedulerStarted) {
    return;
  }

  schedulerStarted = true;

  const reingestMs = Number(process.env.TRAIN_REINGEST_INTERVAL_MS || 24 * 60 * 60 * 1000);
  const alertCheckMs = Number(process.env.TRAIN_ALERT_CHECK_INTERVAL_MS || 24 * 60 * 60 * 1000);

  setInterval(() => {
    initializeTrainData().catch((error) => {
      console.error("Scheduled train ingestion failed", error);
    });
  }, reingestMs);

  setInterval(() => {
    checkTrainAlerts().catch((error) => {
      console.error("Scheduled train alert check failed", error);
    });
  }, alertCheckMs);
}
