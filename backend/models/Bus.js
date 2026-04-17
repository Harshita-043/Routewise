import mongoose from "mongoose";

const stopSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false },
);

const busSchema = new mongoose.Schema(
  {
    busId: { type: String, required: true, unique: true, index: true },
    operatorName: { type: String, required: true, trim: true },
    source: { type: String, required: true, trim: true },
    destination: { type: String, required: true, trim: true },
    stops: { type: [stopSchema], default: [] },
    departureTime: { type: String, required: true, trim: true },
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
    seatsAvailable: { type: Number, required: true, min: 0 },
    price: { type: Number, required: true, min: 0 },
    driverId: { type: String, required: true, trim: true, index: true },
  },
  { timestamps: true },
);

export const Bus = mongoose.model("Bus", busSchema);
