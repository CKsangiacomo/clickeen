# 126G - PRD: Ops

Status: PRE-EXECUTION READY - three-lane review green.
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA).
Series order: 126G of 126A-126M.
KB doc: `documentation/engineering/UI/ops.md`.

This PRD is the execution authority for 126G UI ops. It is filled from Codex
and GLM Step 1 as-built evidence, Step 3 official-source research, and human
product direction. It decides the UI ops standard, names the current gaps, and
defines the blast radius for execution.

126G execution must make source and docs match this PRD. It must not create a
governance platform, approval workflow, universal UI scanner, R2 reconciliation
engine, rollback engine, semantic token validator, or guard around dead local
deploy concepts.

## Step Inputs

- Step 1 Codex as-built: `audits/126G__AsBuilt_Codex.md`.
- Step 1 GLM as-built: `audits/126G__AsBuilt_GLM.md`.
- Step 3 Codex research: `research/126G_Research_Codex.md`.
- Step 3 GLM research: `research/126G_Research_GLM.md`.
- Step 4 Codex pre-execution audit: `audits/126G__Audit__Ops.md`.
- Current living doc: `documentation/engineering/UI/ops.md`.
- Dieter build source: `scripts/build-dieter.js`.
- Tokyo/R2 product-root deploy sync: `scripts/tokyo-r2-deploy-sync.mjs`.
- DevStudio generation sources:
  `admin/scripts/generate-typography-json.cjs`,
  `admin/scripts/generate-foundation-pages.mjs`,
  `admin/scripts/generate-component-pages.ts`,
  `admin/scripts/generate-static-registries.mjs`, and
  `admin/scripts/build-static.mjs`.

## Role

126G owns UI ops: how Dieter/system UI source is built, generated, edited
through DevStudio, committed, deployed to Cloudflare/R2, and documented.

126G does not own what Dieter is; 126H owns the design-system contract. 126G
does not own component behavior; 126I owns components. 126G does not own
DevStudio UI product workflow; 126L owns DevStudio. 126G does not own Roma UI;
126M owns Roma. 126G does not own account product data.

126G is about simplification and clarity. Success means fewer active paths,
fewer obsolete deploy concepts, and docs that match current Cloudflare
reality. It is not a governance-platform PRD.

## Pre-GA Cleanup Tenet

Clickeen is pre-GA. Once the 126G ops standard is decided, execution cleans
source and docs to that standard.

- Fix source and docs to this PRD.
- Remove stale local deploy scripts, roots, guards, and doc claims from active
  code/docs.
- Do not support old and new ops behavior in parallel.
- Do not add guards/checks/deny lists to preserve concepts that should no
  longer exist.
- Do not document removed behavior as a living option.

Compliance reason: agents need one current Cloudflare-centered ops truth. A
guard around a dead concept still teaches agents the concept exists.

## Current UI Ops Boundary

Clickeen UI ops are Cloudflare-centered:

- source lives in git;
- build/generation runs through repo scripts and CI;
- deploy targets are Cloudflare Pages, Workers, and R2;
- account/runtime product data moves through product routes and workers;
- R2 is a runtime/deploy target, not source truth.

The only local-origin workflow in the UI system is icon authoring:
the human originates approved Dieter icons locally through the SF Symbols
tooling flow. After that, approved icons enter the Dieter source/build path and
are treated like source artifacts. Agents do not originate icons.

Any other stale local path, root, guard, script branch, or doc wording must be
removed unless it is proven current by product law. 126G execution must not
preserve dead concepts behind refusal guards or "just in case" logic.

Compliance reason:

- This states the current architecture only. Agents must not infer that stale
  local paths are still architecture because stale code remembers them.

## Current Reality Summary

The 126G as-built is not disputed between Codex and GLM. The current system has
these active parts:

- Dieter source truth is `dieter/**`.
- The active Dieter build command is `pnpm build:dieter`, which resolves to
  `pnpm --filter @ck/dieter build`, which runs root `scripts/build-dieter.js`.
- Build entrypoints are source truth too: root `package.json` defines
  `build:dieter`, `dieter/package.json` defines the package build command, and
  `admin/package.json` defines DevStudio/Admin generation/build commands.
- Generated Dieter repo output is `tokyo/product/dieter/**`.
- Remote Dieter runtime output is R2 `dieter/**`.
- DevStudio generated preview/governance pages are produced through
  `admin/scripts/generate-typography-json.cjs`,
  `admin/scripts/generate-foundation-pages.mjs`,
  `admin/scripts/generate-component-pages.ts`,
  `admin/scripts/generate-static-registries.mjs`, and
  `admin/scripts/build-static.mjs`.
