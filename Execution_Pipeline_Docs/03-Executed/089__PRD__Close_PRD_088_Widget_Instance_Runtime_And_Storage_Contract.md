# PRD 089 - Close PRD 088 Widget Instance Runtime And Storage Contract

Status: Executed
Source PRD: `Execution_Pipeline_Docs/03-Executed/088__PRD__Tokyo_Account_Widget_Instance_Storage_Contract.md`
Source audit: 2026-05-11 static codebase verification of PRD 088 execution
Additional review input: `PRD_88_execution_audit.docx`, reviewed on 2026-05-11

## 1. Purpose

PRD 088 moved Tokyo account widget instance storage toward the correct account-owned shape, but execution did not fully close the product contract.

This PRD exists to finish PRD 088, not to reinterpret it.

The real product path remains:

1. Account opens one widget in Roma.
2. Bob edits one active locale for that widget.
3. Roma saves to Tokyo.
4. Tokyo owns widget instance identity, config, localization overlays, publish state, and serving lookup.
5. Venice serves published instances by the single widget instance ID.

PRD 089 removes the active legacy code and ambiguous derived storage that still prevent that path from being boring, auditable, and cohesive.

## 2. Product Truth

### 2.1 Surviving Authority

The surviving source authority for account widget instances is:

```text
accounts/{accountId}/widgets/{widgetType}/widget.json
accounts/{accountId}/widgets/{widgetType}/{instanceId}/instance.json
accounts/{accountId}/widgets/{widgetType}/{instanceId}/config.json
accounts/{accountId}/widgets/{widgetType}/{instanceId}/publish.json
accounts/{accountId}/widgets/{widgetType}/{instanceId}/overlays/l10n/{locale}/overlay.json
```

The only serving lookup outside the account tree is:

```text
published/widgets/{instanceId}.json
```

`published/widgets/{instanceId}.json` is routing metadata only. It must not become a second source of instance truth.

### 2.2 Single ID Rule

`instanceId` is the only widget runtime, authoring, publish, and embed identifier.

The following concepts are legacy and must not remain in active product code:

- `publicId`
- `public_id`
- `data-ck-public-id`
- `wgt_curated_*`
- `wgt_system_*`
- `systemInstanceRef`
- `curatedRef`
- `/e/{id}`
- `/r/{id}`
- `/l10n/instances/{id}/...`
- `/renders/instances/{id}/...`

For account widget instances, these legacy Supabase entities must also not define current product truth:

- `public.widget_instances`
- `public.curated_widget_instances`
- `public.widget_instance_overlays`
- `public.widget_instance_locales`
- `public.l10n_publish_state`
- `public.l10n_overlay_versions`
- `public.l10n_base_snapshots`
- `public.instance_enforcement_state`
- `public.instance_render_health`

### 2.3 Localization Authority

Account instance localization belongs under:

```text
accounts/{accountId}/widgets/{widgetType}/{instanceId}/overlays/l10n/{locale}/overlay.json
```

Only non-base locales may have overlay documents.

The base locale is config/source truth. It is not an overlay and must not get an empty overlay file.

### 2.4 Builder Preview Truth

Builder preview is not a second widget truth.

Bob may send preview state to the iframe, but the preview contract must use `instanceId`, `baseLocale`, active `locale`, and current state. It must not send or expect `publicId`.

### 2.5 Database Truth

Tokyo R2 is the account widget instance source of truth.

Supabase may not preserve a parallel account widget instance source schema with `id` plus `public_id`, `wgt_curated_*`, `wgt_system_*`, or widget instance overlay tables. If old migrations remain in history, a later hard-cut migration must make the final applied schema match the PRD 088/089 contract.

## 3. Current Evidence From PRD 088 Audit

The following active gaps were found after PRD 088 was marked executed.

### 3.1 Widget Runtime Still Uses `publicId`

Active widget runtime code still reads `publicId` from `data-ck-public-id`, `window.CK_WIDGET.publicId`, or preview messages.

