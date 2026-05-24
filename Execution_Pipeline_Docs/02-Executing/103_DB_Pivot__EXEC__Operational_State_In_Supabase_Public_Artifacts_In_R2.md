# PRD 103_DB_Pivot Execution - Operational State In Supabase Postgres, Public Artifacts In R2

Status: Executing
Date: 2026-05-21
Parent: `103_DB_Pivot__PRD__Operational_State_In_Supabase_Public_Artifacts_In_R2.md`
Blocks: PRD 103 and all moved 103 planning artifacts

## Execution Rule

This execution ledger is now the only active 103-family execution item.

Rules:

- execute one slice at a time;
- do not start the next slice until the current slice is implemented, documented, and verified green;
- delete toxic R2-as-DB flows instead of wrapping them;
- do not preserve legacy source files as product modes;
- any temporary migration script must be one-shot, documented, and removed or marked repair-only before closure;
- every slice must name which product operation owns the state after the slice;
- Supabase Postgres is the canonical operational database; D1 is not allowed as a canonical account/instance/translation/publish store in this pivot;
- Hyperdrive is the default Worker-to-Supabase access path unless evidence in 103_DB.1B proves it unsuitable;
- local Supabase is allowed only for official CLI schema/dev validation, not as product truth or remote-state evidence;
- bootstrap-era `dev-up` Supabase lifecycle and `DEV_UP_USE_REMOTE_SUPABASE` paths are removed/quarantined before DB execution;
- no slice may use `supabase db reset`, `db push`, runtime local/remote Supabase switching, or script-hidden migration/reset commands from an agent terminal.

## Slice Plan

