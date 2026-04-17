import { Booking } from "../models/Booking.js";
import { Bus } from "../models/Bus.js";
import { Carpool } from "../models/Carpool.js";
import { Taxi } from "../models/Taxi.js";
import { Train } from "../models/Train.js";
import { User } from "../models/User.js";
import { generateBookingId, operatesOnDate } from "../utils/utils.js";

async function getTransportRecord(transportType, transportId) {
  switch (transportType) {
    case "train":
      return { model: Train, record: await Train.findById(transportId) };
    case "bus":
      return { model: Bus, record: await Bus.findById(transportId) };
    case "taxi":
      return { model: Taxi, record: await Taxi.findById(transportId) };
    case "carpool":
      return { model: Carpool, record: await Carpool.findById(transportId) };
    default:
      return { model: null, record: null };
  }
}

function getTransportName(type, record) {
  if (type === "train") {
    return record.trainName;
  }
  if (type === "bus") {
    return record.operatorName;
  }
  if (type === "taxi") {
    return `${record.name} • ${record.vehicleType}`;
  }
  return `Carpool ${record.driverId}`;
}

function getTransportCode(type, record) {
  if (type === "train") {
    return record.trainId;
  }
  if (type === "bus") {
    return record.busId;
  }
  return record.driverId;
}

function getUnitPrice(type, record) {
  if (type === "train") {
    return record.fare;
  }
  if (type === "bus") {
    return record.price;
  }
  if (type === "taxi") {
    return record.pricePerKm;
  }
  return record.pricePerSeat;
}

async function reserveInventory(transportType, record, passengers) {
  if (transportType === "train") {
    if (record.seatAvailability < passengers) {
      throw new Error("Not enough train seats available");
    }
    record.seatAvailability -= passengers;
  }

  if (transportType === "bus") {
    if (record.seatsAvailable < passengers) {
      throw new Error("Not enough bus seats available");
    }
    record.seatsAvailable -= passengers;
  }

  if (transportType === "taxi") {
    if (record.availability !== "online") {
      throw new Error("Taxi is no longer available");
    }
    record.availability = "offline";
  }

  if (transportType === "carpool") {
    if (record.availableSeats < passengers) {
      throw new Error("Not enough carpool seats available");
    }
    record.availableSeats -= passengers;
  }

  await record.save();
}

async function releaseInventory(booking) {
  const { record } = await getTransportRecord(booking.transportType, booking.transportRecordId);

  if (!record) {
    return;
  }

  if (booking.transportType === "train") {
    record.seatAvailability += booking.passengers;
  }

  if (booking.transportType === "bus") {
    record.seatsAvailable += booking.passengers;
  }

  if (booking.transportType === "taxi") {
    record.availability = "online";
  }

  if (booking.transportType === "carpool") {
    record.availableSeats += booking.passengers;
  }

  await record.save();
}

export async function createBooking(payload) {
  const {
    user,
    transportType,
    transportId,
    source,
    destination,
    date,
    passengers,
    seats,
    amount,
    passengerDetails,
  } = payload;

  const { record } = await getTransportRecord(transportType, transportId);

  if (!record) {
    throw new Error("Selected transport option was not found");
  }

  if ((transportType === "bus" || transportType === "train") && !operatesOnDate(record, date)) {
    throw new Error(`This ${transportType} is not scheduled for the selected date`);
  }

  const existingUser = await User.findOneAndUpdate(
    { email: user.email.toLowerCase() },
    {
      $set: {
        name: user.name,
        phone: user.phone,
      },
    },
    { new: true },
  );

  if (!existingUser) {
    throw new Error("Authenticated user was not found");
  }

  await reserveInventory(transportType, record, passengers);

  const booking = await Booking.create({
    bookingId: generateBookingId(),
    userId: existingUser._id,
    transportType,
    transportRecordId: record._id,
    transportCode: getTransportCode(transportType, record),
    transportName: getTransportName(transportType, record),
    source,
    destination,
    date,
    passengers,
    seats: seats || [],
    amount,
    status: "confirmed",
    paymentStatus: "paid",
    passengerDetails,
    snapshot: {
      unitPrice: getUnitPrice(transportType, record),
      source,
      destination,
    },
  });

  existingUser.bookings.push(booking._id);
  await existingUser.save();

  return booking.populate("userId", "name email phone");
}

export async function getBookingsByEmail(email) {
  const user = await User.findOne({ email: email.toLowerCase() });

  if (!user) {
    return [];
  }

  return Booking.find({ userId: user._id }).sort({ createdAt: -1 }).lean();
}

export async function cancelBookingById(id) {
  const booking = await Booking.findById(id);

  if (!booking) {
    throw new Error("Booking not found");
  }

  if (booking.status === "cancelled") {
    return booking;
  }

  booking.status = "cancelled";
  booking.paymentStatus = "refunded";
  await booking.save();
  await releaseInventory(booking);

  return booking;
}
