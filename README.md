# RouteWise — AI-Powered Transport Fare & Route Optimization System

RouteWise is a production-ready full-stack MERN application that intelligently compares transport routes, fares, and travel durations across multiple transportation modes including train, bus, taxi, metro, and carpool services.

The platform integrates an AI-powered Retrieval-Augmented Generation (RAG) pipeline using Large Language Models (LLMs) and live web search APIs to provide real-time train schedules, seat availability, Tatkal status, waitlist predictions, and quota-based travel insights.

Built with scalability, resilience, and performance in mind, RouteWise features multi-provider LLM fallback architecture, semantic fallback search, MongoDB-based intelligent caching, and optimized frontend rendering for a seamless user experience.

---

# 🚀 Features

- Smart multi-modal route and fare comparison
- Real-time train schedule and seat availability search
- AI-powered RAG architecture with LLM integration
- Tatkal, waitlist, and quota availability insights
- Multi-provider AI fallback system
- Semantic fallback retrieval using embeddings
- MongoDB TTL caching for optimized repeated queries
- Concurrent API processing using `Promise.all`
- Session state restoration for smooth navigation
- Skeleton loaders and optimized frontend rendering
- Fault-tolerant backend with structured error handling

---

# 🛠 Tech Stack

## Frontend
- React 19
- Vite
- TailwindCSS
- React Router
- Radix UI

## Backend
- Node.js
- Express.js

## Database
- MongoDB
- Mongoose

## AI & External Services
- OpenAI API
- Groq API
- Together AI API
- Google Serper API

---

# 📁 Project Structure

```bash
RouteWise/
│
├── client/                 # React Frontend
│   ├── src/
│   ├── components/
│   ├── pages/
│   └── services/
│
├── server/                 # Express Backend
│   ├── config/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   └── utils/
│
├── .env
├── package.json
└── README.md
```

---

# ⚙️ Environment Variables

Create a `.env` file inside the `server/` directory:

```env
PORT=5000
MONGO_URI=your_mongodb_connection_string

OPENAI_API_KEY=your_openai_api_key
GROQ_API_KEY=your_groq_api_key
TOGETHER_API_KEY=your_together_api_key

SERPER_API_KEY=your_serper_api_key
```

Create another `.env` file inside the `client/` directory:

```env
VITE_API_BASE_URL=http://localhost:5000
```

---

# 📦 Installation & Setup

## 1. Clone the Repository

```bash
git clone https://github.com/your-username/routewise.git
cd routewise
```

---

## 2. Install Dependencies

### Install Backend Dependencies

```bash
cd server
npm install
```

### Install Frontend Dependencies

```bash
cd ../client
npm install
```

---

# ▶️ Running the Application

## Start Backend Server

```bash
cd server
npm run dev
```

Backend will run on:

```bash
http://localhost:5000
```

---

## Start Frontend

```bash
cd client
npm run dev
```

Frontend will run on:

```bash
http://localhost:5173
```

---

# ⚡ Performance Optimizations

## Backend Optimizations
- MongoDB TTL caching for automatic cache expiration
- In-memory caching for volatile seat availability data
- Concurrent request processing using `Promise.all`
- Semantic similarity fallback retrieval
- Timeout-controlled external API calls

## Frontend Optimizations
- Session state restoration using `sessionStorage`
- Skeleton loading components to reduce CLS
- Optimized React rendering and state updates
- Localized UI refreshes for map and train panels

---

# 🛡 Error Handling & Reliability

- Global Express error-handling middleware
- Unhandled Promise rejection monitoring
- Multi-provider AI fallback mechanism
- Graceful degradation when APIs fail
- Structured schema validation with Mongoose

---

# 🔮 Future Improvements

- Real-time GPS-based transport tracking
- AI fare prediction using machine learning
- Personalized travel recommendations
- User authentication and booking integration
- Progressive Web App (PWA) support

---

