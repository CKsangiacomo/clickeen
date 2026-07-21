# 126I - Current-Source Pre-Execution Audit: Components

Status: PRE-EXECUTION STEPS 6-8 COMPLETE - current component source, Bob
compilation, generated DevStudio inventory, and app consumers audited; exact
PRD reviewed GREEN at `22a92ec9`; no Step-9 execution credit.
PRD: `../126I__PRD__Components.md`.

## Audit Question

What does the current component system actually ship, where does it diverge
from accepted 126 product law, and which exact owner must change each gap without
creating a component framework or overlapping the dialog, DevStudio, and Roma
slices?

## Authority Map

| Authority | Current owner |
| --- | --- |
| Component source | `dieter/components/**` |
| Component build and manifest | `scripts/build-dieter.js` |
| ToolDrawer stencil/spec loading | `bob/lib/compiler/stencils.ts` |
| ToolDrawer media dependency expansion | `bob/lib/compiler/media.ts` plus generated `manifest.json` |
| DevStudio component inventory/pages | `admin/scripts/generate-component-pages.ts`, `admin/scripts/generate-static-registries.mjs`, generated `admin/src/**` |
| Blocking dialog lifecycle | 126K, using component-local state callbacks; not 126I |
| DevStudio adoption | 126L |
| Roma operational-field/table adoption | 126M |
| Generated/deployed Dieter authority | 126G build-before-sync path |
| One-time stale product-root cleanup | Approved repo Cloudflare R2 delete command after `pnpm cf:preflight`, limited to deleted `textrename` CSS/HTML/JS and `toggle.js`. |

## Current Inventory

Current source has 25 directories under `dieter/components/**`, including the
non-rendered `shared/` helper directory. The current generated manifest has 24
CSS-backed components and 20 JS-backed components. DevStudio's generated
registry has 22 specs, 23 templates, and 24 CSS sources. DevStudio routing
exposes 3 foundation, 22 component, and 2 Policy routes, but the route-contract
test still lists only 20 component and 1 Policy route, omitting
`agent-activity`, `textedit`, and `llm-management`. These are different
inventories and must never be reported as one unqualified component count.

After the accepted deletion/addition work, the expected inventories are:

- 27 source directories including `shared`: delete `textrename`, add the three
  CSS-only `operational-field`, `operational-table`, and `tooltip` contracts;
- 26 CSS-backed manifest components;
- 18 JS-backed manifest components: `textrename` is gone and Toggle is native;
- 22 DevStudio specs, 22 templates, and 26 CSS sources;
- the DevStudio route count remains 22 because the three new visual primitives
  are named CSS-only contracts rather than ToolDrawer showcases. Execution
  corrects the stale test to the complete 3 foundation / 22 component / 2
  Policy route truth without changing product routes.

## Proven Gaps

### Required ToolDrawer specs currently fail open

`bob/lib/compiler/stencils.ts:65-96` returns `spec?: ComponentSpec` and treats a
404 spec as valid. Every call to `loadComponentStencil()` is for a ToolDrawer
field, including nested fields (`bob/lib/compiler.server.ts:264-288` and
`bob/lib/compiler/stencils.ts:142-159`). Presentation-only primitives such as
`icon` never use this loader. Therefore a missing ToolDrawer spec is not an
optional product state; it is an incomplete field contract and must throw.

The component-typed fields currently present across all eight widget specs are
`bulk-edit`, `button`, `choice-tiles`, `dropdown-actions`, `dropdown-border`,
`dropdown-edit`, `dropdown-fill`, `dropdown-shadow`, `object-manager`,
`repeater`, `segmented`, `slider`, `textfield`, `toggle`, and `valuefield`.
Every one has an existing Dieter spec. The execution gate must still run the
all-widget compiler matrix after the loader becomes strict so this source proof
cannot drift silently.

### `textrename` is dead shipped surface

The only active references are its three source files, the export in
`dieter/components/index.ts:18`, DevStudio's import/call in
`admin/src/main.ts:23,262`, and generated registry entries in
`admin/src/data/componentRegistry.generated.ts`. No widget, Bob surface, Roma
surface, or product route consumes it. Adding a spec would preserve dead code.
The correct action is deletion and regeneration.

### Toggle ships unnecessary custom behavior

