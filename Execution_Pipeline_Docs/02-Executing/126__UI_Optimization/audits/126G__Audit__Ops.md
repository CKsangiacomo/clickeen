# 126G - Pre-Execution Audit: Ops

Status: CODEX PRE-EXECUTION AUDIT - current execution map.
PRD: `../126G__PRD__Ops.md`.

This audit hardens 126G for execution. It records the exact ops blast radius,
current source evidence, documentation work, verification gates, and V1-V8
controls needed for the 126G cleanup. It does not authorize product-data repair
or new ops machinery.

## Authority Gate

| Authority | 126G current authority |
| --- | --- |
| Product surface | UI ops for Dieter/system UI build, generation, DevStudio token edit lane, generated artifacts, and Cloudflare/R2 deployment path. |
| Source coordinate | `dieter/**`, root build scripts, `admin/scripts/**`, DevStudio Pages Functions token write code, and GitHub workflow files. |
| Generated repo coordinate | `tokyo/product/dieter/**`, generated Admin/DevStudio HTML/data. |
| Storage/deploy coordinate | Cloudflare Pages, Workers, and R2 deployed product roots. R2 is deploy/runtime output, not source truth. |
| Product data coordinate | Outside 126G. Account/runtime data under `accounts/{accountPublicId}/...` is owned by product routes/workers. |
| Route/API boundary | DevStudio token editing uses Berlin-authenticated Pages Functions and GitHub Contents API. 126G documents the lane; 126L owns DevStudio product workflow changes. |
| Verification surface | Source/script/docs grep, focused build/generation checks in execution, and post-merge Cloudflare/GitHub Actions evidence for changed deploy surfaces. |

Compliance reason: 126G must make the current source/generated/deployed/product-data
separation legible without adding a governance platform or treating R2 bytes as
source truth.

## Current Source Evidence

Commands used to verify the execution map:

- `rg` across `scripts/build-dieter.js`, `scripts/verify-svgs.js`, and
  `scripts/tokyo-r2-deploy-sync.mjs` for provenance, dependency handling,
  obsolete local/deploy branches, R2 root checks, and source mutation.
- `rg` across `.github/workflows/cloud-dev-workers.yml`,
  `.github/workflows/devstudio-verify.yml`, and Cloudflare docs for build,
  verify, and deploy ownership.
- `rg` across `documentation/engineering/UI/**`, `documentation/services/**`,
  `documentation/engineering/CloudflareOperations.md`, and localization docs
  for stale build paths, wrong 126 ownership, current product roots, l10n, and
  product-data boundaries.
- `find tokyo/prague -path '*/.locales*' -print` to verify Prague locale
  metadata is a real Prague artifact and not something 126G should delete.

Verified source findings:

- `package.json` defines `build:dieter` as `pnpm --filter @ck/dieter build`;
  `dieter/package.json` runs root `scripts/build-dieter.js`.
- `scripts/build-dieter.js` is the active Dieter build entrypoint. It verifies
  committed SVG/icon source through `scripts/verify-svgs.js`, copies source into
  `tokyo/product/dieter/**`, bundles per-component JS, and emits
  `tokyo/product/dieter/manifest.json`.
- `scripts/verify-svgs.js` reads and verifies icon source. It does not mutate
  committed SVG source.
- Pre-execution `scripts/build-dieter.js` allowed untraceable manifest
  provenance and warning-only manifest dependency failures. 126G execution must
  make both fail-visible.
- Pre-execution Dieter build comments still described an obsolete aggregate JS
  output shape. 126G execution must remove that wording.
- `scripts/tokyo-r2-deploy-sync.mjs` maps current git-authored source roots to
  `product/widgets`, `dieter`, `product/roma`, and `prague` R2 roots.
- Prague page locale metadata exists under `tokyo/prague/**`; 126G must preserve
  it as Prague-owned content and remove only obsolete refusal concepts around
  it.
- Tokyo/R2 deploy sync is upload-only. It uploads local entries; it does not
  reconcile deletions, remove orphans, or provide rollback.
