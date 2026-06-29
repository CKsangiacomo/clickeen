# 126C - PRD: Iconography

Status: PRE-EXECUTION READY - three-lane review green.
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA).
Series order: 126C of 126A-126M.
KB doc target: `documentation/engineering/UI/iconography.md`.

This PRD is the execution-grade Clickeen product standard for Dieter
operational icons after pre-execution review. It is grounded in Codex/GLM
as-built audits, official-source research, and human product direction.

126C does not authorize icon redesign, agent icon origination, account-asset
mixing, an icon registry platform, an Admin-specific icon system, fake size
aliases, or icon framework machinery. It defines deterministic icon source and
consumption rules for the approved Dieter icon set.

## Step Inputs

- Step 1 Codex as-built: `audits/126C__AsBuilt_Codex.md`.
- Step 1 GLM as-built: `audits/126C__AsBuilt_GLM.md`.
- Step 3 Codex research: `research/126C_Research_Codex.md`.
- Step 3 GLM research: `research/126C_Research_GLM.md`.
- Step 6 pre-execution audit: `audits/126C__Audit__Iconography.md`.
- Current living doc: `documentation/engineering/UI/iconography.md`.
- Human-owned icon origination tool: `tooling/sf-symbols`.
- Committed source artifact authority: `dieter/icons/svg/*` and
  `dieter/icons/icons.json`.
- Generated runtime/deploy output: `tokyo/product/dieter/icons/**`.

Step 6 is binding for execution. A 126C implementation path not named in this
PRD or `audits/126C__Audit__Iconography.md` is outside 126C. Any scope change
requires a human PRD update before execution. This prevents icon work from
drifting into component redesign, Roma refactor, widget rewrites, account asset
migration, or a new icon subsystem.

## Role

126C owns the iconography baseline for Clickeen UI:

- the human-owned Dieter operational icon set;
- deterministic agent consumption rules;
- injection rules;
- render rules;
- sizing/scaling rules;
- color/state rules;
- accessibility semantics;
- deploy artifact propagation;
- public widget icon delivery boundaries;
- the boundary between Dieter icons and account assets.

Iconography is an inner-doll domain. Dieter icons are operational symbols that
agents and humans rely on to identify UI actions and states. They are not
account assets. Account assets, including admin-account assets, can be SVGs,
but they remain under account asset authority and do not become Dieter icons.

## 126 Pre-GA No Legacy Compatibility Tenet

Clickeen is pre-GA. This PRD must not preserve old UI drift through
compatibility shims, temporary aliases, parallel legacy paths, or "support both
old and new" transitions. This PRD authorizes no 126C exception.

Once the 126C iconography standard is decided:

- Fix source and docs to the standard.
- Remove old drift and stale paths.
- Do not leave legacy names, classes, render paths, token aliases, wrappers, or
  local one-offs as supported alternatives.
- Do not add guard/check machinery to enforce this tenet. The PRD is the
  authority; execution must clean code and docs instead of preserving bad paths
  behind validation.

## Human Decisions

- **Approved set:** the current 157 Dieter icons are the approved operational
  icon set.
- **Human origination:** new icons are human-originated through
  `tooling/sf-symbols`; agents do not add, rename, reshape, replace, or
  originate icons.
- **Source artifact pair:** Dieter icon source truth is
  `dieter/icons/icons.json` plus `dieter/icons/svg/*`.
- **Deploy propagation:** `scripts/build-dieter.js` is deploy artifact
  propagation. It is not icon origination.
- **No source mutation during deploy build:** ordinary Dieter deploy build may
  copy and verify icon artifacts; it must not mutate committed Dieter icon
  source.
- **Account asset boundary:** account/customer/admin SVG assets are not Dieter
  icons and remain under account asset authority.
- **SF Symbols port preserved:** agents must not rename, reshape, or "improve"
  the dot-notation/manifest geometry format.
- **Numeric sizing only:** icon sizes use the numeric Dieter size ladder:
  `12`, `16`, `20`, `24`, `28`, `32`, `36`, `40`.
- **Color:** Dieter icons use `currentColor`.
- **State:** hover, active, selected, disabled, and pressed icon appearance
  comes from parent/control state. This PRD authorizes no named icon variants.
- **Semantics:** decorative icons are hidden. Icon-only controls put the
  accessible name on the control. Meaningful standalone icons require an
  explicit label rule.

## Current Reality Summary