- DevStudio token editing is a Berlin-authenticated Pages Functions lane that
  reads and writes selected Dieter token CSS files through GitHub Contents API.
- Cloud-dev CI runs `pnpm build:dieter` and then
  `scripts/tokyo-r2-deploy-sync.mjs --remote` when Dieter source/build-script
  changes. Generated Tokyo product-root changes run upload-only R2 sync; they
  do not by themselves run `build:dieter`.
- Product account runtime data is outside UI ops. Account data belongs to
  product routes/workers and `accounts/{accountPublicId}/...`.

Pre-execution gaps targeted by this slice:

- Active docs contain stale build-script path references.
- Manifest dependency validation is warning-only.
- Manifest provenance can become `unknown`.
- DevStudio token validation is regex/value-shape validation only.
- DevStudio token commit evidence is not visible enough for the operation lane.
- DevStudio direct token commits are not automatically covered by the PR-only
  `devstudio-verify` workflow.
- Governance guard coverage is generated Admin/DevStudio HTML, not every
  downstream runtime consumer.
- Tokyo/R2 deploy sync is an active Cloudflare deploy step, but it still carries
  stale local/deploy concepts.
- Tokyo/R2 deploy sync uploads current local entries; it does not reconcile
  remote deletions/orphans.

## Human-Converged Product Reading

The 126G problem is not "add governance." The current system already has a
working build/generate/commit/deploy path. The problem is that the path still
carries obsolete deploy concepts and docs do not explain the current
authority chain simply enough for agents.

For Clickeen this matters because:

- Agents operate the repo. If source, generated output, deployed R2 bytes, and
  product data are unclear, agents will edit the wrong layer.
- Stale roots and refusal guards keep dead concepts alive in code.
- Generated files are not source truth.
- R2 deployed objects are not source truth.
- DevStudio is a steering/editing surface, not a second design-system database.
- UI ops must be legible enough that future agents can operate it without
  inventing enterprise process.

126G therefore defines a simplification standard, not a new ops framework.

## Converged Clickeen UI Ops Standard

### Four Authority Lanes

Target law:

- Source authority: `dieter/**`, build scripts, generator scripts, and approved
  UI source files in git.
- Generated repo artifact authority: `tokyo/product/dieter/**` and generated
  DevStudio/Admin artifacts written by the generators.
- Deployed runtime authority: Cloudflare Pages, Workers, and R2 deployed
  objects such as `dieter/**`, `product/widgets/**`, `product/roma/**`, and
  `prague/**`.
- Product data authority: account/runtime product data under
  `accounts/{accountPublicId}/...` and product routes/workers. Product data is
  not UI ops source and is not mutated by Dieter build/generation.

Agents must classify any UI ops task into one of these lanes before editing or
operating. Generated and deployed artifacts do not become source truth because
they exist.

Compliance reason:

- This states the current architecture in one place and prevents agents from
  treating generated output, R2 bytes, or product data as the source layer.

### Cloudflare-Centered Current Ops

Target law:

- Current UI ops are Cloudflare-centered. Docs and code must describe the
  current Cloudflare path, not stale local deploy states.
- `scripts/tokyo-r2-deploy-sync.mjs` is active only as the current git-authored
  product-root deploy sync into Cloudflare R2.
- The script must not preserve stale deploy concepts as architecture.
- Localization/l10n remains a real product/domain concept and may grow. 126G
  must not delete real localization tooling, locale overlay docs, Prague l10n
  tooling, San Francisco l10n execution, or future l10n product direction.
- Root l10n storage is not current UI ops storage law. Only stale assumptions
  that treat l10n as a Tokyo/R2 product-root deploy destination should be
  removed.
- Public runtime concepts must be expressed through current product
  routes/storage, not through obsolete deploy paths.

Execution gap targets:

- Remove stale local deploy wording from UI ops docs.
- Remove stale deploy concepts from the deploy sync and docs unless a root is
  proven current by product law.
- Keep the current Cloudflare deploy path documented plainly if the script
  remains active.

Compliance reason:

- This deletes dead concepts instead of guarding them. A guard around a dead
  concept still teaches agents the concept exists.

### Icon Authoring Exception

Target law:

- Icon authoring is the only surviving local-origin UI workflow.
- The human originates approved Dieter icons locally through the SF Symbols
  tooling flow.
