# 126G - Pre-Execution Audit: Ops

Status: CODEX PRE-EXECUTION AUDIT - three-lane review green.
PRD: `../126G__PRD__Ops.md`.

This audit hardens 126G for execution. It does not change runtime code, product
data, Cloudflare state, or generated artifacts. It records the exact ops blast
radius, current source evidence, documentation work, verification gates, and
V1-V8 controls needed before executing the 126G cleanup.

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

## Source Evidence Snapshot

Commands run during pre-execution audit:

- `rg -n "svg_new|unknown|dependency|dependencies|console\\.warn|writeFileSync|copyFileSync|normaliz|manifest|components\\.js|gitSha" scripts/build-dieter.js scripts/process-svgs.js scripts/verify-svgs.js`
- `rg -n "REFUSED_REMOTE_PREFIXES|l10n|public|published|widgets|accounts|REMOTE_ROOTS|LOCAL_ROOTS|product/widgets|tokyo/product|--remote|dry" scripts/tokyo-r2-deploy-sync.mjs`
- `rg -n "build:dieter|tokyo-r2-deploy-sync|devstudio-verify|dieter|tokyo/product|push|pull_request" .github/workflows/cloud-dev-workers.yml .github/workflows/devstudio-verify.yml`
- `rg -n "dieter/scripts/build-dieter|build-icons|dist/icons|126C|126G|126L|126M|126I|tokyo-r2-deploy-sync|l10n|public/|published|root widgets" documentation/engineering/UI documentation/services documentation/engineering/CloudflareOperations.md documentation/strategy/Clickeen-Babel.md documentation/capabilities/localization.md documentation/ai/sanfrancisco.md scripts/l10n scripts/prague-l10n scripts/i18n`

Current source findings:

- `scripts/build-dieter.js:10,301` still comments that it aggregates
  `components.js`, while current build output is per-component JS.
- `package.json:40` defines `build:dieter` as
  `pnpm --filter @ck/dieter build`; `dieter/package.json:13` runs root
  `scripts/build-dieter.js`; `admin/package.json:8-12` defines DevStudio/Admin
  generate, build, lint, and typecheck entrypoints.
- `scripts/build-dieter.js:39` returns `unknown` when manifest SHA lookup fails.
- `scripts/build-dieter.js:30` scopes local SHA lookup to `dieter` and
  `scripts/build-dieter.js`, omitting other build-affecting scripts such as
  `scripts/process-svgs.js` and `scripts/verify-svgs.js`.
- `scripts/build-dieter.js:89,93` warn on unresolved manifest dependency
  references instead of failing.
- `scripts/build-dieter.js:245,248,251,313` carries the optional `svg_new`
  override path.
- `scripts/process-svgs.js:30` writes normalized SVG content back to source
  files under `dieter/icons/svg/**`.
- `scripts/process-svgs.js:39-45` and `scripts/verify-svgs.js:36-40,58-59`
  use warning-only behavior for SVG count/stroke findings.
- `scripts/tokyo-r2-deploy-sync.mjs:20` still uses stale local sync wording.
- `scripts/tokyo-r2-deploy-sync.mjs:29-31` maps current product roots to R2:
  `product/widgets`, `dieter`, and `fonts`.
- `scripts/tokyo-r2-deploy-sync.mjs:100-103` refuses `accounts/**` and stale
  root deploy prefixes `l10n/**`, `public/**`, `published/**`, and root
  `widgets/**`.
- `scripts/tokyo-r2-deploy-sync.mjs:19-21` carries a `--local` refusal,
  `scripts/tokyo-r2-deploy-sync.mjs:95-105` carries the canonical-root and stale
  root-prefix checks, and `scripts/tokyo-r2-deploy-sync.mjs:117-119` refuses
  stale Prague `.locales` deploy metadata.
- `scripts/tokyo-r2-deploy-sync.mjs:357,363` confirms upload-only behavior:
  it uploads local entries and does not reconcile or delete remote orphans.
- `.github/workflows/cloud-dev-workers.yml:4,124,194,199` runs on push, detects
  Dieter changes, runs `pnpm build:dieter`, and runs the Tokyo/R2 deploy sync.
