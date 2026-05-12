# PRD 094 - Roma Server-Owned Account Authz And Product API Cleanup

Status: Executed - code/build verified; credentialed cloud-dev browser smoke pending deployed build
Owner: Codex
Date: 2026-05-12
Architecture source: `documentation/architecture/CONTEXT.md`
Strategy source: `documentation/strategy/WhyClickeen.md`
Triggered by: Builder open regression returning `authz_capsule_required`
Parent cleanup: `Execution_Pipeline_Docs/02-Executing/093__PRD__PRD_092_Intent_Closure_And_Widget_Catalog_Truth.md`
Execution notes: `Execution_Pipeline_Docs/02-Executing/094A__Execution_Notes.md`

## 0. Execution Result

PRD 094 was executed on 2026-05-12.

Implemented decisions:

- Account authz capsule is stored as a plain httpOnly secure cookie named `ck-authz-capsule`.
- No encryption wrapper, signed-cookie layer, KV session store, fallback account, or browser-visible replacement token was added.
- `/api/session/finish` stores the capsule cookie after Berlin bootstrap returns it.
- `/api/bootstrap` refreshes the server-owned capsule cookie and strips raw `authz.accountCapsule` from the JSON returned to browser JavaScript.
- `resolveCurrentAccountRouteContext` reads server-owned account authz through `resolveServerAccountAuthz`, not a browser request header.
- `useRomaAccountApi` no longer reads or sends account authz.
- Roma-to-Tokyo private service calls still forward `x-ck-authz-capsule` from server route context, and Tokyo-worker remains strict.

Verification:

- `corepack pnpm --filter @clickeen/roma typecheck`
- `PATH="/tmp/codex-bin:$PATH" pnpm typecheck`
- `PATH="/tmp/codex-bin:$PATH" pnpm lint`
- `PATH="/tmp/codex-bin:$PATH" pnpm test`
- `PATH="/tmp/codex-bin:$PATH" pnpm --filter @clickeen/roma build:cf`
- residue scans listed in PRD 094A

Credentialed cloud-dev browser smoke remains pending until this commit is deployed and exercised with a real browser session. The code/build boundary is green.

## 1. Purpose

PRD 094 fixes the current-account auth architecture that allowed Roma to render an authenticated product shell while the active product API path failed with:

```json
{"error":{"kind":"DENY","reasonKey":"coreui.errors.auth.forbidden","detail":"authz_capsule_required"}}
```

This is not a Builder-specific bug and not a publish/unpublish bug.

It is a broken split-auth model:

- Roma session cookies prove the user is logged in.
- `/api/bootstrap` returns an account authz capsule to browser JavaScript.
- Browser JavaScript must attach that capsule as `x-ck-authz-capsule` on every current-account API call.
- Roma server routes reject the same logged-in user if that browser-carried header is absent.
- The product shell can look authenticated while core account APIs fail.

That is toxic for the authoring spine. It makes the real product path depend on a browser header shuttle instead of Roma's server-owned session/account boundary.

PRD 094 deletes that split and replaces it with one surviving rule:

**Browser proves session to Roma. Roma server resolves current-account authz. Roma server forwards the account authz capsule to Tokyo. Browser JavaScript does not own or resend account authz for product APIs.**

## 2. Product Truth

The real product path remains:

```text
Roma account shell
  -> Bob Builder editor
  -> Roma account API boundary
  -> Tokyo-worker account instance storage
```

Opening Builder must require:

- valid Roma session
- current account context
- sufficient account role
- saved authoring config exists in Tokyo

Opening Builder must not require:

- browser JavaScript to manually resend `x-ck-authz-capsule`
- publish/serve state
- demo/minibob identities
- fake account modes
- fallback account guesses

## 3. Current Evidence

Observed failure:

- `GET https://roma.dev.clickeen.com/api/builder/{instanceId}/open`
- HTTP `502` in browser UI, with response body showing:

```json
{
  "error": {
    "kind": "DENY",
    "reasonKey": "coreui.errors.auth.forbidden",
    "detail": "authz_capsule_required"
  }
}
```

Code evidence:

- `roma/lib/account-authz-capsule.ts` returns `authz_capsule_required` when `x-ck-authz-capsule` is missing.
- `roma/lib/current-account-route.ts` requires `authorizeRequestRoleFromCapsule(request)` for current-account API routes.
- `roma/components/account-api.ts` reads `data.authz.accountCapsule` from `/api/bootstrap` and attaches it to client fetches.
- `roma/app/api/builder/[instanceId]/open/route.ts` uses `resolveCurrentAccountRouteContext`.
- Many other current-account API routes use the same resolver.

Approximate blast radius from local scan:

- 20 Roma current-account API route files call `resolveCurrentAccountRouteContext`.
- 9 Roma client/domain components use `useRomaAccountApi`.
- 19 Roma server call sites forward `accountCapsule` to Tokyo/asset helpers.
- Tokyo-worker still correctly requires Roma-to-Tokyo requests to carry a signed account capsule.

Conclusion:

The capsule primitive itself is legitimate as a Roma-to-Tokyo proof. The toxic part is exposing it to browser JavaScript and making browser JavaScript the carrier for Roma's own account API authorization.

## 4. Surviving Authority

### Keep

- Berlin remains the authority that issues/verifies account authz capsules.
- Roma remains the current-account product boundary.
- Tokyo-worker remains the account instance storage and publish/serve-state authority.
- Tokyo-worker must continue to require a signed account authz capsule from Roma for private account data.

### Delete

- Browser-owned account authz header forwarding.
- `/api/bootstrap` exposing `authz.accountCapsule` as a client API requirement.
- `useRomaAccountApi` owning `accountCapsule`.
- Client route success depending on `x-ck-authz-capsule`.
- Any "fallback account", "default account", "if header missing use active account from UI", or "try both" behavior.

## 5. Target Architecture

### Server-Owned Current Account Context

Introduce one Roma server helper that resolves the current account context from server-owned auth state:

```text
Request to Roma current-account API
  -> resolve session bearer from httpOnly session cookies
  -> resolve current account bootstrap/authz server-side
  -> validate role on server
  -> return accountId, role, profile, entitlements, accountCapsule
```

The browser should not provide `x-ck-authz-capsule` to Roma current-account APIs.

### Account Capsule Storage

Preferred implementation:

- On `/api/session/finish`, after Berlin `/v1/session/bootstrap` succeeds, Roma stores the account authz capsule in a Roma-owned httpOnly secure cookie alongside session cookies.
- Current-account API routes read the capsule from that server-owned cookie.
- If the capsule is missing/expired/invalid, Roma refreshes it from Berlin using the server-side access token once at the named auth boundary.
- If refresh fails, Roma returns a named auth/context error and the shell redirects/reloads account context.

The implementation uses the existing cookie helper and stores the already-signed Berlin capsule as a plain httpOnly secure cookie. No extra encryption/signing wrapper or KV-backed session store is part of this PRD.

### Client API Shape

`useRomaAccountApi` should become boring:

```text
fetch('/api/account/...', { credentials: same-origin, cache: no-store })
```

It may still set `content-type`, request ids, or other non-auth headers.

It must not read or attach `accountCapsule`.

### Bootstrap Shape

`/api/bootstrap` may still return account/user/context display data.

It must not return a browser-owned credential that client APIs must replay.

If short-term UI needs to know authz metadata, it should receive non-secret account context:

- account id
- role
- profile
- entitlement snapshot
- expiry display/debug metadata if needed

It must not expose the raw capsule as product API plumbing.

## 6. Non-Negotiables

- Do not make Builder open special.
- Do not preserve browser-carried `x-ck-authz-capsule` as a second valid current-account auth path.
- Do not add a fallback account.
- Do not infer account from route params or widget ids.
- Do not lower Tokyo-worker auth requirements.
- Do not make Tokyo accept account id alone.
- Do not add a generic auth framework.
- Do not preserve duplicated current-account resolvers.
- Do not hide auth failures behind generic 502 copy.

## 7. Execution Slices

Each slice must be green before moving to the next.

### Slice 0 - Evidence And Route Matrix

Goal:

Classify every current-account API route and identify whether it requires server account authz, Tokyo forwarding, asset forwarding, or local-only handling.

