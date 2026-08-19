# 126K Dialogs And Modals - As-Built Audit - Codex

Status: CODEX ONLY - Phase 1 step 1.
Scope: current overlay/dialog/modal/popover behavior across Dieter, Roma, Bob,
and DevStudio.
Process: code owns current reality. This audit does not converge with GLM, does
not choose fixes, and does not run step 4+.

## 0. Authority Boundary

126K owns the overlay system domain: modals, dialogs, popovers, sheets/overlay
mechanics, layering, focus/dismissal behavior, and related current gaps.

MAMA context:

- `126__PRD__UI_Optimization_Program.md:132` assigns 126K to
  dialogs-and-modals.
- `126__PRD__UI_Optimization_Program.md:178` through
  `126__PRD__UI_Optimization_Program.md:190` define the per-domain method.
- `126__PRD__UI_Optimization_Program.md:182` says step 1 is independent
  as-built current reality.
- `126__PRD__UI_Optimization_Program.md:183` says step 2 is current reality
  plus known gaps, no fixes.
- `126__PRD__UI_Optimization_Program.md:184` says source research is
  independent.
- `126__PRD__UI_Optimization_Program.md:185` reserves convergence for the
  human in step 4.

Compliance:

- This audit names existing overlay families and their behavior.
- It does not invent a unified modal system.
- It does not add a `Modal` primitive, focus trap, stack manager, or migration
  machinery.

## 1. Living Dialogs Doc State

`documentation/engineering/UI/dialogs-and-modals.md` already frames this domain
as the overlay system.

Evidence:

- `documentation/engineering/UI/dialogs-and-modals.md:1` names the doc as
  dialogs and modals.
- `documentation/engineering/UI/dialogs-and-modals.md:3` marks it as the living
  canonical overlay-system reference.
- `documentation/engineering/UI/dialogs-and-modals.md:4` says it owns modal,
  dialog, and popover rules.
- `documentation/engineering/UI/dialogs-and-modals.md:10` through
  `documentation/engineering/UI/dialogs-and-modals.md:20` list current overlay
  families: `bulk-edit`, `object-manager`, `textedit` / `dropdown-edit`,
  `popover`, `popaddlink`, Roma parallel modals, and the upgrade popup.
- `documentation/engineering/UI/dialogs-and-modals.md:24` through
  `documentation/engineering/UI/dialogs-and-modals.md:27` name expected overlay
  rules: focus trap, return focus, escape/backdrop dismissal, scroll-lock,
  stacking, ARIA, and reduced motion.
- `documentation/engineering/UI/dialogs-and-modals.md:32` through
  `documentation/engineering/UI/dialogs-and-modals.md:39` list current honest
  gaps.

Current doc alignment:

- The doc is directionally correct that Clickeen has several overlay families.
- The doc's Roma parallel claim is verified by current code in this audit.
- The doc's "upgrade popup" has current code evidence in Bob and Roma.
- The doc's system-rule section remains largely aspirational/TBD in current
  code and must not be treated as implemented.

Current doc drift:

- `documentation/engineering/UI/dialogs-and-modals.md:18` through
  `documentation/engineering/UI/dialogs-and-modals.md:19` say Roma convergence
  is the system 126D retires. Current MAMA assigns 126D to typography and 126K
  to dialogs-and-modals.
- `documentation/engineering/UI/README.md:31` labels dialogs-and-modals as
  `(126B/126D)`, which is stale against current MAMA 126K assignment.
- `documentation/engineering/UI/dialogs-and-modals.md:34` lists z-index values
  as `1, 2, 3, 12, 1000`. That is directionally true for Dieter component CSS,
  but incomplete for the broader 126K surface scope because Bob, Roma,
  DevStudio, and widget runtime add values including `40`, `70`, `80`, and
  `1000`.

Related living docs:

- `documentation/engineering/UI/accessibility.md:26` calls `bulk-edit` the
  `role="dialog" aria-modal="true"` modal pattern.
- `documentation/engineering/UI/accessibility.md:33` through
  `documentation/engineering/UI/accessibility.md:37` record inconsistent modal
  ARIA and unverified focus-trap/return-focus/scroll-lock.
- `documentation/engineering/UI/motion.md:34` through
  `documentation/engineering/UI/motion.md:39` point modal/popover enter-exit to
  this domain and note motion discipline is underdeveloped.

Compliance:

- The audit uses living docs as context only.
- Runtime files below own the current-state claims.

## 2. Dieter Full-Screen Modal Family

### 2.1 `bulk-edit` Is The Strongest Dieter Modal Pattern

`bulk-edit` has modal markup, ARIA, fixed backdrop CSS, Escape close, backdrop
click close, and initial focus.

Markup evidence:

- `dieter/components/bulk-edit/bulk-edit.html:17` defines the hidden modal
  wrapper.
- `dieter/components/bulk-edit/bulk-edit.html:18` puts
  `role="dialog" aria-modal="true" aria-label="{{title}}"` on the modal body.
- `dieter/components/bulk-edit/bulk-edit.html:19` through
  `dieter/components/bulk-edit/bulk-edit.html:24` define the modal header and
  close button.
