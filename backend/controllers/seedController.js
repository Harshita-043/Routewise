import { seedDatabase } from "../services/seedService.js";

export async function seedHandler(req, res) {
  const result = await seedDatabase({ force: Boolean(req.query.force) });
  return res.json(result);
}
