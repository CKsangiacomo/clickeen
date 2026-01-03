# Prague — Marketing & SEO Surface

STATUS: PRD
Created: 2024-12-27
Last updated: 2026-01-02

---

## 0) What Prague is (and what we beat competitors on)

### Core concept

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

### Competitor patterns adopted

| Competitor | Pattern we steal | Our advantage |
|------------|------------------|---------------|
| **Elfsight** | Mega-menu categories, "Best Seller / Trending / New" badges, 97+ widgets scale | GTM Agent automates content at 100⁵ scale |
| **Common Ninja** | Stats strips ("1M+ widgets, 500K+ businesses"), "Made with" gallery | AI-generated, locale-aware |
| **Embeddable** | Use-case specificity (long-tail SEO), template counts, AI customization messaging | SDR Copilot reads your site, auto-generates content |

### Where we beat all three

| Their weakness | Our advantage |
|----------------|---------------|
| Generic customization | SDR Copilot writes content for you |
| AI is prompt-based (still work) | We read your site, auto-generate |
| No content intelligence | We personalize to ICP + locale |
| Manual, human-driven marketing | 100⁵ programmatic scale |
| Same templates for everyone | GTM Agent optimizes per locale/use-case |

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

### Page count calculation (per widget, per locale)

| Page type | Count per widget | Example |
|-----------|------------------|---------|
| Widget landing | 1 | `/widgets/faq` |
| Template gallery | 1 | `/widgets/faq/templates` |
| Hubs (categories) | 5 | `/widgets/faq/for-ecommerce` |
| Spokes (platforms) | 30+ | `/widgets/faq/for-shopify` |
| Spokes (niches) | 15+ | `/widgets/faq/for-dentists` |
| Comparisons | 5 | `/compare/faq-vs-elfsight` |
| **Per widget × locale** | **~55 pages** | |
| **100 widgets × 50 locales** | **~275,000 pages** | |
| **+ Widget gallery per locale** | **+50 pages** | |
| **+ Home, Pricing, Blog, Docs** | **+500 pages** | |
| **Total** | **~400,000 pages** | |

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
| **Template gallery** | `/{locale}/widgets/{widget}/templates` | `/en/widgets/faq/templates` |
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

### Widget landing page anatomy

**URL:** `/{locale}/widgets/{widget}`

```
┌─────────────────────────────────────────────────────────────┐
│ HERO                                                        │
│ ┌─────────────────────────────────┬───────────────────────┐ │
│ │ H1: {gtm.displayName}           │ [Live Widget Preview] │ │
│ │ Subhead: {gtm.tagline}          │ (interactive, real)   │ │
│ │ [Create Free] [See Templates]   │                       │ │
│ │ Badges: [Trending] [12 templates]│                      │ │
│ └─────────────────────────────────┴───────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ PLATFORM STRIP                                              │
│ Works on: [Shopify] [WP] [Wix] [Webflow] [Squarespace] +95 │
├─────────────────────────────────────────────────────────────┤
│ 3-STEP PROCESS                                              │
│ 1. Pick template  →  2. Customize with AI  →  3. Embed     │
├─────────────────────────────────────────────────────────────┤
│ USE CASE CARDS (links to hubs/spokes)                       │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│ │E-commerce│ │ SaaS   │ │Dentists │ │ Lawyers │            │
│ │   FAQ   │ │  FAQ   │ │   FAQ   │ │   FAQ   │            │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘            │
├─────────────────────────────────────────────────────────────┤
│ TEMPLATE GALLERY PREVIEW (4-6 cards from gtm.templates)     │
│ [Accordion] [Grid] [Minimal] [Colorful] → See All Templates │
├─────────────────────────────────────────────────────────────┤
│ FEATURE GRID (from gtm.features)                            │
│ ✓ SEO-optimized  ✓ Schema.org  ✓ Mobile-first  ✓ AI-powered│
├─────────────────────────────────────────────────────────────┤
│ STATS STRIP (from gtm.stats)                                │
│ "10,000+ FAQs created"  "Used on 500+ sites"               │
├─────────────────────────────────────────────────────────────┤
│ FAQ SECTION (meta: FAQ about the widget)                    │
├─────────────────────────────────────────────────────────────┤
│ COMPARISON STRIP                                            │
│ "Why Clickeen vs Elfsight? vs Common Ninja?"               │
├─────────────────────────────────────────────────────────────┤
│ CTA BLOCK                                                   │
│ "Create Your {widget} in 60 Seconds — Free"                │
├─────────────────────────────────────────────────────────────┤
│ MINIBOB (island, loads JS)                                  │
│ Embedded editor with SDR Copilot                            │
└─────────────────────────────────────────────────────────────┘
```

