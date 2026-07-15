# 126G Ops - As-Built Audit - Codex

Status: FROZEN POINT-IN-TIME PRE-EXECUTION AS-BUILT - code changed afterward; exact working-tree provenance may be unrecorded; no step-9 execution credit.
Scope: Current UI ops system: Dieter build, generated artifacts, DevStudio generation/governance, token edit lane, CI deploy trigger, and Tokyo R2 sync.

No code changes, no runtime operations, no product data changes, no Cloudflare/R2 preflight.

## Authority Boundary

- UI ops authority is the source/build/deploy path for Dieter and its generated surfaces.
- Dieter source authority is `dieter/**`.
- Active Dieter build authority is root `scripts/build-dieter.js`.
- Generated repo artifact authority is `tokyo/product/dieter/**`.
- Remote runtime artifact root is R2 `dieter/**`.
- DevStudio preview/admin generation authority is `admin/scripts/**`, `admin/src/html/**`, and `admin/src/data/**`.
- DevStudio token write authority is Berlin-authenticated DevStudio Pages Functions plus the configured GitHub repository/branch.
- Product account runtime storage is not in this authority. Account data remains under account product routes and `accounts/**`; the R2 deploy sync explicitly refuses account runtime keys.

## Build Entrypoints

- Root `package.json` exposes `build:dieter` as `pnpm --filter @ck/dieter build`.
- `dieter/package.json` exposes `build` as `node ../scripts/build-dieter.js`.
- Therefore the active Dieter build script is `scripts/build-dieter.js`, not `dieter/scripts/build-dieter.js`.
- Existing UI ops docs still contain stale references to `dieter/scripts/build-dieter.js`; those are doc drift, not runtime truth.

Evidence:

- `package.json:40`
- `dieter/package.json:13`
- `documentation/engineering/UI/ops.md:7`
- `documentation/engineering/UI/dieter.md:70`
- `documentation/engineering/UI/iconography.md:22`
- `documentation/services/dieter.md:11`

## Dieter Build Pipeline

`scripts/build-dieter.js` currently performs this sequence:

1. Resolve repo root, Dieter root, output root, components source, and foundations source.
2. If `dieter/icons/svg_new` exists, copy it over `dieter/icons/svg` as curated designer-authoritative overrides.
3. Run `scripts/process-svgs.js`.
4. Run `scripts/verify-svgs.js`.
5. Delete and recreate `tokyo/product/dieter`.
6. Copy `dieter/tokens/**` into `tokyo/product/dieter/tokens/**`.
7. Generate shadow token CSS by replacing `:root` with `:host`.
8. Copy `dieter/icons/icons.json` and `dieter/icons/svg/**`.
9. Copy component CSS and statics from `dieter/components/**`.
10. Copy foundation CSS from `dieter/foundations/**`.
11. Bundle per-component TypeScript entries into per-component IIFE files.
12. Assert `tokens/tokens.css`, `icons/icons.json`, and `icons/svg` exist.
13. Emit `manifest.json`.

Evidence:

- `scripts/build-dieter.js:237`
- `scripts/build-dieter.js:244`
- `scripts/build-dieter.js:257`
- `scripts/build-dieter.js:261`
- `scripts/build-dieter.js:265`
- `scripts/build-dieter.js:277`
- `scripts/build-dieter.js:289`
- `scripts/build-dieter.js:301`
- `scripts/build-dieter.js:304`
- `scripts/build-dieter.js:309`

## Build Output Shape

- Build output root is `tokyo/product/dieter`.
- The build deletes and recreates the generated output root before writing.
- Tokens are copied as CSS files and mirrored into `.shadow.css` variants.
- Icons are copied as `icons.json` plus SVG files.
- Component CSS and statics are copied for direct consumers.
- Component JS is bundled per governed component into `components/{name}/{name}.js`.
- The build script header still says it aggregates into `components.js`, but the current code writes per-component JS files. That header is stale relative to runtime behavior.

Evidence:

- `scripts/build-dieter.js:10`
- `scripts/build-dieter.js:196`
- `scripts/build-dieter.js:205`
- `scripts/build-dieter.js:213`
- `scripts/build-dieter.js:240`
- `scripts/build-dieter.js:262`

## Manifest And Provenance

- `manifest.json` records:
  - `gitSha`
  - component list
  - components with JS
  - aliases
  - helpers
  - explicit component dependency graph
- `gitSha` comes from `CF_PAGES_COMMIT_SHA`, `GITHUB_SHA`, `VERCEL_GIT_COMMIT_SHA`, or `COMMIT_SHA` when present.
- Without those env vars, the build runs `git rev-list -1 HEAD -- dieter scripts/build-dieter.js`.
- If SHA lookup fails, `gitSha` becomes `unknown`.
- Dependency graph validation only warns on unknown references; it does not fail the build.

