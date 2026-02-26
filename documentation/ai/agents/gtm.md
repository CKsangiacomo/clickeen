# GTM Agent — AI VP of Marketing

STATUS: PRD (not yet implemented)
Created: 2026-01-02

---

## 0) What GTM means

**GTM = Go-To-Market.**

The GTM Agent is an async, durable agent that manages the entire marketing strategy for Clickeen across 100s of widgets × 100s of countries × 100s of ICPs. It is the AI VP of Marketing.

The GTM Agent knows:
- **Competitors** — features, pricing, weaknesses, positioning
- **Demand Gen** — SEO, content marketing, keyword trends, search intent
- **CRO** — landing page best practices, headline formulas, social proof, CTA optimization
- **ICPs** — pain points, language, objections for SaaS, ecommerce, restaurants, healthcare, etc.
- **Countries** — cultural nuances, local competitors, market maturity, tone preferences

The GTM Agent learns:
- Which pages convert
- Which headlines win
- Which use cases resonate
- Which markets perform

**This agent replaces a $1M+/year marketing org with ~$500/year in AI costs.**

---

## 1) What the GTM Agent produces

### Primary output: GTM JSON per widget

Every widget has a `gtm.json` file that contains everything needed to market it:

```json
// tokyo/widgets/faq/gtm.json
{
  "widgetSlug": "faq",
  "displayName": "FAQ Widget",
  "tagline": "Answer customer questions before they ask",
  "shortDescription": "Embed a beautiful, SEO-optimized FAQ section on any website.",
  
  "valueProps": [
    {
      "headline": "Reduce support tickets",
      "description": "Let customers self-serve answers 24/7",
      "icon": "headset"
    },
    {
      "headline": "Boost SEO",
      "description": "FAQ schema markup helps you rank for question-based searches",
      "icon": "search"
    },
    {
      "headline": "Save time",
      "description": "Update once, publish everywhere",
      "icon": "clock"
    }
  ],
  
  "useCases": [
    {
      "slug": "saas",
      "icp": "SaaS Companies",
      "headline": "FAQ for SaaS Companies",
      "description": "Help users understand pricing, features, and integrations",
      "painPoints": ["Too many support tickets", "Users don't find docs", "Onboarding friction"],
      "starterQuestions": [
        { "q": "What is {product}?", "a": "{product} is a..." },
        { "q": "How much does it cost?", "a": "We offer plans starting at..." },
        { "q": "Do you offer a free trial?", "a": "Yes, you can try..." },
        { "q": "What integrations do you support?", "a": "We integrate with..." }
      ],
      "keywords": ["saas faq widget", "software faq", "product faq", "help center widget"]
    },
    {
      "slug": "ecommerce",
      "icp": "E-commerce Stores",
      "headline": "FAQ for E-commerce",
      "description": "Answer questions about shipping, returns, and products",
      "painPoints": ["Cart abandonment from unanswered questions", "Repetitive support emails"],
      "starterQuestions": [
        { "q": "What are your shipping options?", "a": "We offer..." },
        { "q": "What is your return policy?", "a": "You can return..." },
        { "q": "Do you ship internationally?", "a": "Yes, we ship to..." }
      ],
      "keywords": ["ecommerce faq", "shopify faq widget", "store faq"]
    },
    {
      "slug": "restaurants",
      "icp": "Restaurants & Hospitality",
      "headline": "FAQ for Restaurants",
      "description": "Answer questions about hours, reservations, and menus",
      "painPoints": ["Phone calls for basic info", "Outdated info on review sites"],
      "starterQuestions": [
        { "q": "What are your hours?", "a": "We're open..." },
        { "q": "Do you take reservations?", "a": "Yes, you can book..." },
        { "q": "Do you have vegetarian options?", "a": "Yes, our menu includes..." }
      ],
      "keywords": ["restaurant faq", "menu faq widget", "hospitality faq"]
    }
  ],
  
  "competitors": [
    {
      "name": "Elfsight FAQ",
      "slug": "elfsight",
      "url": "https://elfsight.com/faq-widget/",
      "strengths": ["Large widget library", "Established brand"],
      "weaknesses": ["No AI", "Clunky editor", "Expensive"],
      "ourAdvantages": ["AI-powered content", "Better SEO", "Modern design", "Faster setup"]
    },
    {
      "name": "Tidio FAQ",
      "slug": "tidio",
      "url": "https://tidio.com/",
      "strengths": ["Chat integration"],
      "weaknesses": ["Focused on chat, FAQ is secondary", "Complex pricing"],
      "ourAdvantages": ["Purpose-built FAQ", "Simpler pricing", "Better SEO"]
    }
  ],
  
  "seo": {
    "primaryKeywords": ["faq widget", "embeddable faq", "faq for website", "free faq widget"],
    "longTailPatterns": [
      "{icp} faq widget",
      "best faq widget for {icp}",
      "faq widget like {competitor}",
      "{competitor} alternative"
    ],
    "schemaType": "FAQPage",
    "searchIntent": "transactional"
  },
  
  "cro": {
    "primaryCta": "Try it free",
    "secondaryCta": "See examples",
    "socialProof": ["Used by 10,000+ websites", "4.9/5 on G2"],
    "urgency": null,
    "objectionHandlers": [
      { "objection": "Is it really free?", "response": "Yes, free forever with branding. Remove branding for $X/mo." },
      { "objection": "Will it slow my site?", "response": "No, our widget loads in under 100ms." }
    ]
  },
  
  "locales": {
    "de": {
      "displayName": "FAQ-Widget",
      "tagline": "Beantworten Sie Kundenfragen, bevor sie gestellt werden",
      "shortDescription": "Betten Sie einen schönen, SEO-optimierten FAQ-Bereich auf jeder Website ein.",
      "valueProps": [
        { "headline": "Support-Tickets reduzieren", "description": "Lassen Sie Kunden rund um die Uhr Antworten finden" }
      ]
    },
    "es": {
      "displayName": "Widget de Preguntas Frecuentes",
      "tagline": "Responde las preguntas de tus clientes antes de que las hagan"
    }
  },
  
  "meta": {
    "createdAt": "2026-01-02T00:00:00Z",
    "updatedAt": "2026-01-02T00:00:00Z",
    "generatedBy": "gtm-agent",
    "version": 1,
    "performanceScore": null
  }
}
```

