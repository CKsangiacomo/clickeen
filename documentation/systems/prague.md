# Prague — Marketing & SEO Surface

STATUS: PRD
Created: 2024-12-27
Last updated: 2026-01-02

---

## 0) What Prague is

Prague is the public marketing site (clickeen.com). It is the **SEO surface of the 100⁵ factory**.

Prague does not create content. Prague **renders GTM JSON into pages**.

```
GTM JSON (source of truth)
    → Prague templates
        → 400,000 HTML pages
            → Cloudflare Pages (edge-cached)
                → User lands from search
                    → Minibob converts them
```

**Prague is a rendering engine, not a CMS.**

---

## 1) The 100⁵ scale model

Prague generates pages from a combinatorial matrix:

| Dimension | Count | Source |
|-----------|-------|--------|
| **Widgets** | 100 | Tokyo widget registry |
| **Locales** | 50 | i18n catalogs |
| **Hubs (categories)** | 5 per widget | GTM JSON `useCases` where `type: "hub"` |
| **Spokes (platforms/niches)** | 50+ per widget | GTM JSON `useCases` where `type: "spoke"` |
| **Comparisons** | 5 per widget | GTM JSON `competitors` |

**Result: ~400,000 pages generated from 100 GTM JSON files.**

---

## 2) URL taxonomy

### Structure

```
https://clickeen.com/{locale}/{section}/{widget}/{useCase}
```

### Rules

| Rule | Implementation |
|------|----------------|
| **Locale prefix always** | `/en/`, `/de/`, `/es/` — never optional |
| **No trailing slashes** | `/widgets/faq` not `/widgets/faq/` |
| **Lowercase, kebab-case** | `/for-shopify` not `/for-Shopify` |
| **`for-` prefix on use cases** | `/for-dentists`, `/for-shopify` |
| **Flat use case URLs** | `/for-shopify` not `/for-ecommerce/shopify` |

### URL patterns

| Page type | URL pattern | Example |
|-----------|-------------|---------|
| **Home** | `/{locale}/` | `/en/` |
| **Widget gallery** | `/{locale}/widgets/` | `/en/widgets/` |
| **Widget landing** | `/{locale}/widgets/{widget}` | `/en/widgets/faq` |
| **Hub (category)** | `/{locale}/widgets/{widget}/for-{category}` | `/en/widgets/faq/for-ecommerce` |
| **Spoke (platform)** | `/{locale}/widgets/{widget}/for-{platform}` | `/en/widgets/faq/for-shopify` |
| **Spoke (niche)** | `/{locale}/widgets/{widget}/for-{niche}` | `/en/widgets/faq/for-dentists` |
| **Comparison** | `/{locale}/compare/{widget}-vs-{competitor}` | `/en/compare/faq-vs-elfsight` |
| **Pricing** | `/{locale}/pricing` | `/en/pricing` |
| **Blog** | `/{locale}/blog/{slug}` | `/en/blog/how-to-add-faq` |
| **Docs** | `/{locale}/docs/{path}` | `/en/docs/getting-started` |

### Locale codes

ISO 639-1 (2-letter codes):

| Language | Code |
|----------|------|
| English | `en` |
| German | `de` |
| Spanish | `es` |
| French | `fr` |
| Portuguese | `pt` |
| Japanese | `ja` |
| Korean | `ko` |
| Arabic | `ar` |
| Chinese | `zh` |
| Italian | `it` |

---

## 3) Use case taxonomy (hub-and-spoke model)

### Type hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  HUB (category)                                                             │
│  /for-ecommerce, /for-saas, /for-agencies                                   │
│  High-level value prop + platform cards linking to spokes                   │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │ children
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  SPOKE (platform)                                                           │
│  /for-shopify, /for-hubspot, /for-bigcommerce                               │
│  Platform-specific content + link to parent hub + sibling platforms         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  SPOKE (niche) — standalone, no parent hub                                  │
│  /for-dentists, /for-lawyers, /for-restaurants                              │
│  Niche-specific content, no parent link                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Complete use case map

