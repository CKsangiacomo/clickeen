# Clickeen: A Widget Company Built to Be AI‑Operated

**Date:** February 2026  
**Audience:** A small number of trusted angels / early investors  
**Status:** Confidential (circulate intentionally)

---

## 0. How this started

I didn’t start out trying to write an AI manifesto. I started out trying to build a simple widget company.

I know GTM and PLG, and the widget/embed space is one of those markets that’s simultaneously global, durable, and weirdly stagnant. It’s a clean wedge: clear user value, low adoption friction, and lots of incumbents that haven’t fundamentally changed their underlying product model in years.

I was also building this alone, and I’m not a traditional engineer. So I imposed two constraints from day one that were practical, not philosophical: it had to be global by default, and it had to be “AI‑operated” in the literal sense—AI to help build it, and AI to help operate it—because I wasn’t going to assemble a headcount-heavy machine just to keep the product running.

Those constraints forced architectural choices I didn’t fully anticipate. In hindsight, they produced two “accidental discoveries” that now define Clickeen.

---

## 1. Two accidental discoveries

### 1.1 Discovery #1: a UI composition layer that can be operated (by humans and by agents)

If you want AI to do real work inside a product—beyond writing copy in a text box—you run into a basic problem: most UIs are not machine-operable surfaces. They’re opaque. They mutate implicit state. They rely on humans to interpret what “should happen” when something goes wrong.

I needed the opposite. I needed a UI/editing system where state was explicit, mutations were bounded, and failure was visible. The result is what I call the UI composition layer: configuration is a structured state object, and edits are applied as constrained operations against a known contract. The editor behaves less like a “free-form UI” and more like a deterministic transformation engine.

That matters for two reasons. First, it makes the product coherent at speed, even as a solo founder. Second, it means automation can safely touch production because it interacts through the same contract as a human editor—no improvisation, no heuristic DOM hacking.

This is also one of the two areas that looks genuinely protectable as IP, because it’s not a feature idea; it’s a system-level mechanism.

### 1.2 Discovery #2: overlays as the scalable alternative to copy-based “global software”

The second discovery came from globalization.

In most software, “going global” is implemented by multiplying copies: separate versions per language, per segment, per market. It works until you care about maintenance, drift, and operational load. Copy-based localization becomes a treadmill.

So I built a different primitive: one canonical base configuration plus language-specific overlays applied deterministically at runtime. Variants are not separate artifacts; they’re structured deltas. They can be validated, composed, and kept consistent as the base evolves.

At first, this was just a way to make localization possible as a solo founder. But once it worked, the general point became obvious: if you can make “language” a runtime parameter, a lot of other contextual variation becomes tractable without multiplying versions.

This overlay mechanism is the second protectable core: it’s not “translation,” it’s a generalized system for variants without copy explosion.

---

## 2. The thesis

The claim is not “LLMs changed everything.” The claim is that, with the right primitives, it’s now possible to build SaaS companies that are materially more automated in their operations—localization, onboarding, content iteration, and support workflows—without turning the product into an ungoverned mess.

Most companies bolt AI onto legacy systems and then discover the obvious: opaque state + unconstrained actions + weak governance is a recipe for chaos. Clickeen’s bet is that if you redesign the primitives—legible state, bounded mutations, deterministic composition, and explicit enforcement—then automation becomes safe enough to scale, and the economics of running a global product change meaningfully.

Widgets are the wedge. The substrate is the point.

---

## 3. Why this matters now

Three things are simultaneously true right now:

First, the marginal cost curve of traditional SaaS still climbs with headcount: more markets, more languages, more personalization, more edge-cases—all of it tends to turn into teams, process, and operational drag.

Second, infrastructure has matured enough that edge-first global delivery is no longer exotic. You can ship real systems where “global” is not an afterthought.

Third, model capability is now high enough that agents can do real work—but only if the product is designed for them. The limiting factor isn’t whether an LLM can write decent copy; it’s whether the product provides a safe, machine-operable surface for that copy (or any other change) to be applied, validated, and governed.

Clickeen exists because I built for those constraints from the beginning.

---

## 4. What exists today (technical, not aspirational)

Clickeen is already implemented as a running system. It’s a **modular monorepo** (shared types, shared contracts, shared widget packages), but it deploys like a **microservice architecture** because the major responsibilities ship as separate Cloudflare Workers / Pages deployments with explicit APIs and clear boundaries.

Below is a precise view of the currently deployed components.

