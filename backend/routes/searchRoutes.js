import { Router } from "express";
import {
  getGeocodeSuggestions,
  getRouteSummary,
  searchOptions,
} from "../controllers/searchController.js";

const router = Router();

router.get("/geocode", getGeocodeSuggestions);
router.get("/route", getRouteSummary);
router.get("/search", searchOptions);

export default router;
