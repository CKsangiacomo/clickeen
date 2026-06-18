# PRD 124E - Tokyo-worker Storage Boundary Optimization And Deletion

Status: EXECUTED
Parent: PRD 124
Owner: Tokyo-worker R2 storage boundary
Date: 2026-06-17

## Boundary

Tokyo-worker owns:

- R2 byte storage under account paths.
- Static artifact serving.
- Narrow byte-safety and storage-integrity checks.

Tokyo-worker does not own:

- Account policy.
- Tier policy.
- Product readiness decisions.
- Page or instance composition semantics.
- Widget default composition.
- Translation policy/orchestration.
- Account lifecycle decisions.
- Fallback/healing behavior.

## Findings And Required Actions

| ID | Severity | Component | Category | Evidence | Required action | Blast radius | V-risk |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TW-01 | Critical | Internal translation write auth | Fail-open control | `tokyo-worker/wrangler.toml`, `internal-product-route-utils.ts`, San Francisco Tokyo client | Require private service binding or signed service auth for all internal write routes. Remove public `__internal/*` write reachability unless strictly authenticated. | San Francisco callbacks, Tokyo internal routes, Cloudflare routing | V4, V6, V7 |
| TW-02 | High | Instance registry and serve state | Split truth | `account-instances/registry.ts`, `serve-state.ts`, `clk-live-routes.ts`, Supabase migration | Decide authority. Move registry/serve-state truth to R2 under account runtime storage, or move registry ownership to Roma/Michael and update law/docs explicitly. No hidden DB/R2 split. | Instance list/open/save/publish/delete, public serving | V3, V4, V5, V6 |
| TW-03 | High | Invalid registry/ledger rows | Corruption-as-absence | Registry, ledger, delete code | Invalid rows must fail closed in account scope. Add explicit repair/delete PRD for orphaned R2 data. | Instance listing/delete, translations | V3, V5, V6 |
| TW-04 | High | Page package/publish pipeline | Dead disconnected workflow | Page package files/routes, Roma page create/save routes | Define page package authority. Either add Roma-owned page package materialization plus Tokyo storage endpoint, or remove/defer Tokyo page package publish paths. | Pages UI, publish, `clk.live` pages | V3, V6, V7 |
| TW-05 | Medium | Page source authority | Wrong-service mutation | `domains/pages/source.ts` | Move page source validation/versioning/summaries to Roma or shared contract. Tokyo stores source envelope and account coordinate only. | Page create/save/list/read | V2, V3, V6 |
| TW-06 | Medium | Instance source/content composition | Product composition in storage | `account-instances/source.ts`, operations | Roma/Bob must submit explicit config/content/locale facts. Tokyo stores and fails on missing required fields. Delete default `en`, content extraction, overlay remap, and locale-switcher product rules from Tokyo where moved. | Instance create/save/open, overlays | V1, V2, V5, V6 |
| TW-07 | Medium | Translation orchestration | Wrong-service orchestration | Translation operations/ledger/values | Move translation policy/orchestration to Roma/San Francisco. Tokyo keeps overlay/job-artifact storage or update product law explicitly if Tokyo remains producer. | Roma translation UI, San Francisco, Supabase ledger | V2, V4, V6, V8 |
| TW-08 | Medium | JSON/overlay reads | Corruption-as-absence | `storage.ts`, overlays, values | JSON parse errors become typed failures. Runtime account reads use strict overlay listing and distinguish missing/stale/corrupt. | Storage callers, translation UI, instance reads | V3, V5, V6 |
| TW-09 | Medium | Asset upload policy | Mixed policy/byte safety | Roma upload route, Tokyo asset handlers | Separate byte safety from account product policy. Roma supplies policy/account facts; Tokyo enforces storage preconditions and byte validity. | Asset uploads, Bob asset saving | V4, V6 |
| TW-10 | Medium | Account widget defaults | Product default composition | `account-widget-defaults.ts`, widget-default routes | Move seeding/materialization to Roma or build-time shared contract. Tokyo stores exact defaults and reports schema failures. | Instance creation, widget defaults UI | V1, V3, V6 |
| TW-11 | Medium | Public serving policy | Legacy documented shape | Tokyo docs, `CONTEXT.md`, `clk-live-routes.ts` | Either implement Roma-written `website/serving-policy.json` in public serving or delete the documented storage shape if obsolete. | Public serving, downgrade/suspension | V3, V4, V6 |
| TW-12 | Low | Instance duplicate route | Dead route | `internal-instance-routes.ts`, Roma duplicate route | Delete Tokyo `/duplicate` 410 route and unused error key after internal caller search. | Internal API only | V7 |
| TW-13 | Low | `USAGE_KV` binding | Unused binding | `tokyo-worker/src/types.ts`, `wrangler.toml` | Remove binding/type after deploy config confirmation. | Worker config/deploy | V3 |
| TW-14 | Low | Unused helpers/exports | Dead helpers | `route-helpers.ts`, `widget-definitions.ts` | Delete unused helpers or move them to explicit tests/build checks if actually needed. | Compile/test cleanup | V3 |
| TW-15 | Low | Page package verification | Inefficient byte reads | `domains/pages/package-files.ts` | Use R2 head/metadata checks for existence/readiness unless content validation is explicitly required. | Page publish latency/cost | V8 |

