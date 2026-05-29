# PRD 105M - Tokyo Worker Instance Runtime Refactor

Status: Active execution sub-PRD
Owner: Product + Architecture
Date: 2026-05-28
Parent: `105__PRD__Instance_Folder_Tenets.md`
Depends on: `105A__PRD__DB_R2_Operation_Authority.md`, `105C__PRD__Tokyo_Runtime_Boundary_Verification.md`, `105D__PRD__Translation_Operation_State_And_Smoke_Verification.md`, `105E__PRD__Generic_Translation_Field_And_Agent_Contract_Verification.md`, `105F__PRD__Manual_Translation_Edit_And_Public_Materialization_Verification.md`, `105G__PRD__Translation_Workflow_State_And_Sync_Verification.md`, `105H__PRD__Execution_Verification_Protocol.md`, `105L__PRD__R2_Bucket_And_Widget_Package_Source_Cleanup.md` Phase A only

## Purpose

Refactor `tokyo-worker/src` so Tokyo-worker implements the current product boundary cleanly instead of preserving old generated-file and R2-operation-controller models.

Tokyo-worker should remain the service that owns account instance product operations:

```text
Roma/Bob -> Tokyo instance operations -> R2 source + Supabase operational state -> materialized public artifacts -> clk.live serving
```

This PRD is not a rewrite of Tokyo-worker. It is a disciplined cleanup of the pieces that violate PRD 105:

- `translation-generation-job.json` must disappear from account instance folders;
- generated public artifacts must become the PRD 105 shape;
- translated locale values must move toward `overlays/locales/{locale}.json`;
- route files must remain product adapters, not hidden architecture decision engines;
- tests must stop blessing obsolete artifact names and R2-as-ops behavior.

This is one of the only implementation PRDs in the 105 series. `105A` through `105H` are contracts/checklists, `105I`/`105J` are checkpoints, `105K` is audit/backlog reconciliation, and `105N` is future planning. Do not expand this PRD to implement automatic Babel, SEO/GEO, route modernization, or broad cleanup.

## Product Truth

Tokyo-worker is not a second product and not an agent brain.

Tokyo-worker is a product boundary service:

- account asset operations;
- account instance create/open/save/rename/duplicate/delete;
- publish/unpublish and materialization;
- widget definition reads;
- translation generation command/read/complete/fail boundaries;
- public artifact serving for `clk.live`.

Tokyo-worker must not use account instance folders as backend operation ledgers.

## Source Evidence Reviewed

Current `tokyo-worker/src` contains 43 TypeScript files and tests.

The major findings:

```text
tokyo-worker/src/domains/render/keys.ts
  still defines translation-generation-job.json

tokyo-worker/src/domains/render/translation-generation-state.ts
  persists active generation state in that R2 job JSON

tokyo-worker/src/domains/render/translation-operations.ts
  generates/reads/completes/fails translation work through the R2 job JSON

tokyo-worker/src/domains/render/public-artifacts.ts
  still materializes script.js, script.{locale}.js, script.v*.js, styles.v*.css, and {locale}.html

tokyo-worker/src/routes/clk-live-routes.ts
  still allowlists old per-locale HTML/script artifacts

tokyo-worker/src/domains/render/saved-config.ts
  writes base source correctly as instance.config.json + instance.content.json,
  and before Slice 2 translated locale values were still embedded in instance.content.json
```

## Surviving Instance Folder Contract

This PRD must make Tokyo-worker converge on:

```text
accounts/{accountPublicId}/instances/{instanceId}/
  instance.config.json
  instance.content.json
  overlays/
    locales/
      {locale}.json
  index.html
  styles.css
  runtime.js
```

Forbidden as final generated/source/operation shape:

```text
translation-generation-job.json
script.js
script.{locale}.js
script.v{n}.js
script.v{n}.{locale}.js
styles.v{n}.css
{locale}.html
instance.json
instances/index.json
publish.json
```

## Architecture Rules

### Rule 1 - R2 Source Is Not Operation State

R2 may store:

- account assets;
- instance source files;
- durable locale overlay values;
- generated public browser files;
- product deploy assets.

R2 must not store:

- active job ownership;
- queue progress;
- worker liveness;
- retry state;
- active generation controller state.

### Rule 2 - Supabase Owns Operational State

Supabase is the surviving home for operation state such as:

- instance publish status;
- coarse translation status;
- the required PRD 105 translation operation ledger/outbox rows from `105D`.

If a state exists only to decide what a backend service should do next, it belongs in DB-backed operation state, not in the instance folder.

### Rule 3 - Locale Translations Are Overlays

A translated locale is product data, not a job artifact.

Surviving storage:

```text
overlays/locales/{locale}.json
```

The overlay stores durable translated values and sync metadata for that locale using the v1 schema in PRD 105. It must not store queue/controller state.

### Rule 4 - Public Artifacts Are Simple

Materialization produces:

```text
index.html
styles.css
runtime.js
```

Locale selection must be handled by runtime behavior and/or locale overlay loading, not by emitting one HTML and one JS file per locale by default.

### Rule 5 - Tokyo Routes Stay Thin

Route files validate HTTP, auth, request shape, and call domain operations.

They must not become the place where storage architecture is invented.

## File-Level Blast Radius

### Keep As Product Boundary / Platform Plumbing

| File | Action |
| --- | --- |
| `tokyo-worker/src/index.ts` | Keep. Worker entrypoint and explicit non-consumer queue boundary are correct. |
| `tokyo-worker/src/route-dispatch.ts` | Keep. Simple dispatch is correct. |
| `tokyo-worker/src/http.ts` | Keep. Request logging, request ids, JSON responses, and CORS belong here. |
| `tokyo-worker/src/types.ts` | Keep. Env bindings are required. |
| `tokyo-worker/src/supabase.ts` | Keep. Thin Supabase REST helper is required. |
| `tokyo-worker/src/auth.ts` | Keep. Roma capsule and internal service auth are required. |
| `tokyo-worker/src/route-helpers.ts` | Keep, prune unused helpers only if proven unused. |
| `tokyo-worker/src/instance-identity.ts` | Keep or inline. It is harmless compact identity validation. |

### Keep As Account Asset / Product Asset Boundary

| File | Action |
| --- | --- |
| `tokyo-worker/src/asset-utils.ts` | Keep, later split by concern if useful. Do not change behavior unless needed for PRD 105L/105M. |
| `tokyo-worker/src/domains/assets.ts` | Keep. Account asset source is valid. |
| `tokyo-worker/src/domains/assets-handlers.ts` | Keep. Upload/list/resolve/delete account assets are valid. |
| `tokyo-worker/src/routes/asset-routes.ts` | Keep. Thin asset route adapter is valid. |

