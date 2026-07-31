# Research - Elfsight Competitive Breakdown

Status: PRIMARY-SOURCE COMPETITIVE RESEARCH (2026-07-31)
Type: Research / competitive intelligence. Not a PRD. Defines no scope, no
roadmap, and no product decision.
Owner: Product + Architecture

## 0. Method And Evidence Boundary

Evidence was gathered by driving a live, authenticated Elfsight account in a
real browser session on 2026-07-31. Everything in sections 2 through 8 marked
**Verified** was observed directly on screen or read out of the page. Everything
marked **Inferred** is reasoning from observed evidence and is labelled as such.

Surfaces inspected:

- `dash.elfsight.com/apps/faq` — app dashboard
- `dash.elfsight.com/widget/{uuid}` — widget editor, all four panels
- `dash.elfsight.com/apps/faq/pricing/single` — per-app pricing
- `dash.elfsight.com/apps/faq/pricing/packs` — bundle pricing
- `dash.elfsight.com/catalog` — full app catalog
- `dash.elfsight.com/apps/google-reviews` — second app, on an active plan
- Install dialog with live embed code

Not inspected, and therefore not claimed:

- The public embed at runtime on a third-party site. `elfsightcdn.com` and
  `elfsight.com` were unreachable from the inspection surface, so `platform.js`
  was never fetched, measured, or read. Its behavior in section 5 is derived
  from the embed contract and the commercial model, not from reading its source.
- Server APIs, config payloads, data-fetch endpoints, and response shapes.
- Any paid tier's actual feature behavior. All paid-tier claims come from
  published plan copy.

Disclosure: one state-changing action was taken during inspection. The FAQ
widget's **Publish** button was clicked with account-owner authorization. No
content was edited beforehand, so the published state was identical to the
prior state. No plan was selected and no purchase was made.

## 1. Executive Summary

Five findings matter more than the rest.

1. **Elfsight sells apps; Clickeen sells an account.** Every Elfsight app —
   FAQ, Google Reviews, Countdown — carries its own plan, its own widget count,
   and its own view meter. Clickeen has one account, one tier, entitlements
   spanning all widget types. Nearly every commercial difference descends from
   this.

2. **Their serving model cannot produce crawlable content.** The embed is a
   shared `platform.js` plus an empty `<div>`, rendered client-side and
   lazy-loaded on scroll. Widget content does not exist in the served HTML. To
   any fetcher that does not execute JavaScript — which is most LLM and
   answer-engine crawlers — an Elfsight widget is not present. This is the one
   structural advantage Clickeen's materialized-artifact model holds, and
   Elfsight cannot close it without rebuilding serving for 95 apps.

3. **Their paywall sits at existence, not at creation.** Build, edit, save, and
   publish are all free. The wall lands the moment the widget would go onto a
   website. Clickeen currently has no equivalent pressure point anywhere.

4. **Their design surface is roughly fifteen controls plus two code boxes.**
   The FAQ editor offers no typography controls at all. Their answer to brand
   fidelity is a Custom CSS textarea. Clickeen's per-role typography system and
   token pipeline are a categorical advantage on output quality.

5. **Roughly half their best-sellers are integration-sourced.** Google Reviews,
   Instagram Feed, LinkedIn Feed, All-in-One Reviews, WhatsApp Chat. Clickeen
   has zero. This is the highest-retention widget category because the value is
   a live connection, not retyped content.

## 2. Company And Scale Signals

**Verified** — claims published on their own pricing surface:

| Signal | Value |
| --- | --- |
| Users | 3M+ |
| Catalog size | 95 apps |
| Rating | 4.9, "thousands of reviews" |
| History | 14 years |
| Positioning | "#1 top service in the world when it comes to website widgets" |

Their pricing page renders an **AI-Generated Summary** of 1,063 customer
reviews as social proof. Notable as a pattern: AI used as a conversion asset on
the pricing surface, not only as product capability.

A permanent-feeling discount is in effect: "14th BIRTHDAY SALE" with a live
countdown, 33% off plus one free month, and a "Get All Apps -97%" entry in the
dashboard nav. Treat published list prices as aspirational and discounted
prices as the real ones.

