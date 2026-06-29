# 126I - PRD: Components

Status: DIRECTIONAL - Phase 1 Step 2 baseline from Codex audit (`audits/126I__AsBuilt_Codex.md`).
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA). Series order: dependency order (MAMA §7); DevStudio UI + Roma UI last.
KB doc: `documentation/engineering/UI/components.md` (canonical reference; this PRD drives it).

## Role
The component library: the pivot layer. A-H feed components; Bob, guidance, DevStudio, and Roma consume them. 126I is about component contracts as they exist: source shape, spec/template/CSS/hydration, manifest/runtime media, DevStudio showcase, and Bob ToolDrawer consumption.

## 126 Pre-GA No Legacy Compatibility Tenet

Clickeen is pre-GA. This PRD must not preserve old UI drift through
compatibility shims, temporary aliases, parallel legacy paths, or "support both
old and new" transitions unless the human explicitly makes that behavior product
law in this PRD.

Once the 126I components standard is decided:

- Fix source and docs to the standard.
- Remove old drift and stale paths.
- Do not leave legacy names, classes, render paths, token aliases, wrappers, or
  local one-offs as supported alternatives.
- Do not add guard/check machinery to enforce this tenet. The PRD is the
  authority; execution must clean the code/doc surface instead of preserving bad
  paths behind validation.

## Precondition
Run the real components audit first (six-step loop, MAMA §9). This PRD is filled from verified, `file:line`-cited findings — not assumptions.

## Codex Baseline - Phase 1 Step 2

This is Codex baseline only. It is not final doctrine, not a fix plan, and not Step 4 convergence.

### Current Reality

- Components are the pivot layer between foundation tokens and product surfaces.
- Dieter component source truth is code-first under `dieter/components/**`.
- Runtime component truth is generated into `tokyo/product/dieter/components/**` and represented by `tokyo/product/dieter/manifest.json`.
- DevStudio component truth is a generated showcase/governance view; it is primarily spec-backed and does not equal runtime manifest truth.
- Bob consumes components through compiled ToolDrawer fields, stencil HTML, optional component specs, manifest media, and runtime hydrators.
- Component counts must be qualified by inventory:
  - source folders: 26 directories including `shared` and empty `command-activity`
  - runtime manifest components: 24 CSS-backed components
  - manifest JS components: 20 JS-backed components
  - DevStudio spec imports: 22
  - DevStudio template imports: 23
  - DevStudio CSS imports: 24
- There is no single truthful flat number without naming which inventory is being counted.

### Contract Shapes

- Spec + HTML + CSS components are governed by DevStudio page generation.
- Spec + HTML + CSS + TS components can be governed and hydrated through TypeScript export paths.
- Spec + HTML + CSS + hand-written JS components can ship through manifest runtime media without being TypeScript-exported.
- CSS-only components such as `icon` can be runtime CSS artifacts without being spec-backed ToolDrawer controls.
- HTML + CSS + TS without spec, currently `textrename`, can ship and hydrate but miss spec governance.
- Empty directories such as `command-activity` are source inventory noise and not shipped manifest components.

### Bob And Runtime Baseline

- Bob stencil loading fails if component HTML is missing.
- Bob treats component spec 404 as optional, while non-404 spec failures fail.
- Bob media loading fails invalid/missing Dieter manifest and unknown required bundles.
- Bob emits Dieter token CSS plus component CSS and JS from manifest usage and dependencies.
- Builder runtime runs loaded `window.Dieter.hydrate*` functions.
- Therefore Bob can consume runtime components that are not DevStudio spec-governed.

### DevStudio Baseline

- DevStudio static registry generation walks specs, templates, and CSS independently.
- DevStudio `componentSources` are built from `specModules`.
- DevStudio generated component pages skip folders without spec files.
- DevStudio hydrates a fixed set of imported TypeScript hydrators.
- This creates legitimate but important differences between DevStudio showcase, TypeScript export surface, and runtime manifest surface.

### Known Gaps Only

- Existing component docs contain stale track/count language.
- `textrename` is shipped, exported, and hydrated, but not spec-governed.
- Bob can render no-spec component stencils when the spec is a 404.
- `toggle` has runtime JS but is not exported through `dieter/components/index.ts` and is not hydrated by DevStudio.
- `object-manager` and `repeater` ship and hydrate through Bob runtime scripts, but are static in DevStudio showcase.
- `object-manager` and `repeater` are distinct contracts and must not be consolidated in Step 2.
- Manifest dependency coverage is incomplete for composites such as `object-manager` and `repeater`.
- `command-activity` is an empty dead directory.
- `icon` is CSS-only and should not be counted like a spec-backed ToolDrawer component.
- `agent-activity` is consumed by manual Bob React markup rather than the ToolDrawer compiler path.
- Component-local raw values remain, including raw hue stops, raw z-index/shadows, hardcoded modal widths, undefined `--radius-2`, undefined `--color-surface`, and fallback-masked `--hspace-*`.

### Compliance Reason

- This baseline audits component contracts as they exist.
- This baseline does not add a component framework.
- This baseline does not remove, rename, or consolidate components.
- This baseline does not masquerade local screen UI as Dieter.
- This baseline does not decide fixes for token, color, motion, accessibility, or screen concerns before human convergence.

## Scope (filled from the audit)
- Component inventories by source folder, manifest component, manifest JS bundle, DevStudio spec/template/CSS registry, and Bob runtime usage.
- Hydration + spec-binding model.
- Component-local token/variant/state/data-attribute patterns.
- Drift: raw hue stops, raw z-index/shadow values, hardcoded modal widths, undefined/fallback token references, export/spec/manifest mismatches.
- Dead/empty: `command-activity`.
- Spec gap: `textrename`.
- Open: `repeater` vs `object-manager` distinction remains preserved until human convergence.

## Out of scope
- Redesign / new visual language (design freeze, MAMA §4).
- Token changes (126B/126D/126F/126H own).
- Screens (126L/126M).
- Component removal, consolidation, or migration before Step 4+ convergence.
