# 126A Accessibility - Codex As-Built Audit

Status: CODEX ONLY - Phase 1 Step 1 as-built audit.

Scope: current Clickeen accessibility implementation across Dieter, Bob, Roma,
DevStudio, and public widget runtime evidence found in source/docs. This file
does not define doctrine, does not converge with GLM, does not propose fixes,
and does not execute Step 4+.

Authority boundary:

- Product surface inspected: Dieter UI substrate, Bob builder shell, Roma app
  shell, DevStudio token/editor surfaces, selected Tokyo public widget runtime.
- Account/session/storage/route/runtime/deploy authorities: not touched.
- Product data: not touched.
- Verification surface: local source and current documentation inspection only.

## Executive Current Reality

Clickeen has useful accessibility substrate, but not an accessibility-complete
system contract.

The substrate exists in Dieter tokens and some component implementations:
focus/touch tokens, `.sr-only`, reduced-motion guard, native form controls in
several surfaces, live regions in Bob, and ARIA patterns in tabs, dropdown
menus, choice tiles, and some dialogs. The codebase also openly documents major
accessibility unknowns in `documentation/engineering/UI/accessibility.md` and
`documentation/engineering/UI/dialogs-and-modals.md`.

The main current gaps are not philosophical. They are concrete:

- Focus visibility is inconsistent. Some important components explicitly remove
  focus visuals.
- Keyboard operability is component-by-component, not system-wide.
- Dropdown triggers are often `div role="button"` without `tabindex`, so the
  semantic role does not make them keyboard reachable.
- Dialogs/modals do not share a complete modal behavior contract. Some have
  ARIA and initial focus; focus trap, return focus, scroll lock, and inert
  outside content are not established.
- A 44px touch target token exists, but the control-size ladder and many
  controls are smaller. Adoption is not proven or enforced.
- Contrast tokens exist, but there is no recorded formal contrast audit across
  actual foreground/background pairings.
- Reduced-motion foundation exists, but coverage is not proven for all local
  transitions.

## Current Documentation Evidence

`documentation/engineering/UI/accessibility.md` is mostly honest about current
state. It records:

- Source authority for accessibility evidence as Dieter tokens and component
  HTML/TS.
- Current foundations: focus ring tokens, minimum touch target token,
  `.sr-only`, reduced-motion guard, contrast token variants.
- Verified component semantics for tabs, dropdown-shadow family, bulk-edit,
  and textedit/dropdown-edit.
- Known gaps: no formal WCAG audit, inconsistent modal ARIA, no verified focus
  trap/return focus/scroll lock, keyboard navigation largely unverified, and
  minimum touch target adoption unverified.

`documentation/engineering/UI/dialogs-and-modals.md` is also honest about
modal limits. It identifies:

- `bulk-edit` as the strongest current modal example because it has
  `role="dialog"` and `aria-modal="true"`.
- `object-manager` as modal-like markup without equivalent ARIA semantics.
- Textedit and dropdown-edit as dialog popover patterns.
- Missing shared rules for focus trap, return focus, Escape/backdrop behavior,
  scroll lock, z-index stacking, and reduced motion.

The drift risk is wording. Calling `bulk-edit` a correct pattern can overstate
what exists. The code proves dialog semantics, first-input focus, Escape close,
and backdrop close. It does not prove a complete modal accessibility contract.

## Foundation Tokens And Utilities

### Control Size Ladder

Evidence: `dieter/tokens/dieter-foundation-tokens.css:27-32`.

Current ladder:

- `--control-size-xs: 1rem` = 16px.
- `--control-size-sm: 1.25rem` = 20px.
- `--control-size-md: 1.5rem` = 24px.
- `--control-size-lg: 1.75rem` = 28px.
- `--control-size-xl: 2rem` = 32px.

As-built implication: normal Dieter control sizes are dense. They are smaller
than the separate 44px touch target token. That is not automatically wrong for
desktop builder density, but it means touch target compliance cannot be
claimed from the control ladder.

### Focus And Ergonomic Tokens

Evidence: `dieter/tokens/dieter-foundation-tokens.css:74-77`.

Current tokens:

- `--focus-ring-width: 2px`
- `--focus-ring-offset: 2px`
- `--min-touch-target: 2.75rem` = 44px

