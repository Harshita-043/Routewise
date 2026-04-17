import { Router } from "express";
import { seedHandler } from "../controllers/seedController.js";

const router = Router();

router.post("/seed", seedHandler);

export default router;
