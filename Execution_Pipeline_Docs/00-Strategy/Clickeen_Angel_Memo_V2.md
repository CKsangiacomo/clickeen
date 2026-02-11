# Clickeen: A Widget Company Built to Be AI‑Operated

**Date:** February 2026
**Audience:** A small number of trusted angels / early investors
**Status:** Confidential (circulate intentionally)

---

## 0. The Core Bet

SaaS companies still scale by hiring teams: translators, support reps, content writers, onboarding specialists.

Clickeen is a bet that this model is obsolete—not because "AI is magic," but because the right architectural primitives make AI operability safe enough to scale.

I spent 12 months building those primitives in private. Not because I was afraid to launch, but because the substrate had to be **right** before going public. Retrofitting doesn't work.

This memo explains:
1. The two architectural breakthroughs that make AI-operated SaaS possible
2. Why they're defensible (IP + moat analysis)
3. Why the timing is now (18-month window before incumbents catch up)

I'm raising to execute market entry while the window is open.

---

## 1. Two accidental discoveries

### 1.1 Discovery #1: a UI composition layer that can be operated (by humans and by agents)

If you want AI to do real work inside a product—beyond writing copy in a text box—you run into a basic problem: most UIs are not machine-operable surfaces. They're opaque. They mutate implicit state. They rely on humans to interpret what "should happen" when something goes wrong.

I needed the opposite. I needed a UI/editing system where state was explicit, mutations were bounded, and failure was visible. The result is what I call the UI composition layer: configuration is a structured state object, and edits are applied as constrained operations against a known contract. The editor behaves less like a "free-form UI" and more like a deterministic transformation engine.

That matters for two reasons. First, it makes the product coherent at speed, even as a solo founder. Second, it means automation can safely touch production because it interacts through the same contract as a human editor—no improvisation, no heuristic DOM hacking.

This is also one of the two areas that looks genuinely protectable as IP, because it's not a feature idea; it's a system-level mechanism.

### 1.2 Discovery #2: overlays as the scalable alternative to copy-based "global software"

The second discovery came from globalization.

In most software, "going global" is implemented by multiplying copies: separate versions per language, per segment, per market. It works until you care about maintenance, drift, and operational load. Copy-based localization becomes a treadmill.

So I built a different primitive: one canonical base configuration plus language-specific overlays applied deterministically at runtime. Variants are not separate artifacts; they're structured deltas. They can be validated, composed, and kept consistent as the base evolves.

At first, this was just a way to make localization possible as a solo founder. But once it worked, the general point became obvious: if you can make "language" a runtime parameter, a lot of other contextual variation becomes tractable without multiplying versions.

This overlay mechanism is the second protectable core: it's not "translation," it's a generalized system for variants without copy explosion.

---

## 2. The thesis

The claim is not "LLMs changed everything." The claim is that, with the right primitives, it's now possible to build SaaS companies that are materially more automated in their operations—localization, onboarding, content iteration, and support workflows—without turning the product into an ungoverned mess.

Most companies bolt AI onto legacy systems and then discover the obvious: opaque state + unconstrained actions + weak governance is a recipe for chaos. Clickeen's bet is that if you redesign the primitives—legible state, bounded mutations, deterministic composition, and explicit enforcement—then automation becomes safe enough to scale, and the economics of running a global product change meaningfully.

Widgets are the wedge. The substrate is the point.

---

## 3. Why this matters now (The 18-Month Window)

Three things converge in 2026 that won't stay true:

**1. Model capability crossed the "safe automation" threshold**
- LLMs can now produce structured outputs (not just prose)
- Multi-model routing is economically viable
- Quality is high enough for production workflows

**2. Incumbents are still architected for human operations**
- Elfsight/Powr/EmbedSocial use copy-based localization
- Their state models can't safely accept agent writes
- Retrofitting would break 200M+ deployed widgets

**3. The "AI SaaS" narrative is noisy but implementations are shallow**
- Most products bolt GPT onto legacy systems
- The substrate problem (safe automation) remains unsolved
- First mover with credible primitives wins mindshare

