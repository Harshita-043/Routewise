import { Router } from "express";
import { seedHandler } from "../controllers/seedController.js";

const router = Router();

router.post("/seed", (req, res, next) => {
  const secret = req.headers["x-admin-secret"];
  if (!secret || secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  next();
}, seedHandler);

export default router;
