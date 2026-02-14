# PRD 39 — Scripts AUDIT Cleanup (CI Safety + Idempotency) v0.1

**Status:** EXECUTED  
**Date:** 2026-02-02  
**Executed:** 2026-02-03  
**Owner:** Product Dev Team (Tooling/Infra)  
**Goal:** make CI-critical scripts safe to re-run (idempotent), non-interactive, and explicit about which environment they write to.

---

# Scripts AUDIT cleanup

Scope: `scripts/` inventory. For each script: what it does, whether it is used by the system or ad‑hoc, which service(s) it touches, and CI/CD impact.

Legend:
- **Used** = referenced by `package.json`, `scripts/dev-up.sh`, or another script.
- **Ad‑hoc** = manual run only (no wiring found).
- **CI-Critical** = called by GitHub Actions workflows; failures block deployments.
- **CI-Safe** = idempotent and safe for automated execution.

## CI/CD Impact Summary

**Scripts moving to CI-critical path** (after CI/CD Automation Uplevel execution):
- `scripts/prague-l10n/translate.mjs` → content release workflow
- `scripts/prague-l10n/verify.mjs` → content release workflow
- `scripts/prague-sync.mjs` → content release workflow (R2 publish gate)
- `scripts/prague-blocks/validate.mjs` → both Prague workflows (pre-deploy gate)
- `scripts/infra/ensure-queues.mjs` → workers workflow

**Scripts with CI conflicts/warnings:**
- `scripts/[retired]/prague-l10n-watch` → do NOT run during CI deploys (race condition on overlay files)

**Known gaps exposed by CI/CD:**
- **Safety gate:** `scripts/infra/ensure-queues.mjs` requires explicit `--write` to create queues; deploy scripts pass `--write` so CI can safely re-run.
- **Publish gate correctness:** `scripts/prague-sync.mjs` must require explicit `--publish` and an explicit target (`--remote`/`--local`) so local runs can’t accidentally write to R2.
- **Scale risk (later):** `scripts/prague-sync.mjs` uploads one object per Wrangler call; OK today, but will need bulk/concurrency once overlay count grows by 10×.

**Idempotency requirements** (CI must be able to re-run safely):
- `scripts/prague-sync.mjs` → must produce same result on re-run
- `scripts/infra/ensure-queues.mjs` → must not error if queues already exist

## 0) Execution Plan (v0.1)
1. **Keep `ensure-queues` gated**: require `--write` and keep deploy scripts passing it.
2. **Verify CI-critical scripts are non-interactive**: required env vars only; no prompts.
3. **Verify CI-critical scripts fail visibly**: non-zero exit codes + actionable stderr.
4. **Document environment targeting**: every remote-writing script prints whether it’s writing to local vs cloud-dev and which bucket/project it targets.

---

## 00 - scripts/dev-up.sh
- **What it does:** Brings up the local dev stack (Supabase + Tokyo dev CDN + Paris/San Francisco workers + Bob/DevStudio/Prague/Venice). Optionally runs full rebuild.
- **Used or not:** **Used** (canonical local startup; referenced in repo docs, run manually).
- **Services touched:** Supabase CLI, Wrangler/workerd, local Next/Astro dev servers (Bob, Admin, Prague, Venice), Tokyo dev server.

## 01 - scripts/build-dieter.js
- **What it does:** Builds Dieter assets into `tokyo/dieter` (tokens, icons, component CSS/JS), runs SVG normalize/verify.
- **Used or not:** **Used** (`pnpm build:dieter`, `scripts/dev-up.sh`).
- **Services touched:** Local filesystem; uses `esbuild` and node.

## 02 - scripts/process-svgs.js
- **What it does:** Normalizes Dieter SVG fills to `currentColor`; checks icon count vs manifest.
- **Used or not:** **Used** (called by `scripts/build-dieter.js`).
- **Services touched:** Local filesystem (`dieter/icons/svg`, `dieter/icons/icons.json`).

