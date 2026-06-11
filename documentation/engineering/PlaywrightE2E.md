# Playwright E2E

Status: active engineering workflow

## Purpose

Playwright is the repo-level browser automation harness for Clickeen.

It is not owned by Roma, Bob, Prague, DevStudio, or any single app. Tests live
under root `e2e/` and can target any deployed surface.

## Default Mode

E2E is remote-only by default.

```bash
pnpm e2e
```

Default Roma target:

```text
https://roma.dev.clickeen.com
```

Override with:

```bash
E2E_ROMA_URL=https://roma.dev.clickeen.com pnpm e2e
```

For a non-Roma deployed surface, use the generic base URL override and a
surface-specific storage state file:

```bash
E2E_BASE_URL=https://devstudio.clickeen.com \
E2E_AUTH_STATE=e2e/.auth/devstudio.json \
pnpm e2e
```

The Roma default is preserved when neither `E2E_ROMA_URL` nor `E2E_BASE_URL` is set.

## Authenticated Product Flows

Do not automate Google OAuth.

Authenticated tests use a dedicated dev e2e account and a dev-only session
bootstrap:

1. Playwright calls Roma `POST /api/e2e/session`.
2. Roma calls Berlin `POST /internal/e2e/session`.
3. Berlin resolves the allowlisted e2e email through the existing `email`
   login provider and issues normal access/refresh tokens.
4. Roma fetches the normal Berlin account bootstrap and sets normal shared
   Roma/Bob cookies.
5. Playwright saves the session to `e2e/.auth/roma-dev.json`.

After that, tests exercise the real product path:

```text
Roma -> Bob iframe -> Tokyo product APIs
```

No fake Builder mode, account type, or login provider is introduced.

DevStudio uses the same rule: remote DevStudio e2e must call `/api/e2e/session` on
`https://devstudio.clickeen.com` through `E2E_BASE_URL`; it must not automate Google
OAuth or add a local/dev auth mode.

## Required Secrets

Local `.env.local` or shell environment for the test runner:

```bash
E2E_USER_EMAIL=playwright@clickeen.com
E2E_AUTH_SECRET=...
```

Remote dev services must also be configured:

Berlin:

```text
E2E_AUTH_ENABLED=true
E2E_AUTH_SECRET=...
E2E_ALLOWED_EMAILS=playwright@clickeen.com
```

Roma:

```text
E2E_AUTH_ENABLED=true
E2E_AUTH_SECRET=...
```

DevStudio:

```text
E2E_AUTH_SECRET=...
```

The same `E2E_AUTH_SECRET` must be configured in Playwright, Berlin, and the
deployed surface being tested.

## Storage State

The generated storage state is local secret material:

```text
e2e/.auth/roma-dev.json
```

It is ignored by git.

Refresh it with:

```bash
E2E_REFRESH_AUTH=1 pnpm e2e
```

## Current Specs

- `e2e/smoke/roma-login.spec.ts`: verifies the public Roma login page.
- `e2e/widgets/builder-open.spec.ts`: verifies authenticated Widgets -> Builder
  open through the Bob iframe.

If auth secrets are missing, authenticated specs skip and the public smoke still
runs.
