# 126H — PRD: Motion

Status: DIRECTIONAL — fill after the motion audit (`audits/126H__Audit__Motion.md`).
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA). Series order: `engineering/UI/` folder order; DevStudio UI + Roma UI last.
KB doc: `documentation/engineering/UI/motion.md` (canonical reference; this PRD drives it).

## Role
Motion — durations, easing, and reduced-motion. The thinnest token layer today; this is where it gets deliberately completed.

## Precondition
Run the real motion audit first (six-step loop, MAMA §9). This PRD is filled from verified, `file:line`-cited findings — not assumptions.

## Scope (filled from the audit)
- The duration tokens (`--duration-snap/base/spin`); whether a duration scale is needed.
- The easing gap — no `--easing-*` token is defined (only referenced as a fallback). Completing the easing scale is a candidate deliverable.
- `prefers-reduced-motion` coverage across components.

## Out of scope
- Redesign / new visual language (design freeze, MAMA §4).
- Other domains.
