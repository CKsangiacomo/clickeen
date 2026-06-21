STATUS: EXECUTION RUNBOOK — PRODUCT COPILOT
Updated: June 20, 2026 (real-agent brain boundary)
This file keeps rollout history, but the current runtime owner shape is now:
- account-mode Builder Copilot: Roma-owned backend routes
- Prague demo: not a live Copilot execution surface
- Account Builder widget copilot: one Roma-owned account path using `cs.widget.copilot.v1`
- Product Copilot brain/runtime code: isolated `agents/product-copilot/` worker

## Purpose

This runbook captures the rollout status for the account Builder Copilot path and environment verification.

## Canonical routing contract

- Backend grant resolution on the live account path:
  - account Builder -> `cs.widget.copilot.v1`
- Bob does not own the AI provider, model, or agent. If Bob sends a selected
  model from the UI, Roma validates it against the Product Copilot managed model
  config before minting the grant. Roma mints the account grant from account
  policy and the single account Copilot contract. Paid Product Copilot policy
  must include every managed Product Copilot model; free policy may remain
  narrower.
- Bob sends a bounded `product-copilot.context.v1` capsule. It does not use the
  removed scoped-control pre-routing envelope.
- Product Copilot returns the typed union `answer | clarification | suggestion
  | draft_edit | refusal | error`.

## Environment behavior matrix

| Environment | Browser endpoint | Observed status |
|---|---|---|
| Local / Cloud-dev Roma Builder | `/api/account/instances/:instanceId/copilot` | Active primary route |

## Cloud-dev verification findings (February 11, 2026)

Post-deploy findings:
- Roma + San Francisco cloud-dev resolve policy correctly through the Roma instance route:
  - account Builder calls return `meta.promptRole = "cs"`
- Workspace coverage in shared cloud-dev DB at verification time:
  - present: `free`, `tier3`
  - missing: `tier1`, `tier2`

## Release package scope (CS routing + role-scoped policy split)

Core runtime files:
- `packages/ck-contracts/src/ai.js`
- `agents/product-copilot/src/index.ts`
- `agents/product-copilot/src/worker.ts`
- `agents/product-copilot/wrangler.toml`
- `roma/lib/ai/account-copilot.ts`
- `sanfrancisco/src/index.ts`
- `bob/components/CopilotPane.tsx`
- `admin/src/html/tools/entitlements.html`

Current runtime note:
- The live account Builder route uses the account Builder copilot only.

Verification:
- service-owned integration tests and cloud-dev runtime checks.

Documentation touched for this rollout:
- `documentation/ai/overview.md`
- `documentation/services/bob.md`
- `documentation/services/sanfrancisco.md`
- `documentation/services/devstudio.md`
- `documentation/architecture/CONTEXT.md`
- `documentation/architecture/Overview.md`

## Next rollout action

Add tier1/tier2 cloud-dev workspaces (currently absent in shared dev DB) and extend the same verification matrix to those tiers for complete paid-tier coverage.
