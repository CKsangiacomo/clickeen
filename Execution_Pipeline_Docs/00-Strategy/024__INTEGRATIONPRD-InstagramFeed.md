# INTEGRATIONPRD — Instagram Feed Widget
Version: v0.2 (Integration-focused)  
Owner: Clickeen (Widget Platform)  
Status: Draft for implementation planning

---

## 1) Summary
This document defines the **Instagram integration layer** for the Instagram Feed widget, including:

- **Data source types**: Profile and Hashtag
- **Refresh limits** enforced by tier (TTL + quota)
- Optional **Connected Mode (OAuth)** for paid tiers
- A platform-aligned architecture using **Venice as the browser-facing gateway** and **Paris as the privileged integration service**

This is an **integration PRD** (service + contracts + policy). UI/UX styling and layout behavior remain in the main widget PRD.

---

## 2) Goals
1. Support **Instagram feed rendering** from two user-selectable sources:
   - **Profile** (username)
   - **Hashtag** (tag)

2. Implement **predictable freshness** with tier-based controls:
   - Free: **once/day** refresh (and/or 24h TTL)
   - Paid tiers: higher refresh frequency and optional manual refresh bursts

3. Offer **Connected Mode** (OAuth) on paid tiers where feasible to improve reliability and unlock capabilities (e.g., hashtags).

4. Enforce platform constraints:
   - Widget runtimes/browsers communicate with **Venice** only
   - Privileged token storage, rate limiting, caching, and external calls happen in **Paris** (or in a backend service behind Venice)

---

## 3) Non-goals
- Finalizing the full widget editor UX (handled in main widget PRD)
- Building an Agency dashboard (future)
- Supporting arbitrary third-party “scrape” integrations that violate provider terms
- Guaranteeing access to private content without explicit provider-supported authorization

---

## 4) Key Product Decisions
### 4.1 Source type
User selects one of:
- **Profile feed**
- **Hashtag feed**

### 4.2 Refresh model
Refresh is governed by two controls:
1. **TTL (time-to-live)** — minimum age required before auto-refresh is allowed
2. **Quota** — maximum number of “force refresh” actions in a window

Both are enforced **server-side** (Paris), derived from entitlements for the workspace/instance.

### 4.3 OAuth / Connected Mode
- **Paid tiers** can unlock **Connect Instagram** (OAuth) where supported by the provider API.
- Hashtag feeds are typically only available/reliable in Connected Mode.
- Tokens are stored encrypted server-side; the widget never receives provider tokens.

---

## 5) User Stories
### 5.1 Source selection
- As a user, I can select **Profile** and enter a username to show recent posts.
- As a user, I can select **Hashtag** and enter a tag to show recent posts for that hashtag (if allowed by plan + provider capability).

### 5.2 Freshness control
- As a free user, I can refresh at most **once per day**.
- As a paid user, I can refresh more frequently and optionally trigger **manual refresh now** (within quota).

### 5.3 Connect account (paid)
- As a paid user, I can connect Instagram (via OAuth) so the feed is more reliable and can unlock features (e.g., hashtags) when the provider supports it.

---

## 6) Entitlements & Plan Matrix
Entitlements live in the global entitlement matrix and are checked in Paris at runtime.

### 6.1 Proposed entitlement keys
| Key | Type | Meaning |
|---|---:|---|
| `instagram.profile.enabled` | bool | Allow profile as source |
| `instagram.hashtag.enabled` | bool | Allow hashtag as source |
| `instagram.oauth.enabled` | bool | Allow account connect flow |
| `instagram.refresh.ttlMinutes.min` | int | Minimum TTL between automatic refreshes |
| `instagram.refresh.forcePerDay.max` | int | Manual/forced refresh max per day |
| `instagram.refresh.forcePerHour.max` | int | Optional burst limit |
| `instagram.cache.ttlMinutes.default` | int | Default cache TTL (if not overridden) |

### 6.2 Suggested plan defaults
You can tune these values after observing real-world load.

| Plan | Profile | Hashtag | OAuth | TTL (min) | Force/day | Force/hour |
|---|---|---|---|---:|---:|---:|
| Free | Yes | No | No | 1440 (24h) | 1 | 0 |
| Starter | Yes | Optional | Optional | 360 (6h) | 6 | 1 |
| Pro | Yes | Yes | Yes | 60 (1h) | 24 | 4 |
| Business | Yes | Yes | Yes | 15 | 96 | 12 |

**Notes**
- TTL is the minimum time between **background refreshes** for a given source+instance.
- Force refresh uses quota and can override TTL (but still respects burst caps).

