# EXEC 103_DB.6 Widget Definition Operation Cleanup

Status: Green
Date Started: 2026-05-22
Date Completed: 2026-05-22
Parent PRD: `103_DB_Pivot__PRD__Operational_State_In_Supabase_Public_Artifacts_In_R2.md`
Execution slice: `103_DB.6 - Widget definition operation cleanup`

## Slice Intent

Widget definitions must be product operations, not generated storage artifacts or DB catalog residue.

The approved V1 model is:

- widget source lives in repo/static Tokyo product source under `tokyo/product/widgets/{widgetType}/`;
- Tokyo-worker exposes widget definitions through `/__internal/widgets/definitions`;
- Roma consumes widget definitions only through Tokyo;
- the remote DB `widgets` table is not product authority;
- generated widget catalog/manifest files are not allowed as product authority.

## Current Product Path

- Tokyo-worker imports widget source through the generated source index `tokyo-worker/src/generated/widget-definition-sources.ts`.
- Tokyo-worker validates and exposes public widget definition entries through `listWidgetDefinitions()`.
- Roma loads definitions through `roma/lib/account-instance-direct.ts` using `GET /__internal/widgets/definitions`.
- Widget source validation is non-mutating through `scripts/validate-widget-source.mjs`, and `scripts/generate-widget-definition-sources.mjs --check` fails if a widget folder exists without the checked-in source index being regenerated.

## Cleanup Proof

- `scripts/build-widget-catalog.mjs` is absent.
- `tokyo/product/widgets/manifest.json` is absent.
- `/__internal/renders/widgets/catalog.json` is absent.
- `/__internal/renders/widgets/index.json` is absent.
- `tokyo/product/widgets/*/agent.md` is absent.
- `tokyo/product/widgets/*/content.json` is absent.
- `tokyo/product/widgets/*/seo-geo.ts` is absent.
- `catalog.json` survives only as small repo/static display metadata behind Tokyo widget-definition operations.
- `tokyo-worker/src/generated/widget-definition-sources.ts` survives only as a build-time import index for bundled worker source. It is not a product catalog, storage artifact, DB authority, or runtime state.

## Decision

Widget definitions remain repo/static product source in V1. They do not move to Supabase in this pivot.

That is the boring, correct split:

- the app asks Tokyo for widget definitions;
- Tokyo owns the product operation;
- Tokyo's source imports are generated from widget folders instead of hand-registered per widget;
- R2 does not carry widget catalog authority;
- Supabase does not carry static widget software/catalog rows.

## Verification

- `rg -n "__internal/(renders/widgets|widgets/definitions)|listWidgetDefinitions|getWidgetDefinition|resolveWidgetDefaults|widgets/manifest|build-widget-catalog|product/widgets/manifest|catalog\\.json" roma bob tokyo-worker packages scripts documentation/architecture documentation/widgets -g '*.{ts,tsx,mjs,md,json}'`
- `find tokyo/product/widgets -maxdepth 2 -type f \\( -name 'manifest.json' -o -name 'agent.md' -o -name 'content.json' -o -name 'seo-geo.ts' \\) -print`
- `node scripts/generate-widget-definition-sources.mjs --check`
- `pnpm validate:widgets`
- `pnpm verify:prd103-db-pivot`
- `pnpm lint`
- `pnpm typecheck`
- `git diff --check`

All checks are green for this slice.

## Green Readout

The widget definition path is now operation-shaped:

- Roma does not read a generated catalog artifact.
- Roma does not read Supabase `widgets`.
- Tokyo does not build or consume a generated widget manifest as product truth.
- Tokyo no longer needs runtime edits when a new widget source folder is added; the source index is regenerated and guarded.
- Widget catalog metadata stays small and static under widget source, with guardrails preventing deleted capability/catalog soup from returning.
