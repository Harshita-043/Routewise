import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { BriefcaseBusiness, Bus, Car, Fuel, History, LogOut, MapPin, RadioTower, Save, Sparkles, Train, User, Users, Wifi } from "lucide-react";
import FareComparisonPanel, { type ComparisonCard } from "@/components/FareComparisonPanel";
import NearbyStations from "@/components/NearbyStations";
import PNRStatus from "@/components/PNRStatus";
import RouteInfo from "@/components/RouteInfo";
import RouteMap from "@/components/RouteMap";
import RouteSearch from "@/components/RouteSearch";
import TrainCard from "@/components/TrainCard";
import TransportCard from "@/components/TransportCard";
import { TransportCardSkeleton, TrainCardSkeleton } from "@/components/LoadingSkeleton";
import { Button } from "@/components/ui/button";
import {
  createTrainAlert,
  fetchCurrentUser,
  fetchNearbyStations,
  fetchSavedTrainRoutes,
  fetchTrainLiveStatus,
  fetchRouteSummary,
  saveTrainRoute,
  searchTransport,
  searchTrains,
  type AuthUser,
  type NearbyStation,
  type RouteSearchFilters,
  type SearchOption,
  type SearchResponse,
  type TrainLiveStatus,
  type TrainSearchResult,
} from "@/services/api";

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

type TransportKey = "bus" | "taxi" | "train" | "carpool";
type SortKey = "cheapest" | "fastest" | "greenest";

const CO2_PER_MODE = {
  bus: 5.2,
  taxi: 17.8,
  train: 3.4,
  carpool: 8.5,
  metro: 2.7,
};
const SEARCH_STATE_KEY = "routewise-last-search";

