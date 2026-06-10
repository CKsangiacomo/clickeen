# DevStudio PRD Execution Ledger

Status: active execution
Started: 2026-06-09

## Slice 0A — Canonical Host + Berlin Auth Topology

Status: code/config green; historical slice superseded by Slice 0B topology verification.

Implemented:

- DevStudio canonical host contract: `https://devstudio.clickeen.com`.
- Berlin remains the auth boundary; Cloudflare Access is not used.
- Berlin now supports an allowlisted `finishRedirectUrl` while preserving Roma's default finish route.
- DevStudio Pages Functions now provide:
  - canonical-host redirect;
  - Berlin login start route;
  - Berlin finish route that sets host-scoped session cookies;
  - authenticated middleware for app/API;
  - dev-only `/api/e2e/session` bootstrap using the existing Berlin e2e session path.
- DevStudio package now has real `lint`, `typecheck`, `test`, and `check:functions` commands.
- DevStudio PR verification workflow added for package checks and function syntax.

Verification run:

- `pnpm --filter @clickeen/devstudio lint` — pass, with existing Bob Native console warnings.
- `pnpm --filter @clickeen/devstudio test` — pass, no committed test files yet.
- `pnpm --filter @clickeen/devstudio typecheck` — pass.
- `pnpm --filter @clickeen/devstudio build` — pass.
- `pnpm --filter @clickeen/devstudio check:functions` — pass.
- `pnpm --filter @clickeen/berlin typecheck` — pass.
- `pnpm --filter @clickeen/berlin verify:auth-boundary` — pass.
- `E2E_BASE_URL=https://devstudio.clickeen.com E2E_AUTH_STATE=e2e/.auth/devstudio.json pnpm exec playwright test --list` — pass, 19 tests listed.
- Cloudflare Pages API: added `devstudio.clickeen.com` to the existing DevStudio
  Pages project — success, status `initializing` then `pending`.
- Cloudflare Pages API: DevStudio custom domains now list
  `devstudio.clickeen.com` and `devstudio.dev.clickeen.com`.
- `dig +short devstudio.clickeen.com` — no record returned yet.
- `curl -I https://devstudio.clickeen.com/` — blocked: DNS does not resolve yet.
- `curl -I https://devstudio.dev.clickeen.com/` — existing old host returns 200.

Open external topology item:

- Confirm Cloudflare DNS/Pages custom-domain verification completes for
  `devstudio.clickeen.com`. The current Wrangler OAuth token can update Pages
  custom domains but receives `403` for DNS record inspection, so DNS creation
  cannot be verified from this shell. Until DNS resolves, live browser execution
  against the canonical host cannot run.

Generated drift observed:

- `pnpm --filter @clickeen/devstudio build` regenerated four tracked component pages. The generated artifacts were stale before this slice and must either stay committed or be addressed by the later Design Governance generator-guard slice.

## Slice 0B — Realignment After Existing Cloudflare Project Discovery

Status: repo-side migration continuing; live Cloudflare topology verified; live
runtime still stale.

Reason:

- Execution initially treated PRD Step 1 as greenfield project creation.
- Repo and prior ledger evidence were using imprecise naming. The actual
  Cloudflare Pages project is `devstudio`; its Pages fallback host is
  `devstudio-dev.pages.dev`.
- Step 1 must be reconciled/verified on the existing project rather than
  recreated.

Process ruling:

- Cloudflare Pages/DNS claims must come from `pnpm cf:api:*` repo commands.
- `CLOUDFLARE_REST_API_TOKEN` is the local repo-helper token for Pages/DNS/config.
  Do not reuse the ambiguous `CLOUDFLARE_API_TOKEN` name for this path.

Implemented in this slice:

- Removed the Bob UI Native husk from DevStudio:
  - deleted `admin/src/BobNativeCatalog.ts`;
  - deleted `admin/src/html/tools/bob-ui-native.html`;
  - removed the special Bob Native renderer from `admin/src/main.ts`.
- Reworked DevStudio nav generation to the PRD sections:
  - Foundations;
  - Dieter Components;
  - Policy with `#/policy/entitlements`.
- Removed local Vite policy/theme/rebuild write APIs from `admin/vite.config.ts`.
  Local Vite now keeps only the shell, route fallback, and Tokyo static helper.
- Added shared entitlement cell-update validation to `@clickeen/ck-policy`.
- Added Pages Functions for the four policy routes:
  - `GET /api/entitlements/matrix`;
  - `POST /api/entitlements/matrix/cell`;
  - `GET /api/ai-runtime/matrix`;
  - `POST /api/ai-runtime/matrix/cell`.
