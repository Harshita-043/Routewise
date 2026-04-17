import mongoose from "mongoose";

const classFareSchema = new mongoose.Schema(
  {
    type: { type: String, required: true, trim: true },
    baseFare: { type: Number, required: true, min: 0 },
    reservationCharge: { type: Number, default: 0, min: 0 },
    dynamicMultiplier: { type: Number, default: 1, min: 0.5 },
  },
  { _id: false },
);

const intermediateStationSchema = new mongoose.Schema(
  {
    code: { type: String, trim: true },
    name: { type: String, required: true, trim: true },
    arrival: { type: String, default: null, trim: true },
    departure: { type: String, default: null, trim: true },
    distance: { type: Number, default: 0, min: 0 },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        default: [0, 0],
      },
    },
  },
  { _id: false },
);

const trainScheduleSchema = new mongoose.Schema(
  {
    trainNo: { type: String, required: true, unique: true, index: true, trim: true },
    trainName: { type: String, required: true, trim: true },
    source: { type: String, required: true, trim: true },
    destination: { type: String, required: true, trim: true },
    sourceCode: { type: String, trim: true },
    destinationCode: { type: String, trim: true },
    departureTime: { type: String, required: true, trim: true },
    arrivalTime: { type: String, required: true, trim: true },
    duration: { type: String, required: true, trim: true },
    distanceKm: { type: Number, default: 0, min: 0 },
    runningDays: { type: [String], default: [] },
    classes: { type: [classFareSchema], default: [] },
    intermediateStations: { type: [intermediateStationSchema], default: [] },
    routePolyline: { type: [[Number]], default: [] },
    embedding: { type: [Number], default: [] },
    sourceProvider: { type: String, default: "seed", trim: true },
    lastIngestedAt: { type: Date, default: Date.now },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true, collection: "train_schedules" },
);

trainScheduleSchema.index({
  trainName: "text",
  trainNo: "text",
  source: "text",
  destination: "text",
  "intermediateStations.name": "text",
});

export const TrainSchedule = mongoose.model("TrainSchedule", trainScheduleSchema);
