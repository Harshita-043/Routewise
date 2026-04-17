import mongoose from "mongoose";

let isConnected = false;

export async function connectDatabase() {
  if (isConnected) {
    return mongoose.connection;
  }

  const mongoUri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/routewise";

  try {
    await mongoose.connect(mongoUri, {
      autoIndex: true,
      serverSelectionTimeoutMS: 10000,
    });
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown MongoDB error";
    throw new Error(
      `MongoDB connection failed. Check Atlas credentials, network access allowlist, and MONGODB_URI. ${details}`,
    );
  }

  isConnected = true;
  return mongoose.connection;
}
