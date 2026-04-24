# 076 PRD - Berlin-Owned Login Identity And Account Boundary Redo

Status: CUT 1 GREEN; CUT 2 GREEN; CUT 3 CODE GREEN / PROVIDER CONFIG VERIFICATION BLOCKED
Owner: Berlin identity/account boundary, Roma login shell
Date: 2026-04-24

## Why This PRD Exists

PRD 076's first source slice made Roma login look cleaner, but it preserved the wrong architecture.

The old plan hid the email/password form and kept the browser-visible OAuth relay:

`Roma -> Berlin -> Supabase Auth -> Google -> Supabase Auth -> Berlin -> Roma`

That is not the correct product boundary. It makes Supabase visible in the brand moment, makes provider callback failure hard to reason about, and lets infrastructure identity remain the product user id.

The correct user-facing flow is:

`Roma -> Berlin -> Provider -> Berlin -> Roma`

The correct product model is:

`login identity -> Clickeen user profile -> account membership -> account`

Google is only the first provider adapter. Apple, Facebook, Microsoft, GitHub, SAML, and future providers must plug into the same Berlin-owned identity resolver without changing account management again.

## The Product Problem

Clickeen is a global self-serve product. Signup/login is not a support tool, a dev shortcut, or an implementation detail. It is the front door of the company.

Today the cloud-dev login path fails the product standard:

1. Google presents a Supabase project identity instead of Clickeen.
2. Selecting a Google account can return the user to Roma login without a useful product explanation.
3. The current architecture treats Supabase Auth identity as the product person boundary.
4. Roma starts a provider flow through Berlin but Berlin delegates the browser-visible OAuth ownership to Supabase.
5. The current DB still ties product person rows to `auth.users(id)`.

This is why we keep getting login wrong: we keep confusing login provider identity, Clickeen user, and Clickeen account.

## Canonical Account Management Truth

This PRD follows `documentation/architecture/AccountManagement.md`.

Hard truths:

1. Berlin is the single identity and account-truth boundary.
2. A login identity is not a Clickeen user.
3. A Clickeen user is not a Clickeen account.
4. Account product state belongs to the account.
5. Membership is the relationship between user and account.
6. First successful signup must leave no half-state:
   - no authenticated user without a user profile
   - no account without an owner
   - no signed-in session without an active account context
7. Roma owns login UX and cookie redemption only.
8. Bob owns none of login/signup.
9. Prague may carry signup intent only.
10. Supabase/Michael is persistence infrastructure, not the browser-visible identity owner.

## Current Codebase Reality

### Good Existing Pieces

- Berlin already owns session issuance and account bootstrap.
- Berlin already reconciles a successful auth grant into:
  - `user_profiles`
  - `accounts`
  - `account_members`
  - active account preference
- Roma already has a finish endpoint that redeems a Berlin finish ticket and sets Clickeen cookies.
- Berlin already has a short-lived OAuth state/finish ticket store through `BERLIN_AUTH_TICKETS`.
- Roma already resolves product account context through Berlin bootstrap after session cookies exist.

These mechanics are not the problem and should be preserved:

- The finish-token pattern is correct: browser callbacks carry a short-lived opaque `finishId`, not access/refresh tokens.
- Finish tokens must remain consume-once with typed outcomes for replay, expiry, and store unavailability.
- Account reconciliation should stay idempotent. Repeated login/callback attempts must not create duplicate accounts or duplicate owner memberships.
- Profile seeding should keep defensive provider metadata normalization, because providers vary field names across time and scopes.
- Account provisioning should remain transactional enough to avoid abandoned half-created account rows if membership creation fails.

### Wrong Existing Pieces

- Roma `GET /api/session/login/google` still asks Berlin for a provider URL that ultimately points at Supabase Auth.
- Berlin `POST /auth/login/provider/start` calls Supabase `/auth/v1/authorize`.
- Berlin callback exchanges a Supabase PKCE code, not a provider code owned by Berlin.
- Google therefore sees Supabase as the OAuth client/domain boundary instead of Clickeen.
- `user_profiles.user_id` references `auth.users(id)`.
- `account_members.user_id` references `auth.users(id)`.
- Berlin linked identity summary currently reads Supabase Auth `identities`.
- There is no Clickeen-owned `login_identities` table.
- Hidden password login still depends on Supabase Auth as a product-adjacent identity source.

The account reconciliation code is valuable. The OAuth ownership and person-key foundation are the problem.

## Target Architecture

### Browser Flow

