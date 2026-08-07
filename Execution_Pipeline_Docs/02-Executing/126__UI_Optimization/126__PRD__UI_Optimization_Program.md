# PRD 126 — MAMA: UI Optimization Program

Status: REOPENED — ORIGINAL A–M STEP-9 AND LOCALIZATION-CORRECTION EVIDENCE
PRESERVED; D4 CONVERGENCE IMPLEMENTED AND DEPLOYED; FINAL POPUP-WORKFLOW QA
AND PRODUCT-OWNER ACCEPTANCE PENDING.
Owner: Clickeen product architecture + UI
Date: 2026-06-26
Stage: 02-Executing

## 2026-07-30 UI Convergence Correction

The original A–M Step-9 work and the localization correction remain historical
GREEN evidence for the scopes they actually executed. They did not establish
one Dieter-owned layout, Table, and Popup contract and then make DevStudio,
Roma, and applicable Bob UI consume those contracts. Post-closure DevStudio
commits `2a070120`, `5e7c0266`, and `2b013925` are current-source input only;
they are not convergence execution credit.

The program is therefore reopened. No product code may be changed for this
correction until the corrected H/I/K/L/M contracts and the acceptance matrix in
`126_DevQA.md` are the agreed execution authority.

### 2026-07-30 Visual Acceptance Correction

The first D4 deployment proved structural convergence but failed visual
acceptance: it put a border and radius around the previous dense application
layout without establishing the intended canvas, navigation, page-width, table,
and module hierarchy. Automated structural checks did not constitute visual
acceptance.

The following presentation now supersedes D4's explicitly provisional initial
values without changing its taxonomy or ownership:

- the application canvas and Page use `--role-surface-muted`;
- Full and Compact navigation use the shared surface, no border,
  `--control-radius-3xl`, and the existing floating/elevated shadows;
- the navigation is `20rem` wide and remains inset by `--space-2`;
- Page header and content align to one centered `80rem` maximum width;
- wide Page rhythm is `--layout-page-padding`, `--space-10`, and `--space-8`;
  Compact rhythm is `--space-4`, `--space-6`, and `--space-4`;
- Table is a borderless `2xl` shared surface with floating elevation, muted
  header band, direct role-border row separators, and
  `--space-3`/`--space-4` cell padding;
- DevStudio and Roma own content composition only and must not restate the
  shared shell, Page-width, or Table presentation.

No new token family, color role, component, layout name, framework, generator,
or runtime service is authorized by this correction.

### 2026-07-31 Vertical Rhythm Correction

D6 supersedes only D5's spacing values. Wide Page rhythm is
`--layout-page-padding` (`--space-6`), `--space-6`, and `--space-5`; Compact
rhythm is `--space-4` for all three levels. Table cell padding is
`--space-2`/`--space-4`. DevStudio and Roma tighten their local composition
spacing with smaller existing `--space-*` values. No density token, new scale,
typography change, component, or architecture is authorized.

### 2026-07-31 Rendered Rhythm Correction

D7 records that D6 changed spacing declarations without sufficiently changing
the repeated rendered geometry. D7 supersedes only D6's values: Wide Page
rhythm is `--layout-page-padding` (`--space-6`) with `--space-4` header and
content separation; Compact uses `--space-4` outer padding with `--space-3`
header and content separation. Table cells use `--space-1` block and
`--space-4` inline padding. DevStudio and Roma navigation rows use
`--control-size-lg`. Generic DevStudio source previews use
`--control-size-md`, and generated component rows have one CSS spacing owner
instead of an additional inline margin. Roma primary modules use
`--space-3` block padding and `--space-2` gaps; secondary cards use
`--space-2` for both. Base token values, typography, behavior, routes, data,
and architecture do not change.

### 2026-07-31 Full Navigation Width Correction

D8 supersedes only the Full navigation width after rendered review showed that
the `20rem` panel was disproportionate to the navigation labels. Full now uses
the existing `--layout-left-nav-width` authority at `16rem`; the grid continues
to add `--space-4` for the two `--space-2` outer insets. Compact retains its
separate `--layout-compact-left-nav-width` value of `20rem`. No consumer
override, new token, taxonomy, breakpoint, or navigation behavior is added.

### Frozen Taxonomy And Composition

Roma and DevStudio use exactly this high-level composition:

```text
main-container
├── left-nav
└── page
```

- `main-container` is the root layout and direct parent of the other two.
- `left-nav` is the one navigation region.
- `page` is the right-side route content region.
- Public CSS selectors are `.main-container`, `.left-nav`, and `.page`.
- The shared source markup is:

```html
<div class="main-container" data-navigation-open="true|absent">
  <aside class="left-nav">consumer navigation</aside>
  <main class="page">consumer route content</main>
</div>
```

No second shell vocabulary is authorized. Do not introduce `workspace`,
`appframe`, `navstack`, `workarea`, `routeview`, `viewhead`, `contentflow`,
`contentgroup`, `recordset`, `dialogframe`, `specimenboard`, generic `surface`
wrappers, or aliases for the three names above. `workspace` is deliberately
excluded because Bob already owns `Workspace` and `.workspace` for widget
preview. Bob keeps its product-specific `ToolDrawer | Workspace` composition
and does not adopt the Roma/DevStudio layout taxonomy.

### Frozen Ownership

```text
Dieter defines -> DevStudio demonstrates -> Roma and DevStudio consume
```

Applicable Bob UI consumes Dieter Table and Popup; Bob's product layout remains
Bob-owned.

