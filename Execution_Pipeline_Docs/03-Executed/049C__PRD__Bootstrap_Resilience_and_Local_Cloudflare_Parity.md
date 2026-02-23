# PRD 049C - Bootstrap Resilience and Local/Cloudflare Parity (Part of PRD 49)

**Status:** EXECUTING (Local complete; cloud-dev runtime verification pending)  
**Date:** 2026-02-19  
**Owner:** Product Dev Team  
**Reviewers:** Human Architect + Product Dev Team peers  
**Environment scope:** Local first (`bash scripts/dev-up.sh`), then cloud-dev  
**Parent PRD:** `Execution_Pipeline_Docs/02-Executing/049__PRD__Infra_and_Architecture_Recovery_Program.md`  
**Sequence:** C (after 049B)  
**Program membership:** This PRD is part of PRD 49 and cannot be executed standalone.

---

## Non-negotiable Tenets (inherited from PRD 49, must hold)

1. Bob in Roma and Bob in DevStudio is the same system.
2. Bob loads entitlements at auth; after that Bob does not re-check entitlements for actions (server still enforces writes).
3. Uploading an asset is simple; uploaded assets flow directly into Tokyo.
4. Deleting an asset is immediate hard delete (with confirm when in use); no soft delete.
5. Asset management is account-tied and straightforward.
6. Assets carry the file name in the system and nothing else.
7. There is no asset fallback.
8. Asset replacement updates embeds immediately and automatically.
9. Assets are global and reusable across unlimited instances in the same account.
10. Admin in Roma and DevStudio is just another account profile (same model, unlimited caps, no ad-hoc runtime path).
11. Everything that works in local works the same way in cloud-dev/Cloudflare.
12. No API file can exceed 800 LOC.
13. There is no legacy support and no back-compat execution path.

---

## 1) Architecture tenet lens for PRD C

1. `Tenet 0 (identity determinism)`: bootstrap failures must not silently collapse identity context.
2. `Tenet 2 (orchestrators are dumb pipes)`: hosts should pass config/contracts, not mutate behavior by hostname/runtime branch.
3. `Tenet 3 (fail visibly)`: partial-domain failures must be explicit and attributable.
4. `Tenet 11 (local/cloud parity)`: behavior parity is mandatory; only infrastructure coordinates may differ.
5. `Tenet 12 (API module size limit)`: any API module touched in this PRD must be decomposed so each API module remains `<=800 LOC`.
6. `Tenet 13 (no legacy/backcompat)`: remove legacy bootstrap envelope assumptions; no dual old+new response parsing.

---

## 2) Purpose

1. Make Roma bootstrap resilient to partial domain failures.
2. Preserve successful domains instead of returning all-or-nothing `500`.
3. Enforce local/cloud behavior parity for Bob/Roma/DevStudio bootstrap and host orchestration paths.

This PRD executes Tenet 11 plus resilience requirements required by Tenets 1, 2, and 3.

---

## 3) Why this is third

1. 049A and 049B establish canonical contracts (editor open + asset lifecycle).
2. Resilience/parity must validate the real final contracts, not pre-fix behavior.
3. Doing parity before contract convergence only certifies drift.

---

## 4) Code-verified as-is issues

| Issue | Evidence | Impact |
| --- | --- | --- |
| Bootstrap domain snapshot is all-or-nothing | `paris/src/domains/roma/index.ts:1157` | Any one domain failure drops full domains payload. |
| Auth/context assembly is all-or-nothing | `paris/src/domains/roma/index.ts:2209` | One downstream error returns full `500` even when most context is valid. |
| Bootstrap failure reason is generic | `paris/src/domains/roma/index.ts:2282` | User and logs cannot attribute which domain failed. |
| Roma client flattens all bootstrap failures to one string reason | `roma/components/use-roma-me.ts:451` | UI cannot show domain-specific degradation state. |
| Domain screens treat missing snapshots as generic data-unavailable | `roma/components/widgets-domain.tsx:60`, `roma/components/templates-domain.tsx:39` | Failures are not domain-attributable or actionable. |
| Assets domain silently suppresses degraded bootstrap state | `roma/components/assets-domain.tsx:53` | Domain fails but UI clears error and shows empty list (invisible failure). |
| PRD C touches API file above Tenet 12 limit | `paris/src/domains/roma/index.ts:1` | Any direct behavior edit without first splitting modules violates non-negotiable LOC limit. |
| Runtime host defaults branch by hostname | `roma/components/builder-domain.tsx:65`, `admin/src/html/tools/dev-widget-workspace.html:792`, `admin/src/html/tools/dev-widget-workspace.html:808` | Local/cloud behavior can drift independently of env config. |

