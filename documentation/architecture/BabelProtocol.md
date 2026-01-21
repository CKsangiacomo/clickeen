# The Babel Protocol: Technical Specification

**Version:** 0.1 (Draft)
**Date:** January 20, 2026
**Status:** Architecture Specification

---

## What This Is

The Babel Protocol is Clickeen's internal specification for **multi-dimensional content personalization via overlay composition**.

**What it does:**
- Enables rendering infinite content variants from a single base artifact
- Provides deterministic, auditable personalization at request time
- Maintains performance through content-addressed caching

**What it is NOT:**
- Not a replacement for experimentation platforms (Optimizely)
- Not a replacement for identity resolution (CDPs)
- Not a replacement for segmentation engines (Demandbase)

**The Babel Protocol is the creative variant management layer.** It assumes decisioning/identity/segmentation happens upstream.

---

## Core Thesis

**Traditional approach:**
- Create N×M×P×G variants (languages × industries × experiments × geos)
- Store millions of permutations
- Cannot scale beyond 2-3 dimensions

**Babel Protocol approach:**
- Store 1 base artifact + dimensional overlays
- Compose variants at request time via deterministic merge
- Scale to unlimited dimensions with sub-linear storage growth

**Example:**
- Traditional: 14 languages × 50 industries × 100 ABM accounts × 5 A/B variants = 350,000 stored pages
- Babel: 1 base + 14 language overlays + 50 industry overlays + 100 ABM overlays + 5 A/B overlays = **170 artifacts**

---

## Architecture Components

### 1. Content-Addressed Base Artifacts

**Storage:**
```
tokyo/widgets/faq/
├── spec.json                  # Widget definition
├── widget.html                # Template
├── widget.css                 # Styles
└── widget.client.js           # Client behavior
```

**Characteristics:**
- Immutable (content-addressed by SHA-256 hash)
- Contains default/fallback content (typically English, generic positioning)
- Includes `baseFingerprint` for overlay validation

**Base config example:**
```json
{
  "id": "wgt_faq_default",
  "baseFingerprint": "758d73cba...",
  "baseUpdatedAt": "2026-01-14T23:14:51.314764+00:00",
  "config": {
    "title": "Frequently Asked Questions",
    "pricing": {
      "currency": "USD",
      "amount": 40
    },
    "cta": "Start free trial",
    "legal": {
      "gdpr": false
    }
  }
}
```

---

### 2. Dimensional Overlays

**Structure (deterministic paths):**
```
tokyo/l10n/instances/<publicId>/
├── locale/<locale>/<baseFingerprint>.ops.json
├── geo/<geo>/<baseFingerprint>.ops.json
├── industry/<industry>/<baseFingerprint>.ops.json
├── experiment/<expKey>/<baseFingerprint>.ops.json
├── account/<accountKey>/<baseFingerprint>.ops.json
└── behavior/<behaviorKey>/<baseFingerprint>.ops.json
```

**Overlay format (ops-based):**
```json
{
  "dimension": "locale",
  "dimensionValue": "fr",
  "baseFingerprint": "758d73cba...",
  "allowedPaths": ["title", "cta", "pricing.currency"],
  "ops": [
    {
      "op": "set",
      "path": "title",
      "value": "Questions Fréquemment Posées"
    },
    {
      "op": "set",
      "path": "cta",
      "value": "Essayer gratuitement"
    }
  ],
  "v": 1
}
```

**Key properties:**
- `baseFingerprint`: Must match base artifact (prevents stale overlays)
- `allowedPaths`: Contract enforcement - overlay can only modify declared paths
- `ops`: Array of JSONPatch-style operations (currently only "set" supported)

---

### 3. Context Resolver

**Purpose:** Deterministically compute request context to select overlays

**Input:** HTTP request
**Output:** Context object

**Context object structure:**
```typescript
interface RequestContext {
  // Core dimensions
  locale: string;              // "fr", "es", "ja", etc. (from Accept-Language or URL)
  geo: string;                 // "us", "eu", "apac" (from IP lookup)
  device: string;              // "mobile", "desktop", "tablet" (from User-Agent)

  // Optional dimensions (may be null)
  industry?: string;           // "healthcare", "finance" (from enrichment DB or param)
  account?: string;            // "salesforce", "google" (from IP → company lookup)
  experiment?: Map<string, string>;  // { "exp_001": "variant_b" }
  behavior?: string;           // "first_visit", "returning" (from cookie/session)

  // Metadata
  timestamp: number;           // Request time (for time-based overlays)
  userId?: string;             // If authenticated
}
```