| Contract | Dieter owns | Consumer owns |
| --- | --- | --- |
| Layout | `.main-container`, `.left-nav`, `.page`; Full/Compact composition, sizing, overflow, and navigation-open visual state | route list, labels, route state, page content, navigation-open state, and domain behavior |
| Table | semantic table visual contract: wrapper overflow, border, header, row/cell spacing, and typography | columns, data, editing, sorting, pagination, operations, policy, loading/error/selected/hover meaning |
| Popup | native `<dialog>` visual structure: backdrop, size, border, radius, shadow, header/body/footer/actions, and compact fit; existing lifecycle helper retains mechanics | copy, fields, dirty/running state, validation, persistence, action meaning, and accepted dismissal policy |

Non-modal anchored `popover` remains a distinct Dieter component. Popup must
not be implemented as, renamed to, or routed through Popover.

The Layout ownership, taxonomy, and source/edit path are frozen. D5 corrected
the initial values after visual review. The four named layout values can still
be refined later through DevStudio without changing the contract:

- Full: `16rem` left navigation and `minmax(0, 1fr)` page;
- root: `100dvh`, one grid row, hidden root overflow;
- left navigation: a `16rem` foreground panel inside a track widened by
  `var(--space-4)`, inset by `var(--space-2)` on all sides, with its own
  vertical scrolling, `var(--space-6)` padding plus safe-area insets,
  `var(--role-surface)`, no border, `var(--control-radius-3xl)`, and
  `var(--shadow-floating)`;
- page: the only outer route-content scrolling owner, `var(--space-6)` padding
  plus safe-area insets and `var(--role-surface-muted)`;
- Compact below `600px` usable width or height: one-column page, fixed
  navigation inset by `var(--space-2)` with
  `min(20rem, calc(100vw - var(--space-4)))` width, off-canvas and
  non-interactive when closed, `var(--shadow-elevated)` when open, and the
  shared scrim;
- apps render their trigger and a `button[data-navigation-scrim]` inside
  `main.page`; Dieter styles the scrim/open presentation, while apps own click,
  open/close, and focus behavior;
- DevStudio and Roma use Compact in narrow portrait as well as narrow
  landscape. Bob's specialized editor may retain its app-owned portrait
  boundary; that is not a fourth shared layout class or Dieter runtime
  classifier.

The three structural selectors must be scoped as
`.main-container`, `.main-container > .left-nav`, and
`.main-container > .page`. Layout CSS is imported directly by Roma and
DevStudio only. It must not be added to the broad `dieter/styles.css` import
used by Bob.

The Page foundation is part of the same Layout source:

```html
<main class="page">
  <header class="page__header">
    <div>
      <h1>Consumer title</h1>
      <p>Consumer description</p>
    </div>
    <div class="page__actions">consumer actions</div>
  </header>
  <div class="page__content">consumer content</div>
</main>
```

The only shared Page subparts are `.page__header`, `.page__actions`, and
`.page__content`. Dieter owns their layout, spacing, and outer scrolling
relationship. Consumers own their content and behavior. Do not add generic
section, card, module, panel, surface, canvas, or workspace taxonomy.

Adjustable Layout/Page values are four Dieter foundation tokens:

```text
--layout-left-nav-width
--layout-left-nav-padding
--layout-page-padding
--layout-compact-left-nav-width
```

Layout CSS consumes those tokens without raw fallbacks.
`main-container.spec.json` lists the exact editable token names; it does not
duplicate their values. Existing Dieter role-color, radius, shadow, and motion
tokens remain authoritative for the other visual values.

### Exact Dieter Source Contract

Execution creates these source authorities:

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

The public component selectors are `.diet-table`,
`.diet-table__table`, `.diet-popup`, `.diet-popup__header`,
`.diet-popup__body`, `.diet-popup__footer`, and
`.diet-popup__actions`. The layout selectors are the three unprefixed names
defined above.

Popup has exactly three semantic size states. Their initial shared source
values are:

| State | Selector | Inline size |
| --- | --- | --- |
| Small | `.diet-popup[data-size="small"]` | `min(30rem, calc(100vw - (2 * var(--space-4))))` |
| Medium/default | `.diet-popup` / `[data-size="medium"]` | `min(32.5rem, calc(100vw - (2 * var(--space-4))))` |
| Large | `.diet-popup[data-size="large"]` | `min(61.25rem, calc(100vw - (2 * var(--space-4))))` |

All sizes use `max-height: calc(100dvh - (2 * var(--space-4)))`,
`border: 1px solid var(--role-border)`,
`border-radius: var(--control-radius-2xl)`,
`background: var(--role-surface)`, `color: var(--color-text)`,
`box-shadow: var(--shadow-elevated)`, `padding: 0`, and
`color-mix(in oklab, var(--color-system-black), transparent 65%)` for the
backdrop. `[open]` is a three-row grid. Header/body/footer each use
`var(--space-5)`; header and footer use
`1px solid var(--role-border)` dividers. Header aligns title/close at opposite
ends, body owns `overflow: auto`, and actions are end-aligned, wrapping, with
`var(--space-3)` gap.
Small maps to DevStudio token editing, Medium to Roma/Bob/Object Manager, and
Large to Bulk Edit. Consumers may not restate these widths locally.

Table initially has one base density: `var(--space-2) var(--space-3)` cell
padding. Its source-derived DevStudio page must demonstrate ordinary,
horizontal-overflow, row-action, and editable-cell compositions without adding
a data/table engine.
Its initial base carries forward the current `operational-table` visual source:
`1px solid var(--role-border)`, `var(--control-radius-md)`,
`var(--role-surface)` wrapper, collapsed borders,
`var(--color-text)`, `body-s` body cells and `label-s` column headers,
row/cell bottom borders using `var(--role-border)`, start/middle alignment,
`var(--role-surface-muted)` for the column-header band only, and no final-row
border. Header weight is owned by `label-s`, not assembled locally. No shared
hover, selected, editable, error, or loading state is added; those remain
consumer-owned.

