# PRD 089 Slice 0 - Evidence Refresh And Scope Lock

Status: GREEN
Date: 2026-05-11

## Scope

Slice 0 refreshed stale-contract evidence across:

```text
bob
roma
venice
prague
tokyo-worker
tokyo/dev-server.mjs
tokyo/product/widgets
tokyo/prague/pages
packages
scripts
documentation
supabase
```

## Active Runtime Offenders

### Widget Runtime `publicId`

Action: Slice 1 renames these active runtime contracts to `instanceId`, removes `data-ck-public-id`, and removes `CK_WIDGET.publicId`/`CK_WIDGETS[publicId]` fallback paths.

- `tokyo/product/widgets/shared/stagePod.js`
- `tokyo/product/widgets/shared/localeSwitcher.js`
- `tokyo/product/widgets/shared/branding.js`
- `tokyo/product/widgets/shared/previewL10n.js`
- `tokyo/product/widgets/shared/typography.js`
- `tokyo/product/widgets/faq/widget.client.js`
- `tokyo/product/widgets/countdown/widget.client.js`
- `tokyo/product/widgets/logoshowcase/widget.client.js`

### Removed L10n Routes

Action: Slice 2 replaces these with `/l10n/widgets/{instanceId}/...`.

- `tokyo/product/widgets/shared/previewL10n.js`
- `tokyo/dev-server.mjs`

### Venice Route Residue

Action: Slice 7 removes or updates old cache matchers.

- `venice/lib/tokyo.ts`

## Active Data Offenders

### Curated Source Vocabulary

Action: Slice 8 removes unused source fields or renames them to a surviving source vocabulary.

- `tokyo/product/widgets/logoshowcase/spec.json`

## Active Documentation Offenders

Action: Slice 9 rewrites these active docs so they describe `instanceId`, `/widget/{instanceId}`, account widget instance storage, and `accountInstanceRef`.

- `documentation/README.md`
- `documentation/strategy/WhyClickeen.md`
- `documentation/strategy/Clickeen-Babel.md`
- `documentation/capabilities/localization.md`
- `documentation/capabilities/seo-geo.md`
- `documentation/capabilities/multitenancy.md`
- `documentation/ai/BUILD_PraguePage.md`
- `documentation/ai/overview.md`
- `documentation/ai/widget-copilot-rollout.md`
- `documentation/widgets/WidgetArchitecture.md`
- `documentation/widgets/WidgetBuildContract.md`
- `documentation/widgets/WidgetComplianceSteps.md`
- `documentation/widgets/WidgetPraguePagesBuilder.md`
- `documentation/widgets/FAQ/FAQ_PRD.md`
- `documentation/widgets/Countdown/Countdown_PRD.md`
- `documentation/services/tokyo.md`
- `documentation/services/venice.md`

Third-party competitor-analysis captures under `documentation/widgets/LogoShowcase/CompetitorAnalysis/**` contain `publicId` strings from external scripts. Slice 9 must either exclude them from product-contract scans or explicitly mark the folder as historical third-party evidence, not Clickeen product truth.

## Supabase Schema Offenders

Action: Slice 6 adds a hard-cut migration so the final applied schema no longer exposes legacy account widget instance source truth. Historical migration text may still contain the old names; final schema must not.

Legacy schema/table families found in migration history:

- `public.widget_instances`
- `public.curated_widget_instances`
- `public.widget_instance_overlays`
- `public.widget_instance_locales`
- `public.l10n_publish_state`
- `public.l10n_overlay_versions`
- `public.l10n_base_snapshots`
- `public.instance_enforcement_state`
- `public.instance_render_health`
- `public_id` constraints and grants
- `wgt_curated_*` and `wgt_system_*` constraints

Active application scan found no reads/writes to those legacy table families in:

```text
bob
roma
venice
prague
tokyo-worker
tokyo/product/widgets
packages
scripts
```

`supabase` CLI is not installed in this environment, so final schema verification must use either the repo's accepted local DB workflow if available later or be documented as blocked by missing CLI during Slice 6. Slice 6 must not treat raw migration-text matches as the final schema pass/fail signal.

## Slice 0 Verification Commands

```bash
rg -l "publicId|public_id|data-ck-public-id|CK_WIDGET\\.publicId" bob roma venice prague tokyo-worker tokyo/dev-server.mjs tokyo/product/widgets packages documentation --glob '!Execution_Pipeline_Docs/03-Executed/**'
rg -l "wgt_curated|wgt_system|systemInstanceRef|curatedRef|/l10n/instances|/l10n/v/.*/instances|/renders/instances|public/instances|accounts/\\{accountId\\}/instances" bob roma venice prague tokyo-worker tokyo/dev-server.mjs tokyo/product/widgets packages documentation --glob '!Execution_Pipeline_Docs/03-Executed/**'
rg -l "/e/|/r/" bob roma venice prague tokyo-worker tokyo/dev-server.mjs tokyo/product/widgets packages documentation --glob '!Execution_Pipeline_Docs/03-Executed/**'
rg -l '"source"\\s*:\\s*"curated"' tokyo/product/widgets
rg -n "widget_instances|curated_widget_instances|widget_instance_overlays|widget_instance_locales|l10n_publish_state|l10n_overlay_versions|l10n_base_snapshots|instance_enforcement_state|instance_render_health" bob roma venice prague tokyo-worker tokyo/product/widgets packages scripts --glob '!**/node_modules/**' --glob '!**/.next/**' --glob '!**/dist/**'
```

## Gate

Slice 0 is complete because every active offender has a target slice and intended action, and active app code does not currently consume the legacy Supabase widget-instance tables.
