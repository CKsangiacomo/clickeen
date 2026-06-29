# 126B Color - Codex As-Built Audit

Status: CODEX ONLY - Phase 1 Step 1 as-built audit.

Scope: current Clickeen color implementation across Dieter tokens, generated
Tokyo output, Dieter components, DevStudio reveal/edit surfaces, Bob/Roma
consumers, public widget runtime, and current color docs. This file states
current reality only. It does not select fixes, converge with GLM, write
doctrine, or execute Step 4+.

Authority boundary:

- Product surface inspected: Dieter color tokens/components, Tokyo generated
  Dieter output, DevStudio color reveal/editor, Bob/Roma consuming shells,
  selected public widget color usage.
- Account/session/storage/route/runtime/deploy authorities: not touched.
- Product data: not touched.
- Verification surface: local source/docs inspection only.

## Executive Current Reality

Clickeen has a real color-system idea: Dieter owns color tokens, components
consume those tokens, DevStudio reveals token state, and Bob/Roma/public widgets
load Dieter output. The design intent is token-first, semantic, OKLAB-derived,
and by-reference.

The current implementation is not yet a clean, proven color contract.

The most important as-built finding is structural: `dieter/tokens/dieter-color-tokens.css`
opens a block comment at line 1 and does not close it before the `:root` block
starts at line 11. The first visible close marker appears inside the line 23
inline comment. Because CSS comments do not nest, lines 1-23 are comment text,
which means the early semantic roles and some state declarations are not active
CSS declarations. After that, declarations continue outside a selector until the
closing brace at line 173. The same malformed file is present in Tokyo generated
output and the shadow-token output.

That does not mean the color-system concept is fake. It means the current source
of truth needs to be described honestly: token intent exists textually, but the
CSS authority is malformed at the comment boundary. Step 2 must not claim a
fully healthy color token runtime from the text alone.

## Program And Source Authority

Evidence:

- 126 MAMA defines 126B as the color domain in the dependency series:
  `Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126__PRD__UI_Optimization_Program.md:120-124`.
- MAMA Step 1 is as-built only, with code owning current reality:
  `Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126__PRD__UI_Optimization_Program.md:178-185`.
- MAMA makes `documentation/engineering/UI/` the permanent UI truth home:
  `Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126__PRD__UI_Optimization_Program.md:233-260`.
- 126B delegates canonical color reference to
  `documentation/engineering/UI/color.md`:
  `Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126B__PRD__Color.md:7-13`.
- Dieter source/output authority is documented as source under `dieter/` and
  generated/deployed output under `tokyo/product/dieter/**`:
  `documentation/services/dieter.md:7-18`.

As-built read: color authority is Dieter source plus the generated Tokyo output.
DevStudio reveals and can attempt narrow token writes; Bob/Roma consume the
output. DevStudio/Roma/Bob are not the source authority for color values.

## Token Source Reality

### Import Chain

Evidence:

- `dieter/tokens/tokens.css:1-3` imports foundation, color, and typography in
  that order.
- `roma/app/layout.tsx:5-18` loads deployed Dieter token/component CSS from the
  Tokyo base.
- `bob/app/layout.tsx:4-20` imports `/dieter/tokens/tokens.css` and component
  CSS.
- Public widget templates import `/dieter/tokens/tokens.css`, including
  `tokyo/product/widgets/faq/widget.html:7`,
  `tokyo/product/widgets/countdown/widget.html:7`,
  `tokyo/product/widgets/cards/widget.html:7`, and
  `tokyo/product/widgets/big-bang/widget.html:7`.

As-built read: the intended cascade is real: token source -> generated Tokyo
token output -> Roma/Bob/widgets.

### Malformed Color Token CSS

Evidence:

- `dieter/tokens/dieter-color-tokens.css:1` opens a comment.
- `dieter/tokens/dieter-color-tokens.css:8` says "Do not edit anything below"
  but does not close the comment.
- `dieter/tokens/dieter-color-tokens.css:10` starts another comment marker, but
  nested CSS comments are not real nested comments.