## 3. Commercial Model

### 3.1 The per-app structure

**Verified.** The dashboard's left nav lists apps the account has touched —
Calculator, Countdown Timer, Event Calendar, FAQ, Google Reviews — each with
independent state. During inspection the FAQ app showed a `SELECT PLAN` badge
and a **Select Plan** call to action, while Google Reviews showed a `FREE` badge
and an **Upgrade** call to action. Two apps, two independent plan states, one
account.

Each app header displays its own meters:

```text
WIDGETS  1 / 1        VIEWS  0 / 200        RESETS ON AUG 25
```

### 3.2 Per-app pricing

**Verified.** Annual billing, sale pricing shown with list price struck through.

| | Free | Basic | Pro | Premium |
| --- | --- | --- | --- | --- |
| Price / mo | $0 | $4 (list $6) | $8 (list $12) | $16 (list $24) |
| Positioning | "Good for testing purposes" | "Best for low-traffic websites" | "Best for growing businesses" | "Best for high-traffic websites" |
| Websites | Unlimited | Unlimited | Unlimited | Unlimited |
| Views / mo | 200 | 5,000 | 50,000 | 150,000 |
| Widgets | 1 | 3 | 9 | 21 |
| Projects | — | — | 3 | 9 |
| Collaborators | — | — | 1 | 3 |
| Widget sharing | — | — | — | ✓ |
| Advanced customizations | — | ✓ | ✓ | ✓ |
| Free installation service | — | ✓ | ✓ | ✓ |
| Support | Only bug fixes | Basic | Priority | Priority + live chat |
| Branding | Elfsight branding | 100% Ad Free | 100% Ad Free | 100% Ad Free |

A right-arrow control indicates "Plans with higher limits are available" beyond
Premium. Those tiers were not opened.

### 3.3 Bundle pricing

**Verified.** The "95 Apps Pack" is priced at exactly 3× the single-app tier,
with per-app limits preserved across the whole catalog.

| | Basic | Pro | Premium |
| --- | --- | --- | --- |
| Price / mo | $12 (list $18) | $24 (list $36) | $48 (list $72) |
| Scope | All 95 apps + upcoming apps | All 95 apps + upcoming apps | All 95 apps + upcoming apps |
| Views / mo | 5,000 **per app** | 50,000 **per app** | 150,000 **per app** |
| Widgets | 3 **per app** | 9 **per app** | 21 **per app** |
| Projects | — | 3 | 9 |
| Collaborators | — | 1 | 3 |
| Widget sharing | — | — | ✓ |

Bundle marketing copy explicitly targets agencies: "Perfect for agencies —
enhance your clients' websites more effectively with All Apps Pack" and "One
subscription for all apps — an easy and must-grab deal that saves you $1000s."

### 3.4 Where the paywall sits

**Verified.** Two separate paths were tested and both terminate at the same
gate.

Clicking **Install** on a saved widget in an app with no plan opens
"Pick a plan to install the widget" rather than an embed code.

Clicking **Publish** inside the editor shows a success toast reading
"Changes were published." and then immediately redirects to the same pricing
screen. The redirect URL is explicit about what is happening:

```text
/pricing/single?redirectURL=%2Fapps%2Ffaq%2F%3FinstallationWidgetPid%3D{widgetUuid}&headerCloseURL=%2Fapps%2Ffaq
```

The paywall is interposed *inside* the install flow, carrying the widget id
forward so installation resumes after payment.

Once an app has any plan selected — including Free — **Install** opens the real
embed dialog. Google Reviews, on the Free plan, produced working embed code
immediately.

**Implication.** The gate is not signup, not creation, not save, not publish.
It is the transition from "I made a thing" to "the thing exists on my site."
The entire creation experience is given away, and the ask arrives at peak sunk
cost. This is well-constructed conversion design.

### 3.5 Free tier as trial counter

**Verified.** Free provides 200 views per month, 1 widget, Elfsight branding,
and "Only bug fixes" support, with Projects, Collaborators, Widget sharing,
Advanced customizations, and Free installation service all struck through.

