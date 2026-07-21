# 126G - PRD: Ops

Status: PRE-EXECUTION STEPS 6-7 CORRECTED AFTER STEP-8 REVIEW - one generated
artifact authority, one build-before-sync path, and the complete deploy blast
radius are pinned; fresh exact-tree Step-8 review pending; no Step-9 execution
credit.
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
- Generated Dieter repo output is currently tracked at
  `tokyo/product/dieter/**`; this is the source/deploy ambiguity 126G removes.
- Remote Dieter runtime output is R2 `dieter/**`.
- DevStudio generated preview/governance pages are produced through
  `admin/scripts/generate-typography-json.cjs`,
  `admin/scripts/generate-foundation-pages.mjs`,
  `admin/scripts/generate-component-pages.ts`,
  `admin/scripts/generate-static-registries.mjs`, and
  `admin/scripts/build-static.mjs`.
- DevStudio token editing is a Berlin-authenticated Pages Functions lane that
  reads and writes selected Dieter token CSS files through GitHub Contents API.
- Cloud-dev CI currently runs `pnpm build:dieter` and then
  `scripts/tokyo-r2-deploy-sync.mjs --remote` when Dieter source/build-script
  changes. Generated Tokyo product-root changes run upload-only R2 sync; they
  do not by themselves run `build:dieter`.
- Product account runtime data is outside UI ops. Account data belongs to
  product routes/workers and `accounts/{accountPublicId}/...`.

Current pre-execution boundary:

- Build provenance and declared dependencies fail closed.
- Current local and GitHub builds can stamp different provenance because
  deployment environment SHAs override the scoped Dieter-input identity.
- Current CI rebuilds only for Dieter source/build-script changes. Generated
  Dieter-only, widget/other product-root, and manual-dispatch sync paths can
  upload the Dieter root without rebuilding. The approved manual sync command
  bypasses the build too, and Prague-only source is not watched by the worker
  workflow.
- `dieter/package.json` exposes a missing `main` entrypoint and regenerates
  product output through `prepare` during install; both are false ops surfaces.
- SVG verification is non-mutating.
- Current living docs describe the root build path, generated/deployed
  authority, product-data exclusion, and upload-only Cloudflare sync.
- DevStudio token validation is regex/value-shape validation only.
- DevStudio token commit evidence is not visible enough for the operation lane.
- DevStudio direct token commits are not automatically covered by the PR-only
  `devstudio-verify` workflow.
- Governance guard coverage is generated Admin/DevStudio HTML, not every
  downstream runtime consumer.
- Tokyo/R2 deploy sync uploads current local entries; it does not reconcile
  remote deletions/orphans.

## Human-Converged Product Reading

The 126G problem is not "add governance." The active build/deploy path is
structurally small, but committed generated Dieter output creates a second
repository truth and makes a normal DevStudio source-only commit incompatible
with treating generated Git files as a deploy prerequisite. Remaining work is one
package/build/workflow cleanup that makes generated output ephemeral and every
sync build it from source, plus the DevStudio mutation-evidence gap owned by
126L.

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
- Generated build artifact: `tokyo/product/dieter/**`, recreated from source,
  ignored by Git, and consumed only as local/CI deploy input. It is not a
  repository authority. Generated DevStudio/Admin source registries keep their
  existing ownership; they are a separate generator lane.
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

Current verification targets:

- Verify the current root allowlist, account-data exclusion, and upload-only
  deployment semantics remain intact.
- Verify stale local/deploy concepts remain absent.

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
- `tokyo/product/dieter/**` must not be committed. Source changes, including
  DevStudio token edits, commit only the authoritative source; the deploy path
  rebuilds the output.
- Build comments/docs must match the current output shape.

Current verification targets:

- Verify docs and package entrypoints still name root `scripts/build-dieter.js`.
- Verify SVG build checks remain non-mutating and the former override path
  remains absent.

Compliance reason:

- This makes build behavior predictable and source-safe without adding a new
  build framework.

### Manifest And Verification Honesty

Target law:

- `manifest.json` provenance must be one deterministic identity: the latest
  commit affecting `dieter/`, `scripts/build-dieter.js`, or
  `scripts/verify-svgs.js`, locally and in CI. Deployment environment SHAs must
  not substitute a second identity.
