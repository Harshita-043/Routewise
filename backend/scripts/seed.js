import { connectDatabase } from "../config/db.js";
import { seedDatabase } from "../services/seedService.js";

await connectDatabase();
const result = await seedDatabase({ force: true });
console.log(result);
process.exit(0);
