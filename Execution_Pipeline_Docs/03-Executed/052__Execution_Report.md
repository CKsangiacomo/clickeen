# 052 Execution Report - Berlin Auth Boundary (V1)

Date: 2026-02-27  
Owner: Product Dev Team  
Status: EXECUTED IN CODE (local green, cloud-dev parity green with explicit bearer fallback)

## Environment scope

- Local environment:
  - Berlin auth boundary implementation executed and validated end-to-end.
  - Canonical startup used: `bash scripts/dev-up.sh --reset`.
  - Blocking gates passed.
- Cloud-dev environment:
  - Public and auth parity checks passed.
  - Auth parity requires explicit bearer injection because Roma cloud-dev login route currently returns `roma.errors.auth.config_missing` on `roma-dev.pages.dev`.
  - Cloud deployment for this project is git-driven; no direct terminal deploy is required for execution signoff.

## Implemented slices

1. Slice A - Berlin foundation
   - Added `berlin/` Cloudflare Worker service.
   - Implemented:
     - `POST /auth/login/password`
     - `POST /auth/login/provider/start`
     - `GET /auth/login/provider/callback`
     - `POST /auth/refresh`
     - `POST /auth/logout`
     - `GET /auth/session` and `GET /auth/validate`
     - `POST /auth/link/start`
     - `GET /auth/link/callback`
     - `POST /auth/unlink`
     - `GET /.well-known/jwks.json`
     - `GET /internal/healthz`
   - Added KV-backed session state (`BERLIN_SESSION_KV`) with in-memory fallback.
   - Added refresh rotation/reuse revocation semantics by `sid`.
   - Added revocation by `userId` (`/auth/logout` with user scope).
   - Added signed OAuth state handling for login/link flows.
   - Added JWKS current+previous key publish support.

2. Slice B - Paris auth cutover
   - Paris now verifies Berlin-issued JWTs via JWKS.
   - Paris no longer requires Supabase `/auth/v1/user` validation in request auth path.
   - AuthZ/membership/policy behavior remains in Paris.

3. Slice C - Roma/Bob session cutover
   - Roma session routes migrated to Berlin-backed flow:
     - `POST /api/session/login`
     - `GET /api/session/access-token`
     - `POST /api/session/logout`
   - Roma/Bob session resolvers now refresh via Berlin `POST /auth/refresh`.
   - Roma->Bob handoff contract kept: Roma returns `sessionAccessToken` for Bob message boot.
   - Bob remains cookie-agnostic for iframe auth handoff and uses bearer handoff path.

4. Slice D - linking/conflict rules
   - Implemented explicit provider link/unlink flow.
   - No implicit account merge by email.
   - Deterministic conflict signaling via reason-keyed responses.

## Local gate evidence (PASS)

Command:
- `bash scripts/dev-up.sh --reset && pnpm test:bootstrap-parity && pnpm test:runtime-parity:public && pnpm test:runtime-parity:auth && pnpm test:paris-boundary && pnpm test:bob-bootstrap-boundary && pnpm lint && pnpm typecheck`

Result:
- `test:bootstrap-parity` -> PASS
- `test:runtime-parity:public` -> PASS
- `test:runtime-parity:auth` -> PASS
- `test:paris-boundary` -> PASS
- `test:bob-bootstrap-boundary` -> PASS
- `lint` -> PASS (existing non-blocking warnings remain in Bob)
- `typecheck` -> PASS

Additional local smoke validation (PASS):
- Roma login -> access-token -> Berlin session -> logout -> refresh-after-logout revocation behavior all validated.
- Provider start endpoint is fail-visible in local when provider is not enabled upstream (`reasonKey: coreui.errors.auth.provider.notEnabled`).

## Cloud-dev gate evidence

### Public + bootstrap (PASS)

Commands:
- `pnpm test:bootstrap-parity:cloud-dev`
- `pnpm test:runtime-parity:cloud-dev:public`

Result:
- Both PASS.

### Auth parity with probe mint (BLOCKED on current cloud-dev Roma config)

Command:
- `pnpm test:runtime-parity:cloud-dev:auth`

Initial result:
- FAIL (`roma-dev.pages.dev /api/session/login` returned `503` with `roma.errors.auth.config_missing`).

### Auth parity with explicit cloud bearer fallback (PASS)

Command pattern used:
- Mint bearer from shared cloud-dev Supabase auth.
- Run auth parity with:
  - `RUNTIME_PARITY_AUTH_BEARER_CLOUD=<token> pnpm test:runtime-parity:cloud-dev:auth`

Result:
- PASS.

### Cross-env parity (PASS with explicit cloud bearer)

Command:
- `bash scripts/dev-up.sh --reset && RUNTIME_PARITY_AUTH_BEARER_CLOUD=<token> pnpm test:runtime-parity:cross-env`

Artifacts:
- `artifacts/runtime-parity-local-auth.json`
  - `startedAt`: `2026-02-27T21:26:21.136Z`
  - `finishedAt`: `2026-02-27T21:26:25.465Z`
  - `passed`: `true`
- `artifacts/runtime-parity-cloud-vs-local-auth.json`
  - `startedAt`: `2026-02-27T21:26:25.548Z`
  - `finishedAt`: `2026-02-27T21:26:38.047Z`
  - `passed`: `true`
- `artifacts/runtime-parity-local-public.json`
  - `startedAt`: `2026-02-27T21:26:38.142Z`
  - `finishedAt`: `2026-02-27T21:26:38.465Z`
  - `passed`: `true`
- `artifacts/runtime-parity-cloud-vs-local-public.json`
  - `startedAt`: `2026-02-27T21:26:38.551Z`
  - `finishedAt`: `2026-02-27T21:26:39.183Z`
  - `passed`: `true`

## Cloud-dev deployment note

1. Clickeen cloud-dev deployments are git-driven (canonical path), not direct `wrangler deploy` from local terminal.
2. Existing cloud-dev runtime (`roma-dev.pages.dev`) still shows `roma.errors.auth.config_missing` on `/api/session/login`, which indicates deployed env/runtime has not yet picked up the Berlin auth route wiring from current code.
3. This does not block local execution completion; it is a deployment-state follow-up for the git pipeline.

## Completion decision

1. PRD 052 architecture implementation is complete in code and fully validated in local.
2. Local blocking runtime gates are green.
3. Cloud-dev runtime parity is green when supplied explicit bearer; cloud login mint path on `roma-dev.pages.dev` remains in pre-cutover deployment state.
4. PRD is execution-complete from code perspective and ready for peer review, with git-driven cloud rollout follow-up.
