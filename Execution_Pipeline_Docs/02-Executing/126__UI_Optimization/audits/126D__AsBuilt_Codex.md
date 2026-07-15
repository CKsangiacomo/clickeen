# 126D Typography - Codex As-Built Audit

Status: FROZEN POINT-IN-TIME PRE-EXECUTION AS-BUILT - code and remote font state changed or may have changed; exact working-tree provenance may be unrecorded; no step-9 execution credit.

Scope: current Clickeen typography implementation across Dieter typography
tokens/classes, generated DevStudio typography data, Bob/Roma shell typography,
Bob typography editor contracts, widget-shell typography state paths, public
widget runtime typography, generated Tokyo Dieter output, deploy-copy paths, and
current docs drift.

This file states current reality only. It does not select fixes, converge with
GLM, write doctrine, or execute Step 4+.

Authority boundary:

- Product surface inspected: Dieter typography, DevStudio/Admin typography
  page, Bob/Roma typography consumers, widget-shell typography state, public
  widget typography runtime.
- Account/session/storage/route/runtime/deploy authorities: not touched.
- Product data: not touched.
- Verification surface: local source/docs inspection only.

## Executive Current Reality

Clickeen already has two real typography systems in active use:

- Dieter has a source typography CSS file with font, size, fluid-display,
  line-height, and utility-class definitions.
- Public widgets have a stricter runtime typography engine that validates widget
  typography config and emits `--typo-*` CSS variables.

Those systems overlap, but they are not the same contract:

- Dieter exposes static and viewport-fluid tokens such as `--fs-*`,
  `--fs-fluid-display-*`, and `--lh-*`.
- Widget runtime exposes role scales, tracking presets, line-height presets,
  script fallback fonts, validation, and container-query fluid sizing.
- Bob can author many widget typography roles through the compiler module.
- Widget-shell owns a smaller default set of shell typography roles.
- DevStudio previews Dieter utility classes, but its editable token API only
  exposes `--fs-*` and `--lh-*` tokens for the typography kind.

The main current gaps are contract gaps:

- Dieter has no tracking token layer even though many utilities inline
  `letter-spacing`.
- Dieter viewport fluid display and widget runtime container-query fluid sizing
  are separate mechanisms.
- Dieter line-height tokens are incomplete as the behavioral source because
  some utilities use raw line-height values and some declared tokens are unused
  by utilities.
- `--font-display` is referenced by public widget CSS but is not defined in the
  inspected source state.
- Several source files use class names that are not current Dieter typography
  classes.
- The typography docs understate Bob/widget runtime behavior and current class
  counts.

## Program And Source Authority

Evidence:

- MAMA Step 1 is an independent current-system read: code owns current reality,
  no fixes, no convergence, no external research:
  `Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126__PRD__UI_Optimization_Program.md:182`.
- 126D owns typography mechanics: families, size scale, fluid display, line
  heights, and utility classes:
  `Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126D__PRD__Typography.md:7`.
- `CONTEXT.md` names Dieter as the design-system authority:
  `documentation/architecture/CONTEXT.md:164`.
- `documentation/engineering/UI/typography.md:7` names
  `dieter/tokens/dieter-typography.css` as the CSS source of truth.

As-built read: Dieter owns the general design-system type utility substrate.
Widget runtime owns saved-widget typography execution. Bob, Roma, Admin, and
public widgets consume those substrates through different paths.

## Dieter Typography Tokens

Source:

- `dieter/tokens/dieter-typography.css`.

Current root token set:

- `--font-ui` and `--font-mono` are declared at
  `dieter/tokens/dieter-typography.css:3-4`.
- `--fs-body`, `--fs-ui`, and `--lh-body` are declared at
  `dieter/tokens/dieter-typography.css:7-9`.
- Static size tokens `--fs-10` through `--fs-32` are declared at
  `dieter/tokens/dieter-typography.css:12-22`.
- Fluid display tokens `--fs-fluid-display-1`, `--fs-fluid-display-2`, and
  `--fs-fluid-display-3` use viewport `clamp(...vw...)` formulas at
  `dieter/tokens/dieter-typography.css:25-27`.
- Line-height tokens `--lh-tight`, `--lh-normal`, `--lh-loose`, and
  `--lh-body-ui` are declared at `dieter/tokens/dieter-typography.css:29-32`.

