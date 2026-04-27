# Berlin Auth System — Deep Engineering Analysis
*Clickeen / `berlin/src/` — Full read of all 28 source files*
*April 26, 2026*

---

## Inventory

| File | Lines (approx) | Role |
|---|---|---|
| `route-dispatch.ts` | 180 | Single-file router, no framework |
| `routes-login.ts` | 570 | OAuth PKCE + password login + finish |
| `routes-session.ts` | 200 | refresh / logout / session / michael-token / jwks |
| `routes-account.ts` | 490 | All account management HTTP handlers |
| `auth-session.ts` | 220 | Session issuance, principal resolution, RTI rotation, Supabase bridge |
| `jwt-crypto.ts` | 260 | RS256 signing/verify, HMAC refresh, isolate-cached key import |
| `auth-ticket-store.ts` | 190 | Durable Object for OAuth state + finish tickets |
| `auth-tickets.ts` | 140 | PKCE helpers + ticket create/consume logic |
| `session-kv.ts` | 110 | KV session CRUD: load / save / revoke by sid or userId |
| `account-reconcile.ts` | 590 | Provider identity → user + account provisioning |
| `account-state.ts` | 560 | Bootstrap payload, account context, member listing |
| `account-members.ts` | 260 | Member CRUD |
| `account-invitations.ts` | 460 | Invitation create/accept/delete |
| `account-governance.ts` | 150 | Account delete + owner transfer |
| `account-lifecycle.ts` | 45 | Tier-drop dismiss |
| `account-locales.ts` | 170 | Account locale policy update |
| `contact-methods.ts` | 340 | Phone/WhatsApp contact method verify |
| `user-profiles.ts` | 190 | Profile patch |
| `provider-google.ts` | 160 | Google OAuth2 PKCE token exchange |
| `supabase-client.ts` | 270 | Supabase HTTP client (password grant, refresh, user fetch, email change) |
| `supabase-admin.ts` | 50 | Admin fetch wrapper |
| `supabase-list.ts` | 35 | Paginated list reader |
| `auth-config.ts` | 90 | Env-driven config: issuer, audience, allowed providers, redirect URLs |
| `auth-request.ts` | 50 | Bearer + refresh token extraction from request |
| `helpers.ts` | 120 | Shared primitives: json/redirect/error responses, base64url, PEM parsing |
| `types.ts` | 120 | Full type model and constants |
| `account-state.types.ts` | 55 | BerlinBootstrapPayload and related output types |
| `index.ts` | 35 | Worker entry: delegates to dispatchBerlinRequest + exports DO |

**Total: ~5,900 lines of TypeScript across 28 files.**

---

## 1. The Dual Login System — What Is Actually Happening

Berlin currently contains **two different session issuance paths** that do different things:

### Path A — Password Login (Legacy)
```
POST /auth/login/password
  → requestSupabasePasswordGrant(email, password)    // hits Supabase /token?grant_type=password
  → requestSupabaseUser(supabaseAccessToken)         // hits Supabase /user
  → ensureProductAccountState(supabaseUserResponse) // account-reconcile
  → issueSession({
      userId,
      supabaseRefreshToken,   // ← stored in KV session state
      supabaseAccessToken,    // ← stored in KV session state
      supabaseAccessExp,      // ← stored in KV session state
    })
```
**The Supabase refresh token is alive inside the session.** Every call to `handleMichaelToken` will use it to refresh the Supabase access token silently and mutate KV session state.

### Path B — Google PKCE (New)
```
GET  /auth/login/:provider/start   → redirect to Google
GET  /auth/login/:provider/callback → exchangeGoogleCallback (no Supabase involved)
  → issueProductSessionFromProviderIdentity(identity)
  → ensureProductAccountStateForIdentity(identity)
  → issueSession({ userId })       // ← NO supabaseRefreshToken
POST /auth/finish → consume ticket, return tokens
```
**No Supabase tokens in the session.** `handleMichaelToken` detects `hasSupabaseSessionBridge === false` and falls back to the Supabase service-role key if the request has the `x-ck-internal-service: roma.edge` marker.