Evidence: `dieter/tokens/dieter-color-tokens.css:18`.

Current color token:

- `--focus-ring-color`

As-built implication: the system has centralized values for focus rings and
touch target size. The audit did not find a system-wide enforcement layer that
forces every actionable control to use them.

### Screen Reader Utility

Evidence: `dieter/tokens/dieter-foundation-tokens.css:91-96`.

Current utility:

- `.sr-only` hides visual text while keeping it available to assistive
  technology.

Known consumers include tabs, segmented controls, Bob device controls, and
places where visual-only controls need an accessible text name.

### Reduced Motion

Evidence: `dieter/tokens/dieter-foundation-tokens.css:98-105`.

Current global guard:

- Under `prefers-reduced-motion: reduce`, animations and transitions are
  shortened and smooth scrolling is disabled.

As-built implication: there is a global foundation. This does not prove every
surface avoids motion-dependent meaning, avoids raw local transitions, or has
component-specific reduced-motion behavior where needed.

## Component Evidence Matrix

| Surface | Strong current evidence | Current gap / unknown |
| --- | --- | --- |
| Dieter tokens | Focus, touch target, screen-reader, reduced-motion tokens exist. | Adoption and enforcement are not proven. |
| Tabs | Tablist, tab roles, `aria-selected`, roving tabindex, arrow keys. | Focus visuals are explicitly removed in CSS. |
| Segmented | Native radios, radiogroup, screen-reader labels. | Nested button inside label, `aria-pressed` mirrored on button, no arrow-key handler found. |
| Choice tiles | Radiogroup/radio roles, `aria-checked`, click and arrow focus movement. | Arrow keys move focus but do not select; only supports 2-3 options. |
| Buttons | Native `<button>` template, disabled support, optional aria-label. | Dense heights below 44px; focus visuals removed in several button families. |
| Textfields | Native input inside label, wrapper focuses input. | Dense heights below 44px; field outline removed; reduced-motion selector may not target all transitioning elements. |
| Toggle | Native checkbox with `role="switch"` and labelled visible switch. | Visible switch key handler appears attached to non-tabbable element; focus visuals removed. |
| Shared dropdowns | `aria-expanded`, outside click close, Escape close. | No open-on-key, no trigger return focus, no focus trap, no arrow navigation in shared helper. |
| Dropdown actions | Listbox/options and selected-state sync. | Trigger is `div role=button` without tabindex; no listbox arrow navigation found. |
| Fill/border/shadow popovers | Many sliders/inputs have aria-labels; some swatches sync `aria-pressed`. | Header triggers are not keyboard reachable; swatches often lack per-color accessible names. |
| Upload popover | Dialog role, labelled trigger, hidden file input, validation errors. | Error/name text not announced by live region; preview image has empty alt, which is only correct if decorative. |
| Bulk edit modal | Dialog ARIA, initial focus, Escape close, backdrop close. | No focus trap, return focus, scroll lock, or inert outside content found. |
| Object manager modal | Real buttons for actions; backdrop/modal structure. | No `role=dialog`, no `aria-modal`, no focus management, no Escape handling found in inspected path. |
| Textedit popover | Trigger has dialog semantics; popover role dialog; editor focused on open. | Main popover close does not return focus; Escape behavior is partial; link input lacks visible programmatic label in inline form. |
| Bob Workspace | Iframe title, status live regions, error alert, radiogroup device switch. | Segmented pattern inherits nested control concerns. |
| Bob Upsell | Dialog role, aria-modal, initial close-button focus, Escape close. | No focus trap or return focus found. |
| Roma | Nav landmarks/aria-current; forms use native controls; inputs have focus style. | Some error boundary UI lacks alert/status semantics; modal focus contract not proven. |
| DevStudio | Token editor diff uses `aria-live`; token edit buttons get aria-labels; inputs have focus style. | Token editor is modal-like without proved dialog semantics/focus management; nav focus outline removed. |
| Public widgets | Some widgets use native buttons and FAQ accordion ARIA. | Carousel tablist/dot semantics and target sizes are inconsistent. |

## Dieter Components

### Tabs

Evidence:

- `dieter/components/tabs/tabs.html:1` declares `role="tablist"`.
- `dieter/components/tabs/tabs.html:2`, `:7`, and `:13` use hidden radio
  inputs with `.sr-only`.
