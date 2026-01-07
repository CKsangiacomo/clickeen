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

**These compound.** Each enables the others. Widgets are the wedge—they prove the architecture works.

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

1. **Not a widget company.** Widgets are the wedge. The architecture is the product.

2. **AI ≠ copilots.** AI workforce that operates, not assists. This only works because the codebase is built for it.

3. **The core insight:** Everyone builds copilots because that's all legacy allows. We're building the codebase itself to be AI-operable.

4. **Multiple redefinitions:** AI-managed systems, touchpoints, GTM, global, software development. They compound.

5. **100⁵ architecture:** Combinatorial, not additive. Every system multiplies across dimensions.

6. **Geography as non-concept:** Not "global from day one" as achievement. The absence of locale assumptions.

7. **Content as touchpoint:** The widget is the pixel. First-party by design.

8. **Honest uncertainty:** "If this works, the implications are unprecedented" is more compelling than false certainty.

9. **The playbook is the moat:** No one else is doing this work. The patterns being invented are the defensibility.

10. **Two different questions:** Others ask "How do we add AI to our product?" We ask "How do we build a product that AI can operate?"