As-built read:

- Dieter has a real type token layer.
- The layer covers UI/body sizes, a static size ladder, display-fluid sizes,
  and a small line-height set.
- There is no `--font-display` declaration in the inspected source state.
- There is no Dieter tracking token custom property in
  `dieter/tokens/dieter-typography.css`.

## Dieter Utility Classes

Current utility families:

- Display classes are defined at `dieter/tokens/dieter-typography.css:36-50`.
- Body classes and aliases are defined at
  `dieter/tokens/dieter-typography.css:55-70`.
- Raw heading selectors plus `.heading-1` through `.heading-6` are defined at
  `dieter/tokens/dieter-typography.css:73-107`.
- Label classes are defined at `dieter/tokens/dieter-typography.css:110-116`.
- Caption classes are defined at `dieter/tokens/dieter-typography.css:118-119`.
- Overline classes are defined at
  `dieter/tokens/dieter-typography.css:122-133`.

Observed utility behavior:

- Display utilities inline `font` shorthand and `letter-spacing`:
  `dieter/tokens/dieter-typography.css:36-50`.
- Heading utilities inline `letter-spacing` values:
  `dieter/tokens/dieter-typography.css:73-107`.
- Label, caption, and overline classes include typography mechanics and color
  semantics:
  `dieter/tokens/dieter-typography.css:110-133`.
- Display utilities use raw line-height `1.08` rather than `--lh-*`:
  `dieter/tokens/dieter-typography.css:37,43,49`.
- `.caption-small` uses raw line-height `1.1`:
  `dieter/tokens/dieter-typography.css:119`.
- `.overline` and `.overline-small` use raw line-height `1` and `1.1`:
  `dieter/tokens/dieter-typography.css:123,130`.

As-built read:

- Dieter utilities are useful and already widely consumed.
- They are not purely token-driven because several values are inlined directly
  into class definitions.
- They are not purely typography-only because label/caption/overline classes
  carry color decisions that belong to the 126B color domain.

## DevStudio Typography Generation

Current generated data path:

- `admin/scripts/generate-typography-json.cjs:4-6` reads
  `../../dieter/tokens/dieter-typography.css`.
- `admin/scripts/generate-typography-json.cjs:8-19` defines selector/category
  extraction.
- `admin/scripts/generate-typography-json.cjs:30-49` extracts CSS blocks by
  selector.
- `admin/scripts/generate-typography-json.cjs:52` writes
  `admin/src/data/typography.generated.json`.

Current preview data:

- `admin/src/data/typography.generated.json:1-142` contains generated sample
  entries.
- `admin/src/data/typography.ts:21-30` adapts the generated rows for runtime
  consumption.

DevStudio page rendering:

- `admin/scripts/generate-foundation-pages.mjs:185-203` creates the
  typography foundation page shell.
- `admin/src/html/foundations/typography.html:1-15` contains the generated
  placeholder shell.
- `admin/src/main.ts:566-626` hydrates typography preview rows and applies the
  class name directly to each sample.
- `admin/src/main.ts:613-618` creates the token edit action for typography.
- `admin/src/main.ts:656-660` routes typography edit clicks into the token
  editor.

Editable token limitation:

- `admin/functions/_shared/dieter-tokens.js:12-17` maps the typography kind to
  `dieter/tokens/dieter-typography.css`.
- `admin/functions/_shared/dieter-tokens.js:80-94` parses only tokens matching
  `^--(?:fs|lh)-` for typography editing.

As-built read:

- DevStudio typography preview is generated from Dieter CSS, which is correct
  for current design-system visibility.
- The generated JSON is preview/sample data, not the full behavior authority.
- DevStudio typography token editing does not currently expose `--font-*` or
  inline tracking values.

## Bob Shell Typography

Bob imports Dieter tokens/components:

- `bob/app/layout.tsx:1-5` imports Next `Inter_Tight` and Dieter CSS.
- `bob/app/layout.tsx:15-22` applies the shell layout.

Bob shell CSS:

- `bob/app/bob_app.css:15-19` uses `var(--font-ui, "Inter Tight", Inter, ...)`
  for body text.
