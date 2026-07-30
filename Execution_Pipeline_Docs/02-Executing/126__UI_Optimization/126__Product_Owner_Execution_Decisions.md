# 126 - Product Owner Execution Decisions

Status: D1/D2/D3 ORIGINAL EXECUTION EVIDENCE PRESERVED; D4 ACCEPTED AND
IMPLEMENTED AND DEPLOYED; FINAL POPUP-WORKFLOW QA AND PRODUCT-OWNER ACCEPTANCE
PENDING.
Owner: Clickeen product owner
Date: 2026-07-14
Parent: `126__PRD__UI_Optimization_Program.md`

## Purpose

This is the finite owner-decision record produced by the renewed 126
pre-execution passes. It records the accepted choices that required product or
architecture judgment. Correctness requirements, proven dead code, and current
product law are recorded separately and are not presented as optional choices.

These accepted decisions do not start implementation. They completed Phase 1
step 4. Their doctrine propagation, exact gap/deletion maps, final executable
PRDs, and exact-tree peer reviews are now complete for every A-M domain. Step 9
remains a separate execution phase and has not started.

The statement above is the original pre-execution record for D1/D2/D3. The
original A-M Step-9 work subsequently executed. On 2026-07-30 the product owner
reopened 126 for the bounded D4 convergence correction below. Original
execution evidence remains historical evidence and does not count as D4
execution.

No product code, product data, Cloudflare state, or Supabase state was changed
to produce this register.

## Evidence Boundary

This register was prepared from:

- current source and Git history;
- the dual A-M as-built and official-source research corpus;
- current architecture, product, service, and operations documentation;
- independent current-source passes across A-H, I-K, and L-M;
- authenticated read-only Roma routes for account fonts, widget defaults,
  instances, and Builder-open packages;
- public Bob, Roma, Tokyo, Dieter-manifest, and instance-runtime reads.

Direct Cloudflare R2/API preflight is unavailable on this machine because
`CLOUDFLARE_ACCOUNT_ID` is absent. That boundary is explicit. Product-route and
public-runtime owners supplied the UI evidence used here; no direct-storage
claim or mutation is made.

## Settled Product Law

No new owner choice is required for A-H:

| Domain | Settled law |
|---|---|
| 126A Accessibility | Semantic truth, native controls where behavior is preserved, accessible names, and honest state/copy. No certification or custom accessibility framework. |
| 126B Color | Light mode, current palette, semantic roles, deterministic structural color, and legal user-authored color. No palette redesign or dark-mode prework. |
| 126C Iconography | Keep the approved 157-icon human-originated set, numeric sizing, `currentColor`, and deterministic consumer lanes. Agents do not originate or reshape icons. |
| 126D Typography | Keep operational UI typography separate from public-widget typography. Custom fonts are account assets. The seven-font migration is proven complete. |
| 126E Interactions | Explicit Save, immediate in-memory preview, confirmed persistence, durable failures/partial success, and Agent Activity only for real agent work. |
| 126F Motion | Small system motion using `140ms`, `160ms`, and `ease`, with reduced-motion behavior. Public-widget motion stays widget-owned. |
| 126G Ops | Git source -> deterministic build -> generated Tokyo product output -> Cloudflare deploy. R2 is not source truth. |
| 126H Dieter | Existing spacing, `--control-radius-*`, icon, motion, and shadow substrate by reference. No new elevation, focus/touch, or z-index system. |

The seven untracked files under `tokyo/product/fonts/special/` are neither
source nor deploy inputs. Their deletion is mechanical step-9 cleanup after the
final plan records the already-proven account-asset state.

## Mandatory Execution Law - Not Owner Choices

The following conclusions are already determined by product law, current
consumption, native semantics, or proven absence. Step 6 must map their exact
files and deletions; execution must not reopen them as design workshops.

### Components

