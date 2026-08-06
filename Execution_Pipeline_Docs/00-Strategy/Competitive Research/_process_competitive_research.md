# Competitive Research Process — Senior PMM Standard

Status: **PROCESS — REUSABLE**

Date: 2026-08-05

This is the standard process for conducting competitive research on Widget and
adjacent content-surface platforms. It exists to prevent the two failure modes we hit in
the first pass: (1) taking marketing numbers at face value (the "229 widgets"
mistake), and (2) producing feature catalogs instead of positioning artifacts.

Every competitive analysis in `Competitive Research/` should follow this
process. The output is not a feature list — it is **positioning, battle cards,
and actionable intelligence.**

---

## The principle

A Senior PMM does not catalog features. A Senior PMM interrogates claims,
deduplicates marketing numbers, maps the competitive landscape on axes that
matter to the customer, and produces artifacts sales/marketing/product can act
on. The research serves positioning, not curiosity.

---

## Step 1: Inspect the actual product (not the marketing site)

**Use the browser.** Click through the product. Read the embed code. Open the
dashboard if possible. Verify every claim against what the product actually does.

Specifically:
- **Capture the embed snippet.** Is it a loader stub (Elfsight pattern)? A
  server-rendered artifact? An iframe? The embed architecture IS the product
  architecture — classify it.
- **Render a widget with JavaScript disabled** (or inspect the noscript
  fallback). Is the content crawlable? This is the single most important
  competitive question for Clickeen's thesis.
- **Count the clicks from signup to live widget.** This is the speed-to-live
  claim. Verify it; don't repeat their marketing number.
- **Inspect the editor.** Is there a shared design system, or per-widget styling?
  Is there CSS access? Is there AI? Where does the AI live (inside authoring, or
  beside it)?

**Rule:** never cite a product feature from the marketing page alone. Either
verify it in the product or flag it as "claimed, not verified."

---

## Step 2: Deduplicate the catalog (never trust the headline number)

Every widget/platform competitor inflates their catalog. Before quoting any
widget count, do the deduplication:

### Inflation tactics to identify

| Tactic | How to spot it | Example |
| --- | --- | --- |
| **Connector multiplication** | One engine connected to N platforms = N catalog entries | Reviews engine × 15 platforms = 18 entries |
| **Content-preset multiplication** | One engine with different default content = N entries | Flip-card engine × 6 content types = 7 entries |
| **Layout-variant multiplication** | One engine in different display modes = N entries | Feed engine × feed/carousel/slider = 3 entries per platform |
| **Rebranding** | Same engine rebranded for different audiences | Audio Player / Music Player / MP3 Player / Podcast Player |

### How to deduplicate

1. List every catalog entry.
2. Group by underlying UI engine (same interaction pattern = same engine).
3. Collapse connector variants (1 review engine, not 18 review widgets).
4. Collapse content presets (1 flip-card engine, not 7 flip-card widgets).
5. Collapse layout variants (1 feed engine, not 3 feed widgets per platform).
6. Count the distinct engines.

**Report both numbers:** the marketing headline AND the real engine count.
Example: "Common Ninja claims 229 widgets; deduplication reveals ~50 distinct
engines, inflated ~4.6× through connector and preset multiplication."

---

## Step 3: Map the architecture (the structural differentiator)

For every competitor, classify the public artifact architecture:

| Architecture | What the crawler sees | What the visitor sees | Competitive implication |
| --- | --- | --- | --- |
| **Loader/Elfsight pattern** | `<noscript>` only; empty container | CDN script fetches config and renders DOM at runtime | Content invisible to crawlers/answer engines. Cannot match Clickeen's saved-HTML thesis without rebuilding. |
| **Server-rendered** | Complete HTML | Complete HTML + progressive enhancement | Closest to Clickeen's model. Identify what they serve vs what Clickeen serves. |
| **Iframe embed** | An `<iframe src="...">` tag | Iframe content loaded from provider | Crawlable only if the iframe source URL itself is crawlable. Usually not. |

**The architecture classification determines whether the competitor can match
Clickeen's saved-HTML / SEO / GEO / AEO thesis.** If they're on the loader
pattern, they cannot — and that is the structural moat.

---

## Step 4: Pricing analysis (the unit economics and the pricing seam)

