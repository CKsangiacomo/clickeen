# PRD 057 — Paris Dumb-Pipe Restoration: Direct Supabase Access and RLS Activation

Status: EXECUTING (v4 — product-flow hard lock, execution simplified)
Date: 2026-03-05
Owner: Product Dev Team
Priority: P0 (architectural debt — blocks scalability and simplicity goals)

Execution start: 2026-03-05

Execution log (2026-03-05, initial slice):
- Cloud-dev probe result: Berlin password login succeeded (`200`), but Supabase PostgREST with Berlin JWT returned `401` on `account_members` reads.
- Berlin claim-contract delta implemented in code: access tokens now include `role: "authenticated"` on both session issue and refresh paths. Deployment + cloud-dev retest still required.
- Roma migration slice implemented in local code: new direct boundary `roma/lib/michael.ts`, new route `GET /api/accounts/:accountId/members`, and Team UI moved from `/api/paris/accounts/:accountId/members` to the new direct route.
- Cloud-dev probe detail after deploy: PostgREST error was `PGRST301` ("No suitable key or wrong key type"), confirming JWT trust/key mismatch rather than application logic.
- Execution unblock applied: Berlin now exposes `GET /auth/michael/token` (session-validated broker for Supabase access token), and Roma `michael.ts` consumes this token for direct PostgREST reads (still no Paris hop).
- RLS repair migration applied to cloud-dev Supabase: `20260305193000__rls_flat_reads_repair.sql` (fixes recursive `account_members` policy and grants authenticated read privileges for Category A tables).
- Cloud-dev revalidation after migration: brokered direct reads now succeed (`account_members`, `accounts`, `widget_instances` = `200`), and non-member account query returns empty set (`[]`) as expected.
- Bob migration slice implemented in local code: new `bob/lib/michael.ts`, new `GET /api/accounts/:accountId/locales`, and `LocalizationControls` locales **read** path moved from `/api/paris/accounts/:accountId/locales` to `/api/accounts/:accountId/locales` (PUT write path remains Paris-owned).
- Paris hard-cut applied in local code: external `GET/POST /api/accounts/:accountId/instances` route removed from Paris router; instance creation remains server-owned through Roma domain orchestration (`/api/roma/widgets/duplicate` -> Paris internal create handler).
- Hosted Builder command-boundary slice implemented in local code: Roma Builder now owns Bob account mutations on the product surface. In `surface=roma` account flows, Bob sends save/publish/live-toggle and account l10n mutation intents back to Roma over postMessage; Roma executes named same-origin account routes (`/api/accounts/...`) and returns the payload to Bob. Bob same-origin mutation routes remain for local DevStudio / URL-bootstrap surfaces only.

> Core mandate: Paris is "one boring thing" — validate auth, commit DB write, enqueue mirror jobs. Everything else that Paris does today is architectural debt that must be unwound.

> Review correction (v4): architecture is locked to product flow, not theory. Roma owns widget/instance command orchestration. Bob is editor UX only. Direct Supabase is for flat reads only; composed reads and writes stay server-side through Roma -> Paris orchestration.

Context note:
- PRD 054 established the snapshot-first rendering pipeline and DB touch budgets.
- PRD 055 evicted non-relational data from Supabase to R2/KV.
- PRD 056 converged Berlin as the sole auth gatekeeper.
- PRD 057 completes the arc: now that auth is clean and storage boundaries are correct, Paris can be reduced to its documented role.

Environment contract:
- Canonical integration truth: cloud-dev (Cloudflare + shared remote Supabase "Michael").
- Local is for iteration only.
- Canonical local startup: `bash scripts/dev-up.sh`.

---

## Non-Negotiable Tenets (Product + Execution)

1. **Design follows real product flow, not theoretical purity.**
   - Architecture maps to actual user journey: Berlin entry -> Roma context -> Bob editing -> Roma/Paris publish orchestration.