Evidence:

- `scripts/build-dieter.js:19`
- `scripts/build-dieter.js:27`
- `scripts/build-dieter.js:38`
- `scripts/build-dieter.js:58`
- `scripts/build-dieter.js:73`
- `scripts/build-dieter.js:86`
- `scripts/build-dieter.js:97`
- `tokyo/product/dieter/manifest.json:2`

## SVG Ops

- `process-svgs.js` reads `dieter/icons/svg/**`.
- It normalizes quotes, changes explicit fills to `currentColor`, rewrites inline style fills, and adds `fill="currentColor"` to root SVGs when no fill exists.
- It writes the changed content back to the source SVG file in `dieter/icons/svg`.
- Manifest/SVG count mismatch in `process-svgs.js` is a warning, not a failure.
- `verify-svgs.js` hard-fails non-`currentColor` fill attributes and style fills.
- Manifest/SVG count mismatch in `verify-svgs.js` is also a warning, not a failure.
- Stroke usage is a warning, not a failure.

Evidence:

- `scripts/build-dieter.js:244`
- `scripts/process-svgs.js:4`
- `scripts/process-svgs.js:13`
- `scripts/process-svgs.js:25`
- `scripts/process-svgs.js:30`
- `scripts/process-svgs.js:34`
- `scripts/process-svgs.js:39`
- `scripts/verify-svgs.js:13`
- `scripts/verify-svgs.js:25`
- `scripts/verify-svgs.js:32`
- `scripts/verify-svgs.js:46`

## DevStudio Generation

- `admin/package.json` runs `generate` before build, lint, and typecheck paths.
- `generate` runs:
  - `generate-typography-json.cjs`
  - `generate-foundation-pages.mjs`
  - `generate-component-pages.ts`
  - `generate-static-registries.mjs`
- Typography generation reads `dieter/tokens/dieter-typography.css` and writes `admin/src/data/typography.generated.json`.
- Foundation generation reads color tokens from `dieter/tokens/dieter-color-tokens.css` and icons from `dieter/icons/icons.json`.
- Foundation pages include generated headers and `data-governance-count` values.
- Component generation reads `dieter/components/{name}/{name}.spec.json`, `.html`, and `.css`.
- A component with a spec but missing template or CSS fails generation.
- Component generation deletes old generated component HTML before writing current component pages.
- Component page generation fails unresolved stencil markers.

Evidence:

- `admin/package.json:8`
- `admin/scripts/generate-typography-json.cjs:4`
- `admin/scripts/generate-typography-json.cjs:17`
- `admin/scripts/generate-typography-json.cjs:52`
- `admin/scripts/generate-foundation-pages.mjs:11`
- `admin/scripts/generate-foundation-pages.mjs:14`
- `admin/scripts/generate-foundation-pages.mjs:95`
- `admin/scripts/generate-foundation-pages.mjs:101`
- `admin/scripts/generate-foundation-pages.mjs:124`
- `admin/scripts/generate-component-pages.ts:17`
- `admin/scripts/generate-component-pages.ts:37`
- `admin/scripts/generate-component-pages.ts:39`
- `admin/scripts/generate-component-pages.ts:68`
- `admin/scripts/generate-component-pages.ts:88`

## Governance Guards

`scripts/dieter/governance-guards.mjs` currently checks:

- generated foundation HTML headers
- generated component HTML headers
- colors page governance count against source color token count
- typography generated JSON count locked to 33
- icon manifest count against SVG file count
- icons page governance count
- component page coverage against governed components
- unresolved stencil markers in generated component HTML
- undefined token references in `admin/src/html/**`

Current guard limits:

- It checks generated Admin/DevStudio HTML, not all runtime consumers.
- It does not prove Bob, Roma, public widgets, or Tokyo-served Dieter consumers use tokens correctly.
- It does not prove generated files are byte-identical to fresh generator output unless a generate step is run before it.
- A hand edit that preserves generated headers, counts, component coverage, and defined tokens can pass the current guard.
- The guard does not enforce a design-freeze hash baseline.

Evidence:

- `scripts/dieter/governance-guards.mjs:73`
- `scripts/dieter/governance-guards.mjs:84`
- `scripts/dieter/governance-guards.mjs:91`
- `scripts/dieter/governance-guards.mjs:95`
- `scripts/dieter/governance-guards.mjs:105`
- `scripts/dieter/governance-guards.mjs:117`
- `scripts/dieter/governance-guards.mjs:123`
- `scripts/dieter/governance-guards.mjs:141`

## DevStudio Token Edit Lane

