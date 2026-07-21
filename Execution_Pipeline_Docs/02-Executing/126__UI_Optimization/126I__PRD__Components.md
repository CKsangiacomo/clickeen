# 126I - PRD: Components

Status: PRE-EXECUTION STEPS 6-7 COMPLETE - current source and exact execution
scope are pinned; fresh exact-tree Step-8 review pending; no Step-9 execution
credit.
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA).
Series order: 126I of 126A-126M.
KB doc: `documentation/engineering/UI/components.md`.
Audit: `audits/126I__Audit__Components.md`.

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
| Component build and dependency manifest | `scripts/build-dieter.js`, under 126G build/deploy law |
| ToolDrawer stencil/spec loading | `bob/lib/compiler/stencils.ts` |
| Bob component media expansion | `bob/lib/compiler/media.ts` plus generated Dieter manifest |
| DevStudio component inventory | `admin/scripts/generate-static-registries.mjs` and generated `admin/src/data/**` |
| Blocking dialog lifecycle | 126K exclusively |
| DevStudio adoption | 126L |
| Roma field/table adoption | 126M |
| Runtime/deploy | Git-connected Pages and the 126G exact-SHA Worker/R2 path |
| Product data | Out of scope; no account instance is mutated |

## Current Source Proof

The Step-6 audit proves:

- 25 source directories including `shared`;
- 24 CSS-backed manifest components and 20 JS-backed components;
- 22 DevStudio specs, 23 templates, and 24 CSS sources;
- `textrename` has no product consumer;
- `toggle.ts` ships custom Enter behavior for a native checkbox but is not an
  active exported/hydrated product contract;
- `loadComponentStencil()` treats spec 404 as optional although every caller is
  a ToolDrawer field;
- all component-typed fields currently used by the eight widget specs resolve
  to existing Dieter specs, so making spec loading fail closed does not preserve
  or invent an optional field lane;
- six dropdown templates use `div role="button"` and Bulk Edit creates a seventh
  copy dynamically;
- dropdown-actions has an unreachable apply/cancel workflow;
- Repeater and Object Manager are active, distinct workflows whose static
  dependencies are missing from the manifest;
- Object Manager accumulates backdrop listeners, but 126K owns that lifecycle
  repair;
- Roma repeats native-field/table appearance and current icon-only actions lack
  one designed hover/focus tooltip contract.

Expected inventory after 126I source changes:

- 27 source directories including `shared`: delete `textrename`; add
  `operational-field`, `operational-table`, and `tooltip`;
- 26 CSS-backed manifest components;
- 18 JS-backed manifest components;
- 22 DevStudio specs, 22 templates, and 26 CSS sources;
- 20 DevStudio component routes, unchanged.

These counts describe different inventories and must stay qualified.

## Settled Component Law

### ToolDrawer Contracts Fail Closed

`loadComponentStencil(type)` is used only for ToolDrawer fields. A field without
its spec is incomplete. HTML failure and spec failure therefore use the same
fail-closed rule:

- non-2xx stencil response throws;
- non-2xx spec response, including 404, throws;
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
- Object Manager's 126I static dependency is `button`.
- Repeater's 126I static dependencies are `button`, `textfield`, `toggle`, and
  `tooltip`.
- nested ToolDrawer fields continue to be collected recursively by Bob; the
  manifest does not guess every possible nested field.
- 126K adds Object Manager's `tooltip` dependency when it applies tooltip
  markup during the one dialog rewrite.

### Three Small CSS Contracts

126I adds CSS only:

- `operational-field`: the shared visual base for ordinary operational
  `input`/`select` controls;
- `operational-table`: table width, neutral borders, header surface, cell
  alignment, and horizontal overflow shell;
- `tooltip`: a short label from `data-tooltip`, visible on hover and
  `:focus-visible`, while `aria-label` remains the accessible name.

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

1. Change `bob/lib/compiler/stencils.ts` so any failed spec response, including
   404, throws a component-spec error.
2. Add `bob/tests/run-component-contracts.ts` and a focused Bob package command
   proving successful HTML+spec load and fail-closed spec 404.
