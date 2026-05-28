import mongoose from "mongoose";

const carpoolRequestSchema = new mongoose.Schema(
  {
    rideId: { type: mongoose.Schema.Types.ObjectId, ref: "Carpool", required: true },
    passengerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    source: { type: String, required: true, trim: true },
    destination: { type: String, required: true, trim: true },
    seatsRequested: { type: Number, required: true, min: 1 },
    rideDate: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "cancelled"],
      default: "pending",
    },
    totalAmount: { type: Number, required: true, min: 0 },
    passengerDetails: { type: mongoose.Schema.Types.Mixed, default: [] },
  },
  { timestamps: true }
);

export const CarpoolRequest = mongoose.model("CarpoolRequest", carpoolRequestSchema);