```
HUBS (categories)
├── for-ecommerce
│   └── for-shopify, for-bigcommerce, for-woocommerce, 
│       for-magento, for-squarespace, for-wix
│
├── for-saas
│   └── for-hubspot, for-salesforce, for-intercom,
│       for-zendesk, for-notion, for-slack
│
├── for-agencies
│   └── for-marketing-agencies, for-web-agencies,
│       for-design-agencies, for-seo-agencies
│
├── for-small-business
│   └── for-local-business, for-service-business,
│       for-consultants, for-freelancers
│
└── for-enterprise
    └── for-fortune-500, for-government, for-healthcare-enterprise

STANDALONE SPOKES (niches)
├── for-dentists
├── for-lawyers
├── for-restaurants
├── for-real-estate
├── for-healthcare
├── for-education
├── for-nonprofits
├── for-fitness
├── for-beauty-salons
└── for-hotels
```

---

## 4) Page templates

### Widget landing page

**URL:** `/{locale}/widgets/{widget}`

**Content:**
- Hero with tagline from `gtm.tagline`
- Value props from `gtm.valueProps`
- Links to all hub pages
- Minibob with generic starter
- Schema: `SoftwareApplication`

### Hub page (category)

**URL:** `/{locale}/widgets/{widget}/for-{category}`

**Content:**
- Hero with category headline from `gtm.useCases[].headline`
- Category-level pain points
- **Platform cards grid** linking to all spoke pages
- Minibob with category starter questions
- Internal links to all children

**Example:**
```
/en/widgets/faq/for-ecommerce

"FAQ Widget for E-commerce"
"Reduce cart abandonment by answering questions before checkout"

[Pain points for e-commerce]

Choose your platform:
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐
│ Shopify │ │BigComm. │ │WooComm. │ │ Magento │
└─────────┘ └─────────┘ └─────────┘ └─────────┘

[Minibob with e-commerce starter]
```

### Spoke page (platform/niche)

**URL:** `/{locale}/widgets/{widget}/for-{platform}`

**Content:**
- Breadcrumb: Widget → Hub → Current
- Hero with platform headline + logo
- Platform-specific pain points
- Platform-specific starter questions in Minibob
- **Related platforms** (siblings under same hub)
- Back link to parent hub

**Example:**
```
/en/widgets/faq/for-shopify

FAQ > E-commerce > Shopify

"FAQ Widget for Shopify"
"Add an FAQ to your Shopify store in 2 minutes"

[Shopify-specific pain points]

[Minibob with Shopify-tailored starter Qs]

Also works with: BigCommerce, WooCommerce, Magento
← Back to E-commerce
```

### Comparison page

**URL:** `/{locale}/compare/{widget}-vs-{competitor}`

**Content:**
- Hero: "Clickeen {widget} vs {competitor}"
- Feature comparison table
- Our advantages from `gtm.competitors[].ourAdvantages`
- CTA to try Clickeen
- Minibob embedded

---

## 5) Data source: GTM JSON

Prague renders pages from `tokyo/widgets/{widget}/gtm.json`.

### GTM JSON schema (relevant fields)