| Component | What it is | Stack | What it does today |
|---|---|---|---|
| **Bob** | Editor surfaces | Multiple React apps sharing the same editing engine and design system | Authenticated editor + “try-before-signup” surface + internal dev harness. Supports manual editing and Copilot editing through the same bounded ops contract. |
| **Paris** | Control-plane API | Cloudflare Worker API | Instance lifecycle, publish orchestration, localization lifecycle, enforcement (limits/budgets/roles), and the policy boundary that keeps the system consistent. |
| **Michael** | Primary database | Supabase (Postgres) | Multi-tenant data model: workspaces, memberships/roles, instances, publish state, overlays, localization artifacts, tiers/plan metadata. |
| **Tokyo** | Widget definition distribution | Cloudflare Worker + Cloudflare R2 | Canonical widget packages (spec + assets + constraints) served as versioned definitions. |
| **Venice** | Embed runtime | Cloudflare Worker + Cloudflare R2 | Public, edge-delivered embed runtime for third-party sites. Fetches published artifacts from R2 and renders deterministically at request time. |
| **San Francisco** | Agent execution boundary | Cloudflare Worker–based service | AI orchestration layer with multi‑LLM support. Runs named workflows under constraints; returns structured outputs compatible with the same mutation contracts used in the editor. One workflow is live (SDR/Copilot path). |
| **Prague** | Acquisition surface | Website | Marketing surface (localized) and “try before signup” entry points. |
| **Dieter** | Shared design system | Package in monorepo | Common UI primitives across Bob/Prague (important for consistent semantics and velocity). |

A few details matter here because they’re not “nice-to-haves”—they’re what makes PLG and autonomy viable at scale:

**Multi-tenancy and workspace model.** The platform already supports workspaces, memberships, roles, and the “agency” pattern (one operator managing multiple workspaces). This isn’t something I’m postponing until later; it’s wired into the DB model and the API boundary because the entire PLG wedge depends on clean tenancy and controlled collaboration.

**Entitlements and tiers are already first-class.** There is a real entitlements layer in the control plane: features and limits are gated centrally, not as scattered UI conditionals. Read/write roles, quota gating, and plan-tiering are part of the product model today. This matters because “AI-operated” only makes sense if there’s an enforcement layer that constrains what automation can do by plan, by role, and by policy.

**Cloudflare is doing real work, not “hosting.”** Venice/Tokyo/Paris/San Francisco run on Cloudflare Workers and use R2 for globally accessible artifacts. This is what makes “global by default” operationally credible: delivery and control-plane execution are edge-adjacent, and published assets are retrievable with predictable performance characteristics without standing up region-by-region infrastructure.

**Multi‑LLM support is not theoretical.** San Francisco is structured so workflows are not hard-tied to a single model vendor. That is both a practical hedge and a product decision: as model economics and capabilities shift, the execution substrate remains stable.

The high-level claim “v2/v3/v4 are possible” only matters if these foundations hold. The point of this section is simple: they already exist in code and are running.

---

## 5. What we’re building (and why it started with widgets)

Clickeen is, on the surface, a widget platform. Widgets are a wedge because they’re easy to understand, easy to adopt, and they put you immediately in the real world: arbitrary host sites, real conversion funnels, and real operational constraints.

But widgets are also a forcing function. They force you to solve, early:

- an editor that can change state safely and preview instantly,
- a publish model that doesn’t turn into write amplification,
- an embed runtime that behaves predictably “in the wild,”
- and, critically, a global model where localization isn’t an operational tax.

Those forced problems produced the two discoveries above. That’s why I’m confident this isn’t “just a widget company.”

---

## 6. Translation as the first forcing function (and the overlay model)

Localization is where copy-based systems break. If you duplicate artifacts per language, you multiply maintenance forever.

Clickeen’s solution is to treat translation as overlays over a canonical base configuration. Concretely: the base widget config is the source of truth, and each locale is represented as a structured delta that is composed at runtime.

A simplified illustration looks like this:

```json
// Base config (English)
{ "title": "Frequently Asked Questions" }

// French overlay (delta)
[{ "op": "set", "path": "/title", "value": "Questions Fréquemment Posées" }]
```

The important technical detail is that this is not “apply patches and hope.” The system has explicit consistency rules, so overlays don’t silently drift as the base evolves. That enforcement exists because I needed a system that could scale globally without a translation team.

Translation was the first use case, but the underlying mechanism is general: you’ve built a deterministic variant system where “context” can be expressed as overlays instead of artifact multiplication.

---

## 7. How agents fit (and why they work here)

Agents fail on opaque systems because they don’t have a safe interface to act on. Clickeen’s architecture gives them one.