Clickeen has a real icon source set and deployed icon substrate:

- Current parse found 157 manifest symbols.
- Current parse found 157 source SVGs in `dieter/icons/svg`.
- Current parse found 157 Tokyo SVGs in `tokyo/product/dieter/icons/svg`.
- Current parse found no missing names between source SVG filenames and
  manifest symbols.
- Current source SVGs are fill-only `currentColor` in the inspected state.
- The icon system is an SF Symbols port in current implementation terms:
  dot-notation names, `fontSize: 28`, path-data geometry, and regular
  monochrome rendering.
- `tooling/sf-symbols/scripts/makeSymbols.js` writes
  `dieter/icons/icons.json` from SF Symbols source files and SF Pro font data.
- `scripts/build-dieter.js` copies `icons.json` and `icons/svg` into
  `tokyo/product/dieter/icons/**`, copies tokens/components/foundations,
  bundles component JS, writes the Dieter manifest, and asserts deploy output.

The current implementation has multiple active consumer representations:

- Bob uses `tokyo/product/dieter/icons/icons.json` geometry through
  `bob/lib/icons.ts`.
- Admin/DevStudio uses generated raw SVG imports from `dieter/icons/svg` for
  reveal/docs.
- Public widgets use CSS mask/static URLs when runtime delivery requires it.
- `diet-icon` is CSS-only presentation, not a runtime icon component.

Current gaps:

- Agents do not have deterministic instructions for consuming approved icons in
  each product lane.
- Injection rules differ between `data-icon`, manifest geometry, generated
  reveal imports, CSS mask URLs, and widget-local inline SVGs.
- Sizing/scaling rules are incomplete.
- Accessibility semantics are consumer-dependent.
- DevStudio preview labels drift from `.diet-icon` CSS mapping.
- Docs and PRD baselines have confused icon origination, committed source
  artifacts, deploy artifact propagation, and runtime consumption.

## Product Reading

The 126C problem is not "replace the icons" and not "agents add icons." The
current 157-icon set has real source parity and `currentColor` discipline. New
icons are human-originated through the local tooling path and are outside agent
discretion.

The actual problem is that agents consume approved Dieter icons differently
across the system. Without a deterministic contract, an agent can code the same
approved icon as a `data-icon` placeholder, raw SVG import, inline manifest
SVG, CSS mask URL, account asset, or CSS-only wrapper depending on which file it
saw last.

For Clickeen this matters because:

- agents operate structured UI and need a deterministic icon consumption law;
- humans need icon-only controls to expose accessible action names;
- dense builder and Roma UI need icons to clarify commands, not become unlabeled
  symbols;
- public widgets need icon assets to load reliably under runtime constraints
  without confusing Dieter operational icons with account/content assets.

## Exact Clickeen Standard

### 1. Human-Owned Icon Set

Execution law:

- Agents may consume existing approved icons.
- Agents may not add new icons, import random SVGs, edit the icon set, or use
  `scripts/build-dieter.js` as an authoring path.
- Source SVG generation belongs to the human-owned `tooling/sf-symbols`
  process.
- Source truth is the committed Dieter icon source artifact pair:
  `dieter/icons/icons.json` plus `dieter/icons/svg/*`.
- The source artifact pair must remain in required name/count parity.
- Active Dieter deploy build copies both source artifacts to Tokyo output.
- Deploy build must not mutate `dieter/icons/svg/*` or `dieter/icons/icons.json`
  during ordinary build.

### 2. Icon Consumer Decision Table

This is the deterministic rule agents need. These are consumer/runtime lanes,
not "surfaces" in the 126J sense.

