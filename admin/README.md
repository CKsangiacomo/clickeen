# DevStudio — Internal Toolbench

**Package**: `@clickeen/devstudio`
**Port**: `5173`
**URL**: `http://localhost:5173`

## What DevStudio is

DevStudio is Clickeen's local internal toolbench.

It exists for:
- widget curation and verification
- Bob-hosted internal authoring flows
- Dieter previews and internal fixtures
- deploy/runtime verification from the owner machine
- other narrowly scoped internal tools that do not belong in Roma

It is not:
- a customer shell
- a generic superadmin dashboard
- a global account browser
- a Cloudflare-hosted shared runtime
- the place to test product-auth realism by default

## Current tool surface

Shipped tools today include:
- `/#/tools/dev-widget-workspace`
- `/#/tools/sponsored-account-onboarding`
- `/#/tools/customer-recovery`
- Dieter/foundations pages generated from source
- other internal dev/verification pages under `src/html/tools/`

The old `account-operator` surface is intentionally removed.

## Local contract

DevStudio local runs as an internal toolbench on the owner machine.

Rules:
- local tool routes live only under `/api/devstudio/*`
- local `GET /api/devstudio/context` returns a minimal seeded platform context:
  - `accountId`
  - `scope: 'platform'`
  - `mode: 'local-tool'`
- local DevStudio does not require Roma-style login semantics by default
- local DevStudio authority must not leak onto product routes

Internal transport used by local tool routes:
- `PARIS_DEV_JWT`
- `TOKYO_DEV_JWT`
- `x-ck-internal-service: devstudio.local`

Current local company-plane routes:
- `POST /api/devstudio/control/sponsored-accounts`
- `POST /api/devstudio/control/customer-email-recovery`
- `POST /api/devstudio/control/account-member-removal`
- `POST /api/devstudio/control/revoke-user-sessions`
- `POST /api/devstudio/control/account-publish-containment`
- `POST /api/devstudio/control/support-open-target`
- `POST /api/devstudio/control/support-update-instance`

These are for local DevStudio tool routes only.

Current support-intervention slice:
- open a targeted customer-owned widget in Bob from `customer-recovery`
- save base-config changes back through the explicit support path
- local only

## Development

```bash
pnpm --filter @clickeen/devstudio dev
pnpm --filter @clickeen/devstudio build
```

Canonical startup remains:

```bash
bash scripts/dev-up.sh
```

## Build-time generation

DevStudio still generates Dieter/component showcase pages at build time.
That truth-mirror behavior remains valid and important.

Key generators:
- `scripts/generate-component-pages.ts`
- `scripts/generate-icons-showcase.local.cjs`
- `scripts/generate-typography-json.cjs`

## Editing rules

When changing DevStudio:
1. keep it a local internal toolbench
2. do not add Roma-style product IA
3. do not invent new account/admin concepts in DevStudio
4. keep local-only authority confined to `/api/devstudio/*`
5. if a tool needs company-plane authority, that belongs in the separate internal control plane, not in a fake product account shell