3. Delete `dieter/components/textrename/`.
4. Delete its export from `dieter/components/index.ts`.
5. Delete its import and hydration call from `admin/src/main.ts`.
6. Regenerate DevStudio registries; do not hand-edit generated inventories.
7. Delete `dieter/components/toggle/toggle.ts`; keep Toggle HTML/CSS/spec.

Green gate:

- missing ToolDrawer spec throws;
- the focused Bob contract test passes;
- `pnpm validate:widgets` compiles all eight current widget contracts with the
  fail-closed spec rule;
- repository search finds no `textrename` or `hydrateTextrename` in active
  source/generated registries;
- Toggle remains visible and toggles with native pointer and Space behavior;
- build manifest contains Toggle CSS but no Toggle JS.

### Slice I2 - Native Dropdowns And One Action Workflow

1. Convert the trigger to `<button type="button">` in:
   `dropdown-actions`, `dropdown-border`, `dropdown-edit`, `dropdown-fill`,
   `dropdown-shadow`, and `dropdown-upload` templates.
2. Remove `role="button"` and any tabindex used only to imitate a button.
3. Add the minimal native appearance reset to each owning CSS selector while
   preserving size, typography, alignment, and visual state.
4. Convert Bulk Edit's dynamically created dropdown-upload trigger in
   `bulk-edit.ts` to the same native markup. Do not edit dialog lifecycle.
5. Delete dropdown-actions footer markup/CSS, `data-apply-actions`, pending
   state, apply/cancel handlers, preview/revert functions, and dead branches.
6. Delete `applyActions`, `applyLabel`, and `cancelLabel` from Bob compiler
   context construction.
7. Update `e2e/widgets/prd106f-builder-certification.spec.ts` so it asserts
   native button elements rather than the legacy `role="button"` contract.
8. Add `e2e/widgets/component-contracts.spec.ts` as the focused read-only
   authenticated Builder proof. It may open existing controls and change local
   unsaved UI state, but it must not click Bob Save, publish, or call a product
   mutation route.

Green gate:

- no targeted trigger contains `div role="button"`;
- click, Enter, and Space open each dropdown once;
- Escape/outside-click behavior remains owned by the existing popover helper;
- dropdown-actions emits the selected value immediately and has no footer or
  pending path;
- current Builder certification no longer tests the deleted fake-button shape.

### Slice I3 - Exact Dependencies And Small Shared Visual Contracts

1. Add exact manifest dependencies in `scripts/build-dieter.js`:
   Object Manager -> `button`; Repeater -> `button`, `textfield`, `toggle`,
   `tooltip`.
2. Add the three CSS-only component directories and files.
3. Adopt tooltip on `bob/components/TdMenu.tsx`: keep `aria-label`, add the
   tooltip class/data, and remove native `title`.
4. Adopt tooltip on Repeater reorder, move, and remove icon buttons in
   `repeater.html` and `repeater.js`; keep the accessible label and update the
   tooltip whenever a dynamic label changes.
5. Do not edit Object Manager tooltip markup here. 126K owns it with the dialog
   rewrite and adds the corresponding manifest dependency then.
6. Add Tooltip as a Bob layout dependency and Repeater manifest dependency so
   the CSS is present where the markup is emitted.

Green gate:

- manifest dependencies are exact and all resolve;
- no guessed recursive field dependency is added;
- TdMenu and Repeater tooltips appear on hover and keyboard focus without a
  native `title`, preserve the same `aria-label`, and do not capture clicks;
- operational-field/table CSS contains visual rules only;
- no tooltip runtime, form framework, or table framework exists.

### Slice I4 - Regenerate, Reconcile, Deploy, Verify

1. Run the 126G builder. Its source-derived parity assertion must confirm the
   complete ignored Dieter output before sync.
2. Regenerate DevStudio static registries/pages through the existing generator.
3. Update living documentation counts and contract descriptions.
4. Commit source and generated Admin files, not ignored Dieter output.
5. Push the exact commit only after all local gates pass.
6. Verify the exact-SHA Workers run rebuilt/synced Dieter and read back changed
   manifest/component CSS/JS objects from canonical R2 `dieter/**`.
7. After source and manifest prove the deleted artifacts cannot be regenerated,
   run `pnpm cf:preflight` and use the approved repo R2 delete command for only:
   `dieter/components/textrename/textrename.css`,
   `dieter/components/textrename/textrename.html`,
   `dieter/components/textrename/textrename.js`, and
   `dieter/components/toggle/toggle.js`. Verify each exact key is absent. This
   is one product-root cleanup, not a general reconciliation service.