- `dieter/components/bulk-edit/bulk-edit.html:25` defines the table host.
- `dieter/components/bulk-edit/bulk-edit.html:26` through
  `dieter/components/bulk-edit/bulk-edit.html:33` define cancel/save actions.

CSS evidence:

- `dieter/components/bulk-edit/bulk-edit.css:14` starts the modal backdrop.
- `dieter/components/bulk-edit/bulk-edit.css:15` sets `position: fixed`.
- `dieter/components/bulk-edit/bulk-edit.css:16` sets `inset: 0`.
- `dieter/components/bulk-edit/bulk-edit.css:17` sets the scrim color.
- `dieter/components/bulk-edit/bulk-edit.css:18` through
  `dieter/components/bulk-edit/bulk-edit.css:19` center the panel.
- `dieter/components/bulk-edit/bulk-edit.css:20` sets `z-index: 1000`.
- `dieter/components/bulk-edit/bulk-edit.css:23` through
  `dieter/components/bulk-edit/bulk-edit.css:25` hide the modal with
  `[hidden]`.
- `dieter/components/bulk-edit/bulk-edit.css:27` through
  `dieter/components/bulk-edit/bulk-edit.css:38` define the modal body surface.

Behavior evidence:

- `dieter/components/bulk-edit/bulk-edit.ts:307` through
  `dieter/components/bulk-edit/bulk-edit.ts:313` query the open button, modal,
  table, close/cancel/save buttons, and hidden field.
- `dieter/components/bulk-edit/bulk-edit.ts:329` defines `openModal`.
- `dieter/components/bulk-edit/bulk-edit.ts:331` sets `modal.hidden = false`.
- `dieter/components/bulk-edit/bulk-edit.ts:332` queries the first input.
- `dieter/components/bulk-edit/bulk-edit.ts:333` focuses the first input with
  `preventScroll`.
- `dieter/components/bulk-edit/bulk-edit.ts:334` adds a document keydown
  listener.
- `dieter/components/bulk-edit/bulk-edit.ts:337` defines `closeModal`.
- `dieter/components/bulk-edit/bulk-edit.ts:338` sets `modal.hidden = true`.
- `dieter/components/bulk-edit/bulk-edit.ts:339` removes the document keydown
  listener.
- `dieter/components/bulk-edit/bulk-edit.ts:342` through
  `dieter/components/bulk-edit/bulk-edit.ts:346` close on Escape with
  `preventDefault`.
- `dieter/components/bulk-edit/bulk-edit.ts:370` through
  `dieter/components/bulk-edit/bulk-edit.ts:372` wire open/close/cancel.
- `dieter/components/bulk-edit/bulk-edit.ts:373` through
  `dieter/components/bulk-edit/bulk-edit.ts:375` close when the backdrop itself
  is clicked.

As-built reading:

- `bulk-edit` is the closest current Dieter reference modal.
- It has initial focus but no verified focus trap.
- It closes on Escape and backdrop click.
- It does not show scroll-lock or return-focus code in the inspected lines.
- It uses raw `z-index: 1000`.

Compliance:

- The audit says "strongest current pattern", not "complete modal doctrine".

### 2.2 `object-manager` Is A Modal Sibling With ARIA And Behavior Gaps

`object-manager` has modal markup and CSS similar to `bulk-edit`, but its source
shape differs.

Source inventory:

- `dieter/components/object-manager/object-manager.css` exists.
- `dieter/components/object-manager/object-manager.html` exists.
- `dieter/components/object-manager/object-manager.js` exists.
- `dieter/components/object-manager/object-manager.spec.json` exists.
- `dieter/components/index.ts:1` labels component hydration exports.
- `dieter/components/index.ts:2` through `dieter/components/index.ts:18`
  export many hydrators, but not `hydrateObjectManager`.

Markup evidence:

- `dieter/components/object-manager/object-manager.html:38` defines the hidden
  modal wrapper.
- `dieter/components/object-manager/object-manager.html:39` defines
  `.diet-object-manager__modal-body` without `role`, `aria-modal`,
  `aria-label`, or `aria-labelledby`.
- `dieter/components/object-manager/object-manager.html:40` through
  `dieter/components/object-manager/object-manager.html:44` define the modal
  title.
- `dieter/components/object-manager/object-manager.html:45` defines the modal
  list host.
- `dieter/components/object-manager/object-manager.html:46` through
  `dieter/components/object-manager/object-manager.html:53` define cancel/save
  actions.

CSS evidence:

- `dieter/components/object-manager/object-manager.css:19` starts the modal
  backdrop.
- `dieter/components/object-manager/object-manager.css:20` sets
  `position: fixed`.
- `dieter/components/object-manager/object-manager.css:21` sets `inset: 0`.
- `dieter/components/object-manager/object-manager.css:22` sets the scrim
  color.
- `dieter/components/object-manager/object-manager.css:23` through
  `dieter/components/object-manager/object-manager.css:24` center the panel.
- `dieter/components/object-manager/object-manager.css:25` sets
  `z-index: 1000`.
- `dieter/components/object-manager/object-manager.css:28` through
  `dieter/components/object-manager/object-manager.css:30` hide the modal with
  `[hidden]`.
