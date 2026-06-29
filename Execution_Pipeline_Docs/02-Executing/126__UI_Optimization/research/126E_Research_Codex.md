# 126E Interactions - Codex Source Research

Status: CODEX ONLY - Phase 1 Step 3 source research.

Scope: first-party source research for 126E Interactions only. This file is not
Clickeen doctrine, not a convergence document, and not an implementation plan.
Human convergence happens later in the 126 process.

Source rule: only official Google Material, Apple Human Interface Guidelines /
Apple developer sources, and OpenAI Apps SDK/UI sources are used. No Reddit,
blogs, StackOverflow, design-influencer posts, or third-party summaries.

## Source Set

Material 3:

- https://m3.material.io/foundations/interaction/states
- https://m3.material.io/foundations/interaction/states/applying-states
- https://m3.material.io/components/progress-indicators/guidelines
- https://m3.material.io/components/snackbar
- https://m3.material.io/components/snackbar/accessibility
- https://m3.material.io/components/dialogs
- https://m3.material.io/components/text-fields/guidelines
- https://m3.material.io/components/text-fields/specs

Apple:

- https://developer.apple.com/design/human-interface-guidelines/loading
- https://developer.apple.com/documentation/swiftui/progressview
- https://developer.apple.com/documentation/swiftui/contentunavailableview
- https://developer.apple.com/design/human-interface-guidelines/alerts
- https://developer.apple.com/design/human-interface-guidelines/action-sheets
- https://developer.apple.com/design/human-interface-guidelines/text-fields

OpenAI:

- https://developers.openai.com/apps-sdk/concepts/ux-principles
- https://developers.openai.com/apps-sdk/concepts/ui-guidelines
- https://developers.openai.com/apps-sdk/reference
- https://developers.openai.com/apps-sdk/build/chatgpt-ui
- https://developers.openai.com/apps-sdk/guides/security-privacy
- https://developers.openai.com/apps-sdk/app-submission-guidelines

## Research Result By Interaction Area

### 1. Loading And Progress

First-party source direction:

- Material distinguishes determinate progress from indeterminate activity.
- Apple loading guidance expects UI to communicate that content is loading and,
  where possible, progress or expected duration.
- Apple `ProgressView` represents task progress or indeterminate activity.
- OpenAI hosted UI surfaces receive lifecycle notifications and tool-result
  updates through the Apps SDK host.

Concrete Clickeen audit implication:

- Unknown wait, known progress, stale data, and no result should remain
  different states.
- Progress UI should not imply fake precision.
- Agent activity and command loading should reconcile with real command state.

As-built evidence to compare:

- Roma account shell has loading.
- Widgets/assets/pages show local loading or refreshing copy.
- Translation generation has streamed activity rows.
- Copilot currently shows a minimal pending label.

### 2. Empty And Unavailable States

First-party source direction:

- Apple `ContentUnavailableView` treats unavailable content as a first-class UI
  state with label, supporting content, and optional actions.
- OpenAI component planning guidance calls out list empty-state handling.
- Empty states are not the same as load failure or authorization failure.

Concrete Clickeen audit implication:

- Empty, filtered-empty, unavailable, unauthorized, and failed-to-load states
  should be audited separately.
- "Unavailable" should not silently hide recoverable failures when the user can
  act.

As-built evidence to compare:

- Widgets render no catalog and no instance rows.
- Assets render loading/unavailable/no-assets rows.
- Usage can collapse storage usage failure into unavailable data.

### 3. Command Result Feedback

First-party source direction:

- OpenAI Apps SDK distinguishes model/user-visible `content`, structured tool
  result data, and component-only `_meta`.
- OpenAI tool descriptors can define short invoking/invoked status strings.
- Command feedback must reflect what actually completed.

Concrete Clickeen audit implication:

- A command should not claim full success if only part of the requested work
  completed.
- Partial success should be visible where it matters.
- Command feedback should connect intent, pending, result, and recovery.

As-built evidence to compare:

- Assets bulk upload has per-file success/failed status.
- Settings locale save can distinguish saved settings from follow-up package
  failure.
- Widget commands mostly confirm by forced refresh or route navigation.

### 4. Transient Feedback

First-party source direction:

- Material snackbars provide short process updates.
- Material snackbar actions should not auto-dismiss when action is required.
- Transient messages are weak evidence for durable success or failure.

Concrete Clickeen audit implication:

- Toast/snackbar-like feedback should not become the only record of failure
  where a user must act.
- Durable errors and partial success need persistent inline or modal treatment.
- Timed copy feedback should remain scoped to low-risk transient actions unless
  human convergence chooses otherwise.

As-built evidence to compare:

- Builder and Pages copy statuses clear after 1800ms.
- Workspace has timed/status overlays.
- Most product errors are inline, modal, or conversational.

### 5. Dialogs, Alerts, And Blocking Notices

First-party source direction:

- Material dialogs interrupt users for urgent decisions or important actions.
- Apple alerts are for important information requiring immediate attention.
- Apple action sheets/alerts require clear cancel paths for destructive choices.
- OpenAI tool annotations distinguish read-only and destructive/open-world
  behavior; destructive operations need human confirmation.

Concrete Clickeen audit implication:

- Blocking, destructive, irreversible, or entitlement-changing flows deserve a
  stronger surface than passive transient copy.
- Dialogs should have clear action/cancel semantics.
- Tool metadata and UI feedback should expose side effects before execution.

As-built evidence to compare:

- Roma widget upgrade modal.
- Roma bulk upload modal.
- Roma tier-drop notice modal.
- Bob upsell modal.
- Destructive delete buttons in Roma domains.

### 6. Inline Validation

First-party source direction:

- Material text fields show local error messages below fields until corrected.
- Apple says validation should occur when it makes sense for the field/task.
- Validation should identify the failing input and the action needed.

Concrete Clickeen audit implication:

- Field-level validation should not degrade into generic command failure when a
  specific path is known.
- Validation copy should be close to the field or operation it describes.

As-built evidence to compare:

- Bob control validation returns field-specific messages.
- Bob save can receive validation paths.
- Copilot normalizes issue path/message summaries.
- Roma widgets rename and assets upload errors are local inline copy.

### 7. Disabled, Pending, And Unavailable

First-party source direction:

- Material disabled components are unavailable and cannot be focused, pressed,
  dragged, tapped, or hovered.
- Pending/awaiting/approval states are different from disabled-unavailable
  states.
- OpenAI approval-gated tools can have missing input or waiting states as part
  of tool lifecycle.

Concrete Clickeen audit implication:

- Disabled should not be used as the only way to communicate work in progress,
  approval required, missing prerequisites, or unavailable entitlement.
- Pending labels and explanatory copy should match why an action cannot proceed.

As-built evidence to compare:

- Widgets disable actions while `activeActionKey` is set.
- Translations disable generation while dirty/saving/no locales/no fields.
- Pages publishing is disabled with explanatory copy.

### 8. Agent-Hosted UI Constraints

First-party source direction:

- OpenAI Apps SDK widgets run in iframes and communicate through the Apps SDK
  bridge.
- Hosted app UI cannot rely on privileged browser APIs such as `alert`,
  `prompt`, `confirm`, or unrestricted clipboard access.
- Hosted UI receives tool inputs/results through lifecycle and bridge events.

Concrete Clickeen audit implication:

- Future hosted agent UI feedback must be rendered through host-compatible
  state and bridge events.
- Clickeen cannot assume full browser/page control when operating inside a host.
- Command and agent progress should be visible in the hosted component state.

As-built evidence to compare:

- Bob/Roma currently use `postMessage` between host and iframe.
- Builder copy uses clipboard and local transient status in Roma-owned UI.
- Future OpenAI-hosted UI would need separate constraints.

## Non-Binding Recommendations For Step 4 Human Convergence

These are research implications only:

- Map Clickeen command lifecycle explicitly: intent, pending, partial result,
  success, failure, recovery, undo, and durable record.
- Separate empty/unavailable/error/unauthorized states rather than collapsing
  them into one copy block.
- Treat transient feedback as low-durability unless the action is low-risk.
- Keep destructive/write flows explicit and confirmable.
- Align agent activity surfaces with real agent/command progress, not invented
  progress.
- Preserve current runtime behavior until Step 4+ human convergence selects
  final interaction law and later execution scope.
