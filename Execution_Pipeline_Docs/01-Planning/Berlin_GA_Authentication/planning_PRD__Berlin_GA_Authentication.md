# Planning PRD — Berlin GA Authentication

Status: **DRAFT — REQUIRES HUMAN ACCEPTANCE**

## What this is

The authentication system Clickeen supports at general availability: which
login methods, how identity resolves across them, how sensitive account
operations are secured, and what Berlin must build.

This is a planning PRD. It defines the GA auth surface and contracts. Execution
PRDs under `02-Executing/` will implement each provider and operation.

## What this is not

- Not the messaging infrastructure policy. Email and SMS transport (which
  providers send verification/reset/OTP messages) is owned by a separate
  messaging planning track. This PRD states the dependency; that track resolves
  vendor selection.
- Not the billing/tier system. Account tier assignment beyond the current
  `free` default is owned by a separate billing/tier planning track.
- Not magic link. Magic link is deferred to post-GA as an additive convenience
  for destination-app users.

## Goal

Ship a GA authentication system where a visitor can create and access a
Clickeen account through any of four methods, all owned by Berlin, all
converging on one identity resolution and session model, with phone-verified
step-up security for sensitive account operations.

## Current state

Berlin has a complete, production-grade auth system for one provider:

- **Google OAuth with PKCE** — authorize URL, token exchange, userinfo fetch
  (`auth/providers/google.ts`). Full redirect flow with single-use state
  tickets, TTL-bounded, DurableObject-stored.
- **Identity resolution** — `resolve_login_identity` Supabase RPC is
  idempotent. Found user → backfill profile, return existing. Not found →
  create user + account atomically (8-char compact base36 ID, `tier='free'`,
  `status='active'`, user `role='owner'`), return `created_user=true`. Signin
  and signup are the same call.
- **Session management** — `issueSession` issues KV-stored sessions with JWT
  access tokens (15 min TTL, RSA-signed) and refresh tokens (30 day TTL,
  rotating).
- **Bootstrap** — `loadPrincipalAccountState` loads profile + account
  memberships + validates locale/tier/role. Returns authz capsule with
  entitlements from tier.
- **Invitation acceptance** — `accept_login_invitation_identity` RPC for
  joining existing accounts via invite.
- **Dev admin login** — `/auth/login/dev-admin` for local/cloud-dev.
- **Provider enum** — Postgres `login_provider` is `{'google'}` only (PRD124a
  narrowed it by removing the e2e email provider).
- **Provider dispatch** — `buildProviderAuthorizeUrl` and
  `exchangeProviderCallback` in `auth/routes.ts` switch on provider name.
- **Enabled-providers gate** — `BERLIN_ALLOWED_PROVIDERS` env var controls
  which providers are active.
- **Phone/WhatsApp columns** — `users` table already has `phone` and
  `whatsapp` columns, read by `loadUserRow`. No verification state or OTP
  flow exists yet.

## GA auth methods

| Method | Status | Type |
| --- | --- | --- |
| **Google** | Done | OAuth2 + PKCE |
| **Apple** | Add | OAuth2 + PKCE (Sign in with Apple) |
| **Microsoft** | Add | OAuth2 + PKCE (consumer Microsoft accounts) |
| **Email/password** | Add | Berlin-owned credential |

### Excluded from GA

| Method | Reason |
| --- | --- |
| **Facebook** | Account instability (unpredictable disables), wrong audience (consumer-social, not B2B widget buyers), platform turbulence since Cambridge Analytica. |
| **Magic link** | Deferred to post-GA. Destination-app pattern; puts email deliverability on the login critical path. Additive convenience, not foundational. |
| **GitHub** | Wrong audience for current buyers (website owners, not developers). Trivial to add later if the product targets developers. Architecture already supports it. |
| **X/Twitter** | Paywalled API, unstable, wrong audience. |
| **LinkedIn** | B2B identity but clunky consent flow; widget buyers don't authenticate through LinkedIn. |

### Why these four

