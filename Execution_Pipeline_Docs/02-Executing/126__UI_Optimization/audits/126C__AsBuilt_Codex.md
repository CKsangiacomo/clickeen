# 126C Iconography - Codex As-Built Audit

Status: FROZEN POINT-IN-TIME PRE-EXECUTION AS-BUILT - code changed afterward; exact working-tree provenance may be unrecorded; no step-9 execution credit.

Scope: current Clickeen iconography implementation across Dieter SVG source,
`icons.json` manifest, active build/copy pipeline, `diet-icon` presentation,
Admin/DevStudio icon registry/hydration, Bob/Roma consumers, public widget icon
paths, accessibility semantics, sizing, color inheritance, and current docs.
This file states current reality only. It does not select fixes, converge with
GLM, write doctrine, or execute Step 4+.

Authority boundary:

- Product surface inspected: Dieter icon source/output, DevStudio reveal,
  Bob/Roma consumers, selected public widget icon paths.
- Account/session/storage/route/runtime/deploy authorities: not touched.
- Product data: not touched.
- Verification surface: local source/docs inspection only.

## Executive Current Reality

Clickeen has a real icon source set and a real deployed icon substrate:

- 157 SVG files exist under `dieter/icons/svg`.
- `dieter/icons/icons.json` contains 157 manifest symbols.
- Tokyo output contains 157 SVG files and a matching manifest.
- Source SVGs are fill-only/currentColor in the inspected state.
- `scripts/build-dieter.js` is the active build path that processes/verifies
  SVGs, copies `icons.json` and `icons/svg`, and asserts Tokyo output.

The current implementation is not one single icon API. It is multiple active
representations:

- Bob consumes `tokyo/product/dieter/icons/icons.json` geometry and emits inline
  SVG.
- Admin/DevStudio consumes raw SVG imports generated from `dieter/icons/svg`.
- Public widgets use a mix of CSS mask URLs, restricted allowlists, regex-valid
  Dieter names, and hand-written inline SVGs.
- `diet-icon` exists as CSS presentation only, not a typed exported component
  or shared hydrator.

The main current gaps are contract gaps:

- Icon accessibility semantics are consumer-dependent.
- Missing-icon behavior differs by consumer.
- Count parity exists, but active code does not prove name parity everywhere.
- `dieter/scripts/build-icons.mjs` exists but is not the active product build
  path; docs currently overstate it.
- DevStudio icon preview labels do not match current `.diet-icon` size mapping.
- The inactive `icons/svg_new` override lane is wired but not present on disk.

## Program And Source Authority

Evidence:

- MAMA Step 1 is independent as-built only: code owns current reality, no fixes,
  no convergence, no external research:
  `Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126__PRD__UI_Optimization_Program.md:178-185`.
- `CONTEXT.md` names Dieter as the design-system authority:
  `documentation/architecture/CONTEXT.md:164`.
- 126C scope is the icon set, manifest, build pipeline, `diet-icon`, sizing, and
  color conventions:
  `Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126C__PRD__Iconography.md:7`.
- Dieter source/output authority is documented as `dieter/` source and
  `tokyo/product/dieter/**` deploy output:
  `documentation/services/dieter.md:11` and `documentation/services/dieter.md:31`.

As-built read: Dieter owns icon source truth. Admin, Bob, Roma, and widgets are
consumers with different representation paths.

## Source Set And Manifest

Evidence:

- `dieter/icons/icons.json:1-5` declares `version`, `precision`, `fontSize`, and
  `symbols`.
- Read-only parse found 157 manifest symbols.
- Read-only parse found 157 `dieter/icons/svg/*.svg`.
- Read-only parse found 157 `tokyo/product/dieter/icons/svg/*.svg`.
- Read-only name comparison found no missing names between manifest symbols and
  source SVG file names in the inspected state.
- `dieter/icons/icons.json:6-20` shows the manifest shape: each symbol contains
  regular path geometry and bounds.
- `tokyo/product/dieter/icons/icons.json` mirrors the manifest shape and count.

As-built read: current count and name parity are good in the inspected state.
However, active governance evidence must be scoped: count guards exist, but a
strict name-parity guard is not proven as an active build check.

