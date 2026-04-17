import { buildSeedTrainDocuments } from "./trainSeedCatalog.js";

function toProviderDocument(rawTrain, sourceProvider = "rapidapi") {
  const runningDays = Array.isArray(rawTrain.runningDays)
    ? rawTrain.runningDays
    : ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

  return {
    trainNo: String(rawTrain.trainNo || rawTrain.number || rawTrain.train_num || ""),
    trainName: rawTrain.trainName || rawTrain.name || rawTrain.train_name || "Unknown train",
    source: rawTrain.source || rawTrain.from || rawTrain.origin || "Unknown source",
    destination: rawTrain.destination || rawTrain.to || rawTrain.terminal || "Unknown destination",
    sourceCode: rawTrain.sourceCode || rawTrain.fromCode || "",
    destinationCode: rawTrain.destinationCode || rawTrain.toCode || "",
    departureTime: rawTrain.departureTime || rawTrain.departure || "00:00",
    arrivalTime: rawTrain.arrivalTime || rawTrain.arrival || "00:00",
    duration: rawTrain.duration || "0h 0m",
    distanceKm: Number(rawTrain.distanceKm || rawTrain.distance || 0),
    runningDays,
    classes: Array.isArray(rawTrain.classes) ? rawTrain.classes : [],
    intermediateStations: Array.isArray(rawTrain.intermediateStations) ? rawTrain.intermediateStations : [],
    routePolyline: Array.isArray(rawTrain.routePolyline) ? rawTrain.routePolyline : [],
    sourceProvider,
    metadata: rawTrain.metadata || {},
  };
}

export async function fetchTrainDocumentsForIngestion() {
  // RapidAPI endpoints removed. Relying on professional deterministic seed engine
  // to populate the MongoDB train catalog which serves as the fallback for our RAG.
  console.log("Populating DB with deterministic train schedules...");
  return buildSeedTrainDocuments().map((record) => toProviderDocument(record, "seed"));
}
