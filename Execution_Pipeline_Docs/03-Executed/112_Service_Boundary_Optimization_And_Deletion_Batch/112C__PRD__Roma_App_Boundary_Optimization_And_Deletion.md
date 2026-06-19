# PRD 112C - Roma App Boundary Optimization And Deletion

Status: EXECUTED
Parent: PRD 112
Owner: Roma current-account app boundary
Date: 2026-06-17

## Boundary

Roma owns:

- Current-account routing.
- Same-origin product APIs.
- Tier/account policy.
- Builder host orchestration.
- Save/upload/page commands through Tokyo.
- Widget package materialization before Tokyo stores exact files.

Roma does not own:

- Berlin auth/account truth.
- Tokyo R2/storage semantics.
- Bob editor/control semantics.
- Widget-specific Core product schemas.
- Prague `blocks[]` marketing behavior.
- Invented fallback product modes/defaults.

## Findings And Required Actions

| ID | Severity | Component | Category | Evidence | Required action | Blast radius | V-risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| RMA-001 | High | Pages create/settings | Legacy locale/defaults | `roma/app/api/account/pages/route.ts`, `roma/components/pages-domain.tsx` | Define page creation/default locale contract. Remove hard-coded `en`/`US`; derive from account locale policy or require explicit input. | Pages API/UI, Tokyo page source tests | V1, V3 |
| RMA-002 | High | Widget Defaults UI | Fallback editor | `roma/components/widget-defaults-domain.tsx`, widget architecture docs | Add explicit supported-control contract. Unsupported compiled controls fail visibly with paths; no generic boolean/select/number/text/JSON fallback editors. | Widget defaults, Bob compiled contract | V1, V2, V7 |
| RMA-003 | High | Instance save policy | Widget-specific Roma schema | `roma/lib/account-instance-save-policy.ts` | Move Core structure validation to generated/shared widget contract or compiled spec validation. Roma keeps account policy and shared limit enforcement only. | Instance create/save/duplicate, widgets | V1, V3, V7 |
| RMA-004 | High | Asset delete proxy/client | Partial-success masquerade | `roma/lib/account-assets-gateway.ts`, `roma/components/assets-domain.tsx` | Validate Tokyo delete response. A 2xx body with `error` or missing required success fields becomes a contract failure, not UI success. | Assets route/UI, Tokyo asset delete | V1, V6 |
| RMA-005 | High | Builder host config | Silent fallback | `roma/components/builder-domain.tsx` | Require valid Bob origin per stage. Missing/invalid `NEXT_PUBLIC_BOB_URL` fails visibly; no fallback to `bob.dev.clickeen.com`. | Builder shell, Pages env | V1, V4 |
| RMA-006 | Medium | E2E auth surface | Runtime test dependency | `roma/app/api/e2e/session/route.ts`, `roma/wrangler.toml`, e2e setup | Move e2e session minting to test-only/CI-auth surface or document as explicit dev-runtime exception with stronger deploy gates. | Roma auth, Berlin e2e, Playwright | V8 |
| RMA-007 | Medium | Page publish | Broad relationship check | Page publish route | Add Tokyo placement-status/publish precondition or atomic validation. Roma sends intent and account policy context instead of full account inventory scan. | Page publish, Tokyo page publish | V3, V6 |
| RMA-008 | Medium | Instance delete | Duplicated page traversal | `roma/lib/account-instance-direct.ts`, instance delete route | Move placement-reference check to Tokyo or expose indexed check endpoint. Roma keeps user-facing error policy. | Instance delete, page source | V3, V7 |
| RMA-009 | Medium | Asset upload quota | Race/partial success | Asset upload route, Tokyo asset handlers | Add quota reservation or explicit max-total precondition at Tokyo write boundary while Roma remains policy authority. | Asset upload/storage accounting | V6 |
| RMA-010 | Low | Widget listing/default metadata | Duplicate metadata | Widgets route, widget defaults UI | Move label/description to widget definition/compiled metadata and delete Roma maps/title-case fallbacks. | Widgets list/defaults UI | V1 |
| RMA-011 | Low | Tokyo client helpers | Duplicate wrapper | `roma/lib/tokyo-client.ts`, `roma/lib/account-instance-direct.ts` | Consolidate product-control calls on one client/error decoder. Delete duplicate wrappers after callers migrate. | Roma product-control helpers | V7 |
| RMA-012 | Low | Account locale lock | Broad inventory read | `roma/lib/account-base-locale-lock.ts` | Replace full instance listing with a Tokyo account fact/count endpoint or usage fact. | Locale settings/API | V3 |
| RMA-013 | Low | Instance/page delete semantics | Absence-as-success | Instance/page direct helpers and routes | Decide semantics. Either expose idempotent `deleted:false` to UI or return 404 for user-initiated visible deletes. UI cannot ignore absence while reporting success. | Widgets/pages delete UX | V5, V6 |