- `bob/app/bob_app.css:367-370` uses a hardcoded monospace stack for code
  blocks rather than `--font-mono`.

Bob component usage:

- `bob/components/TranslationsPanel.tsx:207-239` uses Dieter classes such as
  `heading-3`, `label-s`, and `body-s`.
- `bob/components/TopDrawer.tsx:24-30` uses `heading-3`.
- `bob/components/TdMenu.tsx:16-22` exposes Typography as a drawer panel label.

As-built read:

- Bob consumes Dieter typography utilities for shell UI.
- Bob also contains local font-stack decisions where code blocks bypass the
  Dieter mono token.

## Bob Widget Typography Editor

Compiler/editor path:

- `bob/lib/compiler/editor-contract.ts:363-377` creates the shared typography
  panel only when the spec panel declares `shared.id === "typography"` and
  `defaults.typography.roles` exists.
- `bob/lib/compiler/modules/typography.ts:9-16` defines size preset options.
- `bob/lib/compiler/modules/typography.ts:18-21` defines style options.
- `bob/lib/compiler/modules/typography.ts:23-30` defines tracking preset
  options.
- `bob/lib/compiler/modules/typography.ts:32-39` defines line-height preset
  options.
- `bob/lib/compiler/modules/typography.ts:61-76` defines 14 role candidates:
  `title`, `body`, `eyebrow`, `section`, `question`, `answer`, `heading`,
  `timer`, `label`, `button`, `localeSwitcher`, `bigBang`, `cardTitle`,
  `cardCopy`.
- `bob/lib/compiler/modules/typography.ts:89-116` emits role controls for
  family, size preset/custom, style, weight, color, line-height preset/custom,
  and tracking preset/custom.

Font registry:

- `bob/lib/edit/typography-fonts.ts:33-223` defines font records including
  Google and Tokyo sources, categories, and usage metadata.
- `bob/lib/edit/typography-fonts.ts:301-323` derives available styles and
  weights.

As-built read:

- Bob has a real structured typography editing contract.
- The editor is richer than Dieter's public typography utility doc.
- Bob's role surface is wider than the widget-shell default shell-role set.

## Roma Typography

Roma imports Dieter and Inter Tight:

- `roma/app/layout.tsx:1-20` imports Tokyo-hosted Dieter tokens/components and
  Next `Inter_Tight`.

Roma utility usage:

- `roma/components/roma-shell.tsx:17-22` and
  `roma/components/roma-shell.tsx:43-48` use Dieter classes including `body-l`,
  `label-s`, and `heading-2`.
- `roma/components/roma-nav.tsx:20-38` and
  `roma/components/roma-nav.tsx:63-66` use `label-s`.

Roma direct CSS usage:

- `roma/app/roma.css:463-472` uses `font: 400 var(--fs-13) /
  var(--lh-body-ui) var(--font-ui)` for widget default inputs.
- `roma/app/roma.css:489-498` uses `--font-mono` for contract error paths.
- `roma/app/roma.css:565-568` uses `--font-ui` for `pre` blocks.
- `roma/app/roma.css:611-618` uses direct UI font shorthand for general inputs.

Observed class drift:

- `roma/components/team-domain.tsx:223-256` uses `heading-h4`.
- `roma/components/team-member-domain.tsx:210-222` uses `heading-h3` and
  `heading-h4`.
- `roma/components/team-member-domain.tsx:263-264` uses `heading-h4`.
- `roma/components/accept-invite-domain.tsx:87-105` uses `heading-h3`.
- `dieter/tokens/dieter-typography.css:85-94` defines `.heading-3` and
  `.heading-4`, not `.heading-h3` or `.heading-h4`.

As-built read:

- Roma consumes Dieter typography utilities and direct typography tokens.
- Some Roma class names do not match current Dieter typography utility names.

## Widget-Shell Typography Contract

Widget-shell contract:

- `packages/widget-shell/src/contract.ts:14-22` declares shell typography state
  paths for four roles: `title`, `body`, `button`, `localeSwitcher`.
- `packages/widget-shell/src/controls.ts:13-27` exposes typography controls for
  family, size, custom size, style, weight, color, line-height, and tracking.
- `packages/widget-shell/src/controls.ts:35-46` maps shell role paths into
  control definitions.
