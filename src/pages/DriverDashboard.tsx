import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Check, Clock, MapPin, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { acceptCarpoolRequest, fetchCurrentUser, fetchDriverCarpools, fetchDriverRequests, rejectCarpoolRequest, type AuthUser, type ActiveCarpool, type CarpoolRequestResponse } from "@/services/api";

export default function DriverDashboard() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [activeRides, setActiveRides] = useState<ActiveCarpool[]>([]);
  const [requests, setRequests] = useState<CarpoolRequestResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  // Load dashboard data exactly once on mount.
  // CRITICAL: Do NOT include `currentUser` in deps — it would cause an infinite loop
  // because setCurrentUser triggers re-render which re-runs the effect.
  useEffect(() => {
    const token = localStorage.getItem("routewise-token");
    if (!token) {
      navigate("/auth?redirect=%2Fdriver-dashboard");
      return;
    }

    let cancelled = false; // cleanup guard for strict mode double-invoke

    fetchCurrentUser()
      .then((user) => {
        if (cancelled) return;
        setCurrentUser(user);
        return Promise.all([fetchDriverCarpools(), fetchDriverRequests()]);
      })
      .then((result) => {
        if (cancelled || !result) return;
        const [rides, reqs] = result;
        setActiveRides(Array.isArray(rides) ? rides : []);
        setRequests(Array.isArray(reqs) ? reqs : []);
      })
      .catch((err) => {
        if (cancelled) return;
        const msg: string = err instanceof Error ? err.message : String(err);
        if (msg.includes("401") || msg.includes("Authentication") || msg.includes("token")) {
          localStorage.removeItem("routewise-token");
          navigate("/auth?redirect=%2Fdriver-dashboard");
        } else {
          setError(msg || "Failed to load dashboard data");
        }
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [navigate]); // ← navigate is stable; intentionally no currentUser dep

  const handleAccept = async (id: string) => {
    // Operation lock: bail out immediately if this request is already being processed
    if (loadingActions.has(`accept-${id}`) || loadingActions.has(`reject-${id}`)) return;

    setLoadingActions((prev) => new Set(prev).add(`accept-${id}`));
    try {
      await acceptCarpoolRequest(id);
      // Optimistically flip status to accepted — removes the action buttons immediately
      setRequests((current) =>
        current.map((req) => (req._id === id ? { ...req, status: "accepted" } : req))
      );
      // Sync seat count from server
      const rides = await fetchDriverCarpools();
      setActiveRides(Array.isArray(rides) ? rides : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to accept request";
      alert(msg);
    } finally {
      setLoadingActions((prev) => {
        const next = new Set(prev);
        next.delete(`accept-${id}`);
        return next;
      });
    }
  };

  const handleReject = async (id: string) => {
    // Operation lock: bail out immediately if this request is already being processed
    if (loadingActions.has(`accept-${id}`) || loadingActions.has(`reject-${id}`)) return;

    setLoadingActions((prev) => new Set(prev).add(`reject-${id}`));
    try {
      await rejectCarpoolRequest(id);
      // Optimistically flip status to rejected — removes the action buttons immediately
      setRequests((current) =>
        current.map((req) => (req._id === id ? { ...req, status: "rejected" } : req))
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to reject request";
      alert(msg);
    } finally {
      setLoadingActions((prev) => {
        const next = new Set(prev);
        next.delete(`reject-${id}`);
        return next;
      });
    }
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
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-xl">Driver Dashboard</h1>
                <p className="text-xs text-muted-foreground">Manage your carpool rides</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-16">Loading dashboard...</div>
        ) : error ? (
          <div className="text-center text-destructive py-16">{error}</div>
        ) : (
          <div className="space-y-8">
            <section>
              <h2 className="text-xl font-bold mb-4">Incoming Requests</h2>
              {requests.length === 0 ? (
                <div className="bg-card rounded-xl border border-border/50 p-8 text-center text-muted-foreground">
                  No requests found.
                </div>
              ) : (
                <div className="space-y-4">
                  {requests.map((req) => (
                    <div key={req._id} className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-semibold text-lg">{req.passengerId?.name || "Passenger"}</h3>
                          <p className="text-sm text-muted-foreground">{req.passengerId?.phone || "No phone"}</p>
                          <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-medium ${
                            req?.status === "accepted" ? "bg-green-100 text-green-700"
                            : req?.status === "pending" ? "bg-yellow-100 text-yellow-700"
                            : "bg-red-100 text-red-700"
                          }`}>
                            {(req?.status || "pending").charAt(0).toUpperCase() + (req?.status || "pending").slice(1)}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-xl font-bold text-primary">₹{req.totalAmount}</p>
                          <p className="text-sm text-muted-foreground">{req.seatsRequested} seat(s)</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm mb-4">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <MapPin className="w-4 h-4 text-primary shrink-0" />
                          <span className="truncate">{req?.source || "Unknown location"}</span>
                        </div>
                        <span className="text-muted-foreground">→</span>
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <MapPin className="w-4 h-4 text-secondary shrink-0" />
                          <span className="truncate">{req?.destination || "Unknown location"}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
                        <span className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {req?.rideDate ? new Date(req.rideDate).toLocaleDateString() : "Unknown date"}
                        </span>
                      </div>

                      {req.status === "pending" && (
                        <div className="flex items-center gap-3 border-t border-border/50 pt-4 mt-4">
                          <Button
                            disabled={loadingActions.has(`accept-${req._id}`) || loadingActions.has(`reject-${req._id}`)}
                            onClick={() => handleAccept(req._id)}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                          >
                            <Check className="w-4 h-4 mr-2" />
                            {loadingActions.has(`accept-${req._id}`) ? "Accepting..." : "Accept"}
                          </Button>
                          <Button
                            disabled={loadingActions.has(`accept-${req._id}`) || loadingActions.has(`reject-${req._id}`)}
                            variant="outline"
                            onClick={() => handleReject(req._id)}
                            className="flex-1 text-red-600 hover:bg-red-50"
                          >
                            <X className="w-4 h-4 mr-2" />
                            {loadingActions.has(`reject-${req._id}`) ? "Rejecting..." : "Reject"}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h2 className="text-xl font-bold mb-4">Your Active Rides</h2>
              {activeRides.length === 0 ? (
                <div className="bg-card rounded-xl border border-border/50 p-8 text-center text-muted-foreground">
                  You haven't created any rides yet.
                  <div className="mt-4">
                    <Button asChild variant="outline">
                      <Link to="/driver-registration">Create a Ride</Link>
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {activeRides.map((ride) => (
                    <div key={ride._id} className="bg-card rounded-xl border border-border/50 p-5 shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-semibold text-lg">{ride?.route?.source || "Unknown"} to {ride?.route?.destination || "Unknown"}</h3>
                          <p className="text-sm text-muted-foreground">Date: {ride?.rideDate ? new Date(ride.rideDate).toLocaleDateString() : "Unknown"} at {ride?.departureTime || ""}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">{ride?.availableSeats ?? 0} seats left</p>
                          <p className="text-sm text-muted-foreground">₹{ride?.pricePerSeat ?? 0}/seat</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
