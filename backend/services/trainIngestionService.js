import { TrainSchedule } from "../models/TrainSchedule.js";
import { embedText } from "./embeddingService.js";
import { fetchTrainDocumentsForIngestion } from "./trainProviderService.js";

function buildTrainEmbeddingText(document) {
  const classes = document.classes.map((item) => `${item.type} ${item.baseFare}`).join(" ");
  const route = document.intermediateStations.map((station) => station.name).join(" ");

  return [
    document.trainNo,
    document.trainName,
    document.source,
    document.destination,
    document.departureTime,
    document.arrivalTime,
    document.duration,
    document.runningDays.join(" "),
    classes,
    route,
  ].join(" ");
}

export async function ingestTrainSchedules() {
  const documents = await fetchTrainDocumentsForIngestion();
  const preparedDocuments = [];

  for (const document of documents) {
    const embedding = await embedText(buildTrainEmbeddingText(document));
    preparedDocuments.push({
      ...document,
      embedding,
      lastIngestedAt: new Date(),
    });
  }

  if (!preparedDocuments.length) {
    return { ingested: 0 };
  }

  await TrainSchedule.bulkWrite(
    preparedDocuments.map((document) => ({
      updateOne: {
        filter: { trainNo: document.trainNo },
        update: { $set: document },
        upsert: true,
      },
    })),
    { ordered: false },
  );

  return { ingested: preparedDocuments.length };
}