**Google + Apple + Microsoft** cover ~95%+ of consumer OAuth identities (Gmail,
iCloud, Outlook). These are the three identity providers the destination-app
visitor (clk.live) overwhelmingly has.

**Email/password** is distribution-channel-native auth. Clickeen's distribution
is not only the destination app — it is also embedded inside platforms where
users already authenticate:

- **WordPress** (~43% of all websites) has no OAuth. It is 100%
  username/password. A WordPress plugin that requires "Sign in with Google"
  inside wp-admin is broken UX (popup blockers, third-party cookie rejection,
  frame-origin issues). Email/password matches the environment.
- **Squarespace** (Elfsight's primary distribution channel per competitive
  research) uses email/password for site owners.

The auth model must match the distribution channel. Password is not
"traditional" — it is what WordPress and Squarespace users expect.

## Architectural principle

**Berlin owns all authentication. No Supabase Auth.**

Berlin currently owns OAuth end-to-end: redirect flow, PKCE, token exchange,
identity resolution via raw SQL RPC, session issuance, bootstrap. Supabase is
the relational store (Michael), not the auth provider.

Email/password continues this pattern. Berlin stores the password hash via RPC,
generates and verifies tokens, calls the email/SMS provider APIs for
verification/reset/OTP messages, and issues the same session through
`issueSession`.

Messaging providers (email, SMS) are **transport**, not auth systems. Berlin
calls them to send messages. They do not own credentials, verification state,
or sessions.

This keeps one auth authority (Berlin), one session model, one user table, one
identity resolution path.

## OAuth providers are self-contained

Google, Apple, and Microsoft are **self-contained for email verification and
account recovery**. The provider verifies email ownership itself. When Berlin
gets back a `ProviderIdentity` with `emailVerified: true`, the provider has
already proven the user controls that address. Berlin trusts the provider's
claim. Berlin sends zero emails for these flows. The provider handles consent
screens, security alerts, and account recovery — everything.

This means **OAuth providers have zero messaging infrastructure dependency**.
Google + Apple + Microsoft can ship without any email or SMS provider being
decided.

Only email/password makes Berlin a messaging sender:
- **Email** — registration verification, password reset
- **SMS** — phone verification for step-up security on sensitive operations

## Identity model

### One social slot + optional password slot

Each user has at most **two login identity slots**:

| Slot | What it holds | Required? |
| --- | --- | --- |
| **Social login** | Google, Apple, or Microsoft (one only) | At least one slot must be filled |
| **Password** | Email/password credential | Optional |

A user cannot have Google AND Apple simultaneously. One social provider per
user, plus optionally email/password. Maximum two login methods.

This eliminates the hardest problems of multi-provider linking: email
mismatches between providers, Apple Hide My Email collision, "which email is
primary" ambiguity, multi-provider unlinking rules.

### Schema

Split identity off the `users` row into a separate table:

```sql
login_identities (
  provider              text,       -- 'google' | 'apple' | 'microsoft' | 'email'
  provider_subject      text,       -- provider's sub, or the email for 'email'
  user_id               uuid references users(user_id),
  password_hash         text,       -- nullable, only for 'email'
  email_verified        boolean,
  created_at            timestamptz,
  primary key (provider, provider_subject)
);
```

Enforce one social login per user:

```sql
create unique index one_social_per_user
  on login_identities (user_id)
  where provider in ('google', 'apple', 'microsoft');
```

Remove `login_provider` and `login_subject` columns from the `users` table
(migrated into `login_identities`).

### Strict email

One email per user. All linked methods use the same email. `users.primary_email`
is canonical display/notification truth. When a user adds email/password to an
existing OAuth account, the password credential uses the same email. No
multi-email-per-user complexity.

### Identity lookup

Berlin resolves identity on `(provider, provider_subject)`, not on email.
Email is display/notification truth, not the lookup key. Changing email does
not break any identity.

### Auto-linking rules

When a user authenticates with a method whose email matches an existing user:

| Incoming method | Existing user has | Result |
| --- | --- | --- |
| OAuth (verified email) | No social slot filled | **Auto-link** — create login_identity for existing user, log in |
| OAuth (verified email) | Social slot already filled (different provider) | **Reject** — "You already have [provider] sign-in. Use that, or remove it to switch." |
| Email/password | Any existing account with same email | **Reject** — "An account exists for this email. Sign in with your existing method and add a password from settings." |

OAuth providers are trusted identity authorities — their verified email is
sufficient to auto-link. Email/password is not trusted for auto-linking because
anyone can type any email.

### User-initiated linking (from account settings)

A logged-in user can add a second login method:

- **Add password** (if social-only): set a password, stored as email/password
  identity. Email already verified by the OAuth provider — no verification
  email needed. This is the "set a password after OAuth" pattern.
- **Switch social provider** (if social + password exist): remove current
  social, add new social. Requires password as fallback or re-authentication.
  Requires phone OTP (see Account Operations).
- **Remove password** (if social + password exist): drops the email/password
  identity. Social login remains.
- **Remove social** (if social + password exist): drops the social identity.
  Password login remains. Requires phone OTP.

Cannot remove the last remaining login method.

### Password-after-OAuth prompting

Users who sign up via OAuth are prompted to set a password through:

1. **Contextual prompt** — when the user reaches a surface that needs
   password (WordPress plugin install, API access), prompt: "Set a password
   to use Clickeen here."
2. **Gentle nudge** — non-blocking dashboard banner or onboarding checklist:
   "Set a password for more sign-in options." Dismissible.

Not blocking during initial signup. The user gets to widgets as fast as
possible. Password setup is a distribution-channel concern, not a
product-value concern.

## Session and bootstrap — unchanged

All four methods converge on the same path after identity resolution:

```
authenticate → resolve_login_identity (or email/password credential check)
             → issueSession (authMode: 'direct_provider')
             → /auth/finish
             → loadPrincipalAccountState (bootstrap)
             → authz capsule with entitlements
```

No new session type. No new auth mode. Email/password login issues the same
KV-stored session with the same JWT access/refresh tokens. Roma, Bob, and all
product surfaces consume the same bootstrap payload regardless of how the user
authenticated.

## Phone verification — step-up security

Phone number is **not a login method**. It is a **verification channel** — an
independent, out-of-band proof that the person initiating a sensitive operation
is the account owner.

### Why phone

The phone is independent of every other identity provider. Google can suspend
the email. Apple can lock the Apple ID. Microsoft can disable the account. But
the phone number is on the user's SIM, controlled by their telecom provider.
It is the one verification channel that survives any digital-identity provider
suspension.

### Setup (progressive, not required at signup)

1. User goes to account settings → "Add phone number"
2. Enters their number (E.164 format)
3. Berlin generates a 6-digit OTP, stores it with a short TTL (5-10 min) in
   Durable Objects (same ticket pattern as OAuth state)
4. Berlin sends the OTP via SMS
5. User enters the code
6. Berlin marks phone as verified

Schema: `phone` column already exists on `users`. Add `phone_verified` boolean
and `phone_verified_at` timestamp. Rate limiting: max N OTP sends per phone per
hour, max M attempts per hour, exponential backoff.

### When phone verification is required

For **security-sensitive operations only** — not everyday login:

| Operation | Requires phone OTP? |
| --- | --- |
| Everyday login (any method) | No |
| Email change | **Yes** |
| Removing a login identity | **Yes** |
| Password reset (if email unreachable) | **Yes** |
| Adding/switching social provider | **Yes** |

### Users without a verified phone

Fall back to the base security model for email change: re-authentication
(current password) + new email verification + old email notification +
reversal window. Weaker but functional. Progressive security — users who add
phone get stronger protection and self-service recovery.

## Account operations

### Email change

Email change is a security-sensitive operation that enables both recovery and
takeover. The same operation that lets a user escape a dead Google account
also lets an attacker lock out the real owner. Phone verification is the
guardrail.

**With verified phone:**

1. User initiates email change in account settings
2. Berlin requires re-authentication (current password or fresh OAuth)
3. Berlin sends SMS OTP to the user's verified phone
4. User enters the code
5. Berlin sends verification to the new email address
6. User clicks the verification link
7. Berlin updates `primary_email` and the email/password identity's
   `provider_subject` to the new email