- `dieter/components/tabs/tabs.ts:1-14` assigns label role `tab`,
  `aria-selected`, and roving `tabindex`.
- `dieter/components/tabs/tabs.ts:29-54` handles ArrowRight, ArrowDown,
  ArrowLeft, and ArrowUp.
- `dieter/components/tabs/tabs.css:46`, `:57`, and `:62` set tab heights
  around 20-28px depending on size.
- `dieter/components/tabs/tabs.css:88` states focus visuals are removed per
  design.
- `dieter/components/tabs/tabs.css:97-100` includes reduced-motion handling.

As-built read: tabs are one of the stronger semantic/keyboard components, but
they are not a complete accessibility proof because focus visibility is
explicitly removed and touch target sizing is below 44px.

### Segmented Controls

Evidence:

- `dieter/components/segmented/segmented.html:1` declares
  `role="radiogroup"`.
- `dieter/components/segmented/segmented.html:4` uses native radio inputs.
- `dieter/components/segmented/segmented.html:6` nests a real button with
  `tabindex="-1"` inside the label.
- `dieter/components/segmented/segmented.html:10` supports screen-reader label
  text.
- `dieter/components/segmented/segmented.ts:1-7` mirrors radio checked state to
  `aria-pressed` on the internal button.
- `dieter/components/segmented/segmented.ts:9-23` installs change listeners.
- `dieter/components/segmented/segmented.css:159-167` overlays the invisible
  radio input across the segment.
- `dieter/components/segmented/segmented.css:184-200` uses 24/28/32px segment
  heights.
- `dieter/components/segmented/segmented.css:223` states focus state is removed
  per design.
- `dieter/components/segmented/segmented.css:258-263` has reduced-motion
  handling.

As-built read: segmented controls are not plain broken markup; native radios
exist. The risk is mixed semantics: a radio-driven component also contains a
button with `aria-pressed`. That can confuse audit expectations unless the
final doctrine decides this pattern is acceptable or replaces it.

### Choice Tiles

Evidence:

- `dieter/components/choice-tiles/choice-tiles.html:10` declares a
  radiogroup.
- `dieter/components/choice-tiles/choice-tiles.html:12-18` uses button
  elements with `role="radio"` and `aria-checked`.
- `dieter/components/choice-tiles/choice-tiles.html:20-23` marks decorative
  icons `aria-hidden`.
- `dieter/components/choice-tiles/choice-tiles.ts:24-30` only creates state
  when there are 2-3 options.
- `dieter/components/choice-tiles/choice-tiles.ts:59-68` commits selection on
  click and updates the hidden input.
- `dieter/components/choice-tiles/choice-tiles.ts:70-78` handles ArrowLeft and
  ArrowRight by moving focus.
- `dieter/components/choice-tiles/choice-tiles.ts:85-91` syncs selected class,
  `aria-checked`, and `data-selected`.
- `dieter/components/choice-tiles/choice-tiles.css:35` gives tiles a minimum
  block size around 82px.

As-built read: choice tiles are relatively strong for semantics and target
size. The exact keyboard behavior is focus movement, not selection on arrow.
That may be acceptable or not depending on final doctrine.

### Buttons

Evidence:

- `dieter/components/button/button.html:1` renders a native `<button>` with
  optional `aria-label`, disabled state, tabIndex, and path bindings.
- `dieter/components/button/button.html:3` renders the icon span without an
  explicit `aria-hidden` in the base template.
- `dieter/components/button/button.css:23`, `:45`, `:51`, `:57`, `:63`, and
  `:69` size icon/text buttons from the dense control ladder.
- `dieter/components/button/button.css:137`, `:270`, and `:430` state focus
  visuals are removed per design across button families.
- `dieter/components/button/button.ts:1-8` only ensures button type. It does
  not add accessibility behavior.

As-built read: the base button has native button semantics, which is good.
The gaps are focus visibility, touch target sizing, and possible icon
exposure if consumers do not hide decorative icons themselves.

### Textfields

Evidence:

- `dieter/components/textfield/textfield.html:2-11` wraps the input in a label.
- `dieter/components/textfield/textfield.html:7` also sets `aria-label`.
- `dieter/components/textfield/textfield.css:33`, `:99`, `:113`, and `:127`
  set dense control sizes around 20/24/28px.