---

## 7) Data Model
### 7.1 Instance config (widget state)
The widget stores only **configuration**; not provider tokens; not refresh timestamps.

```ts
type InstagramSource =
  | { type: "profile"; username: string }
  | { type: "hashtag"; tag: string };

interface InstagramFeedConfig {
  source: InstagramSource;
  maxPosts: number;                 // e.g., 12
  filterType: "all" | "image" | "video";
  hidePostIds: string[];            // user-managed hidden items
  // ...existing layout/post/appearance/settings from main PRD...
}
```

### 7.2 External data (cached dataset)
Paris stores or can derive dataset payload; Venice returns a normalized shape to the widget.

```ts
type InstagramMediaType = "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";

interface InstagramExternalPost {
  id: string;
  caption?: string;
  mediaType: InstagramMediaType;
  mediaUrl?: string;        // required for VIDEO, optional for IMAGE depending on policy
  thumbnailUrl?: string;    // required for IMAGE and previews
  permalink: string;
  timestamp: string;        // ISO string
  // Optional if provider returns:
  width?: number;
  height?: number;
  children?: Array<{ id: string; mediaUrl?: string; thumbnailUrl?: string; mediaType: InstagramMediaType }>;
}

interface InstagramExternalData {
  posts: InstagramExternalPost[];
  lastUpdated: string;      // ISO
  nextRefreshAllowedAt?: string; // ISO (computed from entitlements/quota)
  sourceEcho: { type: "profile" | "hashtag"; value: string }; // normalized
  warnings?: string[];      // e.g., "HASHTAG_REQUIRES_CONNECT"
}
```

### 7.3 Cache key
Cache should be keyed by:
- `workspaceId`
- `instanceId`
- `source.type`
- `source.value` (username or hashtag)
- provider “mode” (public vs connected)
- `filterType` (optional: can post-filter instead of cache-splitting)

---

## 8) System Architecture
### 8.1 High-level flow (runtime)
1. Widget renders on publisher site.
2. Widget requests dataset from **Venice** (browser → Venice).
3. Venice authenticates request, attaches workspace/instance context, forwards to Paris integration service.
4. Paris returns cached dataset; if stale and permitted, Paris refreshes from provider and updates cache.
5. Venice returns normalized dataset to widget runtime.

### 8.2 Editor flow (preview)
Editor preview should use the same Venice endpoints to avoid special-case behavior and to preserve the “browser hits Venice only” constraint.

### 8.3 Token handling (Connected Mode)
- OAuth occurs through a Venice route that redirects to provider.
- Callback handled by Venice → Paris token store.
- Tokens are encrypted at rest; never returned to widget runtime.
- Paris uses tokens to call provider APIs to fetch profile/hashtag feeds.

---

## 9) API Contracts (Venice)
All endpoints below are **browser-facing**. Venice can proxy to Paris.

### 9.1 Fetch dataset (read)
`GET /v1/integrations/instagram/feed`
- Query params:
  - `instanceId` (or derived from widget runtime token)
  - `sourceType=profile|hashtag`
  - `sourceValue=<username|tag>`
  - `maxPosts=<n>`
  - `filterType=all|image|video`
- Response: `InstagramExternalData`
- Behavior:
  - Returns cached data fast.
  - May include `nextRefreshAllowedAt` when stale but blocked.

### 9.2 Force refresh (write)
`POST /v1/integrations/instagram/refresh`
- Body:
  - `instanceId`
  - `sourceType`
  - `sourceValue`
- Response: `InstagramExternalData`
- Behavior:
  - Enforces quota + burst caps.
  - If blocked: return `409 REFRESH_BLOCKED` with `nextRefreshAllowedAt` and `reasonCode` (see 10.2).

### 9.3 OAuth connect initiation (paid)
`GET /v1/integrations/instagram/connect`
- Params:
  - `instanceId`
  - `redirectUri` (back to editor UI)
- Behavior:
  - Initiates provider OAuth

### 9.4 OAuth callback
`GET /v1/integrations/instagram/callback`
- Provider-specific params
- Behavior:
  - Exchanges code for tokens and stores via Paris
  - Redirects user back to editor UI with status

### 9.5 Disconnect
`POST /v1/integrations/instagram/disconnect`
- Body: `instanceId`
- Behavior: deletes stored tokens & invalidates caches.

---

## 10) Paris Integration Service (implementation requirements)
Paris (or a backend behind Venice) is responsible for:
- Entitlement evaluation (workspace/instance)
- Quota & TTL enforcement
- Provider API calls
- Cache management
- Token storage (Connected Mode)
- Normalizing provider payload → `InstagramExternalData`