## Execution Slices

1. Internal service authentication hardening.
2. Instance registry/serve-state authority cleanup.
3. Corruption handling and orphaned R2 repair plan.
4. Page source/package/publish authority cleanup.
5. Instance source/content composition cleanup.
6. Translation orchestration split.
7. Asset policy/byte-safety split.
8. Widget defaults ownership migration.
9. Dead/legacy surface cleanup.

## Execution Notes

2026-06-17 critical slice:

- TW-01: removed public `tokyo.dev.clickeen.com/__internal/*` Worker route.
- TW-01: removed `x-ck-internal-service` from public CORS advertised request headers.
- TW-01: Roma/San Francisco internal calls remain through Cloudflare service bindings.
- TW-01 closure verification: active Wrangler routes expose only public static/asset paths plus health. Internal route handlers still exist for service-binding calls, but `finalizeTokyoObservedResponse` applies public CORS only to non-`/__internal/` paths and does not advertise `x-ck-internal-service`.

2026-06-17 dead surface and readiness cleanup slice:

- TW-12: deleted the dead Tokyo-worker `/__internal/instances/:id/duplicate` 410 route and removed its unused shared reason key.
- TW-13: deleted the unused Tokyo-worker `USAGE_KV` binding and Env type field. Roma keeps its own `USAGE_KV` account rate-limit/usage binding; Tokyo-worker had no active caller.
- TW-14: deleted unused Tokyo-worker helpers `validateWidgetSource` and `respondInternalOnly`.
- TW-15: page package readiness now checks R2 object existence and content-type metadata with `head`; it no longer reads full page package bytes during publish readiness.
- Boundary rationale: these changes delete dead storage-worker surfaces and reduce byte reads. They do not move policy, composition, or authoring decisions into Tokyo-worker.

2026-06-17 registry corruption closure slice:

- TW-03: account instance registry listing now fails closed when Supabase returns a present malformed row instead of filtering it out.
- TW-03: account instance registry read now distinguishes absent rows from present malformed rows; absent returns `null`, malformed throws `tokyo.instance.registry.read_invalid`.
- Boundary rationale: Tokyo-worker owns storage reads for instance registry state and must not convert corrupt stored state into absence.

2026-06-17 persisted JSON and overlay corruption slice:

- TW-08: shared R2 JSON reads now distinguish missing objects from present invalid JSON; present invalid JSON throws `tokyo.storage.json_invalid`.
- TW-08: locale overlay reads and listings now fail on present invalid overlay documents instead of skipping them.
- TW-08: page serve-state JSON parse failures now fail as `tokyo.errors.page.serveStateInvalid`.
- TW-08: translation operation and locale ledger reads now fail when Supabase returns present malformed rows instead of filtering them out.
- TW-08: translated-locale listing no longer returns `[]` for invalid ids, missing instance location, or invalid source/content; those states fail explicitly.
- Boundary rationale: Tokyo-worker owns persisted R2/Supabase storage reads. Missing can be absence; present malformed storage is corruption and cannot be omitted.

2026-06-17 asset upload policy/byte boundary slice:

- TW-09: Roma sends explicit upload size and account storage quota preconditions from current account policy.
- TW-09: Tokyo-worker rejects missing/malformed quota headers and enforces byte-size/storage preconditions at the asset write boundary before R2 mutation.
- Boundary rationale: Roma remains account/tier policy owner. Tokyo-worker only enforces explicit storage write preconditions and byte safety for the bytes it stores.

2026-06-17 public serving policy doc-truth slice:

- TW-11: deleted obsolete active documentation for `accounts/{accountPublicId}/website/serving-policy.json`.
- TW-11: active docs now state that `clk.live` serving uses Tokyo serve state for stored artifact delivery, while Roma/system account operations own account policy decisions before publish/unpublish.
- Boundary rationale: no new serving-policy runtime file was invented. The docs now match the current storage system and service boundaries.

2026-06-17 PRD 125 split:

- TW-02, TW-04, TW-05, TW-06, TW-07, and TW-10 require authority/product-contract decisions before code execution.
- Those findings were split to `Execution_Pipeline_Docs/01-Planning/125__PRD__Tokyo_Worker_Authority_Migration_Decisions.md`.
- Boundary rationale: PRD 124 is a deletion/optimization batch. It must not fake completion of major ownership migrations by adding local Tokyo-worker machinery.

## Completion Gates

- No public header-only internal write route can mutate account data.
- Tokyo-worker does not treat corrupt persisted state as absence.
- Dead routes/bindings/helpers are deleted.
- TW-02, TW-04, TW-05, TW-06, TW-07, and TW-10 are not claimed complete here;
  they are split to PRD 125 for authority decisions before implementation.
- V1-V8 subagent audit is clean for the completed PRD 124E slices before moving
  to executed.