### Secondary outputs

| Output | Location | Purpose |
|--------|----------|---------|
| **Strategy reports** | `gtm-reports/{runId}/strategy.md` | Human-readable analysis and recommendations |
| **Competitor intel** | D1 `competitor_intel` table | Structured competitor data for cross-widget use |
| **Keyword research** | D1 `keyword_research` table | Keywords, volumes, difficulty, trends |
| **Page performance** | D1 `page_performance` table | Conversion rates, rankings, traffic by page |

---

## 2) Design principles

| Principle | What it means |
|-----------|---------------|
| **Data-driven** | Every decision backed by research, performance, or competitive intel |
| **Continuous** | Not a one-time generation. Learns and improves from outcomes. |
| **100⁵ scale** | Works for 100s of widgets × 100s of countries × 100s of ICPs |
| **Human-in-loop** | Agent proposes. Humans can review and override. |
| **Token-efficient** | Caches research. Chunks processing. Doesn't waste tokens. |

---

## 3) Architecture

### System diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GTM Agent System                                  │
│                                                                             │
│  ┌──────────────┐                                                           │
│  │ Triggers     │                                                           │
│  │              │                                                           │
│  │ - Weekly cron│─────────────────────────────────────────┐                │
│  │ - New widget │                                         │                │
│  │ - Performance│                                         │                │
│  │   alert      │                                         │                │
│  │ - Manual run │                                         │                │
│  └──────────────┘                                         │                │
│                                                           ▼                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Orchestrator (Durable Object)                                       │   │
│  │                                                                     │   │
│  │ State:                                                              │   │
│  │   runId, phase, widgets[], locales[], checkpoint, stats             │   │
│  │                                                                     │   │
│  │ Phases:                                                             │   │
│  │   1. RESEARCH    — Crawl competitors, analyze market, keywords      │   │
│  │   2. STRATEGIZE  — Define positioning, identify use cases           │   │
│  │   3. GENERATE    — Create/update GTM JSON per widget                │   │
│  │   4. LOCALIZE    — Adapt strategy per country/ICP                   │   │
│  │   5. OPTIMIZE    — Improve underperforming pages                    │   │
│  │   6. WRITE       — Output GTM JSON + strategy reports               │   │
│  │   7. DONE                                                           │   │
│  └────────────────────────────────┬────────────────────────────────────┘   │
│                                   │                                        │
│                     Enqueues tasks│                                        │
│                                   ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Task Queue (Cloudflare Queue)                                       │   │
│  │                                                                     │   │
│  │ Task types:                                                         │   │
│  │   { type: "research:competitor", competitor, widget }               │   │
│  │   { type: "research:keywords", widget, locale }                     │   │
│  │   { type: "research:market", icp }                                  │   │
│  │   { type: "strategize:positioning", widget }                        │   │
│  │   { type: "strategize:usecases", widget }                           │   │
│  │   { type: "generate:gtm", widget }                                  │   │
│  │   { type: "localize:country", widget, locale }                      │   │
│  │   { type: "optimize:page", widget, useCase, locale }                │   │
│  └────────────────────────────────┬────────────────────────────────────┘   │
│                                   │                                        │
│                     Workers consume (parallel)                             │
│                                   ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Task Workers (stateless)                                            │   │
│  │                                                                     │   │
│  │ research:competitor                                                 │   │
│  │   1. Fetch competitor page (or use cache if <30 days)               │   │
│  │   2. Extract: features, pricing, positioning, weaknesses            │   │
│  │   3. Store in D1 competitor_intel                                   │   │
│  │                                                                     │   │
│  │ research:keywords                                                   │   │
│  │   1. Call keyword API (or use cache)                                │   │
│  │   2. Get volumes, difficulty, trends                                │   │
│  │   3. Store in D1 keyword_research                                   │   │
│  │                                                                     │   │
│  │ research:market                                                     │   │
│  │   1. Analyze ICP characteristics                                    │   │
│  │   2. Identify pain points, language, objections                     │   │
│  │   3. Store in D1 market_research                                    │   │
│  │                                                                     │   │
│  │ strategize:positioning                                              │   │
│  │   1. Load competitor intel from D1                                  │   │
│  │   2. Define unique positioning (LLM)                                │   │
│  │   3. Store positioning in working memory                            │   │
│  │                                                                     │   │
│  │ strategize:usecases                                                 │   │
│  │   1. Load market research, keyword data                             │   │
│  │   2. Identify high-value ICPs (LLM)                                 │   │
│  │   3. Generate use case objects                                      │   │
│  │                                                                     │   │
│  │ generate:gtm                                                        │   │
│  │   1. Combine positioning, use cases, competitor data                │   │
│  │   2. Generate complete GTM JSON (LLM)                               │   │
│  │   3. Store proposed GTM in R2                                       │   │
│  │                                                                     │   │
│  │ localize:country                                                    │   │
│  │   1. Load GTM JSON for widget                                       │   │
│  │   2. Adapt for locale (not just translate — localize strategy)      │   │
│  │   3. Update locales object in GTM JSON                              │   │
│  │                                                                     │   │
│  │ optimize:page                                                       │   │
│  │   1. Load page performance from D1                                  │   │
│  │   2. Identify underperforming elements                              │   │
│  │   3. Generate improved copy (LLM)                                   │   │
│  │   4. Update GTM JSON with improvements                              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                   │                                        │
│                                   ▼                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ Storage Layer                                                       │   │
│  │                                                                     │   │
│  │ D1 (SQLite) — structured, queryable                                 │   │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │ │ competitor_intel                                                │ │   │
│  │ │   competitor TEXT, widget TEXT, features JSON, pricing JSON,    │ │   │
│  │ │   weaknesses JSON, fetchedAt INTEGER                            │ │   │
│  │ │                                                                 │ │   │
│  │ │ keyword_research                                                │ │   │
│  │ │   keyword TEXT, widget TEXT, locale TEXT, volume INTEGER,       │ │   │
│  │ │   difficulty INTEGER, trend TEXT, fetchedAt INTEGER             │ │   │
│  │ │                                                                 │ │   │
│  │ │ market_research                                                 │ │   │
│  │ │   icp TEXT, painPoints JSON, language JSON, objections JSON     │ │   │
│  │ │                                                                 │ │   │
│  │ │ page_performance                                                │ │   │
│  │ │   widget TEXT, useCase TEXT, locale TEXT, pageViews INTEGER,    │ │   │
│  │ │   conversions INTEGER, conversionRate REAL, ranking INTEGER,    │ │   │
│  │ │   updatedAt INTEGER                                             │ │   │
│  │ │                                                                 │ │   │
│  │ │ run_history                                                     │ │   │
│  │ │   runId TEXT PRIMARY KEY, startedAt INTEGER, completedAt INTEGER│ │   │
│  │ │   status TEXT, stats JSON                                       │ │   │
│  │ └─────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                     │   │
│  │ R2 (Objects) — files, reports                                       │   │
│  │ ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │ │ gtm-outputs/{widgetSlug}/                                       │ │   │
│  │ │   gtm.json              (proposed GTM, ready to copy to Tokyo)  │ │   │
│  │ │   gtm.previous.json     (previous version for diff)             │ │   │
│  │ │                                                                 │ │   │
│  │ │ gtm-reports/{runId}/                                            │ │   │
│  │ │   strategy.md           (human-readable strategy report)        │ │   │
│  │ │   changes.md            (what changed this run)                 │ │   │
│  │ │   performance.md        (page performance analysis)             │ │   │
│  │ │   metadata.json         (run stats, timing, token usage)        │ │   │
│  │ └─────────────────────────────────────────────────────────────────┘ │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Cloudflare bindings

