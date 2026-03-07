# 057 Execution Report - Paris Dumb-Pipe Restoration and Direct RLS Reads

Date: 2026-03-06
Owner: Product Dev Team
Status: EXECUTED IN CODE (local/source gates green; cloud-dev Bob deployment evidence still incomplete)

## Scope

This report captures closeout for PRD 57:
- direct RLS reads for verified flat reads
- Roma-owned product command orchestration
- Bob reduced to editor UX on hosted account flows
- Paris reduced toward composed reads + write/orchestration responsibilities

## Implemented slices

### Slice A - Direct Michael boundary

- Berlin exposes `GET /auth/michael/token`.
- Roma and Bob use dedicated `michael.ts` boundaries for direct flat reads.
- Flat read migrations landed for the main verified cases (`members`, `locales`, account/widget flat reads).

Files:
- `berlin/src/routes-session.ts`
- `roma/lib/michael.ts`
- `bob/lib/michael.ts`

### Slice B - Roma command ownership

- Hosted account mutations now route through Roma rather than Bob owning the product command boundary.
- Bob delegates hosted account save/l10n mutation intents back to Roma.
- Bob same-origin mutation routes remain only for local DevStudio / explicit non-Roma surfaces.

Files:
- `roma/components/builder-domain.tsx`
- `bob/lib/session/useWidgetSession.tsx`
- `roma/app/api/accounts/**`

### Slice C - Catch-all proxy removal and explicit named routes

- Roma catch-all Paris proxy route is gone.
- Remaining Roma/Bob Paris calls go through explicit named route handlers.
- Shared helper modules still exist under those named routes, but wildcard routing is hard-cut.

Files:
- `roma/app/api/paris/[...path]/route.ts` (deleted earlier in execution)
- `roma/lib/api/paris-proxy.ts`
- `bob/lib/api/paris/proxy-helpers.ts`

### Slice D - Paris cleanup on surviving surface

- Dead external routes were removed.
- Tier/rank, seoGeo, mirror-pack, confirm-param, and error-detail duplication was reduced in the surviving Paris code.

Files:
- `paris/src/index.ts`
- `paris/src/shared/errors.ts`
- `paris/src/shared/http.ts`
- `paris/src/shared/mirror-packs.ts`
- `paris/src/shared/roles.ts`
- `paris/src/shared/seo-geo.ts`

## Verification

Local/source gates run:
- `pnpm test:bootstrap-parity` -> PASS
- `pnpm test:bootstrap-parity:cloud-dev` -> PASS
- `pnpm test:paris-boundary` -> PASS
- `pnpm test:bob-bootstrap-boundary` -> PASS
- `pnpm --filter @clickeen/roma lint` -> PASS
- `pnpm --filter @clickeen/bob lint` -> PASS
- `pnpm exec tsc -p roma/tsconfig.json --noEmit` -> PASS
- `pnpm exec tsc -p bob/tsconfig.json --noEmit` -> PASS
- `pnpm exec tsc -p berlin/tsconfig.json --noEmit` -> PASS

Historical cloud-dev execution evidence already recorded in the PRD:
- Berlin brokered RLS reads succeeded after claim + RLS repairs.
- `account_members`, `accounts`, and `widget_instances` direct reads returned `200`.
- Non-member account query returned `[]`.

Current cloud-dev probe state from this machine:
- `GET https://roma.dev.clickeen.com/api/bootstrap` -> `401` as expected unauthenticated.
- `GET https://bob.dev.clickeen.com/api/roma/bootstrap` -> `404`.

Interpretation:
- Source code and local gates are aligned with the target architecture.
- Current cloud-dev Bob deployment/runtime does not yet expose the expected bootstrap route on the probed host, so fresh end-to-end hosted Builder validation is not reproducible from this machine today.

## Completion decision

PRD 57 is complete in code.

The only meaningful caveat is deployment/runtime evidence:
- explicit named routes are the shipped boundary
- shared proxy helpers remain as boring implementation detail under those routes
- current cloud-dev Bob bootstrap route returns `404`, so fresh hosted-flow runtime proof is deployment-gated rather than code-gated

That makes PRD 57 ready to move to `03-Executed` as **executed in code**.