200 monthly views is not a small product allowance; it is a demonstration
counter. Note also that **Advanced customizations** is itself withheld on Free,
so the free control surface is narrower than section 4 documents.

### 3.6 Direct comparison to the Clickeen entitlements matrix

Clickeen values from `packages/ck-policy/entitlements.matrix.json`.

| Dimension | Elfsight Free | Elfsight Basic $4 | Elfsight Pro $8 | Elfsight Premium $16 | CK free | CK tier1 | CK tier2 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Views / mo | 200 | 5,000 | 50,000 | 150,000 | 10,000 | 100,000 | unlimited |
| Widget instances | 1 | 3 | 9 | 21 | 3 | 10 | 25 |
| Published instances | n/a | n/a | n/a | n/a | 1 | 1 | 5 |
| Branding removal | no | yes | yes | yes | no | yes | yes |
| Locales | none | none | none | none | 0 | 3 | 28 |
| Scope | per app | per app | per app | per app | account-wide | account-wide | account-wide |

Three observations:

- **Clickeen's free tier is more generous on views than Elfsight's $4 paid
  tier** — 10,000 versus 5,000 — and matches it on instance count.
- Clickeen tier1 (100,000 views, 10 instances, account-wide) sits between
  Elfsight Pro and Premium *for a single app*, and Clickeen's applies across all
  widget types at once.
- Elfsight has no locale dimension at any price. Clickeen's `l10n.locales.max`
  has no competitor equivalent.

This is worth a deliberate decision rather than drift. Clickeen currently gives
away more than Elfsight sells, across every axis except catalog breadth.

## 4. The Editor

### 4.1 Shape

**Verified.** The editor is structurally near-identical to Bob:

```text
[icon rail] [panel]  |  [live preview]
```

- Top bar: editable widget title on the left; **Publish** (green) and **Close**
  on the right.
- Left icon rail, four sections: Content, Layout, Appearance, Settings. A Help
  affordance sits at the bottom of the rail.
- Second column: the panel for the selected rail section.
- Remaining width: live preview with a device toggle in its top-right corner.

The convergent design is worth noting on its own. Two independent teams arrived
at rail + panel + live preview for the same problem.

### 4.2 Complete control inventory — FAQ app

**Verified.** This is the entire authoring surface, exhaustively.

**Content**

- `Display Category Titles` — toggle
- `QUESTION CATEGORIES` — list of categories, each with an overflow menu
- `+ Add Category`
- `Widget Title` — text field

**Layout**

- `Layout` — three visual preset tiles: Accordion, List, Multicolumn
- `Accordion Icon` — segmented control: Plus / Arrow
- `Open First Question by Default` — toggle
- `Multiple Active Questions` — toggle
- `Show Search Bar` — toggle

**Appearance**

- `Template` — dropdown (observed value: "Background & Border")
- `Item Background Color` — color swatch
- `Question Text Color` — color swatch
- `Answer Text Color` — color swatch
- `Custom CSS` — disclosure to a code editor

**Settings**

- `Display Videos` — toggle, helper text "Transform YouTube and Vimeo links to
  Videos."
- `Display Images` — toggle, helper text "Transform image links to images."
- `Custom JS` — disclosure to a code editor

Total: approximately fifteen controls, two of which are raw code escape hatches.

### 4.3 What is absent

**Verified by exhaustive inspection of all four panels:**

- **No typography controls of any kind.** No font family, size, weight, style,
  line height, or letter spacing. Compare `tokyo/product/widgets/faq/spec.json`,
  which carries a full typography role system — family, weight, fontStyle,
  sizePreset and sizeCustom, trackingPreset and trackingCustom,
  lineHeightPreset and lineHeightCustom, plus structured color — independently
  for `question`, `answer`, and `section` roles.
- **No spacing, sizing, or layout geometry controls** beyond the three preset
  tiles.
