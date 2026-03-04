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
- `/widgets/:publicId` (detail placeholder)
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

Bootstrap payload includes:
- User + account membership graph
- Active defaults (`defaults.accountId`)
- Signed account authz capsule (`authz.accountCapsule`, expiry metadata)
- Account entitlement snapshot (`authz.entitlements`) resolved once at bootstrap (`flags`, `caps`, `budgets{max,used}`)

Client behavior (`use-roma-me.ts`):
- Resolves requested account from URL `accountId` first, then localStorage fallback.
- Caches bootstrap per account with TTL aligned to the authz capsule expiry (`authz.expiresAt`, with min floor + fallback TTL).
- Persists successful bootstrap cache in sessionStorage for reload speed.
- Guards and re-initializes global store shape if corrupted.
- Pushes the account capsule into shared transport state (`paris-http`) so subsequent calls avoid repeated identity/membership lookups.
- When bootstrap returns `coreui.errors.auth.required`, Roma redirects to `/login?next=...` for explicit sign-in.

## Paris proxy model

Roma talks to Paris only through same-origin API routes:
- `roma/app/api/paris/[...path]/route.ts` (generic proxy)

Roma injects the authz capsule for Paris calls through `fetchParisJson` (`roma/components/paris-http.ts`):
- Header: `x-ck-authz-capsule` (account authz capsule)
- Reads capsule from memory/session storage.
- Hydrates capsule from `/api/bootstrap` when missing.
- Retries once with forced capsule refresh on auth failures (`401/403` family).

## Bob orchestration contract (Roma Builder)

`BuilderDomain` flow:
1. Resolve active account + target publicId.
2. Load instance payload (`/api/paris/accounts/:accountId/instance/:publicId?subject=account`).
3. Load compiled payload (`/api/widgets/:widgetType/compiled`).
4. Wait for Bob `bob:session-ready` (`boot=message`).
5. Send `ck:open-editor` with `requestId + sessionId` (no bearer handoff; Bob relies on shared cookies).
6. Require ack/applied lifecycle (`bob:open-editor-ack` → `bob:open-editor-applied` or `bob:open-editor-failed`).

Notes:
- Builder retries open while waiting for ack (bounded attempts + timeout).
- Bob URL-bootstrap (`boot=url`) still exists for explicit URL-mode surfaces, but Roma Builder uses message boot as canonical.
- Roma marks Bob iframe host intent with `surface=roma` to keep host-specific auth behavior explicit.

## Data domains and caches (client-side)

- `useRomaWidgets`: account list cache + in-flight dedupe.
- `useRomaTemplates`: template list cache + in-flight dedupe.
- `account-instance-cache`: per `(accountId, publicId)` cache for builder opens.
- `compiled-widget-cache`: per widget compiled payload cache.
- Widgets/Templates prefetch compiled + likely instances to reduce open latency.

Usage and AI domain behavior:
- `UsageDomain` still reads live usage from account usage endpoint.
- `UsageDomain` and `AiDomain` read profile/role/entitlements from bootstrap authz context (no extra policy/entitlements fetches).

Assets domain behavior:
- `AssetsDomain` reads account inventory + integrity from bootstrap (`GET /api/bootstrap` -> `domains.assets`), and performs per-asset operations through account-canonical Roma routes (`/api/assets/:accountId/:assetId`).
- Roma also exposes account-level asset routes (`/api/assets/:accountId` and `/api/assets/upload`), and proxies writes to Tokyo/Paris with the user session bearer.
- Delete is Roma-surface managed (`x-clickeen-surface=roma-assets`) and hard-deletes via Paris -> Tokyo-worker.
- Account is the ownership boundary.

## Local vs cloud-dev

### Cloud-dev
- Roma runtime target: `https://roma.dev.clickeen.com` (Pages `*.pages.dev` deploys are not supported for authenticated Builder because cookies cannot be shared to Bob).
- Uses cloud-dev Paris/Tokyo/Bob URLs from env/config.

## Operational notes

- Canonical startup script is `bash scripts/dev-up.sh`.
- Roma is **cloud-only** for supported product behavior. Local is for building blocks only (Bob/Paris/Berlin/Tokyo/Venice/DevStudio).
- If services appear down after a successful start, verify the parent shell/session that launched `dev-up` is still alive.