- Added GitHub contents-API backend for policy reads/writes:
  - reads current `main`;
  - applies `@clickeen/ck-policy` validators;
  - commits JSON updates back to GitHub;
  - returns typed validation, upstream, and SHA-conflict failures.
- Removed DevStudio from `scripts/dev-up.sh`.
- Synced current docs for DevStudio, local runtime, Pages cloud-dev contract, and
  system maps.

Verification pending in this slice:

- Local package checks after final docs/code cleanup.
- Live Step 1/3/4 browser evidence on `https://devstudio.clickeen.com` after the
  Pages deployment carries these repo changes and DevStudio's required Pages env
  values/secrets are present.

Verification run after repo-side realignment:

- `rg "5173" scripts documentation -g '*.md' -g '*.sh'` — pass, no matches.
- `rg "BobNativeCatalog|bob-ui-native|api/themes|rebuild-icons|local-edit-entitlements|local-edit-ai-runtime" admin scripts documentation packages -g '*.*'` — pass, no matches.
- `node --import tsx -e "import('./functions/_shared/policy-github.js')..."` from
  `admin/` — pass.
- `pnpm --filter @clickeen/devstudio check:functions` — pass.
- `pnpm --filter @clickeen/ck-policy typecheck` — pass.
- `pnpm --filter @clickeen/devstudio typecheck` — pass.
- `pnpm --filter @clickeen/devstudio lint` — pass with the existing ESLintRC
  deprecation warning.
- `pnpm --filter @clickeen/devstudio test` — pass, no committed test files.
- `pnpm --filter @clickeen/devstudio build` — pass.

Cloudflare verification run after REST-token repair:

- `pnpm cf:api:preflight` — pass. Token active; account visible; `devstudio`
  Pages project visible; `devstudio.clickeen.com` custom domain active;
  `devstudio.clickeen.com` DNS CNAME points to `devstudio-dev.pages.dev`.
- `pnpm cf:pages:project devstudio` — pass. Project name is `devstudio`, fallback
  subdomain is `devstudio-dev.pages.dev`, Git source is
  `CKsangiacomo/clickeen`, production branch is `main`. The live project is still
  mis-rooted at repo root with build command
  `pnpm --filter @clickeen/devstudio build` and output directory `admin/dist`;
  the PRD target is root directory `admin`, build command `pnpm build`, and
  output directory `dist` so `admin/functions/` is at the Pages project root.
- Latest live deployment is commit
  `83e52bf3f7b76f087cf6c4807301aa1cef6f3e22`
  (`docs: record widget certification deploy fix`, 2026-06-10T02:53:50Z), which
  predates the current local DevStudio migration changes.
- Production env currently lacks `BERLIN_BASE_URL`,
  `DEVSTUDIO_CANONICAL_ORIGIN`, `DEVSTUDIO_GITHUB_BRANCH`,
  `DEVSTUDIO_GITHUB_REPOSITORY`, `DEVSTUDIO_GITHUB_TOKEN`, and `ENV_STAGE`.
- `curl -I https://devstudio.clickeen.com/` — returns `200`, not an
  unauthenticated Berlin redirect.
- `curl -I https://devstudio-dev.pages.dev/` — returns `200`, not a canonical-host
  redirect/block.
- `pnpm cf:pages:sync-devstudio-project` — dry-run pass. It would change only the
  DevStudio Pages project settings from repo-root build
  (`pnpm --filter @clickeen/devstudio build`, `admin/dist`) to PRD-rooted
  `admin` build (`pnpm build`, `dist`).
- `pnpm cf:pages:sync-devstudio-project --apply` — blocked with Cloudflare
  `403 Authentication error`. The same `CLOUDFLARE_REST_API_TOKEN` can read
  Pages/DNS state, but cannot edit the Pages project build configuration.
- `pnpm cf:pages:project devstudio` after the failed apply confirms no project
  config change was made.
- 2026-06-10 manual dashboard correction: product owner set the DevStudio Pages
  build configuration to root directory `admin`, build command `pnpm build`, and
  output directory `dist`.
- `pnpm cf:pages:project devstudio` after the dashboard correction — pass. Build
  config now reads back as `root_dir: "admin"`, `build_command: "pnpm build"`,
  `destination_dir: "dist"`.
- `pnpm cf:pages:sync-devstudio-project` after the dashboard correction — pass,
  `matches: true`.
