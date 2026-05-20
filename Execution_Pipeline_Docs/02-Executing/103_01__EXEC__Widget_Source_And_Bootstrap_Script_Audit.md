# PRD 103_01 Execution - Widget Source And Bootstrap Script Audit

Status: Complete / Green
Date: 2026-05-19
Parent: `103_01__PRD__Widget_Source_And_Bootstrap_Script_Audit.md`
Controlling gate: `103_00__EXEC__Pre_103_Architecture_Gate.md`

## Execution Rule

This execution file is the controlling ledger for PRD 103_01.

Execution rules:

- execute one slice at a time;
- do not rename, delete, or shim runtime source until the current slice is green;
- active callers prove dependency only, not product legitimacy;
- generated manifests, generated catalogs, bootstrap scripts, and file-existence checks are deletion candidates unless a product operation needs them;
- no PRD 103 translation runtime work resumes while this PRD is open.

## Slice Plan

| Slice | Status | Scope | Green condition |
| --- | --- | --- | --- |
| 103_01.1 - Consumer inventory | Green | Inventory active code, test, verifier, docs, and build consumers of widget source files, generated manifests, and bootstrap scripts. | Subagent code/docs scans complete; local repo evidence recorded; no runtime files changed; `git diff --check` passes. |
| 103_01.2 - File role decisions | Green | Decide keep/delete/rename/narrow for every widget source file and bootstrap-era script. | Each file/script has one final role and a named surviving product operation, or is marked delete. |
| 103_01.3 - Widget source migration | Green | Implement the approved decisions for widget source, catalog operation, generated manifest removal, tests, verifiers, and docs. | Build/typecheck/test/verifier set for moved callers is green; no product path treats generated manifest, `content.json`, or `spec.overlays.text` as authority. |
| 103_01.3a - FAQ editable-fields migration | Green | Rename FAQ `content.json` to `editable-fields.json` and migrate current product/test/verifier callers. | No active FAQ product/test/verifier caller reads `content.json`; targeted tests, typechecks, lints, widget validation, vertical verifier, and `git diff --check` pass. |
| 103_01.3b - Widget catalog operation migration | Green | Move Tokyo-worker, Roma, Prague, tests, and deploy sync off generated manifest/catalog route authority. | Product paths depend on `listWidgetDefinitions` / `getWidgetDefinition`, not `tokyo/product/widgets/manifest.json` or `/__internal/renders/widgets/catalog.json`. |
| 103_01.3c - Widget source cleanup | Green | Resolve remaining `agent.md`, `seo-geo.ts`, `catalog.json` capability narrowing, non-FAQ `spec.overlays.text`, and bootstrap-script classifications. | Remaining widget-source files have keep/delete decisions implemented or explicitly blocked with no PRD 103 runtime dependency. |
| 103_01.3c.4 - Limits and bootstrap-script closure | Green | Validate widget `limits.json` against `ck-policy`; delete stale Prague sync; update drift guard, workflows, docs, and status ledgers. | Widget limits cannot define tier truth; old Prague l10n sync path is deleted from scripts/workflows; bootstrap scripts have keep/delete/cloudify classifications. |
| 103_01.4 - Closure and 103_02 handoff | Green | Update status docs and confirm all 103_00 BR rows owned by 103_01 are closed or moved to a named follow-up with no PRD 103 runtime blocker. | 103_01 acceptance green; 103_00.2 can close. |

No later slice may begin until the preceding slice is green.

## Slice 103_01.1 Scope

This slice does not change runtime behavior.

Included:

- inventory active consumers of `tokyo/product/widgets/manifest.json`;
- inventory active consumers of `scripts/build-widget-catalog.mjs`;
- inventory active consumers of widget `content.json`, `catalog.json`, `agent.md`, `limits.json`, and `seo-geo.ts`;
- inventory tests, verifiers, docs, and build scripts that still teach generated manifest/catalog/bootstrap behavior;
- record deletion/keep candidates for the next decision slice.

Excluded:

- no widget file rename;
- no package script edit;
- no Tokyo-worker route edit;
- no Roma/Bob/Prague/San Francisco code edit;
- no generated manifest deletion;
- no test rewrite.

Pre-existing dirty runtime files before this slice began:

- `roma/app/api/account/instances/[instanceId]/route.ts`
- `roma/lib/account-instance-translation-jobs.test.ts`

They are not part of `103_01.1`.