- Every ToolDrawer field type has one inspectable Dieter contract: stencil,
  spec, CSS, and behavior source only when behavior is not native. Bob must not
  treat a missing required spec as optional success. Explicit presentation-only
  primitives such as `icon` remain named exceptions, not a second contract.
- Delete `textrename`: it has no current product consumer and survives only in
  source/generated showcase machinery.
- Keep Toggle as native checkbox HTML/CSS/spec and delete the unused custom
  Enter-key hydrator. Native checkbox behavior already supplies the supported
  interaction; 126A forbids inventing a keyboard program.
- Keep `repeater` and `object-manager` distinct. They are active, different
  product workflows: inline nested-item editing versus top-level object
  reorder/delete in a dialog. Document the distinction and declare their proven
  component dependencies. Do not force a JS-to-TS rewrite without a behavior
  reason.
- Convert the six fake dropdown triggers to native buttons while preserving
  behavior.
- Current `dropdown-actions` product compilation sets `applyActions` to empty
  and its spec exposes no apply-action variant. Delete the dead footer branch;
  the surviving component is a choice/listbox popover. Do not retain invalid
  interactive buttons inside a listbox for hypothetical compatibility.
- Remove the accumulating `object-manager` backdrop listener.

### Surfaces And Ownership

- Use the current vocabulary: navigation plane, header/action band,
  canvas/work area, module/section, item/card, table/list, inspector/tool,
  preview, and overlay/dialog. The app background is a backdrop; layout helpers
  are not surfaces.
- Preserve the existing backdrop, white/muted surfaces, borders, and shadows.
  Do not create a new depth or tonal ramp.
- Dieter owns reusable tokens, reusable controls, shared visual contracts, and
  shared dialog mechanics. Roma and DevStudio retain their shell, navigation,
  workspace, domain layout, responsive composition, and host-layout CSS.
- Delete local CSS only when it is dead or duplicates an accepted Dieter-owned
  contract. Do not mass-rename `.roma-*` or `.rd-*` layout classes to satisfy a
  grep count.
- Current numeric `--radius-*` aliases are absent. Preserve
  `--control-radius-*`; do not restore aliases from historical audit text.
- Add one small Dieter CSS/markup contract for native operational `input`,
  `select`, and `textarea` controls. Preserve Roma's current bordered-field
  appearance as the no-redesign baseline. Dieter owns appearance and states;
  apps own labels, validation copy, values, layout, and behavior. Do not stretch
  Bob's compact ToolDrawer `textfield` into a generic app form.
- Add one small Dieter operational-table visual base using Roma's current
  neutral table as the frozen baseline. Dieter owns width, alignment, borders,
  base spacing, and horizontal overflow. Roma owns data/state; DevStudio keeps
  policy-specific density, sticky headers, token columns, and editable-cell
  composition. No table data, sorting, pagination, policy, or React abstraction
  moves into Dieter.

### Overlays And Feedback

- Classify overlays by behavior: choice popovers are listboxes; editing
  popovers are non-modal dialogs; full-screen work and account/product prompts
  are blocking dialogs. Public-widget menus remain widget-owned.
- Every blocking dialog requires truthful naming, initial focus, focus
  containment, return focus, parent inertness, scroll control, and disabled
  dismissal while an operation cannot safely be interrupted. One small
  Dieter-owned lifecycle helper may provide mechanics; product content and
  state stay with the owning screen. No modal framework, registry, or global
  z-index system.
- Replace the two in-app Roma `window.confirm` calls with the accepted dialog
  contract. Keep native `beforeunload` at the browser/tab boundary.
- Add one small Dieter tooltip contract for unfamiliar icon-only actions. It
  appears on hover and keyboard focus; the control retains its accessible name.
  Native `title` is not the designed tooltip system.
- Keep translation-sync attention in Bob's Translations panel beside Tokyo's
  authoritative summary and Generate action. Roma must not infer or display a
  second translation state.

### Proven Cleanup