For Google:

1. User clicks `Continue with Google` in Roma.
2. Roma sends the browser to Berlin provider start.
3. Berlin creates a login transaction with:
   - provider
   - state
   - nonce/PKCE where needed
   - intent
   - next path
4. Berlin redirects the browser directly to Google using a Clickeen-owned Google OAuth client.
5. Google redirects directly back to Berlin callback.
6. Berlin validates state, exchanges/verifies provider response, and normalizes provider identity.
7. Berlin resolves or creates the Clickeen user profile.
8. Berlin resolves or creates account membership/account.
9. Berlin issues a Clickeen session and creates a short-lived finish ticket.
10. Berlin redirects to Roma finish.
11. Roma redeems the finish ticket, sets cookies, and redirects to the requested product path.

Target chain:

`Roma -> Berlin -> Google -> Berlin -> Roma`

There must be no browser-visible Supabase Auth redirect in the provider login chain.

### Provider Adapter Contract

Berlin owns provider adapters.

```ts
type ProviderId = 'google' | 'apple' | 'facebook' | 'microsoft';

type ProviderIdentity = {
  provider: ProviderId;
  providerSubject: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  givenName: string | null;
  familyName: string | null;
  avatarUrl: string | null;
};

interface IdentityProviderAdapter {
  provider: ProviderId;
  buildAuthorizeUrl(transaction: ProviderLoginTransaction): URL;
  exchangeCallback(request: Request, transaction: ProviderLoginTransaction): Promise<ProviderIdentity>;
}
```

Everything after `ProviderIdentity` is provider-independent.

### Clickeen Identity Model

Berlin owns the Clickeen person key.

Required persistence:

```sql
login_identities
- id uuid primary key
- user_id uuid not null references user_profiles(user_id)
- provider text not null
- provider_subject text not null
- email text null
- email_verified boolean not null default false
- display_name text null
- avatar_url text null
- created_at timestamptz not null default now()
- last_used_at timestamptz not null default now()
- unique (provider, provider_subject)
```

`provider_subject`, not email, is the stable provider identity key.

Email is useful profile/contact data. It is not the durable login identity key because providers can hide it, rotate it, or return different emails across flows.

### User And Account Model

The canonical product chain is:

`login_identities.provider/provider_subject -> user_profiles.user_id -> account_members -> accounts`

New signup:

1. Find `login_identities` by `(provider, provider_subject)`.
2. If found, load the existing `user_profiles.user_id`.
3. If not found, create a new Clickeen user profile and linked login identity.
4. If the user has no memberships, create one free account and owner membership.
5. Resolve active account.
6. Issue session.

Existing login:

1. Find `login_identities` by `(provider, provider_subject)`.
2. Update identity `last_used_at` and latest provider email/display metadata.
3. Load the existing user profile.
4. Resolve active account from `user_profiles.active_account_id` if it is still a valid membership.
5. If no valid active account exists, choose a deterministic fallback from memberships and persist it as active.
6. Issue session.

Invited first signup:

1. Provider identity resolves/creates the Clickeen user profile.
2. If the login/finish intent carries a valid invitation token, Berlin accepts the invitation before personal-account provisioning.
3. The invited account becomes the active account for the new session.
4. Berlin must not create a random `Personal` account first for a user whose signup is completing an invitation.
5. If invitation acceptance fails, fail explicitly with an invitation/auth reason and do not silently create a fallback account unless the user starts a normal signup/login flow.

Normal first signup with no invitation:

1. Provider identity resolves/creates the Clickeen user profile.
2. If the user has no memberships and no valid invitation context, create one free account.
3. Create exactly one owner membership.
4. Persist that account as active.
5. Issue session.

Account linking later:

1. Signed-in user starts link flow.
2. Berlin verifies provider identity.
3. If `(provider, provider_subject)` is unused, attach it to the signed-in user.
4. If it belongs to another user, fail with an explicit conflict.
5. Do not create a second user or account during link flow.

## Required Database Correction

The current schema uses `auth.users(id)` as the product person anchor:

- `user_profiles.user_id references auth.users(id)`
- `account_members.user_id references auth.users(id)`

That preserves Supabase Auth as product identity.

This PRD must move the product person anchor to Berlin-owned user profiles.

Target:

- `user_profiles.user_id` remains the Clickeen user id.
- `user_profiles.user_id` no longer references `auth.users(id)`.
- `account_members.user_id` references `user_profiles(user_id)` or enforces the same Berlin-owned user id boundary.
- `login_identities.user_id` references `user_profiles(user_id)`.
- Supabase `auth.users` is no longer a product identity dependency for provider login.

