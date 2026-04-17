export interface SearchOption {
  id: string;
  code: string;
  transportType: "bus" | "train" | "taxi" | "carpool";
  label: string;
  source: string;
  destination: string;
  departureTime: string;
  arrivalTime?: string;
  seatsAvailable: number;
  amount: number;
  durationText: string;
  distanceKm: number;
  driverId?: string;
  driverName?: string;
  matchType: "direct" | "alternate";
  pickupDistanceKm?: number;
  alternative?: {
    source: { stop: { name: string }; distanceKm: number };
    destination: { stop: { name: string }; distanceKm: number };
  };
  metadata?: Record<string, unknown>;
}

export interface TrainFareBreakdown {
  trainNo: string;
  trainName: string;
  classType: string;
  baseFare: number;
  reservationCharge: number;
  superfastSurcharge: number;
  tatkalSurcharge: number;
  gst: number;
  gstRate: number;
  total: number;
  availability?: TrainAvailability | null;
}

export interface TrainAvailability {
  available: boolean;
  seatsLeft: number;
  currentFare: number;
  tatkalSurcharge: number;
  quota: string;
  source: string;
}

export interface TrainSearchResult {
  trainNo: string;
  trainName: string;
  source: string;
  destination: string;
  sourceCode?: string;
  destinationCode?: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  runningDays: string[];
  distanceKm: number;
  classType: string;
  fare: number;
  fareBreakdown: TrainFareBreakdown;
  availability: TrainAvailability | null;
  classes: Array<{
    type: string;
    baseFare: number;
    reservationCharge: number;
    dynamicMultiplier: number;
  }>;
  intermediateStations: Array<{
    code?: string;
    name: string;
    arrival?: string | null;
    departure?: string | null;
    distance?: number;
    location?: { type: "Point"; coordinates: [number, number] };
  }>;
  routePolyline: [number, number][];
  score: number;
  bookingUrl: string;
}

export interface TrainSearchResponse {
  query: {
    from: string;
    to: string;
    date: string;
    classType: string;
  };
  results: TrainSearchResult[];
  aiSummary?: string;
}

export interface NearbyStation {
  _id: string;
  code: string;
  name: string;
  mode: "railway" | "bus";
  location: { type: "Point"; coordinates: [number, number] };
  nextDepartures: Array<{
    trainNo: string;
    trainName: string;
    departureTime: string;
    destination: string;
  }>;
}

export interface PnrStatusResponse {
  pnr: string;
  trainNo: string;
  passengers: Array<{
    passenger: number;
    bookingStatus: string;
    currentStatus: string;
    coach: string | null;
    berth: string | null;
  }>;
  chartPrepared: boolean;
  source: string;
}

export interface TrainLiveStatus {
  trainNo: string;
  date: string;
  delayMinutes: number;
  currentStation: string;
  currentLocation: {
    lat: number;
    lng: number;
  };
  status: string;
  source: string;
}

export interface SavedTrainRoute {
  _id: string;
  from: string;
  to: string;
  date?: string;
  classType?: string;
  createdAt: string;
}

export interface SearchResponse {
  query: {
    from: string;
    to: string;
  };
  results: Record<"train" | "bus" | "taxi" | "carpool", SearchOption[]>;
  suggestions: Record<"train" | "bus" | "taxi" | "carpool", SearchOption[]>;
  nearby: {
    from: Array<{ name: string; distanceKm: number }>;
    to: Array<{ name: string; distanceKm: number }>;
  };
}

export interface RouteResponse {
  distance: number;
  duration: number;
  geometry: [number, number][];
  fares: Record<"bus" | "taxi" | "train" | "carpool" | "fuel", number>;
  times: Record<"bus" | "taxi" | "train" | "carpool" | "fuel", number>;
}

export interface BookingPayload {
  transportType: "bus" | "train" | "taxi" | "carpool";
  transportId: string;
  source: string;
  destination: string;
  date: string;
  passengers: number;
  seats: string[];
  amount: number;
  passengerDetails: Array<{
    name: string;
    age: number;
    gender: string;
  }>;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface RouteSearchFilters {
  date: string;
  classType: string;
}

const API_UNAVAILABLE_MESSAGE =
  "Could not reach the RouteWise API. Start the backend server and try again.";

function getAuthToken() {
  return localStorage.getItem("routewise-token");
}

function withAuthHeaders(headers: HeadersInit = {}) {
  const token = getAuthToken();
  return token
    ? { ...headers, Authorization: `Bearer ${token}` }
    : headers;
}

async function parseErrorMessage(response: Response, fallbackMessage: string) {
  const data = await response.json().catch(() => ({}));
  return data.error || fallbackMessage;
}

async function requestJson<T>(input: RequestInfo | URL, init: RequestInit, fallbackMessage: string): Promise<T> {
  let response: Response;

  try {
    response = await fetch(input, init);
  } catch {
    throw new Error(API_UNAVAILABLE_MESSAGE);
  }

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, fallbackMessage));
  }

  return response.json() as Promise<T>;
}

