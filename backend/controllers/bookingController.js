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
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Booking failed",
    });
  }
}

export async function getBookingsHandler(req, res) {
  const bookings = await getBookingsByEmail(req.user.email);
  return res.json(bookings);
}

export async function cancelBookingHandler(req, res) {
  try {
    const booking = await cancelBookingById(req.params.id);
    return res.json(booking);
  } catch (error) {
    return res.status(404).json({
      error: error instanceof Error ? error.message : "Could not cancel booking",
    });
  }
}