- `dieter/components/object-manager/object-manager.css:32` through
  `dieter/components/object-manager/object-manager.css:42` define the modal
  body surface.

Runtime evidence from built JS:

- `tokyo/product/dieter/components/object-manager/object-manager.js:145`
  defines `hydrateObjectManager`.
- `tokyo/product/dieter/components/object-manager/object-manager.js:155`
  queries `.diet-object-manager__modal`.
- `tokyo/product/dieter/components/object-manager/object-manager.js:339`
  starts the manage button click handler.
- `tokyo/product/dieter/components/object-manager/object-manager.js:381` sets
  `modal.hidden = false`.
- `tokyo/product/dieter/components/object-manager/object-manager.js:383`
  defines `close`.
- `tokyo/product/dieter/components/object-manager/object-manager.js:384` sets
  `modal.hidden = true`.
- `tokyo/product/dieter/components/object-manager/object-manager.js:392` wires
  cancel to close.
- `tokyo/product/dieter/components/object-manager/object-manager.js:393`
  through `tokyo/product/dieter/components/object-manager/object-manager.js:395`
  close on backdrop click.
- `tokyo/product/dieter/components/object-manager/object-manager.js:402`
  through `tokyo/product/dieter/components/object-manager/object-manager.js:405`
  attach `hydrateObjectManager` to `window.Dieter`.

As-built reading:

- The modal visual pattern is close to `bulk-edit`.
- The panel is missing dialog ARIA in source markup.
- The source index does not export a TS hydrator for `object-manager`, while a
  JS hydrator exists in the component directory and built Tokyo artifact.
- The inspected JS has open, close, save/cancel, and backdrop click behavior.
- The inspected JS does not show Escape close, initial focus, focus trap,
  return focus, or scroll-lock.
- The modal uses raw `z-index: 1000`.

Compliance:

- This is not treated as equal to `bulk-edit`.
- The audit does not "fix" the missing ARIA or lifecycle gaps.

## 3. Dieter Anchored Popover / Dialog Families

### 3.1 Shared `dropdownToggle` Engine

Several Dieter popover/dropdown controls share `createDropdownHydrator`.

Evidence:

- `dieter/components/shared/dropdownToggle.ts:1` through
  `dieter/components/shared/dropdownToggle.ts:9` define the config surface.
- `dieter/components/shared/dropdownToggle.ts:19` defines
  `createDropdownHydrator`.
- `dieter/components/shared/dropdownToggle.ts:29` defines `hostRegistry`.
- `dieter/components/shared/dropdownToggle.ts:30` defines
  `globalHandlersBound`.
- `dieter/components/shared/dropdownToggle.ts:32` through
  `dieter/components/shared/dropdownToggle.ts:43` toggle `data-state` and
  trigger `aria-expanded`.
- `dieter/components/shared/dropdownToggle.ts:59` through
  `dieter/components/shared/dropdownToggle.ts:62` toggle on trigger click.
- `dieter/components/shared/dropdownToggle.ts:68` through
  `dieter/components/shared/dropdownToggle.ts:70` bind global handlers once.
- `dieter/components/shared/dropdownToggle.ts:71` through
  `dieter/components/shared/dropdownToggle.ts:87` close open hosts on outside
  capture-phase pointerdown.
- `dieter/components/shared/dropdownToggle.ts:89` through
  `dieter/components/shared/dropdownToggle.ts:95` close open hosts on Escape.

What the shared engine does not show:

- No focus trap.
- No return focus on close.
- No scroll-lock.
- No stacking manager.
- No ARIA role assignment beyond trigger `aria-expanded`.
- No Escape `preventDefault`.

Compliance:

- The engine is recorded as a shared current behavior, not as a complete overlay
  system.

### 3.2 `dropdown-edit` Is A Dialog Popover Using `dropdownToggle`

Evidence:

- `dieter/components/dropdown-edit/dropdown-edit.html:1` defines a
  `.diet-popover-host`.
- `dieter/components/dropdown-edit/dropdown-edit.html:2` uses
  `role="button" aria-haspopup="dialog" aria-expanded="false"`.
- `dieter/components/dropdown-edit/dropdown-edit.html:7` defines a
  `.diet-popover` with `role="dialog"` and `aria-label`.
- `dieter/components/dropdown-edit/dropdown-edit.html:98` through
  `dieter/components/dropdown-edit/dropdown-edit.html:138` embed the nested
  link sheet/popaddlink markup.
- `dieter/components/dropdown-edit/dropdown-edit.ts:1` imports
  `createDropdownHydrator`.
- `dieter/components/dropdown-edit/dropdown-edit.ts:6` through
  `dieter/components/dropdown-edit/dropdown-edit.ts:22` create the host
  hydrator.
- `dieter/components/dropdown-edit/dropdown-edit.ts:13` focuses the editor on
  open.
- `dieter/components/dropdown-edit/dropdown-edit.ts:16` through
  `dieter/components/dropdown-edit/dropdown-edit.ts:20` clear selection and
  close the internal link sheet on close.

As-built reading:

- `dropdown-edit` has dialog semantics and shared outside/Escape close through
  `dropdownToggle`.
- It has initial focus to the editor.
- It has no `aria-modal`, focus trap, return focus, or scroll-lock in the
  inspected code.