```toml
# wrangler.toml (gtm-agent service)

name = "gtm-agent"

[[queues.producers]]
queue = "gtm-agent-tasks"
binding = "TASK_QUEUE"

[[queues.consumers]]
queue = "gtm-agent-tasks"
max_batch_size = 1
max_retries = 3

[[d1_databases]]
binding = "DB"
database_name = "gtm-agent"
database_id = "..."

[[r2_buckets]]
binding = "STORAGE"
bucket_name = "gtm-agent-storage"

[[durable_objects.bindings]]
name = "ORCHESTRATOR"
class_name = "GTMAgentOrchestrator"

[triggers]
crons = ["0 2 * * 0"]  # Every Sunday at 2am UTC
```

---

## 4) Pipeline phases

### 4.1 RESEARCH

**Goal**: Gather competitive intel, keyword data, and market research.

**Competitor research**:
1. For each widget, identify 3-5 top competitors
2. Crawl competitor landing pages (use cache if <30 days)
3. Extract: features, pricing, positioning, unique selling points
4. Identify weaknesses (from reviews, missing features, bad UX)
5. Store structured data in D1

**Keyword research**:
1. For each widget × locale, query keyword API
2. Get: primary keywords, long-tail variations, volumes, difficulty, trends
3. Identify high-opportunity keywords (high volume, low difficulty)
4. Store in D1