- Agents do not originate icons.
- Once approved icons are in Dieter source, they enter the normal
  source/build/generated/deployed artifact lanes.
- Any inactive override path or source-rewriting behavior must be reconciled
  against 126C iconography law. If it is not current icon-authoring law, remove
  it.

Compliance reason:

- This preserves the real human-owned icon origination workflow without letting
  stale local override logic survive as general UI ops architecture.

### Build And Generation

Target law:

- The active Dieter build path is root `scripts/build-dieter.js`.
- Docs must not name obsolete build-script locations as the active build path.
- A build produces generated output. A build must not silently rewrite source
  inputs.
- Generated files must be reproducible from source and scripts.
- Generated output must not be hand-edited as source truth.
- Build comments/docs must match the current output shape.

Execution gap targets:

- Fix stale build path docs in UI ops, Dieter, iconography, and related docs.
- Verify SVG build checks do not mutate `dieter/icons/svg/**`; source icon
  changes belong to the human-owned icon authoring flow.
- Remove inactive override behavior if it is not current icon-authoring law.
- Clean stale build comments that describe old output shapes.

Compliance reason:

- This makes build behavior predictable and source-safe without adding a new
  build framework.

### Manifest And Verification Honesty

Target law:

- `manifest.json` provenance must be traceable. Unknown provenance is not a
  valid current ops result.
- Manifest provenance must cover the build-affecting source/scripts or use the
  full commit SHA. A local scoped SHA that omits build-affecting scripts is not
  traceable enough for 126G.
- Manifest dependencies must resolve. Warning-and-ship is not a valid standard
  for broken declared dependencies.
- Warning-only behavior is allowed only where warning is explicitly product law.
- Existing governance checks should stay scoped to the generated artifacts they
  actually inspect. Do not claim they prove Bob/Roma/widget runtime consumer
  correctness.

Execution gap targets:

- Remove the `unknown` manifest provenance fallback or make failure explicit.
- Fix local manifest SHA lookup so provenance covers all build-affecting source
  and scripts, or use the full commit SHA.
- Make unresolved manifest dependency references fail.
- Decide warning-only SVG count/stroke behavior through 126C iconography law.
- Document governance guard scope honestly in the UI ops doc.

Compliance reason:

- This makes existing checks honest. It does not build a broader governance
  platform or universal runtime scanner.

### DevStudio Token Edit Lane

Target law:

- DevStudio is a controlled steering/edit surface for selected Dieter source
  tokens. It is not a second source authority.
- Token edits are source mutations through GitHub Contents API.
- Token edit evidence must make the mutation legible: token, value change,
  commit SHA, and available authenticated actor/session context.
- Do not create approval workflow, committee workflow, semantic color doctrine,
  contrast enforcement, or PR bureaucracy in 126G.
- Semantic design validation belongs to the owning domain PRD. Color meaning
  belongs to 126B. Typography meaning belongs to 126D. Motion meaning belongs
  to 126F.

Execution gap targets:

- Document the DevStudio token edit lane accurately.
- Record the direct-commit verification gap for 126L DevStudio execution.
- Record token edit evidence visibility as a 126L DevStudio execution target.
- Keep regex/value-shape validation described as current shape validation, not
  design judgment.

Compliance reason:

- This keeps DevStudio legible without inventing a governance/approval system.

### R2 Deploy Sync Contract

Target law:

- The Tokyo/R2 deploy sync is currently an upload path for git-authored product
  roots into Cloudflare R2.
- Its current contract is upload-only. It does not prove remote reconciliation,
  orphan cleanup, or rollback.
- 126G must document that honestly instead of pretending upload-only sync proves
  remote state.
- R2 reconciliation, orphan cleanup, and rollback are not 126G doctrine. They
  require a later build-engineering decision if the human wants them.

Execution gap targets:

- Rename/reword docs so the script reads as current Cloudflare product-root
  deploy sync, not stale local deploy sync.
- Remove obsolete local/deploy concepts from the script and docs.
- Keep account/runtime product data outside the deploy sync.

Compliance reason:

- This clarifies the active path without expanding it into a reconciliation
  engine.

## Detailed Execution Blast Radius

Execution must inspect and update this blast radius as needed. If a listed path
does not contain a current hit, execution records that it was checked and leaves
it alone.

