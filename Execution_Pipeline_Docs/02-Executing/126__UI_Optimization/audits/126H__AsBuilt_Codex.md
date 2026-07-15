# 126H Dieter - As-Built Audit - Codex

Status: FROZEN POINT-IN-TIME PRE-EXECUTION AS-BUILT - code changed afterward; exact working-tree provenance may be unrecorded; no step-9 execution credit.
Scope: Dieter design-system substrate: token files, foundation substrate, component consumption of foundation tokens, generated artifacts, manifest evidence, and known code/docs drift.

No code changes, no runtime operations, no product data changes, no Cloudflare/R2 preflight.

## Authority Boundary

- Dieter is documented as Clickeen's design system authority.
- Dieter owns tokens, component CSS/specs/snippets, icons, optional hydrators, and generated Tokyo artifacts.
- Product surfaces consume Dieter artifacts; they do not own Dieter source truth.
- Active Dieter source is under `dieter/**`.
- Generated Dieter runtime artifacts are under `tokyo/product/dieter/**`.
- The active Dieter build script is root `scripts/build-dieter.js`.

Evidence:

- `documentation/services/dieter.md:5`
- `documentation/services/dieter.md:11`
- `documentation/services/dieter.md:14`
- `documentation/services/dieter.md:64`
- `dieter/package.json:13`
- `scripts/build-dieter.js:237`

## Token Entrypoints

- `dieter/tokens/tokens.css` imports foundation, color, and typography token files.
- Import order is foundation first, color second, typography third.
- Foundation shadows reference color variables that are defined in the color token file, so the foundation file is broad but not self-contained.
- The token layer is therefore a composed token entrypoint, not three isolated standalone files.

Evidence:

- `dieter/tokens/tokens.css:1`
- `dieter/tokens/tokens.css:2`
- `dieter/tokens/tokens.css:3`
- `dieter/tokens/dieter-foundation-tokens.css:85`
- `dieter/tokens/dieter-foundation-tokens.css:86`
- `dieter/tokens/dieter-foundation-tokens.css:87`
- `dieter/tokens/dieter-color-tokens.css:126`
- `dieter/tokens/dieter-color-tokens.css:127`

## Foundation Token Definition Map

`dieter/tokens/dieter-foundation-tokens.css` defines:

- spacing: `--space-0` through `--space-10`
- vertical rhythm: `--vertspace-1` through `--vertspace-9`
- control sizing: `--control-size-xs` through `--control-size-xl`
- control spacing: `--control-padding-inline` and `--control-inline-gap-*`
- control radii: `--control-radius-*`
- surface radius aliases: `--radius-3` and `--radius-4`
- icon sizing: `--icon-size-*`
- focus/input ergonomics: `--focus-ring-width`, `--focus-ring-offset`, `--min-touch-target`
- motion durations: `--duration-snap`, `--duration-base`, `--duration-spin`
- elevation: `--shadow-elevated`, `--shadow-floating`, `--shadow-inset-control`
- `.sr-only`
- reduced-motion global guard

Evidence:

- `dieter/tokens/dieter-foundation-tokens.css:4`
- `dieter/tokens/dieter-foundation-tokens.css:17`
- `dieter/tokens/dieter-foundation-tokens.css:28`
- `dieter/tokens/dieter-foundation-tokens.css:35`
- `dieter/tokens/dieter-foundation-tokens.css:43`
- `dieter/tokens/dieter-foundation-tokens.css:61`
- `dieter/tokens/dieter-foundation-tokens.css:65`
- `dieter/tokens/dieter-foundation-tokens.css:75`
- `dieter/tokens/dieter-foundation-tokens.css:80`
- `dieter/tokens/dieter-foundation-tokens.css:85`
- `dieter/tokens/dieter-foundation-tokens.css:92`
- `dieter/tokens/dieter-foundation-tokens.css:99`

## Spacing And Rhythm

