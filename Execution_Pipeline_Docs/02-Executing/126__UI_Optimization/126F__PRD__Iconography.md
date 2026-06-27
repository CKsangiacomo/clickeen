# 126F — PRD: Iconography

Status: DIRECTIONAL — fill after the iconography audit (`audits/126F__Audit__Iconography.md`).
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA). Series order: `engineering/UI/` folder order; DevStudio UI + Roma UI last.
KB doc: `documentation/engineering/UI/iconography.md` (canonical reference; this PRD drives it).

## Role
The 157-icon set — the SVG source, the manifest, the build pipeline, the `diet-icon` wrapper, and the naming/sizing/color conventions.

## Precondition
Run the real iconography audit first (six-step loop, MAMA §9). This PRD is filled from verified, `file:line`-cited findings — not assumptions.

## Scope (filled from the audit)
- The 157 SVGs (`dieter/icons/svg/`), the `icons.json` manifest, the `build-icons.mjs` pipeline, the generated registry (`icons.js`/`.d.ts`).
- The `diet-icon` wrapper; sizing via `--icon-size-*`; color via `currentColor` (verify per component).
- The inactive `icons/svg_new/` override path (do not treat as live).

## Out of scope
- Redesign / new visual language (design freeze, MAMA §4).
- Other domains.
