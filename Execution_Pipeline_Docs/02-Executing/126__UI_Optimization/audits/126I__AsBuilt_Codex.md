# 126I Components - As-Built Audit - Codex

Status: FROZEN POINT-IN-TIME PRE-EXECUTION AS-BUILT - exact working-tree provenance may be unrecorded; current source has 25 directories including `shared`, no `command-activity`, and no step-9 execution credit.
Scope: Dieter component library contracts: source inventory, runtime manifest, DevStudio registry/showcase, Bob compiler/ToolDrawer consumption, hydration paths, and known component contract gaps.

No code changes, no runtime operations, no product data changes, no Cloudflare/R2 preflight.

Current-source correction: the 26-directory count and `command-activity`
observation below are preserved only as historical evidence from the inspected
tree. They are not current inventory. Current tracked/worktree truth is 25
directories including `shared`; `command-activity` is absent.

The `--color-surface`, `--radius-2`, and `--hspace-*` component findings below
are also historical and resolved. Current source has zero such component
references. Raw user-authored values and component-local overlay geometry remain
separate, current observations.

## Authority Boundary

- Dieter source component authority is `dieter/components/**`.
- Runtime Dieter component artifact authority is `tokyo/product/dieter/components/**` plus `tokyo/product/dieter/manifest.json`.
- DevStudio component documentation/showcase authority is generated from `admin/scripts/**` and `admin/src/data/componentRegistry.generated.ts`.
- Bob component consumption authority is the compiler/ToolDrawer path under `bob/lib/compiler/**` and Builder runtime hydration under `bob/components/td-menu-content/**`.
- This audit treats those as different component contracts. It does not collapse them into one count.

## Inspected-Tree Inventory Counts Must Be Qualified

There is no single honest component count without naming the inventory being counted:

- Inspected source folder inventory: 26 directories under `dieter/components`,
  including `shared` and empty `command-activity`; current source has 25
  including `shared`.
- Inspected renderable source folders excluding `shared`: 25 names.
- Historical empty/dead source directory, absent now: `command-activity`.
- Manifest component inventory: 24 components with generated CSS output.
- Manifest JS inventory: 20 components with JS bundles.
- DevStudio generated spec inventory: 22 spec imports.
- DevStudio generated template inventory: 23 template imports, including `textrename`.
- DevStudio generated CSS inventory: 24 CSS imports, including `icon` and `textrename`.

Evidence:

- `scripts/build-dieter.js:42`
- `scripts/build-dieter.js:49`
- `tokyo/product/dieter/manifest.json:3`
- `tokyo/product/dieter/manifest.json:28`
- `tokyo/product/dieter/manifest.json:30`
- `tokyo/product/dieter/manifest.json:50`
- `admin/src/data/componentRegistry.generated.ts:3`
- `admin/src/data/componentRegistry.generated.ts:24`
- `admin/src/data/componentRegistry.generated.ts:25`
- `admin/src/data/componentRegistry.generated.ts:47`
- `admin/src/data/componentRegistry.generated.ts:48`
- `admin/src/data/componentRegistry.generated.ts:71`

## Inspected-Tree Source File Shape

The source folders in the inspected tree showed these contract shapes:

- Spec + HTML + CSS only: `agent-activity`, `popover`, `slider`.
- Spec + HTML + CSS + TS: most interactive TypeScript components.
- Spec + HTML + CSS + hand-written JS: `object-manager`, `repeater`.
- CSS only: `icon`.
- HTML + CSS + TS without spec: `textrename`.
- Historical empty directory, absent now: `command-activity`.
- Shared helper directory: `shared`.

The source shape matters because generators and consumers use different rules for spec, template, CSS, and runtime hydration.

Evidence:

- `dieter/components/agent-activity/agent-activity.spec.json`
- `dieter/components/popover/popover.spec.json`
- `dieter/components/slider/slider.spec.json`
- `dieter/components/object-manager/object-manager.js`
- `dieter/components/repeater/repeater.js`
- `dieter/components/icon/icon.css`
- `dieter/components/textrename/textrename.ts`
- `dieter/components/textrename/textrename.html`
- `dieter/components/textrename/textrename.css`