2. **Publish/unpublish is Roma-owned, never Bob-owned.**
   - Roma widget/instance domain owns mutation command routing and user intent orchestration.
   - Bob is editor UX; it does not decide draft-vs-publish paths and does not call publish endpoints directly.

3. **Entitlements load once and are reused.**
   - Entitlements/policy are resolved at session/bootstrap and reused in runtime for fast UX gating.
   - No DB round-trip on every editor click; one authoritative server check remains at commit/publish.

4. **Paris is dumb pipe by default.**
   - Paris handles composed reads, writes, and side effects.
   - Paris is not a default CRUD/read-through layer for flat reads.

5. **RLS is primary for flat direct reads.**
   - Flat single-table reads move to Roma/Bob via Supabase RLS.
   - Paris app-level authz for those flat reads is deleted.

6. **Berlin is editable if contract requires it.**
   - If claims/token compatibility needs change (`iss`, `aud`, `role`, key compatibility), Berlin changes are in scope.

7. **Hard-cut execution.**
   - Pre-GA with zero production users: no compatibility maze, no dual-write paths.

8. **Named boundaries only.**
   - `michael.ts` is the direct Supabase boundary.
   - `paris.ts` is the Paris orchestration boundary.
   - No scattered data calls across UI code.

---

## One-line Objective

Restore product-aligned service boundaries: Roma owns widget/instance commands, Bob stays editor UX-only, direct Supabase+RLS is used only for flat reads, and Paris is reduced to write/orchestration responsibilities.

---

## Diagnosis: What Paris Actually Is Today

### By the numbers

| Metric | Value |
|---|---|
| Total files | 49 |
| Total lines | 12,686 |
| Domain folders | 10 |
| Shared utility files | 21 |
| HTTP route handlers | ~75 |
| Upstream dependents | Roma (20 files), Bob (20+ files), Venice (3), Prague (2), SanFrancisco (4) |
| Downstream dependencies | Supabase (16 files via service_role), Tokyo-worker, SanFrancisco, Berlin, R2, KV |

### What Paris absorbed (beyond its documented role)

| Responsibility | Example | Documented owner |
|---|---|---|
| Identity resolution | `shared/auth.ts` (418 lines) verifies Berlin JWT, resolves principals | Berlin (already owns this) |
| Authorization | Every handler checks membership, role, account ownership in TypeScript | Supabase RLS (policies exist, unused) |
| Business rule computation | seoGeo entitlement check (6 copies), normalizeAccountTier (3 copies) | Widget contract files + `ck-policy` |
| Data access layer | 16 files use `SUPABASE_SERVICE_ROLE_KEY` for simple CRUD | Direct Supabase access via RLS |
| Job orchestration | Tokyo mirror jobs, SF commands, l10n pipeline dispatch | Correct — this should stay |
| State management | KV for rate limits, usage, budgets, handoff state | Correct — this should stay |

### Duplication evidence (verified via grep)

| Pattern | Copies | Files |
|---|---|---|
| `normalizeAccountTier()` | 3 | `shared/authz-capsule.ts`, `domains/identity/index.ts`, `domains/accounts/index.ts` |
| `seoGeoEntitled = policy.flags['embed.seoGeo.enabled'] === true` | 6 | create-handler, update-handler, account-handlers, layers-handlers (x2), accounts |
| `seoGeoConfigEnabled = Boolean((x.config as any)?.seoGeo?.enabled === true)` | 6 | Same files |
| Tokyo mirror enqueue ceremony | ~25 call sites | 7 files |

