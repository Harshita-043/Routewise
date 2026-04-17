import { useState } from "react";
import { Link } from "react-router";
import { Bus, Car, Train, Users, Fuel, MapPin, Sparkles, LogOut, User, History } from "lucide-react";
import { useAuth } from "@getmocha/users-service/react";
import RouteSearch from "@/components/RouteSearch";
import RouteInfo from "@/components/RouteInfo";
import TransportCard from "@/components/TransportCard";
import FareComparison from "@/components/FareComparison";
import BookingModal from "@/components/BookingModal";
import RouteMap from "@/components/RouteMap";
import { Button } from "@/components/ui/button";

interface Location {
  display_name: string;
  lat: string;
  lon: string;
}

interface RouteResult {
  source: { name: string; lat: number; lng: number };
  destination: { name: string; lat: number; lng: number };
  distance: number;
  duration: number;
  geometry: [number, number][];
  fares: {
    bus: number;
    taxi: number;
    train: number;
    carpool: number;
    fuel: number;
  };
  times: {
    bus: number;
    taxi: number;
    train: number;
    carpool: number;
    fuel: number;
  };
}

export default function HomePage() {
  const { user, isPending, redirectToLogin, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bookingModal, setBookingModal] = useState<{
    isOpen: boolean;
    transportType: string;
    fare: number;
    time: string;
  } | null>(null);

  const calculateRoute = async (source: Location, destination: Location) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/route?startLat=${source.lat}&startLng=${source.lon}&endLat=${destination.lat}&endLng=${destination.lon}`
      );
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.error || "Failed to calculate route");
      }
      
      const data = await response.json();
      
      const formatName = (name: string) => name.split(",").slice(0, 2).join(",");
      
      setRouteResult({
        source: { name: formatName(source.display_name), lat: parseFloat(source.lat), lng: parseFloat(source.lon) },
        destination: { name: formatName(destination.display_name), lat: parseFloat(destination.lat), lng: parseFloat(destination.lon) },
        distance: data.distance,
        duration: data.duration,
        geometry: data.geometry,
        fares: data.fares,
        times: data.times,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not calculate route";
      setError(
        message === "No route found"
          ? "Could not find a route between these locations. Please try different locations."
          : `Route calculation failed: ${message}`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleBook = (transportType: string, fare: number, time: number) => {
    if (!user) {
      redirectToLogin();
      return;
    }
    setBookingModal({ isOpen: true, transportType, fare, time: `${time} min` });
  };

  const handleConfirmBooking = async () => {
    if (!routeResult || !bookingModal) return;

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceLocation: routeResult.source.name,
          destinationLocation: routeResult.destination.name,
          distance: routeResult.distance,
          duration: bookingModal.time,
          transportType: bookingModal.transportType,
          fare: bookingModal.fare,
        }),
      });

      if (response.ok) {
        setBookingModal(null);
        alert("Booking confirmed! Check your booking history for details.");
      } else {
        alert("Failed to create booking. Please try again.");
      }
    } catch {
      alert("An error occurred. Please try again.");
    }
  };

  const getCheapest = () => {
    if (!routeResult) return null;
    const fares = routeResult.fares;
    return Object.keys(fares).reduce((a, b) => 
      fares[a as keyof typeof fares] < fares[b as keyof typeof fares] ? a : b
    );
  };

  const getFastest = () => {
    if (!routeResult) return null;
    const times = routeResult.times;
    return Object.keys(times).reduce((a, b) => 
      times[a as keyof typeof times] < times[b as keyof typeof times] ? a : b
    );
  };

  const cheapest = getCheapest();
  const fastest = getFastest();

  const formatTime = (mins: number) => mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;

  const fareComparisonData = routeResult ? [
    { type: "Bus", fare: routeResult.fares.bus, time: formatTime(routeResult.times.bus) },
    { type: "Taxi", fare: routeResult.fares.taxi, time: formatTime(routeResult.times.taxi) },
    { type: "Train", fare: routeResult.fares.train, time: formatTime(routeResult.times.train) },
    { type: "Carpool", fare: routeResult.fares.carpool, time: formatTime(routeResult.times.carpool) },
    { type: "Fuel Cost", fare: routeResult.fares.fuel, time: formatTime(routeResult.times.fuel) },
  ].map(item => ({
    ...item,
    isCheapest: item.fare === Math.min(routeResult.fares.bus, routeResult.fares.taxi, routeResult.fares.train, routeResult.fares.carpool, routeResult.fares.fuel),
    isFastest: item.time === formatTime(Math.min(routeResult.times.bus, routeResult.times.taxi, routeResult.times.train, routeResult.times.carpool, routeResult.times.fuel)),
  })) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Background Pattern */}
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -left-40 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 right-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <MapPin className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-xl">RouteWise</h1>
                <p className="text-xs text-muted-foreground">Smart Transport Calculator</p>
              </div>
            </div>
            <nav className="flex items-center gap-3">
              {isPending ? (
                <div className="w-20 h-9 bg-muted animate-pulse rounded-lg" />
              ) : user ? (
                <>
                  <Link
                    to="/history"
                    className="hidden sm:flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
                  >
                    <History className="w-4 h-4" />
                    My Bookings
                  </Link>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/50">
                    {user.google_user_data.picture ? (
                      <img 
                        src={user.google_user_data.picture} 
                        alt="" 
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <User className="w-5 h-5 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium hidden sm:block">
                      {user.google_user_data.given_name || user.email.split("@")[0]}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={logout}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <LogOut className="w-4 h-4" />
                  </Button>
                </>
              ) : (
                <Button onClick={redirectToLogin} className="bg-primary hover:bg-primary/90">
                  Sign in with Google
                </Button>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 md:py-12">
        {/* Hero Section */}
        <section className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4" />
            Compare fares instantly
          </div>
          <h2 className="text-3xl md:text-5xl font-extrabold mb-4 bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text">
            Find the Best Route & Fare
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Compare bus, taxi, train, carpool, and fuel costs. Get real-time estimates 
            and book your ride in seconds.
          </p>
        </section>

        {/* Search Section */}
        <section className="max-w-4xl mx-auto mb-12">
          <RouteSearch onSearch={calculateRoute} isLoading={isLoading} />
          {error && (
            <p className="text-center text-destructive mt-4 text-sm">{error}</p>
          )}
        </section>

        {/* Results Section */}
        {routeResult && (
          <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Map */}
            <RouteMap
              geometry={routeResult.geometry}
              source={routeResult.source}
              destination={routeResult.destination}
            />

            <RouteInfo
              source={routeResult.source.name}
              destination={routeResult.destination.name}
              distance={routeResult.distance}
              duration={formatTime(routeResult.duration)}
            />

            <div>
              <h3 className="text-xl font-bold mb-4">Transport Options</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <TransportCard
                  type="bus"
                  icon={<Bus className="w-7 h-7 text-transport-bus" />}
                  name="Bus"
                  fare={routeResult.fares.bus}
                  time={formatTime(routeResult.times.bus)}
                  description="Public transit • Multiple stops"
                  isCheapest={cheapest === "bus"}
                  isFastest={fastest === "bus"}
                  onBook={() => handleBook("Bus", routeResult.fares.bus, routeResult.times.bus)}
                />
                <TransportCard
                  type="taxi"
                  icon={<Car className="w-7 h-7 text-transport-taxi" />}
                  name="Taxi"
                  fare={routeResult.fares.taxi}
                  time={formatTime(routeResult.times.taxi)}
                  description="Door-to-door • Premium comfort"
                  isCheapest={cheapest === "taxi"}
                  isFastest={fastest === "taxi"}
                  onBook={() => handleBook("Taxi", routeResult.fares.taxi, routeResult.times.taxi)}
                />
                <TransportCard
                  type="train"
                  icon={<Train className="w-7 h-7 text-transport-train" />}
                  name="Train"
                  fare={routeResult.fares.train}
                  time={formatTime(routeResult.times.train)}
                  description="Rail network • Fixed schedule"
                  isCheapest={cheapest === "train"}
                  isFastest={fastest === "train"}
                  onBook={() => handleBook("Train", routeResult.fares.train, routeResult.times.train)}
                />
                <TransportCard
                  type="carpool"
                  icon={<Users className="w-7 h-7 text-transport-carpool" />}
                  name="Carpool"
                  fare={routeResult.fares.carpool}
                  time={formatTime(routeResult.times.carpool)}
                  description="Shared ride • Eco-friendly"
                  isCheapest={cheapest === "carpool"}
                  isFastest={fastest === "carpool"}
                  onBook={() => handleBook("Carpool", routeResult.fares.carpool, routeResult.times.carpool)}
                />
                <TransportCard
                  type="fuel"
                  icon={<Fuel className="w-7 h-7 text-transport-fuel" />}
                  name="Own Vehicle"
                  fare={routeResult.fares.fuel}
                  time={formatTime(routeResult.times.fuel)}
                  description="Fuel cost estimate • Self-drive"
                  isCheapest={cheapest === "fuel"}
                  isFastest={fastest === "fuel"}
                  onBook={() => handleBook("Own Vehicle", routeResult.fares.fuel, routeResult.times.fuel)}
                />
              </div>
            </div>

            <FareComparison fares={fareComparisonData} />
          </section>
        )}

        {/* Empty State */}
        {!routeResult && !isLoading && (
          <section className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
              <MapPin className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Enter Your Route</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Type your source and destination above to see fare estimates 
              for all transport options.
            </p>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/50 mt-auto">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <MapPin className="w-4 h-4 text-white" />
              </div>
              <span className="font-semibold">RouteWise</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2025 RouteWise. Smart transport fare calculator.
            </p>
          </div>
        </div>
      </footer>

      {/* Booking Modal */}
      {bookingModal && routeResult && (
        <BookingModal
          isOpen={bookingModal.isOpen}
          onClose={() => setBookingModal(null)}
          onConfirm={handleConfirmBooking}
          source={routeResult.source.name}
          destination={routeResult.destination.name}
          distance={routeResult.distance}
          transportType={bookingModal.transportType}
          fare={bookingModal.fare}
          time={bookingModal.time}
        />
      )}
    </div>
  );
}
