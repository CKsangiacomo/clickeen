# PRD 103_01 - Widget Source And Bootstrap Script Audit

Status: Planning Hold / Superseded By `103_DB_Pivot`
Owner: Product + Architecture
Date: 2026-05-21
Parent: `103_00__PRD__Pre_103_Architecture_Gate.md`
Execution ledger: `103_01__EXEC__Widget_Source_And_Bootstrap_Script_Audit.md`

## Purpose

2026-05-21 update: this audit remains useful planning evidence, but PRD 103 cannot resume from it. The DB pivot now owns the deeper correction: application state belongs in Supabase, public artifacts belong in R2/CDN, and generated/bootstrap JSON must not be product coordination state.

Lock the widget software source model before PRD 103 resumes.

This PRD decides which files belong in `tokyo/product/widgets/{widgetType}/`, which files are generated, which files are local/bootstrap leftovers, and which scripts must disappear or become narrow Cloudflare-era tooling.

## Product Truth

Widget software is software. It must not own account starter business copy.

The widget folder must expose only current product truth needed by Bob, Roma, Tokyo-worker, Prague, San Francisco, and publish. If a file is only useful because a bootstrap script made it convenient, it is a delete candidate.

Roma must read Tokyo's widget catalog through a product service boundary, not a generated file contract. A route named `/__internal/renders/widgets/catalog.json` is a drift smell because it exposes a generated artifact as the product API.

The target is not to hide a generated `manifest.json` or `catalog.json` behind a nicer function name. The target is to delete those storage-shaped concepts as product authority. A generated artifact may survive only if it is a disposable build/deploy output from real widget source, and no product service treats the artifact as the source model.

This is also a performance requirement. Widget catalog access must not require "build generated manifest, deploy manifest, Tokyo reads manifest, Roma calls catalog JSON, Roma interprets generated payload." The product operation is "resolve available widget definitions." If a generated artifact remains, it must be an implementation cache of that operation, not the operation itself.

## Scope

Audit and classify:

- `tokyo/product/widgets/{widgetType}/spec.json`
- `tokyo/product/widgets/{widgetType}/editable-fields.json` final name for editable/translatable field contracts; FAQ was migrated from the former `content.json` in 103_01.3a
- `tokyo/product/widgets/{widgetType}/widget.html`
- `tokyo/product/widgets/{widgetType}/widget.css`
- `tokyo/product/widgets/{widgetType}/widget.client.js`
- `tokyo/product/widgets/{widgetType}/widget.dom.js` where present
- `tokyo/product/widgets/shared/**`
- `tokyo/product/widgets/{widgetType}/media/**`
- `tokyo/product/widgets/{widgetType}/agent.md`
- `tokyo/product/widgets/{widgetType}/catalog.json`
- `tokyo/product/widgets/{widgetType}/limits.json`
- `tokyo/product/widgets/{widgetType}/seo-geo.ts`
- `tokyo/product/widgets/manifest.json`
- `scripts/build-widget-catalog.mjs`
- bootstrap-era `scripts/**/*.mjs` materializers/syncers that generate product artifacts or push repo files into Tokyo/R2.

## Final 103_01.2 File Role Decisions

Existing imports, package scripts, docs, and tests prove dependency only. They do not prove product legitimacy.

