# PRD 106 - Page Composer And Widget Instance Materializer Foundation

Status: Planning / doctrine reset
Owner: Product + Architecture
Date: 2026-06-03
Depends on: `105__PRD__Instance_Folder_Tenets.md`, `105M__PRD__Tokyo_Worker_Instance_Runtime_Refactor.md`
Enables: `107__PRD__SEO_GEO_Static_Build_And_Page_Strategy.md`

## Purpose

PRD 106 defines the foundation for Clickeen hosted pages.

The product is simple:

```text
Users create and manage a page by stacking Clickeen widget instances.
```

A page is not a second presentation system. A page is an account-owned composition of existing account-owned widget instances.

Examples:

- a hero widget instance;
- a split-layout widget instance;
- an FAQ widget instance;
- a logo carousel widget instance;
- a countdown widget instance;
- a CTA widget instance;
- a pricing widget instance;
- a testimonial widget instance.

The user-facing product area is `Pages`. The authoring surface is the Page Composer.

The new backend capability is the Page Materializer.

## Product Model

Clickeen has one visible presentation primitive:

```text
account-owned widget instance
```

The product model is:

```text
Widget type = product-owned HTML/CSS/JS software.
Instance    = account-owned configured widget type.
Page        = account-owned route, head metadata, ordered instance placements, and placement overrides.
Site        = future collection of pages plus domain/nav/global settings.
```

The page composes instances. It does not own the base source of those instances.

If the same FAQ instance is placed on three pages, editing that FAQ instance updates every page after rematerialization. If a page needs different copy, the user can duplicate the instance or use a placement override when overrides are implemented.

## Why This Is Right

### UX

Users should not have to learn a second content unit.

They already understand:

```text
I have widgets.
I want to put widgets on a page.
I want to reorder them.
I want the page to publish.
```

The Page Composer should make that direct:

- create a page;
- set route and page metadata;
- add an existing widget instance;
- create a new widget instance from a widget type;
- reorder stacked widget instances;
- remove a placement from the page without deleting the underlying instance;
- open a placed instance for editing;
- save and publish the page.

### Product

Every widget already carries the machinery Clickeen needs:

- account ownership;
- Bob editing;
- Roma opening/saving;
- Tokyo source storage;
- customer assets;
- translation;
- public rendering;
- publish state;
- reuse.

Pages should activate that machinery, not replace it.

### Architecture

The current account widget path is the surviving authority:

```text
Roma opens an account widget instance.
Bob edits one widget in one active locale at a time.
Roma saves to Tokyo.
Tokyo stores source and materializes public output.
```

PRD 106 extends that path to pages:

```text
Roma opens an account page.
The page shows ordered widget instance placements.
The user adds, removes, reorders, or opens placed instances.
Roma saves the page composition to Tokyo.
Tokyo materializes one hosted page output.
```

No second editor model. No second translation model. No second renderer registry.

### Scale

The performance target is:

```text
20 placed widget instances -> one page document, one CSS artifact, one runtime artifact
```

Not:

```text
20 placed widget instances -> 20 iframes
```

The page materializer composes HTML-shaped instance renders into one hosted document.

### Future

Once a page is an ordered composition of widget instances, the future becomes straightforward:

- page-specific copy overrides;
- translated page metadata;
- translated placement overrides;
- personalization;
- A/B tests;
- campaign variants;
- site nav;
- domains;
- SEO/GEO.

Those future features target pages and placements. They do not require a second presentation primitive.

## Clickeen Pages Tenet

A Clickeen page is one composed widget package.

Each widget instance already materializes to:

```text
index.html
styles.css
runtime.js
```

Page composition must stay this straightforward:

```text
placed widget instance packages
= one page package

page/index.html
page/styles.css
page/runtime.js
```

The page composer reads the generated `index.html`, `styles.css`, and `runtime.js` for every widget instance placed on the page, preserves the page order, and writes one generated page `index.html`, one generated page `styles.css`, and one generated page `runtime.js`.

This is the core Clickeen Pages doctrine:

- widgets remain the product and rendering unit;
- pages do not introduce a second renderer;
- pages do not reinterpret widget source;
- pages do not serve stacked iframes;
- pages do not assemble themselves in the browser at public request time;
- pages are re-composed when the page changes or when any placed widget instance is edited and re-materialized.

This is why Page Composer is powerful. It turns the existing widget materialization system into hosted pages without inventing a second presentation substrate.

## Current System Truth

Current account widgets already have the source package shape PRD 106 needs:

```text
tokyo/product/widgets/{widgetType}/
  spec.json
  widget.html
  widget.css
  widget.client.js
  editable-fields.json
  limits.json
```

Tokyo already stores account instance source:

```text
accounts/{accountPublicId}/instances/{instanceId}/
  instance.config.json
  instance.content.json
  overlays/locales/{locale}.json
```

Tokyo already materializes an instance to public artifacts:

```text
accounts/{accountPublicId}/instances/{instanceId}/
  index.html
  styles.css
  runtime.js
```

PRD 106 builds on that.

## Existing Prague Share Chrome

Prague already has a strong public-widget share affordance:

```text
prague/src/components/InstanceEmbed.astro
```

It wraps an embedded `clk.live` widget instance with hover/focus chrome:

- a top-right Share button;
- a share menu for copy, SMS, email, WhatsApp, Telegram, Signal, Messenger, WeChat, LINE, Slack, Teams, Discord, X, LinkedIn, Facebook, Reddit, Instagram, and TikTok;
- anchored share URLs that point back to the specific widget embed on the Prague page;
- copy/toast behavior;
- mobile behavior that keeps the chrome visible when hover is not available.

This is good product behavior and must be preserved.

The product direction:

- keep Prague `InstanceEmbed` share chrome as the working reference and current showcase behavior;
- turn the same affordance into a paid widget feature;
- emit the paid feature from each widget's generated package when the account is entitled and the widget instance has the feature enabled;
- do not implement social share as a Page Composer feature;
- do not make Page Composer inject Prague host chrome into page placements;
- do not let social share change the Clickeen Pages tenet that pages compose widget `index.html`, `styles.css`, and `runtime.js` packages.

The current Prague implementation is host chrome. The customer-facing paid product feature should become widget chrome inside the generated widget package.

That means a paid widget instance with social share enabled materializes to:

```text
index.html   includes the share button/menu markup inside the widget root
styles.css   includes the share overlay styling
runtime.js   includes share URL resolution, copy/toast, and channel handlers
```

Then Page Composer stays simple. If a placed widget package contains social share, the composed page contains it. If the widget does not contain it, the composed page does not invent it.

Entitlement must come from real account policy:

```text
packages/ck-policy/entitlements.matrix.json
packages/ck-policy/src/registry.ts
tokyo/product/widgets/{widgetType}/limits.json
```

The expected config path is:

```text
behavior.socialShare.enabled
```

The limits mapping should make enabled social share a paid-only flag. Free accounts see the setting locked or get an upsell from Bob, and public materialization must not emit the overlay for accounts that are not entitled.

When a widget instance with social share enabled is edited and re-materialized, every page containing that instance is queued for page re-composition. Page Composer does not need a separate social-share code path.

## Widget Package Doctrine

Before pages scale, widget packages must be clean.

FAQ is the gold standard refactor:

- `spec.defaults` is structural state, not demo/customer content;
- defaults do not seed fake FAQ rows;
- defaults do not seed product marketing copy;
- defaults do not seed `https://example.com` links;
- `widget.html` is an inert shell with stable hooks;
- add-item templates create blank valid rows through existing object-manager/repeater support;
- tests that need FAQ content create fixture content explicitly.

This matters because Tokyo creates account instances from widget defaults. Anything in defaults can become real saved customer state.

The standard for every widget:

- defaults are valid structural state;
- customer-visible starter content is not hidden in defaults;
- reusable wrapper controls use shared Bob/Dieter modules where they already exist;
- widget runtime renders deterministic state;
- invalid external state fails at the named boundary;
- runtime does not invent fallback product truth.

