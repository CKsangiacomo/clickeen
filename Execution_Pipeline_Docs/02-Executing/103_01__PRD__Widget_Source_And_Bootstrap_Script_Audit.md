# PRD 103_01 - Widget Source And Bootstrap Script Audit

Status: Draft / Pre-103 prerequisite
Owner: Product + Architecture
Date: 2026-05-19
Parent: `103_00__PRD__Pre_103_Architecture_Gate.md`

## Purpose

Lock the widget software source model before PRD 103 resumes.

This PRD decides which files belong in `tokyo/product/widgets/{widgetType}/`, which files are generated, which files are local/bootstrap leftovers, and which scripts must disappear or become narrow Cloudflare-era tooling.

## Product Truth

Widget software is software. It must not own account starter business copy.

The widget folder must expose only current product truth needed by Bob, Roma, Tokyo-worker, Prague, San Francisco, and publish. If a file is only useful because a bootstrap script made it convenient, it is a delete candidate.

Roma must read Tokyo's widget catalog through a product service boundary, not a generated file contract. A route named `/__internal/renders/widgets/catalog.json` is a drift smell because it exposes a generated artifact as the product API.

## Scope

Audit and classify:

- `tokyo/product/widgets/{widgetType}/spec.json`
- `tokyo/product/widgets/{widgetType}/editable-fields.json` target name for current `content.json`
- `tokyo/product/widgets/{widgetType}/widget.html`
- `tokyo/product/widgets/{widgetType}/widget.css`
- `tokyo/product/widgets/{widgetType}/widget.client.js`
- `tokyo/product/widgets/{widgetType}/agent.md`
- `tokyo/product/widgets/{widgetType}/catalog.json`
- `tokyo/product/widgets/{widgetType}/limits.json`
- `tokyo/product/widgets/{widgetType}/seo-geo.ts`
- `tokyo/product/widgets/manifest.json`
- `scripts/build-widget-catalog.mjs`
- bootstrap-era `scripts/**/*.mjs` materializers/syncers that generate product artifacts or push repo files into Tokyo/R2.

## Initial Decisions

- Rename `content.json` to `editable-fields.json`. It is a field contract, not content.
- Kill `agent.md` unless a real current consumer is proven. It is not schema authority.
- Keep `limits.json` only as path/operation/cap mapping to real `ck-policy` keys, such as `items.group.small.max`, `items.group.medium.max`, and `items.group.large.max`.
- Treat `catalog.json` as keep-only-if-useful. If it survives, it must be small catalog metadata, not a capability soup.
- Treat `seo-geo.ts` as keep-only-if-useful in the current static embed model.
- Treat `tokyo/product/widgets/manifest.json` and `scripts/build-widget-catalog.mjs` as kill candidates. Existing consumers prove dependency, not correctness.
- Roma tests must not import committed generated widget manifests as product truth. Tests should mock the Tokyo catalog service response directly.
- If a widget catalog survives, it must be a narrow service contract for the product questions Roma asks, not a generated bundle containing defaults, catalog metadata, editable fields, overlays, and SEO/GEO registry state.

## Bootstrap Script Classification

Every materializer/syncer script must be classified:

- `keep`: still required by a documented Cloudflare build/deploy/runtime contract.
- `cloudify`: responsibility moves into a Cloudflare-owned service or deploy boundary.
- `dev-only`: local setup helper, absent from product build/deploy/runtime.
- `repair-only`: explicit operator tool, never called by product paths.
- `delete`: local bootstrap artifact with no current product contract.

Verification scripts may remain only as non-mutating guards.

## Occurrence Inventory - Widget, Catalog, And Bootstrap Scripts