Required evidence:

- List all `resolveCurrentAccountRouteContext` callers.
- List all places `accountCapsule` is read, returned, or forwarded.
- List all client code that attaches `x-ck-authz-capsule`.
- Confirm whether `/api/bootstrap` currently exposes the raw capsule.
- Confirm exact cookie/session helpers available in `roma/lib/auth/session.ts`.

Green condition:

- A route matrix exists in PRD 094 execution notes.
- No code changes yet.

### Slice 1 - Server-Owned Capsule Session Primitive

Goal:

Add the minimal Roma server primitive that stores and reads current account authz from server-owned session state.

Expected changes:

- Extend Roma session cookie handling to support an httpOnly account authz capsule cookie, or an equivalent server-owned session-bound mechanism.
- On `/api/session/finish`, persist the account authz capsule after Berlin bootstrap succeeds.
- Add a named helper, for example `resolveServerAccountAuthz`, that returns:
  - `accountId`
  - `role`
  - `profile`
  - `entitlements`
  - raw `accountCapsule` for Roma-to-Tokyo forwarding only
  - set-cookie updates if refresh/rotation happens

Guardrails:

- The raw capsule must not become readable by client JavaScript.
- The helper must not guess an account if capsule/bootstrap is missing.
- The helper must fail with named auth/context errors.

Verification:

- Unit or route-level tests for:
  - cookie present and valid
  - cookie missing but access token can refresh from Berlin/bootstrap
  - missing/invalid session
  - insufficient role

Green condition:

- Server routes can resolve current account authz without a browser-provided `x-ck-authz-capsule` header.

### Slice 2 - Replace Current Account Route Resolver

Goal:

Make `resolveCurrentAccountRouteContext` use the server-owned authz helper instead of `authorizeRequestRoleFromCapsule(request)`.

Expected changes:

- `roma/lib/current-account-route.ts` stops reading account authz from request headers.
- It still resolves session bearer from cookies.
- It returns the same route context fields needed by existing routes, including `authzToken` for Tokyo forwarding.
- It applies session/capsule cookie updates through `withSession`.

Guardrails:

- Do not update each route with custom auth code.
- Do not allow both old and new auth paths.
- Do not remove role checks.

Verification:

- `rg "authorizeRequestRoleFromCapsule" roma/app roma/lib`
- Current-account API route tests or smoke proving no browser capsule header is required.
- Existing account routes still typecheck.

Green condition:

- All current-account API routes use the server-owned authz path through the shared resolver.

### Slice 3 - Delete Client Capsule Plumbing

Goal:

Remove browser-owned account authz transport.

Expected changes:

- Remove `accountCapsule` from `RomaAccountApi`.
- Remove `resolveRomaAccountCapsule`.
- Remove `buildRomaAccountHeaders` setting `x-ck-authz-capsule`.
- Remove `accountCapsule` from `fetchRomaAccountJson` init.
- Remove raw `authz.accountCapsule` from `RomaMeResponse` if no longer returned by `/api/bootstrap`.
- Update client call sites to rely on same-origin cookies only.

Guardrails:

- Do not replace it with another browser-visible auth token.
- Do not preserve dead optional `accountCapsule?: string | null` fields in client types.

Verification:

- `rg "accountCapsule|x-ck-authz-capsule|ROMA_AUTHZ_CAPSULE_HEADER" roma/components roma/app/api/bootstrap roma/components/use-roma-me.ts`
- Browser/client code has no raw capsule access.

Green condition:

- Client JavaScript cannot be the carrier for current-account API authz.

### Slice 4 - Keep Roma-To-Tokyo Proof Explicit

Goal:

Preserve the legitimate internal proof from Roma to Tokyo.

Expected changes:

- `roma/lib/tokyo-product-control.ts` continues to attach `x-ck-authz-capsule` from server-owned route context.
- `roma/lib/tokyo-asset-control.ts` continues to attach it from server-owned route context.
- Tokyo-worker auth remains strict.

Guardrails:

- Do not weaken `assertRomaAccountCapsuleAuth`.
- Do not make Tokyo trust only `x-account-id`.
- Do not add dev-only bypasses to product routes.

