# 126A Accessibility - Codex Source Research

Status: CODEX ONLY - Phase 1 Step 3 source research.

Scope: first-party source research for 126A Accessibility only. This file is
not Clickeen doctrine, not a convergence document, and not an implementation
plan. Human convergence happens later in the 126 process.

Source rule: only official Google Material, Apple Human Interface Guidelines,
and OpenAI Apps SDK/UI guidance are used. No Reddit, blogs, summaries, or
third-party interpretation.

## Source Set

Material 3:

- https://m3.material.io/foundations/interaction/inputs
- https://m3.material.io/components/cards/accessibility
- https://m3.material.io/components/dialogs/accessibility
- https://m3.material.io/components/lists/accessibility
- https://m3.material.io/components/menus/accessibility
- https://m3.material.io/components/text-fields/accessibility
- https://m3.material.io/components/snackbar/guidelines
- https://m3.material.io/foundations/designing/structure
- https://m3.material.io/foundations/designing/color-contrast
- https://m3.material.io/foundations/designing/elements
- https://m3.material.io/foundations/writing
- https://m3.material.io/foundations/writing/text-resizing
- https://m3.material.io/styles/motion/transitions/applying-transitions

Apple:

- https://developer.apple.com/design/human-interface-guidelines/accessibility
- https://developer.apple.com/design/human-interface-guidelines/buttons
- https://developer.apple.com/design/human-interface-guidelines/typography
- https://developer.apple.com/design/human-interface-guidelines/voiceover
- https://developer.apple.com/design/human-interface-guidelines/modality
- https://developer.apple.com/design/human-interface-guidelines/sheets

OpenAI:

- https://developers.openai.com/apps-sdk/concepts/ui-guidelines
- https://developers.openai.com/apps-sdk/llms-full.txt

## Research Result By Accessibility Area

### 1. Focus Visibility

First-party source direction:

- Material treats keyboard/input focus as a first-class interaction state and
  shows focus through an explicit indicator around the focused element.
- Material card accessibility requires actionable card areas to support both
  keyboard focus and screen-reader focus.
- Material dialog accessibility expects initial focus to move into the dialog
  and remain within the modal interaction until dismissal.
- Apple accessibility guidance treats keyboard-only operation as a core access
  requirement, not an optional enhancement.

Concrete Clickeen audit implication:

- Every actionable element needs a visible focus state unless it is truly not
  keyboard reachable.
- Removing focus visuals "per design" is not compatible with the source
  direction unless another visible focus indicator is present.
- `div role="button"` is insufficient if it is not focusable and keyboard
  operable.
- Modal/dialog paths need focus entry, contained focus while modal, and a clear
  dismissal/return path.

As-built evidence to compare:

- Dieter has focus tokens in `dieter-foundation-tokens.css`.
- Tabs implement roving focus but remove focus visuals.
- Buttons, segmented controls, dropdown headers, and DevStudio nav contain
  focus-outline removal evidence.
- Bulk edit, Bob upsell, and textedit focus on open in some paths, but no
  shared focus-trap/return-focus contract exists.

### 2. Keyboard Operability

First-party source direction:

- Apple says people should be able to use the keyboard alone.
- Material keyboard/switch focus guidance treats keyboard navigation and focus
  behavior as part of component accessibility.
- Material list/menu/dialog component guidance expects keyboard-operable
  navigation, activation, and dismissal patterns appropriate to the component.

Concrete Clickeen audit implication:

- Builder controls cannot be pointer-only if they are part of normal product
  work.
- Menus/listboxes need keyboard entry, movement, selection, and exit behavior.
- Tabs need arrow-key behavior.
- Dialogs need Escape or explicit dismissal plus focus containment.
- Destructive confirmations and save/publish paths need keyboard access.

As-built evidence to compare:

- Tabs have arrow-key navigation.
- Choice tiles move focus with arrows.
- Shared dropdown host toggles on click and closes on Escape, but does not open
  on Enter/Space or provide listbox arrow navigation.
- Object-manager modal and DevStudio token editor do not prove modal keyboard
  behavior.

### 3. Target Size

First-party source direction:

- Material structure guidance uses 48x48dp as a minimum interactive touch
  target.
- Apple button guidance uses 44x44pt as a minimum tappable area.

Concrete Clickeen audit implication:

- Dense builder controls can remain visually compact only if the interactive
  target area still satisfies the target-size decision adopted in Step 4.
- Icon buttons, close buttons, toolbar controls, carousel controls, dots,
  swatches, chips, list row affordances, and popover handles all need audit.
- A token alone is not compliance. The target has to be applied or achieved by
  hit-area padding.

As-built evidence to compare:

- Dieter declares `--min-touch-target: 2.75rem` = 44px.
- Dieter control sizes are 16-32px.
- Tabs, buttons, segmented controls, textfields, toggles, and public carousel
  controls contain smaller dimensions.

### 4. Contrast

First-party source direction:

- Material color-contrast guidance uses WCAG-style contrast thresholds:
  ordinary/small text needs stronger contrast than large text, and non-text
  graphics/control boundaries also need sufficient contrast.
- OpenAI Apps SDK guidance requires text/background contrast at WCAG AA.
- OpenAI hosted UI guidance also asks apps to respect host/system colors where
  possible instead of redefining core readable surfaces.

Concrete Clickeen audit implication:

- Contrast must be measured per actual foreground/background pairing.
- A token named `contrast` is not enough.
- Disabled, muted, placeholder, border, focus, selection, error, warning,
  success, and overlay states need separate measurement.
- Do not use opacity alone as the only disabled/error/status distinction if it
  makes state unreadable.

As-built evidence to compare:

- Dieter has semantic colors and contrast variants.
- Current docs say no formal WCAG audit exists.
- Subagent spot-check found some token colors do not universally pass as
  text-on-white, which reinforces that pairings must be measured, not assumed.

### 5. Text Resizing And Reflow

First-party source direction:

- Apple typography guidance anchors accessibility in system text sizing and
  Dynamic Type behavior.
- Material writing/text-resizing guidance expects text to remain readable when
  resized.
- OpenAI Apps SDK guidance requires text resizing without broken layouts.

Concrete Clickeen audit implication:

- Controls cannot rely on fixed-height labels that clip when text expands.
- Popover rows, tabs, buttons, sidebars, panels, translations dialogs, and
  generated UI need text growth checks.
- Icon-only controls need accessible names; text labels need enough layout
  room to avoid truncating critical actions.

As-built evidence to compare:

- Dieter has dense heights and many compact controls.
- Bob/Roma panels include status/error strings that can grow.
- Translation and locale UI needs special care because translated strings are
  often longer than source strings.

### 6. Motion Sensitivity

First-party source direction:

- Material motion guidance includes reduced-motion transition behavior.
- Apple accessibility guidance says apps should respond when Reduce Motion is
  active and avoid unnecessary motion that can cause discomfort.

Concrete Clickeen audit implication:

- Clickeen should preserve meaning without animation.
- Animated loading, shimmer, panel transitions, popovers, carousels, and layout
  jumps must respect reduced-motion settings.
- Reduced-motion cannot be only a global duration clamp if a component depends
  on motion to communicate state.

As-built evidence to compare:

- Dieter has a global `prefers-reduced-motion` guard.
- Several components also define local reduced-motion handling.
- Some surfaces still contain raw local transitions; coverage is not proven.

### 7. Semantic Labels, Images, And Icons

First-party source direction:

- Material element/writing/menu guidance emphasizes clear labels that match
  visible meaning.
- Apple VoiceOver guidance expects controls, images, and landmarks to expose
  meaningful accessible names.
- OpenAI Apps SDK guidance requires alt text for images and accessible hosted
  UI structure.

Concrete Clickeen audit implication:

- Icon-only controls need an accessible name.
- Decorative icons should be hidden from assistive technology.
- Visible text buttons generally do not need duplicate `aria-label` unless the
  label needs clarification.
- Image previews need a decision: decorative preview vs meaningful selected
  asset.
- Menu option labels should match the visible option the user sees.

As-built evidence to compare:

- Admin icon normalization hides raw icons.
- Bob and Roma have several explicit accessible labels.
- Dieter base button icon span does not hide icons by default.
- Dropdown upload preview image uses empty alt while representing selected
  media in some states.

### 8. Dialogs, Modality, And Sheets

First-party source direction:

- Apple modality guidance says modality should interrupt only when needed.
- Apple sheet guidance treats modal sheets as blocking the parent interaction
  until dismissal.
- Material dialog accessibility expects dialog focus behavior and clear
  actions for confirm, dismiss, or acknowledge.

Concrete Clickeen audit implication:

- Do not use a dialog for routine passive status if a banner/status/toast is
  the correct pattern.
- When a dialog is used, the user must know where focus went, how to act, how
  to dismiss, and where focus returns.
- Modal overlays must not leave background controls reachable in a way that
  breaks the modal model.

As-built evidence to compare:

- Bulk edit has dialog role/aria-modal and initial focus.
- Bob upsell has dialog role/aria-modal, close focus, and Escape.
- Object manager lacks dialog ARIA.
- DevStudio token editor is modal-like but not proven as a dialog.

### 9. Error And Status Feedback

First-party source direction:

- Material snackbars are for short process updates and should not obscure
  primary controls.
- Material text-field accessibility expects errors/supporting text to be
  perceivable.
