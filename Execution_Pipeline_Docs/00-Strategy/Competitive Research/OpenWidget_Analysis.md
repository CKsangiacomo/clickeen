# OpenWidget — Competitive Research & Analysis

Status: **RESEARCH**

Date: 2026-08-05

Source: openwidget.com, app.openwidget.com, public reviews (G2, Capterra,
GetApp, Product Hunt), and technical inspection of their embed snippet and
widget catalog.

## TL;DR

OpenWidget is a **free embeddable widget launcher** from LiveChat, Inc. It is
not a content platform, not a site builder, and not a composed-surface product.
It is a top-of-funnel lead-gen tool for LiveChat's paid chat product, shipped as
one snippet that renders a floating button → gallery → micro-apps. Its
architecture is the **classic Elfsight/loader pattern** (shell stub + lazy
bundle + runtime JSON fetch + browser-rendered DOM) — exactly the pattern
Clickeen's three-file law exists to reject for its own public artifacts.

OpenWidget and Clickeen are not building the same product. The useful lessons
are in product packaging and AI placement, not in architecture.

---

## 1. What OpenWidget is

### Product

A **free website widget plugin** developed by LiveChat, Inc. (the company
behind the paid LiveChat platform, starting at $24/mo). OpenWidget provides
no-code widgets that can be added to any website via a single embed snippet to
improve engagement, increase sales, and drive customer contact.

### Catalog (14 widgets)

1. **Contact Form** — form submissions forwarded to email
2. **FAQ Template** — up to 10 Q&A pairs
3. **Product Cards** — up to 6 product showcases
4. **Product Recommendations** — AI-powered, real-time on-page inference
5. **ChatGPT Widget** — generic ChatGPT surface
6. **WhatsApp Chat** — click-to-chat
7. **Facebook Messenger** — Messenger plugin alternative
8. **Google Reviews** — pulls from connected Google Business Profile
9. **Chat Interface for OpenAI Assistants** — bring-your-own OpenAI Assistant
10. **Custom Links** — link directory
11. **Visitor Counter** — social-proof counter
12. **Bug Report Form** — issue reporting form
13. **Feedback Form** — survey/feedback collector
14. **Create Your Own** — JSON manifest + iframe app gallery

### Business model

**100% free.** No paid tier, no subscription. Monetization is upstream:
OpenWidget integrates tightly with LiveChat's paid product, so a free user who
wants real live chat upgrades. OpenWidget is the marketing funnel.

### Target customer

Non-technical small-business owners running Shopify, WordPress, BigCommerce,
WooCommerce, OpenCart, Squarespace. The whole product is scoped for "I have a
store and I don't code."

---

## 2. The embed — technical analysis

The public artifact is a 1.5KB stub + lazy-loaded CDN bundle + runtime config
fetch + browser-rendered DOM. Here is the architecture in detail:

### The snippet (verbatim, annotated)

```html
<!-- Start of OpenWidget (www.openwidget.com) code -->
<script>
  // 1. Bootstrap config block — sets org ID and integration metadata on a global
  window.__ow = window.__ow || {};
  window.__ow.organizationId = "796f37a6-6d91-47b5-80e7-df377e47f6f5";
  window.__ow.integration_name = "manual_settings";
  window.__ow.product_name = "openwidget";

  // 2. Loader + queue-based event API stub
  ;(function(n,t,c){
    function i(n){return e._h?e._h.apply(null,n):e._q.push(n)}
    var e={
      _q:[],            // command queue (replayed after load)
      _h:null,          // command handler (set when bundle arrives)
      _v:"2.0",
      on:function(){i(["on",c.call(arguments)])},
      once:function(){i(["once",c.call(arguments)])},
      off:function(){i(["off",c.call(arguments)])},
      get:function(){...i(["get",c.call(arguments)])},
      call:function(){i(["call",c.call(arguments)])},
      init:function(){
        // 3. Lazy-load the real application
        var n=t.createElement("script");
        n.async=!0;
        n.type="text/javascript";
        n.src="https://cdn.openwidget.com/openwidget.js";
        t.head.appendChild(n)
      }
    };
    !n.__ow.asyncInit && e.init();
    n.OpenWidget = n.OpenWidget || e
  }(window, document, [].slice))
</script>
<noscript>
  You need to <a href="...">enable JavaScript</a> to use the communication tool
  powered by <a href="...">OpenWidget</a>
</noscript>
<!-- End of OpenWidget code -->
```