| Area | Owner | Exact files / path shapes | Verify | Must not change |
| --- | --- | --- | --- | --- |
| Build command entrypoints | 126G / repo scripts | `package.json`; `dieter/package.json`; `admin/package.json` | Verify `pnpm build:dieter`, `@ck/dieter build`, and DevStudio/Admin generate/build commands are documented from current package scripts. | Do not document invented build commands or stale script paths. |
| Dieter build source | 126G / Dieter ops | `scripts/build-dieter.js`; `scripts/verify-svgs.js` | Remove stale output comments, remove `unknown` git SHA fallback, include build-affecting verifier source in local SHA lookup, and make manifest dependency failures fail-visible. | Do not create compatibility branches or guards for inactive local override concepts. |
| SVG processing and verification | 126C icon law + 126G build behavior | `scripts/verify-svgs.js`; `dieter/icons/icons.json`; `dieter/icons/svg/` | Verify build execution reads/verifies source SVGs and does not mutate committed source. | Do not let build-time verification silently rewrite committed icon source. |
| Generated Dieter artifacts | Generated from Dieter source | `tokyo/product/dieter/manifest.json`; `tokyo/product/dieter/tokens/tokens.css`; `tokyo/product/dieter/icons/icons.json`; `tokyo/product/dieter/icons/svg/` | Generated artifacts change only through `pnpm build:dieter`; manifest provenance and dependencies are fail-visible. | Do not hand-edit generated output as source truth. |
| DevStudio generation | 126G / DevStudio generation, 126L for DevStudio product workflow | `admin/scripts/generate-typography-json.cjs`; `admin/scripts/generate-foundation-pages.mjs`; `admin/scripts/generate-component-pages.ts`; `admin/scripts/generate-static-registries.mjs`; `admin/scripts/build-static.mjs`; `admin/src/data/typography.generated.json`; `admin/src/html/` | Generated DevStudio/Admin artifacts must reflect source generators; governance scope must be described honestly. | Do not claim generated Admin checks prove Bob/Roma/widget runtime correctness. |
| DevStudio token edit lane | 126L DevStudio execution target, 126G documents lane | `admin/functions/_shared/dieter-tokens.js`; `admin/functions/_shared/berlin.js`; `admin/functions/_middleware.js`; `admin/functions/api/dieter/tokens/colors.js`; `admin/functions/api/dieter/tokens/colors/value.js`; `admin/functions/api/dieter/tokens/typography.js`; `admin/functions/api/dieter/tokens/typography/value.js`; `admin/src/main.ts` | Token write response and visible operation evidence expose token, value change, commit SHA, and available authenticated actor/session context where 126L implements it; client binding and auth boundary are in scope for inspection. | Do not add approval workflow, contrast enforcement, semantic validator, or PR bureaucracy in 126G. |
| Governance guard scope | 126G / generated Admin guard | `scripts/dieter/governance-guards.mjs`; `.github/workflows/devstudio-verify.yml` | Guard docs state exact scope: generated Admin/DevStudio artifacts only. | Do not expand into a universal UI scanner in 126G. |
| Cloud-dev deploy path | DevOps / Cloudflare deploy | `.github/workflows/cloud-dev-workers.yml`; `.github/workflows/cloud-dev-runtime-verify.yml`; `.github/workflows/cloud-dev-roma-app.yml`; `.github/workflows/cloud-dev-prague-app.yml`; `.github/workflows/cloud-dev-prague-content.yml` | Document current deploy path, including that Dieter source/build-script changes run `pnpm build:dieter` plus Tokyo/R2 sync while generated product-root-only changes run upload-only sync. | Do not create new deploy gates or runtime validation rituals in 126G. |
| Tokyo/R2 deploy sync | 126G / Cloudflare product-root deploy sync | `scripts/tokyo-r2-deploy-sync.mjs`; `documentation/services/tokyo.md`; `documentation/services/tokyo-worker.md`; `documentation/engineering/CloudflareOperations.md` | Remove stale local/deploy concepts while preserving the current root allowlist and account-runtime refusal. Document upload-only behavior honestly. | Do not add R2 reconciliation, orphan cleanup, rollback, or refusal guards around dead concepts in 126G. |
| Localization/l10n authority boundary | Babel/Prague/San Francisco/localization owners, not 126G | `documentation/architecture/BabelProtocol.md`; `documentation/architecture/OverlayArchitecture.md`; `documentation/strategy/Clickeen-Babel.md`; `documentation/capabilities/localization.md`; `documentation/services/prague/prague-overview.md`; `documentation/ai/sanfrancisco.md`; `packages/l10n/**`; `packages/l10n/locales.json`; `scripts/i18n/build.mjs`; `scripts/i18n/extract-keys.mjs`; `scripts/i18n/validate.mjs`; `scripts/l10n/build.mjs`; `scripts/l10n/validate.mjs`; `scripts/prague-l10n/lib.mjs`; `scripts/prague-l10n/translate.mjs`; `scripts/prague-l10n/verify.mjs` | Verify real localization tooling remains intact; remove only stale deploy-root assumptions from UI ops/deploy docs. | Do not delete real localization tooling, locale overlays, Prague l10n, San Francisco l10n, or future localization product direction. |
| Product data boundary | Product routes/workers, not 126G | `documentation/services/tokyo.md`; `documentation/services/tokyo-worker.md`; `documentation/services/roma.md`; `documentation/services/bob.md`; account runtime paths `accounts/{accountPublicId}/...` in docs | Docs must state account/runtime product data is outside UI ops source/build/deploy roots. | Do not mutate product data or treat `accounts/**` as a UI deploy root. |
| UI ops living docs | 126G docs | `documentation/engineering/UI/README.md`; `documentation/engineering/UI/ops.md`; `documentation/engineering/UI/dieter.md`; `documentation/engineering/UI/iconography.md`; `documentation/engineering/UI/components.md`; `documentation/engineering/UI/surfaces.md`; `documentation/services/dieter.md`; `documentation/services/devstudio.md`; `documentation/services/tokyo.md`; `documentation/services/tokyo-worker.md` | Fix stale build path, old icon-registry pipeline claims, wrong 126C ownership for ops gaps, Cloudflare-centered authority, icon-authoring exception, and generated/deployed/product-data separation. | Do not document removed local deploy behavior as current doctrine. |