- OpenAI guidance requires clear handling of errors and fallback behaviors in
  hosted UI.

Concrete Clickeen audit implication:

- Save, publish, translation generation, upload, and agent-operation statuses
  need perceivable feedback.
- Error copy cannot only change visually in a hidden or non-live container.
- Status components should not block the primary work unless the state truly
  blocks it.
- Toast/banner/dialog choice must match the product operation, not developer
  convenience.

As-built evidence to compare:

- Bob Workspace status/error overlays use status/live and alert roles.
- Bob TranslationsPanel agent activity uses status/live.
- Dropdown upload error text is not proven announced.
- Roma domain error boundary is not proven announced as alert/status.

### 10. OpenAI Hosted UI Expectations

First-party source direction:

- OpenAI Apps SDK UI guidance asks hosted components to work well in the host
  environment, use readable contrast, support resizing, include alt text where
  applicable, and avoid fighting host core colors and fonts.
- OpenAI guidance is relevant to Clickeen because agent-operated UI and hosted
  agent panels must remain usable when embedded in an AI surface.

Concrete Clickeen audit implication:

- Clickeen UI should not hardcode a style system that blocks host readability
  or resizing in agent-hosted surfaces.
- Agent dialogs, operation panels, and generated UI previews need accessible
  names/status/error treatment.
- Clickeen should prefer structured, inspectable UI semantics over image-only
  or purely visual state.

As-built evidence to compare:

- Clickeen already has an agent-operated architecture and structured UI
  substrate.
- The accessibility substrate is not yet complete enough to guarantee hosted
  agent UI quality without a 126A doctrine and later implementation pass.

## Cross-Source Convergence Inputs For Later Human Step

These are research inputs, not final Clickeen law:

1. Material and Apple both require keyboard-operable interactions. Clickeen
   should not treat pointer-only builder operations as acceptable without an
   explicit human decision.
2. Material 48dp and Apple 44pt differ. Clickeen must choose whether its
   minimum target doctrine is 44px, 48px, or a responsive split by surface.
3. Material/OpenAI contrast direction requires measured pairings. Token names
   cannot substitute for contrast checks.
4. Apple/OpenAI text resizing direction matters more for Clickeen than typical
   SaaS because Clickeen generates and translates content; strings will grow.
5. Material/Apple dialog guidance makes focus management part of the component,
   not an optional test ritual.
6. OpenAI hosted UI guidance reinforces Clickeen's agent-operated premise:
   structured accessible UI is the substrate agents can operate and inspect.

## Source-To-Audit Mapping

| Research area | Audit target in current system |
| --- | --- |
| Focus visibility | Dieter focus tokens, tabs/buttons/segmented/dropdown focus CSS, Roma/Admin focus rules |
| Keyboard operability | Tabs, segmented, dropdowns, modals, carousel, DevStudio token editor |
| Target size | Dieter control ladder, button/tabs/toggle/textfield sizes, public widget controls |
| Contrast | Dieter color tokens, muted/disabled/error states, actual foreground/background pairings |
| Text resizing | Builder sidebars, button labels, tabs, popovers, translation UI, generated widget copy |
| Reduced motion | Dieter global guard, component transitions, Bob/Roma panels, public carousel behavior |
| Semantic labels | Icon-only buttons, decorative icons, image previews, menu options, nav landmarks |
| Dialog modality | Bulk edit, object manager, textedit, dropdown edit/upload, Bob upsell, DevStudio token editor |
| Error/status feedback | Bob workspace/translations, Roma error boundary, uploads, save/publish banners |

## Non-Doctrine Recommendations For Step 4 Discussion

These recommendations are deliberately non-binding until human convergence:

1. Decide the Clickeen target-size law explicitly. The sources provide 44pt and
   48dp anchors; the product must choose how dense builder UI remains usable
   without losing accessibility.
2. Decide that visible focus is required unless a control is intentionally not
   reachable by keyboard. If focus is reachable, it must be visible.
3. Decide whether `div role="button"` is permitted at all. If permitted, it
   needs a strict keyboard/focus contract.
4. Decide a shared modal contract before fixing individual dialogs. The
   contract should cover role, label, initial focus, focus trap, Escape,
   backdrop, return focus, scroll lock, and outside inertness.
5. Decide contrast validation as measured pairings, not token naming.
6. Decide how generated/translated content is stress-tested for text expansion.
7. Decide where status feedback belongs: toast/banner/status/dialog according
   to operation type, not as part of save machinery.

## Explicit Boundary

This research does not authorize implementation. It exists so Step 4 can
compare official source expectations against the Codex and GLM as-built audits,
then write Clickeen-specific accessibility doctrine for the 126 UI refactor.
