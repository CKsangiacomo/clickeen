# 126K Dialogs And Modals - Codex Source Research

Status: CODEX ONLY - Phase 1 step 3.
Sources: first-party Google Material 3, Apple HIG, and OpenAI Apps SDK/UI
guidance only.
Purpose: external reference for the dialogs-and-modals domain. This is not
doctrine and does not converge with GLM.

## 0. Research Boundary

126K is about overlay interaction surfaces: dialogs, modal sheets, popovers,
alerts, action sheets, inline/fullscreen hosted UI, dismissal behavior, and the
relationship between interruption level and UI structure.

This research does not choose Clickeen fixes.

## 1. Source Index

Material 3:

- Dialogs: https://m3.material.io/components/dialogs
- Dialog specs: https://m3.material.io/components/dialogs/specs
- Dialog accessibility: https://m3.material.io/components/dialogs/accessibility
- Bottom sheets: https://m3.material.io/components/bottom-sheets/overview
- Elevation: https://m3.material.io/styles/elevation
- Applying elevation:
  https://m3.material.io/styles/elevation/applying-elevation
- Buttons: https://m3.material.io/components/buttons/guidelines

Apple HIG:

- Modality:
  https://developer.apple.com/design/human-interface-guidelines/modality
- Sheets:
  https://developer.apple.com/design/human-interface-guidelines/sheets
- Popovers:
  https://developer.apple.com/design/human-interface-guidelines/popovers
- Alerts:
  https://developer.apple.com/design/human-interface-guidelines/alerts
- Action sheets:
  https://developer.apple.com/design/human-interface-guidelines/action-sheets
- Presentation:
  https://developer.apple.com/design/human-interface-guidelines/presentation
- Materials:
  https://developer.apple.com/design/human-interface-guidelines/materials

OpenAI:

- Apps SDK UI guidelines:
  https://developers.openai.com/apps-sdk/concepts/ui-guidelines
- Apps SDK UX principles:
  https://developers.openai.com/apps-sdk/concepts/ux-principles
- Design components:
  https://developers.openai.com/apps-sdk/plan/components
- Build ChatGPT UI:
  https://developers.openai.com/apps-sdk/build/chatgpt-ui
- MCP Apps in ChatGPT:
  https://developers.openai.com/apps-sdk/mcp-apps-in-chatgpt

## 2. Material 3 Findings

### 2.1 Dialogs Are Interruptive Prompts In A Flow

Material treats dialogs as prompts that interrupt the user so they can act on
important information. Dialogs are not generic containers for any surface.

Implications for later Clickeen convergence:

- Upgrade prompts, destructive confirmations, and account notices can be
  evaluated by interruption level.
- Operational pickers and editors should not automatically become blocking
  dialogs if a non-modal surface is the better semantic fit.
- Dialog semantics must match the user-flow need, not just the visual shell.

### 2.2 Dialog Actions Are Part Of The Dialog Contract

Material dialog guidance and button guidance treat dialog actions as explicit,
clear, and scoped to the prompt.

Implications for later Clickeen convergence:

- Modal action layout belongs to the overlay contract.
- Primary/secondary actions should be readable and predictable across Bob, Roma,
  DevStudio, and Dieter.
- Action placement should be evaluated as part of the overlay system, not as
  per-screen local styling.

### 2.3 Sheets And Dialogs Are Different Layering Patterns

Material separates dialogs from bottom sheets. Both are layered surfaces, but
they support different task shapes and interruption models.

Implications for later Clickeen convergence:

- Future doctrine should not make every overlay a centered dialog.
- Editor/detail side or bottom surfaces may be better than modal dialogs for
  some operational flows.
- 126K should own the distinction between blocking prompts and layered working
  surfaces.

### 2.4 Elevation And Scrims Encode Layer Hierarchy

Material elevation covers shadow, tonal difference, scrims, and movement in
front of or behind other surfaces.

Implications for later Clickeen convergence:

- `z-index`, scrim color, shadow, and panel surface are one system concern.
- Local `z-index: 12`, `40`, and `1000` values are current-state evidence, not
  final hierarchy.
- Overlay depth should be represented by tokens/primitives before screens
  consume it.

## 3. Apple HIG Findings

### 3.1 Modality Blocks Parent Interaction Until Dismissal

Apple defines modality as a separate mode that prevents interaction with the
parent view until the modal is dismissed or acted on.

Implications for later Clickeen convergence:

- A Clickeen modal should have explicit dismissal and interaction boundaries.
- Focus, keyboard behavior, and parent interaction are not optional polish.
- Browser-native confirmations and local modal families need to be classified
  by actual interruption behavior.

### 3.2 Sheets Are Targeted Modal Experiences

Apple sheets present focused, targeted experiences. They are modal but not the
same as alerts.

