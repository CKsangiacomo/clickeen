# 126I - PRD: Components

Status: ORIGINAL STEP 9 COMPLETE; TABLE/POPUP CONVERGENCE IMPLEMENTED AND
DEPLOYED; FINAL POPUP-WORKFLOW QA AND PRODUCT-OWNER ACCEPTANCE PENDING.
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA).
Series order: 126I of 126A-126M.
KB doc: `documentation/engineering/UI/components.md`.
Audit: `audits/126I__Audit__Components.md`.

## 2026-07-30 Table Convergence Correction

The original 126I execution evidence remains valid except that its CSS-only
`operational-table` was too narrow to be the final Dieter Table contract. The
correction replaces it; it does not add a second table abstraction.

Final source authority:

```text
dieter/components/table/
  table.css
  table.html
  table.spec.json
```

Public selectors:

- `.diet-table` on the horizontal-overflow frame;
- `.diet-table__table` on the semantic `<table>`.

Dieter Table owns table width, overflow, outer border and radius, header
surface, row/cell dividers, cell spacing/alignment, typography, and shared
base appearance. Each consumer owns its columns, records, labels, actions,
selection/editing, sorting, pagination, hover/selected/editable/loading/error
meaning and presentation, and policy. No shared Table state layer is added.
Table adds no React component, data model, state manager, grid engine, or API.
The base cell padding is exactly
`var(--space-2) var(--space-3)`; app-specific sticky/editable composition may
extend it without restating the base border/header/row/overflow contract.

The source HTML/spec is a real, source-derived DevStudio example, so Table is a
visible Dieter component route at `#/dieter/table` rather than a hidden CSS
primitive. The example
uses semantic `table`, `thead`, `tbody`, `tr`, `th`, and `td` markup. Generated
DevStudio output comes only from the existing component generator and registry.
It demonstrates ordinary, horizontal-overflow, row-action, and editable-cell
compositions. These are static contract examples, not product data or table
behavior.

Hard-cut migration:

1. add `table/{table.css,table.html,table.spec.json}`;
2. add Table to `dieter/styles.css` and existing component exports/registries;
3. replace every `.diet-operational-table` and
   `.diet-operational-table__table` consumer in DevStudio and Roma with the
   final selectors;
4. migrate any applicable Bob semantic table;
5. delete `dieter/components/operational-table/`, its imports, generated
   registry entries, selectors, documentation, and tests;
6. delete consumer-local base border/header/row/cell/overflow styling now owned
   by Table while retaining domain-specific composition.

No alias, dual selector, wrapper, or compatibility branch may keep
`operational-table` alive. No new generator script or runtime delivery path is
permitted.

Correction acceptance requires source, generated DevStudio example, every
consumer, deletion searches, local checks, exact-SHA deployments, deployed
browser evidence, current docs, and independent V1–V8 to reconcile in
`126_DevQA.md`.

### 2026-07-30 Table Styling And Typography Acceptance

The human product owner fixed the shared Table presentation and its operational
typography mapping:

- the frame and body use `--role-surface`;
- only the column-header band uses `--role-surface-muted`;
- row-header cells have no separate fill;
- `--role-border` owns the outer stroke and horizontal row dividers;
- there are no vertical rules or zebra stripes;
- column headers use `label-s`;
- every body `th` and `td` uses `body-s`;
- action controls retain Dieter Button typography;
- technical token names and source values do not receive monospace typography;
- action columns are compact and end-aligned; preview columns receive remaining
  width where that composition uses them.

Table CSS must not reconstruct typography from raw font-family, font-size,
weight, line-height, or tracking declarations. Consumers must not restate the
shared frame, header, row, cell, or typography presentation locally. This
remains one Dieter Table plus small documented cell/column composition
patterns, not a separate Token Table component.

## Purpose

Make the current Dieter component layer smaller, native where the browser
already provides the behavior, fail closed where Bob requires a complete field
contract, and reusable only where Bob, DevStudio, or Roma has an immediate
product need.

This is a refactor of the existing component substrate. It is not a component
framework project, a design redesign, or a dialog rewrite.

## Product Result

After execution:

- every ToolDrawer field that Bob compiles has both stencil and spec;
- dead `textrename` code and the unused Toggle hydrator no longer ship;
- six dropdown controls and Bulk Edit's copied upload trigger use native
  buttons instead of fake button divs;
