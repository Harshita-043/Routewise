import { locations } from "../data/seedData.js";
import {
  haversineDistanceKm,
  normalizePlace,
  scorePlaceSimilarity,
} from "../utils/utils.js";

const knownLocations = Object.values(locations);
const locationAliases = {
  Delhi: ["new delhi", "ndls", "delhi cantt", "delhi junction"],
  Gurugram: ["gurgaon", "gurugram railway station"],
  Noida: ["noida city centre", "new okhla"],
  Agra: ["agra cantt", "agra cantonment"],
  Jaipur: ["jaipur junction"],
  Chandigarh: ["chandigarh junction"],
  Ludhiana: ["ludhiana junction"],
  Amritsar: ["amritsar junction"],
  Lucknow: ["lucknow jn", "lucknow junction", "charbagh"],
  Kanpur: ["kanpur central", "kanpur cnt"],
  Varanasi: ["banaras", "varanasi junction", "manduadih"],
  Patna: ["patna junction", "pnbe"],
  Ranchi: ["ranchi junction"],
  Kolkata: ["howrah", "kolkata station", "sealdah"],
  Mumbai: ["mumbai central", "cst", "csmt", "bombay"],
  Thane: ["thane station"],
  Pune: ["pune junction", "pune station"],
  Nashik: ["nasik", "nashik road"],
  Surat: ["surat station"],
  Vadodara: ["baroda", "vadodara junction"],
  Ahmedabad: ["ahmedabad junction", "kalupur", "adi"],
  Bhopal: ["bhopal junction"],
  Indore: ["indore junction"],
  Hyderabad: ["secunderabad", "hyderabad deccan", "nampally"],
  Vijayawada: ["bezawada", "vijayawada junction"],
  Bengaluru: ["bangalore", "bengaluru city", "sbc", "krantivira sangolli rayanna"],
  Mysuru: ["mysore", "mysuru junction"],
  Chennai: ["madras", "chennai central", "mas", "mgr chennai central"],
  Coimbatore: ["coimbatore junction"],
};

function getLocationSearchTerms(location) {
  return [location.name, ...(locationAliases[location.name] || [])];
}

function scoreLocationMatch(query, location) {
  return getLocationSearchTerms(location).reduce(
    (bestScore, term) => Math.max(bestScore, scorePlaceSimilarity(query, term)),
    0,
  );
}

function formatKnownLocation(location) {
  return {
    display_name: `${location.name}, India`,
    lat: String(location.lat),
    lon: String(location.lng),
  };
}

export async function geocodeLocation(query) {
  if (!query) {
    return null;
  }

  const localMatch = [...knownLocations]
    .map((location) => ({ location, score: scoreLocationMatch(query, location) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  if (localMatch) {
    return localMatch.location;
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=in`,
      { headers: { Accept: "application/json" } },
    );

    if (!response.ok) {
      return null;
    }

    const results = await response.json();
    if (!Array.isArray(results) || !results.length) {
      return null;
    }

    const first = results[0];
    return {
      name: first.display_name.split(",").slice(0, 2).join(", "),
      lat: Number(first.lat),
      lng: Number(first.lon),
    };
  } catch {
    return null;
  }
}

export async function geocodeSuggestions(query) {
  const normalizedQuery = normalizePlace(query);
  const localSuggestions = knownLocations
    .map((location) => ({
      location,
      score: normalizedQuery ? scoreLocationMatch(query, location) : 0,
    }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((item) => formatKnownLocation(item.location));

  if (localSuggestions.length || !query) {
    return localSuggestions;
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=in`,
      { headers: { Accept: "application/json" } },
    );

    if (!response.ok) {
      return [];
    }

    const results = await response.json();
    return Array.isArray(results) ? results : [];
  } catch {
    return [];
  }
}

export function findNearbyKnownLocations(point, radiusKm) {
  return knownLocations
    .map((location) => ({
      ...location,
      distanceKm: haversineDistanceKm(point, location),
    }))
    .filter((location) => location.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}