Verification:

- Tokyo-worker tests/typecheck.
- Scan confirms Tokyo still requires capsule on account product routes.

Green condition:

- Internal Roma-to-Tokyo auth remains signed and account-scoped.

### Slice 5 - Builder Open Product Smoke

Goal:

Prove the broken user path works.

Required checks:

- With normal browser session and no JavaScript-added `x-ck-authz-capsule`, `GET /api/builder/:instanceId/open` returns `200`.
- Existing unpublished widget opens in Bob.
- Existing published widget opens in Bob.
- Missing/deleted instance returns named `404`.
- Insufficient role returns named `403`.
- Invalid saved config returns named validation error.

Guardrails:

- Do not require publish state to open Builder.
- Do not collapse auth or validation failures into generic 502.

Green condition:

- Builder opens at least one known unpublished account widget in cloud-dev.

### Slice 6 - Product API Regression Smoke

Goal:

Prove the auth cleanup did not silently break other current-account routes.

Required checks:

- `/api/account/widgets`
- `/api/account/instances`
- `/api/account/usage`
- `/api/account/assets`
- save/update existing instance
- publish/unpublish existing instance, if test account has permission
- rename existing instance

Green condition:

- All named current-account routes work from browser session without browser-owned capsule header.

### Slice 7 - Documentation And Toxic Residue Scan

Goal:

Make docs match the real auth model and remove residue.

Required doc updates:

- `documentation/architecture/CONTEXT.md`
- PRD 094 execution notes
- Any service docs that describe Roma bootstrap/current-account auth

Required scans:

- No client-side `accountCapsule`.
- No client-side `x-ck-authz-capsule`.
- No `/api/bootstrap` raw capsule return.
- No current-account server route directly calls `authorizeRequestRoleFromCapsule(request)`.
- Tokyo-worker still requires account authz capsule for product-control routes.

Green condition:

- Docs and code describe one model: browser session to Roma, Roma server authz to Tokyo.

## 8. Acceptance Criteria

PRD 094 is executed only when all are true:

- Logged-in Roma user can open Builder without browser JavaScript carrying `x-ck-authz-capsule`.
- Existing unpublished widget opens for editing.
- Existing published widget opens for editing.
- Client code has no raw account capsule plumbing.
- `/api/bootstrap` no longer exposes raw account authz capsule as a replay credential.
- Roma current-account API routes use a server-owned account authz resolver.
- Tokyo-worker remains strict and requires signed Roma account authz capsule on account product routes.
- Auth errors are named and visible in route responses.
- No fallback account, default account, demo identity, minibob identity, or guessed account survives in the product path.
- Full local verification is green:
  - `pnpm --filter @clickeen/roma typecheck`
  - `pnpm --filter @clickeen/tokyo-worker typecheck`
  - `pnpm typecheck`
  - route/client auth residue scans
  - credentialed cloud-dev product smoke

## 9. Out Of Scope

- Redesigning Berlin login.
- Removing the account authz capsule primitive entirely.
- Changing Tokyo-worker account storage.
- Changing publish/unpublish semantics.
- Adding customer account switching.
- Building a generic auth platform.
- Supporting old browser-visible capsule clients after this cut.

## 10. Rollback

Because this is pre-GA, no long-lived compatibility shim is required.

Rollback is allowed only as:

- revert PRD 094 commit if the server-owned session auth primitive blocks login entirely, or
- restore the previous deployed Roma build while fixing the server-owned route context.

Rollback must not reintroduce browser-owned `x-ck-authz-capsule` as the intended architecture.

## 11. Execution Decisions

- Cookie storage: separate httpOnly cookie.
- Cookie name: `ck-authz-capsule`.
- Cookie max-age: derived from the capsule JWT `exp`, with a 30-minute fallback only if the token lacks a parseable expiry.
- Refresh strategy: current-account route context refreshes from Berlin bootstrap once when the cookie is missing/invalid; `/api/bootstrap` also refreshes the cookie while stripping the raw capsule from the response.
- Cloud-dev smoke fixture: pending a deployed build and an active Roma browser session.
