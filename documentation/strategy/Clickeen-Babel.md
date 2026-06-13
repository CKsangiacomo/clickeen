# Clickeen Babel Strategy

Status: Active strategy note
Updated: 2026-06-02

## Core Thesis

Clickeen is building account-owned presentation artifacts that start from one explicit base source and render into many validated public outputs.

The product begins with widgets. The future extends the same source/overlay/materialization discipline to pages built from saved widget instances.

```text
one account-owned base source
explicit editable fields
explicit translatable fields
San Francisco translation work
deterministic locale overlays
validated public artifacts
Cloudflare-backed serving
```

This is the Babel strategy: one user-authored source can become multilingual public content without duplicating product truth per language.

## Tier Truth

The only tier identifiers are:

```text
free
tier1
tier2
tier3
tier4
```

There are no commercial package names in the product contract.

`free`, `tier1`, `tier2`, and `tier3` are widget-only tiers.

`tier4` is the first tier that includes customer-owned pages built from saved widget instances.

## Product Sequence

1. Widgets prove account-owned source, editor contracts, translation overlays, and public materialization.
2. Pages become ordered stacks of saved widget instances.
3. Roma composes page packages from those saved instance packages.
4. Tokyo serves public widget/page package artifacts and fails publish/serve readiness when required package files are missing.

The important point is not that every surface is the same product object. It is that every surface uses the same boring substrate:

```text
Bob edits one account widget instance in browser memory.
Roma opens and saves account-owned artifacts.
Tokyo stores account-owned source and overlays.
San Francisco translates declared fields.
Roma turns saved source into submitted public output.
```

San Francisco should not need to know whether it is translating widget copy or page metadata. Tokyo should not invent a separate storage philosophy for each surface. Product meaning belongs at the contract edge.

## Pricing Doctrine

Pricing is not finalized in this document.

Any future pricing work must use the five canonical tier ids:

```text
free   = widget-only free tier
tier1  = widget-only paid tier
tier2  = widget-only paid tier
tier3  = widget-only paid tier
tier4  = pages from saved widget instances tier
```

Do not introduce named packages as architecture truth. If the company later chooses customer-facing labels for marketing copy, those labels must map to the canonical tier ids and must not leak into policy, storage, contracts, migrations, PRDs, or service logic.

## Why This Matters

Most website and widget systems duplicate source truth:

- one page per language;
- one CMS entry per language;
- separate translation plugins;
- runtime fallbacks that hide drift;
- separate SEO systems outside the authoring path.

Clickeen's advantage is the opposite:

- one base source;
- declared fields;
- generated overlays;
- visible stale state;
- deterministic public output;
- account policy as the gate.

That is why PRD 105 matters for widgets, PRD 106 matters for blocks/pages, and PRD 107 must handle SEO/GEO for both without creating a second translation or serving architecture.