Implications for later Clickeen convergence:

- Some Roma/Bob editor flows may need targeted task surfaces rather than alert
  dialogs.
- The overlay system needs more than one shape if product tasks differ.

### 3.3 Popovers Are Transient Views From A Control Or Area

Apple popovers are transient views presented above other content from a control
or interactive region.

Implications for later Clickeen convergence:

- Dieter dropdown/listbox/dialog popovers can remain semantically distinct from
  blocking modals.
- Popover dismissal, anchoring, focus, and escape behavior still need declared
  rules.

### 3.4 Alerts Warn Or Ask For Important Confirmation

Apple alerts communicate problems, destructive risk, purchase confirmation, or
other moments where the user must decide.

Implications for later Clickeen convergence:

- Upgrade and destructive/unsaved-work prompts should be audited as alert-like
  moments.
- Inline status/alert overlays should not be conflated with modal alerts.

### 3.5 Action Sheets Are Not Alerts

Apple distinguishes action sheets from alerts: action sheets present choices
related to a user-initiated task, while alerts are unexpected or require
attention around a situation.

Implications for later Clickeen convergence:

- Listbox/menu popovers should not inherit dialog/alert semantics just because
  they overlay the page.
- Destructive choices need explicit hierarchy and cancellation paths.

## 4. OpenAI Findings

### 4.1 Custom UI Should Stay Focused And Platform-Fit

OpenAI Apps SDK guidance expects custom UI to clarify actions, capture inputs,
or present structured results. It warns against recreating large app surfaces
inside hosted UI when the task can stay atomic.

Implications for later Clickeen convergence:

- Modal/overlay surfaces should be task-focused and not become generic
  mini-apps.
- Agent-operated UI should expose the specific action and state boundary.
- Upsell or irrelevant messaging should not invade the wrong UI surface.

### 4.2 Display Modes Have Host-Level Close And Context Behavior

OpenAI UI guidance distinguishes inline, carousel, fullscreen, and PiP display
modes. Fullscreen includes a system close and must work with the host composer.

Implications for later Clickeen convergence:

- Hosted or embedded surfaces need host-aware dismissal boundaries.
- Clickeen should treat host/system close, internal close, and product action as
  separate concepts.
- Editor-like workflows should use appropriate workspace surfaces rather than
  overloaded modal cards.

OpenAI also exposes host-owned modal/fullscreen/display behavior through the
Apps SDK surface, including modal requests, close requests, and display-mode
negotiation. Inference for Clickeen: a host-owned overlay is a different
authority boundary from a product-owned local modal.

### 4.3 Components Render Structured Tool Results

OpenAI Apps SDK component guidance positions UI as the human-visible half of a
tool/connector and ties it to structured data and component metadata.

Implications for later Clickeen convergence:

- Overlay state should not become hidden product truth.
- Modal UI state, authoritative product data, and tool/action results should
  stay separated.
- Agent-operable overlay behavior needs explicit contracts.

## 5. Cross-Source Synthesis For Later Human Convergence

Shared source themes:

- Dialogs, alerts, sheets, popovers, listboxes, and fullscreen surfaces are not
  interchangeable.
- Interruption level determines the right surface.
- Dismissal behavior is part of the component contract.
- Focus and parent interaction boundaries are core to modality.
- Layering needs a declared depth/stacking model.
- Overlay actions must be clear and scoped.
- Hosted/agent UI must preserve source-truth and state boundaries.

Non-binding Clickeen mapping:

- `bulk-edit` is a useful current modal reference because it has ARIA,
  dismissal, and initial focus, but it is not complete doctrine.
- `object-manager` demonstrates why visual parity is not enough.
- `dropdownToggle` demonstrates useful shared mechanics but not complete modal
  ownership.
- `textedit` demonstrates drift when an overlay lifecycle is hand-rolled
  separately.
- Roma/Bob/DevStudio demonstrate local modal families that need classification
  before any migration.

## 6. Non-Binding Recommendations

These are research notes for later human convergence only:

- Classify overlays by semantic type before planning fixes: alert/dialog,
  modal sheet, popover dialog, listbox popover, status overlay, browser-native
  confirm, hosted fullscreen.
- Keep listbox popovers separate from dialog popovers.
- Treat focus trap, return focus, escape, backdrop click, scroll-lock, parent
  inertness, and stack order as contract items.
- Treat z-index, scrim, shadow, elevation, and motion as design-system tokens or
  primitives before screens consume them.
- Do not migrate Roma/Bob/DevStudio local modal families until human convergence
  decides the target doctrine.

## 7. Step Boundary

This research does not:

- choose target Clickeen doctrine;
- converge Codex and GLM findings;
- update `documentation/engineering/UI/dialogs-and-modals.md`;
- update code;
- change product behavior;
- select a migration plan.
