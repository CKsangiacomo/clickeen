# PRD 105L - R2 Bucket And Widget Package Source Cleanup

Status: Green / Phase A and Phase B executed
Owner: Product + Architecture
Date: 2026-05-28
Parent: `105__PRD__Instance_Folder_Tenets.md`
Depends on: `105C__PRD__Tokyo_Runtime_Boundary_Verification.md`, `105H__PRD__Execution_Verification_Protocol.md`
Phase B depends on: `105I__PRD__Admin_Account_Coordinate_And_Context_Verification.md`, `105J__PRD__Prague_Public_Dogfood_Boundary_Verification.md`, `105M__PRD__Tokyo_Worker_Instance_Runtime_Refactor.md`
Audit input: `105K__PRD__Pre_GA_Codebase_And_Documentation_Cleanup_Verification.md`

## Purpose

Clean up the Tokyo R2 bucket taxonomy once and make the widget package source model explicit.

The R2 bucket currently mixes:

```text
account-owned runtime state
product deploy assets
stale remote keys from older source shapes
```

The cleanup must make one thing true:

```text
R2 mirrors current product authority.
It must not preserve old architecture beside the new one.
```

This PRD has two phases:

```text
Phase A: product deploy roots, widget package source, brand media, manifests, dry-run inventory
Phase B: destructive account/runtime R2 cleanup after 105M proves old files are no longer recreated
```

Do not execute Phase B before `105M` is green.

## Source Evidence Reviewed

Current deploy sync maps repo source to R2 like this:

```text
tokyo/product/widgets -> product/widgets
tokyo/product/media   -> product/media
tokyo/product/themes  -> product/themes
tokyo/product/dieter  -> dieter
tokyo/product/fonts   -> fonts
tokyo/roma            -> product/roma
tokyo/prague          -> prague
```

The script refuses `accounts/` deploy writes, so account runtime state is not deploy source.

Current local widget packages:

```text
tokyo/product/widgets/faq
tokyo/product/widgets/countdown
tokyo/product/widgets/logoshowcase
tokyo/product/widgets/shared
```

Pre-GA canonical widget scope is exactly these three product widgets:

```text
faq
countdown
logoshowcase
```

Execution must regenerate and verify the deployed package source for all three. Do not treat FAQ as the only proof fixture, and do not leave countdown or logoshowcase behind because they are smaller. These three widget packages are the current product surface.

The validator already forbids deleted widget source such as:

```text
agent.md
seo-geo.ts
content.json
manifest.json
```

## Product Bucket Taxonomy

The surviving R2 roots are:

```text
accounts/
product/widgets/
product/media/
product/themes/
product/roma/
dieter/
fonts/
prague/
```

Meaning:

| Root | Meaning |
| --- | --- |
| `accounts/` | Account-owned assets, instance source, locale overlays, generated public artifacts |
| `product/widgets/` | Deployed widget package source/runtime files |
| `product/media/` | Product-owned media, including brand media |
| `product/themes/` | Product/editor theme preset data |
| `product/roma/` | Product UI support catalogs for Roma/Bob, currently i18n bundles |
| `dieter/` | Design-system components, icons, tokens, and manifest |
| `fonts/` | Product-owned font files |
| `prague/` | Prague static/page support assets and page data |

## Brand Media Decision

`product/media/brand` is the correct location for Clickeen-owned brand media.

Examples:

```text
product/media/brand/ClickeenLogoFull.svg
product/media/brand/ClickeenSymbol.svg
```

`product/assets/brand` is stale unless a current manifest proves otherwise. The expected cleanup result is:

```text
keep product/media/brand
delete product/assets/brand
```

## Widget Package Source Contract

FAQ is the canonical model for widget package source.

Every product widget package should have this core shape:

```text
tokyo/product/widgets/{widgetType}/
  spec.json
  editable-fields.json
  limits.json
  widget.html
  widget.css
  widget.client.js
```

### `spec.json`

The widget's state/default/editor contract:

- default config/state;
- normalization rules;
- editor panels and controls;
- state paths used by Bob and runtime;
- widget-owned structural model.

It must not contain deleted translation authority such as `overlays.text`.

### `editable-fields.json`

The editable/translatable customer-visible text contract.

It must include every visitor-visible authored text path, including:

- header title/subtitle;
- CTA label;
- repeated item text;
- captions;
- alt/title text when visitor-visible or semantic;
- rich text fields.

FAQ model:

```text
header.title
header.subtitleHtml
cta.label
sections[].title
sections[].faqs[].question
sections[].faqs[].answer
```

All widgets with customer-visible text must follow this model. FAQ is required as the repeated-field fixture, but it is not special product authority.

### `limits.json`

Widget path/op mapping to `ck-policy` keys.

It may map widget paths to flags and limits. It must not define tiers, plan values, entitlements, or policy matrices.

### `widget.html`

The widget DOM shell and script/style references.

It may reference:

- Dieter CSS;
- shared widget runtime files;
- widget CSS;
- widget client script;
- widget-owned media under the package when needed.

It must not be an account instance source file.

### `widget.css`

Widget package styling.

It is product runtime source, not account-owned generated output.

### `widget.client.js`

Widget browser runtime.

It must assume validated state and fail visibly when required DOM/state is missing. It must not fetch private account source or operation state.

## Allowed Package Extensions

Allowed only when justified:

```text
media/
widget.dom.js
```

### `media/`

Widget-owned demo/default package media may live under:

```text
tokyo/product/widgets/{widgetType}/media/
```

Current example:

```text
tokyo/product/widgets/logoshowcase/media/*.svg
```

This is not account media. Customer/account assets belong under:

```text
accounts/{accountPublicId}/assets/
```

### `widget.dom.js`

`widget.dom.js` may exist only as a small widget-owned DOM helper split from `widget.client.js`.

Current example:

```text
tokyo/product/widgets/countdown/widget.dom.js
```

It is an allowed temporary/package-local split, not a required file for all widgets. Execution must decide whether to keep it as an allowed package extension or fold it back into the normal runtime model. Do not create more helper splits without a reason.

## Forbidden Widget Package Source

These must not exist in current widget package source or deployed `product/widgets/{widgetType}/`:

```text
agent.md
content.json
seo-geo.ts
manifest.json
localization.json
translation-generation-job.json
job.json
queue.json
status.json
```

Why:

- `agent.md` is not schema or agent authority;
- `content.json` is not widget package source because customer content belongs in account instance source;
- `seo-geo.ts` is deleted widget source and can return only through a later named SEO/GEO static build PRD;
- `manifest.json` must not become widget package product truth;
- localization/operation files must not be widget package source.

## Roma I18n Classification

`product/roma/i18n` is product UI localization for Roma/Bob.

It is not:

- account widget translation;
- instance locale overlay;
- public visitor widget content;
- San Francisco output;
- operation state.

Current shape:

```text
product/roma/i18n/source/
product/roma/i18n/public/
product/roma/i18n/public/manifest.json
```

This can survive if active docs clearly label it as product UI i18n. It must not be confused with:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

## Theme Classification

`product/themes/themes.json` is product/editor theme preset data.

It may survive if:

- Bob/Dieter still use it as the theme preset authority;
- it remains product/editor preset data, not account instance state;
- runtime materialization consumes final saved values, not theme files as visitor-time state.

If no active caller uses it, delete it from repo and R2 together.

## Account Instance Folder Cleanup

PRD 105 remains the target for account instance folders:

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

Pre-105M code emitted old public artifact names in `tokyo-worker/src/domains/render/public-artifacts.ts`, including:

```text
script.js
script.{locale}.js
script.v{version}.js
script.v{version}.{locale}.js
{locale}.html
styles.v{version}.css
```

Slice 1 of `105M__PRD__Tokyo_Worker_Instance_Runtime_Refactor.md` stopped materialization from recreating these names. Stale account runtime objects may still exist in R2 until Phase B deletes them after the 105M runtime refactor is green.

Execution order:

1. Run Phase A manifest/taxonomy work without deleting account runtime artifacts.
2. Execute `105M` so materialization target naming and serving rules stop recreating old files.
3. Verify public widgets still serve from the PRD 105 shape.
4. Delete stale generated account/runtime files from R2 with manifest proof.
5. Add tripwires so old generated names are not recreated.

## Required R2 Cleanup Mechanism

Execution must compare three manifests:

1. Current remote R2 object manifest.
2. Expected product deploy manifest from repo sync mappings.
3. Expected account runtime manifest from Supabase/Tokyo account instance inventory.

