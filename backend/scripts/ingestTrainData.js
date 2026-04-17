import "dotenv/config";
import { connectDatabase } from "../config/db.js";
import { ingestTrainSchedules } from "../services/trainIngestionService.js";
import { seedStations } from "../services/stationService.js";

async function main() {
  await connectDatabase();
  const stationResult = await seedStations();
  const trainResult = await ingestTrainSchedules();
  console.log("Stations seeded:", stationResult.seeded);
  console.log("Train schedules ingested:", trainResult.ingested);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Train ingestion failed", error);
    process.exit(1);
  });
