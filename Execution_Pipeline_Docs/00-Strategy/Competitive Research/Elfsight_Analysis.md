# Elfsight — Competitive Research & Analysis

Status: **RESEARCH**

Date: 2026-08-05

Source: elfsight.com (homepage, widget catalog, pricing, AI chatbot, website
translator), G2 (907 reviews), Trustpilot, Reddit (r/webflow, r/bigseo,
r/webdev), Elfsight Community Forum, Crunchbase, LinkedIn, and
technical inspection of their embed code pattern via browser and search.

## TL;DR

Elfsight is the **original widget-platform template** — the company whose name
is synonymous with the "loader pattern" that Clickeen's three-file law exists
to reject. Founded 2012 in Yerevan, Armenia. Bootstrapped. ~20-30 employees (LinkedIn
company page claims 51-200 but actual profile search reveals ~9-10 people,
suggesting ~20-30 after coverage adjustment).
Revenue not publicly disclosed (private, bootstrapped). 97 widget entries (headline) reduced to **~45 distinct
engines** after deduplication. 4.8/5 on G2 (907 reviews — dramatically more
than Common Ninja's 6 or OpenWidget's handful). Claimed 3,000,000 users;
G2 review volume and market presence suggest this number is real in terms of
total signups, though active paid is likely a small fraction.

Elfsight is the **most mature, most reviewed, and most established** competitor
in the widget-platform niche. They have the deepest market penetration, the
strongest brand recognition, and the most customer love. They also have the
exact same architecture Clickeen rejects (CDN script + runtime fetch +
browser-rendered DOM, no crawlable content) and they have admitted in their own
community forum that their widgets offer no SEO benefit because content is
JavaScript-rendered.

---

## 1. What Elfsight is

### Product

A no-code website widget platform. The user picks a widget from a catalog,
customizes it in a visual editor, and embeds it via a script snippet on any
platform (WordPress, Shopify, Wix, Squarespace, Webflow, Elementor, HTML, and
40+ others). Founded 2012; the longest-running player in this space.

### Business model

Freemium SaaS. Two subscription types:
- **Single App subscription** — one widget type, tiered by views/widgets.
- **All Apps Pack** (96 apps) — access to all widgets, tiered by views/widgets
  per app.

14-day refund. Free tier with Elfsight branding and 200 views/month.

### Target customer

Small businesses, agencies, and website owners who want specific functionality
(reviews, social feeds, chat, forms, countdowns) without coding. Same audience
as Common Ninja, but Elfsight has been serving them for 12+ years.

---

## 2. The widget catalog (headline: 97 widgets — actual: ~45 engines, see §14)

The homepage claims "97 No-Code Widgets." After full deduplication of the
catalog (§14), the real engineering surface is **~45 distinct widget engines**,
inflated ~2.1× through connector multiplication (same review engine × 16
platforms) and content-preset multiplication. This is a lower inflation factor
than Common Ninja (4.6×) — Elfsight has more genuinely unique widget engines,
but still inflates through connector variants.

### Widget categories Clickeen does NOT cover

Same gaps as Common Ninja: social feeds (10+ platforms), reviews aggregators
(16+ platforms), chat buttons (7 platforms), audio/media players (4 variants),
popups/bars, e-commerce (booking, catalog, store locator), data viz (stocks,
calculator).

---

## 3. Architecture and embed model

### The embed

The Elfsight embed is **the canonical loader pattern** — so canonical it is
literally called "the Elfsight pattern" inside Clickeen's own PRDs and tenets.

```html
<script src="https://static.elfsight.com/platform/platform.js"
        data-use-service-core defer></script>
<div class="elfsight-app-{WIDGET-ID}"></div>
```

**Architecture classification: Loader/Elfsight pattern.**

1. A single `platform.js` script loads from `static.elfsight.com`.
2. The script scans the page for `<div class="elfsight-app-{ID}">` containers.
3. For each container, it fetches the widget configuration from Elfsight's API.
4. It renders the entire widget DOM client-side via JavaScript.
5. A crawler sees the empty `<div>` container and the `<script>` tag — **zero
   widget content in the HTML source.**

### No composition, no pages

Same as Common Ninja and OpenWidget: each widget is independently embedded.
There is no "Page" concept. No composition of widgets into a single document.
No generated artifact. No standalone crawlable URL.

### The no-code editor

A visual editor with live preview, templates, style options, and a new AI
chatbot builder that scans the user's website to auto-generate its knowledge
base. Custom CSS is available at all tiers (via the Elfsight team's
"tailor-made adjustments" service). There is no shared design system — each
widget is styled independently.

