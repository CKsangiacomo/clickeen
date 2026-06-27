# 126A2 — SubPRD: Color in Clickeen

Status: DRAFT
Parent: `126A__PRD__Dieter_Tokens.md` → `126__PRD__UI_Optimization_Program.md` (MAMA)
Role: Track 1 (Dieter tokens) — the color slice.

## Canonical reference (do not duplicate)

The living, canonical reference for clickeen color is
[`documentation/engineering/UI/color.md`](../../../documentation/engineering/UI/color.md).
It is seeded and in place. This PRD **does not duplicate it** — one source of
truth (by-reference law, MAMA §12). Anything below that conflicts with `color.md`
is wrong; `color.md` wins.

## What this PRD is

A **driver PRD**. `color.md` already exists; executing this PRD **improves
`color.md` and the underlying system in place** — it does not author a new spec.
The reference is the artifact; this PRD governs the work that verifies and
completes it.

## Execution scope (improve `color.md` + the system)

- **Verify `color.md` against the as-built tokens** (`dieter-color-tokens.css`,
  `dieter-foundation-tokens.css`) and correct any drift between doc and code.
- **Complete the dark-mode gap.** The state engine is already dark-ready (dual
  `--state-darken/lighten-target`, "(light)" annotation); what's missing is the
  dark palette block. Add it so the light/dark pair exists. This *completes* the
  existing engine — it does **not** redesign it, and adds no new machinery.
- **Confirm consumer-side color-token bugs are fixed by the sibling token sweep**
  (`--color-surface` → `--role-surface`; `--color-bg` → `--role-surface-bg`).
  These are misuse at consumers, not color-system defects — recorded as a gap in
  `color.md`, owned by the sibling slice.

## Authority & compliance

- **Preserve, do not rewrite** (design freeze, MAMA §4). Apple system colors +
  OKLAB is world-class as-built; the system is the asset, not the problem.
- **No new machinery** (PRD 125 §3). Dark mode = completing the existing engine.
- **Docs are part of done.** Every improvement lands in `color.md` (canonical),
  not back into this PRD.

## Out of scope

- Redesigning or re-deriving the color system.
- Token authoring UI (DevStudio / 126C owns).
- Consumer token-reference fixes (sibling slice).
- Components, screens (later tracks).