- `scripts/tokyo-r2-deploy-sync.mjs` is the one local/CI R2 sync entrypoint. It
  must run `pnpm build:dieter` successfully before it enumerates or uploads any
  root. The workflow and documented manual commands use that same entrypoint.
- `tokyo/product/dieter/**` is ignored build output, so DevStudio may commit one
  source file and CI may build/deploy it without requiring an impossible second
  generated-file commit.
- The worker workflow watches every root the sync uploads, including
  `tokyo/prague/**`, and uses only `tokyo_assets`; the narrower
  `dieter_artifacts` condition is deleted.
- Manifest dependencies must resolve. Warning-and-ship is not a valid standard
  for broken declared dependencies.
- Warning-only behavior is allowed only where warning is explicitly product law.
- Existing governance checks should stay scoped to the generated artifacts they
  actually inspect. Do not claim they prove Bob/Roma/widget runtime consumer
  correctness.

Current verification targets:

- The build must continue failing when provenance is unavailable or declared
  dependencies are unresolved.
- Verify local and CI builds resolve the same scoped input SHA; verify workflow,
  manual, Prague-only, widget-only, Roma-only, and DevStudio token-source paths
  all reach the same build-before-sync entrypoint.
- Verify SVG verification remains 126C-owned and governance scope remains
  documented honestly.

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

- The Tokyo/R2 deploy sync is an upload path for git-authored product source
  roots and their deterministic build output into Cloudflare R2.
- Its current contract is upload-only. It does not prove remote reconciliation,
  orphan cleanup, or rollback.
- 126G must document that honestly instead of pretending upload-only sync proves
  remote state.
- R2 reconciliation, orphan cleanup, and rollback are not 126G doctrine. They
  require a later build-engineering decision if the human wants them.

Current verification targets:

- Verify the script builds Dieter before file enumeration in dry-run and remote
  modes, docs describe the same path, all four source roots trigger CI, and
  account/runtime product data stays outside it.

Compliance reason:

- This clarifies the active path without expanding it into a reconciliation
  engine.

## Detailed Execution Blast Radius

Execution must inspect and update this blast radius as needed. If a listed path
does not contain a current hit, execution records that it was checked and leaves
it alone.