## Required Documentation Repairs

Execution must repair these known doc falsehoods:

- `documentation/engineering/UI/ops.md` must name root `scripts/build-dieter.js`
  as the active Dieter build path.
- `documentation/engineering/UI/ops.md` must not repeat old generated
  icon-registry pipeline claims; 126C owns icon consumption and human-owned icon
  origination.
- `documentation/engineering/UI/ops.md` currently says ops gaps are 126C's job;
  UI ops gaps are 126G.
- `documentation/engineering/UI/dieter.md`,
  `documentation/engineering/UI/iconography.md`, and
  `documentation/services/dieter.md` must not repeat stale build path or old
  generated-output shape claims.
- `documentation/services/tokyo.md` and `documentation/services/tokyo-worker.md`
  must separate current product roots, product data roots, and real
  localization paths from stale deploy assumptions.
- `documentation/engineering/UI/README.md` must map ops to 126G, components to
  126I, DevStudio to 126L, and Roma to 126M.

## V1-V8 Pre-Execution Controls

| ID | 126G risk | Required control |
| --- | --- | --- |
| V1 Silent substitution | `manifest.json` substitutes `unknown` for traceable provenance. | Remove or fail-visible the `unknown` provenance fallback. |
| V2 Silent healing | SVG verification rewrites committed source during build. | Build must not mutate source SVGs; icon source changes belong to human icon authoring / 126C. |
| V3 Silent omission | Stale deploy docs or generated artifacts are dropped without checking real localization/product authority. | Check localization and product-data authorities before removing deploy assumptions; preserve real l10n tooling. |
| V4 Fail-open control | Manifest dependency validation warns and ships unresolved dependencies. | Unresolved declared dependencies fail the build/operation. |
| V5 Corruption-as-absence | Product data or account roots are treated as deploy artifacts and overwritten/ignored. | Keep account/runtime data outside UI ops deploy roots. |
| V6 Partial-success masquerade | R2 upload-only sync is described as reconciliation, orphan cleanup, or rollback. | Document upload-only truth; do not claim remote-state proof. |
| V7 Masquerade/redress | Stale deploy paths or refusal guards are renamed as current Cloudflare law. | Delete dead concepts instead of preserving them behind guards. |
| V8 Runtime test dependency | Normal UI ops depends on governance scans or validation rituals as runtime truth. | Source/build/deploy authorities carry truth; checks only verify their scoped outputs. |

## Verification Checklist

Execution is not complete until these checks are run and reconciled:

- Search docs for stale build-script locations, old icon-registry pipeline
  claims, and wrong 126C ops ownership claims.
- Search `scripts/build-dieter.js` for `unknown`, and warning-only
  manifest dependency behavior; verify provenance covers all build-affecting
  source/scripts or uses the full commit SHA.
- Search `package.json`, `dieter/package.json`, and `admin/package.json` for
  build/generate entrypoints before updating build docs.