## Widget File Simplification Workstream

PRD 106 must make widget files easier to scale.

The goal is not smaller files for aesthetics. The goal is:

- fast widget iteration;
- simple AI/agent editing;
- clear source authority;
- fewer repeated blobs;
- fewer self-checking flows;
- easier page composition.

Current widget package responsibilities:

| File | Current role | Simplification target |
| --- | --- | --- |
| `spec.json` | defaults, editor UI, normalization, shared controls, widget-specific controls | keep widget-specific state/control declarations; move repeated editor patterns into shared Bob/Dieter modules |
| `widget.html` | shell and sometimes visible placeholder content | inert shell with stable hooks only |
| `widget.css` | widget CSS plus repeated wrapper/shared styling | widget-specific styles only where shared CSS cannot own the primitive |
| `widget.client.js` | boot, validation, rendering, sanitization, shared primitive orchestration | split boot from render/init contract; keep deterministic widget-specific rendering |
| `editable-fields.json` | translatable/customer text contract | keep as content/translation authority |
| `limits.json` | policy mapping | keep as policy mapping only |

FAQ proved the first rule:

```text
defaults are structural state, not customer content
```

The next FAQ-level simplifications are:

- remove special-case string guards and replace them with behavioral boundary tests;
- prove `createAccountInstanceFromDefaults('faq')` creates an empty valid account instance;
- stop deriving new item identity from mutable customer text such as question/title;
- use stable IDs created by the editor/data boundary;
- keep normalization only for explicit missing-id repair at the named boundary, then delete the repair path once no current product input can produce it;
- reduce giant editor JSON by extracting repeated collection-editor patterns into shared Bob/Dieter modules;
- separate widget boot code from widget render/init code.

The agent-editability target:

```text
An agent should be able to edit FAQ content model, editor controls, or runtime rendering
without reading thousands of lines of unrelated wrapper/editor machinery.
```

Do not solve this with more widget-specific validators. Solve it by moving repeated product primitives to shared modules and testing behavior at the boundary that owns the truth.

## Page Composer

Page Composer is the Roma product surface for account pages.

Minimum V1 user capabilities:

- list account pages;
- create a page;
- rename a page;
- set slug/route;
- set page title and description;
- add an existing widget instance to the page;
- create a new widget instance and place it on the page;
- reorder placements;
- remove a placement;
- open a placed instance in Bob;
- save page composition;
- publish/rematerialize the page.

The first useful UI does not need freeform canvas editing. It can be a vertical ordered list.

Recommended first layout:

```text
Page header
  slug
  title
  description

Placements
  1. Hero instance
  2. Logo carousel instance
  3. FAQ instance
  4. CTA instance
```

The user thinks in sections on a page. The system stores ordered widget instance placements.

## Page Source Contract

Page source must be account-owned, small, and explicit.

Minimum V1 shape:

```json
{
  "v": 1,
  "id": "page_home",
  "slug": "/",
  "head": {
    "title": "Home",
    "description": "A Clickeen hosted page.",
    "canonicalPath": "/",
    "robots": "index,follow"
  },
  "placements": [
    {
      "id": "plc_hero",
      "instanceId": "HERO123456",
      "region": "main",
      "order": 10,
      "layout": "fullWidth",
      "overrides": {}
    },
    {
      "id": "plc_faq",
      "instanceId": "FAQ1234567",
      "region": "main",
      "order": 20,
      "layout": "contained",
      "overrides": {}
    }
  ]
}
```

Required account website storage direction:

```text
accounts/{accountPublicId}/website/
  manifest.json
  pages/{pageId}/source.json
  pages/{pageId}/overlays/locales/{locale}.json
  routes/{slugKey}.json
  publishes/{pageId}/{publishId}/
    index.html
    styles.css
    runtime.js
```

This is one account website workspace, not three product namespaces.

Roma manages the website as one product surface. Tokyo may store separate documents inside that workspace because they have different jobs:

- `manifest.json` is the website management index used by Roma.
- `pages/{pageId}/source.json` is the editable page truth.
- `routes/{slugKey}.json` maps a public slug to the active published page version.
- `publishes/{pageId}/{publishId}/` contains only generated edge-servable output.

V1 may keep the route map inside `manifest.json` instead of separate `routes/{slugKey}.json` files if that is simpler for the current Tokyo implementation. The non-negotiable rule is that the edge route can resolve a slug to `pageId + publishId` without treating editable draft source as the live public website.

Exact filenames can be finalized in implementation, but ownership cannot blur:

```text
account owns page source
page source references account-owned instances
generated page publishes are output
edge serving reads publishes, not source
```

Do not copy the current widget instance folder shape. Pages do not belong under `instances/`, and a page publish must not make the editable source document publicly readable. Widgets have existing source/artifact co-location debt. Pages should start as an account website workspace with clear source, route, and publish documents.

## Placement

A placement is the relationship between a page and an instance.

It owns:

- placement id;
- instance id;
- order;
- region, initially `main`;
- layout hint, initially `fullWidth` or `contained`;
- optional placement overrides.

A placement does not duplicate instance source.

Removing a placement from a page does not delete the widget instance.

## Placement Overrides

Overrides are part of the direction, but they are not required to ship before basic page composition works.

V1 can ship with empty overrides if needed.

When implemented, rules are:

- overrides are explicit path/value maps;
- override paths target fields declared by the placed widget type's `editable-fields.json`;
- overrides are page/placement-owned;
- base instance source remains unchanged;
- invalid override paths fail materialization;
- arbitrary hidden config is not overrideable in V1;
- translated override behavior must be named before translation support ships.

Overrides must not turn Page Composer into a second widget renderer. When overrides exist, Tokyo first produces an override-resolved generated package for that placement, then Page Composer still does the same simple job:

```text
placement widget package
+ placement override-resolved widget package when needed
= package input to Page Composer

Page Composer input remains:
index.html
styles.css
runtime.js
```

## Page Materializer V1

Page Materializer V1 composes one account-owned page into one hosted page output by combining the already materialized packages of placed widget instances.

Input:

- page source;
- ordered placements;
- referenced account-owned instances;
- current generated `index.html`, `styles.css`, and `runtime.js` for each placed widget instance;
- page head metadata;
- placement overrides only when they can first produce an override-resolved widget package.

Output:

```text
accounts/{accountPublicId}/website/publishes/{pageId}/{publishId}/
  index.html
  styles.css
  runtime.js
```

Responsibilities:

- validate page source;
- validate referenced instance ids;
- read each placed instance's generated `index.html`, `styles.css`, and `runtime.js`;
- extract the instance body/root HTML from the generated instance `index.html`;
- preserve placement order;
- emit page head metadata;
- compose all placed instance HTML into one page `index.html`;
- compose all placed instance CSS into one page `styles.css`;
- compose all placed instance runtime into one page `runtime.js`;
- dedupe shared Dieter imports/runtime where possible;
- dedupe repeated widget CSS/runtime where possible;
- emit one page-level `index.html`;
- emit one page-level `styles.css`;
- emit one page-level `runtime.js`;
- fail fast on invalid or missing generated instance files.

The materializer may use an internal representation, but it must describe generated widget packages, not a new widget-rendering model:

```text
CompiledPlacedInstance
  placement id
  widget type
  instance id
  generated HTML fragment
  generated CSS
  generated runtime
  layout hint
```

This representation is not product source. It is materialization work product.

Single public widget pages and composed pages share the same widget renderer and the same payload shape:

```text
single public widget page:
  one CK_WIDGETS entry -> one root -> initWidget(root, state, context)

hosted page:
  many CK_WIDGETS entries -> many roots -> page runtime calls initWidget(root, state, context) for each placement
```

The widget runtime contract should make generated widget packages composable:

```ts
initWidget(rootEl, generatedPayload, context)
```

Then:

- a single public widget page calls `initWidget` once;
- page runtime loops placed widget roots and calls `initWidget` for each;
- widget-specific render logic stays the same;
- page materializer can dedupe shared dependencies without re-rendering the widget from source.

