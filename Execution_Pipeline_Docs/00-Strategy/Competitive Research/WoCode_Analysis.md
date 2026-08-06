# WoCode (Without Code) — Competitive Research & Analysis

Status: **RESEARCH**

Date: 2026-08-05

Source: wocode.com (homepage, widgets, pricing, SEO, about, showcase), Trustpilot,
Cenny review, LinkedIn, Crunchbase, and browser inspection of the product.

## TL;DR

WoCode (full name "Without Code") is a **no-code website builder** — not a
widget platform. It is in a different category from Elfsight, Common Ninja, and
OpenWidget. It is a **future research reference** because customer Pages and
website building are deferred planning. WoCode shows the scope of that possible
future product when a small team builds it for designers.

Founded 2018 by Steve (former web designer, also founder of MuseThemes — an
Adobe Muse template/widget company). When Adobe Muse reached end-of-life, the
team pivoted to building their own code-free website builder. 24,000+ designers
in their community. Very small team (~5-15 employees). Revenue not disclosed;
likely $500K-2M/year based on pricing and community size.

This analysis is shorter than the widget-platform analyses because WoCode is a
website builder, not an embed platform. Several process steps (embed
architecture, catalog deduplication by connector multiplication) do not apply in
the same way. The competitive intelligence is about the **builder model** —
how a small team builds a full website platform with widget components, hosting,
ecommerce, SEO, and memberships.

---

## 1. What WoCode is

### Product

A cloud-based, drag-and-drop website builder. The user designs an entire
website visually — no code. Hosting is included (AWS-backed). Templates,
ecommerce, SEO tools, email hosting, memberships, and 100+ "widgets" (which are
builder components, not embeddable scripts) are all native to the platform.

### How it differs from widget platforms

| Dimension | WoCode | Elfsight / Common Ninja / OpenWidget |
| --- | --- | --- |
| Product category | Website builder | Embeddable widget platform |
| What they host | The entire website | Just the widget (on YOUR site) |
| Widget role | Builder components (part of the site) | Embeddable scripts (added to a site) |
| Customer | Web designer building a whole site | Site owner adding a feature |
| Embed model | None — you build IN their builder | Script tag pasted into your site |

### Target customer

Web designers, freelancers, and agencies building client websites. 24,000+
designers in their community. Positioned as simpler than WordPress, cheaper than
Webflow, more flexible than Wix/Squarespace.

---

## 2. The widget catalog (100+ builder components)

The "100+ widgets" are **builder components**, not independent embeddable apps.
They only exist inside the WoCode builder — you cannot embed them on an
external site. Categories:

| Category | Representative components |
| --- | --- |
| **Media** | Audio, Audio Playlist, Before & After, Carousel Slider, Cinematic Slider, Combo Slider, Directory Gallery, Expandable Cards, Flipping Boxes, Floating Gallery, Hover & Zoom Gallery, Image Slider, Kinetic Gallery, Photo Gallery, Stacking Cards, Video, Video Slider, Vimeo Gallery |
| **FX (Visual Effects)** | ~25+ visual effect widgets (Bokeh, Birds, Clouds, Confetti, Dots, Fog, Frost, Globe, Particles, Rings, Topology, Waves, etc.) |
| **Social** | Facebook Feed, Facebook Like, Facebook Comments, Twitter Feed, Google Reviews, Yelp Reviews, Reviews Showcase, Disqus Comments, Share, WhatsApp |
| **Business** | Contact Form, Contact Us, About Us, Calendar, Calendly, OpenTable, Google Calendar, Mortgage Calculator, Click to Call, Newsletter, Restaurant, Paypal, Shopify Cart, Shopify Store, Ecwid Store, Zoom Meeting |
| **Basics** | Image, Text & Image, Icon, Shape, Button, Table, HTML, iFrame, Tabs, FAQ, Collapsible Text, Bullet List Pro, Breadcrumbs, Copyright |
| **Advanced** | Dynamic Pages, Dynamic Repeater, SEO Widget Pack, Search (Pro), Enhanced Menu (Mega Menu), Popup Pro, Infiniscroll, Image Hotspots, Image Mask, Lottie Animation, SVG Animate, Countdown, Animated Counter, Animated Bars |
| **Core** | Navigation, Templates, Membership, Account/Dashboard |

**No deduplication needed** in the same way as widget platforms — these are
builder components, not connector-inflated catalog entries. The FX category
(~25 visual effects) is the largest cluster, but each is a genuinely different
animation/effect engine.

