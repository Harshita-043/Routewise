import mongoose from "mongoose";
import {
  cancelBookingById,
  createBooking,
  getBookingsByEmail,
} from "../services/bookingService.js";

export async function createBookingHandler(req, res) {
  try {
    const booking = await createBooking({
      ...req.body,
      user: req.user,
    });
    return res.status(201).json(booking);
  } catch (error) {
    console.error("Create Booking Error:", error);
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Booking failed",
    });
  }
}

export async function getBookingsHandler(req, res) {
  try {
    const bookings = await getBookingsByEmail(req.user.email);
    return res.json(bookings);
  } catch (error) {
    console.error("Get Bookings Error:", error);
    return res.status(500).json({ error: "Could not fetch bookings" });
  }
}

export async function cancelBookingHandler(req, res) {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid booking ID format" });
    }
    const booking = await cancelBookingById(req.params.id);
    return res.json(booking);
  } catch (error) {
    console.error("Cancel Booking Error:", error);
    return res.status(404).json({
      error: error instanceof Error ? error.message : "Could not cancel booking",
    });
  }
}
