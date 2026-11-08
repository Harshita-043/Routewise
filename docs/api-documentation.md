# RouteWise — Complete API Specification

All API endpoints reside under `/api` and communicate using standard JSON payloads.

---

## 1. Authentication Endpoints

### `POST /api/auth/signup`
Creates a new user account and returns a signed JWT token.

- **Auth Required**: No
- **Rate Limit**: 10 requests / min / IP
- **Request Body**:
```json
{
  "name": "Arjun Sharma",
  "email": "arjun@example.com",
  "phone": "9876543210",
  "password": "StrongPassword123!"
}
```
- **Response (200 OK)**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "67cb1a482b8a7f0012345678",
    "name": "Arjun Sharma",
    "email": "arjun@example.com",
    "phone": "9876543210"
  }
}
```

---

### `POST /api/auth/login`
Authenticates an existing user.

- **Auth Required**: No
- **Rate Limit**: 10 requests / min / IP
- **Request Body**:
```json
{
  "email": "arjun@example.com",
  "password": "StrongPassword123!"
}
```
- **Response (200 OK)**:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "67cb1a482b8a7f0012345678",
    "name": "Arjun Sharma",
    "email": "arjun@example.com",
    "phone": "9876543210"
  }
}
```

---

### `GET /api/auth/me`
Retrieves the profile of the authenticated user.

- **Auth Required**: Yes (`Bearer <token>`)
- **Response (200 OK)**:
```json
{
  "id": "67cb1a482b8a7f0012345678",
  "name": "Arjun Sharma",
  "email": "arjun@example.com",
  "phone": "9876543210"
}
```

---

## 2. Search & Routing Endpoints

### `GET /api/geocode?q=<query>`
Provides place autocomplete suggestions with latitude and longitude.

- **Auth Required**: No
- **Rate Limit**: 60 requests / min / IP
- **Response (200 OK)**:
```json
{
  "source": "fallback",
  "results": [
    {
      "display_name": "New Delhi, Delhi, India",
      "lat": "28.6139",
      "lon": "77.2090"
    }
  ]
}
```

---

### `GET /api/route?startLat=<lat>&startLng=<lng>&endLat=<lat>&endLng=<lng>`
Calculates road distance, travel duration, multi-modal fare estimates, and route polyline geometry.

- **Auth Required**: No
- **Response (200 OK)**:
```json
{
  "distance": 268.4,
  "duration": 285,
  "fares": {
    "bus": 752,
    "taxi": 4106,
    "train": 564,
    "carpool": 1127,
    "fuel": 1557
  },
  "times": {
    "bus": 356,
    "taxi": 285,
    "train": 234,
    "carpool": 299,
    "fuel": 285
  },
  "geometry": [
    [28.6139, 77.209],
    [26.9124, 75.7873]
  ]
}
```

---

### `GET /api/search?from=<origin>&to=<destination>&date=<YYYY-MM-DD>`
Performs a multi-modal search across trains, buses, taxis, and carpools.

- **Auth Required**: No
- **Response (200 OK)**:
```json
{
  "query": { "from": "Delhi", "to": "Jaipur" },
  "results": {
    "train": [
      {
        "id": "...",
        "code": "TR102",
        "transportType": "train",
        "label": "Pink City Express",
        "source": "Delhi",
        "destination": "Jaipur",
        "departureTime": "07:00",
        "arrivalTime": "11:35",
        "seatsAvailable": 96,
        "amount": 620,
        "durationText": "4h 35m",
        "distanceKm": 240,
        "matchType": "direct"
      }
    ],
    "bus": [...],
    "taxi": [...],
    "carpool": [...]
  },
  "suggestions": {
    "train": [],
    "bus": [],
    "taxi": [],
    "carpool": []
  },
  "nearby": {
    "from": [],
    "to": []
  }
}
```

---

## 3. RAG AI Assistant Endpoints

### `POST /api/rag/query`
Natural language travel assistant with intent classification, multi-source retrieval (live web + MongoDB), and grounded answer generation.

- **Auth Required**: No
- **Request Body**:
```json
{
  "query": "Find trains between New Delhi and Mumbai"
}
```
- **Response (200 OK)**:
```json
{
  "success": true,
  "answer": "Here are the top trains running between New Delhi (NDLS) and Mumbai Central (BCT)...",
  "intent": "train_schedule",
  "entities": {
    "source": "New Delhi",
    "destination": "Mumbai Central",
    "stationCode": "NDLS",
    "date": null,
    "trainNumber": null,
    "classType": null,
    "quota": null
  },
  "retrievedData": [
    {
      "trainNo": "12952",
      "trainName": "Mumbai Rajdhani",
      "source": "New Delhi",
      "destination": "Mumbai Central",
      "departureTime": "16:55",
      "arrivalTime": "08:35",
      "duration": "15h 40m",
      "fare": 1850,
      "classes": [...]
    }
  ],
  "sources": [
    {
      "title": "Indian Railways / Serper Web Search Results",
      "url": "https://www.irctc.co.in",
      "snippet": "New Delhi to Mumbai Central Rajdhani Express..."
    }
  ],
  "confidence": "high",
  "dataFreshness": {
    "retrievedAt": "2026-11-08T05:11:55.000Z",
    "isLive": true
  },
  "provider": "groq",
  "cached": false
}
```

---

### `POST /api/rag/understand`
Classifies intent and extracts travel entities without executing full document generation.

- **Auth Required**: No
- **Request Body**: `{ "query": "Is Tatkal open for 12002?" }`
- **Response (200 OK)**:
```json
{
  "intent": "tatkal_availability",
  "entities": {
    "trainNumber": "12002",
    "quota": "TQ"
  }
}
```

---

## 4. Indian Railway Services

### `POST /api/trains/search`
Retrieves train schedules with fare calculation and AI overview.

- **Request Body**:
```json
{
  "from": "Delhi",
  "to": "Mumbai",
  "date": "2026-11-20",
  "classType": "3A"
}
```

---

### `GET /api/trains/pnr-status/:pnr`
Checks 10-digit PNR status. Discloses honest integration status when external enterprise gateway credentials are unconfigured.

---

### `GET /api/trains/train-live-status/:trainNo/:date`
Retrieves live train position, current station, and delay minutes via live web RAG.

---

### `GET /api/trains/stations/nearby?lat=<lat>&lng=<lng>&radiusKm=<radius>`
Finds railway stations within the specified geographic radius.

---

## 5. Booking Endpoints

### `POST /api/bookings`
Creates a confirmed reservation for a transport option.

- **Auth Required**: Yes (`Bearer <token>`)
- **Request Body**:
```json
{
  "transportType": "train",
  "transportId": "67cb1a482b8a7f0012345678",
  "source": "Delhi",
  "destination": "Jaipur",
  "date": "2026-11-20",
  "passengers": 2,
  "seats": ["B1", "B2"],
  "amount": 1240,
  "passengerDetails": [
    { "name": "Arjun Sharma", "age": 28, "gender": "male" },
    { "name": "Riya Sharma", "age": 26, "gender": "female" }
  ]
}
```

---

### `GET /api/bookings`
Fetches all bookings belonging to the authenticated user.

- **Auth Required**: Yes (`Bearer <token>`)

---

### `PATCH /api/bookings/:id/cancel`
Cancels a reservation and restores inventory.

- **Auth Required**: Yes (`Bearer <token>`)