---

## 5) Target contracts

### C8-C: Bootstrap degrades by domain, not globally

Response contract:
1. Successful bootstrap returns `200` with `domains` and `domainErrors`.
2. `domainErrors` is a keyed object (`widgets`, `templates`, `assets`, `team`, `billing`, `usage`, `settings`) for failed domains only.
3. Each `domainErrors[domainKey]` includes `{ reasonKey, status, detail? }`.
4. `domains` contains successful domain keys only; failed domains are omitted from `domains` (never `null` placeholders).
5. Core auth bootstrap (`user`, `accounts`, `workspaces`, `authz`) remains authoritative; if this core fails, return explicit error and no fake success.

Example envelope shape:

```json
{
  "user": {},
  "accounts": [],
  "workspaces": [],
  "defaults": {},
  "authz": {},
  "domains": {
    "widgets": { "...": "..." },
    "assets": { "...": "..." }
  },
  "domainErrors": {
    "templates": {
      "reasonKey": "roma.errors.bootstrap.templates_unavailable",
      "status": 502
    }
  }
}
```

### C8-C2: Canonical Roma domain-degraded UI contract (all 7 domain screens)

Contract:
1. Every domain screen (`widgets`, `templates`, `assets`, `team`, `billing`, `usage`, `settings`) consumes the same state tuple: `{ domains[domainKey], domainErrors[domainKey] }`.
2. If `domainErrors[domainKey]` exists, UI state is `degraded` (never silent, never mapped to generic empty state).
3. `degraded` renders must include:
   - common title key: `roma.errors.bootstrap.domain_unavailable`
   - domain-specific reason key from server (`domainErrors[domainKey].reasonKey`)
   - explicit retry action that refetches bootstrap
4. It is forbidden to clear error state (`setError(null)` or equivalent) when `domainErrors[domainKey]` exists.
5. If both `domains[domainKey]` and `domainErrors[domainKey]` are missing, render explicit contract-violation state with key `roma.errors.bootstrap.domain_contract_violation`.

### C8-C3: Client cache semantics for `200` degraded bootstrap responses

1. `useRomaMe` classifies response states into:
   - `success_full`: `domainErrors` absent or empty
   - `success_degraded`: `domainErrors` has one or more keys
   - `error`: non-`200` or request/parse failure
2. Cache rules:
   - `success_full`: keep authz-expiry TTL behavior
   - `success_degraded`: short-lived memory cache only (`<=5000ms`) and never persist to `sessionStorage`
   - `error`: keep short error TTL (`10000ms`)
3. Any refresh action from degraded UI must bypass cache (`force=true`) and hit `/api/bootstrap` directly.
4. Degraded cache entries must never be reused across browser reloads.

### C12-C: Tenet 12 completion condition for PRD C

1. `paris/src/domains/roma/index.ts` must end as a thin router/composer module and be `<=800 code LOC`.
2. Every new module created by this split under `paris/src/domains/roma/**` must be `<=800 code LOC`.
3. PRD C cannot close with partial extraction that leaves `paris/src/domains/roma/index.ts` above 800.
4. LOC verification command for this PRD:

```bash
node scripts/ci/check-api-code-loc.mjs --max-code-loc 800 --scope paris/src/domains/roma
```

### C11-C: Local/cloud parity contract

Allowed environment differences:
1. Base URLs/origins.
2. Secrets/tokens.
3. Cloudflare bindings and deployment wiring.

Forbidden environment differences:
1. Payload shape.
2. Subject mode behavior.
3. Entitlement/policy semantics.
4. Retry/timeout semantics.
5. Asset/open/bootstrap runtime semantics.
6. Bootstrap edge-caching semantics.

