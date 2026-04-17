import { Bus } from "../models/Bus.js";
import { Carpool } from "../models/Carpool.js";
import { Driver } from "../models/Driver.js";
import { Taxi } from "../models/Taxi.js";
import { Train } from "../models/Train.js";
import { locations } from "../data/seedData.js";
import {
  findNearbyKnownLocations,
  geocodeLocation,
} from "./locationService.js";
import {
  haversineDistanceKm,
  isPlaceMatch,
  normalizeOperatingDays,
  normalizePlace,
  operatesOnDate,
  scorePlaceSimilarity,
  toLatLng,
} from "../utils/utils.js";

function resolveKnownPoint(name, fallbackPoint) {
  return locations[name] || fallbackPoint || { name, lat: 0, lng: 0 };
}

function buildTrainStops(train) {
  return [
    resolveKnownPoint(train.source),
    ...train.intermediateStations,
    resolveKnownPoint(train.destination),
  ];
}

function buildBusStops(bus) {
  return [
    resolveKnownPoint(bus.source),
    ...bus.stops,
    resolveKnownPoint(bus.destination),
  ];
}

function findSegment(stops, sourceName, destinationName) {
  const startIndex = stops.findIndex((stop) => isPlaceMatch(stop.name, sourceName));
  const endIndex = stops.findIndex((stop) => isPlaceMatch(stop.name, destinationName));

  if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
    return { isDirect: true, startIndex, endIndex };
  }

  return { isDirect: false, startIndex: -1, endIndex: -1 };
}