```json
{
  "widgetSlug": "faq",
  "displayName": "FAQ Widget",
  "tagline": "Answer questions before they're asked",
  "shortDescription": "Embed a beautiful, SEO-optimized FAQ on any website",
  
  "valueProps": [
    { "headline": "Reduce support tickets", "description": "...", "icon": "headset" }
  ],
  
  "useCases": [
    {
      "slug": "for-ecommerce",
      "type": "hub",
      "icp": "E-commerce Stores",
      "headline": "FAQ Widget for E-commerce",
      "description": "Reduce cart abandonment...",
      "children": ["for-shopify", "for-bigcommerce", "for-woocommerce"],
      "painPoints": ["...", "..."],
      "starterQuestions": [{ "q": "...", "a": "..." }]
    },
    {
      "slug": "for-shopify",
      "type": "spoke",
      "parent": "for-ecommerce",
      "icp": "Shopify Stores",
      "headline": "FAQ Widget for Shopify",
      "platformLogo": "shopify.svg",
      "painPoints": ["...", "..."],
      "starterQuestions": [{ "q": "...", "a": "..." }],
      "keywords": ["shopify faq widget", "faq app shopify"]
    },
    {
      "slug": "for-dentists",
      "type": "spoke",
      "parent": null,
      "icp": "Dental Practices",
      "headline": "FAQ Widget for Dentists",
      "painPoints": ["...", "..."],
      "starterQuestions": [{ "q": "...", "a": "..." }]
    }
  ],
  
  "competitors": [
    {
      "slug": "elfsight",
      "name": "Elfsight FAQ",
      "ourAdvantages": ["AI-powered", "Better SEO", "Faster setup"]
    }
  ],
  
  "locales": {
    "de": { "displayName": "FAQ-Widget", "tagline": "..." },
    "es": { "displayName": "Widget de Preguntas Frecuentes", "tagline": "..." }
  }
}
```

**GTM JSON is owned by the GTM Agent.** See `documentation/Agents/GTMAgent.PRD.md`.

---

## 6) Minibob integration

Every page embeds Minibob with SDR Copilot.

### Embed pattern

```astro
<Minibob
  widget={widget}
  starterQuestions={useCase.starterQuestions}
  locale={locale}
  client:load
/>
```

### Minibob behavior

- Loads unpublished instance with starter questions from GTM JSON
- SDR Copilot active with content-first greeting
- 50K token budget per session
- Conversion gate when budget exhausted
- "Publish" triggers signup flow

### Shadow DOM embed (SEO/GEO mode)

Per `documentation/systems/seo-geo.md`:
- Widget UI renders into Shadow DOM (CSS isolation)
- Schema JSON-LD injected into `<head>`
- Deep links work via hash fragments

---

## 7) SEO implementation

### hreflang (every page)

```html
<link rel="alternate" hreflang="en" href="https://clickeen.com/en/widgets/faq/for-shopify" />
<link rel="alternate" hreflang="de" href="https://clickeen.com/de/widgets/faq/for-shopify" />
<link rel="alternate" hreflang="es" href="https://clickeen.com/es/widgets/faq/for-shopify" />
<link rel="alternate" hreflang="x-default" href="https://clickeen.com/en/widgets/faq/for-shopify" />
```

### Canonical (every page)

```html
<!-- On /de/widgets/faq/for-shopify -->
<link rel="canonical" href="https://clickeen.com/de/widgets/faq/for-shopify" />
```

### Schema JSON-LD

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "name": "Clickeen FAQ Widget",
      "applicationCategory": "WebApplication",
      "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
    },
    {
      "@type": "FAQPage",
      "mainEntity": [...]
    }
  ]
}
</script>
```

### Sitemap

```xml
<!-- sitemap-index.xml -->
<sitemapindex>
  <sitemap><loc>https://clickeen.com/sitemap-en.xml</loc></sitemap>
  <sitemap><loc>https://clickeen.com/sitemap-de.xml</loc></sitemap>
  ...
</sitemapindex>
```

Each locale sitemap includes hreflang annotations.

### Redirects

| From | To | Type |
|------|-----|------|
| `/` | `/{detected-locale}/` | 302 |
| `/widgets/faq` | `/en/widgets/faq` | 301 |
| `/{locale}/widgets/faq/` | `/{locale}/widgets/faq` | 301 |

---

## 8) Internal linking structure

```
                    /{locale}/widgets/{widget}
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        /for-ecommerce   /for-saas    /for-dentists
              │               │          (standalone)
    ┌─────────┼─────────┐     │
    ▼         ▼         ▼     ▼
/for-shopify /for-bc /for-woo /for-hubspot