`dieter/components/toggle/toggle.ts` adds Enter-key behavior to a native
checkbox. It is not exported or directly hydrated by DevStudio, but the Dieter
builder bundles every matching component entry file, so it still appears in the
runtime manifest. The supported contract is the existing checkbox HTML, CSS,
and spec. Delete only the TS hydrator; do not replace native behavior.

### Six dropdown components use fake buttons, and Bulk Edit copies one

The trigger in each of `dropdown-actions`, `dropdown-border`, `dropdown-edit`,
`dropdown-fill`, `dropdown-shadow`, and `dropdown-upload` is a `div` with
`role="button"`. `dieter/components/bulk-edit/bulk-edit.ts:439-445` duplicates
the dropdown-upload trigger markup dynamically, so converting only the six
source templates would leave Bulk Edit on the old interaction contract. All
seven markup sites must use native `button type="button"`; the six component CSS
rules must neutralize native appearance while preserving current visuals.

`dieter/components/shared/dropdownToggle.ts:43-50` already binds click and does
not add synthetic Enter/Space handlers. Native button activation therefore does
not require another keyboard program.

### `dropdown-actions` carries a dead second workflow

Bob hardcodes `applyActions`, `applyLabel`, and `cancelLabel` to empty strings at
`bob/lib/compiler/stencils.ts:283-285`. The component spec exposes no apply
variant. The HTML footer at `dropdown-actions.html:77-96`, CSS footer rules at
`dropdown-actions.css:95-105`, and pending/apply/cancel state in
`dropdown-actions.ts:3-28,49-79,96-113,184-269` are therefore unreachable. The
surviving product is immediate choice selection in a listbox.

### Repeater and Object Manager need exact dependencies, not consolidation

They are different active workflows. Repeater edits nested items inline;
Object Manager adds top-level objects and manages reorder/delete in a blocking
dialog. Current manifest dependencies in `scripts/build-dieter.js:81-92` omit
both.

- Object Manager's own stencil uses Dieter buttons, so its static dependency is
  `button` (and `tooltip` once its icon actions adopt that contract).
- Repeater's own stencil uses `button`, `textfield`, and `toggle`, and its icon
  actions adopt `tooltip`.
- Arbitrary nested ToolDrawer fields are already recursively collected by
  `bob/lib/compiler.shared.ts:35-45`; they must not be duplicated into a broad
  guessed dependency list.

No JS-to-TS rewrite or merged collection component has a product reason.

### Object Manager and Bulk Edit dialog behavior belongs to 126K

Object Manager adds a new backdrop listener every time it opens at
`object-manager.js:339-399`; backdrop click also dismisses it. It lacks Escape,
initial focus, focus containment, return focus, parent inertness, scroll lock,
and dirty-discard behavior. Bulk Edit closes unconditionally on Escape, Cancel,
close, and backdrop at `bulk-edit.ts:329-376`; it also lacks the full blocking
lifecycle.

Accepted D1 law requires a single correction, not a temporary 126I listener
patch followed by a 126K rewrite. 126K is the exclusive write owner for dialog
lifecycle in these two component files. Its rewrite must delete the accumulating
listener and implement unchanged/dirty dismissal against component-local
working state. 126I records and verifies that handoff but does not duplicate it.

### Three small visual contracts are missing

Roma currently repeats one bordered native-field look in `.roma-input` and has
two unstyled `.roma-select` consumers. Nine current tables use `.roma-table` and
repeat width, collapse, neutral borders, header surface, cell alignment, and a
mobile overflow rule (`roma/app/roma.css:611-669,756-759`). Those reusable visual
decisions belong in Dieter; labels, values, layout, data, and behavior remain in
Roma.

Current icon-only controls use either native `title` (`bob/components/TdMenu.tsx:60-73`,
Repeater source) or only an accessible name (Object Manager). Clickeen needs a
small CSS tooltip that appears on hover and keyboard focus while `aria-label`
continues to name the control. It does not need a tooltip runtime or portal.

The correct source additions are three CSS-only, non-ToolDrawer contracts:

- `dieter/components/operational-field/operational-field.css`;
- `dieter/components/operational-table/operational-table.css`;
- `dieter/components/tooltip/tooltip.css`.

126I creates and documents them. 126L applies them only where DevStudio has a
matching operational surface. 126M replaces Roma's duplicated field/table
appearance and adds the corresponding layout links. No React component or form/
table framework is introduced.

