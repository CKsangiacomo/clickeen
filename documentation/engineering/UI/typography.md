# Typography in Clickeen

**Living, canonical reference — typography.**
Seeded 2026-06-27 from the as-built tokens; improved in place as UI program 126 executes.

- Authority: [`126__PRD__UI_Optimization_Program.md` §12](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126__PRD__UI_Optimization_Program.md).
- **Source of truth:** `dieter/tokens/dieter-typography.css` (134 lines). The CSS is authoritative.

## Font families

```text
--font-ui:  Inter Tight, Inter, system-ui, sans-serif
--font-mono: …monospace stack
```

## Size scale

- **Semantic bases:** `--fs-body` (16px), `--fs-ui` (15px).
- **Static scale:** `--fs-10`…`--fs-32` (absolute px-named stops).
- **Fluid display (marketing/hero):** `--fs-fluid-display-1/2/3` via `clamp()`
  (display-1 ≈ 36→60px, -2 ≈ 30→48px, -3 ≈ 24→40px). Distinct from the static
  scale — no breakpoint system, just `clamp()`.

## Line-height

```text
--lh-tight (1.15) | --lh-normal (1.4) | --lh-loose (1.5)
--lh-body (1.5)   | --lh-body-ui (1.35, denser UI rhythm)
```

## Utility-class system

The same file ships a full set of type utility classes that consume the tokens —
`.body-*`, `.heading-*`, `.label-*`, `.caption*`, `.overline*`, `.display-*`
(26 selectors). These are the type layer most surfaces actually use.

**Seam with [`color.md`](color.md):** several utility classes hardcode a color
(`.label-*` → `--color-system-black`, `.overline` → `--color-system-gray`,
`.caption*` via `color-mix`). This doc owns the *type mechanics* (family / size /
weight / leading) of those classes; color semantics stay in [`color.md`](color.md).

## Honest gaps

- No letter-spacing / tracking token — values are inlined per utility class.
- No breakpoint / container-width system — fluid sizes use `clamp()` directly.