### The Problem
These two paths produce **structurally incompatible SessionState objects** from the same `issueSession` function. Whether `supabaseRefreshToken` is present or absent changes runtime behavior in:

- `handleMichaelToken` — two completely different code branches
- `ensureSupabaseAccessToken` — hard fails if `supabaseRefreshToken` is null
- `handleMeEmailChange` — calls `ensureSupabaseAccessToken`, will 503 on Google-path sessions
- `handleRefresh` — V1 token migration path re-seeds KV from a Supabase token in the payload

The router is unified but the session semantics are split. Any feature that needs to call `ensureSupabaseAccessToken` will silently fail for Google-path users. Right now that includes email change. This will grow.

**Fix:** `SessionState` needs an explicit discriminator field — `authMode: 'google_direct' | 'supabase_bridge'` — and code that touches Supabase-bridged behavior must branch explicitly on it, not implicitly on `supabaseRefreshToken` presence. Functions like `handleMeEmailChange` need to know which auth mode is active and either use a different Supabase API call or reject cleanly.

---

## 2. `handleMichaelToken` — Security Surface That Needs Attention

This is the most sensitive route in Berlin. It hands out either a live Supabase user access token or the Supabase service-role key. Read this carefully:

```typescript
// Path 1: Supabase-bridged session
if (hasSupabaseSessionBridge) {
  const ensured = await ensureSupabaseAccessToken(env, principal.session);
  return json({ accessToken: ensured.accessToken, tokenKind: 'supabase_user' });
}

// Path 2: Google-path session — falls back to service-role key
if (!isTrustedRomaMichaelTokenRequest(request, env)) {
  return authError('contextUnavailable', 503, 'supabase_session_unavailable');
}
const serviceRoleKey = resolveSupabaseServiceRoleKey(env);
return json({ accessToken: serviceRoleKey, tokenKind: 'internal_service_role' });
```

`isTrustedRomaMichaelTokenRequest` checks:
1. `x-ck-internal-service: roma.edge` header
2. `CK_INTERNAL_SERVICE_JWT` env var match — **but the comment says "Cloud-dev Roma does not currently carry CK_INTERNAL_SERVICE_JWT"**
3. If `expected` (the JWT) is empty, falls back to **heuristic browser detection**: rejects if request has `origin`, `sec-fetch-site`, `sec-fetch-mode`, or `sec-fetch-dest` headers

This means in cloud-dev, any server-to-server request that sets `x-ck-internal-service: roma.edge` and lacks those four browser headers will receive the Supabase service-role key, which has full database access. The `CK_INTERNAL_SERVICE_JWT` guard that makes this safe is not configured in cloud-dev.

**This is not a current exploit** — Berlin is not publicly accessible on a path that would let external callers set arbitrary headers. But it is a misconfiguration that should be fixed before production: `CK_INTERNAL_SERVICE_JWT` must be set in every deployed environment, and the heuristic browser fallback should be removed entirely.

---

## 3. `resolveProductUserForIdentity` — The Hand-Rolled Distributed Transaction

This is the first-login path. What it does, in order:

```
1. loadLoginIdentity(provider, providerSubject)        // SELECT from login_identities
2. Compute userId (existing or new UUID)
3. upsertUserProfile(userId, profile)                  // POST with on_conflict=merge-duplicates
4. writeLoginIdentity(userId, identity)                // POST or PATCH login_identities
   → if this fails AND we didn't have an existing identity:
       5. loadLoginIdentity again                       // race re-read
       6. if winning row found: upsertUserProfile(racedUserId)
       7.                        writeLoginIdentity(racedUserId)
       8.                        loadExistingUserProfile(racedUserId)
       → return racedUserId
9. loadExistingUserProfile(userId)
→ return userId
```

