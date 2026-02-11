# Minibob Public Grant Mint — Execution PRD (Thin Slice)

**Status:** Executed (code) — Pending Cloudflare ops  
**Owner:** Platform / Paris + Cloudflare  
**Scope:** Public mint path for Minibob SDR agent only (`sdr.widget.copilot.v1`)

---

## Manual ops pending (Cloudflare)
- Bind `MINIBOB_RATELIMIT_KV` in cloud-dev / uat / ga.
- Ensure `AI_GRANT_HMAC_SECRET` is set in those stages.
- Configure edge rate limits + bot protections on:
  - `POST /api/ai/minibob/session`
  - `POST /api/ai/minibob/grant`
  - `POST /v1/execute`

## Current codebase reality (2026-01-27)

This is already partly executed in the right direction:

- Paris endpoint exists: `POST /api/ai/minibob/grant`
  - Routed in `paris/src/index.ts`
  - Implemented in `paris/src/domains/ai/index.ts` via `handleAiMinibobGrant`
- Paris session token endpoint now exists: `POST /api/ai/minibob/session`
  - Routed in `paris/src/index.ts`
  - Implemented in `paris/src/domains/ai/index.ts` via `handleAiMinibobSession`
- Bob now mints a session token before requesting a grant
  - Implemented in `bob/app/api/ai/sdr-copilot/route.ts`
- Paris already enforces the key semantic gates:
  - `workspaceId` is rejected
  - `agentId` is forced to `sdr.widget.copilot.v1`
  - `mode` is forced to `ops`
  - `subject` is forced to `minibob`
- Paris already clamps budgets as documented:
  - `maxTokens = 420`
  - `timeoutMs = 12_000`
  - `maxRequests = 2`
- Paris now verifies `sessionToken` on the grant endpoint.
- Paris now includes a KV throttle behind `MINIBOB_RATELIMIT_MODE`.

What is still missing (and is the only reason this PRD exists):
- Cloudflare edge rate limits and bot controls are not guaranteed by code.
- KV bindings + stage defaults must be set correctly outside local.
- Error i18n keys referenced by throttling/unavailable paths may be missing.
- We have not yet validated thresholds and failure modes in cloud-dev.

---

## Why this slice is elegant and architecture-native

- Paris stays the policy gate (no widget logic, no orchestration creep).
- San Francisco stays the executor (no mint policy there).
- Edge stays the outer guardrail (rate limit + bot control).
- We add only one missing layer: a small Paris KV throttle that scales.

This is a strict, thin slice that reduces abuse risk without expanding surface area.

---

## 1) Purpose
Enable anonymous Minibob sessions to obtain a **restricted AI grant** for SDR execution with **zero privileged surface**, while making sessions server-verifiable.

Non-goals:
- No workspace or devstudio privileges.
- No other agents or modes.
- No long-lived grants.

---

## 2) Endpoint Contract (Paris)

### 2.1 Session token mint (new, thin slice)
**Endpoint:** `POST /api/ai/minibob/session`

**Purpose:** issue a short-lived, server-signed session token so the grant mint cannot be driven by infinite client-generated sessionIds.

**Inputs:** none

**Response:**
- `sessionToken` (server-signed)
- `expiresAt`

**Session token shape (illustrative):**
```
minibob.v1.<issuedAtSec>.<nonce>.<signature>
```
Where:
- `nonce` is a server-generated UUID
- `signature = HMAC_SHA256(AI_GRANT_HMAC_SECRET, "minibob|v1|issuedAt|nonce")`

Validation rules:
- Signature must verify.
- Token must be within TTL (e.g., 1 hour).

### 2.2 Grant mint (existing endpoint, now requires session token)
**Endpoint:** `POST /api/ai/minibob/grant`

**Inputs (client-provided):**
- `sessionToken` (string, required)
- `sessionId` (string, required; retained for agent/session semantics)
- `widgetType` (string, required)
- `locale` (string, optional)

**Response:**
- `grant` (signed token)
- `expiresAt`
- `budgets` (effective caps)

**Hard overrides (server-side):**
- `subject = minibob`
- `agentId = sdr.widget.copilot.v1`
- `mode = ops`
- `workspaceId` must be absent (reject if present)
- any requested budgets are ignored except for **down‑clamp**

---

## 3) Cloudflare Edge Controls (Layer 1)
**Rate limiting (mandatory):**
- **Mint endpoint**:
  - 10 req / 5 min / IP (start conservative)
  - Burst limit: 3 / 30 sec
- **Execute endpoint (SF)**:
  - 30 req / 10 min / IP

**Bot protection:**
- Enable Bot Management on mint + execute paths.
- Optional: Turnstile challenge if score < threshold.