Known offenders:

- `tokyo/product/widgets/shared/previewL10n.js`
- `tokyo/product/widgets/shared/stagePod.js`
- `tokyo/product/widgets/shared/typography.js`
- `tokyo/product/widgets/shared/branding.js`
- `tokyo/product/widgets/shared/localeSwitcher.js`
- `tokyo/product/widgets/faq/widget.client.js`
- `tokyo/product/widgets/countdown/widget.client.js`
- `tokyo/product/widgets/logoshowcase/widget.client.js`

This is active runtime code, not historical documentation.

### 3.2 Preview Localization Still Uses Removed Routes

`tokyo/product/widgets/shared/previewL10n.js` still fetches removed instance routes:

```text
/l10n/instances/{publicId}/live/{locale}.json
/l10n/instances/{publicId}/packs/{locale}/{textFp}.json
```

Those routes are incompatible with PRD 088. They must be replaced by the account-widget l10n read contract used by Venice and Tokyo.

### 3.3 Tokyo Dev Server Still Routes Removed L10n Paths

`tokyo/dev-server.mjs` still recognizes and proxies `/l10n/instances/...` and `/l10n/v/{version}/instances/...`.

This makes local dev preview teach the old route shape even though Tokyo-worker now owns `/l10n/widgets/{instanceId}/...`.

### 3.4 Base Locale Overlay Can Still Be Written

`tokyo-worker/src/domains/account-instance-sync.ts` loops over desired locales and writes overlays even when the locale is the base locale.

That can create:

```text
accounts/{accountId}/widgets/{widgetType}/{instanceId}/overlays/l10n/{baseLocale}/overlay.json
```

This violates PRD 088.

### 3.5 Delete And Live Lookup Cleanup Are Not One Boundary

Roma currently deletes saved source and live surface through separate calls. Because saved delete can remove the account instance location before live cleanup resolves it, deletion can partially succeed and leave published lookup residue.

The delete boundary must be a single Tokyo-owned operation or must resolve the instance location once before deleting any dependency needed for cleanup.

### 3.6 Derived Runtime Artifacts Are Active But Underdocumented

Tokyo currently writes derived runtime artifacts such as:

```text
accounts/{accountId}/widgets/{widgetType}/{instanceId}/published/config.json
accounts/{accountId}/widgets/{widgetType}/{instanceId}/l10n/base/{fingerprint}.snapshot.json
accounts/{accountId}/widgets/index.json
accounts/{accountId}/widgets/{widgetType}/{instanceId}/seo/meta/live/{locale}.json
accounts/{accountId}/widgets/{widgetType}/{instanceId}/seo/meta/{locale}/{metaFp}.json
```

These are not the old public copied tree, but they are active serving/generation artifacts. They must be classified explicitly as derived, rebuildable caches, moved to a clearer generated location, or removed.

They must never become source truth.

### 3.7 Legacy Supabase Widget Instance Schema Still Exists

Supabase migrations still create or mutate widget-instance tables and `public_id` constraints for old account widget truth.

Known offender classes include:

- `public.widget_instances`
- `public.curated_widget_instances`
- `public.widget_instance_overlays`
- widget l10n tables keyed by `public_id`
- constraints enforcing `wgt_curated_*`, `wgt_system_*`, or `wgt_*_u_*`

Application code may no longer read these tables, but the final applied schema still teaches a second identity model unless a hard-cut migration removes or tombstones it.

### 3.8 Stale Cache Matchers Remain In Venice

`venice/lib/tokyo.ts` still recognizes old `/l10n/instances/...` and `/renders/instances/...` paths.

Those matchers must either be updated to the new paths or removed if unused.

### 3.9 Logoshowcase Spec Still Uses Curated Source Vocabulary

`tokyo/product/widgets/logoshowcase/spec.json` still contains baked logo entries with `"source": "curated"`.