## 03 - scripts/verify-svgs.js
- **What it does:** Validates SVG fills are `currentColor`, warns on strokes, checks manifest count.
- **Used or not:** **Used** (called by `scripts/build-dieter.js`).
- **Services touched:** Local filesystem (`dieter/icons/svg`, `dieter/icons/icons.json`).

## 04 - scripts/generate-icons-showcase.js
- **What it does:** Generates icon showcase HTML for Dieter Admin.
- **Used or not:** **Ad‑hoc** (no wiring found).
- **Services touched:** Local filesystem (`dieter/dieteradmin`).

## 05 - scripts/compile-all-widgets.mjs
- **What it does:** Calls Bob compiled widget API for every widget in `tokyo/widgets/*/spec.json` and validates output shape.
- **Used or not:** **Used** via `pnpm compile:widgets` (manual/CI).
- **Services touched:** Bob API (`/api/widgets/:type/compiled`).

## 06 - scripts/i18n/extract-keys.mjs
- **What it does:** Scans repo for i18n keys in code/markup; outputs key list.
- **Used or not:** **Used** (invoked by `scripts/i18n/validate.mjs`).
- **Services touched:** Local filesystem.

## 07 - scripts/i18n/build.mjs
- **What it does:** Builds hashed i18n bundles + manifest into `tokyo/i18n`.
- **Used or not:** **Used** (`pnpm build:i18n`, `scripts/dev-up.sh`).
- **Services touched:** Local filesystem; git (for commit SHA).

## 08 - scripts/i18n/validate.mjs
- **What it does:** Validates all referenced i18n keys exist for each locale.
- **Used or not:** **Used** (`pnpm build:i18n`, `scripts/dev-up.sh`).
- **Services touched:** Local filesystem.

## 09 - scripts/l10n/build.mjs
- **What it does:** Builds layered l10n overlays from `l10n/` and allowlists into `tokyo/l10n/instances`.
- **Used or not:** **Used** (`pnpm build:l10n`).
- **Services touched:** Local filesystem.

## 10 - scripts/l10n/validate.mjs
- **What it does:** Validates l10n overlay + index schemas under `tokyo/l10n`.
- **Used or not:** **Used** (`pnpm build:l10n`).
- **Services touched:** Local filesystem.

## 11 - scripts/[retired]/l10n-pull
- **What it does:** Pulls curated overlays from Supabase into `l10n/instances`.
- **Used or not:** **Ad‑hoc** (manual maintenance).
- **Services touched:** Supabase REST (`widget_instance_overlays`).

## 12 - scripts/[retired]/l10n-push
- **What it does:** Pushes local l10n overlays to Supabase with allowlist checks.
- **Used or not:** **Ad‑hoc** (manual maintenance).
- **Services touched:** Supabase REST (writes overlays).

## 13 - scripts/[retired]/l10n-translate-instances
- **What it does:** Generates missing locale overlays for checked-in curated instances under `l10n/instances/**/locale/*.ops.json` by calling the local/dev San Francisco translate endpoint.
- **Used or not:** **Ad‑hoc** (manual maintenance / locale expansion helper).
- **Services touched:** San Francisco translate endpoint (local/dev), local filesystem (`l10n/instances`).
- **Safety:** Does not write to Supabase; pushing overlays remains an explicit separate action (`scripts/[retired]/l10n-push`).

## 14 - scripts/prague-l10n/lib.mjs
- **What it does:** Shared helper library for Prague l10n translation/verify/migrate.
- **Used or not:** **Used** (imported by Prague l10n scripts).
- **Services touched:** Local only.

## 15 - scripts/prague-l10n/translate.mjs
- **What it does:** Generates Prague overlay ops from Tokyo widget pages + chrome base via allowlists.
- **Used or not:** **Used** (`pnpm prague:l10n:translate`, `scripts/dev-up.sh`). **CI-Critical** (content release workflow).
- **Services touched:** San Francisco translation API (requires `PARIS_DEV_JWT`), local filesystem (`tokyo/l10n/prague`).
- **CI requirements:** Must work non-interactively; requires `SANFRANCISCO_BASE_URL` and `PARIS_DEV_JWT` env vars.
- **Known gap (historical):** Chrome overlay regeneration must validate allowlist completeness (not just file existence). This repo now checks expected paths for chrome too; keep this property true as the script evolves.
- **Idempotency:** Already idempotent (fingerprint-based caching with completeness validation for pages).