`operational-table` is replaced by Table in the same migration. Its directory,
imports, selectors, generated registry entries, and consumer markup are
deleted; it must not survive beside Table as a compatibility path. The existing
`shared/dialog-lifecycle.ts` remains the single native-dialog mechanics helper.
Popup consumes that lifecycle where behavior is required; it does not duplicate
or replace it.

`dieter/layouts/**` becomes an explicit Dieter source category recognized by
the existing source import, governance, and DevStudio generation paths. This
does not authorize a generated runtime mirror, browser manifest, shared runtime
service, new package, new generator script, or compatibility wrapper.

### DevStudio Contract

DevStudio adds `Layouts` under Foundations:

```text
Foundations
  Core styles
  Colors
  Icons
  Typography
  Layouts
```

`Layouts` is generated from the real
`dieter/layouts/main-container/{html,css,spec.json}` source and shows:

1. one short title and explanation;
2. the source structure/markup;
3. an actual Full rendering;
4. an actual Compact rendering with navigation closed;
5. an actual Compact rendering with navigation open.

Examples use the production markup and CSS. DevStudio may supply example nav
items/content. Each example runs in an isolated iframe sized to the applicable
real viewport so production media queries execute. DevStudio controls only the
iframe dimensions, clipping, and label. It must not copy, override, or restyle
the inner layout.

The Layouts page also renders the real Page header/actions/content composition
and an editable-property table derived from `editableTokens` in the Dieter
spec. Each Edit action opens the existing DevStudio token editor for that exact
token. Reads, validation, confirmation, dirty-state protection, and source
commit use the existing token route and Pages Functions. No raw CSS editor,
layout-specific write API, second source writer, or structural editor is added.
Structure is visible but changes only through reviewed Dieter source.

All Foundations and component pages follow one restrained documentation-page
composition: title/short explanation, simple semantic sections, semantic tables
where rows and columns are real, an icon grid for Icons, actual source-derived
component examples, and explicit Edit actions where editing exists. Generated
pages must not use fake `div` tables, giant token rows, nested decorative white
containers, or a DevStudio-only imitation of Dieter.

### Consumer Migration And Deletion

Execution is a hard cut:

1. Add the Dieter Layout source contract.
2. Generate the DevStudio Layouts/Page page from that source, expose its
   `editableTokens` through the existing token editor, and verify its production
   examples.
3. Migrate DevStudio's actual shell to
   `.main-container > .left-nav + .page`.
4. Delete replaced DevStudio shell/page layout selectors and declarations,
   including `.docs-shell*`, `.devstudio-page-layout`, and redundant
   `.devstudio-page*` layout wrappers; retain only page-domain styling that
   Dieter does not own.
5. Add final Dieter Table and Popup source contracts and their source-derived
   DevStudio examples.
6. Replace `operational-table` everywhere and delete it.
7. Migrate all Roma shell markup from `.roma-layout*` to the exact shared layout
   classes and delete the replaced Roma layout base CSS.
8. Migrate Roma dialogs from `.roma-modal*` to Popup and delete replaced local
   popup visual CSS while preserving each workflow's behavior.
9. Migrate applicable Bob dialogs and semantic tables to Popup/Table and delete
   replaced local base visuals. Bob's `Workspace` layout is untouched.
10. Regenerate with the existing generators, then update current living docs
    only after source behavior exists.

No new generator script is permitted. Modify the existing foundation/component
generation and static-registry machinery only where required to consume the new
Dieter sources. Generated files are outputs and must never be hand-authored.

### Exact Correction File Map

Add:

- `dieter/layouts/main-container/{main-container.css,main-container.html,main-container.spec.json}`;
- `dieter/components/table/{table.css,table.html,table.spec.json}`;
- `dieter/components/popup/{popup.css,popup.html,popup.spec.json}`.

Edit Dieter/build:

- `dieter/tokens/dieter-foundation-tokens.css` for the exact four editable
  Layout values;
- `dieter/styles.css` for Table/Popup only;
- existing Dieter exports/governance, including
  `scripts/dieter/governance-guards.mjs` where its current inventory requires
  the new governed sources;
- `dieter/components/bulk-edit/{bulk-edit.html,bulk-edit.css,bulk-edit.ts}`;
- `dieter/components/object-manager/{object-manager.html,object-manager.css,object-manager.ts}`.

Edit DevStudio:

- `admin/README.md`;
- `admin/src/main.ts`;
- `admin/functions/_shared/dieter-token-contracts.js`, extending the existing
  foundation-token validation authority to the exact four Layout tokens;
- `admin/src/css/{layout.css,utilities.css,dieter-previews.css}` and deletion of
  the replaced `admin/src/css/tokens.css` shell values;
- `admin/scripts/generate-foundation-pages.mjs`;
- `admin/src/data/{componentRenderer.ts,routes.ts}`;
- `admin/src/html/tools/{entitlements,llm-management}.html`;
- `e2e/devstudio/{route-contract,core-styles-contract}.spec.ts`.

The existing component-page and static-registry generators remain unchanged;
their current source-driven discovery emits the new Table and Popup outputs
without a second generator or registry path.

Regenerate, never hand-edit:

- `admin/src/html/foundations/**`;
- `admin/src/html/components/**`;
- `admin/src/data/{showcase,componentRegistry}.generated.ts`.

Edit Roma:

- `roma/app/layout.tsx`;
- `roma/app/login/page.tsx`;
- `roma/app/(authed)/builder/page.tsx`;
- `roma/app/(authed)/builder/[instanceId]/page.tsx`;
- `roma/components/roma-shell.tsx`;
- `roma/components/accept-invite-domain.tsx`;
- `roma/app/roma.css`;
- Table sites in
  `roma/components/{assets-domain,team-domain,widgets-domain}.tsx`;