## Execution Slices

1. Page source defaults/localization contract.
2. Widget contract enforcement: defaults UI and widget-specific Core validation.
3. Page/instance relationship checks with Tokyo.
4. Asset mutation truth: delete response and quota preconditions.
5. Runtime/test separation and Builder origin config.
6. Tokyo client consolidation.
7. Account facts optimization.

## Execution Notes

2026-06-17 critical slice:

- RMA-004: Roma asset delete route and client now accept success only for the exact current account public id, exact asset reference, and `deleted: true`.
- RMA-005: Roma Builder now requires explicit valid `NEXT_PUBLIC_BOB_URL`; the hardcoded Bob origin fallback and `about:blank` fallback are removed from the Roma host path.
- BER-02 overlap: Roma `DELETE /api/account` returns explicit conflict and settings no longer renders a delete-account action.

2026-06-17 RMA-001 page locale contract slice:

- RMA-001: Roma page creation now derives `localization.defaultLocale` from the current account locale policy instead of hardcoding `en`.
- RMA-001: Roma page creation seeds page country-locale rules only from the account locale policy; it does not invent `US`.
- RMA-001: Pages UI no longer falls back account locale options to `['en']` when `/api/account/locales` fails or is malformed.
- RMA-001: Adding a country rule uses the first unused configured account country rule when available, otherwise creates an empty explicit country field for user input.
- Boundary rationale: Roma owns page create commands and account locale settings mutation. Berlin remains read context for account locale state, and Tokyo remains page source storage.
- Closure verification: independent RMA-001 audit confirmed no stale hardcoded `en`/`US` defaults in the page create/settings path and a clean V1-V8/product-law assessment.

2026-06-17 RMA-002 widget defaults contract slice:

- RMA-002: Roma Widget Defaults no longer renders controls by generic value shape. Booleans, numbers, strings, arrays, and objects are not treated as enough information to invent an editor.
- RMA-002: Defaults UI renders only explicit compiled Builder controls: `toggle`, `valuefield`, `textedit`, `input`, `textarea`, `dropdown-edit`, or controls with declared options.
- RMA-002: Existing default paths with unsupported compiled controls now produce a visible `Widget Defaults Contract Error` with the exact paths and control types.
- Boundary rationale: Bob/widget compiled controls remain the editor/control authority. Roma only displays the compiled contract for account defaults and fails visibly when the contract is insufficient.
- Closure verification: independent RMA-002 audit confirmed no generic fallback editor remains, no new Roma schema authority was introduced, Roma typecheck passed, and V1-V8/product-law assessment was clean.

2026-06-17 RMA-003 instance save policy slice:

- RMA-003: Roma instance save policy no longer contains widget-specific Core schema validators for `logoshowcase`, `split-media`, `split-carousel-media`, media fill, enum/range fields, or Core cardwrapper.
- RMA-003: Instance create no longer calls a Roma widget structure validator after materializing account defaults.
- RMA-003: Instance save and duplicate call the Roma save policy only with account authz and compiled widget `limits`; `widgetType` is no longer an input to the Roma policy function.
- Boundary rationale: widget Core schema belongs to widget software/Bob compiled controls. Roma keeps account policy enforcement: social-share entitlement and compiled limit evaluation before Tokyo stores submitted files.
- Closure verification: independent RMA-003 audit confirmed no renamed/redressed widget schema validator remains in the scoped save/create/duplicate path, Roma typecheck passed, and V1-V8/product-law assessment was clean.

2026-06-17 RMA-006 runtime E2E auth surface slice:

- RMA-006: Roma no longer has `/api/e2e/session`, and Berlin/Admin no longer expose equivalent product-runtime E2E session mint surfaces.
- RMA-006: Cloudflare runtime configuration no longer carries E2E session mint bindings or vars for Roma, Berlin, or Admin.
- RMA-006: Playwright authenticated specs use ignored local storage state and skip when auth cookies are absent; product services do not mint test sessions.
- Boundary rationale: E2E may test the product, but product runtime must not depend on a test-only session mint path. Berlin owns real auth/session, and Roma consumes real current-account truth.
- Closure verification: independent RMA-006 audit confirmed the route/config surfaces are absent, E2E uses ignored storage state, and V1-V8/product-law assessment was clean.

2026-06-17 RMA-007 page publish relationship slice:

- RMA-007: Roma page publish no longer opens the page or lists all account instances to decide whether placed instances are published.
- RMA-007: Tokyo-worker page publish reads the stored page source, rejects empty placement stacks, verifies every placed instance resolves through Tokyo-worker instance source truth, and requires every placed instance to be published before package readiness, cache purge, or page serve-state mutation.
- RMA-007: Missing or invalid placed instances block publish with the same visible page publish failure instead of being substituted into ordinary unpublished state.
- Boundary rationale: Roma sends the current-account publish intent. Tokyo-worker owns stored page source, stored instance status, page package readiness, cache purge, and page serve-state mutation.
- Closure verification: independent RMA-007 audit confirmed the Roma inventory scan is gone, Tokyo-worker owns the precondition before mutation, Roma and Tokyo-worker typechecks passed, and V1-V8/product-law assessment was clean.

2026-06-17 RMA-008 instance delete relationship slice:

- RMA-008: Roma instance delete no longer lists pages or opens page sources before delete.
- RMA-008: Tokyo-worker instance delete checks stored page `source.json` files through the pages domain before deleting an instance subtree.
- RMA-008: A placed instance delete returns a non-2xx validation error with `coreui.errors.instance.placedOnPage` and the blocking `pageIds`; Roma preserves those structured fields.
- Boundary rationale: Roma sends the current-account delete intent. Tokyo-worker owns account page source storage, instance subtree deletion, and the storage-side placement precondition.
- Closure verification: independent RMA-008 audit confirmed no Roma traversal/redress remains, Tokyo-worker scans stored page sources directly before deletion, Roma preserves `pageIds`, focused typechecks passed, and V1-V8/product-law assessment was clean.

2026-06-17 RMA-009 asset upload quota slice:

- RMA-009: Roma resolves upload and storage limits from the current account policy and forwards explicit quota headers to Tokyo-worker as either a positive integer or `unlimited`.
- RMA-009: Tokyo-worker rejects missing or malformed quota headers before mutation.
- RMA-009: Tokyo-worker enforces per-upload size and total storage using the actual uploaded byte length and current stored bytes immediately before the R2 put.
- Boundary rationale: Roma remains account policy authority. Tokyo-worker owns the account asset write boundary and must not write bytes that violate the explicit account-policy precondition it received.
- Closure verification: independent RMA-009 audit confirmed missing/malformed quota headers fail closed, limit failures are non-2xx before R2 mutation, Roma rejects malformed Tokyo success payloads, focused typechecks passed, and V1-V8/product-law assessment was clean. The known residual is non-atomic concurrent uploads, which remains outside the accepted explicit max-total precondition scope.

2026-06-17 RMA-010 widget metadata authority slice:

- RMA-010: Widget product `displayName` and `description` now live in each widget spec instead of Roma maps or title-case helpers.
- RMA-010: Tokyo-worker widget definitions require and expose `displayName` and `description`; Roma rejects malformed Tokyo widget definition payloads that omit them.
- RMA-010: Roma widgets listing uses Tokyo definition metadata directly for system widget labels/descriptions.
- RMA-010 cleanup: removed the overbroad Bob/editor-panel label expansion. Bob still owns editor panel presentation from existing panel ids; RMA-010 does not require `editor.panels[].label` or compiled `panelLabel`.
- RMA-010: Roma Widget Defaults uses compiled widget display names for widget headings and diagnostics. Control and group labels remain editor presentation from the compiled controls/panel ids, not Roma widget-name truth.
- Boundary rationale: widget product naming belongs to widget software and Tokyo definitions where Roma lists system widgets. Bob remains the editor/control presentation owner. Roma renders the current contract and fails visibly when required widget display metadata is incomplete.
- Closure verification: independent RMA-010 audit must confirm no Roma widget label/description maps, no Roma widget-title-case fallback for widget listing/defaults metadata, no compiled panel-label requirement, and no wrapper/redress path in the widget listing/defaults scope.