**Schema:** `SoftwareApplication` + `FAQPage` for meta FAQ

### Hub page anatomy (category)

**URL:** `/{locale}/widgets/{widget}/for-{category}`

```
┌─────────────────────────────────────────────────────────────┐
│ BREADCRUMB                                                  │
│ Widgets > {widget} > {category}                            │
├─────────────────────────────────────────────────────────────┤
│ HERO                                                        │
│ H1: {gtm.useCases[hub].headline}                           │
│ Subhead: {gtm.useCases[hub].description}                   │
│ [Create Free]                                               │
├─────────────────────────────────────────────────────────────┤
│ PAIN POINTS (from gtm.useCases[hub].painPoints)             │
│ • Pain point 1                                              │
│ • Pain point 2                                              │
│ • Pain point 3                                              │
├─────────────────────────────────────────────────────────────┤
│ PLATFORM CARDS (links to all child spokes)                  │
│ "Choose your platform:"                                     │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐            │
│ │ Shopify │ │BigComm. │ │WooComm. │ │ Magento │            │
│ │   logo  │ │   logo  │ │   logo  │ │   logo  │            │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘            │
├─────────────────────────────────────────────────────────────┤
│ MINIBOB (with category starter questions)                   │
│ SDR Copilot pre-loaded with e-commerce context             │
├─────────────────────────────────────────────────────────────┤
│ CTA BLOCK                                                   │
│ "Create Your {widget} for {category} — Free"               │
└─────────────────────────────────────────────────────────────┘
```

**Internal links:** All child spokes (`gtm.useCases[hub].children`)

### Spoke page anatomy (platform/niche)

**URL:** `/{locale}/widgets/{widget}/for-{platform}`

```
┌─────────────────────────────────────────────────────────────┐
│ BREADCRUMB                                                  │
│ Widgets > {widget} > {hub} > {spoke}                       │
│ (or Widgets > {widget} > {spoke} if standalone niche)      │
├─────────────────────────────────────────────────────────────┤
│ HERO                                                        │
│ ┌──────────────────────────────────┬──────────────────────┐ │
│ │ H1: {gtm.useCases[spoke].headline}│ [Platform Logo]     │ │
│ │ Subhead: platform-specific pitch  │ (e.g., Shopify)     │ │
│ │ [Install on {platform}]           │                     │ │
│ └──────────────────────────────────┴──────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│ INSTALL STEPS (platform-specific)                           │
│ Step 1: Copy embed code                                     │
│ Step 2: Paste in {platform} editor                         │
│ Step 3: Done (60 seconds)                                   │
├─────────────────────────────────────────────────────────────┤
│ PAIN POINTS (from gtm.useCases[spoke].painPoints)           │
│ • Platform-specific pain 1                                  │
│ • Platform-specific pain 2                                  │
├─────────────────────────────────────────────────────────────┤
│ EXAMPLES (screenshots of widget on this platform)           │
│ [Screenshot 1] [Screenshot 2] [Screenshot 3]               │
├─────────────────────────────────────────────────────────────┤
│ MINIBOB (with platform-tailored starter questions)          │
│ SDR Copilot pre-loaded with {platform} context             │
├─────────────────────────────────────────────────────────────┤
│ RELATED PLATFORMS (siblings under same hub)                 │
│ "Also works with: BigCommerce, WooCommerce, Magento"       │
├─────────────────────────────────────────────────────────────┤
│ BACK LINK                                                   │
│ ← Back to E-commerce                                        │
└─────────────────────────────────────────────────────────────┘
```

**Internal links:**
- Parent hub (breadcrumb + back link)
- Sibling spokes (related platforms section)
- Widget landing (breadcrumb)

### Comparison page anatomy

**URL:** `/{locale}/compare/{widget}-vs-{competitor}`