### Comparison to Clickeen's catalog

WoCode has significantly more builder components than Clickeen has widget types
(100+ vs 8). But the comparison is misleading: WoCode's components only work
inside their proprietary builder. Clickeen's widgets are standalone saved
artifacts served from `clk.live`.

---

## 3. Architecture and SEO model

### Architecture: server-rendered website builder

Unlike Elfsight/Common Ninja/OpenWidget (which inject scripts into external
sites), WoCode IS the hosting platform. Sites built on WoCode are served from
WoCode's AWS infrastructure. The pages are **server-rendered HTML** — not
client-rendered from CDN scripts.

This is architecturally **closer to Clickeen's model** than to the widget
platforms:
- WoCode generates real HTML pages (not empty divs + CDN scripts).
- Content is crawlable (WoCode emphasizes SEO: Core Web Vitals, mobile
  optimization, dynamic serving, sitemaps).
- There is no "loader pattern" — the site IS the product.

### SEO claims

WoCode has a dedicated SEO page emphasizing:
- Google Core Web Vitals optimization
- Mobile-first responsive design with dynamic serving by device
- Automatic sitemaps
- Meta tag controls
- Fast load times (AWS hosting)

This is the same SEO story Clickeen tells for Widgets (complete crawlable HTML),
but built into a full website builder rather than a Widget platform.

### The embed question

WoCode does not use embeddable scripts. You build your entire site on their
platform. There is no "paste this snippet into your Shopify store" model. This
means:
- WoCode captures the **entire website budget** (hosting + builder + widgets),
  not just the widget budget.
- WoCode's lock-in is higher: your entire site lives on their platform.
- WoCode competes with Wix/Squarespace/Webflow/Duda, not with
  Elfsight/Common Ninja.

---

## 4. Pricing

### Full pricing table

All plans include a 14-day free trial (no credit card). Monthly and annual
billing available.

| Plan | Monthly | Annual | Key features |
| --- | --- | --- | --- |
| **Free Trial** | $0 | $0 | Build a site, pick a plan later. Email + chat support. Custom branding (white label). 100+ themes & plugins. Powerful widget library. |
| **Standard** | $18/mo | $216/year | Everything in Trial + AWS site hosting. CMS users (client editing). All themes & plugins. |
| **E-Commerce** | $20/mo | $240/year | Everything in Standard + fully integrated store (up to 100 products). No transaction fees. Team members. 100+ premium themes. |
| **E-Commerce Pro** | $35/mo | $420/year | Everything in E-Commerce + up to 2,500 products. Multilingual store catalog. |

### Pricing model analysis

**Per-site, not per-widget or per-view.** This is fundamentally different from
both Elfsight (per-view metering) and Common Ninja (per-widget pricing). One
subscription = one website with all widgets included. No view limits. No
widget-type restrictions.

This is the **closest pricing model to Clickeen's account-owned model** among
all competitors analyzed. One price, all components, no metering.

**White-label/reseller friendly:** custom branding on all plans, client editing
(CMS users), clients never see WoCode pricing. This targets the
designer/agency market directly.

### Key takeaways vs Clickeen's model

1. **Per-site pricing, not per-view or per-widget.** Same structural approach
   as Clickeen's account-owned entitlements. No deactivation risk.
2. **$18-35/mo is competitive.** For a full website builder with hosting, this
   is cheaper than Webflow ($16-39/mo) and Squarespace ($16-54/mo).
3. **Possible future direction:** Clickeen's agent-operated model + Dieter
   design system + saved-as-truth HTML may inform a future website product.
   Clickeen does not currently have that builder stack.
4. **WoCode's advantage today:** they ARE a website builder. Clickeen is not —
   yet.

---

## 5. AI and agent-operation assessment

**No AI features visible.** No AI chatbot, no AI editor, no prompt-to-widget,
no MCP server, no agent surface. The builder is entirely human-operated via
drag-and-drop.

This is the **biggest competitive gap** WoCode has vs current Clickeen Widgets.
The agent-operated model (Product Copilot, Translation Agent) is a structural
advantage in Widget authoring. Future Pages or website comparisons remain
deferred planning.

---

## 6. Company scale and revenue estimation

### Claimed scale

- **"24,000+ designers"** in their community (homepage/about page).
- **"100+ widgets"** (builder components).
- **"200+ modern templates and plugins."**

### Employee count (LinkedIn profile search)