- `.github/workflows/devstudio-verify.yml:4,34` is PR/manual verification, not
  the direct DevStudio token commit lane.
- `documentation/engineering/UI/ops.md:11,17,42,52` has stale build path, stale
  icon pipeline, and wrong 126C ownership claims.
- `documentation/engineering/UI/dieter.md:70` and
  `documentation/engineering/UI/iconography.md:7,19-22,32` repeat stale build
  path/icon pipeline claims.
- `documentation/services/dieter.md:32` describes `dieter/icons/svg_new/` as an
  optional icon override input; execution must remove that doc claim unless 126C
  explicitly keeps it as current human-owned icon authoring law.
- `documentation/engineering/UI/README.md:35`,
  `documentation/engineering/UI/surfaces.md:7,37`, and
  `documentation/engineering/UI/components.md:56` contain stale 126 ownership
  references that must be reconciled with 126G/126I/126L/126M.
- `documentation/engineering/CloudflareOperations.md:188` and
  `documentation/services/tokyo.md:167-169,205` mention root
  `widgets/**`, `l10n/**`, `public/**`, or `published/**` assumptions that must
  be checked against current product law.
- Real localization tooling exists and must be preserved:
  `documentation/architecture/BabelProtocol.md`,
  `documentation/architecture/OverlayArchitecture.md`,
  `documentation/ai/sanfrancisco.md`,
  `documentation/capabilities/localization.md`,
  `documentation/strategy/Clickeen-Babel.md`, `packages/l10n/**`,
  `packages/l10n/locales.json`, `scripts/i18n/build.mjs`,
  `scripts/i18n/extract-keys.mjs`,
  `scripts/i18n/validate.mjs`, `scripts/l10n/build.mjs`,
  `scripts/l10n/validate.mjs`, and `scripts/prague-l10n/*.mjs`.

Correction to earlier as-built framing:

- "CI can rebuild and upload Dieter artifacts without committing generated
  output changes back to git" is not a 126G gap by itself. Source remains
  authority; CI-generated deploy output is acceptable when produced from source.
- The PRD must not preserve a past-state story. 126G states current
  Cloudflare-centered ops only.

## Execution Blast Radius

