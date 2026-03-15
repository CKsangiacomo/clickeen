STATUS: EXECUTION RUNBOOK — WIDGET COPILOT (SDR + CS)
Updated: March 15, 2026 (070A AI ownership cut)
This file keeps rollout history, but the current runtime owner shape is now:
- account-mode Builder Copilot: Roma-owned backend routes
- MiniBob/public Copilot: Bob-owned same-origin routes
- Paris: no `/api/ai/*` ownership

## Purpose

This runbook captures the rollout status for widget copilot routing:
- `widget.copilot.v1` alias
- policy-resolved SDR/CS canonical IDs
- environment verification (local vs cloud-dev)

## Canonical routing contract

- Request alias: `widget.copilot.v1`
- Backend grant resolution:
  - `minibob|free` -> `sdr.widget.copilot.v1`
  - `tier1|tier2|tier3` -> `cs.widget.copilot.v1`
- Minibob public grants are fixed server-side to SDR (`sdr.widget.copilot.v1`).

## Environment behavior matrix

| Environment | Browser endpoint | Observed status |
|---|---|---|
| Local | `POST /api/ai/widget-copilot` | Active primary route |
| Cloud-dev (`bob.dev`) | `POST /api/ai/widget-copilot` | Active primary route |
| Local / Cloud-dev (`bob.dev`) | `POST /api/ai/minibob/session` | MiniBob session mint lives on Bob |

## Cloud-dev verification findings (February 11, 2026)

Pre-deploy finding (earlier same day):
- `bob.dev` was missing `/api/ai/widget-copilot` and temporarily operating through `/api/ai/sdr-copilot` (now removed).

Post-deploy findings:
- Bob cloud-dev now serves `/api/ai/widget-copilot`.
- Roma/Bob + San Francisco cloud-dev resolve policy correctly through that route:
  - free workspace calls return `meta.promptRole = "sdr"`
  - tier3 workspace calls return `meta.promptRole = "cs"`
- For paid tiers, forcing `agentId = sdr.widget.copilot.v1` is canonicalized back to CS (`meta.promptRole = "cs"`), matching the policy contract.
- Minibob flow remains fixed to SDR through Bob-owned same-origin routes.
- Workspace coverage in shared cloud-dev DB at verification time:
  - present: `free`, `tier3`
  - missing: `tier1`, `tier2`

## Release package scope (CS routing + role-scoped policy split)

Core runtime files:
- `packages/ck-policy/src/ai.ts`
- `roma/lib/ai/account-copilot.ts`
- `bob/lib/ai/minibob.ts`
- `sanfrancisco/src/index.ts`
- `sanfrancisco/src/agents/widgetCopilotCore.ts`
- `sanfrancisco/src/agents/sdrWidgetCopilot.ts`
- `sanfrancisco/src/agents/csWidgetCopilot.ts`
- `sanfrancisco/src/agents/widgetCopilotPromptProfiles.ts`
- `bob/app/api/ai/widget-copilot/handler.ts`
- `bob/app/api/ai/widget-copilot/route.ts`
- `bob/components/CopilotPane.tsx`
- `admin/src/html/tools/entitlements.html`

Policy split notes (local runtime):
- SDR and CS still share grant plumbing + telemetry shape, but behavior is now role-scoped in the widget copilot runtime.
- SDR path is constrained to FAQ sales workflow (rewrite existing Q&A, or website-based FAQ personalization).
- CS path handles general control-driven editor requests and does not use the SDR website/seller clarification loop.

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