Agents do not “edit the UI.” They act on structured state through bounded operations, and those operations are validated and enforced the same way human edits are. That’s the core of “AI-operable”: the system provides a constrained action surface and a policy boundary that makes mistakes fail visibly.

Two practical workflows exist today:

- **Localization automation**: the system can extract translatable content, generate locale overlays, and publish variants through the same deterministic pipeline that humans use. The point is not that “AI can translate.” The point is that translation outputs become structured deltas that the product can validate and serve safely.

- **SDR/Copilot path**: an anonymous visitor can interact with a guided flow that produces a personalized, publishable experience. This is an early proof of “zero‑UI” direction: instead of making a user learn the editor before they see value, the system can generate a relevant artifact and then move them into the product when they have intent.

I’m intentionally not claiming a broad agent suite today. What exists today is the substrate: an execution boundary (San Francisco), a policy boundary (Paris), and an operable action interface (bounded ops). Those are the prerequisites that most products lack.

---

## 8. Where this goes (v1 → v2 → v3 → v4)

The reason I’m comfortable talking about later versions is not because I enjoy writing roadmaps. It’s because the two primitives—contract-based mutation and overlays over a canonical base—are already doing real work.

- **v1 (current)**: widgets as the wedge, with global delivery and localization as a first-class system property.
- **v2**: extend overlays beyond language into a structured personalization layer (contextual variants without artifact multiplication).
- **v3**: expand the same operating substrate to additional content surfaces adjacent to the widget embed world.
- **v4 (the long arc)**: a broader “AI-operable SaaS” model where major operational work streams become governed workflows that can be executed and improved over time.

The key point is that each version is an extension of scope, not a rewrite of fundamentals—if the primitives hold.

---

## 9. The moat (and why this is hard to copy)

Incumbents can copy features. They struggle to copy primitives.

Most systems in this space are built around copy-based variants, opaque state, and human-operated workflows. Even if they add “AI features,” their cost curve and operational model don’t change because their underlying substrate doesn’t allow safe automation.

Clickeen’s moat is the combination of:

- a machine-operable editing contract (the UI composition layer),
- a deterministic overlay model that avoids copy explosion,
- a centralized enforcement/policy layer (entitlements, roles, budgets, publish discipline),
- and an explicit AI execution boundary with multi-model flexibility.

These are also the two most plausible patent surfaces: the UI composition/mutation contract and the overlay-based variant system. The point isn’t “patents as marketing.” The point is that these mechanisms are not superficial and are, in my view, defensible as IP because they are concrete system designs.

---

## 10. Economics and scaling dynamics

Traditional SaaS often accumulates operational cost as it expands into more markets and more contexts. Localization, personalization, and support tend to create headcount taxes. Even with good tooling, the marginal cost curve often rises with complexity.

The model Clickeen is building toward is different: once variants are overlays rather than copies, and once operational work is executed through governed workflows rather than teams, the marginal costs tilt toward infrastructure and model execution rather than large human systems.

I’m not presenting this as guaranteed margin math today. I’m presenting it as an architectural direction that changes what the “natural scaling curve” looks like if the substrate is right.

---

## 11. Why I can build this

I’m not approaching this as a first-time operator. I’ve spent decades inside GTM and product systems, including PLG. I know the operational reality of what becomes expensive and what becomes brittle as software scales.

Clickeen is not “one good idea.” It’s a product built from constraints: global-by-default, solo-founder, AI-operable. Those constraints forced hard architectural decisions early, and those decisions are now the foundation.

---

## 12. What I’m raising for (high-level)

I’m raising so I can resign and work on Clickeen full-time, and so the system can move from “one-person operating mode” into a clean, scalable early-stage company without compromising the underlying architecture.

The immediate focus is straightforward:

- increase product surface area (core widget set, distribution-quality polish),
- deepen the overlay pipeline (more robustness, more automation, more scale),
- strengthen the agent substrate (quality gates, evaluation harnesses, outcomes),
- and keep the PLG foundation strong (tiers/entitlements, workspace workflows, acquisition surfaces).

The specifics are best discussed in person; the ask is at the end.

---

## 13. The ask

TBD

---

## Appendix: what I’m not sharing in this document

This memo is intentionally light on certain implementation details (exact composition algorithms, evaluation harness specifics, and internal workflow mechanics). For a trusted conversation, I’m happy to go deep, including a live walkthrough of what’s running and how the enforcement boundaries work.

The purpose of this doc is not to “explain everything.” It’s to communicate the two discoveries, show that they exist in running code, and make the next conversation efficient.