**Resolution strategy:**

```typescript
async function resolveContext(request: Request): Promise<RequestContext> {
  const ctx: RequestContext = {
    locale: resolveLocale(request),
    geo: resolveGeo(request),
    device: resolveDevice(request),
    timestamp: Date.now()
  };

  // Optional enrichments (async, cached)
  ctx.industry = await resolveIndustry(request);  // IP → company → industry
  ctx.account = await resolveAccount(request);     // IP → company mapping
  ctx.experiment = await resolveExperiments(request);  // Cookie-based assignment
  ctx.behavior = await resolveBehavior(request);   // Session/cookie analysis

  return ctx;
}

function resolveLocale(request: Request): string {
  // 1. URL param (?lang=fr) - highest priority
  const urlLang = new URL(request.url).searchParams.get('lang');
  if (urlLang) return urlLang;

  // 2. Cookie (preferred_lang)
  const cookieLang = request.headers.get('Cookie')?.match(/preferred_lang=([^;]+)/)?.[1];
  if (cookieLang) return cookieLang;

  // 3. Accept-Language header
  const acceptLang = request.headers.get('Accept-Language');
  if (acceptLang) {
    const primary = acceptLang.split(',')[0].split('-')[0]; // "fr-FR" → "fr"
    return primary;
  }

  // 4. Fallback
  return 'en';
}

function resolveGeo(request: Request): string {
  // Cloudflare provides this automatically
  const cfCountry = request.headers.get('CF-IPCountry');

  // Map to regions
  const euCountries = ['FR', 'DE', 'ES', 'IT', 'NL', 'BE', 'AT', 'SE', 'DK', 'FI', 'NO'];
  const apacCountries = ['JP', 'KR', 'CN', 'SG', 'AU', 'NZ', 'IN'];

  if (euCountries.includes(cfCountry)) return 'eu';
  if (apacCountries.includes(cfCountry)) return 'apac';
  return 'us';  // Default
}

async function resolveAccount(request: Request): Promise<string | undefined> {
  const ip = request.headers.get('CF-Connecting-IP');

  // Lookup IP in company database (Clearbit, ZoomInfo, etc.)
  const company = await lookupCompany(ip);

  // Check if we have an ABM overlay for this company
  if (company && await hasABMOverlay(company.slug)) {
    return company.slug;  // e.g., "salesforce", "google"
  }

  return undefined;
}
```

**Caching strategy:**
- Locale/geo/device: Computed per-request (fast, deterministic)
- Industry/account: Cached in KV (1-hour TTL)
- Experiments: Cached in cookie (session-scoped)
- Behavior: Cached in cookie (session-scoped)

---

### 3.5 Layer Keys + Selection Contract

**LayerKey rules (canonicalized):**
- locale: BCP47 (en, fr-CA)
- geo: ISO-3166 (US, DE) or explicit market groupings
- industry: slug enum (dentist, restaurant)
- experiment: exp_<id>:<variant>
- account: stable account token (not raw domain)
- behavior: behavior_<id>
- user: locale key first, then optional global fallback

**Selection rules:**
- locale/geo/industry/account: select 0 or 1 key deterministically from request context
- experiment: allow multiple keys; apply in deterministic order (sorted by expId)
- behavior: allow multiple keys; apply in deterministic order
- user: apply locale-specific user overlay first; if absent, apply global fallback

**GeoTargets semantics:**
- geoTargets (if present) only drive locale selection (fr vs fr-CA), not geo overrides.
- Geo-specific overrides live in the geo layer.

---

### 4. Overlay Precedence & Composition

**The critical problem:** Multiple overlays may set the same field. We need deterministic precedence.

**Precedence order (last wins):**
```
1. base config (immutable)
2. locale overlay
3. geo overlay
4. industry overlay
5. experiment overlay
6. account overlay (ABM)
7. behavior overlay
8. user overlay (locale first, then optional global fallback)
```

**Index semantics:**
- `index.json` may include `lastPublishedFingerprint` to reduce 404 misses.
- Runtime never applies an overlay if `overlay.baseFingerprint` mismatches the current base.