- DevStudio token editing is exposed through Pages Functions under `admin/functions/**`.
- Token file config currently permits:
  - `colors`: `dieter/tokens/dieter-color-tokens.css`
  - `typography`: `dieter/tokens/dieter-typography.css`
- Color editable tokens must match `^--color-`.
- Color values must be hex.
- Typography editable tokens must match `--fs` or `--lh`.
- Typography values must match a numeric/unit/clamp regex.
- Token replacement is regex replacement inside the CSS file.
- Replacement refuses non-editable token names, invalid values, token-not-found, and current invalid values.
- Reads come from GitHub Contents API at configured repository and branch.
- Writes use GitHub Contents API with branch, message, content, and current file sha.
- SHA conflicts return 409 with the latest sha.
- Commit message is `dieter(devstudio): ${token} ${value}`.
- The returned JSON includes `commitSha`, but the visible UI path does not display actor attribution or returned commit SHA as a durable operation record.
- The payload is `{token,value}`; no human actor, product reason, or approval note is part of the mutation contract.

Evidence:

- `admin/functions/_shared/dieter-tokens.js:5`
- `admin/functions/_shared/dieter-tokens.js:80`
- `admin/functions/_shared/dieter-tokens.js:97`
- `admin/functions/_shared/dieter-tokens.js:122`
- `admin/functions/_shared/dieter-tokens.js:150`
- `admin/functions/_shared/dieter-tokens.js:163`
- `admin/functions/_shared/dieter-tokens.js:249`
- `admin/functions/_shared/dieter-tokens.js:261`
- `admin/functions/_shared/dieter-tokens.js:267`
- `admin/functions/_shared/dieter-tokens.js:284`
- `admin/functions/_shared/dieter-tokens.js:291`
- `admin/src/main.ts:292`
- `admin/src/main.ts:308`
- `admin/src/main.ts:337`
- `admin/src/main.ts:437`

## DevStudio Auth Gate

- DevStudio token endpoints go through `withDieterTokenSession`.
- Origin enforcement runs before session resolution.
- Session resolution failure returns auth/deny errors instead of proceeding.
- DevStudio docs identify the admin account as `CLICKEEN`.
- Berlin/admin bootstrap requires an admin-capable role for DevStudio.

Evidence:

- `admin/functions/_shared/dieter-tokens.js:211`
- `admin/functions/_shared/dieter-tokens.js:212`
- `admin/functions/_shared/dieter-tokens.js:215`
- `admin/functions/_shared/dieter-tokens.js:220`
- `admin/functions/_shared/berlin.js:16`
- `admin/functions/_shared/berlin.js:33`
- `admin/functions/_middleware.js:63`
- `admin/functions/_middleware.js:71`
- `documentation/services/devstudio.md:13`

## CI And Deploy Path

- `cloud-dev workers deploy` runs on pushes to `main` with path filters for workers, Tokyo product roots, Dieter source, generated Dieter artifacts, and related scripts.
- It also supports manual dispatch.
- The workflow detects Dieter source/script changes and sets `dieter_artifacts=true`.
- If `dieter_artifacts=true`, it runs `pnpm build:dieter`.
- If Dieter artifacts or Tokyo product roots changed, it sets `tokyo_assets=true`.
- If `tokyo_assets=true`, it runs `node scripts/tokyo-r2-deploy-sync.mjs --remote`.
- This path can build generated Dieter artifacts in CI and sync them to R2.
- The workflow does not commit CI-generated `tokyo/product/dieter/**` files back to git.
- `devstudio-verify.yml` runs on pull requests and manual dispatch, not push-to-main.
- `devstudio-verify.yml` includes DevStudio typecheck/lint/build/function check and Dieter governance check.
- DevStudio token edits commit directly to the configured branch; the PR-only verification workflow is not automatically in that direct commit lane.

Evidence:

- `.github/workflows/cloud-dev-workers.yml:3`
- `.github/workflows/cloud-dev-workers.yml:6`
- `.github/workflows/cloud-dev-workers.yml:17`
- `.github/workflows/cloud-dev-workers.yml:24`
- `.github/workflows/cloud-dev-workers.yml:64`
- `.github/workflows/cloud-dev-workers.yml:124`
- `.github/workflows/cloud-dev-workers.yml:128`
- `.github/workflows/cloud-dev-workers.yml:193`
- `.github/workflows/cloud-dev-workers.yml:197`
- `.github/workflows/devstudio-verify.yml:3`
- `.github/workflows/devstudio-verify.yml:24`
- `.github/workflows/devstudio-verify.yml:33`
- `admin/wrangler.toml:8`

## R2 Sync Path

