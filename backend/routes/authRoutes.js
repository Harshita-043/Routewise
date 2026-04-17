import { Router } from "express";
import { loginHandler, meHandler, signupHandler } from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/signup", signupHandler);
router.post("/login", loginHandler);
router.get("/me", requireAuth, meHandler);

export default router;
