# AUDIT 103_DB Product Model Evidence Lock - Table, R2, Operation Map

Status: Executed historical evidence / green product-model evidence lock; surviving doctrine extracted to PRD 105A; superseded by PRD 105 and 105A where conflicting
Date Started: 2026-05-22
Parent PRD: `103_DB_Pivot__PRD__Operational_State_In_Supabase_Public_Artifacts_In_R2.md`
Execution slice: `103_DB.1B - Database product model and evidence lock`

Archive note: retained as evidence for DB/R2/product-operation decisions. Current authority is PRD 105 and PRD 105A.

## Rule

This is still pre-implementation.

No product code, database migration, Supabase mutation, or R2 mutation is allowed in this slice.

The goal is to lock the target product model and delete/keep map before any DB migration starts.

## Inputs Already Green

- `103_DB_Current_Supabase_Inventory__AUDIT__Remote_DB_Object_Map.md`
- `103_DB_Berlin_Auth_Connector__AUDIT__Users_Login_Connector_Map.md`
- `103_DB_Accounts__PRD__Accounts_Table.md`
- `103_DB_Billing_Status__PRD__Billing_Status_Stub.md`
- `103_DB_Users__PRD__Users_Table.md`
- `103_DB_Instances__PRD__Instances_Table.md`

## Target DB Product Model

The DB Pivot uses Supabase only for operational state the application must query or update transactionally.

V1 core tables:

| Table | Purpose | Product owner | Notes |
| --- | --- | --- | --- |
| `accounts` | Account existence, status, tier, billing grace clock, selected target locales, locale policy, creation time. | Berlin/account DB model | No `public_id`, no `is_platform`, no generic `updated_at`, no locale entitlement JSON. |
| `users` | Human, one account association, role, current profile fields, V1 login mapping. | Berlin | Replaces `user_profiles`, `account_members`, and `login_identities` for V1. |
| `account_invitations` | Invite Members lifecycle. | Berlin | Survives as V1 lifecycle table; never creates account membership rows. |
| `instances` | Instance registry/control state: existence, account owner, instance id, widget type, coarse translation status, publish status, creation time. | Tokyo/Roma product operations backed by DB | Does not store authored content, translated payloads, display/title text, or generated artifacts. |

Billing/status stub:

| Model | Purpose | Notes |
| --- | --- | --- |
| `accounts.status`, `accounts.tier`, `accounts.status_changed_at` | Current PLG/billing status and grace/deletion clock. | History stays cold in account-owned history artifact, not hot DB rows. |

## Current Remote DB Delete/Rebuild Map

| Current object | Target action | Reason |
| --- | --- | --- |
| `accounts` | Rebuild | Product need survives; current row carries duplicate identity, platform flag, legacy l10n JSON names, tier-change noise, and generic update state. Target keeps account locale settings under explicit product names. |
| `account_members` | Delete | V1 role truth moves to `users.role`; multi-account membership is not product truth. |
| `account_invitations` | Rebuild | Feature survives, current shape points at old membership/profile model. |
| `login_identities` | Delete/rebuild into `users` | V1 login mapping lives on `users.login_provider` and `users.login_subject`; no extra login table. |
| `user_profiles` | Rebuild as `users` | Current table mixes profile, provider snapshots, active account, and old auth shape. |
| `user_contact_methods` | Delete/defer | Zero rows; accepted/current phone/WhatsApp live on `users`; verification flow requires separate PRD. |
| `user_contact_verifications` | Delete/defer | Zero rows; temporary verification flow not core DB Pivot state. |
| `account_publish_containment` | Merge/delete | Serving policy folds into account status/tier and materialization operations. |
| `account_commercial_overrides` | Delete/defer | No active caller or rows; ck-policy/billing must prove need before survival. |
| `internal_control_events` | Delete/defer | No active caller or rows; future audit/control PRD can reintroduce deliberately. |
| `widgets` | Delete | Widget definitions belong to Tokyo/repo product operations, not Supabase. |
| `resolve_login_identity` | Rebuild | Must target new `users` shape. |
| `transfer_account_owner` | Rebuild | Must update `users.role` transactionally. |
| `is_account_member/admin/editor` | Delete/rebuild | Old membership helpers die with `account_members`. |
| `normalize_asset_config_json/string` | Delete | No approved DB Pivot purpose. |

## R2 Product-State Audit To Complete

Initial repo evidence read:

- `tokyo-worker/src/domains/render/keys.ts`
- `tokyo-worker/src/domains/render/instance-index.ts`
- `tokyo-worker/src/domains/render/saved-config.ts`
- `tokyo-worker/src/domains/render/overlays.ts`
- `tokyo-worker/src/domains/render/translation-generation-state.ts`
- `tokyo-worker/src/domains/render/public-artifacts.ts`

Current object/path map:

| Current object/key family | Current code owner | Current use | Target action | Owning future slice |
| --- | --- | --- | --- | --- |
| `accounts/{accountId}/instances/index.json` | Tokyo-worker `instance-index.ts` | Account instance listing/read model; rebuilt by listing R2 instance docs. | Delete as product truth. Replace with DB-backed `instances` query behind Tokyo `listAccountInstances`. | 103_DB.2 |
| `accounts/{accountId}/instances/{instanceId}/instance.config.json` | Tokyo-worker `saved-config.ts` | Non-text config, identity/display metadata, and locale metadata. | Stop using as cross-service contract. Keep only behind Tokyo payload operation if still needed physically. DB row owns registry/control and publish state. | 103_DB.2 |
| `accounts/{accountId}/instances/{instanceId}/instance.content.json` | Tokyo-worker `saved-config.ts` | Base editable text fields, changed/ok status, translated values per field. | Stop exposing as cross-service contract. Tokyo may use as internal payload in v1; DB `instances` owns coarse state only. | 103_DB.2 / 103_DB.4 |
| `accounts/{accountId}/instances/{instanceId}/instance.json` | Tokyo-worker `saved-config.ts`, `instance-index.ts` | Legacy compatibility mirror and fallback for open/list. | Delete active fallback. One-shot migration may read it; no product path may preserve it. | 103_DB.7 |
| `accounts/{accountId}/instances/{instanceId}/translation-generation-job.json` | Tokyo-worker `translation-generation-state.ts` | Current translation job/progress document. | Delete as product operation truth. Generate/running coarse state belongs in DB `instances.translation_status`; detailed payload remains inside Tokyo operation/queue if needed. | 103_DB.4 |
| `accounts/{accountId}/instances/{instanceId}/overlays/{overlayId}.json` | Tokyo-worker `overlays.ts` | Legacy/private translated value object family and historical overlay id selection logic. | Delete overlay id/pointer/inventory concepts from product API. Translated values are addressed by `{instanceId, locale}` through Tokyo operation. Physical payload may remain only behind Tokyo. | 103_DB.3 |
| Latest-overlay selection by R2 list/pick | Tokyo-worker `overlays.ts` | Infers current translated locale by scanning overlay objects and choosing latest complete id. | Delete. Tokyo operation returns translated locale readiness directly. | 103_DB.3 |
| Public files: `index.html`, versioned CSS/JS support files, `{locale}.html` | Tokyo-worker `public-artifacts.ts`, public route | Generated browser artifacts served from R2/CDN. | Keep in R2. Public serving reads these only; app services must not infer authoring state from them. | 103_DB.7 |
| Product widget source: `product/widgets/{widget}/widget.html/js/css` and widget metadata files | Tokyo repo/R2 deploy source | Static widget software/source read by Tokyo materializer and product operations. | Keep as static product source through Tokyo widget-definition operation. Do not use Supabase `widgets`. | 103_DB.5 |
| `tokyo/product/widgets/{widget}/catalog.json` | Tokyo-worker `widget-catalog.ts` through `listWidgetDefinitions` / `getWidgetDefinition` | Small static widget listing metadata: label, description, category, order. | Keep only as repo/static widget source read by Tokyo's widget-definition operation. It is not generated product state and does not belong in Supabase. | 103_DB.5 |
| Historical `tokyo/product/widgets/manifest.json` | Deleted by 103_01.3b | Former generated widget authority imported by services/tests. | Remains deleted. Do not reintroduce a generated widget catalog/read model as product truth. | 103_DB.5 |
| Historical `/__internal/renders/widgets/catalog.json` | Deleted by 103_01.3b | Former storage-shaped Roma-facing widget catalog route. | Remains deleted. Roma uses `GET /__internal/widgets/definitions`, the product operation route. | 103_DB.5 |
| Historical `scripts/build-widget-catalog.mjs` | Deleted by 103_01.3b | Former broad bootstrap-era generated catalog writer. | Remains deleted. Do not reintroduce a generated widget catalog/read model as product truth. | 103_DB.5 |
| Historical `scripts/validate-widget-source.mjs` | Deleted by PRD 107 | Former standalone widget source validation guard. | Remains deleted. Widget limits are parsed by `ck-policy` at the Bob compiled-widget boundary; widget source indexing is checked by `scripts/generate-widget-definition-sources.mjs --check`. | 103_DB.5 / PRD 107 |
| `scripts/verify/primitive-drift.mjs` | Verification guard | Blocks known deleted generated widget/source vocabularies and storage-shaped drift. | Keep and extend in implementation slices for DB/R2 boundary drift. | 103_DB.8 |
| `tokyo/product/dieter/manifest.json` | Dieter build output consumed by Bob/compiler/CDN tooling | Component/media bundle registry for design-system assets. | Keep as build/deploy artifact only. It is not widget/account/instance/translation product state. | Outside DB Pivot product state |
| `tokyo/roma/i18n/public/manifest.json` and `/i18n/manifest.json` | i18n build output consumed by UX/i18n loaders | Static translation bundle manifest for product chrome/content. | Keep as static build artifact only. It is not account instance state and not a DB candidate in this pivot. | Outside DB Pivot product state |