2026-06-17 RMA-011 Tokyo client helper deletion slice:

- RMA-011: `roma/lib/account-instance-direct.ts` no longer imports `tokyo-product-control` directly.
- RMA-011: The duplicate private JSON client/error decoder in `account-instance-direct.ts` was deleted: `TokyoJsonResult`, `resolveTokyoControlErrorDetail`, `buildTokyoRouteFailure`, `logTokyoJsonParseWarning`, and `fetchTokyoJson`.
- RMA-011: Instance create, publish/unpublish transition, instance list, and widget definitions list now use `callTokyo` from `roma/lib/tokyo-client.ts`, matching the existing open/save/delete/rename paths.
- RMA-011: Existing per-operation payload normalizers stayed in `account-instance-direct.ts`; no new abstraction or wrapper was introduced.
- Boundary rationale: Roma still owns same-origin product API decoding and user-facing route failures. The product-control HTTP transport/error mapping has one Roma authority, `tokyo-client.ts`.
- Closure verification: independent RMA-011 audit confirmed the duplicate client logic was deleted rather than renamed, all account-instance direct calls use `callTokyo`, focused grep found no duplicate helper/import residue, Roma typecheck/lint passed, and V1-V8/product-law assessment was clean. The only behavior tradeoff is removal of the duplicate parse-warning log from the deleted helper; malformed success payloads still fail visibly through existing invalid-payload handling.

2026-06-17 RMA-012 account locale lock fact slice:

- RMA-012: Roma base-locale lock no longer lists every account instance to decide whether the base language is locked.
- RMA-012: Tokyo-worker exposes a narrow account instance fact endpoint that returns only `{ accountId, hasInstances }`.
- RMA-012: The fact is backed by the account instance registry with `limit=1`; it does not read full instance sources or full account inventories.
- RMA-012: Roma validates the fact payload shape and exact account id before using `hasInstances` for the existing account locale lock behavior.
- Boundary rationale: Roma remains the account locale settings policy/UI owner. Tokyo-worker only reports a storage fact from its instance registry.
- Closure verification: independent RMA-012 audit confirmed this is not the old full listing renamed, failures do not unlock the base locale, corrupt registry rows fail instead of becoming absence, focused greps/typechecks/lint passed, and V1-V8/product-law assessment was clean.

2026-06-17 RMA-013 visible delete semantics slice:

- RMA-013: Tokyo-worker instance and page delete return non-2xx not-found responses when the requested stored object does not exist.
- RMA-013: Roma instance and page delete helpers only return visible success for exact true delete payloads. Tokyo 404, `deleted:false`, `existed:false`, and malformed success payloads become visible route failures.
- RMA-013: corrupt present instance registry rows now fail closed at Tokyo-worker registry reads instead of becoming absence and flowing to delete success or not-found.
- Boundary rationale: Tokyo-worker owns storage existence/corruption truth. Roma owns the user-visible route response and cannot report success unless Tokyo confirms deletion.
- Closure verification: independent RMA-013 audit confirmed no remaining visible delete absence-as-success path; residual corrupt-registry-as-absence was fixed in the Tokyo-worker registry read/list boundary.

## Completion Gates

- Roma no longer invents page locale/country defaults.
- Roma no longer renders unsupported widget controls through generic fallback editors.
- Roma no longer owns widget-specific Core schemas.
- Roma no longer owns duplicate widget label/description maps or title-case fallbacks for widget listing/defaults metadata.
- Roma account-instance direct helpers no longer carry a duplicate Tokyo product-control HTTP/error decoder.
- Roma base-locale lock no longer performs a broad account instance inventory read.
- Roma asset mutations cannot return visible success on malformed upstream response.
- Builder cannot silently route to dev Bob on config failure.
- Runtime test helpers are isolated or explicitly gated as dev-only.
- V1-V8 subagent audit is clean before moving to executed.
