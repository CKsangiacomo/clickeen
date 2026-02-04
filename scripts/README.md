# scripts/ README

Purpose: quick reference for repo scripts (what they do + how to run).

## Core workflows
- `dev-up.sh` — canonical local startup (Supabase + Tokyo + Bob + DevStudio + Prague, etc.).
  - Run: `bash scripts/dev-up.sh` (or `bash scripts/dev-up.sh --full` for rebuild)
- `prague-sync.mjs` — Prague local alignment + l10n publish to R2.
  - Run (verify/translate only): `node scripts/prague-sync.mjs`
  - Run (background + log): `node scripts/prague-sync.mjs --background`
  - Run (publish to cloud-dev R2): `node scripts/prague-sync.mjs --publish --remote`
  - Run (publish to wrangler local R2): `node scripts/prague-sync.mjs --publish --local`
  - Behavior: runs `scripts/prague-l10n/verify.mjs` first and only runs `scripts/prague-l10n/translate.mjs` when verification fails (then re-verifies). Publishing to R2 happens only when `--publish` is passed.
  - Flags: `--publish` (requires `--remote` or `--local`), `--skip-translate`, `--skip-verify`, `--skip-publish` (compat).
  - Publish: uses Wrangler `r2 bulk put` (fast), falls back to per-file uploads if unavailable.
  - Env: `WRANGLER_BIN` (defaults to `tokyo-worker/node_modules/.bin/wrangler`), `TOKYO_R2_BUCKET`, `PRAGUE_SYNC_PUBLISH_BULK_CONCURRENCY`, `PRAGUE_SYNC_PUBLISH_BULK_TIMEOUT_MS`
  - Log: `Logs/prague-sync.log`

## Build / compile
- `build-dieter.js` — builds Dieter assets into `tokyo/dieter`.
  - Run: `node scripts/build-dieter.js`
- `compile-all-widgets.mjs` — compiles all widgets (sanity check).
  - Run: `node scripts/compile-all-widgets.mjs`
- `build-bob-cf.mjs` / `build-venice-cf.mjs` — Cloudflare builds for Bob/Venice.
  - Run: `node scripts/build-bob-cf.mjs`, `node scripts/build-venice-cf.mjs`
- `prague-build.mjs` — Prague build orchestration.
  - Run: `node scripts/prague-build.mjs`

## Localization / translations
- `i18n/build.mjs` + `i18n/validate.mjs` — build + validate i18n bundles.
  - Run: `node scripts/i18n/build.mjs && node scripts/i18n/validate.mjs`
- `l10n/build.mjs` + `l10n/validate.mjs` — build + validate l10n overlays.
  - Run: `node scripts/l10n/build.mjs && node scripts/l10n/validate.mjs`
- `l10n/translate-instances.mjs` — generate missing locale overlays for checked-in instances via local San Francisco translator.
  - Run: `node scripts/l10n/translate-instances.mjs`
- `prague-l10n/verify.mjs` / `prague-l10n/translate.mjs` — Prague overlay verify/translate.
  - Run: `node scripts/prague-l10n/verify.mjs` / `node scripts/prague-l10n/translate.mjs`

## Verification / QA
- `verify-contracts.mjs` — contract checks across widgets.
  - Run: `node scripts/verify-contracts.mjs`
- `verify-layer-pipeline.mjs` — validate layer pipeline contracts.
  - Run: `node scripts/verify-layer-pipeline.mjs`
- `eval-copilot.mjs` — Copilot golden evaluation.
  - Run: `node scripts/eval-copilot.mjs`
- `smoke-ai.mjs` — AI system smoke checks.
  - Run: `node scripts/smoke-ai.mjs`
- `validate-sdr-allowlists.mjs` — validate SDR allowlists.
  - Run: `node scripts/validate-sdr-allowlists.mjs`

## Assets / icons
- `process-svgs.js` / `verify-svgs.js` — preprocess + verify SVGs.
  - Run: `node scripts/process-svgs.js`, `node scripts/verify-svgs.js`
- `generate-icons-showcase.js` — icon showcase page.
  - Run: `node scripts/generate-icons-showcase.js`

---

If you add a new script, add it here with a one‑line description + example command.
