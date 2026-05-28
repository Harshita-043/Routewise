import { Router } from "express";
import { registerDriverHandler } from "../controllers/driverController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/register-driver", requireAuth, registerDriverHandler);

export default router;