- Remove dead Bob publish/website modal CSS.
- Remove dead Roma Widget Defaults control CSS while preserving active host
  layout CSS and the compiled Bob/Dieter controls it hosts.
- Fix stale current counts and generated route tests.
- Remove the duplicate DevStudio token import. Current token-editor input
  listener lifecycle is singular and is not a cleanup target.
- Do not split large Roma files only because they are large.
- Do not create a generic Surface component, React UI framework, command-state
  framework, compatibility layer, or governance registry.
- Keep account/session/routes, save behavior, translation behavior, widget
  behavior, and public-widget runtime outside this UI refactor unless an
  accepted decision below explicitly requires a product-surface change.

## Accepted Product-Owner Decisions

### D1 - Blocking Dialog Dismissal Policy

**Status: DECIDED by the product owner.** Lifecycle correctness is mandatory,
and the following matrix defines what dismissal means when local work, a
running operation, or a required notice exists.

**Accepted matrix:**

| Dialog/workflow | Escape | Backdrop | Explicit action and protection |
|---|---|---|---|
| Dieter Bulk Edit | Close if unchanged; otherwise open discard confirmation | Never | Cancel follows the same dirty rule; Save applies edits |
| Dieter Object Manager | Close if unchanged; otherwise open discard confirmation | Never | Cancel follows the same dirty rule; Save applies reorder/delete |
| Roma Add Instances | Close and discard the temporary selection | Never | Cancel discards; Add selected persists |
| Roma Bulk Upload | Disabled while any upload is active; close after terminal | Never | Close available only after the run is terminal |
| Roma account tier-drop notice | Never | Never | Only Open settings or persisted Dismiss resolves the notice |
| Roma plan-limit prompt | Close | Close | Close loses no work; plan enforcement and CTA behavior are outside D1 |
| Bob plan-limit/upsell prompt | Close | Close | Not now loses no work; plan enforcement and CTA behavior are outside D1 |
| Roma upsell scaffold | Close | Close | Close loses no work; no commercial operation has started |
| DevStudio token editor | Close if unchanged; otherwise open discard confirmation | Never | Cancel follows the same dirty rule; Confirm Commit persists |
| Roma unsaved Builder/defaults confirmation | Means keep editing | Never | Keep editing is safe default; Discard is explicit destructive action |

**Blast radius:** `bulk-edit`, `object-manager`, four Roma modal consumers, two
Roma unsaved-work guards, Bob upsell, DevStudio token editor, shared lifecycle
mechanics, accessibility/browser tests, and dialog docs.

Owner decision: `DECIDED - DISMISSAL MATRIX ACCEPTED`

### D2 - Global Operational Workspace Capability

**Status: DECIDED by the product owner.** This is global Clickeen product law,
not a DevStudio-only responsive choice.

```text
resolution -> sharpness
available workspace -> layout
form factor -> expected product experience
```

Retina and 4K hardware pixels govern rendering fidelity, not workspace class.
One generic `960px`/`980px` breakpoint cannot classify the 2026 device
landscape. The implementation must use usable CSS workspace geometry and the
real composition's ability to fit, while preserving the product experience
expected from the form factor.

Accepted operational-workspace contract:

- desktop: full desktop workspace;
- tablet portrait and landscape: full desktop workspace, touch-operable;
- mobile landscape: compact workspace with accessible navigation drawer;
- mobile portrait: explicit rotate-device or larger-screen boundary, never a
  broken editor/dashboard approximation.

Accepted shell law is deliberately small:

```text
full workspace:    persistent left navigation | flexible work area
compact workspace: menu button                | full-width work area
```

The left navigation stays narrow and stable; the work area receives all
remaining space. Desktop and tablet use the full workspace. On mobile
landscape, the same navigation opens as an accessible overlay drawer so the
work area receives the screen. Product domains, routes, operations, and
information architecture do not change between modes.

Bob applies the same shape one level inside Roma:

```text
full Builder:    ToolDrawer | preview/workspace
compact Builder: tool button | full preview/workspace
```

The compact ToolDrawer is an explicit drawer, not a separate mobile editor.
Tables keep their information and may scroll; domains are not rewritten as card
feeds. Dialogs fit the usable viewport. No operation disappears in a supported
mode.

Roma currently hides its persistent navigation below `980px` and substitutes
an inline `details` menu. DevStudio moves its sidebar off-screen below `960px`
without a working trigger. Both are obsolete breakpoint-driven expressions of
the same workspace problem. Bob Builder is part of the supported operational
path hosted by Roma and must remain operable in every supported mode.

This decision does not authorize user-agent sniffing, a device registry, a
responsive framework, or separate tablet product. Roma, Bob, and DevStudio keep
their local shell/layout ownership and implement one shared behavior law. It
also does not authorize a shared shell framework, domain-by-domain responsive
redesign, or mobile copies of existing screens.

D2 execution is green only when representative desktop, tablet portrait,
tablet landscape, and mobile-landscape browser evidence proves navigation,
work-area allocation, touch/keyboard operation, orientation changes, zoom/safe
areas, dialogs, and core workflows without overlap or hidden actions.

**Blast radius:** Roma shell/navigation and responsive CSS; Bob Builder shell,
ToolDrawer/workspace/preview composition; DevStudio shell/navigation and
responsive CSS; supported-viewport browser evidence; architecture, UI, and
service documentation.

Owner decision: `DECIDED - GLOBAL WORKSPACE CAPABILITY TENET ACCEPTED`

### D3 - Upgrade Action Before Billing Exists

**Status: DECIDED by the product owner.** Clickeen is pre-GA and is deliberately
developing the upsell experience before the commercial billing operation is
connected. Legitimate Upgrade entry points stay in Roma and Bob. They must open
or transition to one coherent upsell dialog scaffold rather than navigate to
`/billing` or imply that a purchase can already be completed.

The accepted pre-GA contract is:

- Upgrade remains a real product command on legitimate plan-limit surfaces.
- Every Upgrade entry point opens or transitions to the same product meaning:
  the Clickeen upsell dialog scaffold.
- The scaffold has real dialog semantics and lifecycle, plus a stable content
  region for future plan comparison, benefits, pricing, and checkout work.
- The scaffold may remain intentionally incomplete while pre-GA upsell UX is
  developed. It must not claim a purchase, mutate a plan, call a billing
  provider, show fake success, or invent a sales/contact destination.
- A plan-limit prompt transitions into the upsell scaffold; it does not stack a
  second modal on top of the first.
- Opening the scaffold is an in-place UI transition, not navigation. It preserves
  unsaved Builder work and must not invoke a discard confirmation.
- Roma owns one reusable account upsell scaffold component and its product
  content contract. Roma-native Upgrade entry points open that component. Bob
  keeps the `bob:upsell` intent bridge; Roma handles the intent by opening the
  same scaffold. No global dialog store or upsell framework is authorized.
- Dieter owns reusable dialog mechanics. Bob owns its local plan-limit prompt.
  Future billing work owns the commercial operation.
- Ordinary navigation to Billing as a truthful current-plan surface remains
  valid. Only Upgrade must stop masquerading that read-only screen as a working
  plan-change destination.

**Blast radius:** `roma/components/widgets-domain.tsx`,
`roma/components/builder-domain.tsx`, the small reusable Roma upsell scaffold,
`roma/tests/run-widget-command-gates.ts`, `bob/components/UpsellPopup.tsx`, Bob
upsell message/session types, Billing/current-plan copy, shared dialog lifecycle,
monetization tests, and service/UI docs.

Owner decision: `DECIDED - KEEP UPGRADE AND OPEN SHARED UPSELL SCAFFOLD`

### D4 - Dieter Layout, Table, Popup, And Consumer Convergence

