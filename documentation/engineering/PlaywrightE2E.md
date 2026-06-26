# Playwright E2E

STATUS: CURRENT SYSTEM OPERATOR SPEC

## Purpose

Playwright is the repo-level browser automation harness for Clickeen.

It is not owned by Roma, Bob, Prague, DevStudio, or any single app. Tests live
under root `e2e/` and can target any deployed surface.

E2E is deploy/runtime evidence only when it runs against the deployed
cloud-dev surfaces. It is not a local runtime authority and must not introduce
fake product modes, auth bypasses, or test-only product routes.

## AI Operator Quick Start

If you need to run authenticated Clickeen E2E, do this:

```bash
pnpm e2e:auth:roma-dev
pnpm e2e
```

If you need the Product Copilot runtime smoke:

```bash
pnpm e2e:auth:roma-dev
pnpm e2e:smoke:copilot-runtime
```

If you need the Translation Agent runtime smoke:

```bash
pnpm e2e:auth:roma-dev
pnpm e2e:smoke:translation-agent-runtime
```

If `pnpm e2e:auth:roma-dev` fails, fix the auth-state boundary:

- confirm `CK_ADMIN_EMAIL` and `CK_ADMIN_PASSWORD` exist in root `.env.local`
  or the shell;
- confirm the accepted alternate names `BERLIN_DEV_ADMIN_EMAIL` and
  `BERLIN_DEV_ADMIN_PASSWORD` exist if the `CK_*` names are absent;
- confirm Berlin cloud-dev accepts `POST /auth/login/dev-admin`;
- confirm Roma cloud-dev accepts `/api/session/finish`.

Stop there until auth-state creation works. Do not create a workaround.

## Hard Stops

Never do these to make E2E pass:

- do not automate Google OAuth;
- do not add a public auth bypass;
- do not add a fake Builder mode;
- do not add a fake account type;
- do not add test-only product routes;
- do not switch to localhost as product runtime evidence;
- do not call a Worker directly and claim the browser product path is tested;
- do not edit product code to satisfy a test harness assumption.

If the test needs authenticated product state, the only normal path is:

```text
Berlin dev-admin auth -> Roma session finish -> Playwright storage state
```

If the test needs product behavior, the evidence path is the deployed
cloud-dev product path that a real user or operator uses.

## Code Authority

| Concern | File |
| --- | --- |
| Playwright config | `playwright.config.ts` |
| Global auth-state setup | `e2e/global-setup.ts` |
| Auth-state helper | `e2e/helpers/auth-state.ts` |
| Roma dev-admin auth state writer | `scripts/e2e/roma-dev-auth.mjs` |
| Product Copilot runtime smoke | `scripts/e2e/roma-copilot-runtime-smoke.mjs` |
| Translation Agent runtime smoke | `scripts/e2e/roma-translation-agent-runtime-smoke.mjs` |
| Browser specs | `e2e/**` |

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

Playwright config:

| Setting | Current value |
| --- | --- |
| Test directory | `e2e/` |
| Default base URL | `https://roma.dev.clickeen.com` |
| Default auth state | `e2e/.auth/roma-dev.json` |
| Browser project | Chromium / Desktop Chrome |
| Workers | `1` |
| Retry in CI | `1` |
| Trace | retain on failure |
| Screenshot | only on failure |
| Video | retain on failure |

Remote e2e mutates shared account/widget state, so the config uses one worker.

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

Auth-state creation path:

```text
scripts/e2e/roma-dev-auth.mjs
-> Berlin POST /auth/login/dev-admin
-> Roma /api/session/finish
-> Roma /api/me verification
-> e2e/.auth/roma-dev.json
```

The Berlin dev-admin provider is cloud-dev test infrastructure. It must resolve
to the existing normal `CLICKEEN` account; it is not a customer login path and
must not be exposed as public product auth.

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