### Keep As Widget Definition Boundary

| File | Action |
| --- | --- |
| `tokyo-worker/src/domains/widget-catalog.ts` | Keep. This is the correct generic widget source boundary. |
| `tokyo-worker/src/generated/widget-definition-sources.ts` | Keep generated. It is not product state. |

### Refactor Instance Source / Materialization

| File | Required action |
| --- | --- |
| `tokyo-worker/src/domains/render/keys.ts` | Keep config/content/root helpers. Delete `accountInstanceTranslationGenerationJobKey`. Add overlay locale key helpers. |
| `tokyo-worker/src/domains/render/types.ts` | Keep instance/config/content types. Replace R2 job document types with DB operation summary/product state types. Add locale overlay document type. |
| `tokyo-worker/src/domains/render/normalize.ts` | Keep config/content normalization. Add locale overlay normalization. Remove normalization of obsolete job-document storage once DB operation state replaces it. |
| `tokyo-worker/src/domains/render/storage.ts` | Keep generic R2 JSON helpers. Do not use them for operation controller state. |
| `tokyo-worker/src/domains/render/saved-config.ts` | Keep and split if needed. Preserve `instance.config.json` + `instance.content.json`. Move translated locale values out of embedded field maps into locale overlay operations. |
| `tokyo-worker/src/domains/render/translated-locales.ts` | Keep API concept. Rewrite storage to read/write `overlays/locales/{locale}.json`. |
| `tokyo-worker/src/domains/render/public-artifacts.ts` | Keep concept, rewrite output. Must materialize `index.html`, `styles.css`, `runtime.js`; must stop emitting per-locale HTML/JS and versioned public aliases. |
| `tokyo-worker/src/domains/render/account-instance-transitions.ts` | Keep product operations. Update cache purge and publish/unpublish cleanup for `runtime.js`, `styles.css`, `index.html`, and overlay-aware materialization. |
| `tokyo-worker/src/domains/render/instance-registry.ts` | Keep. Supabase registry is correct DB pivot direction. |
| `tokyo-worker/src/domains/render/instance-delete.ts` | Keep. Delete whole instance subtree plus DB registry row remains valid. |
| `tokyo-worker/src/domains/render/index.ts` | Keep optional barrel. Avoid hiding architecture decisions behind it during refactor. |
| `tokyo-worker/src/domains/render/r2-object.ts` | Delete if still unused after grep. Do not preserve dead helper files. |
| `tokyo-worker/src/domains/render/test-instance-registry.ts` | Keep test helper. |

### Refactor Translation Operation State

| File | Required action |
| --- | --- |
| `tokyo-worker/src/domains/render/translation-generation-state.ts` | Do not keep as R2 persistence. Extract pure summary/locale-state derivation if still useful. Delete R2 job JSON read/write/update functions. |
| `tokyo-worker/src/domains/render/translation-operations.ts` | Keep generate/read/complete/fail product operations, but move active operation state out of `translation-generation-job.json`. Use DB-backed operation state/outbox per 105A/105D/105G. |

### Refactor Routes

| File | Required action |
| --- | --- |
| `tokyo-worker/src/routes/internal-render-routes.ts` | Keep route surface, then split after behavior is green. It currently mixes instances, publish, translation, and widget definitions in one 782-line router. |
| `tokyo-worker/src/routes/clk-live-routes.ts` | Keep public serving route. Update allowlist/cache policy to PRD 105 public artifacts. Remove `{locale}.html` and `script.{locale}.js` serving as default model. |

### Tests To Keep But Rewrite

| Test file | Required action |
| --- | --- |
| `tokyo-worker/src/account-assets-contract.test.ts` | Keep. |
| `tokyo-worker/src/route-helpers.test.ts` | Keep. |
| `tokyo-worker/src/domains/assets-handlers.test.ts` | Keep. |
| `tokyo-worker/src/routes/asset-routes.test.ts` | Keep. |
| `tokyo-worker/src/routes/clk-live-routes.test.ts` | Rewrite assertions that bless `script.it.js` or per-locale public files. |
| `tokyo-worker/src/routes/internal-render-routes.test.ts` | Keep, update materialized artifact expectations. |
| `tokyo-worker/src/domains/render/public-artifacts.test.ts` | Rewrite around `index.html`, `styles.css`, `runtime.js`, and overlays. |
| `tokyo-worker/src/domains/render/saved-config.test.ts` | Keep source split tests. Update generated artifact and translation storage assumptions. |
| `tokyo-worker/src/domains/render/translated-locales.test.ts` | Rewrite storage assertions for `overlays/locales/{locale}.json`. |
| `tokyo-worker/src/domains/render/translation-operations.test.ts` | Keep product-state tests. Delete any expectation that `translation-generation-job.json` exists. |

## Required New/Adjusted Internal Modules

Implementation may add small modules only if they reduce complexity and match this taxonomy.

Allowed additions:

```text
tokyo-worker/src/domains/render/locale-overlays.ts
tokyo-worker/src/domains/render/materialization-files.ts
tokyo-worker/src/domains/render/translation-operation-ledger.ts
```

Rules:

- `locale-overlays.ts` may own R2 read/write of `overlays/locales/{locale}.json`.
- `materialization-files.ts` may own artifact filenames and allowlists.
- `translation-operation-ledger.ts` may own DB-backed translation operation reads/writes if not better placed in existing DB module.

Forbidden additions:

- no R2 ops shim;
- no local scripts that manually mutate production R2 as product flow;
- no compatibility reader for `translation-generation-job.json` unless explicitly timeboxed and deleted in the same execution PRD;
- no alias routing for old public artifact names.

## Execution Slices

Do not execute this PRD as one large patch.

### Slice 0 - Operation Store And Public Serving Boundary Lock

Before editing runtime behavior, name the exact surviving boundary decisions for this implementation.

Required decisions:

1. Translation operation state store.
2. San Francisco callback contract.
3. Bob/Roma translation product summary response shape.
4. Public serving owner and public-safe artifact allowlist.
5. Existing translated value migration/backfill approach.

Default operation-store direction:

```text
Use the Supabase-backed translation_generation_operations and
translation_generation_operation_locales shape defined in 105D.
Keep instances.translation_status as coarse liveness only.
Do not create a broad job-history/workflow platform.
```

If execution proposes any deviation from the `105D` minimum schema, it must amend `105D` and this PRD before code changes. Slice 0 is not a design sprint.

Public serving boundary gate:

- verify which deployed service currently owns `clk.live` / `dev.clk.live`;
- update the relevant serving allowlist for `index.html`, `styles.css`, `runtime.js`, and public-safe overlay access if overlay fetch is public;
- prove private source files and operation state are denied;
- document whether the active code path is Tokyo-worker, Venice, or a handoff between them before implementation proceeds.

