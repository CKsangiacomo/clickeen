# 18 — Prague GA Market Routing & SEO Architecture PRD (Draft v0.2)

Status: Planning. This is not active execution.
Source of truth: `documentation/` for current Prague behavior.

**Date:** 2026-01-26  
**Owner:** Clickeen Product Dev Team (Prague)  
**Stakeholders:** Human architect (Pietro), GTM Dev Team (Prague), Product Dev Team (Bob/DevStudio), Platform/Security (Paris/SF), SEO Agent owners  
**Status:** Draft for peer review (validated against current Prague implementation)

---

## 1) Problem Statement

Prague is evolving from a marketing prototype into a **GA-grade market front door**. In GA, Prague must behave differently by **market** for reasons that are not purely language:

- billing/invoice entity expectations
- currency display
- applicable privacy regime (GDPR/UK GDPR/CPRA), consent, and legal pages
- plan availability and disclaimers
- market-specific messaging and examples

Today, Prague’s primary URL identity is **language (locale)** via routes like:

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

### 2.1 URL identity is locale-first
Prague uses `[locale]` as the primary route segment:
- `prague/src/pages/[locale]/widgets/[widget]/index.astro`
- `prague/src/pages/[locale]/widgets/[widget]/[page]/index.astro`

Prague passes `locale` into layout `<html lang={locale}>` and uses it for chrome strings and page JSON loading.

### 2.2 Prague already applies multi-layer overlays (including geo) at runtime
Prague derives overlay context from request:
- `cf-ipcountry` header becomes `country` (unless `XX`)
- optional dev override via `?geo=` or `?country=`
- layerContext for `industry`, `account`, `experiment`, `behavior` via query/cookies

Prague then applies layered overlays (locale, geo, industry, experiment, account, behavior, user) by fetching Tokyo overlay artifacts keyed by **base fingerprint** and layer keys.

**Important implication:** today, the same `/{locale}/...` URL can render different output for different visitors if geo overlays exist, because `country` is always injected from the request.

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
- **Market (marketKey)**: the contractual/business context Prague should represent (e.g., `uk`, `it`, `ca`, `intl`). This is the GA identity.
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

## 7) Recommended Approach (Draft)

### 7.1 Recommended: Option C (Market + Locale explicit)
For GA-grade Prague where market drives legal/currency/availability, the cleanest identity is:

- `/{market}/{locale}/...`

Where:
- `market` is a controlled key from a config allowlist (`uk`, `it`, `ca`, `intl`, etc.)
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
- Canonical URL includes market (and locale in Option C).
- Runtime experimentation overlays must not alter canonical identity; they must be opt-in and should not change indexable meaning.

---

## 9) Routing Spec (Option C)

### 9.1 Examples
- `/uk/en/` home
- `/uk/en/widgets/faq`
- `/uk/en/widgets/faq/pricing`
- `/it/it/widgets/faq`
- `/it/en/widgets/faq` (English in Italy market)
- `/ca/en/pricing`
- `/intl/en/` global fallback

### 9.2 Redirects and legacy compatibility
- Legacy `/{locale}/...` should 301 to `/intl/{locale}/...` or to a default market per locale policy.
- Root `/` should 302 to inferred market+locale:
  1) explicit cookie selection
  2) IP geo mapping to market
  3) fallback `intl`

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
- Add redirects from legacy locale-first routes

### Phase 2 — Make overlay selection market-deterministic (no hidden IP-based content switching)
- Update `getPragueOverlayContext` (or introduce a market-aware variant) so:
  - `country` used for geo overlays is derived from URL market mapping (primary)
  - IP geo is used only when market is not explicit (root redirect or intl)
- Ensure canonical pages do not vary by `cf-ipcountry` when market is explicit.

### Phase 3 — SEO agent integration
- Define artifact publishing contract: market overlays published as geo overlays keyed by countryCode (or market layer if later)
- Ensure Prague renders deterministically for crawlers.

---

## 12) Risks and Mitigations

1) **Market taxonomy churn** (soft launch changes)
- Mitigation: config-driven markets; keep `intl` fallback.

2) **SEO duplication / inconsistent indexing**
- Mitigation: explicit market identity in URL + canonical tags; remove implicit IP-based content switching for canonical pages.

3) **UK vs GB mismatch**
- Mitigation: market slug `uk` maps to country `GB` for geo overlays (explicit mapping).

4) **Need for market groups (EU)**
- Mitigation: defer; only add new layer or broaden geo semantics when required by real GA needs.

---

## 13) Open Questions (for peer review)

1) Market keys: friendly slugs (`uk`) vs ISO country keys (`gb`). (Implementation can support slugs with mapping; what do we want externally?)  
2) Do we require locale in URL for all GA pages, or allow market-only URLs for pricing/legal?  
3) Do we need per-market allowed locales (recommended) and how strict should invalid combinations be (404 vs redirect)?

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
