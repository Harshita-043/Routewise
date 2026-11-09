# RouteWise — AI-Powered Transport Fare & Route Optimization System

RouteWise is a production-ready full-stack MERN application that intelligently compares transport routes, fares, and travel durations across multiple transportation modes — train, bus, taxi, metro, and carpool — across India.

The platform integrates a fully implemented **Retrieval-Augmented Generation (RAG) pipeline** that combines live web search (Serper API), semantic MongoDB retrieval, and a multi-provider LLM fallback chain (OpenAI → Groq → Together AI) to deliver grounded, real-world travel intelligence.

---

## 🚀 Features

- **Multi-modal route & fare comparison** — Trains, buses, taxis, carpools, and metro in one view
- **AI Assistant with RAG** — Intent-classified, entity-extracted, grounded LLM responses via `POST /api/rag/query`
- **Live web search retrieval** — Serper-powered real-time train schedule and route extraction
- **Semantic MongoDB retrieval** — Embedding-based cosine similarity search over cached train schedules
- **Multi-provider LLM fallback** — OpenAI → Groq → Together AI with per-provider rate-limit handling
- **Honest availability states** — PNR and live status surface clear `source: "unavailable"` when no live API is configured; no simulated data
- **MongoDB TTL caching** — RAG and availability responses cached with automatic expiry
- **Route distance calculation** — OSRM integration with Haversine fallback when OSRM is unreachable
- **Session state restoration** — Search results persist across page navigation via `sessionStorage`
- **Skeleton loaders & structured errors** — Every loading and error state is explicitly handled
- **24-test backend suite** — Full unit + integration coverage (`npm test`)
- **8-scenario RAG evaluation** — Real-world grounding benchmark (`npm run test:rag`)

---

## 🛠 Tech Stack

### Frontend
- React 19, Vite, TypeScript
- TailwindCSS, Radix UI, Lucide Icons
- React Router v6

### Backend
- Node.js, Express.js
- Mongoose (MongoDB ODM)
- `node:test` (native test runner)

### AI & External Services
| Service | Role | Env Var |
|---|---|---|
| OpenAI | Embeddings + LLM primary | `OPENAI_API_KEY` |
| Groq | LLM fallback 1 (fast inference) | `GROQ_API_KEY` |
| Together AI | LLM fallback 2 | `TOGETHER_API_KEY` |
| Serper | Live web search | `SERPER_API_KEY` |
| Google Maps | Geocoding (optional) | `GOOGLE_MAPS_API_KEY` |
| IRCTC / RapidAPI | Live PNR lookup (optional) | `IRCTC_PNR_API_KEY` / `RAPIDAPI_KEY` |

---

## 📁 Project Structure

```
RouteWise/
│
├── backend/
│   ├── config/            # MongoDB connection
│   ├── controllers/       # Route handlers (search, train, auth, pnr)
│   ├── middleware/        # Auth, error handler, validator
│   ├── models/            # Mongoose schemas (Train, TrainSchedule, RagCache, User, Station…)
│   ├── routes/            # Express routers (search, train, rag, auth, pnr)
│   ├── services/
│   │   ├── llmService.js          # Multi-provider LLM fallback (OpenAI→Groq→Together)
│   │   ├── ragService.js          # Full RAG pipeline (intent→retrieval→generation)
│   │   ├── embeddingService.js    # OpenAI embeddings + cosine similarity
│   │   ├── searchService.js       # Multi-modal transport search
│   │   ├── trainAvailabilityService.js
│   │   ├── trainStatusService.js  # Honest PNR (requires IRCTC_PNR_API_KEY)
│   │   └── serperService.js       # Serper web search integration
│   ├── app.js             # Express app + middleware + route registration
│   └── server.js          # HTTP server entry point
│
├── src/                   # React frontend (Vite)
│   ├── components/
│   │   ├── AiAssistant.tsx        # RAG chat UI with sources, intent, provider metadata
│   │   ├── PNRStatus.tsx          # PNR lookup with honest-unavailable display
│   │   ├── TransportCard.tsx
│   │   ├── TrainCard.tsx
│   │   ├── FareComparisonPanel.tsx
│   │   ├── RouteMap.tsx
│   │   └── BookingModal.tsx
│   ├── pages/
│   │   └── TransitHome.tsx        # Main search + results page
│   ├── services/
│   │   └── api.ts                 # Typed API client (includes askRagAssistant())
│   └── main.tsx
│
├── tests/
│   ├── backend.test.js            # 24 unit/integration tests
│   └── rag-evaluation.test.js     # 8 real-world RAG scenario benchmarks
│
├── docs/
│   ├── architecture.md            # RAG pipeline flowcharts + caching strategy
│   └── api-documentation.md      # All API endpoints with request/response schemas
│
├── CONTRIBUTING.md
├── .env.example           # Fully documented template
└── README.md
```

---

## ⚙️ Environment Variables

Copy `.env.example` to `.env` in the project root and fill in your credentials:

```env
# Server
PORT=4000

# MongoDB (Atlas SRV or local)
MONGO_URI=mongodb://127.0.0.1:27017/routewise

# JWT Secret
JWT_SECRET=your-very-strong-secret-at-least-32-chars

# LLM Providers (OpenAI → Groq → Together AI fallback chain)
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
OPENAI_EMBEDDING_MODEL=text-embedding-3-small

GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b        # Also tries qwen/qwen3.8-27b, openai/gpt-oss-120b

TOGETHER_API_KEY=
TOGETHER_MODEL=meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo

# Live Search
SERPER_API_KEY=

# Optional
GOOGLE_MAPS_API_KEY=
IRCTC_PNR_API_KEY=    # Required for live PNR lookup; without this, PNR shows honest-unavailable
RAPIDAPI_KEY=         # Alternative to IRCTC_PNR_API_KEY
```

---

## 📦 Installation & Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/routewise.git
cd "RouteWise - Smart Transport Fare Calculator"
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
copy .env.example .env
# Then edit .env with your API keys
```

### 4. Seed the Database (Automatic / Optional)

The server automatically seeds the database on startup (`initializeBackend()`). If you ever need to manually re-seed:

```bash
npm.cmd run seed
# or: node backend/scripts/seed.js
```

---

## ▶️ Running the Application

### Development (backend + frontend concurrently)

```bash
npm run dev
```

The backend runs on **http://localhost:4000** and the Vite dev server on **http://localhost:5173** (proxied to backend).

### Production Build

```bash
npm run build        # Builds React → dist/
node backend/server.js   # Serves API + static dist/
```

---

## 🧪 Testing

### Backend Unit & Integration Tests (24 tests)

```bash
npm test
```

Covers: DB connectivity, embeddings, LLM fallback chain, geocoding, search, availability, PNR validation, auth, RAG caching.

### RAG Evaluation Benchmark (8 scenarios)

```bash
npm run test:rag
```

Real-world grounding scenarios: train schedule search, availability, Tatkal, waitlist, fare comparison, unrelated query rejection, station disambiguation, and offline fallback.

---

## 🤖 RAG Pipeline

The AI Assistant uses a full RAG architecture — not just an LLM connected to a search API:

```
User Query
    ↓
Intent Classification  (train_schedule / availability / tatkal / pnr / fare_comparison / general …)
    ↓
Entity Extraction      (source, destination, station codes, date, class, quota, train number)
    ↓
Station Disambiguation (resolves ambiguous names before retrieval)
    ↓
Parallel Retrieval
    ├── Serper web search  →  content extraction + relevance filtering
    └── MongoDB semantic   →  embedding cosine similarity over TrainSchedule
    ↓
Context Construction + Deduplication
    ↓
Grounded LLM Generation  (OpenAI → Groq → Together AI)
    ↓
Anti-hallucination validation  (refuses ungrounded claims)
    ↓
Structured Response  { answer, sources[], intent, provider, cached }
```

### RAG API Endpoint

```
POST /api/rag/query
Content-Type: application/json

{
  "query": "Find trains from Delhi to Jaipur on 15 December",
  "sessionId": "optional-session-id"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "answer": "...",
    "sources": [{ "title": "...", "url": "...", "snippet": "..." }],
    "intent": "train_schedule",
    "entities": { "source": "Delhi", "destination": "Jaipur", "date": "2026-12-15" },
    "provider": "groq",
    "cached": false
  },
  "meta": { "timestamp": "...", "queryHash": "..." }
}
```

---

## 🔌 Key API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/search` | Multi-modal route search (train, bus, taxi, carpool) |
| `GET` | `/api/route` | Distance, duration & multi-modal fare estimate |
| `GET` | `/api/geocode` | Place geocoding autocomplete suggestions |
| `POST` | `/api/rag/query` | Full RAG AI assistant query |
| `POST` | `/api/rag/understand` | Intent + entity extraction only |
| `GET` | `/api/rag/capabilities` | RAG system metadata |
| `POST` | `/api/trains/search` | Search trains with AI summary |
| `POST` | `/api/trains/availability` | Seat availability query |
| `GET` | `/api/trains/stations/nearby` | Find stations near coordinates |
| `POST` | `/api/trains/pnr-status` | PNR status (requires `IRCTC_PNR_API_KEY`) |
| `POST` | `/api/auth/signup` | User registration |
| `POST` | `/api/auth/login` | User login (returns JWT) |

Full schema documentation: [`docs/api-documentation.md`](docs/api-documentation.md)

---

## ⚡ Performance & Reliability

| Feature | Detail |
|---|---|
| LLM provider fallback | OpenAI → Groq → Together AI; 429/402 triggers next provider, not next model |
| RAG cache | MongoDB TTL; only caches successful LLM responses (not unavailable fallbacks) |
| Embedding cache | In-memory LRU within process lifetime |
| Route distance | OSRM (6 s timeout) → Haversine fallback |
| PNR | Honest `source: "unavailable"` when no API key configured |
| All external calls | Explicit timeout via `AbortController` |

---

## 🛡 Error Handling

- Global Express error middleware with structured JSON error responses
- All async route handlers wrapped in try/catch
- Unhandled promise rejection monitoring in `server.js`
- Multi-provider AI fallback with per-failure logging
- Meaningful HTTP status codes (400 / 401 / 404 / 429 / 500)

---

## 🔮 Future Improvements

- Real-time GPS-based transport tracking
- AI fare prediction using historical data
- Personalized travel recommendations based on booking history
- PWA support with offline caching
- Webhook-based live train position updates