Existing data migration/backfill gate:

- if current translated values live in `instance.content.json`, decide whether pre-GA data is migrated into locale overlays, regenerated, or discarded;
- do not silently preserve embedded `translatedValues` as the new primary truth;
- record the decision in the execution note before Slice 2 begins.

Green gate:

- implementation store/boundary decisions are written in the execution note;
- migration file for the operation ledger/outbox is drafted or explicitly mapped to an existing reviewed Supabase migration;
- no code has been changed to preserve R2 operation-controller JSON;
- no destructive R2 cleanup has run.

### Slice 1 - Artifact Name Authority

Create one shared artifact filename authority.

Target surviving public files:

```text
index.html
styles.css
runtime.js
```

Update:

- public artifact allowlist;
- public serving route;
- cache purge file set;
- public artifact tests.

Green gate:

- grep shows no required generation of `script.js`, `script.*.js`, `styles.v*.css`, or `{locale}.html`;
- tests prove `clk.live/{account}/{instance}` serves `index.html`;
- tests prove `clk.live/{account}/{instance}/runtime.js` is allowed;
- tests prove old generated locale/script files are not allowed.
- cloud-dev smoke proves all three published CLICKEEN Pre-GA instances load with `runtime.js` before Slice 2 begins.

Pre-GA canonical instance scope:

```text
CLICKEEN / UZ3JEJSHII / faq
CLICKEEN / 8FMVZFFPJV / logoshowcase
CLICKEEN / H7IF9M2K9B / countdown
```

These are not compatibility fixtures. They are the current dogfood/product proof instances. Slice 1 is not green until all three have been rematerialized through Tokyo's product materializer and all three public folders expose the canonical generated shape:

```text
index.html
styles.css
runtime.js
```

None of the three may depend on old public generated artifacts:

```text
script.js
script.{locale}.js
script.v*.js
styles.v*.css
{locale}.html
```

### Slice 2 - Locale Overlay Storage

Introduce `overlays/locales/{locale}.json` as translated locale value storage.

Required overlay document shape:

```json
{
  "v": 1,
  "locale": "it",
  "baseContentMarker": "sha256:v1:...",
  "widgetContractHash": "sha256:v1:...",
  "status": "inSync",
  "values": {
    "sections.0.faqs.0.question": "..."
  },
  "updatedAt": "2026-05-28T00:00:00.000Z"
}
```

Failure state may add `reasonKey` and `detail`. No operation-controller fields are allowed.

Green gate:

- write translated values writes the locale overlay file;
- read translated values reads the locale overlay file;
- listing reviewable locales derives from complete valid locale overlays;
- `instance.content.json` no longer stores new `translatedValues` maps as the primary locale value authority.

### Slice 3 - Materialization Rewrite

Rewrite materialization to derive public artifacts from:

```text
instance.config.json
instance.content.json
overlays/locales/{locale}.json
product/widgets/{widgetType}/
accounts/{accountPublicId}/assets/
```

Green gate:

- publish creates only `index.html`, `styles.css`, and `runtime.js` as public files;
- generated runtime can render base content;
- generated runtime can resolve selected locale overlay without per-locale HTML/JS output;
- if overlay fetch is public, it uses a sanitized public allowlist documented in Slice 0; otherwise overlays are private and materialized into public-safe runtime data;
- visitor-safe assertions remain in place.

### Slice 4 - Translation Operation State Out Of R2

Delete `translation-generation-job.json` as active operation storage.

Green gate:

- no source file writes `translation-generation-job.json`;
- no test expects `translation-generation-job.json`;
- generate/read/complete/fail operate through the Supabase-backed operation state defined in `105D`;
- the DB-backed operation state conforms to `105D` unless the PRD was amended before implementation;
- Supabase coarse `instances.translation_status` remains consistent with product summary;
- stale jobs are rejected by marker, not by R2 job document lineage.

### Slice 5 - Route Split After Behavior Is Green

After Slices 1-4 pass, split `internal-render-routes.ts` by product area if it lowers risk:

```text
internal-instance-routes.ts
internal-publish-routes.ts
internal-translation-routes.ts
internal-widget-definition-routes.ts
```

Green gate:

- route behavior is unchanged except for intentional PRD 105 artifact/storage changes;
- route dispatch remains simple;
- tests cover each route family.

## Deletion Map

Delete from source behavior:

```text
accountInstanceTranslationGenerationJobKey()
readCurrentTranslationGenerationJob() R2 implementation
writeCurrentTranslationGenerationJob() R2 implementation
updateCurrentTranslationGenerationJob() R2 implementation
publicArtifactLocaleHtmlFile()
publicArtifactLocaleScriptFile()
publicArtifactBaseScriptFile()
publicArtifactStylesheetFile()
versioned public artifact generation
per-locale public HTML generation
per-locale public JS generation
```

Delete from tests:

```text
expectations for translation-generation-job.json
expectations for script.it.js
expectations for it.html
expectations for styles.v*.css
expectations for script.v*.js
```

Delete from deployed account instance folders only after code no longer recreates them:

```text
translation-generation-job.json
script.js
script.{locale}.js
script.v*.js
script.v*.{locale}.js
styles.v*.css
{locale}.html
```

## Non-Scope

This PRD does not:

- redesign San Francisco provider logic;
- change widget package source beyond what 105L covers;
- introduce automatic generate-on-save;
- introduce SSE/push UI updates;
- create a Prague-specific embed path;
- create account slugs, aliases, or redirects;
- preserve backwards compatibility for pre-GA obsolete R2 shapes.

## Acceptance Criteria

### Static Evidence

These greps must be clean or intentionally limited to historical docs:

```text
rg "translation-generation-job\\.json" tokyo-worker/src
rg "script\\.[a-z0-9-]+\\.js|script\\.v|styles\\.v|[a-z0-9-]+\\.html" tokyo-worker/src/domains/render tokyo-worker/src/routes
rg "translatedValues" tokyo-worker/src/domains/render
```

Allowed `translatedValues` references after Slice 2 must be compatibility-only if needed, timeboxed, and not the primary write path.

### Runtime Evidence

Publishing one FAQ instance creates:

```text
accounts/{accountPublicId}/instances/{instanceId}/index.html
accounts/{accountPublicId}/instances/{instanceId}/styles.css
accounts/{accountPublicId}/instances/{instanceId}/runtime.js
```

Publishing must not create:

```text
accounts/{accountPublicId}/instances/{instanceId}/it.html
accounts/{accountPublicId}/instances/{instanceId}/script.it.js
accounts/{accountPublicId}/instances/{instanceId}/translation-generation-job.json
```