**Composition algorithm:**
```typescript
function composeVariant(
  baseConfig: object,
  context: RequestContext,
  overlays: OverlayRegistry
): object {
  let result = JSON.parse(JSON.stringify(baseConfig)); // Deep clone

  // Apply overlays in precedence order
  const layers = [
    overlays.locale.get(context.locale),
    overlays.geo.get(context.geo),
    overlays.industry.get(context.industry),
    ...resolveExperimentOverlays(context.experiments, overlays),
    overlays.account.get(context.account),
    ...resolveBehaviorOverlays(context.behaviors, overlays),
    overlays.user.get(context.locale) ?? overlays.user.get('global')
  ];

  for (const overlay of layers) {
    if (!overlay) continue;

    // Validate fingerprint
    if (overlay.baseFingerprint !== baseConfig.baseFingerprint) {
      console.warn(`Overlay ${overlay.dimension} fingerprint mismatch - skipping`);
      continue;
    }

    // Validate path ownership (contract enforcement)
    for (const op of overlay.ops) {
      if (!overlay.allowedPaths.includes(op.path)) {
        throw new Error(`Overlay ${overlay.dimension} tried to set forbidden path: ${op.path}`);
      }
    }

    // Apply ops
    result = applyOps(result, overlay.ops);
  }

  return result;
}

function applyOps(config: object, ops: Array<{ op: string; path: string; value: any }>): object {
  const result = { ...config };

  for (const { op, path, value } of ops) {
    if (op === 'set') {
      setValueAtPath(result, path, value);
    }
    // Future: support 'delete', 'add', 'move' ops
  }

  return result;
}
```

---

### 5. Path Ownership Contracts

**The problem:** Without contracts, overlays can collide and cause chaos.

**Solution:** Each dimension declares allowed paths

**Path ownership table:**

| Dimension | Allowed Paths | Example Values |
|-----------|---------------|----------------|
| **locale** | `title`, `subtitle`, `cta`, `*.question`, `*.answer` | Translatable strings |
| **geo** | `pricing.currency`, `pricing.amount`, `legal.*`, `shipping.*` | Regional pricing/legal |
| **industry** | `hero.title`, `hero.subtitle`, `testimonials` | Positioning copy |
| **experiment** | `cta`, `hero.title`, `pricing.amount` | A/B test variants |
| **account** | `hero.title`, `logos`, `testimonials` | ABM customization |
| **behavior** | `hero.cta`, `hero.subtitle` | Lifecycle messaging |
| **user** | `*` (all paths) | User manual overrides |

**Enforcement:**
```typescript
const PATH_CONTRACTS: Record<string, string[]> = {
  locale: ['title', 'subtitle', 'cta', '*.question', '*.answer'],
  geo: ['pricing.currency', 'pricing.amount', 'legal.*', 'shipping.*'],
  industry: ['hero.title', 'hero.subtitle', 'testimonials'],
  experiment: ['cta', 'hero.title', 'pricing.amount'],
  account: ['hero.title', 'logos', 'testimonials'],
  behavior: ['hero.cta', 'hero.subtitle'],
  user: ['*']  // User overrides can touch anything
};

function validateOverlay(overlay: Overlay): boolean {
  const allowedPaths = PATH_CONTRACTS[overlay.dimension];

  for (const op of overlay.ops) {
    if (!isPathAllowed(op.path, allowedPaths)) {
      throw new Error(
        `Overlay '${overlay.dimension}' cannot modify path '${op.path}'. ` +
        `Allowed paths: ${allowedPaths.join(', ')}`
      );
    }
  }

  return true;
}

function isPathAllowed(path: string, allowedPaths: string[]): boolean {
  return allowedPaths.some(pattern => {
    if (pattern === '*') return true;
    if (pattern.endsWith('.*')) {
      return path.startsWith(pattern.slice(0, -2));
    }
    if (pattern.includes('*.')) {
      const regex = new RegExp('^' + pattern.replace('*', '[^.]+') + '$');
      return regex.test(path);
    }
    return path === pattern;
  });
}
```

---

### 6. Operational Model: Generate Once, Serve Many

**CRITICAL:** Do NOT generate overlays at request time. This will blow up cost/latency.

**The right model:**

