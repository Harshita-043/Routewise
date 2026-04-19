import { Bus } from "../models/Bus.js";
import { Carpool } from "../models/Carpool.js";
import { Driver } from "../models/Driver.js";
import { Taxi } from "../models/Taxi.js";
import { Train } from "../models/Train.js";
import { Station } from "../models/Station.js";
import { TrainAlert } from "../models/TrainAlert.js";
import { TrainSchedule } from "../models/TrainSchedule.js";
import { UserRoute } from "../models/UserRoute.js";
import {
  busSeeds,
  carpoolSeeds,
  driverSeeds,
  taxiSeeds,
  trainSeeds,
} from "../data/seedData.js";
import { initializeTrainData } from "./trainScheduler.js";
import { seedStations } from "./stationService.js";

/**
 * Safe insertMany wrapper that swallows duplicate-key errors (code 11000).
 * This prevents startup crashes when the server restarts and seed data already exists.
 */
async function safeInsertMany(Model, docs) {
  try {
    await Model.insertMany(docs, { ordered: false });
  } catch (err) {
    // MongoDB error code 11000 = duplicate key — safe to ignore during seeding
    if (err?.code === 11000 || err?.writeErrors?.every(e => e.code === 11000)) {
      console.log(`[Seed] Skipped duplicates for ${Model.modelName}`);
    } else {
      throw err;
    }
  }
}

export async function seedDatabase({ force = false } = {}) {
  const trainCount = await Train.countDocuments();

  if (trainCount > 0 && !force) {
    return { seeded: false, message: "Seed data already present" };
  }

  if (force) {
    await Promise.all([
      Driver.deleteMany({}),
      Train.deleteMany({}),
      TrainSchedule.deleteMany({}),
      Station.deleteMany({}),
      TrainAlert.deleteMany({}),
      UserRoute.deleteMany({}),
      Bus.deleteMany({}),
      Taxi.deleteMany({}),
      Carpool.deleteMany({}),
    ]);
  }

  await safeInsertMany(Driver, driverSeeds);
  await safeInsertMany(Train, trainSeeds);
  await safeInsertMany(Bus, busSeeds);
  await safeInsertMany(Taxi, taxiSeeds);
  await safeInsertMany(Carpool, carpoolSeeds);
  await seedStations();
  await initializeTrainData();

  return {
    seeded: true,
    counts: {
      drivers: driverSeeds.length,
      trains: trainSeeds.length,
      trainSchedules: trainSeeds.length,
      buses: busSeeds.length,
      taxis: taxiSeeds.length,
      carpools: carpoolSeeds.length,
    },
  };
}