| Area | Exact paths | Execution requirement | Must not do |
| --- | --- | --- | --- |
| Build command entrypoints | `package.json`; `dieter/package.json`; `admin/package.json` | Verify `pnpm build:dieter`, `@ck/dieter build`, and DevStudio/Admin generation/build commands are documented from current package scripts. | Do not document invented build commands or stale script paths. |
| Dieter build source | `scripts/build-dieter.js`; `scripts/process-svgs.js`; `scripts/verify-svgs.js` | Remove stale `components.js` comments if output is per-component JS; remove or route `svg_new` override logic through 126C icon authoring; make manifest provenance cover all build-affecting source/scripts or full commit SHA; make dependency failures fail-visible. | Do not create compatibility branches or guards for inactive override concepts. |
| SVG processing | `scripts/process-svgs.js`; `scripts/verify-svgs.js`; `dieter/icons/svg/**`; `dieter/icons/icons.json` | Stop build-time source mutation unless 126C explicitly owns that action in human icon authoring; route icon count/stroke warning policy through 126C. | Do not silently rewrite committed icon source during build. |
| Generated Dieter output | `tokyo/product/dieter/**` | Treat as generated output from source/build; update only through `pnpm build:dieter` when execution changes Dieter source/build. | Do not hand-edit generated Dieter output as source truth. |
| DevStudio generation | `admin/scripts/generate-typography-json.cjs`; `admin/scripts/generate-foundation-pages.mjs`; `admin/scripts/generate-component-pages.ts`; `admin/scripts/generate-static-registries.mjs`; `admin/scripts/build-static.mjs`; `admin/src/data/typography.generated.json`; `admin/src/html/**` | Keep generator output and governance scope honest. | Do not claim Admin-generated checks prove Bob/Roma/widget runtime correctness. |
| DevStudio token edit lane | `admin/functions/_shared/dieter-tokens.js`; `admin/functions/_shared/berlin.js`; `admin/functions/_middleware.js`; `admin/functions/api/dieter/tokens/colors.js`; `admin/functions/api/dieter/tokens/colors/value.js`; `admin/functions/api/dieter/tokens/typography.js`; `admin/functions/api/dieter/tokens/typography/value.js`; `admin/src/main.ts` | Document token edit mutation boundary, client binding, auth/session boundary, and evidence needs; leave product workflow changes to 126L. | Do not add approval workflow, semantic validator, contrast enforcement, or PR bureaucracy in 126G. |
| Governance checks | `scripts/dieter/governance-guards.mjs`; `.github/workflows/devstudio-verify.yml` | Document exact scope: generated Admin/DevStudio artifacts and PR/manual verification. | Do not expand to universal UI scanner or runtime consumer proof in 126G. |
| Cloud-dev deploy path | `.github/workflows/cloud-dev-workers.yml`; `.github/workflows/cloud-dev-runtime-verify.yml`; `.github/workflows/cloud-dev-roma-app.yml`; `.github/workflows/cloud-dev-prague-app.yml`; `.github/workflows/cloud-dev-prague-content.yml`; `documentation/engineering/CloudflareOperations.md` | Document current deploy path, Pages/Workers/R2 evidence, and where `pnpm build:dieter` plus Tokyo/R2 sync run. | Do not create new deploy gates or runtime validation rituals in 126G. |
| Tokyo/R2 deploy sync | `scripts/tokyo-r2-deploy-sync.mjs`; `documentation/services/tokyo.md`; `documentation/services/tokyo-worker.md`; `documentation/engineering/CloudflareOperations.md` | Rewrite stale local deploy wording; specifically inspect `--local`, stale root-prefix guards, stale Prague `.locales`, and canonical-root allowlist behavior. Remove dead concept guards while preserving current generic product protection; document upload-only truth. | Do not add reconciliation, orphan cleanup, rollback, or guards around dead roots in 126G. |
| Localization boundary | `documentation/architecture/BabelProtocol.md`; `documentation/architecture/OverlayArchitecture.md`; `documentation/strategy/Clickeen-Babel.md`; `documentation/capabilities/localization.md`; `documentation/services/prague/prague-overview.md`; `documentation/ai/sanfrancisco.md`; `packages/l10n/**`; `packages/l10n/locales.json`; `scripts/i18n/build.mjs`; `scripts/i18n/extract-keys.mjs`; `scripts/i18n/validate.mjs`; `scripts/l10n/build.mjs`; `scripts/l10n/validate.mjs`; `scripts/prague-l10n/lib.mjs`; `scripts/prague-l10n/translate.mjs`; `scripts/prague-l10n/verify.mjs` | Preserve real localization tooling and docs; remove only stale root R2 `l10n/**` deploy assumptions if present in UI ops/deploy docs. | Do not delete real l10n tooling, locale overlays, Prague l10n, San Francisco l10n, or future localization direction. |
| Product data boundary | `documentation/services/tokyo.md`; `documentation/services/tokyo-worker.md`; `documentation/services/roma.md`; `documentation/services/bob.md`; `accounts/{accountPublicId}/...` references in docs | State that account/runtime product data is outside UI ops source/build/deploy roots. | Do not mutate product data or treat `accounts/**` as a UI deploy root. |
| Living docs | `documentation/engineering/UI/README.md`; `documentation/engineering/UI/ops.md`; `documentation/engineering/UI/dieter.md`; `documentation/engineering/UI/iconography.md`; `documentation/engineering/UI/components.md`; `documentation/engineering/UI/surfaces.md`; `documentation/services/dieter.md`; `documentation/services/devstudio.md`; `documentation/services/tokyo.md`; `documentation/services/tokyo-worker.md` | Fix stale build path, stale icon pipeline, wrong 126 ownership, current Cloudflare-centered ops, icon-authoring exception, generated/deployed/product-data separation. | Do not document removed local deploy behavior as current doctrine. |

## Required Documentation Updates

Execution must update UI ops docs so they say:

- Active Dieter build path is root `scripts/build-dieter.js`.
- `dieter/scripts/build-dieter.js`, `build-icons.mjs -> dist/icons/`, and
  old generated icon registry claims are not current UI ops law.
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
| V1 Silent substitution | Manifest provenance becomes `unknown` or omits build-affecting source/scripts and masquerades as traceable source. | Remove/fail-visible the `unknown` fallback; make provenance cover all build-affecting source/scripts or use full commit SHA. |
| V2 Silent healing | Build normalizes and rewrites committed SVG source. | Build must not mutate icon source; icon source changes belong to human-owned 126C icon authoring. |
| V3 Silent omission | Stale root assumptions are removed without checking real localization/product authority. | Check Babel/localization and product-data docs before deleting root assumptions; preserve real l10n tooling. |
| V4 Fail-open control | Manifest dependency validation warns and ships unresolved declared dependencies. | Unresolved declared dependencies fail the operation. |
| V5 Corruption-as-absence | Account/runtime product data is treated as a deploy root and overwritten or ignored. | Keep account data outside UI ops deploy roots. |
| V6 Partial-success masquerade | R2 upload-only sync is described as reconciliation, orphan cleanup, rollback, or remote-state proof. | Document upload-only truth and require owning Cloudflare evidence for deploy claims. |
| V7 Masquerade/redress | Stale roots/refusal guards are renamed as current Cloudflare law. | Delete dead concepts instead of preserving them behind guards. |
| V8 Runtime test dependency | UI ops truth depends on governance scans as runtime proof. | Source/build/deploy authorities carry truth; checks verify scoped outputs only. |

## Verification Gates For Execution

Execution is not complete until these checks are run and reconciled:

- Search docs for `dieter/scripts/build-dieter.js`, `build-icons.mjs`,
  `dist/icons`, and wrong 126 ownership claims.
- Search `scripts/build-dieter.js` for `svg_new`, `unknown`, stale
  `components.js` comments, and warning-only dependency behavior.
- Search `package.json`, `dieter/package.json`, and `admin/package.json` for
  build/generate entrypoints before updating build docs.
- Verify manifest provenance covers all build-affecting source/scripts or uses
  the full commit SHA.
- Search `scripts/process-svgs.js` and `scripts/verify-svgs.js` for source
  mutation and warning-only SVG policy; route icon-specific policy to 126C.
- Search `scripts/tokyo-r2-deploy-sync.mjs` and Tokyo/Cloudflare docs for stale
  local/root deploy concepts and upload-only wording.
- Search `scripts/tokyo-r2-deploy-sync.mjs` specifically for `--local`, stale
  root-prefix guards, `.locales`, and canonical-root allowlist behavior; remove
  dead concept guards while preserving current generic product protection.
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

- Staff Engineer: build/deploy/script/doc blast radius is complete, stale local
  root concepts are removed rather than guarded, generated output ownership is
  clear, and 126C/126L/126I/126M handoffs are correct.
- Senior PM: 126G makes ops simpler and more legible for a one-human plus agent
  operating model; it does not create enterprise governance or confusing UX for
  DevStudio operators.
- Principal TPM: architecture is cohesive/cost-effective, V1-V8 controls are
  explicit, deploy verification uses the owning Cloudflare/GitHub surfaces, and
  no new subsystem is invented.

## Green Criteria

126G is green for execution only when:

- PRD and audit are current-state-only and do not preserve a past-state
  story as live doctrine.
- Build path, generated output, DevStudio generation, token edit lane,
  governance checks, Cloudflare deploy, R2 sync, l10n, product data, and docs are
  all in blast radius.
- Real localization tooling is preserved while stale root deploy assumptions
  are removable.
- Manifest provenance, manifest dependencies, SVG source mutation, R2 upload-only
  truth, and generated/deployed/product-data separation have V1-V8 controls.
- Documentation updates in `documentation/engineering/UI/**`,
  `documentation/services/**`, `documentation/engineering/CloudflareOperations.md`,
  and localization docs are named.
- All three review lanes return green with no blocking gaps.