- Search `scripts/verify-svgs.js` for source mutation; route icon-specific
  decisions through 126C.
- Search `scripts/tokyo-r2-deploy-sync.mjs` and Tokyo docs for stale deploy
  concepts and dead-concept refusal guards.
- Verify `scripts/tokyo-r2-deploy-sync.mjs` keeps the current root allowlist and
  account-runtime refusal while removing dead-concept guards.
- Verify localization tooling/docs listed in the blast radius are preserved,
  including Babel/overlay architecture docs, `packages/l10n/**`, and
  `packages/l10n/locales.json`.
- Verify product data paths under `accounts/{accountPublicId}/...` remain
  outside UI ops deploy roots.
- Verify DevStudio/governance docs state current scope honestly without adding
  approval workflow, semantic validator, or universal scanner.

### Source Research Bar

Current official-source input:

- Material treats design tokens as named decisions shared between design and
  implementation.
- Apple reinforces source-vs-export discipline through platform resources and
  asset tooling.
- OpenAI Apps SDK reinforces explicit resource/state/mutation boundaries.

Converged implication:

- These sources provide useful principles, not an ops pipeline to copy.
- Material, Apple, and OpenAI do not have a directly comparable Clickeen
  DevStudio/build/commit/R2 sync pipeline.
- 126G is internally sourced from Clickeen architecture. Do not import
  Style Dictionary, Supernova, Zeroheight, or any external governance/build
  platform as a north star for this domain.

Compliance reason:

- This keeps 126G anchored to Clickeen's actual architecture and avoids
  replacing one stale ops model with another company's tooling model.

## Execution Gap Targets

126G execution must fix source/docs against this standard:

- Remove obsolete deploy concepts from UI ops docs.
- Fix stale build-script location references to root `scripts/build-dieter.js`.
- Fix stale 126 doc references in UI docs: DevStudio/Roma are 126L/126M;
  components are 126I.
- Verify no inactive override build behavior remains in active source/docs.
- Verify build-time SVG verification does not mutate source.
- Remove stale deploy concepts from `scripts/tokyo-r2-deploy-sync.mjs` and
  docs unless a root is proven current by product law before execution.
- For localization, first check Babel/localization authority docs and current
  localization product law. Remove only stale deploy assumptions. Do not
  delete real localization tooling, docs, locale overlays, Prague localization,
  San Francisco localization, or future localization product direction.
- Remove or rewrite stale local deploy wording around Tokyo/R2 deploy sync.
- Make manifest provenance fail-visible instead of `unknown`.
- Make unresolved manifest dependency references fail.
- Keep R2 reconciliation/orphan cleanup/rollback out of 126G unless the human
  explicitly authorizes that build-engineering work.
- Document governance guard scope honestly; do not claim Bob/Roma/widget runtime
  consumer coverage.
- Document DevStudio direct-commit verification and token-edit evidence as 126L
  execution gaps, not 126G machinery.
- Update `documentation/engineering/UI/ops.md` to explain the current
  Cloudflare-centered UI ops path and the icon-authoring exception.

## Out Of Scope For This PRD

- No product data repair.
- No generated deploy as part of the PRD text update itself.
- No governance platform.
- No approval workflow.
- No universal UI scanner.
- No R2 reconciliation, orphan cleanup, or rollback engine.
- No semantic token validator for contrast, palette, typography, or motion.
- No external ops north star beyond first-party source principles already
  recorded in research.

## GLM Input Integrated

GLM's independent as-built and research passes are integrated into the
converged standard above. This section preserves the high-signal findings that
shaped the final product law.

Confirmed GLM findings:

- The active build is root `scripts/build-dieter.js`.
- An inactive override path is referenced but does not exist in the inspected
  source state.
- SVG verification in current source reads source and fails on invalid icon
  color/manifest state; it does not rewrite committed source.
- `cloud-dev-workers.yml` is the main push deploy lane; `devstudio-verify.yml`
  is PR-only.
- Tokyo/R2 deploy sync is upload-only.
- Governance guards inspect generated Admin/DevStudio artifacts and do not
  prove downstream runtime consumers.
- DevStudio token edits use regex/value-shape validation and commit through
  GitHub Contents API.
- M3, Apple, and OpenAI do not provide a directly comparable ops pipeline for
  Clickeen to copy.

Converged implication:

- 126G must simplify the active Cloudflare UI ops path and delete stale
  root/deploy concepts. It must not create a larger governance system.
