import mongoose from "mongoose";

const routeSchema = new mongoose.Schema(
  {
    source: { type: String, required: true, trim: true },
    destination: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const pointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (coords) => Array.isArray(coords) && coords.length === 2,
        message: "Coordinates must contain [lng, lat]",
      },
    },
  },
  { _id: false },
);

const carpoolSchema = new mongoose.Schema(
  {
    driverId: { type: String, required: true, index: true, trim: true },
    route: { type: routeSchema, required: true },
    availableSeats: { type: Number, required: true, min: 0 },
    time: { type: String, required: true, trim: true },
    pricePerSeat: { type: Number, required: true, min: 0 },
    startLocationName: { type: String, trim: true },
    startLocation: { type: pointSchema },
  },
  { timestamps: true },
);

carpoolSchema.index({ startLocation: "2dsphere" });

export const Carpool = mongoose.model("Carpool", carpoolSchema);