## Consumer Inventory

| Source or artifact | Active consumers found | Current product problem | Next-slice decision |
| --- | --- | --- | --- |
| `tokyo/product/widgets/*/spec.json` | Tokyo create/default path through generated manifest; Bob editor schema/defaults; widget tests/docs | `spec.defaults` currently includes starter/customer-visible copy and sample logo selections, so the file is not cleanly non-content software config today. | Keep `spec.json` as editor schema, normalization, and non-content software defaults only. Extract starter business copy to the account starter instance model before PRD 103 resumes. |
| `tokyo/product/widgets/shared/*` | Widget HTML imports shared JS/CSS; San Francisco embed writer resolves and inlines linked shared sources. | Shared runtime assets were not previously recorded in the source matrix. | Keep as runtime software assets owned by widget runtime, not catalog/source metadata. |
| `tokyo/product/widgets/*/media/**` | Logo Showcase defaults reference widget media SVGs; Tokyo static serving/deploy sync publishes widget media. | Widget-owned media was missing from the source matrix and can be confused with account/customer assets. | Keep as widget runtime media assets only. Starter selections that reference them belong to starter instance content/config, not widget software truth. |
| `tokyo/product/widgets/manifest.json` | Historical 103_01.1 consumers were `tokyo-worker/src/domains/widget-catalog.ts`; `prague/src/lib/widgetCatalog.ts`; `roma/lib/account-instance-translation-jobs.test.ts`; `packages/ck-contracts/src/overlay-codebooks.test.ts`; `scripts/tokyo-r2-deploy-sync.mjs`; `scripts/build-widget-catalog.mjs` | A generated aggregate was treated as product source authority by Tokyo-worker, Prague, tests, and deploy sync. | GREEN in 103_01.3b: generated manifest file deleted; product/test callers moved to direct widget source and widget-definition operations. |
| `scripts/build-widget-catalog.mjs` | Historical root `package.json` `build`, `typecheck`, `build:widgets`, `build:widgets:check`; wrote `tokyo/product/widgets/manifest.json`; wrote `tokyo-worker/src/generated/widget-seo-geo-registry.ts` | One bootstrap-era script validated source, derived overlays, emitted a widget manifest, and emitted SEO registry output. | GREEN in 103_01.3b: deleted and replaced by non-mutating `scripts/validate-widget-source.mjs`; root build/typecheck now run `pnpm validate:widgets`. |
| `tokyo/product/widgets/*/content.json` | Historical callers were `bob/lib/api/compiled-widget-route.ts`; `bob/lib/types.ts`; `sanfrancisco/src/agents/csPromptPayload.ts`; generated manifest; `roma/lib/account-instance-translation-jobs.ts` through catalog content; ck-contracts/Bob/SF/verifier tests | The file was not widget content. It was the editable/translatable field contract for saved instance content. | GREEN for current widgets: FAQ moved from `content.json`; Countdown and Logo Showcase now declare `editable-fields.json`; validator requires the file and no current widget uses `content.json`. |
| `tokyo/product/widgets/*/spec.json` `overlays.text` | Countdown and Logo Showcase declared translatable paths in `spec.json`. | Translation field authority was split between FAQ `editable-fields.json` and non-FAQ `spec.overlays.text`. | GREEN in 103_01.3c.3: Countdown and Logo Showcase moved to `editable-fields.json`; validator fails if `spec.overlays.text` returns. |
| `tokyo/product/widgets/*/catalog.json` | `getWidgetDefinition` / `listWidgetDefinitions`; generic static serving/deploy paths | 103_01.3b made this small source metadata read directly by the widget-definition operation. 103_01.3c.2 removed capability/SEO fields. | Keep only as small catalog metadata: label, description, category, order. |
| `tokyo/product/widgets/*/agent.md` | Historical `sanfrancisco/src/embed-file-writer.ts` existence check discarded content; tests/verifiers seeded the file; docs told agents to update it. | Existence-only runtime dependency; no proven schema or guidance consumer. | GREEN in 103_01.3c.1: runtime check, fixtures, source files, and active docs removed; validator fails if `agent.md` returns. |
| `tokyo/product/widgets/*/limits.json` | `bob/lib/api/compiled-widget-route.ts`; `packages/ck-policy/src/limits.ts`; `bob/lib/session/useSessionEditing.ts`; generic deploy/static serving | This has a real policy-use path, but must not become a detached entitlement model. | GREEN in 103_01.3c.4: kept only as a path/operation/cap mapping to real `ck-policy` keys; source validation and ck-policy tests reject detached tier truth. |
| `tokyo/product/widgets/*/seo-geo.ts` | Historical file source only; generated registry coupling was removed in 103_01.3b. | No runtime import of `SEO_GEO_META_PACK_GENERATORS` was found. | GREEN in 103_01.3c.2: deleted widget/shared SEO/GEO source and catalog capability coupling. |
| `tokyo-worker/src/generated/widget-seo-geo-registry.ts` | Historical generated output from `scripts/build-widget-catalog.mjs`. | Generated dead-looking artifact; no runtime import found. | GREEN in 103_01.3b: generated registry deleted. |
| `/__internal/renders/widgets/catalog.json` | Historical route used by `roma/lib/account-instance-direct.ts`; Roma translation tests mocked it | Route exposed generated catalog/file vocabulary as product API. | GREEN in 103_01.3b: route removed; Roma calls `GET /__internal/widgets/definitions`. |
| `prague/src/lib/widgetCatalog.ts` | Historically imported `tokyo/product/widgets/manifest.json` | Prague bound to generated widget manifest shape. | GREEN in 103_01.3b: Prague reads widget source metadata directly. |
| `bob/lib/api/compiled-widget-route.ts` and `bob/lib/types.ts` | Historically fetched and exposed `content.json`; fetches `limits.json`; returns compiled widget package files | The old file name leaked into product payloads. | GREEN in 103_01.3a: Bob compiled payload uses editable-field vocabulary. |
| `sanfrancisco/src/agents/csPromptPayload.ts` | Historically read `content.json` from Bob widget package and summarized it for Copilot | Copilot context used old file name vocabulary. | GREEN in 103_01.3a: San Francisco receives editable-field contract context. |
| `sanfrancisco/src/embed-file-writer.ts` | Historically read `product/widgets/${widgetType}/agent.md` as required text but discarded content. | This proved only an existence check, not a product need. | GREEN in 103_01.3c.1: existence check removed. |
| `packages/ck-contracts/src/*` widget tests | Historically read `manifest.json`, FAQ `content.json`, and generated overlay-shaped widget contracts | 103_01.3a/3b/3c.3 rewrote active contract tests to approved widget source and editable-field behavior. | Keep green; do not restore generated manifest/content/spec overlay contract tests as authority. |
| `scripts/verify/prd103-faq-vertical-slice.test.ts` | Historically read FAQ `content.json` | 103_01.3a rewrote the verifier to `editable-fields.json`. | Keep green. |
| `scripts/verify/prd103-publish-language-files.test.ts` | Historically seeded `agent.md` as widget product source fixture. | Verifier preserved `agent.md` existence as product behavior. | GREEN in 103_01.3c.1: fixture removed and verifier passes. |
| `scripts/verify/primitive-drift.mjs` | Guard for post-103_01 vocabulary. | 103_01.3c.4 extended it to reject deleted generated widget manifest/catalog route, stale Prague l10n root, deleted widget source files, `spec.overlays.text`, and catalog capabilities. | Keep as non-mutating guard. |
| Widget/service docs | `documentation/widgets/**`, `documentation/services/**`, `documentation/ai/BUILD_Widget.md`, PRD 103 family docs | FAQ field-contract, generated-manifest, `agent.md`, `seo-geo.ts`, `catalog.json`, and `limits.json` docs were updated through 103_01.3a-103_01.3c.4. | GREEN for widget-source docs. Broader account-instance/public-artifact docs remain owned by 103_02 and 103_00.4. |