Rules:

- remote keys under product deploy roots that are absent from repo manifest are deletion candidates;
- remote keys under `accounts/` require account/instance inventory proof before deletion;
- no R2 delete happens from screenshots or assumptions;
- every deleted prefix/key must be listed in evidence;
- dry-run first, delete second, verify third.

## Expected Cleanup Targets

Likely product deploy cleanup targets:

```text
product/assets/**
product/widgets/*/agent.md
product/widgets/*/content.json
product/widgets/*/seo-geo.ts
product/widgets/*/manifest.json
stale product widget files absent from repo
```

Likely account runtime cleanup targets after materialization repair:

```text
accounts/00000001/**
accounts/*/instances/*/{locale}.html
accounts/*/instances/*/script.js
accounts/*/instances/*/script.*.js
accounts/*/instances/*/styles.v*.css
translation-generation-job.json
generation.json
queue.json
status.json
worker-state.json
retry-state.json
```

`product/media/brand` is not a cleanup target unless an audit proves it is unused.

`accounts/00000001/**` is a cleanup target only after `105I` proves:

- Supabase has zero active `00000001` account/user/instance references;
- all active admin source and public files exist under `accounts/CLICKEEN/`;
- `dev.clk.live/CLICKEEN/{instanceId}` serves correctly;
- `dev.clk.live/00000001/{instanceId}` returns `404` with no redirect or alias.

## Blast Radius

Expected implementation areas:

```text
scripts/tokyo-r2-deploy-sync.mjs
scripts/ops/**
scripts/validate-widget-source.mjs
tokyo/product/widgets/**
tokyo/product/media/**
tokyo/product/themes/**
tokyo-worker/src/domains/render/public-artifacts.ts
tokyo-worker/src/routes/clk-live-routes.ts
tokyo-worker/src/asset-utils.ts
documentation/**
Execution_Pipeline_Docs/**
```

`tokyo-worker/src/domains/render/public-artifacts.ts` and `tokyo-worker/src/routes/clk-live-routes.ts` are owned by `105M` for implementation. This PRD may reference them for inventory and verification, but should not independently patch materialization behavior outside the `105M` execution slices.

Do not edit without a focused follow-up:

```text
bob/**
roma/**
berlin/**
sanfrancisco/**
supabase/migrations/**
prague launch page content
```

## Drift Stop Conditions

Stop and split the work if execution requires:

- changing widget behavior beyond source taxonomy cleanup;
- deleting account R2 objects without inventory proof;
- preserving `product/assets` as a second brand-media root;
- making widget package files account instance source;
- creating `agent.md`, `content.json`, or `seo-geo.ts`;
- keeping operation-controller JSON in `product/widgets` or `accounts`;
- keeping default per-locale HTML/JS public artifact generation as PRD 105-compliant;
- changing customer account identity or Prague dogfood behavior.

## Verification Scope

This PRD is green only when:

- `product/media/brand` is the only active product-owned brand media root;
- `product/assets` is absent from active R2 product deploy roots or explicitly proven historical/deleted;
- all deployed `product/widgets/{widgetType}/` keys match repo widget package manifests;
- FAQ package matches the canonical widget package model;
- countdown and logoshowcase either match the model or have documented allowed extensions;
- FAQ, countdown, and logoshowcase are all regenerated/deployed from the same package-source contract;
- deployed widget packages contain no `agent.md`, `content.json`, `seo-geo.ts`, or `manifest.json`;
- `product/roma/i18n` is documented as product UI i18n only;
- `product/themes/themes.json` is either documented as active editor preset authority or removed;
- account instance folders match PRD 105 after materialization repair;
- old `accounts/00000001/**` keys are deleted after `105I` proof, or the delete is explicitly blocked with evidence;
- public serving still returns published widgets;
- old forbidden generated files are not recreated by materialization;
- R2 cleanup evidence includes dry-run manifest, delete manifest, and post-delete manifest.

Phase A is green when the product deploy/widget package checks pass and account/runtime deletion candidates are listed but not deleted.

Phase B is green only after `105M` is green and stale account/runtime objects are deleted with dry-run, delete, and post-delete evidence.

## Phase B Execution Evidence

