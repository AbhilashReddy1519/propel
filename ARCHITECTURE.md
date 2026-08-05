# System Architecture & Technical Specification

This document details the architectural design, graph localization algorithms, telemetry ingestion pipeline, noise handling, API specifications, UI design philosophy, and AI integration rationale for the Automated Grid Fault Localization System.

---

## 1. System Architecture Diagram

```
+-----------------------------------------------------------------------------------+
|                                 OPERATOR CONSOLE                                  |
|                             (Next.js 16 App Router)                               |
|                                                                                   |
|  +---------------------+   +---------------------+   +-------------------------+  |
|  | Header & Status Summary |   | GIS Leaflet Map     |   | Incident Detail Panel   |  |
|  | (10-sec Glanceability)|   | (DT Context & Pins) |   | (Legal Transition Guards)|  |
|  +---------------------+   +---------------------+   +-------------------------+  |
|                                 |                                                 |
|  +-----------------------------------------------------------------------------+  |
|  | 🧪 Simulator Controls (Visually Isolated Fault & Noise Injector Panel)      |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
                                         |
                                         | HTTP REST API (Port 3000)
                                         v
+-----------------------------------------------------------------------------------+
|                                 BACKEND ENGINE                                    |
|                              (Node.js + Express)                                  |
|                                                                                   |
|  +---------------------+   +---------------------+   +-------------------------+  |
|  | REST Controllers    |   | Ingestion Worker    |   | Heartbeat Timeout Job   |  |
|  | (Incidents, Sim, DT)|   | (Sequence Order)    |   | (30-60s Silent Fleet)   |  |
|  +---------------------+   +---------------------+   +-------------------------+  |
|            |                          |                           |               |
|            v                          v                           v               |
|  +-----------------------------------------------------------------------------+  |
|  | Graph Localization Engine (Frontier Walk, Edge Deduplication, Noise Filter) |  |
|  +-----------------------------------------------------------------------------+  |
|            |                                                      |               |
|            v                                                      v               |
|  +---------------------+                                +-------------------+     |
|  | Groq API (Llama 3.3) |                                | PostgreSQL DB     |     |
|  | (Briefing Phrasing) |                                | (Drizzle ORM)     |     |
|  +---------------------+                                +-------------------+     |
+-----------------------------------------------------------------------------------+
```

---

## 2. Telemetry Ingestion Pipeline

High-frequency sensor telemetry arrives from Distribution Transformers (DTs) and power poles across the network. Raw telemetry processing is decoupled into a fast ingest and an asynchronous processing queue to prevent API blocking.

```
Device Telemetry ---> POST /api/v1/telemetry ---> telemetry_raw Table ---> Ingestion Worker ---> Pole State Update ---> Localization Engine
```

### Key Ingestion Rules:
1. **Sequence Number Ordering (`seq` vs `ts`):** Field telemetry clocks can drift by up to ±90 seconds. To prevent out-of-order state corruption, the ingestion worker sorts messages per device by sequence number (`seq`) rather than local event timestamp (`ts`).
2. **Boot Sequence Reset:** When a device sends a `boot` event, its sequence baseline is reset, allowing post-restart sequence counters to start cleanly.
3. **Heartbeat Timeout Monitoring:** Firmware 1.2 devices (~8% of the fleet) do not transmit explicit `power_lost` frames upon failure; they simply fall silent. A background worker periodically scans for devices whose `expectedNextHeartbeatAt` has elapsed beyond a grace window and automatically marks their state as `dark` / `unknown`.

---

## 3. Grid Topology & Missing Data Handling (The 60% Case)

The distribution grid under a Distribution Transformer (DT) is modeled as a directed acyclic graph (tree), where:
- Root = Distribution Transformer (DT)
- Nodes = Power Poles
- Edges = Overhead Spans / Lines

```
[ Distribution Transformer (DT-01) ]
                 |
                 v
            [ Pole P-1 ] (Device)
           /            \
          v              v
   [ Pole P-2 ]       [ Pole P-3 ] (No Device)
     (Device)            /        \
                        v          v
                 [ Pole P-4 ]   [ Pole P-5 ]
                   (Device)       (Device)
```

