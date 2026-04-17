import mongoose from "mongoose";

const stationSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true, trim: true, index: true },
    aliases: { type: [String], default: [] },
    mode: {
      type: String,
      enum: ["railway", "bus"],
      default: "railway",
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
  },
  { timestamps: true, collection: "stations" },
);

stationSchema.index({ location: "2dsphere" });

export const Station = mongoose.model("Station", stationSchema);