- **No localization or translation surface.** Nothing anywhere in the editor.
- **No AI or copilot surface in the builder.** Their AI is packaged as separate
  products (AI Chatbot) or as data processing inside integration apps, never as
  an operator inside authoring.

### 4.4 The Custom CSS / Custom JS pattern

Two of four editor sections terminate in a code box. This is the architectural
opposite of Clickeen's approach and deserves explicit framing for the team.

Elfsight's design system boundary is: offer a small number of high-level
choices, then hand the user raw CSS and JS when those run out. It is cheap to
build, infinitely flexible, requires no token system, and scales to 95 apps
without a shared design language.

The cost is output quality and consistency. Every non-default Elfsight widget
in the wild is styled by a customer-written stylesheet with no contract, which
is why they render inconsistently across the web and why "Advanced
customizations" can be sold as a tier feature.

Clickeen's position — tokenized controls, materialized CSS, no customer CSS —
is the more expensive build and the differentiating one. Section 4.3's
typography gap is the concrete proof point to use when articulating it.

## 5. Serving Architecture

This is the most consequential section for Clickeen.

### 5.1 The embed contract

**Verified.** Read directly out of the Install dialog for a Google Reviews
widget on an active plan:

```html
<!-- Elfsight Google Reviews | Untitled widget -->
<script src="https://elfsightcdn.com/platform.js" async></script>
<div class="elfsight-app-f6a5c3e5-fe8f-41f0-9a76-a475b1f02ec5" data-elfsight-app-lazy></div>
```

Four properties, all significant:

1. **One shared `platform.js`** on a dedicated CDN host, `elfsightcdn.com`. Not
   per-app and not per-widget. One script serving all 95 apps and all customers.
2. **The content container is empty.** The served HTML contains no widget
   content, no configuration, and no data.
3. **The widget identity is a class name.** `elfsight-app-{uuid}`. The markup
   carries no config, so the embed snippet never has to change and everything
   about rendering can move server-side without asking customers to re-paste.
4. **`data-elfsight-app-lazy`.** Rendering is deferred until the container
   scrolls into the viewport.

### 5.2 Bundle and release structure

**Verified.** The editor preview loads in an iframe pointed at:

```text
static.elfsight.com/apps/faq/stable/aec61379e733c2dcdfc3439d4b385c130ddc6633/configurator/index.html?language=mr
```

That single URL reveals the release model:

- **Per-app-type namespace** — `/apps/faq/`
- **Release channel** — `stable`
- **Content-addressed build** — a 40-character hash
- **The editor UI ships inside the app bundle** — `configurator/index.html`
- **The configurator is localized** — a `language` query parameter

The last two matter for how they scale. Each app is a self-contained,
independently versioned artifact that carries both its runtime and its own
editor surface. The dashboard is a shell that mounts them. This is how 95 apps
coexist without 95 codebases in one application.

### 5.3 Runtime behavior

**Inferred**, from the embed contract plus the commercial model. Not observed
directly.

Because `platform.js` is shared across all customers and the container carries
only a uuid, the runtime must resolve per-instance configuration and content at
request time. The sequence is necessarily: load shared script → scan DOM for
`elfsight-app-*` classes → extract uuid → fetch configuration and, for
integration apps, the underlying data → render client-side → and with the lazy
attribute, only once scrolled into view.

Separately, the enforced view meter (200 / 5,000 / 50,000 / 150,000 per app per
month, with a visible reset date) cannot be implemented against static files.
Some call home occurs per render.

### 5.4 SEO, GEO, and AEO consequence

This is the finding to carry into the SEO/GEO/AEO planning PRD.

A crawler that does not execute JavaScript receives, for an Elfsight widget, an
empty `div` and a script tag. No questions, no answers, no reviews, no ratings,
no text of any kind.

A crawler that *does* execute JavaScript still faces `data-elfsight-app-lazy`,
which defers rendering until the container enters the viewport. Crawlers do not
scroll.

Most LLM and answer-engine fetchers retrieve raw HTML without executing
JavaScript. To those systems an Elfsight FAQ or reviews widget is not
low-ranked — it is absent.

