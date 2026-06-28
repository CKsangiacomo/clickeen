# 126E — Source research: Interactions (GLM, Phase-1 step 3)

> GLM independent pass. M3 + Apple HIG + OpenAI UI. Primary sources only. **Not converged.**

---

## Material 3 (m3.material.io)
- **Loading/progress:** M3 defines `CircularProgressIndicator` and `LinearProgressIndicator` as animated components with determinate/indeterminate modes. Reduced-motion: progress indicators should animate continuously (they're informational, not decorative).
- **Snackbars:** M3's transient feedback component. Positioned bottom, auto-dismiss, optional action. One at a time. Replaces toasts.
- **Empty states:** M3 doesn't define a dedicated "empty state" component — it's a composition (illustration + text + CTA) using standard roles.
- **Error:** the `error` color role (error/on-error/error-container/on-error-container) signals errors. Error text uses error-color semantics, not just red text.
- **Interaction states:** M3 defines 5 states — hover, focus, pressed, dragged, disabled. Each is expressed via the **state layer** (an opacity overlay on the component). This is M3's core interaction model — not per-component CSS, but a system-wide overlay.
- **Implications for clickeen:** M3's state-layer model is the structural approach clickeen's state-engine mimics (`--state-hover-mix` etc.) but M3 applies it as a visual layer, not a color-mix formula. clickeen could adopt the state-layer overlay concept.

## Apple HIG (developer.apple.com/design)
- **Loading:** `UIActivityIndicator` (spinner) and `UIProgressView` (bar). Spinners auto-adapt to Reduce Motion (stop spinning, may show text instead).
- **Alerts:** `UIAlertController` — modal, blocking. Sheets for non-blocking. Banners (iOS 16+) for transient non-blocking notifications at the top.
- **Empty states:** Apple uses `UIContentUnavailableConfiguration` (iOS 17+) — a system-provided empty/error state with icon + title + description + actions. Standardized.
- **Pull to refresh:** standard gesture for reloading content lists.
- **Haptics:** Apple integrates tactile feedback (impact/selection/notification) with visual state changes — a dimension web systems lack.
- **Implications for clickeen:** Apple's `UIContentUnavailableConfiguration` is the standardized empty-state component clickeen lacks (each domain improvises). Banners (iOS 16+) are the transient-feedback pattern.

## OpenAI UI (developers.openai.com/apps-sdk)
- **Minimal guidance.** The UI guidelines don't specify loading states, empty states, error handling, or feedback patterns. Only: "accessible color and motion – respect system dark mode and provide focus states for keyboard navigation."
- **No interaction-pattern requirements.** Apps bring their own loading/error/feedback. OpenAI's bar is the accessibility floor (WCAG AA + alt text), not an interaction-design mandate.
- **Implications for clickeen:** OpenAI doesn't constrain interaction patterns. clickeen self-governs here.

## Cross-source synthesis
- **All three have standardized empty-state patterns** (M3 composition, Apple UIContentUnavailableConfiguration, OpenAI silent). clickeen improvises per domain — no shared EmptyState primitive.
- **Feedback:** M3 = Snackbar; Apple = Banner/Alert; OpenAI = silent. clickeen = inline `role="alert"` divs, no Toast/Snackbar system.
- **State model:** M3 = state-layer overlay (system-wide); clickeen = `--state-*-mix` color-mix formula (token-level). Same concept, different implementation altitude.
- **Reduce Motion:** M3 keeps progress-indicator animation (informational); Apple stops spinners. clickeen has the global guard but no per-component override verification.

— end GLM research, 126E.
