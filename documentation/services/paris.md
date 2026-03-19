# System: Paris — Residual Health Stub

STATUS: REFERENCE — MUST MATCH RUNTIME  
Last updated: 2026-03-15

Paris no longer owns any product-path or public-read runtime behavior.

Current role:
- residual worker stub only
- health check only

Non-negotiable:
- Paris does not own public instance reads
- Paris does not own product-path reads or writes
- Paris does not own account-mode translation generation, overlay state, or published-surface convergence
- browsers must not call Paris for product operations

## Shipped endpoints

### Health
- `GET /api/healthz`

## What moved out

- Account locale settings sync is Roma-owned.
- Account localization snapshot/status reads and `layer=user` writes are no longer part of the active Builder authoring path.
- Account widget localization/live sync now runs outside Paris as Roma-triggered, Tokyo-worker-executed reconciliation against Berlin/Tokyo/San Francisco.
- Canonical overlay/artifact state lives in Tokyo/Tokyo-worker, not Paris.
- Public instance payload reads now live in Venice on top of Tokyo live/config artifacts.

## Runtime notes

- Paris no longer reads Michael or Tokyo on the product/public path.
- Paris no longer needs l10n queues, l10n KV/R2 state, or public instance route plumbing.

## Source of truth

- Runtime entry: `paris/src/index.ts`