export async function fetchRouteSummary(params: {
  startLat: string;
  startLng: string;
  endLat: string;
  endLng: string;
}) {
  const query = new URLSearchParams(params).toString();
  return requestJson<RouteResponse>(
    `/api/route?${query}`,
    {},
    "Failed to fetch route summary",
  );
}

export async function searchTransport(params: {
  from: string;
  to: string;
  date?: string;
  type?: string;
}) {
  const query = new URLSearchParams();
  query.set("from", params.from);
  query.set("to", params.to);
  if (params.date) query.set("date", params.date);
  if (params.type) query.set("type", params.type);
  return requestJson<SearchResponse>(
    `/api/search?${query.toString()}`,
    {},
    "Search failed",
  );
}

export async function createBooking(payload: BookingPayload) {
  return requestJson<{ bookingId: string }>(
    "/api/bookings",
    {
      method: "POST",
      headers: withAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    },
    "Booking failed",
  );
}

export async function fetchBookings() {
  return requestJson<
    Array<{
      _id: string;
      bookingId: string;
      transportType: "bus" | "train" | "taxi" | "carpool";
      transportName: string;
      source: string;
      destination: string;
      amount: number;
      passengers: number;
      status: string;
      date: string;
    }>
  >(
    "/api/bookings",
    {
      headers: withAuthHeaders(),
    },
    "Could not fetch bookings",
  );
}

export async function cancelBooking(id: string) {
  return requestJson(
    `/api/bookings/${id}/cancel`,
    {
      method: "PATCH",
      headers: withAuthHeaders(),
    },
    "Could not cancel booking",
  );
}

export async function registerDriver(payload: Record<string, unknown>) {
  return requestJson<{ driver: { name: string } }>(
    "/api/register-driver",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Driver registration failed",
  );
}

export async function signup(payload: {
  name: string;
  email: string;
  phone: string;
  password: string;
}) {
  return requestJson<AuthResponse>(
    "/api/auth/signup",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Signup failed",
  );
}

export async function login(payload: { email: string; password: string }) {
  return requestJson<AuthResponse>(
    "/api/auth/login",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Login failed",
  );
}

export async function fetchCurrentUser() {
  return requestJson<AuthUser>(
    "/api/auth/me",
    {
      headers: withAuthHeaders(),
    },
    "Could not load user",
  );
}

export async function searchTrains(payload: {
  from: string;
  to: string;
  date: string;
  classType: string;
}) {
  return requestJson<TrainSearchResponse>(
    "/api/trains/search",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Train search failed",
  );
}

export async function fetchTrainSchedule(trainNo: string) {
  return requestJson<TrainSearchResult>(
    `/api/trains/${trainNo}/schedule`,
    {},
    "Could not fetch train schedule",
  );
}

export async function fetchTrainFare(trainNo: string, params: { date: string; classType: string }) {
  const query = new URLSearchParams(params).toString();
  return requestJson<TrainFareBreakdown>(
    `/api/trains/${trainNo}/fare?${query}`,
    {},
    "Could not fetch train fare",
  );
}

export async function fetchNearbyStations(params: {
  lat: number;
  lng: number;
  radiusKm: number;
  destination?: string;
}) {
  const query = new URLSearchParams({
    lat: String(params.lat),
    lng: String(params.lng),
    radiusKm: String(params.radiusKm),
    ...(params.destination ? { destination: params.destination } : {}),
  }).toString();

  return requestJson<NearbyStation[]>(
    `/api/trains/stations/nearby?${query}`,
    {},
    "Could not fetch nearby stations",
  );
}

export async function fetchPnrStatus(pnr: string) {
  return requestJson<PnrStatusResponse>(
    `/api/trains/pnr-status/${pnr}`,
    {},
    "Could not fetch PNR status",
  );
}

export async function fetchTrainLiveStatus(trainNo: string, date: string) {
  return requestJson<TrainLiveStatus>(
    `/api/trains/train-live-status/${trainNo}/${date}`,
    {},
    "Could not fetch train live status",
  );
}

export async function createTrainAlert(payload: {
  email: string;
  trainNo: string;
  date: string;
  classType: string;
  targetFare: number;
  notifyOnSeatOpen?: boolean;
}) {
  return requestJson(
    "/api/trains/alerts",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "Could not create train alert",
  );
}

export async function saveTrainRoute(payload: {
  from: string;
  to: string;
  date: string;
  classType: string;
}) {
  return requestJson<SavedTrainRoute>(
    "/api/trains/saved-routes",
    {
      method: "POST",
      headers: withAuthHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    },
    "Could not save route",
  );
}

export async function fetchSavedTrainRoutes() {
  return requestJson<SavedTrainRoute[]>(
    "/api/trains/saved-routes",
    {
      headers: withAuthHeaders(),
    },
    "Could not fetch saved routes",
  );
}
