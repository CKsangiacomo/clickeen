# Roma — Product Shell (Workspace App)

STATUS: REFERENCE — MUST MATCH RUNTIME  
Runtime code + deploy config are truth. If this doc drifts from `roma/*` behavior, update it immediately.

## Purpose

Roma is the authenticated product shell for workspace users. It owns:
- Domain navigation (`/home`, `/widgets`, `/templates`, `/builder`, etc.)
- Active workspace context resolution
- Lightweight catalog/list APIs for product UX
- Bob editor orchestration via explicit message boot

Roma is a host/orchestrator. Bob remains the editor kernel.

## Runtime surface (current repo snapshot)

### App routes
- `/` → redirects to `/home`
- `/:domain` (`home|widgets|templates|assets|team|billing|usage|ai|settings`) via `roma/app/[domain]/page.tsx`
- `/builder` and `/builder/:publicId`
- `/widgets/:publicId` (detail placeholder)
- `/assets/:assetId` (detail placeholder)

### URL path isolation (Builder)
- Selected instance is path-driven: `/builder/:publicId`.
- Query `publicId` is a fallback input only.
- No auto-pick/random-first-instance behavior exists.
- Roma keeps URL and selected instance synchronized (`router.replace`) so state is deep-linkable.

## Auth + account/workspace bootstrap

Roma bootstraps from:
- `GET /api/bootstrap` (canonical)

`/api/bootstrap` proxies to Paris `GET /api/roma/bootstrap` with the user bearer token.
When no valid session is present, it returns `401` with auth error payload (`coreui.errors.auth.required`).
Roma does not auto-bootstrap local auth sessions; local and Cloudflare require real Supabase session tokens.
Roma also exposes `GET /api/session/access-token` for Builder->Bob auth handoff; it resolves the current bearer server-side and forwards refreshed auth cookies when rotation occurs.
Roma exposes explicit session endpoints for product auth UX:
- `POST /api/session/login` (email/password -> Supabase password grant -> httpOnly session cookies)
- `POST /api/session/logout` (clears Supabase session cookies)

Bootstrap payload includes:
- User/accounts/workspaces graph
- Active defaults (`defaults.accountId`, `defaults.workspaceId`)
- Signed workspace authz capsule (`authz.workspaceCapsule`, expiry metadata)
- Signed account authz capsule (`authz.accountCapsule`, expiry metadata)
- Account entitlement snapshot (`authz.entitlements`) resolved once at bootstrap (`flags`, `caps`, `budgets{max,used}`)

Client behavior (`use-roma-me.ts`):
- Resolves requested workspace from URL `workspaceId` first, then localStorage fallback.
- Caches bootstrap per workspace with TTL aligned to the earliest authz capsule expiry (workspace/account; min floor + fallback TTL).
- Persists successful bootstrap cache in sessionStorage for reload speed.
- Guards and re-initializes global store shape if corrupted.
- Pushes both capsules into shared transport state (`paris-http`) so subsequent calls avoid repeated identity/membership lookups.
- When bootstrap returns `coreui.errors.auth.required`, Roma redirects to `/login?next=...` for explicit sign-in.

## Paris proxy model

Roma talks to Paris only through same-origin API routes:
- `roma/app/api/paris/[...path]/route.ts` (generic proxy)
- `roma/app/api/paris/instance/[publicId]/route.ts` (workspace instance read/write shortcut)

Roma injects both authz headers for Paris calls through `fetchParisJson` (`roma/components/paris-http.ts`):
- `x-ck-authz-capsule` (workspace)
- `x-ck-account-capsule` (account)
- Reads capsules from memory/session storage.
- Hydrates capsules from `/api/bootstrap` when missing.
- Retries once with forced capsule refresh on auth failures (`401/403` family).

## Bob orchestration contract (Roma Builder)

`BuilderDomain` flow:
1. Resolve active workspace + target publicId.
2. Resolve Bob handoff bearer (`/api/session/access-token`).
3. Load instance payload (`/api/paris/instance/:publicId?workspaceId=...`).
4. Load compiled payload (`/api/widgets/:widgetType/compiled`).
5. Wait for Bob `bob:session-ready` (`boot=message`).
6. Send `ck:open-editor` with `requestId + sessionId + sessionAccessToken`.
7. Require ack/applied lifecycle (`bob:open-editor-ack` → `bob:open-editor-applied` or `bob:open-editor-failed`).