function formatTime(mins: number) {
  return mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function parseDurationTextToMinutes(duration: string) {
  const hoursMatch = duration.match(/(\d+)h/);
  const minsMatch = duration.match(/(\d+)m/);
  return (hoursMatch ? Number(hoursMatch[1]) * 60 : 0) + (minsMatch ? Number(minsMatch[1]) : 0);
}

export default function TransitHome() {
  const today = useMemo(() => new Date().toISOString().split("T")[0], []);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [routeResult, setRouteResult] = useState<RouteResult | null>(null);
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);
  const [trainResults, setTrainResults] = useState<TrainSearchResult[]>([]);
  const [nearbyStations, setNearbyStations] = useState<NearbyStation[]>([]);
  const [liveStatus, setLiveStatus] = useState<TrainLiveStatus | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [filters, setFilters] = useState<RouteSearchFilters>({ date: today, classType: "SL" });
  const [sortBy, setSortBy] = useState<SortKey>("cheapest");
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [savedRoutesCount, setSavedRoutesCount] = useState(0);
  const lastSearchRef = useRef<{ source: Location; destination: Location; filters: RouteSearchFilters } | null>(null);

  useEffect(() => {
    const savedState = sessionStorage.getItem(SEARCH_STATE_KEY);
    if (!savedState) {
      return;
    }

    try {
      const parsed = JSON.parse(savedState);
      setRouteResult(parsed.routeResult || null);
      setSearchResult(parsed.searchResult || null);
      setTrainResults(parsed.trainResults || []);
      setNearbyStations(parsed.nearbyStations || []);
      setAiSummary(parsed.aiSummary || null);
      setFilters(parsed.filters || { date: today, classType: "SL" });

      if (parsed.trainResults?.[0]) {
        const todayStr = new Date().toISOString().split("T")[0];
        fetchTrainLiveStatus(parsed.trainResults[0].trainNo, todayStr)
          .then((status) => setLiveStatus(status))
          .catch(() => setLiveStatus(parsed.liveStatus || null));
      } else {
        setLiveStatus(parsed.liveStatus || null);
      }

      requestAnimationFrame(() => {
        document.getElementById("estimates")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    } catch {
      sessionStorage.removeItem(SEARCH_STATE_KEY);
    }
  }, [searchParams]);

  useEffect(() => {
    const token = localStorage.getItem("routewise-token");
    if (!token) {
      setCurrentUser(null);
      return;
    }

    fetchCurrentUser()
      .then(async (user) => {
        setCurrentUser(user);
        const routes = await fetchSavedTrainRoutes().catch(() => []);
        setSavedRoutesCount(routes.length);
      })
      .catch(() => {
        localStorage.removeItem("routewise-token");
        localStorage.removeItem("routewise-user");
        setCurrentUser(null);
      });
  }, []);

  useEffect(() => {
    if (!routeResult || !searchResult || trainResults.length === 0) {
      return;
    }

    sessionStorage.setItem(
      SEARCH_STATE_KEY,
      JSON.stringify({
        routeResult,
        searchResult,
        trainResults,
        nearbyStations,
        liveStatus,
        filters,
      }),
    );
  }, [filters, liveStatus, nearbyStations, routeResult, searchResult, trainResults]);

  const refreshTrainPanels = async (
    source: Location,
    destination: Location,
    nextFilters: RouteSearchFilters,
    baseRoute?: RouteResult | null,
  ) => {
    const from = source.display_name.split(",")[0].trim();
    const to = destination.display_name.split(",")[0].trim();
    const trainResponse = await searchTrains({
      from,
      to,
      date: nextFilters.date,
      classType: nextFilters.classType,
    });

    setTrainResults(trainResponse.results);
    setAiSummary(trainResponse.aiSummary || null);
    setNearbyStations(
      await fetchNearbyStations({
        lat: Number(source.lat),
        lng: Number(source.lon),
        radiusKm: 35,
        destination: to,
      }).catch(() => []),
    );

    if (trainResponse.results[0]) {
      const todayStr = new Date().toISOString().split("T")[0];
      setLiveStatus(await fetchTrainLiveStatus(trainResponse.results[0].trainNo, todayStr).catch(() => null));
    } else {
      setLiveStatus(null);
    }

    if (baseRoute && trainResponse.results[0]?.routePolyline?.length) {
      setRouteResult({
        ...baseRoute,
        geometry: trainResponse.results[0].routePolyline,
      });
    }
  };

  const calculateRoute = async (source: Location, destination: Location, nextFilters: RouteSearchFilters) => {
    setIsLoading(true);
    setError(null);
    setFilters(nextFilters);
    lastSearchRef.current = { source, destination, filters: nextFilters };

    try {
      const from = source.display_name.split(",")[0].trim();
      const to = destination.display_name.split(",")[0].trim();
      const [routeData, transportData] = await Promise.all([
        fetchRouteSummary({
          startLat: source.lat,
          startLng: source.lon,
          endLat: destination.lat,
          endLng: destination.lon,
        }),
        searchTransport({
          from,
          to,
          date: nextFilters.date,
        }),
      ]);

      const formatName = (name: string) => name.split(",").slice(0, 2).join(",");
      const nextRoute = {
        source: { name: formatName(source.display_name), lat: Number(source.lat), lng: Number(source.lon) },
        destination: { name: formatName(destination.display_name), lat: Number(destination.lat), lng: Number(destination.lon) },
        distance: routeData.distance,
        duration: routeData.duration,
        geometry: routeData.geometry,
        fares: routeData.fares,
        times: routeData.times,
      };

      setRouteResult(nextRoute);
      setSearchResult(transportData);
      await refreshTrainPanels(source, destination, nextFilters, nextRoute);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not calculate route");
    } finally {
      setIsLoading(false);
    }
  };



  useEffect(() => {
    if (!lastSearchRef.current) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      const lastSearch = lastSearchRef.current;
      if (!lastSearch) return;
      refreshTrainPanels(lastSearch.source, lastSearch.destination, lastSearch.filters, routeResult).catch(() => undefined);
    }, 3 * 60 * 1000);

    return () => window.clearInterval(interval);
  }, [routeResult]);

  const getTopOption = (type: TransportKey): SearchOption | null => {
    if (!searchResult) return null;
    return searchResult.results[type][0] || searchResult.suggestions[type][0] || null;
  };

  const handleBook = (transportType: TransportKey) => {
    if (!routeResult) return;

    const query = new URLSearchParams({
      from: routeResult.source.name.split(",")[0].trim(),
      to: routeResult.destination.name.split(",")[0].trim(),
      date: filters.date,
      returnTo: "/?restoreSearch=1#estimates",
    });

    if (!currentUser) {
      navigate(`/auth?redirect=${encodeURIComponent(`/booking/${transportType}?${query.toString()}`)}`);
      return;
    }

    navigate(`/booking/${transportType}?${query.toString()}`);
  };

  const cheapest = routeResult
    ? Object.keys(routeResult.fares).reduce((a, b) =>
        routeResult.fares[a as keyof typeof routeResult.fares] < routeResult.fares[b as keyof typeof routeResult.fares] ? a : b,
      )
    : null;

  const fastest = routeResult
    ? Object.keys(routeResult.times).reduce((a, b) =>
        routeResult.times[a as keyof typeof routeResult.times] < routeResult.times[b as keyof typeof routeResult.times] ? a : b,
      )
    : null;

  const busOption = getTopOption("bus");
  const taxiOption = getTopOption("taxi");
  const trainOption = trainResults[0] || null;
  const carpoolOption = getTopOption("carpool");

  const comparisonCards = useMemo(() => {
    if (!routeResult) return [];

    const cards = [
      { mode: "carpool" as const, fare: carpoolOption?.amount ?? routeResult.fares.carpool, duration: carpoolOption?.durationText ?? formatTime(routeResult.times.carpool), co2Kg: CO2_PER_MODE.carpool },
      { mode: "bus" as const, fare: busOption?.amount ?? routeResult.fares.bus, duration: busOption?.durationText ?? formatTime(routeResult.times.bus), co2Kg: CO2_PER_MODE.bus },
      { mode: "train" as const, fare: trainOption?.availability?.currentFare ?? trainOption?.fare ?? routeResult.fares.train, duration: trainOption?.duration ?? formatTime(routeResult.times.train), co2Kg: CO2_PER_MODE.train },
      { mode: "taxi" as const, fare: taxiOption?.amount ?? routeResult.fares.taxi, duration: taxiOption?.durationText ?? formatTime(routeResult.times.taxi), co2Kg: CO2_PER_MODE.taxi },
      { mode: "metro" as const, fare: Math.max(35, Math.round(routeResult.distance * 1.8)), duration: formatTime(Math.max(18, Math.round(routeResult.duration * 0.7))), co2Kg: CO2_PER_MODE.metro },
    ];

    const sorted = [...cards].sort((left, right) => {
      if (sortBy === "cheapest") return left.fare - right.fare;
      if (sortBy === "fastest") return parseDurationTextToMinutes(left.duration) - parseDurationTextToMinutes(right.duration);
      return left.co2Kg - right.co2Kg;
    });

    return sorted.map((card, index) => ({
      ...card,
      badge: index === 0 ? (sortBy === "cheapest" ? "best value" : sortBy === "fastest" ? "fastest" : "greenest") as ComparisonCard["badge"] : undefined,
    }));
  }, [busOption, carpoolOption, routeResult, sortBy, taxiOption, trainOption]);

  const topThreeTrains = trainResults.slice(0, 3);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute top-1/2 -left-40 h-96 w-96 rounded-full bg-secondary/10 blur-3xl" />
        <div className="absolute -bottom-40 right-1/4 h-72 w-72 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-md">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary">
                <MapPin className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">RouteWise</h1>
                <p className="text-xs text-muted-foreground">Smart Transport Calculator</p>
              </div>
            </div>
            <nav className="flex items-center gap-3">
              {currentUser ? (
                <>
                  <Link to="/my-bookings" className="hidden items-center gap-2 text-sm font-medium transition-colors hover:text-primary sm:flex">
                    <History className="h-4 w-4" />
                    My Bookings
                  </Link>
                  <div className="hidden items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 sm:flex">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{currentUser.name}</span>
                  </div>
                  <div className="hidden rounded-lg bg-primary/10 px-3 py-2 text-xs font-medium text-primary lg:block">
                    {savedRoutesCount} saved routes
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      localStorage.removeItem("routewise-token");
                      localStorage.removeItem("routewise-user");
                      setCurrentUser(null);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button asChild size="sm" className="bg-primary hover:bg-primary/90">
                  <Link to="/auth">Sign Up / Login</Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                <Link to="/driver-registration">
                  <BriefcaseBusiness className="mr-2 h-4 w-4" />
                  Driver Portal
                </Link>
              </Button>
            </nav>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 md:py-12">
        <section className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium text-primary">
            <Sparkles className="h-4 w-4" />
            Compare fares instantly
          </div>
          <h2 className="mb-4 bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-3xl font-extrabold text-transparent md:text-5xl">
            Find the Best Route, Train, and Fare
          </h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Compare bus, taxi, train, carpool, and metro-style transfer costs with nearby stations and live-style train insights.
          </p>
        </section>

        <section className="mx-auto mb-12 max-w-6xl">
          <RouteSearch
            onSearch={calculateRoute}
            isLoading={isLoading}
            initialSource={routeResult ? { display_name: routeResult.source.name, lat: String(routeResult.source.lat), lon: String(routeResult.source.lng) } : null}
            initialDestination={routeResult ? { display_name: routeResult.destination.name, lat: String(routeResult.destination.lat), lon: String(routeResult.destination.lng) } : null}
          />
          {error ? <p className="mt-4 text-center text-sm text-destructive">{error}</p> : null}
        </section>

        {routeResult ? (
          <section id="estimates" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <RouteMap
              geometry={trainOption?.routePolyline?.length ? trainOption.routePolyline : routeResult.geometry}
              source={routeResult.source}
              destination={routeResult.destination}
              mode="train"
              nearbyStations={nearbyStations}
              liveTrainLocation={liveStatus?.currentLocation || null}
            />
            <RouteInfo
              source={routeResult.source.name}
              destination={routeResult.destination.name}
              distance={routeResult.distance}
              duration={formatTime(routeResult.duration)}
            />

            <div>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-xl font-bold">Transport Options</h3>
                {currentUser ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={async () => {
                      await saveTrainRoute({
                        from: routeResult.source.name.split(",")[0].trim(),
                        to: routeResult.destination.name.split(",")[0].trim(),
                        date: filters.date,
                        classType: filters.classType,
                      });
                      const routes = await fetchSavedTrainRoutes().catch(() => []);
                      setSavedRoutesCount(routes.length);
                    }}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Save Route
                  </Button>
                ) : null}
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <TransportCard
                  type="bus"
                  icon={<Bus className="h-7 w-7 text-transport-bus" />}
                  name="Bus"
                  fare={busOption?.amount ?? routeResult.fares.bus}
                  time={busOption?.durationText ?? formatTime(routeResult.times.bus)}
                  description={busOption ? `${busOption.label} - ${busOption.matchType === "direct" ? "Direct route" : "Alternate stop suggestion"}` : "Public transit - Search all operators"}
                  isCheapest={cheapest === "bus"}
                  isFastest={fastest === "bus"}
                  onBook={() => handleBook("bus")}
                />
                <TransportCard
                  type="taxi"
                  icon={<Car className="h-7 w-7 text-transport-taxi" />}
                  name="Taxi"
                  fare={taxiOption?.amount ?? routeResult.fares.taxi}
                  time={taxiOption?.durationText ?? formatTime(routeResult.times.taxi)}
                  description={taxiOption ? `${taxiOption.label} - ${taxiOption.pickupDistanceKm} km away` : "Nearby drivers - On-demand pickup"}
                  isCheapest={cheapest === "taxi"}
                  isFastest={fastest === "taxi"}
                  onBook={() => handleBook("taxi")}
                />
                <TransportCard
                  type="train"
                  icon={<Train className="h-7 w-7 text-transport-train" />}
                  name="Train"
                  fare={trainOption?.availability?.currentFare ?? trainOption?.fare ?? routeResult.fares.train}
                  time={trainOption?.duration ?? formatTime(routeResult.times.train)}
                  description={trainOption ? `${trainOption.trainName} - ${trainOption.availability?.available ? "Seats available" : "Check waitlist"}` : "Rail network - Fixed schedule"}
                  isCheapest={cheapest === "train"}
                  isFastest={fastest === "train"}
                  onBook={() => handleBook("train")}
                  showBookButton={false}
                />
                <TransportCard
                  type="carpool"
                  icon={<Users className="h-7 w-7 text-transport-carpool" />}
                  name="Carpool"
                  fare={carpoolOption?.amount ?? routeResult.fares.carpool}
                  time={carpoolOption?.durationText ?? formatTime(routeResult.times.carpool)}
                  description={carpoolOption ? `${carpoolOption.label} - ${carpoolOption.matchType === "direct" ? "Direct ride" : "Nearby pickup"}` : "Shared ride - Community trips"}
                  isCheapest={cheapest === "carpool"}
                  isFastest={fastest === "carpool"}
                  onBook={() => handleBook("carpool")}
                />
                <TransportCard
                  type="fuel"
                  icon={<Fuel className="h-7 w-7 text-transport-fuel" />}
                  name="Own Vehicle"
                  fare={routeResult.fares.fuel}
                  time={formatTime(routeResult.times.fuel)}
                  description="Fuel cost estimate - Self-drive"
                  isCheapest={cheapest === "fuel"}
                  isFastest={fastest === "fuel"}
                  onBook={() => {}}
                  showBookButton={false}
                />
              </div>
            </div>

            {topThreeTrains.length ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold">Recommended Trains</h3>
                    {aiSummary ? (
                      <div className="mt-2 mb-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-primary text-sm">AI Route Assistant</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{aiSummary}</p>
                      </div>
                    ) : null}
                    <p className="text-sm text-muted-foreground">Ranked by route match, running day, departure fit, and class availability.</p>
                  </div>
                  {currentUser && trainOption ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={async () => {
                        await createTrainAlert({
                          email: currentUser.email,
                          trainNo: trainOption.trainNo,
                          date: filters.date,
                          classType: filters.classType,
                          targetFare: Math.max(100, (trainOption.availability?.currentFare ?? trainOption.fare) - 100),
                          notifyOnSeatOpen: true,
                        });
                      }}
                    >
                      Set Price Alert
                    </Button>
                  ) : null}
                </div>
                {topThreeTrains.map((train) => (
                  <TrainCard
                    key={`${train.trainNo}-${train.classType}`}
                    train={train}
                    classType={filters.classType}
                    date={filters.date}
                    onRefresh={() => {
                      if (!lastSearchRef.current) return;
                      refreshTrainPanels(lastSearchRef.current.source, lastSearchRef.current.destination, filters, routeResult).catch(() => undefined);
                    }}
                  />
                ))}
              </div>
            ) : null}

            {liveStatus ? (
              <section className="rounded-2xl border border-border/50 bg-card p-5 shadow-lg space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <RadioTower className="h-5 w-5 text-primary" />
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <h3 className="text-xl font-bold">Live Train Status</h3>
                        <span className="text-sm text-muted-foreground">· {trainResults[0]?.trainName ?? liveStatus.trainNo}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">Status for: {today}</span>
                    </div>
                  </div>
                  {/* RAG vs simulated badge */}
                  {liveStatus.source === "rag" ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                      <Wifi className="h-3.5 w-3.5" />
                      Live via AI Web Search
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                      Estimated · No live data
                    </span>
                  )}
                </div>

                {/* Status description */}
                <p className="text-sm text-muted-foreground">{liveStatus.status}</p>

                {/* Stat grid */}
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-xl bg-muted/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Current Station</p>
                    <p className="text-lg font-semibold">{liveStatus.currentStation}</p>
                  </div>
                  <div className="rounded-xl bg-muted/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Delay</p>
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-sm font-bold ${
                        liveStatus.delayMinutes === 0
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : liveStatus.delayMinutes <= 15
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }`}
                    >
                      {liveStatus.delayMinutes === 0 ? "On time" : `+${liveStatus.delayMinutes} min`}
                    </span>
                  </div>
                  <div className="rounded-xl bg-muted/30 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Your Journey Date</p>
                    <p className="text-lg font-semibold">{filters?.date || "N/A"}</p>
                    {liveStatus.date && liveStatus.date !== filters?.date && (
                      <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                        Live Status Date: {liveStatus.date}
                      </p>
                    )}
                  </div>
                </div>
              </section>
            ) : null}

            {nearbyStations.length ? <NearbyStations stations={nearbyStations} /> : null}
            <FareComparisonPanel cards={comparisonCards} sortBy={sortBy} onSortChange={setSortBy} />

            <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
              {searchResult ? (
                <div className="rounded-2xl border border-border/50 bg-card p-5">
                  <h4 className="mb-3 font-semibold">Nearby Alternatives</h4>
                  <div className="grid gap-4 text-sm text-muted-foreground md:grid-cols-2">
                    <div>
                      <p className="mb-2 font-medium text-foreground">Near source</p>
                      <p>{searchResult.nearby.from.map((item) => `${item.name} (${item.distanceKm} km)`).join(", ") || "No nearby source suggestions"}</p>
                    </div>
                    <div>
                      <p className="mb-2 font-medium text-foreground">Near destination</p>
                      <p>{searchResult.nearby.to.map((item) => `${item.name} (${item.distanceKm} km)`).join(", ") || "No nearby destination suggestions"}</p>
                    </div>
                  </div>
                </div>
              ) : null}
              <PNRStatus />
            </div>
          </section>
        ) : isLoading ? (
        <section className="space-y-8 animate-in fade-in duration-500">
          <div className="h-[400px] w-full rounded-2xl bg-muted/30 animate-pulse" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <TransportCardSkeleton />
            <TransportCardSkeleton />
            <TransportCardSkeleton />
          </div>
          <div className="space-y-4">
            <TrainCardSkeleton />
            <TrainCardSkeleton />
          </div>
        </section>
      ) : (
        <section className="py-20 text-center animate-in fade-in zoom-in duration-700">
          <div className="mx-auto mb-8 flex h-28 w-28 items-center justify-center rounded-3xl bg-primary/5 shadow-inner">
            <MapPin className="h-14 w-14 text-primary/40" />
          </div>
          <h3 className="mb-3 text-2xl font-bold">Ready to travel?</h3>
          <p className="mx-auto max-w-md text-lg text-muted-foreground">
            Enter your starting point and destination to compare live fares, train schedules, and nearby station options across India.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4 text-sm font-medium text-muted-foreground">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50"><Bus className="w-4 h-4" /> Buses</div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50"><Train className="w-4 h-4" /> Trains</div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50"><Car className="w-4 h-4" /> Taxis</div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50"><Users className="w-4 h-4" /> Carpools</div>
          </div>
        </section>
      )}
      </main>

      <footer className="mt-auto border-t border-border/50 bg-card/50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-secondary">
                <MapPin className="h-4 w-4 text-white" />
              </div>
              <span className="font-semibold">RouteWise</span>
            </div>
            <p className="text-sm text-muted-foreground">� 2026 RouteWise. Smart transport fare calculator.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
