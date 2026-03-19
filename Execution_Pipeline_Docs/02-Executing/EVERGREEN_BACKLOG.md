# Evergreen Backlog

Status: ACTIVE
Date: 2026-03-13
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
3. `dropped`: no longer needed, with explicit reason

## Active backlog

| ID | Status | Source PRD | Item | Why postponed | Promotion trigger | Destination PRD |
|---|---|---|---|---|---|---|
| EB-001 | backlog | PRD 068 | Email confirmation / email-ownership verification as part of the auth + comms system | This is not a standalone toggle fix; it belongs in the real communications/email system track | Open the communications/email-system PRD and define the outbound email architecture | — |
| EB-002 | backlog | PRD 069A | Admin showcase/demo HTML cleanup for `dropdown-fill.html`, `entitlements.html`, `button.html`, `colors.html` | Low ROI compared with runtime/tooling offenders; not in the main product/runtime edit path | These files become active product work or readability starts blocking real development | — |
| EB-003 | backlog | PRD 069A | Icon catalog generation/classification cleanup for admin and dieter icon pages | Needed housekeeping, but not worth blocking higher-value runtime cleanup | The icon catalog generation path is touched or formalized into a proper source/generator flow | — |
| EB-004 | backlog | PRD 069A | `tokyo/widgets/shared/typography.js` split | Reviewed during `69A` closure and kept deferred because a real split would require changing the widget shared-runtime loading contract, not just moving code | Typography becomes active work and we are willing to change the shared widget runtime loading contract, or a clean no-contract-change split becomes obvious | — |
| EB-005 | backlog | PRD 067 | Outbound posting/integration containment beyond the current widget publish path | PRD 067 closed the current Roma publish containment slice only; broader outbound posting/integration containment was left open intentionally | Outbound posting/integration surfaces become active or trust/safety needs containment beyond the current widget publish path | — |
| EB-006 | backlog | PRD 067 | Remote/internal access design for the company-plane if any non-local internal control runtime is needed | PRD 067 kept the control plane local-first and deferred any non-local internal access design | A real non-local internal control runtime becomes necessary and needs an explicit authority model separate from product memberships | — |
| EB-007 | backlog | PRD 069A | Widget copilot re-separation so SDR and CS regain clearer runtime differentiation beyond the current shared `widgetCopilotCore.ts` | `69A` reduced duplicate LOC, but the current shared core still flattens too much agent-specific runtime behavior for a future agent-focused architecture pass | Agent work becomes active again, or SDR/CS behavior/policy/prompt/runtime changes start creating coupling pressure inside the shared core | — |
| EB-008 | backlog | PRD 072 | Font upload in DevStudio plus first-class font management in Roma | Current local boot syncs canonical fonts into local Tokyo so the stack can render correctly, but there is no deliberate internal font upload workflow or customer-facing font-management domain yet | Typography/font lifecycle becomes active product/internal tooling work and we open a dedicated PRD for font ingestion, storage, governance, and Roma domain UX | — |
| EB-009 | promoted | PRD 070A | `tokyo-worker/src/domains/account-localization.ts` reduction and split into smaller Tokyo-owned localization modules | The owner boundary is now correct, but the file remains too large and still bundles multiple Tokyo localization responsibilities into one implementation; doing the split immediately would be cleanup-only churn after the larger boundary correction | Tokyo localization work becomes active again, or we open a dedicated follow-up PRD to split the Tokyo localization core without reintroducing Roma duplication or cross-owner wrapper layers | PRD 073 |
| EB-010 | dropped | PRD 075A | Split Roma’s shared instance loader so document-open and publish/live-status lookup stop sharing the same helper (`loadTokyoPreferredAccountInstance`) | No longer needed. `75A` executed the split: Roma now uses separate document-open and live-status helpers, and Builder-open no longer shares a mixed loader with publish/live-state consumers. | — | — |

## Promotion log

Add promoted items here with date and destination PRD when they move out of backlog.

- 2026-03-17 — `EB-009` promoted to `PRD 073` (`073__PRD__Audit_Driven_Architecture_Upleveling_And_Simplification.md`)