| File or concept | Final decision | Notes |
| --- | --- | --- |
| `spec.json` | Keep as editor schema, normalization, and non-content software defaults. | Current `spec.defaults` still contains customer-visible starter copy and sample selections. That is migration debt, not final authority. Starter content belongs to the account starter instance model handled with 103_02. |
| `editable-fields.json` | Keep as editable/translatable field contract. | All current widgets declare this file. FAQ `content.json` was renamed; Countdown and Logo Showcase no longer use `spec.overlays.text` as final translation authority. |
| `widget.html`, `widget.css`, `widget.client.js`, `widget.dom.js` | Keep as runtime software assets. | Runtime files are widget software. They do not own catalog metadata, starter content, or translation contracts. |
| `shared/**` | Keep as shared runtime software assets. | Shared JS/CSS imported by widget HTML is part of runtime software, not catalog/source metadata. |
| `media/**` | Keep as widget runtime media assets. | Account/customer media and starter selections are not owned by widget source. |
| `limits.json` | Keep only as mapping from widget paths/ops to real `ck-policy` keys. | Entitlement truth remains in `ck-policy`, for example `items.group.small.max`, `items.group.medium.max`, and `items.group.large.max`. |
| `catalog.json` | Keep only as small product listing metadata read by the widget catalog operation. | It may contain label, description, category, and order. Capability, policy, SEO/GEO, defaults, editable fields, overlays, and generated registry state do not belong here. |
| `agent.md` | Delete as widget product source. | The only runtime evidence is an existence check that discards content. Docs that call it an AI editing contract are obsolete for this model. |
| `seo-geo.ts` | Delete from this widget source model. | No runtime product operation imports the generated registry today. SEO/GEO can return only through a named publish/SEO operation in a later PRD. |
| `tokyo-worker/src/generated/widget-seo-geo-registry.ts` | Delete. | It is generated by the bootstrap catalog script and has no proven runtime consumer. |
| `tokyo/product/widgets/manifest.json` | Delete as product authority. | Replacement must cover Tokyo-worker widget code/default lookup, overlay validation, catalog entries, Prague labels, tests, and deploy sync before deletion. |
| `/__internal/renders/widgets/catalog.json` | Delete as product vocabulary. | Replace with `listWidgetDefinitions` and `getWidgetDefinition` product operations. A route shim may exist only during the same migration with an owner and removal condition. |
| `scripts/build-widget-catalog.mjs` | Delete as broad product assembly. | Replace with non-mutating source validation and, only if needed, disposable deploy generation that no product boundary imports as authority. |
| `scripts/tokyo-r2-deploy-sync.mjs` | Keep only as deploy-byte sync/cloud deploy plumbing. | It may publish static bytes, but it must not make generated manifests or synced R2 keys into product truth. |

## 103_01.3a Execution Result

Slice 103_01.3a is green for the FAQ editable-field contract migration.

The current FAQ field contract is now:

```text
tokyo/product/widgets/faq/editable-fields.json
```

This file is the editable/translatable field contract. It is not account instance content and it is not starter copy.

At the time of 103_01.3a, later widget-source cleanup still had to run. 103_01.4 later closed the full widget-source/bootstrap audit.

## 103_01.3b Execution Result

Slice 103_01.3b is green for widget catalog operation migration.

Current widget definition authority is:

```text
tokyo/product/widgets/{widgetType}/catalog.json
tokyo/product/widgets/{widgetType}/spec.json
tokyo/product/widgets/{widgetType}/editable-fields.json where present
@clickeen/ck-contracts overlay codebook
```

Tokyo-worker exposes this through `listWidgetDefinitions` and `getWidgetDefinition`. Roma calls `GET /__internal/widgets/definitions`; Prague reads widget source metadata directly at build time.

Deleted in 103_01.3b:

- `tokyo/product/widgets/manifest.json`
- `tokyo-worker/src/generated/widget-seo-geo-registry.ts`
- `scripts/build-widget-catalog.mjs`

Added in 103_01.3b:

- `scripts/validate-widget-source.mjs`
- root `pnpm validate:widgets`

Later 103_01 slices closed the remaining widget-source cleanup. 103_01.3c.1 deleted `agent.md`; 103_01.3c.2 deleted widget `seo-geo.ts` and catalog capabilities; 103_01.3c.3 moved Countdown and Logo Showcase to `editable-fields.json`; 103_01.3c.4 implemented and verified `limits.json` policy-key validation and deleted the stale Prague sync path. 103_01.4 closed the PRD.

## 103_01.3c.1 Execution Result

Slice 103_01.3c.1 is green for `agent.md` deletion.

Deleted in 103_01.3c.1:

- `tokyo/product/widgets/faq/agent.md`
- `tokyo/product/widgets/countdown/agent.md`
- `tokyo/product/widgets/logoshowcase/agent.md`

San Francisco embed generation no longer requires or reads `agent.md`. Fixtures no longer seed it, and `scripts/validate-widget-source.mjs` fails if a widget `agent.md` returns.

