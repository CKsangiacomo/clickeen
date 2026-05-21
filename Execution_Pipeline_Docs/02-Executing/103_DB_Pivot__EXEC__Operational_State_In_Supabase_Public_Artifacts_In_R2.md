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
- Hyperdrive is the default Worker-to-Supabase access path unless evidence in 103_DB.1 proves it unsuitable;
- local Supabase/Docker is removed from agent-run product execution, not treated as a safer local authority;
- no slice may use `supabase db reset`, `db push`, runtime local/remote Supabase switching, or script-hidden migration/reset commands from an agent terminal.

## Slice Plan

| Slice | Status | Scope | Green condition |
| --- | --- | --- | --- |
| 103_DB.0 - Planning quarantine and doctrine reset | Green | Move existing 103 docs back to planning, create this DB pivot PRD/exec pair, and update canonical docs/status to block product work. | Only DB pivot remains in `02-Executing`; moved 103 docs are marked planning/blocked; `git diff --check` passes. |
| 103_DB.1 - Database product model and evidence lock | Pending | Inventory active R2 JSON product-state reads/writes, current Supabase tables, target Accounts/Users/Instance State tables and columns, Tokyo/Roma/SF/Bob operation callers, Worker DB access options, Hyperdrive config needs, public artifact reads, and local Supabase/Docker lifecycle footguns. Create/finalize child PRDs for Accounts, Users, and Instances. | Evidence table maps every current table and R2 product-state object to keep/merge/delete/new table; target v1 table/column model is approved through child PRDs; access decision confirms Hyperdrive or names a concrete exception; local scripts cannot start/reset/migrate/seed/switch Supabase during product execution; no product code changes beyond docs/guards. |
| 103_DB.2 - Supabase instance registry/control row | Pending | Execute `103_DB_Instances__PRD__Instances_Table.md`: add/migrate DB authority for instance existence, ownership, widget type, live state, coarse translation state, and timestamps. Do not move authored payloads or display/name/title into DB by default. | Roma/Tokyo create/open/list/rename/publish use product operations backed by the `instances` row; no active product path uses R2 account indexes or source JSON as listing/open truth. |
| 103_DB.3 - Tokyo translated-locale operation cleanup | Pending | Delete overlay inventory and selected/current pointer product concepts. Keep translated value payload ownership behind Tokyo unless 103_DB.1 proves DB rows are required. | Bob/Roma/Tokyo list/read/write translated locales through Tokyo product operations; no active product path exposes overlay inventory, pointer, object IDs, or storage paths. |
| 103_DB.4 - Translation generation control state | Pending | Make Generate acceptance, running/failed state, and changed/missing pickup deterministic through Tokyo operations plus the approved coarse `instances.translation_status` state. Do not add job tables unless 103_DB.1 proves a product need. | Generate can be clicked repeatedly without limbo; stale work cannot overwrite newer saved text; Bob/Roma do not infer progress from storage objects or scattered files. |
| 103_DB.5 - Widget definition operation cleanup | Pending | Ensure Roma asks Tokyo for widget definitions and never reads generated R2 catalog/manifest artifacts; decide whether product registry remains repo/static or DB. | Widget definitions are exposed only through Tokyo product operations; any generated catalog artifact is deleted or proven public/static-only. |
| 103_DB.6 - Publish/materialization bridge | Pending | Define and implement the product operation that materializes public artifacts from Tokyo-owned state to R2. Remove file-presence status mechanics. | `instances.live_status` is the public state truth; any extra materialization state is added only if proven. R2 contains only generated public files; public serving never reads authoring DB state. |
| 103_DB.7 - Migration and toxic-path deletion | Pending | Migrate current dev/admin instances and remove old R2 source files/routes/guards/workflows from active product paths. | Current FAQ/Countdown/Logo Showcase instances open; old R2 product-state routes fail or are absent; one-shot migration evidence is attached. |
| 103_DB.8 - End-to-end verification and PRD 103 resume gate | Pending | Run full targeted verification and human smoke checklist for open/save/generate/preview/publish. | Architecture docs are updated; all listed tests pass; product signs PRD 103 can resume from planning. |

## Initial Blast-Radius Ledger