## Source SVG Shape

Evidence:

- Read-only SVG parse found 157/157 source SVGs with `fill="currentColor"`.
- Read-only SVG parse found 0 `stroke=` attributes in source SVGs.
- Read-only SVG parse found 0 source `aria-hidden` attributes.
- Read-only SVG parse found 0 source `focusable` attributes.
- `dieter/icons/svg/checkmark.svg:1` is representative of fill-only
  `currentColor` source.
- `scripts/process-svgs.js:16` rewrites fills to currentColor.
- `scripts/process-svgs.js:30` mutates source SVGs in place.
- `scripts/process-svgs.js:39` warns on manifest count mismatch rather than
  hard-failing.
- `scripts/verify-svgs.js:25` fails on remaining non-currentColor fills.
- `scripts/verify-svgs.js:46` warns on strokes.

As-built read: the source set is currentColor-controlled, but the currentColor
enforcement path mutates source SVGs. Stroke handling is warning-level, not
hard-fail, though current source parse found no strokes.

## Active Build Path

Evidence:

- `dieter/package.json:12` wires build to the root Dieter build path.
- `scripts/build-dieter.js:257` runs SVG processing/verification as part of the
  active build path.
- `scripts/build-dieter.js:277-280` copies `icons.json` to Tokyo output.
- `scripts/build-dieter.js:304-306` asserts icon output presence.
- `scripts/build-dieter.js:244-252` wires an optional `icons/svg_new` override
  path if present.
- No `dieter/icons/svg_new/` directory exists in the inspected tree.
- `dieter/scripts/build-icons.mjs:49-66` would emit `dieter/dist/icons.js` and
  `dieter/dist/icons.d.ts`.
- No `dieter/dist` exists in the inspected tree.
- No active package script was found invoking `dieter/scripts/build-icons.mjs`.

As-built read: the active product build is `scripts/build-dieter.js`, not
`dieter/scripts/build-icons.mjs`. The optional `svg_new` path is inactive on
disk but active in code if that folder appears.

## Dieter Presentation Layer

Evidence:

- `dieter/components/icon/icon.css:1-15` defines `.diet-icon` as inline-flex and
  sizes nested `svg`/`img` to 100%.
- `dieter/components/icon/icon.css:17-55` maps `data-size` values to icon-size
  tokens.
- `dieter/components/icon/icon.css:27-39` maps `sm`, `md`, and `lg` all to
  `--icon-size-16`.
- `dieter/components/icon/icon.css:42-49` maps `xl` to 20 and `2xl` to 36.
- `dieter/components/icon/icon.css:52-55` maps `3xl` to 40.
- `dieter/tokens/dieter-foundation-tokens.css:64-72` defines the full 12, 16,
  20, 24, 28, 32, 36, 40 icon-size ladder.
- `dieter/components/index.ts:1` exports component hydrators; no icon component
  export was found there.
- The `dieter/components/icon` folder contains CSS only in the inspected tree.

As-built read: `diet-icon` is a CSS wrapper, not a runtime component contract.
Its current size mapping does not expose the full token ladder one-to-one.

## Button And Component Icon Use

Evidence:

- `dieter/components/button/button.css:18` sets `--btn-icon-color:
  currentColor`.
- `dieter/components/button/button.css:88` and `:379` size nested button icon
  spans by tokenized dimensions.
- `dieter/components/button/button.html:3` renders a `span` with `data-icon`
  but no default `aria-hidden` on that base icon span.
- Many component templates put `aria-hidden` on icons where decorative, such as
  `dieter/components/dropdown-fill/dropdown-fill.html:72`,
  `:83`, `:94`, `:105`, `:438`, `:448`, and `:460`.
- Some component CSS bypasses registry-style lookup and masks direct SVG URLs,
  e.g. `dieter/components/dropdown-upload/dropdown-upload.css:49`.

As-built read: button/component icon rendering uses currentColor and tokenized
sizing in many places, but accessibility and lookup path are not centralized.

## Admin / DevStudio Icon Surface

Evidence:

- `admin/scripts/generate-static-registries.mjs:73` generates a raw SVG module
  registry from `dieter/icons/svg`.
- `admin/src/data/icons.generated.ts:1` confirms generated source.
- Current generated registry has 157 imports/entries in the inspected state.
- `admin/src/data/icons.ts:5-11` normalizes raw SVG markup, injecting
  `aria-hidden="true" focusable="false"` when missing.
- `admin/src/data/icons.ts:17-18` returns `undefined` for unknown names.
- `admin/src/main.ts:242` hydrates `[data-icon]` nodes.
- `admin/src/main.ts:242` path skips missing icons because it returns when no
  markup is found.
- `admin/scripts/generate-foundation-pages.mjs:124` generates the icon
  foundation page from `icons.json`, not directly from the SVG directory.
- `admin/src/html/foundations/icons.html:2` says the page contains 157 icons.
- `admin/src/html/foundations/icons.html:24` creates eight preview cards per
  icon.
- `admin/src/main.ts:643` adds `dietIconCss` only for the icons page.
- `admin/src/html/foundations/icons.html:35` labels preview sizes as `sm 20px`,
  `md 24px`, `lg 28px`, `xl 32px`.
- Current `.diet-icon` CSS maps `sm`, `md`, and `lg` to 16px and `xl` to 20px:
  `dieter/components/icon/icon.css:27-45`.

As-built read: DevStudio reveals the icon set and forces decorative SVGs in its
hydration path. It also has preview-label drift against current CSS.

## Bob Icon Consumers

Evidence:

- `bob/lib/icons.ts:4` imports `tokyo/product/dieter/icons/icons.json`.
- `bob/lib/icons.ts:8-12` throws when an icon is missing.
- `bob/lib/icons.ts:13-19` emits inline SVG using manifest path geometry.
- `bob/lib/icons.ts:19` emits SVG without `aria-hidden`, `focusable`, `role`, or
  `title`.
- `bob/lib/compiler/stencils.ts:103` and `:302` replace `data-icon`
  placeholders with inline SVG via regex.
- Bob React usages usually mark the wrapper span decorative, e.g.
  `bob/components/Workspace.tsx:436-439`,
  `bob/components/ToolDrawer.tsx:234-237`, and
  `bob/components/TdMenu.tsx:73`.

As-built read: Bob uses the manifest/geometry representation and fails loudly
on missing icons. Accessibility semantics are normally wrapper-owned, not
provided by the generated SVG string.

## Roma Icon Consumers

Evidence:

- `roma/app/layout.tsx:13` imports Dieter tokens/button/etc. from Tokyo but does
  not import `components/icon/icon.css` in the inspected line.
- `roma/app/roma.css:377` references `.diet-btn-ic__icon` for builder fields.
- No Roma icon registry/hydrator was found in the inspected searches.
- Roma brand SVGs exist separately at `roma/public/brand/clickeen-logo-full.svg`
  and `.vercel` output, which are brand assets rather than Dieter icon source.

As-built read: Roma uses component icon CSS classes where needed but does not
appear to own or hydrate the Dieter icon registry directly.

## Public Widget Icon Paths

Evidence:

- Shared header CTA validates against a five-icon allowlist and sets CSS mask
  URL: `tokyo/product/widgets/shared/header.js:134`,
  `tokyo/product/widgets/shared/header.js:293`, and
  `tokyo/product/widgets/shared/header.css:167`.
- CallToAction uses the same five-icon allowlist and CSS mask:
  `tokyo/product/widgets/calltoaction/widget.client.js:9`,
  `tokyo/product/widgets/calltoaction/widget.client.js:240`, and
  `tokyo/product/widgets/calltoaction/widget.css:105`.
- Cards accepts regex-valid Dieter icon names but does not verify file
  existence: `tokyo/product/widgets/cards/widget.client.js:85`.
- Cards renders CSS mask spans with `aria-hidden`:
  `tokyo/product/widgets/cards/widget.client.js:263` and
  `tokyo/product/widgets/cards/widget.css:79`.