- `pnpm cf:pages:project bob-dev` and `pnpm cf:pages:project roma-dev` — pass.
  Both existing Pages apps are rooted at their app directories (`bob`, `roma`),
  confirming that DevStudio should likewise be rooted at `admin` for
  `admin/functions/` to sit at the Pages project root.
- `pnpm cf:pages:devstudio-env` — pass/read-only. It confirms all five
  non-secret DevStudio vars from `admin/wrangler.toml` are absent from the current
  live project and `DEVSTUDIO_GITHUB_TOKEN` is not present as a Pages secret.
- 2026-06-10 manual dashboard correction: product owner added the DevStudio Pages
  production env vars and `DEVSTUDIO_GITHUB_TOKEN` Pages secret.
- `pnpm cf:pages:devstudio-env` after the dashboard correction — pass,
  `matches: true`. Required production vars present:
  `BERLIN_BASE_URL`, `DEVSTUDIO_CANONICAL_ORIGIN`, `DEVSTUDIO_GITHUB_BRANCH`,
  `DEVSTUDIO_GITHUB_REPOSITORY`, `ENV_STAGE`; required secret present as
  `secret_text`: `DEVSTUDIO_GITHUB_TOKEN`.
- Added `pnpm cf:pages:sync-devstudio-env` as the repo command path for dry-run
  and apply of the DevStudio Pages production env from `admin/wrangler.toml` plus
  `DEVSTUDIO_GITHUB_TOKEN` from root `.env.local`. The command redacts secret
  values in output. `--apply` remains subject to the Cloudflare REST token's Pages
  project edit permission.
- `pnpm --filter @clickeen/berlin exec wrangler pages functions build
  /Users/piero_macpro/code/VS/clickeen/admin/functions --project-directory
  /Users/piero_macpro/code/VS/clickeen/admin --outdir
  /tmp/clickeen-devstudio-functions-build --compatibility-date 2025-12-28` —
  pass. Wrangler 4.54.0 compiled the DevStudio Pages Functions worker
  successfully without deploying.
- Out-of-scope correction: a temporary generated component-page whitespace cleanup
  was reverted because generator/showcase hygiene belongs to
  `PRD__DevStudio_Design_Governance.md`, not this Migration PRD. The generated
  component output remains governed by the existing generator until Design
  Governance Step 0 opens.
- `git diff --check` currently reports trailing whitespace in generated
  component pages (`object-manager`, `valuefield`) after the normal DevStudio
  generator runs. This is a generated-output hygiene issue for Design Governance,
  not a Migration execution task.

Live conclusion:

- Cloudflare project/domain/DNS is no longer the blocker.
- The Pages project build-config blocker is cleared.
- The Pages production app-runtime env/GitHub policy-write secret blocker is
  cleared for Step 1.
- `feat(devstudio): migrate toolbench to Cloudflare Pages`
  (`3238cfcd9d5ff31ab7a63aca6ef304cd640657e9`) was pushed to `main`.
- Cloudflare Pages deployment `4315aafb-ec7d-459c-a4c4-147dc6778816` for
  `3238cfcd9d5ff31ab7a63aca6ef304cd640657e9` completed successfully:
  queued, initialize, clone_repo, build, and deploy all `success`.
- `curl https://devstudio.clickeen.com/` — `302` to
  `/api/session/login/google?next=%2F`.
- `curl https://devstudio-dev.pages.dev/` — `308` to
  `https://devstudio.clickeen.com/`.
- `curl https://devstudio.clickeen.com/api/entitlements/matrix` without cookies
  — `401` with `coreui.errors.auth.required`.
- `curl https://devstudio.clickeen.com/api/session/login/google` — `302` to
  Berlin Google login start with
  `finishRedirectUrl=https://devstudio.clickeen.com/api/session/finish`.
- 2026-06-10 product-owner browser evidence: after Google login at
  `https://devstudio.clickeen.com`, the DevStudio app loads.
- PRD Step 1 is green for the authenticated admin path, unauthenticated boundary,
  and fallback-host redirect. Non-admin denial remains covered by the same
  Berlin bootstrap account/role check in the Pages middleware and policy API; no
  non-admin live credential was available for manual browser evidence.

Verification limitation:

- Step 1 deployment/runtime checks are complete. The remaining live gate is Step
  2 authenticated Appendix A verification, recorded below.

## Step 2 — Page Contract / IA / Deletion Evidence

Status: green; Step 2 complete. Current PRD step: Step 3.

Evidence recorded 2026-06-10:

- Current PRD step after Step 1: Step 2.
- Surviving authority: `PRD__DevStudio_Cloudflare_Migration.md` Appendix A and
  `documentation/services/devstudio.md`.
- `admin/src/data/routes.ts` defines exactly three nav groups from the surviving
  folders: Foundations, Dieter Components, Policy.
- `admin/src/html/` contains the 24 surviving pages:
  20 component fragments, 3 foundation fragments, and
  `tools/entitlements.html`.
- Pushed Migration diff `83e52bf3..3238cfcd` changes no carried HTML fragments;
  the only `admin/src/html` file changed by the commit is the A2 deletion
  `admin/src/html/tools/bob-ui-native.html`.
- `git diff --check 83e52bf3..3238cfcd` — pass.
- `git ls-files admin/dist` — pass, no committed `admin/dist`.
- `git ls-files admin/src/html/tools/bob-ui-native.html admin/src/BobNativeCatalog.ts`
  — pass, no committed husk files.
- `rg "BobNativeCatalog|bob-ui-native|folder === 'dieter'|api/themes|rebuild-icons|local-edit-entitlements|local-edit-ai-runtime" admin scripts documentation packages -g '*.*'`
  — pass, no matches.
- `pnpm --filter @clickeen/devstudio lint` — pass, with existing ESLintRC
  deprecation warning.
- `pnpm --filter @clickeen/devstudio typecheck` — pass.

Live verification system alignment recorded 2026-06-10:

- Normal DevStudio auth remains Berlin/Google. `E2E_AUTH_SECRET` is not normal
  product auth; it gates only the dev-only `/api/e2e/session` bootstrap used by
  the repo Playwright harness.
- Added the explicit DevStudio verification contract:
  `admin/wrangler.toml` and `scripts/cloudflare/api.mjs` now require both
  `DEVSTUDIO_GITHUB_TOKEN` and `E2E_AUTH_SECRET` as DevStudio Pages secrets.
- Added `e2e/devstudio/route-contract.spec.ts` for the Step 2 cloud contract:
  the authenticated shell, all 24 Appendix A routes, the policy read lane, and
  the deleted tool route fallback.
- `pnpm exec playwright test e2e/devstudio/route-contract.spec.ts --list` —
  pass, 27 checks listed.
- After the product owner added `E2E_AUTH_SECRET` in Cloudflare Pages,
  `pnpm cf:pages:devstudio-env` — pass: live DevStudio Pages env matches all
  non-secret vars and has both required Pages secrets,
  `DEVSTUDIO_GITHUB_TOKEN` and `E2E_AUTH_SECRET`.
- `pnpm cf:pages:sync-devstudio-env --apply` — blocked by Cloudflare
  `403 Authentication error`; the current `CLOUDFLARE_REST_API_TOKEN` can read
  Pages/DNS but cannot mutate the Pages project env.
- Cloudflare Pages deployment `6b67c566-80a2-4453-8441-6eb2bc709524` for
  `3238cfcd9d5ff31ab7a63aca6ef304cd640657e9` completed successfully after the
  secret change: queued, initialize, clone_repo, build, and deploy all `success`.
- `POST /api/e2e/session` with an intentionally invalid secret now returns
  `401` with `detail: "e2e_secret_invalid"`, proving the e2e route is live and
  sees an `E2E_AUTH_SECRET` value.
- Live Playwright run:
  `E2E_BASE_URL=https://devstudio.clickeen.com E2E_AUTH_STATE=e2e/.auth/devstudio.json E2E_REFRESH_AUTH=1 pnpm exec playwright test e2e/devstudio/route-contract.spec.ts --project=chromium --reporter=line`
  — blocked in global setup: `POST /api/e2e/session` returned `401` with
  `detail: "e2e_secret_invalid"`.
- Direct non-printing secret probes show the value in `e2e/.auth/e2e.env` is the
  Berlin e2e truth (`POST https://berlin-dev.clickeen.workers.dev/internal/e2e/session`
  returns `200` with token fields present), while the `.env.local` value is
  rejected by Berlin. DevStudio Pages currently accepts the `.env.local` value,
  then Berlin rejects it. No secret values were printed.

Live verification after E2E secret unification recorded 2026-06-10:

- Product owner unified `E2E_AUTH_SECRET` across root `.env.local`,
  `e2e/.auth/e2e.env`, and DevStudio Pages production runtime. Secret values were
  not printed or recorded.
- `pnpm cf:api:preflight` — pass: Cloudflare token/account, DevStudio Pages
  project/domain, and DNS are readable through the repo Cloudflare command.
