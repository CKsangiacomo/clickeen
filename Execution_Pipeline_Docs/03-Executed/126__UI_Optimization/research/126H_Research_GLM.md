# 126H — Source research: Dieter foundations (GLM, Phase-1 step 3)

> GLM independent pass. M3 + Apple HIG + OpenAI UI. **Not converged.**

---

## Material 3 (foundations)
- **Shape:** M3 defines shape scale (none/XS/S/M/L/XL) via corner-radius tokens per component. clickeen's `--control-radius-*` (14 stops, 0–76px) is MORE granular.
- **Elevation:** M3 defines 5 elevation levels (0–5dp) with tonal overlays + shadows. clickeen has 3 shadow tokens (elevated/floating/inset) — fewer but functional.
- **Spacing:** M3 uses a 4dp/8dp grid. clickeen's `--space-*` (4px grid) matches. M3 doesn't define a separate "vertical rhythm" scale (clickeen's `--vertspace-*` is unique).
- **Layout:** M3 defines breakpoints + grid. clickeen has none (no breakpoint/container-width tokens).

## Apple HIG (materials/layout)
- **Materials:** Apple's material system (regular/thin/thick/ultra-thick) defines translucency + blur — a dimension web CSS can approximate but not replicate.
- **Layout guides:** Apple uses safe-area + readable-content guides + system spacing. clickeen's `--vertspace-*` (sub-2px) resembles Apple's tight system spacing.
- **Elevation:** Apple uses z-positioning (layered depth), not shadow tokens. clickeen's shadow tokens are a web-appropriate adaptation.

## OpenAI UI
- **Spacing & layout** section: "Use consistent spacing." "Maintain readable line lengths." Minimal — no token system prescribed.

## Cross-source synthesis
- clickeen's foundation is MORE granular than M3 in shape (14 vs 6 stops) and uniquely separates vertical rhythm from spacing. These are strengths.
- The gaps (no z-index, no easing, no breakpoints, dead touch-target) are clickeen-specific.
- The foundation's cross-file color dependency (shadows reference `--color-system-black`) is architecturally correct (by-reference) but couples foundation to color for dark-mode support.

— end GLM research, 126H.
