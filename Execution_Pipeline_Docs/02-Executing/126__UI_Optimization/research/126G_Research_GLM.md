# 126G — Source research: Ops (GLM, Phase-1 step 3)

> GLM independent pass. M3 + Apple HIG + OpenAI UI. **Not converged.** Ops research = how the three design-system sources handle build/publish/version/govern.

---

## Material 3
- **Distribution:** M3 ships as a design spec (Figma + docs) + code libraries (Android Compose, Flutter, Web Components). Not a build pipeline — it's a published artifact consumed by platforms.
- **Token tooling:** Material Theme Builder (Figma + web) generates token sets from a seed. The output is consumed by the platform library, not a build script. No "governance guard" concept — the platform library IS the guard (use the library = comply).
- **Versioning:** M3 versions are tied to the Compose/Material library versions (e.g., `androidx.compose.material3`). Breaking changes tracked in release notes.
- **Implications:** M3 doesn't have an ops pipeline to compare — it's a published spec, not a build system. clickeen's build/govern model is unique (DevStudio reveal + commit lane).

## Apple HIG
- **Distribution:** Apple's design system IS the platform — HIG + UIKit/SwiftUI + SF Symbols + system fonts. There's no separate "build" — Apple ships it in the OS.
- **Token tooling:** Apple uses asset catalogs (`.xcassets`) with color sets (light/dark/any-appearance) — each color is a palette of appearance-specific values. Xcode handles resolution at build time.
- **Versioning:** tied to iOS/macOS versions. New HIG guidance ships with OS updates.
- **Implications:** Apple's model is platform-native (no build pipeline, no governance guard). clickeen can't directly compare — Apple's design system IS the runtime.

## OpenAI UI (developers.openai.com/apps-sdk)
- **Distribution:** OpenAI ships an npm package (`@openai/apps-sdk-ui`) with the token CSS (3-tier primitive/semantic/component). Apps install it; the CSS handles light-dark via `light-dark()`.
- **No governance concept.** Apps self-govern — OpenAI reviews at submission time (App Store review equivalent).
- **Token tooling:** the CSS files ARE the tokens — no build step, no generation. Primitive → semantic → component is hand-authored CSS custom properties.
- **Versioning:** npm package versioning. Breaking changes tracked in changelog.
- **Implications:** OpenAI's model is "ship the CSS, review at submission." clickeen's build/govern loop (DevStudio reveal + commit lane + CI + R2 sync) is MORE complex — a real pipeline, not just a package.

## Cross-source synthesis
- None of the three sources have a comparable build/govern/deploy pipeline to clickeen's. M3 = published spec; Apple = platform-native; OpenAI = npm package. clickeen's DevStudio reveal/steer loop + commit lane + R2 sync + governance guards is a unique, more-engineered model.
- The closest industry analog: design-token platforms like Style Dictionary (build pipeline for multi-platform token output) + Supernova/Zeroheight (governance + docs). clickeen's `build-dieter.js` + `governance-guards.mjs` + DevStudio ≈ a lightweight version of these.
- **The governance gaps clickeen has (no actor attribution, regex-only validation, fire-and-forget R2, PR-only verify)** are unique to clickeen's custom pipeline — none of the three sources have this problem because none have this pipeline.

— end GLM research, 126G.
