# Roma — Product Shell (Account App)

STATUS: REFERENCE — MUST MATCH RUNTIME  
Runtime code + deploy config are truth. If this doc drifts from `roma/*` behavior, update it immediately.

## Purpose

Roma is the authenticated product shell for account users. It owns:

- Domain navigation (`/home`, `/widgets`, `/templates`, `/builder`, etc.)
- Active account context resolution
- Lightweight catalog/list APIs for product UX
- Bob editor orchestration via explicit message boot

Roma is a host/orchestrator. Bob remains the editor kernel.

## Runtime surface (current repo snapshot)

### App routes

- `/` → redirects to `/home` when a session is present, otherwise `/login`
- `/:domain` (`home|widgets|templates|assets|team|billing|usage|ai|settings`) via `roma/app/[domain]/page.tsx`
- `/builder` and `/builder/:publicId`
- `/widgets/:publicId` (redirects back to `/widgets?selected=:publicId`; widgets list is the canonical status-owner surface)
- `/assets/:assetId` (detail placeholder)

### URL path isolation (Builder)

- Selected instance is path-driven: `/builder/:publicId`.
- Query `publicId` is a fallback input only.
- No auto-pick/random-first-instance behavior exists.
- Roma keeps URL and selected instance synchronized (`router.replace`) so state is deep-linkable.

## Auth + account bootstrap

Roma bootstraps from:

- `GET /api/bootstrap` (canonical)

`/api/bootstrap` proxies to Paris `GET /api/roma/bootstrap` with the user bearer token.
When no valid session is present, it returns `401` with auth error payload (`coreui.errors.auth.required`).
Roma does not auto-bootstrap tool sessions; supported Roma runtimes always require real Berlin session tokens.
Roma does not bridge session tokens through browser JS. Builder relies on shared httpOnly cookies across Roma/Bob on a custom `*.clickeen.com` domain.
Roma exposes explicit session endpoints for product auth UX:

- `POST /api/session/login` (email/password -> Berlin auth login -> httpOnly session cookies)
- `POST /api/session/logout` (best-effort Berlin logout + clears auth cookies)
- `GET /api/session/login/google` (starts Google auth via Berlin)
- `GET /api/session/finish` (redeems Berlin `finishId`, sets shared httpOnly session cookies, then redirects into Roma)

Non-local auth rule:

- Deployed Roma/Bob auth treats non-local hosts as HTTPS for redirect + cookie purposes, even if an upstream proxy presents `http` internally.
- This prevents cloud-dev auth completion from losing `Set-Cookie` on an accidental HTTP->HTTPS hop.

Bootstrap payload includes:

- User + account membership graph
- Default account (`defaults.accountId`)
- Signed account authz capsule (`authz.accountCapsule`, expiry metadata)
- Account entitlement snapshot (`authz.entitlements`) resolved once at bootstrap (`flags`, `caps`, `budgets{max,used}`)

Client behavior (`use-roma-me.ts`):

- Resolves account context from `defaults.accountId` only.
- Caches a single bootstrap payload in a process-global in-memory store with TTL aligned to the authz capsule expiry (`authz.expiresAt`, with min floor + fallback TTL).
- Does not store account preference in localStorage.
- Does not honor URL `accountId` overrides.
- Guards and re-initializes global store shape if corrupted.
- When bootstrap returns `coreui.errors.auth.required`, Roma redirects to `/login?next=...` for explicit sign-in.

Current cloud-dev product rule:

- Roma operates as a single-account shell there.
- Bootstrap still returns `accounts[]` + `defaults.accountId`, but the product uses only the default account.
- Settings does not expose account switching.

## Paris proxy model

Roma talks to Paris only through same-origin API routes:

- Paris-backed routes are explicit handlers under `roma/app/api/**` using `roma/lib/api/paris-proxy.ts` (no generic wildcard proxy).
- Non-Paris routes stay explicit as well (`/api/assets/*` -> Tokyo-worker, `/api/accounts/:accountId/members` -> Michael).

Client fetch behavior:

- Browser code calls same-origin Roma routes only.
- `fetchParisJson` in the browser is just a no-store fetch + timeout/reason wrapper.
- Server routes resolve the bearer from Roma’s httpOnly session cookies and forward upstream.
- Post-bootstrap account shell actions carry `x-ck-authz-capsule` on the active Roma path (`/api/roma/widgets`, `/api/roma/templates`, widget delete, plan-change, tier-drop dismiss, builder/account routes).

## Bob orchestration contract (Roma Builder)

`BuilderDomain` flow:

1. Resolve default account + target publicId.
2. Load instance payload from Roma same-origin (`/api/accounts/:accountId/instance/:publicId?subject=account`), which resolves the saved authoring revision from Tokyo directly.
3. Load compiled payload (`/api/widgets/:widgetname/compiled`).
4. Wait for Bob `bob:session-ready` (`boot=message`).
5. Send `ck:open-editor` with `requestId + sessionId` (no bearer handoff; Bob relies on shared cookies).
6. Require ack/applied lifecycle (`bob:open-editor-ack` → `bob:open-editor-applied` or `bob:open-editor-failed`).

Notes:

- Builder retries open while waiting for ack (bounded attempts + timeout).
- Bob URL-bootstrap (`boot=url`) still exists for explicit URL-mode surfaces, but Roma Builder uses message boot as canonical.
- Roma marks Bob iframe host intent with `surface=roma` to keep host-specific auth behavior explicit.
- In hosted account-editing flows, Bob sends save and account l10n mutation intents back to Roma over postMessage. Roma executes the named same-origin account routes and returns the result payload to Bob. This keeps Bob as editor kernel and Roma as the product command boundary.
- Account language policy/settings are owned by Roma Settings, not Bob. Roma serves `/api/accounts/:accountId/locales` as the same-origin route for that account-level surface.

## Widgets domain ownership

Roma `widgets` is the only product surface that owns per-instance live status changes:

- `Publish` / `Unpublish` happen in `/widgets`
- `Rename` happens in `/widgets`
- Bob does not expose published/unpublished state changes
- Bob does not persist instance rename inline
- Duplicate-from-widget and duplicate-from-template create account-owned instances through Roma same-origin routes that commit the canonical Tokyo-backed authoring state
- The old settings-level “unpublish all instances” product action is not part of the active product surface

## Data domains and caches (client-side)

- `useRomaWidgets`: account list cache + in-flight dedupe.
- `useRomaTemplates`: template list cache + in-flight dedupe.
- `account-instance-cache`: per `(accountId, publicId)` cache for builder opens.
- `compiled-widget-cache`: per widget compiled payload cache.
- Widgets/Templates prefetch compiled + likely instances to reduce open latency.

Usage, billing, and AI domain behavior:

- `UsageDomain` is bootstrap-driven today. It does not expose live metering in current environments; detailed counters render as "not configured".
- `BillingDomain` is a placeholder surface today; billing is not configured in current environments.
- `UsageDomain` and `AiDomain` read profile/role/entitlements from bootstrap authz context (no extra policy/entitlements fetches).

Assets domain behavior:

- `AssetsDomain` reads account inventory from `/api/assets/:accountId` and performs per-asset delete via `/api/assets/:accountId/:assetId`.
- Roma exposes account-level asset routes (`/api/assets/:accountId`, `/api/assets/:accountId/:assetId`, `/api/assets/upload`) and forwards them directly to Tokyo-worker with the user session bearer.
- Assets supports single upload, bulk upload (multi-file queue), list, and per-asset delete only.
- Account is the ownership boundary.

## Local vs cloud-dev

### Cloud-dev

- Roma runtime target: `https://roma.dev.clickeen.com` (Pages `*.pages.dev` deploys are not supported for authenticated Builder because cookies cannot be shared to Bob).
- Uses cloud-dev Paris/Tokyo/Bob URLs from env/config.
- Cloud product auth currently supports both Google and email/password through Berlin-owned session endpoints.
- Cloud-dev currently runs as one effective product account: admin. Roma does not expose account switching there.

## Operational notes

- Canonical startup script is `bash scripts/dev-up.sh`.
- Roma is **cloud-only** for supported product behavior. Local is for building blocks only (Bob/Paris/Berlin/Tokyo/Venice/DevStudio).
- If services appear down after a successful start, verify the parent shell/session that launched `dev-up` is still alive.