**WAF rules (mandatory):**
- Block non‑browser user agents if abusing.
- Reject missing `Origin`/`Referer` if policy requires (optional).

---

## 4) Paris Worker Controls (Layer 2)
### 4.0 Session tokens (thin slice to implement now)
Session tokens are required on the grant mint endpoint.

Grant flow within Paris:
1) Parse and validate payload.
2) Verify `sessionToken` (signature + TTL).
3) Derive a stable, server-verified session key from the token (e.g., the token nonce).
4) Apply KV throttles.
5) Issue grant.

Fail-closed rules:
- Invalid or expired `sessionToken` -> 403 with a stable error shape.
- Missing `sessionToken` -> 422.

### 4.1 Semantic gates (already implemented, must remain strict)
- Reject if `workspaceId` present.
- Reject if `agentId` not exact match.
- Reject if subject not `minibob`.
- Reject if `mode` not allowed.

### 4.2 Budget caps (already implemented, must remain strict)
- `maxTokens`: 420 (range 350–500)
- `timeoutMs`: 12s (range 10–20s)
- `maxRequests`: 2

### 4.3 KV rate limiting (thin slice to implement now)
Goal: add a minimal, privacy-safe throttle in Paris that works at scale without adding new data models.

Design constraints:
- No raw IP/UA persistence.
- No new DB tables.
- Fail-fast in cloud environments, not brittle in local dev.

Privacy-safe fingerprint (server-side only):
```
fp = HMAC_SHA256(
  AI_GRANT_HMAC_SECRET,
  `${utcDay}|${ip}|${userAgent}|${acceptLanguage}`
)
```
- Use the existing `AI_GRANT_HMAC_SECRET` as the salt/secret.
- Include `utcDay` to rotate fingerprints daily.
- Persist only the hash.

Enforce:
- per‑fp mint limit / minute
- per‑session mint limit / hour (use the server-verified session token nonce as the session key)
- stable deny reason on throttle (HTTP 429)

Concrete defaults (no new knobs in this slice):
- per-fp limit: 6 mints / minute
- per-session limit: 12 mints / hour

Important: this KV throttle is a secondary guardrail. Cloudflare Edge rate limits remain the primary abuse control.

### 4.4 Rate-limit layer ordering (make this explicit)
1) Cloudflare Edge (Layer 1) runs first.
- If Edge blocks, Paris is never invoked.
- Edge should count all requests, including those that Paris later throttles.
2) Paris KV throttle (Layer 2) runs second.
- Paris verifies `sessionToken` before KV throttling.
- If KV allows, Paris mints the grant.
- If KV throttles, Paris returns a structured 429.

---

## 5) Logging & Audit
Log every mint attempt with:
- `sessionId`, `widgetType`
- `sessionKey` (derived from verified session token; truncated)
- allow/deny + reason
- effective budgets

No PII beyond hashed fp.

---

## 6) Thin execution slice (what we will actually do now)

This PRD is intentionally narrow. We are not redesigning grants, agents, or modes.

### 6.1 Code changes (local codebase)
Environment: local code edits only. No instance creation/edits.

1) Add explicit KV bindings for rate limiting (Paris types)
- File: `paris/src/shared/types.ts`
- Add:
  - `MINIBOB_RATELIMIT_KV?: KVNamespace`
  - `MINIBOB_RATELIMIT_MODE?: 'off' | 'log' | 'enforce'`

Mode semantics:
- `off` (default in local): no KV reads/writes.
- `log`: compute + log decisions but do not block.
- `enforce`: apply 429 blocks.

Stage defaults (when `MINIBOB_RATELIMIT_MODE` is unset):
- `local` -> `off`
- `cloud-dev` -> `log`
- `uat` / `ga` -> `enforce`

2) Add a session token endpoint and verification in Paris
- File: `paris/src/index.ts`
  - Route `POST /api/ai/minibob/session`
- File: `paris/src/domains/ai/index.ts`
  - Add `handleAiMinibobSession`
  - In `handleAiMinibobGrant`, require and verify `sessionToken`

Minimal session token behavior:
- Token minted server-side using `AI_GRANT_HMAC_SECRET`
- TTL ~ 1 hour
- Verification is strict in all non-local environments

3) Add a minimal KV throttle in the minibob mint handler
- File: `paris/src/domains/ai/index.ts`
- Function: `handleAiMinibobGrant`
- Insert throttle check after payload validation + session token verification and before `issueAiGrant(...)`.

Required behavior:
- Compute privacy-safe fp using `AI_GRANT_HMAC_SECRET`.
- Derive `sessionKey` from the verified session token nonce (not from client `sessionId`).
- Build two counters:
  - fp window: per-minute
  - session window: per-hour
