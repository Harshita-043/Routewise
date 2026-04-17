import { buildFareBreakdown } from "./fareEngine.js";

const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCacheKey(trainNo, date, classType) {
  return `${trainNo}:${date}:${classType}`;
}

function getCachedValue(key) {
  const cached = cache.get(key);

  if (!cached) {
    return null;
  }

  if (cached.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }

  return cached.value;
}

function setCachedValue(key, value) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });
}

function calculateSimulatedAvailability(train, date, classType) {
  const seed = `${train.trainNo}${date}${classType}`.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const fareBreakdown = buildFareBreakdown({ train, classType, date });
  const seatsLeft = seed % 37;

  return {
    available: seatsLeft > 0,
    seatsLeft,
    currentFare: fareBreakdown.total,
    tatkalSurcharge: fareBreakdown.tatkalSurcharge,
    quota: seatsLeft > 10 ? "GN" : "WL",
    source: "simulated",
  };
}

export async function getTrainAvailability(train, date, classType = "SL") {
  const key = getCacheKey(train.trainNo, date, classType);
  const cachedValue = getCachedValue(key);

  if (cachedValue) {
    return cachedValue;
  }

  // Uses robust deterministic simulation since live Indian Railways APIs are unavailable
  const value = calculateSimulatedAvailability(train, date, classType);

  setCachedValue(key, value);
  return value;
}

export async function attachAvailability(trains, date, classType = "SL", limit = 5) {
  const head = await Promise.all(
    trains.slice(0, limit).map(async (train) => ({
      ...train,
      availability: await getTrainAvailability(train, date, classType),
    })),
  );

  return [
    ...head,
    ...trains.slice(limit).map((train) => ({
      ...train,
      availability: null,
    })),
  ];
}
