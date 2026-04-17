import { MapPin, TrainFront } from "lucide-react";
import type { NearbyStation } from "@/services/api";

interface NearbyStationsProps {
  stations: NearbyStation[];
}

export default function NearbyStations({ stations }: NearbyStationsProps) {
  return (
    <section className="rounded-2xl border border-border/50 bg-card p-5 shadow-lg">
      <div className="mb-4">
        <h3 className="text-xl font-bold">Nearby Stations</h3>
        <p className="text-sm text-muted-foreground">Railway stops near your route with the next departures toward your destination.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {stations.map((station) => (
          <article key={station._id || station.code} className="rounded-2xl border border-border/50 bg-muted/20 p-4">
            <div className="mb-3 flex items-center gap-3">
              <div className="rounded-full bg-transport-train/10 p-2 text-transport-train">
                <TrainFront className="h-4 w-4" />
              </div>
              <div>
                <h4 className="font-semibold">{station.name}</h4>
                <p className="text-xs text-muted-foreground">{station.code}</p>
              </div>
            </div>
            <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" />
              <span>
                {station.location.coordinates[1].toFixed(3)}, {station.location.coordinates[0].toFixed(3)}
              </span>
            </div>
            <div className="space-y-2">
              {station.nextDepartures.length ? (
                station.nextDepartures.map((departure) => (
                  <div key={`${station.code}-${departure.trainNo}`} className="rounded-xl bg-background px-3 py-2 text-sm">
                    <p className="font-medium">
                      {departure.trainName} <span className="text-muted-foreground">({departure.trainNo})</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {departure.departureTime} toward {departure.destination}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No matched departures right now.</p>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