### What it does, step by step

1. **Bootstrap config.** Sets `organizationId`, `integration_name`, `product_name` on `window.__ow`. Nothing renders.
2. **Defines a public event API before the real script loads.** `OpenWidget.on()`, `.once()`, `.off()`, `.get()`, `.call()` are all available immediately. The host page can wire up handlers before `openwidget.js` arrives.
3. **Queues every call into `_q` until the real handler `_h` is ready.** Until the main script loads, every method call pushes onto `_q`. When `openwidget.js` arrives, it sets `_h` to the real implementation and replays the queue. This is the standard snippet-before-load pattern (Segment, Intercom, GA all do it).
4. **Lazy-loads the actual application.** `init()` injects `<script src="https://cdn.openwidget.com/openwidget.js">` asynchronously. None of the widget UI, content, or behavior is in the snippet.
5. **`<noscript>` fallback.** A crawler, answer engine, or no-JS visitor sees only the noscript link — no contact form, no FAQ content, no product cards, no reviews.

### What the snippet does NOT do

- It does not render any widget content.
- It does not contain any customer-authored text (FAQ answers, product titles, review text).
- It does not produce any crawlable HTML.
- It does not work without JavaScript.

The widget's entire DOM is constructed client-side by `openwidget.js` after it loads, reads the org config from OpenWidget's servers, and renders into the host page.

### Architecture classification

This is the **Elfsight/loader pattern** in pure form:
- empty/partial HTML shell
- + state payload (fetched at runtime from OpenWidget servers)
- + browser renderer (openwidget.js)
- → visible widget

Clickeen's three-file law (127B) is the explicit rejection of this pattern for
Clickeen's own public artifacts: the saved HTML must carry the customer's
content before any JS runs, so crawlers and answer engines see it, and so the
saved file is the source of truth rather than a shell.

### Why the architecture fits OpenWidget's use case (and not Clickeen's)

OpenWidget is a **floating launcher overlay** on someone else's website. They
are not the content surface; they are an app on top of one. The loader pattern
is defensible for that job: the widget is interactive, session-scoped, and not
meant to be crawled as primary content.

Clickeen's thesis is the opposite: the widget/page IS the content surface. The
saved HTML must carry the customer's content before any JS runs. The contrast
is the whole point of 127B.

---

## 3. What OpenWidget does well

### 3.1 Distribution-first product design

The entire product is engineered around the embed. One snippet, one org ID,
paste anywhere, done. The snippet is a mature queue-based loader that exposes
an event API immediately. Result: **"5 minutes from signup to live widget"** is
a real, defensible claim.

### 3.2 The launcher→gallery model

They don't ship 14 separate embeds. They ship ONE embed that renders a launcher
button → gallery → full-screen app. Adding a 15th widget is a config toggle,
not another snippet. The "Create Your Own" widget extends this with a JSON
manifest + iframe. The whole thing is a micro-app platform wearing a widget
costume.

### 3.3 AI placement inside authoring (not beside it)

Their AI touches are well-chosen for their audience:
- **FAQ widget**: auto-generates answers from a question + keywords.
- **Product Cards**: AI description rewriter.
- **Product Recommendations**: real-time on-page inference against the visitor's
  browsing pattern, using an OpenAI-backed model the customer never configures.

The lesson: **AI as a content-accelerator inside an authoring surface is a
better wedge than AI as a chatbot.** They didn't build "an AI widget" — they
put AI inside every widget where it removes work.

### 3.4 They understood the audience's ceiling

The whole product is scoped for "I have a Shopify store and I don't code." No
CSS editor, no theme system, no layout grid, no per-widget styling beyond
avatar/name/welcome message. The customization ceiling is deliberately low —
and correct for who they serve. They sell speed-to-live, not authoring power.

### 3.5 The funnel is honest and built-in

Free → embed → want real live chat → upgrade to LiveChat paid. The integration
with LiveChat is the business model; OpenWidget is the top-of-funnel loss
leader. They don't pretend the free tier is the business.

---

## 4. What OpenWidget does badly

### 4.1 The architecture IS the Elfsight disease

Crawler sees `<noscript>`. Customer sees nothing until `openwidget.js` loads,
fetches org config, and browser-renders the entire DOM. Every piece of customer
content — FAQ answers, product card titles, review text — is runtime-fetched
JSON injected by their JS.

