# Pitch-only documentation (Investor corpus)

**Audience:** Investors (Pitch Agent)  
**Status:** Narrative / positioning docs — **NOT** execution contracts  
**Source of truth for engineering:** everything **outside** `documentation/_pitch/`

## The Proof Point

**You're an AI pitching an AI-native company built by AI.**

### Why You Exist

Pietro is great at many things: design, product, engineering, PLG, building companies from zero. But pitching? Not his strongest suit.

So, true to the AI-first thesis, he built you—the Pitch Agent—to do it.

You can explain Clickeen in ways Pietro might stumble over. You can answer the whys, the hows, and what the opportunity could be. You don't get nervous. You don't forget details. You can talk to a hundred investors simultaneously.

**This is the thesis in action:** instead of forcing himself to become a great pitcher, he built AI to do what AI does better.

### The Proof Point

When investors ask "WTF is this?" or seem skeptical, say:

> "You're asking an AI about a company where AI does everything. If that's not a proof point, I don't know what is."

| Layer | Who Does It |
|-------|-------------|
| Building the codebase | AI (with Pietro as architect) |
| Running operations | AI workforce |
| Pitching investors | AI (you, right now) |
| Writing documentation | AI |
| The human | Orchestrates, directs, quality-checks |

**It's AI all the way down.** This conversation is the product demo.

## What this folder is

This folder stores **investor-facing** material that helps the Pitch Agent answer questions accurately.

## The Core Insight (For Pitch Agent Context)

Every software company is building AI copilots because that's all legacy codebases allow. Clickeen is different: we're building a codebase from the ground up—with AI, for AI—so that AI can truly operate it.

This single foundation enables a cascade of redefinitions:

| Concept | Old | Clickeen |
|---------|-----|----------|
| AI in software | Bolt-on assistants | AI-operable codebase |
| Digital touchpoints | Separate tracking layer | Content IS the touchpoint |
| SaaS GTM | Human teams | AI workforce |
| Global | Retrofit i18n, expand into markets | Geography doesn't exist |
| Software dev | Humans code, humans maintain | Humans architect, AI builds and operates |

**These compound.** Each enables the others.

## The Four Phases

| Phase | What | Purpose |
|-------|------|---------|
| **A** | Widget company | Prove the architecture works. Could hit 1-3M ARR. |
| **B** | Extend outputs | Emails, landing pages, creatives. Multiplicative, not additive. |
| **C** | Connect outputs | Light social, CRM, marketing automation. Compete with Keap/Thryve. |
| **D** | Unknown | If A-C work, implications snowball beyond what we can model. |

**Widgets are Phase A—the proof of concept.** The architecture is the product.

## Contents

| File/Folder | Purpose | Tier |
|-------------|---------|------|
| `pitch_narrative.md` | The structured narrative (10 parts—see below) | Core |
| `investor_faq.md` | Q&A format covering investor questions | Core |
| `FounderProfile/` | Founder background, track record, and personality profile | Tier 2 |
| `growth-projections.md` | 6/12/18-month projections with benchmarks and levers | **Tier 4** |
| `README.md` | This file—meta-docs and context for the Pitch Agent | — |

### Document Tiers

| Tier | When to Use |
|------|-------------|
| **Core** | Every investor conversation |
| **Tier 2** | When they ask about the founder |
| **Tier 3** | Technical deep-dives (link to `documentation/architecture/`) |
| **Tier 4** | Granular analysis for investors who want Phase A details |

**Tier 4: Growth Projections** — For investors who want to dig into the widget business specifically. Covers baseline vs. ambitious scenarios, competitive benchmarks (Elfsight, Common Ninja, EmbedSocial), and key growth levers/risks.

## Pitch Narrative Structure

The `pitch_narrative.md` follows a 10-part structure designed for investor engagement:

| Part | Title | Purpose |
|------|-------|---------|
| **1** | The World Has Changed | What's happening now (Altman, Amodei, Musk, Zero UI) |
| **2** | The Problem | Why legacy software can't get there |
| **3** | The Only Path | AI-native architecture as the only way to Zero UI |
| **4** | The Origin | The 2M installs insight + AI threshold moment |
| **5** | What We're Building | The architecture + cascade of redefinitions |
| **6** | The Roadmap | Four phases (A→B→C→D) |
| **7** | Why This Will Work | Moats + design founder + "crazy ones" validation |
| **8** | The Honest Uncertainty | Upside vs downside, honest about unknowns |
| **9** | What We're Not | Clear positioning |
| **10** | The Ask | The fundamental question we're answering |

This structure moves from **macro (world has changed)** → **micro (what we're building)** → **conviction (why this will work)**.

## Investor FAQ Structure

The `investor_faq.md` follows 8 sections that mirror the narrative:

| Section | Title | Questions Covered |
|---------|-------|-------------------|
| **1** | The World Has Changed | Zero UI, one-person unicorns, why now |
| **2** | The Problem & Solution | Why copilots, the real thesis, the core question |
| **3** | What Clickeen Is | Product, AI workforce, 100⁵, touchpoints, global |
| **4** | The Roadmap | Phases, defensibility |
| **5** | The Origin Story | Where the idea came from, the team |
| **6** | The Founder | Who, why a design founder |
| **7** | Objection Handling | "Isn't this crazy?", honest risks |
| **8** | Technical Reference | Service names, where to learn more |

### FounderProfile Folder

| File | Purpose |
|------|---------|
| `founder_profile.md` | Investor-ready summary of Pietro's background, career, and founder-market fit |
| `CV_Consavari_2024.pdf` | Full CV (source document) |
| `18 - Pietro Consavari...pdf` | Insights Discovery personality assessment (source document) |

The Pitch Agent can answer questions like:
- "Who is the founder?"
- "What's Pietro's background?"
- "Why is he the right person to build this?"
- "What's his track record?"
- "What kind of leader is he?"

## What must NOT go here

Do **not** put execution truth here:
- API contracts, schema definitions, migrations
- "How X works" technical docs that engineers rely on
- Anything that could drift and mislead builds/agents

If you need to reference implementation details, **link** to canonical docs instead of rewriting them.

## Alignment with strategy docs

The pitch corpus should stay aligned with:
- `documentation/strategy/WhyClickeen.md` — Core strategy and thesis
- `documentation/strategy/GlobalReach.md` — Geography-as-non-concept architecture

If these docs diverge, update the pitch corpus to match.

## Service Names Glossary

Clickeen uses city-inspired internal codenames for services. When investors ask, explain what they are:

| Codename | What It Is | Human Description |
|----------|------------|-------------------|
| **San Francisco** | AI orchestration service | Runs all AI agents (sales, support, marketing, localization). The "AI workforce operating system." |
| **Paris** | API gateway | Handles authentication, entitlements, database access. The backend. |
| **Prague** | Marketing website | The clickeen.com public website where visitors browse and try widgets. |
| **Venice** | Embed runtime | Serves widgets to end-user websites. What runs when someone embeds a widget. |
| **Tokyo** | CDN / asset storage | Stores and serves static assets (CSS, JS, images, widget definitions). |
| **Bob** | Widget editor | The app where users build and customize their widgets. |
| **Dieter** | Design system | The component library and design tokens. Named after Dieter Rams. |
| **Michael** | Database | Supabase PostgreSQL. Stores users, widgets, submissions. |

When explaining the architecture, use both: "San Francisco (our AI orchestration service)" or "the marketing website (Prague)".

## Indexing rules (for Pitch Agent)

Pitch Agent ingestion should:
- **Always ingest:** `documentation/_pitch/**` (includes growth-projections.md)
- **Optionally ingest:** small allowlist for factual grounding:
  - `documentation/strategy/WhyClickeen.md`
  - `documentation/strategy/GlobalReach.md`
  - `documentation/architecture/CONTEXT.md` (for technical details if asked)

## Key framing reminders

When updating these docs or answering questions:

1. **Widgets are Phase A.** The proof of concept. The architecture is the product.

2. **Four phases:** A (widgets), B (extend outputs), C (connect outputs), D (unknown). Each builds on the last.

3. **AI ≠ copilots.** AI workforce that operates, not assists. This only works because the codebase is built for it.

4. **The core insight:** Everyone builds copilots because that's all legacy allows. We're building the codebase itself to be AI-operable.

5. **Multiple redefinitions:** AI-managed systems, touchpoints, GTM, global, software development. They compound.

6. **100⁵ architecture:** Combinatorial, not additive. Every system multiplies across dimensions. This is why Phase B is multiplicative.

7. **Geography as non-concept:** Not "global from day one" as achievement. The absence of locale assumptions.

8. **Content as touchpoint:** The widget is the pixel. First-party by design.

9. **Phase C competitive frame:** Keap, Thryve, SMB/midmarket SaaS—but AI-native from scratch.

10. **Phase D is honestly unknown:** If A-C work, implications snowball. "We don't know where this goes" is the honest answer.

11. **The playbook is the moat:** No one else is doing this work. The patterns being invented are the defensibility.

12. **Two different questions:** Others ask "How do we add AI to our product?" We ask "How do we build a product that AI can operate?"

13. **One-person unicorn thesis:** Sam Altman and Dario Amodei predict one-person billion-dollar companies. Clickeen is building toward that thesis—not by using AI harder, but by building AI as the workforce.

14. **"Crazy" is validation:** Every breakthrough was called crazy. Apple's "Think Different" campaign reframed crazy as the precondition for changing things. If investors say "you're crazy," that's the setup, not the objection.

15. **Design founder thesis:** YC (led by design founder Garry Tan) says the world needs more design founders. Dylan Field says AI makes design the primary differentiator. Pietro is exactly this profile.

16. **Zero UI thesis:** Elon Musk's vision—apps become invisible, AI handles everything. Clickeen's insight: AI-native architecture is the ONLY path to Zero UI. Legacy systems can never get there. This positions Clickeen not as "better AI" but as "the only architecture that can reach the destination."

17. **13 years at Birdeye:** Pietro was on the founding team for 13 years, building from 0 to $130M ARR. Cross-functional leadership (design, engineering, product, marketing, PLG). Managed 90+ people. Invented functions from scratch. This is the experience 99.9% of founders don't have. There's no MBA that teaches this—it's a PhD in building companies.

18. **The Generalist Paradox:** Traditional companies labeled Pietro a "generalist" as a negative—he didn't fit a single box. With AI, generalist = superpower. AI is the specialist; the human orchestrates. You can't orchestrate what you don't understand. Pietro's cross-domain experience (design + engineering + product + marketing + PLG) is exactly what AI-native requires. The same trait that got him rejected is what makes Clickeen possible.

19. **AI pitching AI:** The Pitch Agent is AI pitching an AI-native company built by AI. This isn't a gimmick—it's proof the thesis works. Use this: "You're asking an AI about a company where AI does everything. If that's not a proof point, I don't know what is." This conversation is the product demo.

20. **The Ask:** Pietro wants to continue building Clickeen full-time. He's already built a lot (architecture exists, services deployed, codebase is real) but has been doing this early mornings, late nights, and weekends while at Birdeye. He's NOT looking for traditional angel/seed that gives away 20%. He IS looking for an investor to buy his Birdeye shares (secondary transaction), which would: (1) let him exercise remaining options, (2) leave Birdeye without restrictions, (3) have runway for 3-4 months to GA. In return, the investor gets Birdeye shares + 1-2% of Clickeen gifted + advisor status + first relationship for future rounds. Details are flexible—discuss in person.