- `dieter/components/textfield/textfield.css:48-52` uses focus-within visual
  background/border state.
- `dieter/components/textfield/textfield.css:71` removes native input outline.
- `dieter/components/textfield/textfield.css:139-141` has a reduced-motion rule
  for `.diet-textfield__field`.
- `dieter/components/textfield.ts:9-24` focuses the input from wrapper pointer
  and click paths.
- `dieter/components/textfield.ts:26-31` blurs the input on Enter.

As-built read: textfields have programmatic labeling and native input behavior.
The control heights are dense, and the reduced-motion selector may not cover
all elements that transition in the component.

### Toggle

Evidence:

- `dieter/components/toggle/toggle.html:1-13` uses a label, hidden checkbox,
  `role="switch"`, `aria-labelledby`, `.sr-only`, and a visible switch marked
  `aria-hidden`.
- `dieter/components/toggle/toggle.ts:8-13` toggles the hidden input on Enter.
- `dieter/components/toggle/toggle.ts:15-24` installs a keydown handler on the
  visible switch label.
- `dieter/components/toggle/toggle.css:22` and `:36-49` size the container and
  rail from dense values.
- `dieter/components/toggle/toggle.css:117` states focus visuals are removed.
- `dieter/components/toggle/toggle.css:126-129` includes reduced-motion
  handling.

As-built read: native checkbox and switch semantics exist. The visible switch
keyboard handler appears to target an element that is not made tabbable by the
inspected markup, so the reliable keyboard path is the hidden native input.

### Shared Dropdown Host

Evidence:

- `dieter/components/shared/dropdownToggle.ts:32-43` opens/closes and updates
  `aria-expanded`.
- `dieter/components/shared/dropdownToggle.ts:59-62` toggles on click.
- `dieter/components/shared/dropdownToggle.ts:71-87` closes on outside
  pointerdown.
- `dieter/components/shared/dropdownToggle.ts:89-95` closes on Escape.

As-built read: the shared helper handles open state and closing. It does not
make a non-native trigger focusable, does not open on Enter/Space, does not
provide arrow-key listbox behavior, does not trap focus, and does not return
focus to the trigger after global Escape/outside close.

### Dropdown Actions

Evidence:

- `dieter/components/dropdown-actions/dropdown-actions.html:11-17` uses a
  `div` trigger with `role="button"`, `aria-haspopup="listbox"`,
  `aria-expanded`, and optional `aria-labelledby`.
- No `tabindex` is present on that trigger in the inspected template.
- `dieter/components/dropdown-actions/dropdown-actions.html:29-34` renders the
  popover as `role="listbox"` with an accessible label.
- `dieter/components/dropdown-actions/dropdown-actions.html:45-56` renders each
  option as a native button with `role="option"` and optional `aria-selected`.
- `dieter/components/dropdown-actions/dropdown-actions.html:63-71` hides the
  checkmark icon from assistive technology.
- `dieter/components/dropdown-actions.ts:5-14` uses the shared dropdown
  hydrator.
- `dieter/components/dropdown-actions.ts:104-181` handles menu option clicks.
- `dieter/components/dropdown-actions.ts:172-180` returns focus indirectly by
  clicking/focusing the trigger after commit in one path.
- `dieter/components/dropdown-actions.ts:224-251` commits pending changes and
  focuses trigger in that path.
- `dieter/components/dropdown-actions.ts:254-268` cancels pending changes and
  focuses trigger in that path.
- `dieter/components/dropdown-actions.ts:283-297` syncs display and
  `aria-selected`.

As-built read: listbox semantics exist, but the trigger is not normally
keyboard reachable because it is a `div role=button` without tabindex. Return
focus exists in some component-specific close paths, not in the shared close
contract.

### Fill, Border, And Shadow Popovers

Evidence:

- `dieter/components/dropdown-fill/dropdown-fill.html:19-25` uses a
  `div role="button"` trigger with listbox semantics and no tabindex in the
  inspected template.
- `dieter/components/dropdown-fill/dropdown-fill.html:40-44` renders the
  popover as `role="listbox"`.