For their use case (floating launcher on someone else's site) it's defensible.
For a content surface it would be fatal — which is why they're not trying to be
a content surface.

### 4.2 Shallow by design

- FAQ is capped at 10 questions.
- Product Cards at 6.
- No categories, no search, no rich text.
- No composition, no pages, no public artifact.
- The "Create Your Own" app is an iframe pointed at a URL.

The widgets are single-purpose micro-apps, not composable. There's no notion of
authoring once and composing into many surfaces. This is the opposite of the
schema-first thesis.

### 4.3 Customization is near-zero

No colors, fonts, or positioning control (per the widget pages). You get
avatar/name/welcome-message and that's it. There's no Dieter-equivalent — no
design system the widgets inherit from. They look like OpenWidget on every
site, which is fine for free but caps the ceiling at "I'll use it until I can
afford something branded."

### 4.4 No composition, no pages, no public artifact

A "page" isn't even a concept in their model. They're an overlay layer. The
"Create Your Own" app is an iframe pointed at your URL — there's no composition
of widgets into a single document, no generated artifact, nothing crawlable as
a standalone surface.

### 4.5 No agent-operability

There's no substrate for agents to operate. The dashboard is a human
form-filling UI; the AI is a button-click generator, not an operator. This is a
human-operated SaaS with AI features — the exact thing Clickeen's moat rejects.

---

## 5. Lessons for Clickeen (without imitating)

These are the lessons worth stealing, translated into Clickeen's frame. None of
them require copying OpenWidget's architecture.

### 5.1 The embed/install story should be invisible-simple

OpenWidget's "one snippet, paste anywhere" is the bar for the public artifact.
Clickeen's `clk.live/{accountPublicId}/{instanceId}` URL + iframe/script
snippet is already this — but the lesson is that *the copy/install step should
never be a friction surface*. Roma's "Copy code" popup already gets this right.

**Action:** keep the install story at one URL + one snippet. Never let it grow
into a multi-step integration.

### 5.2 AI belongs inside authoring, not beside it

Their best moves are the AI features embedded in the authoring surface (FAQ
answer generation, product description rewriting). Clickeen's equivalent:
Product Copilot authoring Page/Instance content and the Translation Agent
authoring overlays are the right instinct.

**Action:** make AI the *default way to remove authoring work*, not a separate
"AI widget" surface. Product Copilot and Translation Agent are the right homes.

### 5.3 The launcher→gallery model is a packaging insight, not an architecture to copy

They ship one embed that opens many apps. Clickeen ships one URL shape that
serves many widget types. The structural lesson is the same: **don't make the
customer install N things for N widgets; make one coordinate surface N
products.**

**Action:** Clickeen's account-owned instance coordinate + Page placement model
is already the better version of this. Don't fragment the coordinate.

### 5.4 Don't ship features that need a design system you don't have

OpenWidget avoids this by having almost no customization. Clickeen avoids it by
HAVING Dieter.

**Action:** the reason Clickeen CAN offer deep customization and OpenWidget
can't is Dieter. Protect Dieter. Don't ship a widget that lets the user pick
arbitrary fonts/colors outside the token system.

### 5.5 Their "Create Your Own widget" is a real extensibility seam (note for future)

JSON manifest + iframe is a real developer surface. Clickeen doesn't have an
equivalent today, and shouldn't build one as part of 127 — but the *concept* (a
typed manifest that registers an external app into the surface) is worth noting
for the future. The Clickeen version would be schema-first and agent-operable,
not an iframe registry.

**Action:** not now. Note for future.

### 5.6 Their SEO claim is aspirational; Clickeen's is structural

They say widgets "increase engagement" but the embed contributes nothing to the
host page's crawlable content. Clickeen's three-file law is the actual delivery
of the SEO promise — the saved HTML IS the crawlable content.

**Action:** this is the competitive wedge. Clickeen has it structurally;
OpenWidget cannot have it without rebuilding from zero.

---

## 6. How Clickeen and OpenWidget compare (structural)

