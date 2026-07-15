# Accessibility In Clickeen

Living reference for accessibility doctrine.

- Canonical doctrine: this document.
- Execution PRD: [`126A__PRD__Accessibility.md`](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126A__PRD__Accessibility.md).
- Related docs: [`components.md`](components.md), [`dialogs-and-modals.md`](dialogs-and-modals.md), [`interactions.md`](interactions.md), [`motion.md`](motion.md), [`color.md`](color.md).

This document is not a generic accessibility program. It owns semantic product truth:
state, names, status, errors, dialog/popover/status honesty, and text
inspectability.

## What This Document Owns

- Expose real selected/current/expanded/disabled/invalid/loading/saving/
  uploading/generating/success/failure/partial-success state when the UI already
  communicates that state visually and a truthful semantic mapping exists.
- Prefer native controls where they directly represent the action or input.
- Give icon-only actions an accessible name.
- Hide decorative icons and decorative media from semantic output.
- Name dialog, popover, sheet, banner, and status surfaces honestly.
- Keep operation status and error feedback visible and semantically honest.
- Keep generated, translated, and user-authored text inspectable.
- Resolve backend/service errors and reason keys to product copy before display.
  Raw reason keys and locale/tier tokens are not user copy unless the product
  explicitly presents them as operator coordinates.
- Route motion-only state-signal problems to [`motion.md`](motion.md) or the
  owning component/screen execution PRD.

## What This Document Does Not Own

- WCAG certification.
- Custom keyboard support.
- Keyboard-complete component behavior.
- Focus-trap implementation.
- Focus-ring rollout or component-wide focus redesign.
- Mobile/touch target sizing.
- AI-enforced contrast/color changes.
- Accessibility validator/check suites.
- Modal/dialog framework behavior.
- Visual redesign.

## Current Useful Substrate

- `.sr-only` exists in Dieter foundation tokens.
- Global reduced-motion foundation exists and is owned by [`motion.md`](motion.md).
- Dieter tabs and choice tiles expose useful existing semantics.
- Bulk edit has dialog semantics as current component evidence.
- Bob Workspace and TranslationsPanel include live/status/error semantics.
- Roma nav includes current-page/nav labeling.
- DevStudio token editor diff uses `aria-live`.

These are current strengths, not proof that every surface follows this doctrine.

## Routed Work

This document does not leave a generic accessibility backlog. If a future agent finds a
semantic or copy issue, it must name the exact file/path and route it to the
owning PRD before changing it.

- Native-control conversion for Dieter pseudo triggers belongs to the component
  doctrine and its execution PRD. The six current source families are
  `dropdown-actions`, `dropdown-fill`, `dropdown-border`, `dropdown-shadow`,
  `dropdown-upload`, and `dropdown-edit`. The independently generated upload
  control inside `bulk-edit` must move with the `dropdown-upload` contract.
  Unconsumed `textrename` is deleted rather than converted or preserved.
- Dialog/popover mechanics belong to [`dialogs-and-modals.md`](dialogs-and-modals.md).
  This document only names existing surfaces and exposes truthful status/error
  state.
- Text resizing and long-string proof belongs to the component, DevStudio, and
  Roma execution PRDs.
- Contrast/readability evidence belongs to [`color.md`](color.md). Human design decides colors;
  agents do not enforce contrast doctrine.
- Public widget accessibility belongs to the owning widget runtime/docs unless a
  widget PRD explicitly brings that behavior into system scope.

Icon semantics follow [`iconography.md`](iconography.md): decorative icons are hidden, icon-only controls put
the name on the control, and meaningful standalone icons need an explicit label
rule in the owning consumer.

## Rules For Agents

Use native controls where practical:

- `button` for actions;
- `a` for navigation;
- `input`, `select`, `textarea`, `checkbox`, and `radio` for form controls.

Do not use ARIA to invent behavior. ARIA must name or expose real Clickeen
product state.

Do not communicate state only through color, icon, spinner motion, or hidden
implementation state. If the user needs to know an operation is saving,
generating, failed, blocked, or complete, the surface needs visible status/error
truth.

Do not turn this doc into keyboard, focus, touch-target, contrast, modal, or
validator work. Those are explicitly outside this doctrine unless a later human-owned PRD
changes that scope.

## Public Widgets

System/account/admin UI follows this doctrine. Public widget runtime accessibility belongs
to the owning widget runtime/docs unless a widget PRD explicitly brings that
behavior into system scope.
