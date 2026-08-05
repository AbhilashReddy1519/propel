# Architectural Decision Log & Roadmap

This document records the chronological log of engineering decisions, technical trade-offs, system fragilities, and the future development roadmap.

---

## 1. Newest-First Decision Log

### [2026-08-04] Force-Close Override for Device-less (Range Confidence) Incidents
- **Context:** ~9% of poles have no telemetry device. When a fault's entire affected subtree is such a pole (a leaf with no device, no children), there is no device anywhere to ever send `power_restored` -- the incident can never telemetry-verify, and would sit in `resolved` permanently under the normal lifecycle.
- **Decision:** Added `POST /incidents/:id/force-close`, a narrowly-scoped administrative override. It requires a mandatory note (stricter audit trail than the normal transition), and the server independently re-derives the affected subtree and re-checks for any device before allowing it -- a client claiming "no device" is never trusted on its own. Rejected with a 409 if any device exists in the subtree (telemetry confirmation should be used instead).
- **Trade-Off:** This is a deliberate, principled exception to "never closed by a button alone," not a general loophole -- it only exists because telemetry confirmation is structurally impossible for this specific case, not merely unconfirmed.

### [2026-08-04] `resolved` Guard Removed -- It Was Practically Unreachable
- **Context:** The original transition guard rejected `resolved` while the affected pole was still dark. But telemetry confirming restoration and the auto-verify logic (`verifyRecoveredIncidents`) both fire in the same tick -- there was never a window where a human could click `Mark Resolved` before the ticket had already jumped to `verified`. Every real attempt to reach `resolved` returned a 409.
- **Decision:** `resolved` is now unconditional -- it represents the crew's own unconfirmed report ("I believe I fixed it") and must be enterable regardless of what telemetry currently shows, which is the entire point of having a state distinct from `verified`. It also became a manual dead-end: no `resolved -> closed` path exists anymore, only `verified -> closed`. This closes a related gap the original design allowed: an operator could previously close a ticket straight from `resolved` without telemetry ever confirming the fix.
- **Trade-Off:** None identified -- this is a strict correctness fix, not a scope trade-off.

### [2026-08-04] Telemetry-Only Ticket Closure Guard (`resolved` → `verified`)
- **Context:** Control-room operators frequently close tickets based on crew verbal reports ("I fixed it"), leaving un-repaired dark spans active when repairs were incomplete.
- **Decision:** Remove the manual `closed` action from `resolved` status. Once a crew marks a ticket `resolved`, it enters a `Resolved (pending telemetry)` state. The system requires physical telemetry (`power_restored` / `boot` events) to auto-verify and advance the ticket to `verified` → `closed`.
- **Trade-Off:** Crews cannot forcibly close tickets without physical sensor verification. If a sensor hardware module is destroyed, the operator must trigger a simulated telemetry restoration or replace the physical sensor.

---

### [2026-08-04] AI Placement: Phrasing Header Only + Strict Template Fallback
- **Context:** Incorporating AI into grid operations carries hallucination risks if used for core fault localization.
- **Decision:** Restrict LLM usage strictly to generating a plain-language header summary (`briefing`). Core localization remains 100% deterministic (graph frontier walking). Implemented a zero-latency string template fallback (`briefingSource: 'template'`) if the AI API times out, fails, or lacks an API key.
- **Trade-Off:** Keeps AI out of critical control paths while providing readable ticket summaries for non-technical dispatchers.
- **Provider note (2026-08-04, later):** Originally implemented against the Anthropic API. Switched to Groq (`llama-3.3-70b-versatile`, OpenAI-compatible endpoint) because Anthropic does not provide a free tier and this project has no API budget. Because the AI call is fully abstracted behind `generateBriefing()` returning `{ text, source }`, the swap touched exactly one file and required no changes anywhere else -- a direct payoff of keeping the AI boundary narrow.

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

1. **Detection Latency for Silent-Firmware Devices (up to ~15 minutes, not the 2-minute target):**
   - When a boundary pole successfully sends `power_lost` but its downstream children are among the ~8% of the fleet on firmware that never attempts a `power_lost` message (or among the ~30% of individual send attempts that simply fail), those specific children only get marked `dark` via heartbeat timeout -- which can take up to the full ~15-minute heartbeat interval if the fault happens shortly after their last heartbeat. Until then, `hasLiveDescendant` reads their last-known state, which could stall correct frontier detection at that boundary. Partially mitigated: a pole is treated as `unknown` (not stale `live`) the instant its heartbeat becomes overdue, rather than waiting for the separate heartbeat worker's next sweep -- but this cannot shrink the underlying ~15-minute physical bound for a device whose heartbeat window hasn't expired yet. This is a bounded, understood limitation of the system as specified, not a bug -- most of a fault's subtree self-reports within seconds via each device's own independent capacitor-backed send, so this tail case affects a minority of poles per fault, not the median detection time.
2. **High-Cardinality Polling:**
   - The 4.5-second polling interval works seamlessly for control-room usage (<50 concurrent operators), but scaling to 10,000+ simultaneous browser sessions would cause database read load without a WebSocket pub/sub layer.
3. **Geographic MST Topology Assumptions:**
   - Prim's MST algorithm assumes grid poles connect to their nearest geographic neighbor. In dense urban environments with underground crossovers or multi-circuit lines, geographic proximity does not always match electrical connectivity.
4. **Sequence Counter Wraparound:**
   - Legacy 16-bit sensor devices wrap sequence counters from `65535` to `0`. The current worker expects monotonic integer increases; counter wraparounds without a `boot` event require manual sequence baseline resets.