**Status: DECIDED by the product owner on 2026-07-30.** The earlier approach
left layout, table, and blocking-dialog appearance hardcoded in consumers. D4
supersedes D2's local Roma/DevStudio shell-appearance ownership and the narrow
`operational-table` decision. It preserves D2's workspace behavior and all
route/data/workflow ownership.

The exact Roma/DevStudio taxonomy is:

```text
main-container
├── left-nav
└── page
```

- `main-container` is the root application layout.
- `left-nav` and `page` are its direct children.
- Public selectors are `.main-container`, `.left-nav`, and `.page`.
- `workspace` is not a synonym because Bob already owns `Workspace` and
  `.workspace` for widget preview.
- Bob retains `ToolDrawer | Workspace` and does not adopt this layout.

The ownership chain is:

```text
Dieter defines
→ DevStudio demonstrates the real source
→ DevStudio and Roma consume it by reference
→ Bob consumes Table and Popup only where applicable
```

Dieter adds three source contracts:

```text
dieter/layouts/main-container/
  main-container.css
  main-container.html
  main-container.spec.json

dieter/components/table/
  table.css
  table.html
  table.spec.json

dieter/components/popup/
  popup.css
  popup.html
  popup.spec.json
```

Layout owns the shared Full/Compact visual composition, sizing, scrolling,
overflow, safe-area treatment, and navigation-open presentation. Apps own
routes, nav items, active route, open state, page content, and commands.
The Layout ownership, taxonomy, and source/edit path are decided. Initial source
defaults are `13.75rem | minmax(0, 1fr)` at `100dvh`; the nav owns its
scrolling and `var(--space-6)` safe-area padding; the page owns outer
route-content scrolling and `var(--space-8)` safe-area padding. Compact below
`600px` width or height initially uses
`min(20rem, calc(100vw - 3rem))` off-canvas nav and shared scrim visual. These
values are not final visual approval: the four named Layout tokens can be
refined later through DevStudio without changing the shared contract.
Layout CSS is imported directly by Roma and DevStudio, not through Bob's broad
`dieter/styles.css`.

Inside the shared `.page`, Dieter owns only `.page__header`,
`.page__actions`, and `.page__content`. Apps own their semantic content and
behavior. The editable Layout/Page source values are the four Dieter foundation
tokens `--layout-left-nav-width`, `--layout-left-nav-padding`,
`--layout-page-padding`, and `--layout-compact-left-nav-width`.

Table owns semantic table border, radius, header, row/cell spacing/alignment,
typography, and horizontal overflow. Apps own columns, records, editing,
sorting, pagination, operations, policy, and hover/selected/editable/error/
loading meaning and presentation. No shared state layer is added. Final
selectors are `.diet-table` and `.diet-table__table`.

Popup is a blocking native `<dialog>` visual contract. It owns backdrop, frame,
viewport fit, border, radius, shadow, and header/body/footer/action layout.
The existing shared lifecycle remains the only mechanics helper. Workflows own
copy, state, validation, persistence, actions, and D1 dismissal policy. Final
selectors are `.diet-popup`, `.diet-popup__header`, `.diet-popup__body`,
`.diet-popup__footer`, and `.diet-popup__actions`. Non-modal Popover remains
distinct.
Its initial size values are Small `30rem`, Medium/default `32.5rem`, and Large
`61.25rem`, each capped to the viewport minus `2 * var(--space-4)`. Small is
the token editor; Medium is Roma/Bob/Object Manager; Large is Bulk Edit.

DevStudio adds `Layouts` to Foundations and demonstrates actual Dieter Layout
source in isolated Full, Compact-closed, and Compact-open examples. Table and
Popup receive real source-derived component pages. The target generated
inventory is 5 Foundations, 24 Components, and 2 Policy routes.

Layouts also shows the real Page foundation and exposes the four spec-declared
tokens through the existing DevStudio token editor and source-commit authority.
Visual values are editable there; structural topology remains reviewed Dieter
source. No CSS editor or second write path is authorized.