Executed after `105M__PRD__Tokyo_Worker_Instance_Runtime_Refactor.md` closed and cloud-dev proved PRD 105 runtime names:

```text
dev.clk.live/CLICKEEN/{instanceId}/            -> 200
dev.clk.live/CLICKEEN/{instanceId}/runtime.js -> 200
dev.clk.live/CLICKEEN/{instanceId}/styles.css -> 200
dev.clk.live/CLICKEEN/{instanceId}/script.js  -> 404
dev.clk.live/CLICKEEN/{instanceId}/translation-generation-job.json -> 404
dev.clk.live/00000001/{instanceId}/           -> 404
```

Admin account proof before delete:

```text
Supabase accounts matching CLICKEEN or 00000001: CLICKEEN only
Supabase instances matching CLICKEEN or 00000001:
- 8FMVZFFPJV -> CLICKEEN
- H7IF9M2K9B -> CLICKEEN
- UZ3JEJSHII -> CLICKEEN
```

Dry-run manifest:

```text
/tmp/clickeen-105l/prd105l-dry-run.json
expected deploy keys: 703
remote product keys: 89
remote account keys: 277
product stale keys: 26
account stale keys: 261
total delete candidates: 287
canonical active instance keys preserved: 15
index.html delete candidates: 0
```

Deleted key classes:

```text
product/assets/brand/**
product/widgets/*/agent.md
product/widgets/*/content.json
product/widgets/*/seo-geo.ts
product/widgets/manifest.json
product/widgets/logoshowcase/base-assets/**
accounts/00000001/**
accounts/CLICKEEN/instances/*/script.js
accounts/CLICKEEN/instances/*/script.v*.js
accounts/CLICKEEN/instances/*/styles.v*.css
accounts/CLICKEEN/instances/*/translation-generation-job.json
```

Delete manifest:

```text
/tmp/clickeen-105l/prd105l-delete-manifest.json
product deleted keys: 26
account deleted keys: 261
total deleted keys: 287
```

The Cloudflare R2 API delete process deleted all but one stale key before hanging on the final active-account operation object. The final remaining key, `accounts/CLICKEEN/instances/UZ3JEJSHII/translation-generation-job.json`, was deleted with:

```sh
pnpm --filter @clickeen/tokyo-worker exec wrangler r2 object delete tokyo-assets-dev/accounts/CLICKEEN/instances/UZ3JEJSHII/translation-generation-job.json --remote
```

Post-delete manifest:

```text
/tmp/clickeen-105l/prd105l-post-delete-manifest.json
remote product keys: 63
remote account keys: 16
product stale keys: 0
account stale keys: 0
total delete candidates: 0
canonical active instance keys preserved: 15
```

Post-delete public smoke:

```text
UZ3JEJSHII root=200 runtime=200 styles=200 script=404 job=404 old=404
8FMVZFFPJV root=200 runtime=200 styles=200 script=404 job=404 old=404
H7IF9M2K9B root=200 runtime=200 styles=200 script=404 job=404 old=404
```

Peer verification:

```text
Product lens: GREEN
Legacy/no-LOC-left-behind lens: GREEN
Architecture/systems lens: GREEN
```

Local verification:

```sh
node --check scripts/ops/prd105l-r2-cleanup.mjs
pnpm validate:widgets
```

## Required Static Tripwires

Execution must add or run checks equivalent to:

```sh
pnpm validate:widgets
rg -n "agent.md|seo-geo.ts|content.json" tokyo/product/widgets scripts tokyo-worker packages documentation -S
rg -n "product/assets|assets/brand" tokyo scripts tokyo-worker documentation -S
rg -n "script\\.\\{locale\\}|\\{locale\\}\\.html|script\\.[a-z][a-z-]*\\.js|styles\\.v" tokyo-worker scripts documentation Execution_Pipeline_Docs/02-Executing -S
```

Expected result:

- active references to deleted widget source are only validation/tripwire references;
- no active deploy sync writes `product/assets`;
- old per-locale public artifact language is absent from active architecture docs except as a forbidden target.

## Non-Scope

This PRD does not:

- implement SEO/GEO;
- change widget visual behavior;
- redesign Bob editor controls;
- change translation workflow state;
- change San Francisco provider prompts;
- change Prague page copy;
- delete Supabase migration history;
- delete R2 account objects without manifest proof.
