# 126M Roma UI - Codex Research

Status: CODEX ONLY - Phase 1 Step 3 source research.

Scope: Roma UI as an authenticated account product app and Builder host. This is
not doctrine, not convergence, and not an implementation plan. Sources are
first-party only: Material 3, Apple Human Interface Guidelines, and OpenAI Apps
SDK/UI guidance.

## Sources

Material 3 official:

- https://m3.material.io/
- https://m3.material.io/foundations/adaptive-design/canonical-layouts
- https://m3.material.io/foundations/layout/grids-spacing/spacing
- https://m3.material.io/components/navigation-drawer/overview
- https://m3.material.io/components/lists/overview
- https://m3.material.io/components/text-fields
- https://m3.material.io/components/dialogs
- https://m3.material.io/components/snackbar
- https://m3.material.io/components/progress-indicators/overview

Apple official:

- https://developer.apple.com/design/human-interface-guidelines/layout
- https://developer.apple.com/design/human-interface-guidelines/sidebars
- https://developer.apple.com/design/human-interface-guidelines/lists-and-tables
- https://developer.apple.com/design/human-interface-guidelines/text-fields
- https://developer.apple.com/design/human-interface-guidelines/entering-data
- https://developer.apple.com/design/human-interface-guidelines/alerts
- https://developer.apple.com/design/human-interface-guidelines/action-sheets
- https://developer.apple.com/design/human-interface-guidelines/writing
- https://developer.apple.com/design/human-interface-guidelines/right-to-left

OpenAI official:

- https://developers.openai.com/apps-sdk/concepts/ux-principles
- https://developers.openai.com/apps-sdk/concepts/ui-guidelines
- https://developers.openai.com/apps-sdk/build/mcp-server
- https://developers.openai.com/apps-sdk/build/chatgpt-ui
- https://developers.openai.com/apps-sdk/build/state-management
- https://developers.openai.com/apps-sdk/app-submission-guidelines

## 1. Account App Shell

Source findings:

- Material navigation drawer guidance supports stable access to primary
  destinations in larger app surfaces.
- Apple sidebar guidance supports leading-side navigation for app areas and
  collections.
- Material adaptive layout guidance frames larger surfaces through canonical
  layout patterns rather than per-screen invention.
- Apple layout guidance emphasizes hierarchy, consistency, and adaptation
  across device sizes.

Non-binding Roma reading:

- Roma's current shell/sidebar/current-domain model is aligned with first-party
  navigation patterns.
- Later convergence should preserve current account navigation clarity.
- Mobile adaptation matters because Roma currently hides the side nav and uses a
  compact drawer under its breakpoint.

## 2. Dashboard And Home Surfaces

Source findings:

- Material layout guidance emphasizes directing attention and action through
  structure.
- Apple layout/writing guidance favors clarity, hierarchy, and concise labels.
- OpenAI UX guidance favors purposeful UI over large decorative surfaces.

Non-binding Roma reading:

- Roma home/billing/AI card surfaces should be evaluated as operational
  account surfaces, not marketing pages.
- Compact facts, current account status, direct actions, and clear domain entry
  points are more relevant than decorative cards.
- Current `roma-card` usage should be judged by scannability and action clarity,
  not by whether cards exist at all.

## 3. Lists And Tables

Source findings:

- Material list guidance is relevant when users need to find and act on items.
- Apple lists/tables guidance supports row/column presentation when users compare
  structured records.
- Material spacing/layout guidance supports density as a deliberate scanning
  choice when information is operational.

Non-binding Roma reading:

- Widgets, pages, assets, team members, invitations, page placements, and bulk
  uploads are all record/action surfaces.
- Roma's current table-like screens need consistency in row actions, empty rows,
  loading rows, and mobile overflow.
- Later convergence should preserve the current mobile horizontal-scroll truth
  unless human convergence explicitly changes it.

## 4. Forms And Data Entry

Source findings:

- Material text-field guidance supports clear labels, readable input state, and
  validation/error presentation.
- Apple data-entry guidance supports asking only for needed information and
  making correction obvious.
- Apple text-field guidance supports expected platform behavior for input.
- OpenAI UI guidance emphasizes accessible hosted UI and predictable controls.

Non-binding Roma reading:

- Profile, team invite, team member role, settings, locale settings, pages, and
  widget defaults all need a consistent form anatomy in later convergence.
- Current local `.roma-input`, `.roma-select`, `.roma-field`, and
  `widget-defaults-input` patterns should be treated as current evidence, not as
  the final system.
- Field-level validation and save-state copy should be audited per form before
  any later implementation step.

## 5. Dialogs, Modals, And Confirmations

Source findings:

- Material dialog guidance is relevant for interruptive decisions and focused
  tasks.
- Apple alerts/action sheets guidance distinguishes blocking alerts from action
  choice surfaces.
- OpenAI submission guidance emphasizes that side effects must be clear and not
  hidden.

Non-binding Roma reading:

- Current local Roma modals exist in widgets, assets, pages, and account notices.
- Destructive account actions, deletes, bulk uploads, upgrade prompts, and
  account notices should be classified by actual behavior.
- `window.confirm` in Builder unsaved navigation is a current browser-level
  confirmation surface and should not be silently ignored.

## 6. Snackbars, Banners, And Status

Source findings:

- Material snackbars are relevant for brief non-blocking feedback.
- Progress indicators are relevant when work is ongoing.
- Apple writing guidance favors user-facing explanations over implementation
  jargon.
- OpenAI guidance favors clear transient and persistent state, with hidden side
  effects avoided.

Non-binding Roma reading:

- Roma currently has ad hoc body-text statuses for copy success, save notice,
  loading/unavailable, and mutation errors.
- The missing top-of-builder stale-translation attention signal is a UI gap, but
  Step 3 research does not implement it.
- Later convergence should classify transient success, persistent attention,
  blocking error, and operation progress separately.

## 7. Explicit Side Effects

Source findings:

- OpenAI app submission guidance requires accurate tool/UI descriptions and no
  misleading behavior.
- OpenAI guidance distinguishes read-only presentation from actions with side
  effects.
- Apple writing guidance supports verbs that match the action users are taking.

Non-binding Roma reading:

- Save, publish, unpublish, duplicate, delete, invite, upload, transfer
  ownership, save languages, and generate translations should communicate their
  side effect and owning authority.
- Copy should distinguish source-saved, published, public URL/embed availability,
  and unavailable package state.
- Product operations should not be visually collapsed into one ambiguous success
  when their authorities differ.

## 8. Save And Localization Boundary

Source findings:

- OpenAI state-management guidance separates authoritative business data,
  ephemeral UI state, and durable state.
- OpenAI UX/submission guidance emphasizes clarity about what an action does.
- Apple localization/right-to-left guidance supports designing localization
  affordances intentionally rather than treating translated content as a hidden
  side effect.

Non-binding Roma reading:

- Roma's product law maps cleanly to separate UI meanings:
  source/base save, explicit translation generation, and locale package/public
  cache follow-up are different operations.
- A later banner/toast design should tell users when translations need action
  without making save run translation work.
- The current Step 3 source research supports the separation, but does not
  choose exact copy, persistence, stale evidence, or implementation mechanics.

## 9. Localization And Directionality

Source findings:

- Apple localization guidance includes right-to-left layout and text expansion
  concerns.
- Material layout guidance supports adaptive structure across contexts.
- OpenAI UI guidance emphasizes readable text, accessible contrast, and text
  resizing resilience.

Non-binding Roma reading:

- Roma language settings and Bob translation preview should be evaluated for
  label expansion, locale names, base language labeling, and generated derivative
  state.
- UI copy should not expose backend language names or internal locale mechanics
  when user-facing locale labels are available.
- Locale controls should distinguish source language, active languages, preview
  locale, and generated translation availability.

## 10. Accessibility

Source findings:

- Apple accessibility guidance treats accessibility as baseline product quality.
- OpenAI UI guidelines require accessible hosted UI, readable contrast, alt text,
  and text resizing support.
- Material state/focus guidance supports visible focus and interaction states.

Non-binding Roma reading:

- Current Roma active nav has `aria-current`, and current local modals have some
  `role="dialog"` / `aria-modal` usage.
- Later convergence should audit focus return, Escape behavior, keyboard table
  actions, modal traps, status announcements, disabled states, and text
  resizing.
- Accessibility cannot be reduced to token/colors; it must include operation and
  state behavior.

## 11. AI-Native Product Surface

Source findings:

- OpenAI UX principles and Apps SDK guidance are relevant as comparators for
  AI-native surfaces: small purposeful actions, structured state, clear
  side-effect boundaries, and accessible hosted UI.
- OpenAI app submission guidance warns against misleading names, static-frame
  behavior, hidden side effects, and broad unnecessary context.

Non-binding Roma reading:

- Roma is not hosted inside ChatGPT, but the guidance still maps well to
  Clickeen's agent-operated product law.
- Agent-operable Roma UI should expose account/product truth directly and avoid
  ambiguous status wrappers.
- UI convergence should support the one human and AI workforce operating the
  product through named authorities.

## 12. Non-Binding Recommendations

- Keep Roma's current account shell/navigation authority visible.
- Treat `.roma-*`, `.rd-*`, and `widget-defaults*` as current local UI truth to
  audit, not as final doctrine.
- Classify lists/tables/forms/modals/status patterns by actual behavior before
  selecting implementation.
- Preserve the save/localization boundary as separate user intent and separate
  operation meaning.
- Prefer first-party design-system evidence and current runtime evidence over
  inherited old PRD counts.
- Do not turn this research into implementation without Step 4 human convergence.

## 13. Explicit Non-Decisions

- No Roma redesign.
- No primitive selection.
- No copy decision.
- No stale-translation banner design.
- No save/translation route behavior change.
- No Dieter migration decision.
- No Step 4+ convergence.