- Popup sites in
  `roma/components/{assets-domain,roma-account-notice-modal,roma-unsaved-changes-dialog,roma-upsell-dialog,widgets-domain}.tsx`.
- `roma/tests/run-widget-command-gates.ts`.

Edit Bob only where applicable:

- `bob/components/UpsellPopup.tsx`;
- `bob/components/ToolDrawer.tsx`, replacing its Object Manager transient-work
  guard selector with the final Popup marker;
- `bob/app/bob_app.css`;
- `bob/tests/run-accessibility-copy.ts`.

Do not edit Bob `Workspace.tsx`, ToolDrawer composition, preview sizing/session,
or save behavior. The one ToolDrawer transient-work selector above is a
required hard-cut guard repair, not a layout/composition change. Do not
mass-rename Roma `rd-*`/module selectors; remove one
only when the source diff proves it is solely replaced base page chrome.

Delete:

- `dieter/components/operational-table/**`;
- all active `.diet-operational-table*` imports/selectors/markup;
- DevStudio layout selectors `.docs-shell`, `.docs-shell__sidebar`,
  `.docs-shell__main`, `.docs-shell__compact-bar`,
  `.docs-shell__menu-toggle`, and `.docs-shell__scrim`, including their Full/
  Compact media declarations;
- DevStudio `.devstudio-page-layout` and its direct-child header/div rules;
  `.devstudio-page` border/radius/background/padding; and
  `.devstudio-page-section` generic margin/background/padding/radius. Route
  markup is remapped to semantic headings/sections rather than renamed wrapper
  chrome;
- DevStudio token-editor frame/backdrop/header/body/footer/actions base visuals;
- replaced Roma `.roma-layout*` and `.roma-modal*` base visuals;
- Bob `.ck-upsellModal*` base visuals;
- Bulk Edit/Object Manager popup frame/backdrop/width/base structure duplicated
  by Popup.

Reconcile active doctrine and planning references:

- `documentation/engineering/UI/{README,dieter,components,surfaces,dialogs-and-modals}.md`;
- `documentation/services/{dieter,devstudio,roma,bob}.md`;
- this parent, the product-owner register, H/I/J/K/L/M, DevQA, the active 126E
  interaction statement, and the active Account Asset Folders planning
  dependency.

Retain/remap:

- DevStudio brand and nav-content rules currently under
  `.docs-shell__brand`, `.docs-shell__brand-title`, and `.docs-shell__nav`
  are retained with their class names changed to
  `.devstudio-nav__brand`, `.devstudio-nav__title`, and
  `.devstudio-nav__content`; they are app-local nav content and do not restate
  Layout geometry or expand the shared taxonomy;
- `.devstudio-page__header` becomes `.page__header`; route actions and route
  bodies use `.page__actions` and `.page__content`;
- route-specific section classes such as Entitlements/LLM/token editor state
  remain, but the generic `.devstudio-page-section` class and chrome do not;
- Roma `.roma-nav*`, `.rd-header*`, and domain/module rules remain unless the
  exact declaration duplicates `.page` outer scrolling/padding; only that
  duplicated declaration is deleted, not the domain selector.

Living docs are execution outputs, not pre-execution target claims:

- `documentation/engineering/UI/{README,dieter,components,dialogs-and-modals,surfaces}.md`;
- `documentation/services/{dieter,devstudio,roma,bob}.md`.

Do not rename `surfaces.md`; no such rename was approved.

### Correction Boundaries

- No new transport/service route and no account/session, storage, translation,
  locale, publication, policy, entitlement, or product-data behavior changes.
  The existing authenticated foundation-token GET/POST validation authority
  recognizes exactly the four approved Layout tokens so DevStudio can show and
  edit their real Dieter source values.
- No R2 product-data operation or Worker change.
- No shared React shell, table engine, modal framework, design-system runtime
  service, generic Surface component, device registry, or second package.
- No compatibility aliases or old/new parallel paths.
- No new keyboard-support program. Native semantic controls keep browser-native
  behavior, and the already accepted dialog lifecycle keeps its bounded
  Escape/focus behavior; the correction adds no synthetic keyboard machinery.
- The visual correction is intentional: it replaces hardcoded app-local layout,
  table, and popup appearance with the agreed Dieter contracts. Earlier
  “no redesign,” “local shell,” and “do not touch generated pages” boundaries
  are superseded only for this exact correction.

### Execution And Closure Order

The correction executes only after H/I/K/L/M and `126_DevQA.md` agree with this
section:

1. Dieter Layout;
2. DevStudio Layouts reveal;
3. actual DevStudio layout migration and deletion;
4. Dieter Table and Popup;
5. DevStudio Foundations/component-page convergence;
6. Roma Layout/Table/Popup migration and deletion;
7. applicable Bob Table/Popup migration and deletion;
8. focused source/build checks;
9. exact-SHA Git-connected Pages deployment verification;
10. deployed browser QA for every DevStudio tab, all affected Roma routes, and
    every affected Bob path;
11. living-doc reconciliation and independent V1–V8 audit.

126 cannot close while any correction row in `126_DevQA.md` is open. Historical
Step-9 and localization evidence remains valid but cannot substitute for this
new evidence.

Focused local gates:

```bash
pnpm --filter @ck/dieter typecheck
pnpm dieter:governance:check
pnpm validate:widgets
pnpm --filter @clickeen/devstudio generate
pnpm --filter @clickeen/devstudio typecheck
pnpm --filter @clickeen/devstudio lint
pnpm --filter @clickeen/devstudio check:functions
pnpm --filter @clickeen/devstudio build
pnpm --filter @clickeen/roma lint
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/roma build:cf
pnpm --filter @clickeen/roma test:widget-command-gates
pnpm --filter @clickeen/bob lint
pnpm --filter @clickeen/bob typecheck
pnpm --filter @clickeen/bob build:cf
pnpm --filter @clickeen/bob test:accessibility-copy
pnpm tokyo:r2:sync:check
```

