# 126J — Source research: Surfaces / multi-surface design systems (GLM, Phase-1 step 3)

> GLM independent pass. M3 + Apple HIG + OpenAI UI. **Not converged.**

---

## Material 3
- **Multi-platform by design:** M3 ships for Android (Compose), Flutter, Web (Web Components). Same token model, different implementations. The "surface" question is "which platform" — each gets its own library that consumes the same tokens.
- **No parallel system problem:** because each platform uses the official library, there's no scenario where an app builds its own component set alongside the official one. clickeen's Roma parallel system has no M3 analog.

## Apple HIG
- **Platform IS the system:** on Apple platforms, there's only one component set (UIKit/SwiftUI). Apps can't "not use it" and build a parallel set — the platform enforces adoption through system integration (Dynamic Type, accessibility, Dark Mode all depend on using system components).
- **No multi-surface divergence:** iPad/iPhone/Mac/Vision all use the same components adapted per platform. No parallel systems.

## OpenAI UI
- **Single-host model:** apps render inside ChatGPT. There's ONE host, ONE set of system tokens. Apps that override system tokens break visual consistency. The OpenAI CSS (3-tier tokens) IS the only allowed component layer for hosted UI.
- **No parallel system:** if an app built its own component CSS alongside the OpenAI CSS, it would look inconsistent with ChatGPT. The submission review catches this.

## Cross-source synthesis
- **None of the three sources have clickeen's "parallel system" problem.** M3/Apple/OpenAI all enforce single-system adoption (via platform, library, or review). clickeen's Roma built a parallel `.roma-*` system because nothing enforced Dieter adoption — a governance gap, not a design gap.
- **The convergence target:** Roma must adopt Dieter components + shared primitives and retire `.roma-*`. This is the 126M Roma UI refactor's job.

— end GLM research, 126J.