The command reads `CK_ADMIN_EMAIL`/`CK_ADMIN_PASSWORD`, or the accepted
alternate names `BERLIN_DEV_ADMIN_EMAIL`/`BERLIN_DEV_ADMIN_PASSWORD`, from the
environment or local `.env.local`. Berlin stores the same values in its
`BERLIN_DEV_ADMIN_EMAIL`/`BERLIN_DEV_ADMIN_PASSWORD` Worker secrets. If the
storage state is missing, authenticated specs skip and public smoke specs still
run.

Global setup behavior:

- If `E2E_AUTH_STATE` exists, Playwright uses it.
- If it does not exist, `e2e/global-setup.ts` writes an empty state file.
- Specs that require auth call `hasAuthCookies()` and skip when cookies are
  absent.
- Public unauthenticated specs use an explicit empty storage state.

Do not commit real storage-state cookies. Treat `e2e/.auth/*.json` as local
secret material.

## Shared Account Preconditions

Authenticated E2E uses the existing cloud-dev admin account:

```text
CLICKEEN
```

That account must already have product data for the smoke being run. E2E does
not create a fake account, fake Builder, or fake widget. If a smoke depends on
an instance or copy in the account, that dependency is part of the test evidence
and must be stated in the result.

The current Product Copilot smoke opens the first account widget in Roma, then
uses the Bob Builder path and expects the opened Builder to contain `BigBang
Test`. If that account data changes, either update the real cloud-dev account
state or update the smoke and this doc together.

The current Translation Agent smoke prefers `E2E_TRANSLATION_INSTANCE_ID` when
set. Without it, the script selects instance `QD1G068MX7` if present, then a
`big-bang` instance, then the first instance from Roma. When proving a specific
translation instance, set `E2E_TRANSLATION_INSTANCE_ID` and include that value
in the evidence.

## Current Specs

- `e2e/smoke/roma-login.spec.ts`: verifies the public Roma login page.
- `e2e/widgets/builder-open.spec.ts`: verifies authenticated Widgets -> Builder
  open through the Bob iframe.
- `e2e/widgets/widget-defaults.spec.ts`: verifies widget default behavior.
- `e2e/widgets/prd106f-builder-certification.spec.ts`: certifies current
  Builder behavior for the named widget flow.
- `e2e/devstudio/route-contract.spec.ts`: verifies DevStudio route shell,
  navigation, and policy read lane.

If auth secrets are missing, authenticated specs skip and the public smoke still
runs.

## Operator Commands

```bash
pnpm e2e
pnpm e2e:headed
pnpm e2e:ui
pnpm e2e:auth:roma-dev
pnpm e2e:smoke:copilot-runtime
pnpm e2e:smoke:translation-agent-runtime
```

Required env for authenticated Roma tests:

```text
CK_ADMIN_EMAIL=[cloud-dev admin email]
CK_ADMIN_PASSWORD=[cloud-dev admin password]
```

Accepted alternate env names:

```text
BERLIN_DEV_ADMIN_EMAIL=[cloud-dev admin email]
BERLIN_DEV_ADMIN_PASSWORD=[cloud-dev admin password]
```

Optional target overrides:

```text
E2E_ROMA_URL=[Roma base URL]
E2E_BERLIN_URL=[Berlin base URL for auth-state writer]
E2E_BASE_URL=[generic base URL]
E2E_AUTH_STATE=[storage state path]
E2E_TRANSLATION_INSTANCE_ID=[saved instance id for translation smoke]
```

## Product Copilot Runtime Smoke

After refreshing auth state, run:

```bash
pnpm e2e:smoke:copilot-runtime
```

The smoke uses the authenticated Roma storage state and the `CLICKEEN` account.
It verifies three things:

- authenticated Roma -> Product Copilot route returns `kind: answer` with a
  `meta.requestId`;
- an unmanaged selected model is rejected with HTTP 422 instead of silently
  substituting another model;