- dropdown-actions has one honest product behavior: choose an action and apply
  it immediately;
- Repeater and Object Manager remain distinct products with exact dependencies;
- unfamiliar icon actions can show the same accessible tooltip on hover and
  keyboard focus;
- Roma and DevStudio have small shared field/table visual contracts ready for
  their owning 126M and 126L slices;
- dialog lifecycle is corrected once in 126K, not partially patched here.

The user-visible improvement is straightforward: controls behave like their
native platform controls, keyboard behavior is predictable, icon actions are
understandable, and missing component contracts fail during compilation rather
than producing an incomplete Builder.

## Authority Gate

| Concern | Authority |
| --- | --- |
| Component source | `dieter/components/**` |
| Shared component CSS | `dieter/styles.css` compiled by Bob/Roma |
| Component hydration | Explicit source hydrators called by Bob |
| ToolDrawer stencil/spec loading | `bob/lib/compiler/stencils.ts` |
| Bob compiled panel HTML | Widget artifact generator plus Bob compiler |
| DevStudio component inventory | `admin/scripts/generate-static-registries.mjs` and generated `admin/src/data/**` |
| Blocking dialog lifecycle | 126K exclusively |
| DevStudio adoption | 126L |
| Roma field/table adoption | 126M |
| Runtime/deploy | Git-connected Bob, Roma, and DevStudio Pages builds |
| Product data | Out of scope; no account instance is mutated |

## Current Source Proof

The Step-6 audit proves:

- 25 source directories including `shared`;
- 24 CSS-backed source components and 20 source hydrators;
- 22 DevStudio specs, 23 templates, and 24 CSS sources;
- `textrename` has no product consumer;
- `toggle.ts` ships custom Enter behavior for a native checkbox but is not an
  active exported/hydrated product contract;
- the local component loader can return no spec although every caller is a
  ToolDrawer field;
- all component-typed fields currently used by the eight widget specs resolve
  to existing Dieter specs, so making spec loading fail closed does not preserve
  or invent an optional field lane;
- six dropdown templates use `div role="button"` and Bulk Edit creates a seventh
  copy dynamically;
- DevStudio currently exposes 3 foundation, 22 component, and 2 Policy routes,
  while its route contract test still asserts 20 component and 1 Policy route;
  the fixture omits `agent-activity`, `textedit`, and `llm-management`;
- dropdown-actions has an unreachable apply/cancel workflow;
- Repeater and Object Manager are active, distinct workflows;
- Object Manager accumulates backdrop listeners, but 126K owns that lifecycle
  repair;
- Roma repeats native-field/table appearance and current icon-only actions lack
  one designed hover/focus tooltip contract.

Expected inventory after 126I source changes:

- 26 source directories including `shared`: delete `textrename`; add
  `operational-table` and `tooltip`;
- 25 CSS-backed source components;
- 18 source hydrators;
- 22 DevStudio specs, 22 templates, and 26 CSS sources;
- 22 DevStudio component routes, unchanged. The stale 20-route test fixture is
  corrected to the generated source truth together with the stale 1-route
  Policy fixture; the resulting inventory remains 3 foundation, 22 component,
  and 2 Policy routes. No route is added or deleted.

These counts describe different inventories and must stay qualified.

## Settled Component Law

### ToolDrawer Contracts Fail Closed

`loadComponentStencil(type)` is used only for ToolDrawer fields. A field without
its spec is incomplete. HTML failure and spec failure therefore use the same
fail-closed rule:

- missing stencil source throws;
- missing spec source throws;
- no empty/default context substitutes for a missing spec;
- CSS-only presentation primitives do not call this loader and do not need fake
  specs.

### Native Controls Stay Native

- dropdown triggers are `<button type="button">`;
- native button click, Enter, and Space activation are browser-owned;
- shared dropdown code must not add synthetic Enter/Space activation;
- Toggle keeps its native checkbox HTML/CSS/spec and uses native Space
  activation; `toggle.ts` is deleted, not replaced;
- CSS may neutralize native button appearance only enough to preserve the
  current visual design.

### One Dropdown-Actions Workflow

Dropdown Actions is an immediate-choice listbox. The apply/cancel footer,
pending value, preview/revert path, and Bob's empty template fields are deleted.
No second variant or compatibility branch survives.

### Repeater And Object Manager Remain Distinct

