# PRD 126 — MAMA — UI Optimization Program

**Status:** PLANNING
**Date:** June 25, 2026
**Supersedes:** `UI_PRD__Devstudio_as_a_trustworthy_Reveal_cockpit_DieterComponents.md` (was bloated and wrong — see `DevStudio_Dieter_Sanity_Pass_Findings_June2026.md`).

## Goal, plainly
Get Clickeen's UI onto one healthy design system: **audit and fix Dieter** (tokens + components), **prove it in DevStudio**, then **make Roma use it**.

## Why
Dieter's tokens are healthy, but the system around them isn't: Roma built its own styling instead of using Dieter (762-line `roma.css`, zero Dieter form components); some Dieter components have hardcoded values or messy code; DevStudio's showcase is mostly built but has gaps; and the old DevStudio PRD was wrong (invented a broken token, missed real consumers). We need to actually audit Dieter end-to-end before anything else.

## The rule (order matters)
1. **Design system first** — audit + fix Dieter tokens and components.
2. **Showcase second** — DevStudio shows the fixed Dieter truthfully.
3. **Consumers last** — Roma consumes the healthy Dieter.
DevStudio only displays whatever Dieter actually is, so Dieter must be fixed first. **No redesign** — Dieter is the design; we're cleaning it up and wiring it in.

## Sub-PRDs
| Sub | Scope | Focus / components | Depends on |
|---|---|---|---|
| 126A | Token audit (core) | all token files — completeness, consistency, layering | — |
| 126B | Components: atoms | button, icon | 126A |
| 126C | Components: inputs | textfield, valuefield, textedit, textrename (dead), toggle, slider | 126A |
| 126D | Components: choosers | segmented, choice-tiles | 126A |
| 126E | Components: dropdowns | dropdown-actions, -border, -edit, -fill, -shadow, -upload | 126A |
| 126F | Components: composites | repeater, object-manager, bulk-edit, popover, tabs, popaddlink, menuactions | 126A |
| 126G | Components: activity displays | agent-activity, command-activity | 126A |
| 126H1 | DevStudio: visual modernity | modern look + dark mode, data-grid, skeletons/motion, nav, elevation | 126A |
| 126H2 | DevStudio: CSS cleanup | delete dead CSS, extract embedded styles, tokenize, dedupe inline styles | 126A |
| 126H3 | DevStudio: ops & governance | attribution, gated commits, validation, deploy robustness, build safety | — |
| 126I | Roma refactor | Roma consumes Dieter; delete the parallel `.roma-*` system | 126A–126G |

DevStudio's own UI/ops health (126H1–H3) runs **now**, in parallel with the component batches — the cockpit itself must be clean, not just its showcase of Dieter. They are independent of 126B–G.

## Audit criteria (shared by every component sub-PRD)
For each component, check:
1. **Dieter usage** — uses tokens (no hardcoded hex/px), composes through Dieter primitives, no parallel styling.
2. **Clean, on-standard code** — readable, no dead code, matches Clickeen standards, no inline handlers/styles where avoidable.
Fix what's broken, at the root.

## What this is NOT
Not a redesign. Not new components. Not a token rewrite (tokens are healthy). It's an audit + cleanup + wiring.

## Carry-over facts (already verified)
- Old DevStudio PRD's "fix `--radius-4`" step is wrong — `--radius-4` is a real, used token. Dropped.
- `registry.json` was dead cruft (nothing read it) — already removed (`ff15310b`). The real component list is the 25 folders on disk.
- `command-activity` has no stencil — incomplete component; flagged for 126G.
- DevStudio generation plumbing already works (foundation pages generated from source, component generator guards real, deploy chain real). 126H is small because of this.
- The old loose `UI_PRD__Roma_UI_Refactor.md` is superseded by 126I; can be removed once 126I is reviewed.
