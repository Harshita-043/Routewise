import mongoose from "mongoose";

const ragCacheSchema = new mongoose.Schema(
  {
    // For structured train search caching
    from: { type: String, trim: true, lowercase: true },
    to: { type: String, trim: true, lowercase: true },
    date: { type: String, trim: true },
    classType: { type: String, default: "SL", trim: true },
    trains: { type: Array, default: [] },

    // For general RAG question answering caching
    queryHash: { type: String, trim: true, index: true },
    query: { type: String, trim: true },
    intent: { type: String, trim: true },
    entities: { type: mongoose.Schema.Types.Mixed, default: {} },
    response: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

// TTL index: auto-delete documents 24 hours after creation
ragCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 86400 });
ragCacheSchema.index({ from: 1, to: 1, date: 1, classType: 1 });

export const RagCache = mongoose.model("RagCache", ragCacheSchema);