### 3.3 Listbox Popovers Share Mechanics But Not Dialog Semantics

`dropdown-actions`, `dropdown-fill`, `dropdown-border`, and sibling dropdowns
share popover mechanics but use listbox semantics where appropriate.

Evidence:

- `dieter/components/dropdown-actions/dropdown-actions.html:11` through
  `dieter/components/dropdown-actions/dropdown-actions.html:17` define a
  button-like trigger with `aria-haspopup="listbox"`.
- `dieter/components/dropdown-actions/dropdown-actions.html:29` through
  `dieter/components/dropdown-actions/dropdown-actions.html:33` define a
  `role="listbox"` popover.
- `dieter/components/dropdown-actions/dropdown-actions.ts:5` through
  `dieter/components/dropdown-actions/dropdown-actions.ts:14` use
  `createDropdownHydrator`.
- `dieter/components/dropdown-fill/dropdown-fill.html:19` through
  `dieter/components/dropdown-fill/dropdown-fill.html:24` define a trigger with
  `aria-haspopup="listbox"`.
- `dieter/components/dropdown-fill/dropdown-fill.html:40` through
  `dieter/components/dropdown-fill/dropdown-fill.html:44` define a
  `role="listbox"` popover.
- `dieter/components/dropdown-fill/dropdown-fill.ts:55` through
  `dieter/components/dropdown-fill/dropdown-fill.ts:59` use
  `createDropdownHydrator`.
- `dieter/components/dropdown-border/dropdown-border.html:12` through
  `dieter/components/dropdown-border/dropdown-border.html:17` define a trigger
  with `aria-haspopup="listbox"`.
- `dieter/components/dropdown-border/dropdown-border.html:33` through
  `dieter/components/dropdown-border/dropdown-border.html:37` define a
  `role="listbox"` popover.

As-built reading:

- These are overlays, but they are not dialogs.
- A future overlay system cannot flatten all popovers into dialog semantics.
- They share outside/Escape close from `dropdownToggle`, but still lack the
  broader modal lifecycle items.

### 3.4 `dropdown-upload` Is A Dialog Popover Using `dropdownToggle`

Evidence:

- `dieter/components/dropdown-upload/dropdown-upload.html:22` through
  `dieter/components/dropdown-upload/dropdown-upload.html:28` define a trigger
  with `aria-haspopup="dialog"`.
- `dieter/components/dropdown-upload/dropdown-upload.html:38` defines a
  `.diet-popover` with `role="dialog"` and `aria-label`.
- `dieter/components/dropdown-upload/dropdown-upload.ts:50` through
  `dieter/components/dropdown-upload/dropdown-upload.ts:58` use
  `createDropdownHydrator`.
- `dieter/components/dropdown-upload/dropdown-upload.ts:53` through
  `dieter/components/dropdown-upload/dropdown-upload.ts:57` sync state from
  inputs on open.

As-built reading:

- `dropdown-upload` has dialog popover semantics.
- It does not focus a control on open in the inspected `onOpen`.

### 3.5 `textedit` Is Its Own Overlay Lifecycle

`textedit` does not use `dropdownToggle`; it rolls its own open/close and global
pointer behavior.

Markup/CSS evidence:

- `dieter/components/textedit/textedit.html:1` defines the host with
  `data-state="closed"`.
- `dieter/components/textedit/textedit.html:2` defines the trigger with
  `aria-haspopup="dialog"` and `aria-expanded="false"`.
- `dieter/components/textedit/textedit.html:13` defines the `.diet-popover`
  with `role="dialog"` and `aria-label="Edit text"`.
- `dieter/components/textedit/textedit.css:113` through
  `dieter/components/textedit/textedit.css:120` position the popover and set
  `z-index: 12`.
- `dieter/components/textedit/textedit.css:122` through
  `dieter/components/textedit/textedit.css:124` display the popover when open.
- `dieter/components/textedit/textedit.css:273` uses transition tokens for the
  link form.

Behavior evidence:

- `dieter/components/textedit/textedit.ts:23` defines a `states` map.
- `dieter/components/textedit/textedit.ts:24` defines module-level
  `activeState`.
- `dieter/components/textedit/textedit.ts:48` through
  `dieter/components/textedit/textedit.ts:54` bind global selectionchange,
  pointerdown, resize, and scroll handlers.
- `dieter/components/textedit/textedit.ts:60` through
  `dieter/components/textedit/textedit.ts:63` open/toggle on control click.
- `dieter/components/textedit/textedit.ts:119` through
  `dieter/components/textedit/textedit.ts:127` handle Enter/Escape only inside
  the link input.
- `dieter/components/textedit/textedit.ts:160` through
  `dieter/components/textedit/textedit.ts:179` open/close the host and maintain
  `aria-expanded`.
- `dieter/components/textedit/textedit.ts:167` focuses the editor on open.
- `dieter/components/textedit/textedit.ts:181` through
  `dieter/components/textedit/textedit.ts:188` close all textedit hosts.
- `dieter/components/textedit/textedit.ts:355` through
  `dieter/components/textedit/textedit.ts:362` close the popover on outside
  pointerdown.

As-built reading:

- `textedit` has dialog popover markup and initial editor focus.
- It has a separate outside-click engine from `dropdownToggle`.
- Escape closes only the link form when the link input has focus. The inspected
  file does not show a host-level Escape close for the textedit popover.
- It does not show focus trap, return focus, scroll-lock, or shared stacking.

### 3.6 `popaddlink` Is Nested Popover/Form Content, Not Its Own Overlay Host

Evidence:

- `dieter/components/popaddlink/popaddlink.html:1` defines
  `.diet-popaddlink.diet-popover`.
- `dieter/components/popaddlink/popaddlink.html:1` through
  `dieter/components/popaddlink/popaddlink.html:39` have no `role="dialog"` and
  no `aria-modal`.
- `dieter/components/popaddlink/popaddlink.ts:86` through
  `dieter/components/popaddlink/popaddlink.ts:89` emit cancel.
- `dieter/components/popaddlink/popaddlink.ts:91` through
  `dieter/components/popaddlink/popaddlink.ts:100` handle input Enter/Escape.
- `dieter/components/popaddlink/popaddlink.ts:101` through
  `dieter/components/popaddlink/popaddlink.ts:102` wire apply and close.

As-built reading:

- `popaddlink` is form content hosted inside other overlays.
- It should not be counted as an independent modal/dialog system.

### 3.7 Shared Popover CSS Is Animated And Stacked Locally

Evidence:

- `dieter/components/popover/popover.css:4` defines `.diet-popover-host`.
- `dieter/components/popover/popover.css:9` through
  `dieter/components/popover/popover.css:22` hide and position host child
  popovers.
- `dieter/components/popover/popover.css:16` sets `z-index: 12`.
- `dieter/components/popover/popover.css:19` through
  `dieter/components/popover/popover.css:20` transition opacity and transform
  with `--duration-base`.
- `dieter/components/popover/popover.css:24` through
  `dieter/components/popover/popover.css:29` show open popovers.
- `dieter/components/popover/popover.css:31` through
  `dieter/components/popover/popover.css:44` define the popover surface.

As-built reading:

- Popover motion exists.
- The inspected popover CSS has no local `prefers-reduced-motion` block.
- Popovers use a local z-index literal, not a named stacking token.

## 4. Roma Parallel Modal Family

Roma has its own `.roma-modal-backdrop`, `.roma-modal`, and
`.roma-modal__actions` classes.

CSS evidence:

- `roma/app/roma.css:678` starts `.roma-modal-backdrop`.
- `roma/app/roma.css:679` sets `position: fixed`.
- `roma/app/roma.css:680` sets `inset: 0`.
- `roma/app/roma.css:681` sets `z-index: 1000`.
- `roma/app/roma.css:682` through `roma/app/roma.css:684` center the panel and
  apply padding.
- `roma/app/roma.css:685` sets the scrim color.
- `roma/app/roma.css:688` through `roma/app/roma.css:697` define
  `.roma-modal`.
- `roma/app/roma.css:707` through `roma/app/roma.css:712` define
  `.roma-modal__actions`.

Usage evidence:

- `roma/components/widgets-domain.tsx:198` through
  `roma/components/widgets-domain.tsx:203` set an upgrade prompt on a 402
  create response.
- `roma/components/widgets-domain.tsx:237` through
  `roma/components/widgets-domain.tsx:241` set an upgrade prompt on a 402
  duplicate response.
- `roma/components/widgets-domain.tsx:302` through
  `roma/components/widgets-domain.tsx:306` set an upgrade prompt on a 402
  publish/unpublish response.
- `roma/components/widgets-domain.tsx:591` through
  `roma/components/widgets-domain.tsx:620` render an upgrade modal with
  `.roma-modal-backdrop`, `.roma-modal`, `role="dialog"`, `aria-modal="true"`,
  `aria-labelledby`, close, and billing link actions.
- `roma/app/api/account/instances/route.ts:55` through
  `roma/app/api/account/instances/route.ts:68` define an `UPGRADE_REQUIRED`
  402 response for create-instance limits.
- `roma/app/api/account/instances/route.ts:158` through
  `roma/app/api/account/instances/route.ts:165` return that 402 when the
  widget instance limit is reached.
- `roma/app/api/account/instances/[instanceId]/duplicate/route.ts:45` through
  `roma/app/api/account/instances/[instanceId]/duplicate/route.ts:58` define
  an `UPGRADE_REQUIRED` 402 response for duplicate-instance limits.
- `roma/app/api/account/instances/[instanceId]/duplicate/route.ts:114` through
  `roma/app/api/account/instances/[instanceId]/duplicate/route.ts:122` return
  that 402 when the duplicate would exceed the widget instance limit.
- `roma/app/api/account/instances/[instanceId]/publish/route.ts:33` through
  `roma/app/api/account/instances/[instanceId]/publish/route.ts:46` define an
  `UPGRADE_REQUIRED` 402 response for publish limits.
- `roma/app/api/account/instances/[instanceId]/publish/route.ts:100` through
  `roma/app/api/account/instances/[instanceId]/publish/route.ts:108` return
  that 402 when publishing would exceed the published instance limit.