| Consumer lane | Target authoring shape | Target render/delivery path | Forbidden / gap |
| --- | --- | --- | --- |
| Dieter component source | Approved icon slot with `data-icon="approved.name"` and numeric size where needed | Source markup remains Dieter-authored; downstream lanes resolve it through their allowed path | Raw SVG drops, account asset URLs, per-component icon registries |
| Bob compiler/output | Consume Dieter `data-icon` slots | Compiler replaces `data-icon` using `tokyo/product/dieter/icons/icons.json` manifest geometry | Direct ad hoc SVG strings; direct `getIcon(...)` outside Bob compiler/chrome lanes |
| Bob app chrome | Named Bob chrome files may consume `bob/lib/icons.ts` directly | `bob/components/Workspace.tsx`, `bob/components/ToolDrawer.tsx`, and `bob/components/TdMenu.tsx` consume the manifest adapter and keep wrapper/control semantics | New Bob icon component, new Bob icon registry, raw SVG drops, additional unreviewed direct consumers |
| DevStudio/Admin | DevStudio/Admin consumes generated raw Dieter SVG source imports as its build-time reveal/docs and Admin tooling path | Generated raw imports may be used for Admin/DevStudio only; Admin/DevStudio must not own a separate product runtime icon system | Admin product runtime icon doctrine; silent skip of missing icons |
| Prague static site | Use approved Dieter names where Prague content blocks expose Dieter operational icons | `prague/src/components/DieterIcon.astro` renders Tokyo `/dieter/icons/svg/name.svg`; Prague block registry validates Dieter icon names for blocks that render `DieterIcon` | Treating Prague channel/brand icons as Dieter icons; Prague icon registry/platform |
| Public widgets | Use approved Dieter icon names where the widget schema exposes operational Dieter icons | Render `/dieter/icons/svg/name.svg` as CSS mask/static URL when public runtime delivery requires it | Treating account/content/brand/channel SVGs as Dieter icons; ad hoc inline operational SVGs for Dieter actions |
| Roma product UI | Use the same Dieter operational icon contract for operational icons | Consume Dieter operational icons through the Roma implementation path decided by 126M | Parallel Roma-only operational icon systems |
| Account assets | Not Dieter icon authoring | Use account asset authority and account asset routes | Importing account/customer/admin SVG assets into Dieter icon doctrine |

DevStudio/Admin decision:

- DevStudio/Admin may keep generated raw SVG source imports for reveal/docs and
  Admin tooling.
- DevStudio/Admin must not describe that path as a product runtime icon system.
- DevStudio/Admin missing icon handling must not silently turn missing truth into
  absence.
- `admin/scripts/generate-static-registries.mjs` must generate icon imports
  from `dieter/icons/icons.json` manifest names, verify every manifest name has
  a matching source SVG, verify no extra source SVG lacks a manifest symbol, and
  exit nonzero before writing output on mismatch.
- `admin/scripts/generate-foundation-pages.mjs` must run the same
  manifest/source parity check before writing the icon page.
- The global Admin `hydrateIcons` function in `admin/src/main.ts` applies to
  every Admin `[data-icon]` insertion call. Missing `data-icon` must show an
  explicit marker with the requested icon name: replace the node contents with
  `[missing icon: ${name}]`, set `data-icon-missing="${name}"`, remove
  `data-icon`, and do not substitute another icon. The marker is Admin tooling
  truth, not product runtime icon doctrine.
- Broader DevStudio UI/render refactors belong to 126L.

Public widget decision:

- 126C names current widget Dieter operational icon consumers so execution does
  not invent a universal widget icon system.
- `tokyo/product/widgets/shared/header.js` and
  `tokyo/product/widgets/shared/header.css`: header CTA icon allowlist and CSS
  mask URL remain Dieter operational icon consumption.
- `tokyo/product/widgets/calltoaction/widget.client.js`,
  `tokyo/product/widgets/calltoaction/widget.css`, and
  `tokyo/product/widgets/calltoaction/spec.json`: CallToAction action icon
  allowlist and CSS mask URL remain Dieter operational icon consumption.
- `tokyo/product/widgets/cards/widget.client.js`,
  `tokyo/product/widgets/cards/widget.css`, and
  `tokyo/product/widgets/cards/spec.json`: Cards media icons and between-card
  icons are Dieter operational icon consumers. Execution must replace
  regex-only icon-name acceptance with a Cards-local approved Dieter icon-name
  set based on the current 157-icon source. Do not create a shared widget icon
  service.
- `tokyo/product/widgets/faq/widget.client.js`,
  `tokyo/product/widgets/faq/widget.css`, and
  `tokyo/product/widgets/faq/spec.json`: FAQ accordion icon pairs remain
  widget-owned enum choices that map to approved Dieter icon names.
- `tokyo/product/widgets/logoshowcase/widget.client.js` and
  `tokyo/product/widgets/logoshowcase/widget.css`: fixed previous/next chevrons
  remain Dieter operational icon masks.
- `tokyo/product/widgets/split-media/widget.css` and
  `tokyo/product/widgets/split-carousel-media/widget.css`: fixed `photo` masks
  remain Dieter operational icon placeholders.
