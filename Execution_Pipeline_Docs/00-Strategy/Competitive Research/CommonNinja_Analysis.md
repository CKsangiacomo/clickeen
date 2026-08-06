# Common Ninja — Competitive Research & Analysis

Status: **RESEARCH**

Date: 2026-08-05

Source: commoninja.com (widgets, pricing, features pages), in-app browser
inspection of the full widget catalog, and the developers.commoninja.com /
features/* pages.

## TL;DR

Common Ninja is a **widget marketplace and no-code widget platform** whose
catalog headline claims "229 widgets across 13 categories." After full
deduplication of the catalog (see §9), the real engineering surface is **~50
distinct widget engines**, inflated ~4.6× through connector multiplication
(same review engine × 15 platforms), content-preset multiplication (same
flip-card engine × 6 content types), and layout-variant multiplication (same
feed engine × feed/carousel/slider). Common Ninja is a standalone SaaS whose
entire product IS widgets — build, customize, embed, manage. They have recently
pivoted hard into AI with a prompt-to-widget editor and an **MCP server** that
lets AI agents (Claude, ChatGPT, Cursor) create, edit, and embed widgets
through natural language.

This is the closest competitor to Clickeen's widget thesis that we have
analyzed. They are explicitly building toward agent-operated widgets via MCP —
which is the same strategic direction as Clickeen, arrived at from the legacy
SaaS side rather than from the agent-operated substrate side.

---

## 1. What Common Ninja is

### Product

A no-code widget platform. The user picks a widget from a catalog of **229
widgets** (13 categories), customizes it in a visual editor, and embeds it via a
script snippet on any platform (WordPress, Shopify, Webflow, Squarespace, Wix,
etc.). Each widget is independently managed and embedded.

### Pricing (per widget, billed annually)

| Plan | Price (per widget/year) |
| --- | --- |
| Free | $0 (free forever, no credit card) |
| Essentials | $24/year ($2/mo) |
| Pro | $38.40/year ($3.20/mo) |
| Ultimate | $62.40/year ($5.20/mo) |
| Enterprise | Custom |

**Key insight: pricing is per-widget, not per-account.** A customer who wants 5
widgets pays 5× the plan price. This is the opposite of Clickeen's
account-owned model where one account owns many instances.

### Target customer

Small businesses, marketers, and non-technical website owners who want to add
specific functionality (reviews, social feeds, forms, countdowns, carousels,
calculators, booking, etc.) to an existing website without coding.

---

## 2. The widget catalog (headline: 229 entries — actual: ~50 engines, see §9)

The catalog *appears* massive at first glance — 229 entries across 13
categories. But a deduplication pass (§9) reveals that ~120+ of those entries
are built on only ~15 engine families, inflated by connector variants and
content presets. The real engineering surface is ~50 distinct widget engines.
Categories and representative widgets:

| Category | Count | Representative widgets |
| --- | --- | --- |
| Website Components | 72 | FAQ, Accordion, Tabs, Countdown, Pricing Tables, Comparison Tables, Cookie Banner, Mega Footer, Progress Bars, Progress Circles |
| User Engagement | 36 | Comments, Social Proof, Feature Voting, Quiz Maker, Personality Quiz, Flash Cards, Glossary |
| Social Feeds | 32 | Instagram, X/Twitter, TikTok, YouTube, Facebook, Pinterest, Reddit, RSS, Medium, Tumblr, Mastodon, Threads, Twitch, Vimeo, WordPress, Blogger |
| Popups, Bars & Buttons | 34 | Popup Builder, Notification Bar, Corner Pop-up, Coupon Bar, Slide-In Panel, Call Button, Social Share Buttons, Nudge Button |
| Reviews | 21 | Google, Facebook, Airbnb, Yelp, Etsy, Amazon, eBay, AliExpress, G2, Capterra, Sitejaber, Tripadvisor, App Store, Google Play, Glassdoor, All-in-One Reviews, Reviews Badge, Reviews Trust Box |
| Lists & Cards | 21 | Card Slider, Card Carousel, Flip Cards (Team, Event, Skill, Restaurant, Branch), Info List, 3D Cards, Team Member List, Event List |
| Get Creative | 28 | Timeline, Bracket Maker, Leaderboard, Scores Board, Spinning Wheel, Scratch Card, Image Hotspot, Virtual Tour, Lottie Player, Stop Motion Player |
| Images & Galleries | 19 | Image Gallery, Image Slider, Image Carousel, Slideshow, Video Gallery, Video Slider, Video Carousel, Image Grid Slider, Image Stack Gallery, Before & After Slider |
| Media | 18 | Audio Player, Music Player, MP3 Player, Podcast Player, Interactive Video Player, Sticky Video, PDF Flipbook |
| Forms | 16 | Contact Form, Form Builder, Job Application, Support Form, RSVP Form, Feedback Form, Order Form, Donation Form, HIPAA Compliance Form, Email Subscription |
| Boost Sales | 24 | Pricing Slider, Coupon Popup, Coupon Bar, Corner Coupon Pop-up, Currency Converter, Countdown to Download, Calculator, TDEE Calculator |
| E-Commerce | 14 | Catalog, Product Cards, Appointment Booking, Business Listings, Real Estate Listings, Job Listings, Event Listings, Course Listings, Restaurant Menu |
| Gaming | 5 | Bracket Maker, March Madness Bracket Maker, Leaderboard, Scores Board, Spinning Wheel |

**Plus:** "AI Widget Builder" (via embeddable.co partnership) — a prompt-to-widget system that generates custom widgets from natural language descriptions.

### Widget categories Clickeen does NOT cover

Common Ninja has widgets in categories Clickeen has no equivalent for:
- **Social feeds** (32 widgets pulling live data from 16 platforms)
- **Reviews aggregators** (21 widgets pulling from 15 review platforms)
- **Forms** (16 specialized form types)
- **Popups/bars/buttons** (34 conversion-optimization widgets)
- **Gaming** (brackets, leaderboards, scores)
- **E-commerce listings** (catalogs, booking, real estate, jobs, courses)
- **Data viz** (charts, graphs, diagrams)

This is not a gap to fill — it is a different product thesis. Common Ninja is a
widget-for-every-purpose marketplace; Clickeen is a focused Widget platform.

---

## 3. Architecture and embed model

### The embed

Each widget is embedded via a script snippet that loads from Common Ninja's
CDN. The snippet is the **same Elfsight/loader pattern** as OpenWidget: a small
stub that injects a CDN script, which fetches the widget config from Common
Ninja's servers and browser-renders the widget DOM.

**Content is client-rendered.** A crawler sees the snippet container and a
`<noscript>` fallback, not the widget content. The widget's data (FAQ answers,
review text, social posts, form fields) is fetched at runtime from Common
Ninja's API and rendered by the CDN script.

### No composition, no pages

There is no "Page" concept. Each widget is independently embedded. You cannot
compose multiple widgets into one document, one URL, or one package. The
widgets are independent islands on the host page.

### The no-code editor

A visual editor with live preview, templates, style options (fonts, colors,
layouts), and responsive controls. No CSS editing in the standard editor (the
AI page mentions "switch to manual editing to dive deeper into custom styles
and CSS" but the no-code editor page does not confirm direct CSS access). The
customization is broad but widget-specific — each widget has its own settings,
not a shared design system.

---

## 4. The AI pivot (the strategic signal)

Common Ninja has recently pivoted hard into AI. Three moves:

### 4.1 AI Editor (prompt-to-widget)

> "Create complete widgets by simply describing what you want in a natural
> sentence." "Modify any widget using simple AI commands - no manual editing
> required."

A prompt-to-widget system inside the no-code editor. The user describes what
they want; the AI generates the widget. Includes an AI Image Generator and an
AI Website Analyzer that suggests widget ideas based on the user's site.

This is the legacy-SaaS version of Clickeen's Product Copilot: AI as a content-
accelerator inside the authoring surface. The difference: Common Ninja's AI
modifies widget config; Clickeen's Copilot operates structured source.

### 4.2 MCP Server (agent-operated widgets)

> "Point any MCP-compatible client (Claude, ChatGPT, Cursor) to
> `https://mcp.commoninja.com/mcp`. Describe a widget you need and the AI will
> configure it, keep it hosted live, and generate the appropriate embed code."

This is the most strategically significant finding. **Common Ninja has built an
MCP server that lets external AI agents create, edit, manage, and embed widgets
through natural language.** The agent connects via OAuth, receives widget
management tools, and operates the widget lifecycle from inside the user's AI
client (Claude Desktop, ChatGPT, Cursor).

This is Common Ninja trying to become agent-operated from the outside in: they
keep the legacy SaaS substrate (CDN-hosted, client-rendered, per-widget config)
and bolt agent operation on top via MCP. The agent is a remote operator of a
legacy system, not an operator of a structured substrate.

### 4.3 AI Widget Builder (via embeddable.co)

A separate product partnership: "Create any custom widget you can imagine with
the power of AI. No coding required - just describe what you need." This is a
prompt-to-custom-widget generator that creates widgets outside the 229-widget
catalog.

---

## 5. Feature comparison with Clickeen

| Dimension | Common Ninja | Clickeen |
| --- | --- | --- |
| **Widget count** | 229 (marketplace) | 8 (curated) |
| **Pricing model** | Per-widget subscription | Per-account tier with entitlements |
| **Embed architecture** | CDN script + runtime fetch + browser render (Elfsight pattern) | Saved complete HTML/CSS/JS served from R2 (three-file law) |
| **Crawlable content** | No (JS-rendered; `<noscript>` only) | Yes (complete semantic HTML before JS runs) |
| **Customer Pages** | None | Deferred planning, not a current product |
| **Design system** | Per-widget style options (no shared system) | Dieter token system across all widgets |
| **Localization** | Auto-detect + manual language selection + RTL | baseLocale + exact overlays + Babel protocol |
| **AI authoring** | Prompt-to-widget inside editor + AI image gen + AI site analyzer | Product Copilot (agent-operated draft editing) |
| **Agent operation** | MCP server (external agents operate legacy substrate) | Agent-operated substrate (agents ARE the operators) |
| **Public artifact** | CDN-hosted script (not a standalone artifact) | Saved three-file package at `clk.live` URL |
| **Payments** | Native in-widget checkout | Not a current feature |
| **Analytics** | Built-in widget analytics | Not a current feature |
| **CRM** | Built-in submission CRM | Not a current feature |
| **Developer surface** | MCP server + API | Contracts + widget spec + agent homes |

---

## 6. What Common Ninja does well

### 6.1 Catalog breadth as a distribution moat

229 widgets is a real distribution advantage. For any "I need a widget that does X" search, Common Ninja likely has it. The catalog covers social feeds, reviews, forms, popups, e-commerce, gaming, media, data viz — categories Clickeen does not touch. This is a search-intent moat: they capture the long tail of "add a [specific feature] to my website" queries.

### 6.2 The MCP server is a genuine strategic move

They are the first widget platform we've seen that has built an MCP server for agent operation. The UX is clean: connect Claude/ChatGPT/Cursor via OAuth, then describe widgets in natural language. The agent creates, edits, and embeds. This is the right instinct — agent-operated widgets are the future — even though their substrate is legacy (CDN-hosted, client-rendered, per-widget config).

**This is the competitive threat to watch.** If Common Ninja's MCP server works well, they have a faster path to "agent creates my widget." Clickeen's concrete difference is that agents operate saved Widget source and generated files through named product authorities.

### 6.3 The AI editor is the right product pattern

Prompt-to-widget + AI modification commands + AI image generation + AI site analysis. Each AI touch removes a step from the authoring flow. This is exactly the pattern Clickeen's Product Copilot should follow: AI inside the authoring surface, not beside it.

### 6.4 Beyond-widgets features (payments, CRM, analytics)

They've added native in-widget payments (checkout inside the widget, no redirect), a submission CRM (form submissions managed in-dashboard), and widget analytics. These make individual widgets more valuable as standalone products. The lesson for current Clickeen is that each Widget must be useful enough to justify its existence on its own.

### 6.5 Platform integrations are comprehensive

WordPress, Shopify, Webflow, Squarespace, Wix, Google Tag Manager, plus direct HTML. They meet the customer wherever their site lives. Clickeen's `clk.live` URL + iframe/script snippet is platform-agnostic by default, but Common Ninja's native platform plugins (especially WordPress) reduce friction further.

---

## 7. What Common Ninja does badly

### 7.1 The architecture IS the Elfsight disease (at scale)

229 widgets, all client-rendered from CDN scripts, all fetching config at runtime, all invisible to crawlers. This is the Elfsight pattern at 229× scale. A site with 5 Common Ninja widgets loads 5 CDN scripts, makes 5 runtime config fetches, and renders 5 independent DOM islands — none of which contribute crawlable content to the host page.

### 7.2 No hosted Pages

You cannot build a hosted page from Common Ninja widgets. You can only embed independent widgets on a page someone else built. That is a competitor fact; customer Pages are also deferred at Clickeen and are not a current competitive claim.

### 7.3 Per-widget pricing penalizes using multiple Widgets

The per-widget pricing model actively discourages customers from using multiple Widget types. A customer using 10 Widgets can pay for 10 subscriptions. Clickeen's account-owned model (one account, many instances, tier-based entitlements) is structurally simpler.

### 7.4 No shared design system

Each widget has its own style options. There is no Dieter-equivalent — no token system that makes all widgets look like they belong to the same brand. A page with 5 Common Ninja widgets looks like 5 different products unless the user manually matches colors/fonts across all 5 editors.

### 7.5 Agent operation is bolted on, not native

The MCP server is the right move, but it operates a legacy substrate. The agent modifies widget config through an API; it does not operate structured source truth. The widgets are still CDN-hosted, client-rendered, per-widget-config artifacts. The agent is a remote operator of a legacy system, not an operator of a structured substrate. This is the fundamental difference from Clickeen: Clickeen's agents operate the source truth directly; Common Ninja's agents operate a config layer on top of a CDN.

### 7.6 No localization depth

Their localization is "auto-detect + manual language selection + RTL." There is no equivalent of baseLocale, exact overlays, the Babel protocol, or the Translation Agent. Localization is a feature toggle, not a source-truth model.

---

## 8. Lessons for Clickeen

### 8.1 The MCP server is the competitive threat — and the opportunity

Common Ninja's MCP server proves that agent-operated widgets is a real market
direction, not just a Clickeen thesis. Customers will expect to tell an AI
"create me a countdown widget" and have it appear. The question is whether the
agent operates a legacy CDN substrate (Common Ninja) or a structured source-
truth substrate (Clickeen).

**Clickeen's answer:** Product Copilot and Translation Agent already operate
the structured source. The Clickeen equivalent of an MCP server would expose
the same agent operations to external AI clients — but the current Widget
substrate is richer (saved HTML, exact overlays, Dieter).

**Action:** Consider whether an MCP-compatible surface for Clickeen agents is
warranted. Not now — but the MCP protocol is becoming a standard, and if
customers expect "tell Claude to build my page," Clickeen should be able to
offer it.

### 8.2 The catalog-inflation moat — and why Clickeen should not chase it

Common Ninja's "229 widgets" headline is a **marketing number built on connector
breadth and content presets, not engineering depth.** The deduplication in §9
shows the real count is ~50 distinct widget engines, inflated ~4.6× through
three tactics:

1. **Connector multiplication** — 1 review engine × 15 platforms = 18 entries.
   1 feed engine × 18 platforms × 3 layouts = 33 entries. This is API
   integration work, not widget engineering.
2. **Content-preset multiplication** — 1 flip-card engine × 6 content types = 7
   entries. 1 form engine × 13 presets = 13 entries. This is default content,
   not new code.
3. **Layout-variant multiplication** — 1 feed engine in feed/carousel/slider =
   3 entries. 1 carousel in grid/multi-row/stack/wall = 4+ entries. This is
   layout configuration, not new engines.

Clickeen's 8 curated widgets cannot compete on headline count and should not
try. The thesis is fewer, deeper Widgets — not 50 independent engines
inflated to 229 entries. The right response is to make the 8 deeper,
and more crawlable than any of their 50.

**Action:** do not chase catalog breadth. Invest in current Widget depth
(Dieter, overlays, authoring, serving). Customer Pages remain deferred; Prague
continues as its independent Astro site.

### 8.3 The AI editor pattern is confirmed correct (again)

Common Ninja's prompt-to-widget + AI modification commands + AI image gen + AI
site analyzer is the second confirmation (after OpenWidget) that AI inside the
authoring surface is the right wedge. Product Copilot is Clickeen's version.

**Action:** keep investing in Product Copilot as the primary authoring surface.
The AI site analyzer (suggesting widget ideas based on the user's site) is a
specific feature worth noting for future consideration.

### 8.4 Per-widget pricing vs account-owned is a structural advantage

Common Ninja's per-widget pricing penalizes customers who create multiple
widgets. Clickeen's account-owned model with `widgets.instances.max` and
`instances.published.max` remains structurally simpler for customers.

**Action:** keep the account-owned tier model. Do not move to per-widget
pricing.

### 8.5 Platform integrations (WordPress, Shopify) reduce friction

Common Ninja's native platform plugins (especially WordPress) reduce the embed
friction beyond "paste this script." Clickeen's `clk.live` URL is platform-
agnostic but requires manual paste.

**Action:** consider whether a WordPress plugin (or similar) for Clickeen
embedding is worth building. Not now, but note for distribution.

### 8.6 Payments, CRM, and analytics in widgets are product directions worth noting

Common Ninja's native in-widget payments, submission CRM, and widget analytics
make each widget more valuable as a standalone product. The lesson for current
Clickeen is that Widgets which collect payments, manage submissions, and report
analytics are more useful on their own.

**Action:** note for the future Widget-platform roadmap. It is not part of
deferred PRD 127.

---

## 9. The strategic read

Common Ninja is the **closest competitor to Clickeen's widget thesis** we have
analyzed, but they arrived at agent-operated widgets from the opposite
direction:

- **Common Ninja's path:** Legacy widget marketplace (229 widgets, CDN-hosted,
  client-rendered) → AI editor (prompt-to-widget) → MCP server (external agents
  operate the legacy substrate). They are bolting agent operation onto a legacy
  system.

- **Clickeen's path:** Agent-operated substrate (structured source, saved
  artifacts, named authorities) → saved Widget Instances. Agents are native
  operators, not remote controllers. Customer Pages are deferred planning.

The two will converge on the same current customer expectation: "tell an AI to
build my Widget." The competitive question is whether the substrate under the AI is
legacy (CDN + client-render, invisible to crawlers) or structured (saved HTML,
crawlable, source-of-truth). Clickeen's bet is that the structured substrate
wins because the public artifact matters (SEO, GEO, AEO, source-truth
fidelity).

Common Ninja's MCP server is the canary in the coal mine: if customers expect
agent-operated widgets, the next question is whether those widgets produce real
crawlable content or just CDN scripts. Clickeen has the answer; Common Ninja
structurally does not.

---

---

## 10. Company scale and revenue estimation

### Claimed scale

- **"500K+ Businesses use our widgets on their websites & online stores."**
  (commoninja.com/about-us and pricing page footer). Founded 2021.
- **"Over 190 widgets"** (about page; the catalog page shows 229 entries, but
  the about page rounds down — another number to interrogate).

### Employee count (LinkedIn profile search — NOT the company page range)

The LinkedIn company page says "11-50 employees." That's a self-reported
dropdown range — do NOT cite it as fact.

**LinkedIn profile search results** (site:linkedin.com/in "common ninja"):
- Natalie Ponomarenko — social/influencer marketing (former)
- Inbar Danieli — Support Engineer & Frontend Developer (Mar 2023 – Sep 2024, former)
- Elyakim Goldfus — Web & Graphic Designer (from Jul 2021)
- Plus CEO/founder Daniel Sternlicht (listed on company page)

**Visible profiles: ~3-4 people** (excluding the founder). Two of the three
visible are former employees (Ponomarenko and Danieli left). This suggests a
very small current team.

Israel has high LinkedIn penetration (~50-60% of tech workers). Applying a
1.5-2× coverage multiplier to the visible count:

**Best estimate: ~5-10 employees.** This is a micro-startup, not a 50-person
company.

- **Headquarters:** Netanya, Israel. Privately held.
- **CEO/Founder:** Daniel Sternlicht (building products since 2012; also behind
  BracketsNinja, Embeddable.co, Vidocu.ai, Domainee.dev — a portfolio of small
  SaaS tools spun out of Common Ninja).
- **Founded:** 2021 (per about page). The copyright footer says "© 2012-2026"
  suggesting the founder's product work started in 2012, but Common Ninja as a
  company was incorporated later.

### Revenue estimation

Not publicly disclosed. Bottom-up operating-cost method:

- **~5-10 employees** in Netanya, Israel.
- Israeli fully-loaded cost per employee: ~$80-140K/year (higher than Armenia/
  CIS; Israeli dev salaries are significant).
- 8 employees × ~$100K average = **~$800K/year operating cost.**
- Revenue must cover this with margin: **estimated $1-3M/year.**
- **Funding:** MoreVC and Yanon Axel noted as investors (Crunchbase). Funding
  amount not publicly confirmed. The $657M figure on Crunchbase is aggregated
  across similarly named entities and is NOT Common Ninja's actual funding.

**Cross-check:** G2 has only 6 reviews for Common Ninja (vs Elfsight's 907). At
1:50-150 review-to-customer ratio, that implies ~300-900 paying customers. At
$24-62/widget/year × average 3 widgets = ~$72-186/year per customer × 600
customers = ~$43-112K/year. That is far below the operating cost floor, which
means either (a) the G2 review count massively under-represents their customer
base, or (b) the company is running at a loss on investor funding. Given the
small team size, option (a) is more likely — G2 under-represents SMB widget
companies dramatically, and Common Ninja likely has many more customers who
never review on G2.

**Best revenue estimate: $1-3M/year**, based on operating-cost floor. The G2
review count is too low to cross-validate meaningfully.

### Install verification

- **CDN signature search** found ~5 unique business domains referencing
  `cdn.commoninja.com` in their cookie/privacy policies (medius.com,
  trowers.com, marquardt.com, ateliersdavoy.com, nzanewzealand.com). This is a
  very low lower bound — cookie policies are only a fraction of total installs.
- **No Shopify App Store or WordPress Plugin Directory listing found** under
  the Common Ninja name (they embed via custom HTML, not platform app stores).
- **BuiltWith** reportedly tracks Common Ninja installations but the data is
  behind a paywall.
- **G2 review count: 6.** This is extremely low for a company claiming 500K
  businesses. Even accounting for G2's enterprise bias, 6 reviews suggests the
  500K number is total signups (including free/churned/inactive), not active
  paid customers.

### Growth trajectory signals

- **Product velocity is high.** They added AI Editor, MCP Server, payments,
  CRM, analytics, and localization features recently. The catalog grew from
  ~190 to 229 widgets. This is a company actively shipping.
- **Job postings:** Not enough data to determine hiring trajectory.
- **Social media:** Active on LinkedIn, YouTube, Instagram, Facebook, TikTok, X.
  Content cadence appears regular.
- **The founder runs multiple adjacent products** (Embeddable.co, Vidocu.ai,
  Domainee.dev, BracketsNinja, Trofeo.live) — suggesting Common Ninja is one
  product in a portfolio, not a company's sole focus.

---

## 11. Localization and locale model

Common Ninja has a **shallow, tier-gated localization model** — not a source-
truth discipline.

- **Multi-Language Support is Ultimate-only** ($5.20/mo per widget). It is a
  feature toggle, not a structural property of the platform.
- **Translation is metered as "translation requests"**: 10 (Free), 100
  (Essentials), 500 (Pro), 2,500 (Ultimate). This is a usage meter, not a
  source-truth model.
- **There is a Translations Editor** (Essentials+), suggesting manual editing of
  translated content per widget.
- **Locale-specific formatting**: date/time/number formats matched to regional
  standards; RTL support for Arabic/Hebrew.
- **No baseLocale concept.** There is no distinction between "source language"
  and "translated languages." All locales appear to be equal peers.
- **No translation agent.** The AI Editor can generate content, but there is no
  dedicated agent that translates widget source into overlays the way
  Clickeen's Translation Agent does.
- **No overlay model.** The localization appears to be copy-based (duplicated
  content per locale), not overlay-based (one source + locale-specific value
  maps). This is the legacy SaaS pattern.

**Compared to Clickeen:** Common Ninja's localization is a paid feature with
metered usage. Clickeen's baseLocale + exact overlays + Babel protocol +
Translation Agent is a structural source-truth model available at every tier.
The difference is: Common Ninja treats localization as a feature to gate;
Clickeen treats it as a source-truth discipline baked into the substrate.

---

## 12. Customer voice

### Reviews summary

| Platform | Score | Review count |
| --- | --- | --- |
| G2 | 3.7/5 | 6 |
| Trustpilot | 4.3/5 | 166 |

### Top praises (what customers love)

1. **Widget variety and breadth.** "The variety of widgets and the ease of
   integration are truly unmatched." (G2, Furniture, Enterprise) "Common Ninja's
   breadth of plugins fulfills a variety of use cases." (Trustpilot)
2. **Responsive support team.** "The team at Common Ninja has always been very
   responsive to issues I've had and is quick to make updates." (G2, Mid-Market)
   "Karem from CommonNinja not only fixed my problem but also advised myself on
   sorting..." (Trustpilot)
3. **Cross-platform compatibility.** "These widgets are also great if you are
   working with Elementor." (G2) "Had built a website in SquareSpace and was
   having problems with one of my widgets... [support fixed it]." (Trustpilot)

### Top complaints (what customers dislike)

1. **Per-widget pricing scales expensively.** "The price jumps feel a bit steep
   when you need to scale from one or two widgets to a larger suite." (G2,
   Enterprise) "Regular plans include huge jumps in costs when specific numbers
   of widgets are needed." (G2, Small-Business) "Dishonest practices regarding
   pricing." (SourceForge)
2. **Custom CSS locked behind top tier.** "Some of the more advanced styling
   options like custom CSS editing are limited to the higher-tier paid plans."
   (G2, Enterprise) "I wish I didn't have to upgrade to make adjustments to the
   CSS." (G2, Mid-Market)
3. **Widgets that don't work / reliability.** "Designed a Right Click protect
   widget embedded the code into Wix platform. It never worked." (Trustpilot,
   1-star) — note: Common Ninja replied.

### Who the reviewers are

- Small businesses (50 or fewer) and mid-market (51-1000) are the primary
  reviewers on G2.
- Roles: owners, junior graphic designers, validated users across furniture,
  media, and agency contexts.
- Trustpilot reviewers skew toward no-code website builders (Squarespace, Wix,
  WordPress).

### Switch signals

- One reviewer explicitly mentions "bait and switch" on custom plans (G2,
  1-star).
- No reviewers mention switching FROM a named competitor TO Common Ninja, or
  vice versa.
- The pricing complaints suggest customers churn when they hit the per-widget
  cost wall — a vulnerability for Clickeen to exploit with account-owned
  pricing.

### Community forum

Common Ninja has a community forum at `community.commoninja.com` ("A
collaborative space where web professionals, developers, and tech enthusiasts
connect"). It is behind a login wall — requires signup to read threads. Could
not inspect topics, feature requests, or complaints during this pass.

### Reddit / independent discussion

A Reddit thread on r/ecommerce ("Widget providers. Looking for suggestions
that are decent value as they tend to add up") reveals key customer sentiment:

- **Original poster** (FreeWebStore.org store owner): "I came across
  commoninja.com which has some fantastic widgets which I've been trialling.
  Unfortunately, they become quite pricey when using a few of them. They do
  offer a multi pricing option for 25 widgets which comes to $210 a year which
  I can't justify right now." — **This is the per-widget pricing pain confirmed
  by a real customer in the wild.**
- **Replier** (re: bracket widget): "My very first widget with common ninja was
  a trainwreck I can't imagine anyone using their service let alone paying for
  it. It was glitchy, missed votes (it was a march madness style bracket),
  tabulated wrong.. I watched vote counts go DOWN in real time never to show up
  again." — **Reliability complaint on a complex widget.**
- **Replier** (re: alternative): "Ended up using chatGPT to code some of them
  myself. Only the simple html/CSS ones though. Just told it what I wanted and
  sent screenshots of the common ninja widgets." — **A customer left Common
  Ninja for hand-built AI-generated widgets. This is the "agents replace
  widget-marketplace" signal.**

### Knowledge base observations

- Common Ninja has a help center at `help.commoninja.com`.
- The pricing FAQ reveals important behaviors: deleting a widget does NOT cancel
  the subscription (you must cancel in the dashboard billing menu); expired
  subscriptions revert to free plan with premium features removed.
- Platform-specific guides exist for WordPress, Shopify, Wix, Squarespace,
  Webflow — suggesting platform integration is a real support surface.
- Third-party platform guides also exist (Vev, Webflow integrations directory),
  confirming the cross-platform embed model.

### Live installations

Common Ninja widgets are deployed on real business sites. Verified through
cookie/privacy policies that reference `cdn.commoninja.com` and
`widgets.commoninja.com`:

| Site | Platform | Widget type | Finding |
| --- | --- | --- | --- |
| `medius.com` | Corporate | FAQ | Cookie policy lists `cn_uc__` from cdn.commoninja.com for FAQ widget |
| `trowers.com` | Law firm | FAQ | Notices page mentions cdn.commoninja.com local storage for FAQ widget |
| `page.marquardt.com` | Industrial (B2B) | FAQ | Two pages reference cdn.commoninja.com for FAQ widget |
| `ateliersdavoy.com` | Retail | Widget (type unknown) | Cookie policy references cdn.commoninja.com |
| `nzanewzealand.com` | Corporate | Widget (type unknown) | Privacy page lists `cn_uc__` from cdn.commoninja.com |

**Key crawlability finding:** On `ateliersdavoy.com`, the homepage was
inspected via browser. The page initially showed `cdn.commoninja.com` in the
page source (detected via evaluate), but after full DOM load, no
`commonninja_component` div, no FAQ content, and no visible widget DOM was
found in the rendered HTML. This confirms the loader pattern: **the CDN script
loads, fetches the widget config from Common Ninja's servers, and renders the
widget DOM client-side. The widget content (FAQ answers, review text, etc.) is
NOT in the host page's HTML source — it is invisible to crawlers.**

The embed identifiers (`commonninja_component`, `pid-`) do not appear in search
engine indexes because they only exist inside generated embed snippets from the
dashboard and are rendered client-side after the CDN script loads.

### Knowledge base observations (summary)

See community/KB details above — the pricing FAQ reveals important behaviors
and platform guides confirm cross-platform embedding is a real support surface.

---

## 13. PMM artifacts

### 13.1 Positioning statement

> Clickeen is a Widget platform where your content is saved as
> real, crawlable HTML — not a CDN script that renders in the browser. Common
> Ninja ships 229 catalog entries built on ~50 engines that are invisible to
> crawlers and answer engines, with simpler account-owned pricing.

### 13.2 Battle card

| | Clickeen | Common Ninja |
| --- | --- | --- |
| Where we win | Complete crawlable Widget HTML; account-owned pricing; Dieter design system; baseLocale + exact overlays at every tier; agent-operated substrate (not MCP bolt-on) | — |
| Where they win | — | ~50 widget engines with connector breadth (reviews, feeds, forms); MCP server today; native payments/CRM/analytics; platform plugins (WordPress, Shopify) |
| When we lose | Customer needs a widget type Clickeen doesn't have (social feeds, review aggregators, booking, charts, gaming). Customer wants MCP today. | Customer needs those. |
| When we win | Customer cares about Widget SEO/crawlability, wants brand consistency across Widgets, or wants to stop paying per Widget. |
| Killer question | "Do you want a client-rendered script crawlers struggle to read, or a saved Widget with real crawlable content?" |

### 13.3 Messaging guidance

**Say:**
1. "Your content is real." Saved HTML, not CDN scripts. Crawlers see it, answer engines see it.
2. "One account, all your widgets." Not per-widget pricing.
3. "Agents operate it natively." Product Copilot edits your widgets. Translation Agent localizes them. Not an MCP bolt-on.

**Do NOT say:**
1. "We have 8 widgets." Next to their inflated 229, this invites the wrong comparison. The message is depth, not catalog size.
2. "We have an MCP server." We don't yet. Common Ninja does. Don't claim it.
3. "We're cheaper." Per-widget vs account-owned is complex to compare. The message is "one account owns everything," not "we cost less."

---

## Sources

- [Common Ninja — Widgets catalog](https://www.commoninja.com/widgets)
- [Common Ninja — Pricing](https://www.commoninja.com/pricing)
- [Common Ninja — AI Editor](https://www.commoninja.com/features/ai)
- [Common Ninja — MCP Server](https://www.commoninja.com/features/mcp)
- [Common Ninja — No-Code Editor](https://www.commoninja.com/features/no-code-editor)
- [Common Ninja — Native Payments](https://www.commoninja.com/features/payments)
- [Common Ninja — Localization](https://www.commoninja.com/features/localization)
- [Common Ninja — Developers](https://developers.commoninja.com)
- [Embeddable.co — AI Widget Builder](https://embeddable.co)

---

## 14. Catalog deduplication — the real engine count

### Method

Every widget entry from the `/widgets` page snapshot (229 entries) was clustered
by identifying the underlying UI engine. Three inflation tactics were identified:

| Tactic | How it works | Example |
| --- | --- | --- |
| **Connector multiplication** | One engine connected to N platforms = N entries | Reviews engine × 15 review platforms = 18 entries |
| **Content-preset multiplication** | One engine with different default content = N entries | Flip-card engine × 6 content types = 7 entries |
| **Layout-variant multiplication** | One engine in different display modes = N entries | Feed engine × feed/carousel/slider = 3 entries per platform |

### The biggest inflators

| Engine family | Distinct engine(s) | Catalog entries | Inflation factor | How they inflate |
| --- | --- | --- | --- | --- |
| Reviews aggregator | 1 engine | 18 | 18× | Same widget connected to 15 review platforms + All-in-One + Badge + Trust Box |
| Social feed (feed layout) | 1 engine | 19 | 19× | Same widget connected to 18 social platforms + Social Media & RSS |
| Social feed (carousel layout) | 1 engine (shared with feed) | 7 | — | Same platforms, carousel display |
| Social feed (slider layout) | 1 engine (shared with feed) | 7 | — | Same platforms, slider display |
| Form builder | 1 engine | 13 | 13× | Same form builder with different field presets (contact, job app, RSVP, donation, HIPAA, etc.) |
| Flip cards | 1 engine | 7 | 7× | Same flip-card UI with different default content (team, event, skill, restaurant, branch) |
| Content list | 1 engine | 6 | 6× | Same list UI with different default content (team, event, skill, branch, restaurant, info) |
| Popup | 1 engine | 8 | 8× | Same popup engine with different trigger presets |
| Bar/banner | 1 engine | 6 | 6× | Notification bar + coupon bar + countdown bar + cookie bar + cookie banner |
| Payment/checkout button | 1 engine | 6 | 6× | Same checkout button with different payment providers and modes |
| Chat/click-to-contact button | 1 engine | 5 | 5× | Same click-to-chat button for different platforms |
| Listings board | 1 engine | 7 | 7× | Same listing UI with different content types |
| Audio player | 1 engine | 4 | 4× | Same audio player rebranded |
| Image carousel/slider | 1-2 engines | 8 | 4-8× | Same carousel/slider with different presets |
| Video player/gallery | 1 engine | 5 | 5× | Same gallery with different video sources |
| CTA button | 1 engine | 5+ | 5× | Same button with different animations/positions |
| Quiz/poll engine | 1-2 engines | 8 | 4-8× | Same quiz/poll UI with different interaction modes |
| Bracket/tournament | 1 engine | 4 | 4× | Same bracket engine with different scoring modes |

**These ~18 engine families account for ~140+ of the 229 entries.** Nearly
two-thirds of the catalog is built on about a dozen engines multiplied by
connector variants and content presets.

### The real number

**Conservative (maximum distinct engines): ~60-65**
**Aggressive (collapse shared UI patterns): ~40-45**
**Best estimate: ~50 distinct widget engines**

**The inflation factor: 229 catalog entries ÷ ~50 engines = ~4.6× inflation.**

### What this means

Common Ninja's "229 widgets" is a **connector-inflated marketing number.** Their
actual engineering surface is ~50 widget engines, and the inflation comes from
API integration work (connectors) and content configuration (presets), not from
widget engineering innovation. The corrected competitive picture:

- Common Ninja: ~50 engines (many simple single-purpose widgets), 229 inflated
  entries, no composition, no shared design system, no crawlable HTML
- Clickeen: 8 deep engines, Dieter design system,
  saved crawlable HTML, agent-operated substrate

The real comparison is **8 deep engines vs ~50 mostly-simple
independent engines with connector breadth.** Common Ninja's moat is integration
work, not widget quality or platform depth.

---

## 15. Full pricing matrix (per-widget, annual billing)

Pricing is per-widget and scales by quantity (1, 2, 3, 5, 10, 25, 50, 100, 250,
1,000, or Custom). The prices below are **per widget, list price, billed
annually**. A promotional 30% discount is currently applied at checkout.

| Plan | Per widget / year (list) | Per widget / month equivalent |
| --- | --- | --- |
| Free | $0 | $0 |
| Essentials | $24.00 | $2.00 |
| Pro | $38.40 | $3.20 |
| Ultimate | $62.40 | $5.20 |
| Enterprise | Custom | Custom |

All paid plans include a 3-day risk-free trial. Free-plan widgets revert when a
paid subscription expires.

### Core features by plan

| Feature | Free | Essentials | Pro | Ultimate |
| --- | --- | --- | --- | --- |
| Access 200+ widget types | ✗ | ✓ | ✓ | ✓ |
| Widget Instances | 1 | 5 | 5 | 5 |
| Monthly Pageviews | 200 | Unlimited | Unlimited | Unlimited |
| Projects | ✗ | Unlimited | Unlimited | Unlimited |
| Collaborators | ✗ | 1 | 3 | 5 |
| Custom Widget URL | ✗ | ✗ | ✓ | ✓ |
| Custom Domain | ✗ | ✗ | ✗ | ✓ |
| Premium support | ✗ | ✓ | ✓ | ✓ |
| AI Enhancer | ✗ | ✓ | ✓ | ✓ |
| Integrations | ✗ | ✗ | ✓ | ✓ |
| Multi-Language Support | ✗ | ✗ | ✗ | ✓ |
| API Access | ✗ | ✓ | ✓ | ✓ |
| Remove branding | ✗ | ✓ | ✓ | ✓ |

### Customization by plan

| Feature | Free | Essentials | Pro | Ultimate |
| --- | --- | --- | --- | --- |
| Advanced Styles | ✗ | ✓ | ✓ | ✓ |
| Custom Styles | ✗ | ✗ | ✓ | ✓ |
| Custom CSS | ✗ | ✗ | ✗ | ✓ |

### Content limits by plan

| Limit | Free | Essentials | Pro | Ultimate |
| --- | --- | --- | --- | --- |
| Content Items | 5 | 10 | 100 | 1,000 |
| AI Editor Tokens | 3 | 10 | 25 | 50 |
| AI Image Gen Tokens | 1 | 5 | 10 | 15 |
| Storage | 50 MB | 1 GB | 5 GB | 25 GB |
| Single File Size | 5 MB | 15 MB | 25 MB | 100 MB |

### Widget-specific limits (selected)

| Widget type | Free | Essentials | Pro | Ultimate |
| --- | --- | --- | --- | --- |
| Reviews to Display | 5 | 10 | 100 | 1,000 |
| Form Submissions | 10 | 50 | 1,500 | 5,000 |
| Poll Votes | 10 | 100 | 1,000 | 10,000 |
| Comments | 10 | 50 | 1,500 | 5,000 |
| Feed Sources | 1 | 2 | 5 | 10 |
| Feed Posts | 8 | 20 | 100 | 500 |
| Comparison Table Rows | 8 | 25 | 100 | 1,000 |
| Chart Data Series | 1 | 3 | 10 | 50 |
| Payment Orders | 15 | 75 | 75 | 5,000 |
| Translation Requests | 10 | 100 | 500 | 2,500 |
| AI Chatbot Monthly Messages | 50 | 500 | 2,500 | 10,000 |

### Key takeaways vs Clickeen's model

1. **Per-widget pricing scales expensively.** 10 widgets at Ultimate = ~$624/year
   at list price. Clickeen's account-owned model includes all instances under
   one account tier.
2. **Everything is metered.** Content items, submissions, votes, comments, feed
   sources/posts, reviews, chart data, translation requests, AI chatbot
   messages, storage, file sizes — every dimension has a hard cap per plan.
3. **Free tier is extremely limited.** 1 widget instance, 200 monthly pageviews,
   5 content items, 50 MB storage.
4. **Multi-Language is Ultimate-only** ($5.20/mo per widget). Translation is
   metered by "translation requests" (10-2,500). Clickeen's baseLocale + overlay
   model is structurally built into every tier.
5. **Custom CSS is Ultimate-only.** Pro gets "Custom Styles" but not raw CSS.
   Clickeen avoids this ceiling by having Dieter tokens — every widget is
   customizable through structured controls, not raw CSS gates.
