# Investor FAQ (draft)

**Audience:** Investors (Pitch Agent)  
**Status:** Draft — not an execution contract

## What is Clickeen?

Clickeen is an AI-native platform for building and deploying marketing widgets (and, over time, other marketing artifacts) with global reach by default.

## What problem are you solving?

Customizing widgets and marketing assets is repetitive work: copy, style, layout, and localization across many pages and markets. Most tools either:
- require heavy manual work, or
- lock you into rigid templates.

We use AI agents + a deterministic config model so customization becomes instant and scalable.

## What’s the wedge and what’s the end game?

- Wedge: website widgets (high ROI, embed distribution, fast activation)
- End game: a generalized artifact platform where content + styling + delivery are standardized across surfaces.

## Why is this defensible?

The moat is the platform:
- deterministic artifact state (enables reliable automation)
- shared policy enforcement across all surfaces
- embed runtime as a first-class delivery layer
- global programmatic marketing + localization pipeline

## How do you go global so early?

We design global reach into the system:
- Edge-first deployment
- AI-driven localization (copy + embedded content)

Reference: `documentation/strategy/GlobalReach.md`

## How do you avoid hallucinations in your Pitch Agent?

The Pitch Agent should be retrieval-first:
- index a curated investor corpus (`documentation/_pitch/**`)
- optionally include a small allowlist of canonical docs
- answer only from sources and always cite

Reference: `documentation/ai/agents/pitch-agent.md`