Generating an Italian translation creates or updates:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/it.json
```

### Product Evidence

- Bob opens and saves the same instance source Tokyo materializes.
- Public embed renders the materialized output of that same source.
- Translation review reads locale product state by locale, not queue inventory.
- Public serving does not expose private source files or operation state.

### Test Evidence

Run and keep green:

```text
pnpm --filter @clickeen/tokyo-worker test
pnpm typecheck
pnpm validate:widgets
```

If a command name differs in the workspace, use the actual package script and document the replacement in the execution note.

## Execution Notes

### 2026-05-28 - Slice 0 Boundary Lock

Status: Green for Slice 0 only. Do not treat the full PRD as executed.

Runtime behavior was not changed in this slice. No R2 objects were deleted. The purpose of this slice was to lock the surviving operation/storage/public-serving decisions before later code edits.

Slice 0 changed only:

```text
supabase/migrations/20260528120000__prd105_translation_generation_operations.sql
Execution_Pipeline_Docs/02-Executing/105M__PRD__Tokyo_Worker_Instance_Runtime_Refactor.md
```

The worktree also contains earlier 105A Berlin runtime edits that removed active `account_members` usage. Those edits are not part of 105M Slice 0 and must not be used as evidence that Slice 0 changed Tokyo-worker runtime behavior.

#### Decision 1 - Translation Operation Store

Use the PRD 105D Supabase-backed operation ledger/outbox:

```text
translation_generation_operations
translation_generation_operation_locales
```

`instances.translation_status` remains coarse liveness only: `idle`, `queued`, `running`, `failed`.

`account_public_id` in these rows is the compact account coordinate stored in `accounts.id`. No new `accounts.public_id`, alias, slug, or second account identity is introduced.

New migration drafted:

```text
supabase/migrations/20260528120000__prd105_translation_generation_operations.sql
```

The migration intentionally contains only:

- one operation row per Tokyo-accepted generation request;
- one per-locale row per target locale;
- per-locale enqueue state on the locale row;
- one partial unique index enforcing one active operation per account instance;
- active timeout/enqueue indexes;
- service-role-only RLS, matching the PRD 103 DB foundation;
- a composite FK from `(account_public_id, instance_id)` to `instances(account_id, id)` so operation rows cannot point at an instance owned by a different account.

No broad job history, workflow platform, analytics table, or queue dashboard was added.

#### Decision 2 - San Francisco Callback Contract

San Francisco remains a worker. It receives marker-bearing locale jobs and reports terminal locale outcomes to Tokyo.

Tokyo remains the authority for:

- active operation idempotency;
- base content marker apply/reject;
- stale callback terminal handling;
- operation timeout;
- durable locale overlay write after accepted completion.

Stale/non-applied Tokyo outcomes are terminal for San Francisco and must not become retry churn.

#### Decision 3 - Bob/Roma Product Summary Shape

Bob and Roma must continue to consume Tokyo translation product state, not queue inventory, R2 object presence, or local spinners.

The surviving product summary shape remains the PRD 105D/105G model:

- base locale;
- target locales;
- coarse active/idle/failed state;
- current `baseContentMarker`;
- current `generationRequestMarker` when active;
- per-locale product state: `missing`, `generating`, `inSync`, `outOfSync`, `failed`;
- `reviewable` true only for in-sync locales.

No UI should infer progress from queue rows, generated artifacts, or embedded translated fields.

#### Decision 4 - Public Serving Owner And Allowlist

Current cloud-dev serving owner is Tokyo-worker.

Production `clk.live` ownership is the same product/code path in Tokyo-worker source, but the repo-local deployment config only proves the `dev.clk.live/*` route. Production `clk.live` route ownership must be verified in Cloudflare before production execution or production smoke.

Evidence:

- `tokyo-worker/src/route-dispatch.ts` sends `clk.live` and `dev.clk.live` to `tryHandleClkLiveStaticRoutes`.
- `tokyo-worker/src/routes/clk-live-routes.ts` maps `/{accountPublicId}/{instanceId}[/{file}]` to `accounts/{accountPublicId}/instances/{instanceId}/{file}` in R2.
- `tokyo-worker/wrangler.toml` owns the `dev.clk.live/*` route for cloud-dev.
- `documentation/services/venice.md` says Venice is not the active public account-widget runtime.
- Prague embeds public coordinates only; it does not serve account-widget artifacts.

Current code still allowlists and materializes obsolete public files:

```text
script.js
script.{locale}.js
script.v*.js
script.v*.{locale}.js
styles.v*.css
{locale}.html
```

That is intentional remaining Slice 1 blast radius. Slice 0 does not patch it.

Target allowlist for Slice 1:

```text
index.html
styles.css
runtime.js
```

Locale overlays remain private source/product data by default. Later materialization must either bake public-safe locale data into generated runtime output or explicitly amend this PRD before exposing overlay fetches publicly.

Prague currently builds locale iframe URLs with `/{locale}.html`. Slice 1 must update Prague's public locale embed contract before deleting `{locale}.html` serving.

#### Decision 5 - Existing Translated Value Migration

Current code stores translated values in `instance.content.json`:

```text
fields[path].translatedValues[locale]
fields[path].localeStatus[locale]
localeSync[locale]
```

Slice 2 must move durable translated locale values and sync metadata to:

```text
overlays/locales/{locale}.json
```

Pre-GA backfill rule:

- migrate only complete, current embedded translated value maps into v1 locale overlays;
- recompute PRD 105 SHA-256 markers from current saved source and widget contract;
- discard stale, failed, incomplete, and job/controller state;
- do not preserve embedded `translatedValues` as the primary read/write path.

This is a migration from old product data shape to the new overlay shape, not a long-lived compatibility mode.

#### Verification Run

```text
rg -n "translation_generation_operations|translation_generation_operation_locales" supabase -S
pnpm --filter @clickeen/tokyo-worker typecheck
```

Result:

- no existing migration implemented the operation ledger before this slice;
- new migration now drafts the PRD 105D minimum ledger/outbox shape;
- Tokyo-worker typecheck passed after the migration-only change.

#### Still Not Green For 105A / Full 105M

This slice does not remove active legacy runtime code.

Known remaining blockers:

```text
tokyo-worker/src/domains/render/keys.ts
  accountInstanceTranslationGenerationJobKey()

tokyo-worker/src/domains/render/translation-generation-state.ts
  R2 read/write/update of translation-generation-job.json

tokyo-worker/src/domains/render/translation-operations.ts
  generate/read/complete/fail still use the R2 job document

tokyo-worker/src/domains/render/saved-config.ts
tokyo-worker/src/domains/render/translated-locales.ts
  RESOLVED BY SLICE 2: translated locale values now live in overlays/locales/{locale}.json

tokyo-worker/src/domains/render/public-artifacts.ts
tokyo-worker/src/routes/clk-live-routes.ts
prague/src/components/InstanceEmbed.astro
  public artifact shape still includes script.*, versioned files, and/or {locale}.html
  RESOLVED BY SLICE 1 LOCAL CHANGES; cloud-dev smoke still required before Slice 2.
```

Do not move to 105B while 105A is red. Continue with 105M Slice 1 only after accepting this Slice 0 boundary lock.

### 2026-05-28 - Slice 1 Artifact Filename Authority

Status: Local verification green after peer-verifier tightening. Cloud-dev smoke pending, so do not move to Slice 2 yet.

Slice 1 changed only the generated public artifact filename surface and tests:

```text
tokyo-worker/src/domains/render/materialization-files.ts
tokyo-worker/src/domains/render/public-artifacts.ts
tokyo-worker/src/domains/render/account-instance-transitions.ts
tokyo-worker/src/routes/clk-live-routes.ts
bob/lib/embed-snippets.ts
prague/src/components/InstanceEmbed.astro
prague/src/lib/markdown.ts
tokyo-worker/src/domains/render/public-artifacts.test.ts
tokyo-worker/src/domains/render/saved-config.test.ts
tokyo-worker/src/routes/clk-live-routes.test.ts
bob/lib/embed-snippets.test.ts
```

#### What Changed

Created one shared artifact filename authority:

```text
PUBLIC_INDEX_FILE = index.html
PUBLIC_STYLES_FILE = styles.css
PUBLIC_RUNTIME_FILE = runtime.js
isGeneratedPublicArtifactFile()
```

Materialization now writes only:

```text
index.html
styles.css
runtime.js
```

The generated `runtime.js` carries the base runtime state and any currently materialized locale states from the existing translated-value read path. This is still not the final overlay storage model; Slice 2 owns moving translated values to `overlays/locales/{locale}.json`.

Public serving now allowlists only:

```text
index.html
styles.css
runtime.js
```

The public route rejects old files even if they physically exist in R2:

```text
script.js
script.{locale}.js
script.v*.js
script.v*.{locale}.js
styles.v*.css
{locale}.html
```

Cache purge now targets only the canonical public files plus the canonical extensionless entry URL:

```text
/{accountPublicId}/{instanceId}
/{accountPublicId}/{instanceId}/
/{accountPublicId}/{instanceId}/index.html
/{accountPublicId}/{instanceId}/styles.css
/{accountPublicId}/{instanceId}/runtime.js
```

No R2 cleanup was run. Old deployed files may still physically exist until 105L Phase B, but the code no longer creates or serves them as public artifacts.

Tightening after Slice 1 verification:

- Bob copied script embeds now point to `runtime.js`; `script.js` would 404 under the new public allowlist.
- Generated `runtime.js` selects `?locale={locale}` when that locale exists in the runtime payload, sets `window.CK_WIDGET.locale/state`, and exposes `window.CK_LOCALE_POLICY.languages` for the existing widget locale switcher.
- Unpublish/delete removes both current generated files and obsolete pre-refactor generated files from the instance folder. Serving already rejects obsolete files, but deletion should not leave them behind during normal product transitions.
- Prague iframe embeds and validation now use the canonical public entry URL plus `?locale={locale}` for non-base locales. Prague no longer emits or validates `/{locale}.html`.

#### Local Verification Run

```text
pnpm --filter @clickeen/tokyo-worker test
pnpm --filter @clickeen/tokyo-worker typecheck
pnpm --filter @clickeen/bob test
pnpm --filter @clickeen/prague typecheck
pnpm validate:widgets
rg -n 'script\.js|script\.[a-z0-9-]+\.js|script\.v|styles\.v|publicArtifactLocale|localeFileStem|endsWith\("\.html"\)|endsWith\('\''\.html'\''\)' tokyo-worker/src/domains/render tokyo-worker/src/routes -S --glob '!**/*.test.ts'
rg -n 'script\.js|script\.[a-z0-9-]+\.js|script\.v|styles\.v|localePath' bob prague/src tokyo-worker/src/domains/render tokyo-worker/src/routes -S --glob '!**/*.test.ts'
```

Result:

- Tokyo-worker tests passed: 49/49.
- Tokyo-worker typecheck passed.
- Bob tests passed: 24/24.
- Prague typecheck passed.
- Widget validation passed: 3 widget sources valid.
- Source greps returned no active non-test references to old generated script/style/locale artifact generation, allowlist helpers, or Prague `localePath`.

Test files still contain old artifact filenames only as negative fixtures/assertions proving they are not generated, not served, or deleted during cleanup transitions. Bob internal compiler `.html` references are not public `clk.live` artifacts and are outside this slice.

#### Still Required Before Slice 2

Cloud-dev smoke must prove a published widget loads through:

```text
https://dev.clk.live/{accountPublicId}/{instanceId}
https://dev.clk.live/{accountPublicId}/{instanceId}/runtime.js
```

and that old public artifact paths return 404/null-equivalent:

```text
/{accountPublicId}/{instanceId}/script.js
/{accountPublicId}/{instanceId}/script.it.js
/{accountPublicId}/{instanceId}/it.html
/{accountPublicId}/{instanceId}/styles.v123.css
```

Do not start Slice 2 until this cloud-dev smoke is green after deployment.

#### Cloud-Dev Deployment Attempt

Commit deployed:

```text
2c97db54 feat(tokyo-worker): canonicalize public runtime artifacts
```

GitHub cloud-dev workflows completed successfully:

```text
cloud-dev workers deploy: success
cloud-dev roma app verify: success
cloud-dev prague app verify: success
cloud-dev surface reachability: success
```

Public-host smoke after deployment:

```text
https://dev.clk.live/CLICKEEN/UZ3JEJSHII                  200
https://dev.clk.live/CLICKEEN/UZ3JEJSHII/runtime.js       404
https://dev.clk.live/CLICKEEN/UZ3JEJSHII/styles.css       200
https://dev.clk.live/CLICKEEN/UZ3JEJSHII/script.js        404
https://dev.clk.live/CLICKEEN/UZ3JEJSHII/script.it.js     404
https://dev.clk.live/CLICKEEN/UZ3JEJSHII/it.html          404
https://dev.clk.live/CLICKEEN/UZ3JEJSHII/styles.v123.css  404
```

All three currently published CLICKEEN instances still have old materialized `index.html` output and no `runtime.js`:

```text
UZ3JEJSHII index 200 runtime 404 oldScriptInIndex true runtimeInIndex false
8FMVZFFPJV index 200 runtime 404 oldScriptInIndex true runtimeInIndex false
H7IF9M2K9B index 200 runtime 404 oldScriptInIndex true runtimeInIndex false
```

Interpretation:

- The deployed public route is enforcing the new allowlist; obsolete generated paths now return 404.
- Existing published account runtime files were not automatically rematerialized by deployment.
- Slice 1 cloud-dev smoke is not green until all three published CLICKEEN instances are rematerialized through the real publish/restore product operation and then prove `runtime.js` exists.
- Do not manually write R2 objects to satisfy this gate. Rematerialization must happen through Tokyo's product materializer via an authenticated product operation.

Blocked follow-up evidence:

- `tokyo.dev.clickeen.com` does not mount private product-control instance routes; it only mounts health and product asset routes. `POST https://tokyo.dev.clickeen.com/__internal/accounts/CLICKEEN/serving/restore-paid` returned `405`.
- `dev.clk.live` correctly blocks private product-control routes. `POST https://dev.clk.live/__internal/accounts/CLICKEEN/serving/restore-paid` returned `404`.
- Wrangler remote dev is not usable for this gate with the current worker config because `TOKYO_R2` has no `preview_bucket_name`; Wrangler refuses to bind the production R2 bucket in dev mode.
- No Roma browser session cookie is available in the execution environment, and the in-app browser automation tool required by the Browser skill is not exposed in this session.