### Missing Topology Inference (Prim's MST Algorithm):
In real utility grids, ~60% of transformers lack explicit GIS parent-child pole mapping. When true topology is missing, the system automatically constructs a plausible tree using a modified **Prim's Minimum Spanning Tree (MST)** algorithm:
1. Root the tree at the DT's physical coordinates `(lat, lon)`.
2. Iteratively connect the closest unattached pole using Euclidean distance.
3. Apply a branching penalty heuristic to favor main trunk lines over unrealistic star topologies.

### Confidence Channel Mapping:
Confidence is explicitly separated from incident status to prevent visual confusion:
- **`high` (Known Topology):** Full GIS parent-child tree mapping available, boundary pole contains a working device (`●`).
- **`inferred` (Inferred Topology):** Tree structure generated via Prim's MST algorithm, boundary pole contains a working device (`▲`).
- **`range` (Boundary Range Estimate):** Boundary pole has no attached device, establishing a line range between the nearest upstream live pole and downstream dark pole (`◇`).

---

## 4. Localization Algorithm Specification

The graph localization algorithm operates deterministically in \(O(N)\) time per DT (where \(N \le 240\) poles per DT).

### Core Steps to Reimplement:

```ts
function findFrontiers(poles: PoleNode[], topologyConfidence: 'known' | 'inferred'): FrontierEdge[] {
  // 1. Index tree: build id -> node map and parentId -> children[] map
  const { byId, childrenOf } = indexTree(poles);
  const seenEdges = new Set<string>();
  const frontiers: FrontierEdge[] = [];

  // 2. Identify all leaf poles (poles with no children)
  const leaves = poles.filter((p) => (childrenOf.get(p.id) ?? []).length === 0);

  // 3. Upward walk from every leaf
  for (const leaf of leaves) {
    let cur = leaf;
    while (cur) {
      if (cur.state === 'live') break; // Live node; path above is healthy

      const parent = cur.parentId ? byId.get(cur.parentId) : undefined;
      const parentIsLiveOrRoot = !cur.parentId || parent?.state === 'live';

      if (parentIsLiveOrRoot) {
        // Impossible Fault Check: Dark pole with a live descendant is a SENSOR failure, not a line break
        if (hasLiveDescendant(cur.id, childrenOf, byId)) {
          break; // Filter out bad sensor
        }

        // Deduplicate by Edge: ${parentId}->${childId}
        const edgeKey = `${cur.parentId ?? 'ROOT'}->${cur.id}`;
        if (!seenEdges.has(edgeKey)) {
          seenEdges.add(edgeKey);
          const affected = collectDarkSubtree(cur.id, childrenOf, byId);

          frontiers.push({
            parentPoleId: cur.parentId,
            childPoleId: cur.id,
            affectedPoleIds: affected,
            confidenceHint: !cur.hasDevice ? 'range' : topologyConfidence === 'known' ? 'high' : 'inferred',
            reasoning: cur.parentId
              ? `Live at ${cur.parentId}, dark at ${cur.id} (${topologyConfidence} topology)`
              : `Entire DT subtree dark from root -- likely DT/fuse fault`,
          });
        }
        break;
      }
      cur = parent; // Keep walking upward
    }
  }
  return frontiers;
}
```

---

## 5. Noise & Outage Suppression

1. **Impossible Fault Suppression:** A dark pole with at least one live downstream descendant is flagged as a sensor failure, preventing false ticket generation.
2. **Debouncing Window:** Ticket generation is debounced for 30–60 seconds following the first dark signal in a DT subtree, grouping simultaneous telemetry bursts into a single ticket.
3. **Scheduled Outage Suppression:** Before declaring an active incident, the system cross-references active grid maintenance windows (`/scheduled-outages`). Overlapping faults are flagged as `suppressedBySchedule = true`, muting control-room alarms while keeping the incident visible.

---

## 6. Complete Backend API Contract

All endpoints reside under `/api/v1`.

