import { TrainAlert } from "../models/TrainAlert.js";
import { UserRoute } from "../models/UserRoute.js";

export async function saveUserRoute({ userId, from, to, date, classType }) {
  return UserRoute.create({ userId, from, to, date, classType });
}

export async function listUserRoutes(userId) {
  return UserRoute.find({ userId }).sort({ updatedAt: -1 }).lean();
}

export async function createPriceAlert({ email, trainNo, date, classType, targetFare, notifyOnSeatOpen = true }) {
  return TrainAlert.create({
    email,
    trainNo,
    date,
    classType,
    targetFare,
    notifyOnSeatOpen,
  });
}