- `.github/workflows/cloud-dev-workers.yml` runs on push. Dieter source or
  build-script changes run `pnpm build:dieter` and then Tokyo/R2 deploy sync.
  Generated Tokyo product-root-only changes run upload-only R2 sync and do not
  by themselves run `build:dieter`.
- `.github/workflows/devstudio-verify.yml` is PR/manual verification, not the
  direct DevStudio token commit lane.
- UI ops docs must state the current build/serve/steer loop and must not make
  DevStudio token edits into 126G approval workflow, semantic validation, or PR
  bureaucracy.
- Real localization tooling exists and must be preserved:
  `documentation/architecture/BabelProtocol.md`,
  `documentation/architecture/OverlayArchitecture.md`,
  `documentation/ai/sanfrancisco.md`,
  `documentation/capabilities/localization.md`,
  `documentation/strategy/Clickeen-Babel.md`, `packages/l10n/**`,
  `packages/l10n/locales.json`, `scripts/i18n/**`, `scripts/l10n/**`, and
  `scripts/prague-l10n/**`.

Correction to earlier as-built framing:

- CI rebuilding and uploading generated Dieter artifacts without committing
  regenerated output is not a 126G gap by itself. Source remains authority.
- 126G states current Cloudflare-centered ops only. It must not preserve a
  past-state story as live doctrine.

## Execution Blast Radius