Because Clickeen is pre-GA, prefer a clean migration over preserving fake compatibility.

## Route Shape

### Roma

Roma login page:

- shows provider buttons from config/capability, initially Google
- submits/navigates to same-origin Roma provider start route or directly to Berlin provider start
- does not show Supabase
- does not own provider state, identity resolution, account creation, or session minting

Roma same-origin helper may remain:

- `GET /api/session/login/google`

But it must only redirect the browser to Berlin's provider start. It must not call Berlin server-to-server to fetch a Supabase OAuth URL.

Roma finish remains:

- `GET /api/session/finish?finishId=...`

It redeems Berlin finish, sets cookies, and redirects.

### Berlin

Replace generic Supabase-backed provider routes with Berlin-owned browser routes:

- `GET /auth/login/:provider/start`
- `GET /auth/login/:provider/callback`
- `POST /auth/finish`
- future: `GET /auth/link/:provider/start`
- future: `GET /auth/link/:provider/callback`

Berlin must log enough structured failure detail to identify the failed stage:

- invalid provider
- missing provider config
- invalid state
- provider denied
- provider token exchange failed
- provider identity missing subject
- identity conflict
- user/profile write failed
- account provision failed
- finish ticket missing/expired
- Roma finish/bootstrap failed

Roma may show user-safe messages, but Berlin logs must identify the exact technical step.

Internal error details must be scrubbed before they are returned to Roma or the browser. Berlin may log raw provider/database details in observability, but response payloads must use stable reason keys plus safe diagnostic codes, not raw exception messages.

Finish redemption must remain intentional:

- The canonical browser flow may carry `finishId` in the Roma finish URL because Berlin redirects the browser there.
- Roma must redeem the `finishId` server-side through `POST /auth/finish`.
- Berlin `POST /auth/finish` should treat query-string fallback as temporary compatibility only. The target contract is JSON body redemption from Roma, not generic GET/query redemption.

## Provider Configuration

Google cloud-dev must use a Clickeen-owned OAuth client.

Required operator outcome:

- Google account chooser says Clickeen, not a Supabase project id.
- The redirect/callback URL is Berlin callback.
- The app's test-user/publishing status allows intended cloud-dev users such as `pconsavari@gmail.com`.

For each provider, Berlin owns:

- client id
- client secret
- authorize URL
- token URL
- callback URL
- scopes
- provider identity normalization

Provider secrets live only in Berlin environment.

## What Happens To Supabase

Supabase/Michael remains the database.

Supabase Auth must not be the browser-visible provider OAuth owner for Clickeen login.

Allowed uses after this PRD:

- Postgres persistence
- service-role reads/writes behind Berlin
- possible temporary operational migration support

Forbidden uses on the target customer login path:

- browser redirect to `/auth/v1/authorize`
- Google consent/account chooser branded to Supabase project
- Clickeen user identity defined by Supabase Auth identity rows
- product shells reading provider identity from Supabase Auth directly

## Password And Smoke Login

The current hidden password route is not a product login architecture.

It must not block the provider redo.

Replace CI/runtime smoke dependency with one of:

1. A Berlin-only internal test provider adapter guarded by cloud-dev secrets.
2. A signed internal session-mint route guarded by `CK_INTERNAL_SERVICE_JWT`.
3. A real provider-finish integration test with mocked provider endpoints.

Do not keep customer-adjacent password login just because CI uses it.

## Execution Plan

### Cut 1 - Replace PRD Truth And Instrument Current Failure

- Replace this PRD as the governing auth/account redo.
- Add explicit current-flow logging around Berlin provider start/callback/finish before removing it if needed for diagnosis.
- Make Roma show the exact returned login error reason instead of silently looping.

### Cut 2 - Add Berlin-Owned Identity Persistence

- Add `login_identities`.
- Migrate product user/account FKs away from `auth.users(id)` and toward `user_profiles(user_id)`.
- Update Berlin account reconciliation to resolve by `ProviderIdentity`, not Supabase token payload.
- Preserve the current idempotent account reconciliation behavior while changing the identity source.
- Make active-account resolution respect `user_profiles.active_account_id` when valid.
- Add invited-signup handling before personal-account provisioning.
- Make account slug generation collision-safe or retryable instead of surfacing a generic write failure on rare slug collision.
- Keep migration strict: no duplicate identity, no anonymous user creation, no account without owner.

