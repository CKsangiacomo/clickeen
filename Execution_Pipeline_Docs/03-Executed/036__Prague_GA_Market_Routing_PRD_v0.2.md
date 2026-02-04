# PRD 36 — Prague GA Market Routing (Market + Locale URLs) v0.2

**Status:** EXECUTED  
**Date:** 2026-02-02  
**Executed:** 2026-02-03  
**Owner:** Clickeen Product Dev Team (Prague)  
**Stakeholders:** Human architect (Pietro), GTM Dev Team (Prague), Product Dev Team (Bob/DevStudio), Platform/Security (Paris/SF), SEO Agent owners  
**Decision (locked for v0.2):** Option C — `/{market}/{locale}/...`

Source of truth for current Prague behavior: `documentation/`. This PRD defines the v0.2 contract Prague must implement.

---

## 0) Locked Decisions (v0.2)

- **Canonical URL identity is `{market}/{locale}`.** Market is the business contract (legal/currency/availability). Locale is language only.
- **Markets are allowlisted slugs** (ex: `uk`, `it`, `ca`) in a repo config file.
- **v0.2 markets are country-markets only.** Country-markets map to ISO country codes (`uk → GB`) so we can reuse the existing `geo` overlay layer deterministically.
- **Canonical pages MUST be deterministic.** When `{market}` is explicit, Prague must not vary canonical content by IP, cookies, or experiment keys.
- **IP geo is used only for redirects** (when market is missing), never as a hidden content switch for canonical pages.
- **Locale is required in v0.2 URLs** (no market-only routes). Invalid locale for a market redirects to that market’s default locale (never “best effort” render).
- **Locale tokens are BCP47-ish (v0.2).** Canonical locales live in `config/locales.json` (including script tags like `zh-hans` and 3-letter languages like `fil`); markets further allowlist which locales are valid for `/{market}/{locale}`.
- **No experiments/personalization on canonical pages in v0.2.** If we later add experimentation, it must not change canonical identity and must ship with explicit canonical rules.
- **SEO tags are part of the contract (v0.2):** canonical + hreflang must reflect `/{market}/{locale}` identity (see §8.2).

## 1) Problem Statement

Prague is evolving from a marketing prototype into a **GA-grade market front door** — an **SEO-first acquisition surface**. In GA, Prague must be able to publish and serve pages that are:

- **Indexable + stable** (the same URL always means the same thing to crawlers and humans)
- **Market-aware** (currency/pricing display, availability, disclaimers, and messaging can be market-bound)
- **Composable** (soft-launch markets via config, without proliferating one-off routing logic)

This PRD’s primary driver is **SEO correctness**:
- The SEO agent must be able to publish **market-specific overlays** as artifacts.
- Crawlers must see a **single deterministic canonical** page for each `{market}/{locale}` identity.
- `hreflang` must be emitted from a deterministic identity (BCP47-ish tags like `en-GB`, `fr-CA`).

Important boundary:
- **Billing entity, checkout, and legal acceptance** are not “managed by Prague” — they live in the **Clickeen App + Stripe** flows.
- Prague’s responsibility is to ensure its **public marketing claims** (currency/pricing copy, disclaimers, and informational legal pages/links) are **consistent** with the market contract the app will enforce.

Previously (pre-v0.2), Prague’s primary URL identity was **language (locale)** via routes like:

- `/{locale}/widgets/{widget}/...`

But Prague already supports **runtime overlay context** (country + industry/account/experiment/behavior keys) derived from request headers/cookies/query params. This creates tension:

- URL identity says “language is the page.”
- GA business logic says “market is the page.”

Separately, the product direction includes an **SEO agent** that will optimize Prague content by market. This implies market-level content should be **stable, indexable, and publishable**, not dependent on implicit per-request geo variation.