Therefore the remaining green gate is intentionally blocked on one of the approved product paths:

```text
1. Use an authenticated Roma/Bob session to publish or republish all three CLICKEEN instances.
2. Or run an approved service-binding operation that calls Tokyo's restore/publish product operation.
```

Do not unblock this by uploading `runtime.js` or editing R2 objects directly.

#### Cloud-Dev Rematerialization Closure

The blocker above was resolved without direct R2 object writes.

Correction commits:

```text
bf49995a fix(tokyo-worker): keep github deploy route-neutral
b799f6b9 fix(tokyo-worker): allow visitor content to mention Venice
```

Why the second correction was required:

```text
FAQ customer content legitimately contains "Venice".
The old generated-artifact guard blocked the word /venice/i anywhere in visitor output.
That was not product truth; it prevented customer-visible content from materializing.
The guard was removed and the Tokyo materialization test now proves visitor content may mention Venice.
```

Route/product-operation evidence:

```text
Cloudflare route applied through local authenticated Wrangler deploy.
Current Version ID: 815b6091-5d34-4899-9a00-1667e59250e1

POST https://tokyo.dev.clickeen.com/__internal/accounts/CLICKEEN/serving/restore-paid
200 {"ok":true,"accountId":"CLICKEEN","keptInstanceIds":["UZ3JEJSHII","8FMVZFFPJV","H7IF9M2K9B"],"disabledInstanceIds":[],"materializedInstanceIds":["UZ3JEJSHII","8FMVZFFPJV","H7IF9M2K9B"],"failed":[]}
```

