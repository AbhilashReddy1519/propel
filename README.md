# Operator Console — Automated Grid Fault Localization & Telemetry System

A control-room operator console and backend automated fault localization engine for electrical distribution grids. The system processes high-frequency sensor telemetry across Distribution Transformers (DTs) and power poles, identifies real grid faults versus sensor noise, localizes line breaks using graph frontier walking, and presents glanceable ticket lifecycle controls for 2 a.m. control-room operators.

---

## 🚀 One-Command Quickstart

Get the entire stack (PostgreSQL database, Node.js Express backend API, Next.js operator frontend) running locally with Docker Compose:

```bash
docker compose up --build
```

- **Operator Console UI:** [http://localhost:5000](http://localhost:5000)
- **Backend API Base:** [http://localhost:3000/api/v1](http://localhost:3000/api/v1)

*Note: Prerequisites require Docker & Docker Compose installed.*

---

## ⚡ What It Does

1. **Automated Fault Localization:** Reconstructs electrical grid distribution trees, walking live-to-dark frontier boundaries to pin line breaks down to a single span or Distribution Transformer (DT).
2. **Missing Topology Reconstruction (60% Case):** Geometrically infers missing feeder-pole graph structures using Minimum Spanning Tree (MST) algorithms rooted at the DT.
3. **Noise & False-Positive Suppression:** Filters out impossible faults (dark sensor with a live downstream child) and silences alerts matching scheduled maintenance outage windows.
4. **Telemetry-Gated Ticket Lifecycle:** Enforces real-world operator transitions (`detected` → `acknowledged` → `crew_assigned` → `resolved`). Tickets cannot be manually closed; they auto-verify to `verified` → `closed` only when physical telemetry reports restoration.
5. **AI-Powered Ticket Briefings:** Generates human-readable, plain-language incident summary headers via the Groq API (Llama 3.3 70B), with an automatic template fallback if the AI service is unavailable.
6. **Glanceable Control Room UI:** Built for zero-training operation at 2 a.m., featuring a 10-second glanceable status summary, synchronized GIS Leaflet map, background network context, and a visually isolated simulator panel for testing.

---

## 🌐 Public URL & Demo

- **Live Application URL:** `https://propel-reddy22.vercel.app`
- **Interactive Demo Walkthrough:** `https://drive.google.com/file/d/1CNee55NFAc6bC8qU8t8P3XnSfkfQDUCW/view?usp=sharing`

---

## 🗺️ Documentation Map

To evaluate, understand, or extend this repository, refer to the dedicated documentation files:

| File | Description |
| :--- | :--- |
| [**`ARCHITECTURE.md`**](./ARCHITECTURE.md) | Complete system architecture diagram, graph localization algorithm, 60% missing topology MST design, noise handling, API table, and AI feature justification. |
| [**`DEPLOYMENT.md`**](./DEPLOYMENT.md) | Local and production deployment guide, environment variable documentation, verification procedures, and real-world troubleshooting notes. |
| [**`DECISIONS.md`**](./DECISIONS.md) | Chronological log of engineering decisions, technical trade-offs, system vulnerabilities/fragilities, and future roadmap. |
| [**`AI-WORKFLOW.md`**](./AI-WORKFLOW.md) | Engineering workflow details, tools used, AI vs. hand-written code estimates, and 3 concrete cases where AI code failed and how it was diagnosed/fixed. |