This PRD proposes a GA-ready Prague routing architecture that is:
- market-aware,
- SEO-safe,
- flexible for soft-launch sequences (UK/IT/CA first, US later),
- composable (“Prague is a lego block”),
- aligned with the overlays thesis without creating a “dynamic identity” trap.

---

## 2) Current State (as implemented)

### 2.1 URL identity is market+locale (canonical)
Prague’s canonical routes are implemented as `/{market}/{locale}/...`:
- `prague/src/pages/[market]/[locale]/index.astro`
- `prague/src/pages/[market]/[locale]/widgets/[widget]/index.astro`
- `prague/src/pages/[market]/[locale]/widgets/[widget]/[page]/index.astro`

Root `/` is a non-canonical entry surface implemented in:
- `prague/src/pages/index.astro` (cookie → geo redirect, else default redirect; **no UI surface**)

### 2.2 Canonical overlay application is deterministic
For canonical `/{market}/{locale}/...` pages, Prague applies:
- locale overlays (for `locale != en`)
- market-bound geo overlays derived from `config/markets.json` (`market → country`)

Canonical pages do not vary by IP/cookies/experiment keys. Request-derived layer contexts remain available for future non-canonical preview flows, but they are not part of the v0.2 SEO contract.

### 2.3 Base Prague content vs overlays (where content actually comes from)
For marketed widget pages:
- **Base** content is loaded from the repo-local widget package JSON (`tokyo/widgets/**/pages/*.json`) bundled into the Prague build.
- **Overlays** are fetched from Tokyo CDN paths under `/l10n/v/<PUBLIC_PRAGUE_BUILD_ID>/prague/...` (controlled by `PUBLIC_TOKYO_URL`; the versioned prefix is a cache-bust wrapper for the underlying `l10n/prague/...` keys).

This means Prague already behaves like “stable base + publishable overlay artifacts,” which is aligned with an SEO agent that publishes overlays.

### 2.4 Prague content is stable by nature
Unlike widget **instances** (mutable, user-specific state), Prague is a marketing/product catalog surface. Content should be updated deliberately and remain stable between releases/overlay publishes.

---

## 3) Goals

### 3.1 Functional goals
1) Make Prague GA-grade for **market-specific behavior** (currency/legal/privacy/availability).
2) Support **soft launch** by market: launch UK+IT (or UK+CA) before US.
3) Keep Prague a composable “lego block” with minimal coupling.

### 3.2 SEO goals
4) Ensure **stable, indexable, canonical URLs** per market (and optionally per language).
5) Enable an SEO agent to generate market-specific copy as **publishable artifacts**, not ephemeral runtime output.

### 3.3 Platform goals
6) Preserve the overlays philosophy while preventing “dynamic identity drift” for crawlable pages.
7) Ensure market contract is explicit and reproducible (same URL always means the same market).

---

## 4) Non-goals

- This PRD does not design the SEO agent itself; it defines the interface Prague needs.
- This PRD does not require per-request personalization for canonical SEO pages (experiments can be layered later with strict canonical rules).
- This PRD does not redesign Bob/instances; it focuses on Prague routing + overlay selection.

---

## 5) Key Concepts

### 5.1 Market vs Geo vs Locale (and why we need all three)
- **Geo (countryCode)**: derived signal from IP (e.g., `US`, `GB`, `IT`). A suggestion for default market, not the market contract itself.
- **Market (marketKey)**: the contractual/business context Prague should represent (e.g., `uk`, `it`, `ca`). This is the GA identity.
- **Locale (language)**: how the page is written (`en`, `it`, `fr`). Not the same as market.

### 5.2 Critical normalization constraint from current code
Prague’s existing geo overlay layer keys are **ISO-3166 alpha-2 uppercase** (`GB`, `IT`, `CA`) and are validated as two letters. If we introduce `marketKey` slugs like `uk`, we must map them to a `countryCode` (e.g., `uk → GB`) before overlay selection.

If we want market groups like `eu`, that is a deliberate extension:
- either add a new layer (e.g., `market`) with slug keys, or
- expand geo key semantics beyond `[A-Z]{2}`.

