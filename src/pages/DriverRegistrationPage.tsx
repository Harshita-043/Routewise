import { useState } from "react";
import { Link } from "react-router";
import { ArrowLeft, BriefcaseBusiness, Bus, Car, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { registerDriver } from "@/services/api";

const weekDayOptions = [
  { value: "monday", label: "Mon" },
  { value: "tuesday", label: "Tue" },
  { value: "wednesday", label: "Wed" },
  { value: "thursday", label: "Thu" },
  { value: "friday", label: "Fri" },
  { value: "saturday", label: "Sat" },
  { value: "sunday", label: "Sun" },
];

export default function DriverRegistrationPage() {
  const [transportType, setTransportType] = useState("bus");
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    vehicleType: "",
    carNumber: "",
    source: "",
    destination: "",
    departureTime: "",
    availableSeats: "4",
    price: "400",
    pricePerKm: "15",
    operatingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  });
  const [message, setMessage] = useState("");

  const submit = async () => {
    const result = await registerDriver({ ...form, transportType });
    setMessage(`${result.driver.name} registered successfully.`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <Button asChild variant="ghost" size="sm">
            <Link to="/">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Driver Registration</h1>
            <p className="text-muted-foreground">Add taxi, bus, or carpool inventory to the search system.</p>
          </div>
        </div>

        <div className="bg-card rounded-2xl border border-border/50 p-6">
          <div className="grid md:grid-cols-3 gap-3 mb-6">
            {[
              { id: "bus", label: "Bus", icon: <Bus className="w-4 h-4" /> },
              { id: "taxi", label: "Taxi", icon: <Car className="w-4 h-4" /> },
              { id: "carpool", label: "Carpool", icon: <Users className="w-4 h-4" /> },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setTransportType(option.id)}
                className={`h-12 rounded-xl border flex items-center justify-center gap-2 ${
                  transportType === option.id ? "border-primary bg-primary/10" : "border-border/50 bg-muted/30"
                }`}
              >
                {option.icon}
                {option.label}
              </button>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {[
              ["name", "Name"],
              ["email", "Email"],
              ["phone", "Phone"],
              ["source", "Source"],
              ["destination", "Destination"],
              ["departureTime", "Departure time"],
            ].map(([key, label]) => (
              <input
                key={key}
                value={form[key as keyof typeof form]}
                onChange={(event) => setForm((current) => ({ ...current, [key]: event.target.value }))}
                placeholder={label}
                className="h-11 rounded-lg border border-border bg-muted/40 px-4 outline-none focus:ring-2 focus:ring-primary/30"
              />
            ))}

            {(transportType === "taxi" || transportType === "carpool") && (
              <input
                value={transportType === "taxi" ? form.pricePerKm : form.price}
                onChange={(event) => setForm((current) => ({ ...current, [transportType === "taxi" ? "pricePerKm" : "price"]: event.target.value }))}
                placeholder={transportType === "taxi" ? "Price per km" : "Price per seat"}
                className="h-11 rounded-lg border border-border bg-muted/40 px-4 outline-none focus:ring-2 focus:ring-primary/30"
              />
            )}

            {transportType !== "carpool" && (
              <>
                <input value={form.vehicleType} onChange={(event) => setForm((current) => ({ ...current, vehicleType: event.target.value }))} placeholder="Vehicle type" className="h-11 rounded-lg border border-border bg-muted/40 px-4 outline-none focus:ring-2 focus:ring-primary/30" />
                <input value={form.carNumber} onChange={(event) => setForm((current) => ({ ...current, carNumber: event.target.value }))} placeholder="Vehicle number" className="h-11 rounded-lg border border-border bg-muted/40 px-4 outline-none focus:ring-2 focus:ring-primary/30" />
              </>
            )}

            {(transportType === "bus" || transportType === "carpool") && (
              <input value={form.availableSeats} onChange={(event) => setForm((current) => ({ ...current, availableSeats: event.target.value }))} placeholder="Available seats" className="h-11 rounded-lg border border-border bg-muted/40 px-4 outline-none focus:ring-2 focus:ring-primary/30" />
            )}

            {transportType === "bus" && (
              <input value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} placeholder="Ticket price" className="h-11 rounded-lg border border-border bg-muted/40 px-4 outline-none focus:ring-2 focus:ring-primary/30" />
            )}
          </div>

          {transportType === "bus" && (
            <div className="mt-5">
              <p className="text-sm font-medium mb-3">Operating days</p>
              <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
                {weekDayOptions.map((day) => {
                  const active = form.operatingDays.includes(day.value);

                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() =>
                        setForm((current) => ({
                          ...current,
                          operatingDays: active
                            ? current.operatingDays.filter((item) => item !== day.value)
                            : [...current.operatingDays, day.value],
                        }))
                      }
                      className={`h-10 rounded-lg border text-sm ${
                        active ? "border-primary bg-primary/10 text-primary" : "border-border/50 bg-muted/30"
                      }`}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                This bus will only appear for searches on the selected operating days.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <BriefcaseBusiness className="w-4 h-4" />
              New registrations appear in search results automatically.
            </p>
            <Button onClick={submit}>Register Driver</Button>
          </div>

          {message && <p className="mt-4 text-sm text-primary font-medium">{message}</p>}
        </div>
      </div>
    </div>
  );
}
