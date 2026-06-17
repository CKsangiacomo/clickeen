# PRD 124C - Roma App Boundary Optimization And Deletion

Status: EXECUTING
Parent: PRD 124
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

## Completion Gates

- Roma no longer invents page locale/country defaults.
- Roma no longer renders unsupported widget controls through generic fallback editors.
- Roma no longer owns widget-specific Core schemas.
- Roma asset mutations cannot return visible success on malformed upstream response.
- Builder cannot silently route to dev Bob on config failure.
- Runtime test helpers are isolated or explicitly gated as dev-only.
- V1-V8 subagent audit is clean before moving to executed.