| Slice | Status | Scope | Green condition |
| --- | --- | --- | --- |
| 103_DB.0 - Planning quarantine and doctrine reset | Green | Move existing 103 docs back to planning, create this DB pivot PRD/exec pair, and update canonical docs/status to block product work. | Only DB pivot remains in `02-Executing`; moved 103 docs are marked planning/blocked; `git diff --check` passes. |
| 103_DB.1 - Current remote Supabase inventory audit | Green for rebuild/delete planning | Execute `103_DB_Current_Supabase_Inventory__PRD__Remote_DB_Audit_Gate.md`: inventory every current remote table, column, enum/type, index, FK, RLS policy, grant, trigger, function/RPC, extension, publication/realtime object, and current code caller. | `103_DB_Current_Supabase_Inventory__AUDIT__Remote_DB_Object_Map.md` maps every remote object and caller to keep/rebuild/merge/delete/defer/blocked; no object remains unknown for planning; no mutation command was used; Product + Architecture accepted migration-inferred security/DDL evidence for this rebuild/delete pivot on 2026-05-22. Direct remote SQL remains useful for final migration review but no longer blocks planning. |
| 103_DB.1A - Berlin auth/connector audit | Green | Audit current Berlin login/profile/contact/provider tables against the approved Users model and connector vocabulary. If nuking/rebuilding is simpler than tweaking accumulated scaffolding, choose rebuild. | Surviving login/auth mapping is named as `users.login_provider` + `users.login_subject`; connector state is deferred to a future account-owned connector PRD; stale Berlin tables are mapped to delete/merge/defer; no implementation slice starts with fuzzy user/auth ownership. Current artifact: `103_DB_Berlin_Auth_Connector__AUDIT__Users_Login_Connector_Map.md`. |
| 103_DB.1B - Database product model and evidence lock | Green | Use the green remote inventory to finalize active R2 JSON product-state reads/writes, target Accounts/Users/Instance State tables and columns, Tokyo/Roma/SF/Bob operation callers, Worker DB access options, Hyperdrive config needs, public artifact reads, and bootstrap-era Supabase script footguns. Finalize child PRDs for Accounts, Users, and Instances. | Evidence table maps every current table and R2 product-state object to keep/merge/delete/new table; target v1 table/column model is approved through child PRDs; access decision confirms Hyperdrive or names a concrete exception; active local scripts cannot start/reset/migrate/seed/switch Supabase during product execution; useful Dieter/i18n chores stay explicit; no product runtime changes beyond docs/guards. Current artifact: `103_DB_Product_Model_Evidence_Lock__AUDIT__Table_R2_Operation_Map.md`. |
| 103_DB.2 - Supabase core schema foundation | Green | Execute the approved Accounts, Billing Status, Users, Invitations, and Instances table contracts together at the schema boundary. This slice exists because `instances.account_id` depends on the new compact `accounts.id`; building instances first against the old UUID/public_id split would preserve the toxic model. Current artifact: `103_DB_Core_Schema_Foundation__EXEC__Accounts_Users_Instances.md`. | A reviewed migration creates the approved core enums/tables and removes/rebuilds old Berlin/widget schema foundations without adding product runtime compatibility paths; CI has a manual, guard-gated deploy lane; no remote mutation is run from the agent terminal; cloud-dev schema proof is attached before runtime work starts. Green proof: GitHub run `26284503517`, remote migration `20260522090000`, new tables reachable, old toxic tables absent. |
| 103_DB.3 - Tokyo instance registry/control row wiring | Green | Execute `103_DB_Instances__PRD__Instances_Table.md` in runtime code: add/migrate DB authority for instance existence, ownership, widget type, publish state, coarse translation state, and timestamps. Do not move authored payloads or display/name/title into DB by default. Current artifact: `103_DB_Instance_Registry_Control_Row__EXEC__Tokyo_Runtime_Wiring.md`. | Roma/Tokyo create/open/list/rename/publish use product operations backed by the `instances` row; no active product path uses R2 account indexes or source JSON as listing/open truth. Green proof: cloud deploy green, surface reachability green, and human Roma cloud-dev smoke confirmed FAQ/Countdown/Logo Showcase list and open. |
| 103_DB.4 - Tokyo translated-locale operation cleanup | Green | Delete overlay inventory and selected/current pointer product concepts. Keep translated value payload ownership behind Tokyo unless 103_DB.1 proves DB rows are required. Current artifact: `103_DB_Translated_Locale_Operation_Cleanup__EXEC__Tokyo_Runtime_Wiring.md`. | Bob/Roma/Tokyo list/read/write translated locales through Tokyo product operations; no active product path exposes overlay inventory, pointer, object IDs, or storage paths. Green proof: Tokyo/Bob tests green, Tokyo/Bob/Roma typechecks green, repo lint/typecheck/PRD guard green. |
| 103_DB.5 - Translation generation control state | Green | Make Generate acceptance, running/failed state, and changed/missing pickup deterministic through Tokyo operations plus the approved coarse `instances.translation_status` state. No job table, sourceVersion, generation lane, error column, or per-locale DB progress table was added. Current artifact: `103_DB_Translation_Generation_Control_State__EXEC__Tokyo_Runtime_Wiring.md`. | Green proof: Tokyo Generate/complete/fail update `instances.translation_status`; repeated Generate does not duplicate active work; stale work cannot overwrite newer saved text; Tokyo tests/typecheck green. |
| 103_DB.6 - Widget definition operation cleanup | Green | Ensure Roma asks Tokyo for widget definitions and never reads generated R2 catalog/manifest artifacts; decide whether product registry remains repo/static or DB. Current artifact: `103_DB_Widget_Definition_Operation_Cleanup__EXEC__Tokyo_Runtime_Wiring.md`. | Green proof: widget definitions remain repo/static Tokyo source exposed through Tokyo operations; Roma calls `/__internal/widgets/definitions`; generated widget manifest/catalog route and DB `widgets` authority are absent from active product paths. |
| 103_DB.7 - Publish/materialization bridge | Green | Define and implement the product operation that materializes public artifacts from Tokyo-owned state to R2. Remove file-presence status mechanics. Current artifact: `103_DB_Publish_Materialization_Bridge__EXEC__Tokyo_Runtime_Wiring.md`. | Green proof: `instances.publish_status` is product publish state; `clk.live` visitor traffic reads materialized R2 artifacts without Supabase; unpublish removes public artifacts; `applyFreeTierServing` and `restorePaidTierServing` materialize policy-specific serving output without rewriting publish intent. |
| 103_DB.8 - Migration and toxic-path deletion | Green | Migrate current dev/admin instances and remove old R2 source files/routes/guards/workflows from active product paths. Current artifact: `103_DB_Migration_And_Toxic_Path_Deletion__EXEC__Tokyo_Runtime_Wiring.md`. | Green proof: current dev/admin instances were seeded in 103_DB.3; active runtime no longer writes/reads `instance.json`; `publishStatus` is removed from `instance.config.json`; old helper names are blocked by guard; Tokyo tests/typecheck and PRD guard pass. |
| 103_DB.9 - End-to-end verification and PRD 103 resume gate | Blocked | Run full targeted verification and human smoke checklist for open/save/generate/preview/publish. Current artifact: `103_DB_End_To_End_Verification_And_PRD103_Resume_Gate__EXEC__Cloud_Smoke.md`. | Architecture docs are updated; all listed tests pass; cloud-dev public serving smoke passes on canonical `dev.clk.live`; product signs PRD 103 can resume from planning. |

