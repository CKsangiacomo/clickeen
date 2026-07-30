# 126M - PRD: Roma UI And Final Workspace Integration

Status: ORIGINAL M1-M4 COMPLETE; ROMA CONVERGENCE IMPLEMENTED LOCALLY; FINAL
DEPLOYED/PRODUCT-OWNER VERIFICATION PENDING.
Parent: `126__PRD__UI_Optimization_Program.md`.
Audit: `audits/126M__Audit__Roma_UI.md`.
Service authority: `documentation/services/roma.md`.

## 2026-07-30 Roma Convergence Correction

The original M1-M4 evidence remains valid for its executed scope. At correction
start, Roma still owned hardcoded `.roma-layout*` and `.roma-modal*` visual
bases and used `operational-table`. The local D4 implementation now replaces
those bases with final Dieter Layout, Page, Table, and Popup contracts; deployed
and product-owner verification remain pending.

### Exact Adoption

`RomaShell` must render:

```html
<div class="main-container" data-navigation-open="true|absent">
  <aside class="left-nav">the existing one RomaNav tree</aside>
  <main class="page">current Roma route content</main>
</div>
```

Roma compiles the exact Dieter
`layouts/main-container/main-container.css` source. Roma retains its one-nav
state, route tree, current-route behavior, headers, domain content, and product
operations. Dieter owns the three layout classes and visual composition.

Roma routes adopt the same Page foundation:

- the domain title/description/action band becomes `.page__header`;
- the action container becomes `.page__actions`;
- the route body becomes `.page__content`;
- `.page` remains the single outer padding/scroll owner.

Roma may retain domain-specific `rd-*` classes inside `.page__content`, but
they must not restate the shared outer header/content/padding/scroll contract.

Roma adopts the shared initial `13.75rem | minmax(0, 1fr)` Full geometry, `100dvh`,
nav-owned scrolling/padding, page-owned outer scrolling/padding, and shared
Compact presentation from the parent contract. It does not retain its current
`clamp(232px, 16vw, 264px)` width. Domain-owned `rd-*` composition remains
unless a named rule is proven to duplicate the new page's outer padding or
scroll ownership.

All semantic Roma tables replace `.diet-operational-table*` with
`.diet-table`/`.diet-table__table`. Columns, data, actions, editing, selection,
loading/error meaning, and policy stay with their domains.

All blocking Roma dialogs replace `.roma-modal*` base presentation with
`.diet-popup*`. The existing shared lifecycle and every accepted workflow
dismissal/persistence rule remain unchanged.

### Deletion Boundary

In the same migration:

- delete `.roma-layout*` base layout selectors/declarations replaced by Dieter;
- delete `.roma-modal*` base visual selectors/declarations replaced by Popup;
- delete every operational-table selector/import;
- delete local table/popup/layout base rules now owned by Dieter;
- retain only domain-specific composition that is not covered by the shared
  contracts;
- replace outer `.rd-domain`, `.rd-header`, and `.rd-canvas` responsibilities
  with the shared Page selectors while retaining only proven domain-specific
  descendant composition;
- do not leave aliases, dual classes, wrappers, or old/new media branches.

Bob remains `ToolDrawer | Workspace`; Roma must not rename or restyle Bob's
`Workspace` through this layout correction. Applicable Bob Table/Popup
consumption is verified as a separate consumer boundary.

No Roma API, Berlin session, Tokyo operation, account/product data, route,
translation, locale, save, publish, policy, entitlement, or Builder command
behavior changes. No R2 or Supabase mutation belongs to this correction.

Correction acceptance requires focused checks plus exact-SHA deployed browser
proof for every affected Roma route and applicable Bob path, preservation of
all domain operations, zero replaced selector hits, current-doc reconciliation,
and independent V1–V8 recorded in `126_DevQA.md`.

## Purpose

Finish Roma's simple operational shell and adopt the small shared field/table
visual contracts without changing account operations, domains, data, routes,
or Builder authority. Delete proven dead local controls instead of wrapping or
renaming them. Then run the final integrated workspace proof across Roma, Bob,
and DevStudio.

This is not a Roma redesign, generic UI framework, domain split, table engine,
form engine, state framework, or mobile product variant.

## Dependencies And Exclusive Ownership

- 126I supplies fixed selectors: `.diet-operational-field`,
  `.diet-operational-table`, and `.diet-operational-table__table`.
