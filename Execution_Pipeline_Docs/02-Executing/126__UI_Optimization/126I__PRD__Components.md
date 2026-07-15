# 126I - PRD: Components

Status: PRE-EXECUTION DOCTRINE RECORDED - step-5 living doctrine reconciled; mandatory component law and D1 blocking-dialog dismissal propagated; steps 6-8 remain pending.
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

## Current Mandatory Law

The owner register is the consolidated authority. For 126I it requires one
inspectable contract per ToolDrawer field type; deletion of unconsumed
`textrename`; native Toggle behavior with the unused custom hydrator deleted;
distinct `repeater` and `object-manager` contracts with declared dependencies;
native buttons for the six fake dropdown triggers; deletion of the dead
`dropdown-actions` footer branch; and removal of the accumulating Object Manager
backdrop listener. These are settled execution requirements, not owner choices.
Under accepted D1 law, Bulk Edit and Object Manager close on Escape only when
unchanged; dirty dismissal opens discard confirmation, backdrop dismissal is
disabled, Cancel follows the same dirty rule, and Save applies the local edits
to Bob's working state. Account persistence remains Bob's separate Save command.

## Frozen Phase 1 Evidence

The inventory in this section is the point-in-time Codex Step-2 baseline. It is
evidence, not current doctrine. Mandatory component and D1 dismissal law is now
settled in this PRD and the product-owner decision register.

### Current Reality

- Components are the pivot layer between foundation tokens and product surfaces.
- Dieter component source truth is code-first under `dieter/components/**`.
- Runtime component truth is generated into `tokyo/product/dieter/components/**` and represented by `tokyo/product/dieter/manifest.json`.
- DevStudio component truth is a generated showcase/governance view; it is primarily spec-backed and does not equal runtime manifest truth.
- Bob consumes components through compiled ToolDrawer fields, stencil HTML, optional component specs, manifest media, and runtime hydrators.
- Component counts must be qualified by inventory:
  - source folders: 25 directories including non-rendered `shared`
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
- `shared/` is helper source and is not a shipped manifest component.

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
- `toggle` has a spec, template, CSS, and generated runtime JS, but its unused
  custom Enter-key hydrator is not exported or hydrated. Native checkbox
  behavior is the supported contract; the custom hydrator is a deletion target,
  not an owner decision.
- `object-manager` and `repeater` ship and hydrate through Bob runtime scripts, but are static in DevStudio showcase.
- `object-manager` and `repeater` are distinct contracts and must not be consolidated in Step 2.
- Manifest dependency coverage is incomplete for composites such as `object-manager` and `repeater`.
- `icon` is CSS-only and should not be counted like a spec-backed ToolDrawer component.
- `agent-activity` is consumed by manual Bob React markup rather than the ToolDrawer compiler path.
- Component-local raw values remain, including intentional color-picker hue
  stops, raw z-index/shadows, and hardcoded modal widths. Historical
  `--radius-2`, `--color-surface`, and `--hspace-*` findings are fixed in current
  source and are not current 126I gaps.

### Compliance Reason

- The frozen baseline audited component contracts as they existed.
- It added no component framework and performed no removal, rename, or
  consolidation.
- It did not masquerade local screen UI as Dieter.
- Its then-open decisions are now resolved by the mandatory law in this PRD and
  the owner register.

## Scope (filled from the audit)
- Component inventories by source folder, manifest component, manifest JS bundle, DevStudio spec/template/CSS registry, and Bob runtime usage.
- Hydration + spec-binding model.
- Component-local token/variant/state/data-attribute patterns.
- Drift: raw hue stops, raw z-index/shadow values, hardcoded modal widths, undefined/fallback token references, export/spec/manifest mismatches.
- `textrename` has no current product consumer and is a deletion target rather
  than a spec-governance project.
- `repeater` and `object-manager` are proven distinct and actively consumed;
  preserve both and declare their exact component dependencies.

## Out of scope
- Redesign / new visual language (design freeze, MAMA §4).
- Token changes (126B/126D/126F/126H own).
- Screens (126L/126M).
- Any step-9 component removal, consolidation, or migration before steps 4-8
  are green. The settled deletion targets above are not reopened as decisions.
