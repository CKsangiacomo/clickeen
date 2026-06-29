# 126C Iconography - Codex Source Research

Status: CODEX ONLY - Phase 1 Step 3 source research.

Scope: first-party source research for 126C Iconography only. This file is not
Clickeen doctrine, not a convergence document, and not an implementation plan.
Human convergence happens later in the 126 process.

Source rule: only official Google Material, Apple Human Interface Guidelines /
SF Symbols, and OpenAI Apps SDK/UI sources are used. No Reddit, blogs,
StackOverflow, or third-party summaries.

## Source Set

Material 3:

- https://m3.material.io/styles/icons
- https://m3.material.io/components/icon-buttons/guidelines
- https://m3.material.io/components/icon-buttons/accessibility
- https://m3.material.io/components/icon-buttons/specs
- https://m3.material.io/components/menus/accessibility

Apple:

- https://developer.apple.com/design/human-interface-guidelines/icons
- https://developer.apple.com/design/human-interface-guidelines/buttons
- https://developer.apple.com/sf-symbols/

OpenAI:

- https://developers.openai.com/apps-sdk/concepts/ui-guidelines
- https://developers.openai.com/apps-sdk/build/chatgpt-ui
- https://developers.openai.com/apps-sdk/reference

## Research Result By Iconography Area

### 1. Icon Roles

First-party source direction:

- Material treats icon buttons as compact single-action controls, especially in
  toolbars and dense lists.
- Apple says icons work best when the metaphor is familiar and directly tied to
  the represented action/content.
- OpenAI frames icons as clarity aids inside ChatGPT's visual world, not brand
  substitutes or decorative noise.

Concrete Clickeen audit implication:

- Every icon use should have a clear role: action, state, content category,
  decoration, or brand.
- Dense icon-only controls require stronger naming and hit-target checks than
  text+icon controls.
- Icons should not be added only to make panels look busy.

As-built evidence to compare:

- Bob and Dieter use many icon-only controls with wrapper/button labels.
- Public widgets use icons as CTA/action decoration and content affordances.
- Social Share uses local inline SVGs outside the Dieter set.

### 2. Coherent System Set

First-party source direction:

- Material's icon source is Material Symbols, a coherent variable icon system.
- Apple SF Symbols is a platform symbol library aligned with San Francisco,
  weights, scales, reading-direction adaptation, localization, and vector
  export.
- OpenAI guidance expects system icons or custom iconography that fits the
  ChatGPT monochromatic outlined visual world.

Concrete Clickeen audit implication:

- Clickeen's 157 icons should be assessed as one coherent system set, not
  one-off SVG art.
- Naming, geometry, weight, fill/stroke style, and rendering mode should be
  audited as system properties.
- A custom SVG/manifest system is acceptable only if it stays generated,
  coherent, and by-reference.

As-built evidence to compare:

- Clickeen has a 157 SVG set with dot-notation names.
- Source SVGs are currentColor fill-only in the inspected state.
- Manifest and SVG directories are currently count/name aligned.

### 3. SVG And Registry Substrate

First-party source direction:

- Apple explicitly supports exporting and editing symbols as vector assets while
  preserving shared design/accessibility characteristics.
- Material uses a variable symbol font as its official delivery model.
- OpenAI hosted UI cares less about delivery mechanism than host fit,
  accessibility, and resource constraints.

Concrete Clickeen audit implication:

- SVG/manifest delivery is not itself a defect.
- The doctrine question is whether the source set, manifest, generated outputs,
  and consumer APIs preserve one named icon authority.
- Generated registry claims must match the active build path.

As-built evidence to compare:

- Clickeen has `icons.json`, raw SVGs, Admin generated raw imports, Bob manifest
  geometry, and public CSS mask URL paths.
- `build-icons.mjs` exists but is not active product build output.

### 4. Accessibility Names Vs Decorative Icons

First-party source direction:

- Material icon-button accessibility labels describe the action, such as add,
  bookmark, or send.
- Material menu guidance treats icons beside text as decorative so screen
  readers do not hear redundant labels.
- OpenAI requires accessibility support and alt text for images where relevant.

Concrete Clickeen audit implication:

- Icon-only controls need accessible action names on the control.
- Icons next to visible text should usually be hidden from assistive technology.
- Meaningful non-control icons need a naming strategy; decorative icons need
  `aria-hidden`/non-focusable treatment.

As-built evidence to compare:

- Admin forces injected SVGs decorative.
- Bob SVG strings are bare and wrappers often carry `aria-hidden`.
- Component templates often hide decorative icon spans locally.