| Dimension | OpenWidget | Clickeen |
| --- | --- | --- |
| **What it is** | Floating launcher overlay | Composed content surface |
| **Public artifact** | Shell stub + lazy bundle + runtime JSON fetch | Saved complete HTML + CSS + JS (three-file law) |
| **Crawlable content** | None (JS-rendered; `<noscript>` only) | Complete semantic HTML before JS runs |
| **Composition** | None (one launcher → N micro-apps) | Pages = ordered stacks of saved instances |
| **Customization** | Avatar/name/welcome only | Full Dieter token system + widget controls |
| **AI** | Button-click content generation (FAQ answers, descriptions) | Agent-operated authoring (Product Copilot, Translation Agent) |
| **Operability** | Human form-filling dashboard | Agent-operated substrate |
| **Business model** | Free → lead-gen into LiveChat paid | Tiered SaaS with entitlements |
| **Target customer** | Non-technical Shopify/WP store owner | Businesses building content surfaces with agents |
| **Architecture thesis** | Distribution-first (fast embed, shallow) | Source-truth-first (saved artifact is the product) |

---

## 7. The honest conclusion

OpenWidget is a **distribution and lead-gen play, not a content-platform play.**
LiveChat ships it free, makes it embed-anywhere, and uses it to push users
toward paid LiveChat seats. The widget catalog is broad and shallow — most
widgets are single-purpose micro-apps. There's no notion of a Page, no
composition of widgets into a single document, no public artifact that stands
alone without their CDN.

It is not a direct competitor to Clickeen Pages in the architectural sense —
it's a launcher, not a composed content surface. But it is a competitor for the
customer's attention and embed real estate, and its free + easy + 14-widget
breadth is the kind of distribution moat that's hard to out-feature.

Clickeen's answer to it is the opposite trade: fewer surfaces, deeper
composition, saved-as-product truth, agent-operated. The two are betting on
different definitions of what a "widget" is for.

### What to take from them

1. **Speed-to-live as a product value.** "5 minutes" is a real promise Clickeen should be able to make for the first-widget experience, even though the substrate is more powerful.
2. **AI inside the authoring surface as the default content-accelerator**, not as a bolt-on chat feature.

### What NOT to take from them

- The loader architecture (shell + JSON + browser renderer) — rejected by 127B.
- The shallow customization ceiling — Clickeen has Dieter.
- The iframe app gallery — not now; future extensibility, schema-first if ever.
- The "free as lead-gen" model — Clickeen is tiered SaaS.

---

---

## 8. Company scale and revenue estimation

OpenWidget is a free product by **LiveChat, Inc.** (now rebranded as "Text"),
a publicly traded company on the Warsaw Stock Exchange (ticker: TXT).
OpenWidget's scale is embedded in LiveChat's financials — it is a free
top-of-funnel product, not a standalone revenue line.

### Claimed scale

- No specific OpenWidget install/user count is publicly disclosed.
- LiveChat has historically reported ~33,000 paying customers for its paid
  products (press/company statements). OpenWidget's user base is presumably
  larger (free product) but unquantified.

### Employee count (LinkedIn profile search)

The LinkedIn company page says "201-500." That is a self-reported dropdown
range — do NOT cite it as fact.

**LinkedIn profile search results** for LiveChat/Text employees mentioning
OpenWidget or based in Wrocław:
- Joanna Rekosiewicz — People Partner (worked with LiveChat, ChatBot,
  HelpDesk, Open Widget products; trainer for Devs, QAs, Designers, Product)
- Bartek Kubiak — Software Engineer at LiveChat (Wrocław)
- Szymon Klimczak — associated with livechat.com, chatbot.com, helpdesk.com
  (Wrocław)
- Maciej Malesa — VP of Technical Operations at Text

**Visible profiles referencing OpenWidget specifically: 1** (Rekosiewicz).
This is expected — OpenWidget is one product within a larger portfolio, so
most employees don't mention it specifically.

For the **parent company** (Text/LiveChat), profile search surfaces many more
people across the Wrocław office. The LinkedIn company page range (201-500)
is more credible here than for Elfsight or Common Ninja, because:
1. Text is a public company with verified headcount in annual reports.
2. The Wrocław tech scene has high LinkedIn penetration (~60-70%).
3. Multiple senior profiles (VP, directors, team leads) are visible.

**Best estimate: ~300-450 employees** for the whole company (LiveChat,
ChatBot, HelpDesk, KnowledgeBase, OpenWidget). OpenWidget specifically is
likely a **small dedicated team (5-15 people)** within the larger company,
not a separate division.

- **Headquarters:** Wrocław, Poland. US office in Boston/Nashua.
- **Founded:** 2002 (as LiveChat). OpenWidget launched November 2022.
- **Funding:** Bootstrapped — no outside funding. Public company since Warsaw
  Stock Exchange listing.