### The SEO admission

In their own community forum (community.elfsight.com), Elfsight staff confirmed:
*"Our widgets don't benefit SEO for our Service. When the widget is installed on
the website, benefits will go to the website owner."* This is a tacit admission
that widget content is JavaScript-rendered and not crawlable. The "benefits"
referred to are user experience, not search indexing.

---

## 4. The AI surface

Elfsight has one significant AI product: the **AI Chatbot widget**.

- **What it does:** A configurable chatbot that answers visitor questions 24/7.
  It can be trained on the user's own data: it scans the user's website to
  build its knowledge base, and also supports PDF, TXT, JSON, DOCX, PPTX, HTML,
  and MD file uploads plus manual Q&A entries.
- **Underlying model:** Not explicitly stated, but a "ChatGPT Travel" template
  suggests OpenAI/GPT integration.
- **AI-assisted creation:** During setup, the AI "builds itself" by analyzing
  the user's website content to auto-generate the knowledge base, personality,
  tone of voice, initial greetings, and capabilities.
- **No MCP server.** Unlike Common Ninja, Elfsight does not have an MCP server
  or any external agent-operation surface. AI lives only inside the chatbot
  widget and the setup flow.
- **No prompt-to-widget builder.** Unlike Common Ninja's AI Editor, Elfsight
  does not offer a "describe a widget and AI builds it" tool.

**Assessment:** Elfsight's AI is product-embedded (the chatbot widget) but not
platform-level (no AI editor, no MCP, no agent-operated widget lifecycle). This
puts them behind Common Ninja on the agent-operation axis.

---

## 5. Company scale and revenue estimation

### Claimed scale

- **"Trusted by over 3,000,000 small business, agencies and top global brands
  worldwide."** (Homepage, Trustpilot, multiple pages). Founded 2012 — 14 years
  to accumulate signups.

### Employee count

| Source | Employee count | Reliability |
| --- | --- | --- |
| LinkedIn company page (self-reported) | "51-200" | **Unreliable** — self-selected range, not a count |
| LinkedIn profile search (actual people) | ~9-10 visible | **Ground truth** — real profiles with Elfsight as employer |
| Adjusted for LinkedIn coverage gap (CIS/Armenia) | **~20-30** | **Best estimate** — 2-3× visible count |

The LinkedIn company page claims "51-200 employees" — this is a self-reported
range selected from a dropdown, not a verified count. A LinkedIn profile search
for people listing Elfsight as their employer surfaces only ~9-10 individuals:
3 developers (Vladimir Ivanenko — Lead, Vadim Shlykov — React, Anton Malkin —
Software Engineer), 3 support/community (Helga Razinkova — Community Manager,
Ksenia Slastnikova — Customer Service, Aleksandra Freimundt — Chats Team Lead),
2 marketing (Julia Statsenko — Content, Olga Z. — Affiliate), and 1 other.