- `roma/components/pages-domain.tsx:940` through
  `roma/components/pages-domain.tsx:1001` render an Add instances modal with
  `.roma-modal-backdrop`, `.roma-modal`, `role="dialog"`, `aria-modal="true"`,
  and a table picker.
- `roma/components/assets-domain.tsx:426` through
  `roma/components/assets-domain.tsx:461` render a Bulk upload modal with
  `.roma-modal-backdrop`, `.roma-modal`, `role="dialog"`, `aria-modal="true"`,
  and status table.
- `roma/components/roma-account-notice-modal.tsx:85` through
  `roma/components/roma-account-notice-modal.tsx:108` render an account notice
  modal with `.roma-modal-backdrop`, `.roma-modal`, `role="dialog"`,
  `aria-modal="true"`, settings link, and dismiss action.

As-built reading:

- Roma parallel modal CSS is verified.
- Roma modal markup generally includes dialog ARIA.
- The inspected Roma modals do not show shared focus trap, return focus,
  Escape close, backdrop click close, or scroll-lock.
- Roma modal backdrop uses raw `z-index: 1000`.
- Roma uses Dieter buttons inside local modal containers.
- The widget upgrade modal is driven by API 402 upgrade responses, not by a
  local-only UI condition.

Compliance:

- This is 126K evidence only. It does not execute the later 126M Roma
  convergence.

## 5. Bob Overlay And Modal-Like Surfaces

### 5.1 Bob Upsell Popup

Bob has a local upsell dialog component.

Evidence:

- `bob/components/UpsellPopup.tsx:13` defines `UpsellPopup`.
- `bob/components/UpsellPopup.tsx:16` through
  `bob/components/UpsellPopup.tsx:19` focus the close button when opened.
- `bob/components/UpsellPopup.tsx:21` through
  `bob/components/UpsellPopup.tsx:30` close on Escape with `preventDefault`.
- `bob/components/UpsellPopup.tsx:38` renders a presentation overlay with
  `onMouseDown={onClose}`.
- `bob/components/UpsellPopup.tsx:40` through
  `bob/components/UpsellPopup.tsx:44` render `.ck-upsellModal` with
  `role="dialog"`, `aria-modal="true"`, `aria-label`, and click isolation.
- `bob/components/UpsellPopup.tsx:52` through
  `bob/components/UpsellPopup.tsx:77` render upgrade and close actions.
- `bob/components/BuilderApp.tsx:13` through `bob/components/BuilderApp.tsx:24`
  host `UpsellPopup` from session upsell state.

CSS evidence:

- `bob/app/bob_app.css:560` through `bob/app/bob_app.css:569` define the fixed
  `.ck-upsellOverlay`.
- `bob/app/bob_app.css:563` sets `z-index: 1000`.
- `bob/app/bob_app.css:571` through `bob/app/bob_app.css:581` define
  `.ck-upsellModal`.

As-built reading:

- Bob upsell has ARIA modal semantics, initial focus, Escape close, and
  backdrop mouse-down close.
- It does not show focus trap, return focus, or scroll-lock.
- It uses Bob-local classes and raw `z-index: 1000`.

### 5.2 Bob Workspace Status Overlays

Bob workspace has status/error overlays that are not dialogs.

Evidence:

- `bob/components/Workspace.tsx:395` through `bob/components/Workspace.tsx:398`
  render loading preview status with `role="status"` and `aria-live="polite"`.
- `bob/components/Workspace.tsx:400` through `bob/components/Workspace.tsx:403`
  render preview error with `role="alert"`.
- `bob/components/Workspace.tsx:405` through `bob/components/Workspace.tsx:408`
  render switcher notice with `role="status"` and `aria-live="polite"`.
- `bob/app/bob_app.css:466` through `bob/app/bob_app.css:474` style
  `.workspace-status-overlay`.
- `bob/app/bob_app.css:476` through `bob/app/bob_app.css:478` style the error
  variant.

As-built reading:

- These are overlays by position, but not modal/dialog overlays.
- They use status/alert semantics and pointer-events none.

### 5.3 Bob ToolDrawer Alert And Modal-Work Guard

Bob ToolDrawer detects transient modal/upload work and blocks panel switching
with inline alerts.

Evidence:

- `bob/components/ToolDrawer.tsx:92` defines `hasTransientEditorWork`.
- `bob/components/ToolDrawer.tsx:96` through
  `bob/components/ToolDrawer.tsx:102` check for active uploading,
  `[data-bulk-modal]:not([hidden])`, and
  `.diet-object-manager__modal:not([hidden])`.
- `bob/components/ToolDrawer.tsx:129` through
  `bob/components/ToolDrawer.tsx:135` block drawer context switching with the
  message `Finish the current upload or modal edit before switching panels.`
- `bob/components/ToolDrawer.tsx:276` through
  `bob/components/ToolDrawer.tsx:294` render session errors with
  `role="alert"`.
- `bob/components/ToolDrawer.tsx:295` through
  `bob/components/ToolDrawer.tsx:310` render the switch-block message with
  `role="alert"`.

As-built reading:

- Bob already knows some transient overlay work is unsafe to interrupt.
- This is local ToolDrawer logic, not a shared overlay contract.