| ID | Severity | Product concern | Current bad shape | Target owner | Owner slice | Status |
| --- | --- | --- | --- | --- | --- | --- |
| DB-001 | P0 | Account instance registry | R2 JSON source files as account listing/open truth | Supabase `instances` registry/control row | 103_DB.2 | Open |
| DB-002 | P0 | Instance listing | Generated account index JSON as listing/read model | Supabase query behind Tokyo `listAccountInstances` | 103_DB.2 | Open |
| DB-003 | P0 | Instance authored payload | `instance.config.json` / `instance.content.json` used as cross-service product contracts | Tokyo-owned payload operation; DB only holds registry/control state in v1 | 103_DB.2 | Open |
| DB-004 | P0 | Translated locale readiness | Overlay inventory JSON and partial status/value drift | Tokyo translated-locale readiness operation; no DB locale row by default | 103_DB.3 | Open |
| DB-005 | P0 | Current translated locale | Selected overlay pointer/current object | Tokyo `{instanceId, locale}` translated-value operation | 103_DB.3 | Open |
| DB-006 | P0 | Translation payload | R2 overlay object exposed as application payload/storage identity | Tokyo-owned translated-value payload behind operation; DB JSONB only if proven | 103_DB.3 | Open |
| DB-007 | P0 | Translation generation job | Object-backed job state and local spinner inference | Tokyo Generate operation plus `instances.translation_status`; no job table by default | 103_DB.4 | Open |
| DB-008 | P1 | Translation queue completion | SF completion writes/reads object-shaped state | Tokyo DB transaction via product operation | 103_DB.4 | Open |
| DB-009 | P1 | Changed/missing pickup | Changed fields discovered by Roma/Bob from source JSON/object walks | Tokyo computes delta from the approved authored payload source and saved text input | 103_DB.4 | Open |
| DB-010 | P1 | Widget catalog | Generated manifest/catalog object as product authority | Tokyo widget-definition operation | 103_DB.5 | Open |
| DB-011 | P0 | Publish/live state | Public file presence or sidecar field as status | `instances.live_status` plus named publish operation | 103_DB.6 | Open |
| DB-012 | P0 | Public artifacts | Authoring/product services read generated public files to infer state | R2 public artifact read only by public serving | 103_DB.6 | Open |
| DB-013 | P1 | Materialization owner | Implied builder through scripts/routes | Named Tokyo-owned materialization operation to R2 | 103_DB.6 | Open |
| DB-014 | P1 | Migration | Current admin/dev data left in old object state | One-shot DB migration + cleanup proof | 103_DB.7 | Open |
| DB-015 | P1 | Worker DB access | Workers need a concrete Supabase access path without inventing a DB abstraction | Hyperdrive-backed Supabase Postgres access | 103_DB.1 | Open |
| DB-016 | P1 | D1 drift | Future patches may introduce D1 as another canonical state store | D1 forbidden for account/instance/translation/publish state in this pivot | 103_DB.8 | Open |
| DB-017 | P1 | Guards | Existing guards block names, not DB/R2/D1 consumer split | Regression guard for operational-state-in-R2 and D1 canonical-state drift | 103_DB.8 | Open |
| DB-018 | P0 | Supabase environment management | Local Docker/dev scripts blur local, cloud-dev, staging, and production authority | Migrations plus CI/CD to named Supabase projects; local Docker removed from agent-run product execution | 103_DB.1 | Open |
| DB-019 | P0 | Remote DB mutation safety | Agent/developer terminal can mutate/reset the wrong target if env switches are trusted | Remote mutation only through reviewed migration deployment path | 103_DB.1 | Open |
| DB-020 | P0 | User-created dev data safety | Local reset/migration scripts can destroy user-created dev/admin instances while appearing "safe" | No reset/migrate/seed lifecycle command in product dev scripts; fixtures only in isolated CI | 103_DB.1 | Open |
| DB-021 | P0 | Database product model | Current schema is accumulated mechanisms rather than Accounts/Users/Instance State | Approved simple table/column model before migrations | 103_DB.1 | Open |
| DB-022 | P0 | Supabase stale tables | `widgets` and other stale/bootstrap tables survive as security and confusion risk | Explicit keep/merge/delete table map; `widgets` deleted unless impossible evidence appears | 103_DB.1 | Open |
| DB-023 | P0 | Account identity | UUID `accounts.id` and compact `accounts.public_id` both survive as product identities | One compact `accounts.id` used by Berlin/Roma/Tokyo/R2/public paths | 103_DB.1 | Open |
| DB-024 | P1 | Platform/internal account flag | `is_platform` can become admin/billing/policy bypass soup | Delete from core `accounts`; model explicit capability/config only if proven | 103_DB.1 | Open |
| DB-025 | P0 | Account deletion | `closed` account status could retain free-account rows and owned storage forever | Account deletion is an operation with cleanup, not a retained status | 103_DB.1 | Open |
| DB-026 | P0 | Entitlement policy | Tier limits duplicated into account columns or route code | `ck-policy` is proven/fixed as the single entitlement resolver | 103_DB.1 | Open |
| DB-027 | P1 | Instance display label | Instance display/name/title duplicated into registry DB row | Label remains in Tokyo-owned payload/config; registry row stays control-only | 103_DB.2 | Open |
| DB-028 | P1 | Account history | Tier/status history as DB table or account columns | Cold account-owned `account-history.jsonl`; current DB row stays tiny | 103_DB.1 | Open |
| DB-029 | P0 | User core model | `user_profiles` mixes login, profile, preference, provider, and account state | `users` row owns one account association, role, accepted/current profile fields, and creation timestamp | 103_DB.1 | Open |
| DB-030 | P0 | Multi-account user bomb | `account_members`/membership model can allow one user to belong to multiple accounts | Delete core `account_members`; one user belongs to one account; existing-email invite/add rejects | 103_DB.1 | Open |
| DB-031 | P1 | Contact verification scaffolding | Contact methods/verifications survive as permanent user truth | Delete/defer unless a separate product PRD proves the flow | 103_DB.1 | Open |
| DB-032 | P0 | Provider vocabulary bomb | Login, linked identity, connector, integration, provider account, and widget source can collapse into one ambiguous blob | Lock vocabulary: Login Method, Account Connection, Connection Resource, Widget Source. Login can suggest; connector must explicitly authorize. | 103_DB.1 | Open |