Update existing tests; do not add a second framework. Deployed layout proof uses
`1440x900`, `768x1024`, `1024x768`, `844x390`, `390x844`, and
`600x960`.

Exact existing verification files:

- `e2e/devstudio/route-contract.spec.ts`;
- `e2e/devstudio/core-styles-contract.spec.ts`;
- `e2e/devstudio/126b-color-reveal.spec.ts`;
- `roma/tests/run-widget-command-gates.ts`;
- `bob/tests/run-accessibility-copy.ts`.

The exact authenticated DevStudio command is:

```bash
E2E_BASE_URL=https://devstudio.clickeen.com \
E2E_AUTH_STATE=e2e/.auth/devstudio.json \
pnpm exec playwright test \
  e2e/devstudio/route-contract.spec.ts \
  e2e/devstudio/core-styles-contract.spec.ts \
  e2e/devstudio/126b-color-reveal.spec.ts
```

The auth state must come from the existing Berlin-to-DevStudio session-finish
path and be valid for `devstudio.clickeen.com`; missing/expired auth keeps this
gate RED.

Authenticated Roma browser coverage is:
`/home`, `/profile`, `/widgets`, `/builder`, `/assets`, `/team`,
`/billing`, `/usage`, `/ai`, `/settings`, and the existing
`/settings/widget-defaults` rewrite. Table operations are exercised on
`/widgets`, `/assets`, and `/team`; all Roma Popup workflows listed
in 126K are exercised on their owning routes. Bob proof runs through
`/builder` with an existing instance and covers Upsell, Bulk Edit, and Object
Manager; `Workspace` preview is a non-regression.

Before remote Pages inspection:

```bash
pnpm cf:api:preflight
pnpm cf:pages:project devstudio
pnpm cf:pages:project roma-dev
pnpm cf:pages:project bob-dev
```

The returned `latest_deployment` for projects `devstudio`, `roma-dev`, and
`bob-dev` must be `success` at the same exact source SHA before browser proof.
No Pages config/env mutation is part of this correction.

## 2026-07-30 Reopening

126 closure missed a cross-system localization violation. During 126-era work,
explicit Generate Translations was coupled to per-locale runtime-file creation,
and Bob exposed those derivative outcomes as if they were part of translation
truth.

The accepted invariant is:

```text
Translation may create or update only overlays/locales/{locale}.json.
It must never create locale-specific HTML, CSS, JavaScript, publication state,
fingerprints, or derivative result types.
```

Closure completed on 2026-07-30: active code/routes/docs are overlay-only, all
affected root runtimes were rematerialized, cloud-dev base/translated/failure
paths were verified, the exact 400 obsolete R2 objects were deleted, a final
Generate Translations smoke preserved the 198-object keyset while changing only
the expected 28 overlays, and the independent V1–V8 audit returned GREEN.
`126_DevQA.md` owns the exact commit, deploy, R2, smoke, and failed purge-only
run reconciliation.

`02-Executing` is the repository pipeline folder for this active program.
Steps 1-8 are complete for every A-M domain. Step 9 executes one domain and one
slice at a time in dependency order.

This is the parent program PRD (MAMA). Planning and eventual execution flow through the domain PRDs
**126A–126K** in dependency order (§7) plus the two
screen refactors **126L DevStudio UI** and **126M Roma UI** last. Each domain PRD
is filled from its real audit. If a PRD conflicts with this MAMA, execution
resolves to this MAMA.

Related:

- Domain PRDs **126A–126K** (one per `engineering/UI/` kb doc, in dependency order):
  126A accessibility, 126B color, 126C iconography, 126D typography,
  126E interactions, 126G ops, 126F motion, 126H dieter, 126I components,
  126J surfaces, 126K dialogs-and-modals.
- Screen refactors (last): `126L__PRD__DevStudio_UI.md`, `126M__PRD__Roma_UI.md`.
- `audits/` — real per-domain audits (`126X__Audit__*.md`); see `audits/README.md`
  for the bar.
- Structural templates / granularity bar: `../../03-Executed/124__Overlay_Aware_Runtime_Materializer/124__MAMA__*.md`,
  `../../03-Executed/125__Roma_Tokyo_Product_Authority_And_Inventory_Boundary/125__PRD__*.md`.
- **Law sources read and reconciled on 2026-07-14:**
  `documentation/architecture/CONTEXT.md`, root `AGENTS.md`,
  `documentation/services/devstudio.md`, `documentation/services/roma.md`,
  `documentation/services/bob.md`,
  `../../03-Executed/PRD__DevStudio_Cloudflare_Migration.md` (§3.5 write path,
  §3.6 design freeze, Appendix A hash-frozen baseline).
- Human decision register:
  `126__Product_Owner_Execution_Decisions.md`.

## 1. Purpose

Re-establish the entire UI as one splendid Dieter system, from the inside out,
after it accreted through many incremental passes. This is convergence and
governance — **not a redesign**. We pause the accretion, go bottom-up, and make
each layer splendid so the layers above inherit that splendor for free.

The 126 program exists to make UI deterministic for an AI-operated codebase.
For every UI domain, 126 must do four things:

1. **Decide the Clickeen standard.** The standard is product-owned and
   Clickeen-specific. Material, Apple, and OpenAI are source references; they do
   not override human product authority.
2. **Identify gaps in the codebase.** The audit names current code reality
   against the decided standard: missing tokens, undefined references, local
   one-offs, fake capabilities, stale docs, and places where previous agents
   invented behavior.
3. **Fix gaps in the codebase.** Execution changes only the proven mismatch
   between Clickeen UI law and current runtime/source. It does not redesign,
   introduce new frameworks, or reinterpret a domain into an ideal system.
