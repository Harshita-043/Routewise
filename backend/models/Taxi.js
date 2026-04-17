import mongoose from "mongoose";

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

const taxiSchema = new mongoose.Schema(
  {
    driverId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    vehicleType: { type: String, required: true, trim: true },
    carNumber: { type: String, required: true, trim: true },
    currentLocationName: { type: String, trim: true },
    currentLocation: { type: pointSchema, required: true },
    availability: {
      type: String,
      enum: ["online", "offline"],
      default: "online",
    },
    pricePerKm: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

taxiSchema.index({ currentLocation: "2dsphere" });

export const Taxi = mongoose.model("Taxi", taxiSchema);
