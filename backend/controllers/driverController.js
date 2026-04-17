import { Bus } from "../models/Bus.js";
import { Carpool } from "../models/Carpool.js";
import { Driver } from "../models/Driver.js";
import { Taxi } from "../models/Taxi.js";
import { geocodeLocation } from "../services/locationService.js";
import { normalizeOperatingDays } from "../utils/utils.js";

export async function registerDriverHandler(req, res) {
  const {
    name,
    email,
    phone,
    transportType,
    availability,
    vehicleType,
    carNumber,
    source,
    destination,
    departureTime,
    availableSeats,
    price,
    pricePerKm,
    stops = [],
    operatingDays,
  } = req.body;

  if (!name || !phone || !transportType) {
    return res.status(400).json({ error: "name, phone, and transportType are required" });
  }

  const sourcePoint = source ? await geocodeLocation(source) : null;
  const normalizedOperatingDays = normalizeOperatingDays(operatingDays);

  const existingDriver = await Driver.findOne({
    $or: [
      ...(email ? [{ email: email.toLowerCase() }] : []),
      { phone },
    ],
  });

  const driverPayload = {
    name,
    email: email?.toLowerCase(),
    phone,
    availability: availability || "online",
    vehicleType,
    carNumber,
    currentLocationName: sourcePoint?.name || source || name,
    currentLocation: sourcePoint
      ? {
          type: "Point",
          coordinates: [sourcePoint.lng, sourcePoint.lat],
        }
      : existingDriver?.currentLocation,
    activeRoutes: source && destination && departureTime
      ? [{ source, destination, time: departureTime }]
      : existingDriver?.activeRoutes || [],
  };

  const driver = existingDriver
    ? await Driver.findByIdAndUpdate(
        existingDriver._id,
        {
          ...driverPayload,
          registeredFor: [...new Set([...(existingDriver.registeredFor || []), transportType])],
        },
        { new: true },
      )
    : await Driver.create({
        driverId: `DRV${Date.now()}`,
        ...driverPayload,
        registeredFor: [transportType],
      });

  let createdTransport = null;

  if (transportType === "bus") {
    createdTransport = await Bus.create({
      busId: `BUS${Date.now().toString().slice(-6)}`,
      operatorName: `${name} Transit`,
      source,
      destination,
      stops: stops.map((stop) => ({
        name: stop.name,
        lat: Number(stop.lat),
        lng: Number(stop.lng),
      })),
      departureTime,
      operatingDays: normalizedOperatingDays,
      seatsAvailable: Number(availableSeats || 20),
      price: Number(price || 400),
      driverId: driver.driverId,
    });
  }

  if (transportType === "taxi") {
    createdTransport = await Taxi.findOneAndUpdate(
      { driverId: driver.driverId },
      {
        driverId: driver.driverId,
        name,
        phone,
        vehicleType: vehicleType || "Sedan",
        carNumber: carNumber || "TEMP-0000",
        currentLocationName: sourcePoint?.name || source || "Unknown",
        currentLocation: sourcePoint
          ? { type: "Point", coordinates: [sourcePoint.lng, sourcePoint.lat] }
          : { type: "Point", coordinates: [77.209, 28.6139] },
        availability: availability || "online",
        pricePerKm: Number(pricePerKm || 15),
      },
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );
  }

  if (transportType === "carpool") {
    createdTransport = await Carpool.create({
      driverId: driver.driverId,
      route: { source, destination },
      availableSeats: Number(availableSeats || 3),
      time: departureTime || "08:00",
      pricePerSeat: Number(price || 250),
      startLocationName: sourcePoint?.name || source,
      startLocation: sourcePoint
        ? { type: "Point", coordinates: [sourcePoint.lng, sourcePoint.lat] }
        : undefined,
    });
  }

  return res.status(201).json({
    driver,
    transport: createdTransport,
  });
}
