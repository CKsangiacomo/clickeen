# 126H — PRD: Dieter

Status: DIRECTIONAL — fill after the dieter audit (`audits/126H__Audit__Dieter.md`).
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA). Series order: dependency order (MAMA §7); DevStudio UI + Roma UI last.
KB doc: `documentation/engineering/UI/dieter.md` (canonical reference; this PRD drives it).

## Role
The design system itself — the matrioska law (tokens → components → screens, by reference) and the foundation substrate that color/typography/motion don't cover: spacing, vertical rhythm, control sizing/gaps, radii/shape, icon sizing, elevation, focus/ergonomics. The integrative system doc and the immediate precursor to 126I components.

## Precondition
Run the real dieter audit first (six-step loop, MAMA §9). This PRD is filled from verified, `file:line`-cited findings — not assumptions.

## Scope (filled from the audit)
- Foundation substrate tokens: `--space-*`, `--vertspace-*`, `--control-size-*`, `--control-inline-gap-*`, `--control-radius-*` (+ the `--radius-3/4` aliases), `--icon-size-*`, `--shadow-*` elevation, focus/ergonomics.
- The composition model and the build (`dieter/scripts/*`); how every doll references inward.
- Verified drift: undefined-token refs at consumers (`--color-surface`, `--color-bg`, `--radius-2`, `--hspace-*`); `--radius-3/4` are **intentional aliases** (not a fix — the ghost-token lesson).

## Out of scope
- Redesign / new visual language (design freeze, MAMA §4).
- Color (126B), typography (126D), motion (126F) — separate PRDs.
- Components (126I), screens (126L/126M).
