# 126H — As-built audit: Dieter system + foundation (GLM, Phase-1 step 1)

> GLM independent pass. **Not converged.** Source: `dieter/tokens/dieter-foundation-tokens.css` (107 lines) read in full + consumer greps.

---

## Foundation substrate (`dieter-foundation-tokens.css`)

| Category | Tokens | Lines | Key facts |
|---|---|---|---|
| Spacing (4px grid) | `--space-0`…`--space-10` (11 stops, 2–40px) | `:3–14` | The base length scale |
| Vertical rhythm | `--vertspace-1`…`--vertspace-9` (0–0.8rem, 0.1rem steps) | `:16–25` | Sub-2px, distinct from `--space-*` |
| Control sizing | `--control-size-xs`…`--control-size-xl` (16–32px) | `:27–32` | Caps at 32px (below 44px touch target) |
| Control gaps | `--control-padding-inline`, `--control-inline-gap-xs…xl` (2–12px) | `:34–40` | |
| Control radii | `--control-radius-none`…`--control-radius-10xl` (14 stops, 0–76px) | `:42–58` | Full shape scale |
| Radius aliases | `--radius-3` (= md), `--radius-4` (= lg) | `:60–62` | **Intentional** — surface aliases for generated previews (NOT ghost tokens) |
| Icon sizing | `--icon-size-12/16/20/24/28/32/36/40` (8 stops) | `:64–72` | 3 unused by diet-icon wrapper (24/28/32) |
| Focus/ergonomics | `--focus-ring-width` (2px), `--focus-ring-offset` (2px), `--min-touch-target` (2.75rem/44px) | `:74–77` | 44px consumed by ZERO dieter components |
| Motion | `--duration-snap` (140ms), `--duration-base` (160ms), `--duration-spin` (600ms) | `:79–82` | No easing tokens |
| Elevation | `--shadow-elevated`, `--shadow-floating`, `--shadow-inset-control` | `:84–87` | All `color-mix(in oklab, var(--color-system-black), …)` — cross-file color dependency |
| Utilities | `.sr-only` | `:92–96` | |
| Reduced motion | `@media (prefers-reduced-motion: reduce)` global `*` guard | `:99–106` | Zeroes durations (M3 says fade, not zero) |

## Composition model
- `tokens.css` `@import`s foundation + color + typography. Single entry point.
- `build-dieter.js` copies tokens to `tokyo/product/dieter/tokens/`. Surfaces load via `/dieter/tokens/tokens.css`.
- Bob/Roma/Admin load tokens from CDN; components reference via `var(--*)`.

## Undefined-token bugs (cross-referenced from 126B/126A audits)
- `--color-surface` (button.css:8,190,321) — undefined; button bg unresolved.
- `--radius-2` (bulk-edit.css:96,112) — undefined; only `--radius-3/4` exist.
- `--hspace-1/2/3/4` (10+ consumers) — undefined scale; fallback-masked.

## Gaps
- No z-index token system — raw literals (0/1/2/3/12/1000) across components.
- No easing tokens — only durations.
- `--min-touch-target` (44px) dead in dieter — 0 consumers; ladder caps at 32px.
- Dark-mode not in foundation (light-only state engine).
- Foundation shadows cross-reference color tokens (not standalone).

— end GLM as-built, 126H.
