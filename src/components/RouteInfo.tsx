import { MapPin, Navigation, Route, Clock } from "lucide-react";

interface RouteInfoProps {
  source: string;
  destination: string;
  distance: number;
  duration: string;
}

export default function RouteInfo({ source, destination, distance, duration }: RouteInfoProps) {
  return (
    <div className="bg-card rounded-2xl border border-border/50 p-6 shadow-lg">
      <div className="flex flex-col md:flex-row md:items-center gap-6">
        {/* Route Path */}
        <div className="flex-1 flex items-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-primary" />
            </div>
            <div className="w-0.5 h-8 bg-gradient-to-b from-primary to-secondary" />
            <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
              <Navigation className="w-5 h-5 text-secondary" />
            </div>
          </div>
          <div className="flex-1">
            <div className="mb-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">From</p>
              <p className="font-semibold text-lg truncate">{source}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">To</p>
              <p className="font-semibold text-lg truncate">{destination}</p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="hidden md:block w-px h-24 bg-border" />
        <div className="md:hidden h-px w-full bg-border" />

        {/* Stats */}
        <div className="flex md:flex-col gap-6 md:gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Route className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Distance</p>
              <p className="font-bold text-xl">{distance.toFixed(1)} km</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center">
              <Clock className="w-6 h-6 text-secondary" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Est. Time</p>
              <p className="font-bold text-xl">{duration}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