## 103_01.3c.2 Execution Result

Slice 103_01.3c.2 is green for widget SEO/GEO source deletion and catalog narrowing.

Deleted in 103_01.3c.2:

- `tokyo/product/widgets/faq/seo-geo.ts`
- `tokyo/product/widgets/countdown/seo-geo.ts`
- `tokyo/product/widgets/shared/seo-geo.ts`
- `catalog.capabilities.seoGeo` in widget catalog files and product payloads

`scripts/validate-widget-source.mjs` now fails if widget `seo-geo.ts`, shared `seo-geo.ts`, or `catalog.capabilities` return. Instance `seoGeo.enabled` controls are unchanged and remain outside this widget-source deletion slice.

## 103_01.3c.3 Execution Result

Slice 103_01.3c.3 is green for non-FAQ editable-field migration.

Added in 103_01.3c.3:

- `tokyo/product/widgets/countdown/editable-fields.json`
- `tokyo/product/widgets/logoshowcase/editable-fields.json`

Deleted as source authority in 103_01.3c.3:

- Countdown `spec.json.overlays.text`
- Logo Showcase `spec.json.overlays.text`

`scripts/validate-widget-source.mjs` now requires `editable-fields.json` for every current widget and fails if `spec.overlays.text` returns. Tokyo-worker widget-definition composition exposes editable fields for all current widgets from that contract. Tokyo-worker derives overlay validation primitives internally from `editable-fields.json`; Roma receives editable fields, not a generated `overlays.text` contract.

## 103_01.3c.4 Execution Result

Slice 103_01.3c.4 is green for limits and bootstrap-script closure.

- `scripts/validate-widget-source.mjs` validates every current widget `limits.json` against real `ck-policy` keys/kinds.
- Widget `limits.json` files cannot define tier values, tiers, profiles, or entitlement truth.
- `packages/ck-policy/src/limits.test.ts` proves all current widget limits parse through `ck-policy`.
- `scripts/prague-sync.mjs` is deleted as stale local-bootstrap sync.
- Root package scripts and Prague GitHub Actions no longer invoke or watch the old `tokyo/prague/l10n` publish path.
- `scripts/verify/primitive-drift.mjs` blocks deleted widget manifest/catalog route vocabulary, stale Prague l10n roots, deleted widget source files, `spec.overlays.text`, and catalog capabilities.

## Bootstrap Script Classification

Every materializer/syncer script must be classified:

- `keep`: still required by a documented Cloudflare build/deploy/runtime contract.
- `cloudify`: responsibility moves into a Cloudflare-owned service or deploy boundary.
- `dev-only`: local setup helper, absent from product build/deploy/runtime.
- `repair-only`: explicit operator tool, never called by product paths.
- `delete`: local bootstrap artifact with no current product contract.

Verification scripts may remain only as non-mutating guards.

## Product Operation Owners

| Concern | Surviving owner | Notes |
| --- | --- | --- |
| Widget software source | `tokyo/product/widgets/{widgetType}/` under Product + Architecture | Source files may be read by build/runtime code, but generated artifacts are not authority. |
| Widget catalog operation | Tokyo-worker product operation: `listWidgetDefinitions` and `getWidgetDefinition` | Roma and Prague ask for widget definitions; they do not import or interpret generated manifest output. |
| Compiled widget payload for Bob | Bob route backed by approved widget source/deploy assets | Bob may receive `spec`, editable fields, runtime files, and limits, but not a catchall generated widget manifest as product truth. |
| Widget limit mapping | `packages/ck-policy` plus widget `limits.json` only if mapped to real policy keys | Widget folders declare path/operation/cap mappings; entitlement truth stays in account policy. |
| SEO/GEO registry | Tokyo-worker only if current publish/SEO generation proves the need | If kept, generated registry is deploy output from widget source, not catalog authority. |
| Deploy/sync scripts | CI/cloud deploy owner | Scripts may copy deploy assets; they do not define source or runtime product contracts. |

## Implementation Blast Radius - Code Vectors

