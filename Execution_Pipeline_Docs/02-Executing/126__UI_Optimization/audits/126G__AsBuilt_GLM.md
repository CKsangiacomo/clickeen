# 126G — As-built audit: Ops (GLM, Phase-1 step 1)

> GLM independent pass. Codex writes its own; **not converged**. Verified via `ls` + `grep` across `scripts/`, `admin/scripts/`, `.github/workflows/`, `admin/src/`.

---

## 1. Build pipeline

**Main build:** `scripts/build-dieter.js` (root) — not in `dieter/scripts/` (which has only `build-icons.mjs`). The main build: optionally copies `svg_new/` overrides (dir doesn't exist — dead path), normalizes/verifies SVGs (writes back to source — mutates source files), deletes + recreates `tokyo/product/dieter/`, copies token CSS + generates shadow CSS, copies components/icons/statics, bundles per-component JS, writes `manifest.json` (gitSha, components, JS components, aliases, dependencies).

**Generators (admin/scripts/):** 5 scripts — `generate-foundation-pages.mjs` (colors/icons from token source), `generate-component-pages.ts` (component HTML from specs — throws on unresolved `{{...}}` and no-page components), `generate-typography-json.cjs` (type JSON from `dieter-typography.css`), `generate-static-registries.mjs`, `build-static.mjs`.

## 2. CI/deploy

**8 workflows** in `.github/workflows/`:
- `cloud-dev-workers.yml` — deploys workers + runs `build:dieter` + R2 sync on `main` changes to `dieter/**` / `tokyo/product/**` / scripts.
- `devstudio-verify.yml` — PR-only verification (NOT in the main push lane).
- Others: `cloud-dev-prague-app/content.yml`, `cloud-dev-roma-app.yml`, `cloud-dev-runtime-verify.yml`, `pr-architecture-gates.yml`, `supabase-migrations.yml`.

**Gap:** DevStudio token edits commit directly to `main` (via GitHub Contents API) → trigger `cloud-dev-workers.yml` → rebuild + R2 sync. But `devstudio-verify.yml` (PR-only) is NOT in that lane — token edits skip PR verification.

## 3. R2 sync

`scripts/tokyo-r2-deploy-sync.mjs` — uploads local files to R2. Maps `tokyo/product/dieter` → remote `dieter`. Refuses `accounts/**`, `l10n/**`, `public/**`, stale roots. **Upload-only:** does NOT list remote keys, does NOT compare local→remote, does NOT delete remote orphans, does NOT prove rollback.

## 4. Governance guards

`scripts/dieter/governance-guards.mjs` — checks: generated Admin/DevStudio HTML headers, foundation counts, icon count consistency, component page coverage, unresolved stencil markers, undefined token references in generated Admin HTML. **Does NOT** cover downstream Bob/Roma/public-widget runtime consumers. **Does NOT** enforce design-freeze hash evidence.

## 5. Token editor (DevStudio)

Editable: color tokens (`--color-*` + hex) and typography tokens (`--fs-*`/`--lh-*` + numeric/clamp). Validation: regex/value-shape only (not semantic). Writes via GitHub Contents API (branch + message + SHA). Commit message: `dieter(devstudio): ${token} ${value}`. **No actor attribution** (no human name, no reason, no approval note). SHA conflict → 409. `admin/src/main.ts` handles the client-side binding (`[data-token-edit]`).

## 6. Honest gaps (confirmed by GLM)
- Token-edit commits lack actor attribution — governance gap.
- Token validation is regex-only (no WCAG/contrast check, no semantic validation).
- R2 sync is fire-and-forget (no remote reconciliation/orphan cleanup).
- `devstudio-verify.yml` is PR-only → token direct-commits to main skip it.
- Governance guards cover generated Admin HTML, not runtime consumers.
- SVG normalization mutates source files (writes back to `dieter/icons/svg/`).
- `manifest.json` `gitSha` can fall back to `unknown`.
- Manifest dependency validation is warning-only (doesn't fail build).

— end GLM as-built, 126G.