- `tokyo/product/widgets/shared/localeSwitcher.js`: fixed `chevron.down` mask
  remains a Dieter operational icon.
- `tokyo/product/widgets/shared/socialShare.js` and
  `tokyo/product/widgets/shared/socialShare.css`: Social Share `share`, `copy`,
  and channel glyphs are widget-owned product icons. 126C must not replace them
  with Dieter icons.

### 3. Active Build Path

Execution law:

- `scripts/build-dieter.js` is active as the Dieter deploy artifact builder.
- It is still called by `pnpm build:dieter` through `dieter/package.json`.
- Cloud-dev runs `pnpm build:dieter` before Tokyo R2 sync when Dieter artifacts
  are affected.
- `scripts/build-dieter.js` remains deploy artifact propagation until 126G/126H
  replace it with an approved equivalent.
- `scripts/build-dieter.js` is not icon origination.
- Ordinary deploy build may copy/verify outputs.
- Ordinary deploy build must not mutate committed Dieter icon source.
- Docs must describe only current live product paths.
- `scripts/build-dieter.js` must remove the inactive `icons/svg_new` override
  lane. There is no current `dieter/icons/svg_new/` product concept to guard.
- `scripts/build-dieter.js` must stop calling the source-mutating
  `scripts/process-svgs.js` path during ordinary deploy build.
- `scripts/process-svgs.js` must be deleted once the active build no longer
  calls it. Source healing during deploy build is not a supported Clickeen
  operation.
- `.github/workflows/cloud-dev-workers.yml` must remove `scripts/process-svgs.js`
  from path triggers and Dieter artifact change detection when the script is
  deleted.
- `scripts/verify-svgs.js` remains a non-mutating build verification script for
  the committed source artifact pair. It must fail on icon source/manifest
  name-count mismatch and non-`currentColor` source, and it must not rewrite
  source.
- `dieter/scripts/build-icons.mjs` is inactive dead code. Current audit found no
  live caller and no `dieter/dist/icons.js` / `dieter/dist/icons.d.ts` outputs.
  Execution removes it and removes all docs that present it as current.

### 4. Presentation Wrapper

Execution law:

- `diet-icon` is CSS-only.
- `diet-icon` remains presentation only for 126C. It is not a runtime icon
  component.
- `diet-icon` must use numeric sizing only.
- Glyph size, wrapper size, component slot size, and interactive control size
  are separate dimensions.

### 5. Sizing And Scaling Rules

Allowed numeric icon sizes:

| Numeric size | Token |
| --- | --- |
| `12` | `--icon-size-12` |
| `16` | `--icon-size-16` |
| `20` | `--icon-size-20` |
| `24` | `--icon-size-24` |
| `28` | `--icon-size-28` |
| `32` | `--icon-size-32` |
| `36` | `--icon-size-36` |
| `40` | `--icon-size-40` |

Rules:

- Glyph size uses the numeric ladder.
- Wrapper size is the `.diet-icon` box around the SVG and usually matches glyph
  size unless a component explicitly defines a different alignment box.
- Component icon slot size is the reserved layout space for alignment and
  belongs to the owning component CSS.
- Interactive control size is not icon size and is not 126C touch-target
  doctrine.
- Non-numeric `.diet-icon` glyph size references must be removed from
  source/docs.
- This does not rename unrelated component/control `data-size="sm|md|lg"`
  values. Those are component size APIs owned by component PRDs, not icon glyph
  sizing.
- `dieter/components/icon/icon.css` target mapping is exactly:
  `[data-size="12"] -> --icon-size-12`,
  `[data-size="16"] -> --icon-size-16`,
  `[data-size="20"] -> --icon-size-20`,
  `[data-size="24"] -> --icon-size-24`,
  `[data-size="28"] -> --icon-size-28`,
  `[data-size="32"] -> --icon-size-32`,
  `[data-size="36"] -> --icon-size-36`,
  `[data-size="40"] -> --icon-size-40`.
- `xxs`, `xs`, `sm`, `md`, `lg`, `xl`, `2xl`, and `3xl` are removed from
  `.diet-icon` source/docs. They are not aliases.
- DevStudio preview labels must match actual CSS after numeric sizing is
  applied.
- Clickeen currently carries one regular monochrome path per icon. It must not
  pretend to support optical icon variants by size until those variants actually
  exist in the Dieter icon source model.

### 6. Color And State

Execution law:

- Source SVGs use `currentColor`.
- `diet-icon` uses `currentColor`.
- Operational icons inherit color from the parent/control.
- Hover, active, selected, disabled, and pressed icon appearance comes from the
  parent/control state.
- 126C does not create icon-specific state colors.
- 126C does not create filled/outlined/weight/scale variants.

### 7. Accessibility Semantics

Execution law:

- Source SVGs do not encode consumer semantics.
- Decorative icons are hidden from semantic output.
- Icon-only controls put the accessible name on the control, not the source SVG.
- Meaningful standalone icons require an explicit label rule at the consumer.
- Icons next to visible text are decorative unless the icon adds independent
  product meaning.
- Missing icons must not silently render as absence in tooling/reveal paths.

### 8. Account Asset Boundary

Execution law:

- Dieter icons are operational system icons.
- Account/customer/admin SVG assets are product/account assets.
- Account assets move through account asset authority and account asset routes.
- Account assets may be SVG files.
- Account SVGs do not become Dieter icons.
- Dieter icons must not be sourced from account asset storage.

## Detailed Blast Radius

126C execution may touch only the icon-related truth surface below.

| Area | May change | Must not change |
| --- | --- | --- |
| `tooling/sf-symbols/**` | no 126C code changes; docs may identify it as human-owned origination | agent-driven icon origination, automated icon addition |
| `dieter/icons/icons.json` | no 126C code changes; parity verification only | agent-authored icon additions/renames/geometry edits |
| `dieter/icons/svg/**` | source parity/currentColor verification; no ordinary-build mutation | source mutation during deploy build, random SVG imports |
| `scripts/build-dieter.js` | remove `icons/svg_new` override, remove `process-svgs.js` call, keep non-mutating verify/copy propagation | icon origination, source mutation, new icon pipeline, governance framework |
| `.github/workflows/cloud-dev-workers.yml` | remove `scripts/process-svgs.js` path trigger and change-detection reference | deleted script still affecting deploy workflow |
| `dieter/scripts/build-icons.mjs` | delete inactive script | preserving stale generated-registry pipeline claims or nonexistent `dist/icons.js` / `dist/icons.d.ts` output |
| `scripts/process-svgs.js` | delete after removing active caller | source healing during deploy build |
| `scripts/verify-svgs.js` | keep non-mutating build verification; fail on source/manifest name-count mismatch and non-`currentColor` source | source mutation, new validation platform, runtime dependency |
| `tokyo/product/dieter/icons/**` | generated output from build | hand edits to generated output |
| `dieter/components/icon/icon.css` | replace `.diet-icon` fake size aliases with numeric `12/16/20/24/28/32/36/40` mapping | runtime icon component creation, fake size aliases |
| `dieter/components/**` | `data-icon` slots, numeric icon sizes, decorative/icon-only semantics | raw SVG drops, account asset icon refs, behavior rewrites outside owning component scope |
| `bob/lib/icons.ts` | add decorative SVG attributes to compiler-emitted inline SVG (`aria-hidden="true" focusable="false"`) while preserving manifest geometry | new Bob icon registry, icon origination |
| `bob/lib/compiler/stencils.ts` | compiler-owned `data-icon` replacement path only | scattered icon replacement outside compiler/chrome lanes |
| `bob/components/Workspace.tsx` | named Bob app chrome direct manifest-adapter consumer; verify decorative wrapper/control semantics | new icon component, raw SVG, preview behavior changes |
| `bob/components/ToolDrawer.tsx` | named Bob app chrome direct manifest-adapter consumer; verify decorative wrapper/control semantics | new icon component, raw SVG, mode behavior changes |
| `bob/components/TdMenu.tsx` | named Bob app chrome `data-icon` insertion consumer; verify missing icon behavior remains explicit through `bob/lib/icons.ts` throw | new icon component, raw SVG, menu behavior changes |
| `admin/scripts/generate-static-registries.mjs` | generate icon registry from manifest names and hard-fail manifest/source mismatch before writing | product runtime icon system, source mutation |
| `admin/src/data/icons.generated.ts` | generated reveal/docs registry output | hand edits |
| `admin/src/data/icons.ts` | preserve generated raw import normalization for Admin tooling only | Admin product runtime icon system |
| `admin/src/main.ts` | global Admin `hydrateIcons` missing icon marker: `[missing icon: ${name}]` plus `data-icon-missing`, never silent skip | product runtime icon doctrine |
| `admin/scripts/generate-foundation-pages.mjs` | hard-fail manifest/source icon mismatch and switch preview sizes to numeric `12/16/20/24/28/32/36/40` labels/data-size | source icon authority change |
| `admin/src/html/foundations/icons.html` | generated output only after foundation page regeneration | hand-editing generated reveal truth |
| `prague/src/components/DieterIcon.astro` | keep Prague static Dieter URL consumer; no registry/platform | account/brand/channel icon conversion |
| `prague/src/components/StepsPrimitive.astro` | approved Dieter names only for `DieterIcon` blocks | layout/content rewrite |
| `prague/src/blocks/global-moat/global-moat.astro` | approved Dieter names only for `DieterIcon` blocks | layout/content rewrite |
| `prague/src/blocks/subpage-cards/subpage-cards.astro` | approved Dieter names only for `DieterIcon` blocks | layout/content rewrite |
| `prague/src/lib/blockRegistry.ts` | validate `iconName` values against the approved Dieter manifest for Prague blocks that render `DieterIcon` | Prague icon registry/platform |
| `tokyo/product/widgets/shared/header.js` / `.css` | keep header CTA allowlist/mask Dieter consumption; verify names exist | account/brand/content SVG conversion |
| `tokyo/product/widgets/calltoaction/widget.client.js` / `.css` / `spec.json` | keep CTA allowlist/mask Dieter consumption; verify names exist | universal widget icon system |
| `tokyo/product/widgets/cards/widget.client.js` / `.css` / `spec.json` | replace regex-only Dieter icon acceptance with Cards-local approved-name set; keep mask delivery | universal widget icon system |
| `tokyo/product/widgets/faq/widget.client.js` / `.css` / `spec.json` | keep enum-to-Dieter-pair mask delivery; verify names exist | universal widget icon system |
| `tokyo/product/widgets/logoshowcase/widget.client.js` / `.css` | keep fixed chevron masks; verify names exist | universal widget icon system |
| `tokyo/product/widgets/split-media/widget.css` | keep fixed `photo` mask; verify name exists | widget behavior rewrite |
| `tokyo/product/widgets/split-carousel-media/widget.css` | keep fixed `photo` mask; verify name exists | widget behavior rewrite |
| `tokyo/product/widgets/shared/localeSwitcher.js` | keep fixed `chevron.down` mask; verify name exists | widget behavior rewrite |
| `tokyo/product/widgets/shared/socialShare.js` / `.css` | classify as widget-owned product/channel icons; no 126C Dieter conversion | masquerading channel glyphs as Dieter operational icons |
| `roma/**` | only if 126M/owning path consumes Dieter operational icons | parallel Roma icon doctrine or account asset mixing |
| `documentation/engineering/UI/iconography.md` | rewrite to current 126C law | stale inactive paths, agent origination, fake size labels |
| `documentation/engineering/UI/README.md` | fix UI doc/track mappings | stale PRD mappings |
| `documentation/engineering/UI/components.md` | cross-reference component icon slot/semantics rules | component API expansion not decided by 126I |
| `documentation/engineering/UI/dieter.md` | remove stale `dieter/scripts/*` source-truth/build path claims and point build to root `scripts/build-dieter.js` | stale build path truth |
| `documentation/engineering/UI/ops.md` | align active build path with 126G/126C | stale generated-registry/source-truth claims |
| `documentation/engineering/UI/accessibility.md` | keep icon semantics aligned to 126A | keyboard/touch expansion |
| `documentation/services/dieter.md` | remove `svg_new` and align active icon source/deploy path | inactive icon paths as product law |
| `documentation/services/bob.md` | document Bob compiler icon consumption if changed/formalized | Bob product behavior changes |
| `documentation/services/devstudio.md` | document Admin tooling missing-icon marker if Admin behavior changes | DevStudio write/runtime expansion |
| widget docs | only where widget operational icons are changed | broad widget runtime icon doctrine |