```
┌─────────────────┐
│  Publish Time   │  AI agents generate overlays asynchronously
├─────────────────┤
│ 1. Base changes │ → Trigger overlay regeneration
│ 2. Agent runs   │ → Generate locale/industry/etc. overlays
│ 3. Validate     │ → Check fingerprint, path contracts
│ 4. Store in R2  │ → Content-addressed, immutable
└─────────────────┘
         ↓
┌─────────────────┐
│  Request Time   │  Only select + merge existing overlays
├─────────────────┤
│ 1. Resolve ctx  │ → Compute locale, geo, account, etc.
│ 2. Select       │ → Load relevant overlays from cache
│ 3. Compose      │ → Merge in precedence order
│ 4. Render       │ → Output HTML/JSON
│ 5. Cache result │ → Content-addressed CDN cache
└─────────────────┘
```

**Performance targets:**
- Context resolution: <10ms
- Overlay selection: <5ms (KV lookup)
- Composition: <20ms (merge 5-10 overlays)
- Total TTFB: <50ms (including rendering)

**Caching layers:**
1. **Overlay cache (R2 + KV):** Content-addressed overlays (immutable, cache forever)
2. **Composed variant cache (CDN):** Pre-composed variants for common contexts (1-hour TTL)
3. **Context enrichment cache (KV):** IP → company, IP → geo (1-hour TTL)

---

## Overlay Generation (AI Agent)

**When overlays are generated:**
- On publish: User publishes widget → trigger overlay generation
- On base change: baseFingerprint changes → regenerate all overlays
- On demand: Enterprise customer requests new ABM overlay → agent generates it

**Agent workflow:**
```typescript
async function generateLocaleOverlay(
  baseConfig: object,
  targetLocale: string
): Promise<LocaleOverlay> {
  // 1. Extract translatable fields
  const translatableFields = extractTranslatableFields(baseConfig);

  // 2. Translate via Deepseek
  const translations = await translateWithDeepseek(translatableFields, targetLocale);

  // 3. Generate ops
  const ops = translations.map(({ path, value }) => ({
    op: 'set' as const,
    path,
    value
  }));

  // 4. Validate against path contract
  const overlay: LocaleOverlay = {
    dimension: 'locale',
    dimensionValue: targetLocale,
    baseFingerprint: baseConfig.baseFingerprint,
    allowedPaths: PATH_CONTRACTS.locale,
    ops,
    v: 1
  };

  validateOverlay(overlay);

  // 5. Store in R2 (content-addressed)
  const overlayHash = sha256(JSON.stringify(overlay));
  await storeOverlay(`locale/${targetLocale}.${overlayHash}.ops.json`, overlay);

  return overlay;
}
```

**Cost model:**
- Translation: $0.0006 per overlay (Deepseek)
- Storage: $0.015/GB-month (R2)
- Generation: Async, batched (not on request path)

---

## Entitlements (What Features Are Available per Tier)

**Overlay dimensions by tier:**

| Tier | Locale | Geo | Industry | Experiment | Account (ABM) | Behavior |
|------|--------|-----|----------|------------|---------------|----------|
| **Free** | 3 languages | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Starter** | 14 languages | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Pro** | 14 languages | ✅ | ❌ | 3 experiments | ❌ | ❌ |
| **Business** | 14 languages | ✅ | 10 industries | 10 experiments | ❌ | ✅ |
| **Growth** | 14 languages | ✅ | Unlimited | Unlimited | 50 accounts | ✅ |
| **Enterprise** | 100+ languages | ✅ | Unlimited | Unlimited | Unlimited | ✅ |

**Enforcement:**
```typescript
function checkEntitlement(
  tier: Tier,
  dimension: string,
  count: number
): boolean {
  const limits = TIER_LIMITS[tier];

  switch (dimension) {
    case 'locale':
      return count <= limits.locales;
    case 'industry':
      return limits.industries === 'unlimited' || count <= limits.industries;
    case 'experiment':
      return limits.experiments === 'unlimited' || count <= limits.experiments;
    case 'account':
      return limits.accounts === 'unlimited' || count <= limits.accounts;
    default:
      return limits[dimension] === true;  // geo, behavior (boolean)
  }
}
```

---

## Implementation Phases

### Phase 0: Current State (Month 1-7)
- ✅ Base artifacts (widgets, emails, ads, pages)
- ✅ Locale overlays (14 languages)
- ✅ Content-addressed storage (Tokyo)
- ✅ Fingerprint-gated translation

