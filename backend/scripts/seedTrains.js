import "dotenv/config";
import mongoose from "mongoose";
import { TrainSchedule } from "../models/TrainSchedule.js";

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/routewise";

const CITIES = [
  { name: "New Delhi", code: "NDLS", region: "North" },
  { name: "Mumbai Central", code: "MMCT", region: "West" },
  { name: "Howrah", code: "HWH", region: "East" },
  { name: "Chennai Central", code: "MAS", region: "South" },
  { name: "Bengaluru", code: "SBC", region: "South" },
  { name: "Ahmedabad", code: "ADI", region: "West" },
  { name: "Pune", code: "PUNE", region: "West" },
  { name: "Lucknow", code: "LKO", region: "North" },
  { name: "Patna", code: "PNBE", region: "East" },
  { name: "Jaipur", code: "JP", region: "North" },
  { name: "Hyderabad", code: "HYB", region: "South" },
  { name: "Guwahati", code: "GHY", region: "East" },
  { name: "Kochi", code: "ERS", region: "South" },
  { name: "Bhopal", code: "BPL", region: "Central" },
  { name: "Varanasi", code: "BSB", region: "North" },
  { name: "Nagpur", code: "NGP", region: "Central" }
];

const TRAIN_TYPES = ["Rajdhani Express", "Shatabdi Express", "Duronto Express", "Garib Rath", "Vande Bharat Express", "Mail Express", "Superfast Express"];

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateTime() {
  const hours = String(getRandomInt(0, 23)).padStart(2, "0");
  const minutes = String(getRandomInt(0, 59)).padStart(2, "0");
  return `${hours}:${minutes}`;
}

const trainsToInsert = [];
let trainNoCounter = 11000;

for (let i = 0; i < CITIES.length; i++) {
  for (let j = 0; j < CITIES.length; j++) {
    if (i !== j) {
      // Generate 2-4 trains for each city pair
      const numTrains = getRandomInt(2, 4);
      for (let k = 0; k < numTrains; k++) {
        const source = CITIES[i];
        const dest = CITIES[j];
        const type = TRAIN_TYPES[getRandomInt(0, TRAIN_TYPES.length - 1)];
        const trainName = `${source.name} - ${dest.name} ${type}`;
        const trainNo = String(trainNoCounter++);
        const distanceKm = getRandomInt(300, 2500);
        const durationHours = Math.floor(distanceKm / 70); // Assume avg speed 70km/h
        const duration = `${durationHours}h ${getRandomInt(0, 59)}m`;
        
        trainsToInsert.push({
          trainNo,
          trainName,
          source: source.name,
          sourceCode: source.code,
          destination: dest.name,
          destinationCode: dest.code,
          departureTime: generateTime(),
          arrivalTime: generateTime(),
          duration,
          distanceKm,
          runningDays: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
          classes: [
            { type: "SL", baseFare: Math.floor(distanceKm * 0.5), reservationCharge: 20, dynamicMultiplier: 1 },
            { type: "3A", baseFare: Math.floor(distanceKm * 1.5), reservationCharge: 40, dynamicMultiplier: 1 },
            { type: "2A", baseFare: Math.floor(distanceKm * 2.0), reservationCharge: 50, dynamicMultiplier: 1 },
            { type: "1A", baseFare: Math.floor(distanceKm * 3.0), reservationCharge: 60, dynamicMultiplier: 1 }
          ],
          sourceProvider: "seed_fallback"
        });
      }
    }
  }
}

async function runSeed() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected to MongoDB cluster.");
    
    await TrainSchedule.deleteMany({});
    console.log("Cleared old trains from TrainSchedule collection.");

    await TrainSchedule.insertMany(trainsToInsert);
    console.log(`Successfully seeded ${trainsToInsert.length} trains into MongoDB! This covers robust fallback for all regions.`);
    
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
}

runSeed();
