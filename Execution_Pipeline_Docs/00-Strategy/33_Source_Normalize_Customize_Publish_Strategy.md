# 18 — Source → Normalize → Customize → Publish Everywhere (Strategy Note)

**Purpose:** Lock the core platform concept in writing so we can turn it into a PRD (and avoid drifting into widget-by-widget thinking).

**Status:** Strategy/Planning artifact (not a PRD yet)

---

## The Core Idea (one sentence)

Clickeen is a **repeatable machine** that takes *any source of content*, turns it into **structured truth**, lets the user **customize it beautifully**, and then **publishes it everywhere**—starting with their website.

> Source → Normalize → Customize → Publish

---

## Why this is the right abstraction for Clickeen

Clickeen is not “a bunch of widgets.” It is a platform that turns *inputs* into *outputs* through a consistent pipeline.

- **Inputs** vary wildly (text, images, third-party platforms, feeds, pages).
- **Outputs** also vary (embeds, landing pages, marketing sections, emails, ads).
- The system stays scalable only if the **middle is consistent**: a canonical model + safe customization + deterministic publishing.

---

## 1) Source (anything in)

“Source” is intentionally broad. It means **any content we can pull in** (or that the user provides) to power an output.

### 1.1 Manual sources (user-provided)
These are the simplest sources:
- FAQ questions/answers written directly in Bob
- Countdown event name/date
- Logos uploaded by the user
- Any text/image the user pastes or uploads

Even here, “source” still matters because:
- The content often starts generic
- We personalize it (tone, language, business fit) with AI
- So “manual source” is still source → improve → publish

### 1.2 Connected sources (external)
These are sources Clickeen can “suck in” if we choose to build the adapter:
- Airbnb listing content
- Yelp / Google reviews
- RSS / JSON feeds
- Spotify playlists
- Instagram content
- “Any webpage” where we can extract structured text/images

**Key point:** The source is not the UI. The source is raw input.

---

## 2) Normalize (make it legible)

This is the missing middle layer that makes the system repeatable.

Normalization means:
- Convert raw input into a **canonical dataset/model**
- Preserve provenance (“where did this come from?”)
- Produce a stable shape that renderers/widgets can rely on

### 2.1 Why normalization matters
If we skip normalization, every widget becomes a bespoke integration.

Normalization makes it possible for:
- many widgets to display the same source
- one widget to accept many sources
- agents to operate safely on the content (because the model is legible)

---

## 3) Customize (Bob is the kitchen)

Bob is the universal place where content becomes *yours*.

### 3.1 Bob as the “kitchen”
Everything flows through the same customization space:
- **Stage / Pod / Item** (presentation structure)
- repeaters and object management (lists of items)
- typography and layout controls
- selection and filtering controls (what to show, in what order)
- brand / tone / voice adjustments (with AI help)

This is the “cook it and stir it” step—where we turn raw content into a polished artifact, like icing a cupcake.

### 3.2 Why this step is a moat
The moat is not only “we can ingest sources.” Incumbents can ingest sources.

The moat is:
- high-craft customization UX
- safe, repeatable transformations
- the same interaction model across many widgets

---

## 4) Publish Everywhere (one button)

Once customized, the user should be able to publish with one button and use it anywhere.

### 4.1 Start with the website
The first “everywhere” is the user’s site:
- embed runtime
- stable output

### 4.2 Expand to other surfaces
Over time, the same underlying output model can power:
- landing pages
- marketing sections
- emails
- ads
- internal dashboards

The key is: outputs are just **different renderers** of the same normalized + customized content.

---

## 5) The repeatable flow across Clickeen “spaces”

This is what makes it feel like a single platform, not a set of tools:

- **Bob** = customization kitchen (human + AI)
- **Paris** = connectors/adapters + governance boundary for fetching and permissions
- **Tokyo** = publishable artifacts (base assets + overlays)
- **Venice** = rendering runtime (embeds)
- **San Francisco** = agents that help execute playbooks (personalization, localization, SDR, support)

The user sees one coherent experience: “bring content in → customize → publish.”

---

## 6) Where overlays fit (without overloading the concept)

Overlays are not “the product.” Overlays are how publishing scales when variants explode.

Once you publish, you will eventually want variants:
- translation (language)
- market variants (geo, legal, currency)
- experiments (A/B)
- industry and account context (ABM)

Overlays mean:
- keep one base
- apply context-specific patches at runtime (deterministic)

This keeps “publish everywhere” from turning into “copy everything everywhere.”

---

## Locked principles (the non-negotiables)

1) **Any source in** (manual or connected)  
2) **Normalize to a canonical model** (legible state)  
3) **Customize in one place (Bob)** with a consistent UX model  
4) **Publish with one button** to a deterministic output  
5) **Variants scale by overlays** (not by copy explosion)  
6) **Agents operate only through the same safe interfaces** (no bespoke hacks)

---

## Open questions (to resolve in the PRD)

- What is the canonical “dataset” schema for the first 2–3 source-backed widgets?
- What is the refresh model for connected sources (polling vs webhooks vs manual refresh)?
- Where do we store datasets (and how do we cap cost)?
- What is the minimum publish target list for v1 (“site embed” only, or also landing page blocks)?

---

*End.*
