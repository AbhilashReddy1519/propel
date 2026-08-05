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
| `DATABASE_URL` | Yes | `postgres://<user>:<password>@localhost:4000/propel_db` | PostgreSQL connection URI |
| `CORS_ORIGIN` | Yes | `http://localhost:3000,http://localhost:5000` | Allowed CORS origin URLs |
| `GROQ_API_KEY` | No | `""` | Groq API key for AI briefings (falls back to template if empty) |

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
   - Observe that the ticket auto-advances from `Resolved (pending)` → `Verified` on its own (no button click), typically within a couple seconds.
   - **`Closed` is NOT automatic** — this is a deliberate design choice, not a gap. Click `Close Ticket` manually as the operator's final sign-off after telemetry has confirmed the fix. Auto-closing without an explicit human acknowledgment would remove the last operator checkpoint from the lifecycle.
5. **Verify the no-device / range-confidence path (force-close):**
   - Inject a `Span` fault targeting a pole with no device attached (check `/network/dts/:dtId/poles` for `hasDevice: false` entries, or repeatedly inject span faults — roughly 9% of poles have no device per spec).
   - Confirm the resulting incident shows `range` confidence.
   - Attempting `Restore Physical Telemetry` on this incident should report `unrepairable: true` with an explanation, not a 400 error.
   - Confirm `POST /incidents/:id/force-close` (with a mandatory `note`) succeeds only for this incident, and rejects with a 409 if attempted on any incident where a device exists in the affected subtree.

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

### 5. `resolved` Status Was Practically Unreachable (409 on every real attempt)
- **Symptom:** Clicking `Mark Resolved` returned a `409 Conflict` in every realistic test scenario, making the status impossible to demonstrate.
- **Root Cause:** The original transition guard rejected `resolved` while the affected pole was still dark. But the moment telemetry *did* confirm the pole live (via the simulator's Repair button), `verifyRecoveredIncidents` auto-promoted the ticket straight to `verified` in the same tick -- there was never a window in which the manual transition could legally succeed. The guard and the auto-verify logic were fighting each other.
- **Fix:** Removed the dark-check from the `resolved` transition entirely -- `resolved` now represents the crew's unconfirmed report and is always reachable from `crew_assigned`. It became a manual dead-end (no `resolved -> closed` path); only telemetry can advance a ticket past it, to `verified`.
- **Correct demo flow:** Assign Crew -> **Mark Resolved (now succeeds immediately, before repairing)** -> use the simulator's Repair button -> ticket auto-advances to `Verified` on its own -> operator manually clicks `Close Ticket`.

### 6. Simulator Repair Threw a 400 on Device-less Boundary Poles
- **Symptom:** `POST /sim/repair/:incidentId` returned `400 Bad Request: No device-equipped poles available to repair` for a valid, correctly-detected incident.
- **Root Cause:** ~9% of poles have no telemetry device (per spec). When a fault's entire affected subtree happens to be a single device-less leaf pole (the "range confidence" case), there is no device anywhere to send restoration telemetry from -- this is a legitimate incident, not an invalid request, but the endpoint treated it as an error.
- **Fix:** The repair endpoint now returns a clear, non-error response (`unrepairable: true` with an explanation) instead of a 400. A new administrative override, `POST /incidents/:id/force-close`, allows closing such incidents directly -- but only after the server independently re-verifies that no device exists anywhere in the affected subtree (never trusts the client's claim), and only for `range`-confidence incidents, with a mandatory note for the audit trail.

---

## 6. System Reset Instructions

To completely wipe the database and restart with fresh synthetic grid topology:

```bash
# Stop running containers and remove volumes
docker compose down -v

# Rebuild and start fresh
docker compose up --build
```