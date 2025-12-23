# ADRdecisions.md (Phase-1 Reset)

STATUS: INFORMATIVE  
This file intentionally starts empty following the Phase-1 reboot.  
All prior ADRs are considered superseded; add new decisions here as they are ratified.

No active architectural decisions recorded yet.

## 2025-02-10 — Dieter Lab Component Contracts Blocked
- **Context:** Lab `newcomponentsSept25.md` requires completing the backlog of components (Container → Pulsar) with Dieter-compliant CSS contracts, demos, docs, and tests.
- **Observation:** `documentation/systems/Dieter.md` (frozen v1) only defines Button and Segmented Control contracts. No normative guidance or tokens exist for other components.
- **Decision:** Halt CSS authoring for the remaining lab components until Dieter PRD is updated. Proceeding would violate the "no guessing" rule and risk divergence from Phase-1 specs.
- **Next steps:** Await updated Dieter documentation or explicit CEO approval defining each component's contract/tokens before resuming Steps 2–7 in the lab workflow.
## 2025-10-05 — Template Switch Dry‑Run/Confirm in Paris
- Decision: Introduce non‑destructive template switch flow with dry‑run preview and explicit confirm to persist transformed config. Aligns with Bob’s NON_CARRYABLE guard; prevents accidental data loss.
- Impact: PUT /api/instance supports `?dryRun=true` (preview diff) and `?confirm=true` (apply). Geneva transform order is documented (drop unknowns → apply defaults → validate).

## 2025-10-05 — Optional Redis Rate Limiting with Circuit Breaker
- Decision: Add Redis‑backed counters for submissions/usage with automatic circuit breaker to SQL fallback and backend visibility header.
- Impact: X‑RateLimit‑Backend header added; envs `RATE_LIMIT_REDIS_URL`, `RATE_LIMIT_REDIS_PREFIX`, breaker tuning vars. No schema change; SQL path remains default.

## 2025-10-05 — Venice Loader Event Bus Parity + SSR Budget Check
- Decision: Loader bus emits `ready`, `open`, `close` and buffers until ready. Add report‑only SSR budget script for forms.contact to verify preferred ≤80KB gzipped (never above 200KB gzipped) initial render before release.
- Impact: Developer ergonomics and release quality improve without adding CI gates in Phase‑1.

## 2025-10-06 — Naming Alignment: Loader Bus + Bob Env Var
- Decision: Canonical loader event bus global is `window.ckeenBus`. A backward‑compatible alias `window.Clickeen` is exposed by the loader for existing snippets. Bob’s canonical env var for loading Dieter/widget assets is `NEXT_PUBLIC_DENVER_URL`.
- Impact: Reduces naming drift. New integrations and docs must use `window.ckeenBus` and `NEXT_PUBLIC_DENVER_URL` (Bob).