These are the concrete places implementation must audit before moving PRD 103 forward. The expected action is not necessarily edit-every-file in this PRD, but every vector needs a keep/delete/move decision and a test update when implementation begins.

| Vector | Current coupling | Required implementation decision |
| --- | --- | --- |
| `package.json` `validate:widgets` | Root build/typecheck runs non-mutating widget source validation. | GREEN in 103_01.3b: no generated widget manifest writer remains in build/typecheck. |
| `scripts/validate-widget-source.mjs` | Validates widget source directly and fails if deleted generated authority or detached limits policy reappears. | GREEN in 103_01.3b for non-mutating validation; GREEN in 103_01.3c.4 for limits policy-key validation. |
| `tokyo/product/widgets/manifest.json` | Historical generated manifest imported by Tokyo-worker, Prague, tests, and contracts as source. | GREEN in 103_01.3b: deleted and no product-boundary caller remains. |
| `tokyo/product/widgets/{widget}/spec.json` | Currently carries editor schema plus starter/customer-visible defaults. | Keep schema/default software role, but extract starter business copy to the starter instance model before PRD 103 resumes. |
| `tokyo/product/widgets/shared/**` and widget `media/**` | Runtime shared assets and widget media are deployed/read as widget software. | Keep as runtime assets; do not use them as catalog, starter content, or account asset truth. |
| `tokyo-worker/src/domains/widget-catalog.ts` | Reads approved widget source directly. | GREEN in 103_01.3b: owns `listWidgetDefinitions`, `getWidgetDefinition`, and `validateWidgetSource`; no manifest import. |
| `tokyo-worker/src/routes/internal-render-routes.ts` `/__internal/widgets/definitions` | Exposes widget-definition product operation output. | GREEN in 103_01.3b: old `/__internal/renders/widgets/catalog.json` route removed. |
| `roma/lib/account-instance-direct.ts` and `roma/app/api/account/widgets/route.ts` | Roma calls Tokyo widget-definition operation and maps product payload into UI catalog. | GREEN in 103_01.3b. |
| `prague/src/lib/widgetCatalog.ts` and Prague widget pages/components | Prague reads widget source metadata directly. | GREEN in 103_01.3b; no direct manifest dependency. |
| `bob/lib/api/compiled-widget-route.ts` and `bob/lib/types.ts` | Bob exposed `content.json` in compiled widget files before 103_01.3a. | GREEN for FAQ in 103_01.3a: compiled payload now exposes `editable-fields.json`/editable fields vocabulary. Keep payload narrow in later catalog-operation migration. |
| `bob/lib/i18n/loader.ts` and `bob/lib/compiler/media.ts` | Uses `manifest` for locale and Dieter registries. | Rename only if product-facing vocabulary leaks; deploy artifact registries may stay as implementation details. |
| `packages/ck-contracts/src/*` widget tests | Tests read widget source folders and `editable-fields.json`, not generated manifest/content files. | GREEN in 103_01.3b for generated manifest removal and GREEN in 103_01.3c.3 for current widget editable-field source validation. |
| Generic PRD103J verifier and `scripts/verify/primitive-drift.mjs` | The old FAQ-only verifier was deleted. Generic translation proof now references `editable-fields.json` directly across FAQ and non-FAQ widgets; primitive drift blocks deleted source/path vocabulary. | GREEN for editable-field proof and post-source-gate drift guards. |
| Widget docs under `documentation/widgets/**` and service docs | 103_01.3a/3b/3c updated field-contract, generated-manifest, `agent.md`, SEO/GEO, catalog, and limits docs. | GREEN in 103_01.3c.4 for widget-source documentation; instance/public artifact docs remain under 103_02. |

## Cutover And Deletion Sequence