- The structural spacing ladder is documented as a 4px grid.
- `--space-0` is a 2px sub-step.
- `--space-1` through `--space-10` proceed in 4px increments from 4px through 40px.
- Vertical rhythm is a separate `--vertspace-*` scale using 0.1rem increments.
- The vertical rhythm scale is finer than the structural spacing scale.
- `--control-padding-inline` composes `--space-2`.
- `--control-inline-gap-*` values are hard-coded rem values, not references back to `--space-*`.
- This creates multiple independent definitions of similar numeric values such as 8px.

Evidence:

- `dieter/tokens/dieter-foundation-tokens.css:3`
- `dieter/tokens/dieter-foundation-tokens.css:4`
- `dieter/tokens/dieter-foundation-tokens.css:5`
- `dieter/tokens/dieter-foundation-tokens.css:14`
- `dieter/tokens/dieter-foundation-tokens.css:17`
- `dieter/tokens/dieter-foundation-tokens.css:25`
- `dieter/tokens/dieter-foundation-tokens.css:35`
- `dieter/tokens/dieter-foundation-tokens.css:36`
- `dieter/tokens/dieter-foundation-tokens.css:40`

## Control Sizing And Ergonomics

- Control sizes run from 16px to 32px.
- `--min-touch-target` is 44px.
- No control-size token natively reaches the 44px touch target.
- Therefore visual control size and interaction target are separate concepts in the token file.
- The touch-target token exists, but component consumption is not wired through it.

Evidence:

- `dieter/tokens/dieter-foundation-tokens.css:28`
- `dieter/tokens/dieter-foundation-tokens.css:32`
- `dieter/tokens/dieter-foundation-tokens.css:77`
- `dieter/tokens/dieter-foundation-tokens.css:75`
- `dieter/tokens/dieter-foundation-tokens.css:76`
- `dieter/tokens/dieter-color-tokens.css:18`

## Radius And Shape

- `--control-radius-*` defines a long radius ladder from 0px through 76px.
- `--radius-3` and `--radius-4` are defined as aliases for `--control-radius-md` and `--control-radius-lg`.
- These aliases are real consumed tokens, not ghost tokens.
- They are consumed by hand-written components, not only generated previews.
- There are no `--radius-0`, `--radius-1`, or `--radius-2` aliases in the token file.
- Component code references `--radius-2` without fallback in `bulk-edit`, which means there is a real undefined no-fallback consumer.

Evidence:

- `dieter/tokens/dieter-foundation-tokens.css:43`
- `dieter/tokens/dieter-foundation-tokens.css:58`
- `dieter/tokens/dieter-foundation-tokens.css:60`
- `dieter/tokens/dieter-foundation-tokens.css:61`
- `dieter/tokens/dieter-foundation-tokens.css:62`
- `dieter/components/bulk-edit/bulk-edit.css:30`
- `dieter/components/bulk-edit/bulk-edit.css:53`
- `dieter/components/object-manager/object-manager.css:35`
- `dieter/components/object-manager/object-manager.css:60`
- `dieter/components/popover/popover.css:42`
- `dieter/components/repeater/repeater.css:80`
- `dieter/components/repeater/repeater.css:168`
- `dieter/components/bulk-edit/bulk-edit.css:96`
- `dieter/components/bulk-edit/bulk-edit.css:112`

## Icon Sizing

- Icon size tokens are pixel-keyed names: `--icon-size-12` through `--icon-size-40`.
- The icon component consumes these size tokens for multiple rendered icon sizes.
- Button and menuactions also consume icon size tokens.
- Some icon-like component variables remain outside the token file: `--control-icon-xs`, `--control-icon-sm`, and `--icon-glyph-ratio-*` appear as fallback-backed component variables.

Evidence:

- `dieter/tokens/dieter-foundation-tokens.css:65`
- `dieter/tokens/dieter-foundation-tokens.css:72`
- `dieter/components/icon/icon.css:5`
- `dieter/components/icon/icon.css:18`
- `dieter/components/icon/icon.css:48`
- `dieter/components/icon/icon.css:53`
- `dieter/components/button/button.css:90`
- `dieter/components/button/button.css:114`
- `dieter/components/menuactions/menuactions.css:18`
- `dieter/components/menuactions/menuactions.css:47`
- `dieter/components/textedit/textedit.css:69`
- `dieter/components/textedit/textedit.css:94`
- `dieter/components/menuactions/menuactions.css:19`
- `dieter/components/menuactions/menuactions.css:48`

