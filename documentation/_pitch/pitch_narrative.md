# Pitch narrative (draft)

**Audience:** Investors (Pitch Agent)  
**Status:** Draft narrative — not an execution contract

## TL;DR

Clickeen is building an AI-native platform that makes creating, customizing, and deploying website widgets (and other marketing artifacts) radically faster—globally and at scale.

## The wedge

- We start with **widgets** because they are the most direct way to prove the platform: fast time-to-value, measurable conversion lift, and a simple “embed” distribution model.
- Widgets are also a natural place for AI to do real work: rewriting copy, changing styling, generating templates, and localizing content.

## The platform underneath

- A deterministic artifact model (configuration/state is first-class).
- A centralized policy/entitlements system so gating is consistent across surfaces.
- An embed runtime that serves the same output everywhere (product and website).
- A global marketing surface that scales to many widgets × many locales with AI-assisted content production.

## Why now

- Edge infrastructure + modern LLMs make global localization and content generation essentially free compared to traditional SaaS expansion.
- Teams expect self-serve PLG with strong customization; AI makes customization instant.

## What’s disruptive

Localization is not just UI translation. Clickeen localizes the **actual embedded widget content**, which competitors rarely do because it’s expensive and manual.

## Where to find technical truth

- Architecture overview: `documentation/architecture/Overview.md`
- Prague (marketing surface): `documentation/services/prague/overview.md`
- Venice (embed runtime): `documentation/services/venice.md`
- Policy: `documentation/capabilities/multitenancy.md` (and related PRDs)