Known documentation repairs:

- `documentation/engineering/UI/iconography.md` must describe the active path:
  human origination through `tooling/sf-symbols`, committed Dieter source
  artifacts in `dieter/icons/**`, and deploy propagation through root
  `scripts/build-dieter.js`.
- `documentation/engineering/UI/iconography.md` must not describe
  `dieter/scripts/build-icons.mjs` as the active icon build path.
- `documentation/engineering/UI/iconography.md` must not claim current
  `dieter/dist/icons.js`, `dist/icons.d.ts`, `IconName`, or `iconPath()`
  registry output when those artifacts do not exist.
- `documentation/engineering/UI/ops.md` must not describe
  `dieter/scripts/build-icons.mjs` as the active icon pipeline.
- `documentation/engineering/UI/dieter.md` must not describe `dieter/scripts/*`
  as icon source truth or `dieter/scripts/build-dieter.js` as the active build
  path. The active build path is root `scripts/build-dieter.js`.
- `documentation/services/dieter.md` must remove the `dieter/icons/svg_new/`
  override row. After execution, the dead path is not documented at all.

File-level execution targets:

| File | Exact 126C target |
| --- | --- |
| `dieter/components/icon/icon.css` | `.diet-icon` supports default `20` plus numeric `12/16/20/24/28/32/36/40`; non-numeric icon glyph aliases removed. |
| `admin/scripts/generate-static-registries.mjs` | Icon registry generation reads manifest names, verifies source SVG parity both ways, and fails before writing on mismatch. |
| `admin/scripts/generate-foundation-pages.mjs` | Icons page size array becomes numeric strings with matching labels: `12px` through `40px`. |
| `admin/src/html/foundations/icons.html` | Regenerated from the script; no hand edits. |
| `admin/src/main.ts` | Missing `data-icon` in global Admin `hydrateIcons` becomes visible `[missing icon: ${name}]`, `data-icon-missing="${name}"`, no fallback icon. |
| `bob/lib/icons.ts` | Manifest-generated SVG includes `aria-hidden="true" focusable="false"` and remains `fill="currentColor"`. |
| `bob/components/Workspace.tsx` | Named Bob chrome direct manifest-adapter use; no new component or raw SVG. |
| `bob/components/ToolDrawer.tsx` | Named Bob chrome direct manifest-adapter use; no new component or raw SVG. |
| `bob/components/TdMenu.tsx` | Named Bob chrome `data-icon` insertion use; no new component or raw SVG. |
| `scripts/build-dieter.js` | Removes `icons/svg_new` copy block, `usingOverrides` output, and `process-svgs.js` call. |
| `scripts/process-svgs.js` | Deleted. |
| `scripts/verify-svgs.js` | Non-mutating verification only; hard-fails source/manifest mismatch and non-currentColor. |
| `dieter/scripts/build-icons.mjs` | Deleted. |
| `.github/workflows/cloud-dev-workers.yml` | Removes `scripts/process-svgs.js` from workflow path trigger and change detection. |
| `prague/src/components/DieterIcon.astro` | Remains Prague static Dieter SVG URL consumer; no Prague registry. |
| `prague/src/lib/blockRegistry.ts` | Validates Prague block `iconName` values that render `DieterIcon` against the approved Dieter manifest. |
| `tokyo/product/widgets/cards/widget.client.js` | Replaces regex-only Dieter icon acceptance with Cards-local approved-name set. |
| `tokyo/product/widgets/shared/socialShare.js` | Remains widget-owned product/channel icon code; no Dieter conversion. |
| `documentation/engineering/UI/iconography.md` | Rewritten to active human-origination/source/deploy/consumer law. |
| `documentation/engineering/UI/ops.md` | Removes stale build-icons pipeline description. |
| `documentation/engineering/UI/dieter.md` | Removes stale `dieter/scripts/*` source/build claims. |
| `documentation/services/dieter.md` | Removes `svg_new` override documentation. |
| `documentation/engineering/UI/components.md` | Cross-reference component icon slot and semantic rules where needed. |
| `documentation/engineering/UI/accessibility.md` | Align decorative/icon-only/meaningful icon semantics with 126A and 126C. |
| `documentation/services/bob.md` | Documents Bob compiler icon consumption only if `bob/lib/icons.ts`/compiler behavior changes. |
| `documentation/services/devstudio.md` | Documents Admin tooling missing-icon marker only if `admin/src/main.ts` behavior changes. |

