import { useState, useEffect, useRef } from "react";
import { MapPin, Navigation, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RouteSearchFilters } from "@/services/api";

interface Location {
  display_name: string;
  lat: string;
  lon: string;
}

interface RouteSearchProps {
  onSearch: (source: Location, destination: Location, filters: RouteSearchFilters) => void;
  isLoading?: boolean;
  initialSource?: Location | null;
  initialDestination?: Location | null;
}

const fetchLocationSuggestions = async (query: string, signal?: AbortSignal): Promise<Location[]> => {
  const apiUrl = `/api/geocode?q=${encodeURIComponent(query)}`;

  try {
    const response = await fetch(apiUrl, { signal });
    if (!response.ok) return [];

    const data = await response.json();
    // data structure is { source: 'api' | 'fallback', results: [...] }
    const results = data?.results || [];
    return Array.isArray(results) ? results.slice(0, 5) : [];
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') throw err;
    return [];
  }
};

export default function RouteSearch({ onSearch, isLoading, initialSource, initialDestination }: RouteSearchProps) {
  const [sourceQuery, setSourceQuery] = useState(initialSource?.display_name || "");
  const [destQuery, setDestQuery] = useState(initialDestination?.display_name || "");
  const [sourceSuggestions, setSourceSuggestions] = useState<Location[]>([]);
  const [destSuggestions, setDestSuggestions] = useState<Location[]>([]);
  const [selectedSource, setSelectedSource] = useState<Location | null>(initialSource || null);
  const [selectedDest, setSelectedDest] = useState<Location | null>(initialDestination || null);
  const [activeField, setActiveField] = useState<"source" | "dest" | null>(null);
  const [isSearching, setIsSearching] = useState(false);

  // Sync state if initial props change (e.g. on restoration)
  useEffect(() => {
    if (initialSource) {
      setSelectedSource(initialSource);
      setSourceQuery(initialSource.display_name);
    }
  }, [initialSource]);

  useEffect(() => {
    if (initialDestination) {
      setSelectedDest(initialDestination);
      setDestQuery(initialDestination.display_name);
    }
  }, [initialDestination]);
  
  const sourceRef = useRef<HTMLDivElement>(null);
  const destRef = useRef<HTMLDivElement>(null);
  const sourceAbortController = useRef<AbortController | null>(null);
  const destAbortController = useRef<AbortController | null>(null);

  // Debounced geocoding
  useEffect(() => {
    if (activeField !== "source" || sourceQuery.length < 3 || selectedSource?.display_name === sourceQuery) {
      setSourceSuggestions([]);
      if (sourceAbortController.current) {
        sourceAbortController.current.abort();
      }
      return;
    }

    if (sourceAbortController.current) {
      sourceAbortController.current.abort();
    }
    sourceAbortController.current = new AbortController();
    const signal = sourceAbortController.current.signal;

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await fetchLocationSuggestions(sourceQuery, signal);
        if (!signal.aborted) {
          setSourceSuggestions(data);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') setSourceSuggestions([]);
      }
      if (!signal.aborted) setIsSearching(false);
    }, 400);

    return () => {
      clearTimeout(timer);
    };
  }, [sourceQuery, activeField, selectedSource]);

  useEffect(() => {
    if (activeField !== "dest" || destQuery.length < 3 || selectedDest?.display_name === destQuery) {
      setDestSuggestions([]);
      if (destAbortController.current) {
        destAbortController.current.abort();
      }
      return;
    }

    if (destAbortController.current) {
      destAbortController.current.abort();
    }
    destAbortController.current = new AbortController();
    const signal = destAbortController.current.signal;

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await fetchLocationSuggestions(destQuery, signal);
        if (!signal.aborted) {
          setDestSuggestions(data);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name !== 'AbortError') setDestSuggestions([]);
      }
      if (!signal.aborted) setIsSearching(false);
    }, 400);

    return () => {
      clearTimeout(timer);
    };
  }, [destQuery, activeField, selectedDest]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (sourceRef.current && !sourceRef.current.contains(e.target as Node)) {
        setSourceSuggestions([]);
      }
      if (destRef.current && !destRef.current.contains(e.target as Node)) {
        setDestSuggestions([]);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSource && selectedDest) {
      onSearch(selectedSource, selectedDest, { 
        date: new Date().toISOString().split("T")[0], 
        classType: "SL" 
      });
    }
  };

  const swapLocations = () => {
    setSourceQuery(destQuery);
    setDestQuery(sourceQuery);
    setSelectedSource(selectedDest);
    setSelectedDest(selectedSource);
  };

  const selectSource = (location: Location) => {
    setSelectedSource(location);
    setSourceQuery(location.display_name.split(",").slice(0, 2).join(","));
    setSourceSuggestions([]);
  };

  const selectDest = (location: Location) => {
    setSelectedDest(location);
    setDestQuery(location.display_name.split(",").slice(0, 2).join(","));
    setDestSuggestions([]);
  };

  const formatLocationName = (name: string) => {
    const parts = name.split(",");
    return parts.length > 2 ? `${parts[0]}, ${parts[1]}` : name;
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="bg-card rounded-2xl shadow-xl border border-border/50 p-6 md:p-8">
        <div className="grid gap-4 xl:grid-cols-[1fr_auto_1fr_200px] xl:items-stretch">
          {/* Source Input */}
          <div className="flex-1 relative" ref={sourceRef}>
            <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
            </div>
            <input
              type="text"
              placeholder="Enter source location"
              value={sourceQuery}
              onChange={(e) => {
                setSourceQuery(e.target.value);
                setSelectedSource(null);
              }}
              onFocus={() => setActiveField("source")}
              className="w-full pl-16 h-14 text-base bg-muted/50 border-0 rounded-lg focus:ring-2 focus:ring-primary/30 focus:outline-none"
            />
            {sourceSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-card rounded-xl border border-border shadow-xl z-50 overflow-hidden">
                {sourceSuggestions.map((loc, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectSource(loc)}
                    className="w-full px-4 py-3 text-left hover:bg-muted/50 flex items-start gap-3 border-b border-border/50 last:border-0 transition-colors"
                  >
                    <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <span className="text-sm">{formatLocationName(loc.display_name)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Swap Button */}
          <button
            type="button"
            onClick={swapLocations}
            className="hidden xl:flex w-12 h-12 self-center rounded-full bg-secondary hover:bg-secondary/80 items-center justify-center transition-all hover:scale-105 active:scale-95"
          >
            <ArrowRight className="w-5 h-5 text-secondary-foreground" />
          </button>

          {/* Destination Input */}
          <div className="flex-1 relative" ref={destRef}>
            <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
              <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                <Navigation className="w-5 h-5 text-secondary" />
              </div>
            </div>
            <input
              type="text"
              placeholder="Enter destination"
              value={destQuery}
              onChange={(e) => {
                setDestQuery(e.target.value);
                setSelectedDest(null);
              }}
              onFocus={() => setActiveField("dest")}
              className="w-full pl-16 h-14 text-base bg-muted/50 border-0 rounded-lg focus:ring-2 focus:ring-secondary/30 focus:outline-none"
            />
            {destSuggestions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-card rounded-xl border border-border shadow-xl z-50 overflow-hidden">
                {destSuggestions.map((loc, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectDest(loc)}
                    className="w-full px-4 py-3 text-left hover:bg-muted/50 flex items-start gap-3 border-b border-border/50 last:border-0 transition-colors"
                  >
                    <Navigation className="w-4 h-4 text-secondary mt-0.5 shrink-0" />
                    <span className="text-sm">{formatLocationName(loc.display_name)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Calculate Button */}

          <Button
            type="submit"
            disabled={isLoading || isSearching || !selectedSource || !selectedDest}
            className="h-14 px-8 text-base font-semibold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg shadow-primary/25"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Calculating...
              </>
            ) : (
              <>
                Calculate Route
                <ArrowRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </div>
        
        {/* Helper text */}
        <p className="text-xs text-muted-foreground mt-4 text-center">
          Start typing locations in India to calculate your route
        </p>
      </div>
    </form>
  );
}
