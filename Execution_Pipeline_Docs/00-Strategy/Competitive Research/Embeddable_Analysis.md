# Embeddable.co — Competitive Research & Analysis

Status: **RESEARCH**

Date: 2026-08-05

Source: embeddable.co (homepage, free-widgets, pricing, about), Common Ninja
blog (rebrand announcements), Product Hunt, LinkedIn.

## TL;DR — CRITICAL FINDING

**Embeddable.co IS Common Ninja.** It is not a separate company. Same founder
(Daniel Sternlicht), same co-founder (Erez Wolf), same LinkedIn
(`/company/common-ninja/`), same Instagram (`commonninja_official`), same team.
The about page says verbatim: *"We're the team behind Common Ninja (500,000+
businesses, 10+ years) who created Embeddable to empower marketers with
AI-powered custom widgets and landing pages."*

**Embeddable is Common Ninja's AI-powered evolution.** The pitch from their own
about page:

> "Even with 200+ widgets, marketers kept asking for modifications. We realized
> that no matter how many widgets we built, there would always be unique use
> cases we couldn't predict. That's when AI changed everything. Instead of
> choosing from 200+ pre-built widgets, what if marketers could describe exactly
> what they wanted and get it built instantly?"

This is significant because it means **Common Ninja is bifurcating its product
strategy:**
1. **Common Ninja (commoninja.com)** — the legacy 229-widget marketplace,
   still operational, per-widget pricing.
2. **Embeddable (embeddable.co)** — the AI-powered "describe anything and we
   build it" platform, with landing pages, AI agents, and a completely
   different pricing model.

This analysis covers Embeddable specifically. The Common Ninja analysis covers
the legacy marketplace. Together they describe one company with two products.

---

## 1. What Embeddable is

### Product

An **AI-powered custom widget and landing page builder.** Unlike Common Ninja
(which offers 229 pre-built widgets you configure), Embeddable lets you describe
what you want in natural language and AI generates a custom widget or landing
page. The tagline: "Custom experiences at the speed of AI."

Three product surfaces:
1. **Widgets** — 687 "widget templates" (not 687 distinct engines — these are
   starting-point templates across categories).
2. **Landing Pages** — AI-generated landing pages from templates.
3. **AI Agents** — custom AI agent templates for specific use cases (SEO agents,
   chat agents, etc.).

### How it differs from Common Ninja

| Dimension | Common Ninja (legacy) | Embeddable (new) |
| --- | --- | --- |
| Widget model | Pick from 229 pre-built → configure → embed | Describe what you want → AI builds it → embed |
| Pricing | Per-widget subscription ($24-62/widget/year) | Per-account tier ($0-185/mo, all widgets included) |
| AI | MCP server (external agents operate config) | AI IS the builder (prompt-to-widget generation) |
| Landing pages | Not available | Full landing page builder |
| Agents | Not available | AI agent templates |
| Catalog inflation | 229 entries, ~50 engines, 4.6× inflation | 687 templates, but generated/customizable — inflation is different (same engine, many visual presets) |
| Pageviews | Per-widget view limits | Account-level pageview limits (200 free → unlimited paid) |

### Target customer

Marketers who need custom interactive tools but can't code. The about page is
explicit: "Great tools should empower marketers, not require technical
knowledge."

---

## 2. Architecture and embed model

### How Embeddable actually works (verified by inspecting the product)

Embeddable is **not a widget configurator.** It is an **AI-powered no-code
application builder that outputs embeddable widgets.**

**The core mechanic is a chat-based AI builder.** Every page on embeddable.co
has a prompt box:
```
[Create a quiz about space exploration]
[Website Reference] [Skills] [Voice input] [Send]
```
Plus quick-start suggestions: "ROI Calculator for SaaS", "Email Capture Popup",
"Countdown Timer for Sale".

**The workflow:**
1. You type a natural-language prompt (or pick from 687 templates).
2. The AI generates a complete custom widget — not a config, **actual generated
   application code.**
3. You get a visual editor ("Dynamic Editor") to customize styles, content, and
   behavior in real-time.
4. The widget has **built-in backend capabilities:** AI, scrapers, databases,
   email sending, submissions, voting systems, and Stripe payment processing.
5. You embed it via script tag on any platform.

