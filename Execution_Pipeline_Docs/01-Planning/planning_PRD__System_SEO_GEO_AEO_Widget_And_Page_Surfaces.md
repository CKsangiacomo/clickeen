# Planning PRD — System SEO/GEO/AEO for Public Widget Instances and Prague Pages

Status: Planning — active direction, not independently executable

Owner: Product + Architecture

Date: 2026-08-03

Current authority references:

- `documentation/capabilities/seo-geo.md`
- `documentation/services/tokyo-worker.md`
- `documentation/services/prague/prague-overview.md`
- `documentation/capabilities/localization.md`

## Shared Vision

Clickeen has two real public content surfaces in this program:

```text
Account Instance source
  -> Roma/Bob materialization
  -> generated Widget package in Tokyo/R2
  -> stable clk.live account-instance URL

Repo-authored Prague page JSON + locale sidecar
  -> Prague Astro build and Cloudflare Pages runtime
  -> canonical Prague market/locale route on Cloudflare Pages
```

The surfaces share SEO/GEO/AEO quality rules, but they do not share source or
runtime authority. Public Widget Instances remain account artifacts. Prague
pages remain repo-authored marketing content. This plan improves both without
creating a second content tree or moving Prague into an account product.

## What and Why

- **SEO** means crawlability, indexability, semantic document quality,
  metadata, and structured information for search engines.
- **GEO** means geographic and local-market relevance grounded in approved
  locale, market, and source content.
- **AEO** means clear, attributable, machine-readable answers for search and
  AI answer experiences.

They are quality dimensions of served content, not separate pipelines, copies,
or visitor-time agent calls.

The program matters because:

- every published Widget Instance can be a useful, independently addressable
  content surface;
- Prague is Clickeen's public marketing and product-proof surface;
- explicit locale and market coordinates can make approved content globally
  discoverable;
- source-grounded structured data can make content easier for search and answer
  engines to understand;
- public output must remain fast and deterministic even when agents help
  improve its source asynchronously.

## Product Law

1. There is no duplicate SEO content tree.
2. Widget content meaning stays owned by the account Instance and its source
   authority.
3. Prague page content, metadata, and section order stay owned by the matching
   file under `tokyo/prague/pages/**` and its locale sidecars.
4. Widget output may expose only claims grounded in approved Instance or
   integration source truth.
5. Prague output may expose only claims grounded in its repo-authored page
   source and approved sidecars.
6. Missing or conflicting required truth fails visibly; nothing is invented.
7. Visitor and crawler requests never call an agent, model, authoring route, or
   optimization pipeline.
8. Public Widget serving starts from generated package files. Index requests
   may inject exact saved base/overlay locale context from R2; the browser does
   not fetch overlay JSON directly.
9. Prague serving reads Astro output built from repo source.
10. Locale and market context do not create a second content identity or grant
    permission to rewrite source truth.
11. Integration-sourced reviews, ratings, listings, and other facts remain
    attributable to their external authority.
12. An agent may propose or apply an authorized source edit, but it must use the
    owning route or repo file and preserve the source's authority.

## Source Authorities

| Truth | Authority |
| --- | --- |
| Human-authored Widget content | approved account Instance source |
| Approved AI-authored Widget content | governed account Instance source |
| Widget integration data | external source plus its structured derivative |
| Widget semantics and optional schema capability | Widget source/specification |
| Generated public Widget bytes | Roma-submitted package stored by Tokyo-worker/R2 |
| Saved Widget locale values | exact account Instance overlays in Tokyo/R2 |
| Localized Widget index response | Tokyo-worker injection into the stored base index |
| Widget public serving | Tokyo-worker at `clk.live/{accountPublicId}/{instanceId}` |
| Prague base page content and metadata | `tokyo/prague/pages/{widget}/{page}.json` |
| Prague localized page copy | matching `.translations/{locale}.json` sidecar |
| Prague market and locale coordinates | `prague/src/markets/markets.json` and `packages/l10n/locales.json` |
| Prague canonical/alternate head output | Prague route code and `prague/src/layouts/Base.astro` |
| Prague deploy/runtime | Astro app on Cloudflare Pages |

No optimizer may rewrite human- or integration-owned truth merely to make a
quality check pass.

## Current Runtime Truth

### Public Widget Instances

Published Widget Instances are served from:

```text
https://clk.live/{accountPublicId}/{instanceId}
https://dev.clk.live/{accountPublicId}/{instanceId}
```

Tokyo-worker serves the stored `index.html`, `styles.css`, and `runtime.js`
only when the saved pointer is published and the package is ready. Missing,
malformed, unpublished, or fingerprint-mismatched state fails closed.

For every index request, Tokyo-worker validates the source/serve state and
lists the exact saved locale coordinates. A requested non-base `?locale=` loads
the exact stored translated values and injects `CK_LOCALE_CONTEXT` into the
stored base index. The browser never fetches overlay JSON directly, and no
agent or model runs on the visitor path.

The policy registry contains `embed.seoGeo.enabled`, but no current runtime
consumer proves enforcement on save, publish, or public serving. That mismatch
must be resolved explicitly; policy metadata is not runtime evidence.

### Prague Marketing Pages

Prague pages are repo-authored under:

```text
tokyo/prague/pages/{widget}/{overview|examples|features|pricing}.json
tokyo/prague/pages/{widget}/{page}.translations/{locale}.json
```

Prague exposes Astro routes under `/{market}/{locale}/...`. Widget pages
require a `page-meta` title and description. The route layer emits canonical
and locale-alternate links from the approved route coordinates. Missing
required translated page truth fails visibly rather than substituting base
copy.

