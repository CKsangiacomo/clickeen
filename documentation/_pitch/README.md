# Pitch-only documentation (Investor corpus)

**Audience:** Investors (Pitch Agent)  
**Status:** Narrative / positioning docs — **NOT** execution contracts  
**Source of truth for engineering:** everything **outside** `documentation/_pitch/`

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

| File | Purpose |
|------|---------|
| `pitch_narrative.md` | The story: what we're building, why it's different, the cascade of redefinitions |
| `investor_faq.md` | Q&A format covering investor questions |
| `README.md` | This file—meta-docs and context for the Pitch Agent |

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

## Indexing rules (for Pitch Agent)

Pitch Agent ingestion should:
- **Always ingest:** `documentation/_pitch/**`
- **Optionally ingest:** small allowlist for factual grounding:
  - `documentation/strategy/WhyClickeen.md`
  - `documentation/strategy/GlobalReach.md`
  - `documentation/architecture/CONTEXT.md`

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