Parity rule:
1. If local and cloud-dev receive the same input contract, they must produce equivalent output contract and reason semantics.
2. Bootstrap responses are non-cacheable end-to-end (`Cache-Control: no-store`), and Cloudflare config must not reintroduce cache behavior for `/api/bootstrap`.

### C13-C: No legacy/backcompat bootstrap behavior

1. Bootstrap response contract has one canonical shape (`domains` + `domainErrors`) with no legacy aliases.
2. Roma client parses the canonical shape only; no compatibility parser for previous envelope variants.
3. Host orchestration cannot keep legacy hostname-branch behavior in parallel with config-driven behavior.
4. Bootstrap consumer inventory for hard cut:
   - `roma/app/api/bootstrap/route.ts` remains canonical bootstrap proxy
   - `roma/app/api/me/route.ts` is legacy alias and must be removed in PRD C
   - `roma/components/use-roma-me.ts` and `roma/components/paris-http.ts` must call only `/api/bootstrap`

---

## 6) Cross-product dependency trace (anti-drift)

| Surface | Code evidence | Required change under PRD 49 tenets | Drift if skipped |
| --- | --- | --- | --- |
| Paris Roma API module size (Tenet 12) | `paris/src/domains/roma/index.ts:1` | Decompose `index.ts` before behavior edits so `index.ts` ends as thin router/composer `<=800 code LOC` and each extracted module under `paris/src/domains/roma/**` is `<=800 code LOC`. | PRD C execution violates a non-negotiable tenet and cannot be signed off. |
| Paris domain snapshot fanout | `paris/src/domains/roma/index.ts:1157` | Replace blocking `Promise.all` with `Promise.allSettled` and build `domainErrors` map keyed by domain contract. | One domain outage keeps crashing full bootstrap. |
| Paris auth/context fanout | `paris/src/domains/roma/index.ts:2209` | Separate core auth context minting from domain snapshot fanout so non-core domain failures degrade, not abort. | Partial outages still return full 500. |
| Paris bootstrap error payload | `paris/src/domains/roma/index.ts:2279` | Keep explicit core-failure error path, but stop routing domain failures through generic `contextUnavailable`. | Domain attribution never reaches client. |
| Roma bootstrap proxy | `roma/app/api/bootstrap/route.ts:55` | Preserve upstream `domainErrors` headers/body unchanged; enforce non-cacheable bootstrap pass-through (`Cache-Control: no-store`) in local and cloud-dev. | Domain diagnostics or cache semantics drift between Paris and Roma client. |
| Roma legacy bootstrap alias route | `roma/app/api/me/route.ts:45` | Remove `/api/me` proxy route (hard cut) so bootstrap has one canonical proxy surface (`/api/bootstrap`). | Legacy path can silently drift on envelope/cache semantics. |
| Roma bootstrap client typing | `roma/components/use-roma-me.ts:6` | Add `domainErrors` type to `RomaMeResponse`; parse and retain canonical shape without compatibility parser branches. | UI cannot distinguish widgets outage from billing outage. |
| Roma bootstrap client error handling | `roma/components/use-roma-me.ts:451` | Keep request-level failure behavior, but expose per-domain degraded state when response is `200` with partial domains. | Entire UI appears broken when only one domain is down. |
| Roma bootstrap client caching semantics | `roma/components/use-roma-me.ts:311`, `roma/components/use-roma-me.ts:426` | Add explicit degraded-success cache policy (`domainErrors` present => short-lived memory cache only, no session persistence, force-refresh path). | Stale degraded bootstrap can persist like full success and hide recovery. |
| Roma canonical degraded-state resolver | `roma/components/use-roma-me.ts:6`, `roma/components/widgets-domain.tsx:60`, `roma/components/templates-domain.tsx:39` | Implement one shared domain-error mapping contract for all screens (`reasonKey` passthrough + shared title + retry action). | Each surface keeps custom behavior and drift returns immediately. |
| Roma assets/team/billing/usage/settings screens | `roma/components/assets-domain.tsx:50`, `roma/components/team-domain.tsx:30`, `roma/components/billing-domain.tsx:37`, `roma/components/usage-domain.tsx:43`, `roma/components/settings-domain.tsx:80` | Use canonical degraded-state contract and remove silent suppression (`assets-domain` must not set error to null for degraded bootstrap). | Users see inconsistent degradation states; assets failure remains invisible. |
| Roma Builder Bob base resolution | `roma/components/builder-domain.tsx:65` | Keep environment selection via explicit config (`NEXT_PUBLIC_BOB_URL` / query override), not hostname-derived behavior branches. | Local and cloud run different open host semantics. |
| DevStudio Bob/Tokyo base resolution | `admin/src/html/tools/dev-widget-workspace.html:789`, `admin/src/html/tools/dev-widget-workspace.html:805` | Replace hostname switches with explicit tool config injection; keep one config contract with Roma/Bob env rules. | DevStudio continues to behave differently than Roma/Bob per environment. |
| Shared env resolvers (canonical config behavior) | `bob/lib/env/paris.ts:1`, `bob/lib/env/tokyo.ts:1`, `roma/lib/env/paris.ts:1`, `roma/lib/env/tokyo.ts:1` | Use these as baseline parity contract; any new host resolver must match this behavior profile (env first, local fallback only in local builds, fail-fast in deployed env). | New hosts/tools reintroduce ad-hoc env logic and parity drift. |
| Local startup baseline | `scripts/dev-up.sh:4` | Keep local parity test runs bound to canonical startup script before cloud-dev verification. | Team verifies against non-canonical local states and misses parity drift. |
| Cloud-dev deployment wiring | `.github/workflows/cloud-dev-roma-app.yml:28`, `.github/workflows/cloud-dev-workers.yml:38` | Add parity gate stage with explicit commands before deploy: `pnpm test:contracts`, `node scripts/ci/check-api-code-loc.mjs --max-code-loc 800 --scope paris/src/domains/roma`, `node scripts/ci/check-bootstrap-parity.mjs --env cloud-dev`. | Cloud-dev accepts changes that local never validated under same contract matrix. |