This PRD assumes we start with country-based markets and add grouping later only if needed.

### 5.3 Content artifact types (Prague pages)
- **Base**: stable page JSON for a pageId (bundled at build time)
- **Market overlay**: market-specific edits (pricing/copy/legal)
- **Locale overlay**: language-specific edits within a market
- **Runtime personalization overlays** (optional later): experiment/behavior; must not change canonical identity.

### 5.4 `config/markets.json` (authoritative contract for v0.2)
Prague must use a **single allowlisted config file** to define market behavior (routing + allowed locales + geo mapping).

**File:** `config/markets.json`

**Shape (v0.2):**
```json
{
  "v": 1,
  "markets": [
    { "key": "uk", "country": "GB", "defaultLocale": "en", "locales": ["en"] },
    { "key": "it", "country": "IT", "defaultLocale": "it", "locales": ["it", "en"] },
    { "key": "ca", "country": "CA", "defaultLocale": "en", "locales": ["en", "fr"] }
  ]
}
```

**Rules:**
- `markets[].key`: lower slug (`^[a-z][a-z0-9-]{0,31}$`), unique.
- `markets[].country`: ISO-3166 alpha-2 **uppercase** (e.g. `GB`). (Reserved: `null` for future non-country markets; not used in v0.2.)
- `markets[].defaultLocale` must be included in `markets[].locales`.
- Unknown `market` must not become an indexable identity. For v0.2, prefer a 302 → `/` (non-canonical), which then resolves to the default canonical market+locale.
- Unknown/unsupported `locale` for a known market must 302 → `/{market}/{defaultLocale}/...` (see §9.2).

**Optional (v0.2): cookie selection**
- Root `/` redirect may respect user-chosen cookies first (if present):
  - `ck_market=<marketKey>`
  - `ck_locale=<locale>`
  - Invalid values are ignored.

---

## 6) Solution Options

### Option A — Locale-first URL (status quo), Market via implicit runtime geo
**Shape**
- URLs remain `/{locale}/...`
- Market is derived from IP/cookie and applied via runtime geo overlays

**Pros**
- Minimal routing change
- Language SEO structure is straightforward

**Cons**
- Market contract is not represented in URL.
- Same URL can imply different currency/legal/privacy depending on visitor geo.
- SEO agent “market optimization” is awkward: crawlers may see inconsistent versions.
- Hard to ensure canonicalization if market materially changes page meaning.

**Best fit**
- Prague remains informational only and avoids market-contract behavior.

---

### Option B — Market-first URL, Language as user preference (not in URL)
**Shape**
- URLs become `/{market}/...` (e.g., `/uk/pricing`, `/it/widgets/faq`)
- Language is selected by user/cookie/Accept-Language and applied within that market

**Pros**
- URL encodes business contract (market).
- Soft launch is easy (enable markets).
- Fewer URL permutations than market+locale.
- Matches GA logic: currency/legal are market-bound.

**Cons**
- Language SEO is weaker unless you publish explicit language variants or hreflang.
- “Same URL, different language” can confuse indexing unless canonical/hreflang is handled carefully.
- Requires a clean language picker UX.

**Best fit**
- Market correctness is primary; language SEO is secondary.

---

### Option C — Market + Locale explicit in URL (most canonical)
**Shape**
- URLs become `/{market}/{locale}/...` (e.g., `/uk/en/pricing`, `/it/it/widgets/faq`)
- Market is explicit; locale is explicit.

**Pros**
- Unambiguous identity: market contract + language both stable.
- Best for SEO/hreflang/canonical rules.
- Easiest to reason about “what this URL means.”

**Cons**
- More URL permutations.
- Requires routing refactor (`[locale]` → `[market]/[locale]`).
- Requires market config and market→country mapping to reuse existing geo layer.

