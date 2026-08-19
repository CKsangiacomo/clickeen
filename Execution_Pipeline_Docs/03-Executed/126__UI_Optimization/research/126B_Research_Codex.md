# 126B Color - Codex Source Research

Status: CODEX ONLY - Phase 1 Step 3 source research.

Scope: first-party source research for 126B Color only. This file is not
Clickeen doctrine, not a convergence document, and not an implementation plan.
Human convergence happens later in the 126 process.

Source rule: only official Google Material, Apple Human Interface Guidelines /
Developer documentation, and OpenAI Apps SDK/UI sources are used. No Reddit,
blogs, StackOverflow, or third-party summaries.

## Source Set

Material 3:

- https://m3.material.io/styles/color/roles
- https://m3.material.io/styles/color/system/how-the-system-works
- https://m3.material.io/foundations/design-tokens
- https://m3.material.io/styles/color/overview
- https://m3.material.io/styles/color/static
- https://m3.material.io/foundations/interaction/states/state-layers
- https://m3.material.io/foundations/interaction/states/applying-states
- https://m3.material.io/styles/color/advanced/define-new-colors
- https://m3.material.io/styles/color/advanced/apply-colors

Apple:

- https://developer.apple.com/design/human-interface-guidelines/color
- https://developer.apple.com/design/human-interface-guidelines/dark-mode
- https://developer.apple.com/design/human-interface-guidelines/buttons

OpenAI:

- https://developers.openai.com/apps-sdk/concepts/ui-guidelines
- https://developers.openai.com/apps-sdk/build/mcp-server
- https://developers.openai.com/apps-sdk/plan/components
- https://github.com/openai/apps-sdk-ui/blob/main/README.md
- https://raw.githubusercontent.com/openai/apps-sdk-ui/main/src/styles/variables-semantic.css

## Research Result By Color Area

### 1. Color As Roles, Not Decoration

First-party source direction:

- Material 3 treats color as role-based infrastructure. Roles are assigned from
  tonal palettes and mapped across light and dark schemes.
- Material design tokens are layered: component tokens point to system tokens,
  which point to reference values.
- OpenAI Apps SDK UI also exposes semantic utility examples such as surface,
  border, text-secondary, primary/secondary buttons, and success badges.

Concrete Clickeen audit implication:

- Clickeen should compare its color system by role relationships, not by raw
  palette count.
- Components should be checked for whether they consume roles/component tokens
  or raw system colors.
- A color system can be tokenized and still incomplete if foreground/background
  roles are not explicit.

As-built evidence to compare:

- Dieter has textual roles such as `--role-surface`, `--role-surface-bg`,
  `--role-border`, and `--focus-ring-color`.
- Components often consume raw `--color-system-*` tokens directly.
- Some role tokens are textually present in a malformed CSS region.

### 2. Light, Dark, And Adaptive Color

First-party source direction:

- Material maps roles across light and dark themes.
- Apple emphasizes semantic/adaptive system colors that adjust across
  backgrounds, appearance modes, vibrancy, and accessibility settings.
- Apple dark-mode guidance points to semantic colors and adaptive custom color
  assets where needed.
- OpenAI component planning says hosted components should respect system dark
  mode, including `color-scheme`.

Concrete Clickeen audit implication:

- The later color doctrine must distinguish "some component dark selectors" from
  "a complete adaptive token contract."
- Light and dark cannot be per-component improvisation if the system is meant to
  be agent-operable.
- Host/embedded contexts need a clear adaptation rule.

As-built evidence to compare:

- Dieter token palette is labelled light-only.
- Component-local dark selectors exist.
- Bob has a typed light/dark theme field but no complete token palette backing
  was found.

### 3. Contrast And Pairing

First-party source direction:

- Material color roles support multiple contrast levels for vision needs.
- Material static schemes include accessible foreground/background pairings for
  light and dark themes.
- OpenAI Apps SDK guidance requires text/background contrast at WCAG AA.

Concrete Clickeen audit implication:

- Contrast must be measured by actual role pairings, not individual token names.
- `-contrast` token names are not proof without measured foreground/background
  contexts.
- Disabled, muted, selected, hover, active, alert, and overlay states need
  separate pairing checks.

As-built evidence to compare:

- Dieter has contrast partner tokens.
- Accessibility docs say no formal WCAG audit exists.
- Some docs currently imply contrast targets are hit without a recorded pairing
  audit.

### 4. State Layers And Interaction Color

