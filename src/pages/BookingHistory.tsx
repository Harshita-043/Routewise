import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useAuth } from "@getmocha/users-service/react";
import { MapPin, ArrowLeft, Bus, Car, Train, Users, Fuel, Calendar, Clock, Route, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Booking {
  id: number;
  source_location: string;
  destination_location: string;
  distance: number;
  duration: string;
  transport_type: string;
  fare: number;
  status: string;
  created_at: string;
}

const transportIcons: Record<string, React.ReactNode> = {
  Bus: <Bus className="w-5 h-5 text-transport-bus" />,
  Taxi: <Car className="w-5 h-5 text-transport-taxi" />,
  Train: <Train className="w-5 h-5 text-transport-train" />,
  Carpool: <Users className="w-5 h-5 text-transport-carpool" />,
  "Own Vehicle": <Fuel className="w-5 h-5 text-transport-fuel" />,
};

export default function BookingHistory() {
  const { user, isPending, redirectToLogin } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isPending && !user) {
      redirectToLogin();
      return;
    }

    if (user) {
      fetchBookings();
    }
  }, [user, isPending, redirectToLogin]);

  const fetchBookings = async () => {
    try {
      const response = await fetch("/api/bookings");
      if (response.ok) {
        const data = await response.json();
        setBookings(data);
      }
    } catch (error) {
      console.error("Failed to fetch bookings:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const cancelBooking = async (id: number) => {
    if (!confirm("Are you sure you want to cancel this booking?")) return;
    
    try {
      const response = await fetch(`/api/bookings/${id}`, { method: "DELETE" });
      if (response.ok) {
        setBookings(prev => prev.map(b => 
          b.id === id ? { ...b, status: "cancelled" } : b
        ));
      }
    } catch (error) {
      console.error("Failed to cancel booking:", error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isPending || isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Background Pattern */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
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

      {/* Content */}
      <main className="container mx-auto px-4 py-8">
        {bookings.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
              <Calendar className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">No Bookings Yet</h3>
            <p className="text-muted-foreground mb-6">
              You haven't made any bookings. Start by searching for a route!
            </p>
            <Button asChild>
              <Link to="/">Search Routes</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4 max-w-3xl mx-auto">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className={`bg-card rounded-xl border border-border/50 p-5 shadow-sm transition-all hover:shadow-md ${
                  booking.status === "cancelled" ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                      {transportIcons[booking.transport_type] || <Car className="w-5 h-5" />}
                    </div>
                    <div>
                      <h3 className="font-semibold">{booking.transport_type}</h3>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(booking.created_at)}
                      </p>
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
                    <span className="text-lg font-bold text-primary">₹{booking.fare}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm mb-4">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <MapPin className="w-4 h-4 text-primary shrink-0" />
                    <span className="truncate">{booking.source_location}</span>
                  </div>
                  <span className="text-muted-foreground">→</span>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <MapPin className="w-4 h-4 text-secondary shrink-0" />
                    <span className="truncate">{booking.destination_location}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Route className="w-4 h-4" />
                      {booking.distance.toFixed(1)} km
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {booking.duration}
                    </span>
                  </div>
                  {booking.status === "confirmed" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => cancelBooking(booking.id)}
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