## 16 - scripts/prague-l10n/verify.mjs
- **What it does:** Validates Prague overlay ops against allowlists; ensures all required overlays exist for current base fingerprints.
- **Used or not:** **Used** (`pnpm prague:l10n:verify`, `scripts/dev-up.sh`). **CI-Critical** (content release workflow gate).
- **Services touched:** Local filesystem (reads overlays from `tokyo/l10n/prague`).
- **CI requirements:** Must exit non-zero on validation failure to block deployment.
- **Idempotency:** Read-only; safe for repeated execution.

## 17 - scripts/[retired]/prague-l10n-watch
- **What it does:** Watches base/allowlist/overlay files and reruns translate/verify.
- **Used or not:** **Ad‑hoc** (manual dev convenience). **NOT for CI.**
- **Services touched:** San Francisco translation API (optional), local filesystem.
- **⚠️ CI conflict:** Do NOT run this script while CI content release workflow is active. Both would write to `tokyo/l10n/prague` simultaneously, causing race conditions and inconsistent overlay state. Use for local dev only.

## 18 - scripts/prague-l10n/migrate.mjs
- **What it does:** One‑time migration from legacy `prague-strings` → new Prague content/allowlists/overlays layout.
- **Used or not:** **Ad‑hoc** (migration only).
- **Services touched:** Local filesystem.