**This is a running application, not a static artifact.** The widget iframe
connects to Embeddable's backend for data, submissions, AI calls, and
integrations (HubSpot, Google Sheets, Notion, Slack, Google Analytics, Stripe).

**What this means architecturally:**
- **No saved HTML.** The widget is a live application, not a static file.
- **No source-truth model.** The AI-generated code IS the truth — there is no
  structured source contract, no typed artifact, no deterministic fingerprint.
- **No composition.** Each generated widget is a standalone application, not a
  composable unit that can be stacked into pages.
- **No crawlable content.** Everything is client-rendered from Embeddable's
  backend via the loader pattern.

### How it differs from Elfsight/Common Ninja widget platforms

| Dimension | Elfsight / Common Ninja | Embeddable |
| --- | --- | --- |
| Widget model | Configure pre-built display widgets | AI-generate custom interactive applications |
| Widget type | Display widgets (reviews, feeds, countdowns) | Interactive apps (calculators, quizzes, forms with logic, payment flows) |
| Backend logic | Minimal (fetch data from review/social APIs, display it) | Full (databases, scrapers, AI, email, payments, submissions) |
| Generated artifact | A configured instance of a fixed widget engine | A unique AI-generated application |
| Source truth | The widget config (structured) | The AI output (unstructured code blob) |

### Architecture classification: AI-generated application platform

This is NOT the Elfsight loader pattern (though embed delivery uses script tags).
It is closer to a **no-code app builder** (like Bubble or Glide) that happens
to output embeddable widgets. The generated widget is a running application
with backend dependencies on Embeddable's infrastructure.

### Serving architecture (verified on live URL)

**`embeddable.live`** is Embeddable's public serving domain — equivalent to
Clickeen's `clk.live`. Every generated widget/landing page gets a URL like:
```
https://embeddable.live/embed/{widgetId}
```

**Each generated widget is a compiled React application** with a unique ID
and hashed JS bundle. The page source on a live embeddable.live page:

```html
<div id="root">
  <div class="embeddable-widget">
    <!-- entire page content rendered here by React -->
  </div>
</div>
<script src="https://embeddable.live/proxy/{widgetId}/latest/assets/index-{hash}.js?noWrap=true">
</script>
```

This is a **React SPA** — one script loads and renders the entire page
client-side. The content is NOT in the HTML source. A crawler sees an empty
`<div id="root">` and a `<script>` tag.

**The `?noWrap=true` parameter** suggests there's a "wrapped" version (with
iframe wrapper for embedding on external sites) and an unwrapped version
(standalone page on embeddable.live).

**Verified on a live landing page** (`embeddable.live/embed/fnSgNk8VW1`):
The page was a full AI-generated consulting firm landing page — hero, bio,
credentials, three case studies with metrics, three pricing tiers ($15K-$35K/mo),
contact form, footer. 45,738 characters of HTML — but ALL rendered by the React
bundle. Zero crawlable content in the source HTML.

The "Made With Embeddable" watermark at the bottom confirms: free-tier branding
removal is a monetization lever (same as Elfsight/Common Ninja).

### Serving domain comparison

| Platform | Serving domain | What they serve | Crawlable? |
| --- | --- | --- | --- |
| **Clickeen** | `clk.live` | Saved complete HTML/CSS/JS | **Yes** — content in source HTML |
| **Elfsight** | `static.elfsight.com` | CDN loader script + empty div | No — content rendered by JS |
| **Embeddable** | `embeddable.live` | Compiled React SPA | **No — worst case** (React SPA is even less SEO-friendly than the loader pattern; at least Elfsight injects some DOM structure) |

**Clickeen's wedge against Embeddable:** "Your AI-generated landing page is
invisible to Google. Clickeen pages are real saved HTML that Google crawls
on the first request — no JS execution required."

**Crawlability:** Zero. The widget is a live application rendered client-side
from Embeddable's backend. Content, logic, and data all flow through
Embeddable's servers at runtime. A React SPA is the worst-case for SEO —
even Google's JS renderer may not fully execute complex React bundles.

**Composition:** Zero. Each generated widget is a standalone application.
There is no concept of stacking widgets into a composed page.

