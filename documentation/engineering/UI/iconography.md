# Iconography in Clickeen

**Living, canonical reference — the icon language.**
Seeded 2026-06-27 from the as-built system; improved in place as UI program 126 executes.

- Authority: [`126__PRD__UI_Optimization_Program.md` §12](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126__PRD__UI_Optimization_Program.md).
- **Source of truth:** `dieter/icons/svg/*`, `dieter/icons/icons.json`, `dieter/scripts/build-icons.mjs`, and the `diet-icon` wrapper at `dieter/components/icon/`.

## The set

- **157 icons** as source SVGs in `dieter/icons/svg/`, Apple SF-Symbols-style
  **dot-notation** names (e.g. `square.and.arrow.up.svg`, `chevron.down.svg`).
- **Manifest** `dieter/icons/icons.json`: version `4.0`, `fontSize 28`,
  `precision 2`, 157 symbol entries (each a `path` draw-command string).
  Manifest count matches the SVG directory exactly (157 = 157).

## Build pipeline

`dieter/scripts/build-icons.mjs` runs each SVG through **svgo** into
`dist/icons/`, and emits `dist/icons.js` + `dist/icons.d.ts` — a generated
registry with an `IconName` string union and an `iconPath()` lookup. The umbrella
`dieter/scripts/build-dieter.js` orchestrates it into the Tokyo-deployed bundle.

## Presentation

`diet-icon` is a **CSS-only** presentation wrapper (`.diet-icon` + `data-size`)
— no `.ts`, not exported from `components/index.ts`. Icon glyph sizing comes from
the `--icon-size-*` ladder (see [`dieter.md`](dieter.md) foundation substrate).

## Honest notes

- `dieter/scripts/build-dieter.js` references an optional designer-override
  folder `icons/svg_new/` — it does **not** exist on disk today, so that code
  path is inactive. Do not document it as a live feature.
- Sizing is token-driven (`--icon-size-*`); color inherits `currentColor` (verify
  per component during the iconography pass).
