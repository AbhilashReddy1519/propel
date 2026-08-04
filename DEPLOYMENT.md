# Deployment & Operational Runbook

This document provides step-by-step instructions for running, deploying, configuring, verifying, and troubleshooting the Automated Grid Fault Localization System.

---

## 1. System Prerequisites

- **Docker:** Version 24.0+
- **Docker Compose:** Version 2.20+
- **Node.js (for local dev):** Version 20.0+ LTS
- **PostgreSQL (for local dev):** Version 16.0+

---

## 2. Quickstart & Deployment Commands

### Option A: One-Command Docker Compose (Recommended)

1. Clone the repository:
   ```bash
   git clone https://github.com/AbhilashReddy1519/propel.git
   cd propel
   ```
2. Start all services (PostgreSQL, Express API Server, Next.js Operator Console):
   ```bash
   docker compose up --build
   ```
3. Access the application:
   - **Operator Console:** `http://localhost:5000`
   - **Backend API Base:** `http://localhost:3000/api/v1`

---

### Option B: Local Development Setup (Manual)

#### 1. Database Setup
Ensure PostgreSQL is running locally on port `4000` (or update `DATABASE_URL` in `server/.env`):
```bash
docker compose up -d propel-db-service
```

#### 2. Backend Setup
```bash
cd server
npm install
npx drizzle-kit push   # Apply database migrations
npm run dev            # Starts API on http://localhost:3000
```

#### 3. Frontend Setup
```bash
cd client
npm install
npm run dev            # Starts Next.js App on http://localhost:5000
```

---

## 3. Environment Variables Reference

### Backend (`server/.env`)

| Variable | Required | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `PORT` | Yes | `3000` | HTTP port for the Express backend server |
| `NODE_ENV` | Yes | `development` | Environment mode (`development` / `production`) |
| `DATABASE_URL` | Yes | `postgres://Abhilash:Abhi1234@localhost:4000/propel_db` | PostgreSQL connection URI |
| `CORS_ORIGIN` | Yes | `http://localhost:3000,http://localhost:5000` | Allowed CORS origin URLs |
| `ANTHROPIC_API_KEY` | No | `""` | Anthropic Claude API key for AI briefings (falls back to template if empty) |

### Frontend (`client/.env.local`)

| Variable | Required | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_API_BASE` | Yes | `http://localhost:3000/api/v1` | Base URL for backend REST API calls |

---

## 4. End-to-End Verification Steps

Perform this verification sequence after starting the application:

1. **Verify Network Data Load:**
   - Open `http://localhost:5000` in a browser.
   - Confirm that the GIS Leaflet map loads background DT context dots (`#3a4d6b`).
2. **Inject Synthetic Span Fault:**
   - Scroll down to the `🧪 Simulator — test controls, not real operations` panel.
   - Select a DT (e.g., `D-0204`), choose `Span` fault scope, and click `🧪 Inject SPAN Fault`.
   - Confirm a success banner appears and a new incident appears in the left Queue within 4.5 seconds.
3. **Verify Operator Ticket Lifecycle:**
   - Click the newly created incident in the queue.
   - Click `Acknowledge` → status updates to `Acknowledged`.
   - Click `Assign Crew` → status updates to `Crew Assigned`.
   - Click `Mark Resolved` → status updates to `Resolved (pending)`.
   - Observe that `Mark Resolved` shows the notice: *"Marked resolved by crew, awaiting telemetry confirmation. No manual action can advance it from here."*
4. **Verify Telemetry Auto-Verification:**
   - In the Simulator panel under `Hardware Telemetry Repair (Sim)`, click `🛠️ Restore Physical Telemetry`.
   - Observe that the ticket auto-advances from `Resolved (pending)` → `Verified` → `Closed` within 4.5 seconds.

---

## 5. Real-World Troubleshooting Log (Phase 7 Notes)

### 1. CORS Origin Port Mismatch
- **Symptom:** Next.js frontend on `http://localhost:5000` failed to fetch `/network/dts` and `/incidents`, resulting in blank screens and browser console errors: `Access to fetch at 'http://localhost:3000/api/v1/incidents' from origin 'http://localhost:5000' has been blocked by CORS policy`.
- **Root Cause:** Backend `server/src/config/env.ts` defaulted CORS origins to `5173` (Vite port) instead of `5000` (Next.js dev port).
- **Fix:** Updated `server/src/config/env.ts` and `server/.env` to explicitly include `http://localhost:5000` in `CORS_ORIGIN`.

### 2. `next/font/google` External Network Build Failure
- **Symptom:** Docker container build (`next build`) crashed with a fatal error trying to fetch Google Fonts (`fonts.googleapis.com`).
- **Root Cause:** Next.js `next/font/google` makes external HTTPS requests at build time. Restricted network or offline container builds throw unhandled network exceptions.
- **Fix:** Removed `next/font/google` from `client/app/layout.tsx` and replaced it with standard system font stacks (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`) in `client/app/globals.css`.

### 3. PostgreSQL Container Startup Race Condition
- **Symptom:** Backend container crashed on startup with `ECONNREFUSED 127.0.0.1:4000` or `FATAL: database "propel_db" is starting up`.
- **Root Cause:** Node server started before the PostgreSQL container finished internal initialization.
- **Fix:** Added a Docker healthcheck to `docker-compose.yml` for PostgreSQL and configured `depends_on: { propel-db-service: { condition: service_healthy } }`.

### 4. Component State Leakage Across Incidents
- **Symptom:** Attempting `Mark Resolved` on an un-repaired pole generated a `409 Conflict` error banner. When clicking a different incident, the same 409 error banner remained visible.
- **Root Cause:** `TransitionActions` maintained local `conflictError` state, which React preserved when reusing component instances upon prop updates.
- **Fix:** Added `key={incident.id}` to `<TransitionActions />` in `IncidentDetail.tsx` and implemented a `useEffect` hook listening to `incident.id` to clear error state upon selection change.

---

## 6. System Reset Instructions

To completely wipe the database and restart with fresh synthetic grid topology:

```bash
# Stop running containers and remove volumes
docker compose down -v

# Rebuild and start fresh
docker compose up --build
```