- Object Manager manages top-level objects in a blocking dialog.
- Repeater edits nested collection items inline and supports reorder/remove.
- Shared CSS comes from `dieter/styles.css`.
- Nested controls are hydrated through Bob's explicit source-hydration
  callback.
- Nested ToolDrawer fields continue to be collected recursively by Bob; no
  manifest guesses possible nested fields.
- 126K applies Object Manager tooltip markup during the one dialog rewrite.

### Two Small CSS Contracts

126I adds CSS only:

- `operational-table`: table width, neutral borders, header surface, cell
  alignment, and horizontal overflow shell;
- `tooltip`: a short label from `data-tooltip`, visible on hover and
  `:focus-visible`, while `aria-label` remains the accessible name.

The public selectors are fixed:

- `.diet-operational-table` is the horizontal-overflow wrapper and
  `.diet-operational-table__table` goes on its semantic `<table>`;
- `.diet-tooltip` goes on the positioned icon-action control and reads its
  visual label from `data-tooltip`.

Contract rules:

- no React/Vue component;
- no form state, validation, table data, sorting, or pagination API;
- no tooltip JS, portal, registry, timing engine, or product-copy ownership;
- native `title` is removed where the designed tooltip is adopted;
- `data-tooltip` and `aria-label` carry the same action name;
- tooltip content must not change layout or intercept pointer input.

The CSS-only contracts have no ToolDrawer spec/template/JS and therefore add no
DevStudio showcase route.

### Dialog Ownership Does Not Split

126I does not alter Bulk Edit or Object Manager dialog close/focus/backdrop
lifecycle. 126K exclusively implements accepted D1 law:

- unchanged dialog: Escape, Cancel, or close button closes;
- dirty dialog: those actions open discard confirmation;
- backdrop never dismisses;
- Save applies local edits to Bob's working state;
- initial focus, focus containment, return focus, inertness, and scroll lock are
  correct;
- Object Manager's accumulating backdrop listener is deleted.

126I may change only Bulk Edit's dynamically created dropdown-upload trigger
from fake div to native button. It must not touch that file's dialog lifecycle.

## Execution Slices

Execute in order. A slice does not advance until its focused checks are green.

### Slice I1 - Fail Closed And Delete Dead Surface

1. Make `ComponentStencil.spec` required and have the existing local artifact
   generator read it directly. Missing source then fails the existing build
   through normal filesystem behavior; do not add another validator.
2. Delete `dieter/components/textrename/`.
3. Delete all active exports, imports, hydration calls, and style imports for
   `textrename`.
4. Regenerate DevStudio registries; do not hand-edit generated inventories.
5. Delete `dieter/components/toggle/toggle.ts` and all custom Toggle hydration
   exports/calls; keep Toggle HTML/CSS/spec.

Green gate:

- missing ToolDrawer spec throws;
- `pnpm validate:widgets` compiles all eight current widget contracts with the
  fail-closed spec rule;
- repository search finds no `textrename` or `hydrateTextrename` in active
  source/generated registries;
- Toggle remains visible and toggles with native pointer and Space behavior;
- source contains Toggle CSS but no custom Toggle hydrator.

### Slice I2 - Native Dropdowns And One Action Workflow

1. Convert the trigger to `<button type="button">` in:
   `dropdown-actions`, `dropdown-border`, `dropdown-edit`, `dropdown-fill`,
   `dropdown-shadow`, and `dropdown-upload` templates.
2. Remove `role="button"` and any tabindex used only to imitate a button.
3. Add the minimal native appearance reset to each owning CSS selector while
   preserving size, typography, alignment, and visual state.
4. Convert Bulk Edit's dynamically created dropdown-upload trigger in
   `bulk-edit.ts` to the same native markup. Do not edit dialog lifecycle.
5. Convert the two FAQ nested editor-template copies of the dropdown-edit
   trigger in `tokyo/product/widgets/faq/spec.json`; this file is their source
   authority.
6. Delete dropdown-actions footer markup/CSS, `data-apply-actions`, pending
   state, apply/cancel handlers, preview/revert functions, and dead branches.
7. Delete `applyActions`, `applyLabel`, and `cancelLabel` from Bob compiler
   context construction.
8. Update `e2e/widgets/prd106f-builder-certification.spec.ts` so it asserts
   native button elements rather than the legacy `role="button"` contract.
9. Use direct read-only browser verification for the changed controls. Do not
   add another E2E suite or package command. Browser verification may change
   local unsaved UI state but must not click Bob Save, publish, or call a
   product mutation route.