That is **up to 8 sequential Supabase HTTP calls** on a first login, with a manual optimistic-write + conflict + re-read + retry pattern. The race condition it defends against is: two concurrent first-logins for the same provider identity arriving simultaneously and both trying to INSERT to `login_identities`.

The correct fix at the database layer is:
```sql
INSERT INTO login_identities (user_id, provider, provider_subject, ...)
VALUES (...)
ON CONFLICT (provider, provider_subject) DO UPDATE SET last_used_at = EXCLUDED.last_used_at
RETURNING user_id, id
```

One round trip. No application-level race handler. The `user_id` returned is authoritative regardless of which concurrent request "won."

The current 8-step approach is not wrong — it will converge — but it is fragile to partial failures at each step, and the error messages at step 6-8 are confusing because the profile and identity writes are retried for a `userId` that wasn't the one originally computed.

---

## 4. `buildBootstrapPayload` — The Serialized Database Gauntlet

Every call to `GET /v1/session/bootstrap` runs this waterfall in sequence, **not in parallel**:

```
1. loadUserProfileRow(userId)              // SELECT user_profiles
2. loadAccountMembershipRows(userId)       // paginated SELECT account_members JOIN accounts
3. normalizeUserProfile(...)
4. normalizeAccounts(...)
5. loadUserContactMethods(userId)          // SELECT contact_methods
6. loadPrincipalIdentities(session)        // paginated SELECT login_identities
7. resolvePolicy(tier, role)
8. resolveSigningContext(env)              // isolate-cached, fast after first call
9. mintRomaAccountAuthzCapsule(...)        // RSA sign — most expensive step
```

Steps 1, 2, 5, and 6 are all independent database reads. They run sequentially. Steps 1+2+5+6 could run as `Promise.all([...])` and cut bootstrap latency roughly in half on warm connections.

Step 9 (RSA signing) happens on every bootstrap call. The capsule has a 15-minute TTL (`ROMA_AUTHZ_CAPSULE_TTL_SEC = 900`). There is no cache. Every `/v1/session/bootstrap` call pays the full RSA signing cost. Cache the capsule in KV against `${userId}:${accountId}:${authzVersion}` with a TTL slightly shorter than the capsule's own expiry and skip the sign on a cache hit.

---

## 5. The V1 Refresh Token Zombie

In `verifyRefreshToken`, when `version === 1`:

```typescript
if (version === 1) {
  // ...validation...
  if (!claimAsString((parsed as RefreshPayloadV1).supabaseRefreshToken)) {
    return { ok: false, reason: 'payload' };
  }
  return { ok: true, payload };
}
```

And in `handleRefresh`, when `payload.v === 1`:

```typescript
if (!state && payload.v === 1) {
  // reconstitute session state from the token itself
  state = {
    sid: payload.sid,
    currentRti: payload.rti,
    userId: payload.userId,
    revoked: false,
    supabaseRefreshToken: payload.supabaseRefreshToken,  // ← Supabase token was in the client-visible payload
    ...
  };
  await saveSessionState(env, state);
  await addUserSessionId(env, state.userId, state.sid);
}
```

V1 tokens had `supabaseRefreshToken` directly embedded in the HMAC-signed refresh token body. That body is base64url-encoded and client-visible (not encrypted). Any client that decoded the refresh token in V1 could read the Supabase refresh token directly. V2 fixed this by moving the Supabase token server-side into KV only.

The V1 reconstitution code also **bootstraps a brand new KV session from a token payload**, bypassing the normal session creation flow. If a V1 token is presented and no KV session exists, Berlin silently creates one. This means the session was never properly registered — the user session index (`USER_INDEX_KV_PREFIX:${userId}`) was never written at V1 issuance time, so `revokeSessionsByUserId` will not find it.