## 19 - scripts/prague-sync.mjs
- **What it does:** Runs Prague l10n translate/verify; optionally (with `--publish`) uploads `tokyo/l10n/prague` to R2 (`--remote` for cloud-dev).
- **Used or not:** **Used** (`pnpm prague:sync`). **CI-Critical** (content release workflow R2 publish gate).
- **Services touched:** San Francisco translation API (if translate runs), Cloudflare R2 via Wrangler (writes overlays to `tokyo-assets-dev` bucket).
- **CI requirements:** Must work non-interactively with `--publish --remote` flags; requires `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `TOKYO_R2_BUCKET` env vars.
- **Idempotency:** Must be idempotent (re-uploading same overlay files produces same R2 state). Verify Wrangler R2 upload behavior is idempotent.
- **Safety:** Writes to remote R2; requires explicit `--publish` flag (good). CI uses this flag. 

## 20 - scripts/prague-build.mjs
- **What it does:** Lists Prague widget markdown routes and URL mapping (informational).
- **Used or not:** **Ad‑hoc** (no wiring).
- **Services touched:** Local filesystem.

## 21 - scripts/[retired]/prague-blocks-diff
- **What it does:** Diffs `pages/*.json` between two roots (migration QA).
- **Used or not:** **Retired** in scripts cleanup pass.
- **Services touched:** Local filesystem.

## 22 - scripts/prague-blocks/validate.mjs
- **What it does:** Validates `split` block layout values in Prague pages JSON (schema/structure checks).
- **Used or not:** **Used** via `pnpm prague:blocks:validate`. **CI-Critical** (pre-deploy gate for both app and content release workflows).
- **Services touched:** Local filesystem (reads `tokyo/widgets/*/pages/*.json`).
- **CI requirements:** Must exit non-zero on validation failure to block deployment with malformed blocks.
- **Idempotency:** Read-only; safe for repeated execution.

## 23 - scripts/[retired]/validate-sdr-allowlists
- **What it does:** Validates SDR allowlist paths exist + are string values in widget defaults.
- **Used or not:** **Ad‑hoc/CI** (manual run; not in `dev-up.sh`).
- **Services touched:** Local filesystem.

## 24 - scripts/eval-copilot.mjs
- **What it does:** Runs Copilot evals against Bob API using fixtures; validates intent/outcome.
- **Used or not:** **Ad‑hoc/CI** (`pnpm eval:copilot`).
- **Services touched:** Bob API (`/api/ai/sdr-copilot`).

## 25 - scripts/smoke-ai.mjs
- **What it does:** Smoke test for Paris → San Francisco AI grant/execute; optional Bob SDR upstream.
- **Used or not:** **Ad‑hoc/CI** (`pnpm smoke:ai`).
- **Services touched:** Paris API, San Francisco API, optional Bob API.

## 26 - scripts/verify-contracts.mjs
- **What it does:** Verifies contract invariants across configs and code (schemas, tokens, paths).
- **Used or not:** **Used** (`pnpm test:contracts`).
- **Services touched:** Local filesystem.

## 27 - scripts/verify-layer-pipeline.mjs
- **What it does:** End‑to‑end l10n pipeline test (Paris instance → Tokyo overlay → Venice render). Skips unless env flag set.
- **Used or not:** **Used** (`pnpm test:layer-pipeline`, gated by env).
- **Services touched:** Paris API, Tokyo CDN, Venice render; local overlays; optional Prague l10n verify.

## 28 - scripts/build-bob-cf.mjs
- **What it does:** Produces Cloudflare Pages build output for Bob via Vercel build + next‑on‑pages.
- **Used or not:** **Ad‑hoc/CI** (Cloudflare build pipeline).
- **Services touched:** Local build toolchain (Vercel + next‑on‑pages).

## 29 - scripts/build-venice-cf.mjs
- **What it does:** Produces Cloudflare Pages build output for Venice via Vercel build + next‑on‑pages.
- **Used or not:** **Ad‑hoc/CI** (Cloudflare build pipeline).
- **Services touched:** Local build toolchain (Vercel + next‑on‑pages).

## 31 - scripts/infra/ensure-queues.mjs
- **What it does:** Ensures Cloudflare Queues exist by creating missing queues.
- **Used or not:** **Used** (wired into Paris/SanFrancisco/Tokyo-worker deploy scripts). **CI-Critical** (workers workflow prerequisite).
- **Services touched:** Cloudflare Queues via Wrangler (creates resources if missing).
- **CI requirements:** Must work non-interactively; requires `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` env vars.
- **Idempotency:** Must not error if queues already exist (critical for CI re-runs). Script treats “already exists” responses as success.
- **Safety:** Creates Cloudflare resources. Consider adding an explicit `--write` gate (and updating deploy scripts) if we want to prevent accidental local creation.

## 32 - scripts/[retired]/README
- **What it does:** Human documentation for scripts.
- **Used or not:** **Ad‑hoc** (manual reference).
- **Services touched:** None.

---

## Gaps / cleanup notes

**General:**
- Remote-writing scripts should require explicit opt-in and print their target (Supabase/R2/Cloudflare) before writing.

**CI-specific gaps (must fix before/during CI/CD execution):**
1. **Chrome allowlist completeness** (`translate.mjs`): keep completeness checking in place for chrome + page overlays (no “file exists” shortcuts). Treat allowlist drift as a hard failure.
2. **Idempotency verification**: Confirm `prague-sync.mjs` R2 uploads and `ensure-queues.mjs` queue creation are truly idempotent for safe CI re-runs.
3. **Exit codes**: Verify `validate.mjs` and `verify.mjs` exit non-zero on failures (CI relies on exit codes for failure detection).
4. **Non-interactive operation**: All CI-critical scripts must work without terminal prompts (Wrangler auth via env vars, not interactive login).

**Script lifecycle after CI/CD execution:**
- Update "Used" status for scripts now called by workflows
- Add workflow references (which `.github/workflows/*.yml` files call which scripts)
- Document required CI environment variables per script
- Add "rollback considerations" for scripts that publish to remote (R2, Cloudflare)

**Scripts that may be candidates for removal:**
- `scripts/prague-l10n/migrate.mjs` (#17): If migration complete, can be archived
- `scripts/prague-build.mjs` (#19): Currently informational; evaluate if route validation should be CI gate