Green gate:

- no targeted trigger contains `div role="button"`;
- click, Enter, and Space open each dropdown once;
- Escape/outside-click behavior remains owned by the existing popover helper;
- dropdown-actions emits the selected value immediately and has no footer or
  pending path;
- current Builder certification no longer tests the deleted fake-button shape.

### Slice I3 - Small Shared Visual Contracts

1. Add the three CSS-only component directories and files.
2. Adopt tooltip on `bob/components/TdMenu.tsx`: keep `aria-label`, add the
   tooltip class/data, and remove native `title`.
3. Adopt tooltip on Repeater reorder, move, and remove icon buttons in
   `repeater.html` and `repeater.js`; keep the accessible label and update the
   tooltip whenever a dynamic label changes.
4. Do not edit Object Manager tooltip markup here. 126K owns it with the dialog
   rewrite.
5. Confirm the source CSS entrypoint and explicit Bob hydration cover the new
   markup. Do not add a dependency manifest or per-control media list.

Green gate:

- source CSS and explicit hydration cover each adopted component;
- no dependency manifest or recursive media resolver is added;
- TdMenu and Repeater tooltips appear on hover and keyboard focus without a
  native `title`, preserve the same `aria-label`, and do not capture clicks;
- table and tooltip CSS contains visual rules only;
- no tooltip runtime, form framework, or table framework exists.

### Slice I4 - Reconcile, Deploy, Verify

1. Regenerate DevStudio static registries/pages through the existing generator,
   including Repeater's page after its tooltip markup changes.
2. Update living documentation counts and contract descriptions.
3. Run source checks and focused Bob, Roma, and DevStudio builds.
4. Commit source and generated Admin files.
5. Push the exact commit only after all local gates pass.
6. Verify the Git-connected `bob-dev` Pages deployment for the Bob source
   changes, the Roma Pages deployment because Roma consumes the Bob workspace
   package, and the DevStudio Pages deployment for Admin changes at the same
   source SHA.
7. Run browser evidence on DevStudio dropdown routes and authenticated Roma
   Builder without mutating account product data.

Green gate:

- source, generated DevStudio pages, deployed apps, and browser evidence
  reconcile;
- no legacy trigger/footer/hydrator path survives;
- no account or R2 mutation and no alternate deploy path was used.

## Exact Edit And Deletion Map

| Area | Exact files | Required change |
| --- | --- | --- |
| Component spec authority | `bob/lib/compiler/stencils.ts`; `scripts/widgets/generate-artifacts.ts` | Require the spec in the existing type/loader; delete empty dropdown-actions context fields. |
| Dead component | `dieter/components/textrename/textrename.css`; `.html`; `.ts`; `dieter/components/index.ts`; `admin/src/main.ts` | Delete component, export, import, and hydration. |
| Native Toggle | `dieter/components/toggle/toggle.ts` | Delete custom hydrator only. |
| Six dropdown templates/CSS | `dieter/components/dropdown-{actions,border,edit,fill,shadow,upload}/` owning `.html` and `.css` | Use native buttons and preserve appearance. |
| Bulk Edit copied trigger | `dieter/components/bulk-edit/bulk-edit.ts` | Change only dynamically created upload trigger markup. |
| FAQ nested copies | `tokyo/product/widgets/faq/spec.json` | Use native dropdown-edit buttons in both nested editor templates; regenerate widget artifacts. |
| Dropdown Actions dead branch | `dieter/components/dropdown-actions/dropdown-actions.{html,css,ts}`; `bob/lib/compiler/stencils.ts` | Delete apply/cancel/footer/pending workflow completely. |
| Source consumption | `dieter/styles.css`; Bob source hydration | Ensure new component CSS and behavior are consumed directly; do not add a manifest. |
| CSS contracts | `dieter/components/operational-table/operational-table.css`; `dieter/components/tooltip/tooltip.css` | Add two CSS-only primitives. |
| Tooltip adoption | `bob/components/TdMenu.tsx`; `bob/app/layout.tsx`; `dieter/components/repeater/repeater.{html,js}` | Replace native title/ad hoc names with shared hover/focus visual contract while keeping ARIA names. |
| Generated Admin inventories/pages | `admin/src/data/componentRegistry.generated.ts`; `admin/src/data/showcase.generated.ts` only if generator output changes it; `admin/src/html/components/dropdown-{actions,border,edit,fill,shadow,upload}.html`; `admin/src/html/components/repeater.html` | Regenerate from source, never hand-edit. |
| E2E/browser | `e2e/devstudio/route-contract.spec.ts`; `e2e/widgets/prd106f-builder-certification.spec.ts`; direct read-only browser evidence | Correct the stale DevStudio fixture to 3 foundation, 22 component, and 2 Policy routes by adding `agent-activity`, `textedit`, and `/#/policy/llm-management` with exact heading `LLM Management`; replace stale fake-button assertions in the broad suite; do not add another E2E suite. |
| Living docs | `documentation/engineering/UI/components.md`; `documentation/engineering/UI/dieter.md`; `documentation/engineering/UI/accessibility.md`; `documentation/widgets/authoring/ToolDrawerControls.md`; `documentation/services/bob.md`; `documentation/services/devstudio.md` | Record qualified inventories, required spec law, native trigger/Toggle law, one dropdown-actions workflow, exact dependencies, and 126K/L/M handoffs. |