**Best fit**
- GA-grade Prague where market correctness and SEO both matter.

---

### Option D — BCP47-style combined segment (e.g., `/en-gb/...`)
**Shape**
- URLs become `/{localeTag}/...` where `localeTag` includes region (`en-gb`, `it-it`)

**Pros**
- Standard for docs-style sites; hreflang-friendly.
- Single segment.

**Cons**
- Still feels “language-first.”
- Less intuitive for market-contract pages (pricing/legal).
- Still needs tags for mismatch (ru-us, en-sa).

**Best fit**
- Docs/help properties more than commerce-like front doors.

---

## 7) Locked Approach (v0.2)

### 7.1 Decision: Option C (Market + Locale explicit)
For GA-grade Prague where market drives legal/currency/availability, the cleanest identity is:

- `/{market}/{locale}/...`

Where:
- `market` is a controlled key from a config allowlist (`uk`, `it`, `ca`, etc.)
- `locale` is a supported language token (from locales config)

### 7.2 Reuse existing geo overlays (pragmatic alignment with current code)
To minimize disruption and maximize reuse:
- Treat **market overlays** as the existing **geo layer** overlays, keyed by `countryCode`.
- Maintain a mapping `marketKey → countryCode` (e.g., `uk → GB`) so Prague can feed the geo layer deterministically.

This matches the existing overlay pipeline and avoids introducing a new overlay layer unless we truly need market groups (EU/ROW).

### 7.3 Market resolver (lego-friendly)
- If URL includes `{market}`, Prague uses it as identity.
- IP geo is used only for **default redirects** (e.g., `/` → inferred market), not as a hidden content switch for canonical URLs.

---

## 8) SEO and Content Publishing Model

### 8.1 Principle: SEO optimization outputs must be publishable artifacts
Market-specific SEO changes should be expressed as:
- base updates (rare), and/or
- market overlays (common)

…and published to Tokyo l10n overlay storage as deterministic artifacts. Prague simply renders based on the URL identity.

### 8.2 Canonicalization rules
- **Canonical URL includes market + locale.** A page’s canonical is always its `/{market}/{locale}/...` URL.
- **No hidden variants:** when `{market}` is explicit, canonical output must not vary by IP/cookies/experiments.
- **hreflang (v0.2):** emit alternates **within the same market** only (do not cross-link across markets because market overlays can change meaning).
  - `hreflang` tag should be BCP47-ish: locale + market region (when missing).
    - Examples: `/uk/en/...` → `en-GB`, `/ca/fr/...` → `fr-CA`, `/it/zh-hans/...` → `zh-Hans-IT`.
  - Include `x-default` pointing to the market default locale.
- Runtime experimentation overlays (later) must not alter canonical identity; they must be opt-in and should not change indexable meaning.

---

## 9) Routing Spec (Option C)

### 9.1 Examples
- `/uk/en/` home
- `/uk/en/widgets/faq`
- `/uk/en/widgets/faq/pricing`
- `/it/it/widgets/faq`
- `/it/en/widgets/faq` (English in Italy market)
- `/ca/en/pricing`

### 9.2 Redirects and non-canonical behavior
- **Root `/` is non-canonical** and MUST resolve:
  1) explicit cookie selection (user-chosen market+locale) → 302 → `/{market}/{locale}/`
  2) IP geo mapping → market (then market default locale) → 302 → `/{market}/{defaultLocale}/`
  3) if no market can be resolved (or in local dev with no `cf-ipcountry`): 302 → the default canonical (v0.2: `/uk/en/`)
- **Canonical formatting (v0.2):** Prague canonical URLs use **lowercase** `{market}` + `{locale}` and **include a trailing slash** (directory-style). If a request is missing the trailing slash, redirect (301) to the trailing-slash form.
- `/{market}` (market-only) MUST 302 to `/{market}/{defaultLocale}/` (v0.2 locale-required rule).
- Invalid `{locale}` for a valid `{market}` MUST redirect to that market’s default locale (302).
- Any non-canonical/unknown route shape MUST not become indexable identity. It should redirect (302) to `/` (non-canonical), which then resolves to a canonical `/{market}/{locale}/...` via cookie/geo/default.

