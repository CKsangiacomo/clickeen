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
- `GET /api/me` (compat alias to same upstream bootstrap flow)

Both proxy to Paris `GET /api/roma/bootstrap` with the user bearer token.
When no valid session is present, both return `401` with auth error payload (`coreui.errors.auth.required`).

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
2. Load instance payload (`/api/paris/instance/:publicId?workspaceId=...`).
3. Load compiled payload (`/api/widgets/:widgetType/compiled`).
4. Wait for Bob `bob:session-ready` (`boot=message`).
5. Send `ck:open-editor` with `requestId + sessionId`.
6. Require ack/applied lifecycle (`bob:open-editor-ack` → `bob:open-editor-applied` or `bob:open-editor-failed`).

Notes:
- Builder retries open while waiting for ack (bounded attempts + timeout).
- Bob URL-bootstrap (`boot=url`) still exists for explicit URL-mode surfaces, but Roma Builder uses message boot as canonical.

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
- `AssetsDomain` reads/deletes through account-canonical endpoints (`/api/paris/accounts/:accountId/assets`).
- Workspace context is display/projection only; account is the ownership boundary.

## Local vs cloud-dev

### Local
- Roma runs at `http://localhost:3004` via `bash scripts/dev-up.sh`.
- Canonical entry: `http://localhost:3004/home`.
- Uses local Paris through `PARIS_BASE_URL=http://localhost:3001`.
- `dev-up` points Paris/Workers to local Supabase by default; remote Supabase is opt-in (`DEV_UP_USE_REMOTE_SUPABASE=1`).

### Cloud-dev
- Roma runtime target: `https://roma.dev.clickeen.com` (or deployment-specific Pages domain).
- Uses cloud-dev Paris/Tokyo/Bob URLs from env/config.

## Local smoke baseline (2026-02-17)

Validated flow in local stack:
1. `POST /api/assets/upload` (Bob proxy -> Tokyo-worker)
2. `GET /api/paris/accounts/:accountId/assets` (Roma proxy, repeated)
3. `DELETE /api/paris/accounts/:accountId/assets/:assetId` (Roma proxy)
4. Re-list confirms soft-delete exclusion

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
- `dev-up` starts Roma with the rest of the stack and writes process state into `.dev-up.state/`.
- If services appear down after a successful start, verify the parent shell/session that launched `dev-up` is still alive.