This is the most important intelligence in the entire analysis. Pricing is not
a feature list — it is the customer's real cost, the competitor's real revenue,
and the seam where Clickeen attacks. Do this thoroughly or the battle card is
worthless.

### 4.1 The pricing mechanics (read the fine print)

For every competitor, identify:

1. **Pricing unit:** per-widget? per-account? per-seat? per-view? flat?
2. **Free tier:** what's included? what's the ceiling? Is it usable for real
   evaluation or just a teaser?
3. **Metered dimensions:** what's capped (content items, submissions, views,
   storage, AI tokens)? HOW is each metric counted? (e.g., is a "view" per-page
   or per-widget-load? Per-app or shared pool? This distinction changes the real
   cost by orders of magnitude.)
4. **The multiple-Widget penalty:** if a customer wants N Widgets, what does it
   cost? Per-widget pricing penalizes broader use; account-owned pricing does
   not.
5. **The upgrade cliff:** where does free → paid hit? What does the customer
   lose if they downgrade?
6. **Billing cycle:** monthly? annual-only? Is the headline price promotional
   or standard? What is the actual charge on the credit card?
7. **Hidden costs:** installation fees? Branding removal fees? Per-feature
   unlocks? What is included at every tier vs gated behind higher tiers?

**Read the help center / FAQ, not just the pricing page.** The pricing page
is marketing. The help center reveals how metrics are actually counted. The
view-counting mechanic (per-widget-load vs per-page) is the single most
important hidden cost factor and is never explained on the pricing page.

### 4.2 Customer distribution estimation (where the revenue concentrates)

A PMM needs to know what plan the typical customer is actually on. Triangulate:

1. **From claimed installs/revenue:** If the competitor claims X users and has
   ~$Y ARR, the implied paid conversion rate and average revenue per customer
   can be estimated. (e.g., 3M signups, $3.9M ARR → ~0.5% paid conversion at
   ~$200/customer.)
2. **From review demographics:** G2/Capterra reviewer company sizes reveal who
   actually pays. If 80% of reviewers are "small-business (50 or fewer emp.)",
   the revenue concentrates in the lower tiers.
3. **From community complaints:** what plan are customers complaining from? If
   the complaints are about view limits, the complainers are on Basic/Pro, not
   Enterprise.
4. **Produce a revenue distribution table:** estimated % of paying customers by
   tier, estimated customer count, average revenue per customer, estimated
   revenue contribution per tier. This should reconcile with the total ARR
   estimate from Step 5b.

### 4.3 The pricing seam — where Clickeen attacks

From the pricing mechanics and customer complaints, identify the specific
pricing pain point Clickeen exploits:

- Is it view-limit deactivation? Per-widget pricing? Annual-only billing?
  Confusing metering? Branding removal fees?
- What does the median paying customer actually pay (revenue-weighted average)?
- What could Clickeen charge that undercuts that number while delivering more
  value (no deactivation, saved HTML, agents)?
- State the Clickeen pricing position as a one-sentence answer to "why is your
  pricing better?" — not "we're cheaper" but "what you get for the price is
  structurally different."

**Compare to Clickeen's model explicitly:** account-owned tier, entitlement
matrix (`widgets.instances.max`, `instances.published.max`), no per-widget
pricing, no view metering, baseLocale + overlays at every tier. Pages are a
deferred future product and are not part of the current comparison.

---

## Step 5: AI and agent-operation assessment

For every competitor, answer:

1. **Where does AI live?** Inside the authoring surface (prompt-to-widget, AI
   content generation), beside it (separate AI chatbot), or not at all?
2. **Is there an agent surface?** MCP server? API for external agents? Or is AI
   only available through their UI?
3. **What does the agent operate?** Structured source truth? A config layer on a
   CDN? A form-filling dashboard?
4. **Is the agent operation native or bolted-on?** Did they build for agents
   from the substrate, or did they add an MCP/API on top of a legacy system?

**This is the forward-looking competitive axis.** Common Ninja's MCP server is
the canary. The question is whether agents operate a legacy substrate or a
structured one.

---

## Step 5b: Company scale and revenue estimation

A PMM needs to know how big the competitor actually is — not just what they
claim. This step triangulates company size, install base, revenue, and growth
trajectory from public signals.

### 5b.1 Claimed scale