### Cut 3 - Implement Google Adapter

- Add Berlin Google provider adapter.
- Add direct Berlin start/callback routes.
- Store provider state in `BERLIN_AUTH_TICKETS`.
- Exchange callback directly with Google.
- Normalize `ProviderIdentity`.
- Resolve/create user/account/session.
- Redirect to Roma finish.

### Cut 4 - Update Roma Start Route

- Make Roma's Google start route a pure browser redirect to Berlin.
- Remove server-to-server "fetch OAuth URL" behavior from Roma.
- Keep Roma finish cookie behavior.

### Cut 5 - Remove Supabase-Browser OAuth Path

- Remove or quarantine Berlin's Supabase-backed provider start/callback path.
- Remove Supabase Auth identities as linked-provider source.
- Make `GET /v1/me/identities` read `login_identities`.
- Remove/hide password smoke dependency after replacement.

### Cut 6 - Verification And Provider Extensibility

- Add provider adapter tests with a fake provider.
- Add direct Google cloud-dev manual verification.
- Prove first signup creates exactly one profile, account, and owner membership.
- Prove invited first signup joins the invited account and does not create a personal account first.
- Prove repeat login reuses the same user/account.
- Prove login respects a valid persisted active account preference.
- Prove invalid/expired finish tokens are consume-once/typed and never expose raw internal exception details.
- Prove adding Apple/Facebook later requires only an adapter plus provider env, not account model changes.

## Acceptance Criteria

1. Google login browser chain is `Roma -> Berlin -> Google -> Berlin -> Roma`.
2. No browser-visible Supabase Auth URL appears during login.
3. Google account chooser/consent presents Clickeen branding.
4. Selecting an allowed Google account lands in Roma `/home` with active account context.
5. Selecting/using a disallowed or failing provider account returns a visible, specific login error.
6. First signup creates:
   - one `user_profiles` row
   - one `login_identities` row
   - one `accounts` row
   - one `account_members` owner row
7. Invited first signup accepts the invitation and lands in the invited account without creating an unrelated personal account first.
8. Repeat login with the same provider subject reuses the existing user and account.
9. Login respects a valid persisted active account preference.
10. `GET /v1/me/identities` reads Berlin-owned login identities, not Supabase Auth identities.
11. Hidden password login is no longer required for cloud-dev customer login or runtime smoke.
12. Adding a second provider does not touch Roma account management or account provisioning.
13. Auth responses expose stable safe reason keys; raw provider/database exception text stays in logs only.

## Explicit Non-Goals

- Do not build Apple/Facebook/Microsoft in this PRD beyond keeping the adapter contract ready.
- Do not move account provisioning into Roma.
- Do not let Bob observe provider identity.
- Do not expose linked identities as a normal User Settings product surface yet.
- Do not build customer account switching.
- Do not build a speculative connector framework.
- Do not preserve Supabase Auth identity as product truth for convenience.

## Why The Previous Attempt Failed

The previous slice improved the login page but preserved the wrong chain.

It treated "Berlin starts provider auth" as enough, while Berlin was still delegating browser-visible OAuth ownership to Supabase Auth.

That left three product bugs intact:

1. Google saw Supabase, not Clickeen.
2. Login failure after provider selection was opaque.
3. Product user identity still depended on Supabase Auth rows.

The fix is not another button tweak. The fix is to make Berlin the real OAuth and identity boundary, then keep Roma as a thin login shell and cookie redeemer.

## Verification Checklist

Source checks:

- `corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit`
- `corepack pnpm exec tsc -p roma/tsconfig.json --noEmit`
- targeted Berlin route/provider tests
- migration verification against cloud-dev clone/local Supabase

Cloud-dev checks:

- Google account chooser says Clickeen.
- `pconsavari@gmail.com` succeeds if configured as an allowed/test user.
- Failed provider attempts show a specific Roma error.
- `/api/session/finish` sets cookies.
- `/api/bootstrap` returns active account and authz capsule.
- `/home` loads.
- `/v1/me/identities` returns Berlin-owned provider identity summary.

## 2026-04-24 Cut 1 Execution Notes

Implemented:

- PRD 076 rewritten as Berlin-owned login identity/account boundary redo.
- Berlin current Supabase-backed provider start/callback/finish path now emits structured auth-stage logs for start, callback, finish, rejection, and failure outcomes.
- Berlin current auth callback/session issuance no longer returns raw unexpected exception text to Roma/browser on the reconcile catch path.
- Roma login now renders the stable returned auth error reason code alongside the user-facing message so cloud-dev login failures are visible and diagnosable.