## Exact Step-7 Disposition

| Area | Disposition | Owner boundary |
| --- | --- | --- |
| Required ToolDrawer spec | Make 404 a compiler failure; add a focused Bob contract test. | 126I direct. Presentation-only primitives never call the loader. |
| `textrename` | Delete source/export/DevStudio hydration, regenerate Admin inventories, then delete its three exact stale R2 files after the upload-only deploy. | 126I direct. Source/build cannot recreate it; approved one-time R2 cleanup proves remote absence. |
| Toggle | Delete only `toggle.ts`; keep HTML/CSS/spec. | 126I direct. |
| Dropdown triggers | Native buttons in six templates and Bulk Edit's dynamic upload markup; preserve appearance and current popover semantics. | 126I direct. 126K later corrects listbox/dialog semantics. |
| `dropdown-actions` | Delete footer markup/CSS, pending state/functions, and Bob's empty compiler fields. | 126I direct. |
| Manifest deps | Add exact Object Manager/Repeater dependencies. | 126I direct in `scripts/build-dieter.js`. |
| Field/table/tooltip | Add three CSS-only Dieter contracts; apply tooltip to Bob TdMenu and Dieter Repeater icon actions; regenerate Repeater's Admin page. | 126I source; 126K owns Object Manager adoption with its dialog rewrite; 126L/126M own app adoption. |
| DevStudio route baseline | Update the stale route-contract fixture to 3 foundation, 22 component, and 2 Policy routes by adding `agent-activity`, `textedit`, and `/#/policy/llm-management` with exact heading `LLM Management`. Run it with a real host-scoped DevStudio auth state. | 126I verification correction; no product route change, no Roma-auth substitution, and no second inventory in 126L. |
| Pages deployment | Verify the `bob-dev`, Roma, and DevStudio Git-connected Pages deployments at the exact source SHA. | 126I deployment proof; Bob is not masqueraded as part of Roma. |
| Bulk Edit/Object Manager lifecycle | Delete listener accumulation and implement D1 lifecycle once. | 126K exclusive write owner. |
| Dialog shadow/z-index/width | Preserve until 126K resolves the exact blocking-dialog layer. | No 126I token or visual redesign. |

## V1-V8 Pre-Execution Result

| ID | Result | Evidence/control |
| --- | --- | --- |
| V1 Silent substitution | OPEN UNTIL STEP 9 | Required ToolDrawer spec absence must throw; no default context may substitute for a missing contract. |
| V2 Silent healing | PASS | No persisted data is normalized or rewritten by 126I. |
| V3 Silent omission | OPEN UNTIL STEP 9 | Dynamic Bulk Edit markup, all-widget fail-closed compilation, Repeater's generated page, the full 3/22/2 route fixture, host-correct DevStudio auth, all three affected Pages deployments, generated Admin registries/pages, exact deps, four stale R2 objects, and all living-doc counts are explicitly included. |
| V4 Fail-open control | OPEN UNTIL STEP 9 | Compiler spec 404 and manifest dependency failures must remain fail-closed. |
| V5 Corruption-as-absence | PASS | 126I does not read or mutate persisted product data. |
| V6 Partial-success masquerade | OPEN UNTIL STEP 9 | Dieter source, generated output, Bob/DevStudio consumers, `bob-dev`/Roma/DevStudio Pages, deploy, and browser behavior all have named evidence. |
| V7 Masquerade/redress | OPEN UNTIL STEP 9 | Dead components/branches are deleted, not renamed or wrapped; native behavior replaces custom imitation. |
| V8 Runtime test dependency | PASS | Native controls and CSS/runtime source carry behavior; tests only verify it. |

## No-Touch Boundary

- No product data, account routes, translations, policy, Berlin, San Francisco,
  or Tokyo product-operation code.
- No component framework, React wrapper library, form abstraction, table data
  abstraction, tooltip runtime, modal registry, or JS-to-TS migration.
- No app-wide Roma/DevStudio restyle in 126I.
- No direct edit of ignored `tokyo/product/dieter/**` output.
- No general R2 reconciliation or account-data mutation. After exact-SHA deploy,
  delete and verify only the four obsolete Dieter product-root objects named by
  the PRD; upload-only sync cannot prove remote deletion.
- No dialog lifecycle edit outside the 126K-owned slice.
