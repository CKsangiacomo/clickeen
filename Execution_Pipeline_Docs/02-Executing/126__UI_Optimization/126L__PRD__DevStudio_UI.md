# 126L - PRD: DevStudio UI

Status: PRE-EXECUTION STEPS 6-7 COMPLETE - current DevStudio shell, source
reveal, token editor, policy pages, generated routes, and build boundary are
audited; exact execution scope is pinned; Step-8 review pending; no Step-9
execution credit.
Parent: `126__PRD__UI_Optimization_Program.md`.
Audit: `audits/126L__Audit__DevStudio_UI.md`.
Service authority: `documentation/services/devstudio.md`.

## Purpose

Make DevStudio a complete operational cockpit across supported workspaces while
preserving its current source-derived governance model. DevStudio keeps one
narrow left navigation and one flexible work area. It adopts only the small
Dieter field/table contracts and the completed 126K dialog lifecycle.

This is not a redesign, customer admin app, shared shell framework, policy
rewrite, or new token-management system.

## Dependencies

- 126I supplies `operational-field`, `operational-table`, and `tooltip` CSS.
- 126J pins the global Full/Compact/unsupported workspace classifier.
- 126K supplies native dialog lifecycle and has already migrated the token
  editor behavior before 126L changes its visual classes.
- The execution order is I -> J -> K -> L.

## Authority Map

| Concern | Authority |
| --- | --- |
| DevStudio shell/navigation/workspace | `admin/src/main.ts` and local CSS |
| Generated route inventory | `admin/src/html/**`, generators, and `routes.ts` |
| Current generated truth | 3 foundation / 22 component / 2 Policy routes |
| Token reads/writes | Existing validated Pages Functions |
| Policy reads/writes | Existing Entitlements/LLM Pages Functions and contracts |
| Reusable visual fields/tables | Dieter 126I CSS contracts |
| Token-editor dialog mechanics | 126K helper; DevStudio retains dirty/source-commit state |
| Auth | Berlin -> DevStudio session finish |

## Product Contract

- Full mode: persistent `220px` sidebar and flexible work area.
- Tablet portrait and landscape remain Full and touch-operable.
- Compact mode: one menu icon button opens the same sidebar as an overlay
  drawer over a full-width work area.
- Unsupported mobile portrait: explicit `Rotate your device or use a larger
  screen` boundary.
- Mode changes occur without reload and preserve the current hash route.
- All 3/22/2 routes, policy operations, token commit behavior, and generated
  source relationships remain unchanged.

Use 126J's classifier exactly: Full is default at at least `600px` usable inline
and block size; Compact below either dimension; coarse-pointer portrait below
`600px` shows the unsupported boundary. Use dynamic viewport units and safe
areas. Do not add UA sniffing or a device registry.

## Current Source Truth

- `main.ts` builds the static/hash shell and its navigation at runtime.
- `layout.css` moves the sidebar off-screen below `960px` but no current trigger
  or state can open it.
- Dead collapsed-sidebar selectors and width tokens survive without runtime
  ownership.
- `tokens.css`, `main.ts`, and `index.html` duplicate token/font delivery.
- `main.ts` and `tokens.css` currently import Dieter tokens twice; `index.html`
  already owns the Google font link.
- Token-editor input/select appearance is local duplication and utilities use
  an undefined `--shadow-lg` with fallback.
- Entitlements and LLM Management duplicate table base CSS while needing their
  policy-specific widths, density, sticky behavior, and cell composition.
- Entitlements retains a raw orange fallback even though the Dieter token
  exists.
- 126I owns the stale 20/1 route test correction; 126L does not create another
  route inventory.

## Execution Slices

### L1 - One Complete DevStudio Shell

1. Add a stable sidebar id, compact menu button, scrim, open state, Escape
   close, link-selection close, initial drawer focus, and opener focus return in
   `main.ts`.
2. Render the portrait boundary once at shell construction.
3. Replace the generic `960px`/`640px` branches with 126J's Full/Compact/
   unsupported predicates.
4. Preserve the sidebar at `220px` in Full mode. Compact mode overlays that same
   navigation; it does not create another nav tree.
5. Use `100dvh`, overflow ownership, and safe-area padding.
6. Add `viewport-fit=cover` to the existing viewport metadata.

Green gate: all routes and active-nav state survive mode/orientation changes;
there is no hidden tablet sidebar or unreachable compact navigation.

### L2 - Small Dieter Contract Adoption And Deletion

1. Import 126I's operational-field and operational-table CSS directly in
   `main.ts` using the existing `@dieter/*` source alias.
2. Apply operational-field to token-editor `select`/`input` while preserving
   DevStudio labels, validation, values, and commit state.
3. Apply operational-table to Entitlements and LLM Management tables while
   preserving all policy-specific composition.
4. Delete the duplicate Dieter token import and duplicate Google-font import
   from `tokens.css`; `main.ts` remains token CSS authority and `index.html`
   remains font-link authority.
5. Delete local field appearance now owned by operational-field, duplicated
   table base declarations, dead collapsed-sidebar/menu selectors, dead
   `#root`, `--sidebar-width-collapsed`, and unused `--content-max-width`.
