# scripts/ README

Purpose: quick reference for repo scripts (what they do + how to run).

## Core workflows
- `dev-up.sh` — canonical local startup (Supabase + Tokyo + Paris + SF + Bob + DevStudio + Pitch + Prague).
  - Run: `bash scripts/dev-up.sh`
  - Flags:
    - `--full` (or `--rebuild-all`): run full workspace build before startup.
    - `--prague-l10n` (or `--l10n`): verify Prague overlays and run background regeneration when out of date.
    - `--reset`: force a clean restart of the stack managed by `dev-up`.
  - Behavior:
    - Maintains stack state in `.dev-up.state/` (active marker + PID registry).
    - If an active stack is detected, `dev-up` exits instead of restarting it.
    - Use `--reset` to intentionally tear down stale/orphaned managed processes and relaunch.
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
- `refresh-prague.mjs` — single command for Prague copy refresh (async by default).
  - Run (async default): `node scripts/refresh-prague.mjs`
  - Run (blocking): `node scripts/refresh-prague.mjs --wait`
  - Run + publish local R2: `node scripts/refresh-prague.mjs --publish-local`
  - Run + publish remote R2: `node scripts/refresh-prague.mjs --publish-remote`
  - Behavior: wraps `prague-sync` with strict-latest verification and changed-only translation regeneration.
  - Log (async): `Logs/prague-sync.log`

## Build / compile
- `build-dieter.js` — builds Dieter assets into `tokyo/dieter`.
  - Run: `node scripts/build-dieter.js`
- `compile-all-widgets.mjs` — compiles all widgets (sanity check).
  - Run: `node scripts/compile-all-widgets.mjs`
- `build-bob-cf.mjs` / `build-venice-cf.mjs` — Cloudflare builds for Bob/Venice.
  - Run: `node scripts/build-bob-cf.mjs`, `node scripts/build-venice-cf.mjs`

## Localization / translations
- `i18n/extract-keys.mjs` — extracts referenced i18n keys.
  - Run: `node scripts/i18n/extract-keys.mjs`
- `i18n/build.mjs` + `i18n/validate.mjs` — build + validate i18n bundles.
  - Run: `node scripts/i18n/build.mjs && node scripts/i18n/validate.mjs`
- `l10n/build.mjs` + `l10n/validate.mjs` — build + validate l10n overlays.
  - Run: `node scripts/l10n/build.mjs && node scripts/l10n/validate.mjs`
- `l10n/convergence-gate.mjs` — validates l10n terminal-state convergence.
  - Run: `node scripts/l10n/convergence-gate.mjs`
- `l10n/pull.mjs` / `l10n/push.mjs` — pull/push curated overlays from/to Supabase.
  - Run: `node scripts/l10n/pull.mjs`, `node scripts/l10n/push.mjs`
- `l10n/translate-instances.mjs` — generate missing locale overlays for checked-in instances via local San Francisco translator.
  - Run: `node scripts/l10n/translate-instances.mjs`
- `prague-l10n/verify.mjs` / `prague-l10n/translate.mjs` — Prague overlay verify/translate.
  - Run: `node scripts/prague-l10n/verify.mjs`, `node scripts/prague-l10n/translate.mjs`
  - Env: `PRAGUE_L10N_TRANSLATE_CONCURRENCY` (default `4`, locale-level parallelism)
- `prague-l10n/status.mjs` / `prague-l10n/watch.mjs` — status view and local watch loop.
  - Run: `node scripts/prague-l10n/status.mjs`, `node scripts/prague-l10n/watch.mjs`
- `prague-blocks/validate.mjs` / `prague-blocks/diff.mjs` — validate/diff Prague page blocks.
  - Run: `node scripts/prague-blocks/validate.mjs`, `node scripts/prague-blocks/diff.mjs`

## Infra
- `infra/ensure-queues.mjs` — ensures Cloudflare queues exist.
  - Run: `node scripts/infra/ensure-queues.mjs --queue <queue-name>`
- `infra/backfill-curated-instances.mjs` — backfill curated instances table from `widget_instances`.
  - Run: `DRY_RUN=1 node scripts/infra/backfill-curated-instances.mjs`

## Verification / QA
- `verify-contracts.mjs` — contract checks across widgets.
  - Run: `node scripts/verify-contracts.mjs`
- `verify-layer-pipeline.mjs` — validate layer pipeline contracts.
  - Run: `node scripts/verify-layer-pipeline.mjs`
- `eval-copilot.mjs` — Copilot golden evaluation.
  - Run: `node scripts/eval-copilot.mjs`
  - Optional flags:
    - `--agent-id=<agent-id>` (e.g. `widget.copilot.v1`)
    - `--subject=<subject>` (e.g. `devstudio`)
    - `--prompts=<path-to-jsonl>`
- `smoke-ai.mjs` — AI system smoke checks.
  - Run: `node scripts/smoke-ai.mjs`
- `smoke-prague-copy.mjs` — verifies Prague FAQ routes render the current source copy (overview/templates/examples/features).
  - Run: `node scripts/smoke-prague-copy.mjs`
  - Optional flags: `--base-url`, `--market`, `--locale`
- `validate-sdr-allowlists.mjs` — validate SDR allowlists.
  - Run: `node scripts/validate-sdr-allowlists.mjs`

## Assets / icons
- `process-svgs.js` / `verify-svgs.js` — preprocess + verify SVGs.
  - Run: `node scripts/process-svgs.js`, `node scripts/verify-svgs.js`
- `generate-icons-showcase.js` — icon showcase page.
  - Run: `node scripts/generate-icons-showcase.js`

---

If you add a new script, add it here with a one‑line description + example command.