- `dieter/tokens/dieter-color-tokens.css:11` starts `:root {` while still
  inside the original comment.
- `dieter/tokens/dieter-color-tokens.css:13-18` contains intended semantic
  declarations for `--color-text`, `--color-text-secondary`, `--role-surface`,
  `--role-surface-bg`, `--role-border`, and `--focus-ring-color`.
- `dieter/tokens/dieter-color-tokens.css:21-26` contains intended state
  controls.
- The first visible close marker appears on `dieter/tokens/dieter-color-tokens.css:23`
  in the inline comment after `--state-hover-mix`.
- `dieter/tokens/dieter-color-tokens.css:24-26` then continue declarations
  outside the intended `:root` selector.
- `dieter/tokens/dieter-color-tokens.css:173` closes the block.
- The same malformed header exists in generated Tokyo output:
  `tokyo/product/dieter/tokens/dieter-color-tokens.css:1-23`.
- The same issue exists in shadow token output, with `:host` instead of
  `:root`: `tokyo/product/dieter/tokens/dieter-color-tokens.shadow.css:1-23`.

As-built read: the CSS source contains the intended model textually, but the
syntax boundary means the early roles/state declarations cannot be assumed to
be active. This is a current-state finding, not a fix proposal.

### Textual Token Model

Evidence:

- Intended semantic roles: `dieter/tokens/dieter-color-tokens.css:13-18`.
- Intended state controls: `dieter/tokens/dieter-color-tokens.css:20-26`.
- Light system palette starts at `dieter/tokens/dieter-color-tokens.css:28`.
- Base Apple-like color tokens include red/orange/yellow/green/mint/teal/cyan/
  blue/indigo/purple/pink/brown from
  `dieter/tokens/dieter-color-tokens.css:29-123`.
- Each hue includes a `-contrast` token and `-1` through `-5` OKLAB tints in
  those same ranges.
- Neutral ladder starts at `dieter/tokens/dieter-color-tokens.css:125`.
- Neutral base tokens include white, black, black-secondary, gray, gray-2
  through gray-6 at `dieter/tokens/dieter-color-tokens.css:126-135`.
- Neutral OKLAB steps run through
  `dieter/tokens/dieter-color-tokens.css:137-171`.

As-built read: the declared design intent is a light-only system palette with
OKLAB ramps, neutral ladders, contrast partners, role tokens, and global state
mix controls. The token file does not contain a complete dark token palette.

## Generated Output And Build

Evidence:

- `scripts/build-dieter.js:164-184` generates token shadow CSS by replacing
  `:root` with `:host`.
- `scripts/build-dieter.js:265-275` copies `dieter/tokens` into
  `tokyo/product/dieter/tokens`.
- `tokyo/product/dieter/tokens/dieter-color-tokens.css:13-18` mirrors intended
  role declarations.
- `tokyo/product/dieter/tokens/dieter-color-tokens.css:1-23` mirrors the
  malformed comment/header issue.

As-built read: build propagation is working mechanically. It carries both the
intended token text and the current source defect into product output.

## Dieter Component Consumption

Evidence:

- Subagent audit found 23 of 24 Dieter component CSS files contain color/token/
  `color-mix`/`currentColor` usage.
- Button references undefined `--color-surface` in source:
  `dieter/components/button/button.css:8`, `:190`, and `:321`.
- The same button references exist in Tokyo output:
  `tokyo/product/dieter/components/button/button.css:8`, `:190`, and `:321`.
- Textfield consumes system tokens directly:
  `dieter/components/textfield/textfield.css:5`, `:37`, and `:51`.
- Component-local dark blocks exist in
  `dieter/components/textfield/textfield.css:143-146`,
  `dieter/components/dropdown-actions/dropdown-actions.css:140-150`,
  `dieter/components/dropdown-edit/dropdown-edit.css:224-230`, and
  `dieter/components/valuefield/valuefield.css:144-146`.
- Segmented has both `prefers-color-scheme: dark` and `[data-theme="dark"]`
  selectors in `dieter/components/segmented/segmented.css:266-282`.
