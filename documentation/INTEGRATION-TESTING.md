# Integration Testing Playbook (Phase-1)

STATUS: INFORMATIVE — GUIDED WORKFLOW  
Use this checklist to exercise end-to-end flows across Bob ↔ Paris ↔ Venice ↔ Michael. Run locally before major changes or releases.

## Prerequisites
- `pnpm install` at repo root
- Local Paris server running with service-role env (`pnpm --filter paris dev`)
- Local Venice dev server (`pnpm --filter venice dev`) pointing at local Paris (`PARIS_URL=http://localhost:3001`)
- Local Bob dev server (`pnpm --filter bob dev`) with `NEXT_PUBLIC_PARIS_URL` / `NEXT_PUBLIC_VENICE_URL` set to the local origins
- Supabase local instance (`supabase start`) seeded with Phase-1 schema from `documentation/dbschemacontext.md`

## Scenario 1 — Draft → Edit → Claim → Publish
1. **Create draft from Prague flow** (optional): call `POST /api/instance/from-template` via Postman or Bob “Create” action; capture `publicId` + `draftToken`.
2. **Preview in Bob**: open `/bob?instance=<publicId>`; ensure iframe loads with `?ts` and honors theme/device toggles.
3. **Edit instance**: update config from Bob; verify `PUT /api/instance/:publicId` returns 200 and Venice reflects changes after reload.
4. **Claim draft**: call `POST /api/claim` with `draftToken`; confirm:
   - Response status 200
   - Draft token removed from subsequent GET (401/410 on reuse)
   - Venice renders without Authorization header (published status)
5. **Publish enforcement**: attempt to publish second widget on free plan; expect `403 PLAN_LIMIT`.

## Scenario 1b — Template switch dry‑run → confirm
1. **Dry‑run preview**: `PUT /api/instance/:publicId?dryRun=true` with `{ templateId: "new-template", config: { ... } }`.
   - Expect 200 with `{ action: "template-switch-preview", target, diff: { dropped, added }, proposedConfig }`.
2. **Confirm apply**: resend with `?confirm=true` (or body `{"confirm":true}`) and same payload.
   - Expect 200 with updated instance payload. Unknown fields removed; defaults applied.
3. **Missing confirm**: send `templateId` without confirm flag.
   - Expect `409 CONFIRM_REQUIRED` with `diff` and no persisted change.
4. **Invalid config**: force schema violation.
   - Expect `422` with `[ { path, message } ]`.

## Scenario 2 — Token lifecycle & embed auth
1. **Issue embed token**: `POST /api/token` `{ action: "issue" }`; record token.
2. **Render Venice with token**: request `GET /e/:publicId` with `Authorization: Bearer <token>`; expect 200.
3. **Revoke token**: `POST /api/token` `{ action: "revoke" }`; subsequent Venice request should return `401 TOKEN_INVALID`.
4. **Log verification**: ensure Berlin logs capture token issuance/revocation (app only) and Venice records `token_invalid` event.

## Scenario 3 — Submission + Usage pipeline
1. **Simulate form submit**: POST to `http://localhost:3002/api/submit/:publicId` through Venice or directly to Paris (`/api/submit/:publicId`) with payload ≤32 KB and a unique `idempotencyKey` header/body value. Repeat the call with the same `idempotencyKey` to confirm the duplicate returns **202 { recorded:false }**.
2. **Check DB**: confirm row in `widget_submissions` with `widget_instance_id = publicId` and metadata captured.
3. **Rate limits**: send >60 submissions/min/IP to confirm `429 RATE_LIMITED` and fallback UI.
4. **Usage event**: call `POST /api/usage` with unique `idempotencyKey`; repeat to verify `{ recorded: false }` response on duplicate.
5. **Rate limits**: drive beyond per‑IP/instance limits; expect 429 with headers `X-RateLimit-Limit|Remaining|Reset`, `Retry-After`, and `X-RateLimit-Backend` set to `sql` (or `redis` if configured).

## Scenario 4 — Atlas fallback
1. **Disable Edge Config temporarily**: point `PARIS_URL` to local Paris but omit `ATLAS_EDGE_CONFIG` or mock failure.
2. **Venice request**: ensure SSR still succeeds by falling back to Paris; logs should emit `atlas_unavailable` warning.
3. **Restore**: re-enable Atlas config and check Venice caches data again.

## Acceptance Criteria
- All scenarios above succeed with expected status codes and UI states.
- No console errors in Bob or Venice during flows.
- Logs include `X-Request-ID` correlation across Bob → Venice → Paris.
- Bundle budgets checked via Venice release checklist before shipping.

## Scenario 5 — CORS allowlist
1. **Allowed origin**: set `Origin` to allowlisted value; verify normal responses and `Access-Control-Allow-Origin` echoes origin.
2. **Blocked origin**: set `Origin` to non‑allowlisted; expect `403 FORBIDDEN`.
3. **Preflight**: send OPTIONS with allowlisted origin; expect 204 and correct `Access-Control-Allow-*` headers.

## Scenario 6 — Venice caching (validators)
1. First GET `/e/:publicId` → expect 200 with `ETag` and `Last-Modified`.
2. Repeat with `If-None-Match` set to returned ETag → expect 304.
3. Repeat with `If-Modified-Since` set to `Last-Modified` when unchanged → expect 304.

## Scenario 7 — Redis degradation (optional)
1. Configure `RATE_LIMIT_REDIS_URL`, hit endpoints to observe `X-RateLimit-Backend: redis`.
2. Break Redis connectivity; expect automatic fallback to SQL and `X-RateLimit-Backend: sql`.
3. Restore Redis; expect transparent recovery.

## Scenario 8 — SSR budget check (report‑only)
1. Run `pnpm --filter venice run check:budgets` and record gzipped bytes vs 10KB threshold.
2. For local strictness, run with `-- --strict` to ensure non‑zero exit on failure (not used in CI).

> If any step behaves unexpectedly, stop and update documentation or specs before coding fixes. Documentation is the single source of truth.