## Focus And Touch Consumption

- Focus-ring width, focus-ring offset, focus-ring color, and min-touch-target are defined.
- The component sweep found those token names only in token files, not in `dieter/components`.
- Several components implement focus/outline behavior directly using raw outlines, `var(--color-system-blue)`, or `color-mix`.
- `button.css` has no `:focus`, `:focus-visible`, or `outline` match in the current file.
- Therefore focus/touch ergonomics are token-defined but not consistently token-consumed.

Evidence:

- `dieter/tokens/dieter-foundation-tokens.css:75`
- `dieter/tokens/dieter-foundation-tokens.css:76`
- `dieter/tokens/dieter-foundation-tokens.css:77`
- `dieter/tokens/dieter-color-tokens.css:18`
- `dieter/components/bulk-edit/bulk-edit.css:119`
- `dieter/components/slider/slider.css:71`
- `dieter/components/dropdown-fill/dropdown-fill.css:270`
- `dieter/components/dropdown-border/dropdown-border.css:261`
- `dieter/components/dropdown-shadow/dropdown-shadow.css:254`

## Motion In Foundation

- Foundation defines duration tokens only.
- `--duration-base` is consumed across components.
- `--duration-snap` and `--duration-spin` were found only in the token file during this sweep.
- Button uses raw `150ms ease` transitions in multiple places instead of the duration token scale.
- `--easing-standard` appears in dropdown-fill with a fallback, but no easing token is defined in `dieter/tokens`.
- The foundation file includes a global reduced-motion guard.

Evidence:

- `dieter/tokens/dieter-foundation-tokens.css:80`
- `dieter/tokens/dieter-foundation-tokens.css:81`
- `dieter/tokens/dieter-foundation-tokens.css:82`
- `dieter/components/dropdown-fill/dropdown-fill.css:27`
- `dieter/components/toggle/toggle.css:68`
- `dieter/components/button/button.css:34`
- `dieter/components/button/button.css:215`
- `dieter/components/button/button.css:344`
- `dieter/components/dropdown-fill/dropdown-fill.css:254`
- `dieter/components/dropdown-fill/dropdown-fill.css:287`
- `dieter/tokens/dieter-foundation-tokens.css:99`

## Elevation And Shadows

- Foundation defines three shadow tokens.
- `--shadow-floating` is consumed by popover and textedit.
- `--shadow-inset-control` is consumed by choice-tiles.
- `--shadow-elevated` was found only in the token file during this sweep.
- Many components define raw `box-shadow` values directly.
- Bulk edit and object manager both use raw modal-like `0 18px 60px` shadows.
- Slider, toggle, dropdown-fill, dropdown-border, dropdown-shadow, and segmented also use raw shadows.
- Elevation is therefore partially tokenized and partially ad hoc.

Evidence:

- `dieter/tokens/dieter-foundation-tokens.css:85`
- `dieter/tokens/dieter-foundation-tokens.css:86`
- `dieter/tokens/dieter-foundation-tokens.css:87`
- `dieter/components/popover/popover.css:43`
- `dieter/components/textedit/textedit.css:167`
- `dieter/components/choice-tiles/choice-tiles.css:61`
- `dieter/components/bulk-edit/bulk-edit.css:36`
- `dieter/components/object-manager/object-manager.css:41`
- `dieter/components/slider/slider.css:58`
- `dieter/components/toggle/toggle.css:98`
- `dieter/components/dropdown-fill/dropdown-fill.css:337`
- `dieter/components/dropdown-border/dropdown-border.css:215`
- `dieter/components/dropdown-shadow/dropdown-shadow.css:208`
- `dieter/components/segmented/segmented.css:212`

## Z-Index And Layering

- No z-index token family is defined in `dieter/tokens`.
- Components use raw z-index values.
- Values include `0`, `1`, `2`, `3`, `12`, and `1000`.
- `popover` and `textedit` both use `12`.
- `bulk-edit` and `object-manager` both use `1000`.
- These values are coincidental component literals, not a shared tokenized stacking contract.

