# 076 PRD - Berlin Login/Signup Product Boundary Closure

Status: SOURCE SLICE GREEN; CLOUD-DEV DEPLOY/INTERACTIVE LOGIN VERIFY NEXT
Owner: Berlin/Roma auth boundary
Date: 2026-04-24

## Problem

Roma cloud-dev login is not a trustworthy product surface.

The deployed page presents both Google and email/password as normal customer login methods, while the intended self-serve product path is provider auth through Berlin. Existing docs also drift: some say Google-only for V1/cloud-dev, others say Google and email/password both work. That creates a product-auth boundary with no single truth.

This is not a visual bug. Login/signup is one of Clickeen's core services. A global self-serve product must have one boring account identity pipeline:

`provider identity -> Berlin Clickeen user/account/session -> Roma cookies/bootstrap -> Roma product shell`

Google is only the first provider adapter. Apple, Microsoft, SAML, email magic link, and future providers must plug into the same Berlin-owned model without making provider accounts become Clickeen accounts.

## Product Truth

1. Berlin owns login, signup, linked provider identities, Clickeen user identity, account provisioning, memberships, sessions, and account authz capsule minting.
2. Roma owns the login entry UI, provider-start links, finish-token redemption, secure cookie setting, and product-shell redirect.
3. Bob owns none of login/signup.
4. Prague may carry signup intent into Roma/Berlin, but does not create accounts or sessions.
5. A provider account is a login identity, not a Clickeen account and not the Clickeen user id.
6. One Clickeen user may have many provider identities.
7. One Clickeen user may belong to many Clickeen accounts.
8. One Clickeen account may have many members.
9. First successful provider login may create a Clickeen user and first account if no membership exists.
10. Existing users logging in through an already-linked provider must land in the existing Clickeen user/account context.

## Current Repo Reality

- Roma `/login` renders both Google and email/password.
- Roma `GET /api/session/login/google` starts Berlin provider auth.
- Berlin `POST /auth/login/provider/start`, `GET /auth/login/provider/callback`, and `POST /auth/finish` implement the provider flow.
- Berlin already reads Supabase Auth `identities` and exposes a minimal linked-identity/provider summary through `/v1/me/identities`.
- Berlin reconciles successful auth into `user_profiles`, `accounts`, `account_members`, and active account preference.
- Roma `GET /api/session/finish` redeems Berlin finish tokens and sets shared `.dev.clickeen.com` cookies.
- Roma `POST /api/session/login` still exists for email/password and is useful for operational smoke credentials, but it is not the user-facing canonical cloud-dev login surface.

## Execution Slice

### Cut 1 - Make Roma login honest

Cloud-dev/prod login UI shows only the canonical provider path for now:

- Continue with Google
- no visible email/password form
- copy says Google is the current sign-in method, not “Google or email/password”

Keep `POST /api/session/login` in place as a hidden operational/smoke route until CI is moved to a provider/finish test adapter. Do not advertise it in product UI.

### Cut 2 - Align documentation

Update Berlin/Roma docs so there is one current truth:

- customer-facing cloud-dev login currently uses provider auth through Berlin, with Google as the enabled provider
- email/password route exists as a non-UI operational compatibility path, not the canonical customer login surface
- future Apple/Microsoft/etc are Berlin provider adapters in the same pipeline
- Berlin's current linked-identity source is Supabase Auth identities exposed through `/v1/me/identities`

### Cut 3 - Verification

Source verification:

- Roma TypeScript check
- Berlin TypeScript check
- direct route smoke:
  - `/login` renders Google only
  - `/api/session/login/google` returns redirect to provider auth
  - `/api/session/login` still returns typed auth error for invalid credentials

Cloud-dev manual verification:

- complete Google login interactively
- confirm Roma sets shared cookies
- confirm `/api/bootstrap` returns active account
- confirm `/home` loads

## Explicit Non-Goals

- Do not build Apple/Microsoft/SAML in this slice.
- Do not add a new provider-identity table unless current Supabase Auth identity linkage proves insufficient for a concrete provider-linking requirement.
- Do not remove the password route while runtime smoke still depends on it.
- Do not move account provisioning into Roma.
- Do not let Bob observe provider identity.
- Do not redesign account switching.

## Acceptance Criteria

1. Roma login UI no longer advertises email/password in cloud-dev/prod.
2. Roma login UI clearly represents the current provider-auth entry path.
3. Docs stop presenting email/password as normal cloud product login.
4. Berlin remains the only login/signup/account reconciliation owner.
5. Existing hidden password route remains available for smoke/operational use.
6. TypeScript checks pass for Roma and Berlin.

## 2026-04-24 Source Execution Notes

- Roma `/login` now renders Google as the only visible cloud-dev/prod sign-in path.
- Roma password form remains behind `NEXT_PUBLIC_ROMA_PASSWORD_LOGIN=1`; the same-origin password route is unchanged for hidden operational/smoke use.
- Berlin/Roma service docs now describe provider auth as the customer-facing cloud path and password login as hidden compatibility.
- Historical PRD drift that presented Google + email/password as the normal cloud product surface was corrected or marked superseded by this PRD.
- Source checks:
  - `corepack pnpm exec tsc -p roma/tsconfig.json --noEmit` -> PASS
  - `corepack pnpm exec tsc -p berlin/tsconfig.json --noEmit` -> PASS
  - `NEXT_PUBLIC_TOKYO_URL=https://tokyo.dev.clickeen.com BERLIN_BASE_URL=https://berlin.dev.clickeen.com SANFRANCISCO_BASE_URL=https://sanfrancisco.dev.clickeen.com NEXT_PUBLIC_BOB_URL=https://bob.dev.clickeen.com corepack pnpm -C roma build` -> PASS
- Local copied-machine limitation:
  - `corepack pnpm -C roma build:cf` fails before app build because Vercel tries to spawn a global `pnpm`; this machine currently exposes pnpm through Corepack only.
- Cloud-dev manual verification remains after deployment:
  - `/login` shows Google only
  - Google provider flow completes
  - Roma sets shared cookies
  - `/api/bootstrap` returns active account
  - `/home` loads
