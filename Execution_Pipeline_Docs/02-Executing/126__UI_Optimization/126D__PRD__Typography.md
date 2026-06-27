# 126D — PRD: Typography

Status: DIRECTIONAL — fill after the typography audit (`audits/126D__Audit__Typography.md`).
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA). Series order: dependency order (MAMA §7); DevStudio UI + Roma UI last.
KB doc: `documentation/engineering/UI/typography.md` (canonical reference; this PRD drives it).

## Role
Type — families, size scale, fluid display, line-heights, and the utility-class system. Owns the type mechanics; color semantics stay in 126B.

## Precondition
Run the real typography audit first (six-step loop, MAMA §9). This PRD is filled from verified, `file:line`-cited findings — not assumptions.

## Scope (filled from the audit)
- Font families (`--font-ui`, `--font-mono`); the `--fs-*` static scale + `--fs-body`/`--fs-ui`; fluid display (`--fs-fluid-display-1..3` via `clamp()`); line-heights (`--lh-*`).
- The utility-class system (`.body-*`/`.heading-*`/`.label-*`/`.caption*`/`.overline*`/`.display-*`).
- Gaps: no letter-spacing token; no breakpoint/container-width system.

## Out of scope
- Redesign / new visual language (design freeze, MAMA §4).
- Other domains.
