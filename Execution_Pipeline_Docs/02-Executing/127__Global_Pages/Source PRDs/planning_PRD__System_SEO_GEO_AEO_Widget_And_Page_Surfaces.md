# Planning PRD — Global Serving, SEO, GEO, and AEO for Clickeen Widgets and Pages

Status: **PLANNING INPUT TO PRD 127 — NOT EXECUTABLE**

Owner: Product + Architecture

Date: 2026-08-03

Parent program:

- `../127__PRD__Global_Pages_Program.md`

## 1. Purpose

This document defines how Clickeen Widgets and Pages are served around the world
and what makes their public output friendly to search engines, generative
engines, and answer engines.

The Page review exposed a core Widget defect: generated public Widget HTML is
currently mostly structural while JavaScript creates much of the customer
content in the browser. 127B restores the original direct-file contract before
the Web Code Generator consumes it. It does not change Widget identity, public URLs,
storage roots, `baseLocale`, or overlay paths.

The model is deliberately simple:

```text
one Page
+ existing baseLocale
+ exact locale overlays
+ one generated set of direct Page files
+ complete locale HTML
+ stable locale URLs
+ Cloudflare caching
+ one shared iframe-free installer for external sites
```

## 2. The terms in plain words

- **Global serving** means Cloudflare can deliver the Page worldwide.
- **Geographic selection** means a visitor's country may help choose from
  locale versions the customer already created.
- **SEO** means search engines can crawl, understand, and index the Page.
- **GEO — Generative Engine Optimization** means AI search systems can read,
  understand, and cite the Page.
- **AEO — Answer Engine Optimization** means answer systems can extract clear,
  attributable answers from the Page.

These are qualities of the same public document. Clickeen does not create four
separate optimization pipelines.

### The shared three-file rule

- Every Widget definition contains complete `index.html`, `styles.css`, and
  `runtime.js`.
- Every Instance is a customized saved copy of those files.
- Every Page combines referenced Instances into the same three public files.
- Every tier receives complete initial HTML; Free is not an empty-shell mode.
- Runtime JavaScript supplies behavior and does not construct primary content.
- Bob edits an Instance's working state and explicit Save invokes the Web Code
  Generator to produce its customized three files through the existing
  Instance authority. Page Builder saves Page source and invokes the same Web
  Code Generator to produce the Page's three-file result.

`embed.seoGeo.enabled` controls the additional SEO/GEO/AEO generation features.
It does not determine whether customer content exists in initial HTML.

Public-search output has three separate layers:

1. every tier receives complete semantic initial HTML;
2. Free Widget Instances carry a visible contextual link to the global Clickeen
   product and matching truthful Clickeen application identity generated into
   that HTML;
3. Tier 2+ customers may enable enhanced customer-owned SEO/GEO/AEO output.

Every generated document includes the neutral provenance tag
`<meta name="generator" content="Clickeen">`. It identifies the generating
software without creating visible promotion or claiming ownership of customer
content.

The second and third layers are not the same policy. `branding.remove` controls
visible Clickeen attribution. `embed.seoGeo.enabled` controls enhanced customer
optimization. Pages are a Tier 2+ product. Free, Tier 1, and accounts downgraded
into those tiers can see the Pages domain and retained inventory, but Roma blocks Page product
actions through the standard Upgrade interaction before generation.

The Web Code Generator uses the one approved global Clickeen URL and stable
Clickeen organization/application schema IDs. The Widget definition's display
name supplies contextual attribution wording. It does not invent product copy
or maintain a second product or locale registry.

Free attribution is ordinary, visible, crawlable HTML pointing to the global
Clickeen product with `rel="nofollow noreferrer"`, not a hidden link and not
DOM injected by `runtime.js`. Matching JSON-LD may identify Clickeen as the
software/service and schema publisher and the public Instance as the customer's
`WebPage`. It must never identify
Clickeen as the author or owner of customer content. Customer `mainEntity` and
Widget-specific content schema are emitted only when the customer SEO/GEO/AEO
value is authorized on, only from declared source fields, and must agree with
visible content.

