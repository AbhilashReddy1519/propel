# Architectural Decision Log & Roadmap

This document records the chronological log of engineering decisions, technical trade-offs, system fragilities, and the future development roadmap.

---

## 1. Newest-First Decision Log

### [2026-08-04] Telemetry-Only Ticket Closure Guard (`resolved` → `verified`)
- **Context:** Control-room operators frequently close tickets based on crew verbal reports ("I fixed it"), leaving un-repaired dark spans active when repairs were incomplete.
- **Decision:** Remove the manual `closed` action from `resolved` status. Once a crew marks a ticket `resolved`, it enters a `Resolved (pending telemetry)` state. The system requires physical telemetry (`power_restored` / `boot` events) to auto-verify and advance the ticket to `verified` → `closed`.
- **Trade-Off:** Crews cannot forcibly close tickets without physical sensor verification. If a sensor hardware module is destroyed, the operator must trigger a simulated telemetry restoration or replace the physical sensor.

---

### [2026-08-04] AI Placement: Phrasing Header Only + Strict Template Fallback
- **Context:** Incorporating AI into grid operations carries hallucination risks if used for core fault localization.
- **Decision:** Restrict LLM usage (Anthropic Claude API) strictly to generating a plain-language header summary (`briefing`). Core localization remains 100% deterministic (graph frontier walking). Implemented a zero-latency string template fallback (`briefingSource: 'template'`) if the AI API times out, fails, or lacks an API key.
- **Trade-Off:** Keeps AI out of critical control paths while providing readable ticket summaries for non-technical dispatchers.

---

### [2026-08-04] Next.js 16 App Router & Dynamic Leaflet Rendering
- **Context:** Leaflet GIS map requires browser `window` and `document` objects, which break during Next.js Server-Side Rendering (SSR).
- **Decision:** Wrap `NetworkMapInner` inside `next/dynamic` with `{ ssr: false }`. Render background DT context dots (`#3a4d6b`, radius 4px) underneath active incident markers to display overall network topology.
- **Trade-Off:** Map component renders on the client side after hydration, requiring a brief loading fallback spinner.

---

### [2026-08-03] Sequence Number (`seq`) Telemetry Ordering over Timestamp (`ts`)
- **Context:** Pole telemetry devices exhibit clock drift up to ±90 seconds, leading to out-of-order event processing if ordered by timestamp.
- **Decision:** Ingestion worker sorts telemetry payloads per device by sequence number (`seq`), resetting baselines only upon explicit `boot` events.
- **Trade-Off:** Requires maintaining per-device sequence state in PostgreSQL.

---

### [2026-08-03] Drizzle ORM over Prisma
- **Context:** Prisma requires downloading external binary query engines (`query-engine-node-api`) during `npx prisma generate` / build steps, causing network failure risks in Docker/CI environments.
- **Decision:** Selected Drizzle ORM (`drizzle-orm` + `drizzle-kit`).
- **Trade-Off:** Drizzle requires writing explicit SQL-like queries, but provides a zero-external-binary build pipeline and lower memory footprint.

---

### [2026-08-03] PostgreSQL Polling Queue over Redis / RabbitMQ
- **Context:** Introducing Redis, RabbitMQ, or Kafka increases deployment friction and system complexity for containerized setup.
- **Decision:** Use PostgreSQL raw buffer tables (`telemetry_raw`) polled by a background interval worker.
- **Trade-Off:** Max telemetry throughput is bounded by Postgres write lock performance, but deployment requires zero external queue dependencies.

---

## 2. What We Would Do With Two More Weeks

1. **Server-Sent Events (SSE) / WebSockets:**
   - Replace the 4.5-second HTTP polling loop with an SSE or WebSocket push stream for instant sub-second incident updates and map marker animations.
2. **Audit Event Log API (`GET /incidents/:id/events`):**
   - Expose the existing backend audit log table via a dedicated REST endpoint and build an interactive timeline component in the UI displaying exact operator names, notes, and timestamped state transitions.
3. **Crew Dispatch & GPS GIS Routing:**
   - Render real-time crew truck locations on the Leaflet map and compute shortest-path routing along feeder lines to the frontier pole range.
4. **Multi-Substation & Multi-Tenant Support:**
   - Partition network topology by regional substations with role-based access control (RBAC) for regional utility control rooms.

---

## 3. What Is Currently Fragile / Known Limitations

1. **High-Cardinality Polling:**
   - The 4.5-second polling interval works seamlessly for control-room usage (<50 concurrent operators), but scaling to 10,000+ simultaneous browser sessions would cause database read load without a WebSocket pub/sub layer.
2. **Geographic MST Topology Assumptions:**
   - Prim's MST algorithm assumes grid poles connect to their nearest geographic neighbor. In dense urban environments with underground crossovers or multi-circuit lines, geographic proximity does not always match electrical connectivity.
3. **Sequence Counter Wraparound:**
   - Legacy 16-bit sensor devices wrap sequence counters from `65535` to `0`. The current worker expects monotonic integer increases; counter wraparounds without a `boot` event require manual sequence baseline resets.
