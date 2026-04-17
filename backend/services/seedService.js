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

  await Driver.insertMany(driverSeeds, { ordered: false });
  await Train.insertMany(trainSeeds, { ordered: false });
  await Bus.insertMany(busSeeds, { ordered: false });
  await Taxi.insertMany(taxiSeeds, { ordered: false });
  await Carpool.insertMany(carpoolSeeds, { ordered: false });
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