### 5. Glyph Size Vs Hit Target

First-party source direction:

- Material icon-button target size is at least 48dp, including nested contexts.
- Apple general button hit region is at least 44x44 pt.

Concrete Clickeen audit implication:

- Glyph size and interactive hit target must be audited separately.
- A 16px icon can be acceptable inside a 44/48px target.
- A 28px icon inside a too-small button is still a hit-target problem.

As-built evidence to compare:

- Dieter has icon-size tokens from 12 to 40.
- `.diet-icon` maps several labels to the same 16px glyph size.
- Button/control target sizing belongs to 126A/126I, but iconography must not
  confuse glyph size with target size.

### 6. Stroke, Fill, Selected State, And Rendering Mode

First-party source direction:

- Material distinguishes filled and outlined icon roles; toggle buttons may use
  outlined when unselected and filled when selected.
- Apple exposes multiple weights/scales and rendering modes.
- OpenAI asks for monochromatic outlined iconography in ChatGPT's visual world.

Concrete Clickeen audit implication:

- Selected/unselected icon states should not depend only on color.
- Fill/stroke style should be consistent enough to read as one system.
- If Clickeen has fill-only currentColor SVGs, later doctrine must decide
  whether that is the system style or whether some states require variants.

As-built evidence to compare:

- Source SVGs are fill-only currentColor in the inspected state.
- Social Share uses local stroke SVGs outside the Dieter set.
- Clickeen does not currently expose filled/outlined paired variants as a
  system-level API.

### 7. Color And currentColor

First-party source direction:

- OpenAI says to use system colors for text, icons, and dividers, and not let
  brand accents override core text/background/component colors.
- Apple SF Symbols supports monochrome, hierarchical, palette, and multicolor
  rendering modes.
- Material icon-button specs organize icon/button color through tokens.

Concrete Clickeen audit implication:

- `currentColor` inheritance aligns with a system-color model when parent
  controls use semantic color tokens.
- Hardcoded SVG colors should be treated differently from user-authored content
  or brand assets.
- Icon color should not carry product truth alone.

As-built evidence to compare:

- Source SVGs are currentColor.
- Bob emits inline currentColor SVGs.
- CSS mask icons inherit color/background through CSS.

### 8. Host / Agent UI Constraints

First-party source direction:

- OpenAI Apps SDK components run in a ChatGPT iframe and communicate with the
  host through the Apps bridge.
- OpenAI reference includes widget metadata for description, border preference,
  domain, CSP, and resource/frame domains.
- OpenAI guidance says ChatGPT appends app logo/name itself; apps should not
  inject logos into responses.

Concrete Clickeen audit implication:

- Hosted agent UI icon assets must work with resource-domain/CSP constraints.
- Icon style should fit the host's minimal UI if surfaced inside ChatGPT.
- Brand icons/logos need a separate rule from operational icons.

As-built evidence to compare:

- Clickeen has Dieter operational icons and separate Roma brand SVGs.
- Future hosted agent UI should not treat brand logo assets as generic icons.

## Cross-Source Inputs For Later Human Step

These are research inputs, not Clickeen law:

1. Icons need roles: action, content, state, decoration, or brand.
2. A coherent icon set matters more than icon count.
3. SVG delivery is acceptable if authority and generation stay clear.
4. Decorative icons should be hidden; icon-only controls need accessible names.
5. Glyph size is not hit target size.
6. currentColor is compatible with system color if parent semantics are correct.
7. Hosted agent UI imposes visual/CSP/resource constraints.
8. Brand/logo assets should not be confused with operational icons.

## Source-To-Audit Mapping

| Research area | Audit target in current system |
| --- | --- |
| Icon roles | Bob/Dieter controls, public widget CTA/icons, social share |
| Coherent set | SVG count/name parity, manifest, geometry, fill/stroke style |
| Registry substrate | `icons.json`, raw SVG imports, Bob adapter, Admin hydrator |
| Accessibility | `aria-hidden`, labels, wrappers, meaningful vs decorative icons |
| Size vs target | icon tokens, `.diet-icon`, button/icon target controls |
| Rendering mode | fill-only SVGs, stroke local SVGs, selected/toggle states |
| currentColor | SVG fills, CSS masks, parent color token usage |
| Host constraints | future ChatGPT-hosted UI, brand/logo separation |

## Explicit Boundary

This research does not authorize implementation. It exists so Step 4 can compare
official source expectations against Codex and GLM as-built audits, then write
Clickeen-specific iconography doctrine for the 126 UI refactor.