---

## 10) Privacy and Legal (GA posture)

- Consent banners and privacy pages are market-bound (market determines regime).
- Locale changes only language; it cannot change the underlying legal regime shown for that market.

---

## 11) Implementation Plan (High level)

### Phase 1 — Introduce market identity without breaking everything
- Add `config/markets.json` (market allowlist, default locale per market, market→country mapping)
- Add new routes for `/{market}/{locale}/...`
- Update Nav links to include market segment
- Remove locale-first routes; add a catch-all redirect to `/` for non-canonical shapes

### Phase 2 — Make overlay selection market-deterministic (no hidden IP-based content switching)
- Update `getPragueOverlayContext` (or introduce a market-aware variant) so:
  - When `{market}` is explicit: `country` used for geo overlays is derived from `config/markets.json` mapping (primary), and Prague must ignore request-derived `industry/account/experiment/behavior` keys for canonical pages.
  - IP geo is used only when market is not explicit (root redirect), never as a hidden canonical content switch.
- Ensure canonical pages do not vary by `cf-ipcountry` when market is explicit.

### Phase 3 — SEO agent integration
- Define artifact publishing contract: market overlays published as geo overlays keyed by countryCode (or market layer if later)
- Ensure Prague renders deterministically for crawlers.

---

## 12) Risks and Mitigations

1) **Market taxonomy churn** (soft launch changes)
- Mitigation: config-driven markets; keep the allowlist explicit and reviewable.

2) **SEO duplication / inconsistent indexing**
- Mitigation: explicit market identity in URL + canonical tags; remove implicit IP-based content switching for canonical pages.

3) **UK vs GB mismatch**
- Mitigation: market slug `uk` maps to country `GB` for geo overlays (explicit mapping).

4) **Need for market groups (EU)**
- Mitigation: defer; only add new layer or broaden geo semantics when required by real GA needs.

---

## 13) Explicit Decisions (v0.2)

1) **Market keys:** use friendly slugs (`uk`, `it`, `ca`) + explicit mapping to ISO country codes when needed (`uk → GB`).  
2) **Locale in URL:** required for all pages in v0.2.  
3) **Per-market allowed locales:** yes. Invalid `{market}/{locale}` combos redirect to the market default locale (302). Unknown markets redirect to `/` (non-canonical), which resolves to a default canonical market+locale (302).

---

## 14) Definition of Done (v0.2)

- Prague routes exist for `/{market}/{locale}/...` and are used by all internal links/navigation.
- Canonical pages do not vary by request IP/cookies/experiments when `{market}` is explicit (deterministic renders for crawlers).
- Root `/` redirects as specified (cookie → geo → default). Non-canonical shapes redirect to `/` (and then resolve).
- Market allowlist + mapping are code-owned and reviewable (no hidden rules in runtime).
- Canonical + hreflang tags reflect `/{market}/{locale}` identity (v0.2 rules in §8.2).
- Cloud-dev workflows (deploy + content release) smoke tests are updated to hit a market+locale URL (e.g. `/it/it/widgets/faq/`).
- Cloud-dev workflows (deploy + content release) smoke tests are updated to hit a market+locale URL (e.g. `/uk/en/widgets/faq/`).

---

## Appendix A — Decision Matrix

| Option | Identity clarity | Market correctness | Language SEO | Soft-launch flexibility | Complexity |
|---|---:|---:|---:|---:|---:|
| A: locale-first | Low | Medium (implicit) | High | Medium | Low |
| B: market-first | High | High | Medium | High | Medium |
| C: market+locale | Very High | Very High | High | High | Medium-High |
| D: localeTag | High | High | High | High | Medium |

---

*End.*