- `packages/widget-shell/src/modules.ts:10-24` includes `typography-data.js`
  and `typography.js` in shared runtime modules.

Default role evidence:

- `packages/widget-shell/src/defaults.ts:315` seeds shell default typography.
- `packages/widget-shell/src/defaults.ts:315-378` covers a smaller default role
  set than Bob's 14 role candidates.

As-built read:

- Widget-shell owns the shared shell contract for default role paths.
- Bob can expose more role candidates than shell defaults seed.

## Public Widget Typography Runtime

Runtime data:

- `tokyo/product/widgets/shared/typography-data.js:1-6` freezes typography
  data on `window.CK_WIDGET_TYPOGRAPHY_DATA`.
- `tokyo/product/widgets/shared/typography-data.js:7-31` includes Google and
  Tokyo-hosted font definitions.

Runtime scales and presets:

- `tokyo/product/widgets/shared/typography.js:6-14` defines global role scales
  for `title`, `body`, `section`, `question`, `answer`, `button`, and
  `localeSwitcher`.
- `tokyo/product/widgets/shared/typography.js:15-22` defines tracking presets.
- `tokyo/product/widgets/shared/typography.js:23-30` defines line-height
  presets.
- `tokyo/product/widgets/shared/typography.js:31-41` defines default role line
  heights.
- `tokyo/product/widgets/shared/typography.js:42-44` defines the fluid
  reference width and display-fluid role set.
- `tokyo/product/widgets/shared/typography.js:46-95` defines script typography
  profiles, including CJK line-height handling.
- `tokyo/product/widgets/shared/typography.js:103-124` defines script fonts.
- `tokyo/product/widgets/shared/typography.js:133-184` defines the script
  fallback matrix.

Runtime application:

- `tokyo/product/widgets/shared/typography.js:290-303` resolves fluid size
  values with container-query `cqi` clamps.
- `tokyo/product/widgets/shared/typography.js:666-678` fails if root,
  typography object, role config, or `CSS.supports` is missing.
- `tokyo/product/widgets/shared/typography.js:689-741` validates global family
  and role fields.
- `tokyo/product/widgets/shared/typography.js:744-761` validates allowed family
  weights/styles.
- `tokyo/product/widgets/shared/typography.js:778` only honors `sizeCustom`
  when the size preset is `custom`.
- `tokyo/product/widgets/shared/typography.js:828-835` writes
  `--typo-{role}-family`, `--typo-{role}-size`, `--typo-{role}-weight`,
  `--typo-{role}-style`, `--typo-{role}-color`, `--typo-{role}-tracking`, and
  `--typo-{role}-line-height`.
- `tokyo/product/widgets/shared/typography.js:839` exposes
  `CKTypography.applyTypography`.

As-built read:

- Widget runtime is a strict typography executor, not a passive CSS utility.
- It has its own tracking, line-height, script, font, and fluid-sizing behavior.
- That behavior is not equivalent to Dieter typography utilities.

## Public Widget CSS Consumers

Runtime `--typo-*` consumers include:

- `tokyo/product/widgets/shared/header.css:63-80` for title/body typography.
- `tokyo/product/widgets/shared/header.css:154-159` for button typography.
- `tokyo/product/widgets/shared/localeSwitcher.css:124-129` for locale switcher
  typography.
- `tokyo/product/widgets/shared/stagePod.css:7-12` for base body font.
- `tokyo/product/widgets/shared/stagePod.css:132-154` for text wrapping.
- `tokyo/product/widgets/cards/widget.css:100-117` for card title/copy
  typography.
- `tokyo/product/widgets/big-bang/widget.css:36-54` for statement/support
  typography.
- `tokyo/product/widgets/calltoaction/widget.css:42-99` for eyebrow/title/body
  and button typography.
- `tokyo/product/widgets/countdown/widget.css:98-125`,
  `tokyo/product/widgets/countdown/widget.css:164-170`, and
  `tokyo/product/widgets/countdown/widget.css:198-205` for timer/label/button
  typography.
- `tokyo/product/widgets/faq/widget.css:49-56`,
  `tokyo/product/widgets/faq/widget.css:77-96`, and
  `tokyo/product/widgets/faq/widget.css:139-146` for section/question/answer
  typography.