- `--state-muted-opacity` is referenced but not defined in token source:
  `dieter/components/dropdown-border/dropdown-border.css:273` and
  `dieter/components/dropdown-shadow/dropdown-shadow.css:274`.

As-built read: components broadly participate in the token system, but usage is
not pure role-token composition. Some components consume raw system tokens
directly, some contain component-local dark handling, and some reference missing
tokens.

## Color Picker And Raw Hex Reality

Evidence:

- `dieter/components/dropdown-fill/dropdown-fill.html:183-238` contains raw hex
  swatch values such as `#ff3b30`, `#ff9500`, `#007aff`, `#212121`, and
  `#ffffff`.
- `dieter/components/dropdown-fill/dropdown-fill.html:318` uses a raw hex
  placeholder.
- `dieter/components/dropdown-fill/fill-types.ts:43-44` uses raw hex defaults
  for gradient stops.
- `dieter/components/dropdown-fill/dropdown-fill.css:603-610` uses raw hexes
  for the hue gradient itself.
- `dieter/components/dropdown-fill/dropdown-fill.ts:540` formats user-selected
  colors as `rgba(...)` or hex.
- `dieter/components/dropdown-fill/dropdown-fill-gradient.ts:552` formats
  gradient values as `rgba(...)` or hex.

As-built read: raw hex is not only in base token definitions. It is also present
in picker swatches, defaults, gradients, and user-authored color serialization.
That may be appropriate for an authoring control, but docs must scope claims
carefully.

## DevStudio Color Reveal And Edit Surface

Evidence:

- `admin/src/css/tokens.css:1-3` imports Dieter tokens from source.
- `admin/src/main.ts:1` imports `@dieter/tokens/tokens.css`.
- `admin/scripts/generate-foundation-pages.mjs:11` reads
  `dieter/tokens/dieter-color-tokens.css`.
- `admin/scripts/generate-foundation-pages.mjs:28-39` strips only closed
  comments before parsing custom properties with regex.
- `admin/scripts/generate-foundation-pages.mjs:42-45` filters color/role/focus/
  state target tokens for the generated color page.
- `admin/scripts/generate-foundation-pages.mjs:95-121` writes `colors.html`.
- `admin/src/html/foundations/colors.html:1-2` declares the generated color page
  and 132 governed rows.
- `admin/src/html/foundations/colors.html:1915-2002` exposes role/focus/state
  rows such as `--role-surface`, `--role-surface-bg`, `--focus-ring-color`, and
  state targets as token-edit buttons.
- `admin/src/main.ts:656-660` binds `[data-token-edit]` nodes to the runtime
  token editor.
- `admin/functions/api/dieter/tokens/colors.js:1-5` and
  `admin/functions/api/dieter/tokens/colors/value.js:1-5` delegate color token
  API routes to the shared handler.
- `admin/functions/_shared/dieter-tokens.js:5-10` only treats `^--color-` as
  color-token readable/editable and only accepts hex values.
- `admin/functions/_shared/dieter-tokens.js:97-103` rejects non-`--color-`
  token writes and non-hex writes.
- `admin/functions/_shared/dieter-tokens.js:108-117` refuses replacement when
  the current token value is non-hex.

As-built read: DevStudio reveal is broader than DevStudio write. Generated UI
can display role/focus/state rows, but the write path is narrow: `--color-*`
and hex-only. This is current behavior, not a proposed fix.

## Bob And Roma Consumers

Evidence:

- Roma imports deployed Dieter tokens and component CSS from Tokyo base in
  `roma/app/layout.tsx:5-18`.
- Bob imports Dieter tokens/components in `bob/app/layout.tsx:4-20`.
- Bob compiler includes token CSS in compiled widget media:
  `bob/lib/compiler/media.ts:103-110`.
- Roma shell CSS is mostly token-driven but references undefined
  `--color-system-gray-7` in `roma/app/roma.css:494`.
- Bob session includes typed `theme: 'light' | 'dark'` in
  `bob/lib/session/sessionTypes.ts:21`.
- Bob session defaults theme to light in `bob/lib/session/sessionTypes.ts:145`.