Verification:

- `corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit` -> PASS
- `corepack pnpm exec tsc -p roma/tsconfig.json --noEmit` -> PASS
- `git diff --check` -> PASS
- `NEXT_PUBLIC_TOKYO_URL=https://tokyo.dev.clickeen.com BERLIN_BASE_URL=https://berlin.dev.clickeen.com SANFRANCISCO_BASE_URL=https://sanfrancisco.dev.clickeen.com NEXT_PUBLIC_BOB_URL=https://bob.dev.clickeen.com corepack pnpm -C roma build` -> PASS

## 2026-04-24 Cut 2 Execution Notes

Implemented:

- Added `public.login_identities` migration for Berlin-owned provider identity persistence.
- Migration drops the active product-person foreign keys from `auth.users(id)` and re-anchors account membership, invitations, and contact methods to `user_profiles(user_id)`.
- Berlin reconciliation now resolves through normalized provider identity, then `login_identities`, then `user_profiles`, then account membership.
- Berlin sessions now use the reconciled Clickeen user id as the session subject and store the Supabase subject separately for the temporary Supabase grant bridge.
- Existing login now respects `user_profiles.active_account_id` when it is a valid membership and persists a deterministic fallback when it is missing or stale.
- Invitation login paths derived from `/accept-invite/:token` now accept the invitation before personal account provisioning.
- Account slug creation now retries slug collisions and only treats a 409 as already-created when the account id actually exists.

Verification:

- `corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit` -> PASS
- `corepack pnpm exec tsc -p roma/tsconfig.json --noEmit` -> PASS
- `git diff --check` -> PASS
- `corepack pnpm dlx supabase@latest --version` -> PASS (`2.95.1`)
- `corepack pnpm dlx supabase@latest db push --dry-run --linked` -> PASS
- `corepack pnpm dlx supabase@latest migration list --linked` -> PASS
- `corepack pnpm dlx supabase@latest db lint --linked --fail-on error` -> PASS
- `corepack pnpm dlx supabase@latest db push --linked --yes` -> PASS
- `corepack pnpm dlx supabase@latest db push --dry-run --linked` after apply -> PASS (`Remote database is up to date.`)
- Linked read-only verification -> PASS (`public.login_identities` exists with 3 rows; product-person FKs now reference `user_profiles`)

Applied migrations:

- The linked cloud database was current through `20260313022000`.
- The apply brought remote current through `20260424120000`.
- Applied: `20260313110000__prd67_internal_control_phase1_foundation.sql`, `20260313131500__prd67_account_publish_containment.sql`, and `20260424120000__prd76_berlin_owned_login_identities.sql`.

## 2026-04-24 Cut 3 Execution Notes

Implemented:

- Added a Berlin-owned Google OAuth adapter using direct Google authorize/token/userinfo endpoints.
- Added direct browser routes:
  - `GET /auth/login/google/start`
  - `GET /auth/login/google/callback`
- Existing `POST /auth/login/provider/start` now returns a direct Google authorization URL rather than a Supabase Auth URL.
- Berlin provider callback now exchanges the Google code directly, normalizes `ProviderIdentity`, resolves the Clickeen user/account boundary, creates a finish ticket, and redirects to Roma finish.
- Berlin session state now supports provider-owned sessions without requiring Supabase Auth refresh tokens.
- `GET /v1/me/identities` / bootstrap identity summary now reads `login_identities`, not Supabase Auth identities.
- Berlin Cloudflare config now declares the direct Google callback URL:
  - `https://berlin.dev.clickeen.com/auth/login/google/callback`

Verification:

- `corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit` -> PASS
- `git diff --check` -> PASS

Blocker:

- Direct Google cloud verification cannot run yet because provider secret/config verification is blocked on this machine.
- No local env file contains `BERLIN_GOOGLE_CLIENT_ID` or `BERLIN_GOOGLE_CLIENT_SECRET`.
- `wrangler secret list` for `berlin-dev` fails with Cloudflare API authentication error `code: 10000`, so this machine cannot verify whether those secrets already exist in Cloudflare.
- Per this PRD's execution gate, Cut 4 must not start until Berlin's Google OAuth client id/secret are confirmed in Cloudflare and the Google OAuth client is confirmed to allow `https://berlin.dev.clickeen.com/auth/login/google/callback`.