- Bob receives the Builder instance, Copilot returns a `draft_edit`, Bob applies
  it in browser memory, exposes `Undo`, and Undo completes.

Pass evidence is the command exiting `0` and printing JSON with:

```json
{
  "ok": true,
  "account": "CLICKEEN",
  "instance": {
    "instanceId": "[instance id]",
    "widgetType": "[widget type]",
    "displayName": "[display name]"
  },
  "route": {
    "requestId": "[San Francisco request id]",
    "kind": "answer"
  },
  "noFallback": {
    "status": 422,
    "issue": "[selected model rejection]"
  },
  "bob": {
    "builderUrl": "[Roma Builder URL]"
  }
}
```

Failure means the deployed Roma/Product Copilot/Bob path is not proven. Do not
replace this with a direct Worker call and call the product path verified.

## Translation Agent Runtime Smoke

After refreshing auth state, run:

```bash
pnpm e2e:smoke:translation-agent-runtime
```

The smoke uses the authenticated Roma storage state and the `CLICKEEN` account.
Set `E2E_TRANSLATION_INSTANCE_ID` when proving a specific saved instance.
It verifies the real product path:

```text
Bob Translations panel -> Roma -> Translation Agent Worker -> San Francisco -> Tokyo-worker/R2
```

The command clicks Bob's real `Generate translations` button, waits for the Roma
generation response, requires the exact success shape with non-empty
`activeLocales` and empty `skippedLocales`, then reads the generated overlay
list and one locale overlay through Roma and renders translated overlay values
in Bob.

Pass evidence is the command exiting `0` and printing JSON with:

```json
{
  "ok": true,
  "account": "CLICKEEN",
  "instance": {
    "instanceId": "[instance id]",
    "widgetType": "[widget type]",
    "displayName": "[display name]"
  },
  "baseLocale": "[base locale]",
  "activeLocaleCount": "[number]",
  "generatedLocaleCount": "[number]",
  "generatedLocales": ["[active locale]"],
  "sampledLocale": "[locale]",
  "sampledOverlayValueCount": "[number]",
  "bob": {
    "generation": {
      "builderUrl": "[Roma Builder URL]"
    },
    "overlay": {
      "builderUrl": "[Roma Builder URL]",
      "rowTextLength": "[number]"
    }
  }
}
```

Failure means the deployed Bob -> Roma -> Translation Agent -> San Francisco ->
Tokyo-worker path is not proven. Do not replace this with a direct Translation
Agent call and call the product path verified.

## Failure Semantics

| Case | Result |
| --- | --- |
| Missing auth state | global setup writes empty state; authenticated specs skip |
| Missing admin email/password for auth-state writer | `pnpm e2e:auth:roma-dev` fails |
| Berlin dev-admin login fails | auth-state writer fails; no fake login substitute |
| Roma session finish fails | auth-state writer fails |
| Deployed app route fails | Playwright spec fails against owning deployed surface |
| Copilot unmanaged model accepted | Copilot smoke fails; no-substitution law violated |
| Translation generation partial/skipped | Translation smoke fails |

## Verification Evidence

| Concern | Evidence |
| --- | --- |
| Public Roma reachable | `e2e/smoke/roma-login.spec.ts` screenshot/output |
| Authenticated Roma session | non-empty `e2e/.auth/roma-dev.json` created by `pnpm e2e:auth:roma-dev` |
| Builder open product path | `e2e/widgets/builder-open.spec.ts` passes against deployed Roma/Bob |
| Product Copilot path | `pnpm e2e:smoke:copilot-runtime` JSON output |
| Translation Agent path | `pnpm e2e:smoke:translation-agent-runtime` JSON output |
| DevStudio route shell | `e2e/devstudio/route-contract.spec.ts` passes against configured base URL/auth state |

`pnpm e2e` is authenticated evidence only when the authenticated specs run and
pass. A run where authenticated specs skip because `e2e/.auth/roma-dev.json`
has no cookies is public smoke evidence only.