**Market research**:
1. For each ICP (SaaS, ecommerce, restaurants, etc.)
2. Research: pain points, language patterns, common objections
3. Store in D1

**Caching**: Research is expensive. Cache results for 30 days. Only re-fetch on explicit trigger.

### 4.2 STRATEGIZE

**Goal**: Define positioning and identify high-value use cases.

**Positioning**:
1. Load competitor intel
2. Identify gaps in market (what competitors don't do well)
3. Define Clickeen's unique positioning (LLM)
4. Output: tagline, value props, differentiators

**Use cases**:
1. Load keyword data and market research
2. Identify high-value ICPs based on:
   - Keyword volume (demand signal)
   - Competition (can we win?)
   - Fit (does our widget solve their problem?)
3. Generate use case objects with:
   - Headline, description, pain points
   - Starter questions (for SDR Copilot)
   - Keywords

### 4.3 GENERATE

**Goal**: Create complete GTM JSON for each widget.

**Process**:
1. Combine: positioning, use cases, competitor data, keywords
2. Generate full GTM JSON (LLM)
3. Validate JSON structure
4. Store proposed GTM in R2

### 4.4 LOCALIZE

**Goal**: Adapt GTM for each country.

**This is NOT just translation**. Localization includes:
- Cultural tone (formal/informal)
- Local competitors (different in each market)
- Local pain points (different priorities)
- Local pricing expectations
- Local social proof

**Process**:
1. Load base GTM JSON
2. For each locale:
   - Adapt messaging for culture
   - Add local competitors if relevant
   - Adjust value props for local priorities
3. Update `locales` object in GTM JSON

### 4.5 OPTIMIZE

**Goal**: Improve underperforming pages.

**Triggers**:
- Page conversion rate < threshold
- Page ranking dropped
- Low time-on-page

**Process**:
1. Load page performance from D1
2. Identify underperforming elements:
   - Weak headline? → test alternatives
   - Wrong use cases? → reorder or add
   - Missing objection handlers? → add
3. Generate improved copy (LLM)
4. Update GTM JSON
5. Track changes for A/B comparison

### 4.6 WRITE

**Goal**: Output final GTM JSON and reports.

**Outputs**:
1. `gtm-outputs/{widgetSlug}/gtm.json` → proposed GTM
2. `gtm-reports/{runId}/strategy.md` → human-readable summary
3. `gtm-reports/{runId}/changes.md` → what changed this run
4. Update `run_history` in D1

---

## 5) Learning loop

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GTM AGENT LEARNING LOOP                           │
│                                                                             │
│   GTM Agent outputs GTM JSON                                                │
│          │                                                                  │
│          ▼                                                                  │
│   Human reviews (optional) → copies to tokyo/widgets/{widget}/gtm.json      │
│          │                                                                  │
│          ▼                                                                  │
│   Prague builds pages from GTM JSON                                         │
│          │                                                                  │
│          ▼                                                                  │
│   Pages deployed to Cloudflare Pages                                        │
│          │                                                                  │
│          ▼                                                                  │
│   Berlin tracks:                                                            │
│   - Page views, time on page                                                │
│   - Minibob opens, SDR Copilot conversations                                │
│   - Signup conversions                                                      │
│   - Keyword rankings (via Search Console API)                               │
│          │                                                                  │
│          ▼                                                                  │
│   Performance data → D1 page_performance                                    │
│          │                                                                  │
│          ▼                                                                  │
│   GTM Agent reads performance data                                          │
│          │                                                                  │
│          ▼                                                                  │
│   GTM Agent identifies:                                                     │
│   - Which pages convert well → double down                                  │
│   - Which pages underperform → optimize                                     │
│   - Which use cases resonate → expand                                       │
│   - Which keywords rank → build more content                                │
│          │                                                                  │
│          ▼                                                                  │
│   Updated GTM JSON → cycle repeats                                          │
│                                                                             │
│   ∞ CONTINUOUS IMPROVEMENT                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 6) Token efficiency