- On throttle:
  - return `ckError({ kind: 'DENY', reasonKey: 'coreui.errors.ai.minibob.rateLimited' }, 429)`
  - log a single structured throttle event.

Local-dev rule:
- If `ENV_STAGE === 'local'` and KV binding is missing, behave as `off` (do not block).

Cloud-dev rule:
- If `ENV_STAGE === 'cloud-dev'` and KV binding or `AI_GRANT_HMAC_SECRET` is missing, degrade to `log` (do not block iteration).

UAT/GA rule:
- If `ENV_STAGE` is neither `local` nor `cloud-dev` and KV binding or `AI_GRANT_HMAC_SECRET` is missing, fail closed with a clear 503/5xx and a single structured log line.

4) Add structured mint decision logs
- File: `paris/src/domains/ai/index.ts`
- Log on every mint attempt:
  - `event: 'minibob.mint'`
  - `decision: allow | deny | throttle`
  - `reason`
  - `sessionId`, `widgetType`
  - `sessionKey` (derived from verified token; may be truncated)
  - effective budgets

5) Client contract update (thin but required)
- Minibob clients must:
  - call `POST /api/ai/minibob/session` first
  - pass `sessionToken` into `POST /api/ai/minibob/grant`
- This is a small wiring change and preserves the current grant contract otherwise.

### 6.2 Edge configuration (Cloudflare, human-applied)
- Apply rate limits and bot controls described in Section 3.
- No new runtime routes or code paths are required.
**Human-required (not code):**
- Bind `MINIBOB_RATELIMIT_KV` in Cloudflare for cloud-dev/uat/ga.
- Ensure `AI_GRANT_HMAC_SECRET` is set in those stages.
- Configure the edge rate limits + bot controls (dashboard/WAF).

---

## 7) Acceptance Criteria (execution-ready)

1) Mint policy remains strictly scoped:
- Only `subject=minibob`, `agentId=sdr.widget.copilot.v1`, `mode=ops`.
- Requests attempting to override these are denied.

2) Throttle exists and is deterministic:
- In `enforce` mode, abusive clients receive HTTP 429 with a stable reason key.
- Normal usage is unaffected.

3) Session tokens are enforced:
- `POST /api/ai/minibob/grant` rejects missing/invalid/expired session tokens.
- Session-based throttling uses a server-verified session key (token nonce).

4) Architecture remains clean:
- No new tables.
- No new agent/mode switches.
- Paris remains a policy gate; SF remains executor.

---

## 8) Verification (local + cloud-dev mental model)

Environment notes:
- Local: `bash scripts/dev-up.sh` is the canonical startup.
- Cloud-dev: rate limit enforcement depends on Cloudflare config + KV bindings.

Local verification (no instance edits needed):
- Call `POST /api/ai/minibob/session` and confirm a session token is returned.
- Call `POST /api/ai/minibob/grant` with required fields.
- Confirm successful grant issuance still works.
- If `MINIBOB_RATELIMIT_MODE=log`, confirm decision logs appear without blocking.

---

## 9) Rollout Checklist
- [ ] Session token endpoint implemented: `POST /api/ai/minibob/session`
- [ ] Grant mint requires verified `sessionToken`
- [ ] Paris KV throttle implemented behind `MINIBOB_RATELIMIT_MODE`
- [ ] Paris mint decision logs added
- [ ] Cloudflare rate limits on mint + execute
- [ ] Cloudflare bot protections enabled on mint + execute
- [ ] `coreui.errors.ai.minibob.rateLimited` added to coreui i18n
- [ ] `coreui.errors.ai.minibob.ratelimitUnavailable` added to coreui i18n
- [ ] Monitoring: deny rates + error rates + token usage
- [ ] Stage defaults verified: local=off, cloud-dev=log, uat/ga=enforce

---

## 10) Testing
- Unit: gate rejections (workspaceId, wrong agentId, mode)
- Load: rate limit thresholds
- Security: SSRF / header spoofing attempts
- End‑to‑end: anonymous Minibob → grant → execute → ops apply (no DB writes)

---

## Notes on scope discipline

Explicit non-goals for this execution:
- No new grant shapes.
- No new agent IDs.
- No persistence beyond KV counters.

---

## Security hardening beyond this slice (pre-GA, separate PRD)

The following are valid concerns but intentionally out of scope for this thin slice:
- Progressive throttling / deny-rate tracking.
- Aggregate load-shedding controls.

If we decide these are required before GA, we should capture them in a dedicated hardening PRD rather than expanding this slice mid-flight.
