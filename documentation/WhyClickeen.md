# Why Clickeen

STATUS: INFORMATIVE — CONTEXT ONLY
This page explains what we're building and why. It is not a spec.
For implementation, see:
- documentation/CONTEXT.md (glossary, widget list, precedence)
- documentation/systems/ (system PRDs: Venice, Paris, Bob, Copenhagen, etc.)
- documentation/widgets/ (widget PRDs: content.faq, testbutton, etc.)

---

## Manifesto (Why We Exist)
Software today is broken:
- Companies overspend on sales and marketing, making tools expensive
- Products are bloated, complex, and painful to adopt
- Small businesses are locked out, enterprises are overcharged

Clickeen is different:
- **Designer-led** — obsessed with simplicity and craft.
- 100% product-led — no sales team, no friction
- **AI-native** — built from day one to be understood and modified by AI  

---

## How Clickeen Works

Clickeen provides embeddable widgets that businesses add to their websites with one line of code.

Core definitions
- Widget: a functional unit (e.g., contact form, FAQ, pricing table)
- Template: a pre-designed visual style for that widget (e.g., minimal, modern, playful)
- Instance: your saved copy of a template with your edits (private to your workspace)
- Single tag: inline = iframe; overlays/popups = script; both load Venice SSR HTML
- Templates are data: switching templates changes config, not code

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
- MiniBob loads with that specific widget already instantiated and ready to edit
- User can customize config (text, colors, etc.) AND switch templates inside MiniBob
- Preview updates live as they edit
- No signup needed to experiment
- **NO Save button** in MiniBob
- **NO "Copy Code" button** in MiniBob
- Only one button: **"Publish"**

Publish triggers signup
- When visitor clicks "Publish", they're prompted to create a free account
- After signing up, they land in the authenticated app (Bob) and the widget they just built is claimed to their workspace
- The widget is now published and they can copy the embed code

Inside the app (authenticated Bob)
- **"Copy Code" button always visible** — get embed snippet anytime
- **"Save" button appears when dirty** — shows when local changes differ from server state
- Clicking Save persists changes to Paris (explicit user action, NO auto-save)
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

## Why This PLG Motion Works: Superior Execution

While the `build -> signup -> embed` flow is standard, our execution is radically better. Our competitors are engineering-led, resulting in functional but clunky, bloated, and uninspired products.

Clickeen is architected by a designer. We win by delivering a 100x better user experience, focusing on craftsmanship and simplicity that others structurally cannot.

- **Zero-Friction Experience**: We don't just offer a free builder; we make it instant, intuitive, and delightful. Our obsession with speed and simplicity (codified in specs like `bob.md`) creates a "time to value" that feels effortless compared to the friction-filled builders of our competitors.
- **Delight as a Weapon**: We treat motion, timing, and a "no jank" policy as core requirements, not afterthoughts. This commitment to high-fidelity craftsmanship creates a product that doesn't just work better—it *feels* better to use.

Natural upgrade path
- Need a second widget (free allows one)
- Want professional appearance (remove branding)
- Need premium templates or advanced options

Distribution loop (core growth mechanism)
1) Every free widget displays “Made with Clickeen”  
2) Visitors see the widget in use  
3) Some click through (viral coefficient = % of viewers who become new users)  
4) They create their own widget  
5) Loop repeats

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
- Everything is tokenized (widgets, templates, components, schemas)
- Attributes-only contracts (`data-variant="primary"` not `class="btn-blue-500"`)
- Single source of truth (Dieter showcase HTML is canonical)
- Structured JSON schemas for every widget type
- Complete API contracts (Paris/Venice/Geneva documented)
- Migration history capturing every decision

**Result:** AI can actually work:
- Read widget schema → know what's editable
- Read Dieter showcase → generate correct UI
- Read Paris API docs → make correct calls
- Read user's config → understand current state
- Map "make button red" → `{ color: "red" }` → Paris PUT → Done

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
AI: *reads widget schema* "engagement.contact has fields array"
AI: *reads Paris docs* "PUT /api/instance/:id with config.fields[]"
AI: *makes API call* { config: { fields: [...existing, {type: "email"}] } }
AI: "Added email field"
User: *sees it working immediately in preview*
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
