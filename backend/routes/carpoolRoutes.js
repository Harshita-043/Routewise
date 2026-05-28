import { Router } from "express";
import {
  acceptRequestHandler,
  createCarpoolRequestHandler,
  getDriverCarpoolsHandler,
  getDriverRequestsHandler,
  getPassengerRequestsHandler,
  rejectRequestHandler,
  cancelPassengerRequestHandler,
} from "../controllers/carpoolController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = Router();

router.post("/requests", requireAuth, createCarpoolRequestHandler);
router.get("/requests/passenger", requireAuth, getPassengerRequestsHandler);
router.get("/requests/driver", requireAuth, getDriverRequestsHandler);
router.patch("/requests/:id/accept", requireAuth, acceptRequestHandler);
router.patch("/requests/:id/reject", requireAuth, rejectRequestHandler);
router.patch("/requests/:id/cancel-passenger", requireAuth, cancelPassengerRequestHandler);
router.get("/driver/active-rides", requireAuth, getDriverCarpoolsHandler);

export default router;