- `pnpm cf:pages:devstudio-env` — pass: live DevStudio Pages env matches all
  non-secret vars and both required Pages secrets are present as `secret_text`.
  This command proves presence/type only, not secret values.
- Pushed Step 2 verification contract commit
  `ce2150ad0f5ba46e9aa77898c08fa40c5157d699`
  (`test(devstudio): add Cloudflare route contract`) to `main`.
- Cloudflare Pages deployment `1b3d431a-a32d-42c2-aeb0-847a620905bf` for
  `ce2150ad0f5ba46e9aa77898c08fa40c5157d699` completed successfully: queued,
  initialize, clone_repo, build, and deploy all `success`.
- Non-printing auth probes with the unified local secret:
  `POST https://devstudio.clickeen.com/api/e2e/session` — `200`, account id
  present; `POST https://berlin-dev.clickeen.workers.dev/internal/e2e/session`
  — `200`, account id and token fields present.
- Live Playwright route contract:
  `E2E_BASE_URL=https://devstudio.clickeen.com E2E_AUTH_STATE=e2e/.auth/devstudio.json E2E_REFRESH_AUTH=1 pnpm exec playwright test e2e/devstudio/route-contract.spec.ts --project=chromium --reporter=line`
  — pass, 27 checks.
- The route-contract run proves the authenticated shell, exactly three nav
  sections (Foundations `3`, Dieter Components `20`, Policy `1`), all 24
  Appendix A live routes, policy read GETs, and deleted tool-route fallback on
  `devstudio.clickeen.com`.
- Step 2 live blocker is closed. Step 3 remains next; screenshots and three
  entitlement-value spot-checks are separate Step 3 evidence.

## Step 3 — Showcase And Policy Read-Lane Verification

Status: green; Step 3 complete. Current PRD step: Step 4.

Evidence recorded 2026-06-10:

- Surviving authority: `PRD__DevStudio_Cloudflare_Migration.md` Step 3,
  Appendix A, and `packages/ck-policy` matrix files from `main`.
- `pnpm cf:api:preflight` — pass: Cloudflare token/account, DevStudio Pages
  project/domain, and DNS are readable through the repo Cloudflare command.
- `pnpm cf:pages:devstudio-env` — pass: live DevStudio Pages env matches
  `admin/wrangler.toml`; required Pages secrets `DEVSTUDIO_GITHUB_TOKEN` and
  `E2E_AUTH_SECRET` are present as `secret_text`. This command proves
  presence/type only, not secret values.
- Non-printing auth probe using the repo Playwright bootstrap contract:
  `POST https://devstudio.clickeen.com/api/e2e/session` — `200`, account id
  present; `POST https://berlin-dev.clickeen.workers.dev/internal/e2e/session`
  — `200`, account id and token fields present.
- Live Playwright route contract rerun:
  `E2E_BASE_URL=https://devstudio.clickeen.com E2E_AUTH_STATE=e2e/.auth/devstudio.json E2E_REFRESH_AUTH=1 pnpm exec playwright test e2e/devstudio/route-contract.spec.ts --project=chromium --reporter=line`
  — pass, 27 checks.
- Screenshot set saved outside the repo:
  `/tmp/clickeen-devstudio-step3/foundations-colors.png`,
  `/tmp/clickeen-devstudio-step3/dieter-button.png`,
  `/tmp/clickeen-devstudio-step3/policy-entitlements.png`.
- Live Policy Editor read endpoints:
  `GET /api/entitlements/matrix` — `200`, path
  `packages/ck-policy/entitlements.matrix.json`, sha present;
  `GET /api/ai-runtime/matrix` — `200`, path
  `packages/ck-policy/ai-runtime.matrix.json`, sha present.
- Entitlement spot-checks against
  `packages/ck-policy/entitlements.matrix.json`:
  `branding.remove` `tier1` expected `true`, API returned `true`, UI switch
  checked `true`; `instances.published.max` `tier2` expected `5`, API returned
  `5`, UI input value `5`; `views.monthly.max` `tier2` expected `null`, API
  returned `null`, UI input empty with `∞` placeholder.
- AI runtime read check against `packages/ck-policy/ai-runtime.matrix.json`:
  `cs.widget.copilot.v1` `tier2` `defaultModel` expected
  `{ provider: "openai", model: "gpt-5.2" }`, API matched, UI select value
  `openai::gpt-5.2`.
- Browser evidence reported `consoleErrors: []` and `pageErrors: []`.
- No write-path controls were clicked, typed into, or submitted. Step 4 remains
  the write-path gate.
