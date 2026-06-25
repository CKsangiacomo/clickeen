# Multitenancy Capability

STATUS: CURRENT SYSTEM OPERATOR SPEC

Multitenancy is deterministic account law in Clickeen. Strategy, PLG
positioning, seat packaging ideas, and unshipped comments do not define current
runtime truth.

Canonical account-management architecture:

- `documentation/architecture/AccountManagement.md`
- `documentation/services/berlin.md`
- `documentation/services/roma.md`
- `documentation/services/michael.md`

## Code Authority

| Concern | File |
| --- | --- |
| Berlin account/session bootstrap | `berlin/src/bootstrap/routes.ts` |
| Berlin account-management routes | `berlin/src/account-management/routes.ts` |
| Berlin invitations | `berlin/src/account-management/invitations.ts` |
| Roma bootstrap proxy | `roma/app/api/bootstrap/route.ts` |
| Roma current user/account route | `roma/app/api/me/route.ts` |
| Roma team routes | `roma/app/api/account/team/**` |
| Roma owner transfer route | `roma/app/api/account/owner-transfer/route.ts` |
| Roma tier-drop dismiss route | `roma/app/api/account/lifecycle/tier-drop/dismiss/route.ts` |
| Roma account asset upload | `roma/app/api/account/assets/upload/route.ts` |
| Roma instance create/save/publish routes | `roma/app/api/account/instances/**` |
| Roma page publish disabled route | `roma/app/api/account/pages/[pageId]/publish/route.ts` |
| Roma instance save policy | `roma/lib/account-instance-save-policy.ts` |
| Policy resolver | `packages/ck-policy/src/policy.ts` |
| Policy registry/matrix | `packages/ck-policy/src/registry.ts`, `packages/ck-policy/entitlements.matrix.json` |
| Tokyo asset limit enforcement | `tokyo-worker/src/domains/assets-handlers.ts` |
| Current DB foundation | `supabase/migrations/20260522090000__prd103_db_core_foundation.sql` |

## Product Law

```text
One user belongs to one account.
One account has many users.
The user's role is the user's role in that account.
```

Current account truth:

- no customer account switching;
- no core many-to-many membership table;
- role lives on `users.role`;
- `accounts.id` is the compact account product/storage coordinate;
- `accountPublicId` is the API/embed/authz field name for that same value;
- Clickeen admin uses the normal `CLICKEEN` account.

Current relational truth lives in:

```text
public.accounts
public.users
public.account_invitations
```

The current role/account invariant is:

```text
users.account_id -> accounts.id
users.role -> role inside that account
```

## Authorities

| Concern | Authority |
| --- | --- |
| Login/session/account bootstrap | Berlin |
| Current account shell and product routes | Roma |
| Relational account/user/team data | Michael/Supabase |
| Account assets/instances/pages files | Tokyo-worker over Tokyo R2 |
| Account product policy | Roma using `@clickeen/ck-policy` |
| Public widget serving | Tokyo-worker generated package serving |

Account-scoped product work follows:

```text
Roma current account
-> accountPublicId
-> Roma account route
-> owning service
-> accounts/{accountPublicId}/...
```

## Roles

| Role | Current meaning |
| --- | --- |
| `viewer` | Can view account surfaces allowed to viewers. |
| `editor` | Viewer + edit/create product content where policy allows. |
| `admin` | Editor + normal account/team/settings operations where policy allows. |
| `owner` | Admin + final accountable holder of the account. |

Effective capability is:

```text
user role + account tier/status/policy
```

Role checks happen at the Roma account route and/or the Berlin backing route.
Do not infer role permission from UI visibility alone.

## Current Account And Team Routes

| Product operation | Roma route | Berlin backing route | Current behavior |
| --- | --- | --- | --- |
| Bootstrap current account | `/api/bootstrap` | `GET /session/bootstrap` | resolves session/current account and writes account authz cookie |
| Current user/account view | `/api/me` | `/me` | read/update current user profile |
| Team overview | `/api/account/team` | `GET /accounts/:id/members` | viewer+ lists account users |
| Member read | `/api/account/team/members/:memberId` | `GET /accounts/:id/members/:memberId` | viewer+ reads member |
| Member update | `/api/account/team/members/:memberId` | `PATCH /accounts/:id/members/:memberId` | admin+; cannot mutate owner illegally |
| Member delete | `/api/account/team/members/:memberId` | `DELETE /accounts/:id/members/:memberId` | admin+; owner deletion is blocked |
| Invitations list/create | `/api/account/team/invitations` | `GET/POST /accounts/:id/invitations` | admin/owner list and create account invitations |
| Invitation delete | `/api/account/team/invitations/:invitationId` | `DELETE /accounts/:id/invitations/:invitationId` | admin/owner delete invitation |
| Login-time invitation acceptance | Berlin OAuth login flow from `/accept-invite/{invitationId}` | login identity resolver | accepts invitation during login and creates the user in invited account |
| Signed-in invitation acceptance | `/api/invitations/:token/accept` | `POST /invitations/:token/accept` | Roma proxy exists; Berlin currently rejects with `invitation_accept_requires_login_flow` |
| Owner transfer | `/api/account/owner-transfer` | `POST /accounts/:id/owner-transfer` | owner-only transfer |
| Tier-drop dismissal | `/api/account/lifecycle/tier-drop/dismiss` | `POST /accounts/:id/lifecycle/tier-drop/dismiss` | Berlin allows admin/owner |
| Account deletion | `DELETE /api/account` | `DELETE /accounts/:id` | owner-only request; currently returns conflict and does not delete account root |

