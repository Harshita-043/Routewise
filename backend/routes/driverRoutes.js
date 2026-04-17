import { Router } from "express";
import { registerDriverHandler } from "../controllers/driverController.js";

const router = Router();

router.post("/register-driver", registerDriverHandler);

export default router;