Bob shows **Enable SEO/GEO/AEO** as an off/on toggle to every tier for ordinary
Widget Instances. New Instance drafts start off. If a Free or Tier 1 user
attempts to turn it on, the value remains off, draft state does not change, and
the existing Upgrade dialog opens. Tier 2, Tier 3, Tier 4, and Tier99 may turn
it on. Roma checks the entitlement again on Instance Save before generation.
The saved choice lives in `instance.config.json`; Web Code Generator receives
only the effective authorized Instance boolean and does not resolve tiers.

Page Builder has no SEO/GEO/AEO toggle. Pages already require Tier 2-or-higher
access through `pages.max`, and every ordinary Page receives Page
SEO/GEO/AEO output from declared Page fields and exact Page overlays. Tokyo does
not enforce either product policy.

The Web Code Generator owns these final Instance/Page files. The Bob Editor
Compiler owns only Bob's ToolDrawer/editor. Tokyo owns storage and serving.

For the eight current Widgets, the existing `spec.json` declares
`header.title` as the customer SEO title path and `header.subtitleHtml` as the
description path. Only FAQ declares content-specific FAQ structured data from
its existing question/answer paths. The generic generator reads those
declarations; there is no Widget-specific SEO renderer or inferred schema.

## 3. One Page, not country copies

A Page has one account-owned identity:

```text
accountPublicId + pageId
```

The Page may be available in generic languages or language-market locales such
as:

```text
en
en-us
en-gb
it-it
de
```

Those locales do not create copied Pages. They are versions of the same Page
using the same structure, CSS, and JavaScript.

The customer explicitly selects and authors the locales. Clickeen does not
create an Italian, German, or US version because a visitor arrives from that
country.

If the customer needs different US and UK content, the customer selects
`en-us` and `en-gb` and supplies their exact values. The overlays may differ in
copy, assets, offers, prices, currency, links, calls to action, metadata, and
other declared fields.

## 4. `baseLocale` and overlays

The existing Clickeen localization model remains authoritative.

`baseLocale` is the locale of saved source values. Every selected non-base
locale uses its exact same-code overlay.

For a requested locale, the Web Code Generator resolves the Page and every included
Instance independently:

- if the requested locale equals its `baseLocale`, use saved source values;
- otherwise, use its exact overlay;
- if a required overlay is missing or invalid, fail;
- never substitute `baseLocale` or another locale.

The same locale code is used by account policy, Page source, Instance overlay
paths, generated `overlays.json`, exact public URLs, and cache keys. The existing
locale authority defines its canonical storage format. PRD 127 adds no alias,
second registry, or alternate locale abstraction.

Country does not author content. Translation Agent may translate declared
language-owned fields, but it does not invent market offers, prices, currencies,
assets, links, or claims.

## 5. What explicit Save or Update creates

The Web Code Generator generates one set of direct current Page files:

```text
index.html
styles.css
runtime.js
```

- `index.html` contains the Page structure and semantic content.
- `styles.css` is shared by every locale.
- `runtime.js` is shared by every locale.
- private locale data stored by Tokyo contains the generated values required by
  selected non-base locales; it is not a fourth public Page file.

There is no country folder, locale file tree, or copied Page:

```text
not pages/{pageId}/italy/
not pages/{pageId}/germany/
not pages/{pageId}/en-us/index.html
```

Private generated overlay data is internal input for Tokyo. Browsers and crawlers
do not fetch it to assemble primary content.

## 6. Public URLs and locale selection

Every Page has one stable URL:

```text
https://clk.live/{accountPublicId}/pages/{pageId}
```

Each available locale has one exact URL:

```text
https://clk.live/{accountPublicId}/pages/{pageId}/{locale}
```

An exact URL always wins. It returns that locale regardless of IP, cookie,
browser language, or country. If that locale is unavailable or incomplete, the
request fails instead of returning another locale.

The shorter URL selects only among locales the customer made available:

1. use an available browser-language match;
2. otherwise use the saved account-approved Cloudflare-country mapping;
3. otherwise use the Page `baseLocale`.

Country is a hint, not content authority. It may select `it-it`; it cannot
create `it-it`, write its overlay, or prove the visitor speaks Italian.

Because the shorter URL can vary by visitor signal, its resolver response is
not shared-cacheable. It is the `x-default` coordinate for discovery. Exact
locale URLs are independently cacheable and never vary invisibly.

## 7. Edge completion and caching

On an exact locale cache miss:

```text
exact locale URL
→ Tokyo reads the direct current Page files
→ Tokyo applies that locale's generated values
→ Tokyo returns complete ordinary HTML
→ Cloudflare caches the completed HTML
```