The page materializer must extract and compose:

- body fragments from generated widget `index.html` files;
- page-safe root attributes per placement;
- shared Dieter CSS imports once;
- shared widget CSS once per widget type where possible;
- shared runtime modules once;
- widget client runtime once per widget type where possible;
- generated widget runtime payloads when present;
- page head metadata once.

Runtime payload authority is one map:

```js
window.CK_WIDGETS = {
  HERO123456: {},
  FAQ1234567: {},
  LGS1234567: {}
};
```

`window.CK_WIDGET` is not a product boundary and should not be emitted or read by new runtime work.

Interactive widgets initialize against their own root element. Static widgets remain HTML/CSS.

The materializer must not paste fully standalone widget documents into the page. It must compose fragments and dependencies deliberately.

## Widget Types For Page Sections

Current and future visual sections are normal widget types.

Examples:

- `hero`;
- `split-left`;
- `split-right`;
- `image-title`;
- `steps`;
- `pricing`;
- `testimonial-strip`;
- `cta`;
- `faq`;
- `countdown`;
- `logoshowcase`.

The first new page-section widgets should be hypersimple:

- self-contained fields;
- no nested instance references;
- full-width section rendering;
- normal Bob controls;
- normal Tokyo instance storage;
- normal editable-fields translation contract.

This gets pages live without inventing container composition.

## Embedded Instance References

Some future widget types may need to display another widget instance inside their own layout.

Example:

```text
split-left instance
  left side = copy/image owned by split-left instance
  right side = embedded FAQ instance
```

This is a separate capability from simple page stacking.

Do not implement it accidentally.

Preferred future contract:

```json
{
  "rightInstanceRef": {
    "accountPublicId": "CLICKEEN",
    "instanceId": "FAQ1234567"
  }
}
```

Rules:

- the reference is config, not translated content;
- it uses public account coordinates;
- it does not expose private storage paths;
- it does not copy child instance source into parent source;
- it fails if the referenced instance is missing or not renderable.

PRD 106 V1 should defer embedded references unless the first page composer slice proves stacking is insufficient.

## Translation Contract

For placed instances:

- base instance text lives in `instance.content.json`;
- translatable paths come from the widget type's `editable-fields.json`;
- locale overlays live under the instance;
- San Francisco translates approved concrete paths;
- the page materializer resolves locale values before rendering.

For page metadata:

- page title and description are page source;
- translated page metadata is page-scoped;
- page metadata is not represented as a fake widget instance.

For placement overrides:

- V1 may keep overrides disabled;
- if enabled, translation behavior must be explicit;
- no request-time translation;
- no silent healing.

## SEO/GEO Technical Meaning

In PRD 106, SEO/GEO means the hosted page is technically legible to search engines and AI systems.

It does not mean adding keywords after the fact. It means the materialized page output is a real machine-readable document.

`SEO` means:

- the primary page content exists in the initial HTML response;
- title and meta description are emitted in the HTML head;
- canonical URL is emitted clearly and consistently;
- localized versions have explicit alternate/hreflang behavior when locales exist;
- internal links are normal crawlable links;
- robots directives are explicit;
- HTTP status codes are meaningful;
- sitemap support is planned for hosted pages;
- structured data is valid JSON-LD where the page type warrants it.

`GEO` means generative engine optimization:

- AI answer systems can read the page as coherent semantic content;
- page hierarchy uses real headings and sections;
- FAQ/question-answer content is visible as HTML and can become valid FAQ structured data where appropriate;
- organization, product, service, pricing, feature, and support facts are explicit;
- content is not trapped only in runtime state or client-side app shell output;
- crawler policy for search/AI systems is intentional.

The output contract:

```text
Page Materializer emits crawlable HTML first.
JavaScript enhances behavior after the document is already understandable.
```

Technical implications:

- no app-shell-only hosted pages;
- no page metadata injected only after JavaScript runs;
- no canonical changes after initial HTML;
- no hidden content that differs materially from visible content;
- no request-time generated SEO copy;
- no fake structured data that does not match visible content.