- 126J owns Bob Full/Compact/unsupported behavior. 126M does not edit Bob's
  workspace implementation.
- 126K owns all D1 dialog migrations, the Roma upsell scaffold, Bob intent
  bridge behavior, and deletion of in-app `window.confirm`.
- 126L owns DevStudio UI.
- 126M owns only Roma shell/navigation and Roma field/table/dead-CSS adoption,
  followed by integrated proof.
- Execution order is I -> J -> K -> L -> M.

## Authority Map

| Concern | Authority |
| --- | --- |
| Account/session/policy | Berlin bootstrap and Roma server routes, unchanged |
| Roma shell/navigation/domain layout | Roma |
| Bob editing state and translation panel | Bob, unchanged by 126M |
| Shared field/table appearance | Dieter 126I CSS |
| Field values, labels, validation, table data/actions | Owning Roma domains |
| Dialog lifecycle and upsell | Completed 126K behavior |
| Account storage/public runtime | Tokyo, outside scope |

## Product Contract

- Full mode: one persistent narrow Roma navigation beside the flexible domain
  work area.
- Tablet portrait and landscape remain Full and touch-operable.
- Compact mode: one menu icon button opens that same navigation DOM as an
  overlay drawer; the domain work area uses the viewport.
- Unsupported mobile portrait: explicit `Rotate your device or use a larger
  screen` boundary.
- Domain routes, settings hierarchy, operations, tables, and data remain the
  same in every supported mode.
- Tables retain all columns and scroll horizontally inside the Dieter wrapper;
  they are not rewritten as cards.
- Bob remains the editor inside Roma. Translation attention remains only in
  Bob's Translations panel beside Tokyo's authoritative state.

Use 126J's classifier exactly: Full is default at at least `600px` usable inline
and block size; Compact below either dimension; coarse-pointer portrait below
`600px` shows the unsupported boundary. Use dynamic viewport units and safe
areas. No UA sniffing or device registry.

## Execution Starting Point

- `RomaShell` renders persistent navigation plus a second inline `<details>`
  compact navigation tree.
- `roma.css` hides the persistent navigation below `980px`, incorrectly
  collapsing tablets and exposing an inline menu rather than an overlay drawer.
- `.roma-layout--focus` has no current consumer.
- `RomaNav` has a `compact` branch solely for the duplicate navigation tree.
- Nine semantic tables use `.roma-table`: four Pages, two Assets, two Team, and
  one Widgets table.
- Ordinary text/select controls are spread across Pages, Widgets, Team, Team
  Member, Profile, Settings, and Account Locale Settings.
- `.roma-input`, `.roma-select` absence, `.roma-instance-rename__input`, and
  `.roma-table` create inconsistent or duplicated visual bases.
- `.widget-defaults-fields`, `.widget-defaults-field*`,
  `.widget-defaults-input`, and `.widget-defaults-textarea` have no runtime
  consumers. The live compiled controls are Bob/Dieter-owned.
- `.widget-defaults-builder-fields` and its ToolDrawer host composition are
  active and must remain.
- 126K, executed earlier, owns Roma/Bob dialogs, two unsaved confirmations, and
  Upgrade-to-upsell behavior. 126M only verifies their survival.

## Execution Slices

### M1 - One Roma Navigation Tree

1. Make `RomaShell` the small client owner of drawer open state, opener focus,
   Escape close, scrim close, and portrait boundary.
2. Keep one `RomaNav` instance in the existing aside. In Compact mode CSS moves
   that same aside into the overlay drawer.
3. Add one menu icon button in the header with accessible name,
   `aria-expanded`, and `aria-controls`.
4. Remove `RomaNav.compact`, the second inline `<details>` tree, and
   `.roma-nav--compact`.
5. Replace the generic `980px` branch with 126J's Full/Compact/unsupported
   predicates.
6. Delete dead `.roma-layout--focus`; use `100dvh`, explicit overflow ownership,
   safe-area padding, and viewport-fit support.

Green gate: one navigation tree, complete tablet workspace, reachable compact
drawer, route change without hidden controls, and no portrait approximation.

### M2 - Operational Fields And Nine Tables

1. Use Roma's existing direct `dieter/styles.css` source import in
   `roma/app/layout.tsx`; do not add another CSS delivery path.
