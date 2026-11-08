import { useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchPnrStatus, type PnrStatusResponse } from "@/services/api";

export default function PNRStatus() {
  const [pnr, setPnr] = useState("");
  const [result, setResult] = useState<PnrStatusResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const checkStatus = async () => {
    if (!pnr.trim()) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      setResult(await fetchPnrStatus(pnr.trim()));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not fetch PNR status");
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="rounded-2xl border border-border/50 bg-card p-5 shadow-lg">
      <div className="mb-4">
        <h3 className="text-xl font-bold">PNR Status Checker</h3>
        <p className="text-sm text-muted-foreground">Track confirmation, coach, berth, and current booking status.</p>
      </div>

      <div className="flex flex-col gap-3 md:flex-row">
        <input
          value={pnr}
          onChange={(event) => setPnr(event.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="Enter 10-digit PNR"
          className="h-11 flex-1 rounded-xl border border-border bg-muted/40 px-4 outline-none focus:ring-2 focus:ring-primary/30"
        />
        <Button type="button" onClick={checkStatus} disabled={isLoading || pnr.length < 10}>
          <Search className="mr-2 h-4 w-4" />
          {isLoading ? "Checking..." : "Check PNR"}
        </Button>
      </div>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

      {result ? (
        <div className="mt-4 space-y-3">
          {result.passengers && result.passengers.length > 0 ? (
            <>
              <div className="rounded-xl bg-muted/30 p-4">
                <p className="text-sm text-muted-foreground">Train {result.trainNo}</p>
                <p className="font-semibold">{result.chartPrepared ? "Chart prepared" : "Chart not prepared yet"}</p>
              </div>
              {result.passengers.map((passenger) => (
                <div key={passenger.passenger} className="rounded-xl border border-border/50 p-4">
                  <p className="font-medium">Passenger {passenger.passenger}</p>
                  <p className="text-sm text-muted-foreground">
                    Booking: {passenger.bookingStatus} • Current: {passenger.currentStatus}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Coach: {passenger.coach || "Pending"} • Berth: {passenger.berth || "Pending"}
                  </p>
                </div>
              ))}
            </>
          ) : (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300">
              <p className="font-semibold mb-1">Official IRCTC Gateway Required</p>
              <p className="text-xs text-muted-foreground mb-3">
                Live Indian Railways PNR status is gated by CRIS / IRCTC anti-bot CAPTCHAs and requires an authorized enterprise API key.
              </p>
              <a
                href="https://www.irctc.co.in/nget/enquiry/pnr-enquiry"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-primary hover:underline text-xs"
              >
                Check official IRCTC PNR Portal →
              </a>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
