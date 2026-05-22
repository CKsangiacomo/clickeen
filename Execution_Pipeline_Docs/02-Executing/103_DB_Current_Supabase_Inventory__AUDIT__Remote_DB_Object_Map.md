# AUDIT 103_DB Current Supabase Inventory - Remote DB Object Map

Status: Green for rebuild/delete planning - Product accepted migration-inferred security/DDL evidence for this pivot on 2026-05-22
Date Started: 2026-05-22
Remote project ref: `ebmqwqdexmemhrdhkmwn`
Parent PRD: `103_DB_Current_Supabase_Inventory__PRD__Remote_DB_Audit_Gate.md`

## Rule

This audit must be green before any DB Pivot implementation migration starts.

No mutation commands are allowed while collecting this evidence.

Forbidden during this audit:

- `supabase db reset`
- `supabase db push`
- dashboard schema writes
- remote mutation SQL
- `supabase db pull` unless Product + Architecture explicitly decide remote dashboard drift must become a migration
- local Docker Supabase as evidence of remote product state

## Evidence Collected

No mutation commands were used.

Product + Architecture decision:

```text
Because the target is a rebuild/delete DB pivot rather than surgical preservation,
migration-inferred RLS/grants/triggers/extensions/publications evidence is accepted
as sufficient to proceed to 103_DB.1A. Direct remote SQL evidence remains useful,
but it no longer blocks planning the rebuild.
```

Safe remote checks that completed:

```bash
npx supabase@2.62.5 migration list --linked
npx supabase@2.62.5 gen types typescript --linked --schema public > /tmp/clickeen_remote_public_types.ts
npx supabase@2.62.5 inspect db table-stats --linked -o json > /tmp/clickeen_remote_table_stats.json
npx supabase@2.62.5 inspect db index-stats --linked -o json > /tmp/clickeen_remote_index_stats.json
```

Additional safe checks:

```bash
npx supabase@2.62.5 projects list -o json
npx supabase@2.62.5 snippets list --project-ref ebmqwqdexmemhrdhkmwn -o json
curl "$SUPABASE_URL/rest/v1/widgets?select=id,type,name,created_at,catalog&order=type.asc" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Tooling notes:

- `npx supabase@2.101.0` crashes with `SIGILL` on this Monterey Intel machine.
- `npx supabase@2.62.5` works for linked read-only metadata commands.
- `supabase db dump --schema public` is blocked because the CLI shells through Docker for `pg_dump`, and Docker Desktop is unavailable on this OS.
- Native `psql` and `pg_dump` are not installed.
- The checked-in `supabase/.temp/pooler-url` password is stale; direct SQL failed with `password authentication failed for user "postgres"`.
- `inspect db role-stats` is blocked by a Supabase CLI null-scan bug.
- The official Management API read-only SQL endpoint exists, but the local Supabase CLI credential is not accepted by that endpoint (`401`, `JWT could not be decoded`). This keeps direct remote RLS/grant SQL evidence blocked until a valid PAT/fine-grained token or dashboard/VS Code SQL output is available.
- PostgREST does not expose catalog views such as `pg_policies`; `/rest/v1/pg_policies` returns `PGRST205`.

Migration history result:

```text
Local and remote migration history match through 20260514120000__prd98_account_public_ids.
```

That proves the linked project and repo migration history line up. It does not prove the current schema is good product architecture.

## Inventory Status

| Object class | Status | Notes |
| --- | --- | --- |
| Tables | Captured | 11 public tables from generated remote types. |
| Columns | Captured | Column names and types captured from generated remote types. |
| Primary keys | Partially captured | Captured through generated relationships/index stats where visible; exact constraint DDL still needs direct SQL. |
| Foreign keys | Captured | Generated types expose current public relationships. |
| Indexes | Captured | `inspect db index-stats` completed. Exact predicates should be confirmed with direct SQL before migration. |
| Enums/types/domains | Captured | No public enums in generated remote types. |
| RLS policies | Migration-inferred; direct SQL blocked | Current surviving table policies were inferred from migration history, which matches remote. Direct remote confirmation still needs SQL access. |
| Grants | Migration-inferred; direct SQL blocked | Current surviving grants were inferred from migration history, which matches remote. Direct remote confirmation still needs SQL access. |
| Functions/RPCs | Captured | 7 public RPC/function surfaces from generated remote types. |
| Triggers | Migration-inferred; direct SQL blocked | Current surviving triggers were inferred from migration history. Direct remote confirmation still needs SQL access. |
| Extensions | Migration-inferred; direct SQL blocked | Migration history shows only `pgcrypto` created in `extensions` schema. Direct remote confirmation still needs SQL access. |
| Publications/realtime | Migration-inferred empty; direct SQL blocked | No checked-in migration creates/edits publications. Direct remote confirmation still needs SQL access. |
| Storage/auth dependencies | Partially captured | Public-schema FK map captured; auth/storage schemas still need direct SQL if relevant. |
| Code callers | Captured for active app code | Berlin and Roma callers mapped; no active Tokyo DB caller found. |

## Current Remote Public Tables

| Table | Columns | Estimated rows | Estimated size | Remote usage signal |
| --- | --- | ---: | ---: | --- |
| `accounts` | 17 | 2 | 104 kB | Active Berlin callers. |
| `account_members` | 4 | 2 | 64 kB | Active Berlin callers. |
| `account_invitations` | 11 | 5 | 64 kB | Active Berlin callers. |
| `login_identities` | 13 | 3 | 64 kB | Active Berlin callers. |
| `user_profiles` | 12 | 2 | 80 kB | Active Berlin callers. |
| `user_contact_methods` | 6 | 0 | 16 kB | Active Berlin callers but no rows. |
| `user_contact_verifications` | 10 | 0 | 24 kB | Active Berlin callers but no rows. |
| `account_publish_containment` | 4 | 0 | 16 kB | Active Berlin/Roma callers but no rows. |
| `account_commercial_overrides` | 6 | 0 | 16 kB | No active repo caller found. |
| `internal_control_events` | 10 | 0 | 32 kB | No active repo caller found. |
| `widgets` | 5 | 3 | 32 kB | No direct repo caller found, but high remote index scan count. |

Direct data API check for `widgets` returned:

| type | name | catalog |
| --- | --- | --- |
| `countdown` | `Countdown` | `{}` |
| `faq` | `FAQ` | `{}` |
| `logoshowcase` | `Logoshowcase` | `{}` |

This table is not carrying useful catalog state. It is a stale type list with an authenticated `SELECT` grant.

## Public Functions / RPCs

| Function | Current purpose | Caller evidence | Classification |
| --- | --- | --- | --- |
| `resolve_login_identity(...)` | Berlin login reconciliation. | `berlin/src/identity/reconcile.ts` | rebuild |
| `transfer_account_owner(...)` | Berlin account governance. | `berlin/src/account-management/governance.ts` | rebuild |
| `is_account_admin(target_account_id uuid)` | Role helper for RLS/app checks. | Remote function surface; direct policy dependency not yet confirmed. | blocked |
| `is_account_editor(target_account_id uuid)` | Role helper for RLS/app checks. | Remote function surface; direct policy dependency not yet confirmed. | blocked |
| `is_account_member(target_account_id uuid)` | Role helper for RLS/app checks. | Remote function surface; direct policy dependency not yet confirmed. | blocked |
| `normalize_asset_config_json(p_json jsonb)` | Asset/config normalization residue. | No active repo caller found in current audit. | delete |
| `normalize_asset_config_string(p_value text)` | Asset/config normalization residue. | No active repo caller found in current audit. | delete |

## Migration-Inferred Security / DDL Inventory

This section is not direct remote SQL output. It is inferred from checked-in migrations plus the verified fact that local and remote migration history match through `20260514120000__prd98_account_public_ids`.

### Surviving Table RLS / Policies / Grants

| Table | Migration-inferred RLS/grant shape | Product read |
| --- | --- | --- |
| `accounts` | RLS enabled. Policies: `accounts_service_role_all`, `accounts_select_members`. Grant: `SELECT` to `authenticated`. Trigger: `set_accounts_updated_at`. | Rebuild. Current security model depends on `account_members` helper functions, which the target model deletes. |
| `account_members` | RLS enabled. Policies: `account_members_select_members`, `account_members_manage_admin`. Grant: `SELECT` to `authenticated`. | Delete/rewrite. This is the current multi-account membership bomb. |
| `account_invitations` | RLS enabled. Policy: `account_invitations_service_role_all`. Trigger: `set_account_invitations_updated_at`. | Rebuild. Invite Members survives, current table does not. |
| `account_publish_containment` | RLS enabled. Policies: `account_publish_containment_service_role_all`, `account_publish_containment_select_members`. Grant: `SELECT` to `authenticated`. Trigger: `set_account_publish_containment_updated_at`. | Merge into billing/account serving status. |
| `account_commercial_overrides` | RLS enabled. Policy: `account_commercial_overrides_service_role_all`. Trigger: `set_account_commercial_overrides_updated_at`. | Defer/delete unless ck-policy/billing proves it. |
| `internal_control_events` | RLS enabled. Policy: `internal_control_events_service_role_all`. | Defer/delete unless audit/control proves it. |
| `login_identities` | RLS enabled. Policy: `login_identities_service_role_all`. Trigger: `set_login_identities_updated_at`. | Rebuild as Login Method. |
| `user_contact_methods` | RLS enabled. Policy: `user_contact_methods_service_role_all`. Trigger: `set_user_contact_methods_updated_at`. | Delete/defer. |
| `user_contact_verifications` | RLS enabled. Policy: `user_contact_verifications_service_role_all`. Trigger: `set_user_contact_verifications_updated_at`. | Delete/defer. |
| `user_profiles` | RLS enabled. Policy: `user_profiles_service_role_all`. Trigger: `set_user_profiles_updated_at`. | Rebuild as `users`. |
| `widgets` | No RLS policy found in migrations. Grant: `SELECT` to `authenticated`. | Delete. Widget definitions belong to Tokyo operations. |

### Surviving Public Functions / Grants

| Function | Migration-inferred grant shape | Product read |
| --- | --- | --- |
| `is_account_member(uuid)` | `EXECUTE` to `authenticated` and `service_role`; revoked from `PUBLIC`. | Delete/rebuild with old membership model. |
| `is_account_editor(uuid)` | `EXECUTE` to `authenticated` and `service_role`; revoked from `PUBLIC`. | Delete/rebuild with old membership model. |
| `is_account_admin(uuid)` | `EXECUTE` to `authenticated` and `service_role`; revoked from `PUBLIC`. | Delete/rebuild with old membership model. |
| `transfer_account_owner(uuid, uuid, uuid)` | `EXECUTE` to `service_role`; revoked from `PUBLIC`. | Rebuild only if owner transfer survives simplified Users model. |
| `resolve_login_identity(...)` | `EXECUTE` grant exists in migrations; current generated types prove function exists. | Rebuild against `users` + Login Method. |
| `normalize_asset_config_json(jsonb)` | No active caller found; generated types prove function exists. | Delete. |
| `normalize_asset_config_string(text)` | No active caller found; generated types prove function exists. | Delete. |

### Extensions / Publications

| Object class | Migration-inferred result | Product read |
| --- | --- | --- |
| Extension | `pgcrypto` created in `extensions` schema. | Likely keep or replace depending on new ID generation. |
| Publications/realtime | No checked-in migration creates or alters publications. | Treat realtime as absent unless direct remote SQL proves otherwise. |

## Current Caller Map

| DB object | Caller path | Caller type | Product operation | Keep/rewrite/delete decision |
| --- | --- | --- | --- | --- |
| `resolve_login_identity` | `berlin/src/identity/reconcile.ts` | Active product path | Login reconciliation. | Rewrite under Users/Login Method PRD. |
| `user_profiles` | `berlin/src/identity/reconcile.ts` | Active product path | Create/read login user profile. | Rebuild as `users`. |
| `user_profiles` | `berlin/src/bootstrap/state.ts` | Active product path | Bootstrap current user/account context. | Rebuild as `users`. |
| `user_profiles` | `berlin/src/identity/user-profiles.ts` | Active product path | User preference/profile endpoint. | Rebuild as `users`; remove profile black box. |
| `account_members` | `berlin/src/bootstrap/state.ts` | Active product path | Determine current account and role. | Delete/rewrite; one user belongs to one account in approved V1. |
| `account_members` | `berlin/src/account-management/members.ts` | Active product path | Invite Members/team list. | Rewrite to approved Invite Members/account role model. |
| `account_members` | `berlin/src/account-management/invitations.ts` | Active product path | Invitation acceptance/membership write. | Rewrite. |
| `account_invitations` | `berlin/src/account-management/invitations.ts` | Active product path | Invite Members lifecycle. | Rebuild as approved V1 lifecycle table. |
| `accounts` | `berlin/src/identity/reconcile.ts` | Active product path | Account creation/default account. | Rebuild minimal account row. |
| `accounts` | `berlin/src/bootstrap/state.ts` | Active product path | Account context. | Rebuild minimal account row. |
| `accounts` | `berlin/src/account-management/governance.ts` | Active product path | Account governance and owner transfer. | Rewrite; owner transfer likely changes with one-account user model. |
| `accounts` | `berlin/src/account-management/locales.ts` | Active product path | Account locale settings. | Rewrite; available locales come from tier/policy, used locales from Roma settings. |
| `login_identities` | `berlin/src/bootstrap/state.ts` | Active product path | Read login methods. | Rebuild as login methods, not connectors. |
| `login_identities` | `berlin/src/identity/reconcile.ts` | Active product path | Create/update login identity. | Rebuild. |
| `user_contact_methods` | `berlin/src/identity/contact-methods.ts` | Active product path | Contact methods/verification. | Delete or defer; current separate contact model not approved. |
| `user_contact_verifications` | `berlin/src/identity/contact-methods.ts` | Active product path | Contact verification flow. | Delete or defer; current separate contact model not approved. |
| `account_publish_containment` | `berlin/src/publish-containment/account-publish-containment.ts` | Active product path | Account serving containment. | Merge into status/tier serving policy. |
| `account_publish_containment` | `roma/lib/berlin-publish-containment.ts` | Active product path | Roma reads containment. | Rewrite to Berlin account status/serving operation. |
| Tokyo instance objects | `roma/lib/account-instance-direct.ts` | Active product path | Roma lists/loads/saves instances through Tokyo internal routes. | DB Pivot must replace storage-object coordination with product operations. |
| Tokyo widget definitions | `roma/lib/account-instance-direct.ts` | Active product path | Roma loads widget definitions from Tokyo. | Keep as product operation; do not route through DB `widgets`. |
| `widgets` | Migrations only in repo search | Migration/bootstrap residue | Historical widget catalog/bootstrap. | Delete candidate; blocked by high remote index-scan signal until live deployed usage is checked. |

No active direct database caller was found in `tokyo-worker/src` during this audit. Tokyo currently owns instance state through R2/object routes, not through Supabase.

## Object Map

Every row below has a product domain and a current decision. `blocked` means implementation cannot touch that object until the named evidence is resolved.

| Object | Object type | Domain | Classification | Current callers | Decision / notes | Owning future slice |
| --- | --- | --- | --- | --- | --- | --- |
| `accounts` | table | Accounts | rebuild | Berlin active | Product need survives, but current row is bloated: UUID plus `public_id`, `is_platform`, `name`, `slug`, `website_url`, l10n JSON, tier history columns, and generic `updated_at`. Target account table must be minimal and tied to billing/status/tier contracts. | `103_DB_Accounts` + `103_DB_Billing_Status` |
| `account_members` | table | Users | delete | Berlin active | Current table enables multi-account membership, which is explicitly rejected for V1. Rewrite callers so `users.account_id` and `users.role` carry the approved one-user-one-account model. | `103_DB_Users` |
| `account_invitations` | table | Invite Members | rebuild | Berlin active | Invite Members is a real feature and needs a V1 lifecycle table, but current shape points at `user_profiles` and old membership semantics. | `103_DB_Users` |
| `login_identities` | table | Berlin auth login method | rebuild | Berlin active | Product need survives: login method is separate from user. Current row duplicates profile/provider fields and points at `user_profiles`. Must rebuild as login methods, not connectors. | `103_DB_Users` + Berlin auth/connector audit |
| `user_profiles` | table | Users | rebuild | Berlin active | Product need survives as `users`. Current name and shape are wrong: profile black box, `active_account_id`, email verification duplication, and old account membership assumptions. | `103_DB_Users` |
| `user_contact_methods` | table | Users | delete | Berlin active, zero rows | Current separate contact method model is not approved for the DB Pivot. If phone/email verification is needed, it must be specified in Users PRD without duplicate verification truth. | `103_DB_Users` |
| `user_contact_verifications` | table | Users | delete | Berlin active, zero rows | Same as `user_contact_methods`; no rows and no approved product contract. | `103_DB_Users` |
| `account_publish_containment` | table | Billing status stub | merge | Berlin/Roma active, zero rows | Serving containment is real, but not as a standalone table. Account status/tier and the billing grace contract should drive `applyFreeTierServing`. | `103_DB_Billing_Status` |
| `account_commercial_overrides` | table | Policy/entitlement | defer | No active repo caller found, zero rows | Possible policy/billing residue. Do not preserve by default. Decide in ck-policy/billing review; otherwise delete. | ck-policy decision slice |
| `internal_control_events` | table | Audit/control | defer | No active repo caller found, zero rows | Audit/control may become useful, but current empty table is not approved product architecture. Keep out of pivot unless a compliance/audit PRD owns it. | Future audit/control PRD or delete |
| `widgets` | table | Legacy widget catalog | delete | No direct repo caller found; row check shows only three static types with empty catalogs; high remote index scans | Widget product definitions belong in Tokyo, not DB. The scan count is treated as historical/dashboard/OpenAPI/deployed-old-path noise unless a live caller is proven before migration. | widget catalog cleanup |
| `resolve_login_identity` | RPC | Berlin auth login method | rebuild | Berlin active | Login reconciliation survives but must target `users` and login methods, not `user_profiles` plus multi-account membership. | `103_DB_Users` |
| `transfer_account_owner` | RPC | Users | rebuild | Berlin active | Current governance assumes membership model. Rebuild only if owner transfer survives V1 account/user rules. | `103_DB_Users` |
| `is_account_admin` | RPC | Users | blocked | Possible RLS/policy dependency | Cannot classify until remote RLS/policies are directly inspected. Likely dies or rebuilds if account membership table dies. | RLS/grant evidence gate |
| `is_account_editor` | RPC | Users | blocked | Possible RLS/policy dependency | Same as `is_account_admin`. | RLS/grant evidence gate |
| `is_account_member` | RPC | Users | blocked | Possible RLS/policy dependency | Same as `is_account_admin`. | RLS/grant evidence gate |
| `normalize_asset_config_json` | RPC | Legacy instance/widget scaffolding | delete | No active repo caller found | Asset/config normalization residue. No approved DB Pivot purpose. | cleanup |
| `normalize_asset_config_string` | RPC | Legacy instance/widget scaffolding | delete | No active repo caller found | Asset/config normalization residue. No approved DB Pivot purpose. | cleanup |

## Migration History Objects That No Longer Exist Remotely

Checked-in migrations reference many tables that are not present in the current remote public schema. They must not be treated as current product truth.

Examples:

- `widget_instances`
- `curated_widget_instances`
- `widget_instance_overlays`
- `l10n_*`
- `comments`
- `workspaces`
- `workspace_members`
- `account_assets`
- `account_asset_*`
- `instance_*`

Current remote generated types confirm these are gone from `public`.

## Product Read From This Audit

The user expectation that this is "99% nuke" is directionally correct.

What survives is not the current table design. What survives is the product need:

- accounts exist and carry billing/status/tier truth;
- users exist and belong to exactly one account in V1;
- login methods exist separately from future business connectors;
- Invite Members exists as a V1 lifecycle feature;
- instances need deterministic operational state, but they are not currently in Supabase;
- widget definitions belong in Tokyo, not in the DB.

The current database is mostly Berlin/auth bootstrap and legacy widget/catalog residue. The DB Pivot should rebuild clean product tables instead of preserving these names as architecture.

## Open Questions / Blockers

1. Direct remote SQL output is still not available from this machine. Migration-inferred evidence is accepted for rebuild/delete planning; direct SQL remains useful for the final migration review.
2. `widgets` table is now classified `delete`. Before the actual drop migration, run a deployed-old-path check so any legacy cloud-dev/production caller is found deliberately instead of preserved blindly.
5. `account_commercial_overrides` needs a ck-policy/billing decision. If ck-policy remains file-backed policy, this table likely dies.
6. `internal_control_events` needs a compliance/audit decision. If no current product reader/writer owns it, it dies.
7. Contact verification needs a Users PRD decision. The current separate contact tables have zero rows and are not approved by the simplified Users model.

## Migration Blockers

- Product + Architecture accepted migration-inferred RLS/grants/triggers/extensions/publications evidence as sufficient for rebuild/delete planning.
- No implementation migration may preserve `widgets`; before dropping, it must verify deployed live usage and then delete or route that usage to Tokyo widget-definition operations.
- No implementation migration may preserve `account_members`, `user_profiles`, or `login_identities` as-is. They are rebuild surfaces, not stable foundations.
- No DB Pivot slice may introduce a new abstraction table unless the parent DB Pivot PRD explicitly approves the product operation it serves.

## Required PRD Updates After Audit

- Parent DB Pivot PRD must state that current Supabase is a rebuild surface, not a foundation to preserve.
- Accounts PRD must explicitly delete `public_id`, `is_platform`, account display/name fields, l10n JSON, and generic tier history columns unless a later approved slice restores them.
- Users PRD must explicitly replace `user_profiles` and `account_members` with the approved one-user-one-account model.
- Users PRD must separate login methods from future connector/account connections.
- Invite Members V1 table must be specified as its own lifecycle table or explicitly deferred.
- Billing Status PRD must own account status, `status_changed_at`, grace, serving downgrade, and deletion windows.
- Instances PRD must not use the old `widgets` DB table; widget definitions come from Tokyo operations.

## Green Checklist

- [x] Every remote public table inventoried.
- [x] Every remote public table has a product domain.
- [x] Every remote public table has a keep/rebuild/merge/delete/defer/blocked classification.
- [x] Public functions/RPCs inventoried.
- [x] Active Berlin/Roma callers mapped at repo level.
- [x] No mutation command was used during audit collection.
- [x] Migration-inferred RLS policy map captured.
- [x] Migration-inferred grants captured.
- [x] Migration-inferred triggers captured.
- [x] Migration-inferred extensions captured.
- [x] Migration-inferred publications/realtime result captured.
- [x] `widgets` row payload and repo caller check captured; classified delete.
- [x] Direct remote RLS policies captured or migration-inferred evidence explicitly accepted.
- [x] Direct remote grants captured or migration-inferred evidence explicitly accepted.
- [x] Direct remote triggers captured or migration-inferred evidence explicitly accepted.
- [x] Direct remote extensions captured or migration-inferred evidence explicitly accepted.
- [x] Direct remote publications/realtime captured or migration-inferred evidence explicitly accepted.
- [x] Product + Architecture approve the object map for rebuild/delete planning.