No active code should preserve `curated` as an account widget instance/product source concept. If the source field is unused, delete it. If it is useful, rename it to a surviving authority such as `platform` or `admin`.

### 3.10 Roma Duplicable Default Surface Is Undecided

PRD 088 described admin-owned instances as normal account instances and allowed a platform-owned catalog only if Roma still needed starter examples.

No `product/catalog/roma-duplicable-instances.json`, Roma default endpoint, or default gallery exists. PRD 089 must force this product decision:

1. Build the platform catalog and Roma surface using admin-owned `ins_*` account instances, or
2. Explicitly declare starter browsing out of scope and remove active docs/UX expectations that imply it exists.

### 3.11 Active Documentation Still Names Dead Product Concepts

Active docs still mention public ID, curated starter/system instances, `/e`, or `systemInstanceRef`.

Known stale docs include:

- `documentation/strategy/WhyClickeen.md`
- `documentation/strategy/Clickeen-Babel.md`
- `documentation/capabilities/localization.md`
- `documentation/capabilities/seo-geo.md`
- `documentation/ai/BUILD_PraguePage.md`
- `documentation/ai/overview.md`
- `documentation/widgets/WidgetPraguePagesBuilder.md`
- `documentation/widgets/WidgetBuildContract.md`
- `documentation/widgets/WidgetComplianceSteps.md`
- `documentation/widgets/WidgetArchitecture.md`
- `documentation/services/venice.md`

PRD 088 allowed stale names only in historical executed docs or migration reports. These are active docs and must be corrected.

## 4. Goals

1. Make `instanceId` the only active widget authoring/runtime/embed identifier.
2. Remove `publicId` from active widget runtime, Bob preview payloads, Tokyo widget assets, Venice runtime helpers, Roma account-instance APIs, and shared contracts.
3. Replace legacy l10n instance routes with account-widget l10n routes.
4. Stop base-locale overlay creation and repair any existing base-locale overlays.
5. Make account instance deletion one reliable Tokyo-owned boundary.
6. Classify, move, or remove derived runtime artifacts so the source-of-truth model is explicit.
7. Hard-cut legacy Supabase widget instance schema that contradicts one `instanceId`.
8. Remove stale active docs and stale verification blind spots from PRD 088.
9. Resolve the admin-owned duplicable starter surface decision without reintroducing fake starter/product identities.

## 5. Non-Goals

1. Do not design a new widget storage topology.
2. Do not reintroduce starter, curated, system, demo, or public instance product identities.
3. Do not create compatibility aliases for `publicId`.
4. Do not make preview a second widget truth.
5. Do not move Prague page translations into account widget overlays.
6. Do not implement entitlement downgrade enforcement here unless it is necessary to prevent a PRD 089 regression. Downgrade enforcement remains owned by the follow-up PRD 088B track, but PRD 089 must not make it harder.
7. Do not build a starter gallery unless Slice 8 explicitly confirms that Roma still needs one for the current product.

## 6. Execution Slices

### Slice 0 - Evidence Refresh And Scope Lock

Before editing product code, rerun the stale-contract scan across active code and docs.

Required scan scope:

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

Required search patterns:

```text
publicId
public_id
data-ck-public-id
wgt_curated
wgt_system
systemInstanceRef
curatedRef
/e/
/r/
/l10n/instances
/l10n/v/*/instances
/renders/instances
public/instances
accounts/{accountId}/instances
widget_instances
curated_widget_instances
widget_instance_overlays
source": "curated"
```

Slice 0 output must be an execution note listing every active offender and whether it will be deleted, renamed, migrated, or intentionally preserved as historical documentation.

Supabase migration history is special: old migration files may still contain old names, but the final applied schema must not. Slice 0 must distinguish historical migration text from final schema truth.

### Slice 1 - Widget Runtime ID Contract Closure

Replace the widget runtime contract with `instanceId`.

Required changes:

1. Rename active widget runtime inputs from `publicId` to `instanceId`.
2. Replace `data-ck-public-id` with `data-ck-instance-id` only where a data attribute is still needed.
3. Replace `window.CK_WIDGET.publicId` reads with `window.CK_WIDGET.instanceId`.
4. Replace `CK_WIDGETS[publicId]` access with either `CK_WIDGET.state` or `CK_WIDGETS[instanceId]`, then delete the legacy map path if it is not needed.
5. Update `ck:ready`, `ck:state-update`, copy override, typography, branding, and locale-switcher messages to use `instanceId`.
6. Remove `publicId` aliases and fallback branches after all active callers are migrated.

Affected files are expected to include:

- `bob/components/Workspace.tsx`
- `tokyo/product/widgets/shared/previewL10n.js`
- `tokyo/product/widgets/shared/stagePod.js`
- `tokyo/product/widgets/shared/typography.js`
- `tokyo/product/widgets/shared/branding.js`
- `tokyo/product/widgets/shared/localeSwitcher.js`
- `tokyo/product/widgets/faq/widget.client.js`
- `tokyo/product/widgets/countdown/widget.client.js`
- `tokyo/product/widgets/logoshowcase/widget.client.js`

Exit criteria:

```bash
rg -n "publicId|public_id|data-ck-public-id|CK_WIDGET\\.publicId" tokyo/product/widgets bob roma venice prague packages
```

must return no active product-code matches.

### Slice 2 - Preview, Dev Server, And Runtime L10n Route Closure

Remove legacy l10n route usage from preview/runtime code.

Required changes:

1. Delete all fetches to `/l10n/instances/...`.
2. Use the Tokyo account-widget l10n read contract:

```text
/l10n/widgets/{instanceId}/index.json
/l10n/widgets/{instanceId}/{locale}/overlay.json
```

3. Preview l10n must request overlays by `instanceId`.
4. For base locale preview, do not fetch a base overlay.
5. For missing non-base overlays, fail visibly at the preview boundary or return an explicit missing-translation state. Do not silently normalize into a new product truth.
6. Update `tokyo/dev-server.mjs` so local dev routes and proxies recognize `/l10n/widgets/...`, not `/l10n/instances/...`.
7. Delete any `/l10n/v/{version}/instances/...` legacy matching unless there is a current versioned widgets route that must be preserved under `/l10n/v/{version}/widgets/...`.

Exit criteria:

```bash
rg -n "/l10n/instances|/l10n/v/.*/instances|/renders/instances" bob roma venice prague tokyo-worker tokyo/dev-server.mjs tokyo/product/widgets packages
```

must return no active runtime-code matches.

### Slice 3 - Base Locale Overlay Elimination

Stop base-locale overlay writes and repair stored residue.

Required changes:

1. In account instance sync, skip `upsertL10nOverlay` when `locale === baseLocale`.
2. Ensure l10n read/index code does not advertise base locale overlays even if stale objects exist.
3. Add an audit/repair command that:
   - scans account widget instance overlays,
   - identifies overlays where locale equals the instance base locale,
   - deletes those base-locale overlay objects,
   - writes a report under `Execution_Pipeline_Docs/03-Executed/` only after execution.
4. Add targeted tests for base-locale overlay prevention.

Exit criteria:

1. Saving or syncing an English-base instance with English active locale does not write `overlays/l10n/en/overlay.json`.
2. A non-base locale still writes `overlays/l10n/{locale}/overlay.json`.
3. The l10n index does not list the base locale as an overlay locale.

### Slice 4 - Delete Boundary Atomicity

Make account instance deletion reliable and Tokyo-owned.

Required changes:

1. Replace Roma's split saved-delete and live-delete flow with one boundary.
2. Either:
   - add a Tokyo internal endpoint that deletes the account instance source and published lookup in one operation, or
   - reuse an existing Tokyo operation that already deletes the account instance folder and `published/widgets/{instanceId}.json` deterministically.
