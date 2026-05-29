# AUDIT 103_DB Berlin Auth/Connector - Users, Login, Connector Map

Status: Executed historical evidence / green Berlin auth-connector audit; surviving doctrine extracted to PRD 105A
Date Started: 2026-05-22
Parent PRD: `103_DB_Pivot__PRD__Operational_State_In_Supabase_Public_Artifacts_In_R2.md`
Execution slice: `103_DB.1A - Berlin auth/connector audit`

Archive note: retained as evidence for the V1 user/account/login boundary. It is not active execution authority.

## Rule

This audit is pre-work for the DB Pivot Users slice.

No implementation or database mutation is allowed from this audit. Its job is to decide what survives, what is rebuilt, and what is deleted before any migration or code rewrite starts.

The default posture is rebuild/delete, not preservation. If the current Berlin shape is easier to rebuild than to safely tweak, rebuild.

## Product Boundary

Clickeen V1 uses the simple user/account rule approved in the Users PRD:

```text
One user belongs to one account.
One account has many users.
The user's role is the user's role in that account.
```

That means the current many-account membership model is not product truth for this pivot.

Vocabulary locked for this audit:

| Term | Product meaning | DB Pivot decision |
| --- | --- | --- |
| `User` | The human using Clickeen, plus the accepted/current person fields needed by User Settings and account access. | Core row in `users`. |
| `Login Method` | A way that proves a human can sign into Clickeen, such as Google login. | Current V1 login maps on `users`; no extra login table. |
| `Account Connection` | Account-authorized external provider/source used by Clickeen product capabilities, such as a Google Business Profile connection for a reviews widget. | Not part of Users core table. Future connector PRD. |
| `Connection Resource` | A selectable external business/resource under an account connection. | Future connector PRD. |
| `Widget Source` | A widget instance's reference to an account-owned connection resource. | Future connector/widget PRD. |

Login can suggest a provider account later in connector setup. Login does not automatically create an account connection, connector scopes, widget source, provider resource, or reusable provider token.

## Evidence Read

Current runtime/code evidence:

- `berlin/src/identity/reconcile.ts`
- `berlin/src/bootstrap/state.ts`
- `berlin/src/account-management/invitations.ts`
- `berlin/src/account-management/members.ts`
- `berlin/src/identity/contact-methods.ts`
- `berlin/src/identity/user-profiles.ts`
- `berlin/src/identity/profile-normalization.ts`
- `berlin/src/account-management/governance.ts`

Current documentation evidence:

- `documentation/architecture/AccountManagement.md`
- `documentation/services/berlin.md`
- `documentation/capabilities/multitenancy.md`
- `Execution_Pipeline_Docs/02-Executing/103_DB_Users__PRD__Users_Table.md`
- `Execution_Pipeline_Docs/02-Executing/103_DB_Current_Supabase_Inventory__AUDIT__Remote_DB_Object_Map.md`

## Documentation Conflict Resolved

`documentation/architecture/AccountManagement.md` previously said it was the canonical current model, but it conflicted with the DB Pivot Users model:

| Current doc says | DB Pivot says | Audit decision |
| --- | --- | --- |
| `User Profile`, `Account`, and `Account Membership` are canonical. | `users` is the core user/account/role row for V1. | AccountManagement doc must be rewritten before implementation. |
| One person may belong to many accounts. | One user belongs to one account. | Old doc was stale for DB Pivot; active doc is now rewritten. |
| Role lives in account membership. | Role lives on `users`. | Current membership model is a deletion/rewrite target. |
| Berlin persists `active_account_id`. | No `active_account_id`. | Delete. |
| `linkedIdentities` / `linkedProviders` are bootstrap connector traits. | Login Method is not Account Connection. | Rename/rebuild; do not expose login as connector state. |
| Social login can later be reused/upgraded by Berlin. | Login may suggest, but connector scopes must be explicitly authorized. | Connector state moves to a future Account Connection PRD. |

That doc has now been rewritten as the active DB Pivot account-management model.

`documentation/services/berlin.md` has also been updated to mark `login_identities`, `user_profiles`, membership truth, `accountPublicId`, and current bootstrap behavior as runtime residue, not target model.

## Current Berlin Table/Flow Map

| Current object | Current callers | Current product behavior | Target classification | Decision |
| --- | --- | --- | --- | --- |
| `user_profiles` | `identity/reconcile.ts`, `bootstrap/state.ts`, `identity/user-profiles.ts` | Stores user id, email, verification flag, provider/profile names, locale fields, and `active_account_id`. | Rebuild as `users` | Product need survives, current table shape dies. |
| `account_members` | `identity/reconcile.ts`, `bootstrap/state.ts`, `account-management/members.ts`, `account-management/invitations.ts`, governance helpers | Stores user/account/role join and enables many-account users. | Delete as core truth | Replaced by `users.account_id` and `users.role` for V1. |
| `account_invitations` | `account-management/invitations.ts`, login invitation acceptance | Invite Members lifecycle. Current accept path creates membership and active-account preference. | Rebuild | Feature survives; table must target one-account user model and global existing-email rejection. |
| `login_identities` | `identity/reconcile.ts` via RPC, `bootstrap/state.ts` | Maps provider and provider subject to user profile; also carries provider/profile snapshot fields in current schema. | Delete/rebuild into `users` login columns | Current table dies. Current V1 login mapping belongs on `users`; no extra login table is approved. |
| `user_contact_methods` | `identity/contact-methods.ts`, `bootstrap/state.ts` | Stores verified phone/WhatsApp rows; currently zero remote rows. | Delete/defer | Accepted current values belong on `users` if the product keeps them; verification flow needs a separate PRD if revived. |
| `user_contact_verifications` | `identity/contact-methods.ts` | Stores pending verification challenges; local-only delivery; currently zero remote rows. | Delete/defer | Temporary verification state is not core DB truth for the DB Pivot. |
| `resolve_login_identity` RPC | `identity/reconcile.ts` | Creates/resolves user profile and login identity; returns active account id. | Rebuild | Must target `users` plus the approved Login Method shape. |
| `transfer_account_owner` RPC | `account-management/governance.ts` | Assumes account membership model. | Rebuild/delete | Only survives if owner transfer is rewritten against `users.role`. |
| `is_account_member/admin/editor` RPCs | RLS/app helper surface | Assumes membership table. | Delete/rebuild | Old model helper functions cannot survive unchanged. |