8. Verify the Roma Pages build for Bob changes and the DevStudio Pages build for
   Admin changes at the same source SHA.
9. Run browser evidence on DevStudio dropdown routes and authenticated Roma
   Builder without mutating account product data.

Green gate:

- local, generated, deployed, and browser evidence reconcile;
- deleted source does not appear in manifest or R2 output;
- no legacy trigger/footer/hydrator path survives;
- no account mutation or alternate deploy path was used; the only direct R2
  mutation is the four-key, preflighted stale product-root deletion above.

## Exact Edit And Deletion Map

| Area | Exact files | Required change |
| --- | --- | --- |
| Bob spec authority | `bob/lib/compiler/stencils.ts`; `bob/tests/run-component-contracts.ts`; `bob/package.json` | Fail spec 404; add focused test command; delete empty dropdown-actions context fields. |
| Dead component | `dieter/components/textrename/textrename.css`; `.html`; `.ts`; `dieter/components/index.ts`; `admin/src/main.ts` | Delete component, export, import, and hydration. |
| Native Toggle | `dieter/components/toggle/toggle.ts` | Delete custom hydrator only. |
| Six dropdown templates/CSS | `dieter/components/dropdown-{actions,border,edit,fill,shadow,upload}/` owning `.html` and `.css` | Use native buttons and preserve appearance. |
| Bulk Edit copied trigger | `dieter/components/bulk-edit/bulk-edit.ts` | Change only dynamically created upload trigger markup. |
| Dropdown Actions dead branch | `dieter/components/dropdown-actions/dropdown-actions.{html,css,ts}`; `bob/lib/compiler/stencils.ts` | Delete apply/cancel/footer/pending workflow completely. |
| Dependencies/build | `scripts/build-dieter.js` | Add exact Object Manager/Repeater deps; use 126G builder law. |
| CSS contracts | `dieter/components/operational-field/operational-field.css`; `dieter/components/operational-table/operational-table.css`; `dieter/components/tooltip/tooltip.css` | Add three CSS-only primitives. |
| Tooltip adoption | `bob/components/TdMenu.tsx`; `bob/app/layout.tsx`; `dieter/components/repeater/repeater.{html,js}` | Replace native title/ad hoc names with shared hover/focus visual contract while keeping ARIA names. |
| Generated Admin inventories/pages | `admin/src/data/componentRegistry.generated.ts`; `admin/src/data/showcase.generated.ts` only if generator output changes it; `admin/src/html/components/dropdown-{actions,border,edit,fill,shadow,upload}.html` | Regenerate from source, never hand-edit. |
| E2E | `e2e/devstudio/route-contract.spec.ts`; `e2e/widgets/prd106f-builder-certification.spec.ts`; new `e2e/widgets/component-contracts.spec.ts` | Preserve 20 DevStudio routes; replace stale fake-button assertions in the broad suite; add focused native activation/immediate-action/tooltip checks in a read-only Builder spec. |
| Living docs | `documentation/engineering/UI/components.md`; `documentation/engineering/UI/dieter.md`; `documentation/engineering/UI/accessibility.md`; `documentation/widgets/authoring/ToolDrawerControls.md`; `documentation/services/bob.md`; `documentation/services/devstudio.md` | Record qualified inventories, required spec law, native trigger/Toggle law, one dropdown-actions workflow, exact dependencies, and 126K/L/M handoffs. |

Execution-start grep must confirm each generated/doc file before edit. Files with
no current affected statement are recorded as checked and left unchanged.

## Explicit 126K, 126L, And 126M Handoffs

126K owns:

- all Bulk Edit/Object Manager dialog lifecycle and listener cleanup;
- Object Manager icon tooltip markup and its `tooltip` manifest dependency;
- blocking-dialog shadow/layer/width decisions and dialog browser tests.

126L owns:

- adoption of operational-field/table/tooltip in matching DevStudio operational
  screens;
- no duplicate DevStudio-only version of those visual contracts.

126M owns:

- replacement of Roma `.roma-input`, `.roma-select`, and `.roma-table` visual
  duplication with the new CSS contracts;
