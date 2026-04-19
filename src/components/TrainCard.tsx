import { useState, useCallback } from "react";
import { ExternalLink, Loader2, RefreshCw, TrainFront, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { calculateTrainFareInline, type TrainFareBreakdown, type TrainSearchResult } from "@/services/api";

interface TrainCardProps {
  train: TrainSearchResult;
  classType: string;
  date: string;
  onRefresh: () => void;
}

function availabilityTone(train: TrainSearchResult) {
  const seats = train.availability?.seatsLeft ?? 0;
  if (!train.availability?.available) return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
  if (seats <= 8) return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
  return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
}

// Mirror of fareEngine.js — used to derive the initial display fare from the train prop
// without an extra network round-trip on first render.
function deriveInitialFare(train: TrainSearchResult, classType: string): number {
  const cls = train.classes.find((c) => c.type === classType) ?? train.classes[0];
  return cls ? cls.baseFare + (cls.reservationCharge ?? 0) : train.fare;
}

export default function TrainCard({ train, classType: initialClass, date, onRefresh }: TrainCardProps) {
  const [selectedClass, setSelectedClass] = useState(initialClass);
  const [fareData, setFareData] = useState<TrainFareBreakdown | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Shown fare: prefer freshly-fetched breakdown total; fall back to availability fare; then derive from classes
  const breakdown = fareData ?? train.fareBreakdown;
  const displayFare =
    fareData?.total ??
    (train.availability?.currentFare && train.fareBreakdown?.classType === selectedClass
      ? train.availability.currentFare
      : deriveInitialFare(train, selectedClass));

  const handleClassSelect = useCallback(
    async (cls: string) => {
      if (cls === selectedClass && fareData) return; // already fetched for this class
      setSelectedClass(cls);
      setFetchError(null);

      setIsFetching(true);
      try {
        // Always use inline calculation — works for both DB trains and RAG-sourced trains
        const data = await calculateTrainFareInline({
          trainNo: train.trainNo,
          trainName: train.trainName,
          classes: train.classes,
          date,
          classType: cls,
        });
        setFareData(data);
      } catch (err) {
        setFetchError(err instanceof Error ? err.message : "Could not fetch fare");
        setFareData(null);
      } finally {
        setIsFetching(false);
      }
    },
    [selectedClass, fareData, train.trainNo, train.trainName, train.classes, date],
  );

  return (
    <article className="rounded-2xl border border-transport-train/30 bg-card p-5 shadow-lg">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        {/* ── Left: train meta ── */}
        <div className="space-y-3 flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-transport-train/10 text-transport-train">
              <TrainFront className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-lg font-bold truncate">{train.trainName}</h3>
              <p className="text-sm text-muted-foreground">
                {train.trainNo} · {train.source} → {train.destination}
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

        {/* ── Right: fare panel ── */}
        <div className="w-full lg:w-[280px] shrink-0 space-y-4 rounded-2xl bg-slate-950 p-4 text-slate-50">
          {/* Class selector */}
          <div className="space-y-2">
            <span className="text-xs uppercase tracking-wide text-slate-400">Select Class</span>
            <div className="flex flex-wrap gap-2">
              {train.classes.length > 0 ? (
                train.classes.map((item) => (
                  <button
                    key={item.type}
                    type="button"
                    disabled={isFetching}
                    onClick={() => handleClassSelect(item.type)}
                    className={`relative flex-1 min-w-[68px] rounded-lg border p-2 text-center transition-all duration-150 ${
                      selectedClass === item.type
                        ? "border-primary bg-primary/25 text-white ring-1 ring-primary"
                        : "border-slate-700 bg-slate-900/50 text-slate-300 hover:bg-slate-800 hover:border-slate-500"
                    } disabled:opacity-60 disabled:cursor-not-allowed`}
                  >
                    <div className="text-sm font-bold">{item.type}</div>
                    <div className="text-xs text-slate-400">
                      {selectedClass === item.type && isFetching ? (
                        <Loader2 className="mx-auto h-3 w-3 animate-spin" />
                      ) : (
                        `₹${item.baseFare}`
                      )}
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-xs text-slate-500">No class data available</p>
              )}
            </div>
          </div>

          {/* Dynamic fare box */}
          <div className="rounded-xl bg-slate-900/80 p-3 min-h-[76px] flex flex-col justify-center">
            {isFetching ? (
              <div className="flex items-center justify-center gap-2 text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Fetching {selectedClass} fare…</span>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-300">
                    Fare ·{" "}
                    <span className="font-semibold text-primary">{breakdown?.classType ?? selectedClass}</span>
                  </span>
                  <span className="text-2xl font-bold">₹{displayFare}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                  {breakdown && (
                    <>
                      <span className="inline-flex items-center gap-1">
                        <Wallet className="h-3.5 w-3.5" />
                        Base ₹{breakdown.baseFare}
                      </span>
                      {breakdown.tatkalSurcharge > 0 && (
                        <span>Tatkal ₹{breakdown.tatkalSurcharge}</span>
                      )}
                      {breakdown.superfastSurcharge > 0 && (
                        <span>SF ₹{breakdown.superfastSurcharge}</span>
                      )}
                      <span>GST {Math.round((breakdown.gstRate ?? 0) * 100)}%</span>
                    </>
                  )}
                </div>
              </>
            )}
            {fetchError && <p className="mt-1 text-xs text-red-400">{fetchError}</p>}
          </div>

          {/* Availability badge */}
          <div className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${availabilityTone(train)}`}>
            {train.availability?.available
              ? `${train.availability.seatsLeft} seats left`
              : "Waitlist / unavailable"}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onRefresh}
              disabled={isFetching}
              className="flex-1 border-slate-700 bg-transparent text-slate-100 hover:bg-slate-800"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button asChild className="flex-1 bg-transport-train text-white hover:bg-transport-train/90">
              <a href={train.bookingUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                Book IRCTC
              </a>
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