This used Tokyo's own restore/materialization product operation. No `runtime.js`, `index.html`, or `styles.css` objects were manually uploaded.

Cloud-dev public smoke after rematerialization:

```text
faq UZ3JEJSHII
  index 200
  runtime.js 200
  styles.css 200
  index references runtime.js: true
  index references old script artifacts: false
  runtime contains CK_WIDGET: true
  runtime contains CK_LOCALE_POLICY: true
  script.js 404
  script.it.js 404
  it.html 404
  styles.v123.css 404

logoshowcase 8FMVZFFPJV
  index 200
  runtime.js 200
  styles.css 200
  index references runtime.js: true
  index references old script artifacts: false
  runtime contains CK_WIDGET: true
  runtime contains CK_LOCALE_POLICY: true
  script.js 404
  script.it.js 404
  it.html 404
  styles.v123.css 404

countdown H7IF9M2K9B
  index 200
  runtime.js 200
  styles.css 200
  index references runtime.js: true
  index references old script artifacts: false
  runtime contains CK_WIDGET: true
  runtime contains CK_LOCALE_POLICY: true
  script.js 404
  script.it.js 404
  it.html 404
  styles.v123.css 404
```

Slice 1 cloud-dev gate is now green for all three Pre-GA CLICKEEN dogfood instances.

### 2026-05-29 - Slice 2 Locale Overlay Storage

Status: Green. Local verification, GitHub deploy checks, cloud-dev rematerialization, public artifact smoke, and R2 source-shape verification passed. Slice 3 may begin.

Slice 2 changed translated-locale storage only. It did not remove `translation-generation-job.json`; Slice 4 owns operation state.

Changed files:

```text
tokyo-worker/src/domains/render/keys.ts
tokyo-worker/src/domains/render/types.ts
tokyo-worker/src/domains/render/normalize.ts
tokyo-worker/src/domains/render/index.ts
tokyo-worker/src/domains/render/locale-overlays.ts
tokyo-worker/src/domains/render/translation-markers.ts
tokyo-worker/src/domains/render/saved-config.ts
tokyo-worker/src/domains/render/translated-locales.ts
tokyo-worker/src/domains/render/translation-generation-state.ts
tokyo-worker/src/domains/render/translation-operations.ts
tokyo-worker/src/domains/render/translated-locales.test.ts
tokyo-worker/src/domains/render/translation-operations.test.ts
scripts/verify/prd103-publish-language-files.test.ts
documentation/architecture/BabelProtocol.md
```

#### What Changed

Tokyo now stores durable translated-locale values in:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

The locale overlay document is the private Tokyo storage wrapper for the public translated value map:

```json
{
  "v": 1,
  "locale": "it",
  "baseContentMarker": "...",
  "widgetContractHash": "...",
  "status": "inSync",
  "values": {
    "sections.0.faqs.0.question": "..."
  },
  "updatedAt": "2026-05-29T00:00:00.000Z"
}
```

`instance.content.json` is now base text source only. New writes no longer put translated locale values into:

```text
fields[path].translatedValues[locale]
fields[path].localeStatus[locale]
localeSync[locale]
```

Read/write/list translated-locale product operations now use locale overlays:

```text
writeTranslatedLocaleValues -> overlays/locales/{locale}.json
readTranslatedLocaleValues  -> overlays/locales/{locale}.json
listTranslatedLocales       -> complete in-sync overlays only
```

Translation generation state now derives ready/reviewable/out-of-sync locale product states from complete, current locale overlays instead of embedded content-field maps.

Completion now writes the accepted translated values into the locale overlay and updates only base-field `status` in `instance.content.json`.

Overlay `baseContentMarker` and `widgetContractHash` values now use the PRD 105 v1 marker shape:

```text
sha256:v1:{64-lowercase-hex-digest}
```

Completion clears a changed base field only when every target locale has a complete `inSync` overlay for the current base marker and current widget contract hash. A stale but complete overlay is not enough to mark base content clean.