## Bootstrap-Era Script Inventory

| Script or script family | Current role found | Next-slice classification needed |
| --- | --- | --- |
| `scripts/validate-widget-source.mjs` | Non-mutating widget source guard. | Kept. Replaces deleted `scripts/build-widget-catalog.mjs`. |
| `scripts/tokyo-r2-deploy-sync.mjs` | Publishes approved repo deploy roots into Tokyo/R2. | Cloudify as deploy-only byte sync; must not define source truth. |
| `scripts/tokyo-fonts-sync.mjs` | Separate font publisher. | Keep only if current deploy needs separate font sync; otherwise fold into deploy or delete. |
| `scripts/prague-sync.mjs` | Deleted stale publisher from old Prague/Tokyo l10n roots. | GREEN in 103_01.3c.4: root script and workflow dependency removed; Prague sidecar translation/verification stays on `scripts/prague-l10n/*`. |
| `scripts/prague-l10n/*.mjs` | Prague page translation/generation and verification scripts. | Keep current page-translation guard/generation if documented; cloudify long term. |
| `scripts/i18n/*.mjs` | Builds and validates hashed Bob/Roma i18n bundles. | Keep as deploy artifact builder/guard, not product truth. |
| `scripts/l10n/*.mjs` | Guards against repo-owned account-instance l10n. | Keep as boundary guard if non-mutating. |
| `scripts/build-dieter.js` and icon processors | Builds Dieter deploy assets and manifest. | Keep as Dieter build artifact pipeline; do not confuse Dieter registry with widget product catalog. |
| Cloudflare build helpers and infra scripts | `scripts/build-bob-cf.mjs`, `scripts/build-roma-cf.mjs`, `scripts/infra/ensure-queues.mjs` | Keep only with documented Cloudflare build/deploy/infra contract. |
| Verifiers and health scripts | `scripts/verify/*.mjs`, `scripts/health/product-path-smoke.mjs` | Keep only as non-mutating guards; update vocabulary after cutover. |
| Dev-only scripts | `scripts/dev/*.mjs` | Keep only if explicitly local-only and absent from product build/deploy/runtime. |

