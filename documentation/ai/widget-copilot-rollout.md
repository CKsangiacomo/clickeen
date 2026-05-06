STATUS: EXECUTION RUNBOOK — WIDGET COPILOT
Updated: May 5, 2026 (backend boundary cleanup)
This file keeps rollout history, but the current runtime owner shape is now:
- account-mode Builder Copilot: Roma-owned backend routes
- Prague demo: not a live Copilot execution surface
- Account Builder widget copilot: one Roma-owned account path using `cs.widget.copilot.v1`

## Purpose

This runbook captures the rollout status for the account Builder Copilot path and environment verification.

## Canonical routing contract

- Backend grant resolution on the live account path:
  - account Builder -> `cs.widget.copilot.v1`
- Bob does not choose the AI provider, model, or agent. Roma mints the account grant from account policy and the single account Copilot contract.

## Environment behavior matrix

| Environment | Browser endpoint | Observed status |
|---|---|---|
| Local / Cloud-dev Roma Builder | `/api/account/instances/:publicId/copilot` | Active primary route |

## Cloud-dev verification findings (February 11, 2026)

Pre-deploy finding (earlier same day):
- `bob.dev` was missing `/api/ai/widget-copilot` and temporarily operating through `/api/ai/sdr-copilot` (now removed).

Post-deploy findings:
- Roma + San Francisco cloud-dev resolve policy correctly through the Roma instance route:
  - account Builder calls return `meta.promptRole = "cs"`
- Workspace coverage in shared cloud-dev DB at verification time:
  - present: `free`, `tier3`
  - missing: `tier1`, `tier2`

## Release package scope (CS routing + role-scoped policy split)

Core runtime files:
- `packages/ck-contracts/src/ai.js`
- `roma/lib/ai/account-copilot.ts`
- `sanfrancisco/src/index.ts`
- `sanfrancisco/src/agents/widgetCopilotCore.ts`
- `sanfrancisco/src/agents/csWidgetCopilot.ts`
- `sanfrancisco/src/agents/widgetCopilotPromptProfiles.ts`
- `bob/components/CopilotPane.tsx`
- `admin/src/html/tools/entitlements.html`

Current runtime note:
- Historical SDR routing notes below are archival. The live account Builder route now uses the CS widget copilot only.

Verification:
- service-owned integration tests and cloud-dev runtime checks.

Documentation touched for this rollout:
- `documentation/ai/overview.md`
- `documentation/ai/agents/sdr-copilot.md`
- `documentation/services/bob.md`
- `documentation/services/sanfrancisco.md`
- `documentation/services/devstudio.md`
- `documentation/architecture/CONTEXT.md`
- `documentation/architecture/Overview.md`

## Next rollout action

Add tier1/tier2 cloud-dev workspaces (currently absent in shared dev DB) and extend the same verification matrix to those tiers for complete paid-tier coverage.