### Phase 1: Foundation (Month 8-12)
- [ ] Context resolver (locale, geo, device)
- [ ] Overlay precedence engine
- [ ] Path ownership contracts
- [ ] Geo overlays (currency, legal)
- [ ] Basic A/B testing (3 experiments for Pro tier)

**Outcome:** Prove overlay composition works for 3 dimensions (locale, geo, experiment)

### Phase 2: Industry Personalization (Month 13-18)
- [ ] Industry taxonomy (50 industries)
- [ ] Industry overlay generation (AI-powered)
- [ ] Industry resolution (IP → company → industry)
- [ ] Entitlement enforcement (10 industries for Business tier)

**Outcome:** "Clickeen personalizes by industry" (4 dimensions proven)

### Phase 3: ABM (Month 19-24)
- [ ] Account overlay generation (manual + AI-assisted)
- [ ] Account resolution (IP → company slug)
- [ ] ABM governance UI (Enterprise customers manage their overlays)
- [ ] Analytics (which accounts viewed, converted)

**Outcome:** "Clickeen is an ABM platform" (5 dimensions proven)

### Phase 4: Behavior (Month 25-30)
- [ ] Behavior taxonomy (first visit, returning, engaged, churned)
- [ ] Behavior tracking (cookie + session)
- [ ] Lifecycle overlays
- [ ] Predictive personalization (ML-based behavior prediction)

**Outcome:** "Clickeen is a full personalization engine" (6 dimensions proven)

---

## What This Is NOT (And Why That Matters)

**Babel Protocol does NOT:**
- ❌ Resolve user identity (that's Segment, mParticle, CDPs)
- ❌ Assign experiment variants (we use simple hash-based assignment, not stats engines)
- ❌ Provide segmentation/targeting rules (we assume context is resolved upstream)
- ❌ Track conversion events (we integrate with analytics, not replace them)
- ❌ Provide governance workflows (Enterprise customers manage overlays directly)

**Babel Protocol DOES:**
- ✅ Store base artifacts (content-addressed, immutable)
- ✅ Generate dimensional overlays (AI-powered, async)
- ✅ Compose variants at request time (deterministic, fast)
- ✅ Enforce path ownership (contract-based safety)
- ✅ Cache aggressively (content-addressed, CDN-friendly)

**This is the creative variant management layer, not the full MarTech stack.**

---

## Success Criteria

**Technical:**
- [ ] <50ms request-time composition (p95)
- [ ] >99.9% overlay cache hit rate
- [ ] Zero path ownership violations in production
- [ ] <$0.001 per overlay generation (AI cost)

**Product:**
- [ ] Pro tier uses geo overlays (EUR vs USD) - 50% adoption
- [ ] Business tier uses industry overlays - 30% adoption
- [ ] Enterprise tier uses ABM overlays - 80% adoption
- [ ] A/B tests run across multiple languages (10% of Pro users)

**Business:**
- [ ] Personalization features drive 30% higher ARPU (Business+ tiers)
- [ ] Enterprise tier adoption increases 2× (ABM is the killer feature)
- [ ] Churn decreases 40% for users using 3+ dimensions

---

## Open Questions

1. **Conflict resolution:** If experiment overlay and account overlay both set `hero.title`, which wins?
   - Current: Precedence order (account wins)
   - Alternative: Explicit conflict detection + error

2. **Overlay versioning:** If we regenerate locale overlay, do we keep old version?
   - Current: Yes (version limits per tier)
   - Question: How long to retain?

3. **Real-time vs batch:** Can Enterprise customers generate overlays on-demand?
   - Current: Batch (async via queue)
   - Enterprise request: Real-time API for ABM overlay generation

4. **Multi-variate experiments:** How to handle interactions between dimensions?
   - Example: Does French variant A perform better than English variant A?
   - Current: No cross-dimensional analytics
   - Future: Multi-variate experiment framework

---

## References

- Content-addressed storage: `/documentation/architecture/CONTEXT.md`
- Localization system: `/tokyo/l10n/README.md`
- Agent system: `/sanfrancisco/README.md`
- Widget specification: `/tokyo/widgets/*/spec.json`

---

**END OF SPECIFICATION**

*This is a living document. Update as implementation evolves.*