Search the competitor's own marketing for scale claims:
- "Trusted by X businesses" / "X+ websites" / "X installs"
- Homepage badges, footer stats, case study counts
- Press releases, blog posts, podcast appearances by founders
- App store listing stats (Shopify App Store download counts, WordPress plugin
  active installs, etc.)

**Rule:** record the claim AND the source URL. Claims are marketing, not facts.

### 5b.2 Employee count (LinkedIn — do NOT trust the company page range)

**The LinkedIn company page range (e.g. "11-50" or "51-200") is self-reported
marketing, NOT a verified count.** Companies select it from a dropdown and
routinely inflate it. Do NOT cite it as data. It is a claim, not a fact.

**The correct method:** search LinkedIn for actual employee profiles.

1. Search `site:linkedin.com/in "[company name]"` to find individual profiles
   listing the company as employer.
2. Count the unique people visible.
3. Apply a coverage multiplier of **2-3×** to account for employees who don't
   maintain LinkedIn profiles or don't list their employer (this factor is
   higher in CIS/Eastern European/Asian markets where LinkedIn penetration is
   lower).
4. Report: "N visible profiles on LinkedIn → estimated ~N×2 to N×3 actual
   employees."

Also record from the LinkedIn company page:
- **Headquarters location** (country, city) — this determines the salary floor
  for revenue estimation.