## Initial Blast-Radius Ledger

| ID | Severity | Product concern | Current bad shape | Target owner | Owner slice | Status |
| --- | --- | --- | --- | --- | --- | --- |
| DB-001 | P0 | Account instance registry | R2 JSON source files as account listing/open truth | Supabase `instances` registry/control row | 103_DB.3 | Green |
| DB-002 | P0 | Instance listing | Generated account index JSON as listing/read model | Supabase query behind Tokyo `listAccountInstances` | 103_DB.3 | Green |
| DB-003 | P0 | Instance authored payload | `instance.config.json` / `instance.content.json` used as cross-service product contracts | Tokyo-owned payload operation; DB only holds registry/control state in v1 | 103_DB.3 | Open |
| DB-004 | P0 | Translated locale readiness | Overlay inventory JSON and partial status/value drift | Tokyo translated-locale readiness operation; no DB locale row by default | 103_DB.4 | Green |
| DB-005 | P0 | Current translated locale | Selected overlay pointer/current object | Tokyo `{instanceId, locale}` translated-value operation | 103_DB.4 | Green |
| DB-006 | P0 | Translation payload | R2 overlay object exposed as application payload/storage identity | Tokyo-owned translated-value payload behind operation; DB JSONB only if proven | 103_DB.4 | Green |
| DB-007 | P0 | Translation generation job | Object-backed job state and local spinner inference | Tokyo Generate operation plus `instances.translation_status`; no job table by default | 103_DB.5 | Green |
| DB-008 | P1 | Translation queue completion | SF completion writes/reads object-shaped state | Tokyo DB transaction via product operation | 103_DB.5 | Green |
| DB-009 | P1 | Changed/missing pickup | Changed fields discovered by Roma/Bob from source JSON/object walks | Tokyo computes delta from the approved authored payload source and saved text input | 103_DB.5 | Green |
| DB-010 | P1 | Widget catalog | Generated manifest/catalog object as product authority | Tokyo widget-definition operation | 103_DB.6 | Green |
| DB-011 | P0 | Publish state | Public file presence or sidecar field as status | `instances.publish_status` plus named publish/unpublish operation; policy serving changes use materialization operations | 103_DB.7 | Green |
| DB-012 | P0 | Public artifacts | Authoring/product services read generated public files to infer state | R2 public artifact read only by public serving | 103_DB.7 | Green |
| DB-013 | P1 | Materialization owner | Implied builder through scripts/routes | Named Tokyo-owned materialization operations to R2: publish/unpublish, `applyFreeTierServing`, and `restorePaidTierServing` | 103_DB.7 | Green |
| DB-014 | P1 | Migration | Current admin/dev data left in old object state | One-shot DB migration + cleanup proof | 103_DB.8 | Green |
| DB-015 | P1 | Worker DB access | Workers need a concrete Supabase access path without inventing a DB abstraction | Hyperdrive-backed Supabase Postgres access | 103_DB.1B | Green for planning |
| DB-016 | P1 | D1 drift | Future patches may introduce D1 as another canonical state store | D1 forbidden for account/instance/translation/publish state in this pivot | 103_DB.8 | Green |
| DB-017 | P1 | Guards | Existing guards block names, not DB/R2/D1 consumer split | Regression guard for operational-state-in-R2 and D1 canonical-state drift | 103_DB.8 | Green |
| DB-018 | P0 | Supabase environment management | Local Docker/dev scripts blur local, cloud-dev, staging, and production authority | Migrations plus CI/CD to named projects; local Docker removed from agent-run product execution | 103_DB.1B | Green for planning; active `dev-up` Supabase lifecycle quarantined |
| DB-019 | P0 | Remote DB mutation safety | Agent/developer terminal can mutate/reset the wrong target if env switches are trusted | Remote mutation only through reviewed migration deployment path | 103_DB.1B | Green for planning; `DEV_UP_USE_REMOTE_SUPABASE` helper deleted |
| DB-020 | P0 | User-created dev data safety | Local reset/migration scripts can destroy user-created dev/admin instances while appearing "safe" | No reset/migrate/seed lifecycle command in product dev scripts; fixtures only in isolated CI | 103_DB.1B | Green for planning; active `dev-up` refuses to run Supabase lifecycle |
| DB-021 | P0 | Database product model | Current schema is accumulated mechanisms rather than Accounts/Users/Instance State | Complete remote object inventory first; approved simple table/column model before migrations | 103_DB.1 / 103_DB.1B | Open |
| DB-022 | P0 | Supabase stale tables | `widgets` and other stale/bootstrap tables survive as security and confusion risk | Full remote object map; explicit keep/merge/delete table map; `widgets` deleted unless impossible evidence appears | 103_DB.1 / 103_DB.1B | Open |
| DB-023 | P0 | Account identity | UUID `accounts.id` and compact `accounts.public_id` both survive as product identities | One compact `accounts.id` used by Berlin/Roma/Tokyo/R2/public paths | 103_DB.1B | Open |
| DB-024 | P1 | Platform/internal account flag | `is_platform` can become admin/billing/policy bypass soup | Delete from core `accounts`; model explicit capability/config only if proven | 103_DB.1B | Open |
| DB-025 | P0 | Account deletion | `closed` account status could retain free-account rows and owned storage forever | Account deletion is an operation with cleanup, not a retained status | 103_DB.1B | Open |
| DB-026 | P0 | Entitlement policy | Tier limits duplicated into account columns or route code | `ck-policy` is proven/fixed as the single entitlement resolver | 103_DB.1B | Open |
| DB-027 | P1 | Instance display label | Instance display/name/title duplicated into registry DB row | Label remains in Tokyo-owned payload/config; registry row stays control-only | 103_DB.3 | Green |
| DB-028 | P1 | Account history | Tier/status history as DB table or account columns | Cold account-owned `account-history.jsonl`; current DB row stays tiny | 103_DB.1B | Open |
| DB-029 | P0 | User core model | `user_profiles` mixes login, profile, preference, provider, and account state | `users` row owns one account association, role, accepted/current profile fields, and creation timestamp | 103_DB.1A / 103_DB.1B | Open |
| DB-030 | P0 | Multi-account user bomb | `account_members`/membership model can allow one user to belong to multiple accounts | Delete core `account_members`; one user belongs to one account; existing-email invite/add rejects | 103_DB.1A / 103_DB.1B | Open |
| DB-031 | P1 | Contact verification scaffolding | Contact methods/verifications survive as permanent user truth | Delete/defer unless a separate product PRD proves the flow | 103_DB.1A / 103_DB.1B | Open |
| DB-032 | P0 | Provider vocabulary bomb | Login method, connector, integration, provider account, and widget source can collapse into one ambiguous blob | Lock vocabulary: Login Method, Account Connection, Connection Resource, Widget Source. Login can suggest; connector must explicitly authorize. | 103_DB.1A / 103_DB.1B | Open |
| DB-033 | P0 | Invite Members lifecycle | Invitations left conditional or folded into membership can recreate account switching/membership ambiguity | `account_invitations` is V1 Berlin-owned invitation lifecycle; accepting never attaches an existing user to a second account | 103_DB.1A | Open |

