import mongoose from "mongoose";

const stationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false },
);

const trainSchema = new mongoose.Schema(
  {
    trainId: { type: String, required: true, unique: true, index: true },
    trainName: { type: String, required: true, trim: true },
    source: { type: String, required: true, trim: true },
    destination: { type: String, required: true, trim: true },
    intermediateStations: { type: [stationSchema], default: [] },
    departureTime: { type: String, required: true, trim: true },
    arrivalTime: { type: String, required: true, trim: true },
    operatingDays: {
      type: [String],
      enum: [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ],
      default: [
        "sunday",
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
      ],
    },
    seatAvailability: { type: Number, required: true, min: 0 },
    fare: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

export const Train = mongoose.model("Train", trainSchema);
