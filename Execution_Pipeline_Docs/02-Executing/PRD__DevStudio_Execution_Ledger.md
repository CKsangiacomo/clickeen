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
- The Pages production env/secret blocker is cleared.
- PRD Step 1 is still not green only because the live project serves the old
  static deployment. These repo changes must reach `main`, and the Git-connected
  Pages deployment must build from the new `admin` root with `admin/wrangler.toml`.

Verification limitation:

- The remaining deploy/runtime check must happen through the Git-connected Pages
  build after the DevStudio Pages project is rooted at `admin`, the required
  `DEVSTUDIO_GITHUB_TOKEN` Pages secret exists, and these repo changes reach
  `main`.