6. Replace the undefined `--shadow-lg` fallback with the existing
   `--shadow-elevated` token.
7. Remove the raw orange fallback and use the existing orange token.

Green gate: no policy semantics or source mutation path moves into Dieter; no
old visual rules survive beside the accepted contracts.

### L3 - Authenticated Proof And Documentation

1. Run generation, typecheck, build, route-contract, and focused UI tests.
2. Use a real `e2e/.auth/devstudio.json` produced by Berlin -> DevStudio login/
   session finish. Roma auth is not valid for this host.
3. Prove all workspace modes, orientation change, keyboard/touch drawer use,
   current route preservation, token-editor D1 behavior, table overflow, and no
   console errors.
4. Verify the Git-connected DevStudio Pages deployment at the exact source SHA.
5. Update the DevStudio service doc and affected UI docs.

## Exact Blast Radius

### Edit

| File | Change |
| --- | --- |
| `admin/src/main.ts` | Compact drawer, portrait boundary, operational CSS imports/classes; preserve K dialog lifecycle. |
| `admin/src/css/layout.css` | Full/Compact/unsupported shell, dynamic viewport, safe areas; delete dead responsive/collapsed branches. |
| `admin/src/css/tokens.css` | Keep shell variables only; remove duplicate Dieter/font imports and dead variables. |
| `admin/src/css/utilities.css` | Delete local field appearance and invalid shadow fallback; preserve DevStudio-specific dialog composition. |
| `admin/src/html/tools/entitlements.html` | Adopt operational-table; preserve policy composition; remove raw color fallback. |
| `admin/src/html/tools/llm-management.html` | Adopt operational-table; preserve policy composition. |
| `admin/index.html` | Add `viewport-fit=cover` to the existing viewport metadata. |
| `documentation/services/devstudio.md` | Record delivered shell and shared-contract behavior. |
| `documentation/engineering/UI/{surfaces,components,dialogs-and-modals}.md` | Reconcile only behavior proven by execution. |

### Add

- `e2e/devstudio/ui-contract.spec.ts` for D1/D2 and operational table/field
  proof. It complements, rather than duplicates, 126I's route-contract suite.

### Delete In Place

- `#root` layout selector;
- `.sidebar-toggle*`, `.docs-shell__menu-toggle`, `data-sidebar='collapsed'`,
  and `data-sidebar-state` selector families;
- entire generic `960px` and `640px` responsive branches;
- `--sidebar-width-collapsed` and `--content-max-width`;
- duplicate token/font imports;
- token-editor local input/select appearance and `--shadow-lg` fallback;
- table base declarations replaced by operational-table;
- raw orange fallback.

### Do Not Touch

- `admin/functions/**` token/policy/auth behavior;
- generated route registries or generated component/foundation pages except
  output already changed by preceding 126I/K builds;
- route count, route paths, policy data, account data, Roma, Bob, Tokyo, R2, or
  Supabase;
- token-editor persistence semantics established by existing Pages Functions;
- 126K dialog lifecycle code.

## Verification

```bash
pnpm build:dieter
pnpm --filter @clickeen/devstudio typecheck
pnpm --filter @clickeen/devstudio lint
pnpm --filter @clickeen/devstudio check:functions
pnpm --filter @clickeen/devstudio build
E2E_BASE_URL=https://devstudio.clickeen.com E2E_AUTH_STATE=e2e/.auth/devstudio.json pnpm exec playwright test e2e/devstudio/route-contract.spec.ts e2e/devstudio/dialog-contracts.spec.ts e2e/devstudio/ui-contract.spec.ts
```

Browser matrix:

| Viewport | Expected |
| --- | --- |
| `1440x900` | Full persistent sidebar. |
| `768x1024` | Full tablet portrait cockpit. |
| `1024x768` | Full tablet landscape cockpit. |
| `844x390` | Compact overlay drawer and full work area. |
| `390x844` | Unsupported portrait boundary. |
| `600x960` | Full boundary behavior. |

Deploy proof is the Git-connected DevStudio Pages build at the exact source SHA
and authenticated canonical-host evidence. No Worker, R2, Supabase, or product
data mutation belongs to 126L.

## Non-Scope

- New DevStudio routes or navigation groups.
- Token schema/editor expansion.
- Policy or Pages Function changes.
- Shared shell framework or generic responsive utility.
- Mobile-specific versions of pages.
- Domain/table data redesign.

## V1-V8 Pre-Execution Audit

| ID | Result | Reason |
| --- | --- | --- |
| V1 | PASS | Route, policy, and token truth remain source-derived. |
| V2 | PASS | No source token or policy value is silently rewritten. |
| V3 | OPEN UNTIL STEP 9 | All modes, 3/22/2 routes, token editor, tables, auth, deploy, and docs need proof. |
| V4 | OPEN UNTIL STEP 9 | Compact navigation and token mutation must remain fail-closed and reachable. |
| V5 | PASS | No stored account/product data is handled. |
| V6 | OPEN UNTIL STEP 9 | Local build without authenticated deployed proof is partial. |
| V7 | OPEN UNTIL STEP 9 | Dead sidebar/import/field/table branches must be deleted, not renamed. |
| V8 | PASS | Runtime source owns behavior; tests only verify. |