| Occurrence | Classification | Current problem | Required action |
| --- | --- | --- | --- |
| `scripts/build-widget-catalog.mjs` | Audit before keep | Generates `tokyo/product/widgets/manifest.json` and `tokyo-worker/src/generated/widget-seo-geo-registry.ts`; real consumers exist, but the output is currently treated as product authority. | Decide whether it survives as a private deploy/build artifact generator. If it survives, product services must call `get widget catalog` / `resolve widget definition`, not read the manifest as authority. |
| `tokyo/product/widgets/manifest.json` | Generated artifact candidate | Used by Tokyo-worker, Prague, Roma tests, and contract tests as if it were current source truth. | Keep only as generated read model hidden behind service/resolver APIs, or delete after consumers move to source folders/contracts. |
| `/__internal/renders/widgets/catalog.json` | Boundary drift | Exposes generated catalog JSON as the service route. | Replace or wrap behind product vocabulary: `get widget catalog` / `list widget definitions`. |
| `prague/src/lib/widgetCatalog.ts` | Product dependency drift | Imports `tokyo/product/widgets/manifest.json` directly. | Prague must resolve widget definitions through a stable product/build contract, not direct manifest import. |
| `bob/lib/i18n/loader.ts` `I18nManifest` | Naming drift | Uses `manifest` to mean locale/bundle catalog. | Rename product-facing concepts toward `LocaleCatalog` or `LocaleRegistry`; keep hashed bundle files as deploy artifacts. |
| `bob/lib/compiler/media.ts` `DieterManifest` | Naming drift | Uses `manifest` to mean Dieter component/dependency registry. | Rename toward `DieterComponentRegistry`; document deploy artifact status. |
| Multiple `manifest` meanings across Bob, Dieter, Tokyo widgets, Prague, and asset hashing | Naming drift | Five different catalogs use the same storage-file word, making "manifest" meaningless as architecture vocabulary. | Each surviving catalog must be named by product meaning: locale catalog, Dieter component registry, widget catalog, asset version registry. |
| `packages/ck-contracts/src/overlay-codebooks.test.ts` | Test drift | Requires overlay codebook to match generated manifest. | Assert coverage against the supported widget registry/contract API, not a generated file. |
| `packages/ck-contracts/src/faq-language-values.test.ts` | Test drift | Reads current widget `content.json` as language-value authority. | Update after `content.json` becomes `editable-fields.json`; assert field contract, not starter/base content. |
| `roma/lib/account-instance-translation-jobs.test.ts` | Test drift | Imports generated widget manifest and mocks `/__internal/renders/widgets/catalog.json`. | Mock the Tokyo widget catalog service response directly. |
| `tokyo/product/widgets/{widget}/content.json` | Rename required | Current name implies widget-owned customer content. | Rename/migrate to `editable-fields.json`; it lists translatable saved-content paths only. |
| `tokyo/product/widgets/{widget}/agent.md` | Delete candidate | Guidance file with no named schema authority. | Kill unless a real current consumer is proven; if guidance survives, it must not duplicate schema truth. |
| `tokyo/product/widgets/{widget}/catalog.json` | Keep-only-if-useful | Product listing metadata and capability flags risk becoming catchall soup. | Keep only small catalog metadata that a named service uses; move capability/policy truth elsewhere. |
| `tokyo/product/widgets/{widget}/limits.json` | Keep with narrow contract | Limit declarations are detached unless mapped to real policy keys. | Express limited paths/ops/caps in relation to `ck-policy` keys such as `items.group.small.max`, `items.group.medium.max`, `items.group.large.max`. |
| `tokyo/product/widgets/{widget}/seo-geo.ts` and generated SEO registry | Audit before keep | Current model may be stale under the static embed model. | Keep only if current publish/SEO generation uses it through a named operation; otherwise delete or rebuild the contract. |
| `scripts/i18n/build.mjs` | Keep as deploy artifact builder | Produces hashed Roma/Bob i18n bundles. | Keep as build artifact generation; document that output is deploy artifact, not product truth. |
| `scripts/l10n/build.mjs` and `scripts/l10n/validate.mjs` | Repair-only / guard | They refuse repo-owned account-instance l10n and are not materializers. | Keep only as boundary guards. |
| `scripts/build-dieter.js` | Keep as deploy artifact builder | Writes `tokyo/product/dieter/**`, including a Dieter manifest consumed by Bob compiler. | Keep, but document Dieter manifest as deploy/build artifact, not widget/product source authority. |
| `scripts/process-svgs.js` inside Dieter build | Repair-only candidate | Mutates `dieter/icons/svg` source in place. | Keep only as deliberate icon normalization/repair, not an always-on hidden source mutation. |
| `scripts/tokyo-r2-deploy-sync.mjs` | Cloudify | Pushes repo deploy roots into Tokyo/R2. | Keep as CI/cloud deploy behavior only; never treat local synced R2 keys as source truth. |
| `scripts/tokyo-fonts-sync.mjs` | Cloudify / narrow keep | Separate font publisher covered by broader Tokyo sync. | Keep only if a real deploy need exists; otherwise fold into cloud deploy or delete. |
| `scripts/prague-l10n/translate.mjs` | Keep, cloudify long-term | Generates real Prague page translations consumed by Prague build, but calls San Francisco from script land. | Keep current page-translation contract, but move orchestration toward CI/cloud service ownership. |
| `scripts/prague-l10n/verify.mjs` | Keep | Validates Prague sidecars against base page fingerprints. | Keep as non-mutating guard. |
| `scripts/prague-sync.mjs` | Delete candidate / repair-only if retained | Publishes from absent/stale `tokyo/prague/l10n` while current docs say Prague translations live beside pages and root `l10n/**` must not publish. | Delete or quarantine as repair-only after verifying no current workflow depends on it. |
| `scripts/build-bob-cf.mjs` and `scripts/build-roma-cf.mjs` | Dev/build-only | Cloudflare build shims, not product truth. | Keep only as build plumbing. |
| `admin/scripts/*` and showcase generators | Dev-only | Generate DevStudio docs/showcase artifacts. | Keep out of product source model; delete stale targets such as old Dieter admin showcase if unused. |
| `scripts/infra/ensure-queues.mjs` | Cloudify | Creates infra as deploy side effect. | Keep in deploy automation; not part of product source truth. |

## Acceptance

- Each widget-folder file has a documented role: source truth, generated artifact, generated read model, local/dev helper, repair-only tool, or delete.
- Product paths no longer depend on a catchall widget manifest unless a narrow generated artifact is explicitly justified.
- Roma no longer has a product dependency on `tokyo/product/widgets/manifest.json`.
- Roma-facing catalog routes/docs no longer expose `catalog.json` as the product boundary.
- `content.json` -> `editable-fields.json` migration plan is approved.
- `agent.md`, `catalog.json`, `seo-geo.ts`, and `limits.json` each have a keep/kill decision.
- `scripts/build-widget-catalog.mjs` has a keep/cloudify/delete decision.
- Root build/typecheck/lint scripts no longer hide bootstrap-era product materialization.
- No PRD 103 translation code resumes until this PRD is complete.