4. **Write deterministic docs for future agents.** The final living docs tell
   agents exactly how to code the UI domain: allowed patterns, forbidden
   patterns, source authority, human-owned decisions, and out-of-scope drift.

Anything less leaves interpretation space for future agents; anything more
turns 126 into invented machinery.

### Pre-GA No Legacy Compatibility Tenet

Clickeen is pre-GA. The 126 program does not preserve old UI drift through
compatibility shims, temporary aliases, parallel legacy paths, or "support both
old and new" transitions unless the human explicitly makes that behavior product
law in the relevant PRD.

For every 126 domain, once the standard is decided:

- Fix source and docs to the standard.
- Remove old drift and stale paths.
- Do not leave legacy names, classes, render paths, token aliases, wrappers, or
  local one-offs as supported alternatives.
- Do not add guard/check machinery to enforce this tenet. The PRD is the
  authority; execution must clean the code/doc surface instead of preserving bad
  paths behind validation.

## 2. Core concept — the matrioska

The UI is a Brad-Frost atomic / nesting-doll system. Three dolls:

- **Tokens** — the innermost. Raw values: a color, a spacing step, a radius, a
  font size.
- **Components** — the middle. A button, a text field, a toggle. Each is made of
  tokens by **reference** (`var(--token)`), not by copying the value.
- **Screens** — the outer. DevStudio UI (all its parts) and Roma UI (all its
  parts). Each is made of components by reference, not by rebuilding them.

Because every doll points inward, a change to an inner doll rolls outward on its
own: fix a token → every component using it updates → every screen using those
components updates. Fix the center once; the fix reaches the edge by itself.

Consequences that drive the whole program:

- **Order is inside-out and forced.** Tokens → components → screens. You cannot
  make the outer doll splendid while the inner one is rotten; that work is
  thrown away when the inner doll is fixed.
- **Healthy = points inward.** A token-driven component, a component-built
  screen — leave them alone.
- **Rot = broke the chain.** A hardcoded value, a parallel component set, a
  hand-written showcase page dressed to look right — these are outside the
  cascade, so a token fix never reaches them. They are the real problems.
- **The sin is dressing the outer doll instead of fixing the inner one.** If a
  screen looks wrong, fix the token/component beneath; don't patch the screen.

## 3. Why now — the gap

The UI was built through many passes, each fixing the symptom at whatever layer
someone was standing in. Drift now sits at **every** layer. Another pass on top
adds accretion; it does not clean the chain. So we stop, uplevel, and rebuild the
reference chain from the center.

## 4. The law (binding rules)

- **North stars: 2026 Material 3 (M3), Apple HIG, OpenAI UI.** "2026 best practice" is pinned to these three — token-first, accessible, *engineered* systems, not painted ones. Every audit's modern lens (loop step c, §9) measures clickeen against them, not against a vibe. clickeen's color is already world-class because it was seeded from Apple's source colors + OKLAB; the same sourcing discipline applies to every domain. They define the bar — 126 is converge-to-the-bar.
- **Original source only — never Reddit, Stack Overflow, or "how to build X UI" blogposts.** Reference Google / Apple / OpenAI *directly*. Those secondhand sources are the old, over-upvoted, contaminated distribution that caused the dated-UI problem — lossy interpretations that teach the *look*, not the *system*. Reading them re-injects the median we're eradicating and produces cargo-cult UI: the appearance without the engineering, exactly Roma's parallel `.roma-*` failure. An AI or audit left to "research modern UI" drifts there by default; this tenet forces the harder, correct path — the actual source.
- **Dieter is the only design system.** No parallel component system.
- **Design freeze.** Current layouts are the frozen baseline; no new visual
  language; ported screens match what exists. DevStudio's migrated page
  fragments and dependent CSS are the Appendix A hash-frozen baseline. A 126
  execution change requires an exact accepted gap, visual evidence, and product
  owner approval; the migration freeze is not permission for an unreviewed
  redesign. *(Source: Migration PRD §3.6 + Appendix A.)*
- **Reveal, never masquerade.** DevStudio shows Dieter's true state; it must be
  structurally incapable of dressing it up.
- **By reference, not copy.** Every doll points inward; nothing hardcodes a value
  its inner doll already owns.
- **No new framework.** We converge; we don't rebuild.
- **No invented product behavior** to fill a UI gap.

The authority grounding and product-owner convergence are complete. D1 defines
dialog dismissal, D2 defines global operational workspace capability, and D3
keeps Upgrade entry points connected to one honest pre-GA upsell dialog
scaffold. These accepted decisions in
`126__Product_Owner_Execution_Decisions.md` now govern domain doctrine and the
frozen execution contracts.

## 5. Authority (who owns what)

| Concern | Owner | Verify |
| --- | --- | --- |
| Tokens | `dieter/tokens/*` | compiled/materialized directly by each consumer |
| Components | `dieter/components/*` | stencil + spec + CSS |
| DevStudio reveal + token guard | `admin/*` | write lane: Migration §3.5 |
| Roma screens / routes / save | `roma/*` | Roma product law unchanged |
| Visual design / layout | Product owner (frozen) | — |

Authority chains are confirmed against current architecture/service docs and
runtime code: Roma owns current-account application routes, Berlin owns
session/account context, Tokyo owns account product operations, Dieter source
owns design-system truth, and DevStudio's token write lane remains the
Berlin-session/account-verified GitHub commit path from Migration §3.5.

## 6. Scope

**In:** the 11 kb domains (126A–126K, mirroring `engineering/UI/`) + DevStudio UI
refactor (126L) + Roma UI refactor (126M).

**Out:** any redesign; new product features; backend / route changes; other
surfaces (Prague, etc.); token authoring-as-a-feature.

## 7. The domain PRD series — order