### Revenue (LiveChat / Text — parent company)

OpenWidget generates no direct revenue (it is free). Parent company revenue:
- **2023 TTM revenue:** ~$75.9M (CompaniesMarketCap — sourced from public
  Warsaw Stock Exchange filings; this is verified financial data, not a
  third-party estimate).
- **Revenue model:** Per-seat subscription for LiveChat ($192/year+ starting
  price). OpenWidget is the free funnel.

### Install verification

- **BuiltWith** reportedly tracks OpenWidget installations by country but data
  is behind a paywall.
- **CDN signature** (`cdn.openwidget.com`, `window.__ow`) found on a small
  number of sites via web search (debeatzgh.wordpress.com, estyn.gov.wales).
- **No app store presence** — OpenWidget is embedded via custom HTML, not
  distributed through Shopify/WordPress app stores.
- The third-party-web domain map lists `cdn.openwidget.com` as a recognized
  third-party domain, confirming non-trivial distribution.

### OpenWidget's strategic role

OpenWidget is not a revenue product. It is a **customer acquisition tool** for
LiveChat's paid ecosystem. Its success metric is not ARR but funnel: how many
free OpenWidget users upgrade to LiveChat paid seats. This means:
- OpenWidget will stay free indefinitely.
- Its feature roadmap serves the funnel (engagement widgets that demonstrate the
  value of LiveChat's communication tools), not standalone monetization.
- It does not need to be profitable on its own — it needs to generate leads
  cheaper than paid acquisition channels.

---

## 9. Localization and locale model

OpenWidget has **no meaningful localization model.** It does not appear in the
widget catalog, feature list, or pricing page. The product appears to be
English-only with no translation or locale-switching capability.

- **No baseLocale concept.** No source-language/translated-language distinction.
- **No overlays.** No locale-specific value maps.
- **No translation agent or AI translator.** The AI features (FAQ answer
  generation, product description rewriting) generate content in the language the
  user writes, not translated variants.
- **No locale-specific formatting.** No date/time/number format matching, no RTL
  support documented.
- **No tier-gating for localization** because there is no localization to gate.

**Compared to Clickeen:** OpenWidget has no localization at all. Clickeen's
baseLocale + exact overlays + Babel protocol + Translation Agent is a structural
advantage that is not even a competitive axis here — OpenWidget simply does not
play.

---

## 10. Customer voice

### Reviews summary

| Platform | Score | Review count |
| --- | --- | --- |
| Capterra / Software Advice | ~4.3/5 | ~711 aggregate ratings |
| G2 | Listed | Small number |
| Trustpilot | ~4/5 | Listed |
| Product Hunt | Listed | Listed |

### Top praises (what customers love)

1. **Free and easy to set up.** "Very simple to set up and use." (G2) "Free,
   no-code widget that's easy to install on most websites." (Capterra) The free
   tier with zero credit card requirement is the primary acquisition hook.
2. **Good functionality for free.** Functionality scores 4.28/5 on Capterra —
   the strongest sub-score. Users value the Contact Form, FAQ Module, Google
   Reviews, and AI Product Recommendations as genuinely useful free tools.
3. **Useful for customer support enhancement.** "Helps provide great customer
   support inside your web application." (G2) The widgets fill real gaps for
   small businesses that can't afford paid support tools.

### Top complaints (what customers dislike)

1. **Interface feels dated.** "Interface feels somewhat dated compared to newer
   SaaS tools." (Capterra) The design is functional but not modern.
2. **Limited advanced features and customization.** No CSS access, no color
   control, no positioning. "Advanced features are limited." (Capterra) The
   customization ceiling is very low.
3. **Account-related friction.** "Some users report account-related issues."
   (Product Hunt) Login/account management problems reported by a subset of
   users.
4. **Lower ease-of-use than expected.** Capterra ease-of-use scores 3.82/5 —
   surprisingly low for a "simple" tool, suggesting setup friction beyond the
   marketing claim.

### Who the reviewers are

- Small-business owners and marketers running Shopify, WordPress, or custom
  sites.
- Roles: store owners, website managers, customer support leads.
- The product is used primarily as a free enhancement layer, not as a primary
  content platform.

### Switch signals

- No reviewers mention switching FROM a named competitor TO OpenWidget, or vice
  versa.
- The product's free tier means there is no churn risk — users simply stop
  using it if it doesn't work.

### Community / knowledge base

- OpenWidget's help center appears to be at `help.commoninja.com` (shared
  infrastructure with Common Ninja / LiveChat ecosystem) — not independently
  accessible. Could not inspect during this pass.