A normal cache hit performs no Page-source read, child-Instance traversal,
generator call, agent call, or browser-side content assembly.

The cache identity includes the Page and exact locale. Shared CSS and JavaScript
are reused across locales.

Source changes alone do not replace the direct current files and do not invalidate
public Page cache. After successful explicit **Save** or **Update page** installs
a complete replacement, cache invalidation follows the changed generated output:

- changing one generated locale output invalidates that exact locale response;
- changing generated shared Page structure invalidates all locale responses;
- CSS or JavaScript is invalidated only when its bytes change;
- unpublish or delete invalidates the root and all exact locale responses.

A failed Save or Update reports the ordinary retry error and does not advance
serving state. Mixed direct files never serve.

## 7A. Direct documents and external installation

Widgets and Pages use the same two delivery modes over the same published
files.

The Widget URL returns a complete document. The stable Page URL redirects to a
selected exact-locale URL, which returns the complete Page document:

```text
Widget Instance: https://clk.live/{accountPublicId}/{instanceId}
Page:            https://clk.live/{accountPublicId}/pages/{pageId}
```

External websites use one product-neutral loader:

```html
<script
  src="https://clk.live/clickeen.js"
  data-clickeen="https://clk.live/ACCOUNT/PUBLIC-PRODUCT"
  defer
></script>
```

The loader fetches the already-completed public response, mounts the visible
body in open Shadow DOM, attaches the artifact's CSS, and loads its
behavior-only `runtime.js` when required. It does not translate, generate,
publish, read private overlays, or build primary content. Widget Instances and
Pages differ only in the public URL supplied through `data-clickeen`.

The host website remains responsible for its document title, description,
canonical, locale alternates, robots, and social metadata. The mounted product
may contribute only its approved visible content and source-backed structured
data. Direct Page URLs own the full Page head because the Page is then the
top-level document.

The stable Page redirect and public completed HTML/CSS/JavaScript allow
credential-free cross-origin reads. The shared loader is globally cached and multiple snippets mount
independently. There is no iframe mode and no snippet that loads only an
artifact's `runtime.js`.

Clickeen-generated Pages do not use the loader for child Instances. The Web
Code Generator places each child directly in initial Page HTML using open
declarative Shadow DOM, references the Page's one stylesheet, and initializes
behavior through the Page's one runtime. This preserves style isolation,
avoids child public requests, and keeps child content in the initial response.

The direct `clk.live` locale document is the deterministic crawler authority.
On a third-party host, JS-capable crawlers may also inspect mounted Shadow DOM
and approved structured data, but Clickeen does not overwrite host metadata or
claim that every non-JavaScript crawler will treat an installed product as the
host's own document. Platform-specific WordPress, Shopify, Wix, or similar
adapters may later emit the same loader/public URL contract; they are not new
renderers.

## 8. Why the output is SEO-friendly

For Clickeen itself, Free Widget distribution uses one real global Clickeen URL
and the matching Clickeen application identity. Hidden links, keyword-stuffed
anchors, invented “all languages” claims, or schema that
does not match visible truth are forbidden. Clickeen can create a clear product
entity and discovery trail; it cannot claim or guarantee ranking benefit.

Search engines receive complete server-delivered HTML at every tier and in both
toggle states. Important content is not hidden behind JavaScript, an iframe
stack, or a later overlay request on direct Widget/Page URLs or inside a
Clickeen-generated Page. The generic external installer mounts the same
complete output and never uses an iframe or runtime DOM renderer.

Every exact locale response contains the correct language, direction, and
visible semantic headings, paragraphs, lists, links, and images. It also keeps
the Page title and the customer's robots policy because those are basic document
truth, not premium optimization.

Every ordinary Page exact-locale response contains the following document
information. A Widget receives its corresponding customer SEO/GEO/AEO output
only when its saved authorized toggle is on:

- Page description;
- self-canonical exact locale URL;
- reciprocal `hreflang` links to every other published locale;
- `x-default` pointing to the stable Page URL;
- social title, description, and image when supplied;
- one localized `WebPage` JSON-LD block containing the exact Page URL and
  `@id`, effective localized title, optional localized description,
  `inLanguage`, and optional supplied social image;
