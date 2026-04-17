import mongoose from "mongoose";

const userRouteSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    from: { type: String, required: true, trim: true },
    to: { type: String, required: true, trim: true },
    date: { type: String, trim: true },
    classType: { type: String, trim: true },
  },
  { timestamps: true, collection: "user_routes" },
);

export const UserRoute = mongoose.model("UserRoute", userRouteSchema);