## Build And Manifest Contract

- `scripts/build-dieter.js` lists component bundles by generated component directories that contain `{name}.css`.
- It bundles component scripts from TypeScript files whose basename equals their parent component folder name.
- It bundles to `components/{name}/{name}.js` and exposes the function on `window.Dieter` through the IIFE wrapper.
- Manifest `components` therefore means CSS-backed generated component artifact, not necessarily spec-backed or TypeScript-exported.
- Manifest `componentsWithJs` means a JS artifact exists, not necessarily that the component is exported from `dieter/components/index.ts`.
- Manifest aliases map `btn*` variants to `button` and `popover-host` to `popover`.
- Manifest deps are explicit for dropdowns, `bulk-edit`, and `popaddlink`, but not every composite.

Evidence:

- `scripts/build-dieter.js:42`
- `scripts/build-dieter.js:49`
- `scripts/build-dieter.js:196`
- `scripts/build-dieter.js:203`
- `scripts/build-dieter.js:213`
- `scripts/build-dieter.js:224`
- `scripts/build-dieter.js:309`
- `tokyo/product/dieter/manifest.json:3`
- `tokyo/product/dieter/manifest.json:30`
- `tokyo/product/dieter/manifest.json:52`
- `tokyo/product/dieter/manifest.json:65`

## DevStudio Component Registry Contract

- Static registry generation walks spec files, template files, and CSS files independently.
- `specModules`, `templateModules`, and `cssModules` therefore can have different inventories.
- `componentSources` are built from `specModules`.
- DevStudio generated component pages skip directories with no spec, and require template+CSS for governed components.
- Governance defines governed components as component directories containing spec, HTML, and CSS.
- DevStudio route pages pull CSS by component slug for discovered component pages.
- DevStudio hydrates a fixed list of imported TypeScript hydrators.

Evidence:

- `admin/scripts/generate-static-registries.mjs:99`
- `admin/scripts/generate-static-registries.mjs:101`
- `admin/scripts/generate-static-registries.mjs:102`
- `admin/scripts/generate-static-registries.mjs:103`
- `admin/scripts/generate-static-registries.mjs:133`
- `admin/scripts/generate-static-registries.mjs:137`
- `admin/scripts/generate-static-registries.mjs:141`
- `admin/src/data/componentRegistry.ts:54`
- `admin/src/data/componentRegistry.ts:78`
- `admin/scripts/generate-component-pages.ts:33`
- `admin/scripts/generate-component-pages.ts:38`
- `admin/scripts/generate-component-pages.ts:39`
- `scripts/dieter/governance-guards.mjs:57`
- `scripts/dieter/governance-guards.mjs:69`
- `admin/src/data/routes.ts:57`
- `admin/src/data/routes.ts:64`
- `admin/src/main.ts:253`
- `admin/src/main.ts:269`

## Bob Compiler And ToolDrawer Contract

- Bob consumes component controls through `tooldrawer-field` markup.
- Bob loads component HTML stencils from Tokyo Dieter artifacts.
- Missing component HTML fails compilation.
- Component `.spec.json` is optional only when the spec request returns 404.
- Non-404 spec load errors fail.
- `buildContext` accepts optional specs and falls back to generic/default context when no spec exists.
- Bob media loads the remote Dieter manifest.
- Invalid/missing manifest fails.
- Unknown required Dieter component bundle fails.
- Bob expands manifest deps and emits `/dieter/tokens/tokens.css`, component CSS, and component JS.
- Builder runtime loads those media assets and runs all `window.Dieter.hydrate*` functions except `hydrateAll`.

Evidence:

- `bob/lib/compiler/controls.ts:269`
- `bob/lib/compiler/stencils.ts:67`
- `bob/lib/compiler/stencils.ts:80`
- `bob/lib/compiler/stencils.ts:82`
- `bob/lib/compiler/stencils.ts:86`
- `bob/lib/compiler/stencils.ts:90`
- `bob/lib/compiler/stencils.ts:175`
- `bob/lib/compiler/stencils.ts:181`
- `bob/lib/compiler/media.ts:20`
- `bob/lib/compiler/media.ts:34`
- `bob/lib/compiler/media.ts:89`
- `bob/lib/compiler/media.ts:93`
- `bob/lib/compiler/media.ts:98`
- `bob/lib/compiler/media.ts:103`
- `bob/lib/compiler/media.ts:109`
- `bob/components/td-menu-content/dom.ts:73`
- `bob/components/td-menu-content/dom.ts:78`
- `bob/components/td-menu-content/dom.ts:87`

## Textrename Contract Gap

- `textrename` is a real shipped runtime component: it has HTML, CSS, and TypeScript.
- It is in the manifest component list.
- It is in the manifest JS list.
- It is exported from `dieter/components/index.ts`.
- It is imported and hydrated in DevStudio.
- It has no `.spec.json`, so it is not in `specModules`.
- It is present in generated template and CSS registries.
- DevStudio generated component pages are spec-driven, so `textrename` does not become a governed component page.
- Bob can render no-spec stencils because spec 404 is tolerated.

Evidence:

- `dieter/components/textrename/textrename.ts:13`
- `dieter/components/textrename/textrename.html:1`
- `dieter/components/textrename/textrename.css:1`
- `tokyo/product/dieter/manifest.json:25`
- `tokyo/product/dieter/manifest.json:47`
- `dieter/components/index.ts:18`
- `admin/src/main.ts:23`
- `admin/src/main.ts:258`
- `admin/src/data/componentRegistry.generated.ts:45`
- `admin/src/data/componentRegistry.generated.ts:69`
- `admin/src/data/componentRegistry.generated.ts:73`
- `admin/src/data/componentRegistry.generated.ts:96`
- `bob/lib/compiler/stencils.ts:86`
- `bob/lib/compiler/stencils.ts:94`

## Toggle Export Drift

- `toggle` has a real TypeScript hydrator.
- `toggle` is in manifest `componentsWithJs`.
- `toggle` is not exported from `dieter/components/index.ts`.
- DevStudio imports and hydrates many Dieter hydrators but does not import/hydrate `hydrateToggle`.
- Bob is different because it executes every loaded `window.Dieter.hydrate*` function.
- Therefore this is an export/DevStudio hydration drift, not proof that `toggle` is unshipped.

Evidence:

- `dieter/components/toggle/toggle.ts:1`
- `dieter/components/toggle/toggle.ts:25`
- `tokyo/product/dieter/manifest.json:48`
- `dieter/components/index.ts:1`
- `dieter/components/index.ts:18`
- `admin/src/main.ts:11`
- `admin/src/main.ts:27`
- `admin/src/main.ts:253`
- `admin/src/main.ts:269`
- `bob/components/td-menu-content/dom.ts:78`
- `bob/components/td-menu-content/dom.ts:87`

## Object Manager And Repeater Are Distinct Contracts

- `object-manager` and `repeater` both represent array-like editing in ToolDrawer, but their specs differ.
- Bob field-value logic treats both as JSON field sources.
- Bob stencil logic distinguishes them for label and action behavior.
- `object-manager` has a modal management model.
- `repeater` has reorder/list-item behavior and can open bulk edit.
- Both ship hand-written JS.
- Neither is exported from `dieter/components/index.ts`.
- Bob hydrates them through manifest-loaded `window.Dieter` scripts.
- DevStudio does not import/hydrate their JS, so generated showcase pages are static for these controls.
- They must not be consolidated or declared duplicates in Step 2.

Evidence:

- `dieter/components/object-manager/object-manager.spec.json:2`
- `dieter/components/object-manager/object-manager.html:38`
- `dieter/components/object-manager/object-manager.js:146`
- `dieter/components/repeater/repeater.spec.json:2`
- `dieter/components/repeater/repeater.html:1`
- `dieter/components/repeater/repeater.js:236`
- `dieter/components/repeater/repeater.js:327`
- `bob/components/td-menu-content/fieldValue.ts:16`
- `bob/components/td-menu-content/fieldValue.ts:17`
- `bob/lib/compiler/controls.ts:222`
- `bob/lib/compiler/controls.ts:229`
- `bob/lib/compiler/stencils.ts:323`
- `bob/lib/compiler/stencils.ts:360`
- `tokyo/product/dieter/manifest.json:40`
- `tokyo/product/dieter/manifest.json:42`
- `dieter/components/index.ts:1`
- `dieter/components/index.ts:18`
- `bob/components/td-menu-content/dom.ts:78`
- `bob/components/td-menu-content/dom.ts:87`
- `admin/src/main.ts:11`
- `admin/src/main.ts:27`

## Composite Dependency Gaps

- Bob loads required usages plus manifest dependencies.
- Manifest deps cover dropdowns, `bulk-edit`, and `popaddlink`.
- Manifest deps do not currently declare `repeater` or `object-manager` dependencies.
- `object-manager` stencils use Dieter button classes.
- `repeater` stencils use Dieter button classes and can contain textfield/toggle markup.
- Current behavior can therefore depend on incidental sibling component usage instead of declared composite dependencies for those composites.

Evidence:

- `bob/lib/compiler/media.ts:89`
- `bob/lib/compiler/media.ts:98`
- `bob/lib/compiler/media.ts:103`
- `bob/lib/compiler/media.ts:105`
- `tokyo/product/dieter/manifest.json:65`
- `tokyo/product/dieter/manifest.json:110`
- `dieter/components/object-manager/object-manager.html:12`
- `dieter/components/object-manager/object-manager.html:19`
- `dieter/components/object-manager/object-manager.html:47`
- `dieter/components/object-manager/object-manager.html:68`
- `dieter/components/repeater/repeater.html:5`
- `dieter/components/repeater/repeater.html:16`
- `dieter/components/repeater/repeater.html:25`
- `dieter/components/repeater/repeater.html:47`
- `dieter/components/repeater/repeater.html:59`
- `dieter/components/repeater/repeater.html:64`

## Icon Component Contract

- `icon` is CSS-only in source.
- `icon` appears in manifest components because it has CSS output.
- `icon` appears in generated CSS registry.
- `icon` has no spec or template import in generated registry.
- It should not be counted as equivalent to spec-backed ToolDrawer components.

Evidence:

- `dieter/components/icon/icon.css:1`
- `tokyo/product/dieter/manifest.json:14`
- `admin/src/data/componentRegistry.generated.ts:58`
- `admin/src/data/componentRegistry.generated.ts:135`
- `admin/src/data/componentRegistry.generated.ts:3`
- `admin/src/data/componentRegistry.generated.ts:47`
- `admin/src/data/componentRegistry.generated.ts:73`
- `admin/src/data/componentRegistry.generated.ts:122`

## Agent Activity Contract

- `agent-activity` has Dieter spec/HTML/CSS.
- Bob loads `agent-activity` CSS globally in app layout.
- Bob translations UI renders matching Dieter class markup directly in React.
- This is a Dieter component consumer path, but not ToolDrawer compiler output.

Evidence:

- `dieter/components/agent-activity/agent-activity.html:1`
- `dieter/components/agent-activity/agent-activity.html:8`
- `bob/app/layout.tsx:15`
- `bob/app/layout.tsx:20`
- `bob/components/TranslationsPanel.tsx:94`
- `bob/components/TranslationsPanel.tsx:101`

## Historical Dead Empty Directory

- `dieter/components/command-activity/` existed as an empty directory in the
  inspected tree and is absent from current source.
- It had no CSS, HTML, spec, TS, or JS files and was absent from manifest and
  generated DevStudio registries.
- It could not be a shipped runtime component through that build path because
  the manifest listed CSS-backed output component folders.

Evidence:

- `scripts/build-dieter.js:42`
- `scripts/build-dieter.js:49`
- `tokyo/product/dieter/manifest.json:3`
- `tokyo/product/dieter/manifest.json:28`

## Historical Component-Local Styling Findings

- Resolved after this audit: `button` referenced undefined `--color-surface`.
- Resolved after this audit: `bulk-edit` referenced undefined `--radius-2`.
- Resolved after this audit: several dropdown/text controls referenced
  fallback-masked `--hspace-*`.
- `dropdown-fill` contains raw hue gradient stops.
- `bulk-edit` and `object-manager` both hardcode `z-index: 1000` and duplicate modal-like shadows.
- `popover` and `textedit` both use raw `z-index: 12`.
- `textedit` has a fallback raw `rgba` shadow.
- These are component contract facts; Step 2 does not decide whether fixes belong in 126I, 126B, 126F, 126H, or later convergence.

Evidence:

- `dieter/components/button/button.css:8`
- `dieter/components/button/button.css:190`
- `dieter/components/button/button.css:321`
- `dieter/components/bulk-edit/bulk-edit.css:96`
- `dieter/components/bulk-edit/bulk-edit.css:112`
- `dieter/components/dropdown-fill/dropdown-fill.css:10`
- `dieter/components/textedit/textedit.css:5`
- `dieter/components/tabs/tabs.css:50`
- `dieter/components/dropdown-fill/dropdown-fill.css:603`
- `dieter/components/dropdown-fill/dropdown-fill.css:610`
- `dieter/components/bulk-edit/bulk-edit.css:20`
- `dieter/components/bulk-edit/bulk-edit.css:36`
- `dieter/components/object-manager/object-manager.css:25`
- `dieter/components/object-manager/object-manager.css:41`
- `dieter/components/popover/popover.css:16`
- `dieter/components/textedit/textedit.css:119`
- `dieter/components/textedit/textedit.css:167`

## Docs Drift Found During Audit

- At audit time, `documentation/engineering/UI/components.md` said "27 component
  dirs + shared", while the inspected tree contained 26 directories including
  `shared` and empty `command-activity`. Current source has 25 including `shared`.
- The same doc still says "track 126B" and "to be filled during 126B"; the current program track for components is 126I.
- The 126I PRD previously referenced `audits/126I__Audit__Components.md`; this Codex artifact is `audits/126I__AsBuilt_Codex.md`.

Evidence:

- `documentation/engineering/UI/components.md:3`
- `documentation/engineering/UI/components.md:10`
- `documentation/engineering/UI/components.md:43`
- `Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126I__PRD__Components.md:3`

## Point-In-Time Gaps And Current Corrections

- Component counts differ across source folders, runtime manifest, DevStudio specs, templates, CSS registries, and JS bundles.
- `textrename` is shipped/hydrated but not spec-governed.
- Bob tolerates no-spec stencils on 404, so no-spec rendering can exist beyond DevStudio.
- `toggle` is shipped with JS but not exported through `dieter/components/index.ts` and not hydrated in DevStudio.
- `object-manager` and `repeater` ship through Bob runtime but are static in DevStudio showcase.
- Manifest deps do not fully describe composite dependencies for `object-manager` and `repeater`.
- Resolved after this audit: the empty `command-activity` directory is absent.
- `icon` is CSS-only and should not be counted as a spec-backed component.
- `agent-activity` is consumed in Bob manual React markup, not through the ToolDrawer compiler path.
- Component-local raw user/content values and overlay geometry remain; the
  undefined/fallback token findings above are resolved.
- Existing docs had stale component-track and count language at audit time;
  current living docs are reconciled separately.

## Compliance Notes

- This frozen audit records the component contracts of its inspected tree; the
  corrections at the top state current source truth.
- This audit does not remove, rename, consolidate, or rewrite any component.
- This audit does not turn screen-local UI into Dieter components.
- This audit does not decide whether styling gaps are fixed in component, token, motion, color, or later convergence tracks.
- This audit preserves `object-manager` and `repeater` as distinct until human convergence.
