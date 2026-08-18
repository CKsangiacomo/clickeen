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
| Policy resolver | `packages/ck-policy/src/policy.ts` |
| Policy registry/matrix | `packages/ck-policy/src/registry.ts`, `packages/ck-policy/entitlements.matrix.json` |
| Widget entitlement binding and contextual copy | `tokyo/product/widgets/{widgetType}/limits.json` and `upsell/{locale}.json` |
| Current duplicate Tokyo asset entitlement gate (architecture mismatch) | `tokyo-worker/src/domains/assets-handlers.ts` |
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
| Account asset and instance files | Tokyo-worker over Tokyo R2 |
| Account tier, entitlement values, current/target plan truth | System policy; Roma consumes Berlin authority through `@clickeen/ck-policy` |
| Widget-specific denial message | Git-authored Widget `upsell/{locale}.json` |
| Upsell composition, hosting, and system CTA | Roma |
| Upsell Popup mechanics | Dieter |
| Public widget serving | Tokyo-worker serving Roma-materialized packages |

Account-scoped product work follows:

```text
Roma current account
-> accountPublicId
-> Roma account route
-> owning service
-> accounts/{accountPublicId}/...
```

A Widget is software that uses this account service through the same
`accountPublicId` and current-account command lifecycle as every other Widget.
Its Core never implements membership, role, tier, or storage-coordinate logic,
and Roma never gains a Widget-specific account path. If an account capability
must grow, Roma augments the shared account contract once for every applicable
Widget.

## Closed-System Trust

Multitenancy preserves security boundaries without turning every internal
handoff into another schema or authority check.

- Berlin accepts external authentication input and mints the exact current
  user/account/role authority.
- Roma trusts that Berlin authority and owns current-account product routing
  and product-policy decisions.
- An owning account route accepts raw browser input once, performs the command,
  and emits one exact Clickeen result.
- Tokyo-worker trusts the account coordinate and exact artifact submitted by
  the owning Clickeen route; it does not reconstruct account policy or Widget
  meaning.
- Michael/Supabase persists exact relational operations from its owning
  service; downstream product services do not rediscover membership truth.

Authentication, authorization, invitation-token acceptance, upload-byte
acceptance, and other raw external inputs remain legitimate boundaries. Once
their owner has produced Clickeen truth, downstream services do not add guards,
validators, allowlists, filters, normalization, repair, schema projection, or
fallback. A missing authority/result cannot become another account, unlimited
policy, or partial success.

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

Berlin owns identity and its relational account-management commands; Roma owns
current-account product commands. Each enforces the authorization boundary it
owns and trusts authority already minted by the other service. A downstream
storage or Widget service does not repeat the role decision. Do not infer role
permission from UI visibility alone.

## Current Account And Team Routes

| Product operation | Roma route | Berlin backing route | Current behavior |
| --- | --- | --- | --- |
| Bootstrap current account | `/api/bootstrap` | `GET /session/bootstrap` | resolves session/current account and writes account authz cookie |
| Current user/account view | `/api/me` | `/me` | read/update current user profile, including dormant exact `usePrimaryLanguageForUi` data |
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
4. Roma trusts and uses that exact account context for subsequent account
   routes; it does not rediscover or reinterpret the account relationship.

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
session/bootstrap/account authz. Roma trusts that authority. Roma product
routes use the shared policy resolver to make the product decision they own
from the exact entitlement snapshot. The resolver is:

```text
resolvePolicyFromEntitlementsSnapshot(...)
```

Operational examples:

- account locale settings enforce `l10n.locales.max`;
- Bob-local Widget edits use the exact system policy plus the compiled Widget
  entitlement binding at Bob's one generic editing boundary; a denied edit is
  not applied to browser-memory state and its exact capability/message identity
  is carried to Roma;
- Roma trusts a Bob draft already produced through that boundary when Save is
  requested; Save does not repeat the same Widget entitlement decision;
- Publish enforces `instances.published.max` at command time: Roma performs the
  fast precheck and Tokyo-worker uses Roma's exact limit inside one
  account-scoped, lifecycle-fenced Durable Object coordinator for the final
  first-wins transition;
- Create and Duplicate have no editable-instance quota; every tier may retain
  multiple editable instances;
- asset upload currently checks `uploads.size.max` and `storage.bytes.max` in
  both Roma and Tokyo-worker; that duplicated internal entitlement enforcement
  is an architecture gap, not the target trust contract;