## Gap-To-Fix Categories

126C execution maps icon gaps into these categories:

1. human-owned source artifact parity;
2. ordinary build must not mutate icon source;
3. Dieter component `data-icon` and numeric size cleanup;
4. Bob compiler-owned icon replacement path;
5. Bob app chrome manifest-adapter consumers;
6. DevStudio/Admin icon generation and missing-icon truth;
7. Prague static Dieter icon consumption;
8. public widget operational icon classification;
9. `diet-icon` numeric sizing;
10. `currentColor` preservation;
11. parent/control-owned icon state;
12. decorative/icon-only/meaningful icon semantics;
13. account asset boundary;
14. living-doc rewrite.

These are execution categories, not a license to build a registry, runtime
replacement system, validation platform, icon governance workflow, or new icon
component.

## Out Of Scope For 126C Implementation

- New icon design.
- Agent icon origination.
- Adding icons.
- Renaming icons.
- Replacing the SF Symbols port.
- Account asset migration into Dieter icons.
- Runtime icon registry/platform.
- Admin product runtime icon system.
- New icon component.
- Optical-size, filled/outlined, weight, or scale variants.
- Touch-target doctrine.
- Keyboard support.
- Product data changes.

## V1-V8 Pre-Execution Risk Controls

- **V1 silent substitution:** invented icon names, missing icons, or account SVGs
  must not be substituted for approved Dieter icons.