#### Pre-GA Embedded Translation Migration

Slice 2 includes a narrow one-time migration inside Tokyo's product read boundary:

- if an old `instance.content.json` still contains complete embedded translated values for a current target locale;
- and any legacy sync marker present still matches the current base marker and widget contract hash;
- Tokyo writes `overlays/locales/{locale}.json`;
- then Tokyo rewrites `instance.content.json` through the normalized clean source shape.

This is not a second storage model. It exists only so current pre-GA CLICKEEN instances can survive the storage move without direct R2 object edits. Incomplete, stale, failed, or mismatched embedded locale data is discarded and regenerated by the normal translation product operation.

#### Local Verification Run

```text
pnpm --filter @clickeen/tokyo-worker typecheck
pnpm --filter @clickeen/tokyo-worker test
pnpm verify:prd103-publish-language-files
pnpm validate:widgets
rg -n "translatedValues|localeStatus|localeSync|TranslationLocaleSyncRecord" tokyo-worker/src/domains/render -S --glob '!**/*.test.ts'
rg -n "translatedValues|localeStatus|localeSync|TranslationLocaleSyncRecord" tokyo-worker/src/**/*.test.ts scripts/verify -S
```

Result:

- Tokyo-worker typecheck passed.
- Tokyo-worker tests passed: 50/50.
- PRD publish/materialization verifier passed: 3/3, now validating PRD 105 canonical runtime from locale overlays.
- Widget validation passed: 3 widget sources valid.
- Whole-workspace typecheck passed.
- Active non-test render source has no primary embedded translated-locale storage references. The only remaining `translatedValues` / `localeStatus` / `localeSync` references are inside the one-time legacy migration helper in `saved-config.ts`.
- Tests reference the old embedded fields only as negative/migration fixtures proving they are removed from clean `instance.content.json`.
- Tests prove overlay markers use `sha256:v1:{digest}` and that stale overlays cannot clear changed base-field status.

#### Cloud-Dev Verification Run

Commit deployed:

```text
abc1eb75 feat(tokyo-worker): store translations in locale overlays
```

GitHub cloud-dev workflows completed successfully for `abc1eb75`:

```text
cloud-dev workers deploy: success
cloud-dev roma app verify: success
cloud-dev surface reachability: success
```

The real Tokyo product restore/rematerialization operation was run against cloud-dev:

```text
POST https://tokyo.dev.clickeen.com/__internal/accounts/CLICKEEN/serving/restore-paid
```

Result:

```json
{
  "ok": true,
  "accountId": "CLICKEEN",
  "keptInstanceIds": [
    "UZ3JEJSHII",
    "8FMVZFFPJV",
    "H7IF9M2K9B"
  ],
  "disabledInstanceIds": [],
  "materializedInstanceIds": [
    "UZ3JEJSHII",
    "8FMVZFFPJV",
    "H7IF9M2K9B"
  ],
  "failed": []
}
```

Cloud-dev public artifact smoke passed for all three pre-GA CLICKEEN instances:

```text
CLICKEEN / UZ3JEJSHII / faq
  /runtime.js: 200
  /styles.css: 200
  /script.js: 404
  /script.it.js: 404
  /it.html: 404
  /styles.v123.css: 404

CLICKEEN / 8FMVZFFPJV / logoshowcase
  /runtime.js: 200
  /styles.css: 200
  /script.js: 404
  /script.it.js: 404
  /it.html: 404
  /styles.v123.css: 404

CLICKEEN / H7IF9M2K9B / countdown
  /runtime.js: 200
  /styles.css: 200
  /script.js: 404
  /script.it.js: 404
  /it.html: 404
  /styles.v123.css: 404
```

Each deployed `runtime.js` contains both required runtime markers:

```text
CK_WIDGET
CK_LOCALE_POLICY
```

Read-only R2 object verification passed for the canonical instance source/artifact files:

```text
accounts/CLICKEEN/instances/{instanceId}/instance.config.json
accounts/CLICKEEN/instances/{instanceId}/instance.content.json
accounts/CLICKEEN/instances/{instanceId}/index.html
accounts/CLICKEEN/instances/{instanceId}/styles.css
accounts/CLICKEEN/instances/{instanceId}/runtime.js
```

Downloaded cloud-dev `instance.content.json` files for all three instances contain no embedded translated-locale fields:

```text
translatedValues
localeStatus
localeSync
```

Tokyo currently reports no translated locale inventory for the three live pre-GA CLICKEEN instances, so there were no existing locale overlay objects to prove in cloud. The deployed code path and local migration tests prove old embedded complete translations migrate into `overlays/locales/{locale}.json` when present.

Existing stale `script.js` R2 objects are still present under account instance folders but are not publicly served. This is expected before `105L` Phase B. `105M` stops relying on and recreating legacy artifact names; `105L` Phase B owns deleting stale account runtime objects after `105M` is green.

### 2026-05-29 - Slice 3 Materialization Rewrite

Status: Green. Local verification, peer verification, GitHub deploy checks, cloud-dev rematerialization, and public artifact smoke passed. Slice 4 may begin.

Slice 3 had already inherited most of its public artifact shape from Slice 1 and its translated-value source from Slice 2. The remaining blocker found by peer verification was Bob/public parity for account-owned media: Bob preview resolved `assetRef` values into browser-safe media URLs, but Tokyo public materialization baked raw `assetRef` values into `runtime.js`.

#### What Changed

Tokyo public materialization now resolves account-owned media before writing `runtime.js`:

```text
collectConfigMediaAssetRefs(instance.value.config)
loadAccountAssetByRef(accounts/{accountPublicId}/assets/{assetRef})
materializeConfigMedia(...)
runtime.js
```

If a saved widget config references a missing account asset, materialization fails with:

```text
artifact.account_asset_missing
```

That is intentional. Public embed cannot depend on Bob to resolve missing media later. Invalid public state must fail at the materialization boundary instead of publishing a weaker runtime than Bob preview.

The translated locale runtime state is resolved over the same materialized base state. Locale overlays remain private source/product data; translated states are baked into `runtime.js` as visitor-safe runtime payload, not fetched from `/overlays/`.

Changed files:

```text
tokyo-worker/src/domains/render/public-artifacts.ts
tokyo-worker/src/domains/render/public-artifacts.test.ts
```

#### Local Verification Run

```text
pnpm --filter @clickeen/tokyo-worker test
pnpm --filter @clickeen/tokyo-worker typecheck
pnpm verify:prd103-publish-language-files
pnpm validate:widgets
pnpm typecheck
```

Result:

- Tokyo-worker tests passed: 52/52.
- Tokyo-worker typecheck passed.
- PRD publish/materialization verifier passed: 3/3.
- Widget validation passed: 3 widget sources valid.
- Whole-workspace typecheck passed.
- Tests now prove account asset refs materialize into public runtime media URLs.
- Tests now prove missing account assets fail materialization with `artifact.account_asset_missing`.
- Tests continue to prove public output is only `index.html`, `styles.css`, and `runtime.js`.
- Peer verifiers marked Slice 3 green after the account asset fix.

#### Cloud-Dev Verification Run

Commit deployed:

```text
b525e0a6 feat(tokyo-worker): materialize account asset media in runtime
```

GitHub cloud-dev workflows completed successfully for `b525e0a6`:

```text
cloud-dev workers deploy: success
cloud-dev surface reachability: success
```

The real Tokyo product restore/rematerialization operation was run against cloud-dev:

```text
POST https://tokyo.dev.clickeen.com/__internal/accounts/CLICKEEN/serving/restore-paid
```

Result:

```json
{
  "ok": true,
  "accountId": "CLICKEEN",
  "keptInstanceIds": [
    "UZ3JEJSHII",
    "8FMVZFFPJV",
    "H7IF9M2K9B"
  ],
  "disabledInstanceIds": [],
  "materializedInstanceIds": [
    "UZ3JEJSHII",
    "8FMVZFFPJV",
    "H7IF9M2K9B"
  ],
  "failed": []
}
```

Cloud-dev public artifact smoke passed for all three pre-GA CLICKEEN instances:

```text
CLICKEEN / UZ3JEJSHII / faq
  /runtime.js: 200
  /styles.css: 200
  /script.js: 404
  /script.it.js: 404
  /it.html: 404
  /styles.v123.css: 404
  runtime markers: CK_WIDGET, CK_LOCALE_POLICY

CLICKEEN / 8FMVZFFPJV / logoshowcase
  /runtime.js: 200
  /styles.css: 200
  /script.js: 404
  /script.it.js: 404
  /it.html: 404
  /styles.v123.css: 404
  runtime markers: CK_WIDGET, CK_LOCALE_POLICY

CLICKEEN / H7IF9M2K9B / countdown
  /runtime.js: 200
  /styles.css: 200
  /script.js: 404
  /script.it.js: 404
  /it.html: 404
  /styles.v123.css: 404
  runtime markers: CK_WIDGET, CK_LOCALE_POLICY
```

### 2026-05-29 - Slice 4 Translation Operation State Out Of R2

Status: Local verification green. Cloud-dev deploy/smoke pending, so do not move to Slice 5 yet.

Slice 4 removed `translation-generation-job.json` as active operation storage. Translation generation now uses the PRD 105D Supabase operation ledger:

```text
translation_generation_operations
translation_generation_operation_locales
```

`instances.translation_status` remains coarse liveness only. Locale translated values remain in:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

#### What Changed

Tokyo added a small DB-backed ledger module:

```text
tokyo-worker/src/domains/render/translation-operation-ledger.ts
```

The module owns the narrow Supabase operations required by 105D:

- read latest operation for an instance;
- create one accepted operation row and one locale row per queued locale;
- mark queued locale rows as sent after queue enqueue succeeds;
- mark completion/failure/stale locale outcomes;
- roll locale terminal outcomes up to operation status;
- timeout active operations through DB state.

Tokyo no longer has an R2 key or R2 read/write/update path for:

```text
accounts/{accountPublicId}/instances/{instanceId}/translation-generation-job.json
```

Deleted from active source:

```text
accountInstanceTranslationGenerationJobKey()
readCurrentTranslationGenerationJob()
writeCurrentTranslationGenerationJob()
updateCurrentTranslationGenerationJob()
```

Completion apply/reject now matches the active operation id carried in the San Francisco job payload and the saved-base marker. Stale callbacks are recorded as terminal locale `stale` outcomes in DB, return `applied: false`, and do not write locale overlays.

Timeout proof moved from mutating an R2 object to updating the Supabase operation ledger in tests.

Changed files:

```text
tokyo-worker/src/domains/render/keys.ts
tokyo-worker/src/domains/render/types.ts
tokyo-worker/src/domains/render/translation-generation-state.ts
tokyo-worker/src/domains/render/translation-operation-ledger.ts
tokyo-worker/src/domains/render/translation-operations.ts
tokyo-worker/src/domains/render/test-instance-registry.ts
tokyo-worker/src/domains/render/translation-operations.test.ts
```

#### Local Verification Run

```text
pnpm --filter @clickeen/tokyo-worker typecheck
pnpm --filter @clickeen/tokyo-worker test
pnpm verify:prd103-publish-language-files
pnpm validate:widgets
pnpm typecheck
rg -n "translation-generation-job\\.json|accountInstanceTranslationGenerationJobKey|readCurrentTranslationGenerationJob|writeCurrentTranslationGenerationJob|updateCurrentTranslationGenerationJob" tokyo-worker/src scripts packages bob roma sanfrancisco venice prague admin --glob '!**/node_modules/**'
rg -n "TranslationGenerationJobDocument|TranslationGenerationJobBasis|generation job state" tokyo-worker/src --glob '!**/node_modules/**'
```

Result:

- Tokyo-worker typecheck passed.
- Tokyo-worker tests passed: 52/52.
- PRD publish/materialization verifier passed: 3/3.
- Widget validation passed: 3 widget sources valid.
- Whole-workspace typecheck passed.
- Active source/tests contain no `translation-generation-job.json` key/path references.
- Active source contains no R2 operation-controller reader/writer/update function names.
- Active source no longer has `TranslationGenerationJobDocument` / R2 job-document vocabulary.
- Tests still prove duplicate Generate returns active work without creating competing operations.
- Tests still prove base changes while active do not create competing work.
- Tests still prove completion applies only when the saved-base marker remains current.
- Tests still prove stale completion is terminal/non-applied.
- Tests still prove locale failure and operation timeout produce failed product state and coarse registry status.

#### Peer Verification

Three Slice 4 sidecar verifiers reviewed the work before implementation and identified the required contract:

- Supabase operation row is the mutex and lifecycle authority.
- Per-locale rows are callback/outbox authority.
- Locale `stale` is terminal and does not become a public operation status.
- `instances.translation_status` mirrors only coarse liveness.
- The timeout test must stop mutating `translation-generation-job.json`.
- Product tests must keep proving states, not storage mechanics.

Implementation followed that scope. No compatibility reader, R2 ops shim, queue dashboard, or broad workflow platform was added.

## Final State

Tokyo-worker remains important, but smaller in meaning:

```text
It owns product operations.
It stores source in the approved instance taxonomy.
It stores operation state in Supabase.
It materializes one simple public runtime.
It never treats the instance folder as an ops database.
```
