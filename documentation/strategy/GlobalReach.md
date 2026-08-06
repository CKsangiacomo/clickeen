# Clickeen Global Reach Strategy

STATUS: INFORMATIVE - STRATEGY & VISION

This document explains the global-by-default product thesis. It is not an
implementation plan. Current localization contracts live in
`documentation/capabilities/localization.md`; Babel doctrine lives in
`documentation/strategy/Clickeen-Babel.md`.

## Thesis

Clickeen is designed so geography is not a product assumption.

Traditional software globalizes by copying pages and content into regional or
language trees and manually keeping those surfaces current. Clickeen's strategy
is the opposite. The product is built around structured content, account-owned
source truth, active locales, agent-operated overlays, and edge serving so
global availability follows the source-plus-overlay model instead of copy trees.

## What Global-By-Default Means

Global-by-default means:

- locale is part of product context, not product identity;
- account-owned artifacts are not duplicated per language;
- active locales express which translated locales the account wants generated
  and maintained;
- agents create localized overlays from structured source;
- public runtime serves stored artifacts close to the visitor;
- missing localized content is visible as missing instead of hidden by fallback.

Global operation must not introduce per-market source copies, regional product
identities, or fallback-localized truth. It must extend the source + overlay +
artifact model.

## Why This Is Different

Legacy SaaS grows into complexity:

- market teams;
- translation projects;
- duplicated CMS entries;
- regional support operations;
- manual copy updates;
- manual drift across copied language trees.

Clickeen makes global work agent-operable:

- structured source tells agents what can be changed;
- overlays let agents localize content without copying products;
- active locales let users express intent simply;
- Cloudflare-backed runtime keeps serving global by default;
- new optimization agents are valid only when they have a named source of
  truth, edit authority, verification surface, and failure semantics.

The strategic result is lower marginal cost per locale/surface. One content
effort can become many localized public artifacts when the serving surface has
the required operator contracts, and those artifacts can improve over time
because agents own the operational work.

## Search And Answer Engines

Global reach is not only display language. Search and answer reach begins only
after localized public artifacts exist at crawlable coordinates, with sitemap,
hreflang, structured data, or equivalent exposure and measurable performance
authority.

That loop is strategic:

```text
source fields declared -> overlays generated -> localized artifact published
-> crawl/answer evidence collected -> authorized agent proposes or applies
   source or overlay improvements
```

The runtime and SEO/GEO/AEO details belong in execution and capability docs.
The strategy is that Clickeen can compound globally because it structures
account-owned source, locale overlays, public artifact generation, and agent
authorities.

## Strategic Boundary

This document does not define locale registries, tier caps, overlay storage
paths, public localized artifact routing, RTL rendering contracts, crawler
metadata, verification checklists, commerce rules, or launch plans. Those
details belong in capability, service, architecture, engineering, and planning
docs.