| Area | Owner | Exact files / path shapes | Verify | Must not change |
| --- | --- | --- | --- | --- |
| Build command entrypoints | 126G / repo scripts | `package.json`; `dieter/package.json`; `admin/package.json` | Remove Dieter's false `main`, install-time `prepare`, and 126F-assigned unused GSAP declaration in one package edit; preserve explicit build/typecheck and real dependencies. | Do not generate deploy output during install or edit `dieter/package.json` again in 126F/126H. |
| Dieter build source | 126G / Dieter ops | `scripts/build-dieter.js`; `scripts/verify-svgs.js` | Remove deployment-SHA precedence; verify the scoped input SHA and dependency failures remain fail-closed and source verification remains non-mutating. | Do not create a second builder, compatibility branch, or dual manifest identity. |
| SVG processing and verification | 126C icon law + 126G build behavior | `scripts/verify-svgs.js`; `dieter/icons/icons.json`; `dieter/icons/svg/` | Verify build execution reads/verifies source SVGs and does not mutate committed source. | Do not let build-time verification silently rewrite committed icon source. |
| Generated Dieter artifacts | Generated from Dieter source | `tokyo/product/dieter/**`; `.gitignore` | Remove the generated tree from Git tracking, ignore it, and recreate it before every R2 sync; manifest provenance and dependencies remain fail-visible. | Do not hand-edit, commit, or treat generated output as source. |
| DevStudio generation | 126G / DevStudio generation, 126L for DevStudio product workflow | `admin/scripts/generate-typography-json.cjs`; `admin/scripts/generate-foundation-pages.mjs`; `admin/scripts/generate-component-pages.ts`; `admin/scripts/generate-static-registries.mjs`; `admin/scripts/build-static.mjs`; `admin/src/data/typography.generated.json`; `admin/src/html/` | Generated DevStudio/Admin artifacts must reflect source generators; governance scope must be described honestly. | Do not claim generated Admin checks prove Bob/Roma/widget runtime correctness. |
| DevStudio token edit lane | 126L DevStudio execution target, 126G documents lane | `admin/functions/_shared/dieter-tokens.js`; `admin/functions/_shared/berlin.js`; `admin/functions/_middleware.js`; `admin/functions/api/dieter/tokens/colors.js`; `admin/functions/api/dieter/tokens/colors/value.js`; `admin/functions/api/dieter/tokens/typography.js`; `admin/functions/api/dieter/tokens/typography/value.js`; `admin/src/main.ts` | Token write response and visible operation evidence expose token, value change, commit SHA, and available authenticated actor/session context where 126L implements it; client binding and auth boundary are in scope for inspection. | Do not add approval workflow, contrast enforcement, semantic validator, or PR bureaucracy in 126G. |
| Governance guard scope | 126G / generated Admin guard | `scripts/dieter/governance-guards.mjs`; `.github/workflows/devstudio-verify.yml` | Guard docs state exact scope: generated Admin/DevStudio artifacts only. | Do not expand into a universal UI scanner in 126G. |
| Cloud-dev deploy path | DevOps / Cloudflare deploy | `.github/workflows/cloud-dev-workers.yml`; `.github/workflows/cloud-dev-runtime-verify.yml`; `.github/workflows/cloud-dev-roma-app.yml`; `.github/workflows/cloud-dev-prague-app.yml`; `.github/workflows/cloud-dev-prague-content.yml` | Watch all four sync source roots, including `tokyo/prague/**`; delete `dieter_artifacts`; route every `tokyo_assets=true` sync through the sole build-before-sync entrypoint. | Do not preserve a generated-only trigger, narrower build condition, or second deploy service. |
| Tokyo/R2 deploy sync | 126G / Cloudflare product-root deploy sync | `scripts/tokyo-r2-deploy-sync.mjs`; `package.json`; `documentation/services/tokyo.md`; `documentation/services/tokyo-worker.md`; `documentation/engineering/CloudflareOperations.md` | Build Dieter before enumeration in dry-run and remote modes; then preserve the current root allowlist, account-runtime exclusion, and upload-only behavior. | Do not permit the documented manual command to bypass the build; do not add R2 reconciliation, orphan cleanup, or rollback. |
| Bob source dependency | Bob compile/build | `bob/lib/icons.ts`; `.github/workflows/cloud-dev-roma-app.yml` | Read the icon registry from authoritative `dieter/icons/icons.json` so Bob builds do not require a committed generated tree; remove the generated-tree workflow trigger. | Do not duplicate the registry or add a copy step. |
| Localization/l10n authority boundary | Babel/Prague/San Francisco/localization owners, not 126G | `documentation/architecture/BabelProtocol.md`; `documentation/architecture/OverlayArchitecture.md`; `documentation/strategy/Clickeen-Babel.md`; `documentation/capabilities/localization.md`; `documentation/services/prague/prague-overview.md`; `documentation/ai/sanfrancisco.md`; `packages/l10n/**`; `packages/l10n/locales.json`; `scripts/i18n/build.mjs`; `scripts/i18n/extract-keys.mjs`; `scripts/i18n/validate.mjs`; `scripts/l10n/build.mjs`; `scripts/l10n/validate.mjs`; `scripts/prague-l10n/lib.mjs`; `scripts/prague-l10n/translate.mjs`; `scripts/prague-l10n/verify.mjs` | Verify real localization tooling remains intact; remove only stale deploy-root assumptions from UI ops/deploy docs. | Do not delete real localization tooling, locale overlays, Prague l10n, San Francisco l10n, or future localization product direction. |
| Product data boundary | Product routes/workers, not 126G | `documentation/services/tokyo.md`; `documentation/services/tokyo-worker.md`; `documentation/services/roma.md`; `documentation/services/bob.md`; account runtime paths `accounts/{accountPublicId}/...` in docs | Docs must state account/runtime product data is outside UI ops source/build/deploy roots. | Do not mutate product data or treat `accounts/**` as a UI deploy root. |
| Generated-output living docs | 126G docs | `documentation/architecture/Overview.md`; `documentation/engineering/CloudflareOperations.md`; `documentation/engineering/CloudflarePagesCloudDevChecklist.md`; `documentation/engineering/UI/README.md`; `documentation/engineering/UI/ops.md`; `documentation/engineering/UI/dieter.md`; `documentation/engineering/UI/color.md`; `documentation/engineering/UI/iconography.md`; `documentation/engineering/UI/components.md`; `documentation/engineering/UI/surfaces.md`; `documentation/services/bob.md`; `documentation/services/dieter.md`; `documentation/services/devstudio.md`; `documentation/services/tokyo.md`; `documentation/services/tokyo-worker.md`; `documentation/widgets/README.md`; `documentation/widgets/authoring/ToolDrawerControls.md` | Update every active `tokyo/product/dieter` reference to distinguish authoritative `dieter/**`, ignored local/CI build output, and deployed R2 `dieter/**`; document one build-before-sync path and automatic Prague trigger. | Do not call ignored output git-authored source, describe the manual build bypass as current after execution, or rewrite historical PRD evidence. |