| Method | Endpoint | Purpose | Request Body / Query | Response |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/incidents?open=true` | List active grid incidents | `open=true` | `IncidentRow[]` |
| `GET` | `/incidents/:id` | Get incident details | None | `IncidentRow` |
| `POST` | `/incidents/:id/transition` | Transition ticket lifecycle | `{ status, actor, note? }` | Updated `IncidentRow` |
| `POST` | `/incidents/:id/force-close` | Administrative override: close an incident with no telemetry-confirmable device in its affected subtree (`range` confidence only, note mandatory) | `{ actor, note }` | Updated `IncidentRow` |
| `GET` | `/network/dts` | List DT network summaries | None | `DtSummary[]` |
| `GET` | `/network/dts/:dtId/poles` | List poles under a DT | None | `PoleSummary[]` |
| `POST` | `/sim/inject-fault` | Inject span/dt/feeder fault | `{ type, dtId, targetId? }` | `{ success, description, ... }` |
| `POST` | `/sim/inject-noise` | Inject sensor/outage noise | `{ dtId, noiseType? }` | `{ success, message }` |
| `POST` | `/sim/repair/:incidentId` | Simulate physical repair | `{ actor, note? }` | `{ success, repairedDeviceCount }` |
| `GET` | `/scheduled-outages` | List maintenance windows | `from`, `to` (optional) | `{ success, outages: [] }` |

---

## 7. Control Room UI & Operator Design Philosophy

1. **The 2 a.m. 10-Second Glanceability Rule:** A tired operator with zero training must glance at the screen and immediately ascertain:
   - How many real incidents exist (large bold counter in header).
   - Exact breakdown by status (`2 detected · 1 crew assigned`).
   - Visual locations on the GIS map.
2. **6 Distinct Status Colors:**
   - `detected`: Bright Red (`#ff4d5e`) — Needs immediate inspection.
   - `acknowledged`: Amber-Orange (`#ffb84d`) — Seen by operator.
   - `crew_assigned`: Blue (`#66b5ff`) — Dispatch in progress.
   - `resolved`: Yellow (`#ffe59a`) — Pending telemetry confirmation.
   - `verified`: Green (`#b3f4d2`) — Telemetry confirmed fixed.
   - `closed`: Muted Green (`#b3f4d2`) — Ticket closed.
   - `muted`: Grey (`#8ba6c8`, 0.6 opacity) — Scheduled outage.
3. **Visually Isolated Simulator Panel (`🧪 Simulator`):**
   - Housed in a distinct diagonal-striped container with a warm amber border (`#6b4a1a`).
   - Explicitly labeled `🧪 Simulator — test controls, not real operations` to prevent accidental execution during live grid management.

---

## 8. AI Feature Justification & Architecture

### Feature: Plain-Language Ticket Briefing Header
The Groq API (`llama-3.3-70b-versatile`) generates a concise, one-sentence plain-language briefing (e.g., *"Power loss detected across 20 poles downstream of Transformer D-0204 near PIN 560079"*).

```
Structured Incident Data ---> Groq API (Llama 3.3) ---> Plain-Language Briefing ("✦ AI")
                                    |
                            (Timeout / Error)
                                    v
                           Deterministic Template ("⚙ Template")
```

### Why AI Is Used ONLY for Briefing Phrasing:
- **Fault Localization MUST NOT use an LLM:** Graph frontier walking requires 100% deterministic mathematical accuracy, zero execution cost, sub-millisecond speed, and 100% auditability. An LLM is probabilistic, slow, expensive, and subject to hallucinations.
- **Template Fallback Guarantee:** If the Groq API is unreachable, times out, or lacks an API key, the system seamlessly falls back to a deterministic string template (`briefingSource: 'template'`), ensuring zero service disruption.
- **Provider swap note:** this feature originally targeted the Anthropic API; it was switched to Groq (OpenAI-compatible endpoint, `llama-3.3-70b-versatile`) because Anthropic does not offer a free API tier and this project has no budget for paid API usage. The abstraction (`generateBriefing()` returning `{ text, source }`) made this a same-day swap with no changes required anywhere else in the codebase -- worth noting as a concrete case of the "AI is a phrasing layer, not core logic" decision paying off: swapping providers touched one file.