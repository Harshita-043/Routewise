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

const routeSchema = new mongoose.Schema(
  {
    source: { type: String, required: true, trim: true },
    destination: { type: String, required: true, trim: true },
    time: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const driverSchema = new mongoose.Schema(
  {
    driverId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    availability: {
      type: String,
      enum: ["online", "offline"],
      default: "online",
    },
    vehicleType: { type: String, trim: true },
    carNumber: { type: String, trim: true },
    registeredFor: {
      type: [String],
      enum: ["bus", "taxi", "carpool"],
      default: [],
    },
    currentLocationName: { type: String, trim: true },
    currentLocation: { type: pointSchema },
    activeRoutes: { type: [routeSchema], default: [] },
  },
  { timestamps: true },
);

driverSchema.index({ currentLocation: "2dsphere" });

export const Driver = mongoose.model("Driver", driverSchema);