## Slice 103_DB.0 Tasks

- Green: moved existing `103*` artifacts from `02-Executing` to `01-Planning`.
- Green: created this DB pivot PRD and execution ledger in `02-Executing`.
- Green: marked the moved PRD 103 status ledger as blocked by DB pivot.
- Green: updated architecture context so new work does not follow the old R2 operational-state model.
- Green: verified docs-only diff with `git diff --check`.

## Slice 103_DB.1 Required Evidence

Before any implementation slice starts, 103_DB.1 must produce and verify:

- active Supabase usage map by service: Berlin, Tokyo-worker, Roma, Bob, San Francisco, scripts, and CI;
- current migration/schema map, including tables that were dropped and must not be treated as surviving product truth;
- current table classification into Accounts, Users, Instance State, merge, or delete;
- target v1 table/column model for `accounts`, `account_invitations`, `users`, and `instances`;
- account identity migration plan that makes compact account id the only target `accounts.id` and deletes `public_id` as a co-equal product identity;
- child PRDs for Accounts, Users, and Instances, each naming product what/why/how, exact columns, writers/readers, indexes, migration, deletion targets, and verification;
- Users child PRD must encode one user belongs to one account, role lives on `users`, existing-email invite/add rejects, and Berlin auth/profile/contact/connector scaffolding requires an audit decision before any extra table survives;
- Users child PRD must encode first-account Google login and the provider rule: login can suggest a provider account for connector setup, but connector scopes must be explicitly authorized and stored as account-owned connection/resource state outside `users`;
- Accounts child PRD must define PLG billing status semantics, exclude retained `closed` status, and define account deletion cleanup as an operation;
- Accounts child PRD must remove `updated_at` from core accounts unless a runtime cache/sync need is proven, and route tier/status history to cold account-owned history artifact;
- evidence that `ck-policy` is deterministic, typed, tested, and the single entitlement resolver, or an explicit repair slice before product PRD 103 resumes;
- explicit proof before adding any `instance_locale_values`, `instance_translation_jobs`, or materialization table. The default is no table unless the evidence names the product reader, writer, lifecycle, query need, and cost reason;
- explicit decision for `widgets`, `account_commercial_overrides`, `internal_control_events`, `account_publish_containment`, `user_contact_methods`, and `user_contact_verifications`;
- local Supabase/Docker lifecycle audit, including `scripts/dev-up.sh`, `scripts/dev/local-supabase.mjs`, reset/push/migration/seed commands, and any `DEV_UP_USE_REMOTE_SUPABASE` or equivalent target-switching path;
- Cloud-dev/staging/prod target model: which Supabase project is used for each environment and which CI job may apply migrations;
- explicit command policy: which Supabase CLI commands are allowed locally, which are CI-only, and which are forbidden;
- guard plan to prevent future local scripts from starting, resetting, migrating, seeding, pushing, or silently targeting Supabase during product execution.

103_DB.1 is green only when the execution ledger names the surviving database workflow, approves the simple table/column model, and proves the old local/remote confusion path and local destructive reset path are deleted, blocked, or quarantined behind a manual break-glass protocol that cannot run by accident.

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
