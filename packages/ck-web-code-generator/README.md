# @clickeen/ck-web-code-generator

Pure, browser-compatible generation of Clickeen Widget Instance and Page web
files. The package exports exactly two generation operations:

- `generateInstance`
- `generatePage`

The package performs no network or storage work. Callers supply structured
source, authored definition files, the required base-locale coordinate, exact
overlays, and already-resolved account assets and typography.

Widget HTML uses the package-owned generic stencil renderer. Inside `each`,
`{{@index}}` is the current item index and `{{@path}}` is its concrete source
path. Nested repeaters therefore produce paths such as
`faq.sections.0.faqs.1.answer`.

## Public-coordinate placeholders

The generator writes only these unresolved public-coordinate literals:

- `__CK_PUBLIC_ACCOUNT_ID__` — compact public account coordinate in a Widget
  Instance URL;
- `__CK_PUBLIC_INSTANCE_ID__` — compact public Instance coordinate;
- `__CK_PUBLIC_PAGE_URL__` — stable Page base URL
  `https://clk.live/{accountPublicId}/pages/{pageId}`.

Tokyo owns those values and must replace every occurrence before public HTML is
served. The generator does not create locale placeholders. When the structured
Instance enables its locale switcher and the base locale plus exact overlay
keys provide more than one locale, the saved HTML contains the complete static
switcher. Page composition removes child Instance switchers because the Page
owns locale selection. Page exact-locale URLs append the declared locale to
`__CK_PUBLIC_PAGE_URL__`; `data-ck-page-public-coordinate`
markers identify canonical, social URL, and `WebPage` JSON-LD values for the
later exact-locale serving path.

Page title and metadata use the same `data-ck-field-path` /
`data-ck-field-target` contract as Widget content. Metadata uses the approved
`attribute:content` target. There is no second Page-field marker system.

Every generated Instance includes neutral `meta[name="generator"]` provenance.
Customer Instance metadata and source-backed schema are emitted only when
`seoGeoAeoEnabled` is true. Contextual Clickeen Widget attribution and its
matching Organization, global Clickeen WebApplication, and Instance WebPage
identity are emitted only when `includeClickeenAttribution` is true. The
visible credit uses the Widget display name from its generated definition;
there is no second product registry.