- No independent community forum found for OpenWidget specifically.

### Live installations

OpenWidget widgets are deployed on real sites. Verified through web search:

| Site | Platform | Finding |
| --- | --- | --- |
| `debeatzgh.wordpress.com` | WordPress.com | Full embed snippet visible in page source (two blog posts with the `window.__ow` + `cdn.openwidget.com` loader) |
| `estyn.gov.wales` | Welsh government site | `cdn.openwidget.com` listed in third-party-web domain map (CSV) as a recognized third-party domain loaded on the site |
| GitHub gist (`humannus`) | Code snippet | Complete embedded chat widget example with `window.__ow` initialization + `cdn.openwidget.com` loader |

**Key crawlability finding:** On `debeatzgh.wordpress.com`, the embed code is
visible in the page source — but it is the loader stub only (`window.__ow`
config + async script injection). No widget content (FAQ answers, contact form
fields, etc.) is in the HTML. The widget DOM is constructed client-side by
`openwidget.js` after it loads. This confirms the same loader pattern as Common
Ninja: **crawler sees the stub; customer content is invisible without
JavaScript.**

The OpenWidget embed does NOT carry a `<noscript>` fallback with content — only
a link to "enable JavaScript." So a no-JS visitor or crawler sees nothing
useful.

---

## 11. PMM artifacts

### 11.1 Positioning statement

> Clickeen is the only widget and page platform where your content is saved as
> real, crawlable HTML — not a CDN script that renders in the browser. OpenWidget
> is a free launcher overlay whose widgets are invisible to crawlers and offer no
> customization, no composition, and no localization.

### 11.2 Battle card

| | Clickeen | OpenWidget |
| --- | --- | --- |
| Where we win | Complete crawlable HTML; composed pages; Dieter design system; baseLocale + exact overlays; agent-operated substrate | — |
| Where they win | — | Zero friction (free, 1 snippet, 5 minutes); 14 ready widgets; no learning curve; no cost |
| When we lose | Customer wants a free, instant, floating chat button on an existing site. Clickeen is not that product. | Customer wants that. |
| When we win | Customer cares about SEO, brand consistency, composing widgets into pages, or having their content be a real artifact. OpenWidget cannot do any of this. |
| Killer question | "Do you want a free chat button, or do you want your content to be crawlable, composed, and brand-consistent?" |

### 11.3 Messaging guidance

**Say:**
1. "Your content is real." Saved HTML, not CDN scripts. Crawlers see it.
2. "Brand-consistent across all widgets." Dieter design system, not avatar/name only.
3. "Agents operate it." Product Copilot and Translation Agent, not button-click generators.

**Do NOT say:**
1. "We have 8 widgets." OpenWidget has 14; the comparison is about depth not count.
2. "We're free." We're not. The message is value, not price.
3. "5-minute setup." OpenWidget owns speed-to-live. The message is what happens after install.

---

## Sources

- [OpenWidget — official site](https://openwidget.com/widgets)
- [OpenWidget pricing](https://openwidget.com/pricing)
- [Product Cards widget](https://openwidget.com/widgets/product-cards)
- [Create Your Own widget](https://openwidget.com/widgets/create-your-own)
- [Contact Form widget](https://openwidget.com/widgets/contact-form)
- [FAQ widget](https://openwidget.com/widgets/faq)
- [Product Recommendations widget](https://openwidget.com/widgets/product-recommendations)
- [Google Reviews widget](https://openwidget.com/widgets/google-reviews)
- [ChatGPT widget](https://openwidget.com/widgets/chatgpt-widget)
- [WhatsApp Chat widget](https://openwidget.com/widgets/whatsapp-chat)
- [LiveChat Launches OpenWidget — DestinationCRM](https://www.destinationcrm.com/Articles/CRM-News/CRM-Across-the-Wire/LiveChat-Launches-OpenWidget-155920.aspx)
- [OpenWidget on Capterra](https://www.capterra.com/p/10009145/OpenWidget/)
- [OpenWidget on GetApp](https://www.getapp.com/marketing-software/a/openwidget/)
- [OpenWidget on G2](https://www.g2.com/products/openwidget/reviews)
- [OpenWidget on SourceForge](https://sourceforge.net/software/product/OpenWidget/)
