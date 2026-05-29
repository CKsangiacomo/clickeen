# Evergreen Backlog

Status: ACTIVE
Date: 2026-05-28
Owner: Product Dev Team

## Purpose

This file is the canonical holding area for work that is:

1. needed
2. intentionally postponed out of an active PRD
3. still expected to come back into execution later

## How to use this file

1. When a PRD defers a needed item, add it here immediately.
2. Every entry must say:
   - source PRD
   - exact postponed work
   - why it was postponed
   - what should trigger it to come back into active execution
3. Do not put stale ideas, rejected ideas, or already-executing work here.
4. When an item is promoted into a new or active PRD, update its status and add the destination PRD.
5. When an item is no longer needed, mark it dropped with a reason. Do not silently delete history.

## Status meanings

1. `backlog`: needed, postponed, not executing yet
2. `promoted`: moved into an active PRD
3. `closed`: promoted PRD executed; no longer active backlog work
4. `dropped`: no longer needed, with explicit reason

## Active backlog

| ID | Status | Source PRD | Item | Why postponed | Promotion trigger | Destination PRD |
|---|---|---|---|---|---|---|
| EB-001 | backlog | PRD 068 | Email confirmation / email-ownership verification as part of the auth + comms system | This is not a standalone toggle fix; it belongs in the real communications/email system track | Open the communications/email-system PRD and define the outbound email architecture | — |
| EB-002 | backlog | PRD 069A | Admin showcase/demo HTML cleanup for `dropdown-fill.html`, `entitlements.html`, `button.html`, `colors.html` | Low ROI compared with runtime/tooling offenders; not in the main product/runtime edit path | These files become active product work or readability starts blocking real development | — |
| EB-003 | backlog | PRD 069A | Icon catalog generation/classification cleanup for admin and dieter icon pages | Needed housekeeping, but not worth blocking higher-value runtime cleanup | The icon catalog generation path is touched or formalized into a proper source/generator flow | — |
| EB-004 | promoted | PRD 069A | `tokyo/widgets/shared/typography.js` split / shared runtime risk review | The old item is now part of the PRD 105K pre-GA cleanup verification. 105K must first verify whether the shared runtime needs a focused split/versioning PRD instead of doing speculative movement. | — | PRD 105K |
| EB-005 | backlog | PRD 067 | Outbound posting/integration containment beyond the current widget publish path | PRD 067 closed the current Roma publish containment slice only; broader outbound posting/integration containment was left open intentionally | Outbound posting/integration surfaces become active or trust/safety needs containment beyond the current widget publish path | — |
| EB-006 | backlog | PRD 067 | Remote/internal access design for the company-plane if any non-local internal control runtime is needed | PRD 067 kept the control plane local-first and deferred any non-local internal access design | A real non-local internal control runtime becomes necessary and needs an explicit authority model separate from product memberships | — |
| EB-007 | backlog | PRD 069A | Widget copilot re-separation so SDR and CS regain clearer runtime differentiation beyond the current shared `widgetCopilotCore.ts` | `69A` reduced duplicate LOC, but the current shared core still flattens too much agent-specific runtime behavior for a future agent-focused architecture pass | Agent work becomes active again, or SDR/CS behavior/policy/prompt/runtime changes start creating coupling pressure inside the shared core | — |
| EB-008 | backlog | PRD 072 | Font upload in DevStudio plus first-class font management in Roma | Current local boot syncs canonical fonts into local Tokyo so the stack can render correctly, but there is no deliberate internal font upload workflow or customer-facing font-management domain yet | Typography/font lifecycle becomes active product/internal tooling work and we open a dedicated PRD for font ingestion, storage, governance, and Roma domain UX | — |
| EB-009 | closed | PRD 070A | `tokyo-worker/src/domains/account-localization.ts` reduction and split into smaller Tokyo-owned localization modules | Closed by executed PRD 073. Tokyo-worker localization is now split across smaller Tokyo-owned modules instead of the old single mixed implementation. | — | PRD 073 |
| EB-010 | dropped | PRD 075A | Split Roma’s shared instance loader so document-open and publish/live-status lookup stop sharing the same helper (`loadTokyoPreferredAccountInstance`) | No longer needed. `75A` executed the split: Roma now uses separate document-open and live-status helpers, and Builder-open no longer shares a mixed loader with publish/live-state consumers. | — | — |
| EB-011 | promoted | PRD 075E | Builder Translations panel, translated-locale inspection, and manual translated-locale edit model | The old backlog item correctly warned against a second full CMS, but its blanket rejection of per-instance manual translated-locale editing is no longer current authority. PRD 105F defines a deliberately simple full-map manual edit model, and PRD 105G defines the Bob product-state resolver and reviewability rules. | — | PRD 105F / PRD 105G |
| EB-012 | backlog | PRD 075E | Move account base-locale setup into onboarding/account creation so the source-language decision is explicit before any widget is saved | `75E` now locks base locale after the first widget save because translation overlays must stay anchored to one immutable base-locale base. The product still needs a cleaner first-run place to make that choice explicit instead of leaving it only in later Settings. | Account onboarding/account-creation work becomes active and we open a dedicated PRD for first-run account setup flow and source-language capture. | — |
| EB-013 | backlog | PRD 105D / 105G / 105J | Zero-touch Babel runtime: save-triggered translation generation, durable operation ledger/outbox outside the instance folder, push/SSE or equivalent state updates, and completion-triggered rematerialization for already-published instances | The 105 series intentionally stabilizes the current manual Generate workflow and instance-folder taxonomy first. Zero-touch automation should not be built until translation sync, operation authority, public materialization, and Prague public boundary are green. | PRD 105D, 105G, 105F, and 105J are green enough to support automation without reviving operation-controller JSON or Bob queue math. | — |
| EB-014 | promoted | 082 / codebase audits | Pre-GA codebase and documentation cleanup verification | The remaining audit work has been extracted into PRD 105K so it can be verified against the PRD 105 north star instead of remaining as loose planning residue. | — | PRD 105K |
| EB-015 | promoted | PRD 101 stub | Paid SEO/GEO static build mode | The old 101 stub used stale pre-105 language. It has been replaced by a current PRD grounded in the PRD 105 instance-folder taxonomy. | — | PRD 101 |

## Promotion log

Add promoted items here with date and destination PRD when they move out of backlog.

- 2026-03-17 — `EB-009` promoted to `PRD 073` (`073__PRD__Audit_Driven_Architecture_Upleveling_And_Simplification.md`)
- 2026-04-30 — `EB-009` closed because `PRD 073` is executed and Tokyo-worker localization is already split into smaller owner-correct modules.
- 2026-05-28 — `EB-004` promoted to `PRD 105K` for shared runtime risk verification before any typography split.
- 2026-05-28 — `EB-011` promoted/reconciled into `PRD 105F` and `PRD 105G`; old no-manual-edit constraint superseded by the 105 manual full-map edit and product-state resolver model.
- 2026-05-28 — `EB-014` added as promoted to `PRD 105K` for remaining pre-GA cleanup and documentation verification.
- 2026-05-28 — `EB-015` added as promoted to current `PRD 101` for paid SEO/GEO static build mode.