```
┌─────────────────────────────────────────────────────────────┐
│ HERO                                                        │
│ H1: "Clickeen {widget} vs {competitor.name}"               │
│ Subhead: "See why teams choose Clickeen"                   │
├─────────────────────────────────────────────────────────────┤
│ COMPARISON TABLE                                            │
│ ┌──────────────────┬────────────┬────────────┐             │
│ │ Feature          │ Clickeen   │ {competitor}│             │
│ ├──────────────────┼────────────┼────────────┤             │
│ │ AI customization │ ✓          │ ✗          │             │
│ │ SEO Schema.org   │ ✓          │ ✓          │             │
│ │ Free tier        │ ✓          │ Limited    │             │
│ │ GEO optimization │ ✓          │ ✗          │             │
│ └──────────────────┴────────────┴────────────┘             │
├─────────────────────────────────────────────────────────────┤
│ OUR ADVANTAGES (from gtm.competitors[].ourAdvantages)       │
│ • AI-powered content generation                             │
│ • Better SEO with Schema.org                                │
│ • Faster setup (60 seconds)                                │
├─────────────────────────────────────────────────────────────┤
│ MINIBOB (try it yourself)                                   │
│ "See the difference — create your {widget} now"            │
├─────────────────────────────────────────────────────────────┤
│ CTA BLOCK                                                   │
│ "Switch from {competitor} to Clickeen — Free"              │
└─────────────────────────────────────────────────────────────┘
```

**SEO target:** "{widget} vs {competitor}", "alternative to {competitor}"

### Widget gallery page anatomy

**URL:** `/{locale}/widgets/`

```
┌─────────────────────────────────────────────────────────────┐
│ HERO                                                        │
│ H1: "Free Widget Templates for Your Website"               │
│ Subhead: "100+ widgets. Customize with AI. Embed anywhere."│
│ [Browse All] [Popular] [New]                               │
├─────────────────────────────────────────────────────────────┤
│ CATEGORY FILTER                                             │
│ [All] [Engagement] [Social Proof] [Forms] [Navigation] ... │
├─────────────────────────────────────────────────────────────┤
│ WIDGET CARDS GRID                                           │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │ [Preview]   │ │ [Preview]   │ │ [Preview]   │            │
│ │ FAQ Widget  │ │ Testimonials│ │ Logo Slider │            │
│ │ [Trending]  │ │ [Popular]   │ │ [New]       │            │
│ │ 12 templates│ │ 8 templates │ │ 6 templates │            │
│ └─────────────┘ └─────────────┘ └─────────────┘            │
├─────────────────────────────────────────────────────────────┤
│ STATS STRIP                                                 │
│ "100+ widgets" "50,000+ sites" "50 countries"              │
├─────────────────────────────────────────────────────────────┤
│ PLATFORM STRIP                                              │
│ "Works on: Shopify, WordPress, Wix, + 95 more"             │
└─────────────────────────────────────────────────────────────┘
```

**Data source:** Aggregated from all `tokyo/widgets/*/gtm.json`

### Template gallery page anatomy

**URL:** `/{locale}/widgets/{widget}/templates`

```
┌─────────────────────────────────────────────────────────────┐
│ BREADCRUMB                                                  │
│ Widgets > {widget} > Templates                             │
├─────────────────────────────────────────────────────────────┤
│ HERO                                                        │
│ H1: "{widget} Templates"                                   │
│ Subhead: "12 ready-to-use templates. Pick one and customize."│
├─────────────────────────────────────────────────────────────┤
│ TEMPLATE CARDS GRID (large previews)                        │
│ ┌─────────────────┐ ┌─────────────────┐                    │
│ │ [Live Preview]  │ │ [Live Preview]  │                    │
│ │ Accordion       │ │ Grid            │                    │
│ │ "Classic FAQ"   │ │ "Modern cards"  │                    │
│ │ [Use Template]  │ │ [Use Template]  │                    │
│ └─────────────────┘ └─────────────────┘                    │
├─────────────────────────────────────────────────────────────┤
│ CTA BLOCK                                                   │
│ "Start from scratch with AI instead"                       │
│ [Create Custom {widget}]                                   │
└─────────────────────────────────────────────────────────────┘
```

**SEO target:** "{widget} templates", "free {widget} template"

---

## 5) Data source: GTM JSON

Prague renders pages from `tokyo/widgets/{widget}/gtm.json`.

### GTM JSON schema (complete)

