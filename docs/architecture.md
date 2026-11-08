# RouteWise — Architecture & Engineering Specification

This document details the architectural design, system boundaries, RAG pipeline, data models, and resilience strategies implemented in **RouteWise**.

---

## 1. System Overview

RouteWise is a full-stack multi-modal transport discovery, fare comparison, and route optimization platform for India. It integrates local databases with Retrieval-Augmented Generation (RAG) across live web search and Large Language Models (LLMs).

```mermaid
flowchart TD
    Client["React 19 / Vite Single Page Application"]
    API["Express.js API Gateway (:4000)"]
    Auth["JWT Authentication & Security Middleware"]
    
    subgraph Services["Core Application Services"]
        Search["Search Service (Multi-Modal Engine)"]
        RAG["RAG Service (Query Understanding & Grounding)"]
        Fare["Fare Calculation Engine"]
        Station["Station & Geocoding Service"]
        Status["Railway Status & Availability Service"]
    end
    
    subgraph DataLayer["Data & Persistence Layer"]
        MongoDB[("MongoDB Atlas Database")]
        RagCache[("RagCache & TTL Engine")]
        VectorStore["Semantic Vector Embeddings (256/1536d)"]
    end
    
    subgraph External["External Services & Fallbacks"]
        Serper["Serper Web Search API"]
        OpenAI["OpenAI (Primary LLM & Embeddings)"]
        Groq["Groq (Fallback 1: gpt-oss-20b / Qwen)"]
        Together["Together AI (Fallback 2: Llama-3)"]
        OSRM["OSRM Routing Gateway"]
    end

    Client -->|HTTPS / JSON| API
    API --> Auth
    Auth --> Services
    Services --> DataLayer
    Services --> External
```

---

## 2. Retrieval-Augmented Generation (RAG) Architecture

The RouteWise RAG pipeline is engineered with multi-stage query understanding, intent classification, station disambiguation, hybrid retrieval (live web + MongoDB vector search), context synthesis, multi-provider LLM fallback, and strict anti-hallucination grounding validation.

```mermaid
flowchart TD
    UserQuery["User Natural Language Query"]
    
    subgraph Understanding["1. Query Understanding & Disambiguation"]
        Intent["Intent Classifier (Schedule, Tatkal, WL/RAC, Route, Unrelated)"]
        Entities["Entity Extractor (Source, Destination, TrainNo, Class, Date)"]
        Disambiguation["Station Normalization (e.g., Delhi -> NDLS, Mumbai -> BCT)"]
    end
    
    subgraph Retrieval["2. Hybrid Retrieval Layer"]
        LiveSearch["Live Serper Web Search (IRCTC / Railway Snippets)"]
        LocalDB["MongoDB Master Train Schedules"]
        VectorSearch["Semantic Cosine Vector Matching"]
    end
    
    subgraph Filtering["3. Synthesis & Grounding"]
        Deduplication["Deduplication & Relevance Filtering"]
        ContextBuild["Context Construction with Sources & Timestamps"]
    end
    
    subgraph Generation["4. Multi-Provider LLM Generation"]
        OpenAIPrimary["OpenAI GPT-4o-mini (Primary)"]
        GroqFallback["Groq gpt-oss-20b / Qwen (Fallback 1)"]
        TogetherFallback["Together AI Llama-3 (Fallback 2)"]
    end
    
    subgraph Output["5. Grounding Validation & Final Delivery"]
        Validation["Grounding & Anti-Hallucination Validator"]
        FinalResponse["Structured JSON Output + Source Attribution"]
    end

    UserQuery --> Understanding
    Intent & Entities & Disambiguation --> Retrieval
    LiveSearch & LocalDB & VectorSearch --> Filtering
    Deduplication & ContextBuild --> Generation
    OpenAIPrimary -.->|Quota 429 / Error| GroqFallback
    GroqFallback -.->|Error| TogetherFallback
    Generation --> Validation
    Validation --> FinalResponse
```

---

## 3. Intelligent Caching Strategy

RouteWise utilizes a tiered caching architecture to maintain high throughput while ensuring data freshness:

| Category | Storage Engine | Freshness / TTL | Invalidation Strategy |
|:---|:---|:---|:---|
| **RAG Queries** | MongoDB `RagCache` | 24 Hours TTL | Query MD5 Hash + Automatic TTL Index |
| **Train Searches** | MongoDB `RagCache` | 24 Hours TTL | Origin + Destination + Date + Class key |
| **Seat Availability** | In-Memory `Map` | 5 Minutes | Memory TTL expiry (`expiresAt`) |
| **Live Train Status** | RAG Web Search | Real-Time | Evaluated on-demand per train and date |
| **Station Master Catalog** | MongoDB `Station` | Static / Persistent | Refreshed during database ingestion |
| **Embeddings** | In-Memory `Map` + DB | Persistent | Cached by exact string representation |

---

## 4. Multi-Modal Transport Comparison Engine

The transport comparison engine evaluates multiple travel modes concurrently:

1. **Train**: Directly queries `Train` and `TrainSchedule` models, applying class-specific base fares, reservation charges, superfast surcharges, GST, and Tatkal formulas.
2. **Bus**: Compares operator schedules, amenities, seat availability, and driver assignments.
3. **Taxi**: Computes distance-based estimates based on vehicle class (Hatchback, Sedan, SUV) and driver proximity.
4. **Carpool**: Matches shared community rides with atomic reservation concurrency control.
5. **Own Vehicle (Fuel)**: Estimates fuel expenditure using distance metrics and average fuel efficiency assumptions.

### Routing Scoring Algorithm:
$$\text{Score} = w_{\text{fare}} \cdot S_{\text{fare}} + w_{\text{time}} \cdot S_{\text{time}} + w_{\text{eco}} \cdot S_{\text{eco}}$$

Where:
- $S_{\text{fare}}$ prioritizes lowest financial cost
- $S_{\text{time}}$ prioritizes lowest transit duration
- $S_{\text{eco}}$ prioritizes lowest estimated $\text{CO}_2$ emissions per passenger-kilometer

---

## 5. Security & Reliability Engineering

- **Helmet**: Secures HTTP response headers against clickjacking, cross-site scripting, and sniffing.
- **In-Memory Rate Limiting**: Dedicated rate limiters protect authentication (10 req/min) and geocoding endpoints (60 req/min).
- **JWT Authentication**: High-entropy signed tokens with 7-day expiration and bcrypt password hashing (10 salt rounds).
- **Graceful OSRM Degradation**: If public routing servers time out or fail, RouteWise automatically falls back to Haversine geodesic distance calculation without user interruption.
- **Honest Provider Adapters**: Official railway APIs requiring enterprise credentials (such as live PNR status or RTIS GPS gateways) report honest integration status instead of fabricated simulation data.
