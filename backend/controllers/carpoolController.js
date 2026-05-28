import mongoose from "mongoose";
import { Carpool } from "../models/Carpool.js";
import { CarpoolRequest } from "../models/CarpoolRequest.js";
import { createBooking, runAcceptTransaction } from "../services/bookingService.js";

export async function createCarpoolRequestHandler(req, res) {
  try {
    const { rideId, source, destination, seatsRequested, totalAmount, passengerDetails, date } = req.body;
    
    const carpool = await Carpool.findById(rideId);
    if (!carpool) {
      return res.status(404).json({ error: "Carpool not found" });
    }

    const existingRequest = await CarpoolRequest.findOne({
      rideId,
      passengerId: req.user._id,
      status: { $in: ["pending", "accepted"] }
    });

    if (existingRequest) {
      return res.status(400).json({ error: "You already have a pending or accepted request for this ride." });
    }

    if (carpool.availableSeats < seatsRequested) {
      return res.status(400).json({ error: "Not enough seats available" });
    }

    const request = await CarpoolRequest.create({
      rideId,
      passengerId: req.user._id,
      driverId: carpool.userId, // Links to the User document of the driver
      source,
      destination,
      seatsRequested,
      totalAmount,
      passengerDetails,
      rideDate: date,
      status: "pending",
    });

    return res.status(201).json(request);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function getPassengerRequestsHandler(req, res) {
  try {
    const requests = await CarpoolRequest.find({ passengerId: req.user._id })
      .populate("rideId")
      .populate("driverId", "name phone")
      .sort({ createdAt: -1 });
    return res.json(requests);
  } catch (error) {
    return res.status(500).json({ error: "Could not fetch requests" });
  }
}

export async function getDriverRequestsHandler(req, res) {
  try {
    const requests = await CarpoolRequest.find({ driverId: req.user._id })
      .populate("rideId")
      .populate("passengerId", "name phone")
      .sort({ createdAt: -1 });
    return res.json(requests);
  } catch (error) {
    return res.status(500).json({ error: "Could not fetch requests" });
  }
}

export async function acceptRequestHandler(req, res) {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    return res.status(400).json({ error: "Invalid request ID format" });
  }

  try {
    const result = await runAcceptTransaction(req.params.id, req.user._id);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }
    return res.json(result.data);
  } catch (error) {
    // Retry once on write conflict (MongoDB error code 112)
    if (error.code === 112 || (error.message && error.message.includes("Write conflict"))) {
      console.warn("[acceptRequest] Write conflict detected — retrying once...");
      try {
        const retryResult = await runAcceptTransaction(req.params.id, req.user._id);
        if (retryResult.error) {
          return res.status(retryResult.status).json({ error: retryResult.error });
        }
        return res.json(retryResult.data);
      } catch (retryError) {
        console.error("[acceptRequest] Retry also failed:", retryError.message);
        return res.status(409).json({ error: "A conflicting operation is in progress. Please try again in a moment." });
      }
    }
    return res.status(400).json({ error: error.message || "Failed to accept request" });
  }
}

export async function rejectRequestHandler(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid request ID format" });
    }

    const request = await CarpoolRequest.findById(req.params.id);
    
    if (!request || request.driverId.toString() !== req.user._id.toString()) {
      return res.status(404).json({ error: "Request not found or unauthorized" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ error: "Request is no longer pending" });
    }

    request.status = "rejected";
    await request.save();

    return res.json(request);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function cancelPassengerRequestHandler(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid request ID format" });
    }

    const request = await CarpoolRequest.findById(req.params.id);
    
    if (!request || request.passengerId.toString() !== req.user._id.toString()) {
      return res.status(404).json({ error: "Request not found or unauthorized" });
    }

    if (request.status !== "pending") {
      return res.status(400).json({ error: "Only pending requests can be cancelled directly. Accepted requests must be cancelled from My Bookings." });
    }

    request.status = "cancelled";
    await request.save();

    return res.json(request);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
}

export async function getDriverCarpoolsHandler(req, res) {
  try {
    const carpools = await Carpool.find({ userId: req.user._id }).sort({ createdAt: -1 });
    return res.json(carpools);
  } catch (error) {
    return res.status(500).json({ error: "Could not fetch active rides" });
  }
}
