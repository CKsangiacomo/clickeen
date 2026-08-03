# Planning PRD — System SEO/GEO/AEO For Widget And Page Surfaces

Status: Planning — alignment input to the future PRD 127; not independently executable

Owner: Product + Architecture

Date: 2026-08-03

Related planning:

- `planning_PRD__Account_Page_Compiler_And_Publication.md`
- `planning_PRD__Prague_Migration_From_Astro_Blocks_To_Page_Composer.md`

## Shared Vision

Clickeen serves two real structured content surfaces:

```text
Instance → one independently materialized Widget identity that may be published

Page source = Page metadata + ordered saved Instance references
Page source + exact Instance packages → Page Compiler
Page Compiler → one SEO-valid document + deduplicated CSS/runtime
compiled build → Tokyo/R2 → one stable clk.live Page URL
```

This PRD owns the SEO/GEO/AEO product contract. The Page Compiler PRD owns its
deterministic materialization and publication. The Prague PRD owns migration
proof and legacy deletion. Their accepted decisions must be consolidated into
PRD 127 before execution begins.

## What And Why

- **SEO** means crawlability, indexability, semantic document quality, metadata
  and structured information for search engines.
- **GEO** means geographic and local-market relevance grounded in approved
  locale, market and source content.
- **AEO** means clear, attributable and machine-readable answers for search and
  AI answer experiences.

They are quality dimensions of the same served content—not separate pipelines,
content trees or agents.

An individually valid Widget does not automatically produce a valid Page. A
browser stack of independently served Widget documents can duplicate metadata,
schema, CSS, runtime and shells while losing whole-document heading and
canonical authority. Copying compiled output into another system creates a
second stale source.

The system therefore keeps Instance and Page source structured, compiles
approved truth before publication, and serves exact generated artifacts from
stable public identities.

## Product Law

1. There is no SEO block layer and no duplicate SEO content tree.
2. Widget content meaning remains owned by the Widget Instance and its source
   authority.
3. Page metadata and composition order remain owned by Page source.
4. The Page Compiler validates and materializes approved truth; it does not
   silently rewrite customer content.
5. A published Page is one initial semantic document, not a client-only loader,
   iframe stack or browser stack of Widget URLs.
6. A Page has one document-head authority. Included Widgets do not contribute
   competing title, canonical, robots, locale or social heads.
7. Widget structured data enters a Page only through an explicit generic
   Widget-owned contribution contract.
8. Missing or conflicting required truth fails visibly under an approved
   blocking/advisory policy; nothing is invented.
9. Public serving never calls an agent, model, authoring route or compiler.
10. Pages V1 publishes one base/default locale and does not claim locale URL
    trees, `hreflang`, country routing or language switching.
11. Pages V1 does not own menus, shared site chrome, domains or Website routes.
12. A future Website may collect stable Page identities and add site-wide
    navigation, routes, localization and SEO without replacing the Page
    Compiler.

## Source Authorities

| Truth                                               | Authority                                     |
| --------------------------------------------------- | --------------------------------------------- |
| Human-authored content                              | approved Instance or Page source              |
| Approved AI-authored content                        | governed Instance or Page source              |
| Reviews, feeds, listings and other integration data | external source and its structured derivative |
| Widget semantics and optional schema capability     | Widget-owned source/specification             |
| Instance content/configuration                      | account Instance source                       |
| Page metadata and composition                       | Roma Page source                              |
| Page-level validation/materialization               | deterministic Roma Page Compiler              |
| Generated public bytes                              | compiler output stored by Tokyo-worker/R2     |
| Public serving                                      | active generated artifact at `clk.live`       |

The compiler may report that source needs improvement. It must not mutate human-
or integration-owned truth to make validation pass.

## Widget Contract

A public Widget Instance should expose approved visible content as semantic
initial HTML. A Widget may also contribute structured data when its type owns an
approved capability, for example:

- FAQ questions and answers with FAQ schema;
- review facts with schema grounded in integration-sourced review truth;
- product/service facts grounded in structured Instance truth.

A Widget must not infer claims, ratings, locations, prices or other schema
values from presentation markup.

When included in a Page, an Instance contributes:

- one validated semantic root;
- exact style modules;
- exact runtime payload/modules;
- optional explicitly declared structured SEO data.

It does not contribute a Page document head. Adding an SEO-capable Widget must
not require a central `if widgetType === ...` branch in the Page Compiler.

PRD 127 must approve the smallest generic Widget SEO contribution shape. If it
does not ship in the first slice, the compiler may validate semantic HTML but
must not scrape arbitrary markup to invent JSON-LD.

## Page Contract

Page source remains:

```text
Page metadata + ordered saved Instance references
```

It does not copy Widget content, generated packages or SEO sidecars. The Page
Compiler creates one complete document at:

```text
https://clk.live/{accountPublicId}/pages/{pageId}
https://dev.clk.live/{accountPublicId}/pages/{pageId}
```

The stable `clk.live` identity is locked; the exact first path taxonomy shown
above remains proposed for PRD 127 approval. The URL identifies the Page, not a
particular build.

Every published Page requires one approved authority for:

- title;
- description;
- robots policy;
- canonical URL;
- `lang`;
- `dir`;
- viewport.

Social title, description and image are included only if PRD 127 approves their
structured source fields. `lang` and `dir` may be derived deterministically from
the approved base locale; marketing copy, canonicals, social content and images
must not be invented.

The compiler validates the assembled Page as one document:

- every placement appears once and in order;
- primary content exists in initial HTML;
- compiler-generated Instance coordinates are unique;
- contribution IDs and structured data do not conflict;
- one Page metadata authority exists;
- heading, link and image findings follow the approved severity policy;
- declared schema matches visible source truth;
- ordinary content and links remain useful without JavaScript;
- CSS/runtime contributions are deduplicated without changing content meaning.

The compiler rejects conflicts it cannot preserve exactly. It does not silently
renumber arbitrary Widget markup, rewrite headings, manufacture alt text or
coerce schema.

## GEO And AEO Boundaries

GEO uses approved locale and market truth. For Pages V1, one base locale is
published with required `lang` and `dir`; unsupported localization settings
block publication. Locale Page URLs, market routing and `hreflang` require a
later Page/Website localization contract.

AEO comes from clear semantic source content and compatible structured data.
Questions, answers and factual claims remain attributable to their human or
integration source. AEO does not create a separate answer tree or model-generated
visitor response.

## Compiler, Agent And Serving Boundaries

The Page Compiler is deterministic: identical Page source and exact Instance
packages produce identical public bytes and validation results.

An agent may later propose improvements to Page metadata or Instance content,
but an accepted change must use the owning structured route and preserve source
authority. This planning set does not create an SEO agent, crawler, cron,
recommendation store, learning loop, ranking integration or automatic rewrite.

Normal visitor/crawler requests must not:

- fetch authoring or overlay JSON;
- call Bob, Roma, Berlin, San Francisco or any agent;
- resolve Page Instance references or concatenate Widget packages;
- generate or repair metadata, schema or locale output;
- activate a partial build.

Tokyo-worker serves one exact complete active generated artifact. For Pages,
the stable URL must resolve HTML, CSS and runtime from one build-coherent package
under the activation contract approved in PRD 127.

## Failure Law

| Case                                           | Required result                                               |
| ---------------------------------------------- | ------------------------------------------------------------- |
| Missing required Page metadata                 | publication blocks; no value is invented                      |
| Missing/malformed Instance contribution        | compilation blocks; placement is not omitted                  |
| Conflicting module identity or structured data | compilation blocks                                            |
| Advisory quality finding                       | exact finding remains visible under approved policy           |
| Unsupported localization enabled               | publication blocks                                            |
| Failed Page recomposition                      | last complete build may serve; Roma shows Page as out of date |
| Partial new build                              | never becomes active                                          |
| Missing/corrupt public artifact                | public serving fails closed                                   |

PRD 127 must classify blocking versus advisory findings. Execution agents must
not decide severity ad hoc.

## Prague Alignment

Prague supplies migration source; it does not create another Page SEO authority.

- Prague `page-meta` maps into validated Roma Page metadata.
- Prague blocks map into normal account Instances and ordered Page placements.
- Prague `navmeta`, menus, routes and chrome remain Website-level Prague truth
  outside Pages V1.
- The standalone Page Compiler owns the document at the stable `clk.live` URL.
- Production Prague cutover remains blocked until a general host/Website
  contract preserves site chrome and initial-response SEO.

Prague must not parse, proxy, inject, rewrite or copy Page packages to fill that
future product gap.

## Current Truth

This is target planning, not deployed behavior. Today:

- public Widget serving returns generated files for published Instances;
- Page publication and public Page serving are disabled;
- no runtime proves complete SEO/GEO/AEO generation or measurement;
- `embed.seoGeo.enabled` exists in policy metadata but has no proven active
  runtime consumer.

Minimum Page SEO is part of creating a valid hosted Page, not an optional embed
enhancement. `embed.seoGeo.enabled` must not silently become a Page publication
gate. Its Widget embed meaning and current runtime mismatch need an explicit
decision.

## Non-Goals

- Menus, shared site chrome, a Website product or platform-specific adapters.
- Multi-locale Pages, locale URL trees, `hreflang` or country routing.
- A separate SEO content tree or Page-specific Widget overrides.
- Visitor-time generation, optimization or model calls.
- Heuristic schema generation or silent content/metadata rewriting.
- A central per-Widget SEO switchboard.
- An agent, recommendation store, crawler, learning loop or ranking system.
- New entitlement machinery or implicit reuse of `embed.seoGeo.enabled`.

## Decisions To Carry Into PRD 127

1. Minimal additional Page metadata fields for social previews.
2. Generic Widget structured SEO contribution contract, or explicit first-slice
   deferral of Widget JSON-LD.
3. Blocking versus advisory whole-Page findings.
4. Whether V1 needs any deterministic GEO/AEO gates beyond base-locale
   `lang`/`dir` and declared source/schema. Default: no additional machinery
   without a named objective rule.
5. Whether an included materialized Instance must be independently published.
6. Resolution or explicit deferral of the `embed.seoGeo.enabled` policy/runtime
   mismatch without coupling it silently to Pages.

## Acceptance

- All three planning PRDs use one source-faithful SEO/GEO/AEO vision.
- Page source remains metadata plus ordered Instance references.
- Page compilation produces one initial semantic document with one Page head and
  deduplicated CSS/runtime.
- One stable `clk.live` URL remains the Page's public identity.
- Widget contributions remain Widget-owned; Page metadata remains Page-owned.
- The compiler validates/materializes but never silently authors customer truth.
- Pages V1 remains base-locale, standalone and free of Website/navigation
  machinery.
- Prague uses the same Page product and creates no separate compiler or SEO path.
- No agent, crawler, recommendation store, learning loop or adapter is introduced.
- Open decisions move once into PRD 127 before execution begins.
