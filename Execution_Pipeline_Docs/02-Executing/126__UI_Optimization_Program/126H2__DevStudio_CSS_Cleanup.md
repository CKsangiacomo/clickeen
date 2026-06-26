# 126H2 — DevStudio: Presentation-Layer CSS Cleanup

**Parent:** 126 MAMA. **Runs:** now. **Depends on:** 126A (tokens).

## Problem
The CSS is messy underneath: ~100+ lines of dead subsystems, two pages bypass shared CSS with embedded `<style>` blocks, magic numbers instead of tokens, inline-style boilerplate duplicated 43× and baked into the renderer.

## Work
1. Delete the two dead CSS subsystems: the unused `.stack-*`/`.grid-*`/`.anchor-list`/`.visually-hidden` utilities, and the `.component-masonry`/`.compiler-*`/`.bob-*` grid (zero references).
2. Extract the `entitlements` (245-line) and `llm-management` (114-line) embedded `<style>` blocks into shared, tokenized CSS.
3. Tokenize magic numbers: `#f4f5f7`, `280px` (×3), `32px`.
4. Dedupe the 43× inline styles — move spacing into CSS rules; fix the renderer (`componentRenderer.ts:153,227`) so it stops emitting presentational inline styles.
5. Converge the two row abstractions (`.section/.row` vs `.dieter-component-row`).
6. Remove the `!important` hack and the unused overlapping `.devstudio-page*` classes.

## Done when
Zero dead CSS; zero embedded `<style>` blocks; zero untokenized magic numbers; one row abstraction; the renderer emits no presentational inline styles.

## Not in scope
Visual redesign (126H1). Ops (126H3).
