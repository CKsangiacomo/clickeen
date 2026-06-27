# UI ops — how Dieter is built, served, and governed

**Living, canonical reference — the UI runbook.**
Seeded 2026-06-27 from the as-built pipeline; improved in place as UI program 126 executes. This doc owns "how the system runs"; [`dieter.md`](dieter.md) owns "what the system is."

- Authority: [`126__PRD__UI_Optimization_Program.md` §12](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126__PRD__UI_Optimization_Program.md).
- **Sources:** `dieter/scripts/*`, `admin/scripts/*`, `.github/workflows/*`, `Execution_Pipeline_Docs/03-Executed/PRD__DevStudio_Cloudflare_Migration.md` (§3.5 write path, §3.6 design freeze, Appendix A hash baseline).

## Build

- `dieter/scripts/build-dieter.js` bundles tokens + components + icons into
  `tokyo/product/dieter/**`.
- Generators (in `admin/scripts/`): `generate-foundation-pages.mjs` (colors/icons/
  typography from token source), `generate-component-pages.ts` (**guarded**: throws
  on unresolved `{{...}}` stencils and on a component that renders no page),
  `generate-typography-json.cjs`, `generate-static-registries.mjs`.
- `build-icons.mjs` (svgo → `dist/icons/` + `icons.js`/`.d.ts` registry) — see
  [`iconography.md`](iconography.md).

## Serve

- Deployed to **Tokyo R2** at `dieter/**`; surfaces load it from `/dieter`
  (Bob via CDN, Bob/Roma via the `/dieter` edge proxy).
- Deploy chain is real: a `tokyo/product/dieter/**` change triggers `build:dieter`
  + `tokyo-r2-deploy-sync` (`.github/workflows/cloud-dev-workers.yml`).

## Govern (DevStudio reveal/steer loop)

- DevStudio is the cockpit: it **reveals** Dieter (generated, guarded pages) and
  **steers** through a values-only token editor on the ratified commit lane
  (Migration §3.5: Berlin-session → validate → commit → propagate). Adding /
  removing / renaming tokens stays code work; the UI edits values only.
- Trust = the human looks at derived truth and judges; guards are a backstop, not
  the trust layer.

## Design freeze + hash baseline

- Migration §3.6 freezes the showcase layouts; Appendix A holds the hash-frozen
  visual baseline. Generation changes *where content comes from*, never *how it
  looks* — a frozen page that drifts is a regression, not an improvement.

## Honest gaps (audit Phase 3 "Ops" findings — to verify/fix during 126C)

- Governance commits have **no actor attribution** and go **straight to `main`**,
  skipping the governance/lint gates that run on PRs only.
- Color validation is **regex-only**.
- R2 sync is **fire-and-forget** (no rollback, no orphan cleanup).
- `build-dieter` **silently overwrites committed source SVGs**.
- No visible CI drift-detection on the generated committed HTML (a hand-edit could
  slip through).

126C's job is to close these without inventing new machinery — make the existing
loop attributable, gated, and drift-detected.
