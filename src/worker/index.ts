/// <reference types="../../worker-configuration.d.ts" />
import { Hono } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import {
  exchangeCodeForSessionToken,
  getOAuthRedirectUrl,
  authMiddleware,
  deleteSession,
  MOCHA_SESSION_TOKEN_COOKIE_NAME,
} from "@getmocha/users-service/backend";

const app = new Hono<{ Bindings: Env }>();

// ========== AUTH ROUTES ==========

// Get OAuth redirect URL
app.get("/api/oauth/google/redirect_url", async (c) => {
  const redirectUrl = await getOAuthRedirectUrl("google", {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });
  return c.json({ redirectUrl }, 200);
});

// Exchange code for session token
app.post("/api/sessions", async (c) => {
  const body = await c.req.json();

  if (!body.code) {
    return c.json({ error: "No authorization code provided" }, 400);
  }

  const sessionToken = await exchangeCodeForSessionToken(body.code, {
    apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
    apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
  });

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 60 * 24 * 60 * 60, // 60 days
  });

  return c.json({ success: true }, 200);
});

// Get current user
app.get("/api/users/me", authMiddleware, async (c) => {
  return c.json(c.get("user"));
});

// Logout
app.get("/api/logout", async (c) => {
  const sessionToken = getCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME);

  if (typeof sessionToken === "string") {
    await deleteSession(sessionToken, {
      apiUrl: c.env.MOCHA_USERS_SERVICE_API_URL,
      apiKey: c.env.MOCHA_USERS_SERVICE_API_KEY,
    });
  }

  setCookie(c, MOCHA_SESSION_TOKEN_COOKIE_NAME, "", {
    httpOnly: true,
    path: "/",
    sameSite: "none",
    secure: true,
    maxAge: 0,
  });

  return c.json({ success: true }, 200);
});

// ========== ROUTING ROUTES ==========

// Geocode a location name to coordinates using Nominatim
app.get("/api/geocode", async (c) => {
  const query = c.req.query("q");
  
  if (!query) {
    return c.json({ error: "Query parameter 'q' is required" }, 400);
  }

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=in`,
      { headers: { Accept: "application/json" } }
    );

    if (!response.ok) {
      return c.json({ error: "Geocoding provider request failed" }, 502);
    }

    const data = (await response.json()) as Array<{ display_name: string; lat: string; lon: string }>;
    return c.json(data);
  } catch {
    return c.json({ error: "Failed to geocode location" }, 500);
  }
});

// Calculate route between two points using OSRM
app.get("/api/route", async (c) => {
  const startLat = c.req.query("startLat");
  const startLng = c.req.query("startLng");
  const endLat = c.req.query("endLat");
  const endLng = c.req.query("endLng");

  if (!startLat || !startLng || !endLat || !endLng) {
    return c.json({ error: "Missing coordinates" }, 400);
  }

  try {
    // OSRM expects lng,lat format
    const response = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`
    );

    if (!response.ok) {
      return c.json({ error: "Routing provider request failed" }, 502);
    }

    const data = await response.json() as { 
      code: string; 
      routes?: Array<{ 
        distance: number; 
        duration: number; 
        geometry: { coordinates: number[][] } 
      }> 
    };

    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      return c.json({ error: "No route found" }, 404);
    }

    const route = data.routes[0];
    const distanceKm = route.distance / 1000;
    const durationMin = Math.round(route.duration / 60);

    // Calculate fares for different transport modes (Indian Rupees)
    const fares = {
      bus: Math.round(Math.max(10, distanceKm * 2.5)),
      taxi: Math.round(50 + distanceKm * 14),
      train: Math.round(Math.max(15, distanceKm * 1.8)),
      carpool: Math.round(distanceKm * 4.5),
      fuel: Math.round(distanceKm * 5.5),
    };

    // Calculate estimated times (minutes)
    const times = {
      bus: Math.round(durationMin * 1.4), // Bus is slower due to stops
      taxi: durationMin,
      train: Math.round(durationMin * 0.8), // Train is faster for long distances
      carpool: Math.round(durationMin * 1.15),
      fuel: durationMin,
    };

    return c.json({
      distance: distanceKm,
      duration: durationMin,
      fares,
      times,
      geometry: route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]), // Convert to [lat, lng]
    });
  } catch {
    return c.json({ error: "Failed to calculate route" }, 500);
  }
});

// ========== BOOKING ROUTES ==========

// Create a booking (protected)
app.post("/api/bookings", authMiddleware, async (c) => {
  const user = c.get("user");
  const body = await c.req.json();

  const { sourceLocation, destinationLocation, distance, duration, transportType, fare } = body;

  if (!sourceLocation || !destinationLocation || !transportType) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const result = await c.env.DB.prepare(
    `INSERT INTO bookings (user_id, source_location, destination_location, distance, duration, transport_type, fare)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(user!.id, sourceLocation, destinationLocation, distance, duration, transportType, fare)
    .run();

  return c.json({ 
    success: true, 
    bookingId: result.meta.last_row_id,
    message: "Booking confirmed!"
  }, 201);
});

// Get user's bookings (protected)
app.get("/api/bookings", authMiddleware, async (c) => {
  const user = c.get("user");

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM bookings WHERE user_id = ? ORDER BY created_at DESC`
  )
    .bind(user!.id)
    .all();

  return c.json(results);
});

// Get single booking (protected)
app.get("/api/bookings/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const bookingId = c.req.param("id");

  const result = await c.env.DB.prepare(
    `SELECT * FROM bookings WHERE id = ? AND user_id = ?`
  )
    .bind(bookingId, user!.id)
    .first();

  if (!result) {
    return c.json({ error: "Booking not found" }, 404);
  }

  return c.json(result);
});

// Cancel a booking (protected)
app.delete("/api/bookings/:id", authMiddleware, async (c) => {
  const user = c.get("user");
  const bookingId = c.req.param("id");

  await c.env.DB.prepare(
    `UPDATE bookings SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`
  )
    .bind(bookingId, user!.id)
    .run();

  return c.json({ success: true });
});

export default app;