Evidence:

- `dieter/components/tabs/tabs.css:37`
- `dieter/components/tabs/tabs.css:85`
- `dieter/components/segmented/segmented.css:165`
- `dieter/components/segmented/segmented.css:181`
- `dieter/components/segmented/segmented.css:240`
- `dieter/components/popover/popover.css:16`
- `dieter/components/textedit/textedit.css:119`
- `dieter/components/bulk-edit/bulk-edit.css:20`
- `dieter/components/object-manager/object-manager.css:25`

## Undefined And Fallback-Masked References

### No-Fallback References

- `button.css` uses `--color-surface` for button background.
- Color tokens define `--role-surface` and `--role-surface-bg`, not `--color-surface`.
- This is a naming split, not just a missing arbitrary color token.
- `bulk-edit.css` uses `--radius-2` with no fallback.
- Foundation defines `--radius-3` and `--radius-4` aliases, not `--radius-2`.

Evidence:

- `dieter/components/button/button.css:8`
- `dieter/components/button/button.css:190`
- `dieter/components/button/button.css:321`
- `dieter/tokens/dieter-color-tokens.css:15`
- `dieter/tokens/dieter-color-tokens.css:16`
- `dieter/components/bulk-edit/bulk-edit.css:96`
- `dieter/components/bulk-edit/bulk-edit.css:112`
- `dieter/tokens/dieter-foundation-tokens.css:61`
- `dieter/tokens/dieter-foundation-tokens.css:62`

### Fallback-Masked References

- `--hspace-2`, `--hspace-3`, and `--hspace-4` appear in component code with fallbacks.
- The fallbacks match the `--vertspace-*` numeric scale.
- Foundation defines `--vertspace-*`, not `--hspace-*`.
- This looks like unresolved rename drift hidden by fallbacks.
- `--easing-standard`, `--control-icon-xs`, `--control-icon-sm`, `--control-letter-spacing`, and `--icon-glyph-ratio-*` also appear as fallback-backed component variables without matching foundation definitions.

Evidence:

- `dieter/components/dropdown-actions/dropdown-actions.css:8`
- `dieter/components/dropdown-border/dropdown-border.css:10`
- `dieter/components/dropdown-edit/dropdown-edit.css:11`
- `dieter/components/dropdown-fill/dropdown-fill.css:10`
- `dieter/components/dropdown-shadow/dropdown-shadow.css:11`
- `dieter/components/dropdown-upload/dropdown-upload.css:9`
- `dieter/components/textedit/textedit.css:5`
- `dieter/components/textfield/textfield.css:4`
- `dieter/components/tabs/tabs.css:50`
- `dieter/components/tabs/tabs.css:59`
- `dieter/components/tabs/tabs.css:64`
- `dieter/tokens/dieter-foundation-tokens.css:17`
- `dieter/components/dropdown-fill/dropdown-fill.css:254`
- `dieter/components/textedit/textedit.css:69`
- `dieter/components/toggle/toggle.css:25`
- `dieter/components/menuactions/menuactions.css:19`

## Button Consumption Reality

- Button consumes multiple foundation tokens for size, radius, gap, icon size, and padding.
- Button still uses `--color-surface`, which is not defined in color tokens.
- Button uses raw `150ms ease` transitions in multiple blocks.
- Button has no focus/outline selector match in the current file.
- Button is therefore a good example of the 126H reality: Dieter is token-defined and partially token-consumed, but consumption is not complete.

Evidence:

- `dieter/components/button/button.css:8`
- `dieter/components/button/button.css:22`
- `dieter/components/button/button.css:34`
- `dieter/components/button/button.css:45`
- `dieter/components/button/button.css:46`
- `dieter/components/button/button.css:69`
- `dieter/components/button/button.css:90`
- `dieter/components/button/button.css:114`
- `dieter/components/button/button.css:121`
- `dieter/components/button/button.css:190`
- `dieter/components/button/button.css:215`
- `dieter/components/button/button.css:321`
- `dieter/components/button/button.css:344`