2. Put `.diet-operational-field` directly on ordinary operational text inputs,
   selects, and textareas in:
   - `pages-domain.tsx`;
   - `widgets-domain.tsx` rename input;
   - `team-domain.tsx`;
   - `team-member-domain.tsx`;
   - `profile-domain.tsx`;
   - `settings-domain.tsx`;
   - `account-locale-settings-card.tsx`.
3. Do not apply it to checkboxes or hidden file inputs.
4. Wrap all nine tables in `.diet-operational-table` and put
   `.diet-operational-table__table` on each semantic `<table>` in Pages,
   Widgets, Assets, and Team.
5. Preserve domain-specific cell actions, selected rows, editable cells,
   column content, loading/error state, and all operations.
6. Delete `.roma-input` and `.roma-table` visual bases. Keep only true local
   composition such as rename layout; remove duplicated rename appearance.

Green gate: all current operations remain reachable; every table retains all
columns and scrolls rather than reflowing into cards.

### M3 - Proven Dead CSS Deletion

Delete the complete unused hand-written Widget Defaults control family:

- `.widget-defaults-fields`;
- `.widget-defaults-field` and descendants/modifiers;
- `.widget-defaults-input` and focus rules;
- `.widget-defaults-textarea`.

Preserve `.widget-defaults-builder-fields`, group/host layout, error surfaces,
and all current compiled Bob/Dieter control behavior.

Green gate: current Widget Defaults still renders and edits every compiled
control; no deleted selector has a source consumer.

### M4 - Final Integrated Proof

1. Run Roma lint/typecheck/build and focused UI tests.
2. Run the complete 126I/J/K/L focused suites against the final source SHA.
3. Prove Roma navigation, Bob ToolDrawer, and DevStudio navigation at the shared
   viewport matrix, including orientation changes, touch/keyboard access,
   dialogs, table overflow, and no hidden commands.
4. Regress 126K's plan-prompt-to-upsell and real Bob `bob:upsell` bridge without
   `/billing` navigation or discard confirmation.
5. Verify Git-connected Roma, `bob-dev`, and DevStudio Pages at the final source
   SHA. Verify each app deployment compiles the Dieter source from that commit
   and no generated Dieter runtime or shared CSS/JavaScript request returns.
6. Reconcile Roma/Bob/DevStudio and UI living docs.

## Exact Blast Radius

### Edit

| File | Change |
| --- | --- |
| `roma/components/roma-shell.tsx` | One drawer state/trigger/scrim and portrait boundary. |
| `roma/components/roma-nav.tsx` | Delete compact duplicate-tree branch; keep one nav. |
| `roma/app/roma.css` | Full/Compact/unsupported shell; operational-class adoption cleanup; dead Widget Defaults deletion. |
| `roma/app/layout.tsx` | Preserve direct `dieter/styles.css` source compilation and add viewport-fit support. |
| `roma/components/pages-domain.tsx` | Operational fields; wrap four tables. Preserve K dialog changes. |
| `roma/components/widgets-domain.tsx` | Rename field; wrap one table. Preserve K upsell/dialog changes. |
| `roma/components/assets-domain.tsx` | Wrap two tables. Preserve K upload dialog behavior. |
| `roma/components/team-domain.tsx` | Operational fields; wrap two tables. |
| `roma/components/team-member-domain.tsx` | Operational field. |
| `roma/components/profile-domain.tsx` | Operational fields. |
| `roma/components/settings-domain.tsx` | Operational select. |
| `roma/components/account-locale-settings-card.tsx` | Operational base-locale select; leave checkboxes native. |
| `documentation/services/roma.md` | Record delivered shell and visual-contract behavior. |
| `documentation/services/bob.md`; `documentation/services/devstudio.md`; UI docs | Final integrated reconciliation only. |

### Add

- None. The deployed browser matrix is one-off verification, not runtime or
  permanent test machinery.

### Delete In Place

- inline `<details className="roma-nav-drawer">` and duplicate compact nav;
- `RomaNav.compact` and `.roma-nav--compact`;
- `.roma-layout--focus`;
- entire generic `@media (max-width: 980px)` block;
- `.roma-input` and `.roma-table` visual bases;
- duplicated `.roma-instance-rename__input` appearance, retaining layout only;
- unused Widget Defaults control selectors listed in M3.

### Do Not Touch

- Roma API routes, Berlin, Tokyo, San Francisco, Supabase, R2 account data, or
  public runtimes;
- account/session/policy, save, publish, translation, or locale operations;
- Bob workspace source owned by 126J;
- 126K dialog/upsell/unsaved-work implementation except for preserving and
  testing it while adding classes in the same domain files;