| Strategy | Implementation |
|----------|----------------|
| **Cache research** | Competitor intel, keywords cached 30 days in D1 |
| **Chunk by widget** | Process one widget at a time, not all at once |
| **Two-phase LLM** | Cheap model for research extraction, quality model for copy generation |
| **Incremental updates** | Only regenerate what changed, not entire GTM |
| **Diff-based optimization** | Only optimize pages that underperform, not all pages |

**Token budget**: 500K tokens per full run (all widgets). With caching, typical run uses <100K.

---

## 7) Human review workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  GTM Agent completes run                                                    │
│                                                                             │
│  R2: gtm-outputs/{widgetSlug}/                                              │
│       ├── gtm.json              (proposed)                                  │
│       └── gtm.previous.json     (for diff)                                  │
│                                                                             │
│  R2: gtm-reports/{runId}/                                                   │
│       ├── strategy.md           (summary)                                   │
│       ├── changes.md            (what changed)                              │
│       └── performance.md        (analysis)                                  │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  Human review (optional)                                                    │
│                                                                             │
│  1. Read strategy.md and changes.md                                         │
│  2. Review proposed gtm.json                                                │
│  3. Accept: copy gtm.json → tokyo/widgets/{widget}/gtm.json                 │
│     OR modify: edit and then copy                                           │
│     OR reject: don't copy, agent will try again next run                    │
│  4. Commit to git                                                           │
│  5. Prague rebuilds with new GTM                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Trust level**: Initially, human reviews all changes. As trust builds, auto-copy for low-risk changes (typo fixes, stat updates) while flagging strategy changes for review.