1. Inventory current consumers of `manifest.json`, `content.json`, `catalog.json`, `agent.md`, `limits.json`, `seo-geo.ts`, and `scripts/build-widget-catalog.mjs`.
2. Approve the final widget source file roles before code starts. No implementation may preserve a file only because a consumer exists.
3. Decide `content.json` -> `editable-fields.json`. If approved, migrate FAQ first and update Bob, Tokyo-worker, contracts, verify scripts, and docs in the same implementation slice.
4. Replace Tokyo's generated catalog route with a product catalog operation whose response is sourced from approved widget source or a private generated cache.
5. Move Roma and Prague off direct generated-manifest dependencies. Tests must mock product catalog responses, not committed generated files.
6. Split or delete `scripts/build-widget-catalog.mjs`. If part survives, it must be named and documented as validation/deploy generation only.
7. Delete product use of `tokyo/product/widgets/manifest.json`. A surviving generated file must have no product-boundary imports and a documented rebuild rule.
8. Update docs that currently tell agents to rerun bootstrap catalog/materializer scripts as architecture.

## Migration Shim Constraints

- Shims may exist only to keep old callers working while the same implementation slice moves them to product operations.
- Shims must not introduce a second widget source shape or fallback from approved source to generated manifest on failure.
- Shims must fail fast when required approved source is invalid; do not silently regenerate source truth from old artifacts.
- No new product caller may be added to `/__internal/renders/widgets/catalog.json` or direct `tokyo/product/widgets/manifest.json` imports during this cutover.
- The final state must delete old product callers before PRD 103 resumes. A shim left behind without callers is a deletion task, not tech debt to normalize.

## Occurrence Inventory - Widget, Catalog, And Bootstrap Scripts

