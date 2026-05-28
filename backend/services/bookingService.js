import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import { Bus } from "../models/Bus.js";
import { Carpool } from "../models/Carpool.js";
import { CarpoolRequest } from "../models/CarpoolRequest.js";
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

async function reserveInventory(transportType, record, passengers, session) {
  if (transportType === "train") {
    if (record.seatAvailability < passengers) {
      throw new Error("Not enough train seats available");
    }
    record.seatAvailability -= passengers;
    await record.save({ session });
  }

  if (transportType === "bus") {
    if (record.seatsAvailable < passengers) {
      throw new Error("Not enough bus seats available");
    }
    record.seatsAvailable -= passengers;
    await record.save({ session });
  }

  if (transportType === "taxi") {
    if (record.availability !== "online") {
      throw new Error("Taxi is no longer available");
    }
    record.availability = "offline";
    await record.save({ session });
  }

  // Carpool: use atomic $inc with a floor guard to prevent race conditions.
  // This avoids read-modify-write and eliminates write conflict errors.
  if (transportType === "carpool") {
    const updateOpts = session ? { session, new: true } : { new: true };
    const updated = await Carpool.findOneAndUpdate(
      { _id: record._id, availableSeats: { $gte: passengers } },
      { $inc: { availableSeats: -passengers } },
      updateOpts,
    );
    if (!updated) {
      throw new Error("Not enough carpool seats available or seat was already reserved");
    }
  }
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

export async function createBooking(payload, externalSession = null) {
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

  const session = externalSession || await mongoose.startSession();
  if (!externalSession) session.startTransaction();

  try {
    await reserveInventory(transportType, record, passengers, session);

    const [booking] = await Booking.create([{
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
    }], { session });

    // Use atomic $push instead of read-modify-save to avoid write conflicts
    // when the User document was loaded outside the transaction session boundary.
    const userUpdateOpts = externalSession ? { session } : {};
    await User.findByIdAndUpdate(
      existingUser._id,
      { $push: { bookings: booking._id } },
      userUpdateOpts
    );

    if (!externalSession) {
      await session.commitTransaction();
      session.endSession();
    }

    return booking.populate("userId", "name email phone");
  } catch (error) {
    if (!externalSession) {
      await session.abortTransaction();
      session.endSession();
    }
    throw error;
  }
}

export async function runAcceptTransaction(requestId, driverUserId) {
  // STEP 1: Atomically transition the request from pending → accepted.
  // This single findOneAndUpdate is inherently atomic — no session needed.
  // If it returns null, the request was not pending (or not owned by this driver).
  const request = await CarpoolRequest.findOneAndUpdate(
    { _id: requestId, driverId: driverUserId, status: "pending" },
    { status: "accepted" },
    { new: true }
  ).populate("rideId");

  if (!request) {
    // Idempotency guard: check if already accepted by a prior successful call
    const existingRequest = await CarpoolRequest.findOne({
      _id: requestId,
      driverId: driverUserId,
      status: "accepted",
    }).populate("rideId");

    if (existingRequest) {
      // Safe idempotent response — no error, no retry
      return { data: { request: existingRequest, booking: null, idempotent: true } };
    }

    return { error: "Request not found, unauthorized, or no longer pending", status: 404 };
  }

  // STEP 2: Fetch the passenger user document.
  const passengerUser = await mongoose.model("User").findById(request.passengerId);
  if (!passengerUser) {
    // Rollback the status change we just made
    await CarpoolRequest.findByIdAndUpdate(requestId, { status: "pending" });
    return { error: "Passenger not found", status: 404 };
  }

  // STEP 3: Create the booking. createBooking manages its own session internally.
  // We deliberately DO NOT pass an external session here — doing so caused a deadlock
  // because the User document (passengerUser) was read outside any session context,
  // and saving it inside a shared session caused MongoDB write conflicts.
  try {
    const booking = await createBooking({
      user: passengerUser,
      transportType: "carpool",
      transportId: request.rideId._id,
      source: request.source,
      destination: request.destination,
      date: request.rideDate,
      passengers: request.seatsRequested,
      seats: [],
      amount: request.totalAmount,
      passengerDetails: request.passengerDetails,
    });

    return { data: { request, booking } };
  } catch (bookingError) {
    // Booking failed — roll back the request status so the driver can retry
    console.error("[runAcceptTransaction] Booking creation failed, rolling back request status:", bookingError.message);
    await CarpoolRequest.findByIdAndUpdate(requestId, { status: "pending" });
    throw bookingError;
  }
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

  if (booking.transportType === "carpool") {
    await CarpoolRequest.findOneAndUpdate(
      { rideId: booking.transportRecordId, passengerId: booking.userId, status: "accepted" },
      { status: "cancelled" }
    );
  }

  return booking;
}