**Source ownership:** Zero. The customer does not own the generated code —
it runs on Embeddable's infrastructure and depends on their backend for all
functionality. The compiled JS bundle at `embeddable.live/proxy/{id}/latest/`
is not portable — if Embeddable shuts down, every generated widget dies.

---

## 3. Pricing intelligence

### Full pricing table (monthly billing)

| Plan | Price/mo | Pageviews/mo | Messages/mo | Seats | Storage | Submissions/mo | Integration tokens/mo | Watermark |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Free** | $0 | 200 | 6 daily (25/mo) | 1 | 25MB | 100 | 10 | Yes |
| **Starter** | $25 | Unlimited | 100 | 1 | 5GB | 5,000 | 1,000 | No |
| **Pro** | $45 | Unlimited | 250 | 3 | 10GB | 10,000 | 2,500 | No |
| **Business** | $185 | Unlimited | 1,250 | 10 | 50GB | 50,000 | 10,000 | No |

Annual billing: 30% off. PAYG (pay-as-you-grow) option also available.
"Messages" = AI generation credits. "Integration tokens" = third-party API
calls (e.g., Google Reviews API pulls). Both are metered and consumed per use.

### Key differences from Common Ninja pricing

1. **Per-account, not per-widget.** One Embeddable subscription includes ALL
   widgets and templates. No per-widget stacking.
2. **Pageview-metered (free tier only).** Free has 200 pageviews/mo; paid tiers
   are unlimited. This eliminates the Elfsight deactivation problem for paying
   customers.
3. **AI-message-metered.** The AI builder consumes "messages" — each AI
   generation costs credits. This is the real monetization lever: the more you
   use AI to build/customize, the more you pay.
4. **Submissions-metered.** Form submissions are capped (100-50,000/mo). This
   is the forms monetization from Jotform's playbook.
5. **"Messages never expire" add-on.** One-time $12 for 20 AI messages. A
   PAYG top-up that doesn't expire.

### The pricing seam

