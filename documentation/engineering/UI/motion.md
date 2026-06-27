# Motion in Clickeen

**Living, canonical reference — motion.**
Seeded 2026-06-27 from the as-built tokens; improved in place as UI program 126 executes.

- Authority: [`126__PRD__UI_Optimization_Program.md` §12](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126__PRD__UI_Optimization_Program.md).
- **Source of truth:** `dieter/tokens/dieter-foundation-tokens.css` (motion block, ~lines 79-82 and the reduced-motion guard at line 99).

## What exists

```text
--duration-snap:  140ms   /* quick state snaps (toggle, segmented) */
--duration-base:  160ms   /* default transitions (hover, open) */
--duration-spin:  600ms   /* spinners / long loops */
```

```css
@media (prefers-reduced-motion: reduce) { /* guard: neuter non-essential motion */ }
```

## Honest gaps (this is a thin layer today)

- **No easing-curve token.** `--easing-standard` appears only as a *fallback arg*
  in a few `color-mix`/transition call sites — it is never declared. There is no
  easing scale. This is the headline gap; completing it is a 126A deliverable.
- **No duration scale beyond three stops** — no fast/medium/slow ramp, no
  enter/exit pair tokens.
- **Reduced-motion guard exists but its coverage is unverified** — which
  transitions it actually neutralizes across components is TBD during the motion
  pass.

## Where motion shows up

- Control state transitions (hover/pressed via [`color.md`](color.md) state mixes).
- Modal/popover enter-exit (see [`dialogs-and-modals.md`](dialogs-and-modals.md)).
- Spinners / agent-activity (see [`interactions.md`](interactions.md)).

The motion discipline is the least-developed token layer; the 126 series is where
it gets deliberately completed (durations scale + easing tokens + verified
reduced-motion coverage), not invented from scratch.
