export const fallbackLocations = {
  Delhi: { name: "Delhi", lat: 28.6139, lng: 77.209 },
  Mumbai: { name: "Mumbai", lat: 19.076, lng: 72.8777 },
  Bengaluru: { name: "Bengaluru", lat: 12.9716, lng: 77.5946 },
  Kolkata: { name: "Kolkata", lat: 22.5726, lng: 88.3639 },
  Chennai: { name: "Chennai", lat: 13.0827, lng: 80.2707 },
  Hyderabad: { name: "Hyderabad", lat: 17.385, lng: 78.4867 },
  Pune: { name: "Pune", lat: 18.5204, lng: 73.8567 },
  Ahmedabad: { name: "Ahmedabad", lat: 23.0225, lng: 72.5714 },
  Jaipur: { name: "Jaipur", lat: 26.9124, lng: 75.7873 },
  Lucknow: { name: "Lucknow", lat: 26.8467, lng: 80.9462 },
  Kanpur: { name: "Kanpur", lat: 26.4499, lng: 80.3319 },
  Nagpur: { name: "Nagpur", lat: 21.1458, lng: 79.0882 },
  Indore: { name: "Indore", lat: 22.7196, lng: 75.8577 },
  Thane: { name: "Thane", lat: 19.2183, lng: 72.9781 },
  Bhopal: { name: "Bhopal", lat: 23.2599, lng: 77.4126 },
  Visakhapatnam: { name: "Visakhapatnam", lat: 17.6868, lng: 83.2185 },
  Surat: { name: "Surat", lat: 21.1702, lng: 72.8311 },
  Patna: { name: "Patna", lat: 25.5941, lng: 85.1376 },
  Vadodara: { name: "Vadodara", lat: 22.3072, lng: 73.1812 },
  Ghaziabad: { name: "Ghaziabad", lat: 28.6692, lng: 77.4538 },
  Ludhiana: { name: "Ludhiana", lat: 30.901, lng: 75.8573 },
  Agra: { name: "Agra", lat: 27.1767, lng: 78.0081 },
  Nashik: { name: "Nashik", lat: 19.9975, lng: 73.7898 },
  Faridabad: { name: "Faridabad", lat: 28.4089, lng: 77.3178 },
  Meerut: { name: "Meerut", lat: 28.9845, lng: 77.7064 },
  Rajkot: { name: "Rajkot", lat: 22.3039, lng: 70.8022 },
  Varanasi: { name: "Varanasi", lat: 25.3176, lng: 82.9739 },
  Srinagar: { name: "Srinagar", lat: 34.0837, lng: 74.7973 },
  Aurangabad: { name: "Aurangabad", lat: 19.8762, lng: 75.3433 },
  Dhanbad: { name: "Dhanbad", lat: 23.7957, lng: 86.4304 },
  Amritsar: { name: "Amritsar", lat: 31.634, lng: 74.8723 },
  NaviMumbai: { name: "Navi Mumbai", lat: 19.033, lng: 73.0297 },
  Allahabad: { name: "Allahabad", lat: 25.4358, lng: 81.8463 },
  Ranchi: { name: "Ranchi", lat: 23.3441, lng: 85.3096 },
  Howrah: { name: "Howrah", lat: 22.5958, lng: 88.311 },
  Coimbatore: { name: "Coimbatore", lat: 11.0168, lng: 76.9558 },
  Jabalpur: { name: "Jabalpur", lat: 23.1815, lng: 79.9864 },
  Gwalior: { name: "Gwalior", lat: 26.2183, lng: 78.1828 },
  Vijayawada: { name: "Vijayawada", lat: 16.5062, lng: 80.648 },
  Jodhpur: { name: "Jodhpur", lat: 26.2389, lng: 73.0243 },
  Madurai: { name: "Madurai", lat: 9.9252, lng: 78.1198 },
  Raipur: { name: "Raipur", lat: 21.2514, lng: 81.6296 },
  Kota: { name: "Kota", lat: 25.2138, lng: 75.8648 },
  Guwahati: { name: "Guwahati", lat: 26.1445, lng: 91.7362 },
  Chandigarh: { name: "Chandigarh", lat: 30.7333, lng: 76.7794 },
  Solapur: { name: "Solapur", lat: 17.6599, lng: 75.9064 },
  Hubballi: { name: "Hubballi", lat: 15.3647, lng: 75.124 },
  Tiruchirappalli: { name: "Tiruchirappalli", lat: 10.7905, lng: 78.7047 },
  Bareilly: { name: "Bareilly", lat: 28.367, lng: 79.4304 },
  Moradabad: { name: "Moradabad", lat: 28.8386, lng: 78.7733 },
  Mysuru: { name: "Mysuru", lat: 12.2958, lng: 76.6394 },
};

function scoreStringSimilarity(a, b) {
  const s1 = (a || "").toLowerCase();
  const s2 = (b || "").toLowerCase();
  if (s1 === s2) return 100;
  if (s1.includes(s2) || s2.includes(s1)) return 50;
  return 0;
}

export function getFallbackLocationSuggestions(query, reason) {
  console.log(`[Fallback Triggered] Location Suggestions for "${query}". Reason: ${reason}`);

  if (!query) return [];
  const results = Object.values(fallbackLocations)
    .map(loc => ({
      ...loc,
      score: scoreStringSimilarity(query, loc.name)
    }))
    .filter(loc => loc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(loc => ({
      display_name: `${loc.name}, India`,
      place_id: `fallback_${loc.name}`,
      lat: String(loc.lat),
      lon: String(loc.lng)
    }));

  return results;
}