8. Berlin notifies the old email (if reachable) that the change occurred

**Without verified phone:**

1. User initiates email change
2. Berlin requires re-authentication
3. Berlin sends verification to the new email
4. Berlin sends security notification to the old email with a reversal link
5. Reversal window (24-72 hours) during which the old email can cancel the
   change
6. After the window, the change commits

### Login identity removal

Removing a login identity requires phone OTP (or re-authentication + delay if
no phone). Cannot remove the last remaining login method.

### Recovery path (Google suspension scenario)

1. User signed up with Google, set a password, verified phone — all while
   Google was active
2. Google suspends the account — Gmail and Google OAuth are dead
3. User logs in to Clickeen with email + password (Berlin does not contact
   Google — login works)
4. User initiates email change to an address they control
5. Berlin sends SMS OTP to the user's phone (independent of Google)
6. User enters the code, verifies the new email
7. Recovery complete — no support intervention needed
8. User can optionally remove the dead Google identity and add a new social
   provider (Apple/Microsoft)

Prerequisite: the user must have set a password and verified their phone
**before** losing Google access. This is why the password-after-OAuth prompt
and phone verification nudge matter — they are insurance.

## Provider contracts

### Google — done

Existing implementation. No changes for GA beyond remaining on the enabled
providers list.

### Apple — add

Sign in with Apple uses OAuth2 + PKCE like Google, but with four real
differences:

1. **JWT client secret.** Apple does not issue a static client secret. Berlin
   signs a short-lived JWT with a private key registered in the Apple Developer
   portal. This JWT expires (max 6 months) and must be regenerated at token
   exchange time. Config: `BERLIN_APPLE_TEAM_ID`, `BERLIN_APPLE_KEY_ID`,
   `BERLIN_APPLE_PRIVATE_KEY_PEM`, `BERLIN_APPLE_CLIENT_ID`.

2. **User info returned once.** Apple returns the user's name and email **only
   on first authorization**, inside the ID token. On every subsequent login,
   only `sub` comes back. Berlin must capture and persist name/email on first
   authorization. There is no Apple userinfo endpoint to re-fetch.

