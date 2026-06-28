# 126K — Source research: Dialogs/Modals/Overlays (GLM, Phase-1 step 3)

> GLM independent pass. M3 + Apple HIG + OpenAI UI. **Not converged.**

## Material 3
- **Dialogs:** modal, blocking. `role="alertdialog"` for destructive, `role="dialog"` for general. Focus trap required. Escape to dismiss. Scrim (backdrop) at elevation level 3.
- **Sheets:** bottom-anchored, drag-to-dismiss. Non-blocking variants exist.
- **Snackbars:** transient, non-blocking, bottom-anchored.
- **Specs:** M3 publishes exact measurements (scrim opacity 0.32, dialog corner radius 28dp, etc.).

## Apple HIG
- **Sheets** (iOS 15+): the primary modal pattern. Detents (medium/large) — partial-screen sheets. Drag-to-dismiss.
- **Alerts:** `UIAlertController` — modal, blocking, system-styled. Standardized button layout (cancel on left, action on right).
- **Popovers** (iPad): `UIPopoverPresentationController` — anchored, non-blocking, arrow-pointing.
- **Focus management:** system handles focus trap + restoration automatically.

## OpenAI UI
- **Dialogs:** Radix Dialog component (from apps-sdk-ui). Focus trap, Escape dismiss, scroll-lock all built-in via Radix. No custom work needed.
- **Minimal guidance:** "provide focus states for keyboard navigation."

## Cross-source synthesis
- All three have standardized overlay patterns with focus-trap/escape/scroll-lock built-in. clickeen has NONE of these systematically — only markup-level role=dialog/aria-modal.
- M3's scrim-at-elevation-3 = a z-index token concept. clickeen has no z-index system.
- Apple's sheet detents (partial-screen) and Radix's built-in focus management are patterns clickeen lacks.

— end GLM research, 126K.