`operational-table`, `.docs-shell*`, replaced `.devstudio-page*` layout chrome,
`.roma-layout*`, `.roma-modal*`, and other consumer-local base rules duplicated
by these contracts are deleted in the same migration. No aliases or dual
old/new branches remain.

This decision does not authorize:

- a shared React shell, runtime design-system service, generic Surface
  component, device registry, table engine, popup manager, or global dialog
  store;
- a generated Dieter runtime mirror, manifest, second package, new generator
  script, or copied Dieter CSS;
- new route/API/service boundaries, account/session, product-data,
  translation, locale, policy, persistence, R2, Worker, or Supabase changes.
  The existing DevStudio foundation-token GET/POST contract is explicitly
  extended to recognize only the four named Layout tokens so the approved
  Layouts editor can use the existing write authority;
- a new keyboard-support project or synthetic keyboard machinery.

Existing generation scripts may be extended to expose the source; generated
files remain outputs. Current living docs stay as-built truth until code lands.

Owner decision:
`DECIDED - DIETER DEFINES LAYOUT/TABLE/POPUP; DEVSTUDIO REVEALS; CONSUMERS ADOPT`

## Product Owner Response

The recorded decisions are:

```text
D1: Decided - dismissal matrix accepted
D2: Decided - global workspace capability tenet
D3: Decided - keep Upgrade and open the shared upsell dialog scaffold
D4: Decided - Dieter Layout/Table/Popup consumer convergence
```

No other architecture, cleanup, component, surface, translation, storage,
route, or execution choice is delegated to implementation.

## After D4 Product Convergence

The original D1–D3/A–M sequence completed and remains recorded in the PRDs and
DevQA. It is not a current instruction to restart at 126A.

D4 proceeds only through the reopened correction order:

1. complete and independently audit the corrected parent, owner register,
   H/I/J/K/L/M, and DevQA;
2. Dieter Layout;
3. DevStudio Layouts reveal and real shell adoption;
4. Dieter Table and Popup;
5. all DevStudio Foundation/component presentation and consumer adoption;
6. product-owner approval of the deployed DevStudio reference;
7. Roma adoption;
8. applicable Bob adoption with Workspace preserved;
9. exact-SHA Pages/browser verification, living-doc reconciliation, and final
   independent V1–V8.

No product code, product data, or remote state changes before item 1 is GREEN.
No later item advances while its acceptance row in `126_DevQA.md` is OPEN.

## Historical D1-D3 Pre-Execution Check

Final independent exact-tree re-audit completed on 2026-07-21: **PASS**. The
reviewers verified all Step-5 doctrine, Step-6 blast radius, Step-7 execution
contracts, and Step-8 authority findings before the result below was recorded.
This table is historical D1–D3 evidence only. It does not audit or close D4.

| ID | Result | Reason |
|---|---|---|
| V1 Silent substitution | PASS | Accepted product decisions are explicit; unknown Cloudflare truth is bounded rather than invented. |
| V2 Silent healing | PASS | No source, product data, or managed-service state was normalized or repaired. |
| V3 Silent omission | PASS | A-M, mandatory cleanup, deferred residue, and all accepted D1/D2/D3 decisions are represented. |
| V4 Fail-open control | PASS | No control or enforcement behavior changes in this pre-execution pass. |
| V5 Corruption-as-absence | PASS | Stale planning input is frozen/corrected, not treated as missing or clean. |
| V6 Partial-success masquerade | PASS | Steps 1-8 are complete for every A-M domain; all Step-9 implementation, deploy, product-data, and runtime work remains explicitly unstarted. |
| V7 Masquerade/redress | PASS | Landed work is not rewrapped as new execution; legacy replacements are not preserved under new names. |
| V8 Runtime test dependency | PASS | Evidence and review gates verify work; normal product operation does not depend on them. |
