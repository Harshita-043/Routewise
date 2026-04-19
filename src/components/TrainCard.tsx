import { ExternalLink, RefreshCw, TrainFront, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TrainSearchResult } from "@/services/api";

interface TrainCardProps {
  train: TrainSearchResult;
  classType: string;
  onClassChange: (classType: string) => void;
  onRefresh: () => void;
}

function availabilityTone(train: TrainSearchResult) {
  const seats = train.availability?.seatsLeft ?? 0;

  if (!train.availability?.available) {
    return "bg-red-100 text-red-700";
  }

  if (seats <= 8) {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-emerald-100 text-emerald-700";
}

export default function TrainCard({ train, classType, onClassChange, onRefresh }: TrainCardProps) {
  return (
    <article className="rounded-2xl border border-transport-train/30 bg-card p-5 shadow-lg">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-transport-train/10 text-transport-train">
              <TrainFront className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">{train.trainName}</h3>
              <p className="text-sm text-muted-foreground">
                {train.trainNo} • {train.source} to {train.destination}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Departure</p>
              <p className="text-lg font-semibold">{train.departureTime}</p>
            </div>
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Arrival</p>
              <p className="text-lg font-semibold">{train.arrivalTime}</p>
            </div>
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Duration</p>
              <p className="text-lg font-semibold">{train.duration}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {train.runningDays.map((day) => (
              <span key={day} className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                {day.slice(0, 3).toUpperCase()}
              </span>
            ))}
          </div>
        </div>

        <div className="min-w-[270px] space-y-4 rounded-2xl bg-slate-950 p-4 text-slate-50">
          <div className="space-y-2">
            <span className="text-sm text-slate-300">Available Classes</span>
            <div className="flex flex-wrap gap-2">
              {train.classes.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => onClassChange(item.type)}
                  className={`flex-1 min-w-[70px] rounded-lg border p-2 text-center transition-colors ${
                    classType === item.type
                      ? "border-primary bg-primary/20 text-white"
                      : "border-slate-700 bg-slate-900/50 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <div className="text-sm font-bold">{item.type}</div>
                  <div className="text-xs">₹{item.baseFare}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-slate-900/80 p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Dynamic fare</span>
              <span className="text-2xl font-bold">₹{train.availability?.currentFare ?? train.fare}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-400">
              <span className="inline-flex items-center gap-1">
                <Wallet className="h-3.5 w-3.5" />
                Base ₹{train.fareBreakdown.baseFare}
              </span>
              <span>Tatkal ₹{train.fareBreakdown.tatkalSurcharge}</span>
            </div>
          </div>

          <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${availabilityTone(train)}`}>
            {train.availability?.available
              ? `${train.availability.seatsLeft} seats left`
              : "Waitlist / unavailable"}
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={onRefresh} className="flex-1 border-slate-700 bg-transparent text-slate-100 hover:bg-slate-800">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button asChild className="flex-1 bg-transport-train text-white hover:bg-transport-train/90">
              <a href={train.bookingUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Book on IRCTC
              </a>
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