## Current Documentation Reconciliation

`documentation/engineering/UI/ops.md` and the related Dieter, iconography,
Tokyo, Tokyo-worker, and UI-index docs record the current authority lanes, root
build, generated/deployed separation, localization boundary, and upload-only
Cloudflare path. 126G execution adds the one-identity provenance rule,
install-side-effect deletion, ephemeral generated-output rule, and one
build-before-sync entrypoint.

## Final Step-7 Execution Disposition

126G has one bounded package/build/workflow cleanup and no product-data or
managed-service mutation. 126F supplies the first source change used to prove
the corrected build path, and the DevStudio screen work remains with 126L.
Premature cleanup is current as-built input but receives no Step-9 execution
credit.

The final integrated Step-9 plan carries these precise responsibilities:

1. **Single Dieter package cleanup:** remove false `main`, install-time
   `prepare`, and Dieter's unused GSAP declaration assigned by 126F in one edit;
   preserve explicit `build`/`typecheck`, `@clickeen/ck-contracts`, and `tldts`.
2. **Deterministic provenance:** make `scripts/build-dieter.js` always derive
   the latest scoped Dieter/build-input commit; remove deployment-environment
   SHA precedence.
3. **One generated-artifact model:** remove all currently tracked
   `tokyo/product/dieter/**` files from Git and ignore that directory. The build
   continues to recreate the same local path as ephemeral deploy input. Change
   `bob/lib/icons.ts` to import authoritative `dieter/icons/icons.json` directly,
   so a clean clone does not need generated files to build Bob.
4. **One build-before-sync entrypoint:** make
   `scripts/tokyo-r2-deploy-sync.mjs` run `pnpm build:dieter` successfully before
   it enumerates files in both dry-run and remote modes. Package commands and CI
   invoke this same script. Remove the separate workflow build step and the
   `dieter_artifacts` variable. Add `tokyo/prague/**` to the workflow trigger and
   `tokyo_assets` detection. Remove generated Dieter paths from workflow
   triggers because they no longer exist in Git.
5. **Preservation gate:** if another 126 slice changes Dieter source, build or
   generator scripts, DevStudio functions, or deploy
   workflows, re-run the owning source/build checks and verify the exact
   deployed surface through its existing GitHub/Cloudflare authority.
6. **126L handoff:** DevStudio must display the token, old value, new value, and
   returned commit SHA after a successful direct token commit, using available
   authenticated session context where the server records operation evidence.
   126L also closes the direct-commit verification visibility gap. 126G does not
   implement that screen workflow or add an ops service.
7. **126F handoff:** 126F changes Dieter source and proves source commit -> build
   -> R2 deployment at that same source commit. Generated output is inspected
   locally and read back from R2; it is never committed or hand-edited.

Exact current deletion map:

- `dieter/package.json`: delete false `main`, install-time `prepare`, and the
  unused Dieter GSAP declaration assigned by 126F.
- `scripts/build-dieter.js`: delete deployment-environment SHA precedence.
- `tokyo/product/dieter/**`: delete all generated files from Git tracking;
  retain the path only as ignored build output.
- `.gitignore`: ignore `tokyo/product/dieter/**`.
- `bob/lib/icons.ts`: replace the generated-registry import with the authoritative
  source registry.
- `scripts/tokyo-r2-deploy-sync.mjs`: build Dieter before enumerating uploads in
  dry-run and remote modes.
- `.github/workflows/cloud-dev-workers.yml`: watch `tokyo/prague/**`, collapse
  `dieter_artifacts` into `tokyo_assets`, remove generated-output triggers, and
  use the sole sync entrypoint.
- `.github/workflows/cloud-dev-roma-app.yml`: remove the generated Dieter path
  trigger; `dieter/**` remains the source trigger.