First-party source direction:

- Material models interaction state color as state layers, usually using the
  content/on-color at fixed opacity rather than hand-authored hover palettes.
- Material separates enabled state expectations from disabled treatment.
- OpenAI semantic CSS includes hover/active variants in semantic token families.

Concrete Clickeen audit implication:

- Clickeen should compare current state mix controls against a systematic state
  layer model.
- Hover/pressed/muted/inactive color should not be per-component guesswork.
- Disabled states should be semantically named and visually consistent.

As-built evidence to compare:

- Dieter defines textual global state mix controls.
- Some components reference missing `--state-muted-opacity`.
- Current docs mention a `--state-hover-target` token that source does not
  define.

### 5. Error, Success, Warning, Info, And Status Semantics

First-party source direction:

- Material has a first-class `error` role.
- Material advanced color docs show custom semantic additions such as a green
  success color.
- OpenAI semantic variables include families for info, warning, caution, danger,
  success, discovery, disabled, border, and surface.
- Apple warns against using the same color for different meanings and against
  relying on color alone.

Concrete Clickeen audit implication:

- Clickeen later needs a status-color law: error, warning, success, info,
  neutral, disabled, active, selected.
- Product state cannot be communicated by color alone.
- Brand/accent color must not collide with operational status meaning.

As-built evidence to compare:

- Dieter has base hue tokens but not a full semantic status role set.
- Bob uses red alert mixes in local UI.
- Public widgets and authoring controls include raw/default colors.

### 6. Brand Color And Agent-Hosted UI

First-party source direction:

- OpenAI Apps SDK UI guidance says hosted UI should feel native to ChatGPT.
- OpenAI guidance says use system colors for text, icons, dividers, and spatial
  elements; brand accents can appear in logos, icons, inline imagery, accents,
  badges, and primary buttons.
- OpenAI discourages custom gradients/patterns that break the host's minimal
  look.

Concrete Clickeen audit implication:

- Agent-hosted Clickeen UI should not overwrite structural text/background
  colors with brand color.
- Brand color should be constrained to approved accent/status/CTA surfaces.
- If Clickeen UI is embedded in host/agent surfaces, the color system must be
  able to respect host/system colors.

As-built evidence to compare:

- Clickeen is agent-operated and has DevStudio/Roma/Bob surfaces plus future
  hosted agent UI concerns.
- Current token system is product-owned rather than host-adaptive.

### 7. Raw Color Values And Authoring

First-party source direction:

- Material and OpenAI both use tokenized semantic layers for UI.
- Apple allows custom colors but expects them to be adaptive and meaningfully
  assigned.

Concrete Clickeen audit implication:

- Raw hex in base token definitions is different from raw hex in component UI.
- Raw user-authored colors in a color picker may be legitimate content/state,
  but raw colors used as structural UI chrome should be audited.
- Later doctrine must distinguish design-system color from user-authored widget
  color.

As-built evidence to compare:

- Dieter base palette uses raw hex.
- Dropdown fill/border/shadow authoring controls contain raw swatch/default
  values.
- Public widget runtime defaults include raw shadow/fallback values.

## Cross-Source Convergence Inputs For Later Human Step

These are research inputs, not Clickeen law:

1. Color should be role-based and layered.
2. Foreground/background pairings matter more than individual palette values.
3. Light/dark/adaptive behavior must be designed at the system level.
4. Interaction states should use a systematic state model.
5. Status colors need semantic separation; error is core, success/warning/info
   may be product extensions.
6. OpenAI-hosted UI constrains brand color and structural text/background use.
7. Color cannot carry product truth alone.

## Source-To-Audit Mapping

| Research area | Audit target in current system |
| --- | --- |
| Role-based color | Dieter role tokens, direct system-token component use, docs claims |
| Light/dark/adaptive | Token palette, component-local dark selectors, Bob theme field |
| Contrast | `-contrast` tokens, actual UI pairings, accessibility doc claims |
| State layers | State mix controls, component hover/pressed/muted usage |
| Status semantics | Error/success/warning/info/disabled naming and usage |
| Host/system colors | DevStudio/Roma/Bob/agent-hosted UI assumptions |
| Raw values | Base tokens vs picker swatches vs runtime fallbacks |

## Explicit Boundary

This research does not authorize implementation. It exists so Step 4 can compare
official source expectations against Codex and GLM as-built audits, then write
Clickeen-specific color doctrine for the 126 UI refactor.
