# DevStudio — Internal Toolbench

**Package**: `@clickeen/devstudio`
**Port**: `5173`
**URL**: `http://localhost:5173`

## What DevStudio is

DevStudio is Clickeen's local internal toolbench.

It exists for:
- widget curation and verification
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
- `/#/tools/bob-ui-native`
- `/#/tools/entitlements`
- Dieter/foundations pages generated from source
- other internal dev/verification pages under `src/html/tools/`

The old `account-operator` surface is intentionally removed.

## Local contract

DevStudio local runs as an internal toolbench on the owner machine.

Rules:
- local DevStudio does not require Roma-style login semantics by default
- local DevStudio must not grow hidden company-plane authority or fake product routes

## Runtime layout

The local widget-authoring workspace at `/#/tools/dev-widget-workspace` is removed.
DevStudio remains the internal toolbench for internal pages and supporting local tooling.

Current runtime layout:
- [devstudio.ts](/Users/piero_macpro/code/VS/clickeen/admin/vite/devstudio.ts) owns the remaining DevStudio Vite route fallback
- [vite.config.ts](/Users/piero_macpro/code/VS/clickeen/admin/vite.config.ts) is the Vite shell plus plugin registration

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
4. do not reintroduce removed local widget-authoring or company-plane action lanes
5. if a tool needs company-plane authority, that belongs in the separate internal control plane, not in a fake product account shell
