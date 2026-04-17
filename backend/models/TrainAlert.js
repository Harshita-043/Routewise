import mongoose from "mongoose";

const trainAlertSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true },
    trainNo: { type: String, required: true, trim: true, index: true },
    date: { type: String, required: true, trim: true },
    classType: { type: String, required: true, trim: true },
    targetFare: { type: Number, required: true, min: 0 },
    notifyOnSeatOpen: { type: Boolean, default: true },
    lastNotifiedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "train_alerts" },
);

export const TrainAlert = mongoose.model("TrainAlert", trainAlertSchema);