- **Founder/leadership profiles** (background, previous companies, how long
  they've been at this one).
- **Job postings** (are they hiring? what roles? — growth signal).
- **Founding year** (from the LinkedIn "About" or company website).

Employee count (from profile search, not company page) is the single most
reliable public proxy for a private company's actual size and operating cost.
Cross-reference with the website footer copyright year.

### 5b.3 Revenue estimation

For private SaaS companies, revenue is not public. Do NOT cite third-party
estimate services (GetLatka, ZoomInfo, Growjo, etc.) — they produce unreliable
scraped guesses with no methodology and should never be used as data.

**The bottom-up operating-cost method (most reliable):**
1. Take the **employee count from §5b.2** (profile-search-based, not the
   company-page range).
2. Determine **fully-loaded cost per employee** based on headquarters location:
   - US/Western Europe: ~$100-200K/year per employee
   - Eastern Europe/CIS: ~$35-60K/year
   - Armenia/Georgia/India: ~$25-50K/year
   - Israel: ~$80-140K/year
3. Multiply: **employee count × cost per employee = annual operating cost.**
4. A bootstrapped company must cover operating costs with margin. Revenue is
   typically **1.5-3× operating cost** for a profitable SaaS.
5. This gives a **revenue floor** (operating cost) and a **revenue ceiling**
   (3× operating cost).

**Cross-check with pricing-based estimation:**
- G2/Capterra review count × estimated review-to-customer ratio (1:50-200 for
  B2B SaaS, adjusted for incentivization) = estimated paying customers.
- Paying customers × average plan price = estimated revenue.
- If this falls within the operating-cost range, the estimate is consistent.

**Report a range with the method stated.** Example: "~20-30 employees in Armenia
at ~$35-50K/year each = ~$0.7-1.5M operating cost. Revenue probably $1.5-4M/year.
G2's 907 reviews suggest ~68,000-136,000 paying customers at $50-100/year average
= $3.4-13.6M. The two ranges overlap at $1.5-4M, which is our best estimate."

### 5b.4 Install verification

Try to verify the claimed install count:
- **Search engine queries for embed signatures** (e.g.
  `cdn.commoninja.com`, `cdn.openwidget.com`). The number of unique domains
  referencing the CDN is a lower bound on real installations.
- **BuiltWith / Wappalyzer / SimilarTech** — these services track technology
  installs across the web. Search for the competitor's domain or technology
  signature. They often show install counts and growth trends.
- **WordPress plugin directory** (if applicable) — shows active install counts
  directly.
- **Shopify App Store** (if applicable) — shows review count and sometimes
  install count ranges.

**Report both the claimed number and the verified/lower-bound number.** If the
claim is "500K businesses" but web-wide CDN signature searches find ~50 unique
domains, the claim is likely total signups (including free/churned), not active
paid installations.

### 5b.5 Growth trajectory signals

- **Job postings** — hiring = growing; frozen hiring = stagnating.
- **Product velocity** — how many new widgets/features in the last 12 months?
  (Check blog, changelog, release notes.)
- **Social media activity** — is the company posting regularly? Are customers
  engaging?
- **Review growth rate** — are G2/Capterra reviews accumulating or stale?

---

## Step 6: Localization and locale model

For every competitor, answer:

1. **Do they support multiple languages?** Is it a feature, a tier-gate, or
   absent?
2. **What is the localization model?** Is it:
   - **Copy-based** (duplicated content per locale — the legacy SaaS pattern)?
   - **Overlay-based** (one source + locale-specific value maps — Clickeen's
     model)?
   - **Machine translation** (auto-translate button, no source-truth
     discipline)?
   - **None** (single-language only)?
3. **Is there a `baseLocale` equivalent?** Does the product distinguish between
   "source language" and "translated languages," or are all locales equal?
4. **Is localization tier-gated?** Common Ninja puts Multi-Language Support
   behind Ultimate ($5.20/mo per widget) and meters "translation requests"
   (10-2,500). Identify the gate and the metering.
5. **Is there a translation agent or AI translator?** Does an agent generate
   translations from source, or does the user hand-translate everything?
6. **What about locale-specific formatting?** Date/time/number formats, RTL
   support, currency — are these handled per-locale or globally?

**Compare to Clickeen's model explicitly:** baseLocale + exact overlays + Babel
protocol + Translation Agent. The question is whether the competitor has
source-truth discipline or just copy-duplicates content per locale.

---

## Step 7: Customer voice (reviews, community, knowledge base)

This is the step that separates a PMM from a feature-cataloguer. The product
pages tell you what the vendor claims. Customer voice tells you what actually
happens.

### 7.1 Customer reviews

Search G2, Capterra, GetApp, Product Hunt, TrustPilot, and SourceForge for
customer reviews. Read at least 15-20 reviews across platforms.

Extract:
- **What customers love** (the top 3-5 praised features). These are the
  competitor's real strengths — not their marketing claims, but what actually
  delights users.
- **What customers complain about** (the top 3-5 complaints). These are
  Clickeen's competitive openings. Pay special attention to complaints about:
  performance, SEO, customization limits, pricing, support quality, bugs,
  mobile rendering, and content ownership.
- **Who the reviewers are** (agency? small business? enterprise? developer?).
  This tells you who the competitor actually serves vs who they market to.
- **The switch signal** (reviews that mention switching FROM another tool, or
  wanting to switch TO another tool). These reveal the competitive dynamics.

**Report verbatim quotes** for the top praise and top complaint. A real customer
sentence is worth more than a summary.

### 7.2 Community forum

If the competitor has a community forum (Discourse, Slack, Discord, Facebook
group), go read it. Look for:

- **Feature requests** — what are users asking for that the competitor hasn't
  built? These are gaps Clickeen could fill.
- **Bug reports and complaints** — what's broken or painful? These are
  weaknesses.
- **Workarounds** — what are users doing to solve problems the product doesn't
  handle? These reveal unmet needs.
- **Tone and engagement** — is the community active? Are the vendor responses
  helpful or defensive? This tells you about the company's support culture.
- **Popular topics / pinned posts** — what does the community care about most?

### 7.3 Knowledge base / help center

Go through the competitor's help center or documentation. Look for:

- **The most-viewed / most-linked articles** — these tell you what users
  struggle with most.
- **"How do I..." articles** that reveal product complexity — if there's a
  20-step guide for something that should be simple, that's a UX weakness.
- **Limitations and caveats** — articles that say "we don't support X" or "X
  is not available on plan Y." These are hard constraints.
- **Migration articles** — "how to switch from [tool]" reveals who they see as
  competitors and what switching costs look like.
- **Developer/API docs** — how deep is the developer surface? Is there an API?
  Webhooks? An MCP server? How well documented is it?

### 7.4 Customer discovery (find live installations)

Find real websites using the competitor's widgets. Methods:

- **Search for their embed signatures.** Common Ninja widgets load from
  `cdn.commoninja.com` — search for that string. OpenWidget uses
  `cdn.openwidget.com` and `window.__ow`. Elfsight uses `elfsight.com`.
- **Use the competitor's showcase / "built with" page** if they have one.
- **Search for their brand name + "review" or "demo"** on YouTube, Reddit, and
  blog posts — users often publish walkthroughs showing real installations.
- **Check the competitor's social media** for customer shoutouts and case
  studies.

For each live installation found, note:
- **What platform the site is on** (WordPress, Shopify, Webflow, custom).
- **Which widgets are installed** and how many.
- **How the widgets look** (branded? unbranded? well-styled or default?).
- **Whether the widget content is crawlable** (view source — do you see the
  content in HTML, or just a script tag?).
- **Page load impact** (does the widget add visible latency?).

This is the ground-truth verification of their architecture claim. If the
marketing says "SEO-friendly" but view-source shows only a script tag, that's a
contradiction worth reporting.

---

## Step 8: Produce the PMM artifacts

The research is not the deliverable. The deliverable is one or more of:

### 8.1 Positioning statement (mandatory)

One sentence that frames Clickeen vs this competitor on the axis Clickeen wins.

Formula: *"Clickeen is the only [category] where [structural differentiator],
unlike [competitor] who [their architectural limitation]."*

### 8.2 Battle card (mandatory)

| | Clickeen | [Competitor] |
| --- | --- | --- |
| Where we win | … | — |
| Where they win | — | … |
| When we lose | … | … |
| When we win | … | … |
| Killer question | The one question that exposes their weakness | — |

### 8.3 Messaging guidance (mandatory)

Three things to say. Three things NOT to say. With reasoning.

**Say:** messages where Clickeen has a structural advantage the competitor
cannot copy.

**Do NOT say:** messages where Clickeen is weaker (don't invite the comparison)
or where we can't back the claim.

### 8.4 Gap analysis (if applicable)

What does Clickeen need to build to remove reasons to choose this competitor?
NOT to copy them — to close the gap that makes a customer choose them.

### 8.5 Content commissions (if applicable)

What marketing content should be produced from this research? (Explainers,
comparison pages, pricing calculators, etc.)

---

## Step 9: Quality gates

Before publishing the analysis, verify:

- [ ] Every feature claim is verified against the actual product (not just the
      marketing page). Unverified claims are flagged "claimed, not verified."
- [ ] The catalog count is deduplicated. Both the marketing number and the real
      engine count are reported.
- [ ] The architecture is classified (loader/server-rendered/iframe).
- [ ] The pricing unit is identified and compared to Clickeen's model.
- [ ] The metering mechanics are verified against the help center/FAQ, not just
      the pricing page. HOW metrics are counted (per-page vs per-widget, per-app
      vs shared pool) is stated.
- [ ] The customer distribution is estimated: what plan the typical paying
      customer is on, the revenue-weighted average price, and a revenue
      distribution table that reconciles with the total ARR estimate.
- [ ] The pricing seam is identified: the specific pain point Clickeen exploits,
      the median competitor customer cost, and the Clickeen pricing position.
- [ ] The AI/agent surface is assessed.
- [ ] Company scale is estimated: claimed installs, **LinkedIn profile-search-
      based** employee count (NOT the company-page self-reported range), revenue
      range from bottom-up operating-cost method (NOT third-party estimate
      services), and verified install lower-bound are all reported.
- [ ] The localization model is classified and compared to Clickeen's
      baseLocale + overlay model.
- [ ] At least 15-20 customer reviews across G2/Capterra/GetApp/Product Hunt
      are read and the top 3 praises + top 3 complaints are reported with
      verbatim quotes.
- [ ] The community forum (if one exists) is read and feature requests / bug
      reports / workarounds are reported.
- [ ] The knowledge base is scanned for limitations, caveats, and complexity
      signals.
- [ ] At least 3-5 live customer installations are found and inspected
      (view-source for crawlability, widget count, platform, styling quality).
- [ ] The PMM artifacts (positioning, battle card, messaging) are produced.
- [ ] No marketing number is cited without interrogation.

---

## File naming and location

```
Execution_Pipeline_Docs/00-Strategy/Competitive Research/
├── _process_competitive_research.md   ← this file
├── OpenWidget_Analysis.md
├── CommonNinja_Analysis.md
└── [NextCompetitor]_Analysis.md
```

Each analysis follows the 10-step process and produces the PMM artifacts. The
process file is referenced by every analysis to ensure consistency.