- `dieter/components/dropdown-fill/dropdown-fill.html:63-106` uses mode
  buttons with `aria-label` and `aria-pressed`; icons are hidden.
- `dieter/components/dropdown-fill/dropdown-fill.html:110-112` uses an
  accessible native color input.
- `dieter/components/dropdown-fill/dropdown-fill.html:121-140` labels hue and
  opacity range inputs.
- `dieter/components/dropdown-fill.ts:587-594` syncs swatch `aria-pressed`.
- `dieter/components/dropdown-border/dropdown-border.html:12-18` uses a
  similar `div role="button"` trigger.
- `dieter/components/dropdown-border/dropdown-border.html:56-58`,
  `:70-77`, and `:85-96` label color/range/hex inputs.
- `dieter/components/dropdown-border/dropdown-border.html:101-160` renders
  swatches with `aria-pressed` but no per-color accessible label in the
  inspected lines.
- `dieter/components/dropdown-border.html:165-174` includes an embedded switch
  pattern.
- `dieter/components/dropdown-shadow/dropdown-shadow.html:17-23` uses the same
  trigger pattern.
- `dieter/components/dropdown-shadow.html:61-63`, `:75-82`, and `:90-101`
  label color/range/hex inputs.
- `dieter/components/dropdown-shadow.html:106-167` renders swatches with
  `aria-pressed` but no per-color accessible label in the inspected lines.

As-built read: the internal controls are often labelled, especially sliders and
color inputs. The shared trigger pattern still blocks keyboard reachability for
the popover itself unless some outer consumer adds focusability.

### Dropdown Upload

Evidence:

- `dieter/components/dropdown-upload/dropdown-upload.html:22-28` uses a trigger
  with `role="button"`, `aria-haspopup="dialog"`, `aria-expanded`, and
  `aria-labelledby`.
- `dieter/components/dropdown-upload/dropdown-upload.html:38` renders the
  popover as `role="dialog"`.
- `dieter/components/dropdown-upload/dropdown-upload.html:57` marks preview
  wrapper `aria-hidden`.
- `dieter/components/dropdown-upload/dropdown-upload.html:59` gives preview
  image an empty alt.
- `dieter/components/dropdown-upload/dropdown-upload.html:88-89` renders file
  name and error containers without `aria-live` or `role="alert"` in the
  inspected template.
- `dieter/components/dropdown-upload/dropdown-upload.html:107` hides the file
  input from assistive technology and tab order.
- `dieter/components/dropdown-upload.ts:174-179` disables controls when a meta
  path is missing.
- `dieter/components/dropdown-upload.ts:181-187` sets an error message on media
  load failure.
- `dieter/components/dropdown-upload.ts:217-246` handles validation/upload
  errors via `setError`.
- `dieter/components/dropdown-upload.ts:279-315` validates selected file
  metadata.

As-built read: validation exists, but the error message is not proven
announced. The empty image alt is correct only if the preview is decorative;
if it is the user's selected image preview, final doctrine may require a
different accessible name.

### Bulk Edit Modal

Evidence:

- `dieter/components/bulk-edit/bulk-edit.html:17-18` gives the modal body
  `role="dialog"` and `aria-modal="true"`.
- `dieter/components/bulk-edit/bulk-edit.ts:329-335` renders, unhides modal,
  focuses the first input, and installs a keydown listener.
- `dieter/components/bulk-edit/bulk-edit.ts:337-346` hides modal and removes
  the keydown listener; Escape closes.
- `dieter/components/bulk-edit/bulk-edit.ts:370-376` wires open, close,
  cancel, backdrop close, and save.
- `dieter/components/bulk-edit/bulk-edit.css:14-21` uses a fixed modal overlay
  with z-index 1000.
- `dieter/components/bulk-edit/bulk-edit.css:119-121` provides local table
  input focus outline.

As-built read: this is the strongest current Dieter modal path, but it still
does not prove focus trap, return focus, scroll lock, or inert outside content.

### Object Manager Modal

Evidence:

- `dieter/components/object-manager/object-manager.html:38-40` defines hidden
  modal markup without `role="dialog"` or `aria-modal`.
- `dieter/components/object-manager/object-manager.js:339-381` opens and
  renders the modal list.
- `dieter/components/object-manager/object-manager.js:383-395` closes and
  wires save/cancel/backdrop close.