| Occurrence | Classification | Current problem | Required action |
| --- | --- | --- | --- |
| `scripts/validate-widget-source.mjs` | Keep | Non-mutating source validation; fails if generated manifest/SEO registry authority reappears. | GREEN in 103_01.3b. |
| `tokyo/product/widgets/manifest.json` | Deleted | Was used by Tokyo-worker, Prague, Roma tests, and contract tests as if it were current source truth. | GREEN in 103_01.3b. |
| `/__internal/renders/widgets/catalog.json` | Deleted product vocabulary | Exposed generated catalog JSON as the service route. | GREEN in 103_01.3b; replaced by `GET /__internal/widgets/definitions`. |
| `prague/src/lib/widgetCatalog.ts` | Product dependency corrected | Previously imported `tokyo/product/widgets/manifest.json` directly. | GREEN in 103_01.3b; Prague reads source metadata directly. |
| `bob/lib/i18n/loader.ts` `I18nManifest` | Naming drift | Uses `manifest` to mean locale/bundle catalog. | Rename product-facing concepts toward `LocaleCatalog` or `LocaleRegistry`; keep hashed bundle files as deploy artifacts. |
| `bob/lib/compiler/media.ts` `DieterManifest` | Naming drift | Uses `manifest` to mean Dieter component/dependency registry. | Rename toward `DieterComponentRegistry`; document deploy artifact status. |
| Multiple `manifest` meanings across Bob, Dieter, Tokyo widgets, Prague, and asset hashing | Naming drift | Five different catalogs use the same storage-file word, making "manifest" meaningless as architecture vocabulary. | Each surviving catalog must be named by product meaning: locale catalog, Dieter component registry, widget catalog, asset version registry. |
| `packages/ck-contracts/src/overlay-codebooks.test.ts` | Test drift fixed | Required overlay codebook to match generated manifest. | GREEN in 103_01.3b: asserts coverage against widget source folders. |
| Generic translated-value primitive tests | Test drift | The deleted FAQ-only test previously read FAQ `content.json` as language-value authority. | GREEN under 103J: tests read `editable-fields.json` and assert the generic field contract, not starter/base content. |
| `roma/lib/account-instance-translation-jobs.test.ts` | Test drift fixed | Imported generated widget manifest and mocked `/__internal/renders/widgets/catalog.json`. | GREEN in 103_01.3b: mocks `GET /__internal/widgets/definitions`. |
| `tokyo/product/widgets/{widget}/content.json` | Deleted product authority | The old name implied widget-owned customer content. | GREEN for current widgets: all current editable/translatable field contracts are named `editable-fields.json`. |
| `tokyo/product/widgets/{widget}/agent.md` | Deleted | Guidance file with no named schema authority. | GREEN in 103_01.3c.1: runtime/docs/verifier dependency removed and validation blocks return. |
| `tokyo/product/widgets/{widget}/catalog.json` | Kept as small metadata | Product listing metadata and capability flags risked becoming catchall soup. | GREEN in 103_01.3c.2: capability fields removed; direct widget-definition operation consumes label, description, category, and order. |
| `tokyo/product/widgets/{widget}/limits.json` | Kept with narrow contract | Limit declarations were detached unless mapped to real policy keys. | GREEN in 103_01.3c.4: every current widget `limits.json` is validated against `ck-policy` matrix keys/kinds and cannot define tier values. |
| `tokyo/product/widgets/{widget}/seo-geo.ts` and generated SEO registry | Deleted | Current model was stale under the static embed model. | GREEN in 103_01.3b/3c.2: generated registry and widget/shared SEO/GEO source deleted. |
| `scripts/i18n/build.mjs` | Keep as deploy artifact builder | Produces hashed Roma/Bob i18n bundles. | Keep as build artifact generation; document that output is deploy artifact, not product truth. |
| `scripts/l10n/build.mjs` and `scripts/l10n/validate.mjs` | Repair-only / guard | They refuse repo-owned account-instance l10n and are not materializers. | Keep only as boundary guards. |
| `scripts/build-dieter.js` | Keep as deploy artifact builder | Writes `tokyo/product/dieter/**`, including a Dieter manifest consumed by Bob compiler. | Keep, but document Dieter manifest as deploy/build artifact, not widget/product source authority. |
| `scripts/process-svgs.js` inside Dieter build | Repair-only candidate | Mutates `dieter/icons/svg` source in place. | Keep only as deliberate icon normalization/repair, not an always-on implicit source mutation. |
| `scripts/tokyo-r2-deploy-sync.mjs` | Cloudify | Pushes repo deploy roots into Tokyo/R2. | Keep as CI/cloud deploy behavior only; never treat local synced R2 keys as source truth. |
| `scripts/tokyo-fonts-sync.mjs` | Cloudify / narrow keep | Separate font publisher covered by broader Tokyo sync. | Keep only if a real deploy need exists; otherwise fold into cloud deploy or delete. |
| `scripts/prague-l10n/translate.mjs` | Keep, cloudify long-term | Generates real Prague page translations consumed by Prague build, but calls San Francisco from script land. | Keep current page-translation contract, but move orchestration toward CI/cloud service ownership. |
| `scripts/prague-l10n/verify.mjs` | Keep | Validates Prague sidecars against base page fingerprints. | Keep as non-mutating guard. |
| `scripts/prague-sync.mjs` | Deleted | Published from absent/stale `tokyo/prague/l10n` while current docs say Prague translations live beside pages and root `l10n/**` must not publish. | GREEN in 103_01.3c.4: root script and GitHub Actions dependency removed; Prague content workflow now translates/verifies page sidecars directly. |
| `scripts/build-bob-cf.mjs` and `scripts/build-roma-cf.mjs` | Dev/build-only | Cloudflare build shims, not product truth. | Keep only as build plumbing. |
| `admin/scripts/*` and showcase generators | Dev-only | Generate DevStudio docs/showcase artifacts. | Keep out of product source model; delete stale targets such as old Dieter admin showcase if unused. |
| `scripts/infra/ensure-queues.mjs` | Cloudify | Creates infra as deploy side effect. | Keep in deploy automation; not part of product source truth. |

## Slow Path Inventory - Widget Source

| Slow path | Current cause | Required simplification |
| --- | --- | --- |
| Roma widget catalog | Roma calls a JSON catalog route backed by generated manifest output. | Roma calls a product catalog operation. The owning service resolves widget definitions from approved widget source or a disposable cache. |
| Prague widget catalog | Prague reads widget source metadata directly. | GREEN in 103_01.3b; no direct generated-manifest dependency. |
| Widget build validation | `scripts/validate-widget-source.mjs` validates `catalog.json`, `editable-fields.json`, `spec.json`, overlays, and SEO/GEO source presence without writing output. | GREEN in 103_01.3b. |
| Build/deploy sync | R2 sync scripts push repo files into runtime storage and can make deployed objects look like source. | Cloud deploy may copy static assets, but services must not treat copied objects as source of product truth. |
| Dieter/media manifest | Bob compiler reads a remote `dieter/manifest.json` to resolve component/media bundles. | Keep only if it is a build/deploy component registry; do not let it become widget product/catalog authority. |