- **V2 silent healing:** deploy build must not normalize or rewrite committed
  icon source during ordinary build.
- **V3 silent omission:** blast radius must include Dieter source, deploy
  output, Bob, DevStudio/Admin, widgets, Roma, and docs.
- **V4 fail-open control:** missing icons in reveal/tooling paths must not
  silently skip and render absence.
- **V5 corruption-as-absence:** invalid icon references must not become empty
  UI without an owning fix.
- **V6 partial-success masquerade:** source/Tokyo parity must not be claimed
  while consumer lanes still drift.
- **V7 masquerade/redress:** Admin local replacement must not reappear as a
  "shared contract" or product runtime icon system.
- **V8 runtime test dependency:** normal icon consumption must not depend on
  validation rituals or helper checks.

## Execution Checklist

126C execution is green only when:

1. `dieter/icons/icons.json`, `dieter/icons/svg/**`, and
   `tokyo/product/dieter/icons/**` have required count/name parity.
2. Source SVGs remain `currentColor`.
3. Ordinary `pnpm build:dieter` does not mutate committed Dieter icon source.
4. Agents are documented as consumers only, not icon originators.
5. Dieter component icon slots use approved names and `.diet-icon` glyph sizes
   use numeric values only.
6. Non-numeric `.diet-icon` size labels are removed from icon source/docs while
   unrelated component `data-size` APIs remain under component PRD ownership.
7. `diet-icon` numeric size mapping matches the Dieter size ladder.
8. Bob icon consumption remains compiler/manifest-owned.
9. DevStudio/Admin reveal/docs path does not silently skip missing icons and is
   not documented as product runtime icon replacement.
10. Public widget operational icons are classified and use approved Dieter names
    where widget schema exposes operational icons.
11. Account/brand/content SVG assets remain outside Dieter icon doctrine.
12. Decorative icons are hidden; icon-only controls are named on the control;
    meaningful standalone icons have an explicit label rule.
13. Living docs listed in the blast-radius table match this PRD.
14. No inactive paths, compatibility aliases, legacy wrappers, icon registry
    platform, or validation machinery are preserved as product law.

## Done For 126C

126C is done when implementation makes iconography truthful and agent-operable:

- the approved Dieter icon source artifact pair is authoritative;
- human origination through `tooling/sf-symbols` is documented;
- ordinary build copies/verifies icons without mutating source;
- consumers have deterministic icon consumption lanes;
- icons use numeric sizes only;
- icons use `currentColor`;
- icon state comes from parent/control state;
- icon semantics are explicit at the consumer/control level;
- account SVG assets remain account assets;
- living docs tell future agents exactly how to consume icons without inventing
  icon paths, aliases, registries, runtime replacement systems, or new icons.

## Compliance With Clickeen Architecture And Product Law

- Lean and agent-operable: agents consume a fixed human-owned icon set through
  deterministic paths.
- Source authority separation: Dieter owns operational icon source; Tokyo
  publishes output; account assets remain account assets; consumers consume.
- No reinterpretation: 126C does not become icon redesign, icon governance,
  registry platform, account asset migration, Admin icon system, or component
  framework.
- No masquerade: docs and consumers must not claim inactive paths, missing-icon
  absence, Admin replacement, or fake size aliases as current product truth.
- No silent substitution: missing icons, account SVGs, and unknown names remain
  errors/gaps until fixed by the owning path.
- Human authority preserved: icon origination and new icon decisions remain
  human-owned.