## Current Product Problems

1. Berlin has two different user concepts: `user_profiles` for the person and `account_members` for account/role. The approved V1 product needs one user row that says which account and role the user has.
2. `active_account_id` exists only because the current model allows many accounts per person. The approved V1 model does not need it.
3. Invite Members currently checks whether the email is already a member of the same account. The approved product behavior must check whether the email already exists globally and reject with:

```text
This user is already associated with an account.
```

4. Login identity and connector vocabulary are mixed. `linkedIdentities` and `linkedProviders` currently sound like reusable connector state, but they are only login/provider facts.
5. Contact verification is implemented as permanent tables even though current remote rows are empty and cloud delivery is unavailable. That is not a green core-model foundation.
6. Current canonical docs teach the old model. If code follows those docs during DB Pivot execution, it will rebuild the same problem.

## Surviving Product Model

### User

`users` owns:

- `user_id`
- `account_id`
- `role`
- `primary_email`
- accepted/current profile fields approved by `103_DB_Users__PRD__Users_Table.md`
- `created_at`

No user belongs to two accounts in V1.

### Invite Members

Invite Members survives.

Rules:

- invite targets one account, one email, one intended role;
- invite creation checks `users.primary_email` globally;
- existing email rejects instead of attaching the user to a second account;
- accepting a valid invitation creates or activates one user for the inviting account;
- no `account_members` row is created.

### Login Method

A Login Method is needed to map an external login to `users.user_id`.

This audit does not approve a new table and does not preserve `login_identities`.

The product question is smaller than the current table:

```text
When Berlin receives a verified provider login, how does it resolve the Clickeen user?
```

Current `login_identities` is not approved as-is because it stores/returns extra provider/profile snapshot concepts, points at `user_profiles`, and currently feeds connector-looking bootstrap output.

V1 decision:

```text
Store the current login provider and provider subject on `users`.
```

That is the smallest shape for the current one-login-method product. A separate login-method table is not approved in the DB Pivot. If multiple login methods become a real product requirement later, that future PRD can extract the login columns into a dedicated table with evidence.

`users.login_provider` must be a constrained provider enum or equivalent constrained value, with `google` as the current approved value. `users.login_subject` is the provider's stable subject id for sign-in. The pair must be unique.

### Account Connection

Account Connection is out of scope for core Users.

When connectors are built, the product must explicitly authorize scopes again. Example:

```text
Pietro logs into Clickeen with Google.
Later Pietro wants a Google Reviews widget.
Clickeen may suggest the same Google account, but the account connection must be explicitly authorized for Google Business Profile / reviews scopes.
```

The connector data must be account-owned, not user-login-owned.

## Required Documentation Updates Before Implementation

These docs must be updated before code execution:

- `documentation/architecture/AccountManagement.md`
- `documentation/services/berlin.md`
- `documentation/services/roma.md`
- `documentation/services/bob.md`
- `documentation/capabilities/multitenancy.md`

The docs must remove the old canonical many-account membership model from the active path and replace it with the approved V1 rule:

```text
One user belongs to one account.
Role lives on users.
Invite Members cannot attach an existing user/email to a second account.
Login Method is not Account Connection.
```

## Product Decisions Still Needed

These decisions are now locked for 103_DB.1A:

1. Login Method physical shape:
   - current V1 login mapping lives on `users`;
   - no new login-method table;
   - current `login_identities` dies.
2. Member removal semantics under one-account users:
   - removing a non-owner team member deletes that user row and its login mapping;
   - the system must not create account-less users or hidden second-account access.
3. Contact verification:
   - current contact verification routes/tables are deleted/deferred for the DB Pivot;
   - phone/WhatsApp on `users` are accepted/current values only;
   - any future verification flow needs a separate PRD.
4. Owner transfer:
   - owner transfer survives as V1 account operation;
   - it must be rewritten against `users.role`, not membership rows.

## Green Checklist

- [x] Current Berlin user/profile/member/login/contact callers mapped.
- [x] Current documentation conflicts named.
- [x] Current remote Berlin tables classified as rebuild/delete/defer/blocked.
- [x] Login Method vs Account Connection vocabulary separated.
- [x] Invite Members survival rule captured.
- [x] Product + Architecture decide Login Method physical shape.
- [x] Product + Architecture decide member removal semantics.
- [x] Product + Architecture decide contact verification fate.
- [x] Product + Architecture decide owner transfer fate.
- [x] Required documentation updates are made before implementation.

## Current Readout

Berlin should be treated as a rebuild target for the DB Pivot user/account boundary.

The current code is valuable evidence of the flows that exist, but it is not the model to preserve. The approved product model is smaller:

- `users` replaces `user_profiles`, `account_members`, and `login_identities` as core user/account/role/login truth for V1;
- Invite Members survives, but no longer creates memberships;
- Login Method survives as constrained login fields on `users`, not as connector state;
- contact verification scaffolding is deletion/defer until a real product PRD owns it;
- stale canonical docs have been rewritten for the active DB Pivot model so future coding does not rebuild the old model.
