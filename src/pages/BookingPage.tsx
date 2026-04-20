import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { ArrowLeft, CalendarDays, CheckCircle2, CreditCard, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createBooking, fetchCurrentUser, searchTransport, type AuthUser, type SearchOption } from "@/services/api";

type TransportType = "bus" | "train" | "taxi" | "carpool";

const transportLabels: Record<TransportType, string> = {
  bus: "Bus",
  train: "Train",
  taxi: "Taxi",
  carpool: "Carpool",
};

function generateSeatOptions(type: TransportType) {
  const prefix = type === "train" ? "S" : "B";
  return Array.from({ length: 24 }, (_, index) => `${prefix}${index + 1}`);
}

export default function BookingPage() {
  const navigate = useNavigate();
  const { type } = useParams();
  const [searchParams] = useSearchParams();
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";
  const date = searchParams.get("date") || new Date().toISOString().split("T")[0];
  const returnTo = searchParams.get("returnTo") || "/?restoreSearch=1#estimates";
  const transportType = (type || "bus") as TransportType;
  const needsSeatSelection = transportType === "bus" || transportType === "train";

  const [options, setOptions] = useState<SearchOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<SearchOption | null>(null);
  const [passengers, setPassengers] = useState(1);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [travellers, setTravellers] = useState([{ name: "", age: 25, gender: "Adult" }]);
  const [paymentReady, setPaymentReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("routewise-token");
    if (!token) {
      navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      return;
    }

    fetchCurrentUser()
      .then(setUser)
      .catch(() => {
        localStorage.removeItem("routewise-token");
        localStorage.removeItem("routewise-user");
        navigate(`/auth?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
      });
  }, [navigate]);

  const [bookingError, setBookingError] = useState<string | null>(null);

  useEffect(() => {
    const loadOptions = async () => {
      setIsLoading(true);
      setBookingError(null);
      try {
        const response = await searchTransport({ from, to, date, type: transportType });
        const mergedOptions = [...response.results[transportType], ...response.suggestions[transportType]];
        setOptions(mergedOptions);
        setSelectedOption(mergedOptions[0] || null);
      } catch (err) {
        setBookingError(err instanceof Error ? err.message : "Could not load transport options");
      } finally {
        setIsLoading(false);
      }
    };

    loadOptions();
  }, [date, from, to, transportType]);

  useEffect(() => {
    setTravellers((current) => {
      if (current.length === passengers) return current;
      if (current.length < passengers) {
        return [
          ...current,
          ...Array.from({ length: passengers - current.length }, () => ({ name: "", age: 25, gender: "Adult" })),
        ];
      }
      return current.slice(0, passengers);
    });
  }, [passengers]);

  const seatOptions = useMemo(() => generateSeatOptions(transportType), [transportType]);
  const totalAmount = selectedOption ? (transportType === "taxi" ? selectedOption.amount : selectedOption.amount * passengers) : 0;

  const toggleSeat = (seat: string) => {
    setSelectedSeats((current) => {
      if (current.includes(seat)) {
        return current.filter((item) => item !== seat);
      }
      if (current.length >= passengers) {
        return current;
      }
      return [...current, seat];
    });
  };

  const completeBooking = async () => {
    if (!selectedOption) return;
    setIsSubmitting(true);
    setBookingError(null);

    try {
      const booking = await createBooking({
        transportType,
        transportId: selectedOption.id,
        source: selectedOption.source,
        destination: selectedOption.destination,
        date,
        passengers,
        seats: selectedSeats,
        amount: totalAmount,
        passengerDetails: travellers,
      });

      localStorage.setItem("routewise-user", JSON.stringify(user));
      navigate(`/payment-success?bookingId=${booking.bookingId}&type=${transportType}`);
    } catch (err) {
      setBookingError(err instanceof Error ? err.message : "Booking failed. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Button variant="ghost" size="sm" onClick={() => navigate(returnTo)}>
            <span className="inline-flex items-center">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </span>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{transportLabels[transportType]} Booking</h1>
            <p className="text-muted-foreground">{from} to {to} on {date}</p>
          </div>
        </div>

        {bookingError && (
          <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {bookingError}
          </div>
        )}

        <div className="grid lg:grid-cols-[1.2fr,0.8fr] gap-6">
          <div className="space-y-6">
            <section className="bg-card rounded-2xl border border-border/50 p-5">
              <h2 className="font-semibold mb-4">1. Select an available option</h2>
              {isLoading ? (
                <p className="text-muted-foreground">Loading options...</p>
              ) : bookingError && options.length === 0 ? (
                <p className="text-muted-foreground">Could not load options — check your connection and try again.</p>
              ) : options.length === 0 ? (
                <p className="text-muted-foreground">No direct option found right now for this mode.</p>
              ) : (
                <div className="space-y-3">
                  {options.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSelectedOption(option)}
                      className={`w-full text-left rounded-xl border p-4 transition-all ${
                        selectedOption?.id === option.id ? "border-primary bg-primary/5" : "border-border/50 hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold">{option.label}</p>
                          <p className="text-sm text-muted-foreground">{option.source} → {option.destination}</p>
                          <p className="text-xs text-muted-foreground mt-1">{option.departureTime} • {option.durationText} • {option.matchType}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-primary">₹{option.amount}</p>
                          <p className="text-xs text-muted-foreground">{option.seatsAvailable} seats</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-card rounded-2xl border border-border/50 p-5">
              <h2 className="font-semibold mb-4">2. Passenger details</h2>
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <input value={user?.name || ""} readOnly placeholder="Full name" className="h-11 rounded-lg border border-border bg-muted/40 px-4 outline-none" />
                <input value={user?.email || ""} readOnly placeholder="Email" className="h-11 rounded-lg border border-border bg-muted/40 px-4 outline-none" />
                <input value={user?.phone || ""} readOnly placeholder="Phone number" className="h-11 rounded-lg border border-border bg-muted/40 px-4 outline-none" />
              </div>

              <div className="flex items-center gap-3 mb-4">
                <Users className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Passengers</span>
                <select value={passengers} onChange={(event) => setPassengers(Number(event.target.value))} className="h-10 rounded-lg border border-border bg-muted/40 px-3">
                  {[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count}</option>)}
                </select>
              </div>

              <div className="grid gap-3">
                {travellers.map((traveller, index) => (
                  <div key={`${index + 1}`} className="grid md:grid-cols-3 gap-3">
                    <input value={traveller.name} onChange={(event) => setTravellers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} placeholder={`Passenger ${index + 1} name`} className="h-11 rounded-lg border border-border bg-muted/40 px-4 outline-none focus:ring-2 focus:ring-primary/30" />
                    <input type="number" value={traveller.age} onChange={(event) => setTravellers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, age: Number(event.target.value) } : item))} className="h-11 rounded-lg border border-border bg-muted/40 px-4 outline-none focus:ring-2 focus:ring-primary/30" />
                    <select value={traveller.gender} onChange={(event) => setTravellers((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, gender: event.target.value } : item))} className="h-11 rounded-lg border border-border bg-muted/40 px-4">
                      <option>Adult</option>
                      <option>Female</option>
                      <option>Male</option>
                      <option>Child</option>
                    </select>
                  </div>
                ))}
              </div>
            </section>

            {needsSeatSelection && (
              <section className="bg-card rounded-2xl border border-border/50 p-5">
                <h2 className="font-semibold mb-4">3. Seat selection</h2>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                  {seatOptions.map((seat) => (
                    <button
                      key={seat}
                      type="button"
                      onClick={() => toggleSeat(seat)}
                      className={`h-10 rounded-lg border text-sm font-medium ${
                        selectedSeats.includes(seat) ? "border-primary bg-primary text-primary-foreground" : "border-border bg-muted/40"
                      }`}
                    >
                      {seat}
                    </button>
                  ))}
                </div>
              </section>
            )}

            <section className="bg-card rounded-2xl border border-border/50 p-5">
              <h2 className="font-semibold mb-4">4. Payment</h2>
              <div className="flex items-center justify-between p-4 rounded-xl bg-primary/10">
                <div>
                  <p className="text-sm text-muted-foreground">Simulated payment gateway</p>
                  <p className="font-semibold">UPI / Card / Netbanking</p>
                </div>
                <Button onClick={() => setPaymentReady(true)} disabled={!selectedOption}>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Mark Payment Successful
                </Button>
              </div>
            </section>
          </div>

          <aside className="space-y-6">
            <section className="bg-card rounded-2xl border border-border/50 p-5 sticky top-6">
              <h2 className="font-semibold mb-4">Fare summary</h2>
              {selectedOption ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4 text-primary" />
                    <span>{selectedOption.source} → {selectedOption.destination}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <CalendarDays className="w-4 h-4 text-primary" />
                    <span>{date}</span>
                  </div>
                  <div className="rounded-xl bg-muted/40 p-4">
                    <p className="text-sm text-muted-foreground">Selected {transportLabels[transportType]}</p>
                    <p className="font-semibold">{selectedOption.label}</p>
                    <p className="text-sm text-muted-foreground mt-1">{selectedOption.departureTime} • {selectedOption.durationText}</p>
                  </div>
                  <div className="flex items-center justify-between text-sm"><span>Passengers</span><span>{passengers}</span></div>
                  {needsSeatSelection && <div className="flex items-center justify-between text-sm"><span>Seats</span><span>{selectedSeats.join(", ") || "Select seats"}</span></div>}
                  <div className="flex items-center justify-between text-lg font-bold text-primary"><span>Total</span><span>₹{totalAmount}</span></div>
                  <Button
                    className="w-full"
                    disabled={!paymentReady || !user || travellers.some((traveller) => !traveller.name) || (needsSeatSelection && selectedSeats.length !== passengers) || isSubmitting}
                    onClick={completeBooking}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    {isSubmitting ? "Confirming..." : "Confirm Booking"}
                  </Button>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">Select a transport option to continue.</p>
              )}
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
