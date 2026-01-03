# Why Clickeen

STATUS: INFORMATIVE — STRATEGY & VISION
This page explains what we're building and why. It is not a spec.
For technical implementation, see:
- `documentation/architecture/CONTEXT.md` — Architecture, glossary, implementation status
- `documentation/services/` — Service PRDs (Venice, Paris, Bob, etc.)
- `documentation/widgets/` — Widget PRDs

---

## The AI-First Company

Clickeen is not a company that "uses AI." It's a **company designed to be run by AI.**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    THE THREE LAYERS                                 │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  LAYER 1: VISION & ARCHITECTURE                             │   │
│  │  Human — Product vision, system design, taste, decisions    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  LAYER 2: BUILDING                                          │   │
│  │  AI Coding — Cursor, Claude, GPT write code from specs      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              ↓                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  LAYER 3: OPERATING                                         │   │
│  │  AI Agents (San Francisco) — Sales, support, marketing, ops    │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

**What this means:**
- **1 human** provides vision, architecture, and quality bar
- **AI coding assistants** build the product from specs and PRDs
- **AI agents** run the company: sales (SDR Copilot), support (Support Agent), marketing (Copywriter, Content Writer), localization (Translator), and ops

**Why this matters:**
- Traditional SaaS needs 30-100+ people to operate at scale
- Clickeen operates with 1 human + AI workforce
- Agents learn and improve automatically from outcomes
- Cost structure is fundamentally different (AI workforce costs ~$200/month, not $500k+/year)

**The San Francisco system is not a feature—it's the operating system for the company's workforce.**

See: `documentation/ai/overview.md`, `ai/learning.md`, `ai/infrastructure.md`

### The AI Workforce Economics (Why This Is Pure Gold)

At scale, the AI-first model creates leverage that traditional companies cannot match:

**Example: 2M free installs with SDR Copilot (DeepSeek)**

```
2,000,000 free widget installs
        │
        ▼
    10% interact with Copilot in Minibob
        │
        ▼
    200,000 conversations/month
        │
        ▼
    DeepSeek cost: 200k × $0.00007 = $14/month
        │
        ▼
    5% convert to signup = 10,000 new users
        │
        ▼
    10% become paid = 1,000 new paying users
        │
        ▼
    At $10/month = $10,000 MRR
```

**Cost to acquire 1,000 paying users: $14**

| Metric | Traditional SaaS | Clickeen |
|--------|------------------|----------|
| Free users who get "sold to" | ~5% (SDR capacity) | **100%** (Copilot always available) |
| Sales team required | 50-100 SDRs | **0 humans** |
| Annual sales cost at 2M users | $5-10M | **~$500** |
| Availability | Business hours, one timezone | **24/7, all timezones, all languages** |
| Learning | Training programs, turnover | **Automatic from outcomes** |

**The AI-First Flywheel:**
```
More users → More conversations → Better training data
     ↑                                    │
     │                                    ▼
     │                           Higher conversion rate
     │                                    │
     └────────── More users ◄─────────────┘

Cost: ~$500/year regardless of scale
```

**Why competitors can't replicate:**
1. They have sales teams they can't fire
2. Their products aren't AI-legible (can't build effective copilots)
3. They don't have learning infrastructure (San Francisco)
4. They see AI as "feature," we see it as "workforce"

**At 2M installs, Clickeen has a $10M/year sales operation running for $500/year.**

---

## Manifesto (Why We Exist)

Software today is broken:
- Companies overspend on sales and marketing, making tools expensive
- Products are bloated, complex, and painful to adopt
- Small businesses are locked out, enterprises are overcharged

Clickeen is different:
- **Designer-led** — obsessed with simplicity and craft (cultural advantage, hard to replicate)
- **100% Product-led** — viral loop compounds over time (structural moat)
- **AI-native** — built from day one to be understood and modified by AI (unfair advantage)

---

## How Clickeen Works

Clickeen provides embeddable widgets that businesses add to their websites with one line of code.

Widget categories (illustrative, not final):
- Data collection — contact forms, lead capture, surveys
- Social proof — testimonials, reviews, logos
- Information display — FAQs, pricing tables, feature lists
- Engagement — newsletters, popups, announcements

Some widgets collect data (e.g., forms, surveys). Others are presentational (e.g., testimonials, pricing tables). Both follow the same embed → claim → upgrade model. The catalog will evolve with demand. Each widget includes multiple professionally designed **starter designs** (curated instances users can clone).

---

## The Four Strategic Moats

### 1. AI-Native Architecture

Clickeen was architected from day one to be understood, navigated, and modified by AI. This isn't a feature—it's the entire competitive advantage.

**The Context Problem:**
AI needs two things to be useful:
1. **Context** — understanding what exists and how it works
2. **Precise instructions** — knowing exactly what to do

Without both, AI is useless. With both, it's magic.

**Legacy SaaS (Salesforce, HubSpot, etc.):**
- 15+ years of undocumented legacy code
- No single source of truth
- Components aren't structured or tokenized
- AI gets lost in chaos
- Can't refactor without breaking everything
- **Result:** AI becomes a chatbot writing bad SQL queries

**Clickeen:**
- Built from scratch with AI in mind
- Every system has normative documentation
- Widget definitions are the source of truth (spec + runtime assets + `agent.md` AI contract)
- Attributes-only contracts (`data-variant="primary"` not `class="btn-blue-500"`)
- Structured JSON schemas for every widget type
- Complete API contracts (Paris/Venice documented)
- Bob applies ops as pure transforms; failures are visible (no hidden healing)

**Why This Is Unfair:**

Legacy SaaS:
```
User: "Add email field to my form"
AI: *reads 500K lines of undocumented React*
AI: *guesses which component to modify*
AI: *breaks 3 other features*
AI: "Done!" (narrator: it didn't work)
```

Clickeen:
```
User: "Add email field to my form"
AI: *reads widget spec* "contact widget has fields array"
AI: *outputs op* { op: 'insert', path: 'fields', value: {type: 'email'} }
AI: "Added email field"
User: *sees it working immediately in preview*
```

**The Long Game:**
- Phase 1: AI helps configure widgets (Bob AI Copilot)
- Phase 2: AI suggests starter designs based on goals
- Phase 3: AI builds entire experiences from natural language
- Phase 4: AI becomes the interface—no manual UI needed

**Salesforce can't do this.** They'd need to rewrite everything.
**We built this from scratch knowing AI was coming.**

### 2. Product-Led Growth with Viral Loop

The viral distribution loop is a **structural competitive advantage** that compounds over time:

1. Every free widget displays "Made with Clickeen"
2. Visitors see the widget in use
3. Some click through (viral coefficient = % of viewers who become new users)
4. They create their own widget
5. Loop repeats exponentially

