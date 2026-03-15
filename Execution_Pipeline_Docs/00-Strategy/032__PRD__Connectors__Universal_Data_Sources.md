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

---

## 10) Web Presence Connector — Cloudflare Browser Rendering crawl mode

### What it is

Cloudflare Browser Rendering added a `/crawl` endpoint (open beta, March 2026).

Submit a starting URL → Cloudflare discovers, headless-renders, and returns all reachable pages as HTML, Markdown, or structured JSON. Async: submit → get job ID → poll results. Respects robots.txt. Available on Workers Free and Paid.

Reference: https://developers.cloudflare.com/changelog/post/2026-03-10-br-crawl-endpoint/

### How it fits the connector model

This is a `url` connection mode for a new connector family: `web_presence`.

- Connector family: `web_presence`
- Connection mode: `url` (the account's own website URL — no OAuth, no API key)
- Output: normalized `WebPresenceSnapshot` — structured facts extracted from the site

The crawl runs inside a Worker, costs nothing beyond the Cloudflare plan, and produces structured JSON output via Workers AI extraction. It fits the existing connector architecture without adding any new infrastructure.

### Normalized output contract (illustrative)

```ts
type WebPresenceSnapshot = {
  primaryLanguage: string;        // e.g. 'en', 'it'
  detectedCountry: string | null; // from content/currency/address signals
  businessCategory: string | null;// e.g. 'restaurant', 'dentist', 'retail'
  brandTone: string | null;       // e.g. 'formal', 'casual'
  platformLinks: {                // social/platform links found on the site
    provider: string;             // e.g. 'instagram', 'google', 'facebook'
    url: string;
  }[];
  contentThemes: string[];        // top recurring topics/keywords
  existingLanguages: string[];    // language variants detected on the site
};
```

Widgets do not receive raw crawl HTML. They receive only the normalized snapshot.

### Where this connects to the rest of the platform

**Berlin (PRD 064 — account intelligence):**
The normalized `WebPresenceSnapshot` is a Berlin-owned account trait. On first account creation, Berlin can trigger a web presence crawl of the account's website URL and store the normalized output as part of the account's trait set. This seeds the account intelligence plane without requiring the user to fill out a form.

**Locale policy (Tokyo/l10n):**
`primaryLanguage`, `detectedCountry`, and `existingLanguages` can pre-populate the account's locale policy defaults, removing the need for manual locale configuration on signup.

**Widget recommendations (SanFrancisco):**
`platformLinks` reveals which social platforms the account already uses, allowing AI agents to recommend the most relevant widget families first.

**Widget pre-population (Bob):**
`businessCategory` and `contentThemes` give the AI copilot enough context to generate brand-relevant default copy when a user creates their first widget.

**Personalization layers (016 — Blueprint layers):**
`detectedCountry` and `businessCategory` feed directly into the `geo` and `industry` layer keys, allowing the layering engine to apply the correct base overlays from first load.

### Execution rule

Do not build the full `WebPresenceSnapshot` extraction in this strategy doc. When this connector is prioritized for execution, create a dedicated connector PRD that covers:
- the Worker implementation using Cloudflare Browser Rendering `/crawl`
- the Workers AI structured extraction prompt
- the normalized output schema
- when the crawl is triggered (signup, manual reconnect, periodic refresh)
- how the snapshot is stored as a Berlin-owned account trait
- policy gating (which tiers get crawl, refresh frequency caps)

---

## 11) Structured Schema Emission — Google AI Discovery Signal (March 2026)

### What happened

Google launched **Ask Maps** on March 12, 2026 — a Gemini-powered natural language query layer inside Google Maps that answers questions about businesses directly in the Maps surface. Key behavior confirmed: Google's synthesis pipeline **prefers structured content from the business's own website** over community signals (reviews, Reddit, aggregators). If the business site emits clean structured schema, Google uses it as the authoritative answer. If not, Google reconstructs an answer from whatever community signals it can find.

Reference: https://blog.google/products-and-platforms/products/maps/ask-maps-immersive-navigation/

### Why this changes the widget renderer contract

Clickeen widgets that emit `FAQPage` JSON-LD (FAQ widget) and `AggregateRating` / `Review` JSON-LD (Reviews widget) become Google's preferred input for answering questions about that business in Maps, Search, and AI Overviews — before the user even visits the site.

This reframes what a widget is:

- **Before:** a widget is a site UX component that improves the visitor experience
- **After:** a widget is a Google presence tool that controls what AI tells people about the business before they arrive

The FAQ widget is not just "a nice accordion on the site." It is the mechanism by which a business asserts authoritative answers that Google's AI will prefer over synthesized community noise.

The Reviews widget is not just "social proof." It is the structured signal that feeds Google's rating synthesis for Ask Maps, Search snippets, and AI Overviews.

### Connection to existing connector architecture

This is not a connector concern — connectors acquire and normalize data. This is a **renderer concern**: the widget renderer layer must emit structured schema as a default output requirement, not an optional enhancement.

The normalized dataset contract (section 4) already produces the fields needed:
- Reviews connector output → maps directly to `AggregateRating` + `Review` JSON-LD
- FAQ content → maps directly to `FAQPage` JSON-LD

No new data is required. The schema emission is a rendering output contract.

### Competitive moat

Elfsight, Powr, and EmbedSocial widgets do not emit structured schema. Their renderers produce HTML for humans, not machine-readable signals for Google. Retrofitting this into their architectures without breaking 200M+ deployed embeds is non-trivial. Clickeen can ship this from day one because the rendering contract is clean and the output is deterministic.

### Execution rule

When the FAQ widget and Reviews widget are prioritized for execution, **structured schema emission is a P0 output requirement**, not a stretch goal:
- FAQ widget: emit `FAQPage` JSON-LD as an inline `<script type="application/ld+json">` in the Venice embed output, built from the same normalized content that renders the visible widget
- Reviews widget: emit `AggregateRating` JSON-LD (and optionally individual `Review` entries) from the normalized reviews dataset
- Schema must reflect the actual rendered state, not stale or cached content
- Schema emission must be covered in the widget's connector PRD and Venice rendering spec