**The window:** 18-24 months before incumbents rebuild foundations or new entrants copy the architecture.

**Clickeen's position:** Substrate is done. Market entry is the next milestone. This raise funds execution during the open window.

---

## 4. What exists today (Why This Isn't Vaporware)

Clickeen is not a prototype. It's a production-grade system running on Cloudflare with the operational maturity most companies don't achieve until Series A.

**Critically:** This is all **deployed and functional**. The reason you haven't seen it in market is strategic timing, not technical gaps. I built the substrate privately to avoid half-measures. The next phase is launch execution.

Clickeen is already implemented as a running system. It's a **modular monorepo** (shared types, shared contracts, shared widget packages), but it deploys like a **microservice architecture** because the major responsibilities ship as separate Cloudflare Workers / Pages deployments with explicit APIs and clear boundaries.

Below is a precise view of the currently deployed components.

| Component | What it is | Stack | What it does today |
|---|---|---|---|
| **Bob** | Editor surfaces | Multiple React apps sharing the same editing engine and design system | Authenticated editor + "try-before-signup" surface + internal dev harness. Supports manual editing and Copilot editing through the same bounded ops contract. |
| **Paris** | Control-plane API | Cloudflare Worker API | Instance lifecycle, publish orchestration, localization lifecycle, enforcement (limits/budgets/roles), and the policy boundary that keeps the system consistent. |
| **Michael** | Primary database | Supabase (Postgres) | Multi-tenant data model: workspaces, memberships/roles, instances, publish state, overlays, localization artifacts, tiers/plan metadata. |
| **Tokyo** | Widget definition distribution | Cloudflare Worker + Cloudflare R2 | Canonical widget packages (spec + assets + constraints) served as versioned definitions. |
| **Venice** | Embed runtime | Cloudflare Worker + Cloudflare R2 | Public, edge-delivered embed runtime for third-party sites. Fetches published artifacts from R2 and renders deterministically at request time. |
| **San Francisco** | Agent execution boundary | Cloudflare Worker–based service | AI orchestration layer with multi‑LLM support. Runs named workflows under constraints; returns structured outputs compatible with the same mutation contracts used in the editor. One workflow is live (SDR/Copilot path). |
| **Prague** | Acquisition surface | Website | Marketing surface (localized) and "try before signup" entry points. |
| **Dieter** | Shared design system | Package in monorepo | Common UI primitives across Bob/Prague (important for consistent semantics and velocity). |

A few details matter here because they're not "nice-to-haves"—they're what makes PLG and autonomy viable at scale:

**Multi-tenancy and workspace model.** The platform already supports workspaces, memberships, roles, and the "agency" pattern (one operator managing multiple workspaces). This isn't something I'm postponing until later; it's wired into the DB model and the API boundary because the entire PLG wedge depends on clean tenancy and controlled collaboration.

**Entitlements and tiers are already first-class.** There is a real entitlements layer in the control plane: features and limits are gated centrally, not as scattered UI conditionals. Read/write roles, quota gating, and plan-tiering are part of the product model today. This matters because "AI-operated" only makes sense if there's an enforcement layer that constrains what automation can do by plan, by role, and by policy.

**Cloudflare is doing real work, not "hosting."** Venice/Tokyo/Paris/San Francisco run on Cloudflare Workers and use R2 for globally accessible artifacts. This is what makes "global by default" operationally credible: delivery and control-plane execution are edge-adjacent, and published assets are retrievable with predictable performance characteristics without standing up region-by-region infrastructure.

**Multi‑LLM support is not theoretical.** San Francisco is structured so workflows are not hard-tied to a single model vendor. That is both a practical hedge and a product decision: as model economics and capabilities shift, the execution substrate remains stable.

The high-level claim "v2/v3/v4 are possible" only matters if these foundations hold. The point of this section is simple: they already exist in code and are running.

---

## 5. What we're building (and why it started with widgets)

