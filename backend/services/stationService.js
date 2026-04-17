import { Station } from "../models/Station.js";
import { TrainSchedule } from "../models/TrainSchedule.js";
import { buildSeedStations } from "./trainSeedCatalog.js";

export async function seedStations() {
  const stations = buildSeedStations();

  if (!stations.length) {
    return { seeded: 0 };
  }

  await Station.bulkWrite(
    stations.map((station) => ({
      updateOne: {
        filter: { code: station.code },
        update: { $set: station },
        upsert: true,
      },
    })),
    { ordered: false },
  );

  return { seeded: stations.length };
}

export async function findNearbyStations({ lat, lng, radiusKm = 25, destination }) {
  const stations = await Station.find({
    location: {
      $nearSphere: {
        $geometry: {
          type: "Point",
          coordinates: [Number(lng), Number(lat)],
        },
        $maxDistance: Number(radiusKm) * 1000,
      },
    },
  })
    .limit(12)
    .lean();

  return Promise.all(
    stations.map(async (station) => {
      const nextDepartures = await TrainSchedule.find({
        $or: [{ sourceCode: station.code }, { "intermediateStations.code": station.code }],
        ...(destination ? { destination: new RegExp(destination, "i") } : {}),
      })
        .sort({ departureTime: 1 })
        .limit(3)
        .lean();

      return {
        ...station,
        nextDepartures: nextDepartures.map((train) => ({
          trainNo: train.trainNo,
          trainName: train.trainName,
          departureTime: train.departureTime,
          destination: train.destination,
        })),
      };
    }),
  );
}