Open technical references for implementation:

- [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics): initial HTML with real content is stronger for users and crawlers; not all bots can run JavaScript.
- [Google canonical guidance](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls): canonical should be clear in the HTML source and not changed to a different URL by JavaScript.
- [Google localized versions](https://developers.google.com/search/docs/advanced/crawling/localized-versions): localized page alternates need explicit language/region annotations when localized URLs exist.
- [Google structured data guidance](https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data): JSON-LD is recommended and must be valid, complete, and accurate.
- [OpenAI crawler guidance](https://platform.openai.com/docs/bots): search visibility and training crawlers are controlled independently; crawler policy must be deliberate.

## Roma Product Shape

Target product navigation after foundation:

```text
Overview
Builder
Widgets
Pages
Assets
Settings
```

`Pages` is the new product area.

Do not add a separate product area for page sections. The inventory is widgets and pages.

First real workflow:

```text
Roma opens page
Page Composer shows ordered widget instance placements
user adds/reorders/removes placements
user opens a placed instance in Bob when needed
Roma saves the page source through Tokyo
Tokyo materializes the page
```

## Edge Serving And Public Artifact Contract

Current widget serving:

```text
clk.live/{accountPublicId}/{instanceId}
```

Hosted page serving must be account/page-owned and edge-served.

The implementation must choose one clear public route strategy:

```text
pages.clickeen.com/{accountPublicId}/{pageSlug}
```

or:

```text
clk.live/{accountPublicId}/pages/{pageSlug}
```

or another explicitly named Clickeen-hosted page route.

The public route must resolve through the account website route map and then serve generated files from the active page publish.

The edge route must not serve from:

- page source files;
- website manifest or route management files;
- page locale overlay files;
- instance source files;
- account asset metadata files;
- internal API routes.

Edge serving responsibilities:

- redirect HTTP to HTTPS;
- support `GET` and `HEAD`;
- reject traversal, encoded slash abuse, backslashes, and invalid account/slug/file coordinates;
- serve only allowlisted generated files;
- return `404` for unpublished, missing, or disabled pages;
- set `content-type` from the generated file;
- set `x-content-type-options: nosniff`;
- emit cache headers deliberately;
- expose no private source documents.

Allowed public files for V1:

```text
index.html
styles.css
runtime.js
```

If V1 uses unhashed `styles.css` and `runtime.js`, they need short CDN cache behavior similar to index. If V1 emits content-hashed assets later, hashed assets may be immutable while `index.html` stays short-cache.

Publish flow:

```text
save page source
materialize page into a new publish version
validate generated files
update website route map atomically to active publishId
edge route serves only the active publishId
```

Unpublish flow:

```text
clear or disable the website route entry
edge route returns 404
old public artifacts may be deleted asynchronously
```

Slug change flow must be explicitly defined before shipping. V1 may choose one of:

- old slug returns `404`;
- old slug redirects to new slug;
- old slug remains as an alias.

Do not leave slug behavior implicit.

## Relationship To PRD 107

PRD 107 waits for PRD 106.

SEO/GEO cannot be correct until PRD 106 names:

- page source truth;
- page head metadata source;
- placement source;
- placement override rules;
- page materialization output;
- page locale behavior;
- public hosted page route;
- instance composition contract;
- initial HTML content contract;
- canonical/hreflang strategy;
- structured data emission boundary;
- crawler/robots policy.

Widget SEO/GEO can continue separately. Hosted page SEO/GEO waits for Page Materializer V1.

## Execution Sequence

PRD 106 executes through the child PRDs now started in `02-Executing`:

1. `106A__PRD__Widget_File_Structure_V2.md`
   Fix single-widget files first: `spec.json`, `widget.html`, `widget.css`, `widget.client.js`, `editable-fields.json`, and `limits.json`.

2. `106B__PRD__Widget_Package_Composition_Contract.md`
   Define the generated widget package contract Page Composer consumes: `index.html`, `styles.css`, and `runtime.js`.

3. `106C__PRD__Paid_Social_Share_Widget_Feature.md`
   Move Prague's share overlay into generated widget packages as a paid widget feature.

4. `106D__PRD__Page_Section_Widgets_V1.md`
   Build the first page-shaped widgets as normal widget types.

5. `106E__PRD__Page_Source_And_Roma_Composer.md`
   Build page source and Roma's Page Composer surface for stacking widget instances.

6. `106F__PRD__Page_Materializer_And_Recomposition.md`
   Compose widget packages into one page package and recompose pages when placed widgets change.

7. `106G__PRD__Page_Publish_Edge_Serve_And_SEO_GEO_Baseline.md`
   Publish and edge-serve the page package with the first SEO/GEO technical baseline.

## Required Non-Scope

Do not:

- create a second presentation primitive;
- create a separate page-section inventory;
- create a second editor model;
- create a second translation model;
- create a generic container/slot system in V1;
- start with full site/domain/nav management;
- start with freeform drag/drop canvas editing;
- delete Prague `InstanceEmbed` share chrome;
- inject Prague `InstanceEmbed` host chrome into every customer-hosted page placement by default;
- implement social share as a Page Composer feature instead of a widget package feature;
- ship page composition as many iframes;
- ship hosted pages as app-shell-only/client-rendered content;
- store page public artifacts beside private page source;
- serve page source files from the public edge route;
- use the widget instance folder as the page artifact folder;
- inject page head metadata only after JavaScript runs;
- emit structured data that does not match visible content;
- add A/B testing in V1;
- add personalization rules in V1;
- add page-scoped AI rewrite flows in V1;
- duplicate entire instance source into page source;
- allow arbitrary hidden config overrides in V1;
- run PRD 107 hosted page SEO/GEO before page materialization exists.

## Verification Scope

PRD 106 is ready for execution when implementation slices can prove:

- 106A makes current widget files easier to edit without inventing new widget package sidecars;
- 106B defines a generated widget package contract based on `index.html`, `styles.css`, and `runtime.js`;
- 106C moves social share into widget packages as a paid feature;
- 106D creates page-section widgets as normal widget types;
- 106E lets Roma create and save pages by stacking widget instances;
- 106F composes widget packages into one page package and recomposes pages when placed widgets change;
- 106G publishes and edge-serves the page package with a baseline crawlable HTML/head contract;
- widget item identity is stable and not derived from mutable customer text for new authored rows;
- widget runtime has a defined single-root init path that can be reused by page composition;
- page source can reference existing instance ids;
- the account website workspace separates editable source, route/live state, and publish output without putting pages under widget instance folders;
- Roma can create and save a page;
- Page Composer can stack existing widget instances;
- Page Composer can create a new widget instance and place it;
- removing a placement does not delete the widget instance;
- edge page route serves only allowlisted generated files;
- edge page route cannot read or expose page source, instance source, or locale overlays;
- unpublish disables the page edge route;
- Page Materializer V1 reads placed widget `index.html`, `styles.css`, and `runtime.js` files as its composition input;
- Page Materializer V1 emits one page `index.html`, one page `styles.css`, and one page `runtime.js`;
- a page with multiple instances does not render as multiple iframes;
- materialized page initial HTML contains the primary visible content;
- materialized page head includes title, meta description, canonical, and robots directives;
- localized page behavior has a named hreflang/canonical strategy before shipping translated hosted pages;
- structured data, when emitted, matches visible content and validates;
- translated instance values resolve through instance locale overlays;
- page metadata is page-owned;
- no second translation path is introduced;
- PRD 107 has a clear prerequisite boundary.

## Success Definition

After PRD 106, Clickeen can say:

```text
Users create and manage hosted pages by stacking Clickeen widget instances.
The visible product primitive is the account-owned widget instance.
Pages own route, head metadata, placement order, and optional placement overrides.
Widget instances remain the source of truth for their own content/config/translations.
Tokyo can materialize one hosted page artifact from many instances.
Widget translation, storage, assets, and runtime work carry forward into pages.
```

That is the foundation for hosted pages, sites, SEO/GEO, personalization, and A/B testing.