**Action:** Audit whether any V1 tokens can still be presented (check `REFRESH_TOKEN_TTL_SECONDS` — if it's 30 days, V1 tokens issued up to 30 days ago are still valid). Then delete the V1 branch.

---

## 6. Session KV — What Happens Under Eventual Consistency

`session-kv.ts` uses `BERLIN_SESSION_KV` (Cloudflare KV) for all session state: load, save, revoke.

KV global replication latency is up to 60 seconds in the worst case (typically ~1-3s). Two specific scenarios become races:

**Scenario A — Concurrent refresh at the grace window boundary:**
- User has two open browser tabs.
- Both tabs detect an expired access token simultaneously.
- Tab A sends refresh → `rotateRefreshRti` computes nextRti, writes new session state to KV.
- Tab B sends refresh 200ms later, lands in a different PoP before replication completes.
- Tab B reads stale KV state, sees `currentRti === old RTI`, computes the same `nextRti` (deterministic HMAC derivation is correct), lands in the grace window branch, converges.
- This works correctly **only within `REFRESH_RTI_GRACE_MS`**. The grace window is the defense. Verify it's set long enough for worst-case KV replication (the constant is in `types.ts`; needs to be >= 60s to be safe, ideally 120s).

**Scenario B — Revocation not propagating before next request:**
- Admin calls `POST /internal/control/users/:userId/revoke-sessions`.
- `revokeSessionsByUserId` writes `revoked: true` to KV for each sid.
- User's next request lands at a PoP that hasn't seen the revocation write yet.
- `resolvePrincipalSession` calls `loadSessionState` → reads stale non-revoked state → accepts the token.
- User gets one more request through after revocation.

For most use cases this is acceptable. For a security revocation scenario (compromised account) it is not. If strong revocation is a hard requirement, the session index and session state need to be in a Durable Object, not KV. The `BerlinAuthTicketDO` already demonstrates the pattern.

---

## 7. `account-state.ts` — Two `UserProfileRow` + Two `normalizeProfileLocation`

`account-reconcile.ts` defines:
```typescript
type UserProfileRow = {
  user_id?: unknown; primary_email?: unknown; email_verified?: unknown;
  display_name?: unknown; given_name?: unknown; family_name?: unknown;
  primary_language?: unknown; country?: unknown; timezone?: unknown;
  active_account_id?: unknown;
};
```

`account-state.ts` defines its own `UserProfileRow` with a slightly different field set (no `display_name`). These are not the same type and are not linked. A schema change to `user_profiles` requires updating both in sync.

`normalizeProfileLocation` is also defined separately in both files with **different implementations**:
- `account-reconcile.ts` version: calls `normalizeUserSettingsCountry` then `normalizeTimezone` (uses its own local `normalizeTimezone`)
- `account-state.ts` version: calls `normalizeUserSettingsCountry` then `asTrimmedString` directly on the raw timezone value

The two implementations will produce different output for the same input. There is no test coverage to catch divergence.

Both should be one function in `helpers.ts`.

---

## 8. `loadPrincipalAccountState` — Called Twice Per Account Management Request

Every handler in `routes-account.ts` that needs account context calls `resolvePrincipalState`, which calls `loadPrincipalAccountState`. Several handlers then call it **a second time** after a write:

```typescript
// handleAccountCreate
const provisioned = await provisionOwnedAccount(...);
const state = await loadPrincipalAccountState(...)   // ← second full DB round-trip
const account = findAccountContext(state.value, accountId);
```

```typescript
// handleMeUpdate
const writeError = await patchUserProfile(...);
const refreshed = await loadPrincipalAccountState(...)  // ← second full DB round-trip
```

`loadPrincipalAccountState` is not cheap — it does a paginated join query across `account_members + accounts` plus a `user_profiles` read. Calling it twice per request on the write handlers doubles the DB cost. For `handleAccountCreate`, the second call is just to find the newly created account — the provisioned `accountId` is already known and the account shape can be reconstructed from local data without a re-read.

---

## 9. `handlePasswordLogin` — Active But Orphaned

`POST /auth/login/password` is live in the router. It:
1. Calls Supabase password grant
2. Calls Supabase user endpoint
3. Calls `ensureProductAccountState(supabaseUserResponse)` — the **Supabase-user-shape** reconciliation path
4. Issues a session with Supabase tokens embedded

This path is structurally different from the Google PKCE path and will produce a `supabase_bridge` session. As Google becomes the canonical login path, this route is either:
- A deliberate fallback for testing / admin login
- Dead code that's waiting to be removed

It is not marked as either. The comment in `isTrustedRomaMichaelTokenRequest` says "Cloud-dev Roma does not currently carry `CK_INTERNAL_SERVICE_JWT`" — which implies password login is still being used in cloud-dev since it produces sessions that can use the Supabase bridge. If Google PKCE is the product path, password login should be explicitly marked as an internal-only or dev-only route and gated behind an env flag, not silently live.

---

## 10. Route Dispatch — String Matching Without a Framework

`route-dispatch.ts` is 180 lines of `if (pathname === ...)` and `pathname.match(/^.../)` chains with no route table, no middleware abstraction, and no typed parameter extraction. This works today because Berlin has one developer. It will become a maintenance problem as routes multiply. The specific issue is that adding a new route requires scanning the entire chain to understand ordering, and there is no central list of what routes exist — they are scattered through the file as regex matches.

This is low priority but worth noting: at some point a simple route table (`{ method, pattern, handler }[]`) would make the dispatch logic legible at a glance and eliminate the risk of a new route shadowing an existing one.

---

## 11. Priority Order

These are ranked by what is blocking the product right now, not by theoretical severity.

| Priority | Issue | File(s) | Impact |
|---|---|---|---|
| P0 | Dual session path — `handleMeEmailChange` and any future Supabase-dependent feature silently fails on Google-path sessions | `auth-session.ts`, `routes-account.ts` | Blocks email change on Google users |
| P0 | `CK_INTERNAL_SERVICE_JWT` not set in cloud-dev — service-role key heuristic guard active | `routes-session.ts` | Security misconfiguration in deployed env |
| P1 | Bootstrap waterfall — sequential DB reads, no capsule caching | `account-state.ts` | Every login and page load pays full RSA sign cost |
| P1 | V1 refresh token path still live with Supabase token in payload | `jwt-crypto.ts`, `routes-session.ts` | Security debt; session index bypass |
| P1 | `resolveProductUserForIdentity` — 8 sequential HTTP calls on first login | `account-reconcile.ts` | First login latency + fragile race handler |
| P2 | `loadPrincipalAccountState` called twice per write handler | `routes-account.ts` | Double DB cost on account create / profile update |
| P2 | Two `UserProfileRow` types + two `normalizeProfileLocation` implementations diverging silently | `account-reconcile.ts`, `account-state.ts` | Schema change requires two updates; logic divergence |
| P3 | `handlePasswordLogin` not marked as dev/internal-only | `routes-login.ts` | Ambiguity about which path is canonical |
| P3 | Route dispatch as linear regex chain | `route-dispatch.ts` | Maintainability |

---

## What Berlin Looks Like When It's Done

The session machinery (`jwt-crypto.ts`, `auth-session.ts`, `session-kv.ts`) is already clean and correct. The Google PKCE flow (`provider-google.ts`, `routes-login.ts` PKCE branch) is correct. The finish-ticket pattern is correct.

What needs work is the **seam** between the old Supabase-bridge session model and the new direct-provider model. Right now that seam is implicit (presence/absence of `supabaseRefreshToken`). Making it explicit with a discriminator field, removing the V1 path, setting `CK_INTERNAL_SERVICE_JWT` in all envs, and caching the bootstrap capsule will close the four highest-priority issues.

The account management surface (`account-members.ts`, `account-invitations.ts`, `account-locales.ts`, `contact-methods.ts`) is fine where it is for now — the business logic is cleanly separated from auth concerns. Moving it elsewhere is a future optimization, not a current blocker.
