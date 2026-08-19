# 126H Dieter - Codex Research

Status: CODEX ONLY - Phase 1 step 3. First-party sources only; not doctrine.

## Sources

- Material 3 design tokens: https://m3.material.io/foundations/design-tokens
- Material 3 spacing tokens: https://m3.material.io/styles/spacing/tokens
- Material 3 layout application: https://m3.material.io/foundations/layout/applying-layout
- Material 3 canonical layouts: https://m3.material.io/foundations/layout/canonical-layouts
- Material 3 density and touch targets: https://m3.material.io/foundations/layout/grids-spacing/density
- Material 3 icon design: https://m3.material.io/styles/icons/designing-icons
- Material 3 interaction states: https://m3.material.io/foundations/interaction/states/applying-states
- Material 3 shape radius scale: https://m3.material.io/styles/shape/corner-radius-scale
- Material 3 elevation: https://m3.material.io/styles/elevation/applying-elevation
- Apple HIG layout: https://developer.apple.com/design/human-interface-guidelines/layout
- Apple HIG components: https://developer.apple.com/design/human-interface-guidelines/components
- Apple HIG buttons: https://developer.apple.com/design/human-interface-guidelines/buttons
- Apple HIG typography: https://developer.apple.com/design/human-interface-guidelines/typography
- Apple HIG SF Symbols: https://developer.apple.com/design/human-interface-guidelines/sf-symbols
- OpenAI Apps SDK custom UX: https://developers.openai.com/apps-sdk/build/chatgpt-ui
- OpenAI UI guidelines: https://developers.openai.com/apps-sdk/concepts/ui-guidelines
- OpenAI UX principles: https://developers.openai.com/apps-sdk/concepts/ux-principles

## Findings

- Material treats design tokens as the shared substrate across design, tooling, and code. Foundations, styles, and components layer on top of that substrate.
- Material spacing uses an 8dp center with smaller 2dp, 4dp, and 6dp values for finer component rhythm. This supports a foundation system with explicit exceptions rather than undocumented ad hoc values.
- Material layout guidance uses breakpoints, panes, and canonical layouts such as feed, list-detail, and supporting pane. This supports Dieter as a system of tokens and composition patterns, not only a CSS token file.
- Material separates visual size from interaction target. A visual icon can sit inside a larger target; density should not shrink accessibility targets.
- Material icon guidance standardizes common icon sizes and interaction states. This supports keeping icon-size tokens separate from target-size/focus tokens.
- Material shape and elevation are tokenized systems. Radius and elevation are named semantic decisions, not one-off per-component values.
- Apple HIG emphasizes safe areas, margins, layout guides, system controls, platform focus behavior, materials, standard hit regions, and SF Symbols.
- Apple button guidance supports a minimum practical hit area around 44x44pt, while visionOS uses larger target expectations.
- Apple SF Symbols integrate with San Francisco typography and adapt through rendering modes and platform context. This supports Dieter exposing intent-level icon primitives rather than only raw SVG dimensions.
- OpenAI Apps SDK custom UI treats components as iframe-rendered views of structured tool results, not standalone app replicas.
- OpenAI UI guidance recommends system colors, system font stack, grid spacing, constrained corner rounds, monochrome/outlined iconography, WCAG AA contrast, alt text, and resize-safe layouts.
- OpenAI composition guidance favors small, conversational surfaces: inline cards for focused actions/data, carousels for comparable sets, fullscreen for deeper rich tasks, and picture-in-picture for live ongoing sessions.
- OpenAI guidance discourages nested scrolling, deep navigation inside cards, duplicated inputs, ornamental UI, and wholesale app replication.

## Non-Binding Recommendations

- Treat Dieter as typed substrate first, primitives/components second, and screen patterns third.
- Keep visual-size tokens separate from interaction-target tokens.
- Use a 4/8 rhythm with explicit, named exceptions rather than hidden one-off values.
- Keep radius, elevation, focus, and layer semantics named and small enough for agents to reason about.
- Avoid arbitrary per-component shadows, z-indexes, and corner values when the system intends shared semantics.
- Expose intent-level primitives such as button, icon button, segmented control, menu, sheet, list row, focusable region, toolbar/action bar, and inspector/pane patterns.
- For AI-operated UI, encode composition constraints agents can apply: max primary actions, no nested scroll in cards, required empty states, source-of-truth ownership, and clear display-mode fit.
- These are non-binding Phase 1 research recommendations only. They do not select fixes before human convergence.

## Source-Specific Implications For 126H

### Material

- Material supports the Dieter premise that design decisions should be structured as named tokens and component primitives.
- Material also shows that token systems need explicit exceptions and semantic layers; otherwise local values accumulate.
- Material's target-size guidance is directly relevant to Dieter's current separation between small visual control sizes and `--min-touch-target`.

### Apple

- Apple supports platform-native primitives, layout constraints, safe areas, hit regions, and symbol systems.
- Apple reinforces that source primitives should adapt to platform contexts instead of forcing every surface to copy one visual treatment.
- Apple hit-target guidance is directly relevant to Dieter's focus/touch token gap.

### OpenAI

- OpenAI is directly relevant to Clickeen because Clickeen is agent-operated and AI-native.
- Apps SDK guidance supports Dieter as a structured UI substrate that agents can use to produce constrained surfaces.
- Apps SDK guidance also supports separating component resources, display mode, structured data, and state ownership.

## Compliance Notes

- Research used first-party Google Material, Apple Developer/HIG, and OpenAI documentation only.
- No third-party blogs, Reddit, StackOverflow, or secondary explainers were used.
- Findings are directional and non-binding.
- No source research item authorizes a Step 4 fix during Phase 1.