- FAQ has four named icon-pair styles and masks expand/collapse icons:
  `tokyo/product/widgets/faq/widget.client.js:434` and
  `tokyo/product/widgets/faq/widget.css:103`.
- Social Share is not Dieter-icon based; it returns inline stroke SVG strings:
  `tokyo/product/widgets/shared/socialShare.js:121`.
- Social Share icons are styled to currentColor:
  `tokyo/product/widgets/shared/socialShare.css:170`.

As-built read: public widgets use multiple icon strategies. Some are Dieter
mask URLs with allowlists, some accept regex-valid icon names, and Social Share
uses local inline SVGs outside the Dieter icon manifest.

## Missing Icon Behavior

Evidence:

- Bob throws on missing icon: `bob/lib/icons.ts:8-12`.
- Admin `getIcon` returns undefined: `admin/src/data/icons.ts:17-18`.
- Admin hydrator skips missing markup: `admin/src/main.ts:242`.
- Cards accepts regex-valid icon names without file existence check:
  `tokyo/product/widgets/cards/widget.client.js:85`.

As-built read: missing-icon semantics are not centralized. This matters because
silent empty icons can become invisible operations, while throw-on-missing can
fail a build/runtime path depending on consumer.

## Accessibility Semantics

Evidence:

- Source SVGs do not include `aria-hidden` or `focusable`.
- Admin injects `aria-hidden="true" focusable="false"` in
  `admin/src/data/icons.ts:8-11`.
- Bob emits bare SVG in `bob/lib/icons.ts:19`.
- Bob wrappers usually add `aria-hidden`, e.g. Workspace/ToolDrawer/TdMenu cited
  above.
- Many Dieter and public widget icon spans include `aria-hidden="true"`.
- Icon-only controls often carry `aria-label` at the button/control level, such
  as dropdown-fill mode buttons and upload/remove buttons.

As-built read: decorative icon handling is common, but the policy is local. A
central meaningful-icon vs decorative-icon contract was not found.

## Current Documentation Drift

Evidence:

- `documentation/engineering/UI/iconography.md:7` lists
  `dieter/scripts/build-icons.mjs` as source of truth. Current runtime consumers
  do not import its output.
- `documentation/engineering/UI/iconography.md:19-21` says `build-icons.mjs`
  emits `dist/icons.js` / `.d.ts` and is orchestrated into the Tokyo bundle.
  The active build path is `scripts/build-dieter.js`; no `dieter/dist` exists.
- `admin/src/html/foundations/icons.html:17` says glyphs render through the same
  icon hydrator used in components. No Dieter icon hydrator export was found;
  Admin has its own `hydrateIcons()` in `admin/src/main.ts:242`.
- `documentation/engineering/UI/README.md:26` labels iconography as `126B`,
  while MAMA maps iconography to 126C:
  `Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126__PRD__UI_Optimization_Program.md:120-124`.

## Known Current Gaps

These are current-state gaps only, not selected fixes:

1. Icon system has multiple active representations: manifest geometry, raw SVG
   imports, CSS masks, and local inline widget SVGs.
2. `diet-icon` is CSS-only and not a typed exported component/hydrator.
3. Size labels in DevStudio previews drift from `.diet-icon` CSS mapping.
4. Missing-icon behavior differs by consumer.
5. Accessibility semantics are consumer-dependent.
6. Count/name parity is good in inspected state, but active code evidence mostly
   proves count, not strict name parity.
7. `build-icons.mjs` exists but is not the active product build path.
8. `svg_new` override lane is wired but inactive; if present it can copy over
   source SVGs before normalization.
9. Public widgets use several icon strategies outside one central Dieter icon
   contract.
10. Current docs overstate the generated registry and shared hydrator story.

## What This Audit Does Not Claim

- It does not claim the 157-icon set is visually wrong.
- It does not choose Material Symbols, SF Symbols, or OpenAI UI doctrine.
- It does not propose replacing the icon system.
- It does not select an accessibility implementation.
- It does not authorize build/runtime changes.

## Step Boundary For 126C

This Step 1 artifact should feed human comparison with GLM and later Step 4
convergence. It must not be treated as final doctrine, final gap audit, or an
implementation plan.