One PRD per `engineering/UI/` kb doc, in **dependency order** (not alphabetical);
DevStudio UI and Roma UI last. Production order (audits + PRDs) follows this
table; **execution stays inside-out and gated** (§9).

| PRD | Domain |
| --- | --- |
| 126A | accessibility |
| 126B | color |
| 126C | iconography |
| 126D | typography |
| 126E | interactions |
| 126G | ops |
| 126F | motion |
| 126H | dieter (system + foundation) |
| 126I | components (the pivot) |
| 126J | surfaces |
| 126K | dialogs-and-modals |
| 126L | DevStudio UI refactor |
| 126M | Roma UI refactor |

**126I components is the pivot.** Domains 126A–126H feed the library; 126J surfaces
and 126K dialogs-and-modals are built on / consume it. Then the screens.

**DevStudio UI (126L) and Roma UI (126M) are last** because they are the
outermost consumers of Dieter and the UI doctrine beneath them. DevStudio and
Roma are sibling consumers; neither is the other's runtime dependency.
DevStudio is planned first because it reveals and governs Dieter source, then
Roma consumes the same settled Dieter contracts as the customer account shell.

## 8. What must not happen

- No redesign or new visual language.
- No parallel component system left behind. App-specific layout/composition
  classes may remain; local classes that duplicate Dieter-owned controls,
  reusable table appearance, or shared dialog mechanics must go. Do not rename
  legitimate `.roma-*`/`.rd-*` layout classes merely to satisfy a grep count.
- No masquerade in DevStudio.
- No invented product behavior.
- **No "fix" that silently changes the look.** Historical numeric radius
  aliases were already removed in premature code changes. Current law is
  `--control-radius-*`; do not restore aliases from stale audit text. Every
  visual change still needs explicit approval and before/after evidence.
- No one-pass or parallelized execution across layers.

## 9. Pre-Execution And Execution Process

**Human-confirmed process authority (2026-07-14):** steps 1–8 for every A–M
domain are pre-execution. Auditing code, verifying remote state, researching,
converging product law, updating doctrine, writing final PRDs, and peer-reviewing
those exact PRDs are all pre-execution. Step 9 is the only execution phase.

Code or product-data changes that land before every A–M domain reaches step 8 do
not become execution retroactively. They become current as-built input that
pre-execution must re-audit against the final human-approved program. Verification
of those premature changes is also pre-execution and gives them no completion
credit.

Two phases. **Plan everything first; execute once at the end.**

- **Phase 1 — Pre-execution (steps 1–8 for every A–M domain).** All audits,
  remote-state verification, research, human convergence, doctrine, gap-audits,
  final PRDs, and peer reviews done for *every* domain in §7 before any code changes.
- **Phase 2 — Execute (step 9), once.** Only when all PRDs are maniacal-detail and
  peer-reviewed. Runs inside-out and gated (tokens → components → screens),
  splendid bar at each layer.
- Why plan-all-then-execute: planning is cheap and reversible; code is expensive
  and forces rework when later planning changes it. The domains are a dependency
  graph and the screen PRDs consume every domain — so resolving the whole graph on
  paper first means execution never reworks settled ground, and the codebase shifts
  old → new in one controlled pass, not a half-refactored intermediate.
- One step at a time; green (named evidence) before the next.
- **Splendid bar at each layer, verified, before the layer above may build on it.**
- Proof is visual: before/after browser screenshots. Green lint is not enough.
- Docs are part of done — design-system truth lands in `documentation/engineering/UI/` (§12); service-level truth in `services/*.md`.
- Every subPRD names exact files, shapes, invariants, a V1–V8 audit,
  verification, and a Done list — the 124/125 bar.
- Start from clean git; commit doc work with explicit pathspecs.

### Per-domain method (steps 1–9) — Phase 1 runs steps 1–8 for every domain; step 9 runs once at the end

Every domain (dependency order, §7) runs steps 1–8 in Phase 1. Only after **every** domain reaches step 8 does step 9 (execute) begin — once, inside-out. (Steps are numbered 1–9 so they never collide with the A–M subPRD letters.)

- **1. As-built audit — Codex + GLM each write their own (independent).** Two independent passes read the code and state current reality. They stay separate; **no AI converges them.** Factual gathering → independent dual-pass for coverage and hallucination-catch (the as-built is the foundation everything builds on, and "state what exists" is the top hallucination surface). (*Code owns current reality*.)
- **2. Baseline / directional PRD — Codex authors; GLM appends a feedback addendum.** Codex writes the baseline PRD (current reality + known gaps + proposed Clickeen standard where human direction is already known). GLM reads it and writes a critique addendum. One coherent PRD + its adversarial review, not two competing drafts. Sequences **Codex-author → GLM-review.** (*Directional draft, not final execution authority*.)
- **3. Source research — Codex + GLM each write their own (independent).** Two independent passes fetch what M3, Apple HIG, and OpenAI UI do for this area, from the primary sources only (`research/126X_Research_*.md`). They stay separate; **no AI converges them.** (*Google/Apple/OpenAI own the external reference*.)
- **4. Human converges 1/2/3 into the Clickeen standard.** The human reconciles the two as-builts, the baseline PRD + its addendum, and the two research passes into the decided Clickeen law for that UI domain. **AIs never converge — this is product judgment, human lane only.** The output is not a vague decision surface; it is the standard agents must later code against.
- **5. Consolidate into doctrine.** The decided standard becomes Clickeen UI doctrine, written into the kb doc (`engineering/UI/X.md`), current → target. *Dieter kb docs own Clickeen UI truth.*
- **6. Re-audit the code against the doctrine.** Gap audit — exact files/lines that violate or fail to implement the standard. Lives in `audits/126X__Audit__*.md`.
- **7. Final executable PRD.** From current state + doctrine + gaps — an executable gap-fix plan, not vibes, research notes, or an ideal-system rewrite.
- **8. Peer review.** Attack omissions.
- **9. Execute** — once, after every domain has reached step 8. Inside-out and gated; splendid bar at each layer; visual before/after proof.