Clickeen's materialized `index.html` contains the actual content as text in the
initial response. For widget types whose entire purpose is answering questions —
FAQ, reviews — this is the difference between feeding answer engines and being
invisible to them.

`embed.seoGeo.enabled` already exists in the shipped Clickeen entitlements
matrix at tier2 and above. This research indicates the flag points at something
structurally real and structurally unavailable to the incumbent.

### 5.5 Honest counterweight — where their model is better

Their single shared `platform.js` is cached once per CDN edge location and
reused by every Elfsight customer worldwide. A visitor who encountered any
Elfsight widget on any site arrives at the next site with a warm browser cache.

Clickeen's per-instance artifacts never share a cache entry. Ten thousand
instances are ten thousand independently cold objects.

Two mitigations, and one real cost:

- Clickeen artifacts are small and immutable, so a cold fetch is one round trip
  to a nearby edge with an unbounded TTL.
- Compare what each request buys. Theirs returns machinery that must then fetch
  content. Clickeen's returns the content. Even against a warm cache, Clickeen
  should reach meaningful paint in fewer round trips.
- **The real cost is fleet updates.** Elfsight ships a new hash, flips `stable`,
  and every widget on the internet updates. Clickeen must re-materialize each
  affected instance. Their architecture gets fleet-wide fixes for free;
  Clickeen's requires an operation that does not currently exist. This is a
  genuine structural liability of the materialized model and should be priced
  as such rather than dismissed.

### 5.6 View metering asymmetry

Elfsight's meter is free with their architecture — the embed already calls home.

Clickeen's `views.monthly.max` exists in the shipped matrix, but static file
serving from R2 yields edge request logs rather than per-account counters. A
counting mechanism is unbuilt. This is one place where the incumbent's weaker
architecture hands them something Clickeen has to construct deliberately.

## 6. Catalog And Product Surface

**Verified.**

Browse axes: AI-Powered, Best Sellers, Trending, New Apps, App Wishlist.

Categories: Social, Reviews, E-Commerce, Chats, Forms, Video, Audio, Tools,
Files.

Best-sellers observed on the catalog landing view:

| App | Tags | Content source |
| --- | --- | --- |
| Google Reviews | BEST SELLER, Powered by AI | Integration |
| Instagram Feed | BEST SELLER | Integration |
| LinkedIn Feed | BEST SELLER | Integration |
| All-in-One Reviews | BEST SELLER, Powered by AI | Integration (Google, FB, Amazon, Yelp, 20+) |
| WhatsApp Chat | — | Integration |
| AI Chatbot | BEST SELLER, Powered by AI | AI-generated |
| Event Calendar | BEST SELLER | Authored |
| Calculator | BEST SELLER, Powered by AI | Authored |
| Countdown Timer | BEST SELLER | Authored |

**The pattern to note.** Roughly half the visible best-sellers are
integration-sourced — they render live data pulled from another system.
Clickeen's current widget set (FAQ, countdown, cards, CTA, logo showcase,
split-media, big-bang) is entirely authored-content.

Authored content is the *lowest* switching-cost category. The content lives in
the customer's head and can be retyped into any competitor in an afternoon. An
integration-sourced widget is different: once a business's live Google reviews
flow through a provider, leaving means losing the connection and re-authorizing
elsewhere.

Clickeen's CONTEXT.md already names integration-sourced content as one of three
content authorities, with the rule that agents preserve source truth and mutate
only through an explicit integration write path. The authority is designed. No
integration widget exists.

## 7. Distribution And Installation

**Verified.** The Install dialog carries three tabs:

- **Embed Code** — the snippet in 5.1
- **Share Link** — a hosted destination for the widget; note that "Widget
  sharing" is a Premium-tier entitlement
- **Request Installation** — a human installation service, offered free from
  Basic upward

Below the snippet, a searchable **Platform Tutorials** directory covering 24
platforms:

```text
Shopify      Wix           WordPress
Squarespace  BigCommerce   Blogger
OpenCart     Big Cartel    Joomla
Webflow      GoDaddy       Google Sites
Lightspeed   Jumpseller    Webnode
Drupal       Duda          Jimdo
Weebly       Ecwid         Canva
Notion       Prestashop    iFrame
```

