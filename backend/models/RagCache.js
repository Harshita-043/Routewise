import mongoose from "mongoose";

const ragCacheSchema = new mongoose.Schema(
  {
    from: { type: String, required: true, trim: true, lowercase: true },
    to: { type: String, required: true, trim: true, lowercase: true },
    date: { type: String, required: true, trim: true },
    classType: { type: String, default: "SL", trim: true },
    trains: { type: Array, default: [] },
    createdAt: { type: Date, default: Date.now, expires: 86400 } // Auto-delete after 24 hours
  },
  { timestamps: true }
);

ragCacheSchema.index({ from: 1, to: 1, date: 1, classType: 1 });

export const RagCache = mongoose.model("RagCache", ragCacheSchema);