LinkedIn company page (linkedin.com/company/wocodeinc) exists but profile search
for employees listing "Without Code" or "WoCode" as employer surfaced **zero
direct employee profiles.** Only one user (Gary McShane, UK) mentions using
WoCode software as a client.

This is consistent with a **very small team** — likely **5-15 employees** (the
founder "Steve" plus a small team of developers and support staff, many of whom
may not maintain LinkedIn profiles or may be contractors).

- **Founder:** Steve (former web designer, also founder of MuseThemes).
- **Founded:** 2018 (LinkedIn). The team originated from MuseThemes (Adobe Muse
  templates), which predates this.
- **Headquarters:** Not clearly stated; likely US-based given AWS hosting and
  English-first marketing.
- **Funding:** No Crunchbase profile found. Likely bootstrapped/self-funded.

### Revenue estimation

Not publicly disclosed. Bottom-up:

- **~5-15 employees** (US-based, so ~$80-140K/year fully loaded each).
- 10 employees × $100K = **~$1M/year operating cost.**
- Revenue must cover this with margin: **estimated $1-3M/year.**

Cross-check: If they have 24,000 designers and even 10% are paying ($18-35/mo),
that's 2,400 × $25/mo average = **$720K/year.** At 20% paying: $1.44M/year.
Consistent with the operating-cost estimate.

**Revenue estimate: $1-3M/year.** A small, profitable, bootstrapped website
builder serving a niche designer community.

---

## 7. Localization model

**Minimal.** The E-Commerce Pro plan ($35/mo) includes "Multilingual Store
Catalog." There is a Google Translate widget in the catalog. No baseLocale
concept, no overlay model, no translation agent, no structural localization
discipline.

Same shallow approach as Common Ninja (a widget, not a platform property).

---

## 8. Customer voice

### Reviews summary

| Platform | Score | Review count |
| --- | --- | --- |
| Trustpilot | ~3.5/5 | Very sparse (~1 review) |
| Facebook | 86% recommend | 14 reviews |

**Review volume is extremely low** — consistent with a niche product serving a
small designer community that doesn't review on mainstream platforms.

### What customers like (from limited sources)

1. **Ease of use for designers.** The drag-and-drop builder is accessible
   without coding. Positioned as simpler than WordPress.
2. **Transparent, fair pricing.** No per-widget or per-view charges. One price
   includes everything.
3. **White-label/reseller friendly.** Designers can build client sites without
   the client seeing WoCode branding or pricing.

### What customers dislike

1. **Small ecosystem.** Fewer integrations, templates, and community resources
   than Wix, Squarespace, or Webflow.
2. **Platform lock-in.** Your entire site lives on WoCode. No easy export.
3. **Limited review presence.** Hard to evaluate from independent sources.

### Community

WoCode has a designer community of 24,000+ (claimed). Active Facebook page
(WebsitesWithoutCode). Tutorials and documentation available. The community is
the MuseThemes diaspora — designers who used Adobe Muse and needed a new home.

### Live sites

WoCode has a "Site Showcase" page at wocode.com/showcase featuring real
customer websites built on the platform. This confirms active deployments —
these are full websites, not widget embeds.

---

## 9. What WoCode does well

### 9.1 The full-stack builder model

Hosting + builder + widgets + ecommerce + SEO + memberships + email — one
platform, one price. For a designer building client sites, this is simpler than
assembling WordPress + hosting + themes + plugins + widgets from different
vendors.

### 9.2 White-label/reseller design

Custom branding, client CMS editing, hidden pricing — built for designers who
resell websites. This is a smart niche positioning that Wix/Squarespace don't
serve as well.

### 9.3 Per-site pricing with no metering

No view limits, no per-widget charges, no deactivation. One price = one site.
This is the cleanest pricing model among all competitors analyzed.

### 9.4 The MuseThemes diaspora community

24,000+ designers who migrated from Adobe Muse. This is a captive, loyal
audience that WoCode inherited. It's a real distribution moat for a small
company.

### 9.5 Server-rendered, SEO-friendly architecture

Real HTML pages, not CDN scripts. Core Web Vitals optimization. Sitemaps. This
is architecturally sound — closer to Clickeen's model than to the widget
platforms.

---

## 10. What WoCode does badly

### 10.1 No AI, no agents

Zero AI features. No chatbot, no AI editor, no prompt-to-widget, no MCP. In a
market where Common Ninja has an MCP server and Elfsight has an AI chatbot,
WoCode has nothing. This is the biggest gap.

### 10.2 Platform lock-in

