STATUS: EXECUTION RUNBOOK — WIDGET COPILOT
Updated: March 15, 2026 (070A AI ownership cut)
This file keeps rollout history, but the current runtime owner shape is now:
- account-mode Builder Copilot: Roma-owned backend routes
- Prague demo: not a live Copilot execution surface
- Paris: no `/api/ai/*` ownership
- Account Builder widget copilot: `widget.copilot.v1` -> `cs.widget.copilot.v1`

## Purpose

This runbook captures the rollout status for widget copilot routing:
- `widget.copilot.v1` alias
- current CS canonical ID on the live account product path
- environment verification (local vs cloud-dev)

## Canonical routing contract

- Request alias: `widget.copilot.v1`
- Backend grant resolution on the live account path:
  - account Builder -> `cs.widget.copilot.v1`

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
- `packages/ck-policy/src/ai.ts`
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
- `documentation/services/paris.md`
- `documentation/services/sanfrancisco.md`
- `documentation/services/devstudio.md`
- `documentation/architecture/CONTEXT.md`
- `documentation/architecture/Overview.md`

## Next rollout action

Add tier1/tier2 cloud-dev workspaces (currently absent in shared dev DB) and extend the same verification matrix to those tiers for complete paid-tier coverage.
