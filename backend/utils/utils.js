const STOP_WORDS = new Set([
  "city",
  "district",
  "division",
  "india",
  "junction",
  "junctions",
  "jn",
  "jn.",
  "railway",
  "railways",
  "railwaystation",
  "station",
  "stn",
  "terminal",
  "terminus",
  "metro",
  "bus",
  "stand",
  "airport",
]);

export const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

export function normalizePlace(value = "") {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !STOP_WORDS.has(token))
    .join(" ")
    .trim();
}

export function tokenizePlace(value = "") {
  return normalizePlace(value)
    .split(" ")
    .filter(Boolean);
}

export function scorePlaceSimilarity(left = "", right = "") {
  const normalizedLeft = normalizePlace(left);
  const normalizedRight = normalizePlace(right);

  if (!normalizedLeft || !normalizedRight) {
    return 0;
  }

  if (normalizedLeft === normalizedRight) {
    return 100;
  }

  if (
    normalizedLeft.startsWith(normalizedRight) ||
    normalizedRight.startsWith(normalizedLeft)
  ) {
    return 92;
  }

  if (
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  ) {
    return 85;
  }

  const leftTokens = new Set(tokenizePlace(left));
  const rightTokens = new Set(tokenizePlace(right));
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;

  if (!overlap) {
    return 0;
  }

  const denominator = Math.max(leftTokens.size, rightTokens.size, 1);
  return Math.round((overlap / denominator) * 75);
}

export function isPlaceMatch(left = "", right = "", threshold = 85) {
  return scorePlaceSimilarity(left, right) >= threshold;
}

export function haversineDistanceKm(pointA, pointB) {
  const toRad = (degrees) => (degrees * Math.PI) / 180;

  const dLat = toRad(pointB.lat - pointA.lat);
  const dLng = toRad(pointB.lng - pointA.lng);
  const lat1 = toRad(pointA.lat);
  const lat2 = toRad(pointB.lat);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);

  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function generateBookingId() {
  const stamp = Date.now().toString(36).toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `RW-${stamp}-${suffix}`;
}

export function generateSeatMap(prefix, total = 40) {
  return Array.from({ length: total }, (_, index) => `${prefix}${index + 1}`);
}

export function toLatLng(geoPoint) {
  return {
    lat: geoPoint.coordinates[1],
    lng: geoPoint.coordinates[0],
  };
}

export function normalizeOperatingDays(days) {
  if (!Array.isArray(days) || !days.length) {
    return [...WEEKDAYS];
  }

  const normalizedDays = days
    .map((day) => normalizePlace(String(day)))
    .filter((day) => WEEKDAYS.includes(day));

  return normalizedDays.length ? [...new Set(normalizedDays)] : [...WEEKDAYS];
}

export function getWeekdayForDate(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return WEEKDAYS[date.getUTCDay()];
}

export function operatesOnDate(record, dateInput) {
  const weekday = getWeekdayForDate(dateInput);

  if (!weekday) {
    return true;
  }

  return normalizeOperatingDays(record?.operatingDays).includes(weekday);
}