- content-specific structured data only when it comes from supported visible
  content. Of the current Widgets, only FAQ may contribute `FAQPage` data from
  its visible questions and answers.

The Web Code Generator writes this JSON-LD into the Page's existing
`index.html`. Tokyo completes its locale values and exact public URL through the
same response markers used by the Page metadata before Cloudflare caches the
HTML. There is no schema service, schema editor, request-time generator, or
separate AEO document.

127 adds no sitemap or discovery subsystem. Exact locale documents carry their
own approved canonical and `hreflang` relationships when SEO/GEO/AEO is enabled.

Clickeen guarantees a technically crawlable and internally consistent Page. It
does not guarantee that a search engine will index or rank it.

## 9. Why geographic serving is friendly

Cloudflare makes one Page available globally while country evidence helps
select an already-authored locale at the short URL.

This avoids two bad models:

- copying the entire Page for every country;
- serving invisible IP-dependent variants behind one exact canonical URL.

A visitor in Italy may be directed to `it-it`; a visitor in the United States
may be directed to `en-us`. Both exact URLs remain stable and return the same
content to people and crawlers regardless of where the request originates.

Countries without a configured mapping still receive the Page. Browser
language may match an available locale; otherwise the short URL uses the Page
`baseLocale`.

## 10. Why the output is GEO-friendly

GEO here means Generative Engine Optimization.

AI search systems work best when content is visible, semantic, attributable,
and available at stable URLs. Clickeen supports that by serving:

- complete initial HTML;
- coherent headings and landmarks;
- visible facts that agree with metadata;
- stable locale URLs that can be cited;
- source-grounded structured data;
- explicit language, canonical, and alternate relationships.

Clickeen does not generate a separate AI-only answer tree or change content for
an AI crawler. People, search crawlers, and generative engines receive the same
approved visible truth at an exact locale URL.

Clickeen cannot guarantee inclusion or citation by a generative engine.

## 11. Why the output is AEO-friendly

Answer engines can extract answers when the Page uses real semantic structure
and directly states the information.

The Web Code Generator preserves the meaning contributed by its Instances. For
example, an FAQ Instance remains a set of visible questions and answers inside
the Page instead of becoming an opaque embed. That visible FAQ content is also
the only current source for `FAQPage` structured data. Other Widget types do
not receive inferred content schema.

AEO-friendly output requires:

- meaningful headings and sections;
- direct visible answers;
- attributable and source-faithful facts;
- appropriate links and image descriptions;
- supported structured data that agrees with visible content;
- no hidden machine-only text or generated claims.

Clickeen cannot guarantee selection by an answer engine.

## 12. Widget and Page ownership

Included Instances contribute their semantic content, scoped CSS, and required
JavaScript to the Web Code Generator. Instance content and configuration remain
owned by the Instance.

The Page owns the document head and Page-wide relationships: title,
description, canonical, robots, social metadata, locale alternates, and Page
`WebPage` JSON-LD. Included Instances do not add competing document titles,
canonicals, robots directives, social heads, or `WebPage` identity.

Widget-specific structured data enters the Page only when the Widget owns a
declared compatible contribution. The generator does not guess schema from
arbitrary text.

This contract changes how Instances contribute to a generated Page and restores
the direct three-file contract for every Widget and Instance. It does not change
their public URL, storage root, `baseLocale`, or overlay path.

## 13. Roma authoring and preview

Page Builder lets the customer manage:

- Page title and description;
- selected locales and Page overlays;
- robots choice;
- social title, description, and image;
- ordered Instance placements;
- the last explicitly generated preview for each selected locale;
- publication and Current or Needs update state.

Page Builder does not expose a structured-data form. Web Code Generator writes
the required `WebPage` JSON-LD automatically from those saved Page fields and
the exact public Page coordinate. Supported FAQ content contributes only its
matching visible questions and answers.

The generator runs only after explicit **Save** or **Update page**. Preview uses
the resulting direct files and the same locale-completion code as public
serving. Unsaved draft changes and dependency mutations do not generate. Roma
does not maintain a separate browser-only Page-file output.

Translation Agent operates declared language-owned overlay fields. The customer
remains authority for market-specific offers, prices, assets, links, claims,
metadata, and publication.

