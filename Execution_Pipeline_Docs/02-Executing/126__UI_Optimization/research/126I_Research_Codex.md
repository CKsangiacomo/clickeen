# 126I Components - Codex Research

Status: CODEX ONLY - Phase 1 step 3. First-party sources only; not doctrine.

## Sources

- Material 3 components: https://m3.material.io/components
- Material 3 buttons: https://m3.material.io/components/buttons/overview
- Material 3 text fields: https://m3.material.io/components/text-fields
- Material 3 interaction states: https://m3.material.io/foundations/interaction/states
- Material 3 applying states: https://m3.material.io/foundations/interaction/states/applying-states
- Material 3 menus: https://m3.material.io/components/menus/overview
- Material 3 dialogs: https://m3.material.io/components/dialogs
- Material 3 bottom sheets: https://m3.material.io/components/bottom-sheets/overview
- Material 3 lists: https://m3.material.io/components/lists/overview
- Material 3 cards: https://m3.material.io/components/cards/guidelines
- Material 3 card accessibility: https://m3.material.io/components/cards/accessibility
- Apple HIG components: https://developer.apple.com/design/human-interface-guidelines/components
- Apple HIG buttons: https://developer.apple.com/design/human-interface-guidelines/buttons
- Apple HIG sheets: https://developer.apple.com/design/human-interface-guidelines/sheets
- Apple HIG menus: https://developer.apple.com/design/human-interface-guidelines/menus
- Apple HIG lists and tables: https://developer.apple.com/design/human-interface-guidelines/lists-and-tables
- Apple HIG text fields: https://developer.apple.com/design/human-interface-guidelines/text-fields
- Apple HIG accessibility: https://developer.apple.com/design/Human-Interface-Guidelines/accessibility
- OpenAI Apps SDK custom UX: https://developers.openai.com/apps-sdk/build/chatgpt-ui
- OpenAI Apps SDK MCP server: https://developers.openai.com/apps-sdk/build/mcp-server
- OpenAI Apps SDK state management: https://developers.openai.com/apps-sdk/build/state-management
- OpenAI Apps SDK reference: https://developers.openai.com/apps-sdk/reference
- OpenAI UI guidelines: https://developers.openai.com/apps-sdk/concepts/ui-guidelines
- OpenAI Apps SDK submission: https://developers.openai.com/apps-sdk/deploy/submission

## Findings

- Material treats components as contract-bearing primitives with explicit variants, states, behavior, and accessibility expectations.
- Material button guidance distinguishes button forms and visual variants; text fields distinguish filled and outlined forms.
- Material states are expected to be consistent, combinable, and accessibility-visible; disabled controls are not focusable or pressable.
- Material separates transient surfaces by job: menus for temporary choices, dialogs for important decisions, bottom sheets for secondary content, lists for scanning/action, and cards for grouped content/actions.
- Apple HIG similarly frames components as familiar system-defined controls. Component choice is tied to user expectation, not only visual style.
- Apple buttons initiate immediate actions and can carry role semantics such as destructive. Sheets support scoped tasks tied to context. Menus are compact command choosers. Lists/tables need hierarchy and disclosure semantics. Text fields need purpose hints.
- Apple accessibility guidance makes accessibility inspection part of component validation.
- OpenAI Apps SDK makes component contracts explicit across tool descriptors, resource templates, tool results, hosted UI, CSP/resource domains, and state ownership.
- OpenAI hosted UI components render in an iframe, receive structured tool results over the Apps bridge, and should separate authoritative server/business data from local widget UI state.
- OpenAI UI guidance favors small purpose-fit surfaces. Inline cards should be single-purpose, limit primary actions, avoid deep navigation, avoid nested scrolling, and avoid duplicating ChatGPT-native input.
- OpenAI hosted components have hard platform constraints: CSP allowlists, resource domains, hosted origin, versioned UI resource URIs, and compatibility metadata.

## Non-Binding Recommendations

- Treat every Dieter component as a small contract: purpose, variants, states, ARIA/accessibility expectations, data attributes, hydration entry point, binding model, runtime media, and overlay behavior where relevant.
- Document state/variant matrices before selecting fixes: enabled, hover, focus, pressed, selected, loading, disabled, error, destructive, empty, persisted, and dirty states.
- Keep overlay jobs separate: menu for choices/commands, popover for contextual controls, dialog for blocking decisions, sheet/fullscreen for richer scoped workflows.
- Keep authoritative business/product data outside components; components may own local UI state only within their contract.
- Treat resource/version/CSP-like boundaries as part of component contracts for any future hosted UI or Apps SDK-facing surface.
- These are non-binding Phase 1 research recommendations only. They do not select fixes before human convergence.

## Source-Specific Implications For 126I

### Material

- Material supports component contract matrices: variants, states, density, accessibility, and component-specific behavior.
- Material overlay distinctions map directly to Dieter dropdown/popover/modal/sheet-like components and should prevent conflating all overlays.

### Apple

- Apple supports platform-familiar components and role semantics rather than one visual style applied everywhere.
- Apple reinforces the need for clear component purpose, accessibility behavior, and context-specific presentation.

### OpenAI

- OpenAI is especially relevant to Clickeen because components may be operated by agents and rendered in constrained hosted contexts.
- Apps SDK guidance supports treating component metadata, resource URI, CSP, structured data, and state ownership as part of the component contract.

## Compliance Notes

- Research used first-party Google Material, Apple Developer/HIG, and OpenAI documentation only.
- No third-party blogs, Reddit, StackOverflow, or secondary explainers were used.
- Findings are directional and non-binding.
- No source research item authorizes a Step 4 fix during Phase 1.
