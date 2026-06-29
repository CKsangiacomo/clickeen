# 126D Typography - Codex Source Research

Status: CODEX ONLY - Phase 1 Step 3 source research.

Scope: first-party source research for 126D Typography only. This file is not
Clickeen doctrine, not a convergence document, and not an implementation plan.
Human convergence happens later in the 126 process.

Source rule: only official Google Material, Apple Human Interface Guidelines /
Apple developer sources, and OpenAI Apps SDK/UI sources are used. No Reddit,
blogs, StackOverflow, design-influencer posts, or third-party summaries.

## Source Set

Material 3:

- https://m3.material.io/styles/typography/overview
- https://m3.material.io/styles/typography/type-scale-tokens
- https://m3.material.io/styles/typography/applying-type
- https://m3.material.io/foundations/accessible-design/accessibility-basics

Apple:

- https://developer.apple.com/design/human-interface-guidelines/typography
- https://developer.apple.com/fonts/
- https://developer.apple.com/documentation/uikit/scaling-fonts-automatically
- https://developer.apple.com/videos/play/wwdc2020/10175/

OpenAI:

- https://developers.openai.com/apps-sdk/concepts/ui-guidelines
- https://developers.openai.com/apps-sdk/concepts/ux-principles
- https://openai.github.io/apps-sdk-ui/

## Research Result By Typography Area

### 1. Semantic Type Roles

First-party source direction:

- Material 3 frames typography as role-based styles, not one-off local font
  sizes.
- Material's type scale groups roles into display, headline, title, body, and
  label families.
- Apple frames typography through system text styles that carry size, weight,
  leading, platform, and accessibility behavior.
- OpenAI Apps SDK guidance expects hosted app UI to fit inside ChatGPT's UI
  world, with clear heading/body/caption hierarchy and system-compatible text.

Concrete Clickeen audit implication:

- Clickeen typography should be evaluated as a semantic role system, not only a
  pile of `font-size` tokens.
- Bob/editor role names, widget runtime role names, and Dieter utility names
  should be compared before doctrine is written.
- Role decisions must preserve current product meaning; Step 3 source research
  does not authorize renaming or remapping current Clickeen roles.

As-built evidence to compare:

- Dieter has display/body/heading/label/caption/overline utility classes.
- Bob typography editor exposes 14 role candidates.
- Widget-shell defaults expose a smaller shell role set.
- Widget runtime role scales include title/body/section/question/answer/button
  and locale switcher roles.

### 2. Published Type Scale

First-party source direction:

- Material publishes explicit type scale tokens:
  display large/medium/small, headline large/medium/small,
  title large/medium/small, body large/medium/small, and
  label large/medium/small.
- Material's published values include size and line-height pairings, for
  example display large `57/64`, display medium `45/52`, display small `36/44`,
  headline large `32/40`, title large `22/30`, body large `16/24`, and label
  large `14/20`.
- Apple uses platform text styles rather than a single web token table. Current
  HIG typography values are platform-specific and should not be flattened into
  a universal Clickeen scale without human convergence.
- OpenAI's hosted UI guidance favors consistency with the ChatGPT surface over
  many custom local font sizes.

Concrete Clickeen audit implication:

- Dieter type scale should be compared as a role/behavior system, not copied
  blindly from Material numeric values.
- Fixed numeric values from Apple must remain platform-qualified if referenced.
- A later Clickeen scale should explain why public widgets, builder UI, Roma,
  and DevStudio need the same or different role mappings.

As-built evidence to compare:

- Dieter has `--fs-10` through `--fs-32`, `--fs-body`, `--fs-ui`, and three
  fluid display tokens.
- Widget runtime has role-specific size scales and custom size handling.

### 3. Line Height And Leading

First-party source direction:

- Material type scale pairs font size with line-height.
- Apple treats leading as part of legibility and text-style behavior.
- Apple notes that scripts/locales can need different line-height behavior, and
  system text behavior accounts for platform/localization needs.
- OpenAI Apps SDK guidance requires readable hosted UI that survives resizing
  and different host contexts.

Concrete Clickeen audit implication:

- Line-height cannot be treated as an afterthought or only a token-count issue.
- Clickeen should compare Dieter `--lh-*` tokens, utility raw line heights, and
  widget runtime line-height presets.
- Locale/script handling matters because widgets and agent-operated content can
  be multilingual.

As-built evidence to compare:

- Dieter declares `--lh-tight`, `--lh-normal`, `--lh-loose`, and `--lh-body-ui`.
- Some Dieter utilities hardcode raw line heights.
- Widget runtime has line-height presets plus script typography profiles.

### 4. Tracking And Letter Spacing

First-party source direction:

- Material's current type-scale token tables mostly use `0` tracking, with
  small body/label roles using small positive tracking values.
- Apple system fonts include dynamic tracking and optical behavior; custom
  tracking should be used carefully because it can reduce legibility.
- OpenAI guidance favors consistency and readability in constrained hosted UI
  surfaces.

Concrete Clickeen audit implication:

- Tracking should be audited as a controlled system decision, not scattered
  local styling.
- Step 4 human convergence should compare Dieter inline tracking and widget
  runtime tracking presets before choosing any Clickeen doctrine.
- Research does not imply "remove all tracking"; it implies tracking must be
  named, purposeful, and readable.

As-built evidence to compare:

- Dieter currently inlines letter-spacing values in utilities.
- Widget runtime has named tracking presets.

### 5. System Fonts And Custom Fonts

First-party source direction:

- Apple system fonts are designed for platform legibility, optical sizing,
  weights, and Dynamic Type behavior.
- Apple gives SF Pro as the primary system family, SF Mono for aligned/code
  text, and New York as a serif companion family.
- OpenAI Apps SDK guidance recommends inheriting system fonts in ChatGPT-hosted
  UI and avoiding visual drift from the host.
- Material supports typography systems but still requires consistent roles and
  accessible text behavior.

Concrete Clickeen audit implication:

- Clickeen must separate builder/admin shell typography from public widget
  brand typography.
- Public widgets may need brand fonts, but builder/Roma/DevStudio operational
  UI should avoid arbitrary font invention.
- Mono usage should be token-governed where code/technical text is intended.

As-built evidence to compare:

- Dieter declares `--font-ui` and `--font-mono`.
- Bob imports Inter Tight and has at least one hardcoded mono stack.
- Widget runtime supports Google and Tokyo-hosted fonts.

### 6. Text Resizing And Responsive Type

First-party source direction:

- Material accessibility guidance requires text to remain usable when resized.
- Apple Dynamic Type is a core accessibility mechanism and text styles should
  scale with user preference.
- OpenAI Apps SDK guidance requires hosted UI to support text resizing without
  broken layouts.

Concrete Clickeen audit implication:

- Clickeen typography should be tested against resizing, wrapping, truncation,
  and host-surface constraints.
- A later PRD should distinguish viewport fluid type, container fluid type, and
  user text scaling.
- Truncation that hides source truth, required action labels, or operational
  state is a product-law risk, not cosmetic polish.

As-built evidence to compare:

- Dieter fluid display uses viewport `vw`.
- Widget runtime fluid sizing uses container-query `cqi`.
- Stage/pod CSS includes wrapping rules for widget text.

### 7. Hosted Agent UI Constraints

First-party source direction:

- OpenAI Apps SDK UI can appear as inline cards, carousels, fullscreen views,
  or picture-in-picture surfaces.
- Inline cards should be lightweight and avoid nested scrolling.
- Carousel metadata should be short and scannable.
- Fullscreen mode still exists inside ChatGPT with ChatGPT composer context.

Concrete Clickeen audit implication:

- Typography for future hosted agent surfaces should be dense, readable, and
  host-compatible.
- Over-large headings, excessive custom fonts, and long fixed metadata strings
  are risky in constrained agent surfaces.
- Typography must not assume Clickeen controls the entire viewport when hosted
  inside another product.

As-built evidence to compare:

- Roma/Bob/DevStudio are Clickeen-owned surfaces.
- Future OpenAI-hosted surfaces would have additional host constraints and
  should not inherit public-widget brand typography by default.

## Non-Binding Recommendations For Step 4 Human Convergence

These are research implications only:

- Compare Dieter utility roles, Bob typography editor roles, widget-shell
  default roles, and widget runtime roles before defining Clickeen typography
  doctrine.
- Treat typography as a system contract: size, role, line-height, tracking,
  family, script behavior, wrapping, and host constraints must fit together.
- Keep product-surface distinctions explicit: operational UI, public widgets,
  and hosted agent UI do not necessarily share the same typography freedom.
- Use original-source systems as north stars, not as copy/paste token tables.
- Preserve Clickeen current reality until Step 4+ human convergence selects
  final doctrine and later execution scope.