Links:
────────────────────────────────────────────────────
Widget landing → all hubs (category cards)
Hub → all its spokes (platform cards)
Spoke → parent hub (breadcrumb + back link)
Spoke → sibling spokes (related platforms section)
All pages → widget landing (breadcrumb)
Comparison → widget landing + Minibob
```

---

## 9) i18n implementation

### Locale detection

1. URL path is canonical (`/de/widgets/faq`)
2. Root `/` redirects based on `Accept-Language` header
3. User can switch locale via language selector
4. Preference stored in cookie for subsequent visits

### Content localization

| Content type | Source |
|--------------|--------|
| UI strings | `tokyo/i18n/{locale}/coreui.json` |
| Widget marketing copy | `gtm.locales.{locale}.*` |
| Starter questions | `gtm.useCases[].starterQuestions` (localized in `locales`) |

### RTL support

For `ar`, `he`:
- `dir="rtl"` on `<html>`
- CSS uses logical properties (`margin-inline-start` not `margin-left`)
- Font stack includes RTL-friendly fonts

---

## 10) Build pipeline

### Framework: Astro

- SSG (Static Site Generation)
- Islands architecture (only Minibob ships JS)
- Cloudflare Pages adapter

### Pipeline steps

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. FETCH INPUTS                                                            │
│                                                                             │
│  tokyo/widgets/*/gtm.json      → widget marketing data                      │
│  tokyo/i18n/{locale}/*.json    → localized UI strings                       │
│  prague/config/locales.json    → enabled locales                            │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  2. COMPUTE ROUTE MATRIX                                                    │
│                                                                             │
│  For each widget:                                                           │
│    For each locale:                                                         │
│      - /{locale}/widgets/{widget}                                           │
│      For each useCase:                                                      │
│        - /{locale}/widgets/{widget}/{useCase.slug}                          │
│      For each competitor:                                                   │
│        - /{locale}/compare/{widget}-vs-{competitor.slug}                    │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. RENDER PAGES                                                            │
│                                                                             │
│  WidgetLanding.astro   → generic widget page                                │
│  HubPage.astro         → category + platform cards                          │
│  SpokePage.astro       → platform-specific + related                        │
│  ComparisonPage.astro  → widget vs competitor                               │
│                                                                             │
│  Each page includes:                                                        │
│  - hreflang links                                                           │
│  - canonical URL                                                            │
│  - Schema JSON-LD                                                           │
│  - Minibob island                                                           │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. OUTPUT                                                                  │
│                                                                             │
│  dist/                                                                      │
│    en/widgets/faq/index.html                                                │
│    en/widgets/faq/for-ecommerce/index.html                                  │
│    en/widgets/faq/for-shopify/index.html                                    │
│    de/widgets/faq/index.html                                                │
│    de/widgets/faq/for-shopify/index.html                                    │
│    en/compare/faq-vs-elfsight/index.html                                    │
│    ...                                                                      │
│    sitemap-index.xml                                                        │
│    sitemap-en.xml                                                           │
│    sitemap-de.xml                                                           │
│    ...                                                                      │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  5. DEPLOY                                                                  │
│                                                                             │
│  Cloudflare Pages                                                           │
│  - Edge cached globally                                                     │
│  - Immutable until next build                                               │
│  - Build triggered on git push or GTM JSON change                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Build triggers

| Trigger | Action |
|---------|--------|
| Git push to `main` | Full rebuild |
| GTM JSON updated (webhook) | Incremental rebuild for affected widget |
| i18n catalog updated | Rebuild affected locale pages |
| Scheduled (weekly) | Full rebuild to pick up any changes |

---

## 11) File structure

```
prague/
  astro.config.mjs           # Astro + Cloudflare Pages adapter
  package.json
  
  src/
    layouts/
      Base.astro             # HTML shell, head, nav, footer
      WidgetPage.astro       # Shared layout for widget pages
    
    pages/
      index.astro            # Root redirect
      [locale]/
        index.astro          # Home page
        widgets/
          index.astro        # Widget gallery
          [widget]/
            index.astro      # Widget landing
            [useCase]/
              index.astro    # Hub or spoke page
        compare/
          [comparison]/
            index.astro      # Comparison page
        pricing.astro
        blog/
          index.astro
          [slug].astro
    
    components/
      Hero.astro
      ValueProps.astro
      PlatformCards.astro
      Minibob.astro          # Island — loads embed
      Breadcrumb.astro
      RelatedPlatforms.astro
      ComparisonTable.astro
      Footer.astro
      LanguageSelector.astro
    
    lib/
      gtm.ts                 # Load GTM JSON from Tokyo
      i18n.ts                # Load i18n catalogs
      routes.ts              # Compute route matrix
      seo.ts                 # Generate hreflang, canonical, schema
  
  public/
    robots.txt
    favicon.ico
    # Static assets
