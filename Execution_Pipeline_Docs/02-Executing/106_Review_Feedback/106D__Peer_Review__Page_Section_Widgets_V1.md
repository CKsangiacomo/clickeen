# 106D Peer Review - Page Section Widgets V1

Status: Historical review feedback / superseded by `106H__Audit_Refresh_Decision_Log.md` 2026-06-04 system tenets audit
Date: 2026-06-03
Reviewed PRD: `../106D__PRD__Page_Section_Widgets_V1.md`

## Review Lens

Page-section widgets are normal Clickeen widgets.

The word “section” may describe the user-facing shape, but it must not create:

- a block product type;
- a section inventory;
- a section renderer;
- a composer-only widget source;
- a second catalog path;
- widget-inside-widget slots.

The boring model is:

```text
tokyo/product/widgets/{widgetType}
  -> normal account instance
  -> normal Bob edit
  -> normal Tokyo materialized package
  -> normal Page Composer placement
```

## Consolidated Verdict

106D is directionally right but too thin to execute safely.

The core idea is correct:

- `hero`, `split`, `cta`, and image/title sections should be widget types;
- FAQ, Countdown, and Logo Showcase are already page sections when placed full-width;
- Page Composer should not care whether a widget looks “section-like.”

The PRD needs stronger execution boundaries:

- V1 scope conflicts with its green criteria;
- 106A/106B must be hard prerequisites;
- new widget code vectors are not named;
- `image-title` is a current naming/validation risk;
- catalog display metadata is unresolved without `catalog.json`;
- `split` needs a self-contained definition so it does not become a container.

## Agent1 - Staff Engineer Review

### Elegant Engineering And Scalability

Good:

- Keeps page-shaped content in the existing widget system.
- Uses normal account-owned widget instances.
- Avoids a block/section source model.
- Keeps translation on `editable-fields.json`.

Blocking gaps:

- The PRD lists four V1 targets but says “at least one” must materialize.
- A new widget can pass 106D while still failing 106B if it copies current runtime/CSS patterns.
- New widget type implementation requires codebook, generated source index, widget validation, Roma creation, Bob compilation, saved package output, and Tokyo package storage.

### Architecture / Tenet Compliance

Compliant:

- No separate section inventory.
- No widget-inside-widget slots.
- No section renderer.
- Normal Roma account instance create/edit path.

Needs tightening:

- Explicitly ban `block`, `pageSection`, section routes, section registries, and composer-only widget truth.
- Require the 106B composable runtime contract for new widgets from day one.
- Require normal Stage/Pod/Header/Typography/shared modules, not copied shell CSS.

### Overarchitecture / Gold-Plating Risks

Avoid:

- generic section/container widget;
- split-left/split-right clones;
- a layout framework;
- block-library variants;
- page-specific editor primitives;
- `catalog.json` resurrection.

`split` should be one self-contained media/copy widget with layout settings, not a container with child placements.

### Simple / Boring Path

Recommended simple path:

```text
V1 required target: hero
Follow-up candidates: cta, split, imagetitle
Use FAQ/countdown/logoshowcase as existing page-section proof
```

Build one new widget through the entire real stack before multiplying widget types.

## Agent2 - Senior PM Review

### Product UX And Scalability

Good:

- Users do not need to learn “block vs widget.”
- A page is simply a stack of things they already understand: widget instances.
- Existing FAQ/Countdown/Logo Showcase already become page content when stacked.

Product risks:

- Four new widgets before Page Composer works can become catalog bloat.
- “image-title” or “imagetitle” raw fallback labels are poor UX unless display metadata is solved.
- `split` can invite accidental nesting unless the product shape is explicit.
- Full-width section defaults need taste: hero can be viewport-height; CTA/split/image-title should default to content-height.

### Architecture / Tenet Compliance

Compliant:

- The user-facing product stays one widget system.
- Page sections use normal Builder editing.
- Translation and policy remain widget-owned.

Needs tightening:

- Decide display metadata authority without `catalog.json`.
- Decide whether 106D ships one vertical slice or all named targets.
- Require 106E placement by `instanceId` with no widget-type branch.

### Overarchitecture / Complexity

Do not block Page Composer on a full section library.

The first product proof can be:

```text
hero + faq + countdown + logoshowcase
```

That proves page composition without inventing a new design system category.

### Simple / Boring Product Path

Sequence:

1. Make the package contract composable.
2. Add one flagship page-shaped widget.
3. Compose it with existing widgets.
4. Add more section widgets only after the page workflow works.

## Agent3 - Principal TPM Review

### Cohesive / Cost-Effective Architecture

Good:

- New page-shaped widgets ride the current widget definition pipeline.
- Roma already lists widget definitions from Tokyo.
- Roma already creates account instances by `widgetType`.
- Bob already compiles widget folders into editor contracts.

Operational gaps:

- Every new widget type must be added to the overlay codebook.
- Generated widget definition source must be updated and validated.
- `limits.json` is required by current validation/test expectations, not optional “when needed.”
- Existing 106B publish/composition ambiguity remains: page placement should not require a separate public section publish mode.

### Systems That Talk To Each Other

The required systems are:

- `tokyo/product/widgets/{widgetType}`;
- `editable-fields.json`;
- `limits.json`;
- `packages/ck-contracts` overlay codebook;
- generated Tokyo widget definition source index;
- Tokyo widget catalog/domain;
- Roma `/api/account/widgets` and `/api/account/instances`;
- Bob compiled widget route;
- Tokyo package storage/readiness;
- Page Composer placement by instance id.

No new subsystem is needed.

### SaaS-Grade Technical Bar

New section widgets must:

- pass current widget validation;
- use 106A shared primitives;
- use 106B root-scoped runtime;
- generate first-paint saved content;
- avoid page-breaking global CSS;
- initialize twice on one page without collision;
- cover every visible customer string in `editable-fields.json`.

### Recommended Sequence

Run 106A/106B to green first.

Then ship one 106D vertical slice, preferably `hero`, through the full stack. Only after that should split/CTA/image-title be added or treated as dependable inputs for Page Composer.

## Consolidated Required PRD Decisions

Before executing 106D, decide:

1. **V1 Scope**
   - Option A: V1 required target is `hero`; `cta`, `split`, and image/title are follow-up candidates.
   - Option B: all listed V1 targets must pass all gates before 106D is green.
   - Recommended: Option A.

2. **Widget Type Naming**
   - `image-title` conflicts with current validation conventions.
   - Rename to a validator-safe widget type such as `imagetitle`, or update validation/codebook parsing deliberately.

3. **Display Metadata Authority**
   - Roma currently falls back to raw widget type labels.
   - Solve label/description without resurrecting `catalog.json`.

4. **Hard 106A/106B Prerequisite**
   - New widgets must use the composable package contract from the start.
   - No new widget may copy `document.currentScript`, `window.CK_WIDGET`, or global Stage/Pod CSS leakage.

5. **Valid `limits.json` For Every New Widget**
   - Replace “when needed” with “required.”
   - It maps only to `ck-policy` keys and never defines tier truth.

6. **Self-Contained Section Widget Shapes**
   - `hero`: self-contained headline/body/CTA/media section.
   - `split`: one self-contained media/copy widget with layout/alignment settings.
   - `cta`: self-contained conversion row.
   - image/title: self-contained image plus text widget.
   - No slots, no child widget references, no nested placements.

7. **Stage/Pod Defaults**
   - `hero` may default to viewport-height.
   - Non-hero widgets should default to content-height full-width sections.

8. **No Separate Publish Mode**
   - 106D should not create a section publish state.
   - Page composition/public serving semantics belong to 106F/106G.

## Suggested Acceptance Gates

106D should fail if:

- a new widget lacks `spec.json`, `widget.html`, `widget.css`, `widget.client.js`, `editable-fields.json`, or `limits.json`;
- overlay codebook does not include a unique code for the widget;
- generated widget definition source index is stale;
- `pnpm validate:widgets` fails;
- `/__internal/widgets/definitions` does not include the new widget;
- Roma `/api/account/widgets` does not list it;
- Roma `/api/account/instances` cannot create it as a normal account instance;
- Bob compiled route cannot return spec, editable fields, limits, and package files;
- generated `index.html` lacks saved visible content before JavaScript;
- generated runtime emits or reads `window.CK_WIDGET`;
- two instances of the same new widget collide in one document;
- 106E needs a `section`, `block`, or widget-type-specific branch to place it.

## Decision Status

Do not execute 106D as-is.

Keep the direction, but narrow the first execution slice and harden the real widget-system gates. The point of 106D is not to build a block library. It is to prove that a page-shaped product section can be just another widget.