Your entire website lives on WoCode. No export, no portability. If WoCode shuts
down or raises prices, your site is gone. This is the fundamental risk of any
hosted website builder.

### 10.3 Small ecosystem

Fewer integrations, templates, and third-party resources than Wix, Squarespace,
Webflow, or WordPress. The 100+ widgets are builder components — there's no app
marketplace or developer ecosystem.

### 10.4 No localization depth

A Google Translate widget and a "Multilingual Store Catalog" on the top tier.
No structural localization model.

### 10.5 Tiny team and market presence

~5-15 employees. Almost no G2/Trustpilot presence. Low brand awareness outside
the MuseThemes diaspora. This limits growth and creates platform-risk for
customers.

---

## 11. PMM artifacts

### 11.1 Positioning statement

> WoCode is a niche website builder for designers (24,000+ community, ~$1-3M
> revenue, no AI) that shows the scope of a possible future website product.
> Clickeen currently ships Widgets; customer Pages and websites are deferred.

### 11.2 Battle card (future — when Clickeen extends to websites)

| | Clickeen (future) | WoCode |
| --- | --- | --- |
| Where we win | Agent-operated website composition; Dieter design system; baseLocale + exact overlays; saved-as-truth HTML at every level; no platform lock-in (artifacts served from R2, not trapped in a builder) | — |
| Where they win | — | Full website builder today (hosting, templates, CMS, ecommerce, memberships, email); 100+ builder components; 24,000+ designer community; white-label reseller model |
| When we lose | Customer needs a full website builder today. Clickeen is currently a Widget platform. | Customer needs those. |
| When we win | Customer wants agent-operated website building. Customer wants their content to be real saved HTML, not trapped in a proprietary builder. Customer wants localization as a structural property. |
| Killer question | "Do you want to build websites by dragging boxes in a proprietary builder, or do you want agents to compose saved artifacts into websites you own?" |

### 11.3 Messaging guidance (future)

**Say:**
1. Do not use future website messaging as a current product claim.
2. Current messaging remains about saved, crawlable Widgets operated by agents.
3. Revisit website positioning only when the deferred product has an approved execution PRD.

**Do NOT say:**
1. "We're a website builder." We are not. Customer Pages and websites are deferred planning.
2. "We have more widgets." WoCode has 100+. The current message is Widget depth + agents.
3. "We're cheaper." WoCode is $18-35/mo for a full builder. Clickeen's pricing model is different and the comparison is not straightforward.

---

## 12. The strategic read for Clickeen

WoCode is a **possible future competitive reference** — not a current
competitor. Customer Pages and websites are deferred planning; this research
must not be read as an approved roadmap or current product claim.

The lessons from WoCode:

1. **A small team CAN build a full website builder.** ~5-15 people built a
   platform with hosting, 100+ components, ecommerce, SEO, and memberships.
   This is competitor evidence only, not approval for Clickeen to build one.

2. **The designer/agency niche is real and underserved.** WoCode's 24,000+
   community proves designers want a code-free platform with white-label
   capabilities. Clickeen's agent-operated model could serve this audience
   better — agents do the design work, designers direct.

3. **Per-site pricing with no metering is the right model.** WoCode proves it
   works. Clickeen's account-owned entitlements are the natural extension.

4. **No AI is a fatal gap.** WoCode has zero AI. Clickeen's current Product
   Copilot operates structured saved Widget truth directly. A future website
   product remains deferred planning and is not a current claim.

5. **Platform lock-in is the vulnerability.** WoCode traps your entire site.
   Clickeen's saved-as-truth artifacts (real HTML/CSS/JS files served from R2)
   are portable by design. "Your website is real files, not a proprietary
   builder database" is a positioning wedge against every hosted website
   builder.

---

## Sources

- [WoCode — Homepage](https://www.wocode.com/)
- [WoCode — Widgets](https://www.wocode.com/widgets)
- [WoCode — Pricing](https://www.wocode.com/pricing)
- [WoCode — SEO](https://www.wocode.com/seo)
- [WoCode — About](https://www.wocode.com/about)
- [WoCode — Site Showcase](https://www.wocode.com/showcase)
- [WoCode — LinkedIn](https://www.linkedin.com/company/wocodeinc)
- [WoCode — Trustpilot](https://www.trustpilot.com/review/www.wocode.com)
- [MuseThemes — WoCode announcement](https://www.muse-themes.com/blogs/news/without-code)
- [Cenny — WoCode review](https://cenny.net/platforms/without-code-review/)
