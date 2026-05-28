/**
 * mapsService.js
 *
 * Attempts Google Places autocomplete.
 * Returns null (not throws) when the API key is absent, billing is disabled,
 * quota is exceeded, or any other API-level failure occurs so that the caller
 * can immediately switch to the local fallback without a try/catch dance.
 */

export async function getPlaceAutocomplete(query) {
  if (!query || query.length < 2) return null;

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  // No key configured — skip Google entirely, return null for fallback
  if (!apiKey) {
    console.warn("[mapsService] GOOGLE_MAPS_API_KEY not set — skipping Google Places.");
    return null;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 s hard cap

    const response = await fetch(
      "https://places.googleapis.com/v1/places:autocomplete",
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
        },
        body: JSON.stringify({
          input: query,
          locationBias: {
            circle: {
              center: { latitude: 20.5937, longitude: 78.9629 }, // India centre
              radius: 500000,
            },
          },
        }),
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn(`[mapsService] Places API HTTP ${response.status} — falling back.`);
      return null; // non-fatal: let caller use fallback
    }

    const data = await response.json();

    if (!data.suggestions || data.suggestions.length === 0) {
      return null; // API succeeded but no results; use fallback
    }

    return data.suggestions.map((s) => ({
      display_name: s.placePrediction.text.text,
      place_id: s.placePrediction.placeId,
      // lat/lon are NOT returned by the autocomplete endpoint; they are set
      // only after a Place Details lookup.  Leave undefined so the controller
      // can decide whether to enrich or fall back.
    }));
  } catch (error) {
    if (error.name === "AbortError") {
      console.warn("[mapsService] Places API timed out — falling back.");
    } else {
      console.warn("[mapsService] Places API error:", error.message, "— falling back.");
    }
    return null; // always non-fatal
  }
}