Execution-start grep must confirm each generated/doc file before edit. Files with
no current affected statement are recorded as checked and left unchanged.

## Explicit 126K, 126L, And 126M Handoffs

126K owns:

- all Bulk Edit/Object Manager dialog lifecycle and listener cleanup;
- Object Manager icon tooltip markup;
- blocking-dialog shadow/layer/width decisions and dialog browser tests.

126L owns:

- adoption of existing Dieter input components plus table/tooltip in matching
  DevStudio operational screens;
- all later DevStudio visual work inherits 126I's corrected 22-route generated
  component baseline and complete 3/22/2 generated route inventory; 126L does
  not create a second route inventory;
- no duplicate DevStudio-only version of those visual contracts.

126M owns:

- replacement of Roma `.roma-input`, `.roma-select`, and `.roma-table` visual
  duplication with the new CSS contracts;
- deletion of dead `.widget-defaults-*` control CSS;
- Roma layout links/imports and browser verification.

## Verification Matrix

### Focused Commands

```bash
pnpm --filter @clickeen/bob typecheck
pnpm validate:widgets
pnpm --filter @ck/dieter typecheck
pnpm dieter:governance:check
pnpm --filter @clickeen/devstudio typecheck
pnpm --filter @clickeen/devstudio build
pnpm --filter @clickeen/roma lint
E2E_BASE_URL=https://devstudio.clickeen.com E2E_AUTH_STATE=e2e/.auth/devstudio.json pnpm exec playwright test e2e/devstudio/route-contract.spec.ts
```

The DevStudio command requires a valid `e2e/.auth/devstudio.json` produced by
the real Berlin -> DevStudio login/session-finish path. Roma's
`e2e/.auth/roma-dev.json` is host-scoped to `.dev.clickeen.com` and must not be
substituted. Missing or expired DevStudio auth keeps the browser gate RED.

### Static Proof

- no active `textrename`/`hydrateTextrename`;
- all eight current widget contracts compile with every component-typed field
  resolving both stencil and spec;
- no custom Toggle hydrator;
- no targeted `role="button"` trigger;
- no dropdown-actions apply/cancel/pending path;
- source and DevStudio inventories match the qualified expected counts;
- three new contracts contain CSS only;
- no tooltip `title` remains on adopted actions;
- 126K-owned dialog lifecycle remains untouched in 126I.

### Browser Proof

- DevStudio's generated 3 foundation, 22 component, and 2 Policy routes,
  including `agent-activity`, `textedit`, and `llm-management`, remain live with
  no console errors;
- all six native dropdown triggers activate through click, Enter, and Space;
- dropdown-actions commits immediately and renders no footer;
- native Toggle changes through pointer and Space without custom Toggle JS;
- TdMenu and Repeater tooltips appear on hover and focus, retain accessible
  names, fit their container, and do not intercept commands;
- authenticated Roma Builder opens its existing instances and exercises the
  changed Bob controls without Save, publish, or product mutation. The broad
  PRD106F suite is updated for the native markup but is not the 126I remote-data
  proof because it owns separate save/restore certification.

### Deploy Proof

- exact source SHA recorded;
- `bob-dev`, Roma, and DevStudio Pages deployments reconciled to that source
  SHA;
- no Dieter component/token/editor objects are deployed or mutated in R2.

## V1-V8 Controls