| Area | Exact paths | Execution requirement | Must not do |
| --- | --- | --- | --- |
| Build command entrypoints | `package.json`; `dieter/package.json`; `admin/package.json` | Verify `pnpm build:dieter`, `@ck/dieter build`, and DevStudio/Admin generation/build commands are documented from current package scripts. | Do not document invented build commands or stale script paths. |
| Dieter build source | `scripts/build-dieter.js`; `scripts/verify-svgs.js` | Remove obsolete output comments, make manifest provenance fail-visible, include the verifier in local provenance lookup, and make manifest dependency failures fail-visible. | Do not create compatibility branches or guards for inactive local override concepts. |
| SVG verification | `scripts/verify-svgs.js`; `dieter/icons/svg/**`; `dieter/icons/icons.json` | Verify build reads/checks source SVGs and does not mutate committed source. | Do not silently rewrite committed icon source during build. |
| Generated Dieter output | `tokyo/product/dieter/**` | Treat as generated output from source/build; update only through `pnpm build:dieter` when execution changes Dieter source/build. | Do not hand-edit generated Dieter output as source truth. |
| DevStudio generation | `admin/scripts/generate-typography-json.cjs`; `admin/scripts/generate-foundation-pages.mjs`; `admin/scripts/generate-component-pages.ts`; `admin/scripts/generate-static-registries.mjs`; `admin/scripts/build-static.mjs`; `admin/src/data/typography.generated.json`; `admin/src/html/**` | Keep generator output and governance scope honest. | Do not claim Admin-generated checks prove Bob/Roma/widget runtime correctness. |
| DevStudio token edit lane | `admin/functions/_shared/dieter-tokens.js`; `admin/functions/_shared/berlin.js`; `admin/functions/_middleware.js`; `admin/functions/api/dieter/tokens/colors.js`; `admin/functions/api/dieter/tokens/colors/value.js`; `admin/functions/api/dieter/tokens/typography.js`; `admin/functions/api/dieter/tokens/typography/value.js`; `admin/src/main.ts` | Document token edit mutation boundary, client binding, auth/session boundary, and evidence needs; leave product workflow changes to 126L. | Do not add approval workflow, semantic validator, contrast enforcement, or PR bureaucracy in 126G. |
| Governance checks | `scripts/dieter/governance-guards.mjs`; `.github/workflows/devstudio-verify.yml` | Document exact scope: generated Admin/DevStudio artifacts and PR/manual verification. | Do not expand to universal UI scanner or runtime consumer proof in 126G. |
| Cloud-dev deploy path | `.github/workflows/cloud-dev-workers.yml`; `.github/workflows/cloud-dev-runtime-verify.yml`; `.github/workflows/cloud-dev-roma-app.yml`; `.github/workflows/cloud-dev-prague-app.yml`; `.github/workflows/cloud-dev-prague-content.yml`; `documentation/engineering/CloudflareOperations.md`; `documentation/engineering/CloudflarePagesCloudDevChecklist.md` | Document current deploy path, Pages/Workers/R2 evidence, and the exact split between Dieter source/build-script rebuild plus sync and generated product-root-only upload sync. | Do not create new deploy gates or runtime validation rituals in 126G. |
| Tokyo/R2 deploy sync | `scripts/tokyo-r2-deploy-sync.mjs`; `documentation/services/tokyo.md`; `documentation/services/tokyo-worker.md`; `documentation/engineering/CloudflareOperations.md` | Remove obsolete local/deploy concepts while preserving current root allowlist, account-runtime refusal, and upload-only truth. | Do not add reconciliation, orphan cleanup, rollback, or guards around dead concepts in 126G. |
| Localization boundary | `documentation/architecture/BabelProtocol.md`; `documentation/architecture/OverlayArchitecture.md`; `documentation/strategy/Clickeen-Babel.md`; `documentation/capabilities/localization.md`; `documentation/services/prague/prague-overview.md`; `documentation/ai/sanfrancisco.md`; `packages/l10n/**`; `packages/l10n/locales.json`; `scripts/i18n/**`; `scripts/l10n/**`; `scripts/prague-l10n/**`; `tokyo/prague/**` | Preserve real localization tooling, locale metadata, and docs; remove only stale deploy assumptions from UI ops/deploy docs. | Do not delete real l10n tooling, locale overlays, Prague l10n, San Francisco l10n, or future localization direction. |
| Product data boundary | `documentation/services/tokyo.md`; `documentation/services/tokyo-worker.md`; `documentation/services/roma.md`; `documentation/services/bob.md`; account runtime paths in docs | State that account/runtime product data is outside UI ops source/build/deploy roots. | Do not mutate product data or treat `accounts/**` as a UI deploy root. |
| Living docs | `documentation/engineering/UI/README.md`; `documentation/engineering/UI/ops.md`; `documentation/engineering/UI/dieter.md`; `documentation/engineering/UI/iconography.md`; `documentation/engineering/UI/components.md`; `documentation/engineering/UI/surfaces.md`; `documentation/services/dieter.md`; `documentation/services/devstudio.md`; `documentation/services/tokyo.md`; `documentation/services/tokyo-worker.md` | Fix stale build path, stale icon pipeline, wrong 126 ownership, current Cloudflare-centered ops, icon-authoring exception, and generated/deployed/product-data separation. | Do not document removed local deploy behavior as current doctrine. |

## Required Documentation Updates

Execution must update UI ops docs so they say:

- Active Dieter build path is root `scripts/build-dieter.js`.
- Obsolete build paths and old generated icon-registry claims are not current UI
  ops law.
- DevStudio/Roma are 126L/126M, components are 126I, ops is 126G.
- Source is `dieter/**` and repo scripts; generated repo output is
  `tokyo/product/dieter/**`; deployed runtime output is Cloudflare/R2; product
  data is product routes/workers.
- Tokyo/R2 deploy sync is upload-only. It does not prove reconciliation,
  orphan cleanup, or rollback.
- Real localization tooling remains outside 126G deletion scope.

Compliance reason: future agents read the UI docs before changing product-path
code. Stale build paths and wrong PRD ownership recreate the drift 126G is
supposed to remove.

## V1-V8 Pre-Execution Audit

