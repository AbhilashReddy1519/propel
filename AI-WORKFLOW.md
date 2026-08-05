# AI Workflow, Tooling & Engineering Collaboration

This document outlines the AI tools utilized during development, the delegation split between AI generation and human architectural direction, concrete failure cases encountered, and code generation estimates.

---

## 1. AI Tooling Stack

- **Primary AI Coding Assistant:** Google Antigravity (AGY) Agentic AI Assistant
- **Underlying LLM Models:** Anthropic Claude 3.5 Sonnet / Google Gemini (verify the exact Gemini version string here before submission -- "3.6 Flash" as originally written doesn't match a Google model naming pattern either of us could confirm; check Antigravity's own settings/docs for the actual model identifier rather than leaving an unverified guess in a submitted document)
- **IDE Environment:** VS Code with Antigravity Extension & CLI Tooling

---

## 2. Delegation Split: Hand-Written vs. AI-Generated

### Human Architectural Direction & System Design (~20-25%):
- **Graph Localization Logic:** Formulated the leaf-to-root frontier walk algorithm, edge deduplication keying (`${parentId}->${childId}`), and the impossible fault rule (`hasLiveDescendant`).
- **State Machine Guard Rules:** Defined strict lifecycle rules prohibiting manual ticket closure without telemetry verification (`resolved` → `verified` → `closed`).
- **Database Schema Architecture:** Designed tree self-referencing models (`parentId`) and raw telemetry ingestion buffer models in Drizzle ORM.
- **Prompt Engineering & System Constraints:** Enforced zero-external-binary constraints (Drizzle over Prisma), system font usage over external build-time dependencies, and visually isolated test panel styling (`🧪 Simulator`).

### AI Delegated Generation (~75-80%):
- **React UI Component Scaffolding:** Generated `Header`, `IncidentList`, `IncidentListItem`, `IncidentDetail`, `ConfidenceBadge`, `StatusTimeline`, `TransitionActions`, `SimulatorPanel`, `FaultInjectorForm`, `NoiseInjectorForm`, and `RepairButton`.
- **CSS Token System & Layouts:** Built `src/styles/tokens.css`, status pill styling, dark navy gradients, and custom Leaflet popup CSS.
- **Express REST API Controllers & Routes:** Generated boilerplate endpoint handlers, Zod schema validations, and mock data generators.
- **TypeScript Interface Definitions:** Created `src/types/api.ts` covering all backend payload contracts.

---

## 3. Concrete AI Failure Cases & Resolution Log

### Case 1: Vite vs. Next.js App Router Architecture Mismatch
- **What the AI Got Wrong:** Initial prompt templates assumed a Vite frontend scaffold (`src/App.tsx`, `import.meta.env.VITE_API_BASE`). The AI attempted to generate Vite-specific environment variables and imports.
- **How It Was Caught:** Inspected the actual repository directory structure, finding `app/page.tsx`, `next.config.ts`, and `package.json` configured for Next.js 16 App Router.
- **How It Was Fixed:** Redirected the AI to follow Next.js App Router conventions: created `NEXT_PUBLIC_API_BASE`, used `app/page.tsx` as entry point, and wrapped Leaflet map components inside `next/dynamic` with `{ ssr: false }`.

---

### Case 2: Shared Component State Error Bleeding Across Incidents
- **What the AI Got Wrong:** The AI placed `conflictError` local state inside `TransitionActions.tsx`. When an operator selected Incident A and triggered a `409 Conflict` (e.g., resolving a dark pole), `conflictError` was set. When the operator clicked Incident B, React reused the component instance, displaying Incident A's 409 error banner on Incident B.
- **How It Was Caught:** Manual UI testing with multiple active incidents revealed that an error triggered on one incident rendered on every subsequent incident clicked.
- **How It Was Fixed:**
  1. Passed `key={incident.id}` to `<TransitionActions />` in `IncidentDetail.tsx` so React remounts a fresh component instance when selection changes.
  2. Added a `useEffect` hook in `TransitionActions.tsx` listening to `incident.id` to reset `conflictError` and `submittingStatus` to `null`.

---

### Case 3: Build-Time External Network Fetch Failure (`next/font/google`)
- **What the AI Got Wrong:** The AI included `next/font/google` font loaders (`Geist`, `Geist_Mono`) in `client/app/layout.tsx`.
- **How It Was Caught:** Executing `next build` inside a network-restricted container threw an unhandled build exception trying to download font binaries from `fonts.googleapis.com`.
- **How It Was Fixed:** Removed `next/font/google` imports from `layout.tsx` and configured a system font stack (`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`) in `globals.css`.

---

### Case 4: `resolved` Transition Guard Contradicted the Auto-Verify Logic
- **What Went Wrong:** An early implementation of the ticket state machine rejected the `resolved` transition with a 409 whenever the affected pole was still dark. This seemed correct in isolation ("don't let a crew mark something fixed if it visibly isn't"), but it interacted badly with the separate telemetry auto-verify logic: the instant a pole *did* come back live, the system jumped straight to `verified` in the same tick, before a human could possibly click `Mark Resolved` first. The net effect: `resolved` was reachable in theory but unreachable in every real test.
- **How It Was Caught:** Manually clicking through the full ticket lifecycle in the actual UI (Acknowledge -> Assign Crew -> Mark Resolved) and hitting a 409 every single time, regardless of pole state -- this was not a corner case, it failed on every attempt.
- **How It Was Fixed:** Removed the dark-check from `resolved` entirely. `resolved` now represents the crew's own unconfirmed report and must be reachable regardless of current telemetry -- that asymmetry (enterable anytime, but a manual dead-end once entered) is the actual design intent. Also removed a previously-allowed `resolved -> closed` manual path that would have let an operator bypass telemetry confirmation entirely.

---

### Case 5: Anthropic API Has No Free Tier -- Provider Swap to Groq
- **What Happened:** The AI briefing feature was originally built against the Anthropic API. During testing, this proved impractical -- Anthropic does not offer a free tier, and this project has no budget for paid API calls.
- **How It Was Handled:** Swapped the implementation to Groq's OpenAI-compatible endpoint (`llama-3.3-70b-versatile`, free tier available). Because the AI call was already isolated behind a single `generateBriefing()` function returning `{ text, source }`, the swap required changing exactly one file (`briefingService.ts`) -- no changes to the incident service, the schema, or any UI component. This is presented here as a concrete payoff of the "AI is a thin phrasing layer, not embedded logic" decision (see `DECISIONS.md`), not just a workflow footnote.

---

## 4. Code Generation Estimates

| Category | % AI Generated | % Human Directed / Refactored | Notes |
| :--- | :---: | :---: | :--- |
| **Graph Localization Algorithm** | 40% | 60% | Logic & frontier edge rules defined by human; implementation scaffolded by AI. |
| **React UI & Component Tree** | 90% | 10% | Fully generated by AI based on CSS token & component specifications. |
| **Express Controllers & Routes** | 85% | 15% | Boilerplate generated by AI; error handling & status codes refined by human. |
| **Database Schemas & Migrations** | 80% | 20% | Drizzle schema generated by AI; relations & keys reviewed by human. |
| **Documentation & Runbooks** | 75% | 25% | Documentation structure & content generated by AI based on codebase audit. |