## Final Decisions From 103_01.2

103_01.2 is green for decisions only. It does not approve runtime migration as complete.

| Concern | Final role | Owner operation or deletion rule | 103_01.3 implementation requirement |
| --- | --- | --- | --- |
| `spec.json` | Keep as widget editor schema, normalization, and non-content software defaults. | Bob/Tokyo widget definition source. | Remove starter/customer-visible business copy from widget software authority. Starter instance content/config is handled by the account instance model in 103_02. |
| `editable-fields.json` | Keep as the editable/translatable field contract. | Bob compiled widget package, Tokyo translation/publish operations, San Francisco prompt context. | Rename FAQ `content.json` to `editable-fields.json`; migrate `spec.overlays.text` users; update tests, verifiers, and docs. |
| `widget.html`, `widget.css`, `widget.client.js`, `widget.dom.js` | Keep as widget runtime software assets. | Public artifact builder and Bob preview/compiled package. | Keep as runtime files; do not mix catalog metadata, starter copy, or translation field authority into them. |
| `shared/*` widget runtime files | Keep as shared runtime software assets. | Public artifact builder and embed writer dependency resolver. | Include in source validation and deploy sync as runtime assets only. |
| `media/**` widget files | Keep as widget runtime media assets. | Widget runtime/static asset serving. | Keep only as software-owned media. Account/customer media and starter selections are not owned by widget source. |
| `limits.json` | Keep as a narrow limit mapping file. | `ck-policy` is entitlement authority; Bob uses the mapping during edit operations. | GREEN in 103_01.3c.4: every entry maps to real policy keys/kinds; no tier tables or entitlement truth in widget folders. |
| `catalog.json` | Keep only as small product listing metadata. | Tokyo widget catalog operation may read it directly. | GREEN in 103_01.3c.2 for capability/SEO narrowing; policy/limits mapping remains separate. |
| `agent.md` | Delete as widget product source. | No surviving product operation. | Remove San Francisco existence check and docs/verifier dependencies. Do not preserve as schema/guidance authority. |
| `seo-geo.ts` | Delete from widget source model unless a later named SEO/GEO product operation is approved. | No surviving product operation in this PRD. | GREEN in 103_01.3c.2: widget/shared source files deleted and validator guard added. |
| `tokyo-worker/src/generated/widget-seo-geo-registry.ts` | Delete. | No runtime import found. | GREEN in 103_01.3b. |
| `tokyo/product/widgets/manifest.json` | Delete as product authority. | Replaced by widget catalog/definition product operations. | GREEN in 103_01.3b. |
| `/__internal/renders/widgets/catalog.json` | Delete as product vocabulary. | Replaced by `listWidgetDefinitions` and `getWidgetDefinition` product operations. | GREEN in 103_01.3b. |
| `scripts/build-widget-catalog.mjs` | Delete as broad product assembly. | Replaced by non-mutating widget source validation. | GREEN in 103_01.3b. |
| `scripts/tokyo-r2-deploy-sync.mjs` | Keep only as deploy-byte sync/cloud deploy plumbing. | CI/cloud deploy owner. | Stop publishing generated manifest as source truth; document deploy roots as static bytes, not product model. |
| Other `.mjs` materializers/syncers | Classified as keep/cloudify/dev-only/repair-only/delete for the widget-source gate. | CI/cloud deploy, local dev, or repair owner only. | GREEN in 103_01.3c.4. Future cloudification/folding is allowed only as follow-up, not as a PRD 103 runtime blocker. |

