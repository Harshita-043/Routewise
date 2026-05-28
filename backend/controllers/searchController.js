import { getPlaceAutocomplete } from "../services/mapsService.js";
import { getFallbackLocationSuggestions } from "../utils/fallbackModule.js";
import { searchTransportOptions } from "../services/searchService.js";

/**
 * GET /api/geocode?q=<query>
 *
 * Resolution order:
 *  1. Google Places autocomplete  (returns null on any failure)
 *  2. Local fallback city list    (always succeeds)
 *
 * The response is ALWAYS:
 *   { source: "api"|"fallback", results: [{ display_name, lat, lon }, ...] }
 */
export async function getGeocodeSuggestions(req, res) {
  const query = req.query.q;

  if (!query || query.trim().length === 0) {
    return res.status(400).json({ error: "Query parameter q is required" });
  }

  // ── 1. Try Google Places (never throws — returns null on any failure) ──────
  let apiResults = null;
  try {
    apiResults = await getPlaceAutocomplete(query);
  } catch {
    // Safety net: getPlaceAutocomplete should never throw, but just in case.
    apiResults = null;
  }

  // Only use Google results if they exist AND contain usable lat/lon data.
  // The Places autocomplete endpoint does NOT return coordinates, so results
  // from Google will NOT have lat/lon — always use the fallback for now.
  // (If a Place Details lookup is added later, remove this filter.)
  const validApiResults =
    Array.isArray(apiResults) &&
    apiResults.length > 0 &&
    apiResults.every((r) => r.lat !== undefined && r.lon !== undefined)
      ? apiResults
      : null;

  if (validApiResults) {
    console.log(`[geocode] Google Places returned ${validApiResults.length} result(s) for "${query}".`);
    return res.json({ source: "api", results: validApiResults });
  }

  // ── 2. Fallback — always returns valid { display_name, lat, lon } objects ──
  const reason = apiResults === null
    ? "Google Places unavailable or key missing"
    : "Google Places returned results without coordinates";

  const fallback = getFallbackLocationSuggestions(query, reason);

  console.log(`[geocode] Fallback returned ${fallback.length} result(s) for "${query}" (reason: ${reason}).`);

  return res.json({ source: "fallback", results: fallback });
}

export async function getRouteSummary(req, res) {
  const { startLat, startLng, endLat, endLng } = req.query;

  if (!startLat || !startLng || !endLat || !endLng) {
    return res.status(400).json({ error: "Missing coordinates" });
  }

  try {
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`,
    );

    if (!response.ok) {
      return res.status(502).json({ error: "Routing provider request failed" });
    }

    const data = await response.json();
    const route = data.routes?.[0];

    if (!route) {
      return res.status(404).json({ error: "No route found" });
    }

    const distanceKm = route.distance / 1000;
    const durationMin = Math.round(route.duration / 60);

    return res.json({
      distance: distanceKm,
      duration: durationMin,
      fares: {
        bus: Math.round(Math.max(25, distanceKm * 2.8)),
        taxi: Math.round(80 + distanceKm * 15),
        train: Math.round(Math.max(35, distanceKm * 2.1)),
        carpool: Math.round(Math.max(30, distanceKm * 4.2)),
        fuel: Math.round(distanceKm * 5.8),
      },
      times: {
        bus: Math.round(durationMin * 1.25),
        taxi: durationMin,
        train: Math.round(durationMin * 0.82),
        carpool: Math.round(durationMin * 1.05),
        fuel: durationMin,
      },
      geometry: route.geometry.coordinates.map((coord) => [coord[1], coord[0]]),
    });
  } catch {
    return res.status(500).json({ error: "Failed to calculate route" });
  }
}

export async function searchOptions(req, res) {
  const { from, to, type, date } = req.query;

  if (!from || !to) {
    return res.status(400).json({ error: "Both from and to are required" });
  }

  try {
    const result = await searchTransportOptions({ from, to, type, date });
    return res.json(result);
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Search failed",
    });
  }
}