Execution rule for this table:
1. Every row is blocking.
2. No waivers or compatibility exceptions.
3. “Parity done” is false until every affected Roma domain screen has consistent degraded-state behavior.

---

## 7) Implementation scope

### Files/services touched

1. `paris/src/domains/roma/index.ts`
2. `paris/src/domains/roma/bootstrap/*` (new split modules required for Tenet 12 compliance)
3. `scripts/ci/check-api-code-loc.mjs` (Tenet 12 gate used by PRD C)
4. `scripts/ci/check-bootstrap-parity.mjs` (explicit parity smoke contract runner)
5. `roma/app/api/bootstrap/route.ts`
6. `roma/app/api/me/route.ts` (remove legacy alias route)
7. `roma/components/use-roma-me.ts`
8. `roma/components/bootstrap-domain-state.ts` (shared degraded-state resolver)
9. `roma/components/paris-http.ts`
10. `roma/components/widgets-domain.tsx`
11. `roma/components/templates-domain.tsx`
12. `roma/components/assets-domain.tsx`
13. `roma/components/team-domain.tsx`
14. `roma/components/billing-domain.tsx`
15. `roma/components/usage-domain.tsx`
16. `roma/components/settings-domain.tsx`
17. `roma/components/builder-domain.tsx`
18. `admin/src/html/tools/dev-widget-workspace.html`
19. `.github/workflows/cloud-dev-roma-app.yml`
20. `.github/workflows/cloud-dev-workers.yml`

### Required changes

1. Decompose touched Paris API module(s) first to satisfy Tenet 12 before behavior changes.
2. Implement all-settled domain bootstrap with explicit `domainErrors` payload.
3. Enforce response shape rule: failed domains are omitted from `domains` and represented only via `domainErrors`.
4. Preserve partial domains on bootstrap success whenever core auth context is valid.
5. Add one canonical domain-aware degradation contract in Roma client and apply it to all 7 domain surfaces.
6. Implement degraded-success cache policy in `useRomaMe` (`<=5000ms` memory TTL, no session persistence, explicit force refresh path).
7. Remove hostname-driven runtime behavior in host tools; keep behavior config-driven.
8. Add parity checks in local and cloud-dev pipelines using explicit gate commands.
9. Remove legacy/bootstrap compatibility envelope handling from producers and consumers, including hard removal of `/api/me` bootstrap alias.
10. Add bootstrap fanout observability (`bootstrapFanoutMs` and per-domain outcome fields) so allSettled cost is measurable in local and cloud-dev.