Additional active product-state object reads/writes are now mapped at the ownership level:

- account instance source/index reads and writes map to DB-backed Tokyo instance operations;
- instance config/content source files stop being cross-service contracts and become Tokyo-owned payload implementation detail until 103_DB.2 decides physical storage;
- translated locale value payloads stop exposing overlay ids/pointers/inventories and are addressed by `{instanceId, locale}` through Tokyo operations;
- generated widget catalog/manifest artifacts are either already deleted or classified as non-mutating/static validation/build outputs;
- public publish artifacts stay in R2/CDN and are never authoring state;
- account history is a cold account-owned JSONL artifact read only by support/admin/history inspection;
- no script-generated JSON may be used as product operation truth unless a later slice names it as a public/static build artifact.

Classification rule:

```text
If application services query/update it as operational state, move it behind DB-backed product operations.
If browsers fetch it as generated/public content, keep it in R2/CDN.
If it is a generated read model for another Clickeen service, delete or replace with direct product operation.
```

## Supabase Workflow Audit

Initial repo evidence read:

- `scripts/dev-up.sh`
- `scripts/dev/local-supabase.mjs`
- docs grep for `DEV_UP_USE_REMOTE_SUPABASE`, `supabase start`, `supabase migration up`, `db reset`, `db push`, and `db pull`.

Current script risk map:

| Current path | Evidence | Target action |
| --- | --- | --- |
| `scripts/dev-up.sh` | Previously started local Supabase, ran `supabase migration up`, and loaded local Supabase env into the app stack. | Quarantined in this slice. It now reads explicit env only and refuses to start, migrate, reset, seed, or switch Supabase targets. Useful Dieter/i18n build chores remain. |
| `scripts/dev/local-supabase.mjs` | Read `DEV_UP_USE_REMOTE_SUPABASE`, shelled `supabase status -o env`, and could fall back between local and env-provided Supabase. | Deleted in this slice. No runtime local/remote Supabase switch remains in active scripts. |
| `documentation/services/bob.md` | Previously documented local Supabase by default and `DEV_UP_USE_REMOTE_SUPABASE=1`. | Updated in this slice to block Supabase lifecycle/target switching from `dev-up`. |
| `documentation/architecture/Overview.md` | Previously documented local default and remote switch. | Updated in this slice to block local script Supabase lifecycle/target switching. |

Result:

- active scripts no longer contain `DEV_UP_USE_REMOTE_SUPABASE`;
- active scripts no longer run `supabase start`;
- active scripts no longer run `supabase migration up`;
- active scripts no longer set `CK_SUPABASE_TARGET=local`;
- `dev-up` still runs useful non-DB local chores: Dieter build, i18n build/validate, local Workers/UI startup, font sync.

Target rule:

```text
Agents do not run Supabase reset/push/seed/mutation flows from terminal.
Schema changes happen through reviewed migrations and the approved deploy path.
Local Supabase is not product truth and not remote evidence.
```

## Green Checklist

- [x] Remote Supabase object inventory accepted for rebuild/delete planning.
- [x] Berlin auth/connector audit closed.
- [x] Target core DB tables named.
- [x] Current remote table/function delete/rebuild map drafted.
- [x] Active R2 product-state reads/writes mapped at first-pass owner level.
- [x] Active generated JSON/read-model artifacts mapped.
- [x] Supabase/dev script lifecycle mapped and quarantined at active-script level.
- [x] Accounts/Users/Instances child PRDs checked against this evidence lock.
- [x] No implementation slice starts with an unknown current object or fake compatibility path.

## Child PRD Consistency Check

Checked on 2026-05-22:

- Accounts child PRD approves only `id`, `status`, `status_changed_at`, `tier`, `selected_target_locales`, `locale_policy`, and `created_at`; rejects `public_id`, `is_platform`, locale entitlement JSON, generic `updated_at`, account profile fields, and core `account_members`.
- Users child PRD approves one user/one account, role on `users`, V1 login mapping on `users.login_provider` + `users.login_subject`, and deletes `account_members`, `user_profiles`, `login_identities`, active-account switching, and connector payloads on users.
- Instances child PRD approves only instance registry/control columns and rejects content/config payloads, display/title/name, locale values, translation job tables, job ids, per-locale progress, `sourceVersion`, generated artifact metadata, and legacy `instance.json` fallback.
- Billing Status child PRD uses `accounts.status` + `accounts.status_changed_at` for current lifecycle behavior and keeps history cold in account-owned JSONL, not hot DB rows.