Execution update (2026-03-05, local):
- `normalizeAccountTier()` duplication removed. Canonical copy now only in `shared/authz-capsule.ts`.
- seoGeo decision logic centralized via `shared/seo-geo.ts` (`isSeoGeoEntitled`, `isSeoGeoConfigEnabled`, `isSeoGeoLive`) and reused across previously duplicated handlers.
- Legacy Paris `/api/accounts/:accountId/members` compatibility route stub removed from `paris/src/index.ts` (hard-cut; no fallback path).
- Roma catch-all Paris proxy removed: `roma/app/api/paris/[...path]/route.ts` deleted.
- Roma components rewired from `/api/paris/...` URLs to named explicit routes (`/api/accounts/...`, `/api/roma/...`, `/api/minibob/...`).
- Roma added thin named proxy routes backed by `roma/lib/api/paris-proxy.ts`; no wildcard proxy remains.
- Bob editor flow hard-cut off wildcard Paris proxy: `/api/paris/[...path]` removed, `/api/paris/instance/[publicId]` moved to `/api/instance/[publicId]`, and editor calls now use named Bob routes (`/api/accounts/.../instance/...`, `/api/accounts/.../instances/.../layers/user/...`, `/api/accounts/.../instances/.../l10n/*`).
- Bob removed remaining `/api/paris/*` namespace routes for curated/bootstrap and replaced them with named routes (`/api/roma/bootstrap`, `/api/roma/templates`); runtime parity scripts and DevStudio curated tool were rewired to the named paths.
- Bob route boilerplate trimmed: instance/assets proxies now use shared `proxyToParisRoute(...)` contracts (auth mode + forwarded headers) with duplicated route-level proxy logic removed.
- Paris dead endpoints removed: unused `/api/widgets`, `/api/personalization/onboarding*`, and `/api/submit/:publicId` route stubs deleted from router + domain handlers (hard-cut, no compatibility layer).
- Bob dead compatibility AI routes removed: `/api/ai/sdr-copilot` and `/api/ai/faq-copilot` deleted; `widget-copilot` is the single execution endpoint.
- Paris hard-cut continued: external `GET /api/accounts/:accountId` removed from router + handler export (no in-repo callers; direct/boundary reads are now named per-surface).
- Paris hard-cut continued: external `/api/accounts/:accountId/business-profile` route and `business-profile-handler.ts` removed (dead path, no in-repo callers).
- Roma asset hard-cut: `/api/assets/:accountId` and `/api/assets/:accountId/:assetId` no longer proxy to Paris; they now forward directly to Tokyo with Berlin session auth (list, delete, purge). `/api/bootstrap` remains the Paris orchestration path.
- Venice dead submission proxy removed: `POST /s/:publicId` route and `venice/lib/paris.ts` deleted after prior Paris `/api/submit/:publicId` hard-cut, removing a broken cross-service legacy path.
- Paris hard-cut continued: orphaned `POST /api/usage` route and `paris/src/domains/usage/index.ts` removed (no in-repo caller after Venice pixel simplification).
- Billing placeholder surface hard-cut: removed Roma `/api/accounts/:accountId/billing/*` proxy routes and Paris `/api/accounts/:accountId/billing/*` handlers; Billing UI now uses bootstrap context only and shows explicit not-configured state without backend round-trips.
- Usage diagnostics surface hard-cut: removed Roma `/api/accounts/:accountId/usage` proxy route and Paris `/api/accounts/:accountId/usage` handler; Usage UI now renders bootstrap/authz context only.
- Paris dead identity passthrough hard-cut: removed external `GET /api/me` route/handler; identity payload resolution remains internal to Roma bootstrap orchestration.
- Asset detail read hard-cut: removed single-asset `GET` path (`/api/accounts/:accountId/assets/:assetId`) from Paris and host proxies; canonical asset flow is now list (`GET /api/assets/:accountId`), upload, and delete only.
- SanFrancisco onboarding legacy persistence cut: removed dead call-path that attempted to write business-profile data to a removed Paris endpoint; onboarding job completion is now self-contained in SanFrancisco state without cross-service drift.
- Tokyo-worker dead metadata endpoint hard-cut: removed `GET /assets/account/:accountId/:assetId` handler and exports after Paris single-asset read removal; canonical asset reads are list (`/assets/account/:accountId`) and canonical-version blob fetch only.
- Bob asset-delete route hard-cut: removed `bob/app/api/assets/[accountId]/[assetId]/route.ts` so per-asset management remains Roma-owned; runtime parity cleanup now deletes Bob-uploaded assets through Roma host route.
- Paris auth fallback hard-cut: removed local trusted-internal synthetic identity fallback in `resolveIdentityMePayload`; bootstrap identity now requires a real Berlin-authenticated principal.
- Paris schema probe surface hard-cut: removed `/api/healthz/schema` route and schema-probe handler complexity; retained single boring health endpoint (`/api/healthz`).
- Paris account-auth simplification: removed unused `auth.source` payload from `authorizeAccount` success contract (callers only consume role/account), reducing internal coupling.
- Paris identity default-account simplification: removed `accountId` query override path from bootstrap identity selection; default account resolution now follows canonical membership/admin selection only.
- Bob asset read hard-cut: `bob/app/api/assets/[accountId]/route.ts` no longer proxies to Paris and now calls Tokyo directly with Berlin session auth.
- Paris asset passthrough hard-cut: removed `/api/accounts/:accountId/assets` and `/api/accounts/:accountId/assets/:assetId` handlers/routes; account asset CRUD is no longer exposed by Paris.
- Tokyo auth boundary simplification: account asset list/delete/purge endpoints now accept Berlin-authenticated principals with account membership checks (viewer/editor) instead of service-token-only access.
- Curated list hard-cut: removed Paris `GET /api/curated-instances` and the Bob `/api/curated-instances` proxy route; curated picker now uses Roma templates domain route (`/api/roma/templates?accountId=...`) as the single source.