- DevStudio source owned by 126L;
- domain file structure solely because files are large;
- local cards, modules, toolbars, grids, labels, validation, and domain layout
  that do not duplicate an accepted Dieter contract.

## Verification

```bash
pnpm --filter @clickeen/roma lint
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/roma build:cf
pnpm --filter @clickeen/roma test:widget-command-gates
E2E_BASE_URL=https://devstudio.clickeen.com E2E_AUTH_STATE=e2e/.auth/devstudio.json pnpm exec playwright test e2e/devstudio/route-contract.spec.ts
```

Browser matrix:

| Viewport | Expected |
| --- | --- |
| `1440x900` | Full Roma, Bob, and DevStudio workspaces. |
| `768x1024` | Full tablet portrait workspaces. |
| `1024x768` | Full tablet landscape workspaces. |
| `844x390` | Compact overlay drawers and complete work areas. |
| `390x844` | Unsupported portrait boundaries. |
| `600x960` | Full boundary behavior. |

Deploy evidence requires Roma, `bob-dev`, and DevStudio Pages at the final source
SHA. Each app compiles Dieter source from the repository; deployed network proof
must show no generated Dieter runtime manifest or shared CSS/JavaScript request.
Icon SVG requests remain the intentional CDN lane. No direct product-data
mutation belongs to 126M.

## Non-Scope

- Shared React UI/shell/form/table framework.
- Domain rewrites or file splitting.
- Table data, sorting, pagination, policy, or API changes.
- New Roma/Bob translation state or stale-translation banner.
- Billing implementation.
- Mobile-specific domain screens.

## Execution Evidence

- M1 commits: `2871a679` and specificity fix `274722d7`.
- M2 commit: `aaaebc40`; 19 source control sites and all nine semantic table
  definitions use the existing Dieter operational contracts. The slice was
  subtractive: 82 additions and 117 deletions.
- M3 commit: `61317dbb`; 82 proven-dead Widget Defaults CSS lines deleted with
  zero additions.
- Dieter, Bob, Roma, and DevStudio typecheck/lint/build gates: GREEN.
- Dieter governance, all eight widget contracts, Roma Cloudflare build, and
  Roma widget-command/upsell gate: GREEN.
- Existing deployed DevStudio route contract: 33/33 GREEN.
- Deployed browser matrix: Roma and DevStudio Full at `1440x900`, `768x1024`,
  `1024x768`, and `600x960`; Compact at `844x390`; unsupported portrait at
  `390x844`. Hosted Bob Full and Compact use one ToolDrawer; Bob portrait shows
  the unsupported boundary.
- Deployed Roma operational tables/fields, five DevStudio Policy Editor tables,
  and two DevStudio token-editor fields: GREEN.
- Real Bob `bob:upsell` message to Roma scaffold: GREEN; no Billing navigation
  and no discarded Builder work.
- Git-connected Cloudflare Pages deployments at `61317dbb`: Roma
  `e26e1db5-909a-45ac-934b-7dd491780127`, Bob
  `8cdcfb83-6d3d-4317-990c-f49d2f4741ed`, and DevStudio
  `7c543a94-b00f-48b8-bc07-161d2b21d2a0`, all `deploy: success`.
- GitHub Roma app verification run `30291294567` and cloud-dev surface
  reachability run `30291538676`: GREEN.
- Deployed network proof found no generated Dieter manifest/shared CSS/JavaScript
  requests; Bob requested only intentional Dieter icon SVGs.
- No product data, Worker, R2, Supabase, translation, publish, or locale
  operation changed.

## V1-V8 Execution Audit

| ID | Result | Reason |
| --- | --- | --- |
| V1 | PASS | Roma continues to render route/account truth; no fallback state is invented. |
| V2 | PASS | No account/product data is normalized or rewritten. |
| V3 | PASS | One nav, all fields, nine tables, dead CSS, all modes, prior dialogs, deploy, and docs were proven. |
| V4 | PASS | Compact navigation and existing command/policy gates remain fail-closed. |
| V5 | PASS | No corrupt persistence state is interpreted. |
| V6 | PASS | Roma, Bob, and DevStudio all passed source, deploy, and browser verification. |
| V7 | PASS | Duplicate navigation and dead visual/control CSS were deleted rather than renamed. |
| V8 | PASS | Runtime shell/CSS own behavior; tests only verify it. |
