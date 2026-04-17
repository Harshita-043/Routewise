export async function getPlaceAutocomplete(query) {
  if (!query || query.length < 2) return [];

  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is not set");
  }

  try {
    const response = await fetch(
      "https://places.googleapis.com/v1/places:autocomplete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey
        },
        body: JSON.stringify({
          input: query,
          locationBias: {
            circle: {
              center: { latitude: 20.5937, longitude: 78.9629 }, // India center
              radius: 500000
            }
          }
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Places API failed: ${response.status}`);
    }

    const data = await response.json();

    if (!data.suggestions) {
      return [];
    }

    return data.suggestions.map(s => ({
      display_name: s.placePrediction.text.text,
      place_id: s.placePrediction.placeId
    }));

  } catch (error) {
    console.error("[Autocomplete API Error]", error.message);
    throw error; // ❗ don't fallback silently
  }
}