### 5.4 Bob Publish Modal CSS Exists

Bob app CSS also defines `.ck-publishOverlay` and `.ck-publishModal`.

Evidence:

- `bob/app/bob_app.css:603` through `bob/app/bob_app.css:612` define
  `.ck-publishOverlay` with fixed inset overlay and `z-index: 1000`.
- `bob/app/bob_app.css:614` through `bob/app/bob_app.css:625` define
  `.ck-publishModal`.

As-built reading:

- CSS exists for a publish modal family.
- This audit did not find a corresponding component in the targeted reads, so
  current runtime usage remains unverified here.

## 6. DevStudio Modal-Like Surface

DevStudio has a token editor overlay built imperatively in `admin/src/main.ts`.

Evidence:

- `admin/src/main.ts:337` defines `openTokenEditor`.
- `admin/src/main.ts:340` creates a `div`.
- `admin/src/main.ts:341` assigns `devstudio-token-editor`.
- `admin/src/main.ts:343` through `admin/src/main.ts:367` inject a `form`
  panel with heading, close button, token select, value input, diff live region,
  cancel, and confirm commit.
- `admin/src/main.ts:369` appends the overlay to `document.body`.
- `admin/src/main.ts:371` hydrates icons in the overlay.
- `admin/src/main.ts:379` through `admin/src/main.ts:385` close on overlay
  click or close controls.
- `admin/src/css/utilities.css:56` through `admin/src/css/utilities.css:64`
  define `.devstudio-token-editor` as a fixed full-screen overlay with
  `z-index: 40`.
- `admin/src/css/utilities.css:66` through
  `admin/src/css/utilities.css:75` define the panel surface.
- `admin/src/css/utilities.css:107` through
  `admin/src/css/utilities.css:110` define focus outlines for the editor's
  select/input.
- `admin/src/css/utilities.css:140` through
  `admin/src/css/utilities.css:144` include a global reduced-motion override in
  utilities CSS.

As-built reading:

- DevStudio's token editor is an overlay, but its injected panel has no
  `role="dialog"` or `aria-modal` in the inspected markup.
- It closes on backdrop/close controls.
- It does not show Escape close, focus trap, return focus, or scroll-lock in
  the inspected code.
- It uses `z-index: 40`, separate from Dieter/Roma/Bob `1000` modal literals
  and Dieter popover `12`.

## 7. Browser-Native Confirmation Paths

Roma still uses browser-native confirmation for unsaved-work navigation guards.

Evidence:

- `roma/components/builder-domain.tsx:831` starts an effect for unsaved Builder
  navigation.
- `roma/components/builder-domain.tsx:832` defines `confirmDiscard`.
- `roma/components/builder-domain.tsx:834` calls `window.confirm`.
- `roma/components/builder-domain.tsx:837` through
  `roma/components/builder-domain.tsx:841` handle beforeunload.
- `roma/components/builder-domain.tsx:843` through
  `roma/components/builder-domain.tsx:852` intercept navigation clicks.
- `roma/components/builder-domain.tsx:854` through
  `roma/components/builder-domain.tsx:863` handle popstate.
- `roma/components/widget-defaults-domain.tsx:406` through
  `roma/components/widget-defaults-domain.tsx:418` intercept link clicks while
  defaults are dirty and call `window.confirm`.

As-built reading:

- These are confirmation flows, but not Clickeen-styled modals.
- They are outside Dieter/Roma modal components and browser-owned.

## 8. Stacking And Motion Current Reality

Stacking scan summary across targeted overlay files:

- Dieter full-screen modal literal: `z-index: 1000` in `bulk-edit.css`.
- Dieter object-manager modal literal: `z-index: 1000` in
  `object-manager.css`.
- Dieter popover literal: `z-index: 12` in `popover.css` and `textedit.css`.
- Roma modal literal: `z-index: 1000` in `roma.css`.
- Bob upsell/publish overlay literal: `z-index: 1000` in `bob_app.css`.
- DevStudio token editor literal: `z-index: 40` in `utilities.css`.
- Widget runtime social share root literal: `z-index: 80` in
  `tokyo/product/widgets/shared/socialShare.css`.
- Widget runtime social share toast literal: `z-index: 70` in
  `tokyo/product/widgets/shared/socialShare.css`.
- Widget runtime locale switcher literal: `z-index: 80` in
  `tokyo/product/widgets/shared/localeSwitcher.css`.
- Widget runtime fixed top/bottom stage literal: `z-index: 1000` in
  `tokyo/product/widgets/shared/stagePod.css`.

Motion/reduced-motion scan summary:

- `dieter/components/popover/popover.css:19` through
  `dieter/components/popover/popover.css:20` animate opacity and transform.
- `dieter/components/textedit/textedit.css:273` animates link-form opacity,
  transform, height, and margin.
- Targeted overlay CSS did not show local `prefers-reduced-motion` blocks in
  Dieter overlay files.
- `admin/src/css/utilities.css:140` through
  `admin/src/css/utilities.css:144` has a DevStudio global reduced-motion
  override.

As-built reading:

- Stacking is not centralized.
- Overlay motion is partly tokenized through duration tokens but not consistently
  governed by overlay-specific reduced-motion handling.

