# 126B — Track PRD: Dieter Components

Status: DRAFT — DIRECTIONAL SKELETON (fill only after the Components audit)
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA)
Role: **Track 2 — the middle doll.** ~25 Dieter components, built on the tokens
from 126A. Every component must be splendid and purely token-driven before the
screen dolls (126C/126D) may build on it.

## Precondition

Fill only after `audits/126B__Audit__Components.md` exists: a **full per-CSS
cleanliness read of all ~25 components**. The interim audit Phase 2 explicitly
deferred this ("a full per-CSS cleanliness read of all 25 is TBD").

## Seed findings (from the interim audit — to verify and complete)

- **Preserve:** the token-driven approach and the component-local token pattern
  (`--seg-*`, `--btn-*`, `--tog-*`, `--ma-*`).
- **Likely drift (small):**
  - `dropdown-fill.css` raw hex hue-rainbow — intrinsic to a color picker; judge.
  - `textedit.css` raw `rgba` fallback for a shadow token.
  - A few hardcoded modal/popover widths (intrinsic sizing).
  - Behavior-in-markup smell in the dropdown stencils.
- **Dead / broken components:** `textrename` (dead; removal must also delete
  `admin/src/main.ts:23,258` per the sanity-pass), `command-activity`
  (no stencil; broken/incomplete).
- **Open question:** the precise `repeater` vs `object-manager` distinction
  (both live in Bob's ToolDrawer) — read their usage before claiming overlap.

## Sections to fill (from the audit)

- **Current state** — all ~25 components, per-component preserve/fix.
- **Target** — every component splendid + built purely from tokens; no
  hardcoded values; no dead components.
- **Authority** — `dieter/components/*` (stencil + spec + CSS).
- **Steps / subPRDs** — per component group as the audit reveals (e.g.
  `126B1 dead-component removal`, `126B2 dropdown stencils`).
- **Verification** — `build:dieter` green + visual before/after in the
  showcase / DevStudio.
- **Acceptance** — the splendid-bar for components (MAMA §10).

## Out of scope

- Redesigning components (preserve the approach; fix drift).
- Token changes (126A owns).
- Screens (126C/126D).
