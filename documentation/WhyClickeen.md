# Why Clickeen

STATUS: INFORMATIVE — CONTEXT ONLY
This page explains what we're building and why. It is not a spec.
For implementation, see:
- documentation/CONTEXT.md (glossary, widget list, precedence)
- documentation/systems/ (system PRDs: Venice, Paris, Bob, Copenhagen, etc.)
- documentation/widgets/ (widget PRDs: content.faq, etc.)

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

Core definitions
- **Widget JSON**: complete software definition (the Widget) - ONE file per widget type
- **Widget Instance**: the data the program processes - database row with instanceData 
- **Template**: predefined instanceData configuration within widget JSON (not separate code)
- **publicId**: instance unique identifier in DB
- **widgetName**: unique widget identifier referencing the widget JSON definition
- **instanceData**: specific instance's custom values (user's data)
- Single tag: inline = iframe; overlays/popups = script; both load Venice SSR HTML
- Templates are data: switching templates merges instanceData configurations, same renderer handles all

Widget categories (illustrative, not final)
- Data collection — contact forms, lead capture, surveys
- Social proof — testimonials, reviews, logos
- Information display — FAQs, pricing tables, feature lists
- Engagement — newsletters, popups, announcements

Some widgets collect data (e.g., forms, surveys). Others are presentational (e.g., testimonials, pricing tables). Both follow the same embed → claim → upgrade model.  
The catalog will evolve with demand. Each widget includes multiple professionally designed templates.

---

## The PLG Motion

Play without an account (marketing site)
- Visitor browses widget gallery on clickeen.com (Prague)
- Clicks on a widget card (e.g., "Contact Form", "FAQ", "Testimonials")
- Prague creates draft instance via Paris `POST /api/instance/from-template` with chosen widget + default template
- Prague opens MiniBob (Bob iframe with `?minibob=true&publicId=wgt_xxx`)
- MiniBob loads widget JSON from Paris via `GET /api/widgets/:widgetType` and renders uiSchema controls
- User can customize instanceData (text, colors, etc.) AND switch templates inside MiniBob
- Preview iframe loads Venice SSR: `/e/:publicId?preview=1` and updates live as they edit
- No signup needed to experiment
- **NO Save button** in MiniBob (claim persists on signup)
- **NO "Copy Code" button** in MiniBob
- Only one button: **"Publish"**

Publish triggers signup
- When visitor clicks "Publish", they're prompted to create a free account
- After signing up, they land in the authenticated app (Bob) and the widget they just built is claimed to their workspace
- The widget is now published and they can copy the embed code

Inside the app (authenticated Bob)
- **"Copy Code" button always visible** — get embed snippet anytime
- User can continue editing, create more widgets, view collected data

What a free account provides
- Ability to publish widgets and get embed code
- Manage published widgets (edit, view submissions, analytics)
- Save configurations permanently to workspace
- Create additional widgets (free plan: 1 active widget limit)

Free vs Paid boundaries
- Free: one active widget, “Made with Clickeen” branding on
- Paid: unlimited widgets, no branding, premium templates
- Technical note for implementers: third-party pages only ever talk to Venice; Paris stays private to Bob (builder app) surfaces and Venice’s proxy calls.

---

## How We Execute: Designer-Led Excellence

Our PLG motion works because we obsess over execution quality. Our competitors are engineering-led, resulting in functional but clunky, bloated, and uninspired products.

Clickeen is architected by a designer. Our design-led culture creates a product that feels better to use, which compounds into our viral loop. This disciplinary advantage is hard to replicate because it requires taste, not just engineering talent.

- **Zero-Friction Experience**: We don't just offer a free builder; we make it instant, intuitive, and delightful. Our obsession with speed and simplicity creates a "time to value" that feels effortless compared to competitors. Bob is widget-agnostic - ONE codebase serves ALL 100 widgets by reading JSON definitions.
- **Delight as a Weapon**: We treat motion, timing, and a "no jank" policy as core requirements, not afterthoughts. This commitment to high-fidelity craftsmanship creates a product that feels better to use.

Natural upgrade path
- Need a second widget (free allows one)
- Want professional appearance (remove branding)
- Need premium templates or advanced options

### Strategic Moat: Product-Led Growth with Viral Loop

The viral distribution loop is a **structural competitive advantage** that compounds over time:

1) Every free widget displays "Made with Clickeen"
2) Visitors see the widget in use
3) Some click through (viral coefficient = % of viewers who become new users)
4) They create their own widget
5) Loop repeats exponentially