Current source otherwise has no `unknown` provenance fallback,
warning-and-ship manifest dependency path, source-mutating SVG build, stale UI
deploy root, account-data deploy mapping, or claim that upload-only R2 sync
performs reconciliation. The stale committed generated manifest disappears with
the tracked generated tree; each build emits current scoped provenance.

Exact no-touch boundary:

- account/runtime product data and product routes;
- real Babel, Prague, San Francisco, i18n, and l10n tooling;
- 126C human-owned icon authoring and icon policy;
- 126L DevStudio screen and direct-commit UX until that slice executes;
- 126I component behavior and 126M Roma UI;
- R2 reconciliation, orphan cleanup, rollback, governance platform, approval
  workflow, or universal UI scanner.

Do not run a remote sync or deploy solely to manufacture 126G execution. A
later slice that changes a deployed authority owns its normal deployment and
read-back proof.

## V1-V8 Pre-Execution Controls

| ID | 126G risk | Required control |
| --- | --- | --- |
| V1 Silent substitution | CI deployment SHA substitutes for scoped source-input identity. | Local and CI builds derive the same latest scoped Dieter/build input commit and fail when it is unavailable. |
| V2 Silent healing | SVG verification rewrites committed source during build. | Build must not mutate source SVGs; icon source changes belong to human icon authoring / 126C. |
| V3 Silent omission | Install-time generation, widget/other product-root deploys, Prague-only changes, manual sync, or DevStudio source commits bypass the build. | Delete `prepare`; make the sole sync entrypoint build first; watch all four roots; delete `dieter_artifacts`. |
| V4 Fail-open control | Manifest dependency validation regresses to warning-and-ship. | Unresolved declared dependencies must continue failing the build. |
| V5 Corruption-as-absence | Product data or account roots are treated as deploy artifacts and overwritten/ignored. | Keep account/runtime data outside UI ops deploy roots. |
| V6 Partial-success masquerade | DevStudio reports a committed source edit but generated deployment never reaches R2. | Generated output is not committed; the source commit triggers the same fail-closed build-before-sync path and 126L exposes its run evidence. |
| V7 Masquerade/redress | Stale deploy paths or refusal guards are renamed as current Cloudflare law. | Delete dead concepts instead of preserving them behind guards. |
| V8 Runtime test dependency | Normal UI ops depends on governance scans or validation rituals as runtime truth. | Source/build/deploy authorities carry truth; checks only verify their scoped outputs. |

## Verification Checklist

Execution is not complete until these checks are run and reconciled:

- Search docs for stale build-script locations, old icon-registry pipeline
  claims, and wrong 126C ops ownership claims.
- Search `scripts/build-dieter.js` for `unknown`, and warning-only
  manifest dependency behavior; verify local and CI provenance always resolves
  the latest scoped Dieter/build input SHA.
- Search `package.json`, `dieter/package.json`, and `admin/package.json` for
  build/generate entrypoints; verify Dieter has no false `main`, install-time
  `prepare`, or unused GSAP declaration after the single package cleanup.
- Prove `tokyo/product/dieter/**` has no tracked files and is ignored, while
  `pnpm build:dieter` recreates the full output and current manifest.
- Exercise Dieter source, widget-only, Roma-only, Prague-only, manual dry-run,
  manual remote, workflow dispatch, and DevStudio token-source paths; prove each
  reaches the same build-before-enumeration sync entrypoint.
- Build Bob from a clean generated-output state and prove its icon registry
  resolves from `dieter/icons/icons.json`.
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

Step 6 found a second repository truth for generated Dieter output, one
deterministic-build gap, an incomplete deploy trigger, and two false Dieter
package surfaces. 126G removes tracked generated output, the environment-SHA
override, install-time generation, missing entrypoint claim, and obsolete
`dieter_artifacts` vocabulary; makes the sole sync entrypoint build first; and
preserves fail-closed dependencies, non-mutating SVG verification, the current
R2 root allowlist, account-data exclusion, real localization, and upload-only
sync. DevStudio
direct-commit evidence remains owned by 126L. No R2 reconciliation, orphan
cleanup, rollback, or new governance machinery enters 126G.

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

GLM's independent input remains frozen historical provenance. Current source
overrides stale present-tense implementation claims.

Confirmed GLM findings:

- The active build is root `scripts/build-dieter.js`.
- Historical override and deploy-root drift are absent from current source.
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