3. Resolve account/widget/instance location before deleting any object needed for cleanup.
4. Rebuild the account widget index after source deletion.
5. Deleting an unpublished instance and deleting a published instance must both be idempotent.

Exit criteria:

1. Deleting a published instance removes:

```text
accounts/{accountId}/widgets/{widgetType}/{instanceId}/...
published/widgets/{instanceId}.json
```

2. Repeating delete returns a controlled not-found/idempotent response, not a partial-failure stack.
3. There is no Roma-side `Promise.all` that races source deletion against live lookup deletion.

### Slice 5 - Derived Artifact Contract

Decide and document the fate of current derived artifacts.

Known artifacts:

```text
accounts/{accountId}/widgets/index.json
accounts/{accountId}/widgets/{widgetType}/{instanceId}/published/config.json
accounts/{accountId}/widgets/{widgetType}/{instanceId}/l10n/base/{fingerprint}.snapshot.json
accounts/{accountId}/widgets/{widgetType}/{instanceId}/seo/meta/live/{locale}.json
accounts/{accountId}/widgets/{widgetType}/{instanceId}/seo/meta/{locale}/{metaFp}.json
```

Allowed outcomes:

1. Keep them as derived caches, but document:
   - who writes them,
   - who reads them,
   - how to rebuild them,
   - why they are not source truth.
2. Move them under an explicit generated namespace.
3. Remove them and make readers use the account source plus serving lookup directly.

Disallowed outcome:

- Leaving them undocumented while PRD 088 says the account instance target shape is closed.

Exit criteria:

1. `documentation/architecture/CONTEXT.md` explains the source tree and any derived account-instance artifacts.
2. A rebuild/audit command exists for kept derived artifacts.
3. No generated artifact is required to determine account instance identity, ownership, base config truth, or publish truth.
4. `seo/meta` is either documented as a generated per-instance serving namespace or moved to a clearer generated/serving location.

### Slice 6 - Supabase Legacy Widget Schema Hard Cut

Remove the final applied Supabase schema's legacy widget-instance source of truth.

Required changes:

1. Audit active application, RPC, trigger, policy, and migration consumers for legacy widget instance tables.
2. Add a new hard-cut migration, timestamped at execution time, that drops or tombstones legacy account widget instance tables that no active runtime uses.
3. Expected drop candidates include:

```text
public.widget_instances
public.curated_widget_instances
public.widget_instance_overlays
public.widget_instance_locales
public.l10n_publish_state
public.l10n_overlay_versions
public.l10n_base_snapshots
public.instance_enforcement_state
public.instance_render_health
```

4. Drop dependent policies, triggers, grants, functions, indexes, and constraints with the tables.
5. If any table cannot be dropped because a current product path still depends on it, PRD 089 execution must stop and name the surviving authority before proceeding.
6. Do not keep `public_id` as a second account widget instance identity.

Exit criteria:

1. Applying migrations to a fresh local database succeeds.
2. A final schema dump has no account widget instance table with `public_id`, `wgt_curated_*`, or `wgt_system_*` constraints.
3. Active app code still has zero reads or writes to the dropped tables.
4. The execution report lists the final migration name and the schema-dump verification command.

### Slice 7 - Venice Cache And Route Residue Cleanup

Remove or update old Tokyo path matchers in Venice.

Required changes:

1. Delete matchers for `/l10n/instances/...` and `/renders/instances/...`.
2. Add matchers for current paths only if Venice still needs per-path cache behavior:

```text
/l10n/widgets/{instanceId}/...
/renders/widgets/{instanceId}/...
```

3. Verify `/widget/{instanceId}` still serves live published embeds.

Exit criteria:

```bash
rg -n "/l10n/instances|/renders/instances|/e/|/r/" venice
```

must return no active-code matches.

### Slice 8 - Default Surface And Data Vocabulary Decision

Resolve the last non-code product vocabulary gaps without inventing a fake default mode.

Required changes:

1. Clean `tokyo/product/widgets/logoshowcase/spec.json` so baked entries do not use `"source": "curated"` as product vocabulary.
2. If the `source` field is unused, delete it.
3. If the `source` field is needed, rename it to a surviving concept such as `platform` or `admin`.
4. Decide whether Roma needs admin-owned duplicable examples in the current product.
5. If yes, create the smallest platform-owned catalog and Roma read surface that points to real admin-owned `ins_*` account instances.
6. If no, remove active docs and UX expectations that imply a starter gallery exists today.

Exit criteria:

1. `rg -n '"source"\\s*:\\s*"curated"' tokyo/product/widgets` returns no active matches.
2. There is either a real Roma starter/catalog path backed by admin-owned `ins_*` instances or an explicit execution-report decision that starter browsing is out of scope for PRD 089.
3. No new `starter`, `template`, `curated`, or `system` product identity is introduced.

### Slice 9 - Documentation And Scan Closure

Update active docs so they match the product that exists.

Required docs:

- `documentation/architecture/CONTEXT.md`
- `documentation/strategy/WhyClickeen.md`
- `documentation/strategy/Clickeen-Babel.md`
- `documentation/capabilities/localization.md`
- `documentation/capabilities/seo-geo.md`
- `documentation/ai/BUILD_PraguePage.md`
- `documentation/ai/overview.md`
- `documentation/ai/widget-copilot-rollout.md`
- `documentation/widgets/WidgetPraguePagesBuilder.md`
- `documentation/widgets/WidgetBuildContract.md`
- `documentation/widgets/WidgetComplianceSteps.md`
- `documentation/widgets/WidgetArchitecture.md`
- `documentation/widgets/FAQ/FAQ_PRD.md`
- `documentation/widgets/Countdown/Countdown_PRD.md`
- `documentation/services/roma.md`
- `documentation/services/tokyo.md`
- `documentation/services/venice.md`

Required corrections:

1. Replace starter/curated/system instance language with account widget instance language.
2. Replace `publicId` with `instanceId`.
3. Remove `/e` and `/r` embed references.
4. Replace `systemInstanceRef` with `accountInstanceRef` where the doc describes active Prague page data.
5. Clearly state that Prague page translations and account widget overlays are separate localization domains.
6. Replace old SEO/GEO render examples with the current route and storage contract, or mark SEO/GEO storage as explicitly deferred if Slice 5 moves/removes it.
7. Keep competitor-analysis scraped assets out of product-contract scans, or mark them as third-party historical references.

Allowed stale matches after execution:

1. Historical PRDs in `Execution_Pipeline_Docs/03-Executed/`.
2. Migration reports in `Execution_Pipeline_Docs/03-Executed/`.
3. Explicitly marked historical notes.

No active docs may preserve dead product identity.

## 7. Required Tests And Verification

### 7.1 Static Verification

Run:

```bash
rg -n "publicId|public_id|data-ck-public-id|CK_WIDGET\\.publicId" bob roma venice prague tokyo-worker tokyo/dev-server.mjs tokyo/product/widgets packages documentation --glob '!Execution_Pipeline_Docs/03-Executed/**'
rg -n "wgt_curated|wgt_system|systemInstanceRef|curatedRef|/l10n/instances|/l10n/v/.*/instances|/renders/instances|public/instances|accounts/\\{accountId\\}/instances" bob roma venice prague tokyo-worker tokyo/dev-server.mjs tokyo/product/widgets packages documentation --glob '!Execution_Pipeline_Docs/03-Executed/**'
rg -n "/e/|/r/" bob roma venice prague tokyo-worker tokyo/dev-server.mjs tokyo/product/widgets packages documentation --glob '!Execution_Pipeline_Docs/03-Executed/**'
rg -n '"source"\\s*:\\s*"curated"' tokyo/product/widgets
```

All active matches must be either removed or documented in the execution report as intentionally historical.

For Supabase, do not use old migration-file text as the final pass/fail signal. Apply migrations locally and verify the final schema:

```bash
supabase db reset
supabase db dump --schema-only --local | rg -n "widget_instances|curated_widget_instances|widget_instance_overlays|public_id|wgt_curated|wgt_system"
```

The final schema scan must have no legacy account widget instance source-truth matches. If the local Supabase command is unavailable, use the repo's accepted schema-dump workflow and document it.

### 7.2 Unit And Integration Verification

At minimum:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

If full workspace verification is too slow or blocked, run the targeted package checks first and document the blocker.

Expected targeted checks:

```bash
pnpm --filter @clickeen/bob lint
pnpm --filter @clickeen/roma lint
pnpm --filter @clickeen/venice lint
pnpm --filter @clickeen/tokyo-worker test
```

Use the package names that exist at execution time.

### 7.3 Product Path Verification

The executor must verify these flows:

1. Open an account widget in Roma.
2. Bob loads the widget with `instanceId`.
3. Edit and save base locale.
4. Confirm Tokyo writes source config and instance metadata under the account widget path.
5. Confirm base locale does not create an overlay.
6. Switch to a non-base locale, save, and confirm overlay is written under `overlays/l10n/{locale}/overlay.json`.
7. Publish the widget.
8. Confirm Venice serves `/widget/{instanceId}`.
9. Confirm local Tokyo dev preview uses `/l10n/widgets/{instanceId}/...`, not `/l10n/instances/...`.
10. Render two instances of the same widget type on one page and confirm runtime messages remain instance-scoped.
11. Unpublish the widget.
12. Confirm `published/widgets/{instanceId}.json` is removed.
13. Delete the widget instance.
14. Confirm source tree and published lookup are removed without race or partial failure.
15. Apply Supabase migrations locally and confirm final schema no longer exposes legacy account widget instance identity.

## 8. Execution Report Requirements

Execution must produce:

```text
Execution_Pipeline_Docs/03-Executed/089__Execution_Report.md
```

The report must include:

1. Before/after stale scan results.
2. Files changed by slice.
3. Any derived artifacts kept and their rebuild/audit command.
4. R2 repair report path for base-locale overlay cleanup.
5. Supabase hard-cut migration name and final schema verification.
6. Roma starter/catalog decision and any product surface implemented or explicitly deferred.
7. Verification commands and results.
8. Known residual risks, if any.

PRD 089 may move to `03-Executed/` only after canonical docs are updated.

## 9. Exit Criteria

PRD 089 is complete only when all of the following are true:

1. Active product code has no `publicId` contract.
2. Active product code has no `/l10n/instances` or `/renders/instances` route usage.
3. Base locale overlays are neither written nor advertised.
4. Existing base-locale overlay residue has been audited and repaired.
5. Published instance deletion is one reliable boundary and cannot race against itself.
6. Derived account-instance runtime artifacts are documented, rebuildable, and not source truth, or removed.
7. Final Supabase schema has no legacy account widget instance source tables or `public_id` account-widget identity.
8. Active widget data does not use `source: curated` as product vocabulary.
9. Roma starter browsing is either implemented against admin-owned `ins_*` instances or explicitly deferred with docs corrected.
10. Active documentation no longer describes starter/curated/system/public widget identities as product truth.
11. The PRD 088 verification scan is corrected so it includes `tokyo/product/widgets`, `tokyo/dev-server.mjs`, active docs, and final schema verification.
12. The real product path remains account opens widget in Roma, Bob edits, Roma saves to Tokyo, Venice serves published instance by `instanceId`.

## 10. First Review Questions

Before moving this PRD to `02-Executing`, review must answer:

1. Does this plan use elegant engineering and scale across hundreds of widgets?
2. Is it compliant with the account-widget instance storage authority from PRD 088?
3. Does it avoid compatibility layers that preserve dead product identities?
4. Does it move the product toward one authoring surface, one instance ID, and one Tokyo-owned storage contract?
5. Are the derived artifact decisions clear enough for an AI executor to implement without inventing a second truth?