## Slice 103_DB.0 Tasks

- Green: moved existing `103*` artifacts from `02-Executing` to `01-Planning`.
- Green: created this DB pivot PRD and execution ledger in `02-Executing`.
- Green: marked the moved PRD 103 status ledger as blocked by DB pivot.
- Green: updated architecture context so new work does not follow the old R2 operational-state model.
- Green: verified docs-only diff with `git diff --check`.

## Slice 103_DB.1 Required Evidence

Before any DB implementation slice starts, 103_DB.1 must produce and verify:

- the audit artifact `103_DB_Current_Supabase_Inventory__AUDIT__Remote_DB_Object_Map.md`;
- complete remote public table inventory;
- complete column inventory with type, nullability, defaults, enum/domain use, writer, reader, product meaning, and keep/rebuild/merge/delete/defer/blocked classification;
- complete primary-key, foreign-key, index, enum/type/domain, RLS policy, grant, function/RPC, trigger, extension, and publication/realtime inventory;
- migration-history summary proving the current remote migration state;
- list of objects present in migrations but absent remotely;
- active code caller map for every object across Berlin, Roma, Bob, Tokyo, San Francisco, Prague, Venice, scripts, CI, DevStudio, and tests;
- classification for every object using the approved vocabulary: keep, rebuild, merge, delete, defer, or blocked;
- no object left as unknown;
- no mutation command used to collect evidence.