## Generated Artifact And Manifest Evidence

- `scripts/build-dieter.js` copies token files, generates shadow token CSS, copies component statics, bundles matching component TypeScript entries, and writes `manifest.json`.
- The manifest includes components, components with JS, aliases, helpers, and dependencies.
- Bob compiler code loads `/dieter/manifest.json`.
- Bob compiler output includes `/dieter/tokens/tokens.css` plus needed component CSS/JS URLs.
- Tokyo widget artifacts link Dieter token CSS and component CSS.
- This verifies Dieter as a generated artifact system, not only a local CSS folder.

Evidence:

- `scripts/build-dieter.js:265`
- `scripts/build-dieter.js:275`
- `scripts/build-dieter.js:289`
- `scripts/build-dieter.js:301`
- `scripts/build-dieter.js:309`
- `bob/lib/compiler/media.ts:21`
- `bob/lib/compiler/media.ts:93`
- `bob/lib/compiler/media.ts:109`
- `tokyo/product/widgets/faq/widget.html:7`
- `tokyo/product/widgets/faq/widget.html:8`
- `tokyo/product/dieter/manifest.json:2`

## Component Shape Drift

- Generated manifest and DevStudio registry do not expose the exact same component shape.
- Manifest includes component artifacts based on build output.
- DevStudio `componentSources` are built from `specModules`.
- `textrename` CSS/template exists in generated registry import maps, but `componentSources` are spec-driven.
- The UI Dieter doc already records `textrename` missing `.spec.json` and `command-activity` as empty/dead.
- This belongs in 126H as system-shape evidence and in 126I as component-surface detail.

Evidence:

- `tokyo/product/dieter/manifest.json:14`
- `tokyo/product/dieter/manifest.json:25`
- `admin/src/data/componentRegistry.generated.ts:45`
- `admin/src/data/componentRegistry.generated.ts:69`
- `admin/src/data/componentRegistry.generated.ts:73`
- `admin/src/data/componentRegistry.ts:54`
- `documentation/engineering/UI/dieter.md:79`

## Docs Drift Found During Audit

- Service docs and package scripts point to root `scripts/build-dieter.js`.
- UI reference docs still name `dieter/scripts/build-dieter.js`.
- The 126H PRD previously referenced `audits/126H__Audit__Dieter.md`; the actual current audit artifacts are `audits/126H__AsBuilt_Codex.md` and `audits/126H__AsBuilt_GLM.md`.
- The PRD scope previously listed `--color-bg`, but this Codex sweep did not find `--color-bg` in Dieter component/source token references.

Evidence:

- `documentation/services/dieter.md:12`
- `dieter/package.json:13`
- `documentation/engineering/UI/dieter.md:70`
- `Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126H__PRD__Dieter.md:3`

## Known Current Gaps

- Dieter is token-defined but only partially token-consumed.
- Focus/touch ergonomics tokens are defined but not consumed by Dieter components in this sweep.
- Button has no current focus/outline implementation.
- `--shadow-elevated`, `--duration-snap`, and `--duration-spin` are defined but not consumed by components in this sweep.
- Elevation is partially tokenized and partially raw/ad hoc.
- z-index is raw component literals without tokenized layering.
- `--color-surface` is an undefined no-fallback button reference and appears to be a naming split with `--role-surface`.
- `--radius-2` is an undefined no-fallback bulk-edit reference.
- `--hspace-*` references are fallback-masked and likely rename drift from the `--vertspace-*` scale.
- Additional fallback-backed variables appear without matching foundation definitions.
- Docs contain stale build-script path references.
- `@ck/dieter` has `"main": "index.html"`, so it is not a normal JS/CSS package entrypoint for programmatic imports.

## Compliance Notes

- This audit records current source reality and known gaps only.
- This audit does not select fixes.
- This audit does not decide whether to add aliases, rename callers, delete dead tokens, or wire currently unconsumed tokens.
- This audit keeps Dieter source, generated artifacts, and consuming product surfaces as separate authorities.
- This audit does not reinterpret Dieter into a new ideal design system.
