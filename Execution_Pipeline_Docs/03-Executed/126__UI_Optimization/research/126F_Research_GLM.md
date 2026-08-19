# 126F — Source research: Motion (GLM, Phase-1 step 3)

> GLM independent pass. M3 + Apple HIG + OpenAI UI. **Not converged.**

---

## Material 3 (m3.material.io/styles/motion)
- **Easing curves:** 3 standard — Emphasized (`cubic-bezier(0.2,0,0,1)`), Standard, Decelerated. Each maps to a semantic intent (entering, exiting, attention).
- **Durations:** 5 stops — XS (100ms), S (150ms), M (250ms), L (300ms), XL (400ms). Mapped to component size/complexity.
- **Reduced motion (verbatim):** "Use subtle fades instead [of intense sliding or scaling]; Disable decorative effects like parallax or shape morphing; [maintain] stable layouts."
- **Choreography:** enter/exit patterns (fade-through, scale, slide) with duration/easing per pattern.
- **Implications:** M3 has 3 easing curves + 5 durations + choreography patterns. clickeen has 3 durations + 0 easing + no patterns. The gap is easing + choreography.

## Apple HIG (developer.apple.com/design/human-interface-guidelines/motion)
- **Spring physics** (damping + response) — not fixed easing curves. Feels natural.
- **Reduce Motion (3 mitigations):** tighten springs (reduce bounce), track animations to gestures, avoid z-depth animation. `UIAccessibility.isReduceMotionEnabled`.
- **Haptics** integrated with motion — web lacks this dimension.
- **Implications:** Spring-based isn't directly portable to CSS. The 3 mitigations ARE portable (reduce duration, no transform, no translateZ).

## OpenAI UI (developers.openai.com/apps-sdk)
- **"Accessible color and motion"** — the single mention. No specifics. clickeen self-governs.

## Cross-source synthesis
- **Easing is the biggest gap:** M3 has 3 semantic curves; Apple uses springs; clickeen has 0. Every component uses literal `ease` or nothing.
- **Durations adequate but not semantic:** snap/base/spin (140/160/600ms) ≈ M3's small/medium but lack the semantic mapping.
- **Reduced motion:** M3 says fade (not zero). clickeen zeroes — potentially too aggressive per M3.

— end GLM research, 126F.