## Product Operations Locked For Migration

The generated catalog route is replaced by product operations:

- `listWidgetDefinitions`: returns the Roma/Prague catalog view of available widgets.
- `getWidgetDefinition(widgetType)`: returns the approved source needed for create/defaults, Bob compile, editable fields, limits, and runtime asset references.
- `validateWidgetSource`: non-mutating guard for widget source files.

HTTP routes, if any, are implementation details. Product code must depend on these operations, not on `manifest.json`, `/__internal/renders/widgets/catalog.json`, or generated catalog file shapes.

## Implementation Work Remaining After 103_01.2

103_01.3 must implement these decisions before 103_01 can close:

- migrate FAQ `content.json` to `editable-fields.json`; GREEN in 103_01.3a
- migrate or remove `spec.overlays.text` as translation authority for Countdown and Logo Showcase; GREEN in 103_01.3c.3
- move Tokyo-worker off generated manifest for widget code lookup, defaults, overlay validation, and catalog entries; GREEN in 103_01.3b
- move Prague off generated manifest imports; GREEN in 103_01.3b
- replace Roma catalog JSON route dependency with product operation clients; GREEN in 103_01.3b
- remove `agent.md` runtime/docs/verifier dependency; GREEN in 103_01.3c.1
- remove SEO/GEO generated registry wiring unless a named operation is approved; GREEN in 103_01.3b for generated registry and GREEN in 103_01.3c.2 for source files/catalog capabilities
- replace `build-widget-catalog.mjs` with non-mutating validation or delete it; GREEN in 103_01.3b
- update docs/tests/verifiers in the same cutover; GREEN through 103_01.4 closure.

## Slice 103_01.3a Scope

This slice changes the FAQ editable-field contract name only.

Included:

- move `tokyo/product/widgets/faq/content.json` to `tokyo/product/widgets/faq/editable-fields.json`;
- rename contract types/functions from widget content vocabulary to editable-field vocabulary;
- update Bob compiled widget payloads, Bob translation review, Roma translation job lookup, Tokyo-worker catalog shape, San Francisco Copilot package context, tests, verifiers, and current generated manifest output to the new field name;
- keep no `tokyo/product/widgets/manifest.json`; it was deleted in 103_01.3b;
- record docs/status updates before closing the slice.

Excluded:

- no generated manifest deletion;
- no catalog route/product operation migration;
- no `agent.md` deletion;
- no `seo-geo.ts` or generated SEO registry deletion;
- no starter-content extraction from `spec.json`;
- no instance source/content split.

Pre-existing dirty runtime files before this slice began:

- `roma/app/api/account/instances/[instanceId]/route.ts`
- `roma/lib/account-instance-translation-jobs.test.ts`

They are not evidence for this slice except where this slice explicitly changed translation-field contract vocabulary.

## Verification For Slice 103_01.3a

Required before marking this slice green:

- active code/test/verifier search for old FAQ field-contract vocabulary is clean outside generic `content` terms;
- `pnpm validate:widgets` passes;
- `pnpm --filter @clickeen/ck-contracts test` passes;
- `pnpm --filter @clickeen/ck-contracts typecheck` passes;
- `pnpm --filter @clickeen/bob test` passes;
- `pnpm --filter @clickeen/bob typecheck` passes;
- `pnpm --filter @clickeen/bob lint` passes;
- `pnpm --filter @clickeen/roma test` passes;
- `pnpm --filter @clickeen/roma typecheck` passes;
- `pnpm --filter @clickeen/roma lint` passes;
- `pnpm --filter @clickeen/sanfrancisco test` passes;
- `pnpm --filter @clickeen/sanfrancisco typecheck` passes;
- `pnpm --filter @clickeen/tokyo-worker test` passes;
- `pnpm --filter @clickeen/tokyo-worker typecheck` passes;
- `pnpm verify:prd103-faq-vertical` passes;
- `git diff --check` passes.

