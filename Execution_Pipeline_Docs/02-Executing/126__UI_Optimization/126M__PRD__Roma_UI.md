# 126M - PRD: Roma UI And Final Workspace Integration

Status: PRE-EXECUTION STEPS 6-8 COMPLETE - exact-tree three-lens review GREEN at
`22a92ec9`; no Step-9 execution credit.
Parent: `126__PRD__UI_Optimization_Program.md`.
Audit: `audits/126M__Audit__Roma_UI.md`.
Service authority: `documentation/services/roma.md`.

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

## Current Source Truth

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

1. Load the generated operational-field and operational-table CSS from the
   existing Tokyo Dieter root in `roma/app/layout.tsx`.
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
   SHA. Verify the Dieter manifest records the latest commit that affected
   Dieter/build inputs, that commit is an ancestor of final `main`, and the
   manifest/artifact bytes are the ones consumed by the final app deployments.
6. Reconcile Roma/Bob/DevStudio and UI living docs.

## Exact Blast Radius

### Edit

| File | Change |
| --- | --- |
| `roma/components/roma-shell.tsx` | One drawer state/trigger/scrim and portrait boundary. |
| `roma/components/roma-nav.tsx` | Delete compact duplicate-tree branch; keep one nav. |
| `roma/app/roma.css` | Full/Compact/unsupported shell; operational-class adoption cleanup; dead Widget Defaults deletion. |
| `roma/app/layout.tsx` | Load two generated Dieter CSS contracts and add viewport-fit support. |
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

- `e2e/roma/ui-contract.spec.ts` for Roma shell, field/table, table-overflow,
  and final cross-app integration proof.

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
E2E_BASE_URL=https://roma.dev.clickeen.com pnpm exec playwright test e2e/roma/ui-contract.spec.ts e2e/widgets/bob-workspace-capability.spec.ts e2e/widgets/dialog-contracts.spec.ts
E2E_BASE_URL=https://devstudio.clickeen.com E2E_AUTH_STATE=e2e/.auth/devstudio.json pnpm exec playwright test e2e/devstudio/route-contract.spec.ts e2e/devstudio/dialog-contracts.spec.ts e2e/devstudio/ui-contract.spec.ts
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
SHA. Dieter evidence uses its latest owning commit, proves ancestry to final
`main`, and reads back the manifest/artifacts consumed by the apps. No direct
product-data mutation belongs to 126M.

## Non-Scope

- Shared React UI/shell/form/table framework.
- Domain rewrites or file splitting.
- Table data, sorting, pagination, policy, or API changes.
- New Roma/Bob translation state or stale-translation banner.
- Billing implementation.
- Mobile-specific domain screens.

## V1-V8 Pre-Execution Audit

| ID | Result | Reason |
| --- | --- | --- |
| V1 | PASS | Roma continues to render route/account truth; no fallback state is invented. |
| V2 | PASS | No account/product data is normalized or rewritten. |
| V3 | OPEN UNTIL STEP 9 | One nav, all fields, nine tables, dead CSS, all modes, prior dialogs, deploy, and docs require proof. |
| V4 | OPEN UNTIL STEP 9 | Compact navigation and existing command/policy gates must stay fail-closed. |
| V5 | PASS | No corrupt persistence state is interpreted. |
| V6 | OPEN UNTIL STEP 9 | Roma-only success cannot stand in for final Roma/Bob/DevStudio integration. |
| V7 | OPEN UNTIL STEP 9 | Duplicate nav and dead visual/control CSS must be deleted, not renamed. |
| V8 | PASS | Runtime shell/CSS own behavior; tests only verify it. |