```json
{
  "widgetSlug": "faq",
  "displayName": "FAQ Widget",
  "tagline": "Answer questions before they're asked",
  "shortDescription": "Embed a beautiful, SEO-optimized FAQ on any website",
  "category": "engagement",
  
  "badges": ["trending"],
  
  "stats": {
    "created": "10,000+",
    "views": "1M+",
    "sites": "500+"
  },
  
  "templates": {
    "count": 12,
    "featured": ["accordion", "grid", "minimal", "colorful"]
  },
  
  "platforms": {
    "featured": ["shopify", "wordpress", "wix", "webflow", "squarespace"],
    "all": ["shopify", "wordpress", "wix", "webflow", "squarespace", "bigcommerce", "html", "notion", "framer", "ghost", "webflow"]
  },
  
  "features": [
    { "key": "seo", "label": "SEO-optimized", "icon": "search" },
    { "key": "schema", "label": "Schema.org markup", "icon": "code" },
    { "key": "ai", "label": "AI-powered customization", "icon": "sparkles" },
    { "key": "mobile", "label": "Mobile-first design", "icon": "smartphone" }
  ],
  
  "valueProps": [
    { "headline": "Reduce support tickets", "description": "Answer common questions before they reach your inbox", "icon": "headset" },
    { "headline": "Boost SEO", "description": "Schema.org markup gets your FAQs in Google rich results", "icon": "trending-up" },
    { "headline": "60-second setup", "description": "Pick a template, customize with AI, embed anywhere", "icon": "zap" }
  ],
  
  "useCases": [
    {
      "slug": "for-ecommerce",
      "type": "hub",
      "icp": "E-commerce Stores",
      "headline": "FAQ Widget for E-commerce",
      "description": "Reduce cart abandonment by answering questions before checkout",
      "children": ["for-shopify", "for-bigcommerce", "for-woocommerce"],
      "painPoints": [
        "Customers abandon carts because questions go unanswered",
        "Support team overwhelmed with repetitive questions",
        "Product pages lack trust-building content"
      ],
      "starterQuestions": [{ "q": "What is your return policy?", "a": "..." }]
    },
    {
      "slug": "for-shopify",
      "type": "spoke",
      "parent": "for-ecommerce",
      "icp": "Shopify Stores",
      "headline": "FAQ Widget for Shopify",
      "platformLogo": "shopify.svg",
      "painPoints": [
        "Shopify's built-in FAQ is too basic",
        "Third-party apps are slow and bloated",
        "Need SEO-optimized FAQ for product pages"
      ],
      "installSteps": [
        "Copy embed code from Clickeen",
        "Go to Shopify Admin → Online Store → Themes → Customize",
        "Add Custom HTML block and paste code"
      ],
      "starterQuestions": [{ "q": "Do you ship internationally?", "a": "..." }],
      "keywords": ["shopify faq widget", "faq app shopify", "shopify faq section"]
    },
    {
      "slug": "for-dentists",
      "type": "spoke",
      "parent": null,
      "icp": "Dental Practices",
      "headline": "FAQ Widget for Dentists",
      "painPoints": [
        "Patients call with the same questions",
        "Website lacks educational content",
        "Need to build trust before appointments"
      ],
      "starterQuestions": [{ "q": "Do you accept insurance?", "a": "..." }],
      "keywords": ["dental faq widget", "dentist website faq"]
    }
  ],
  
  "competitors": [
    {
      "slug": "elfsight",
      "name": "Elfsight FAQ",
      "ourAdvantages": ["AI-powered content generation", "Better SEO with Schema.org", "Faster 60-second setup"],
      "comparisonTable": {
        "aiCustomization": { "us": true, "them": false },
        "schemaOrg": { "us": true, "them": true },
        "freeTier": { "us": "Unlimited", "them": "Limited" },
        "geoOptimization": { "us": true, "them": false }
      }
    },
    {
      "slug": "commoninja",
      "name": "Common Ninja FAQ",
      "ourAdvantages": ["Content intelligence", "Personalized to your site", "GEO optimization"]
    }
  ],
  
  "metaFaq": [
    { "q": "Is the FAQ widget really free?", "a": "Yes, forever free with a Clickeen backlink. Remove it with Pro." },
    { "q": "Does it work on mobile?", "a": "Yes, all our widgets are mobile-first and responsive." },
    { "q": "Does the FAQ widget help SEO?", "a": "Yes, we generate Schema.org FAQPage markup automatically." }
  ],
  
  "locales": {
    "de": { "displayName": "FAQ-Widget", "tagline": "Beantworten Sie Fragen, bevor sie gestellt werden" },
    "es": { "displayName": "Widget de Preguntas Frecuentes", "tagline": "Responde preguntas antes de que se hagan" }
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
                    /{locale}/widgets/
                         (gallery)
                              │
                              ▼
                    /{locale}/widgets/{widget}
                         (landing)
                              │
              ┌───────┬───────┼───────┬───────────┐
              ▼       ▼       ▼       ▼           ▼
         /templates  /for-ecommerce  /for-saas  /for-dentists  /vs-elfsight
              │           │               │      (standalone)    (compare)
              │     ┌─────┼─────┐         │
              │     ▼     ▼     ▼         ▼
              │  /shopify /bc /woo    /hubspot
              │
              └──────────────────────────────────────────────────────────────
```

### Link rules

