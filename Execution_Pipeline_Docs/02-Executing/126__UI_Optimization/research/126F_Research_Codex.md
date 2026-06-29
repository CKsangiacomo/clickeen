# 126F Motion - Codex Source Research

Status: CODEX ONLY - Phase 1 Step 3 source research.

Scope: first-party source research for 126F Motion only. This file is not
Clickeen doctrine, not a convergence document, and not an implementation plan.
Human convergence happens later in the 126 process.

Source rule: only official Google Material, Apple Human Interface Guidelines /
Apple developer sources, and OpenAI Apps SDK/UI sources are used. No Reddit,
blogs, StackOverflow, design-influencer posts, or third-party summaries.

## Source Set

Material 3:

- https://m3.material.io/styles/motion/overview/how-it-works
- https://m3.material.io/styles/motion/transitions/applying-transitions
- https://m3.material.io/styles/motion/easing-and-duration
- https://m3.material.io/styles/motion/easing-and-duration/tokens-specs
- https://m3.material.io/components/progress-indicators/overview

Apple:

- https://developer.apple.com/design/human-interface-guidelines/motion
- https://developer.apple.com/design/Human-Interface-Guidelines/accessibility
- https://developer.apple.com/documentation/uikit/uiaccessibility/preferscrossfadetransitions
- https://developer.apple.com/design/human-interface-guidelines/progress-indicators

OpenAI:

- https://developers.openai.com/apps-sdk/llms-full.txt
- https://developers.openai.com/apps-sdk/build/chatgpt-ui
- https://developers.openai.com/apps-sdk/reference
- https://developers.openai.com/apps-sdk/concepts/ui-guidelines

## Research Result By Motion Area

### 1. Purpose And Orientation

First-party source direction:

- Material frames motion as helping UI feel expressive and easy to use.
- Material transitions establish a spatial model and guide navigation.
- Apple treats motion as part of interface stability and warns that strong
  spatial movement can affect user comfort.
- OpenAI Apps SDK UI is hosted inside another product, so motion must not fight
  the host surface.

Concrete Clickeen audit implication:

- Motion should explain state/spatial change, not decorate.
- Motion that does not clarify product state should be treated as suspect until
  human convergence decides otherwise.
- Hosted agent UI motion must fit the host context.

As-built evidence to compare:

- Dieter control transitions.
- Bob/Roma cluster toggles.
- Public widget carousel/ticker motion.

### 2. Duration And Easing

First-party source direction:

- Material publishes duration/easing guidance and motion tokens.
- Material distinguishes standard, emphasized, emphasized decelerate, and
  emphasized accelerate timing behavior.
- Material's examples include standard transitions around 300ms, enter-like
  deceleration around 400ms, exit-like acceleration around 200ms, and emphasized
  transitions around 500ms.
- Apple does not require copying Material's token table; it emphasizes
  appropriate, comfortable motion.

Concrete Clickeen audit implication:

- Duration and easing decisions should be named and purposeful.
- Clickeen should compare current Dieter tokens, local component timings, and
  widget motion before choosing doctrine.
- Official values are north-star references, not automatic Clickeen token
  replacements.

As-built evidence to compare:

- Dieter has 140ms/160ms/600ms duration tokens.
- Button/menuactions/Bob/Roma/Admin/widgets use additional literal values.
- Segmented has a local cubic-bezier.

### 3. Reduced Motion

First-party source direction:

- Material notes that platforms provide reduced animation settings for motion
  sensitivity.
- Apple exposes Reduce Motion and Prefer Cross-Fade Transitions.
- Apple platform APIs include `isReduceMotionEnabled` and
  `prefersCrossFadeTransitions`.
- Reduced motion may mean replacing movement-heavy transitions with fades or
  static state changes, not merely making every motion faster.

Concrete Clickeen audit implication:

- Reduced-motion behavior should be audited at the actual moving element level.
- Global duration shortening is useful, but not automatically sufficient for
  JS-driven, carousel, ticker, or transform-heavy motion.
- Runtime verification matters for JS-written inline transitions and public
  widget motion.

As-built evidence to compare:

- Dieter global guard.
- Selected Dieter component-local guards.
- Repeater inline JS transitions.
- Logo Showcase ticker and JS scrolling.

### 4. Loading And Progress Motion

First-party source direction:

- Material progress indicators communicate ongoing process status in real time.
- Apple progress indicators reassure users the app is not stalled.
- Apple cautions against unnecessary labels for spinning indicators.

Concrete Clickeen audit implication:

- Loading/progress motion should communicate real status.
- Motion should not imply progress if no measurable or true process state
  exists.
- Agent activity and progress indicators should reflect actual agent/tool work.

As-built evidence to compare:

- Translation Agent activity.
- Bob/Roma loading states.
- Any spinner or looping animation claim in docs versus actual source.

### 5. Hosted Agent UI Constraints

First-party source direction:

- OpenAI Apps SDK UI runs in an iframe inside ChatGPT.
- Hosted UI communicates with the host through the MCP Apps bridge and
  `postMessage`-mediated lifecycle.
- Hosted UI uses CSP/domain controls for resources and subframes.
- OpenAI exposes tool invocation status strings, widget state, host-controlled
  display modes, dynamic height notifications, and navigation synchronization.

Concrete Clickeen audit implication:

- Agent UI motion should reflect host-mediated tool/widget state transitions.
- Hosted UI must not depend on arbitrary embedded animation resources or full
  browser control.
- Motion should support, not obscure, tool invocation state.

As-built evidence to compare:

- Bob/Roma iframe/postMessage surfaces.
- Future OpenAI-hosted UI surfaces.
- Agent activity and command status feedback.

## Non-Binding Recommendations For Step 4 Human Convergence

These are research implications only:

- Audit whether each motion explains state or spatial change.
- Audit duration/easing as a named system, not local timing literals alone.
- Compare current Dieter motion, public widget motion, and hosted-agent
  constraints before selecting a final motion contract.
- Treat reduced motion as a first-class behavior, including alternatives to
  transform-heavy movement.
- Keep loading/progress motion truthful to actual process state.
- Preserve current runtime behavior until Step 4+ human convergence selects
  final motion law and later execution scope.