Clickeen is, on the surface, a widget platform. Widgets are a wedge because they're easy to understand, easy to adopt, and they put you immediately in the real world: arbitrary host sites, real conversion funnels, and real operational constraints.

But widgets are also a forcing function. They force you to solve, early:

- an editor that can change state safely and preview instantly,
- a publish model that doesn't turn into write amplification,
- an embed runtime that behaves predictably "in the wild,"
- and, critically, a global model where localization isn't an operational tax.

Those forced problems produced the two discoveries above. That's why I'm confident this isn't "just a widget company."

---

## 6. Translation as the first forcing function (and the overlay model)

Localization is where copy-based systems break. If you duplicate artifacts per language, you multiply maintenance forever.

Clickeen's solution is to treat translation as overlays over a canonical base configuration. Concretely: the base widget config is the source of truth, and each locale is represented as a structured delta that is composed at runtime.

A simplified illustration looks like this:

```json
// Base config (English)
{ "title": "Frequently Asked Questions" }

// French overlay (delta)
[{ "op": "set", "path": "/title", "value": "Questions Fréquemment Posées" }]
```

The important technical detail is that this is not "apply patches and hope." The system has explicit consistency rules, so overlays don't silently drift as the base evolves. That enforcement exists because I needed a system that could scale globally without a translation team.

Translation was the first use case, but the underlying mechanism is general: you've built a deterministic variant system where "context" can be expressed as overlays instead of artifact multiplication.

---

## 7. How agents fit (and why they work here)

Agents fail on opaque systems because they don't have a safe interface to act on. Clickeen's architecture gives them one.

Agents do not "edit the UI." They act on structured state through bounded operations, and those operations are validated and enforced the same way human edits are. That's the core of "AI-operable": the system provides a constrained action surface and a policy boundary that makes mistakes fail visibly.

Two practical workflows exist today:

- **Localization automation**: the system can extract translatable content, generate locale overlays, and publish variants through the same deterministic pipeline that humans use. The point is not that "AI can translate." The point is that translation outputs become structured deltas that the product can validate and serve safely.

- **SDR/Copilot path**: an anonymous visitor can interact with a guided flow that produces a personalized, publishable experience. This is an early proof of "zero‑UI" direction: instead of making a user learn the editor before they see value, the system can generate a relevant artifact and then move them into the product when they have intent.

I'm intentionally not claiming a broad agent suite today. What exists today is the substrate: an execution boundary (San Francisco), a policy boundary (Paris), and an operable action interface (bounded ops). Those are the prerequisites that most products lack.

---

## 8. Where this goes (v1 → v2 → v3 → v4)

The reason I'm comfortable talking about later versions is not because I enjoy writing roadmaps. It's because the two primitives—contract-based mutation and overlays over a canonical base—are already doing real work.

- **v1 (current)**: widgets as the wedge, with global delivery and localization as a first-class system property.
- **v2**: extend overlays beyond language into a structured personalization layer (contextual variants without artifact multiplication).
- **v3**: expand the same operating substrate to additional content surfaces adjacent to the widget embed world.
- **v4 (the long arc)**: a broader "AI-operable SaaS" model where major operational work streams become governed workflows that can be executed and improved over time.

The key point is that each version is an extension of scope, not a rewrite of fundamentals—if the primitives hold.

---

## 8.5 Why I Built This In Stealth

Most founders launch MVPs and iterate publicly. I took a different path for two reasons:

**1. The substrate had to be right from day zero**

If you launch with opaque state and bolt on "AI features" later, you're stuck. The contract-based mutation layer and overlay system aren't bolt-ons—they're foundational.

Building this publicly would've meant:
- Pressure to ship half-solutions (investor updates, growth metrics)
- Technical debt from premature scaling
- Competitors copying surface features before the moat solidified

**2. This market rewards "first with credibility," not "first with anything"**

The widget space is crowded. The AI SaaS space is noisy. Launching without the substrate proven would've been ignored.

**The payoff:** I'm entering market with a system that looks like a Series A company's architecture, at pre-seed stage. That headstart is the moat.

---

## 9. The moat (and why this is hard to copy)