- `dieter/components/object-manager.css:19-25` uses a fixed overlay with
  z-index 1000.
- `dieter/components/object-manager.css:32-42` styles the modal body.

As-built read: it is visually modal, but weaker than `bulk-edit` for assistive
technology and keyboard behavior. No Escape handling, focus management, focus
return, focus trap, scroll lock, or inert outside content was proven in the
inspected path.

### Textedit And Popaddlink

Evidence:

- `dieter/components/textedit/textedit.html:2` uses a button trigger with
  `aria-haspopup="dialog"` and `aria-expanded="false"`.
- `dieter/components/textedit/textedit.html:13` renders the popover as
  `role="dialog"` with `aria-label="Edit text"`.
- `dieter/components/textedit/textedit.html:17-18` gives the delete button an
  accessible label.
- `dieter/components/textedit/textedit.html:23` uses a contenteditable editor.
- `dieter/components/textedit/textedit.html:32-35` renders a link input form
  whose input has placeholder text but no explicit aria-label in the inspected
  inline template.
- `dieter/components/textedit.ts:160-179` toggles open/closed, updates
  `aria-expanded`, and focuses the editor on open.
- `dieter/components/textedit.ts:181-187` closes all textedit popovers by
  setting `aria-expanded` false.
- `dieter/components/textedit.ts:355-361` closes on outside pointer.
- `dieter/components/popaddlink/popaddlink.html:19-24` gives the standalone
  URL input an `aria-label`.
- `dieter/components/popaddlink.ts:56-71` sets valid/invalid state and
  disables apply.
- `dieter/components/popaddlink.ts:91-100` applies on Enter and cancels on
  Escape.

As-built read: textedit has useful dialog semantics and focus-on-open. Focus
return and trap are not proven. The standalone popaddlink is better labelled
than the inline textedit link input.

## Bob Surfaces

### Workspace

Evidence:

- `bob/components/Workspace.tsx:388-394` gives the preview iframe a title.
- `bob/components/Workspace.tsx:396-407` renders loading/status overlays with
  `role="status"` and `aria-live="polite"`, and errors with `role="alert"`.
- `bob/components/Workspace.tsx:411` hides the overlay from accessibility tree
  when there is no widget.
- `bob/components/Workspace.tsx:413-416` labels the device control as a
  radiogroup.
- `bob/components/Workspace.tsx:419-426` uses radio state for desktop.
- `bob/components/Workspace.tsx:428-435` uses an internal button with
  `tabIndex={-1}` and `aria-pressed`.
- `bob/components/Workspace.tsx:436-439` hides the icon.
- `bob/components/Workspace.tsx:442` and `:468` provide screen-reader labels
  for Desktop/Mobile.

As-built read: status announcement is strong. Device switching inherits the
Dieter segmented mixed radio/button semantics.

### Translations Panel

Evidence:

- `bob/components/TranslationsPanel.tsx:55-70` wraps select input in a label.
- `bob/components/TranslationsPanel.tsx:94-105` uses `role="status"` and
  `aria-live="polite"` for agent activity.
- `bob/components/TranslationsPanel.tsx:227-236` renders a native generate
  button.

As-built read: core form/status semantics exist here. This audit does not
evaluate translation product flow; only accessibility semantics.

### Upsell Popup

Evidence:

- `bob/components/UpsellPopup.tsx:16-19` focuses the close button when open.
- `bob/components/UpsellPopup.tsx:21-30` handles Escape.
- `bob/components/UpsellPopup.tsx:38` uses a presentation overlay and closes on
  mouse down.
- `bob/components/UpsellPopup.tsx:40-44` renders `role="dialog"`,
  `aria-modal="true"`, and `aria-label`.

As-built read: stronger than many modal paths, but no focus trap, return focus,
or inert outside content was proven.

### Tool Drawer Navigation

Evidence:

- `bob/components/TdMenu.tsx:50-56` renders vertical tablist navigation.
- `bob/components/TdMenu.tsx:60-74` renders buttons with `role="tab"`,
  `aria-selected`, accessible labels/titles, and hidden icons.

As-built read: semantics exist. Arrow-key tab navigation was not proven in the
inspected snippet; click activation is visible.

## Roma Surfaces

Evidence:

- `roma/components/roma-nav.tsx:20-23` marks active link text with
  `aria-current="page"`.
- `roma/components/roma-nav.tsx:45` uses `nav aria-label="Roma nav"`.
- `roma/components/roma-nav.tsx:48-51` gives brand link an accessible label and
  image alt.
- `roma/app/login/page.tsx:60-62` labels the login button.
- `roma/app/login/page.tsx:66-68` renders auth error text with `role="alert"`.
- `roma/components/roma-domain-error-boundary.tsx:54-80` renders a domain error
  UI with buttons, but no `role="alert"` or live-region semantics were found
  in the inspected lines.
- `roma/app/roma.css:457-460` gives widget-default inputs focus-visible
  outline.
- `roma/app/roma.css:620-622` gives `.roma-input:focus-visible` a visible
  outline.

As-built read: Roma has reasonable native navigation and input focus evidence.
Modal/error announcement behavior is not system-proven from the inspected
files.

## DevStudio Surfaces

Evidence:

- `admin/src/main.ts:235-239` sets `aria-current="page"` on the active nav.
- `admin/src/main.ts:340-365` renders the token editor overlay/panel and uses a
  diff container with `aria-live="polite"`.
- `admin/src/main.ts:613-618` gives typography token edit buttons accessible
  labels.
- `admin/src/css/utilities.css:107-110` gives token editor selects/inputs
  focus outline using focus tokens.
- `admin/src/css/layout.css:127-128` removes focus outline from nav links.
- `admin/src/html/foundations/typography.html:12` and
  `admin/src/html/foundations/colors.html:14` use focus-visible token styles on
  token edit triggers.
- `admin/src/data/icons.ts:5` normalizes raw SVGs to include `aria-hidden` and
  `focusable="false"`.

As-built read: DevStudio has accessibility details in token editing and icons,
but the token editor overlay is modal-like without a proven dialog/focus
contract, and nav focus visibility is explicitly removed.

## Public Widget Runtime Evidence

Evidence from subagent read-only audit:

- FAQ widget questions are native buttons with `aria-expanded` and
  `aria-controls`, and answers are regions.
- Split carousel dots container declares `role="tablist"`, but dot children are
  plain buttons with `aria-current`, not `role="tab"` and `aria-selected`.
- Split carousel controls are around 40px desktop and 36px mobile; dots are
  around 8px. Social share controls are around 42px.

As-built read: public widgets contain some accessible patterns, especially FAQ,
but carousel semantics and target sizing need exact audit before claims.

## Cross-System Current Gaps

These are current-state findings only, not fixes:

1. Focus visibility is not a single product contract. Tokens exist, but several
   core components remove focus visuals.
2. Touch target sizing is not a single product contract. A 44px token exists,
   but common controls are 16-32px tall and some public controls are below
   44px.
3. Modal accessibility is not a single product contract. Several modal-like
   paths exist with different ARIA/focus behavior.
4. Keyboard support is not complete. Tabs are strong; dropdown triggers,
   segmented controls, object-manager, token editor, and carousel controls have
   gaps or unproven behavior.
5. Status/error announcement is uneven. Bob workspace and translations have
   live regions/alerts; some upload and Roma error paths are not proven
   announced.
6. Contrast is not audited. Semantic color tokens and contrast variants exist,
   but current docs should not claim WCAG success without actual pairing
   measurement.
7. Reduced motion is foundational but not fully proven. The global guard exists,
   but local transitions and motion-dependent workflows were not exhaustively
   checked.
8. Component docs are directionally honest but can overstate isolated examples
   as patterns. `bulk-edit` should be described as the strongest current modal
   evidence, not as a complete modal solution.

## What This Audit Does Not Claim

- It does not claim WCAG compliance.
- It does not choose Material, Apple, or OpenAI doctrine.
- It does not converge Codex and GLM findings.
- It does not prescribe implementation.
- It does not authorize runtime code changes.
- It does not audit every public widget line-by-line.
- It does not validate with browser, screen reader, axe, or Playwright.

## Step Boundary For 126A

This Step 1 artifact should feed human/AI comparison and later convergence. It
must not be treated as Step 4 doctrine or Step 6 final gap audit. The safe use
of this file is to understand what Clickeen currently has before deciding what
the 126A accessibility product law should become.