103_DB.1 is green only when Product + Architecture approve the full remote object map and every later DB Pivot slice can name exactly which current objects it owns, deletes, rewrites, or must not touch.

Current 103_DB.1 readout:

- Green for rebuild/delete planning: remote public tables, columns, FKs exposed by generated types, table stats, index stats, public RPC/function surface, migration history, active Berlin/Roma caller map, migration-inferred RLS/grants/triggers/extensions/publications, and `widgets` row/caller evidence are captured in `103_DB_Current_Supabase_Inventory__AUDIT__Remote_DB_Object_Map.md`.
- Product + Architecture accepted migration-inferred security/DDL evidence for this pivot on 2026-05-22 because the target is rebuild/delete, not surgical preservation.
- Direct remote SQL evidence remains useful before final migration review, but it no longer blocks 103_DB.1A or 103_DB.1B planning.
- `widgets` is a delete target. Before the actual drop migration, run a deployed-old-path check so any live caller is found deliberately instead of preserved blindly.
- Directional result: the current remote DB is mostly a rebuild/delete surface. `accounts`, `user_profiles`, `login_identities`, `account_invitations`, and active Berlin callers represent product needs that must be rebuilt under the approved Accounts/Users model; `account_members`, contact verification scaffolding, and legacy widget/catalog residue are not stable foundations.

## Slice 103_DB.1A Required Evidence

Before any Users/Auth implementation slice starts, 103_DB.1A must produce and verify:

- the audit artifact `103_DB_Berlin_Auth_Connector__AUDIT__Users_Login_Connector_Map.md`;
- current Berlin callers for `user_profiles`, `account_members`, `account_invitations`, `login_identities`, `user_contact_methods`, and `user_contact_verifications`;
- current documentation conflicts in `documentation/architecture/AccountManagement.md`, `documentation/services/berlin.md`, and related service docs;
- product classification for each current Berlin table as rebuild, merge, delete, defer, or blocked;
- the surviving mapping from external login to `users.user_id`;
- an explicit boundary between Login Method, Account Connection, Connection Resource, and Widget Source;
- whether contact verification is deleted/deferred or assigned to a separate product PRD;
- how Invite Members survives without reintroducing many-account membership;
- any product decision that must be made before implementation.

103_DB.1A is green only when Product + Architecture approve the login/auth/connector map and no implementation slice starts with fuzzy ownership over user, login method, account connection, role, invitation, or contact verification state.

## Slice 103_DB.1B Required Evidence

Before any implementation slice starts, 103_DB.1B must use the green 103_DB.1 inventory to produce and verify:

- active Supabase usage map by service: Berlin, Tokyo-worker, Roma, Bob, San Francisco, scripts, and CI;
- current migration/schema map, including tables that were dropped and must not be treated as surviving product truth;
- current table classification into Accounts, Users, Instance State, merge, or delete;
- target v1 table/column model for `accounts`, `account_invitations`, `users`, and `instances`;
- account identity migration plan that makes compact account id the only target `accounts.id` and deletes `public_id` as a co-equal product identity;
- child PRDs for Accounts, Users, and Instances, each naming product what/why/how, exact columns, writers/readers, indexes, migration, deletion targets, and verification;
- Users child PRD must encode one user belongs to one account, role lives on `users`, existing-email invite/add rejects, approved `users` columns stay intact unless a later product slice proves a change, and Berlin auth/profile/contact/connector scaffolding requires an audit decision before any extra table survives;
- Users child PRD must encode first-account Google login and the provider rule: login can suggest a provider account for connector setup, but connector scopes must be explicitly authorized and stored as account-owned connection/resource state outside `users`;
- Accounts child PRD must define PLG billing status semantics, exclude retained `closed` status, and define account deletion cleanup as an operation;
- Accounts child PRD must remove generic `updated_at` from core accounts, keep `status_changed_at` as the current status lifecycle clock, and route tier/status history to cold account-owned history artifact;
- operation vocabulary must be locked: `duplicateInstanceFromTemplate`, `duplicateInstance`, `applyFreeTierServing`, `restorePaidTierServing`, and `deleteAccount`;
- evidence that `ck-policy` is deterministic, typed, tested, and the single entitlement resolver, or an explicit repair slice before product PRD 103 resumes;
- explicit proof before adding any `instance_locale_values`, `instance_translation_jobs`, or materialization table. The default is no table unless the evidence names the product reader, writer, lifecycle, query need, and cost reason;
- explicit decision for `widgets`, `account_commercial_overrides`, `internal_control_events`, `account_publish_containment`, `login_identities`, `user_profiles`, `user_contact_methods`, and `user_contact_verifications`;
- local Supabase/script lifecycle audit, including `scripts/dev-up.sh`, `scripts/dev/local-supabase.mjs`, reset/push/migration/seed commands, and any `DEV_UP_USE_REMOTE_SUPABASE` or equivalent target-switching path;
- explicit decision on `dev-up.sh`: remove/quarantine Supabase lifecycle; extract Dieter/i18n build chores if they remain useful;
- Cloud-dev/staging/prod target model: which Supabase project is used for each environment and which CI job may apply migrations;
- explicit command policy: which Supabase CLI commands are allowed locally, which are CI-only, and which are forbidden;
- guard plan to prevent future local scripts from starting, resetting, migrating, seeding, pushing, or silently targeting Supabase during product execution.