Observed green on 2026-05-19:

- all required commands above passed;
- no active FAQ product/test/verifier caller reads `tokyo/product/widgets/faq/content.json`;
- At the time of 103_01.3a, later widget-source cleanup still had to run. 103_01.4 later closed the full 103_01 PRD.

## Slice 103_01.3b Scope

This slice removes generated widget manifest/catalog-route authority from product paths.

Included:

- replace Tokyo-worker manifest-backed widget catalog with direct widget-definition operations: `listWidgetDefinitions`, `getWidgetDefinition`, and `validateWidgetSource`;
- update Tokyo-worker saved-config, instance-index, create defaults, overlay validation, and internal route code to use widget definitions from approved widget source;
- replace the storage-shaped `GET /__internal/renders/widgets/catalog.json` route with `GET /__internal/widgets/definitions`;
- update Roma callers/tests to call the widget-definition route and payload;
- update Prague widget labels to read widget source metadata directly instead of the generated manifest;
- rewrite widget codebook tests to compare against widget source folders instead of generated manifest;
- delete `tokyo/product/widgets/manifest.json`;
- delete `tokyo-worker/src/generated/widget-seo-geo-registry.ts`;
- delete `scripts/build-widget-catalog.mjs`;
- add non-mutating `scripts/validate-widget-source.mjs`;
- update package scripts so root build/typecheck run `pnpm validate:widgets`.

Excluded:

- no account instance source/content split;
- no public artifact model change;
- no `agent.md` deletion yet;
- no `seo-geo.ts` source deletion yet;
- no `limits.json` policy mapping cleanup;
- no remaining bootstrap-script classification cleanup;
- no final narrowing of `catalog.json` capability fields or `limits.json` policy mapping.

## Slice 103_01.3c.1 Scope

This slice deletes `agent.md` as widget product source.

Included:

- remove the San Francisco embed writer existence check for `product/widgets/${widgetType}/agent.md`;
- remove `agent.md` seeds from San Francisco tests and PRD 103 publish-language verifier;
- delete widget `agent.md` files from FAQ, Countdown, and Logo Showcase;
- add a non-mutating validator guard so widget `agent.md` files cannot return;
- update active architecture/widget/build docs that described `agent.md` as required source or schema authority.

Excluded:

- no Copilot prompt/runtime behavior change;
- no `seo-geo.ts` deletion;
- no non-FAQ editable-field migration;
- no account instance source/content split.

## Slice 103_01.3c.2 Scope

This slice deletes stale widget SEO/GEO source and catalog capability pass-through.

Included:

- delete FAQ, Countdown, and shared widget `seo-geo.ts` source files;
- remove `catalog.capabilities.seoGeo` from widget `catalog.json` files;
- remove SEO/GEO capability parsing/pass-through from Tokyo-worker, Roma, and Prague widget catalog/definition types;
- update widget source validation to reject widget `seo-geo.ts`, shared `seo-geo.ts`, and catalog `capabilities`;
- update active docs that told agents to add widget `seo-geo.ts` or `catalog.capabilities.seoGeo`.

Excluded:

- no change to instance `seoGeo.enabled` controls in `spec.json`;
- no PRD 101 static SEO/GEO publish implementation;
- no account instance source/content split;
- no non-FAQ editable-field migration.

## Slice 103_01.3c.3 Scope

This slice removes `spec.overlays.text` as translation field authority from the remaining current widgets.

Included:

- add `tokyo/product/widgets/countdown/editable-fields.json`;
- add `tokyo/product/widgets/logoshowcase/editable-fields.json`;
- remove top-level `overlays.text` declarations from Countdown and Logo Showcase `spec.json`;
- require `editable-fields.json` for every current widget source in `scripts/validate-widget-source.mjs`;
- update Tokyo-worker widget definition composition so every current widget exposes editable fields through the approved contract and no longer exposes generated overlay-shaped field contracts to Roma;
- update active docs that still taught `content.json` or `spec.overlays.text` as current translation authority.

Excluded:

- no account instance source/content split;
- no new translation runtime behavior;
- no `limits.json` policy mapping cleanup;
- no remaining bootstrap-script classification cleanup.

## Slice 103_01.3c.4 Scope

This slice closes the remaining widget limits and bootstrap-script work from 103_01.3c.

Included:

- validate every current widget `limits.json` against the `ck-policy` entitlement matrix;
- reject tier tables, tier values, profiles, and entitlement truth inside widget `limits.json`;
- add ck-policy coverage for widget limits parsing;
- delete stale `scripts/prague-sync.mjs`;
- remove root/package/workflow dependencies on the old `tokyo/prague/l10n` sync path;
- extend drift guards for deleted product-authority paths and source vocabulary;
- update active docs and PRD ledgers for the final limits/bootstrap decisions.

Excluded:

- no account instance source/content split;
- no translation runtime behavior;
- no server save/publish enforcement implementation for widget limits.

## Verification For Slice 103_01.3c.4

Observed green on 2026-05-19:

- `pnpm validate:widgets` passed;
- `pnpm --filter @clickeen/ck-policy test` passed;
- `pnpm --filter @clickeen/ck-policy typecheck` passed;
- `node scripts/verify/primitive-drift.mjs` passed;
- `pnpm --filter @clickeen/bob test` passed;
- `pnpm --filter @clickeen/bob typecheck` passed;
- `pnpm --filter @clickeen/roma test` passed;
- `pnpm --filter @clickeen/roma typecheck` passed;
- `pnpm --filter @clickeen/roma lint` passed;
- `pnpm --filter @clickeen/tokyo-worker test` passed;
- `pnpm --filter @clickeen/tokyo-worker typecheck` passed;
- `pnpm --filter @clickeen/prague typecheck` passed with 0 errors and existing Astro hints;
- `pnpm --filter @clickeen/sanfrancisco test` passed;
- `pnpm --filter @clickeen/sanfrancisco typecheck` passed;
- `pnpm --filter @clickeen/ck-contracts test` passed;
- `pnpm --filter @clickeen/ck-contracts typecheck` passed;
- `pnpm verify:prd103-faq-vertical` passed;
- `pnpm verify:prd103-publish-language-files` passed;
- `pnpm typecheck` passed;
- `node --check tokyo/dev-server.mjs` passed after removing the old local Prague l10n static route;
- active search found no package/workflow/source dependency on `scripts/prague-sync.mjs` or the old Prague l10n publish path outside deletion notes and fail-fast guards;
- `node scripts/verify/primitive-drift.mjs` passed after final docs/status updates;
- `git diff --check` passed.

## Verification For Slice 103_01.3c.3

Observed green on 2026-05-19:

- `pnpm validate:widgets` passed;
- `pnpm --filter @clickeen/tokyo-worker typecheck` passed;
- `pnpm --filter @clickeen/tokyo-worker test` passed;
- `pnpm --filter @clickeen/bob typecheck` passed;
- `pnpm --filter @clickeen/bob test` passed;
- `pnpm --filter @clickeen/roma typecheck` passed;
- `pnpm --filter @clickeen/roma test` passed;
- `pnpm --filter @clickeen/ck-contracts typecheck` passed;
- `pnpm --filter @clickeen/ck-contracts test` passed;
- `pnpm --filter @clickeen/sanfrancisco test` passed;
- `pnpm verify:prd103-faq-vertical` passed;
- active code/docs search has no current product authority for `content.json`, `spec.overlays.text`, or generated overlay-shaped widget field contracts outside blocked historical notes and fail-fast guards;
- `git diff --check` passed.

## Verification For Slice 103_01.3c.2

Observed green on 2026-05-19:

- `pnpm validate:widgets` passed;
- `pnpm --filter @clickeen/tokyo-worker typecheck` passed;
- `pnpm --filter @clickeen/tokyo-worker test` passed;
- `pnpm --filter @clickeen/roma typecheck` passed;
- `pnpm --filter @clickeen/roma test` passed;
- `pnpm --filter @clickeen/roma lint` passed;
- `pnpm --filter @clickeen/prague typecheck` passed;
- active code search has no catalog capability/SEO generator dependency outside instance `seoGeo.*` config and validator forbidden-path guards;
- `git diff --check` passed.

## Verification For Slice 103_01.3c.1

Observed green on 2026-05-19:

- `pnpm validate:widgets` passed;
- `pnpm --filter @clickeen/sanfrancisco test` passed;
- `pnpm --filter @clickeen/sanfrancisco typecheck` passed;
- `pnpm verify:prd103-publish-language-files` passed;
- active code/test/verifier search found no `agent.md` dependency outside docs/PRD references that explicitly mark it deleted or forbidden;
- `git diff --check` passed.