Incumbents can copy features. They struggle to copy primitives.

Most systems in this space are built around copy-based variants, opaque state, and human-operated workflows. Even if they add "AI features," their cost curve and operational model don't change because their underlying substrate doesn't allow safe automation.

Clickeen's moat is the combination of:

- a machine-operable editing contract (the UI composition layer),
- a deterministic overlay model that avoids copy explosion,
- a centralized enforcement/policy layer (entitlements, roles, budgets, publish discipline),
- and an explicit AI execution boundary with multi-model flexibility.

These are also the two most plausible patent surfaces: the UI composition/mutation contract and the overlay-based variant system. The point isn't "patents as marketing." The point is that these mechanisms are not superficial and are, in my view, defensible as IP because they are concrete system designs.

---

## 10. Economics and scaling dynamics

Traditional SaaS often accumulates operational cost as it expands into more markets and more contexts. Localization, personalization, and support tend to create headcount taxes. Even with good tooling, the marginal cost curve often rises with complexity.

The model Clickeen is building toward is different: once variants are overlays rather than copies, and once operational work is executed through governed workflows rather than teams, the marginal costs tilt toward infrastructure and model execution rather than large human systems.

I'm not presenting this as guaranteed margin math today. I'm presenting it as an architectural direction that changes what the "natural scaling curve" looks like if the substrate is right.

---

## 11. Why I can build this

I'm not approaching this as a first-time operator. I've spent decades inside GTM and product systems, including PLG. I know the operational reality of what becomes expensive and what becomes brittle as software scales.

Clickeen is not "one good idea." It's a product built from constraints: global-by-default, solo-founder, AI-operable. Those constraints forced hard architectural decisions early, and those decisions are now the foundation.

---

## 12. What I'm raising for

The system is built. The next phase is **operational proof at scale**.

**Immediate focus (GA launch - 2 months):**
- 20 production widgets (full library coverage)
- Global launch with 29-language localization
- Public PLG funnel live (Minibob → workspace conversion)
- Harden AI substrate (evaluation harnesses, quality gates)

**First milestone (6 months post-raise):**
- 500K global free installs
- 3% conversion rate to lower paid tier (15K paid users)
- 20 additional widgets (40 total widget library)
- Unit economics data: AI execution cost < $0.10 per locale/widget
- **AI Workforce deployed:** Support Agent, Marketing Copywriter, Content Writer, Ops Monitor (expanding beyond SDR Copilot, Editor Copilot, and UI Translator that ship at GA)

**Why now:** The window for "AI-native SaaS" is 18-24 months before incumbents retrofit their architectures. I've spent 12 months building the substrate in private. I need to prove the market model before the moment closes.

**Capital efficiency:** Most of this round funds execution (content, polish, go-to-market) not R&D. The core primitives are done.

---

## 13. The ask

**Target:** TBD
**Structure:** SAFE (YC standard terms)

**Use of funds (12-month runway):**
- Full-time founder bandwidth + core execution
- Equity transition costs (clean exit from current role)
- Contract talent (design, engineering, content)
- CTO advisory (3 candidates identified)
- Infrastructure (Cloudflare scale tier, model APIs)
- Legal/accounting (entity formation, IP protection)

**6-month milestones:**
- Public launch (PLG funnel live, Minibob → workspace flow)
- 500K global free installs
- 3% conversion rate to lower paid tier (15K paid users)
- 40 production widgets with 29-language coverage
- AI Workforce deployed (7 operational agents running the company)

**Why this round:** You're funding **execution**, not R&D. The primitives are done. This capital buys market entry during the 18-month open window.

---

## Appendix: what I'm not sharing in this document

This memo is intentionally light on certain implementation details (exact composition algorithms, evaluation harness specifics, and internal workflow mechanics). For a trusted conversation, I'm happy to go deep, including a live walkthrough of what's running and how the enforcement boundaries work.

The purpose of this doc is not to "explain everything." It's to communicate the two discoveries, show that they exist in running code, and make the next conversation efficient.