Invite creation rejects an email already associated with a user. Runtime
invitation acceptance is login-time work: Berlin carries the invitation through
OAuth state and creates the user in the invited account while marking the
invitation accepted. The signed-in `POST /invitations/:token/accept` path is
disabled and returns `invitation_accept_requires_login_flow`.

## Operator Recipes

### Resolve Current Account

1. Browser calls Roma:

```text
GET /api/bootstrap
```

2. Roma proxies to Berlin `GET /session/bootstrap`.
3. Berlin returns the current user, account, role, account public id, account
   authz capsule, and entitlement snapshot.
4. Roma uses that account context for subsequent account routes.

### List Or Change Team Access

Use Roma account routes only:

```text
GET /api/account/team
GET /api/account/team/members/{memberId}
PATCH /api/account/team/members/{memberId}
DELETE /api/account/team/members/{memberId}
GET /api/account/team/invitations
POST /api/account/team/invitations
DELETE /api/account/team/invitations/{invitationId}
```

Roma forwards to Berlin. Berlin persists account/user/invitation relational
state through Supabase service-role access.

### Enforce Account Product Policy

Berlin mints the current account role, profile, and entitlement snapshot into
session/bootstrap/account authz. Roma product routes resolve policy from the
current authz payload and entitlement snapshot. The resolver is:

```text
resolvePolicyFromEntitlementsSnapshot(...)
```

Operational examples:

- account locale settings enforce `l10n.locales.max`;
- instance save/duplicate applies widget `limits.json` through Roma save
  policy;
- instance publish enforces `instances.published.max`;
- widget create enforces `widgets.types.max`;
- asset upload checks `uploads.size.max` and `storage.bytes.max` in Roma and
  Tokyo-worker;
- Copilot grant issuance enforces `copilot.turns.monthly.max`.

### Verify Account-Owned Files

Account-owned runtime files use:

```text
accounts/{accountPublicId}/...
```

Verify product behavior through Roma account routes first. Use R2 evidence after
`pnpm cf:preflight` only when raw storage bytes or metadata are the concern.

## Entitlements

The current entitlement source is:

```text
packages/ck-policy/entitlements.matrix.json
packages/ck-policy/src/registry.ts
```

Current entitlement keys:

| Key | Kind | Enforcement owner | Status |
| --- | --- | --- | --- |
| `l10n.locales.max` | limit | Roma account locale settings | enforced |
| `branding.remove` | flag | Roma save policy | enforced |
| `embed.seoGeo.enabled` | flag | no proven active runtime owner outside policy metadata | gap |
| `widget.socialShare.enabled` | flag | Roma save policy | enforced |
| `copilot.turns.monthly.max` | limit | Roma copilot grant issuance | enforced |
| `storage.bytes.max` | limit | Roma upload route and Tokyo-worker assets | enforced |
| `views.monthly.max` | limit | clk.live public-serving telemetry | gap |
| `instances.published.max` | limit | Roma publish route | enforced |
| `widgets.types.max` | limit | Roma system widget/create routes | enforced |
| `uploads.size.max` | limit | Roma upload route and Tokyo-worker assets | enforced |
| `items.group.small.max` | limit | Roma save policy | enforced |
| `items.group.medium.max` | limit | Roma save policy | enforced |
| `items.group.large.max` | limit | Roma save policy | enforced |

Tier values are read from the matrix. Do not restate commercial package prose
here unless it maps to exact entitlement keys.

Operator warning: `packages/ck-policy/src/registry.ts` currently marks
`embed.seoGeo.enabled` as `enforced`, but runtime evidence does not prove an
active consumer in Roma save, Roma publish, or Tokyo-worker public serving.
Treat this row as conflicting policy metadata until code and registry agree.

## Failure Semantics

| Case | Result |
| --- | --- |
| No current account/session | Roma route fails auth; no account fallback |
| Role below route requirement | explicit deny from Roma/Berlin |
| Unknown member/invitation | `404` from owning account route |
| Duplicate invitation email/user conflict | explicit conflict; no silent attach |
| Account deletion | explicit conflict; no account-root delete |
| Entitlement limit exceeded | explicit product-policy failure |
| Policy key exists but no runtime consumer | documented as `gap`, not claimed enforced |

## Known Current Gaps

These are not active runtime truth:

- comments API/UI;
- seat-limit/editor-count entitlement key;
- `SEAT_LIMIT_EXCEEDED` runtime error;
- customer account switching;
- core `account_members` role authority;
- public monthly view denial/upsell behavior for `views.monthly.max`;
- page publish is disabled; Roma returns `422 coreui.errors.page.publishUnavailable`, and public page copy/open is not active.

## Verification

| Concern | Verification |
| --- | --- |
| Current account/session | Roma `/api/bootstrap` sets the account authz cookie, returns current account context, and does not expose `authz.accountCapsule` in JSON; `/api/me` returns current user/profile |
| Berlin account/team behavior | Berlin backing routes through Roma account routes |
| Relational account schema | Supabase migrations and `documentation/services/michael.md` |
| Role/account invariant | `users.account_id` and `users.role` current truth |
| Entitlement keys/values | `packages/ck-policy/entitlements.matrix.json` |
| Entitlement metadata/enforcement status | runtime owner evidence plus `packages/ck-policy/src/registry.ts`; `embed.seoGeo.enabled` currently conflicts |
| Account files | Roma routes first; raw bytes require `pnpm cf:preflight` and R2 evidence |
| Page publish disabled | `POST /api/account/pages/{pageId}/publish` returns `422 coreui.errors.page.publishUnavailable` |

## Not Current Product Truth

- Figma/PLG strategy as runtime law.
- Viewer comments as shipped role capability.
- Seat packaging as enforced entitlement.
- One user directly belonging to multiple customer accounts.
- `active_account_id`.
- `account_members` as core role authority.