---

## 8) Configuration

```json
// gtm-agent-config.json (stored in R2 or repo)
{
  "widgets": ["faq", "testimonials", "pricing", "logo-showcase", "contact"],
  "locales": ["en", "de", "es", "fr", "pt", "ja"],
  "icps": ["saas", "ecommerce", "restaurants", "healthcare", "agencies", "education"],
  
  "competitors": {
    "faq": ["elfsight", "tidio", "helpscout"],
    "testimonials": ["elfsight", "testimonial.to", "senja"],
    "pricing": ["elfsight", "pricetable.io"]
  },
  
  "research": {
    "cacheTtlDays": 30,
    "keywordApi": "dataforseo",
    "maxCompetitorsPerWidget": 5
  },
  
  "optimization": {
    "conversionRateThreshold": 0.02,
    "rankingDropThreshold": 10
  },
  
  "llm": {
    "research": { "model": "gpt-4o-mini", "maxTokens": 2000 },
    "strategy": { "model": "gpt-4o", "maxTokens": 4000 },
    "copy": { "model": "gpt-4o", "maxTokens": 4000 },
    "localize": { "model": "gpt-4o", "maxTokens": 2000 }
  },
  
  "tokenBudgetPerRun": 500000,
  "schedule": "0 2 * * 0"
}
```

---

## 9) Integration with other agents

| Agent | How GTM Agent integrates |
|-------|-------------------------|
| **UX Writer Agent** | GTM Agent generates marketing copy. UX Writer improves i18n quality. They work on different layers (GTM = strategy, UX Writer = polish). |
| **SDR Copilot** | GTM Agent provides starter questions for each use case. SDR Copilot uses them for content-first personalization. |

---

## 10) Success criteria

### Marketing metrics
- Pages generated: 100+ per widget × locale × use case
- Keyword rankings: track improvement over time
- Organic traffic: track growth
- Conversion rate: target >2% from page view to Minibob open

### Efficiency metrics
- Token cost per run: <$50 (500K tokens at $0.10/1K)
- Research cache hit rate: >80%
- Human review time: <30 min per run

### Quality metrics
- GTM JSON validity: 100% valid schema
- Copy quality: human reviewer approval rate >80%
- Competitive accuracy: claims are defensible and accurate

---

## 11) File structure

```
services/
  gtm-agent/
    src/
      index.ts              # Cron trigger + queue consumer entry
      orchestrator.ts       # Durable Object
      workers/
        research.ts
        strategize.ts
        generate.ts
        localize.ts
        optimize.ts
      lib/
        llm.ts              # LLM client with token tracking
        keywords.ts         # Keyword API client
        scraper.ts          # Competitor page scraper
        gtm-schema.ts       # GTM JSON validation
    wrangler.toml
    package.json

tokyo/widgets/
  faq/
    spec.json
    agent.md
    gtm.json                # GTM output (committed after review)
    widget.html
    widget.css
    widget.client.js
  
  testimonials/
    ...
    gtm.json

documentation/
  ai/
    agents/
      gtm.md                # This doc
```

---

## 12) Dependencies

| Dependency | Purpose |
|------------|---------|
| Cloudflare Workers | Runtime |
| Cloudflare Durable Objects | Orchestrator state |
| Cloudflare Queues | Task distribution |
| Cloudflare D1 | Structured storage (intel, research, performance) |
| Cloudflare R2 | Object storage (GTM outputs, reports) |
| OpenAI API (or similar) | LLM for research, strategy, copy |
| Keyword API (DataForSEO, etc.) | Keyword volumes, difficulty |
| Berlin (analytics) | Page performance data |