- `scripts/tokyo-r2-deploy-sync.mjs` maps local repo roots to remote R2 roots:
  - `tokyo/product/widgets` -> `product/widgets`
  - `tokyo/product/dieter` -> `dieter`
  - `tokyo/product/fonts` -> `fonts`
  - `tokyo/roma` -> `product/roma`
  - `tokyo/prague` -> `prague`
- Allowed remote roots are `dieter`, `fonts`, `product`, and `prague`.
- The script refuses `accounts/**`.
- The script refuses stale roots `l10n/**`, `public/**`, `published/**`, and root `widgets/**`.
- It builds upload entries from local files only.
- It assigns explicit content types for known extensions.
- It can write through signed R2 API or fall back to Wrangler object put.
- Uploads run with retry and concurrency.
- The script has dry-run mode unless `--remote` is present.

Evidence:

- `scripts/tokyo-r2-deploy-sync.mjs:14`
- `scripts/tokyo-r2-deploy-sync.mjs:24`
- `scripts/tokyo-r2-deploy-sync.mjs:28`
- `scripts/tokyo-r2-deploy-sync.mjs:36`
- `scripts/tokyo-r2-deploy-sync.mjs:95`
- `scripts/tokyo-r2-deploy-sync.mjs:108`
- `scripts/tokyo-r2-deploy-sync.mjs:130`
- `scripts/tokyo-r2-deploy-sync.mjs:280`
- `scripts/tokyo-r2-deploy-sync.mjs:290`
- `scripts/tokyo-r2-deploy-sync.mjs:327`
- `scripts/tokyo-r2-deploy-sync.mjs:349`

## R2 Sync Gaps

- The current R2 sync builds local upload entries and uploads them.
- It does not list the remote R2 prefix before upload.
- It does not compare local entries to remote keys.
- It does not delete remote keys that no longer exist locally.
- It does not prove remote orphan cleanup.
- It does not provide rollback semantics.
- Therefore Step 2 can say the code lacks remote reconciliation; it cannot claim remote orphans actually exist without runtime R2 evidence.

Evidence:

- `scripts/tokyo-r2-deploy-sync.mjs:108`
- `scripts/tokyo-r2-deploy-sync.mjs:327`
- `scripts/tokyo-r2-deploy-sync.mjs:349`
- `scripts/tokyo-r2-deploy-sync.mjs:363`

## Docs Drift Found During Audit

- `documentation/engineering/UI/ops.md` names `dieter/scripts/build-dieter.js`; runtime uses `scripts/build-dieter.js`.
- `documentation/engineering/UI/dieter.md` names `dieter/scripts/build-dieter.js`; runtime uses `scripts/build-dieter.js`.
- `documentation/engineering/UI/iconography.md` names `dieter/scripts/build-dieter.js`; runtime uses `scripts/build-dieter.js`.
- `documentation/engineering/UI/surfaces.md` says DevStudio/Roma track PRDs are `126C`/`126D`; the program doc lists DevStudio/Roma as `126L`/`126M`.
- `documentation/engineering/UI/components.md` says components are track `126B`; the program doc lists components as `126I`.

No docs were corrected in this Step 1 audit because this pass is artifact generation for 126G, not code/runtime/doc cleanup.

Evidence:

- `documentation/engineering/UI/ops.md:7`
- `documentation/engineering/UI/dieter.md:70`
- `documentation/engineering/UI/iconography.md:22`
- `documentation/engineering/UI/surfaces.md:7`
- `documentation/engineering/UI/components.md:4`
- `Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126__PRD__UI_Optimization_Program.md:16`

## Known Current Gaps

- Active docs have stale build-script path references.
- Manifest dependency validation warns instead of failing on unknown dependency references.
- Manifest provenance can become `unknown`.
- SVG normalization mutates source SVG files.
- SVG manifest/SVG count mismatch is warning-only in the SVG scripts.
- Stroke usage is warning-only.
- DevStudio token validation is regex/value-shape validation, not semantic design validation.
- DevStudio token commit messages lack explicit human actor attribution.
- DevStudio token UI does not expose a durable operation record with commit SHA and actor context.
- DevStudio direct token commits are not automatically covered by the PR-only `devstudio-verify` workflow.
- Current governance guard coverage is Admin-generated HTML, not every downstream consumer.
- Current governance guard does not enforce a design-freeze hash baseline.
- R2 sync uploads current local files but does not reconcile deleted/orphaned remote objects.
- CI can rebuild and upload Dieter artifacts without committing generated output changes back to git.

## Compliance Notes

- This audit treats source code, generated repo artifacts, and remote R2 artifacts as separate authorities.
- This audit does not reinterpret ops into a new ideal pipeline.
- This audit does not select fixes.
- This audit does not run Cloudflare operations or inspect remote product data.
- This audit records only current code/docs truth and known gaps supported by source evidence.
