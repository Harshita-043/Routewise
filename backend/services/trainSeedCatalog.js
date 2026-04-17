import { locations, trainSeeds } from "../data/seedData.js";
import { normalizeOperatingDays, WEEKDAYS } from "../utils/utils.js";

const DEFAULT_CLASSES = [
  { type: "SL", factor: 0.85, reservationCharge: 25 },
  { type: "3A", factor: 1.15, reservationCharge: 45 },
  { type: "2A", factor: 1.45, reservationCharge: 60 },
  { type: "1A", factor: 1.9, reservationCharge: 75 },
  { type: "CC", factor: 1.05, reservationCharge: 35 },
];

function stationCode(name) {
  return name
    .replace(/[^A-Za-z]/g, "")
    .toUpperCase()
    .slice(0, 4)
    .padEnd(3, "X");
}

function parseTimeValue(time) {
  const [hours = "0", minutes = "0"] = String(time).split(":");
  return Number(hours) * 60 + Number(minutes);
}

function formatClock(totalMinutes) {
  return `${String(Math.floor(totalMinutes / 60) % 24).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
}

function formatDurationMinutes(totalMinutes) {
  const safeMinutes = Math.max(totalMinutes, 0);
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function buildIntermediateStations(seed) {
  const totalSegments = seed.intermediateStations.length + 1;

  return seed.intermediateStations.map((station, index) => {
    const progress = (index + 1) / totalSegments;
    const arrivalMinutes = parseTimeValue(seed.departureTime) + Math.round(progress * 110);
    const departureMinutes = arrivalMinutes + 5;

    return {
      code: stationCode(station.name),
      name: station.name,
      arrival: formatClock(arrivalMinutes),
      departure: formatClock(departureMinutes),
      distance: Math.round(progress * 1000),
      location: {
        type: "Point",
        coordinates: [station.lng, station.lat],
      },
    };
  });
}

export function buildSeedTrainDocuments() {
  return trainSeeds.map((seed, index) => {
    const sourceLocation = locations[seed.source];
    const destinationLocation = locations[seed.destination];
    const departureMinutes = parseTimeValue(seed.departureTime);
    let arrivalMinutes = parseTimeValue(seed.arrivalTime);

    if (arrivalMinutes < departureMinutes) {
      arrivalMinutes += 24 * 60;
    }

    const durationMinutes = arrivalMinutes - departureMinutes;
    const distanceKm = Math.max(150, Math.round((durationMinutes / 60) * 82));
    const intermediateStations = buildIntermediateStations(seed);

    return {
      trainNo: seed.trainId.replace(/^TR/, "12"),
      trainName: seed.trainName,
      source: seed.source,
      destination: seed.destination,
      sourceCode: stationCode(seed.source),
      destinationCode: stationCode(seed.destination),
      departureTime: seed.departureTime,
      arrivalTime: seed.arrivalTime,
      duration: formatDurationMinutes(durationMinutes),
      distanceKm,
      runningDays: normalizeOperatingDays(seed.operatingDays || WEEKDAYS),
      classes: DEFAULT_CLASSES.map((classType) => ({
        type: classType.type,
        baseFare: Math.max(180, Math.round(seed.fare * classType.factor)),
        reservationCharge: classType.reservationCharge,
        dynamicMultiplier: 1 + ((index % 3) * 0.08),
      })),
      intermediateStations,
      routePolyline: [
        [sourceLocation.lat, sourceLocation.lng],
        ...intermediateStations.map((station) => [station.location.coordinates[1], station.location.coordinates[0]]),
        [destinationLocation.lat, destinationLocation.lng],
      ],
      sourceProvider: "seed",
      metadata: {
        legacyTrainId: seed.trainId,
        defaultSeats: seed.seatAvailability,
        irctcBookingUrl: "https://www.irctc.co.in/nget/train-search",
      },
    };
  });
}

export function buildSeedStations() {
  return Object.values(locations).map((location) => ({
    code: stationCode(location.name),
    name: location.name,
    aliases: [location.name],
    mode: "railway",
    location: {
      type: "Point",
      coordinates: [location.lng, location.lat],
    },
  }));
}