| From | To | Link type |
|------|-----|-----------|
| Widget gallery | All widget landings | Widget cards |
| Widget landing | All hubs | Use case cards |
| Widget landing | Templates | "See Templates" CTA |
| Widget landing | Comparisons | Comparison strip |
| Hub | All child spokes | Platform cards |
| Spoke | Parent hub | Breadcrumb + back link |
| Spoke | Sibling spokes | "Also works with" section |
| All pages | Widget landing | Breadcrumb |
| All pages | Widget gallery | Breadcrumb |
| Comparison | Widget landing | CTA + Minibob |
| Templates | Widget landing | Breadcrumb |

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
│  For each locale:                                                           │
│    - /{locale}/widgets/                          (widget gallery)           │
│                                                                             │
│  For each widget:                                                           │
│    For each locale:                                                         │
│      - /{locale}/widgets/{widget}                (widget landing)           │
│      - /{locale}/widgets/{widget}/templates      (template gallery)         │
│      For each useCase:                                                      │
│        - /{locale}/widgets/{widget}/{useCase.slug}  (hub or spoke)          │
│      For each competitor:                                                   │
│        - /{locale}/compare/{widget}-vs-{competitor.slug}  (comparison)      │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  3. RENDER PAGES                                                            │
│                                                                             │
│  WidgetGallery.astro   → all widgets grid                                   │
│  WidgetLanding.astro   → hero, use cases, templates preview, stats, FAQ     │
│  TemplateGallery.astro → template cards for one widget                      │
│  HubPage.astro         → category + platform cards grid                     │
│  SpokePage.astro       → platform hero, install steps, related platforms    │
│  ComparisonPage.astro  → side-by-side table + advantages                    │
│                                                                             │
│  Each page includes:                                                        │
│  - hreflang links                                                           │
│  - canonical URL                                                            │
│  - Schema JSON-LD                                                           │
│  - Minibob island                                                           │
│  - Badges (Trending/New/Popular from gtm.badges)                            │
│  - Stats strip (from gtm.stats)                                             │
│  - Platform strip (from gtm.platforms)                                      │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  4. OUTPUT                                                                  │
│                                                                             │
│  dist/                                                                      │
│    en/widgets/index.html                          (widget gallery)          │
│    en/widgets/faq/index.html                      (widget landing)          │
│    en/widgets/faq/templates/index.html            (template gallery)        │
│    en/widgets/faq/for-ecommerce/index.html        (hub)                     │
│    en/widgets/faq/for-shopify/index.html          (spoke)                   │
│    en/widgets/faq/for-dentists/index.html         (niche spoke)             │
│    de/widgets/faq/index.html                                                │
│    de/widgets/faq/for-shopify/index.html                                    │
│    en/compare/faq-vs-elfsight/index.html          (comparison)              │
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
    
    blocks/                   # "Blocks" not "components" (avoid Dieter confusion)
      HeroWidget.astro        # Widget landing hero with live preview
      HeroSpoke.astro         # Platform/use-case specific hero
      PlatformStrip.astro     # Logo grid of supported platforms
      StepsProcess.astro      # 3-step embed process
      UseCaseGrid.astro       # Cards linking to hubs/spokes
      TemplateGallery.astro   # Template preview cards
      FeatureGrid.astro       # Checkmark feature list
      StatsStrip.astro        # "10,000+ created" numbers
      FaqSection.astro        # Meta FAQ about the widget
      ComparisonStrip.astro   # "Why Clickeen vs X?"
      ComparisonTable.astro   # Side-by-side feature table
      CtaBlock.astro          # Final conversion CTA
      InstallSteps.astro      # Platform-specific install guide
      RelatedLinks.astro      # Links to sibling spokes
      Breadcrumb.astro        # Navigation breadcrumb
      Minibob.astro           # Island — loads embed (only JS)
      Footer.astro            # Site footer
      Nav.astro               # Site navigation
      LanguageSelector.astro  # Locale picker
    
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

### Block design rules

| Rule | Rationale |
|------|-----------|
| **Call them "blocks", not "components"** | Avoid confusion with Dieter components (Bob ToolDrawer) |
| **Import only Dieter foundation tokens** | `@import 'dieter/tokens/colors.css'`, etc. — no Dieter components |
| **Astro-only (no React/Vue)** | SSG, no client-side hydration except Minibob island |
| **Scoped styles** | Each block has `<style>` scoped to that block |
| **Props from GTM JSON** | Blocks receive data, don't fetch it |
| **No hardcoded content** | Everything comes from GTM JSON or i18n catalogs |

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
