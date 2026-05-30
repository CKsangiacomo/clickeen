# PRD 105B - Core DB Model Verification

Status: Green / contract verified
Owner: Product + Architecture
Date: 2026-05-27
Parent: `105__PRD__Instance_Folder_Tenets.md`
Depends on: `105A__PRD__DB_R2_Operation_Authority.md`

## Purpose

Verify that the executed core DB model still matches the PRD 105 north star.

This PRD extracts the surviving account/user/billing/instance schema rules from the 103_DB core model batch. The goal is not to redesign the DB. The goal is to prove that the executed schema and active runtime did not preserve the old identity, membership, platform-flag, widget-catalog, or R2-as-DB models.

## Source Documents Reviewed

This PRD extracts from:

```text
103_DB_Accounts__PRD__Accounts_Table.md
103_DB_Users__PRD__Users_Table.md
103_DB_Billing_Status__PRD__Billing_Status_Stub.md
103_DB_Instances__PRD__Instances_Table.md
103_DB_Core_Schema_Foundation__EXEC__Accounts_Users_Instances.md
```

Those documents become historical evidence after this extraction. They must not remain active execution authority.

## Product Contract

The core DB model is intentionally small:

```text
accounts = account identity, lifecycle status, tier/policy input, account locale settings, creation time
users = one human, one account, one role, login mapping, current profile fields
account_invitations = invite lifecycle
instances = account-owned instance registry/control row
```

The DB must not become the widget payload store, translation payload store, generated artifact store, or public serving path.

## Surviving Rules To Keep

### Accounts

- `accounts.id` is the one compact account identity.
- There is no co-equal `accounts.public_id`.
- There is no `is_platform` core account flag.
- Admin/platform behavior must not be derived from a magic account id.
- `accounts.status` is current lifecycle/billing state.
- `accounts.status_changed_at` is the current status lifecycle clock.
- `accounts.tier` is the policy input; limits stay in `ck-policy`.
- Account history is cold evidence, not current product truth.
- Account deletion is an operation, not a retained `closed` status.

### Users

- One user belongs to one account in V1.
- Role lives on `users.role`.
- `account_members` is not V1 product truth.
- `active_account_id` is not V1 product truth.
- Invite/add-user rejects an email that is already associated with any account.
- Login Method is not Account Connection.
- Account Connection, Connection Resource, and Widget Source require later explicit PRDs.
- Roma receives user/account context from Berlin and does not write users.
- Tokyo and San Francisco do not write users.

### Billing Status Stub

- Approved V1 account statuses are `active` and `suspended`.
- No `closed` status.
- Suspended account behavior is product-gated through account status, tier, and `ck-policy`.
- Public visitor serving must not read Supabase.
- Billing recovery/materialization uses named operations such as `applyFreeTierServing` and `restorePaidTierServing`.
- Account deletion must remove operational rows plus owned Tokyo/R2 source, overlays, assets, and generated artifacts according to the deletion policy.

### Instances

- `instances` is a registry/control table only.
- `instances.id` is the durable instance id.
- `instances.account_id` is the compact account id.
- `instances.widget_type` identifies the widget product but is not a DB widget catalog.
- `instances.publish_status` is product publish intent, not public file presence.
- `instances.translation_status` is coarse liveness only: `idle`, `queued`, `running`, `failed`.
- Translation sync, readiness, markers, locale values, job ids, and per-locale progress do not belong in `instances`.
- Widget payloads, translated values, generated artifacts, and public artifact metadata do not belong in `instances`.
- Public serving does not read `instances`.

## PRD 105 Boundary Clarifications

### Account Locale Settings vs Instance Locale Output

Account-level locale settings and instance locale overlays are different product concerns.

Correct boundary:

```text
accounts = account-level locale settings and policy input
instance.config.json = instance source metadata
instance.content.json = base customer-visible source text
overlays/locales/{locale}.json = durable translated locale output
```

The DB may hold selected account target locales or account locale policy. It must not hold locale overlay payloads by default.

### Coarse Translation Status

`instances.translation_status` may exist only as coarse product liveness for the Generate button and backend operation gates.

It must not become:

- sync truth;
- readiness truth;
- per-locale progress;
- job identity;
- stale-work authority;
- a replacement for locale overlays;
- a reason to preserve `translation-generation-job.json`.