### 10.1 Provider strategy
Two modes (you can ship progressively):
1. **Connected Mode (OAuth)** — recommended baseline for reliability and features.
2. **Public Mode (no OAuth)** — optional and “best effort” only if provider allows a compliant method.

### 10.2 Standard error model
When blocked or failing, return structured errors that Bob can use to upsell.

Example `409 REFRESH_BLOCKED` payload:
```json
{
  "error": "REFRESH_BLOCKED",
  "reasonCode": "QUOTA_EXCEEDED" | "TTL_NOT_ELAPSED" | "PLAN_RESTRICTED",
  "nextRefreshAllowedAt": "2026-01-20T03:00:00Z",
  "upgradeHint": "Pro"
}
```

### 10.3 Quota algorithm (recommended)
- Maintain counters by (workspaceId, instanceId, sourceKey):
  - `force_refresh_count_day`
  - `force_refresh_count_hour`
- Implement rolling windows or calendar windows; calendar day is fine for v0.1.
- TTL rule:
  - If cache age < `ttlMinutes.min`, block background refresh.
  - Force refresh may bypass TTL but counts against quota.

---

## 11) Performance, Caching, and Rate Limiting
### 11.1 Caching
- Cache normalized dataset (posts list) with timestamps.
- Cache should survive brief outages and avoid repeated provider calls.

### 11.2 Provider rate limiting
- Provider APIs will impose rate limits; design assumes limits exist and are strict.
- Paris must:
  - Deduplicate inflight refreshes (singleflight) per cache key
  - Backoff on provider 429/5xx
  - Return cached content when refresh fails, with `warnings`

---

## 12) Security & Compliance
- Store OAuth tokens encrypted at rest.
- Do not expose tokens to widget runtime.
- Validate and sanitize inputs:
  - username: `[A-Za-z0-9._]{1,30}` (example; confirm with provider)
  - hashtag: `[A-Za-z0-9_]{1,50}`; no spaces; strip leading `#`
- Audit log refresh and connect/disconnect actions for troubleshooting.

---

## 13) UX Requirements (integration-driven)
These requirements must exist in the editor and/or preview for a coherent integration experience:
- Show **Last Updated**
- Show **Next refresh available** when blocked
- Provide a **Refresh now** button (if plan allows)
- Provide a **Connect Instagram** action when `instagram.oauth.enabled=true`
- For Hashtag:
  - If OAuth is required by plan/provider: present connect gating and upgrade gating

---

## 14) Rollout Plan
### Phase 1 (MVP)
- Profile source only
- Free-tier: once/day refresh (TTL 24h)
- Venice read endpoint + Paris caching/quota enforcement
- No OAuth

### Phase 2
- Paid-tier refresh expansion
- Manual “Refresh now” with quota enforcement
- Add OAuth connect for reliability (if desired)

### Phase 3
- Hashtag source (typically gated behind OAuth)
- Additional improvements: better carousel behaviors, video playback rules, post hiding UI improvements

---

## 15) Observability & Metrics
Track per workspace and globally:
- `instagram_feed_requests_total`
- `instagram_refresh_attempts_total`
- `instagram_refresh_blocked_total` by reason
- cache hit rate
- provider error rates (429, 5xx)
- average fetch latency (Venice and Paris)

---

## 16) Test Plan
- Unit tests:
  - quota logic
  - TTL logic
  - cache key normalization
  - input validation
- Integration tests (staging):
  - read returns cached data
  - refresh increments quota and blocks at cap
  - OAuth connect/disconnect (Phase 2+)
- UI contract tests:
  - error mapping to “Next refresh available” and “Upgrade” prompts

---

## 17) Open Questions (answer before implementation)
1. Do we commit to **Connected Mode first** (recommended), or do we ship **Public Profile** MVP first?
2. Are we willing to restrict hashtags to OAuth-only?
3. Do we need width/height in post data to support “original aspect ratio” in layout logic?
4. What is the required auth mechanism from widget runtime → Venice (instance token, signed request, etc.)?
5. What are the exact plan names and how do entitlements map to billing today?

---

## Appendix A — Recommended PRD Patch Notes for Main Widget PRD
- Expand `source` schema to include `type=profile|hashtag`
- Replace “Bob calls Paris during editing” with “Browser calls Venice; Venice proxies to Paris”
- Replace multi-breakpoint CSS with single 900px breakpoint behavior
- Add “Last updated / Refresh now / Connect” UX requirements