- Copilot grant issuance enforces `copilot.turns.monthly.max` at its owning
  product-policy boundary; no downstream service repeats that decision.

The target rule is one decision per owned concern. Roma owns account product
policy, including upload and storage entitlements. Tokyo-worker owns the
byte-safety ingress for files entering account storage. Those are different
decisions. After they produce an authorized Clickeen asset write, internal
storage consumes it without another entitlement interpretation or
response-shape validation.

Local implementation: Bob applies every current Widget's `limits.json` at its
common operation boundary before manual, Product Copilot, or undo mutation. A
denial leaves the draft unchanged and sends
`{ capability, messageId, required }`. Roma uses the exact Boolean/numeric
demand to select the first higher system tier that permits the edit, resolves
that Widget's `upsell/en.json`, and opens one Popup. Save does not repeat the
decision.

If no higher configured tier permits that exact demand, Roma does not invent
one. It presents system-owned maximum-capacity copy with Close only and omits
the Upgrade action.

### Widget Entitlement Binding And Composed Upsell

Commercial limits are generic tier capabilities. `items.group.small.max`, for
example, is one system limit with system-owned values for every tier; it is not
a FAQ, Cards, or Logo Showcase limit. A Widget's `limits.json` only declares:

- the generic system entitlement key;
- the unique Widget coordinate/action and metric that consume it;
- the exact Widget upsell message identity for that denied action.

It does not declare whether policy is enforced on edit, load, Save, publish,
or serve. Those are system command/editing boundaries, not Widget policy.

The referenced `upsell/{locale}.json` entry is a complete translatable message,
not a fragment. It may interpolate exact system placeholders such as
`{currentPlan}` and `{targetPlan}`. The Widget does not author plan names,
target-plan selection, eligibility, pricing, CTA copy/action/destination,
Popup behavior, or billing. Widget Core and the public package have no
entitlement or upsell role.

The assembled surface is intentionally multi-source with atomic ownership:

```text
system current plan + eligible target plan
+ Widget complete localized contextual message
+ system CTA
-> Roma assembly and one shared upsell Popup
-> Dieter presentation/lifecycle
```

The Upgrade CTA is system scaffolding until the commercial destination exists.
It must not invent a Billing route, provider operation, plan mutation, contact
destination, or success result. Future Billing work replaces that one
system-owned action without changing Widget message catalogs.

Bob carries the exact denied editing context; it does not hardcode FAQ/Cards/
Logo Showcase copy or render a second commercial surface. Roma-native commands
use system-owned contextual copy when no unique Widget meaning is involved.
There is no generic fallback for missing required Widget copy: that is a
Widget source/build defect, not a runtime invitation to substitute another
message.

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
| `branding.remove` | flag | Bob generic edit boundary for canonical Widget bindings | locally implemented for all five current Widgets |
| `embed.seoGeo.enabled` | flag | Bob generic **Enable SEO/GEO** edit boundary; Publish materializer consumes the exact saved result | locally implemented for all five current Widgets |
| `widget.socialShare.enabled` | flag | Bob generic edit boundary for canonical Widget bindings | locally implemented for all five current Widgets |
| `copilot.turns.monthly.max` | limit | Roma copilot grant issuance | enforced |
| `storage.bytes.max` | limit | Roma upload route and Tokyo-worker assets | enforced with current duplicate internal check; architecture gap |
| `views.monthly.max` | limit | clk.live public-serving telemetry | gap |
| `instances.published.max` | limit | Roma publish policy; Tokyo-worker final account transition | locally enforced first-wins for overlapping Publish; Republish consumes no slot |
| `uploads.size.max` | limit | Roma upload route and Tokyo-worker assets | enforced with current duplicate internal check; architecture gap |
| `items.group.small.max` | limit | Bob generic edit boundary for applicable canonical Widget bindings | locally implemented for Cards, FAQ, and Logo Showcase |
| `items.group.medium.max` | limit | Bob generic edit boundary for applicable canonical Widget bindings | locally implemented for FAQ and Logo Showcase |
| `items.group.large.max` | limit | Bob generic edit boundary for applicable canonical Widget bindings | locally implemented for FAQ and Logo Showcase |

Current public-capacity values:

| Tier | `instances.published.max` |
| --- | ---: |
| `free` | 1 |
| `tier1` | 1 |
| `tier2` | 5 |
| `tier3` | 25 |
| `tier4` | 100 |

The Widgets catalog is not tier-filtered. Every tier may use every Widget type,
create editable instances, Duplicate them, edit them, and Save them. Public
capacity is separate: Publish enforces `instances.published.max` at command
time, with Free able to publish and serve one instance.
Roma first performs a fast list-facts precheck before materialization. A request
that passes sends Roma's exact limit and exact materialized package to
Tokyo-worker. Tokyo routes that final command to the account's one Durable
Object coordinator, which reads the exact per-instance publication states,
permits Republish without another slot, and otherwise compares the current published
count with that passed limit before writing package or published state. The
first allowed Publish wins. An overlapping contender while that command is
active gets HTTP 409 `PUBLISH_IN_PROGRESS` and persists nothing; after the winner
commits, a later attempt gets the existing HTTP 402 `UPGRADE_REQUIRED`
capacity result. Before R2 work, the coordinator touches its own storage only
to activate Cloudflare's shutdown/replacement fencing. It stores no durable
policy, count, or publication data and is not a publication registry: each
instance's `serve-state.json` remains publication truth.
`widgets.instances.max` has been removed rather than renamed or repurposed. The policy authority emits
one exact decision; downstream services do not re-evaluate that decision.

`embed.seoGeo.enabled` is also separate from Widget access.
Free and Tier 1 receive the Clickeen Discovery baseline. Tier 2 and above may
turn on the shared **Enable SEO/GEO** control; the exact saved value is consumed
only by Publish materialization. Widget Core and public serving do not decide
the tier.

Tier values are read from the matrix. Do not restate commercial package prose
here unless it maps to exact entitlement keys.

## Failure Semantics

| Case | Result |
| --- | --- |
| No current account/session | Roma route fails auth; no account fallback |
| Role below route requirement | explicit deny from Roma/Berlin |
| Unknown member/invitation | `404` from owning account route |
| Duplicate invitation email/user conflict | explicit conflict; no silent attach |
| Account deletion | explicit conflict; no account-root delete |
| Entitlement limit exceeded | explicit product-policy failure |
| Migrated Widget editing action exceeds a tier capability | no draft mutation, exact `{ capability, messageId, required }` denial, and one Roma-composed upsell Popup |
| Existing content exceeds a newly lower tier | preserve exact content; do not delete, clamp, or heal it; gate only the next disallowed action at its owning boundary |
| Required Widget upsell message is absent | producing Widget contract/build failure; no generic runtime replacement |
| Policy key exists but no runtime consumer | documented as `gap`, not claimed enforced |
| Owner-produced account/package result handed to another Clickeen service | consumed exactly; no downstream semantic revalidation or filtering |

## Known Current Gaps

These are not active runtime truth:

- comments API/UI;
- seat-limit/editor-count entitlement key;
- `SEAT_LIMIT_EXCEEDED` runtime error;
- customer account switching;
- core `account_members` role authority;
- public monthly view denial/upsell behavior for `views.monthly.max`;
- a product account-downgrade operation that resolves published overage and
  already-published tier-dependent output.

## Verification

| Concern | Verification |
| --- | --- |
| Current account/session | Roma `/api/bootstrap` sets the account authz cookie, returns current account context, and does not expose `authz.accountCapsule` in JSON; `/api/me` returns current user/profile |
| Berlin account/team behavior | Berlin backing routes through Roma account routes |
| Relational account schema | Supabase migrations and `documentation/services/michael.md` |
| Role/account invariant | `users.account_id` and `users.role` current truth |
| Entitlement keys/values | `packages/ck-policy/entitlements.matrix.json` |
| Entitlement metadata/enforcement status | runtime owner evidence plus `packages/ck-policy/src/registry.ts`; all five current Widgets are the local proof |
| Account files | Roma routes first; raw bytes require `pnpm cf:preflight` and R2 evidence |

Verification proves the owning boundary and stored result outside the normal
product path. It must not add a runtime probe, duplicate validator, or second
policy decision between trusted Clickeen services.

## Not Current Product Truth

- Figma/PLG strategy as runtime law.
- Viewer comments as shipped role capability.
- Seat packaging as enforced entitlement.
- One user directly belonging to multiple customer accounts.
- `active_account_id`.
- `account_members` as core role authority.