This is not support content. It is two things at once: an indexed landing
surface per platform, and a friction remover placed at the exact moment a
non-technical user is most likely to abandon. The dashboard also surfaces
"Installation Tutorials" and "Request Installation Help" directly beneath the
widget list.

Clickeen currently offers no equivalent installation guidance surface.

## 8. Scorecard

### Where Elfsight is ahead

| Area | Detail |
| --- | --- |
| Catalog breadth | 95 apps versus 8 widget types |
| Acquisition surface | Each app is an independent funnel, SEO surface, and landing page |
| Integration widgets | Roughly half of best-sellers; highest retention category; Clickeen has none |
| Fleet updates | New hash, flip `stable`, everything updates — free with their architecture |
| Shared cache | One `platform.js` warm across the entire web |
| Agency features | Projects, collaborators, widget sharing |
| Installation support | 24 platform guides plus a human installation service |
| Trust | 14 years, 3M+ users, 4.9 rating |
| Monetization discipline | Paywall precisely placed at peak sunk cost |

### Where Clickeen is ahead

| Area | Detail |
| --- | --- |
| Crawlable output | Content in initial HTML; theirs is an empty div, lazy-loaded |
| Answer-engine visibility | Structural, and not closable by them without rebuilding serving |
| Design depth | Full per-role typography system versus three color swatches |
| Output consistency | Tokenized and materialized versus customer-authored CSS |
| Localization | Overlay model with 28-locale ceiling versus no locale dimension at any price |
| Free tier value | 10,000 views versus 200; more generous than their $4 tier |
| Time to live | Publish produces a working URL with no wall |
| Runtime independence | Served bytes with no dependency on a platform script |
| Agent architecture | Governed model execution and agent homes; they have none |

## 9. Open Questions For The Team

Framed as questions, not recommendations. None of these are decisions this
document is authorized to make.

1. **Is Clickeen's free tier deliberate?** It currently exceeds Elfsight's $4
   paid tier on views and matches it on instances. Either it is a considered
   acquisition weapon or it is unpriced generosity.

2. **Where should Clickeen's pressure point be?** Elfsight monetizes existence.
   Clickeen has no equivalent moment. `instances.published.max` of 1 on both
   free and tier1 may be the intended analogue — worth confirming it is
   intentional, since free and tier1 are identical on that axis.

3. **Does the integration-sourced gap need closing, and when?** It is the
   retention category and the authority is already specified in CONTEXT.md.

4. **How are views counted?** The entitlement ships; the mechanism does not
   exist. Elfsight gets this free from an architecture Clickeen has rejected for
   good reasons.

5. **Does the SEO/GEO/AEO advantage get stated publicly?** It is real,
   verifiable, and currently invisible to the market. It is also the one thing
   the incumbent cannot answer quickly.

6. **Is an installation guidance surface worth building?** Their 24-platform
   directory is cheap content that removes the highest-abandonment moment in
   the funnel.

## 10. What This Document Does Not Establish

- Any measurement of `platform.js` size, parse cost, or request waterfall. It
  was never fetched.
- Any claim about paid-tier behavior beyond published plan copy.
- Any claim about their server APIs, data pipelines, or infrastructure beyond
  what the CDN URL structure exposes.
- Any competitor comparison beyond Elfsight.
- Any Clickeen scope, sequencing, or roadmap position.

## 11. Reproduction

The dashboard requires an authenticated Elfsight account. With one:

1. `dash.elfsight.com/apps/{app}` — per-app dashboard, meters, plan badge.
2. Click **Edit** on a widget — editor, four rail sections.
3. Inspect the preview iframe `src` for the app bundle path, channel, and hash.
4. Click **Install** on an app with any plan selected — embed code dialog.
5. Click **Install** on an app with no plan — pricing wall.
6. `dash.elfsight.com/apps/{app}/pricing/single` and `/pricing/packs` — pricing.
7. `dash.elfsight.com/catalog` — full catalog and category axes.
