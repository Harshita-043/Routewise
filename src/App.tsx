import { BrowserRouter as Router, Routes, Route } from "react-router";
import HomePage from "@/pages/TransitHome";
import BookingPage from "@/pages/BookingPage";
import BookingHistory from "@/pages/MyBookings";
import AuthPage from "@/pages/AuthPage";
import DriverRegistrationPage from "@/pages/DriverRegistrationPage";
import PaymentSuccessPage from "@/pages/PaymentSuccessPage";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/booking/:type" element={<BookingPage />} />
        <Route path="/my-bookings" element={<BookingHistory />} />
        <Route path="/driver-registration" element={<DriverRegistrationPage />} />
        <Route path="/payment-success" element={<PaymentSuccessPage />} />
      </Routes>
    </Router>
  );
}