### The root cause

Paris is the sole holder of `SUPABASE_SERVICE_ROLE_KEY`. Any operation that needs DB data gravitates to Paris because no other service can reach Supabase. This created a mandatory bottleneck: every button click in Roma or Bob round-trips through Paris for what is often a single DB read.

### What the documentation says Paris should be

**Tenet 2** (Tenets.md): "Orchestrators Are Dumb Pipes. Bob, Paris, Venice, and Michael are orchestrators. They move data between systems."

**Vision doc** (ClickeenVision.md): "Accounts Enforce Isolation: Multi-tenancy from core. Not app-level checks, database-level enforcement."

**Paris service PRD** (paris.md): "Paris does one boring thing: 1) Validate auth/ownership + payload shape, 2) Commit the minimal DB write, 3) Enqueue Tokyo mirror jobs when the instance is live."

Paris violates all three.

### Why the original PRD over-scoped Tier 1

Handler inspection revealed that many "read" handlers are not simple CRUD:

**`read-handlers.ts` — GET instance (editor load):**
Composes a multi-table envelope from `widget_instances` + `accounts` + `widgets` + merged locale/user overlay layers + computed editor policy + base fingerprint + L10n policy derivation. This is orchestration, not a flat SELECT.

**`update-handler.ts` — PUT instance (all saves):**
Even "draft saves" perform entitlement validation (`enforceLimits`), asset contract checks, URL persistability checks, and asset usage sync. On publish transitions: L10n job enqueuing, Tokyo mirror jobs (text/meta/config/live-surface packs), and unpublish cleanup. The draft/publish split is deeply server-side — not a status check a client can safely make.

**Conclusion:** Only flat single-table reads with no composition qualify for Tier 1. All writes and all composed reads stay in Paris.

---

## Before vs After (system behavior)

### Before (current — wrong)

1. Roma needs to list account members/locales/instance list → calls Paris for many flat reads that could be RLS-direct.
2. Bob editing interactions repeatedly depend on server checks instead of a loaded session entitlement context.
3. Mutation ownership is blurred (editor surface vs orchestration surface), increasing drift and routing complexity.
4. Every operation — read or write, simple or complex — tends to funnel through Paris.
5. RLS policies exist but are underused for safe flat reads.

### After (target — correct)

