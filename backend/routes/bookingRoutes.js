import { Router } from "express";
import {
  cancelBookingHandler,
  createBookingHandler,
  getBookingsHandler,
} from "../controllers/bookingController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", requireAuth, getBookingsHandler);
router.post("/", requireAuth, createBookingHandler);
router.patch("/:id/cancel", requireAuth, cancelBookingHandler);

export default router;
