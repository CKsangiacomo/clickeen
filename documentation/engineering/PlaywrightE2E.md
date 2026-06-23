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

Authenticated tests use an ignored Playwright storage-state file created from
Berlin's cloud-dev admin auth provider. The provider accepts the configured
admin email and password, verifies that the existing user resolves to the
normal `CLICKEEN` account, issues a normal Berlin session, and lets Roma finish
the session through `/api/session/finish`.

After that, tests exercise the real product path:

```text
Roma -> Bob iframe -> Tokyo product APIs
```

No fake Builder mode, account type, or login provider is introduced.

## Storage State

The generated storage state is local secret material:

```text
e2e/.auth/roma-dev.json
```

It is ignored by git.

Create or refresh it with:

```bash
pnpm e2e:auth:roma-dev
```

The command reads `CK_ADMIN_EMAIL`/`CK_ADMIN_PASSWORD`, falling back to
`BERLIN_DEV_ADMIN_EMAIL`/`BERLIN_DEV_ADMIN_PASSWORD`, from the environment or
local `.env.local`. Berlin stores the same values in its
`BERLIN_DEV_ADMIN_EMAIL`/`BERLIN_DEV_ADMIN_PASSWORD` Worker secrets. If the
storage state is missing, authenticated specs skip and public smoke specs still
run.

## Current Specs

- `e2e/smoke/roma-login.spec.ts`: verifies the public Roma login page.
- `e2e/widgets/builder-open.spec.ts`: verifies authenticated Widgets -> Builder
  open through the Bob iframe.

If auth secrets are missing, authenticated specs skip and the public smoke still
runs.