Templates do not introduce another localization or serving path. **Catalog** is
only the read-only view of templates owned by `CLICKEEN`; even `CLICKEEN` edits
the underlying object through DevStudio, not through Catalog. **Save as
template** copies complete reusable source/config, including the Widget
SEO/GEO/AEO setting, then clears locale, translation, and public-serving values
from the copied template config. **Use template** generates no translations.
Templates cannot publish, so they create no canonical, cache, or public
coordinates. The resulting ordinary object gets locale choices and translations
only through its owning account's normal explicit localization workflow.

## 14. Failure behavior

| Situation | Required result |
| --- | --- |
| Required Page or Instance overlay is missing | Generation blocks; no locale is substituted. |
| Instance contribution is missing or malformed | Generation blocks; the placement is not omitted. |
| Visible content and metadata disagree structurally | Generation blocks with the exact problem. |
| Unsupported exact locale is requested | Explicit failure; no redirect to another locale. |
| Included Instance or overlay changes | No Page operation runs; later comparison reports Needs update. |
| Explicit Save or Update fails | Show the ordinary retry error; never claim success or advance serving state. |
| Public direct files are missing or corrupt | Public serving fails closed. |

Validation protects source fidelity. It does not silently rewrite customer or
integration-owned content to make a Page pass.

## 15. Non-goals

This planning PRD does not introduce:

- changes to standalone Widget locale coordinates, storage roots, or public
  URL shapes;
- replacement or renaming of `baseLocale`;
- copied country/locale Pages or packages;
- hidden IP variants at exact locale URLs;
- browser-side primary-content assembly;
- iframe installation, runtime-only installation snippets, or separate Widget
  and Page loaders;
- public-loader calls for child Instances inside a generated Clickeen Page;
- separate SEO, GEO, or answer content trees;
- heuristic schema generation or invisible keyword content;
- an SEO agent, crawler, recommendation store, ranking system, or learning
  loop;
- guaranteed indexing, ranking, AI citation, or answer placement;
- Websites, menus, shared site chrome, platform adapters, or A/B testing.

## 16. Acceptance

This planning direction is correctly represented in PRD 127 when:

- one Page identity uses existing `baseLocale` and exact overlays;
- explicit Save or Update creates one set of three direct public files plus
  private overlay data; Publish exposes those already-current files and creates no
  country or locale copies;
- templates retain complete reusable source/config but have no `baseLocale`,
  selected locales, overlays, translations, public-serving state, or public SEO
  output; only resulting ordinary saved Pages can generate, publish, and enter
  public serving;
- the stable URL selects only among customer-authored locales;
- exact locale URLs are deterministic and independently cacheable;
- country is only a selection hint;
- Tokyo returns complete HTML and Cloudflare caches it;
- the Widget URL and Page exact-locale URL render without an installer; the
  stable Page URL redirects to the selected exact locale;
- one cached `clickeen.js` contract mounts either product on an external site
  in open Shadow DOM without changing host metadata;
- generated Pages contain their child Instances in initial declarative Shadow
  DOM and make no child public Widget requests;
- iframe and runtime-only installation choices are absent;
- crawlers never need JavaScript or `overlays.json` to obtain primary content;
- Free Widget output contains one visible contextual link to the global Clickeen
  product and matching source-truthful Clickeen application identity in initial
  HTML;
- paid branding removal is controlled by `branding.remove` and remains separate
  from customer SEO/GEO/AEO authorization through `embed.seoGeo.enabled`;
- no Clickeen product URL, schema ID, description, or language claim is invented
  outside the one approved global Clickeen identity;
- exact responses always contain consistent language, semantic content, Page
  title, and robots; every ordinary Page additionally contains its metadata,
  canonical and alternate links, localized `WebPage` JSON-LD, and only
  supported visible-content schema; Widget enhancement output follows its
  saved authorized toggle;
- Widget meaning remains Instance-owned and the document head remains
  Page-owned;
- missing values fail instead of falling back;
- SEO, geographic delivery, GEO, and AEO remain qualities of the same approved
  Page rather than new subsystems;
- every Widget definition and saved Instance contains complete HTML, CSS, and
  JavaScript files for every tier;
- Bob edits and saves the customized three-file Instance files;
- Page code generation reads those exact saved files and produces the same three
  public file types;
- Widget, Instance, and Page JavaScript supplies behavior rather than creating
  primary content;
- no standalone Widget locale, storage-root, or public-URL redesign enters PRD
  127.