LinkedIn typically surfaces 30-60% of actual employees for small companies in
CIS/Armenian markets (many people don't maintain profiles or list employers).
Applying a 2-3× multiplier to the visible count: **~20-30 employees.**

**Best estimate: ~20-30 employees.** A small, lean, bootstrapped team — not the
mid-size company the LinkedIn range implies.

### Revenue estimation

- **Not publicly disclosed.** Elfsight is private and bootstrapped ($0 funding
  per Crunchbase).
- **Funding:** $0 raised — bootstrapped since 2012.
- **Operating cost floor:** 20-30 employees in Yerevan, Armenia, at fully-loaded
  ~$35-50K/year per employee (Armenian dev salaries + overhead) =
  **~$0.7-1.5M/year operating cost.** They must be generating at least this
  much to be sustainable for 12+ years bootstrapped.
- **Revenue estimate:** With profit margin, revenue is probably
  **$1.5-4M/year.** A profitable small SaaS business, not a scale-up.
- Third-party estimate services produce unreliable scraped guesses — do not cite.

### Install verification

- **G2 review count: 907 at 4.8/5.** This is 150× more reviews than Common Ninja
  (6) and confirms Elfsight has dramatically deeper market penetration. G2
  under-represents the total SMB customer base (most small-business owners never
  review on G2), so the real paying customer count is likely in the low
  thousands to tens of thousands.
- **The 3,000,000 claim** is almost certainly total signups over 12 years
  (including free/churned/inactive). It is a marketing number, not an active-user
  count. But unlike Common Ninja's "500K" (which has almost no review evidence),
  Elfsight's 3M has meaningful review volume behind it — they are genuinely the
  market leader in this niche.
- **BuiltWith** reportedly tracks Elfsight installations but data is behind a
  paywall.

### Growth trajectory signals

- **14th Birthday Sale (33% OFF +1 FREE MONTH).** Running a birthday promotion
  suggests an established company celebrating longevity, not a startup needing
  to drive urgency.
- **Product velocity:** recently added AI Chatbot, Calculator, Store Locator,
  Website Translator, Spinning Wheel, Telegram Feed. Shipping steadily.
- **Social media:** active across YouTube, Instagram, Facebook, TikTok, X,
  LinkedIn. Regular content cadence.
- **No outside funding** after 12 years — they are profitable and sustainable.

---

## 6. Localization and locale model

Elfsight's localization is **a widget, not a platform feature.** The
"Website Translator" widget provides:

- **100+ languages** via Google's AI translation engine.
- **Instant automated translation** of page content (menus, articles, checkout).
- **Granular exclusions** — prevent specific elements (e.g., email addresses)
  from being translated.
- **Full custom translation editing** — stated as "in development."
- **No RTL support documented.**
- **No date/time/number formatting per locale documented.**

**Compared to Clickeen:** Elfsight treats localization as a widget you embed
(a Google Translate wrapper), not as a structural property of the widget
platform. There is no baseLocale concept, no overlay model, no translation
agent, no source-truth discipline. Each widget renders in one language; if you
want the page translated, you embed a separate translator widget. This is the
opposite of Clickeen's baseLocale + exact overlays + Babel protocol.

---

## 7. Customer voice

### Reviews summary

| Platform | Score | Review count |
| --- | --- | --- |
| G2 | **4.8/5** | **907** |
| Trustpilot | ~5/5 | Listed (high volume) |

**Elfsight has 150× more G2 reviews than Common Ninja (6) and vastly more than
OpenWidget.** This is the strongest market-presence signal in the widget niche.

### G2 AI-generated summary (from 907 reviews)

> "Users consistently praise the product for its **ease of use** and
> **exceptional customer support**, highlighting how quickly they can implement
> widgets and receive assistance when needed. Many appreciate the wide variety
> of widgets available, which enhance their websites without requiring
> extensive technical skills. A common limitation noted is the **view limits**
> on certain plans, which can restrict usage for high-traffic sites."

### Top praises (what customers love)

1. **Customer support.** 31 mentions (top pro). "Exceptional customer support"
   (Trustpilot). "Customer support that is always incredibly responsive" (G2,
   Petar D., Aerospace). Elfsight's support is their #1 differentiator.
2. **Ease of use.** 23 mentions. "How effortlessly it bridges the gap between
   advanced AI capabilities and no-code implementation" (G2, Petar D.).
3. **Widget variety.** 22 mentions. "Wide variety of widgets available, which
   enhance their websites without requiring extensive technical skills" (G2).
4. **Easy setup.** 16 mentions. "Deploy the AI Chatbot widget across our site
   via a simple copy-paste code snippet without touching a line of backend
   infrastructure" (G2, Petar D.).
5. **Easy integrations.** 10 mentions. "Integrate smoothly with WordPress
   without requiring custom development" (G2, Marius C., Safari business).

### Top complaints (what customers dislike)

1. **View limits.** 4 mentions. "The monthly view and message caps mean that if
   your website experiences an unexpected traffic spike, the widget can pause
   until the next billing cycle unless you upgrade" (G2, Petar D.). — **The
   metering model is the #1 friction point.**
2. **Widget issues / bugs after updates.** 4 mentions. "Widget issues and bugs
   after updates" (SociableKIT review summary). — **A reliability concern at
   scale.**
3. **Expensive / pricing transparency.** 4 mentions. "Pricing ambiguity" and
   "users find pricing unclear/ambiguous" (multiple sources).
4. **Poor support (minority).** 4 mentions — notable because support is also
   the #1 praised feature, suggesting inconsistency.
5. **Missing features.** 2 mentions. "Limited functionality in some widget
   areas" (SociableKIT).

### Who the reviewers are

- Small businesses (50 or fewer) dominate.
- Roles: customer support specialists, project managers, marketing managers,
  website owners, agency staff.
- Industries: aerospace, safari/tourism, e-commerce, professional services.
- Reviewers skew toward non-technical users who value "no coding required."

### Switch signals

- One reviewer (G2, Petar D., Aerospace) explicitly states they "evaluated
  several competitors, but Elfsight clearly outperformed them all." — Elfsight
  wins competitive evaluations.
- The Reddit r/bigseo thread discusses whether Elfsight's embedded links affect
  SEO — suggesting customers are SEO-conscious enough to ask, but Elfsight's
  answer (no direct SEO benefit) is a gap.

### Community forum

Elfsight has a community forum at `community.elfsight.com`. Key finding:
- **"Do I get any SEO benefit from your widgets?"** — Elfsight staff answered:
  "Our widgets don't benefit SEO for our Service." This is a direct admission
  that widget content is JavaScript-rendered and not crawlable.

### Reddit / independent discussion

- **r/webflow "Is Elfsight worth it?"** — mixed discussion. Users considering
  subscription; some praise, some hesitation on value-for-money.
- **r/bigseo "Do embedded software links actually affect SEO?"** — discusses
  Elfsight alongside HotJar and review widgets. Confirms the SEO community is
  aware that embedded widgets do not contribute crawlable content.
- **r/webdev "Google Reviews Widgets Question"** — a developer speculates about
  how Elfsight pulls Google Reviews data (scraping vs API), suggesting
  technical users are skeptical of the architecture.

### Knowledge base observations

- Help center at `help.elfsight.com`.
- The pricing page FAQ reveals: views = "the number of times a widget loads on
  a webpage or via a share link." If exceeded, the widget is "temporarily
  deactivated" — **a hard stop, not a graceful degradation.**
- All plans (including Free) allow unlimited websites — the limit is on views,
  not domains.
- 14-day full refund "for any reason."
- Platform-specific installation guides exist for WordPress, Shopify, Wix,
  Squarespace, Webflow, Elementor, and 40+ others — the most comprehensive
  platform coverage in the widget niche.

### Live installations

Elfsight embeds use `static.elfsight.com/platform/platform.js` and
`<div class="elfsight-app-{ID}">`. Found on:
- Squarespace forum posts (users sharing embed code)
- Discourse forum meta (Discourse integration discussion)
- Facebook group posts (accessibility widget embed)
- Iframely documents the embed pattern as a known standard

**Key crawlability finding (confirmed by Elfsight's own community):** widget
content is entirely JavaScript-rendered. The `<div class="elfsight-app-{ID}">`
container is empty until `platform.js` loads, fetches the config, and renders
the DOM. A crawler sees the empty div. Elfsight staff confirmed no SEO benefit.

---

## 8. What Elfsight does well

### 8.1 Market tenure and brand recognition

12+ years in the market. "Elfsight" is synonymous with "website widget" in the
SMB segment. 907 G2 reviews at 4.8/5 is dominant market presence. They are the
incumbent.

### 8.2 Customer support is the moat

31 of 907 G2 reviews cite customer support as the top pro. "Free installation
service" is included at every tier — Elfsight's team will install the widget
for you. This is a human-service moat that competitors (Common Ninja, OpenWidget)
do not match.

### 8.3 Platform breadth

40+ platform integrations with dedicated installation guides. WordPress,
Shopify, Wix, Squarespace, Webflow, Elementor, Blogger, Joomla, Drupal,
BigCommerce, OpenCart, Adobe Muse, and more. This is the most comprehensive
platform coverage in the widget niche.

### 8.4 View-based pricing is actually smart for their audience

Unlike Common Ninja's per-widget pricing (which penalizes composition),
Elfsight's view-based pricing scales with traffic, not widget count. A customer
with 3 widgets on one page pays for views of that page, not 3× the widget price.
This is more composition-friendly than Common Ninja's model.

### 8.5 The AI chatbot is genuinely good

The AI chatbot widget with website-scanning knowledge base, file upload
training, and auto-generated personality is the best AI implementation among
the three competitors analyzed. It is a product, not a feature button.

---

## 9. What Elfsight does badly

### 9.1 The architecture IS the disease (the original carrier)

Elfsight literally gives the pattern its name. CDN script + empty div +
runtime fetch + browser-rendered DOM. Zero crawlable content. Confirmed by
their own community forum staff. This is the structural ceiling Clickeen
breaks through.

### 9.2 No composition, no pages, no public artifact

Same as Common Ninja and OpenWidget. No "Page" concept. No composition. No
generated artifact. No standalone crawlable URL. Independent widget islands.

### 9.3 View limits create hard stops

Widgets are "temporarily deactivated" when view limits are exceeded. This is
a hard stop, not a graceful degradation. Customers complain about widgets
disappearing during traffic spikes.

### 9.4 No shared design system

Each widget is styled independently. No Dieter equivalent. No token system.
A page with 5 Elfsight widgets looks like 5 different products unless manually
harmonized.

### 9.5 No agent-operability

No MCP server. No API for external agents. No prompt-to-widget builder. AI
exists only inside the chatbot widget. Elfsight is behind Common Ninja on the
agent-operation axis.

### 9.6 Localization is a widget, not a property

The Website Translator is a Google Translate wrapper embedded as a separate
widget. There is no baseLocale, no overlay model, no source-truth discipline.
Localization is a feature you add; it is not structural.

---

## 10. Lessons for Clickeen

### 10.1 Customer support IS a moat — and Elfsight proves it

31/907 reviews praising support. Free installation at every tier. This is not a
feature; it is a competitive advantage. Clickeen's agent-operated model should
make support better (agents handle the work), but the lesson is: never
underestimate the value of a human who installs the widget for you.

### 10.2 View-based pricing is more composition-friendly than per-widget

Elfsight's view-based model does not penalize composition the way Common Ninja's
per-widget pricing does. Clickeen's account-owned model is even better (no
view limits, no per-widget charges), but the lesson is: meter by usage, not by
widget count, if you want customers to compose.

### 10.3 Platform breadth is table stakes for this market

40+ platform guides. Customers expect "works on my platform" out of the box.
Clickeen's `clk.live` URL + iframe is platform-agnostic, but explicit platform
guides (especially WordPress) reduce friction.

### 10.4 The SEO admission is the competitive opening

Elfsight's own staff admitted widgets don't benefit SEO. This is the gap
Clickeen fills: saved HTML content IS crawlable. The messaging is simple:
"Elfsight widgets are invisible to Google. Clickeen widgets are real HTML that
Google sees."

### 10.5 G2 review volume is a leading indicator of market leadership

907 reviews vs Common Ninja's 6 vs OpenWidget's handful. Elfsight's market
position is real. Clickeen should not expect to out-review them; Clickeen
should expect to out-architect them.

---

## 11. PMM artifacts

### 11.1 Positioning statement

> Clickeen is the only widget and page platform where your content is saved as
> real, crawlable HTML — not a CDN script that renders in the browser. Elfsight
> is the incumbent widget platform (907 G2 reviews, 12 years, 3M signups), but
> their own community staff admit widgets don't benefit SEO because all content
> is JavaScript-rendered and invisible to crawlers.

### 11.2 Battle card

| | Clickeen | Elfsight |
| --- | --- | --- |
| Where we win | Complete crawlable HTML; composed pages; account-owned pricing (no view limits); Dieter design system; baseLocale + exact overlays; agent-operated substrate | — |
| Where they win | — | Market tenure (12 years); 907 G2 reviews at 4.8/5; customer support (free installation service); 40+ platform integrations; AI chatbot with website-scanning knowledge base; deepest widget catalog by engine count (~45 engines) |
| When we lose | Customer needs a widget type Clickeen doesn't have. Customer needs a specific platform integration Clickeen doesn't guide. Customer wants free installation service. | Customer needs those. |
| When we win | Customer cares about SEO/crawlability (Elfsight admits no SEO benefit). Customer wants to compose widgets into pages. Customer is tired of view limits deactivating widgets during traffic spikes. Customer wants brand consistency (Dieter). |
| Killer question | "Elfsight's own staff say their widgets don't benefit SEO because all content is JavaScript-rendered. Do you want widgets that Google can see, or widgets that Google can't?" |

### 11.3 Messaging guidance

**Say:**
1. "Your content is real." Saved HTML, not CDN scripts. Google sees it. Elfsight's own community staff admit their widgets don't.
2. "No view limits." Your widgets don't disappear during a traffic spike. Elfsight deactivates widgets when you exceed the cap.
3. "One account, all your widgets and pages." Not view-metered. Not per-widget priced.

**Do NOT say:**
1. "We have 8 widgets." Elfsight has ~45 engines and 97 catalog entries. The comparison is depth + composition, not catalog size.
2. "We have better support." Elfsight's support is their #1 praised feature (31/907 reviews). Don't pick that fight until we can back it.
3. "We're cheaper." The pricing models are too different to compare simply. The message is "no view limits, no per-widget pricing."

---

## 12. Feature comparison with Clickeen

| Dimension | Elfsight | Clickeen |
| --- | --- | --- |
| **Widget count** | ~45 engines (97 inflated) | 8 (curated, deep) |
| **Pricing model** | Per-widget OR all-apps; view-metered | Per-account tier with entitlements |
| **View limits** | Yes (200 to unlimited by tier) | No |
| **Embed architecture** | CDN script + empty div + runtime fetch + browser render | Saved complete HTML/CSS/JS served from R2 |
| **Crawlable content** | No (JS-rendered; staff-admitted) | Yes (complete semantic HTML before JS runs) |
| **Composition** | None (independent widget islands) | Pages = ordered stacks of saved instances |
| **Design system** | Per-widget styling (no shared system) | Dieter token system across all widgets |
| **Localization** | Website Translator widget (Google Translate wrapper) | baseLocale + exact overlays + Babel protocol |
| **AI** | AI Chatbot widget (website-scanning, file upload training) | Product Copilot (agent-operated draft editing) + Translation Agent |
| **Agent operation** | None (no MCP, no API for agents) | Agent-operated substrate (agents ARE the operators) |
| **Customer support** | Free installation service at every tier; 31/907 reviews cite it as top pro | Agent-operated (agents do the work) |
| **Platform integrations** | 40+ dedicated platform guides | Platform-agnostic (clk.live URL) |
| **G2 reviews** | 907 (4.8/5) | N/A (pre-launch) |

---

## 13. The strategic read

Elfsight is the **incumbent to beat.** They have the tenure (12 years), the
reviews (907 at 4.8/5), the market presence (3M claimed signups), and the
brand recognition. They also have the exact architecture Clickeen rejects,
and their own staff have admitted the SEO gap in their community forum.

The competitive dynamics are different from Common Ninja:
- **Common Ninja** is a newer, smaller, more aggressive competitor pivoting to
  AI and MCP. They are trying to out-innovate Elfsight.
- **Elfsight** is the established leader with a proven product and deep customer
  loyalty. They are not trying to out-innovate anyone; they are maintaining and
  extending.

Clickeen's path against Elfsight is NOT to match their catalog, their platform
guides, or their review count. It is to:
1. **Win the SEO argument** — Elfsight admits the gap; Clickeen delivers the
   solution.
2. **Win the composition argument** — Elfsight has no Pages; Clickeen does.
3. **Win the agent-operation argument** — Elfsight has no agent surface;
   Clickeen's agents are native operators.
4. **Win the pricing argument** — Elfsight deactivates widgets on view limits;
   Clickeen's account-owned model never does.

Elfsight's moat is customer love (support + tenure + familiarity). Clickeen's
moat is structural (saved HTML + composition + agents). The question is whether
structural advantages can overcome incumbent loyalty. The SEO admission is the
wedge.

---

## 14. Catalog deduplication — the real engine count

### Method

All 97 widget entries from the `/widgets/` page were extracted via browser DOM
evaluation. Platform-specific landing pages (e.g., "See all widgets for
WordPress") and blog links were filtered out, leaving 91 actual widget entries.
These were then clustered by underlying UI engine.

### The biggest inflators

| Engine family | Distinct engine(s) | Catalog entries | Inflation factor |
| --- | --- | --- | --- |
| Reviews aggregator | 1 engine | 21 | 21× (same widget connected to 16+ review platforms + All-in-One + Testimonials) |
| Social Feed | 1 engine | 10 | 10× (same widget connected to 9 social platforms + Social Feed) |
| Chat/click-to-contact | 1 engine | 7 | 7× (same chat button for WhatsApp/Telegram/Messenger/Instagram/Line/Viber + All-in-One) |
| Audio player | 1 engine | 4 | 4× (same player rebranded as Audio/Background Music/Podcast/Radio) |
| Form builder | 1 engine | 5 | 5× (same form engine with presets: Contact/Form Builder/Subscription/Booking/Calculator) |
| Popup/bar | 1 engine | 4 | 4× (same popup engine with trigger presets: Popup/Announcement Bar/Banner/Sales Notification) |
| Video gallery | 1 engine | 2 | 2× (YouTube Gallery + Vimeo Gallery) |

**These 7 engine families account for 53 of the 91 entries.** More than half
the catalog is built on 7 engines multiplied by connector variants and content
presets.

### The real number

- **Actual widget entries (after platform-page filtering):** 91
- **Engine-family deduplication:** 53 entries collapse to 7 engines
- **Standalone unique engines:** 38
- **Total distinct widget engines: ~45** (7 family engines + 38 standalone)
- **Inflation factor: 91 ÷ ~45 = ~2.0×**

Elfsight's inflation factor (2.0×) is lower than Common Ninja's (4.6×) — they
have more genuinely unique widget engines per catalog entry. But the headline
"97 widgets" still overstates the engineering surface by ~2×.

---

## 15. Pricing intelligence — the real cost mechanics

### How Elfsight pricing works (the mechanics they don't explain)

Elfsight has **two subscription tracks**, each with 8 tiers. All paid plans are
**billed annually only** — the "/mo" number is the annual price ÷ 12, charged
upfront for the full year. No monthly billing option exists.

A **"view"** is counted **every time a widget loads on a page.** This is the
critical mechanic:

- **Two widgets of the SAME app on one page = 2 views** (confirmed verbatim in
  their help center).
- **Two different apps on one page = 1 view for app A + 1 view for app B** —
  each app has its own separate view counter.
- **For the All Apps Pack, each app gets its OWN separate view budget.** "5,000
  views per app" means Google Reviews gets 5,000, Instagram Feed gets 5,000, FAQ
  gets 5,000. They do NOT share a pool.
- **Floating widgets burn views exponentially.** A WhatsApp Chat button on every
  page of a 20-page site with 500 visitors/month = 10,000 views for that one
  app. This is the #1 source of "my views ran out" complaints.
- **When views are exceeded, the widget is DEACTIVATED.** It disappears from the
  site until the next billing cycle or until the customer upgrades. Elfsight
  sends email warnings before this happens, but the hard stop is real.

A **"widget"** is an instance of an app — NOT a widget type. "3 widgets" means
3 Google Reviews widgets, not 3 different types. A customer who wants Google
Reviews + FAQ + Contact Form on the Single App track needs 3 subscriptions.

Additionally:
- The **"14th Birthday Sale"** (33% off + 1 free month) is a limited-time
  promotion. Regular prices are ~50% higher.
- A **"Welcome Coupon"** for 20% off is emailed within 24 hours of signup and
  stacks with the promotion.
- **"Free installation service"** is included at every tier — Elfsight staff
  manually install the widget on the customer's site. This is their #1
  differentiator (31/907 G2 reviews cite support).
- **14-day full refund** for any reason.

### The full pricing tables

**Track 1: Single App subscription (one widget type only)**

| Tier | Promo ($/mo) | Regular ($/mo) | Annual (promo) | Annual (regular) | Views/mo | Widgets |
| --- | --- | --- | --- | --- | --- | --- |
| Free | $0 | $0 | $0 | $0 | 200 | 1 |
| Basic | $4 | $6 | $48 | $72 | 5,000 | 3 |
| Pro | $8 | $12 | $96 | $144 | 50,000 | 9 |
| Premium | $16 | $24 | $192 | $288 | 150,000 | 21 |
| Enterprise T1 | $24 | $42 | $288 | $504 | 300,000 | 50 |
| Enterprise T2 | $32 | $56 | $384 | $672 | 600,000 | 100 |
| Enterprise T3 | $48 | $84 | $576 | $1,008 | 1,200,000 | 200 |
| Enterprise T4 | $64 | $112 | $768 | $1,344 | Unlimited | 400 |

**Track 2: All Apps Pack subscription (all 96 apps)**

| Tier | Promo ($/mo) | Regular ($/mo) | Annual (promo) | Annual (regular) | Views/mo (per app) | Widgets (per app) |
| --- | --- | --- | --- | --- | --- | --- |
| Basic | $12 | $18 | $144 | $216 | 5,000 | 3 |
| Pro | $24 | $36 | $288 | $432 | 50,000 | 9 |
| Premium | $48 | $72 | $576 | $864 | 150,000 | 21 |
| Enterprise T1 | $72 | $126 | $864 | $1,512 | 300,000 | 50 |
| Enterprise T2 | $96 | $168 | $1,152 | $2,016 | 600,000 | 100 |
| Enterprise T3 | $144 | $252 | $1,728 | $3,024 | 1,200,000 | 200 |
| Enterprise T4 | $192 | $336 | $2,304 | $4,032 | Unlimited | 400 |

All tiers: unlimited websites, advanced customizations, free installation
service, ad-free (except Free which has Elfsight branding).

### Likely customer distribution — what we can and can't know

**What we can't reliably estimate:**
- **Customer count** is not derivable from available data. The "3M trusted by"
  claim has no methodology behind it (signups? active installs? historical
  accounts? marketing number?). Revenue is not publicly disclosed (private,
  bootstrapped). Third-party estimate services produce unreliable scraped
  guesses — do not cite them. Dividing one unreliable number by another to
  produce a customer count is false precision.
- **Revenue** is estimated at **$1.5-4M/year** based on ~20-30 employees in
  Armenia at fully-loaded ~$35-50K/year each, plus profit margin. Not publicly
  disclosed; this is a bottom-up operating-cost inference, not a third-party
  estimate.
  (where dev costs are well below US/EU) bootstrapped for 12 years.

**What we CAN say from verified evidence:**
- **G2's 907 reviews** confirm substantial paying-customer volume — dramatically
  more than Common Ninja (6) or OpenWidget (handful). G2 under-represents total
  customer base (most SMB customers never review on G2), so the real paying
  customer count is likely **in the low thousands to tens of thousands.**
- **G2 reviewer demographics** overwhelmingly identify as "small-business (50 or
  fewer emp.)". This tells us the revenue concentrates in lower tiers, not
  Enterprise.
- **The complaint pattern** centers on view limits — which only bite at Basic/Pro
  traffic levels. Enterprise customers (unlimited or 300K+ views) would not
  complain about view deactivation. This confirms the active paying base skews
  toward Basic and Pro.

**The typical paying customer is most likely on Basic or Pro:**
- Basic ($48-144/year promo) or Pro ($96-288/year promo).
- Likely paying **$50-300/year**.
- This is the number Clickeen needs to beat or reframe.

### The pricing seam — where Clickeen attacks

The customer complaints and pricing mechanics reveal four seams:

**Seam 1: View-limit deactivation is the #1 pain point.**
G2 reviews, community forum posts, and the help center all confirm: customers
HATE that widgets disappear when views are exceeded. The floating-widget
scenario (WhatsApp button on every page) burns views exponentially and forces
upgrades customers don't want. **Clickeen's answer: no view limits. Ever. Your
widgets don't disappear.**

**Seam 2: The pricing page is deliberately confusing.**
"Views per app" vs "views per page" is never explained on the pricing page.
Customers discover the mechanic when their widget vanishes. The promotional
price (33% off) is shown as the headline; the regular price is in small grey
text. Annual-only billing is not obvious. **Clickeen's answer: simple
account-owned entitlements. No view metering. No per-app counters.**

**Seam 3: Per-widget-type pricing penalizes composition.**
On the Single App track, a customer who wants 5 different widget types needs 5
subscriptions. The All Apps Pack fixes this but introduces per-app view
budgets that are equally confusing. Either way, the customer is managing a
pricing model, not building a website. **Clickeen's answer: one account, all
widget types, compose into pages, no per-type or per-view pricing.**

**Seam 4: The Free tier is nearly useless.**
200 views/month = ~6-7 visitors per day seeing the widget. That's not enough
to evaluate anything. The Elfsight branding on the Free tier also makes it
unsuitable for production. **Clickeen's Free tier gives 3 widget instances —
more generous for actual evaluation.**

### Where Clickeen should price to undercut

Based on the customer distribution above, the revenue-weighted average Elfsight
customer pays **~$195/year** (promo) or **~$290/year** (regular). That is the
number to beat.

A Clickeen tier that includes:
- Multiple widget types (not per-app metered)
- No view limits
- Page composition
- Agent-operated editing
- baseLocale + overlays at every tier

…priced at **$150-250/year** would undercut Elfsight's median paid customer
while delivering structurally more value (no deactivation, composition, saved
HTML, agents). The message is not "we're cheaper per widget" — it is "one
price, all widgets, no disappearing, real HTML."

---

## Sources

- [Elfsight — Homepage](https://elfsight.com/)
- [Elfsight — Widget Catalog](https://elfsight.com/widgets/)
- [Elfsight — Pricing](https://elfsight.com/pricing/)
- [Elfsight — AI Chatbot Widget](https://elfsight.com/ai-chatbot-widget/)
- [Elfsight — Website Translator Widget](https://elfsight.com/website-translator-widget/)
- [Elfsight — G2 Reviews (907)](https://www.g2.com/products/elfsight/reviews)
- [Elfsight — Trustpilot](https://www.trustpilot.com/review/apps.elfsight.com)
- [Elfsight — Community Forum (SEO admission)](https://community.elfsight.com/t/do-i-get-any-seo-benefit-from-your-widgets-if-so-how-much-and-how/14405)
- [Elfsight — Crunchbase](https://www.crunchbase.com/organization/elfsight)
- [Elfsight — LinkedIn Company Page (self-reports 51-200; actual ~20-30)](https://am.linkedin.com/company/elfsight)
- [Reddit — r/webflow "Is Elfsight worth it?"](https://www.reddit.com/r/webflow/comments/1ji7r3h/is_elfsight_worth_it/)
- [Reddit — r/bigseo "Do embedded software links affect SEO?"](https://www.reddit.com/r/bigseo/comments/em9md5/do_embedded_software_links_actually_affect_seo/)
- [Iframely — Elfsight embed code pattern](https://iframely.com/domains/elfsight)
- [SociableKIT — Elfsight Review](https://www.sociablekit.com/elfsight-reviews/)