1. Roma reads flat account data directly from Supabase via RLS (members/locales/flat instance lists).
2. Session/bootstrap loads entitlements once; Bob reuses that context for local UX gating.
3. Bob editor commands route through Roma widget domain for all writes.
4. Roma routes orchestration writes to Paris (validation, DB commit, mirror/l10n side effects).
5. Paris handles composed reads and orchestration writes; it is no longer default data-access for flat reads.
6. RLS becomes active access control for Tier 1 flat reads.

---

## Target State Architecture

### Two execution categories

**Category A — Direct Supabase reads (Roma/Bob -> Michael via RLS)**

Strictly flat single-table reads where RLS already enforces access and the handler performs no composition, no policy resolution, and no side effects:

| Operation | Current Paris handler | Why it qualifies |
|---|---|---|
| List members | `GET /api/accounts/:accountId/members` | Flat scan of `account_members`. No composition. |
| Read locales | `GET /api/accounts/:accountId/locales` | Single field read from `accounts` table. Verify no policy derivation in handler. |
| Get account metadata (flat fields) | `GET /api/accounts/:accountId` | Single-row account read if response is not composed with additional policy/envelope data. |

Each candidate must be verified by handler inspection before migration. If the handler composes data from multiple sources or resolves policy, it stays in Paris.

Estimated scope: ~10-15 handlers (down from the original ~40-50 estimate).

**Category B — Roma/Paris orchestration (server-owned)**

All writes, all composed reads, all cross-service coordination:

| Operation | Why Paris is needed |
|---|---|
| **Get instance (editor load)** | **Composed envelope**: instances + accounts + widgets + merged locale/user overlays + policy + fingerprint + L10n policy. NOT simple CRUD. |
| **All instance writes (draft AND publish)** | **Server-side enforcement**: entitlement validation, asset contract checks, enforceLimits. Publish adds: L10n jobs, Tokyo mirror packs, unpublish cleanup. Bob never performs draft/publish routing. |
| Create instance | Idempotency check + potential mirror job on publish |
| Publish/unpublish instance | Roma widget domain command -> Paris DB write + Tokyo mirror jobs (text/config/meta packs + sync-live-surface) |
| L10n enqueue/pipeline | SanFrancisco dispatch + R2 writes + state tracking |
| Locale config change | DB write + l10n recompute trigger |
| Tier lifecycle / plan change | Multi-table write + unpublish excess + asset purge + mirror resync |
| Roma bootstrap | Aggregated multi-table payload (account + instances + members + entitlements) |
| Account creation handoff | DB write + membership + KV handoff state |
| AI grant issuance | Budget check + HMAC signing + rate limiting (KV) |
| MiniBob sessions | AI session orchestration |
| Personalization jobs | SanFrancisco dispatch + status tracking |

No change in this PRD for Tokyo-worker and SanFrancisco ownership boundaries.

### What Paris looks like at target

Paris retains orchestration + composed-read endpoints (~25-30).
Flat direct reads (~10-15 handlers) migrate to Roma/Bob via RLS.

Paris shrinks from 12,686 lines / 49 files to ~8,000-9,000 lines / ~35 files in Phase 1 of this PRD.
Further reduction happens in a future PRD if/when composed reads are decomposed (e.g., moving overlay merging to a Supabase function or splitting the envelope).

---

## Product Flow Contract (Hard Lock Before Implementation)

1. User authenticates through Berlin and lands in Roma.
2. Roma bootstrap resolves account context + entitlements once.
3. Bob receives that context and uses it for local UX gating.
4. Bob does not publish/unpublish and does not decide draft-vs-publish routing.
5. All Bob mutation intents go to Roma widget-domain server routes.
6. Roma executes simple server-owned logic and forwards orchestration-required mutations to Paris.
7. Paris commits writes and runs side effects (mirror/l10n/usage/handoff).

This contract is mandatory. Any implementation that bypasses it is non-compliant with PRD 057.

---

## Execution Sequence