- deletion of dead `.widget-defaults-*` control CSS;
- Roma layout links/imports and browser verification.

## Verification Matrix

### Focused Commands

```bash
pnpm --filter @clickeen/bob test:component-contracts
pnpm --filter @clickeen/bob typecheck
pnpm validate:widgets
pnpm --filter @ck/dieter typecheck
pnpm dieter:governance:check
pnpm build:dieter
pnpm --filter @clickeen/devstudio typecheck
pnpm --filter @clickeen/devstudio build
pnpm --filter @clickeen/roma lint
E2E_BASE_URL=https://devstudio.clickeen.com pnpm exec playwright test e2e/devstudio/route-contract.spec.ts
E2E_BASE_URL=https://roma.dev.clickeen.com pnpm exec playwright test e2e/widgets/component-contracts.spec.ts
```

Use the exact package script name created in Slice I1. If an existing command
supersedes it before execution, update this PRD first; do not silently skip the
contract test.

### Static Proof

- no active `textrename`/`hydrateTextrename`;
- all eight current widget contracts compile with every component-typed field
  resolving both stencil and spec;
- no generated Toggle JS;
- no targeted `role="button"` trigger;
- no dropdown-actions apply/cancel/pending path;
- manifest counts/dependencies match the qualified expected inventory;
- three new contracts contain CSS only;
- no tooltip `title` remains on adopted actions;
- 126K-owned dialog lifecycle remains untouched in 126I.

### Browser Proof

- DevStudio's 20 existing component routes remain live with no console errors;
- all six native dropdown triggers activate through click, Enter, and Space;
- dropdown-actions commits immediately and renders no footer;
- native Toggle changes through pointer and Space without generated Toggle JS;
- TdMenu and Repeater tooltips appear on hover and focus, retain accessible
  names, fit their container, and do not intercept commands;
- authenticated Roma Builder opens its existing instances and exercises the
  changed Bob controls without Save, publish, or product mutation. The broad
  PRD106F suite is updated for the native markup but is not the 126I remote-data
  proof because it owns separate save/restore certification.

### Deploy Proof

- exact source SHA recorded;
- Workers/R2 sync run at that SHA recorded;
- canonical R2 manifest and changed component objects read back;
- Roma and DevStudio Pages builds reconciled to that source SHA;
- after the upload-only deploy is green, the four exact stale product-root keys
  are deleted through the approved repo Cloudflare command and verified absent;
  do not treat source absence as remote absence or add remote reconciliation.

## V1-V8 Controls

| ID | Failure mode | Required control |
| --- | --- | --- |
| V1 Silent substitution | Missing spec becomes empty defaults. | Any non-2xx ToolDrawer spec response throws. |
| V2 Silent healing | Native values/labels are normalized while changing controls. | Preserve current authored values and labels; change semantics only where named. |
| V3 Silent omission | Bulk Edit's copied trigger, generated registries, e2e assumptions, or four remote stale objects are missed. | Execute the exact map and reconcile source, generated, deployed, and browser inventories. |
| V4 Fail-open control | Missing spec/dependency/output warns and ships. | Bob compiler and 126G builder fail closed. |
| V5 Corruption-as-absence | Invalid component data is treated as missing/default. | No persisted data path changes; existing component validation remains. |
| V6 Partial-success masquerade | Local deletion is called complete while old R2 files or app builds remain. | Require exact-SHA R2 and Pages evidence. |
| V7 Masquerade/redress | Dead code survives behind a rename, wrapper, or compatibility branch. | Delete textrename, Toggle JS, fake triggers, and dead action workflow outright. |
| V8 Runtime test dependency | Product behavior depends on the tests. | Native HTML/CSS/runtime source owns behavior; checks only verify it. |

## No-Touch Boundary

- no account product data or instance save/publish;
- no Tokyo product-operation, translation, Berlin, San Francisco, policy, or
  entitlement change;
- no dialog lifecycle edit outside 126K;
- no Roma/DevStudio screen adoption outside 126L/126M;
- no direct edit of ignored `tokyo/product/dieter/**` output; only the four
  named obsolete remote objects may be deleted after preflight;
- no component framework, form engine, table engine, tooltip runtime, modal
  registry, JS-to-TS migration, compatibility path, or new deploy lane.

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