**Authority lanes (held through every step):** code → current reality (step 1) · Google/Apple/OpenAI → external reference (step 3) · human → product judgment (step 4) · Dieter kb docs → clickeen UI truth (step 5) · final PRD → execution (steps 7/9). Keeping each authority in its lane is the 124/125 discipline and the no-invented-machinery tenet.

**The gate is absolute: no code or product-data mutation before ALL domain PRDs
(steps 1–8 for every domain) are human-converged, maniacal-detail, and peer-reviewed
at an exact recorded commit/tree. Read-only verification remains pre-execution.**

Every domain PRD must be judged against the four-part 126 loop: standard
decided, codebase gaps identified, fix categories mapped, deterministic agent
docs specified. A PRD that only says "later decide" is not done once human
direction is known.

## 10. Parent acceptance — the deterministic-bottom-up bar

This is not a taste bar. In 126, "splendid" means deterministic, source-owned,
gap-fixed, and documented so future agents know exactly how to code UI without
inventing.

The program is done when:

- Every domain has a decided Clickeen standard, owned by human product judgment
  and grounded in the correct source authorities.
- Every gap between the decided standard and the codebase is identified by file,
  line, behavior, and owning layer.
- Every approved gap is fixed in the correct inner-doll layer: tokens before
  components, components before screens.
- Every **token** is complete, intentional, referenced by name, and free of
  undefined/dead/duplicate contract drift.
- Every **component** consumes tokens and documented component contracts; no
  local hardcoded values, state recipes, or parallel behavior when Dieter owns
  the rule.
- **DevStudio UI** reveals true Dieter state and write authority; it cannot
  masquerade as editing or supporting UI truth it does not own.
- **Roma UI** has no parallel component system; screens consume Dieter
  components/shared primitives and expose loading/empty/error/status states
  through the decided standards.
- The living docs in `documentation/engineering/UI/` tell future agents the
  deterministic rules: allowed patterns, forbidden patterns, source authority,
  human-owned decisions, and out-of-scope drift.
- Visual parity is held throughout unless the human explicitly approves a
  visual change. This is not a redesign.
- V1–V8 is green on every subPRD and final execution pass.

## 11. Doc tree (structure to work on)

```text
126__PRD__UI_Optimization_Program.md        (this MAMA)
126A__PRD__Accessibility.md
126B__PRD__Color.md
126C__PRD__Iconography.md
126D__PRD__Typography.md
126E__PRD__Interactions.md
126F__PRD__Motion.md
126G__PRD__Ops.md
126H__PRD__Dieter.md
126I__PRD__Components.md
126J__PRD__Surfaces.md
126K__PRD__Dialogs_and_Modals.md
126L__PRD__DevStudio_UI.md                  (screen refactor — second-to-last)
126M__PRD__Roma_UI.md                       (screen refactor — last)
audits/
  README.md                                 (the audit bar)
  126X__Audit__<domain>.md                  (one real audit per domain, in dependency order)
```

## 12. Permanent home for UI design-system truth (`documentation/engineering/UI/`)

The execution-pipeline PRDs (this folder) are **temporary** — they get archived
to `03-Executed/` when the program ends, and PRD history is not current docs
(per PRD 125's docs-sync rule). The permanent living home already exists at
**`documentation/engineering/UI/`**. This program corrects and completes that
current authority; it does not invent a second documentation surface.

- **Docs-sync target for every domain.** Each domain's "docs are part of done"
  lands design-system truth here. The locked set (seeded 2026-06-27, each driven
  by its domain PRD): `README.md` (index), `dieter.md` (system), `color.md`,
  `typography.md`, `motion.md`, `iconography.md`, `accessibility.md`,
  `components.md`, `dialogs-and-modals.md`, `interactions.md`, `ops.md`,
  `surfaces.md`. Service-level truth still lands in
  `services/*.md`; `engineering/UI/` holds the cross-cutting design-system truth.
- **Reference PRDs graduate into it.** A reference PRD like `126B` (color) is the
  *working* version; its content becomes the canonical living doc
  (`documentation/engineering/UI/color.md`), and the PRD then links to it.
- **One source of truth (by-reference law).** The living doc is canonical; PRDs
  link to it, they do not duplicate it — so the two cannot drift.
- **Declared truth for an agent-operated system.** clickeen is agent-operated;
  agents operate only declared truth. Undeclared UI truth is what lets every
  future agent revert to the corpus median (hand-picked hex, parallel systems).
  `engineering/UI/` is the declared-truth surface that prevents that recurrence.

## 13. Pre-Execution Closure And Step-9 Start

1. Complete: D1/D2/D3 are accepted in
   `126__Product_Owner_Execution_Decisions.md` (step 4).
2. Complete: every A-M domain has reconciled its settled product law into the
   owning living doctrine (step 5).
3. Complete: every A-M domain has a current-source audit with exact mismatch,
   blast-radius, and deletion ownership (step 6).
4. Complete: every A-M domain has a final executable PRD with bounded files,
   checks, proof, and non-scope (step 7).
5. Complete: every A-M domain is peer-reviewed GREEN at an exact tree (step 8):
   A `c06fa7db`; B `4b480e50`; C `b5efaefc`; D `31b81152`; E `ec1ed486`;
   F/G/H `4c5458b4`; I/J/K/L/M `22a92ec9`.
6. Complete: 126A through 126M completed Step 9 in the accepted dependency
   order, including 126G before 126F. Every slice advanced only after its code,
   product-data where applicable, deploy/runtime, documentation, and V1-V8
   gates were GREEN.