| ID | Risk | 126G control |
| --- | --- | --- |
| V1 Silent substitution | Manifest provenance becomes untraceable or omits build-affecting source/scripts and masquerades as traceable source. | Remove/fail-visible untraceable provenance; include build-affecting source/scripts or use a full commit SHA. |
| V2 Silent healing | Build verification rewrites committed SVG source. | Build must not mutate icon source; icon source changes belong to human-owned 126C icon authoring. |
| V3 Silent omission | Deploy assumptions are removed without checking real localization/product authority. | Check Babel/localization and product-data docs before removing deploy assumptions; preserve real l10n tooling. |
| V4 Fail-open control | Manifest dependency validation warns and ships unresolved declared dependencies. | Unresolved declared dependencies fail the operation. |
| V5 Corruption-as-absence | Account/runtime product data is treated as a deploy root and overwritten or ignored. | Keep account data outside UI ops deploy roots. |
| V6 Partial-success masquerade | R2 upload-only sync is described as reconciliation, orphan cleanup, rollback, or remote-state proof. | Document upload-only truth and require owning Cloudflare evidence for deploy claims. |
| V7 Masquerade/redress | Obsolete deploy paths/refusal guards are renamed as current Cloudflare law. | Delete dead concepts instead of preserving them behind guards. |
| V8 Runtime test dependency | UI ops truth depends on governance scans as runtime proof. | Source/build/deploy authorities carry truth; checks verify scoped outputs only. |

## Verification Gates For Execution

Execution is not complete until these checks are run and reconciled:

- Search docs for stale build paths, old icon-registry pipeline claims, and
  wrong 126 ownership claims.
- Search `scripts/build-dieter.js` for untraceable provenance, obsolete output
  comments, and warning-only dependency behavior.
- Search `package.json`, `dieter/package.json`, and `admin/package.json` for
  build/generate entrypoints before updating build docs.
- Verify manifest provenance covers build-affecting source/scripts or uses a
  full commit SHA.
- Search `scripts/verify-svgs.js` for source mutation; route icon-specific
  policy to 126C.
- Search `scripts/tokyo-r2-deploy-sync.mjs` and Tokyo/Cloudflare docs for stale
  deploy concepts and upload-only wording.
- Verify Tokyo/R2 sync keeps current root allowlist and account-runtime refusal
  without dead-concept guards.
- Verify real l10n/localization files listed in the blast radius remain intact.
- Verify account/runtime product data docs remain outside UI ops deploy roots.
- Run `pnpm build:dieter` if Dieter build/source/generator code changes.
- Run focused DevStudio/Admin checks if `admin/scripts/**`, `admin/functions/**`,
  `admin/src/**`, or generated Admin docs change.
- After merged deploy-path changes, verify the owning deploy surface:
  Cloudflare Pages build state for Pages apps, GitHub Actions `cloud-dev workers
  deploy` for Workers/R2 sync, and repo Cloudflare R2 evidence when R2 objects
  are part of the claim.

## Three-Lane Review Inputs

The three review agents must verify:

- Staff Engineer: build/deploy/script/doc blast radius is complete, obsolete
  deploy concepts are removed rather than guarded, generated output ownership is
  clear, and 126C/126L/126I/126M handoffs are correct.
- Senior PM: 126G makes ops simpler and more legible for a one-human plus agent
  operating model; it does not create enterprise governance or confusing UX for
  DevStudio operators.
- Principal TPM: architecture is cohesive/cost-effective, V1-V8 controls are
  explicit, deploy verification uses the owning Cloudflare/GitHub surfaces, and
  no new subsystem is invented.

## Green Criteria

126G is green for execution only when:

- PRD and audit are current-state-only and do not preserve a past-state story as
  live doctrine.
- Build path, generated output, DevStudio generation, token edit lane,
  governance checks, Cloudflare deploy, R2 sync, l10n, product data, and docs are
  all in blast radius.
- Real localization tooling and Prague locale metadata are preserved while
  stale deploy assumptions are removable.
- Manifest provenance, manifest dependencies, SVG source mutation, R2
  upload-only truth, and generated/deployed/product-data separation have V1-V8
  controls.
- Documentation updates in `documentation/engineering/UI/**`,
  `documentation/services/**`, and `documentation/engineering/**` are named.
- All three review lanes return green with no blocking gaps.