Observed undefined font token references:

- `tokyo/product/widgets/cards/widget.css:102` references
  `var(--font-display)`.
- `tokyo/product/widgets/big-bang/widget.css:38` references
  `var(--font-display)`.
- Current source search found no `--font-display:` definition in the inspected
  source state.

As-built read:

- Public widgets rely on widget runtime variables for user-authored type.
- Some widget CSS still references a display font token that is not defined by
  current Dieter tokens.

## Generated Output And Deploy Copy Path

Dieter output:

- `scripts/build-dieter.js:3-10` states that Dieter artifacts are built into
  `tokyo/product/dieter`.
- `scripts/build-dieter.js:265-275` copies token sources into Tokyo output.
- `scripts/build-dieter.js:164-184` generates shadow CSS by replacing `:root`
  with `:host`.
- Current local inspection found `dieter/tokens/dieter-typography.css` and
  `tokyo/product/dieter/tokens/dieter-typography.css` byte-identical in this
  checkout.
- `tokyo/product/dieter/tokens/dieter-typography.shadow.css:1` uses `:host`.

Cloud-dev path:

- `.github/workflows/cloud-dev-workers.yml:193-195` runs `pnpm build:dieter`
  when Dieter artifacts changed.
- `scripts/tokyo-r2-deploy-sync.mjs:28-31` maps `tokyo/product/dieter` to the
  `dieter` R2 path.

As-built read:

- Dieter source is `dieter/`.
- Tokyo Dieter files are generated/deploy output, not equal design authority.
- Drift risk exists if generated output is hand-edited, but the documented
  authority is not two equal sources.

## Docs Drift And Under-Specified Reality

Observed docs drift:

- `documentation/engineering/UI/typography.md:31-35` says utility classes total
  26 selectors.
- `scripts/dieter/governance-guards.mjs:91-93` currently locks generated
  typography data to 33 entries.
- `admin/src/data/typography.generated.json:1-142` contains the 33 generated
  class rows.
- `documentation/engineering/UI/typography.md:44-45` correctly names missing
  Dieter tracking and breakpoint/container-width token systems, but it does not
  describe the separate widget runtime tracking presets and `cqi` fluid engine.
- `documentation/engineering/UI/typography.md` does not describe DevStudio's
  typography token editor limitation to `--fs-*` and `--lh-*`.
- `documentation/widgets/shared/ShellCore.md:52-64` names
  `CKTypography.applyTypography`, but does not enumerate the runtime font
  registry, script fallback, tracking, line-height, and fluid-sizing behavior.

Observed class-name drift:

- `dieter/components/textedit/textedit.html:23` uses a typography class not in
  current generated Dieter typography rows.
- `dieter/components/textedit/textedit-dom.ts:58-63` uses typography class names
  not proven by the current Dieter utility list.
- Roma examples above use `heading-h3` and `heading-h4`, while Dieter defines
  `heading-3` and `heading-4`.

As-built read:

- Current docs tell part of the truth but do not fully represent the active
  typography substrate.
- Step 4+ should not start from doc claims alone; it must use source/runtime
  evidence.

## Known Gaps Only

This section records current gaps without choosing fixes:

- No Dieter tracking token layer.
- Two fluid-type mechanisms: Dieter viewport `vw` display clamps and widget
  runtime container-query `cqi` clamps.
- Two tracking surfaces: Dieter inline utility tracking and widget runtime
  tracking presets.
- Line-height token coverage is incomplete because some utilities hardcode raw
  line heights and some declared line-height tokens are not used by utilities.
- `--font-display` is referenced but not defined in inspected source.
- Bob has at least one mono-stack bypass of `--font-mono`.
- DevStudio typography token editor does not expose all typography decisions in
  the CSS file.
- Bob authoring roles and widget-shell default roles are not the same set.
- Current docs understate runtime/Bob behavior and current generated class
  counts.

## Gaps And Unknowns

- This audit is repo-source only.
- Deployed Cloudflare/R2 bytes were not inspected.
- Browser-computed styles were not inspected.
- Account-owned saved widget instances were not inspected.
- No build, lint, typecheck, Playwright, or runtime verification was run.
- No product data was read or mutated.
- No code behavior was changed.
