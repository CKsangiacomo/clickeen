# PRD 101 Stub - Paid SEO/GEO Embed Coding Agent

Status: Stub  
Owner: Product + Architecture  
Date: 2026-05-16  
Depends on: PRD 100 - Static Public Embed Delivery

## Purpose

PRD 101 will define the paid SEO/GEO embed build mode that becomes possible after PRD 100 is executed.

PRD 100 makes every widget instance independently live as static browser files in Tokyo and served through `clk.live`. PRD 101 will define how the embed coding agent produces a richer version of those browser files for customers entitled to SEO/GEO.

This is not a runtime SEO service. It is not Venice rendering. It is not per-view computation.

SEO/GEO means:

```text
same saved instance source
same async embed build
same instance folder
same static serving path
better generated HTML/CSS/JS and metadata
```

## Core Idea

The embed coding agent can generate different levels of output from the same widget source.

Base embed mode produces a functional static widget.

Paid SEO/GEO mode produces a richer static widget build optimized for search engines and generative answer engines.

The difference is the generated code, not the serving architecture.

## Product Boundary

PRD 101 will only apply after PRD 100 establishes:

- one `instance.json` source package per instance
- overlays under `overlays/`
- generated browser files in the instance folder
- `clk.live/{accountPublicId}/{instanceId}` static serving
- Save-triggered async embed generation
- San Francisco-managed embed coding agent
- no Venice request-time composition

PRD 101 must not reintroduce:

- runtime rendering
- public request-time decisions
- Venice hot-path behavior
- extra public namespaces
- shorteners or redirects
- duplicate source JSON files
- account asset copying into instance folders

## What PRD 101 Will Define

PRD 101 will define the paid SEO/GEO contract for the embed coding agent, including:

- entitlement rules for when `seoMode` can be `full`
- how Roma/Bob expose SEO/GEO as a paid build mode
- how `instance.json.embedBuildShape` records SEO/GEO intent
- widget-type-specific semantic HTML requirements
- widget-type-specific schema.org JSON-LD requirements
- canonical URL rules for `clk.live`
- Open Graph and social metadata generation
- locale and `hreflang` behavior when overlays exist
- sitemap/indexing rules for public widget mini-sites
- crawler/robots behavior and customer opt-out rules
- Prague dogfooding requirements for Clickeen's own widget pages
- validation reports surfaced in Roma
- CI checks for generated SEO/GEO output

## Examples Of Richer Paid Output

For FAQ widgets, paid SEO/GEO may require:

- real semantic FAQ HTML
- `FAQPage` JSON-LD
- crawlable question and answer text
- locale-specific output when translations exist
- `hreflang` links between locale variants
- canonical URL metadata
- no hidden keyword stuffing
- no hallucinated claims not present in `instance.json` or overlays

For review, pricing, event, article, or other future widgets, PRD 101 will map each widget type to the correct semantic and structured-data contract.

## Non-Negotiables

- SEO/GEO is a paid embed build mode.
- SEO/GEO is produced by the embed coding agent at build time.
- Public visitors never choose or trigger SEO/GEO mode.
- Free/base embeds must remain functional and static.
- Paid SEO/GEO embeds must remain static and CDN-friendly.
- The embed coding agent must not invent business claims, reviews, prices, locations, offers, or facts.
- Generated structured data must come from saved instance source, overlays, account assets, or approved product/widget contracts.
- SEO/GEO must not become spam infrastructure.
- Prague pages using Clickeen widgets are first-class dogfooding surfaces for this contract.

## Out Of Scope For The Stub

This stub does not execute PRD 101.

This stub does not define final schema.org mappings, crawler policies, sitemap shape, or Roma UI details.

Those belong in the full PRD 101 after PRD 100 is implemented and the static embed path is real.

## Future Execution Shape

Expected PRD 101 child slices:

| Slice | Scope |
| --- | --- |
| `101A` | SEO/GEO entitlement and `embedBuildShape` contract |
| `101B` | Widget-type semantic HTML and schema.org mappings |
| `101C` | Locale, canonical, `hreflang`, sitemap, and crawler policy |
| `101D` | Embed coding agent SEO/GEO generation rules and validation |
| `101E` | Roma/Bob paid SEO/GEO controls and status/reporting |
| `101F` | Prague dogfooding and SEO/GEO demo pages |
| `101G` | CI guards against bad structured data, hidden text, spam, and hallucinated claims |

## Done

This stub is done when the team agrees that PRD 101 is the post-PRD-100 product document for paid SEO/GEO embed generation by the coding agent.