3. **Hide My Email.** Users may choose a relay address
   (`abc@privaterelay.appleid.com`). Berlin accepts it as the primary email.
   It cannot be used for display, but it works for verification/reset mail.
   Hide My Email relay addresses will not auto-link to existing accounts by
   email match (the relay address won't match any stored email). Apple users
   with hidden email can still manually link from account settings.

4. **Prerequisite.** Apple Developer Program enrollment ($99/year) is required.

### Microsoft — add

Microsoft consumer accounts (Outlook, Hotmail, Live) use OAuth2 + PKCE through
the Microsoft identity platform (v2 endpoint):

- Authorization: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`
- Token: `https://login.microsoftonline.com/common/oauth2/v2.0/token`
- UserInfo: Microsoft Graph or ID token claims
- Scope: `openid email profile`

The `/common` tenant accepts both consumer and Entra ID accounts. For GA,
consumer accounts are the target. Config: `BERLIN_MICROSOFT_CLIENT_ID`,
`BERLIN_MICROSOFT_CLIENT_SECRET`, `BERLIN_MICROSOFT_CALLBACK_URL`.

Unlike Apple, Microsoft has a callable userinfo endpoint and returns email/name
on every authorization. Same pattern as Google.

### Email/password — add

Berlin owns the credential. Berlin verifies the credential itself instead of
redirecting to an external provider.

**Registration:**

1. User submits email + password
2. Berlin validates email format and password requirements
3. Berlin hashes the password with argon2id (library choice depends on
   Cloudflare Workers runtime — Web Crypto does not include argon2; WASM or
   pure-JS implementation may be required)
4. Berlin creates the user with a `login_identities` row
   (`provider='email'`, `provider_subject=<email>`)
5. Berlin sends email verification through the email provider
6. Account is created but email is unverified until confirmed

**Login:**

1. User submits email + password
2. Berlin looks up `(provider='email', provider_subject=<email>)`
3. Berlin verifies the password hash
4. Berlin enforces rate limiting / brute-force protection (per-identity and
   per-IP attempt limits, exponential backoff, lockout after N failures)
5. Berlin issues session through `issueSession`

**Password reset:**

1. User submits email
2. Berlin generates a single-use reset token, short TTL
3. Berlin sends reset email through the email provider
4. User clicks link, submits new password
5. Berlin validates token, updates hash, invalidates token and all sessions

**Password requirements (NIST 800-63B aligned):**

- Minimum 12 characters
- No forced composition rules (no "must contain uppercase + symbol + number")
- Breach check (HIBP API or local bloom filter — product decision)
- Rate-limited password attempts

## Phasing and dependencies

### Phase 1: OAuth providers — no messaging infrastructure

| Component | Dependency |
| --- | --- |
| Google | None (done) |
| Apple | Apple Developer Program enrollment ($99/year) |
| Microsoft | Azure app registration |

Google + Apple + Microsoft ship as a batch. **Zero messaging infrastructure
needed.** Providers are self-contained for email verification and recovery.

### Phase 2: Email/password + phone verification — requires messaging

| Component | Dependency |
| --- | --- |
| Email/password registration | Email provider decided and wired |
| Email/password reset | Email provider decided and wired |
| Phone verification (OTP) | SMS provider decided and wired |
| Email change (with phone) | SMS provider decided and wired |
| Identity removal (with phone) | SMS provider decided and wired |

Email/password and phone verification are **coupled dependencies**. Safe
account operations require both. The vendor selection should consider whether
to use a single dual-channel vendor (Twilio SendGrid + Twilio SMS, or AWS SES
+ Amazon SNS) or separate vendors per channel. This decision is owned by the
messaging planning track, not this PRD.

### Prerequisites checklist

- [ ] Identity model accepted (one social + optional password, strict email,
      auto-link rules)
- [ ] Phone verification model accepted (step-up security, progressive opt-in)
- [ ] Apple Developer Program enrollment exists
- [ ] Microsoft Azure app registration exists
- [ ] Messaging planning track has promoted email provider into execution
      (blocks Phase 2)
- [ ] Messaging planning track has promoted SMS provider into execution
      (blocks Phase 2 phone verification)

## What this PRD does not own

| Concern | Owner |
| --- | --- |
| Email/SMS provider selection | Messaging planning track |
| Email/SMS send routes, templates, deliverability | Messaging service runtime PRD |
| Account tier assignment beyond `free` | Billing/tier planning track |
| Account onboarding UX (locale setup, website URL, widget seeding) | Roma product PRD |
| Magic link / passwordless | Post-GA planning |
| Apple Developer Program enrollment | External — human action required |
| Microsoft Azure app registration | External — human action required |

## Code work (per-provider execution PRDs will detail)

### Identity model

- [ ] Create `login_identities` table with the schema above
- [ ] Add `one_social_per_user` unique partial index
- [ ] Migrate existing `(login_provider, login_subject)` from `users` rows
      into `login_identities`
- [ ] Remove `login_provider` and `login_subject` columns from `users`
- [ ] Rewrite `resolve_login_identity` RPC for the new table: lookup by
      `(provider, provider_subject)`, auto-link OAuth by email match, reject
      email/password duplicate by email match
- [ ] Add `phone_verified` boolean and `phone_verified_at` timestamp to `users`

### Providers

- [ ] Add `'apple'`, `'microsoft'`, `'email'` to the Postgres `login_provider`
      enum (reverses PRD124a's narrowing)
- [ ] `auth/providers/apple.ts` — authorize URL, JWT client secret signing,
      token exchange, first-auth identity capture
- [ ] `auth/providers/microsoft.ts` — authorize URL, token exchange, userinfo
- [ ] Email/password credential flow — registration, login, reset, verification
      routes. Password hashing (argon2id). Rate limiting. Token store
- [ ] Wire `buildProviderAuthorizeUrl` and `exchangeProviderCallback` for
      apple and microsoft
- [ ] Add `BERLIN_APPLE_*`, `BERLIN_MICROSOFT_*` env vars to `types.ts`
- [ ] Update `BERLIN_ALLOWED_PROVIDERS` to include active GA providers

### Phone verification

- [ ] Phone OTP generation, storage (Durable Objects), and verification
- [ ] SMS send integration (through the decided SMS provider)
- [ ] Rate limiting on OTP send and attempt
- [ ] Phone verification required for: email change, identity removal,
      social provider switch

### Account operations

- [ ] Email change flow (phone OTP + new email verification + old email
      notification)
- [ ] Login identity add/remove from account settings
- [ ] Password-after-OAuth contextual prompt and gentle nudge
- [ ] Brute-force protection on email/password login

### Documentation

- [ ] Update `documentation/architecture/CONTEXT.md` and Berlin service docs
      with the GA provider list, identity model, and phone verification
      authority

## Verification

Prove for each provider:

- New user can register and land in a bootstrapped session with `tier='free'`,
  `status='active'`.
- Returning user can sign in and land in the same session/bootstrap path as
  Google users.
- All four methods converge on the same `issueSession` → bootstrap path.
- Roma and downstream surfaces cannot tell which provider authenticated the
  user.

Prove the identity model:

- One social login per user is enforced (schema constraint).
- OAuth auto-link works when email matches and social slot is empty.
- OAuth is rejected when social slot is already filled by a different provider.
- Email/password registration is rejected when email matches an existing user.
- User can add password to an OAuth-only account without a verification email
  (email already verified by provider).
- User can remove a login method as long as one remains.
- Cannot remove the last login method.

Prove Apple-specific:

- First-auth captures name/email; subsequent auths resolve from stored `sub`.
- Hide My Email relay address works for verification/reset mail.
- JWT client secret is regenerated at exchange time.

Prove email/password:

- Registration creates unverified account; verification link works.
- Login rejects wrong password with the same error as non-existent email (no
  leakage).
- Reset flow works end-to-end.
- Brute-force protection triggers after N failures.

Prove phone verification:

- Phone OTP is required and enforces for email change and identity removal.
- Users without verified phone fall back to the base security model.
- SMS rate limiting prevents abuse.

Prove the recovery path:

- User with Google + password + phone can log in with password after Google
  suspension, change email with phone OTP, and restore recovery without
  support.

## Failure behavior

| Failure | Required result |
| --- | --- |
| Apple client secret JWT expired | Regenerate from private key at exchange time; do not store a static secret. |
| Apple first-auth identity lost (not captured) | User can still authenticate by `sub`; name/email permanently unavailable. Capture on first auth. |
| Microsoft token exchange fails | Return explicit auth error; do not fall back to another provider. |
| Email/password login with wrong password | Reject; increment attempt counter; rate-limit after N failures. Same error as non-existent email. |
| Password reset token expired/used | Reject; require new reset request. |
| Email verification token expired/used | Reject; require new verification send. |
| Email/SMS provider unavailable | Registration/reset/OTP fails visibly; do not silently skip verification. |
| Phone OTP expired/used | Reject; require new OTP send. |
| Email change without phone verification | Require re-auth + new email verification + old email notification + reversal window. |
| User tries to link a method already linked to another account | Reject; do not merge accounts silently. |
| User tries to remove last login method | Reject; require at least one method to remain. |

## Definition of done

Berlin GA Authentication is done when:

- Google, Apple, Microsoft, and email/password all authenticate through Berlin
  and converge on one session and bootstrap path.
- The identity model (one social + optional password, strict email, auto-link
  rules) is implemented and enforced.
- Phone verification secures email change and identity removal.
- Email/password credentials are hashed (argon2id) and stored securely.
- Verification, reset, and OTP flows work through the messaging providers.
- Brute-force protection and rate limiting are active.
- Email change is guarded by phone OTP or the base security fallback.
- The recovery path (Google suspension → password login → phone-verified email
  change) works without support intervention.
- Focused and broad checks pass.
- Current documentation matches runtime.
- An independent V1–V8 audit is GREEN.