### Phase 0 — Validate Berlin JWT → Supabase PostgREST (SPIKE)

Objective: answer one question fast — can Supabase PostgREST accept Berlin JWT for RLS-scoped REST access?

Implementation:
1. Configure Supabase to verify Berlin's JWKS endpoint (`berlin/.well-known/jwks.json`).
2. Issue one Berlin access token and run one member query against PostgREST.
3. Run one non-member query and confirm RLS deny behavior.
4. If failure occurs, patch Berlin claim contract (`iss` / `aud` / `role`) and retry immediately.

Files involved:
- `supabase/config.toml` — add third-party JWT verification config
- `berlin/src/index.ts` and/or `berlin/src/jwt-crypto.ts` — patch claim shape if required (`iss` / `aud` / `role`)
- `supabase/migrations/20260304090000__account_only_tenancy.sql` — reference RLS policies

Done gate:
- Member query succeeds with Berlin JWT.
- Non-member query is denied by RLS.
- If Berlin claim patch was needed, it is implemented and documented in this PRD.

### Phase 1 — Add Supabase client to Roma and Bob + lock command boundary

Objective: Roma and Bob can query Supabase directly using Berlin access token while keeping command ownership boundaries hard.

Implementation:
1. Add `@supabase/supabase-js` to Roma and Bob.
2. Create one named data-access module per app:
   - `roma/lib/michael.ts` — all direct Supabase queries live here. No other file imports `@supabase/supabase-js`.
   - `bob/src/lib/michael.ts` — same pattern.
3. Each module creates the Supabase client with Berlin access token in auth header.
4. The anon key + Berlin JWT + RLS = scoped access. No service_role key ever leaves Paris.
5. Create/standardize Roma widget-domain command routes for all instance mutations.
6. Hard rule: Bob mutation calls target Roma routes only. Bob does not call Paris directly for publish/unpublish or write-path selection.
7. Verify whether Roma bootstrap already provides the full entitlement snapshot Bob needs for local gating.
8. If entitlements are incomplete, add only missing snapshot fields in bootstrap/session contract (no extra per-click read path).

Minimal token behavior contract:
- Use `@supabase/supabase-js` standard auth handling.
- Berlin access token is external to Supabase Auth; refresh path is app-owned (not automatic Supabase session refresh).
- On 401 from direct read path: refresh Berlin session once, retry once, then force login on failure.
- No custom token framework and no fallback to Paris for flat reads.

Files involved:
- `roma/lib/michael.ts` (new — sole owner of all direct Supabase queries in Roma)
- `bob/src/lib/michael.ts` (new — sole owner of all direct Supabase queries in Bob)
- `roma/lib/paris.ts` (named Paris orchestration client)
- `bob/src/lib/paris.ts` (if needed; no publish/unpublish ownership in Bob)
- `roma/package.json`, `bob/package.json` — add `@supabase/supabase-js` dependency

Done gate:
- Roma can execute a flat query via `michael.ts` and get back only data for the authenticated user's accounts.
- Bob can do the same.
- 401 path refreshes/retries once and redirects to login on failure.
- No file outside `michael.ts` imports `@supabase/supabase-js` (enforced by lint rule or code review).
- Publish/unpublish requests originate from Roma widget-domain routes, not Bob direct orchestration.
- Entitlement snapshot verification outcome is explicit: `already compliant` or `delta implemented`.
- Bob local gating uses bootstrap/session entitlements (no per-click entitlement DB probe path).

### Phase 2 — Migrate verified Tier 1 flat reads from Paris to direct Supabase

Objective: Flat single-table reads go directly to Supabase from Roma/Bob.

**Pre-migration audit** (required per endpoint before any code change):
For each candidate Tier 1 handler, inspect the Paris handler source and confirm:
- [ ] Handler queries exactly one table.
- [ ] Handler performs no policy resolution, overlay merging, or entitlement computation.
- [ ] Handler returns the query result without composition from other sources.
- [ ] RLS policy for the table covers the required access pattern (member read, role-scoped write).

