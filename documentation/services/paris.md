# System: Paris — Residual Public Read Boundary

STATUS: REFERENCE — MUST MATCH RUNTIME  
Last updated: 2026-03-15

Paris is no longer part of the account-mode product l10n path.

Current role:
- public published-instance read
- residual non-product paths only

Non-negotiable:
- product-path core instance open/save are not mounted in Paris
- product-path localization snapshot, user-layer writes, l10n status, and locale aftermath are not mounted in Paris
- Paris does not own account-mode translation generation, overlay state, or published-surface convergence
- browsers still must not call Paris for account-mode product operations

## Shipped endpoints

### Health
- `GET /api/healthz`

### Public read
- `GET /api/instance/:publicId`
  - public read only
  - user-owned rows are published-only
  - saved-config truth is loaded from Tokyo

## What moved out

- Account locale settings aftermath is Roma-owned.
- Account localization snapshot reads are Roma-owned.
- Account l10n status reads are Roma-owned.
- Account `layer=user` writes are Roma-owned.
- Account save/publish aftermath runs from Roma against Berlin/Tokyo/San Francisco/Tokyo-worker.
- Canonical overlay/artifact state lives in Tokyo/Tokyo-worker, not Paris.

## Runtime notes

- Paris still reads Michael for public instance shell metadata.
- Paris still reads Tokyo saved config directly for the public `GET /api/instance/:publicId` response.
- Paris no longer needs l10n queues, l10n KV/R2 state, or internal locale aftermath/reporting routes.

## Source of truth

- Runtime entry: `paris/src/index.ts`
- Public read handler: `paris/src/domains/instances/index.ts`
- Tokyo saved-config bridge: `paris/src/domains/account-instances/service.ts`