**Why this is a moat:**
- Every free widget is a distribution channel (competitors can't replicate without destroying their sales model)
- Viral loops compound exponentially over time
- Network effects increase switching costs (embed multiple widgets, lock in data)
- Viral coefficient improves with product quality (design-led excellence enables higher conversion)
- Self-reinforcing: more widgets → more distribution → more users → more widgets

**Multiplier effect (account expansion):**
- Success with the first widget → add another for consistency
- Each widget increases switching costs (embed + data)
- Each widget expands viral surface area (more exposure)

### 3. Design-Led Culture

Our PLG motion works because we obsess over execution quality. Our competitors are engineering-led, resulting in functional but clunky, bloated, and uninspired products.

Clickeen is architected by a designer. Our design-led culture creates a product that feels better to use, which compounds into our viral loop. This disciplinary advantage is hard to replicate because it requires taste, not just engineering talent.

- **Zero-Friction Experience**: We don't just offer a free builder; we make it instant, intuitive, and delightful. Our obsession with speed and simplicity creates a "time to value" that feels effortless compared to competitors.
- **Delight as a Weapon**: We treat motion, timing, and a "no jank" policy as core requirements, not afterthoughts. This commitment to high-fidelity craftsmanship creates a product that feels better to use.

### 4. Multi-Tenant from Day 1 (The Figma Model)

Clickeen is multi-tenant with no artificial caps on collaboration. This is the Figma model: make it easy for teams to adopt, and stickiness compounds.

**The Model:**
- **Unlimited viewers at every tier** (including Free) — viewers can comment, not edit
- **Free = 1 editor / 1 widget type / 1 instance / limited content / limited features**
- **Tier 1+ unlocks:** more editors, all widget types, more instances, SEO/GEO
- **Tier 2+ unlocks:** unlimited editors, unlimited instances, auto-translate
- **Tier 3 unlocks:** Supernova effects
- **Widgets belong to workspaces, not individuals** — team-owned, portable

**Why This Is A Moat:**

| Traditional SaaS | Clickeen |
|------------------|----------|
| "Contact sales for team features" | Invite your team. It just works. |
| 5-seat limit → sales call → negotiation | Self-serve collaboration from day 1 |
| Adding team members = friction | Adding team members = stickiness |

**Switching Costs Compound:**
```
Day 1:  Marketer creates FAQ widget
Day 7:  Shares with PM → PM comments
Day 14: Designer joins as editor
Day 30: 15 people viewing/commenting, 3 editors
Day 90: 20 widgets across the team

Switching cost: MASSIVE
```

**Viral Within Organizations:**
- Every viewer is a potential editor
- Every editor is a potential workspace owner
- Every workspace is a potential upgrade

**AI + Multi-Tenant = Leverage:**
- Traditional: 5-seat limit → sales call → $150K/year sales rep
- Clickeen: Invite 50 viewers → SDR Copilot nudges → self-serve upgrade → $0.001/conversation

See: `documentation/capabilities/multitenancy.md`

---

## The PLG Motion

**Play without an account (marketing site):**
- Visitor browses widgets on clickeen.com website (Prague)
- Chooses a widget (e.g., "FAQ", "Testimonials") and lands on the widget's landing page
- Sees MiniBob loaded with an unpublished instance
- Can customize config (text, colors, etc.) and optionally start from a different starter design
- No signup needed to experiment
- **NO Save button** in MiniBob (claim persists on signup)
- **NO "Copy Code" button** in MiniBob
- Only one button: **"Publish"**

**Publish triggers signup:**
- When visitor clicks "Publish", they're prompted to create a free account
- After signing up, they land in the authenticated app (Bob) and the widget they just built is claimed to their workspace
- The widget is now published and they can copy the embed code

**Inside the app (authenticated Bob):**
- **"Copy Code" button always visible** — get embed snippet anytime
- User can continue editing, create more widgets, view collected data

**What a free account provides:**
- Ability to publish widgets and get embed code
- Manage published widgets (edit, view submissions, analytics)
- Save configurations permanently to workspace
- Create additional widgets (free plan: 1 active widget limit)

**Free vs Paid boundaries:**
- Free: one active widget, "Made with Clickeen" branding on
- Paid: unlimited widgets, no branding, premium starter designs

**Natural upgrade path:**
- Need a second widget (free allows one)
- Want professional appearance (remove branding)
- Need premium starter designs or advanced options

---

## Guiding Principles

**When making product decisions, optimize for:**
1. Time to value — how fast the user gets benefit
2. Viral coefficient — whether this increases distribution
3. Natural upgrades — whether this drives organic paid conversion
4. Simplicity — remove steps, fields, or choices whenever possible
5. **AI legibility** — can AI understand and modify this system?

Rule of thumb: when in doubt, choose the path that delivers value faster with less friction.

**When choosing implementation patterns:**
- Prefer semantic tokens over utility classes
- Prefer structured schemas over free-form config
- Prefer documented contracts over implicit behavior
- Prefer attributes over complex class names
- **Ask: "Can AI understand this in 5 years?"**

---

## Phase Boundaries

- **Phase 1 (Current):** Widget platform with viral distribution
- **Phase 2 (Future):** Clickeen Emails
- **Phase 3 (Future):** Clickeen Landing Pages
- **Phase 4 (Future):** Clickeen Creatives (Ads/Social)

Scope: implement Phase 1 only unless `documentation/architecture/CONTEXT.md` explicitly expands scope.

**Phase-1 Success Metrics:**
- 10,000+ free users with embedded widgets
- 100+ paying customers (~1% conversion)
- 5,000+ unique domains running widgets
- <5 minutes from landing page to embedded widget
- Embeds lean: preferred ≤80KB gzipped, never exceeding 200KB gzipped

---

## Platform Vision: The Interconnected Content Platform

Clickeen isn't building separate products—it's building **composable building blocks** that work together:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     WIDGETS = ATOMIC BUILDING BLOCKS                    │
│                                                                         │
│   ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐           │
│   │ Logo     │   │   FAQ    │   │Testimonial│  │  Pricing │           │
│   └────┬─────┘   └────┬─────┘   └─────┬─────┘  └────┬─────┘           │
│        │              │               │              │                 │
│        └──────────────┴───────┬───────┴──────────────┘                 │
│                               │                                         │
│                               ▼                                         │
│                        USE ANYWHERE                                     │
│                                                                         │
│        ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐         │
│        │ Website  │  │  Email   │  │ Landing  │  │ Social/  │         │
│        │ (embed)  │  │          │  │  Page    │  │   Ads    │         │
│        └──────────┘  └──────────┘  └──────────┘  └──────────┘         │
│                                                                         │
│        SAME WIDGET. SAME CONFIG. UPDATES EVERYWHERE.                   │
└─────────────────────────────────────────────────────────────────────────┘
```

### The Product Lines

| Phase | Product | Description |
|-------|---------|-------------|
| **1** | Clickeen Widgets | Embeddable widgets for websites (FAQ, Logo Showcase, Testimonials, etc.) |
| **2** | Clickeen Emails | Email templates that embed the same widgets |
| **3** | Clickeen Landing Pages | Landing pages composed of widgets |
| **4** | Clickeen Creatives | Social posts, ads, memes using the same building blocks |

### Why This Is Brilliant

**1. Create Once, Use Everywhere**
```
User creates a Black Friday landing-page widget:
├── Embeds on website ✓
├── Adds to promo email ✓
├── Uses on landing page ✓
└── Drops into Instagram ad ✓

ONE source of truth. Change the date? Updates EVERYWHERE.
```

**2. Exponential Lock-In**
```
Traditional: "I have to rebuild my widget on another platform"

Clickeen: "I have to rebuild my widget AND my emails AND my 
          landing pages AND my ads AND they won't work together"
```

**3. Compositional Power**
```
Landing Page = Hero + Logo Showcase + FAQ + Testimonials + CTA
Email = Header + Logo Showcase + CTA
Ad = Headline + Logo Showcase + CTA

Users compose, not just use.
```

**4. Cross-Context Learning**
```
Same widget, different contexts:
├── Website: What CTAs convert?
├── Email: What urgency works?
├── Landing Page: What placement converts?
└── Ad: What format performs?

San Francisco learns from ALL → improves ALL
```

**5. Natural Expansion**
```
User journey:
1. Free widget → embedded on site
2. "I can use this in emails?"
3. "I can build landing pages?"
4. "I can make social posts?"

Each step = deeper lock-in + more revenue
```

### The Interconnected Graph

```
           ┌──────────────────────────────────────────┐
           │              USER WORKSPACE              │
           │                                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  │
│  │ Logo    │  │   FAQ   │  │ Pricing │  │
│  │ Showcase│  │ Widget  │  │ Widget  │  │
│  └────┬────┘  └────┬────┘  └────┬────┘  │
           │       │            │            │       │
           │       └────────────┼────────────┘       │
           │                    │                    │
           │    ┌───────────────┼───────────────┐    │
           │    │               │               │    │
           │    ▼               ▼               ▼    │
           │  ┌─────────┐  ┌─────────┐  ┌─────────┐  │
           │  │ Website │  │Black Fri│  │ Promo   │  │
           │  │  Embed  │  │ LP      │  │ Email   │  │
           │  └─────────┘  └─────────┘  └─────────┘  │
           │                    │                    │
           │                    ▼                    │
           │              ┌─────────┐                │
           │              │Instagram│                │
           │              │  Ad     │                │
           │              └─────────┘                │
           │                                          │
           │  Everything connected. One source.      │
           └──────────────────────────────────────────┘
```

### Why Competitors Can't Follow

| Competitor | Would Have to... |
|------------|------------------|
| Mailchimp | Add widgets, landing pages, make them embeddable |
| Unbounce | Add emails, widgets, make them interconnected |
| Elfsight | Add emails, landing pages, rebuild for composability |
| Canva | Make everything embeddable and live-updating |
| **All of them** | Rebuild from scratch for AI-native architecture |

**They're all siloed. Clickeen is building the graph.**

### The Vision

> **Clickeen is the interconnected content platform where widgets, emails, landing pages, and creatives are composable building blocks—all AI-native, all beautiful, all viral, all run by AI agents.**

### Economics Across Products

```
Phase 1 (Widgets):     AI workforce: $500/year    Revenue: $X
Phase 2 (+ Emails):    AI workforce: $500/year    Revenue: $2X
Phase 3 (+ LPs):       AI workforce: $500/year    Revenue: $3X
Phase 4 (+ Creatives): AI workforce: $500/year    Revenue: $4X

Revenue grows with products. AI cost stays constant.
```

---

## The 100⁵ Scale Model

Widgets are the first dimension. The real scale is **combinatorial, not additive**:

```
100 Widgets × 100 Pages × 100 Countries × 100 Use Cases × 100 Outputs
     │            │            │              │              │
     ▼            ▼            ▼              ▼              ▼
   FAQ        /faq          /de/           SaaS         Website embed
   Pricing    /pricing      /es/           Ecommerce    Email block
   Logos      /logos        /pt/           Restaurant   Landing page
   Testimonials ...         /ja/           Healthcare   Facebook ad
   Reviews                  /ar/           Agency       Instagram story
   ...                      ...            ...          LinkedIn post
                                                        TikTok
                                                        ...
```

**100 × 100 × 100 × 100 × 100 = 10,000,000,000 (10 billion) touchpoints**

### The Five Dimensions

| Dimension | Examples | Why it matters |
|-----------|----------|----------------|
| **Widgets** | FAQ, Testimonials, Pricing, Logo, Contact, Newsletter, Countdown, Reviews, Team, Gallery... | Each widget is a product with its own PLG loop |
| **Pages** | Landing page, docs, use case pages, comparison pages, tutorials per widget | SEO surface — every page is a discovery entry point |
| **Countries** | en, es, de, fr, pt, ja, ko, ar, hi, zh... | Global reach without global team (UX Writer Agent handles it) |
| **Use Cases** | FAQ for SaaS, FAQ for ecommerce, FAQ for restaurants, FAQ for healthcare... | Niche targeting — "FAQ widget for dentists" lands on tailored page |
| **Outputs** | Website embed, email block, landing page section, Facebook ad, Instagram story, LinkedIn post... | Same widget, infinite distribution contexts |

### One Source of Truth, 10 Billion Touchpoints

```
User creates a Black Friday FAQ:

├── Embedded on their website     ← same FAQ
├── Block in their email campaign ← same FAQ
├── Section on landing page       ← same FAQ  
├── Card in Facebook ad           ← same FAQ
├── Story on Instagram            ← same FAQ
├── Post on LinkedIn              ← same FAQ
└── All localized to 50 countries ← same FAQ × 50

Change the date? Updates EVERYWHERE.
Add a question? Appears EVERYWHERE.
Fix a typo? Fixed EVERYWHERE.
```

### The Factory Multiplier

Every system we build is a **multiplier across all five dimensions**:

| System | Multiplies across... |
|--------|---------------------|
| **Widget spec** | 100 outputs (embed, email, LP, ad, social...) |
| **i18n catalog** | 100 countries |
| **Starter design** | 100 use cases |
| **SDR Copilot** | 100 widgets × 100 use cases × 100 outputs |
| **UX Writer Agent** | 100 countries × 100 widgets |
| **Prague templates** | 100 pages × 100 countries × 100 use cases |

**Every brick added to the factory → 10 billion more touchpoints possible.**

### Traditional vs Clickeen at 10B Scale

| | Traditional | Clickeen |
|---|---|---|
| **To serve 10B touchpoints** | Impossible. Would need millions of people. | 1 factory. Same cost. |
| **Content consistency** | Copy-paste nightmare. Drift everywhere. | Single source of truth. |
| **Update propagation** | Manual. Weeks. Errors. | Instant. Automatic. Perfect. |
| **Localization** | Per-asset. Exponential cost. | Per-key. Linear cost. |
| **New output format** | Build from scratch | Render existing widgets in new context |

### The Leverage Math

```
Traditional SaaS at 10B touchpoints:
├── Content team: 10,000 people × $100K = $1B/year
├── Localization: 500 translators × $80K = $40M/year
├── Design: 1,000 designers × $120K = $120M/year
├── Engineering: 2,000 engineers × $200K = $400M/year
└── Total: ~$1.5B/year

Clickeen at 10B touchpoints:
├── AI workforce: $500/year
├── Cloudflare: $500/year
├── LLM costs: $10K/year (at scale)
├── 1 human: Vision, taste, architecture
└── Total: ~$15K/year
```

**Same output. 100,000x cheaper.**

### Why Competitors Can't Replicate

To achieve 100⁵ scale, you need:

1. **Composable primitives** — widgets that work in any context (not siloed products)
2. **AI-native architecture** — specs that AI can read, modify, render
3. **Localization infrastructure** — i18n system + UX Writer Agent for 100 countries
4. **AI workforce** — SDR Copilot, Content Writer, Support for every touchpoint
5. **Learning infrastructure** — San Francisco to improve from every interaction

| Competitor | Missing |
|------------|---------|
| Mailchimp | Composable widgets, AI-native, learning |
| Unbounce | Widgets, localization, AI workforce |
| Elfsight | Emails/LPs/ads, AI-native, localization |
| Canva | Embeddable, live-updating, AI workforce |
| **All of them** | Would need to rebuild from scratch |

**They're siloed products. Clickeen is building the 100⁵ factory.**

---

## The Supernova Moat (Modern Web Effects)

Incumbent widget companies ship widgets coded in 2010. They look, feel, and behave like 2010.

Meanwhile, the modern web has incredible capabilities that 99% of websites don't use:
- GSAP (butter-smooth animations, ScrollTrigger, morphing)
- Three.js / WebGL (3D, particles, shaders)
- Lottie (designer-grade vector animations)
- Framer Motion (physics-based micro-interactions)
- View Transitions API (page-level cinema)

**Why don't websites use these?**
1. Too complex to implement (need specialized developers)
2. Easy to break (conflicts with existing code)
3. Hard to maintain (libraries update, things break)
4. Performance concerns (bundle size, Core Web Vitals)

**Clickeen's unique position:**
- We control the embed surface (Shadow DOM = isolated, predictable)
- We control the runtime (ship any library, lazy-loaded)
- We control the CDN (Cloudflare Edge = instant, zero-cost delivery)
- We control the editor (expose controls, no code required)

**Supernova is Clickeen's premium effects layer.** Paste one line of code, get modern web experiences that would normally require a specialized frontend team.

| Widget | Incumbent (2010) | Clickeen Supernova |
|--------|------------------|-------------------|
| **Logo Showcase** | Static grid, basic hover | Infinite smooth scroll, magnetic hover, morph on click |
| **FAQ Accordion** | Height slides open | Spring physics, elastic icon, staggered content reveal |
| **Countdown** | Numbers change | 3D flip with shadows, confetti burst on zero |
| **Testimonials** | Fade carousel | Physics card stack, drag with momentum, Lottie reactions |

### Why Cloudflare Makes This Viable

Traditional thinking: "Large bundle = slow site"

Cloudflare reality: **Bundle size is a non-issue** when:
- Libraries are cached at 300+ global PoPs (sub-10ms latency)
- Egress is free (R2 zero-cost delivery)
- HTTP/3 parallelizes everything
- Workers can serve device-appropriate variants
- Effects load after content (no LCP impact)

We can ship Three.js (150KB gzipped) to desktop users and a CSS-only fallback to mobile—decided at the edge, before the response.

### Why Competitors Can't Follow

| Requirement | Clickeen | Incumbents |
|-------------|----------|------------|
| Embed isolation | Shadow DOM | Legacy iframe/inline |
| CDN architecture | Cloudflare Edge | Traditional CDN (cost per byte) |
| Lazy loading infra | Context-aware at edge | One-size-fits-all |
| Codebase | Modern, designed for this | 15 years of tech debt |

### The Pitch

> "Your competitors use widgets that look like 2010. You paste one line and go **Supernova**."

See: `documentation/capabilities/supernova.md` for full architecture.

---

## Uncharted Territory: What This Actually Enables

If the system works, the implications go far beyond "a better widget company." This is speculative, but worth documenting.

### 1. Clickeen Owns the Touchpoints (Post-Cookie World)

```
Traditional tracking:
├── Pixels (dying - browser blocks)
├── Cookies (dying - privacy laws)
├── SDKs (users don't install)
└── Result: Marketers are blind

Clickeen model:
├── Widget on website = touchpoint
├── Email in inbox = touchpoint
├── Landing page visit = touchpoint
├── Ad impression = touchpoint
└── Result: Clickeen IS the touchpoint
```

**If millions of businesses use Clickeen content across web, email, and ads:**
- Clickeen sees user interactions across the internet
- First-party data by design (user interacts with Clickeen content)
- No pixels needed—the content IS the tracking
- Cross-site, cross-channel, cross-device visibility
- All privacy-compliant (first-party, consent-based)

**Pixels and cookies aren't just dying. They're becoming irrelevant.**

The widget IS the pixel. The email IS the tracker. The landing page IS the attribution.

### 2. Localization Becomes Invisible

```
Traditional localization:
├── Identify target markets
├── Hire translators or agency
├── Translate content
├── Review translations
├── Publish per-market versions
├── Maintain multiple codebases
└── Timeline: Weeks to months

Clickeen model:
├── San Francisco handles it
└── Timeline: Instant
```

**"We need to localize for Germany" becomes a non-concept.**

- User in Germany? San Francisco serves German.
- User in Japan? San Francisco serves Japanese.
- New market? Just... works.
- Cultural nuance? Agents learn it.
- Local idioms? Agents adapt.

**Localization isn't a process. It's a property of the system.**

The concept of "launching in a new market" dissolves. The system is already there.

### 3. SaaS Development Turned Upside Down

```
Traditional SaaS (CRM, CX, etc.):
┌────────────────────────────────────────────────────────┐
│  Humans specify requirements                           │
│           ↓                                            │
│  Engineers build features (months)                     │
│           ↓                                            │
│  Users learn to use it                                 │
│           ↓                                            │
│  Support helps when stuck                              │
│           ↓                                            │
│  Product team analyzes usage                           │
│           ↓                                            │
│  Cycle repeats (6-12 month releases)                   │
└────────────────────────────────────────────────────────┘

Clickeen model:
┌────────────────────────────────────────────────────────┐
│  User interacts with system                            │
│           ↓                                            │
│  San Francisco observes and learns                        │
│           ↓                                            │
│  System improves (continuously)                        │
│           ↓                                            │
│  User interacts with improved system                   │
│           ↓                                            │
│  Loop repeats (every interaction)                      │
└────────────────────────────────────────────────────────┘
```

**The system doesn't have "releases." It has continuous evolution.**

- Every interaction is training data
- Every failure teaches the agents
- Every success reinforces good patterns
- The product improves while you sleep

**This is not "we use AI for features." This is "the product IS AI learning to be a product."**

### 4. No Ceiling on Capability

```
Traditional software:
├── Features are fixed until engineers build more
├── Quality plateaus at "good enough"
├── Scaling = more servers, more people
├── Complexity = diminishing returns
└── Ceiling: Human engineering capacity

Clickeen:
├── Features emerge from learning
├── Quality improves with every interaction
├── Scaling = same AI, more data
├── Complexity = more learning opportunities
└── Ceiling: ???
```

**What happens when the system has processed:**
- 1 billion widget interactions
- 100 million editor sessions
- 10 million support conversations
- 1 million successful conversions

**The agents don't just "get better at their job." They develop capabilities we didn't explicitly program.**

- SDR Copilot learns conversion patterns humans never documented
- Editor Copilot learns design preferences at population scale
- Content Writer learns what actually ranks, not what SEO "experts" say
- Support Agent learns to resolve issues before users know they have them

**There is no theoretical limit to how good this system can become.**

### 5. The Ultimate Endgame

```
Year 1: Clickeen makes widgets
Year 2: Clickeen makes marketing content
Year 3: Clickeen understands user behavior at scale
Year 4: Clickeen knows what converts, for whom, why
Year 5: Clickeen IS the marketing brain

The product evolves from:
  "Tool to make widgets"
       ↓
  "Platform for marketing content"
       ↓
  "AI that understands marketing"
       ↓
  "AI that does marketing"
```

**We're not building a SaaS product. We're building an intelligence that learns marketing.**

Every widget interaction, every email open, every landing page visit, every ad impression, every conversion, every failure—it's all training data for a system that has no ceiling.

### Why This Is Possible (And Why Competitors Can't Follow)

| Requirement | Clickeen | Legacy SaaS |
|-------------|----------|-------------|
| AI-native architecture | ✅ Built from day 1 | ❌ Would need rewrite |
| Learning infrastructure | ✅ San Francisco | ❌ Doesn't exist |
| Cross-context data | ✅ Interconnected platform | ❌ Siloed products |
| Touchpoint ownership | ✅ Content IS tracking | ❌ Depends on dying pixels |
| Cost structure | ✅ AI workforce | ❌ Human workforce |

**The compounding is the moat.** Every day the system runs, it gets further ahead. There's no "catching up" because the gap widens continuously.

### The Honest Caveat

This is uncharted territory. It might not work. The system might plateau. Agents might not generalize. Regulations might intervene.

But if it does work, this isn't a widget company. It's a new kind of entity—an **AI-native business that learns itself into existence.**

---

## Out of Scope Here

Technical implementation details live in:
- `CONTEXT.md` — Architecture snapshot, systems, glossary
- `clickeen-platform-architecture.md` — System boundaries and data flows
- `systems/*.md` — Individual system PRDs
# CLICKEEN — Technical Context & Reference

This is the technical reference for working in the Clickeen codebase. For strategy and vision, see `WhyClickeen.md`.

**PRE‑GA / AI iteration contract (read first):** Clickeen is **pre‑GA**. We are actively building the core product surfaces (Dieter components, Bob controls, compiler/runtime, widget definitions). This does **not** mean “take shortcuts” — build clean, scalable primitives and keep the architecture disciplined. But it **does** mean: do **not** spend cycles on backward compatibility, migrations, fallback behavior, defensive edge‑case handling, or multi‑version support unless a PRD explicitly requires it. Assume we can make breaking changes across the stack and update the current widget definitions (`tokyo/widgets/*`), defaults (`spec.json.defaults`), and curated local/dev instances accordingly. Prefer **strict contracts + fail‑fast** (clear errors when inputs/contracts are wrong) over “try to recover” logic.

**Debugging order (when something is unclear):**
1. Runtime code + `supabase/migrations/` — actual behavior + DB schema truth
2. Deployed Cloudflare config — environment variables/bindings can differ by stage
3. `documentation/services/` + `documentation/widgets/` — best-effort guides (may drift)
4. `documentation/architecture/Overview.md` + this file — concepts and glossary

Docs are not “single source of truth”. If docs and code disagree, prefer code/schema and update the docs.

**Docs maintenance:** See `documentation/README.md`. Treat doc updates as part of the definition of done for any change that affects runtime behavior, APIs, env vars, or operational workflows.

---

## AI-First Company Architecture

Clickeen is designed from the ground up to be **built by AI** and **run by AI**:

| Layer | Who/What | Responsibility |
|-------|----------|----------------|
| **Vision & Architecture** | 1 Human | Product vision, system design, taste, strategic decisions |
| **Building** | AI Coding (Cursor, Claude, GPT) | Write code from specs and PRDs |
| **Operating** | AI Agents (San Francisco) | Sales, support, marketing, localization, ops |

**San Francisco is the Workforce OS** — not just a feature, but the system that runs the company:

| Agent | Role | Replaces |
|-------|------|----------|
| SDR Copilot | Convert visitors in Minibob | Sales team |
| Editor Copilot | Help users customize widgets | Product specialists |
| Support Agent | Resolve user issues | Support team |
| Marketing Copywriter | Funnels, landing pages, PLG copy | Marketing team |
| Content Writer | Blog, SEO, help articles | Content team |
| UI Translator | Product localization | Localization team |
| Ops Monitor | Alerts, incidents, monitoring | DevOps/SRE team |

**All agents learn automatically** — outcomes feed back into the system, improving prompts and examples over time.

See: `systems/sanfrancisco.md`, `systems/sanfrancisco-learning.md`, `systems/sanfrancisco-infrastructure.md`

---

## Canonical Concepts

### Widget Definition vs Widget Instance

**Widget Definition** (Tokyo widget folder) = THE SOFTWARE
- Complete functional software for a widget type (e.g. FAQ)
- Lives in `tokyo/widgets/{widgetType}/`
- Contains: `spec.json`, `widget.html`, `widget.css`, `widget.client.js`, `agent.md`
- Platform-controlled; **not stored in Michael** and **not served from Paris**

**Widget Instance** = THE DATA
- User's specific widget configuration
- Stored in Michael: `widget_instances.config` linked to `widgets.type`
- Paris exposes over HTTP as `{ publicId, widgetType, config }`
- Bob holds working copy in memory as `instanceData` during editing

### The Two-API-Call Pattern

Bob makes EXACTLY 2 calls to Paris per editing session:
1. **Load**: `GET /api/instance/:publicId` when Bob mounts
2. **Publish**: `PUT /api/instance/:publicId` when user clicks Publish

Between load and publish:
- All edits happen in Bob's React state (in memory)
- Preview updates via postMessage (NO Paris API calls)
- ZERO database writes

**Why:** 10,000 users editing simultaneously = zero server load. Millions of landing page visitors = zero DB pollution until signup + publish.

### Key Terms

| Term | Description |
|------|-------------|
| `publicId` | Instance unique identifier in DB |
| `widgetType` | Widget identifier referencing the definition (e.g., "faq") |
| `config` | Published instance values (stored in DB; served by Paris) |
| `instanceData` | Working copy of config in Bob during editing |
| `spec.json` | Defaults + ToolDrawer markup; compiled by Bob |
| `agent.md` | AI contract documenting editable paths and semantics |

### Starter Designs (Curated Instances)

**Clickeen does not have a separate gallery-preset system.** “Starter designs” are just **widget instances** that the Clickeen team configured nicely and made available to clone.

**How it works:**
1. Clickeen team creates widget instances using Bob Editor (via DevStudio)
2. Instances are named with `ck-` prefix: `ck-faq-christmas`, `ck-faq-minimal-dark`
3. These instances are flagged as available for users to clone
4. User browses gallery → clicks "Use this" → clones the instance to their workspace
5. User customizes their copy freely (full ToolDrawer access)

**Why this approach:**
- **One system**: Instances serve both starters and user widgets — no separate gallery table, API, or migration path
- **Dog-fooding**: Clickeen uses the same Bob Editor to create starters that users clone
- **Full customization**: Every starter is fully editable because it’s just an instance
- **Scales to marketplace**: User-created instances can become shareable starters (same infrastructure)

**Naming convention for Clickeen starters:**
```
ck-{widgetType}-{theme/variant}
Examples:
  ck-faq-christmas
  ck-faq-minimal-dark
```

---

## Systems

| System | Purpose | Runtime | Repo Path |
|--------|---------|---------|-----------|
| **Prague** | Marketing site + gallery | Cloudflare Pages | `prague/` |
| **Bob** | Widget builder app | Cloudflare Pages (Next.js) | `bob/` |
| **Venice** | SSR embed runtime | Cloudflare Workers | `venice/` |
| **Paris** | HTTP API gateway | Cloudflare Workers | `paris/` |
| **San Francisco** | AI Workforce OS (agents, learning) | Workers (D1/KV/R2/Queues) | `sanfrancisco/` |
| **Michael** | Database | Supabase Postgres | `supabase/` |
| **Dieter** | Design system | Build artifacts in Tokyo | `dieter/` |
| **Tokyo** | Asset storage & CDN | Cloudflare R2 | `tokyo/` |
| **Atlas** | Edge config cache (read-only) | Cloudflare KV | — |

---

## Glossary

**Bob** — Widget builder. React app that loads widget definitions from Tokyo (compiled for the editor), holds instance `config` in state, syncs preview via postMessage, publishes via Paris (writes to Michael). Widget-agnostic: ONE codebase serves ALL widgets.

**Venice** — SSR embed runtime. Fetches instance config via Paris and serves embeddable HTML. Third-party pages only ever talk to Venice; Paris is private.

**Paris** — HTTP API gateway (Cloudflare Workers). Reads/writes Michael using service role; handles instances, tokens, submissions, usage, entitlements. Stateless API layer. Browsers never call Paris directly. Issues AI Grants to San Francisco.

**San Francisco** — AI Workforce Operating System. Runs all AI agents (SDR Copilot, Editor Copilot, Support Agent, etc.) that operate the company. Manages sessions, jobs, learning pipelines, and prompt evolution. See `systems/sanfrancisco.md`, `systems/sanfrancisco-learning.md`, `systems/sanfrancisco-infrastructure.md`.

**Michael** — Supabase PostgreSQL database. Stores widget instances, submissions, users, usage events. RLS enabled. Note: starters are just instances with a `ck-` prefix naming convention.

**Tokyo** — Asset storage and CDN. Hosts Dieter build artifacts, widget definitions/assets, and signed URLs for user-uploaded images.

**Dieter** — Design system. Tokens (spacing, typography, colors), 16+ components (toggle, textfield, dropdown-fill, object-manager, repeater, dropdown-edit, etc.), icons. Output is CSS + HTML. Each widget only loads what it needs.

**Atlas** — Cloudflare KV. Read-only runtime cache. Admin overrides require INTERNAL_ADMIN_KEY and CEO approval.

**agent.md** — Per-widget AI contract. Documents editable paths, parts/roles, enums, and safe list operations. Required for AI editing.

---

## Widget Architecture

### Tokyo Widget Folder Structure

```
tokyo/widgets/{widgetType}/
├── spec.json          # Defaults + ToolDrawer markup (<bob-panel> + <tooldrawer-field>)
├── widget.html        # Semantic HTML with data-role attributes
├── widget.css         # Scoped styles using Dieter tokens
├── widget.client.js   # applyState() for live DOM updates
└── agent.md           # AI contract (required for AI editing)
```

### Shared Runtime Modules

All widgets use shared modules from `tokyo/widgets/shared/`:

| Module | Global | Purpose |
|--------|--------|---------|
| `stagePod.js` | `CKStagePod.applyStagePod(stage, pod, scopeEl)` | Stage/pod layout (background, padding, radius, alignment) |
| `typography.js` | `CKTypography.applyTypography(typography, root, roleConfig)` | Typography roles with dynamic Google Fonts loading |
| `branding.js` | `CKBranding` | "Made with Clickeen" backlink display |

### Stage/Pod Architecture

- **Stage** = workspace backdrop (container surrounding the widget)
- **Pod** = widget surface (actual widget container)
- All widgets use `.stage > .pod > [data-ck-widget]` wrapper structure
- Layout options: stage canvas mode (`wrap`/`fill`/`viewport`/`fixed`), background (fill picker), padding per device (`desktop` + `mobile`, linked or per-side), corner radius (linked or per-corner), pod width mode (wrap/full/fixed), pod alignment

### Compiler Modules

Bob's compiler (`bob/lib/compiler/`) auto-generates shared functionality:

**Auto-generated from `defaults` declarations:**
- **Typography Panel** — If `defaults.typography.roles` exists, generates font family, size preset, custom size, style, and weight controls per role
- **Stage/Pod Layout Panel** — If `defaults.stage`/`defaults.pod` exists, injects pod width, alignment, padding, radius controls

**Curated Typography:**
- 17 Google Fonts with weight/style specifications
- Dynamic loading via `CKTypography.applyTypography()`
- Role-based size presets (xs/s/m/l/xl/custom)

---

## Ops Protocol

Edits are expressed as ops (no direct mutation):

```typescript
type WidgetOp =
  | { op: 'set'; path: string; value: unknown }
  | { op: 'insert'; path: string; index: number; value: unknown }
  | { op: 'remove'; path: string; index: number }
  | { op: 'move'; path: string; from: number; to: number };
```

All ops are validated against `compiled.controls[]` allowlist. Invalid ops are rejected fail-closed.

---

## Current Implementation Status

### Systems

| System | Status | Notes |
|--------|--------|-------|
| Bob | ✅ Active | Compiler, ToolDrawer, Workspace, Ops engine |
| Tokyo | ✅ Active | FAQ widget with shared modules |
| Paris | ✅ Active | Instance API, tokens, entitlements, submissions |
| Venice | ⚠️ Partial | Debug shell (full SSR rendering planned) |
| Dieter | ✅ Active | 16+ components, tokens, typography |
| Michael | ✅ Active | Supabase Postgres with RLS |

### Widgets

| Widget | Status | Components Used |
|--------|--------|-----------------|
| FAQ | ✅ Complete | object-manager, repeater, dropdown-edit, toggle, textfield, dropdown-fill, dropdown-actions |

### Dieter Components

`toggle`, `textfield`, `slider`, `dropdown-actions`, `dropdown-fill`, `dropdown-edit`, `choice-tiles`, `segmented`, `tabs`, `object-manager`, `repeater`, `popover`, `popaddlink`, `textedit`, `textrename`, `button`

---

## Working with Code

**Before making changes:**
- Read `WhyClickeen.md` (strategy/vision)
- Read `clickeen-platform-architecture.md` (system boundaries)
- Read the relevant system PRD (`systems/{system}.md`)

**Build & Dev:**
```bash
pnpm install                    # Install dependencies
pnpm build:dieter               # Build Dieter assets first
pnpm build                      # Build all packages

# Development
./scripts/dev-up.sh             # Start all: Tokyo (4000), Paris (3001), Bob (3000), DevStudio (5173)
pnpm dev:bob                    # Bob only
pnpm dev:paris                  # Paris only
pnpm dev:admin                  # DevStudio only

# Quality
pnpm lint && pnpm typecheck
pnpm test

# Compilation safety (deterministic)
node scripts/compile-all-widgets.mjs
```

### Environments (Canonical)

| Environment | Bob | Paris | Tokyo | San Francisco | DevStudio |
|---|---|---|---|---|---|
| **Local** | `http://localhost:3000` | `http://localhost:3001` | `http://localhost:4000` | (optional) `http://localhost:8787` | `http://localhost:5173` |
| **Cloud-dev (from `main`)** | `https://bob.dev.clickeen.com` | `https://paris.dev.clickeen.com` | `https://tokyo.dev.clickeen.com` | `https://sanfrancisco.dev.clickeen.com` | `https://devstudio.dev.clickeen.com` |
| **UAT** | `https://app.clickeen.com` | `https://paris.clickeen.com` | `https://tokyo.clickeen.com` | `https://sanfrancisco.clickeen.com` | (optional) internal-only |
| **Limited GA** | `https://app.clickeen.com` | `https://paris.clickeen.com` | `https://tokyo.clickeen.com` | `https://sanfrancisco.clickeen.com` | (optional) internal-only |
| **GA** | `https://app.clickeen.com` | `https://paris.clickeen.com` | `https://tokyo.clickeen.com` | `https://sanfrancisco.clickeen.com` | (optional) internal-only |

UAT / Limited GA / GA are **release stages** (account-level exposure controls), not separate infrastructure.

### Deterministic compilation contract (anti-drift)

- **Dieter bundling manifest (authoritative)**: `tokyo/dieter/manifest.json`
- **Rule**: ToolDrawer `type="..."` drives required bundles; CSS classnames never add bundles.
- **Compile-all gate**: `node scripts/compile-all-widgets.mjs` must stay green.

**Key Discipline:**
- Runtime code + DB schema are truth. Update docs when behavior changes.
- Preserve what works; no speculative refactors.
- Ask questions rather than guess.
# Multi-Tenancy — The Figma Model

## Core Principle

Clickeen is multi-tenant from day 1 with no artificial caps on collaboration. This is the Figma model: make it easy for teams to adopt, and stickiness compounds.

---

## The Model

| Tier | Viewers | Editors | Widget Types | Instances | Content | Features |
|------|---------|---------|--------------|-----------|---------|----------|
| **Free** | ∞ | 1 | 1 | 1 | Limited | Limited |
| **Tier 1** | ∞ | 3-5 | All | 5-10 | Higher caps | + SEO/GEO |
| **Tier 2** | ∞ | ∞ | All | ∞ | ∞ | + Auto-translate |
| **Tier 3** | ∞ | ∞ | All | ∞ | ∞ | + Supernova |

### Tier Details

**Free:**
- 1 editor (solo use)
- 1 widget type (e.g., only FAQ)
- 1 instance (can't embed on multiple pages)
- Limited content (e.g., max 4 FAQs per section, max 2 sections)
- Limited features (no SEO/GEO, no auto-translate)
- No Supernova
- "Made with Clickeen" branding

**Tier 1:**
- 3-5 editors
- All widget types
- 5-10 instances
- Higher content caps (e.g., 10 FAQs per section)
- SEO/GEO enabled
- No auto-translate, no Supernova
- Branding optional

**Tier 2:**
- Unlimited editors
- All widget types
- Unlimited instances
- Unlimited content
- All features including auto-translate (up to 10 locales)
- No Supernova
- No branding

**Tier 3:**
- Everything in Tier 2
- Unlimited auto-translate locales
- Supernova effects enabled
- Priority support

**Key rules:**
- **Viewers are always unlimited** at every tier (including Free)
- **Viewers can comment** (feedback loop, collaboration without editing)
- **Upgrade drivers:** instances → Tier 1, team size → Tier 2, effects → Tier 3
- **No caps on collaboration** once you hit Tier 2

---

## Why Unlimited Viewers Matters

### 1) Virality Within Organizations

```
Day 1:  Marketer creates FAQ widget
Day 3:  Shares view link with PM → PM comments
Day 7:  PM shares with Product → Product comments
Day 14: Designer joins as editor to improve styling
Day 30: 15 people viewing/commenting, 3 editors
```

Every viewer is a potential editor. Every editor is a potential workspace owner.

### 2) No Friction for Adoption

**Bad model:**
> "You've hit 3 viewers. Upgrade to add more."

User: *finds a different tool*

**Good model (Clickeen):**
> "Invite anyone to view and comment. Upgrade when you need more editors."

User: *invites whole team, becomes dependent on Clickeen*

### 3) Switching Costs Compound

More people in the workspace = harder to leave.

If 20 people are viewing and commenting on widgets, switching means:
- Re-training everyone
- Losing all comment history
- Breaking embedded widgets

**Multi-tenant = stickiness moat.**

---

## Roles

| Role | View | Comment | Edit | Create | Manage Team | Billing |
|------|------|---------|------|--------|-------------|---------|
| **Viewer** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Editor** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Owner** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

**Viewers:**
- Can see all widgets in the workspace
- Can leave comments (feedback, suggestions, approvals)
- Cannot edit or create widgets
- Do not count toward seat limits

**Editors:**
- Can create and edit widgets
- Count toward seat limits (Free/Tier 1)
- Unlimited in Tier 2/3

---

## Workspace Structure

```
Workspace
├── Plan: { tier, billingEmail, ... }
├── Members[]
│   ├── { userId, role: 'owner', joinedAt }
│   ├── { userId, role: 'editor', joinedAt }
│   ├── { userId, role: 'viewer', joinedAt }
│   └── ...
├── WidgetInstances[]
│   ├── { publicId, widgetType, config, createdBy, ... }
│   └── ...
└── Comments[]
    ├── { widgetId, userId, text, createdAt, resolved }
    └── ...
```

**Widgets belong to workspaces, not users.** If an editor leaves, their widgets stay.

---

## Commenting System

Viewers need a way to provide feedback without editing. Comments are:
- Tied to a widget instance
- Optionally tied to a specific field/element (like Figma's comment pins)
- Resolvable (mark as done)
- Visible to all workspace members

### Comment Schema

```typescript
type Comment = {
  id: string;
  workspaceId: string;
  widgetInstanceId: string;
  userId: string;
  text: string;
  target?: {
    path: string;      // e.g., "sections[0].faqs[2].answer"
    elementId?: string; // DOM element reference
  };
  resolved: boolean;
  createdAt: Date;
  updatedAt: Date;
};
```

### UX (Bob)

- Viewer mode: Can view widget, leave comments, cannot edit
- Editor mode: Full editing + can see/resolve comments
- Comment indicator: Badge on widget showing unresolved comment count

---

## Tier Gating (Full Matrix)

| Capability | Free | Tier 1 | Tier 2 | Tier 3 |
|------------|------|--------|--------|--------|
| **Viewers** | ∞ | ∞ | ∞ | ∞ |
| **Editors** | 1 | 3-5 | ∞ | ∞ |
| **Widget types** | 1 | All | All | All |
| **Instances** | 1 | 5-10 | ∞ | ∞ |
| **Content** | Limited | Higher | ∞ | ∞ |
| **SEO/GEO** | ❌ | ✅ | ✅ | ✅ |
| **Auto-translate** | ❌ | ❌ | ✅ (10 locales) | ✅ (∞) |
| **Supernova** | ❌ | ❌ | ❌ | ✅ |
| **Branding** | Required | Optional | None | None |

**Upgrade triggers:**
- "I need another widget type" → Tier 1
- "I need more instances" → Tier 1
- "I want SEO/GEO" → Tier 1
- "Add another editor" blocked at seat limit → Tier 2
- "I want auto-translate" → Tier 2
- "I want Supernova effects" → Tier 3
- Viewers are never blocked

---

## Why This Is The Figma Model

| Figma | Clickeen |
|-------|----------|
| Unlimited viewers on any file | Unlimited viewers on any widget |
| Pay per editor seat | Upgrade tiers unlock more editors |
| Comments on designs | Comments on widgets |
| Workspace = organizing unit | Workspace = organizing unit |
| Switching cost = team is embedded | Switching cost = widgets are embedded everywhere |

---

## Why Multi-Tenant from Day 1

### 1) Enterprise-Ready Without "Contact Sales"

Agencies, marketing teams, and enterprises can self-serve. No sales call required for collaboration.

### 2) AI + Multi-Tenant = Leverage

```
Traditional SaaS:
- 5-seat limit → sales call → negotiation
- Cost: $150K/year sales rep

Clickeen:
- Invite 50 viewers → they upgrade themselves when needed
- SDR Copilot nudges at the right moment
- Cost: $0.001 per conversation
```

### 3) PLG Flywheel

```
Free user → invites team as viewers → viewers comment
→ viewers want to edit → upgrade to add seats
→ more editors → more widgets → more embeds
→ more embeds seen → more signups → repeat
```

---

## Technical Notes

### Paris Enforcement

- Workspace plan includes `maxEditors`
- Adding an editor beyond limit returns `403 SEAT_LIMIT_EXCEEDED`
- Adding viewers always succeeds (no limit check)
- Publish checks workspace entitlements (widget-level features)

### Bob UX

- Role-aware UI: viewers see "View Only" mode, cannot access edit controls
- Invite modal: dropdown for role (Viewer / Editor)
- Seat limit warning: shows remaining editor seats

### Michael Schema

```sql
CREATE TABLE workspace_members (
  workspace_id UUID REFERENCES workspaces(id),
  user_id UUID REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (workspace_id, user_id)
);

CREATE TABLE comments (
  id UUID PRIMARY KEY,
  workspace_id UUID REFERENCES workspaces(id),
  widget_instance_id UUID REFERENCES widget_instances(id),
  user_id UUID REFERENCES users(id),
  text TEXT NOT NULL,
  target_path TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Summary

1. **Viewers are always unlimited** — at every tier, including Free
2. **Viewers can comment** — collaboration without editing
3. **Editor seats are the upgrade lever** — capped in Free/Tier 1, unlimited in Tier 2/3
4. **Widgets belong to workspaces** — portable, team-owned
5. **No sales call for teams** — self-serve collaboration from day 1

This is the Figma model applied to widgets: make adoption frictionless, let stickiness compound, charge for serious usage.

# Supernova — NextGen Web Design

## What Supernova Is

**Supernova** is Clickeen's premium visual technology layer—the cutting-edge design capabilities that make web experiences mindblowing.

> "Supernova is the technological expression of Clickeen's design moat."

### The Core Idea

**Clickeen's moat is Design.** Supernova is how we give that advantage to users.

- Competitors ship functional widgets that look like 2010.
- Clickeen ships widgets that make the web beautiful.
- Supernova unlocks the NextGen technologies that define the modern web.

### What Supernova Includes

| Category | Technologies | What It Does |
|----------|--------------|--------------|
| **Motion** | GSAP, Framer Motion, CSS animations | Movement that delights |
| **Effects** | Three.js, WebGL, particles, shaders | Depth, atmosphere, wow |
| **Micro-interactions** | Lottie, spring physics, magnetic | Polish, responsiveness |
| **Generative Images** | Flux, Midjourney, DALL-E | AI-created visuals, backgrounds, graphics |
| **Generative Video** | Sora, Runway, Pika | AI-created video backgrounds, demos |
| **Future Visual Tech** | WebGPU, View Transitions, spatial | Whatever comes next |

**All visual. All about beauty. All under one premium umbrella.**

### What Supernova Is NOT

| Feature | Where It Lives | Why Not Supernova |
|---------|----------------|-------------------|
| Translation | Auto-translate (Tier 2+) | Localization, not design |
| Content generation | SDR Copilot | Words, not visuals |
| SEO/GEO | Tier 1+ | Indexability, not beauty |
| Analytics | Separate feature | Data, not design |

### The Problem We're Solving

**NextGen visual technologies exist but go unused:**
- GSAP (butter-smooth animations, ScrollTrigger, morphing)
- Three.js / WebGL (3D, particles, shaders)
- Lottie (designer-grade vector animations)
- Framer Motion (physics-based micro-interactions)
- Canvas effects (liquid, noise, particles)
- Generative AI (Flux, Sora, Runway for images/video)
- View Transitions API (page-level cinema)

**Why 99% of websites don't use these:**
1. Too complex to implement (need specialized developers)
2. Easy to break (conflicts with existing code)
3. Hard to maintain (libraries update, things break)
4. Performance concerns (bundle size, Core Web Vitals)
5. No design system integration (custom one-offs)
6. Generative AI is expensive and hard to integrate

**Clickeen's unique position:**
- We control the embed surface (Shadow DOM = isolated, predictable)
- We control the runtime (ship any library, lazy-loaded)
- We control the CDN (Cloudflare Edge = performance optimized)
- We control the editor (expose controls, no code required)
- We control the AI integration (generate visuals, cache on R2)

---

## Plan Gating

| Tier | Supernova Access |
|------|------------------|
| **Free** | ❌ Disabled, "Upgrade" message |
| **Tier 1** | ❌ Disabled |
| **Tier 2** | ❌ Disabled |
| **Tier 3** | ✅ Full Supernova effects |

Supernova is the top-tier differentiator. Lower tiers get full functionality but standard visuals; Tier 3 adds the "wow factor."

**State shape:**

```json
{
  "supernova": {
    "enabled": false,
    "effects": {
      "motion": "spring",
      "hover": "magnetic",
      "scroll": "stagger-fade",
      "celebration": false
    }
  }
}
```

---

## Effect Categories

### 1) Motion (how things move)

| Effect | Description | Library |
|--------|-------------|---------|
| `spring` | Physics-based open/close with overshoot | GSAP, Framer Motion |
| `stagger-fade` | Items fade in one-by-one on scroll | GSAP ScrollTrigger |
| `morph` | Shape transforms into another | GSAP MorphSVG |
| `parallax` | Layers move at different speeds | GSAP, Locomotive |
| `smooth-scroll` | Butter-smooth infinite scroll | GSAP |

### 2) Visuals (how things look beyond CSS)

| Effect | Description | Library |
|--------|-------------|---------|
| `particles` | Floating dots/shapes in background | tsParticles, Three.js |
| `gradient-animate` | Shifting aurora/gradient background | CSS + JS |
| `3d-object` | Rotating 3D model | Three.js |
| `lottie` | Vector animations (characters, icons) | Lottie |
| `confetti` | Celebration burst | canvas-confetti |
| `noise` | Subtle grain/texture overlay | CSS/Canvas |

### 3) Interactions (how things respond to input)

| Effect | Description | Library |
|--------|-------------|---------|
| `magnetic` | Cursor pulls element toward it | GSAP, custom |
| `tilt` | Card tilts based on mouse position | Vanilla-tilt |
| `press` | Satisfying button press animation | CSS + GSAP |
| `drag-physics` | Cards can be thrown, bounce | Framer Motion |
| `cursor-trail` | Custom cursor with trailing effect | Custom |

### 4) Generative Images (AI-created visuals)

| Effect | Description | Provider |
|--------|-------------|----------|
| `gen-background` | AI-generated background image | Flux, DALL-E |
| `gen-pattern` | AI-generated repeating pattern | Midjourney, Flux |
| `gen-icon` | AI-generated custom icons | DALL-E, Ideogram |
| `gen-hero` | AI-generated hero imagery | Flux, Midjourney |
| `gen-avatar` | AI-generated placeholder avatars | Flux |

**How it works:**
- User describes what they want or picks from presets
- AI generates image → cached on R2 (zero egress)
- Served from edge with immutable cache headers
- Generation cost incurred once, served forever

### 5) Generative Video (AI-created motion)

| Effect | Description | Provider |
|--------|-------------|----------|
| `gen-video-bg` | AI-generated video background loop | Sora, Runway |
| `gen-demo` | AI-generated product demo clip | Sora, Pika |
| `gen-transition` | AI-generated transition between states | Runway |

**How it works:**
- User provides prompt or selects from templates
- AI generates video → encoded and cached on R2/Stream
- Served via Cloudflare Stream (adaptive bitrate)
- Generation cost incurred once, served forever

---

## Widget Examples

### Logo Showcase

| Without Supernova | With Supernova |
|-------------------|----------------|
| Static grid, basic CSS hover | Infinite smooth scroll, magnetic hover, morph on click |

### FAQ Accordion

| Without Supernova | With Supernova |
|-------------------|----------------|
| Height slides, icon rotates | Spring physics, elastic icon, staggered content |

### Countdown Timer

| Without Supernova | With Supernova |
|-------------------|----------------|
| Numbers change | 3D flip with shadows, confetti burst on zero |

### Testimonials

| Without Supernova | With Supernova |
|-------------------|----------------|
| Fade carousel | Physics card stack, drag with momentum, Lottie reactions |

---

## Architecture

### Effect Libraries (Tokyo)

```
tokyo/supernova/
  manifest.json           # Effect registry + variants
  gsap/
    full.js               # Desktop: GSAP + ScrollTrigger + MorphSVG
    lite.js               # Mobile: GSAP core only
  three/
    full.js               # Full Three.js
    particles.js          # Particles system only
  lottie/
    player.js             # Full Lottie player
    light.js              # Reduced feature set
  confetti/
    confetti.js           # Canvas confetti
  shared/
    magnetic.js           # Magnetic hover effect
    spring.js             # Spring physics utilities
```

### Generative Assets (R2)

```
r2://supernova-assets/
  {workspaceId}/
    images/
      {assetId}.webp      # Generated images (optimized)
    video/
      {assetId}/
        manifest.mpd      # DASH manifest (adaptive)
        segments/         # Video segments
```

**Generation flow:**
1. User requests generation (prompt or preset)
2. Paris calls external API (Flux, Sora, etc.)
3. Result saved to R2 with workspace-scoped key
4. AssetId stored in widget state (`supernova.generatedAssets[]`)
5. Venice serves from R2 with immutable cache headers

**Cost model:**
- Generation cost: $0.01-0.50 per image, $0.10-2.00 per video
- Serving cost: $0 (R2 zero egress)
- Generation happens once; served forever

### Manifest Schema

```json
{
  "v": 1,
  "gitSha": "...",
  "effects": {
    "gsap": {
      "full": "gsap/full.a1b2.js",
      "lite": "gsap/lite.c3d4.js"
    },
    "three": {
      "full": "three/full.e5f6.js",
      "particles": "three/particles.g7h8.js"
    },
    "lottie": {
      "player": "lottie/player.i9j0.js"
    },
    "confetti": {
      "default": "confetti/confetti.k1l2.js"
    }
  },
  "presets": {
    "motion-spring": ["gsap.lite"],
    "motion-full": ["gsap.full"],
    "particles-simple": ["three.particles"],
    "celebration": ["confetti.default"]
  }
}
```

### Widget Declaration (spec.json)

```json
{
  "supernova": {
    "supported": ["motion", "hover", "scroll", "celebration"],
    "defaultEffects": {
      "motion": "none",
      "hover": "none",
      "scroll": "none",
      "celebration": false
    },
    "libraries": {
      "motion-spring": ["gsap.lite"],
      "hover-magnetic": ["gsap.lite"],
      "scroll-stagger": ["gsap.full"],
      "celebration": ["confetti.default"]
    }
  }
}
```

---

## Loading Strategy (Cloudflare-Optimized)

### Why Bundle Size Isn't a Concern

1. **Edge caching (300+ PoPs)** — Libraries cached globally, sub-10ms latency
2. **R2 zero egress** — No bandwidth cost regardless of library size
3. **HTTP/3 multiplexing** — Parallel loading, no head-of-line blocking
4. **Early Hints (103)** — Preload before HTML parse
5. **Brotli compression** — Automatic, best-in-class
6. **Smart splitting (Workers)** — Device/connection-aware variants

### Context-Aware Loading

```javascript
// Venice/loader determines variant based on context
const ua = request.headers.get('user-agent');
const saveData = request.headers.get('save-data');
const connection = request.cf?.httpProtocol;

if (isMobile(ua) || saveData === 'on') {
  return serve('gsap.lite.js');    // 20KB
} else {
  return serve('gsap.full.js');    // 80KB
}
```

### Lazy Hydration Pattern

```html
<!-- Widget shell renders instantly (no Supernova dependency) -->
<div class="ck-faq" data-supernova="spring,magnetic">
  <!-- FAQ content visible immediately -->
</div>

<script>
  // Effects load AFTER content visible (no LCP impact)
  if (!prefersReducedMotion() && supernovaEnabled) {
    import('https://tokyo.clickeen.com/supernova/gsap.lite.js')
      .then(() => initSupernovaEffects());
  }
</script>
```

---

## Editor UI (Bob)

### Supernova Panel

```html
<bob-panel id="supernova">
  <tooldrawer-cluster>
    <tooldrawer-eyebrow text="Supernova Effects" />
    <tooldrawer-field 
      type="toggle" 
      path="supernova.enabled" 
      label="Enable Supernova" 
      plan-gate="pro"
    />
  </tooldrawer-cluster>
  
  <tooldrawer-cluster show-if="supernova.enabled == true">
    <tooldrawer-eyebrow text="Motion" />
    <tooldrawer-field 
      type="dropdown-actions" 
      path="supernova.effects.motion" 
      label="Animation style"
      options='[
        {"label":"None","value":"none"},
        {"label":"Spring physics","value":"spring"},
        {"label":"Elastic","value":"elastic"},
        {"label":"Smooth","value":"smooth"}
      ]'
    />
  </tooldrawer-cluster>
  
  <tooldrawer-cluster show-if="supernova.enabled == true">
    <tooldrawer-eyebrow text="Hover" />
    <tooldrawer-field 
      type="dropdown-actions" 
      path="supernova.effects.hover"
      label="Hover effect"
      options='[
        {"label":"None","value":"none"},
        {"label":"Magnetic pull","value":"magnetic"},
        {"label":"Tilt 3D","value":"tilt"},
        {"label":"Glow","value":"glow"}
      ]'
    />
  </tooldrawer-cluster>
</bob-panel>
```

### Plan Gating UX

For users below Tier 3, the toggle shows:
> ☐ Enable Supernova — *Upgrade to unlock*

Clicking opens upgrade modal with Supernova showcase.

---

## Accessibility

### `prefers-reduced-motion` Support

```javascript
function supernovaEnabled() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return false; // Respect user preference
  }
  return state.supernova?.enabled === true;
}
```

All Supernova effects automatically disable when user prefers reduced motion. The widget remains fully functional—just without animations.

### Fallback Behavior

| Supernova enabled | Reduced motion | Result |
|-------------------|----------------|--------|
| ✅ | ❌ | Full effects |
| ✅ | ✅ | No effects, functional widget |
| ❌ | Any | No effects, functional widget |

---

## Performance Contracts

### Core Web Vitals Guarantees

| Metric | Guarantee |
|--------|-----------|
| **LCP** | No impact (effects load after content) |
| **FID** | No impact (effects don't block interaction) |
| **CLS** | No impact (effects don't change layout) |
| **INP** | < 50ms for any Supernova interaction |

### How We Achieve This

1. **Shell-first rendering** — Widget content appears before effects load
2. **Lazy hydration** — Effects initialize after LCP
3. **GPU acceleration** — Use `transform`/`opacity` only (no layout thrash)
4. **Frame budget** — All animations capped at 60fps
5. **Mobile reduction** — Lighter effects on mobile by default

---

## Verification

### Acceptance Criteria

1. **Toggle works**: `supernova.enabled` toggles effects on/off
2. **Plan gating**: Free users see "Upgrade to Pro" message
3. **Lazy loading**: Effects don't block initial render (LCP unchanged)
4. **Reduced motion**: Effects disabled when `prefers-reduced-motion: reduce`
5. **Mobile variant**: Lighter bundle served to mobile devices
6. **Edge caching**: Effect libraries return `cache-control: immutable`

---

## The Moat

### Supernova Is The Design Moat, Technologized

Clickeen's strategic moat #3 is **Design-Led Culture**. Supernova is how we weaponize that moat:

| Layer | What It Means |
|-------|---------------|
| **Free tier** | Clean, solid, well-designed (already better than competitors' paid) |
| **Supernova tier** | Mindblowing — motion, effects, AI-generated visuals, the full arsenal |

### Why Competitors Can't Copy This

| Requirement | Clickeen | Incumbents |
|-------------|----------|------------|
| **Design DNA** | Architect is a designer | Engineering-led, functional but dated |
| **Embed isolation** | Shadow DOM | Legacy iframe/inline |
| **CDN architecture** | Cloudflare Edge, zero egress | Traditional CDN, cost per byte |
| **Generative AI infra** | R2 caching, one-time gen cost | Would need new infra |
| **Lazy loading** | Context-aware at edge | One-size-fits-all |
| **Tier gating** | State-level, server-enforced | Would need rewrite |
| **Codebase** | Modern, designed for this | 15 years of tech debt |

### The Pitch

> "Your competitors use widgets that look like 2010.
> You paste one line and go Supernova."

> "GSAP. Three.js. Flux. Sora.
> The technologies that define the modern web.
> With Clickeen Supernova, paste one line. Make it beautiful."

> "Supernova: The technologies that make the web beautiful."

---

## References

- WhyClickeen.md — Supernova as a moat
- WidgetArchitecture.md — How widgets declare Supernova support
- HowWeBuildWidgets.md — Implementing Supernova in a widget

STATUS: REFERENCE — LIVING DOC (MAY DRIFT)
This document describes the intended boundary between Paris and San Francisco.
When debugging reality, treat runtime code, `supabase/migrations/`, and deployed Cloudflare config as truth.
If you find a mismatch, update this document; execution continues even if docs drift.

# System: San Francisco — AI Workforce Operating System

## The Workforce OS

**Clickeen is an AI-first company.** San Francisco is not just a feature—it's the **operating system for the company's AI workforce**.

Traditional SaaS companies need 30-100+ people to operate at scale. Clickeen operates with **1 human + AI agents**:

| Agent | Role | Traditional Equivalent |
|-------|------|------------------------|
| SDR Copilot | Convert visitors in Minibob | Sales team (5-20 people) |
| Editor Copilot | Help users customize widgets | Product specialists |
| Support Agent | Resolve user issues | Support team (5-15 people) |
| Marketing Copywriter | Funnels, landing pages, PLG copy | Marketing team (3-10 people) |
| Content Writer | Blog, SEO, help articles | Content team (2-5 people) |
| UI Translator | Product localization | Localization team (5+ people) |
| Ops Monitor | Alerts, incidents, monitoring | DevOps/SRE (2-5 people) |

**Every agent learns automatically** from outcomes—improving prompts, accumulating golden examples, and evolving over time. Day 1 agents are mediocre. Day 100 agents are excellent.

See also:
- `sanfrancisco-learning.md` — How agents learn from outcomes
- `sanfrancisco-infrastructure.md` — Sessions, jobs, state management

---

## Technical Purpose

San Francisco is Clickeen's **AI execution service**: it runs copilots and operational agents at scale, calling LLM providers and returning strictly-structured outputs.

At GA scale (100s of widgets, millions of installs), San Francisco must be **isolated** from:
- Paris’s DB authority and product entitlements logic
- The editor’s real-time in-memory edit loop

## The Core Boundary (Non‑Negotiable)

### Paris (Policy + Persistence)
Paris is the **product authority** and **DB gateway**.
- Auth, workspace membership, paid/free entitlements
- View/install limits, widget count limits, publish permissions
- Instance read/write (Michael via Supabase service role)
- Audit/billing-oriented usage records
- Issues **AI Grants** (described below)

Boundary (explicit ownership):
- LLM provider keys and model execution live in San Francisco.
- Agent orchestration (routing, prompts, tools) lives in San Francisco.

### San Francisco (Execution + Orchestration)
San Francisco is the **AI runtime**.
- Holds provider keys
- Chooses provider/model for a given **Agent** within the constraints of the **AI Grant**
- Enforces AI execution limits (tokens/$ budgets, concurrency, timeouts)
- Executes agents (copilot, support, community manager, etc.)
- Returns **structured results + usage metadata**

Boundary (explicit ownership):
- Policy, entitlements, and persistence live in Paris.
- San Francisco executes based on the AI Grant + request payload and returns structured results.

## Why This Separation Exists (GA Reality)
At scale, AI workloads are bursty, slow, and failure-prone; instance APIs must remain boring and stable.
Keeping Paris and San Francisco separate prevents:
- AI incidents from degrading instance CRUD/publish
- Frequent AI changes from forcing risky deploys of core DB logic
- Agent-security concerns (prompt injection, tool permissions) from expanding Paris’s attack surface

## Key Product Invariants
- **Editor is strict**: invalid edits are rejected immediately and surfaced.
- **AI edits are machine diffs**: editor agents return `ops[]` rather than prose instructions.
- **Provider selection is explicit**: outages return explicit errors.
- **Provider calls are server-side**: browsers talk only to Clickeen surfaces.

## Terms (Precise)
- **Agent**: A named AI capability (e.g. `editor.faqAnswer`, `support.reply`, `ops.communityModeration`).
- **AI Grant**: A signed authorization payload from Paris that defines what San Francisco is allowed to do for a subject (user/workspace) for a short time window.
- **Execution Request**: The payload sent to San Francisco containing `agentId`, input, and the AI Grant.
- **Result**: Structured output from San Francisco (`ops[]` for editor agents, or a typed payload for non-editor agents).

## High‑Level Data Flow

### Editor agents (inside Clickeen app)
1) Bob loads an instance via Paris (`GET /api/instance/:publicId`).
2) Bob requests a short‑lived **AI Grant** from Paris (`POST /api/ai/grant`) for that editing session.
3) Bob calls San Francisco with `{ grant, agentId, input, context }`.
4) San Francisco returns `{ ops[], usage }`.
5) Bob applies `ops[]` locally as pure state transforms. If an op cannot be applied, Bob fails loudly (platform bug) and the developer fixes the widget/package or copilot output.

### Operational agents (Clickeen’s internal workforce)
- A worker (or scheduled job) triggers an execution request to San Francisco using a **service grant** issued by Paris (or by an internal service issuer with Paris-level authority).
- Result is used to create tickets, draft responses, or propose actions (depending on the agent’s permissions/tools).

## Runtime Reality (what’s actually shipped)

San Francisco is deployed as a **Cloudflare Worker** and currently ships:

- Endpoints:
  - `GET /healthz`
  - `POST /v1/execute`
  - `POST /v1/outcome` (outcome attach, signed by Paris)
- Cloudflare bindings:
  - `SF_KV` (sessions)
  - `SF_EVENTS` (queue for async event ingestion)
  - `SF_D1` (queryable indexes)
  - `SF_R2` (raw event storage)
- Agent IDs currently recognized by the worker:
  - `sdr.copilot`
  - `sdr.widget.copilot.v1`
  - `debug.grantProbe` (dev only)

This matters because the “learning loop” is not theoretical: every `/v1/execute` call enqueues an `InteractionEvent`, and the queue consumer writes raw payloads to R2 + indexes a small subset into D1.

## Contracts

### AI Grant (issued by Paris)
Paris computes grants from paid/free entitlements and returns a **signed** token to the caller.

Requirements:
- San Francisco MUST verify the signature and expiry.
- Grants are short-lived (minutes), scoped (capabilities), and revocable by key rotation.
- Grants encode only allowed capabilities/budgets; pricing-tier rules live elsewhere.

Shape (conceptual):
```ts
type AIGrant = {
  v: 1;
  iss: 'paris';
  sub:
    | { kind: 'anon'; sessionId: string } // Minibob / public experiences
    | { kind: 'user'; userId: string; workspaceId: string } // Clickeen app
    | { kind: 'service'; serviceId: string }; // internal automation
  exp: number; // epoch seconds
  caps: string[]; // allowed capabilities, e.g. ['agent:sdr.copilot']
  budgets: {
    maxTokens: number;
    timeoutMs?: number;
    maxCostUsd?: number;
    maxRequests?: number; // optional session window
  };
  mode: 'editor' | 'ops'; // editor copilots vs operational agents
  trace: { sessionId?: string; instancePublicId?: string };
};
```

#### Grant format (shipped)

San Francisco verifies grants using an HMAC signature shared with Paris (`AI_GRANT_HMAC_SECRET`).

Format:
`v1.<base64url(payloadJson)>.<base64url(hmacSha256("v1.<payloadB64>", AI_GRANT_HMAC_SECRET))>`

### Results (from San Francisco)
San Francisco always returns a **structured** result (never prose instructions).
- Editor agents return `ops[]` only.
- Non-editor agents return a typed JSON payload per agent.
```ts
type EditorAIResult = {
  requestId: string;
  ops: Array<{ op: 'set' | 'insert' | 'remove' | 'move'; path: string; value?: unknown; index?: number; from?: number; to?: number }>;
  usage: {
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    costUsd?: number;
    latencyMs: number;
  };
};
```

### Errors (explicit, typed)
No silent behavior changes. All failures are explicit.
```ts
type AIError =
  | { code: 'GRANT_INVALID'; message: string }
  | { code: 'GRANT_EXPIRED'; message: string }
  | { code: 'CAPABILITY_DENIED'; message: string }
  | { code: 'BUDGET_EXCEEDED'; message: string }
  | { code: 'PROVIDER_ERROR'; message: string; provider: string }
  | { code: 'BAD_REQUEST'; message: string; issues?: Array<{ path: string; message: string }> };
```

## Public Interfaces

### Paris (adds AI Grant issuance)
Paris remains the public boundary.

Shipped (dev/local in this repo):
1) **Grant issuance**
   - `POST /api/ai/grant`
   - Returns `{ grant, exp, agentId }`
   - Grant includes `trace.envStage` (ex: `local` or `cloud-dev`) so San Francisco can index learning data by exposure stage.
   - This same endpoint can be used to refresh a grant (if a session is long-lived and the old grant expires).
2) **Outcome forwarding**
   - `POST /api/ai/outcome`
   - Paris signs the payload with `AI_GRANT_HMAC_SECRET` and forwards to San Francisco `/v1/outcome` using `SANFRANCISCO_BASE_URL`.

Possible future (product ergonomics):
- Return a grant on instance load (`GET /api/instance/:publicId`) to reduce one extra round trip per chat session.

Paris does NOT execute AI calls. It only issues grants and forwards outcomes.

### San Francisco (AI execution service endpoints)
This is a separate deployable service (Cloudflare Workers) from day one.

#### `GET /healthz`
Health check for deploys and local dev.

Response: `{ ok: true, service: "sanfrancisco", env: "dev|prod|...", ts: <ms> }`

#### `POST /v1/execute`
Execute an agent under a Paris-issued grant.

Request:
```json
{
  "grant": "<string>",
  "agentId": "sdr.widget.copilot.v1",
  "input": {},
  "trace": { "requestId": "optional-uuid", "client": "minibob|bob|ops" }
}
```

Response:
```json
{ "requestId": "uuid", "agentId": "sdr.widget.copilot.v1", "result": {}, "usage": {} }
```

Behavior:
- verifies grant signature + expiry
- asserts capability `agent:${agentId}`
- executes the agent
- enqueues an `InteractionEvent` into `SF_EVENTS` (non-blocking)

#### `POST /v1/outcome`
Attach post-execution outcomes (UX decisions, conversions) that San Francisco cannot infer.

- Request: `OutcomeAttachRequest` (see `sanfrancisco/src/types.ts`)
- Auth: required header `x-paris-signature` = `base64url(hmacSha256("outcome.v1.<bodyJson>", AI_GRANT_HMAC_SECRET))`
- Writes: D1 rows in `copilot_outcomes_v1`

Why it exists: San Francisco can’t infer conversions; Paris (and Bob) are the sources of truth for those moments.

## Agent Orchestration (San Francisco Core)
Orchestration is San Francisco’s “meat” and is built incrementally behind the same execution interface.

Phase‑1 (shipped orchestration surface):
- Multiple agents behind the same `/v1/execute` interface:
  - `sdr.copilot`
  - `sdr.widget.copilot.v1` (Minibob/Bob widget editing Copilot)
  - `debug.grantProbe` (dev only)
- Provider/model is explicit per agent; strict errors if unavailable (no silent provider switching).
- No general “tool” system yet; any extra capabilities must be explicitly implemented inside the agent (for example: `sdr.widget.copilot.v1` includes bounded, SSRF-guarded single-page URL reads + Cloudflare HTML detection).
- Always returns structured JSON (never “go edit X” prose), plus usage metadata.

GA roadmap (still behind the same interface):
- Agent registry (configs in code or a San Francisco-owned store)
- Provider/model selection rules per agent (explicit, versioned)
- Tool allowlists per agent (e.g. `tool:analyzeUrl`, `tool:searchDocs`)
- Background execution for operational agents (queues/workers)

## Limits (Paris vs San Francisco)

### Paris limits (product policy)
Examples:
- can the user access Copilot at all?
- free vs paid feature gates
- product usage limits (views/installs/widgets)

### San Francisco limits (AI execution)
Examples:
- per-agent concurrency and throughput
- token/$ budgets per grant/session
- provider quotas and timeouts

These are different classes of limits and must not be mixed.

## Security
- San Francisco verifies grant signatures and expiry.
- San Francisco enforces capability allowlists from the grant.
- San Francisco enforces per-request budgets and concurrency.
- Bob never receives provider keys.

## Operational Specs (shipped)

### Concurrency guard
San Francisco applies a per-isolate in-flight cap to fail fast under load.
If the cap is exceeded, the worker returns `429` with `BUDGET_EXCEEDED` (this prevents tail-latency collapse).

### Event ingestion (best-effort by design)
Execution responses must not block on logging/indexing. The queue pipeline is intentionally best-effort:
- failures are logged to console
- execution still returns a structured result

### Storage layout (shipped)

- Raw event payloads (R2): `logs/{ENVIRONMENT}/{agentId}/{YYYY-MM-DD}/{requestId}.json`
- Queryable indexes (D1):
  - `copilot_events_v1` (one row per interaction; versions + intent/outcome + basic deltas)
  - `copilot_outcomes_v1` (one row per `requestId+event`; attached by Paris/Bob)

## Roadmap (milestones)

This section is a planning artifact. The shipped reality is captured in:
- “Runtime Reality (what’s actually shipped)” (above)
- `documentation/ai/infrastructure.md`
- `documentation/ai/learning.md`

### Milestone 0 — Documentation cleanup
Status: shipped (ongoing)

Definition of done:
- System boundary docs exist and are kept in sync with shipped code.
- Older narrative docs remain allowed, but must not be mistaken for runtime truth.

### Milestone 1 — San Francisco service scaffold
Status: shipped

Definition of done:
  - New service deployable exists (Cloudflare Workers).
  - Health endpoint and base `POST /v1/execute` handler exists (returns typed errors).

### Milestone 2 — Ship `sdr.copilot` (Minibob)
Status: shipped

Definition of done:
  - `agentId: sdr.copilot` works end-to-end in San Francisco
  - Response is structured JSON + usage metadata (no prose-only responses)

### Milestone 3 — Paris issues AI grants (anon + user)
Status: shipped (dev grants; user/workspace grants evolve with auth)

Definition of done:
  - Paris can issue signed grants for:
    - anon sessions (Minibob)
    - user/workspace sessions (Clickeen app)
  - San Francisco verifies signature + expiry + capabilities

### Milestone 4 — Bob uses San Francisco for AI
Status: shipped

Definition of done:
- Bob no longer calls provider APIs directly.
- Bob calls San Francisco with the Paris-issued grant.
- Errors are explicit; no silent behavior changes.

### Milestone 5 — Remove Bob-local AI route
Status: shipped (implemented as thin proxies)

Definition of done:
- Deleted `bob/app/api/ai/faq-answer/route.ts` (FAQ-only route removed).

## Open Questions (next)
- Grant transport: return grant in `GET /api/instance/:publicId` vs separate `POST /api/ai/grant` (both work; choose based on desired session semantics).
- Where AI usage is recorded for billing: Paris-only ledger via an internal San Francisco→Paris report, or a later aggregation pipeline.

## Links
- Paris system PRD: `documentation/services/paris.md`
- Bob system PRD: `documentation/services/bob.md`