**Why this is a moat:**
- Every free widget is a distribution channel (competitors can't replicate without destroying their sales model)
- Viral loops compound exponentially over time
- Network effects increase switching costs (embed multiple widgets, lock in data)
- Viral coefficient improves with product quality (design-led excellence enables higher conversion)
- Self-reinforcing: more widgets → more distribution → more users → more widgets

Multiplier effect (account expansion)
- Success with the first widget → add another for consistency
- Each widget increases switching costs (embed + data)
- Each widget expands viral surface area (more exposure)

---

## Phase Boundaries

Important: This page gives strategic context only.
Implementation scope, technical specs, and priorities are defined in:
- documentation/CONTEXT.md (Phase-1 widget list, glossary, precedence rules)
- documentation/systems/ (system PRDs: Venice, Paris, Bob, Copenhagen, etc.)
- documentation/widgets/ (widget PRDs for each widget type)

- Phase 1 (Current): Widget platform with viral distribution
- Phase 2 (Future): SMB SaaS tools — not specified here
- Phase 3 (Future): Enterprise platform — not specified here

Do not implement Phase 2/3 features. Assume Phase 1 only unless CONTEXT.md specifies otherwise.

---

## Phase‑1 Success Metrics

- 10,000+ free users with embedded widgets  
- 100+ paying customers (~1% conversion)  
- 5,000+ unique domains running widgets  
- <5 minutes from landing page to embedded widget  
- While keeping embed loader ≤28KB gzipped and each widget ≤10KB gzipped (see venice.md)

---

## The AI-Native Architecture (Strategic Moat)

Clickeen was architected from day one to be understood, navigated, and modified by AI. This isn't a feature—it's the entire competitive advantage.

### The Context Problem

**AI needs two things to be useful:**
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
- Widget JSON is source of truth - complete software definitions in ONE file per widget type
- Templates are predefined instanceData configurations within widget JSON (not separate code)
- Bob is DUMB renderer - reads widget JSON uiSchema and displays whatever controls are defined
- Attributes-only contracts (`data-variant="primary"` not `class="btn-blue-500"`)
- Single source of truth (Dieter showcase HTML is canonical)
- Structured JSON schemas for every widget type
- Complete API contracts (Paris/Venice documented)
- Migration history capturing every decision

**Result:** AI can actually work:
- Read widget JSON defaults → know what's editable
- Read widget JSON uiSchema → know how to edit it
- Read Dieter showcase → generate correct UI components
- Read Paris API docs → make correct calls
- Read user's instanceData → understand current state
- Map "make button red" → update instanceData → Venice renders with change

### Why This Is Unfair

**Legacy SaaS:**
```
User: "Add email field to my form"
AI: *reads 500K lines of undocumented React*
AI: *guesses which component to modify*
AI: *breaks 3 other features*
AI: "Done!" (narrator: it didn't work)
```

**Clickeen:**
```
User: "Add email field to my form"
AI: *reads widget JSON* "contact widget has fields array in defaults"
AI: *reads Paris docs* "PUT /api/instance/:id with instanceData.fields[]"
AI: *makes API call* { instanceData: { fields: [...existing, {type: "email"}] } }
AI: "Added email field"
User: *sees it working immediately in Venice SSR preview*
```

### Why Pure Tokens Everywhere

This is why we enforce **attributes-only contracts** and **pure Dieter patterns**:

**Wrong (AI can't understand):**
```html
<div class="btn btn-primary btn-lg rounded-lg px-4 py-2 bg-blue-500">
```

**Right (AI can understand):**
```html
<button class="diet-btn" data-variant="primary" data-size="lg">
```

When everything uses semantic tokens:
- AI reads `data-variant="primary"` and knows what it means
- AI reads Dieter docs and knows how to change it
- AI reads widget schema and knows what values are valid
- No guessing. No breaking things. Just works.

### The Long Game

**Phase 1:** AI helps configure widgets (Bob AI Copilot)
**Phase 2:** AI suggests templates based on goals
**Phase 3:** AI builds entire experiences from natural language
**Phase 4:** AI becomes the interface—no manual UI needed

This only works because we have:
- Complete system documentation
- Tokenized primitives everywhere
- Structured schemas
- Canonical patterns
- Version-controlled ground truth

**Salesforce can't do this.** They'd need to rewrite everything.
**We built this from scratch knowing AI was coming.**

This isn't just an AI feature. **This is the business model.**

### Architectural Enabler: Widget-Agnostic Design

**Key insight:** Bob is completely widget-agnostic.

- **ONE Bob codebase serves ALL 100 widgets**
- Bob reads widget JSON's `uiSchema` and renders whatever controls are defined
- Adding a new widget = add ONE JSON file, Bob automatically works
- Bob has NO widget-specific code - no `if (widgetName === 'faq')` statements
- ToolDrawer is a dumb renderer using Dieter components
- Same renderer architecture: Venice has pure function per widget type

**Why this matters:** This architecture is what makes AI-Native design possible. By eliminating widget-specific code and treating all widgets as data configurations, we create a system AI can understand and modify. This is a consequence of AI-first thinking, not a competitive advantage in itself—any competent architecture team could design similarly. What matters is that we designed this way *from day one*, giving us the structural advantage of complete AI legibility.

---

## Guiding Principles

When making product decisions, optimize for:
1) Time to value — how fast the user gets benefit
2) Viral coefficient — whether this increases distribution
3) Natural upgrades — whether this drives organic paid conversion
4) Simplicity — remove steps, fields, or choices whenever possible
5) **AI legibility** — can AI understand and modify this system?

Rule of thumb: when in doubt, choose the path that delivers value faster with less friction.

When choosing implementation patterns:
- Prefer semantic tokens over utility classes
- Prefer structured schemas over free-form config
- Prefer documented contracts over implicit behavior
- Prefer attributes over complex class names
- **Ask: "Can AI understand this in 5 years?"**

---

## Out of Scope Here

- APIs, schemas, caching, tokens, and CSP details
- Service/runtime choices and deployments

See CONTEXT.md for Phase-1 scope, and system PRDs (Venice/Paris/Bob/Copenhagen) for technical specifications.
