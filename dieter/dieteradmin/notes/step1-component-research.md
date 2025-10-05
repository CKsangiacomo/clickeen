# Step 1 Research Notes — Remaining Components

This log captures Gestalt reference touchpoints and Dieter/Phase-1 guidance reviewed before implementation. Badge, Box, and Divider were previously completed; all other backlog entries are covered here. Button and Segmented Control Dieter contracts were re-opened as pattern references before reviewing each component.

## Container
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/container.tsx` — responsive layout clamping at ~800px with centered max-width on large screens; quality checklist highlights accessibility.
- **Dieter/Phase-1 guidance:** Dieter PRD has no Container contract; treat as new primitive leveraging existing spacing tokens and layout utilities.
## Link
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/link.tsx` — covers inline vs standalone usage, underline behavior, color variants, external link treatments, accessibility (aria-label, external icon), localization.
- **Dieter guidance:** No existing link contract; will rely on Dieter typography tokens and focus ring patterns from button/segmented specs.
## Spinner
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/spinner.tsx` — shows main spinner usage, delay/overlay scenarios, label and localization guidance, grayscale/white color treatments.
- **Dieter guidance:** No spinner contract; will derive motion tokens from Dieter and ensure reduced-motion fallbacks as per system rules.
## Input
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/textfield.tsx` — covers helper/error text, hidden labels, sizes, password toggle, character count, mobile keypad optimization.
- **Dieter guidance:** No TextField contract yet; align with Dieter tokens for control heights and focus ring behavior defined for buttons/segmented controls.
## Textarea
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/textarea.tsx` — details long-form input, helper/error text, row management, hidden labels, tag entry, character limit messaging.
- **Dieter guidance:** No Textarea contract; reuse Dieter control sizing tokens, focus ring, and textarea-specific typography decisions will be needed.
## Checkbox
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/checkbox.tsx` — multi-select guidance, helper text, indeterminate state, table alignment, sizing, error messaging.
- **Dieter guidance:** Must respect Dieter control size tokens and focus rings; align ARIA `role=checkbox`, `aria-checked`, `aria-describedby` patterns per Phase-1 accessibility rules.
## Radio Group
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/radiogroup.tsx` — single-selection guidance, layout direction, helper text, badges, error states, radio button vs radio group patterns.
- **Dieter guidance:** Implement roving tabindex ARIA pattern (`role=radiogroup`, `role=radio`, keyboard arrow support) consistent with Phase-1 accessibility rules.
## Select
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/selectlist.tsx` — native select usage, option grouping, helper text, error states, hidden labels, sizing.
- **Dieter guidance:** Implement trigger + native `<select>` fallback consistent with Dieter tokens; ensure keyboard/ARIA parity per Phase-1.
## Switch
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/switch.tsx` — binary toggle with immediate effect, label usage, disabled messaging, combination examples.
- **Dieter guidance:** Map to Dieter control tokens; implement accessible switch semantics (`role="switch"`, `aria-checked`, keyboard Space/Enter) per Phase-1.
## Fieldset
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/fieldset.tsx` — grouping related form fields with legends, accessibility emphasis, error messaging variations, hidden legends.
- **Dieter guidance:** Ensure semantic `<fieldset>` and `<legend>` remain; style wrappers with Dieter spacing tokens.
## Modal
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/modal.tsx` — modal vs overlay choices, size presets, mobile behavior, role alert dialog, prevent close, accessibility focus management.
- **Dieter guidance:** Phase-1 specs demand focus trap, Escape to close, labelled heading/description, scroll lock (per Techphases Modal requirements).
## Overlay Panel
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/overlaypanel.tsx` — slide-in sheet patterns, sizes, animation guidance, dismissing element, prevented close, confirmation vs quick edit content.
- **Dieter guidance:** Phase-1 overlay spec requires focus trap, aria-modal, labelled header, dismissal affordance; treat as viewport edge sheet.
## Popover
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/popover.tsx` — anchor alignment, ideal direction, focus trapping, ESC dismissal, layered scrolling containers.
- **Dieter guidance:** Overlay spec (Phase-1) requires focus trap, returning focus to trigger, `aria-labelledby`/`aria-describedby`, pointer arrow optional.
## Tooltip
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/tooltip.tsx` — positioning, inline anchors, z-index layering, accessibility (pointer/focus triggers), guidance against critical info.
- **Dieter guidance:** Provide `role="tooltip"`, manage focus/hover/focus-visible transitions with Dieter tokens and reduced motion compliance.
## Tabs
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/tabs.tsx` — placement above content, indicator styles, icon support, wrapping behavior, size variants, accessibility expectations.
- **Dieter guidance:** Implement tablist semantics (`role="tablist"` etc.) and keyboard arrow navigation as per Phase-1 overlay guidance.
## Toast
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/toast.tsx` — success/error variants, primary action/undo, dismiss behavior, multi-surface messaging, placement on desktop vs mobile.
- **Dieter guidance:** Follow Phase-1 rule for polite vs assertive announcements; manage live regions and auto-dismiss timers with reduced motion/respect to system tokens.
## Dropdown
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/dropdown.tsx` — action vs link items, sections, avatars/badges, mobile behavior, composability, complex content inside menu.
- **Dieter guidance:** Need menu role semantics (`role="menu"`, `role="menuitem"` etc.) with keyboard navigation; align with overlay tokens for backgrounds/shadows.
## Activation Card
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/activationcard.tsx` — sequenced cards showing onboarding status: not started, pending, needs attention, complete.
- **Dieter guidance:** Compose using Box/Badge/Button primitives; ensure dismiss button semantics and aria-label for optional dismiss.
## Banner
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/bannercallout.tsx` (plus overlay/upsell/slim variants) — high-priority messaging, status variants (info/warning/success), dismiss and action buttons, placement at top of surface.
- **Dieter guidance:** Leverage Dieter role tokens for status colors; ensure `role="status"` or `alert` depending on severity and optional dismiss button with aria-label.
## Help Button
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/helpbutton.tsx` — inline question-mark button with overlay content, link support, placement guidance.
- **Dieter guidance:** Compose with Popover/Tooltip behavior; ensure button has `aria-label`/`aria-expanded` and uses Dieter icon tokens.
## Page Header
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/pageheader.tsx` — title/subtitle layout, primary vs secondary actions, responsive stacking, avatar/illustration support.
- **Dieter guidance:** Compose with Dieter typography hierarchy and button tokens; ensure there is a single H1 per page.
## Mask
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/mask.tsx` — masking images/shapes with rounding options, washes, will-change toggle.
- **Dieter guidance:** Provide CSS mask utilities with Dieter radius tokens and accessible fallback backgrounds.
## Sticky
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/sticky.tsx` — wrapper applying CSS sticky with top/bottom/left/right offsets.
- **Dieter guidance:** Provide utility classes for sticky positioning with Dieter spacing tokens for offsets.
## Button Social
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/buttonsocial.tsx` — service presets (Apple/Facebook/Google/Line/Email) with login/continue/signup text variations.
- **Dieter guidance:** Build on Dieter button contract with icon leading; ensure provider branding tokens align with legal guidelines.
## Datapoint
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/datapoint.tsx` — numeric metric presentation, trend indicator, size options, badge pairing, localization.
- **Dieter guidance:** Use Dieter numeric typography tokens; ensure trend semantics use color tokens with accessible text alternatives.
## Date Input
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/datefield.tsx` — localized date entry with disabled dates, helper text, sizes, read-only mode, gestalts `DateField` component.
- **Dieter guidance:** Need Dieter-styled input with calendar icon; integrate locale formatting and accessible descriptions per Techphases.
## Indicator
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/indicator.tsx` — notification dot vs counter badge variants, small emphasis.
- **Dieter guidance:** Use Dieter status tokens; ensure accessible text for counters and hide decorative dots from screen readers.
## Pulsar
- **Gestalt reference:** `TMP_OLDREPO/gestalt/docs/pages/web/pulsar.tsx` — animated attention ring, used with popover onboarding, size variants, paused state, do/don’t guidance.
- **Dieter guidance:** Implement CSS animation with Dieter motion tokens and honor `prefers-reduced-motion`; pair with Popover for context.
