import { getPlaceAutocomplete } from "../services/mapsService.js";
import { getFallbackLocationSuggestions } from "../utils/fallbackModule.js";
import { searchTransportOptions } from "../services/searchService.js";

export async function getGeocodeSuggestions(req, res) {
  const query = req.query.q;

  if (!query) {
    return res.status(400).json({ error: "Query parameter q is required" });
  }

  try {
    const apiResults = await getPlaceAutocomplete(query);
    if (apiResults && apiResults.length > 0) {
      return res.json({ source: "api", results: apiResults });
    } else {
      const fallback = getFallbackLocationSuggestions(query, "API returned zero results");
      return res.json({ source: "fallback", results: fallback });
    }
  } catch (err) {
    const fallback = getFallbackLocationSuggestions(query, `API error: ${err.message}`);
    return res.json({ source: "fallback", results: fallback });
  }
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
