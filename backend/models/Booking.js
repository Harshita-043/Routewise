import mongoose from "mongoose";

const passengerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    age: { type: Number, min: 0, required: true },
    gender: { type: String, trim: true, default: "Unspecified" },
  },
  { _id: false },
);

const bookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    transportType: {
      type: String,
      enum: ["bus", "train", "taxi", "carpool"],
      required: true,
    },
    transportRecordId: { type: mongoose.Schema.Types.ObjectId, required: true },
    transportCode: { type: String, required: true, trim: true },
    transportName: { type: String, required: true, trim: true },
    source: { type: String, required: true, trim: true },
    destination: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    passengers: { type: Number, required: true, min: 1 },
    seats: [{ type: String, trim: true }],
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["confirmed", "cancelled", "completed"],
      default: "confirmed",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "refunded"],
      default: "paid",
    },
    passengerDetails: { type: [passengerSchema], default: [] },
    snapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

export const Booking = mongoose.model("Booking", bookingSchema);