---

## 8) Verification

### Resilience tests

1. Force each domain loader to fail independently; verify remaining domains still return in same bootstrap response.
2. Verify `domainErrors` contains only failed domains with deterministic `reasonKey` and status.
3. Verify failed domain keys are omitted from `domains` (never `null` placeholders).
4. Verify core auth failure still returns explicit hard error (no fake partial success).

### UI degradation tests

1. Widgets/templates/assets/team/billing/usage/settings each show explicit degraded-state reason when their domain fails.
2. Every degraded domain screen uses the same contract: common unavailable title + server `reasonKey` + explicit retry action.
3. Verify `assets-domain` no longer silently suppresses failure (`setError(null)`-style behavior removed for degraded state).
4. Non-failing domains remain operational in same session.

### Bootstrap client cache tests (`useRomaMe`)

1. Full success (`domainErrors` empty) uses authz-expiry TTL and can be restored from session cache.
2. Degraded success (`domainErrors` non-empty) expires within `<=5000ms`, does not persist to session cache, and retries on explicit refresh.
3. Request errors keep short error TTL and do not overwrite last valid success payload.

### Parity tests (local vs cloud-dev)

1. Run same bootstrap contract matrix in local (canonical `bash scripts/dev-up.sh`) and cloud-dev.
2. Verify payload shape, `reasonKey` values, and degraded-state behavior are equivalent.
3. Verify Bob open/origin selection behavior is config-driven, not hostname-driven.
4. Verify no legacy bootstrap envelope keys/aliases are emitted or parsed.
5. Verify `/api/bootstrap` remains non-cacheable end-to-end (`Cache-Control: no-store`) in local and cloud-dev.
6. Verify `/api/me` bootstrap alias path no longer exists (expected `404` or route-not-found contract).

### Gate command contract (must be wired exactly)

Local gate run:

```bash
pnpm test:contracts
node scripts/ci/check-api-code-loc.mjs --max-code-loc 800 --scope paris/src/domains/roma
node scripts/ci/check-bootstrap-parity.mjs --env local
```

Cloud-dev workflow gate run (in both `.github/workflows/cloud-dev-roma-app.yml` and `.github/workflows/cloud-dev-workers.yml`, before deploy steps):

```bash
pnpm test:contracts
node scripts/ci/check-api-code-loc.mjs --max-code-loc 800 --scope paris/src/domains/roma
node scripts/ci/check-bootstrap-parity.mjs --env cloud-dev
```

### Fanout scalability observability tests

1. Capture bootstrap fanout telemetry in local and cloud-dev (`bootstrapFanoutMs`, per-domain success/failure outcome).
2. Confirm there is no hidden retry loop added in PRD C; one request issues one deterministic domain fanout.
3. Store pre-change vs post-change bootstrap latency snapshots for peer review sign-off.

---

## 9) Exit gate (blocking)

1. Bootstrap no longer fails globally on single domain failure.
2. `domainErrors` is present, explicit, and consumed by Roma UI surfaces.
3. Local and cloud-dev parity matrix is green with equivalent runtime behavior and reason semantics.
4. No hostname-based branch alters product behavior for Bob/Tokyo/Paris orchestration.
5. All dependency-table rows are complete.
6. No legacy/backcompat bootstrap path remains in Paris/Roma/Admin host flow.
7. All seven Roma domain screens implement the same degraded-state contract with no silent suppression.
8. `paris/src/domains/roma/index.ts` is a thin router/composer and `<=800 code LOC`; all extracted modules under `paris/src/domains/roma/**` are also `<=800 code LOC`.
9. `/api/me` bootstrap alias route is removed; `/api/bootstrap` is the only supported Roma bootstrap proxy.
10. Bootstrap degraded-success cache semantics are implemented (`<=5000ms`, memory-only, no session persistence).
11. Bootstrap fanout observability fields are present in local and cloud-dev verification artifacts.

---

## 10) Handover to 049D

049D can start only when 049C exit gate is green. 049C establishes bootstrap-scope Tenet 12 and parity gates; 049D expands the same governance model across the broader API surface.