If any check fails, the endpoint stays in Paris. No exceptions.

Migrate in order (verified flat reads only):
1. `GET /api/accounts/:accountId/members` → Roma queries `account_members` via `michael.ts`.
2. `GET /api/accounts/:accountId/locales` → Roma queries `accounts` via `michael.ts` (flat fields only).
3. `GET /api/accounts/:accountId` → Roma queries `accounts` via `michael.ts` (only if response is flat, no composition).
4. Additional flat reads identified during audit.

**Minimal verification per endpoint** (no framework-heavy harness):
1. Add one contract test that validates required response keys/types for the migrated read.
2. Add one deny test that confirms non-member is blocked by RLS.
3. Validate against existing UI usage before deleting handler.

For each migrated endpoint:
1. Add direct Supabase call in `michael.ts` (Roma or Bob).
2. Add minimal contract + deny tests.
3. Remove the Paris handler.
4. Remove the proxy route in Roma/Bob.

Done gate per endpoint:
- Required response contract test passes.
- RLS deny test passes.
- Paris handler is deleted (not commented out, not behind a flag).
- No proxy route exists for the migrated path.
- Query lives in `michael.ts`, not scattered in components.

### Phase 3 — Clean up Paris internals

Objective: Consolidate duplication in surviving Paris handlers and remove dead shared utilities.

Implementation:
1. Delete shared utilities that only served migrated Tier 1 handlers (verify zero imports before deleting).
2. Consolidate remaining duplication in surviving handlers:
   - `normalizeAccountTier()` → one canonical copy in `shared/authz-capsule.ts`.
   - seoGeo entitlement check → one canonical function in `shared/seo-geo.ts`.
   - Tokyo mirror enqueue → one shared helper (already partially exists).
3. Remove dead routes from `paris/src/index.ts`.
4. Update `documentation/services/paris.md` to reflect the reduced surface.

Done gate:
- `normalizeAccountTier()` exists in exactly 1 file.
- seoGeo entitlement check exists in exactly 1 function.
- No dead routes in `paris/src/index.ts`.
- All deleted code has zero import references (verified by grep).

### Phase 4 — Update Roma/Bob proxy infrastructure

Objective: Remove catch-all Paris proxy; replace with named explicit routes.

Currently:
- Roma proxies most `/api/*` calls through `paris-http.ts` / `app/api/paris/[...path]/route.ts`.
- Bob proxies through `proxy-helpers.ts`.

After Tier 1 migration:
1. Remove catch-all proxy routes.
2. Keep explicit proxy routes only for surviving Paris orchestration/composed endpoints.
3. Each remaining proxy route is a named function calling a specific Paris endpoint.
4. `michael.ts` is the sole module for direct Supabase queries. Paris proxy functions are a separate module (`roma/lib/paris.ts`, `bob/src/lib/paris.ts`) — no mixing.

Done gate:
- No catch-all `/api/paris/[...path]` route exists in Roma.
- No generic proxy helper exists in Bob.
- Each Paris call is a named function in `paris.ts` calling a specific endpoint.
- Each Supabase query is a named function in `michael.ts`.
- Clear boundary: `michael.ts` = direct DB, `paris.ts` = orchestration calls.

---

## Scope

In scope:
- Configure Supabase third-party JWT verification for Berlin tokens (with full claim contract).
- Add Supabase client SDK to Roma and Bob behind named data-access modules.
- Lock Roma widget-domain ownership for publish/unpublish and all mutation command routing.
- Define and enforce token lifecycle contract (expiry, refresh, retry, failure).
- Implement entitlement snapshot reuse in Roma/Bob runtime (no per-click DB probe pattern).
- Per-handler audit to verify Tier 1 qualification (flat single-table, no composition).
- Minimal per-endpoint contract + deny tests for migrated flat reads.
- Migrate verified Tier 1 flat reads from Paris to direct Supabase.
- Consolidate Paris internal duplication.
- Replace catch-all proxy with named explicit routes.
- Update `documentation/services/paris.md`.