| ID | Failure mode | Required control |
| --- | --- | --- |
| V1 Silent substitution | Missing spec becomes empty defaults. | Missing local ToolDrawer spec source throws. |
| V2 Silent healing | Native values/labels are normalized while changing controls. | Preserve current authored values and labels; change semantics only where named. |
| V3 Silent omission | Bulk Edit's copied trigger, generated registries, or browser assumptions are missed. | Execute the exact map and reconcile source, generated, deployed, and browser inventories. |
| V4 Fail-open control | Missing spec or hydrator silently produces an incomplete control. | Bob compiler fails missing required specs and explicit hydration remains complete. |
| V5 Corruption-as-absence | Invalid component data is treated as missing/default. | No persisted data path changes; existing component validation remains. |
| V6 Partial-success masquerade | Local deletion is called complete while affected app builds remain unverified. | Require exact-SHA Pages evidence; 126G already deleted the old R2 component-delivery lane. |
| V7 Masquerade/redress | Dead code survives behind a rename, wrapper, or compatibility branch. | Delete textrename, Toggle JS, fake triggers, and dead action workflow outright. |
| V8 Runtime test dependency | Product behavior depends on the tests. | Native HTML/CSS/runtime source owns behavior; checks only verify it. |

## No-Touch Boundary

- no account product data or instance save/publish;
- no Tokyo product-operation, translation, Berlin, San Francisco, policy, or
  entitlement change;
- no dialog lifecycle edit outside 126K;
- no Roma/DevStudio screen adoption outside 126L/126M;
- no generated Dieter output, manifest, or compatibility bundle;
- no component framework, form engine, table engine, tooltip runtime, modal
  registry, JS-to-TS migration, compatibility path, or new deploy lane.

## Step-9 Execution Evidence

- Source commits: `e40f565d`, `0a96cbf9`, `3062671a`, and `fda75fc4`.
- Net 126I source/documentation result: 322 additions and 655 deletions.
- `textrename`, custom Toggle hydration, fake dropdown triggers, and the dead
  dropdown-actions apply/cancel workflow are deleted.
- The only new contracts are CSS-only table and tooltip source. No test,
  validator, manifest, probe, framework, portal,
  observer, timer, or runtime subsystem was added.
- Widget validation, Dieter governance/typecheck, Bob lint/typecheck/build,
  Roma lint/typecheck/Cloudflare build, and DevStudio
  lint/typecheck/functions/build are GREEN.
- DevStudio local route proof passed 26 of 27 routes; the sole local failure was
  the temporary static server lacking `/dieter/icons/svg/photo.svg`, not a
  component failure.
- Exact source SHA `fda75fc4e1e3af023e4dfb0fddc486312c9d3fd0`
  deployed successfully to `bob-dev`, `roma-dev`, and `devstudio`.
  Cloudflare Pages deployment ids are
  `caa8f645-0450-487b-a073-c92a0513c9ac`,
  `0bb6e0d2-bbbf-4aa2-b423-778cef8f6ab0`, and
  `ffee3b0d-bace-4ad3-bbb1-54dd026ef0b1`.
- GitHub Actions runs `30264274921`, `30264274951`, and `30264848542`
  completed successfully for Roma verification, Worker/product-root deploy,
  and final surface reachability.
- Deployed read-only browser proof used Berlin dev-admin -> DevStudio
  session-finish, traversed the generated 3 Foundation, 22 Component, and 2
  Policy routes in one live session, and verified tooltip name, focus/hover
  visibility, absent native title, and `pointer-events: none`.
- No account instance, account asset, translation, policy, entitlement,
  Supabase, or direct R2 product data mutation occurred.
- Independent slice and whole-PRD reviews passed V1-V8.

## Step-8 Review Questions

1. Does every deletion have a complete source/generated/test/doc/deploy blast
   radius?
2. Is any non-ToolDrawer component accidentally forced to add a spec?
3. Do all native trigger sites, including Bulk Edit's dynamic copy, converge
   without synthetic keyboard code?
4. Is dropdown-actions truly immediate everywhere after the dead branch is
   removed?
5. Are Repeater/Object Manager dependencies exact and non-recursive?
6. Are the three CSS contracts small enough to avoid a framework while serving
   immediate 126L/126M product work?
7. Is 126K the sole owner of dialog lifecycle and listener cleanup?
8. Can the exact-SHA deployment prove remote deletion rather than assuming it?