Embeddable's pricing is **fundamentally different from Common Ninja's** and
more competitive:
- No per-widget pricing (fixes Common Ninja's #1 complaint)
- No pageview deactivation for paid tiers (fixes Elfsight's #1 complaint)
- AI-message metering is the new cost axis — customers who lean heavily on AI
  will burn through messages and need to upgrade

**Clickeen's position:** Clickeen's account-owned model (no pageview limits, no
AI message metering, no submission caps) is still simpler. But Embeddable's
model is closer to Clickeen's than any other competitor's — they've already
moved away from per-widget pricing.

---

## 4. AI and agent-operation assessment

### AI IS the product

Embeddable's entire value proposition is AI-powered creation:
- **Prompt-to-widget:** describe what you want, AI builds a custom widget.
- **Prompt-to-landing-page:** describe the page, AI generates it.
- **AI customization:** "Customize with AI, match your brand."
- **AI Agents:** pre-built AI agent templates (SEO agents, chat agents, etc.)

This is the **most AI-forward widget platform** we've analyzed. Common Ninja's
MCP server lets external agents operate config; Embeddable's AI IS the builder.
Different approach, same direction.

### Agent operability

No MCP server visible on Embeddable (the MCP server was Common Ninja's legacy
product). But the AI builder is essentially an internal agent — it generates
custom widgets from natural language. Whether this can be exposed to external
agents (Claude, ChatGPT) via MCP or API is unknown.

### Assessment

Embeddable is the closest competitor to Clickeen on the AI axis. Both are
building toward "describe what you want and agents build it." The difference:
- **Embeddable:** AI generates custom widget code from prompts (from-scratch
  generation).
- **Clickeen:** Product Copilot operates structured source (editing existing
  widget instances through typed controls).

Embeddable's approach is more flexible (infinite custom widgets) but less
structured (generated code, not typed artifacts). Clickeen's approach is more
structured (typed contracts, saved HTML, deterministic artifacts) but less
flexible (8 widget types, not infinite).

---

## 5. Company scale

**Same company as Common Ninja.** All data from the Common Ninja analysis
applies:

- **Founder/CEO:** Daniel Sternlicht (also co-founder Erez Wolf)
- **Employees:** ~5-10 (LinkedIn profile search)
- **Revenue:** ~$1-3M/year (operating-cost estimate for Israeli team)
- **Headquarters:** Netanya, Israel
- **Founded:** Common Ninja 2021; Embeddable launched later
- **Funding:** MoreVC + angel investment
- **Product portfolio:** Common Ninja (legacy widgets), Embeddable (AI builder),
  BracketsNinja (tournaments), Vidocu.ai (AI video), Domainee.dev (custom
  domains)

**"Trusted by 10,000+ developers"** (Embeddable homepage) vs Common Ninja's
"500K+ businesses." The 10K number is likely Embeddable-specific signups, not
migrated Common Ninja users.

---

## 6. Localization

No visible localization features on Embeddable. Same gap as Common Ninja.

---

## 7. Customer voice

### Reviews

No independent G2/Capterra reviews for Embeddable specifically (it's too new
and has a separate brand from Common Ninja). Product Hunt launch page exists.

### Community

Shares Common Ninja's community infrastructure.

---

## 8. What Embeddable does well

### 8.1 AI-first is the right bet

They recognized that pre-built widget marketplaces have a ceiling (Common
Ninja's own about page admits: "no matter how many widgets we built, there
would always be unique use cases we couldn't predict"). AI-generated custom
widgets break that ceiling. This is the direction the market is heading.

### 8.2 Landing pages extend the surface

Widgets → landing pages → (eventually) full pages/sites. This is the same
trajectory Clickeen is on (widgets → pages → websites). Embeddable is further
along on the landing-page axis.

### 8.3 Per-account pricing (not per-widget)

They fixed Common Ninja's #1 complaint by moving to per-account pricing. Paid
tiers have unlimited pageviews — no deactivation risk.

### 8.4 The 687-template library is SEO catnip

687 widget templates indexed by category and search-engine-optimized (the URLs
are descriptive: `/free-calculator-widgets`, `/free-faq-widgets`, etc.). This
is a content marketing engine designed to capture "free [widget type] widget"
search queries. Each template page is an SEO landing page.

### 8.5 AI Agents as a product surface

Pre-built AI agent templates (SEO agents, etc.) extend beyond widgets into
agentic workflows. This is a broader product vision than any other widget
competitor.

---

## 9. What Embeddable does badly

### 9.1 Generated widgets are not structured artifacts

AI-generated custom widgets are code blobs, not typed contracts. There is no
baseLocale, no overlay model, no deterministic fingerprint, no saved-as-truth
HTML. The widget is whatever the AI generated — which means:
- No composition into pages (each widget is independent generated code)
- No locale overlays (each widget is single-language)
- No source-truth discipline (the AI output IS the truth)

### 9.2 Same loader-pattern architecture

Widget embeds are still CDN-loaded, client-rendered. Invisible to crawlers.
Same Elfsight disease.

### 9.3 AI-message metering is a new friction point

Customers who lean on AI will burn through messages quickly. $12 for 20
messages = $0.60 per AI generation. Heavy users will face escalating costs
that the pricing page doesn't make obvious.

### 9.4 Two products, one small team

Running Common Ninja (legacy marketplace) AND Embeddable (AI builder) AND
BracketsNinja AND Vidocu AND Domainee with ~5-10 people means every product
is under-resourced. Focus risk is high.

### 9.5 No shared design system

Each AI-generated widget is styled from scratch. No Dieter equivalent. No
token system. No brand consistency guarantee across generated widgets.

---

## 10. PMM artifacts

### 10.1 Positioning statement

> Embeddable is Common Ninja's AI-powered evolution — the same team (Daniel
> Sternlicht, ~5-10 employees, Netanya Israel) building a prompt-to-widget
> platform that generates custom widgets from natural language. It is the most
> AI-forward widget platform in the market, but generated widgets are code
> blobs, not structured artifacts. Clickeen's typed contracts + saved HTML +
> agent-operated composition is the structured alternative to AI-generated
> widget soup.

### 10.2 Battle card

| | Clickeen | Embeddable |
| --- | --- | --- |
| Where we win | Structured typed artifacts; saved crawlable HTML; Dieter design system; baseLocale + overlays; composed pages; deterministic fingerprints | — |
| Where they win | — | AI generates ANY widget from a prompt (infinite flexibility); landing pages; AI agents; 687 SEO-indexed template pages; per-account pricing (no per-widget) |
| When we lose | Customer wants a widget type Clickeen doesn't have and Embeddable's AI can generate it. Customer wants landing pages. Customer wants infinite widget variety. | Customer needs structured content, SEO crawlability, composition into pages, brand consistency across widgets, or localization |
| When we win | Customer cares about content ownership (saved HTML vs generated code blob). Customer wants to compose widgets into pages. Customer needs localization. Customer wants brand consistency (Dieter). |
| Killer question | "Embeddable's AI generates a custom code blob for each widget — no saved HTML, no locale overlays, no page composition, no design system. Do you want infinite widget variety with no structure, or structured widgets that compose into real crawlable pages?" |

### 10.3 Messaging guidance

**Say:**
1. "Your widgets are structured artifacts, not generated code blobs." Saved HTML, typed contracts, deterministic output.
2. "Your widgets compose into pages." Not independent generated islands.
3. "Your brand is consistent." Dieter design system, not per-widget AI styling.

**Do NOT say:**
1. "We have AI too." Product Copilot edits structured source; Embeddable generates from scratch. Different approach. Don't claim their flexibility.
2. "We have 687 templates." We have 8 widgets. The message is depth + structure, not template count.
3. "AI-generated widgets are bad." They're not — they're a legitimate approach for infinite variety. The message is "structure beats flexibility for content you own."

---

## 11. The strategic read

Embeddable is the **most strategically interesting competitor** because it
represents the same company (Common Ninja) making a fundamentally different
bet than their legacy product:

- **Common Ninja (legacy):** Pre-built widget marketplace, per-widget pricing,
  MCP server for external agents. The "many widgets" play.
- **Embeddable (new):** AI-generated custom widgets, per-account pricing,
  prompt-to-widget, landing pages, AI agents. The "infinite widgets via AI"
  play.

This bifurcation tells us Common Ninja's founder sees the market splitting:
- Customers who want pre-built widgets from a catalog (Common Ninja legacy).
- Customers who want AI to build custom widgets (Embeddable).

**Clickeen is playing a third game:** structured widgets that compose into
pages, operated by agents, saved as real HTML. Neither Common Ninja's catalog
nor Embeddable's AI generation produces structured, composable, crawlable
artifacts. That is Clickeen's unique position.

The key strategic question: will the market prefer **infinite AI-generated
flexibility** (Embeddable) or **structured composability with agents**
(Clickeen)? The answer is probably "both, for different customers" — but
Clickeen's structured approach is the only one that delivers SEO value, page
composition, localization, and brand consistency.

---

## Update to Common Ninja analysis

This finding should be noted in the Common Ninja analysis: **Common Ninja and
Embeddable are the same company.** The Common Ninja analysis covers the legacy
marketplace product. This analysis covers the AI-powered evolution. Together
they describe one company (~5-10 employees, Netanya, Israel, ~$1-3M revenue)
operating two widget products with different models.

---

## 12. Footer intelligence — the hidden goldmine

### The product portfolio (one team, five products)

The Embeddable.co footer "Tools" section reveals the full portfolio:
- **Website Widgets+** → `commoninja.com` (legacy widget marketplace)
- **Bracket Maker** → `bracketsninja.com` (tournament widgets)
- **AI Product Videos & Documentation** → `vidocu.ai` (AI video tool)
- **SaaS Custom Domains** → `domainee.dev` (white-label domains)

**One ~5-10 person team runs five separate branded products.** This is a
portfolio-operator strategy — multiple products, multiple domains, one small
team. Focus risk is high; every product is under-resourced.

### Identity confirmation

Social links in the footer:
- LinkedIn → `/company/common-ninja/` (NOT a separate Embeddable page)
- Instagram → `commonninja_official`
- TikTok → `@commonninja_official`
- YouTube → `@Embeddableco` (only Embeddable-specific channel)

**They haven't created a separate LinkedIn company page for Embeddable.** The
company identity IS Common Ninja. Embeddable is a product, not a company.

### The SEO content machine (700+ landing pages)

The footer reveals a massive SEO content strategy:
- **687 widget template pages** — each indexed by category and keyword
  (`/free-calculator-widgets`, `/free-faq-widgets`, etc.)
- **46 alternative-comparison pages** — `/alternatives/elfsight`,
  `/alternatives/jotform`, `/alternatives/typeform`, etc.
- **4 landing page template categories**
- **4 AI agent template categories**
- **Dedicated `/seo` page** pitching SEO benefits
- **`/free-tools` lead magnets**
- **`/alternatives` hub page** with 46 competitors across 11 categories

**Total: ~700+ SEO-indexed pages** designed to capture "free [widget] widget"
and "[competitor] alternative" search queries. For a 5-10 person team, this is
an extraordinarily aggressive content marketing play.

### The competitive map and their claimed advantages

Embeddable lists **46 competitors** across 11 categories. Each competitor has
a dedicated comparison page with Embeddable's claimed advantages. The pattern
is identical across all pages — they compete on one axis:

**"AI generation > pre-built catalog."**

#### vs Elfsight (the widget incumbent)

Embeddable claims:
1. "Build Anything with AI" — infinite widget variety, not limited to 80+
   pre-built templates
2. "True Customization" — complete design control vs predefined options
3. "Better Pricing" — $19/mo vs Elfsight's $25/mo (misleading: $19/mo only
   includes 100 AI messages; Elfsight's $25/mo includes unlimited widgets)
4. "One Platform for Everything" — calculators, forms, quizzes, popups, booking
5. "Real-time AI Editing" — chat with AI, no settings panels
6. "Modern Tech Stack"

Concedes to Elfsight:
- "Established marketplace with 80+ pre-built templates"
- "No learning curve — just pick and configure"
- "Extensive third-party integrations library"

#### vs Jotform (the forms giant)

Embeddable claims:
1. "AI vs 10,000 Templates" — describe instead of search
2. "Beyond Forms" — forms + calculators + quizzes + widgets
3. "No Submission Limits" — pay per AI token, not per submission
4. "Simpler Interface" — chat-based vs drag-and-drop
5. "Better Pricing" — $19/mo vs Jotform's $99/mo for 100K submissions

Concedes to Jotform:
- "Massive template library (10,000+)"
- "HIPAA compliance options"
- "Advanced payment processing features"

#### Numbers revealed on comparison pages

The comparison pages carry new numbers not found elsewhere:
- **"600K+ businesses"** (up from Common Ninja's "500K+")
- **"2M+ widgets created"** (across both platforms)
- **"10+ years expertise"**

#### The strategic read

Their entire competitive position is one sentence: **"Describe what you want
and AI builds it — no templates, no learning curve, no limits."** They concede
every structural advantage to incumbents (catalog size, integrations,
compliance, proven reliability) and bet entirely on AI generation being so
much better that customers accept fewer pre-built options.

**The pricing claims are misleading.** "$19/mo vs Elfsight's $25/mo" sounds
cheaper, but $19/mo only includes 100 AI generations. Once consumed, additional
messages cost $12/20 ($0.60 each). A customer who generates 10 widgets/month
and customizes each 3× = 30 messages = fine. A customer who iterates heavily
(50+ generations/month) will pay $19 + $24 = $43/mo — more than Elfsight.

**What they never mention on comparison pages:** crawlability, SEO, saved HTML,
content ownership, page composition, localization, or design systems. These are
exactly Clickeen's structural advantages — and Embeddable doesn't even
acknowledge them as competitive dimensions.

### Monetization channels

- **Affiliate program** (`/affiliates`) — referral revenue from recommending
  competitors they can't beat
- **Product Hunt badge** — launch strategy confirmation
- **Free tier → paid conversion** — the core model (messages, pageviews,
  submissions all metered)

---

## Sources

- [Embeddable — Homepage](https://embeddable.co/)
- [Embeddable — Free Widgets](https://embeddable.co/free-widgets)
- [Embeddable — Pricing](https://embeddable.co/pricing)
- [Embeddable — About](https://embeddable.co/about)
- [Embeddable — Product Hunt](https://www.producthunt.com/products/embeddable-ai)
- [Common Ninja Blog — Embeddable launch](https://www.commoninja.com/blog/common-ninja-goes-ai-embeddable-is-live-on-product-hunt)
- [Common Ninja Blog — Rebrand](https://www.commoninja.com/blog/breaking-website-walls-with-widgets-plus-common-ninja-rebrand)
- [Daniel Sternlicht — Embeddable contributor page](https://embeddable.co/contributors/daniel-sternlicht)