Out of scope:
- Instance/config writes (stay in Paris — no client-side draft/publish split).
- Composed reads like GET instance editor load (stays in Paris — envelope composition is orchestration).
- Decomposition of Paris's composed reads into simpler patterns (future PRD if needed).
- Changes to Venice (embed path is already Paris-free per PRD 054).
- Tokyo render/l10n ownership changes (already correct).
- Changes to SanFrancisco (already owns its state).
- New comments feature design/work (not an active product feature in this phase).
- New user-facing features.
- Billing/tier model changes.

---

## Risk Register

| Risk | Mitigation |
|---|---|
| Berlin JWT not accepted by PostgREST | Phase 0 spike decides go/no-go quickly; patch Berlin claim contract (`iss`/`aud`/`role`) and retry. |
| Tier 1 candidate is not truly flat | Mandatory handler audit before migration; if composed, keep in Paris. |
| RLS gap exposes or blocks data incorrectly | Per-endpoint member/deny tests before handler deletion. |
| Publish ownership drifts into Bob | Hard gate: publish/unpublish routes are Roma-owned only. |
| Entitlement checks drift back to per-click DB probes | Phase 1 gate: runtime gating uses bootstrap entitlements; server remains final authority at commit/publish. |
| Supabase calls spread across UI code | Enforce named boundaries: `michael.ts` only for direct DB calls. |

---

## Success Metrics

| Gate | Required outcome |
|---|---|
| Phase 0 spike | Berlin JWT works with PostgREST for member allow + non-member deny (or Berlin claims patched and verified). |
| Flat-read migrations | Each migrated endpoint has one contract test + one deny test; Paris handler removed. |
| Command ownership | Publish/unpublish calls originate from Roma widget-domain routes; Bob direct publish orchestration calls = 0. |
| Entitlements runtime | Verification outcome explicit (`already compliant` or `delta implemented`); no per-click entitlement DB probe path in Bob. |
| Boundary enforcement | `michael.ts` is sole direct Supabase boundary; `paris.ts` is orchestration boundary; catch-all proxies removed. |
| Paris cleanup | Duplicate helpers reduced (`normalizeAccountTier`, seoGeo check); dead routes removed. |

---

## Relationship to Other PRDs

| PRD | Relationship |
|---|---|
| PRD 054 (Snapshot Pipeline) | Established mirror job architecture. Paris publish/unpublish orchestration endpoints use this. Unchanged by PRD 057. |
| PRD 055 (Supabase Eviction) | Moved overlays/assets/l10n to R2/KV. PRD 057 must verify which operations are R2 (per 055) vs still Supabase during Tier 1 audit. |
| PRD 056 (Berlin Auth Boundary) | Made Berlin the sole auth gatekeeper. PRD 057 builds on this: Berlin JWT becomes the Supabase access credential. Berlin claim updates are explicitly in scope if required for Supabase compatibility. |
| Architecture Tenets | PRD 057 restores compliance with Tenet 2 (Dumb Pipes) and Vision Principle 5 (DB-level isolation). |

---

## Future Work (explicitly out of scope for PRD 057)

**Decomposing composed reads (potential PRD 058+):**
The GET instance editor load envelope (`read-handlers.ts`) composes policy + overlays + multi-table data. This could be decomposed by:
- Moving overlay merging to a Supabase function (postgres function callable via RLS).
- Splitting the envelope into separate calls (instance data, policy, overlays as three requests).
- Creating a Supabase view that pre-joins the required tables.

This is a separate design decision with its own tradeoffs and is not attempted here.

**Moving all writes to direct Supabase (not recommended):**
All instance writes involve server-side enforcement (entitlements, asset contracts, limits) and side effects (mirror jobs, l10n). Moving write routing to clients would duplicate enforcement logic and create race conditions. Writes should stay server-side.