```

---

## 12) Performance requirements

| Metric | Target |
|--------|--------|
| **LCP** | ≤ 2.5s |
| **CLS** | < 0.1 |
| **FID** | < 100ms |
| **Total JS** | < 100KB (only Minibob) |
| **Time to Interactive** | < 3s |

### How we achieve this

- SSG: HTML is pre-rendered, no server rendering
- Islands: Only Minibob ships JS
- Edge caching: Cloudflare Pages serves from nearest PoP
- Minimal CSS: Scoped styles, no framework bloat
- Optimized images: WebP, lazy loading, responsive sizes

---

## 13) Integrations

| System | Integration |
|--------|-------------|
| **Tokyo** | Fetch GTM JSON, i18n catalogs, widget assets |
| **Bob** | Minibob iframe/embed for each page |
| **Venice** | Widget embed origin for Minibob |
| **GTM Agent** | Generates/updates GTM JSON |
| **Berlin** | Analytics (page views, conversions) |
| **San Francisco** | SDR Copilot in Minibob |

### Environment variables

```
TOKYO_URL=https://tokyo.clickeen.com
BOB_URL=https://app.clickeen.com
VENICE_URL=https://embed.clickeen.com
```

---

## 14) Deployment

### Cloudflare Pages config

```toml
# wrangler.toml (if using Workers for redirects)
name = "prague"
compatibility_date = "2024-01-01"

[site]
bucket = "./dist"
```

### Build command

```bash
pnpm build
```

### Headers

```
# _headers (Cloudflare Pages)
/*
  X-Frame-Options: DENY
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin

/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

### Redirects

```
# _redirects (Cloudflare Pages)
/widgets/*  /en/widgets/:splat  301
/compare/*  /en/compare/:splat  301
```

---

## 15) Success metrics

| Metric | Target |
|--------|--------|
| **Pages indexed** | 90%+ of generated pages |
| **Organic traffic** | Track growth month-over-month |
| **Keyword rankings** | Track top 100 keywords |
| **Minibob open rate** | > 10% of page visitors |
| **Signup conversion** | > 2% of Minibob opens |
| **Core Web Vitals** | All green in Search Console |

---

## 16) Dependencies

| Dependency | Purpose |
|------------|---------|
| **GTM Agent** | Generates GTM JSON for all widgets |
| **i18n system** | Provides localized strings |
| **Tokyo** | Hosts GTM JSON and i18n catalogs |
| **Bob/Minibob** | Widget editor embedded on pages |
| **SDR Copilot** | Conversion agent in Minibob |
| **Cloudflare Pages** | Hosting and edge caching |

---

## 17) Out of scope

- Authenticated experiences (dashboards, user settings)
- CMS authoring UI (GTM Agent writes content)
- Dynamic server-side rendering (SSG only)
- Third-party scripts (no marketing pixels without approval)
- E-commerce checkout (handled by Stripe via Bob)

---

## 18) Links

- `documentation/Agents/GTMAgent.PRD.md` — GTM JSON generator
- `documentation/Agents/SDR_Copilot.PRD.md` — Conversion agent
- `documentation/systems/seo-geo.md` — SEO/GEO platform architecture
- `documentation/CONTEXT.md` — Platform overview
