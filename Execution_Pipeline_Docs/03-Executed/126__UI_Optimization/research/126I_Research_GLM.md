# 126I — Source research: Component libraries (GLM, Phase-1 step 3)

> GLM independent pass. M3 + Apple HIG + OpenAI UI. **Not converged.**

---

## Material 3
- **Full component library:** ~40+ components (buttons, cards, dialogs, lists, navigation drawer, navigation bar, tabs, chip, slider, switch, text fields, menus, snackbars, progress, etc.). Each with anatomy, variants, specs, accessibility.
- **3-tier token model:** reference → system → component. Component tokens are specific to one component (e.g., `md.comp.fab.container.color`). clickeen's component-local tokens (`--btn-*`, `--seg-*`) match this pattern.
- **Specs:** M3 publishes detailed specs (measurements, color roles, typography roles, motion) per component. clickeen's `.spec.json` is a lighter version.
- **Variants/sizes/states:** every component has size (S/M/L) + state (hover/focus/pressed/disabled) + variant (e.g., button: filled/outlined/text) dimensions.

## Apple HIG (UIKit/SwiftUI)
- **Platform-native components:** Apple doesn't publish "component specs" — the components ARE the platform (UIButton, UITextField, UIAlertController, etc.). Developers use them directly.
- **System integration:** components auto-adapt to Dynamic Type, Dark Mode, vibrancy, accessibility. No separate "dark variant" — the system handles it.
- **No hand-off specs needed:** because the platform renders the component, there's no " stencil + hydrate" model — the component IS the implementation.

## OpenAI UI (apps-sdk-ui)
- **Radix + Tailwind 4 component library:** OpenAI ships actual React components (buttons, text fields, selects, dialogs, tabs, etc.) built on Radix primitives + Tailwind classes.
- **3-tier tokens:** primitive (raw values) → semantic (roles) → component (component-specific). Same structure as M3 and clickeen.
- **Dark mode built-in:** every component resolves via `light-dark()` tokens — no separate dark variant.
- **Accessibility:** Radix provides keyboard nav, focus management, ARIA out of the box. No per-component a11y work needed.

## Cross-source synthesis
- clickeen's component library (27 dirs, spec-driven, stencil+hydrate) is architecturally between M3 (spec-published, platform-implemented) and OpenAI (actual React components with built-in a11y). clickeen's model is more manual (stencils + hydration + per-component TS).
- The component-local token pattern (`--btn-*` etc.) matches M3's component-token tier.
- The missing shared primitives (Modal, DataTable, EmptyState) that Roma needs are present in all three sources (M3: dialogs/lists; Apple: UIAlertController/List; OpenAI: Radix Dialog/Table).

— end GLM research, 126I.