Notes:
- Builder retries open while waiting for ack (bounded attempts + timeout).
- Bob URL-bootstrap (`boot=url`) still exists for explicit URL-mode surfaces, but Roma Builder uses message boot as canonical.
- Roma marks Bob iframe host intent with `surface=roma` to keep host-specific auth behavior explicit.

## Data domains and caches (client-side)

- `useRomaWidgets`: workspace list cache + in-flight dedupe.
- `useRomaTemplates`: template list cache + in-flight dedupe.
- `workspace-instance-cache`: per `(workspaceId, publicId)` cache for builder opens.
- `compiled-widget-cache`: per widget compiled payload cache.
- Widgets/Templates prefetch compiled + likely instances to reduce open latency.

Usage and AI domain behavior:
- `UsageDomain` still reads live usage from account usage endpoint.
- `UsageDomain` and `AiDomain` read profile/role/entitlements from bootstrap authz context (no extra workspace policy/entitlements fetches).

Assets domain behavior:
- `AssetsDomain` reads account inventory + integrity from bootstrap (`GET /api/bootstrap` -> `domains.assets`), and performs per-asset operations through account-canonical Roma routes (`/api/assets/:accountId/:assetId`).
- Roma also exposes account-level asset routes (`/api/assets/:accountId` and `/api/assets/upload`) that delegate to Bob server routes.
- Delete is Roma-surface managed (`x-clickeen-surface=roma-assets`) and hard-deletes via Paris -> Tokyo-worker.
- Workspace context is display/projection only; account is the ownership boundary.

## Local vs cloud-dev

### Local
- Roma runs at `http://localhost:3004` via `bash scripts/dev-up.sh`.
- Canonical entry: `http://localhost:3004/home`.
- Uses local Paris through `PARIS_BASE_URL=http://localhost:3001`.
- `dev-up` exports `ENV_STAGE=local` for Bob/Roma so local-only bypass logic stays stage-gated.
- `dev-up` points Paris/Workers to local Supabase by default; remote Supabase is opt-in (`DEV_UP_USE_REMOTE_SUPABASE=1`).
- `dev-up` seeds deterministic local auth personas (non-destructive) for parity testing:
  - `local.free@clickeen.local` -> `ck-demo` (`free`, `owner`)
  - `local.paid@clickeen.local` -> `ck-dev` (`tier3`, `owner`)
  - `local.admin@clickeen.local` -> `ck-dev` (`tier3`, `admin`)
  Admin identity env vars:
  - `CK_ADMIN_EMAIL`
  - `CK_ADMIN_PASSWORD`
  `CK_ADMIN_PASSWORD` is required for local persona seeding and local DevStudio auth bootstrap.

### Cloud-dev
- Roma runtime target: `https://roma.dev.clickeen.com` (or deployment-specific Pages domain).
- Uses cloud-dev Paris/Tokyo/Bob URLs from env/config.

## Local smoke baseline (2026-02-17)

Validated flow in local stack:
1. `POST /api/assets/upload` (Bob proxy -> Tokyo-worker)
2. `GET /api/bootstrap` (Roma bootstrap; `domains.assets` carries account asset list + integrity snapshot)
3. `DELETE /api/assets/:accountId/:assetId` (Roma proxy -> Bob -> Paris -> Tokyo-worker)
4. `GET /api/bootstrap` confirms hard-delete removal

Observed timings (single machine, warm services):
- Paris `GET /api/me?workspaceId=...`: `~12ms`
- Bob upload proxy: `~55ms`
- Roma account assets list: `~48-89ms` over 5 consecutive calls
- Roma account asset delete: `~49ms`
- Roma list after delete: `~48ms`

Validation result:
- Uploaded asset present before delete (`count=1`) and absent after delete (`count=0`).

## Operational notes

- Canonical startup script is `bash scripts/dev-up.sh`.
- `dev-up` starts Roma with the rest of the local stack and relies on process/port health checks only.
- If services appear down after a successful start, verify the parent shell/session that launched `dev-up` is still alive.
