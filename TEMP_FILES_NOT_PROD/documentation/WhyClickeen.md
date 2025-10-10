# Why Clickeen

STATUS: INFORMATIVE — CONTEXT ONLY  
This page explains what we’re building and why. It is not a spec.  
For implementation, see:
- documentation/CRITICAL-TECHPHASES/Techphases.md
- documentation/CRITICAL-TECHPHASES/Techphases-Phase1Specs.md
- documentation/systems/venice.md
- documentation/systems/paris.md
- documentation/systems/geneva.md

---

## Manifesto (Why We Exist)
Software today is broken:
- Companies overspend on sales and marketing, making tools expensive  
- Products are bloated, complex, and painful to adopt  
- Small businesses are locked out, enterprises are overcharged  

Clickeen is different:  
- 100% product-led — no sales team, no friction  
- AI-native — rebuilt fast and simple  
- Affordable, beautiful, and self-serve  

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
- Any visitor can open the builder, pick a widget, customize it, and preview it live.
- No signup is needed to experiment.

Create a free account (app)
- When a visitor clicks “Copy code / Embed on my site”, they’re prompted to create a free account.
- After signing up, they land in the app and the widget they just built is auto-saved.
- Inside the app they can copy the embed code, continue editing, and manage the widget.

What a free account provides
- Ability to embed and manage widgets on your own site
- Edit an already-embedded widget
- View collected data
- Save configurations permanently
- Create additional widgets

Free vs Paid boundaries
- Free: one active widget, “Made with Clickeen” branding on
- Paid: unlimited widgets, no branding, premium templates
- Technical note for implementers: third-party pages only ever talk to Venice; Paris stays private to Studio/app surfaces and Venice’s proxy calls.

---

## Why This PLG Motion Works

Zero-friction entry
- No signup, no demo, no sales call. A working widget in minutes.

Value-first sequence
- Traditional SaaS: Account → Trial → Setup → maybe Value
- Clickeen: Value → Embed → Account (when needed) → Pay (when limited)

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
- documentation/CRITICAL-TECHPHASES/Techphases-Phase1Specs.md (Phase‑1 authority)
- documentation/CRITICAL-TECHPHASES/Techphases.md (global contracts)
- documentation/systems/ (system PRDs/specs)

- Phase 1 (Current): Widget platform with viral distribution  
- Phase 2 (Future): SMB SaaS tools — not specified here  
- Phase 3 (Future): Enterprise platform — not specified here  

Do not implement Phase 2/3 features. Assume Phase 1 only unless Techphases specifies otherwise.

---

## Phase‑1 Success Metrics

- 10,000+ free users with embedded widgets  
- 100+ paying customers (~1% conversion)  
- 5,000+ unique domains running widgets  
- <5 minutes from landing page to embedded widget  
- While keeping embed loader ≤28KB gzipped and each widget ≤10KB gzipped (see Techphases.md)

---

## Guiding Principles

When making product decisions, optimize for:
1) Time to value — how fast the user gets benefit  
2) Viral coefficient — whether this increases distribution  
3) Natural upgrades — whether this drives organic paid conversion  
4) Simplicity — remove steps, fields, or choices whenever possible

Rule of thumb: when in doubt, choose the path that delivers value faster with less friction.

---

## Out of Scope Here

- APIs, schemas, caching, tokens, and CSP details
- Service/runtime choices and deployments

See Techphases.md for authoritative technical phases and constraints, and systems docs (Venice/Paris/Geneva) for specifications.
