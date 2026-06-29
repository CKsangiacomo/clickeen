# UI Ops - How Dieter Is Built, Served, And Steered

**Living, canonical reference — the UI runbook.**
Seeded 2026-06-27 from the as-built pipeline; improved in place as UI program 126 executes. This doc owns "how the system runs"; [`dieter.md`](dieter.md) owns "what the system is."

- Authority: [`126__PRD__UI_Optimization_Program.md` §12](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126__PRD__UI_Optimization_Program.md).
- **Sources:** `scripts/build-dieter.js`, `scripts/verify-svgs.js`,
  `admin/scripts/*`, `.github/workflows/*`,
  `documentation/engineering/CloudflareOperations.md`, and
  `Execution_Pipeline_Docs/03-Executed/PRD__DevStudio_Cloudflare_Migration.md`
  (section 3.5 write path, section 3.6 design freeze, Appendix A hash baseline).

## Authority Lanes

- **Source:** `dieter/**`, build scripts, generator scripts, and approved UI
  source in git.
- **Generated repo artifacts:** `tokyo/product/dieter/**` and generated
  DevStudio/Admin artifacts written by generators. They are regenerated from
  source and are not hand-edited as source truth.
- **Deployed runtime:** Cloudflare Pages, Workers, and R2 product roots such as
  `dieter/**`, `product/widgets/**`, `product/roma/**`, and `prague/**`.
- **Product data:** account/runtime data under
  `accounts/{accountPublicId}/...` and product routes/workers. Dieter build
  and UI ops do not mutate it.

## Build

- `scripts/build-dieter.js` bundles tokens, components, component JS, and icons
  into `tokyo/product/dieter/**`.
- Icon propagation verifies `dieter/icons/icons.json` and `dieter/icons/svg/*`
  parity/currentColor, then copies them to Tokyo output. The build does not
  mutate committed icon source.
- The Dieter manifest records traceable provenance. Missing git provenance or
  unresolved component dependencies fail the build.
- Generators (in `admin/scripts/`): `generate-foundation-pages.mjs` (colors/icons/
  typography from token source), `generate-component-pages.ts` (**guarded**: throws
  on unresolved `{{...}}` stencils and on a component that renders no page),
  `generate-typography-json.cjs`, `generate-static-registries.mjs`.

## Serve

- Deployed to **Tokyo R2** at `dieter/**`; surfaces load it from `/dieter`
  (Bob via CDN, Bob/Roma via the `/dieter` edge proxy).
- Deploy chain is real: Dieter source/build-script changes trigger
  `build:dieter` plus `tokyo-r2-deploy-sync`
  (`.github/workflows/cloud-dev-workers.yml`). Generated Tokyo product-root
  changes run upload-only sync; they do not by themselves run `build:dieter`.
- Tokyo/R2 sync uploads current git-authored product roots. It is not remote
  reconciliation, orphan cleanup, rollback, or product-data mutation.

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

## Current Boundaries

- Governance guards cover generated Admin/DevStudio artifacts. They do not prove
  Bob, Roma, Prague, widget runtime, or account-runtime behavior.
- DevStudio token edits are a product workflow owned by 126L. 126G documents the
  lane; it does not add approval workflow, semantic token validation, contrast
  enforcement, or PR bureaucracy.
- Color, typography, icon, motion, component, layout, and surface semantics are
  owned by their UI PRD slices and living docs. Ops records how artifacts move.
- Icon origination remains human-owned local authoring through the icon tooling
  documented in `iconography.md`. Agents consume approved Dieter icons; they do
  not originate new ones.

126G owns these without inventing new machinery: simplify current UI ops, remove
obsolete deploy paths, keep icon authoring as the only local authoring
exception, and document the current build/serve/govern loop honestly.