Prague may embed a published Widget Instance through an explicit
`accountPublicId + instanceId` reference. That embed does not give Prague
private account or authoring authority.

### Not Implemented

No current runtime proves an SEO/GEO/AEO agent, crawler, cron job, ranking
feedback loop, automated recommendation store, or automatic source rewrite.
The active program must specify each capability before code claims it exists.

## Public Widget Contract

A public Widget Instance should expose approved visible content in semantic
initial HTML. A Widget may contribute structured data only when its type owns an
approved, typed capability, for example:

- FAQ questions and answers grounded in visible Instance content;
- review facts grounded in integration-sourced review truth;
- product or service facts grounded in structured Instance truth.

A Widget must not infer claims, ratings, locations, prices, or other schema
values from presentation markup. It must not scrape its rendered DOM to invent
source meaning.

The smallest shared Widget SEO contribution contract remains a planning
decision. If no generic contract is approved, individual Widgets may improve
semantic HTML without claiming unsupported JSON-LD.

## Prague Page Contract

Prague keeps one repo source and one owning route for each marketing
page. SEO work must operate through that existing authority:

- `page-meta` owns the page title and description;
- the Prague route owns canonical and locale-alternate coordinates;
- the market/locale route owns `lang` and route identity;
- visible sections own the content that metadata or structured data describes;
- translation sidecars own approved localized string changes;
- the Astro runtime turns the approved source into initial HTML.

Future social metadata or structured data must be added to the owning Prague
source contract and rendered by Prague. It must not be hidden in a parallel SEO
file, inferred from arbitrary markup, or generated only for crawlers.

## GEO and AEO Boundaries

GEO uses explicit locale and market truth.

- Prague already owns market/locale paths and translated page sidecars.
- Public Widget Instances have locale overlays, but a stable crawlable Widget
  locale URL contract is not yet established by this plan.
- Unsupported locale or market claims must not be inferred from request
  geography alone.

AEO comes from clear semantic source content and compatible structured data.
Questions, answers, reviews, and factual claims remain attributable to their
human or integration source. AEO does not create a separate answer tree or a
model-generated visitor response.

## Agent, Build, and Serving Boundaries

An agent may later measure public quality, recommend improvements, and apply an
approved edit through the owning source authority. It must not silently mutate
customer truth, integration truth, Prague source, or locale sidecars.

Normal visitor and crawler requests must not:

- fetch private authoring or overlay JSON;
- call Bob, Roma, Berlin, San Francisco, or an agent;
- generate or repair metadata, schema, or locale output;
- substitute a stale or different source when required truth is invalid;
- receive crawler-only content that differs in meaning from visible output.

Widget public serving starts from one stored generated base package and may
inject exact saved locale context into index HTML. Prague serves its Astro
build. Neither surface waits for optimization work at request time.

## Failure Law

| Case | Required result |
| --- | --- |
| Unpublished Widget Instance | public Widget route returns `404` |
| Missing or malformed Widget package state | public Widget route returns `404` |
| Widget schema claim lacks structured source | schema output is rejected or omitted under an explicit contract; no claim is invented |
| Prague page missing required `page-meta` | Prague load/build fails visibly |
| Required Prague locale sidecar missing or invalid | Prague load/build fails visibly; base copy is not substituted |
| Metadata or schema conflicts with visible source | quality check fails; source is not silently rewritten |
| Automated measurement dependency unavailable | source and public serving remain unchanged; no success is claimed for the measurement operation |

Any future quality gate must classify blocking and advisory findings in its
own approved contract. Execution agents must not choose severity ad hoc.

## Active Planning Workstreams

1. Define the minimum semantic-initial-HTML requirements for every public
   Widget type.
2. Decide whether a smallest generic Widget structured-data contribution shape
   is warranted, without a central per-Widget switchboard.
3. Decide the stable crawlable locale identity for public Widget Instances, or
   explicitly defer it.
4. Extend Prague metadata or structured-data source fields only where a named
   use case requires them.
5. Define source-safe measurement and recommendation evidence before creating
   an SEO/GEO/AEO agent or scheduled operation.
6. Resolve or explicitly defer the `embed.seoGeo.enabled` policy/runtime
   mismatch.
7. Define verification for rendered semantics, canonical identity, locale
   alternates, structured-data/source agreement, and public no-agent behavior.

## Non-Goals

- A new customer page-composition product or customer page runtime.
- Moving Prague marketing content into account storage.
- Replacing Prague's repo-authored JSON and Astro routes.
- A separate SEO content tree or per-surface copy of source truth.
- Visitor-time generation, optimization, or model calls.
- Heuristic schema generation or silent content/metadata rewriting.
- A central per-Widget SEO switchboard.
- An agent, crawler, recommendation store, learning loop, or ranking system
  without a separately approved operation and evidence contract.
- New entitlement machinery or implicit reuse of `embed.seoGeo.enabled` beyond
  its proven runtime consumer.

## Acceptance

- The program targets the two real surfaces: published Widget Instances and
  repo-authored Prague marketing pages.
- Each surface keeps its existing source, build, deploy, and runtime authority.
- Public Widget requests start from generated package files and may inject only
  exact saved locale context from R2; the browser never fetches overlay JSON
  directly and no visitor-time agent/model runs.
- Prague requests serve Astro output from repo-authored page source and locale
  sidecars.
- Widget schema remains Widget-owned and source-grounded.
- Prague metadata and future structured data remain Prague-owned and
  source-grounded.
- Missing or conflicting truth fails visibly; no optimizer invents or silently
  repairs it.
- Visitor requests do not call agents, models, authoring routes, or optimization
  pipelines.
- Open work moves into an execution PRD only after its owner, input, mutation
  path, failure semantics, and verification surface are named.
