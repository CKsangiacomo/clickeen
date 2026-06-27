# 126J — PRD: Surfaces

Status: DIRECTIONAL — fill after the surfaces audit (`audits/126J__Audit__Surfaces.md`).
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA). Series order: `engineering/UI/` folder order; DevStudio UI + Roma UI last.
KB doc: `documentation/engineering/UI/surfaces.md` (canonical reference; this PRD drives it).

## Role
How the three surfaces consume Dieter — the comparative: Bob (the bar), DevStudio (reveal), Roma (convergence target). One doc, not per-screen.

## Precondition
Run the real surfaces audit first (six-step loop, MAMA §9). This PRD is filled from verified, `file:line`-cited findings — not assumptions.

## Scope (filled from the audit)
- Bob — full consumer, the standard (runtime CSS, `/dieter` proxy, compile, real components across panes).
- DevStudio — reveal/governance cockpit (renders components from CDN; generates foundation pages from token source).
- Roma — tokens adopted, components essentially absent; the parallel `.roma-*`/`.rd-*` system (the convergence target for 126M).

## Out of scope
- Redesign / new visual language (design freeze, MAMA §4).
- Other domains.
