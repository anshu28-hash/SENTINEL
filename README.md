# Sentinel — Real-Time Fraud Detection & Autonomous Transaction Engine

A full-stack, enterprise-grade financial fraud detection platform with an automated transaction stream, real-time heuristic detection engine, and seamless Supabase database integration.

---

## 🚀 Key Features Built

1. **Automatic Transaction Streamer (`simulator.js`)**:
   - Continuously generates realistic financial transactions (UPI, IMPS, NEFT, RTGS) at configurable intervals (default: 4 seconds).
   - Generates ~75% legitimate day-to-day transactions and ~25% suspicious anomaly patterns (money mule layering, high-value spikes, rapid velocity bursts, structuring).
   - Can be started, stopped, or manually triggered via API (`POST /api/simulator/start`, `POST /api/simulator/stop`, `POST /api/simulator/trigger`).

2. **Real-Time Fraud Detection Engine (`fraudDetector.js`)**:
   - **High-Value Anomaly Detection**: Flags transfers exceeding retail and institutional limits (> ₹2,00,000 to ₹5,00,000+).
   - **Velocity Burst Rule**: Flags accounts attempting automated or rapid transactions within a 2-minute window.
   - **Money Mule / Layering Detection**: Detects rapid onward transfers where an account receives funds and immediately forwards ~90-100% to a third account.
   - **Structuring / Smurfing Rule**: Detects transfers deliberately calibrated just below reporting ceilings (₹49,000–₹49,999, ₹98,000–₹99,999, etc.).
   - **Circular Fund Flow**: Identifies cyclic routing between accounts.
   - **Dynamic Scoring**: Computes a 0–100 risk score and classifies severity (`Critical`, `High`, `Medium`, `Low`).
   - **Autonomous Investigation & Evidence Creation**: Automatically drafts structured investigation summaries and attaches evidence when fraud is detected.

3. **Supabase Database & Resilient In-Memory Synchronization (`database.js`)**:
   - Synchronizes with tables: `accounts`, `transactions`, `alerts`, `investigations`, `evidence`, `audit_logs`.
   - Auto-creates counterparty accounts on the fly.
   - Resilient design: Server continues uninterrupted even during network hiccups.

4. **Real-Time Live Streaming (Server-Sent Events - SSE)**:
   - Endpoint `GET /api/stream` pushes incoming transactions, fraud evaluations, and alerts live to connected frontend clients.

5. **Single-Port Unified Experience**:
   - The backend on port `3000` serves the complete REST API **and** the full React frontend simultaneously at `http://localhost:3000`.

---

## 🛠️ API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check, Supabase status & simulator status |
| `GET` | `/api/stats` | Summary metrics, active alerts, confirmed frauds, activity chart |
| `GET` | `/api/transactions` | Query transactions (filters: `q`, `status`, `channel`, `min`, `max`, `from`, `to`, `sort`, pagination) |
| `POST` | `/api/transactions` | Ingest external transaction -> Runs live fraud detection -> Returns evaluation |
| `GET` | `/api/alerts` | List all detection alerts |
| `GET` | `/api/alerts/:id` | Alert details with linked transaction |
| `GET` | `/api/investigations` | List investigation cases |
| `GET` | `/api/investigations/:id` | Investigation case with AI summary & evidence |
| `PATCH` | `/api/investigations/:id` | Record analyst decision (`outcome`: `confirmed_fraud` \| `legitimate` \| `inconclusive`, `notes`) |
| `GET` | `/api/stream` | Server-Sent Events (SSE) live transaction feed |
| `POST` | `/api/simulator/start` | Start automated transaction stream |
| `POST` | `/api/simulator/stop` | Pause automated transaction stream |
| `POST` | `/api/simulator/trigger` | Trigger a specific transaction (`normal`, `high_value`, `mule`) |

---

## 🏃 Quick Start Guide

### 1. Start the Backend (API + Web Dashboard)
```bash
cd backend
npm start
```
The server will start on `http://localhost:3000` with the automated transaction simulator running.

### 2. Run Backend Tests
```bash
cd backend
npm test
```

### 3. (Optional) Run Frontend in Vite Dev Mode
```bash
cd frontend
npm run dev
```
Accessible at `http://localhost:5173` (proxies `/api` to port 3000).