### Publish Status

`instances.publish_status` is product intent.

Generated files in R2 are materialized output. R2 file presence must not decide whether the instance is published.

## Verification Scope

This PRD is green only when active schema/code/docs are checked for these rules.

Required checks:

- schema has the approved core tables: `accounts`, `users`, `account_invitations`, `instances`;
- schema does not contain core `account_members`, `user_profiles`, `login_identities`, or `widgets` tables as active product truth;
- `accounts` does not expose `public_id` as co-equal identity;
- `accounts` does not expose `is_platform`;
- `users` carries `account_id` and `role`;
- active invite/add-user flow rejects existing global emails instead of creating cross-account membership;
- `instances` does not contain payload, locale value, job history, marker, per-locale progress, generated artifact, or source-version columns;
- active runtime does not read public files to decide publish state;
- active runtime does not use R2 account indexes or source files for account instance listing;
- active runtime does not use `translation_status` as translation sync truth;
- active docs do not present the old many-account membership model, `public_id`, `is_platform`, DB widget catalog, or DB payload storage as current truth.

## Final Verification - 2026-05-30

PRD 105B is green.

Executed changes:

- Berlin account routes now validate compact account ids with the same account-public-id contract as the DB and public product.
- Berlin membership/member-role operations read and write `users.account_id` and `users.role`; `account_members` is not active runtime truth.
- Berlin user settings read and write the `users` row; `user_profiles` is not active runtime truth.
- Berlin invite acceptance attaches a user to the invited account by updating `users.account_id` and `users.role`.
- The fake active-account-preference shim was deleted. There is no V1 `active_account_id` persistence or preference concept.
- The `/v1/me/identities` / Roma `/api/me/identities` connector surface was deleted. Login method is not Account Connection in V1.
- Contact-method verification routes and tables were removed from active runtime. Phone/WhatsApp verification requires a later focused PRD if it returns.
- Latest Supabase migration `20260530100000__prd105b_resolve_login_identity_account_id.sql` replaces the RPC output with `account_id` and recreates `transfer_account_owner` against the current `users` model.

Static verification passed:

```text
pnpm --filter @clickeen/berlin typecheck
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/berlin verify:auth-boundary
pnpm verify:prd103-db-pivot
pnpm validate:widgets
pnpm typecheck
```

Live Supabase read verification:

```text
200 /rest/v1/accounts keys=id,status,tier
200 /rest/v1/users keys=user_id,account_id,role,primary_email,login_provider,login_subject
200 /rest/v1/account_invitations keys=id,account_id,email,role,status
200 /rest/v1/instances keys=id,account_id,widget_type,publish_status,translation_status
404 /rest/v1/account_members
404 /rest/v1/user_profiles
404 /rest/v1/login_identities
404 /rest/v1/widgets
```

Legacy scan:

```text
rg "user_profiles|account_members|login_identities|active_account_id|is_platform|isPlatform|reconcile|user-profiles|profile-normalization|contact-methods|user_contact_methods|user_contact_verifications|login_identity_id|created_identity"
```

Allowed matches only remain in `scripts/verify/prd103-db-pivot-guard.mjs`, where those names are forbidden-schema checks.

Subagent verification:

- Product/architecture lens: Green.
- Legacy/no-LOC-left-behind lens: Green.
- Runtime/migration/deploy-risk lens: Green.

Deployment order caveat:

```text
1. Apply Supabase migration 20260530100000__prd105b_resolve_login_identity_account_id.sql.
2. Verify resolve_login_identity returns account_id.
3. Deploy Berlin.
```

Berlin must not deploy before the migration because the runtime now expects the RPC to return `account_id`.

## Archive Decision For Source Batch

After this PRD is created, the core DB model batch must move to `03-Executed` as historical evidence.

Required archive status:

```text
Executed historical evidence.
Surviving doctrine extracted to PRD 105B.
Superseded by PRD 105/105A/105B where conflicting.
```

## Non-Scope

This PRD does not:

- redesign account billing;
- implement real Stripe/billing tables;
- create connector tables;
- implement agency account rollups;
- move instance source payloads into DB;
- move translated locale overlays into DB;
- repair translation runtime liveness;
- rename R2 generated files;
- change Prague/account coordinate work.

Those require separate focused PRD 105 sub-PRDs if verification proves they are needed.