function findAlternateSegment(stops, fromPoint, toPoint, radiusKm) {
  const nearbySources = stops
    .map((stop, index) => ({
      index,
      stop,
      distanceKm: haversineDistanceKm(fromPoint, stop),
    }))
    .filter((item) => item.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const nearbyDestinations = stops
    .map((stop, index) => ({
      index,
      stop,
      distanceKm: haversineDistanceKm(toPoint, stop),
    }))
    .filter((item) => item.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);

  const combination = nearbySources.find((source) =>
    nearbyDestinations.some((destination) => source.index < destination.index),
  );

  if (!combination) {
    return null;
  }

  const destination = nearbyDestinations.find((item) => item.index > combination.index);

  if (!destination) {
    return null;
  }

  return {
    source: combination,
    destination,
  };
}

function scoreAlternative(alternative) {
  return alternative.source.distanceKm + alternative.destination.distanceKm;
}

function scoreRouteMatch(stops, fromPoint, toPoint) {
  const sourceScore = Math.max(
    ...stops.map((stop) => scorePlaceSimilarity(stop.name, fromPoint.name)),
  );
  const destinationScore = Math.max(
    ...stops.map((stop) => scorePlaceSimilarity(stop.name, toPoint.name)),
  );

  return sourceScore + destinationScore;
}

function estimateDurationHours(fromPoint, toPoint, speedKmph, minimumHours = 1) {
  const distance = haversineDistanceKm(fromPoint, toPoint);
  return Math.max(minimumHours, Math.round((distance / speedKmph) * 10) / 10);
}

function formatDuration(hours) {
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return wholeHours ? `${wholeHours}h ${mins}m` : `${mins}m`;
}

function buildTrainResult(train, fromPoint, toPoint, matchType, alternative = null) {
  const distance = haversineDistanceKm(fromPoint, toPoint);

  return {
    id: train._id,
    code: train.trainId,
    transportType: "train",
    label: train.trainName,
    source: alternative?.source?.stop?.name ?? train.source,
    destination: alternative?.destination?.stop?.name ?? train.destination,
    departureTime: train.departureTime,
    arrivalTime: train.arrivalTime,
    seatsAvailable: train.seatAvailability,
    amount: train.fare,
    durationText: formatDuration(estimateDurationHours(fromPoint, toPoint, 85)),
    distanceKm: Math.round(distance),
    matchType,
    alternative,
    metadata: {
      intermediateStations: train.intermediateStations.map((station) => station.name),
      operatingDays: normalizeOperatingDays(train.operatingDays),
      alternateStops: alternative
        ? {
            boarding: alternative.source.stop.name,
            boardingDistanceKm: Math.round(alternative.source.distanceKm * 10) / 10,
            dropoff: alternative.destination.stop.name,
            dropoffDistanceKm: Math.round(alternative.destination.distanceKm * 10) / 10,
          }
        : null,
    },
  };
}

function buildBusResult(bus, fromPoint, toPoint, driver, matchType, alternative = null) {
  const distance = haversineDistanceKm(fromPoint, toPoint);

  return {
    id: bus._id,
    code: bus.busId,
    transportType: "bus",
    label: bus.operatorName,
    source: alternative?.source?.stop?.name ?? bus.source,
    destination: alternative?.destination?.stop?.name ?? bus.destination,
    departureTime: bus.departureTime,
    seatsAvailable: bus.seatsAvailable,
    amount: bus.price,
    durationText: formatDuration(estimateDurationHours(fromPoint, toPoint, 55)),
    distanceKm: Math.round(distance),
    driverId: bus.driverId,
    driverName: driver?.name ?? "Assigned Driver",
    matchType,
    alternative,
    metadata: {
      stops: bus.stops.map((stop) => stop.name),
      operatingDays: normalizeOperatingDays(bus.operatingDays),
      alternateStops: alternative
        ? {
            boarding: alternative.source.stop.name,
            boardingDistanceKm: Math.round(alternative.source.distanceKm * 10) / 10,
            dropoff: alternative.destination.stop.name,
            dropoffDistanceKm: Math.round(alternative.destination.distanceKm * 10) / 10,
          }
        : null,
    },
  };
}

function buildCarpoolResult(ride, fromPoint, toPoint, matchType) {
  const distance = haversineDistanceKm(fromPoint, toPoint);
  return {
    id: ride._id,
    code: ride.driverId,
    transportType: "carpool",
    label: `Carpool with ${ride.driverId}`,
    source: ride.route.source,
    destination: ride.route.destination,
    departureTime: ride.time,
    seatsAvailable: ride.availableSeats,
    amount: ride.pricePerSeat,
    durationText: formatDuration(estimateDurationHours(fromPoint, toPoint, 60)),
    distanceKm: Math.round(distance),
    matchType,
  };
}

function buildTaxiResult(taxi, fromPoint, toPoint) {
  const pickupDistance = haversineDistanceKm(fromPoint, toLatLng(taxi.currentLocation));
  const tripDistance = haversineDistanceKm(fromPoint, toPoint);
  const amount = Math.round(80 + tripDistance * taxi.pricePerKm);

  return {
    id: taxi._id,
    code: taxi.driverId,
    transportType: "taxi",
    label: `${taxi.name} • ${taxi.vehicleType}`,
    source: fromPoint.name,
    destination: toPoint.name,
    departureTime: "On demand",
    seatsAvailable: 4,
    amount,
    durationText: formatDuration(estimateDurationHours(fromPoint, toPoint, 42)),
    distanceKm: Math.round(tripDistance),
    driverId: taxi.driverId,
    driverName: taxi.name,
    matchType: "direct",
    pickupDistanceKm: Math.round(pickupDistance * 10) / 10,
    metadata: {
      carNumber: taxi.carNumber,
      pricePerKm: taxi.pricePerKm,
    },
  };
}

export async function searchTransportOptions({ from, to, type, date }) {
  const fromPoint = await geocodeLocation(from);
  const toPoint = await geocodeLocation(to);

  if (!fromPoint || !toPoint) {
    throw new Error("Could not resolve one or both locations");
  }

  const [trains, buses, taxis, carpools, drivers] = await Promise.all([
    Train.find().lean(),
    Bus.find().lean(),
    Taxi.find({ availability: "online" }).lean(),
    Carpool.find().lean(),
    Driver.find().lean(),
  ]);

  const driverMap = new Map(drivers.map((driver) => [driver.driverId, driver]));

  const results = {
    train: [],
    bus: [],
    taxi: [],
    carpool: [],
  };

  const suggestions = {
    train: [],
    bus: [],
    taxi: [],
    carpool: [],
  };

  if (!type || type === "train") {
    trains.forEach((train) => {
      if (date && !operatesOnDate(train, date)) {
        return;
      }

      const stops = buildTrainStops(train);
      const segment = findSegment(stops, fromPoint.name, toPoint.name);

      if (segment.isDirect) {
        results.train.push(buildTrainResult(train, fromPoint, toPoint, "direct"));
        return;
      }

      const alternate = findAlternateSegment(stops, fromPoint, toPoint, 50);
      if (alternate) {
        suggestions.train.push(buildTrainResult(train, fromPoint, toPoint, "alternate", alternate));
      }
    });
  }

  if (!type || type === "bus") {
    buses.forEach((bus) => {
      if (date && !operatesOnDate(bus, date)) {
        return;
      }

      const stops = buildBusStops(bus);
      const segment = findSegment(stops, fromPoint.name, toPoint.name);

      if (segment.isDirect) {
        results.bus.push(buildBusResult(bus, fromPoint, toPoint, driverMap.get(bus.driverId), "direct"));
        return;
      }

      const alternate = findAlternateSegment(stops, fromPoint, toPoint, 50);
      if (alternate) {
        suggestions.bus.push(buildBusResult(bus, fromPoint, toPoint, driverMap.get(bus.driverId), "alternate", alternate));
      }
    });
  }

  if (!type || type === "taxi") {
    taxis
      .map((taxi) => buildTaxiResult(taxi, fromPoint, toPoint))
      .filter((taxi) => taxi.pickupDistanceKm <= 10)
      .sort((a, b) => a.pickupDistanceKm - b.pickupDistanceKm)
      .forEach((taxi) => results.taxi.push(taxi));
  }

  if (!type || type === "carpool") {
    carpools.forEach((ride) => {
      const sourceMatch = normalizePlace(ride.route.source) === normalizePlace(fromPoint.name);
      const destinationMatch = normalizePlace(ride.route.destination) === normalizePlace(toPoint.name);

      if (sourceMatch && destinationMatch) {
        results.carpool.push(buildCarpoolResult(ride, fromPoint, toPoint, "direct"));
        return;
      }

      const sourceDistance = ride.startLocation
        ? haversineDistanceKm(fromPoint, toLatLng(ride.startLocation))
        : 99;

      if (sourceDistance <= 20) {
        suggestions.carpool.push(buildCarpoolResult(ride, fromPoint, toPoint, "alternate"));
      }
    });
  }

  const nearbyFrom = findNearbyKnownLocations(fromPoint, 50).map((location) => ({
    name: location.name,
    distanceKm: Math.round(location.distanceKm * 10) / 10,
  })).filter((location) => !isPlaceMatch(location.name, fromPoint.name));

  const nearbyTo = findNearbyKnownLocations(toPoint, 50).map((location) => ({
    name: location.name,
    distanceKm: Math.round(location.distanceKm * 10) / 10,
  })).filter((location) => !isPlaceMatch(location.name, toPoint.name));

  results.train.sort((a, b) => a.amount - b.amount);
  results.bus.sort((a, b) => a.amount - b.amount);
  results.taxi.sort((a, b) => a.pickupDistanceKm - b.pickupDistanceKm || a.amount - b.amount);
  results.carpool.sort((a, b) => a.amount - b.amount);

  suggestions.train.sort((a, b) => {
    const trainA = trains.find((train) => String(train._id) === String(a.id));
    const trainB = trains.find((train) => String(train._id) === String(b.id));
    const stopsA = trainA ? buildTrainStops(trainA) : [];
    const stopsB = trainB ? buildTrainStops(trainB) : [];
    const proximityA = a.alternative ? scoreAlternative(a.alternative) : Number.MAX_SAFE_INTEGER;
    const proximityB = b.alternative ? scoreAlternative(b.alternative) : Number.MAX_SAFE_INTEGER;
    return (
      proximityA - proximityB ||
      scoreRouteMatch(stopsB, fromPoint, toPoint) - scoreRouteMatch(stopsA, fromPoint, toPoint) ||
      a.amount - b.amount
    );
  });

  suggestions.bus.sort((a, b) => {
    const busA = buses.find((bus) => String(bus._id) === String(a.id));
    const busB = buses.find((bus) => String(bus._id) === String(b.id));
    const stopsA = busA ? buildBusStops(busA) : [];
    const stopsB = busB ? buildBusStops(busB) : [];
    const proximityA = a.alternative ? scoreAlternative(a.alternative) : Number.MAX_SAFE_INTEGER;
    const proximityB = b.alternative ? scoreAlternative(b.alternative) : Number.MAX_SAFE_INTEGER;
    return (
      proximityA - proximityB ||
      scoreRouteMatch(stopsB, fromPoint, toPoint) - scoreRouteMatch(stopsA, fromPoint, toPoint) ||
      a.amount - b.amount
    );
  });

  suggestions.taxi.sort((a, b) => a.amount - b.amount);
  suggestions.carpool.sort((a, b) => a.amount - b.amount);

  return {
    query: { from: fromPoint.name, to: toPoint.name },
    results,
    suggestions,
    nearby: {
      from: nearbyFrom,
      to: nearbyTo,
    },
  };
}