## Runtime And Service Dependencies

- Tokyo-worker must have access to approved widget source or a private deploy cache for widget catalog operations.
- Roma account widgets UI depends on the catalog operation for create/list labels and grouping.
- Bob compiled-widget loading depends on runtime widget files, editable field contract, and limits.
- Prague static/widget pages depend on widget labels and descriptions, but not on manifest file identity.
- `ck-policy` remains the policy authority; widget `limits.json` cannot define account entitlements by itself.
- Cloudflare deploy/sync scripts may publish static bytes, fonts, Dieter bundles, and widget runtime files, but they must not be treated as account instance or widget source truth.

## Tests And Verifiers To Rewrite

| Test/verifier | Required rewrite |
| --- | --- |
| `packages/ck-contracts/src/overlay-codebooks.test.ts` | GREEN in 103_01.3b: asserts supported widget source/codebook coverage without reading generated widget manifest as authority. |
| Generic translated-value primitive tests | GREEN under 103J: read final editable-fields contracts and assert field paths/roles, not widget-owned content. |
| `packages/ck-contracts/src/overlay-primitives.test.ts` | GREEN in 103_01.3a: primitive/path assertions align with final editable-field source. |
| `roma/lib/account-instance-translation-jobs.test.ts` | GREEN in 103_01.3b: mocks widget-definition and translation operations; does not import manifest or catalog JSON route. |
| `bob/lib/translations-preview.test.ts` | GREEN in 103_01.3a: FAQ field contract import uses `editable-fields.json`. |
| Generic PRD103J verifier | GREEN for editable-field contract naming across FAQ and non-FAQ widgets. |
| `scripts/verify/primitive-drift.mjs` | GREEN in 103_01.3c.4: guards deleted generated widget manifest/catalog route, stale Prague l10n root, deleted widget source files, `spec.overlays.text`, and catalog capabilities. |
| Root `pnpm validate:widgets` path | GREEN in 103_01.3b: validates approved source without generated output. |

## Acceptance

103_01.4 closure: all acceptance criteria below are green. PRD 103 runtime work remains blocked by 103_02 and 103_00.4, not by widget-source/bootstrap audit work.

- Each widget-folder file has a documented role: source truth, generated artifact, generated read model, local/dev helper, repair-only tool, or delete.
- Product paths no longer depend on a catchall widget manifest. No surviving generated widget manifest remains.
- Roma no longer has a product dependency on `tokyo/product/widgets/manifest.json`.
- Roma-facing catalog routes/docs no longer expose `catalog.json` as the product boundary.
- Widget catalog resolution has a direct product owner and does not require Roma/Prague/tests to read generated manifest output.
- FAQ `content.json` -> `editable-fields.json` migration is implemented and verified in 103_01.3a.
- Countdown and Logo Showcase `spec.overlays.text` -> `editable-fields.json` migration is implemented and verified in 103_01.3c.3.
- `agent.md`, `catalog.json`, `seo-geo.ts`, and `limits.json` each have a keep/kill decision.
- `scripts/build-widget-catalog.mjs` has a keep/cloudify/delete decision: deleted in 103_01.3b and replaced with `scripts/validate-widget-source.mjs`.
- Root build/typecheck scripts no longer preserve bootstrap-era product materialization under product-sounding names.
- Every code vector in the blast-radius table has an implementation task, deletion task, or explicit no-op rationale.
- Old catalog/manifest shims have an owner and removal condition before implementation starts.
- Test and verifier rewrites above are included in the implementation plan; no manifest/content-json test is left as the guard for new product behavior.
- Service docs and widget docs that still teach generated-manifest/catalog bootstrap behavior are assigned to the same cutover.
- No PRD 103 translation code resumes until this PRD is complete.