103_DB.1B is green only when the execution ledger names the surviving database workflow, approves the simple table/column model, and proves the old local/remote confusion path and local destructive reset path are deleted, blocked, or quarantined behind a manual break-glass protocol that cannot run by accident.

Current 103_DB.1B readout:

- Green: target V1 core tables are `accounts`, `account_invitations`, `users`, and `instances`.
- Green: current remote DB objects are mapped to rebuild/delete/defer; `widgets`, `account_members`, `login_identities`, `user_profiles`, contact scaffolding, and old membership helpers are not stable foundations.
- Green: R2 product-state objects are mapped. Account index JSON, legacy instance source mirrors, generation job JSON, and overlay id/pointer/inventory concepts are delete targets from product paths. Public generated artifacts stay in R2/CDN.
- Green: generated widget manifest/catalog authority is already deleted. `catalog.json` survives only as small static widget metadata behind Tokyo widget-definition operations.
- Green: `dev-up` no longer starts, migrates, seeds, resets, loads from, or switches Supabase targets. It reads explicit env only.
- Green: `scripts/dev/local-supabase.mjs` is deleted; the `DEV_UP_USE_REMOTE_SUPABASE` path is gone from active scripts.
- Green: Accounts, Users, Instances, and Billing Status child PRDs were checked against the evidence lock and do not approve fake compatibility columns/tables.

Current executable slice is `103_DB.9 - End-to-end verification and PRD 103 resume gate`.

Current 103_DB.9 readout:

- Green: account locale taxonomy fix `caf522f9` is pushed and Supabase migration `20260523150000__prd103_account_locale_settings_taxonomy.sql` was deployed through reviewed workflow run `26367289969` on head `e4c0a56e`.
- Blocked: cloud deploy and targeted code verification were green at the previous runtime head, but the authenticated product-path smoke gate is not green yet at `e4c0a56e`.
- Green: architecture docs now split public serving by environment. Cloud-dev uses `dev.clk.live`; production release stages use `clk.live`.
- Green: `dev.clk.live/*` routes to `tokyo-assets-dev`, with `PUBLIC_SERVING_BASE_URL=https://dev.clk.live`.
- Green from prior smoke: `dev.clk.live/{accountPublicId}/{instanceId}` resolves to Tokyo-worker and the seeded FAQ, Countdown, and Logo Showcase public artifacts returned 200 after materialization repair.
- Green invariant to preserve: private source mirror access such as `/instance.json` must still return 404 on the public-serving host.
- Blocked: authenticated Roma human smoke still needs a real browser/session or Roma cookie and must prove open, save, Generate, translated preview, and publish before PRD 103 resumes.

## Required Commands For 103_DB.0

```bash
git diff --check
find Execution_Pipeline_Docs/02-Executing -maxdepth 1 -type f -name '103*' -print | sort
find Execution_Pipeline_Docs/01-Planning -maxdepth 1 -type f -name '103*' -print | sort
```

## Resume Gate For Product PRD 103

PRD 103 may move back to execution only when:

- all DB pivot slices are green;
- R2 storage-object coordination is deleted from active product paths;
- current instances have been migrated into the `instances` registry/control row, with authored/translated payload ownership documented behind Tokyo operations;
- public embeds still serve from R2/CDN;
- Supabase schema changes are managed by migrations plus CI/CD to named projects, with local Docker Supabase removed from agent-run product execution;
- Roma/Bob/Tokyo/San Francisco product paths speak product operations backed by DB state;
- human smoke proves open, save, Generate, translation preview, and publish on a real FAQ instance.