## 9. Widget Runtime Layered Menus And Status

Tokyo widget runtime has layered share/locale/stage surfaces that are not
Clickeen modals.

Evidence:

- `tokyo/product/widgets/shared/socialShare.js:141` starts social share markup.
- `tokyo/product/widgets/shared/socialShare.js:143` renders a toast with
  `role="status"` and `aria-live="polite"`.
- `tokyo/product/widgets/shared/socialShare.js:145` uses a `details` host.
- `tokyo/product/widgets/shared/socialShare.js:147` renders the share menu with
  `role="menu"` and `aria-label="Share"`.
- `tokyo/product/widgets/shared/socialShare.js:483` through
  `tokyo/product/widgets/shared/socialShare.js:488` close the details menu on
  outside click.
- `tokyo/product/widgets/shared/socialShare.js:489` through
  `tokyo/product/widgets/shared/socialShare.js:491` close on Escape.
- `tokyo/product/widgets/shared/socialShare.css:5` through
  `tokyo/product/widgets/shared/socialShare.css:8` set the social share layer
  to `position: absolute` and `z-index: 80`.
- `tokyo/product/widgets/shared/socialShare.css:279` through
  `tokyo/product/widgets/shared/socialShare.css:284` position the social share
  toast with `z-index: 70`.
- `tokyo/product/widgets/shared/localeSwitcher.css:1` through
  `tokyo/product/widgets/shared/localeSwitcher.css:4` position the locale
  switcher with `z-index: 80`.
- `tokyo/product/widgets/shared/stagePod.css:38` through
  `tokyo/product/widgets/shared/stagePod.css:43` set fixed top/bottom stage
  positioning with `z-index: 1000`.

As-built reading:

- Widget runtime has layered menus and status surfaces.
- These are not dialogs or modals, but they share the broader stacking/layering
  concern of 126K.
- They add more raw z-index values outside Dieter/Roma/Bob/Admin.

## 10. Current Known Gaps Only

These are gaps found in current reality. They are not fixes.

- No declared shared overlay system currently owns all modal/dialog/popover
  semantics.
- `bulk-edit` is strongest but still lacks verified focus trap, return focus,
  and scroll-lock.
- `object-manager` source markup lacks dialog ARIA.
- `object-manager` current inspected JS lacks Escape close and initial focus.
- `dropdownToggle` gives shared outside-click and Escape behavior but not a
  full modal lifecycle.
- `dropdownToggle` Escape close does not call `preventDefault`, unlike
  `bulk-edit`.
- `textedit` has a separate outside-click engine and no inspected host-level
  Escape close.
- `popaddlink` is nested content, not an independent overlay family.
- Listbox popovers must remain semantically distinct from dialog popovers.
- Roma modals are verified as a parallel local modal family.
- Bob upsell is another local modal family.
- DevStudio token editor is an overlay without inspected dialog ARIA.
- Browser-native `window.confirm` remains in Roma unsaved-work guards.
- z-index values are raw and disconnected across surfaces.
- Overlay reduced-motion handling is not consistently local to overlay CSS.
- Living UI docs have stale 126 labels for dialogs/modals and Roma convergence.
- Widget runtime layering is outside the current Dialogs doc z-index snapshot.

## 11. Explicit Non-Decisions

- No decision to create a shared `Modal` component.
- No decision to migrate Roma modals.
- No decision to change `window.confirm` flows.
- No decision to change Bob upsell.
- No decision to change DevStudio token editor.
- No decision to add focus trap, scroll-lock, or return-focus behavior.
- No decision to change z-index tokens.
- No decision to rewrite popovers.
- No code changes.
- No Step 4+ convergence.

## 12. Compliance Check

Architecture compliance:

- Keeps Dieter, Roma, Bob, and DevStudio overlay families distinct as current
  state.
- Does not flatten listbox popovers into dialog semantics.
- Does not convert local overlays into a shared abstraction in step 1.

Product compliance:

- No UI redesign.
- No product behavior changes.
- No save/translation/account/deploy path changes.
- Upgrade and unsaved-work modal flows are recorded, not changed.

Product-law compliance:

- No code changes.
- No product data changes.
- No managed-service changes.
- No AI convergence with GLM.
- No Step 4 human convergence.
- No machinery added to enforce an interpretation.

## 13. V1-V8 Pre-Execution Audit

This is documentation only and did not execute product behavior. Content check:

- V1 Silent substitution: avoided. Separate overlay families are recorded
  instead of replaced by an invented unified system.
- V2 Silent healing: avoided. Missing ARIA/focus/scroll behavior is named, not
  repaired in prose.
- V3 Silent omission: avoided. Roma, Bob, DevStudio, browser confirm, listbox
  popovers, and nested popaddlink are included.
- V4 Fail-open control: not applicable; no controls changed.
- V5 Corruption-as-absence: avoided. Unverified runtime usage is marked as
  unverified rather than absent.
- V6 Partial-success masquerade: avoided. `bulk-edit` is strongest but not
  called complete.
- V7 Masquerade/redress: avoided. Browser confirm and local modal families are
  not renamed as Dieter convergence.
- V8 Runtime test dependency: not applicable; no runtime probes or tests were
  added.
