# PRD — Connectors: Universal Data Sources (URL / API / OAuth) + Policy Gating

Status: Draft (planning-only; not executed)
Owner: Clickeen core platform
Peer reviewers: (TBD)

Related:
- `Execution_Pipeline_Docs/00-Strategy/007__PRD_Multitenancy_and_SubjectPolicy_System.md`
- `documentation/capabilities/multitenancy.md`
- Competitor reference catalogs:
  - [SociableKIT Widgets](https://www.sociablekit.com/widgets/)
  - [Elfsight Social Widgets](https://elfsight.com/widgets/social/)

---

## 0) Summary (1 paragraph)
Competitors present “90+ widgets”, but much of the work is repeatable: a **data acquisition layer** (connect to a source) + a **renderer layer** (feed/list/grid/carousel/etc.) + **skin**. This PRD defines **Connectors** as a universal platform primitive: a connector family (e.g. Google Reviews) can support multiple connection modes (**URL fetch**, **API**, **OAuth**) with increasing benefits. Widgets render a normalized dataset from a connector; policy controls which modes are allowed per surface/tier (e.g. MiniBob URL-only; Free limited; paid full).

---

## 1) Goals / Non-goals

### Goals
- Define **Connector** as a first-class platform capability reused across many widgets/artifacts.
- Define the persistence rule: **connectors (connections) exist only for account workspaces**, and are stored at **workspace level** so they can be reused by multiple widgets.
- Support multiple **connection modes** per connector family:
  - `url` (paste a link)
  - `api` (server credentials / API key)
  - `oauth` (workspace-level user-granted connection)
- Define a durable **normalized dataset** output contract so widgets render deterministically without per-source logic.
- Define how **policy gating** applies:
  - MiniBob: allow URL-only (bounded demo)
  - Free: allow some modes with caps/budgets
  - Paid: allow full “juice” (OAuth/API, higher freshness/fields/caps)
- Define a scalable path to “90 widgets without 90 engines”.

### Non-goals (v1)
- Implementing any specific connector in code (this PRD is planning-only).
- Solving scraping legality/ToS in detail (must be handled per connector).
- Building the full billing system (uses existing policy architecture).
- Finalizing which connectors we ship first.

---

## 2) Core concepts

### 2.0 Connector vs Connection (do not mix)
We use two related terms:
- **Connector family**: a capability that knows how to acquire + normalize a data domain (e.g. `instagram_feed`, `google_reviews`).
- **Workspace connection**: a persisted workspace-level object that stores the user’s chosen source and any required credentials/references, so multiple widgets can reuse it.

Hard rule:
- **Persisted connections require an account (workspace)**. Anonymous MiniBob sessions may allow URL entry for demo, but it is **ephemeral** (not saved/reusable across widgets).

### 2.1 Connector family vs connection mode
- **Connector family**: “what data domain we want”, e.g. `google_reviews`, `instagram_feed`, `linkedin_posts`, `youtube_gallery`, `rss_feed`.
- **Connection mode**: “how we acquire that data”, e.g. `url` vs `api` vs `oauth`.

Why this matters:
- The same “Google Reviews” output can be obtained via a public URL (fast onboarding) or via Places API / OAuth (richer, more stable).

### 2.2 Connector output is a normalized dataset
Widgets must not encode “how Google works” or “how Instagram works”.
They render a **normalized dataset**:

Examples of normalized dataset types (illustrative):
- `Review[]`
- `Post[]`
- `Video[]`
- `Event[]`
- `Product[]`

Each dataset is:
- **deterministic** for a given connector snapshot (no randomness)
- **schema-stable** across connection modes (a richer mode may fill more fields, but does not break the schema)

### 2.3 Reuse pattern (the “rinse and repeat” reality)
Competitor catalogs suggest that many “different widgets” are really:

> Renderer Type (feed/list/grid/carousel/ticker)  
> + Connector family (Instagram/Google/LinkedIn/etc.)  
> + Skin preset

We should model exactly that, rather than building bespoke engines per “widget name”.

---

## 3) Product model: what the user experiences

### 3.1 Onboarding ladder (upgrade lever)
For a given connector family, the user can start with a low-friction mode and upgrade later:

- **Mode: URL**
  - UX: paste a link / handle
  - Benefits: instant onboarding
  - Limitations: brittle, fewer fields, lower refresh reliability

- **Mode: API**
  - UX: connect via workspace credentials (or platform-managed keys)
  - Benefits: structured data, stable paging, predictable refresh
  - Limitations: requires key/billing/quota management

- **Mode: OAuth**
  - UX: “Connect your account” with a workspace-level connection
  - Benefits: best UX, richer permissions/scopes (varies by provider), reliable refresh
  - Limitations: token lifecycle, revocation, scope complexity

### 3.2 Policy gating (MiniBob vs Free vs Paid)
Policy determines which mode buttons are allowed, and which are Upsell-gated:
- **MiniBob**: URL-only (ephemeral; not persisted as a workspace connection)
- **Free**: URL + ability to create persistent workspace connections (limited caps/budgets)
- **Paid**: full (OAuth/API), higher caps and budgets

This uses the platform rule: **full entitlement UI is visible; gating happens on interaction via a single Upsell popup** (no inline errors, no hidden buttons).

---

## 4) Architecture model (how it fits Clickeen)

### 4.1 Separation of concerns
- **Widgets (Tokyo 5-file packages)**: render deterministic DOM/CSS/JS from **state + dataset**.
- **Connectors (platform)**: acquire/normalize/cache datasets.
- **Policy engine (`@clickeen/ck-policy`)**: gates modes, caps, budgets, and actions consistently.

### 4.2 Where connector logic runs (proposal)
We should keep widgets “dumb” and keep connector execution in platform services:
- Paris: authoritative API gateway (auth, workspace membership, policy, persistence)
- Venice: embed assembly runtime (public rendering; may request connector snapshots)
- (Optional) dedicated connector service later if needed

This PRD does not lock the exact service boundary, but it enforces the separation: **connector != widget**.

### 4.3 Connection objects (workspace-level)
OAuth/API credentials should be stored as workspace-level “connections”:
- One workspace connects to Meta once, and multiple connectors can reuse it (Instagram + Facebook sources).

This avoids per-widget OAuth duplication.

Additional rule (durable):
- Widgets store **references** to workspace connections (or embed the ephemeral URL input for MiniBob-only demo flows). Widgets do not store OAuth tokens or API keys in instance config.

---

## 5) Data contracts (planning-level)

### 5.1 Instance config shape (illustrative)
Widgets reference a connector via a source block:

```ts
type SourceConfig = {
  provider: string; // e.g. 'google_reviews'
  mode: 'url' | 'api' | 'oauth';
  input: unknown; // mode-specific input
  options?: {
    maxItems?: number;
    filters?: Record<string, unknown>;
  };
};
```

Examples:
- Google Reviews URL:
  - `provider='google_reviews'`
  - `mode='url'`
  - `input={ url: 'https://…' }`
- Google Reviews API:
  - `provider='google_reviews'`
  - `mode='api'`
  - `input={ placeId: '…', credentialsRef: 'workspace-cred-…' }`
- Instagram Feed OAuth (via Meta connection):
  - `provider='instagram_feed'`
  - `mode='oauth'`
  - `input={ connectionId: 'workspace-connection-meta-…', igAccountId: '…' }`

### 5.2 Connector snapshot contract (illustrative)
Connectors should produce a snapshot:
- `datasetType` (e.g. `reviews`)
- `items[]` (normalized)
- `fetchedAt`, `ttlSeconds`, `sourceDebug` (optional; not exposed to embeds if sensitive)

Widgets render `items[]` according to their Type variants and skin.

---

## 6) Policy keys (planning-level)

We need durable policy keys that scale across many connectors.

Suggested scheme:
- **Mode gating** (per connector family):
  - `connector.<provider>.mode.url.enabled`
  - `connector.<provider>.mode.api.enabled`
  - `connector.<provider>.mode.oauth.enabled`
- **Connection-level caps** (workspace):
  - `workspace.connections.max`
  - `workspace.connections.<provider>.max`
- **Budgets**:
  - `platform.connectorRefreshes` (or per-provider budgets)
  - `platform.copilotTurns` (already exists conceptually)

PRDs should not invent keys; keys must be registered in the shared capability registry.

---

## 7) Developer LOE (rough)
Planning-level estimate for platform v1:
- Registry + policy keys + gating UI wiring: **2–5 days**
- Connection storage model (workspace connections) + minimal APIs: **3–7 days**
- One connector family end-to-end (e.g. Google Reviews URL mode only): **3–10 days** (depends heavily on acquisition method)
- One renderer widget that consumes a normalized dataset (if not already): **3–10 days**

Total depends on how many connectors and which modes we attempt first. The “hard” work is always acquisition + caching + ToS constraints.

---

## 8) Why this is scalable / elegantly engineered
- **No duplication**: connectors are reused across many renderer types and skins.
- **Composability**: “new widget” often becomes a new connector + existing renderer Type variants.
- **Clean upsell lever**: upgrade the connection mode for better quality and reliability.
- **Policy-driven**: surfaces/tier gating stays centralized and consistent.
- **Future-proof**: same architecture works for widgets, emails, ads, landing pages—anything that renders a dataset + skin.

---

## 9) Open decisions (explicit yes/no)
1) Do we allow URL scraping modes at all for sensitive providers, or only for “safe” sources (RSS/public pages)?
2) Which connector family do we ship first (Google Reviews vs Instagram Feed vs RSS)?
3) For Free tier: do we allow OAuth/API at all, or only URL with higher caps?

