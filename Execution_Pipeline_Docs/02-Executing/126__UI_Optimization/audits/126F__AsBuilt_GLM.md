# 126F — As-built audit: Motion (GLM, Phase-1 step 1)

> GLM independent pass. Codex writes its own; **not converged**. Source: `dieter/tokens/dieter-foundation-tokens.css:79–82, 99–106` + component CSS greps.

---

## 1. Duration tokens (`dieter-foundation-tokens.css:79–82`)

| Token | Value | Intended use |
|---|---|---|
| `--duration-snap` | `140ms` | quick state snaps (toggle, segmented) |
| `--duration-base` | `160ms` | default transitions (hover, open) |
| `--duration-spin` | `600ms` | spinners / long loops |

Only 3 stops. No fast/medium/slow ramp, no enter/exit pair tokens. M3 has 5 (100/150/250/300/400ms).

## 2. Easing — ZERO tokens

No `--easing-*` token is defined anywhere in the token files. `--easing-standard` appears ONLY as a fallback argument in a few `color-mix`/`transition` call sites — it is never declared. Every component that animates uses a literal `ease`, `ease-in-out`, `linear`, or nothing.

**This is the biggest motion gap:** M3 defines 3 semantic easing curves (Emphasized/Standard/Decelerated); Apple uses spring physics; clickeen has none.

## 3. Reduced-motion guard (`dieter-foundation-tokens.css:99–106`)

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

Global `*` guard — zeroes ALL animation/transition durations + forces scroll-behavior:auto. Duplicated in `admin/src/css/utilities.css:140–147`.

**Potential mismatch with M3:** M3 says reduced-motion should use "subtle fades" (not zero). clickeen zeroes everything — which is more aggressive than M3 recommends. Some animations may become instant-jarring rather than gentle-fade.

## 4. Per-component reduced-motion overrides

Explicit overrides (in addition to the global guard):
- `toggle.css:127–129` — toggle transition
- `tabs.css:98–100` — tab transition
- `segmented.css:259–263` — segmented transition
- `valuefield.css:138–142` — valuefield transition
- `textrename.css:128–133` — textrename transition
- `textfield.css:139–141` — textfield `__field` (partial: targets `__field` but the real transition is on `__control/__inner`)

No explicit override (rely on global guard): button, popover, repeater, dropdown-fill swatches/stops.

## 5. Literal ms/ease bypasses

Codex found literal `120ms`/`150ms ease` in product/component CSS (bypassing `--duration-*` tokens). These are inline values that don't reference the token system.

## 6. Honest gaps
- No easing token system (the headline gap).
- Only 3 durations (M3 has 5; Apple spring-based — different model).
- Global guard zeroes everything (M3 says fade, not zero).
- Literal ms/ease values bypassing tokens (not quantified this pass).

— end GLM as-built, 126F.
