# PRD — 07-14 Remaining Work Closeout (AI Parity + Verification)

Status: Executed (2026-01-27). This PRD captures ONLY the unfinished items we still want from legacy PRDs 07–14.
Source of truth: `documentation/` for architecture; this doc is the execution-ready delta list.

---

## 0) Summary (what this is)
Legacy PRDs 07–14 are now archived. This document is the single, small, execution-ready list of **remaining work** we still want, aligned with current architecture and tenets (deterministic, scalable, fail-closed, no drift).

---

## 1) Goals (must ship)
1) **AI policy parity** so all AI executions (including system jobs like l10n) use the policy-driven router.
2) **Budget enforcement parity** in San Francisco across all AI paths (`maxTokens`, `timeoutMs`, `maxCostUsd`, `maxRequests`).
3) **Verification closeout** to confirm the executed architecture is correct and stable (local + cloud-dev checks).

---

## 2) Non-goals
- Re-litigating architecture already documented in `documentation/`.
- New product surfaces (billing UI, comments, new copilots).
- Any manifest-based localization paths or legacy pipelines.

---

## 3) Remaining Work (the only items we still want)

### 3.1 AI policy parity (from PRD 11 intent)
**Why:** We still have at least one important bypass: l10n jobs are dispatched without a policy capsule and the l10n agent can call providers directly. This breaks the "policy router is authoritative" invariant and creates drift risk.

**Required behaviors**
- All AI executions (including **l10nInstance**) go through the policy-driven router.
- Paris attaches a **policy capsule (or equivalent service-grant reference)** to l10n jobs at enqueue time.
- San Francisco validates the capsule/grant before any provider selection.
- Provider choice is policy-driven (no agent-level overrides).

**Deliverables**
- Extend the l10n job contract to include policy context minted by Paris.
- Route l10nInstance through the same grant/policy capsule path as other agents (or define a single explicit service-grant path with the same constraints).
- Document the l10n AI policy contract in `documentation/services/sanfrancisco.md` (and update any affected AI infrastructure docs).

---

### 3.2 Budget enforcement parity (new; required to make policy real)
**Why:** Grant budgets include cost and request limits, but San Francisco currently enforces only tokens and timeout. That is an incomplete contract.

**Required behaviors**
- San Francisco enforces `maxCostUsd` and `maxRequests` in addition to `maxTokens` and `timeoutMs`.
- Cost is computed from normalized provider usage plus a single price table config.
- Enforcement is fail-closed when usage or pricing is missing/unknown.
- l10nInstance respects the same budget enforcement path as other AI tasks.

**Deliverables**
- Implement `maxCostUsd` and `maxRequests` checks in San Francisco grant enforcement.
- Add/confirm a single, explicit pricing configuration surface used by enforcement.
- Add targeted tests for over-budget denial paths.

---

### 3.3 Verification closeout (from PRD 15 Phase 5 intent)
**Why:** We already shipped architecture; now we need confidence and drift control.

**Required behaviors**
- Run compile gate and correctness checks.
- Verify cloud-dev behavior for curated publish, Venice overlay resolution, and Prague personalization preview.
- Ensure docs reflect runtime truth (no manifest references).

**Deliverables**
- Run: `node scripts/compile-all-widgets.mjs`
- Run: `pnpm lint && pnpm typecheck && pnpm test` (or targeted per-app as needed).
- Verify cloud-dev flows with a minimal smoke checklist.
- Update `documentation/` where any drift is discovered.

---

## 4) Acceptance criteria
1) l10nInstance no longer calls providers directly and runs through a policy capsule/grant path minted by Paris.
2) San Francisco enforces all grant budgets: `maxTokens`, `timeoutMs`, `maxCostUsd`, and `maxRequests`.
3) Verification checklist passes (local + cloud-dev), with docs aligned.

---

## 5) Execution notes
- This PRD is intentionally small; everything else from 07–14 is archived.
- Policy seat caps and other new entitlement keys are out of scope here unless they exist in `config/entitlements.matrix.json`.
- If a new item emerges, it must be added here (not resurrected from old PRDs).

---

## 6) Closeout notes (2026-01-27)
- Cloud-dev l10n materialization parity was verified for:
  - `wgt_curated_faq.lightblurs.v01` (14/14 locales succeeded; Tokyo index 200)
  - `wgt_main_faq` (14/14 locales succeeded; Tokyo index 200)
- Paris l10n queue resilience and grant TTL were hardened to prevent drift under backlog:
  - Stale queued/running l10n states (10+ minutes) now requeue on next update/promote.
  - AI grant TTL for l10n jobs increased to 10 minutes.
- Documentation was aligned with runtime truth in `documentation/services/paris.md`.