As-built read: Bob/Roma consume Dieter tokens and expose some theme-related
state, but there is no complete token-level dark palette backing a full light/
dark color contract.

## Public Widget Runtime

Evidence:

- Widget templates load `/dieter/tokens/tokens.css`; examples:
  `tokyo/product/widgets/faq/widget.html:7`,
  `tokyo/product/widgets/countdown/widget.html:7`,
  `tokyo/product/widgets/cards/widget.html:7`,
  `tokyo/product/widgets/big-bang/widget.html:7`.
- Countdown defines `--countdown-item-bg` from undefined
  `--color-system-gray-10`: `tokyo/product/widgets/countdown/widget.css:2-4`.
- Shared social share uses token fallbacks with raw hex fallback values:
  `tokyo/product/widgets/shared/socialShare.css:8`, `:143-166`, `:203-206`,
  and `:225`.
- Shared appearance runtime defaults shadow color to raw `#000000`:
  `tokyo/product/widgets/shared/appearance.js:57-59`.
- `tokyo/product/widgets/shared/stagePod.js:145` also defaults shadow color to
  raw `#000000`.

As-built read: public widgets are connected to Dieter tokens, but runtime
fallbacks and default user-authored shadow values still include raw colors.

## Current Documentation Drift

Evidence:

- `documentation/engineering/UI/color.md:7-8` says CSS files are authoritative.
  That is correct as authority, but the current source/output CSS is malformed
  at the comment boundary.
- `documentation/engineering/UI/color.md:25` says base tokens are the only
  place raw hex lives. That is only safe if scoped to color-token definitions;
  picker swatches, defaults, gradients, and runtime fallbacks also contain raw
  hex.
- `documentation/engineering/UI/color.md:83-85` describes a state example using
  `--state-hover-target`, but token source defines `--state-darken-target` and
  `--state-lighten-target`, not `--state-hover-target`:
  `dieter/tokens/dieter-color-tokens.css:21-26`.
- `documentation/engineering/UI/color.md:116-123` says dark mode is anticipated
  but not shipped. That is directionally true for the token palette, but should
  not imply there are no component-local dark selectors.
- `documentation/engineering/UI/color.md:124-127` records `--color-surface` and
  `--color-bg` as consumer bugs. Current audit also found
  `--color-system-gray-7`, `--color-system-gray-10`, and
  `--state-muted-opacity`.
- `Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126B__PRD__Color.md:4`
  references stale/nonexistent `126A__PRD__Dieter_Tokens.md`.
- `documentation/engineering/UI/color.md:7` references nonexistent
  `126A2__SUBPRD__Color_System.md`.

## Known Current Gaps

These are current-state gaps only, not selected fixes:

1. Color token CSS source/output is malformed at the opening comment boundary.
2. Semantic roles/state controls are textually present but not safely active CSS
   because of that boundary.
3. No complete token-level dark palette exists.
4. Component-local dark selectors exist, so docs must say "no complete dark
   token contract," not "no dark implementation anywhere."
5. Undefined or missing token references include `--color-surface`,
   `--color-bg`, `--color-system-gray-7`, `--color-system-gray-10`, and
   `--state-muted-opacity`.
6. DevStudio reveal and DevStudio write scope differ: reveal includes role/
   focus/state rows; write accepts only `--color-*` hex values.
7. Contrast is not formally audited across actual foreground/background
   pairings.
8. Raw hex exists outside base tokens in authoring controls, defaults, gradients,
   and runtime fallback paths.
9. Docs have stale references and examples that no longer match the source.
10. Existing 126B PRD has Step 2 drift because it prescribes fixes.

## What This Audit Does Not Claim

- It does not claim the color system is broken beyond repair.
- It does not claim the palette should be redesigned.
- It does not claim dark mode should be implemented in this phase.
- It does not choose Material, Apple, or OpenAI color doctrine.
- It does not propose runtime code changes.
- It does not touch DevStudio write APIs or product data.

## Step Boundary For 126B

This Step 1 artifact should feed human comparison with GLM and later Step 4
convergence. It must not be treated as final doctrine, final gap audit, or an
implementation plan.
