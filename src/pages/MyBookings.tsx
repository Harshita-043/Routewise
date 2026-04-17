import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router";
import {
  ArrowLeft,
  Bus,
  Calendar,
  Car,
  Clock,
  MapPin,
  Route,
  Train,
  Users,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cancelBooking, fetchBookings, fetchCurrentUser, type AuthUser } from "@/services/api";

interface BookingRecord {
  _id: string;
  bookingId: string;
  transportType: "bus" | "train" | "taxi" | "carpool";
  transportName: string;
  source: string;
  destination: string;
  amount: number;
  passengers: number;
  status: string;
  date: string;
}

const transportIcons: Record<string, ReactNode> = {
  bus: <Bus className="w-5 h-5 text-transport-bus" />,
  taxi: <Car className="w-5 h-5 text-transport-taxi" />,
  train: <Train className="w-5 h-5 text-transport-train" />,
  carpool: <Users className="w-5 h-5 text-transport-carpool" />,
};

export default function MyBookings() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadBookings = async () => {
    setIsLoading(true);
    try {
      const data = await fetchBookings();
      setBookings(data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("routewise-token");
    if (!token) {
      navigate("/auth?redirect=%2Fmy-bookings");
      return;
    }

    fetchCurrentUser()
      .then((user) => {
        setCurrentUser(user);
        return loadBookings();
      })
      .catch(() => {
        localStorage.removeItem("routewise-token");
        localStorage.removeItem("routewise-user");
        navigate("/auth?redirect=%2Fmy-bookings");
      });
  }, [navigate]);

  const handleCancel = async (id: string) => {
    await cancelBooking(id);
    setBookings((current) =>
      current.map((booking) =>
        booking._id === id ? { ...booking, status: "cancelled" } : booking,
      ),
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span className="hidden sm:inline">Back</span>
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-xl">My Bookings</h1>
                <p className="text-xs text-muted-foreground">Your travel history</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto mb-6 bg-card rounded-2xl border border-border/50 p-5">
          <p className="text-sm font-medium mb-1">{currentUser?.name || "Signed in user"}</p>
          <p className="text-sm text-muted-foreground">{currentUser?.email || "Loading user..."}</p>
        </div>

        {isLoading ? (
          <div className="text-center text-muted-foreground">Loading bookings...</div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
              <Calendar className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Bookings Yet</h3>
            <p className="text-muted-foreground mb-6">
              Search for a route and finish a booking to see your trip history here.
            </p>
            <Button asChild>
              <Link to="/">Search Routes</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {bookings.map((booking) => (
              <div
                key={booking._id}
                className={`bg-card rounded-xl border border-border/50 p-5 shadow-sm transition-all hover:shadow-md ${
                  booking.status === "cancelled" ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      {transportIcons[booking.transportType] || <Car className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-semibold">{booking.transportName}</h3>
                      <p className="text-xs text-muted-foreground">{booking.bookingId}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      booking.status === "confirmed"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                    }`}>
                      {booking.status === "confirmed" ? "Confirmed" : "Cancelled"}
                    </span>
                    <span className="text-lg font-bold text-primary">₹{booking.amount}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm mb-4">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate">{booking.source}</span>
                  </div>
                  <span className="text-muted-foreground">→</span>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <MapPin className="w-4 h-4 text-secondary shrink-0" />
                    <span className="truncate">{booking.destination}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Route className="w-4 h-4" />
                      {booking.passengers} passenger(s)
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {new Date(booking.date).toLocaleDateString()}
                    </span>
                  </div>
                  {booking.status === "confirmed" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancel(booking._id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