## Verification For Slice 103_01.3b

Required before marking this slice green:

- active code/test/verifier search has no product dependency on `tokyo/product/widgets/manifest.json`, `/__internal/renders/widgets/catalog.json`, `build-widget-catalog.mjs`, or the generated SEO/GEO registry;
- deleted generated files are absent;
- `pnpm validate:widgets` passes;
- `pnpm --filter @clickeen/tokyo-worker test` passes;
- `pnpm --filter @clickeen/tokyo-worker typecheck` passes;
- `pnpm --filter @clickeen/roma test` passes;
- `pnpm --filter @clickeen/roma typecheck` passes;
- `pnpm --filter @clickeen/roma lint` passes;
- `pnpm --filter @clickeen/prague typecheck` passes;
- `pnpm --filter @clickeen/ck-contracts test` passes;
- `pnpm --filter @clickeen/ck-contracts typecheck` passes;
- `pnpm verify:prd103-faq-vertical` passes;
- `pnpm verify:prd103-publish-language-files` passes;
- `pnpm tokyo:r2:sync:check` passes;
- root `pnpm typecheck` passes after package-script cutover;
- `git diff --check` passes.

Observed green on 2026-05-19:

- all required commands above passed;
- root `pnpm typecheck` passed after `build`/`typecheck` were rewired to `pnpm validate:widgets`;
- the only active-code search hit is `scripts/validate-widget-source.mjs` refusing the deleted generated registry path if it reappears;
- At the time of 103_01.3b, later widget-source cleanup still had to run. 103_01.4 later closed the full 103_01 PRD.

## Slice 103_01.4 Scope

This closure slice does not change runtime behavior.

Included:

- mark 103_01 complete only after 103_01.3a, 103_01.3b, 103_01.3c.1, 103_01.3c.2, 103_01.3c.3, and 103_01.3c.4 are green;
- confirm every 103_00 blast-radius row owned by 103_01 is GREEN;
- confirm every remaining open blast-radius row is owned by 103_02 or 103_00.4, not by 103_01;
- update the deterministic status ledger and pre-103 execution ledger so the next allowed implementation step is 103_02;
- keep PRD 103 runtime translation work blocked until 103_02 and 103_00.4 close.

Excluded:

- no account instance source/content split;
- no translation generation or queue behavior;
- no publish/public artifact model change;
- no additional widget-source runtime migration.

## Verification For Slice 103_01.4

Observed green on 2026-05-19:

- 103_01 acceptance rows are green;
- 103_00 blast-radius rows BR-001 through BR-009 and BR-028 are GREEN;
- no 103_01-owned blast-radius row remains open;
- remaining open blast-radius rows are owned by 103_02 or 103_00.4;
- active search found no package/workflow/source dependency on deleted widget manifest, generated catalog route, broad widget-catalog builder, deleted widget source files, stale Prague l10n sync path, `spec.overlays.text`, or catalog capabilities outside fail-fast guards and historical/deletion notes;
- no runtime/code file is changed by this closure slice;
- `pnpm validate:widgets` passed;
- `node scripts/verify/primitive-drift.mjs` passed;
- `git diff --check` passed.

## Verification For Slice 103_01.1

Required before marking this slice green:

- code-path subagent completed read-only inventory;
- docs/tests/verifiers subagent completed read-only inventory;
- local repo search confirmed active consumers and generated artifact writers;
- this execution ledger exists;
- `103_01` remains executing, not complete;
- no runtime/code files are edited by this slice beyond the two pre-existing dirty Roma files recorded before `103_00.1`;
- `git diff --check` passes.

Slice 103_01.1 cannot close if implementation moved before final file-role decisions.

## Verification For Slice 103_01.2

Required before marking this slice green:

- architecture verification subagent completed and blockers were folded into the final decision table;
- docs/status verification subagent completed and required status updates were applied;
- shared runtime assets and widget media are included in the source model;
- `spec.json` starter/customer-visible defaults are recorded as migration debt, not final widget software authority;
- final decisions exist for `content.json`/`editable-fields.json`, `agent.md`, `catalog.json`, `limits.json`, `seo-geo.ts`, generated SEO registry, generated manifest, catalog route, and bootstrap scripts;
- no runtime/code files are edited by this slice beyond the two pre-existing dirty Roma files recorded before `103_00.1`;
- `git diff --check` passes.
