# PRD 107 - SEO/GEO Static Build And Page/Block Strategy

Status: Planning / deferred future PRD / blocked on PRD 106 Prague foundation
Owner: Product + Architecture
Date: 2026-06-02
Replaces: `101__PRD_STUB__Paid_SEO_GEO_Embed_Coding_Agent.md`, former `105N__PRD__Paid_SEO_GEO_Static_Build_Mode.md`
Depends on: `105__PRD__Instance_Folder_Tenets.md`, `105M__PRD__Tokyo_Worker_Instance_Runtime_Refactor.md`, future `106__PRD__Prague_Block_Page_Product_Foundation.md`

## Purpose

Define Clickeen's SEO/GEO strategy across both product layers:

1. published widgets;
2. Prague blocks/pages, and later customer landing pages/sites built from blocks.

PRD 107 is intentionally outside the active PRD 105 runtime execution set. It must not execute before:

- PRD 105 runtime cleanup is committed and green;
- PRD 106 makes Prague block/page contracts clean;
- entitlement authority is named in `ck-policy`;
- public serving proves the PRD 105 widget artifact shape;
- Prague dogfoods public widget coordinates only.

Execution order:

```text
PRD 105: widget source, locale overlays, public artifact runtime
PRD 106: Prague block/page foundation
PRD 107: SEO/GEO strategy for widgets and block-built pages
```

## Core Doctrine

SEO/GEO is static, build-time product output.

It is not:

- a request-time rendering service;
- a `clk.live` public visitor decision;
- a San Francisco public traffic path;
- a second public namespace;
- a reason to duplicate source JSON;
- a reason to let Prague read widget internals.

SEO/GEO means:

```text
approved saved source
approved translation overlays
named entitlement/policy
named materialization operation
richer generated static browser output and metadata
static validation before public serving
```

## Product Layers

### Widgets

Widgets remain account-owned product artifacts.

Widget truth:

- account opens widget in Roma;
- Bob edits one widget in one active locale at a time;
- Roma saves to Tokyo;
- Tokyo owns instance source, overlays, and public materialization;
- public widgets are served from generated artifacts.

The normal public widget shape is fixed by PRD 105 and PRD 105M:

```text
accounts/{accountPublicId}/instances/{instanceId}/
  instance.config.json
  instance.content.json
  overlays/locales/{locale}.json
  index.html
  styles.css
  runtime.js
```

Widget SEO/GEO may change the generated browser output:

- semantic HTML quality;
- structured data;
- Open Graph metadata;
- canonical metadata;
- crawler/indexing metadata;
- attribution behavior according to entitlement.

It must not change:

- the source taxonomy;
- the account coordinate model;
- the runtime public boundary;
- the default public artifact shape;
- the locale overlay model.

Widget SEO/GEO is a richer materialization mode, not a second widget architecture.

### Prague Blocks And Pages

Blocks are page structure, not widgets.

Block/page truth after PRD 106 must be:

- one page owns an ordered list of block instances;
- each block instance has a block type, structured copy, metadata, and optional explicit widget embed refs;
- block/page translations are Prague/page translations, not account-widget translations;
- a widget-in-block is a public reference only: `accountPublicId + instanceId`;
- invalid block/page state fails at the Prague boundary.

Block/page SEO/GEO may use:

- page metadata;
- block copy;
- block translation overlays;
- public widget embed coordinates;
- page route/canonical market+locale data;
- approved product settings saved through product operations.

It must not use:

- account-widget private source internals;
- widget translation operation state;
- San Francisco job state;
- private Tokyo R2 paths;
- SEO/GEO widget build internals;
- inferred customer claims.

Block/page SEO/GEO is a Prague/page materialization strategy. It is adjacent to widget SEO/GEO, not the same operation.

## Shared Boundary Between Blocks And Widgets

A block may contain a widget only through the public widget boundary:

```text
accountPublicId + instanceId
```

That reference means:

- render/embed the published widget;
- never copy widget source into the block;
- never infer widget locale availability from Prague route locale;
- never read private translation state;
- never make Prague a privileged widget consumer.

If SEO/GEO output needs facts from a widget embedded in a page, a child PRD must name the public artifact or public metadata shape that exposes those facts. Prague must not reach behind the public boundary.

## Entitlement Contract

SEO/GEO is a paid capability.

Entitlement truth must come from:

```text
ck-policy + account policy/account tier
```

Do not hardcode SEO/GEO entitlement in Bob, Roma, Tokyo, `clk.live` public serving, Prague, or San Francisco.

Free/base widgets and pages remain functional and static. Free/base surfaces may include honest Clickeen attribution if allowed by plan and policy, but attribution is a growth loop for Clickeen, not full customer SEO/GEO.

## Public Serving Contract

Public visitors must not:

- trigger SEO/GEO generation;
- choose SEO/GEO mode;
- call Bob;
- call Roma editor state;
- call Berlin;
- call San Francisco;
- read private source JSON directly;
- read translation operation state.

`clk.live` serves generated widget artifacts.

Prague/Cloudflare Pages serves generated or server-rendered Prague pages from the approved page/block source contract. If a future customer page/site runtime exists, it must name its own public artifact path and serving boundary.

## Locale Contract

The default PRD 105 widget architecture is not per-locale HTML or per-locale JavaScript.

Do not make this the default widget model:

```text
fr.html
script.fr.js
styles.fr.css
```

The default widget model remains:

```text
index.html
styles.css
runtime.js
overlays/locales/{locale}.json
```

Widget SEO/GEO may propose static locale-specific pages only if a future child PRD proves a real SEO/GEO need, names the public artifact shape, and keeps it separate from the default embed model.

Prague/block/page locale behavior must be defined by PRD 106 before PRD 107 executes. If block-built pages need locale-specific static routes, that shape belongs to the page/block lane, not the widget embed lane.

## Widget-Specific SEO/GEO Requirements

PRD 107 child slices must define widget-specific rules before implementation.

For FAQ, likely requirements include:

- semantic question/answer structure;
- `FAQPage` JSON-LD only when content qualifies;
- no hidden keyword stuffing;
- no hallucinated claims;
- translated FAQ text only when the locale overlay exists and is in sync;
- clear metadata derived from saved instance source.

For future widgets, each widget type must map to the correct semantic and structured-data contract. Do not force FAQ schema onto unrelated widgets.

## Block/Page SEO/GEO Requirements

PRD 107 child slices must define block/page rules after PRD 106 names the block/page source contract.

Likely requirements include:

- page title, description, canonical, alternate locale metadata;
- block-level semantic HTML rules where the block type has semantic meaning;
- clear rules for when embedded widgets contribute public metadata to a page;
- static validation against hidden text and keyword stuffing;
- no invented customer facts, reviews, prices, business locations, offers, availability, guarantees, or claims;
- translated page copy only when page/block translation overlays are present and in sync.

## Free Attribution Contract

Free widgets and pages may include visible, honest Clickeen attribution when policy requires it.

Rules:

- attribution is visible and accessible;
- attribution is not hidden text;
- attribution points to the relevant Clickeen/Prague product page when possible;
- paid plans may remove attribution according to entitlement;
- attribution does not claim the customer's widget, page, or site has paid SEO/GEO unless enabled;
- attribution does not keyword-stuff customer pages.

## Prague Dogfood Contract

Prague is a first-class dogfood surface for SEO/GEO only through explicit product boundaries.

Prague may embed Clickeen-owned widgets by:

```text
accountPublicId + instanceId
```

Prague may dogfood block/page SEO/GEO through its own page/block source contract after PRD 106.

Prague must not consume:

- generated widget source internals;
- widget translation operation state;
- San Francisco job state;
- private Tokyo R2 paths;
- widget SEO/GEO build internals.

## Expected Future Child Slices

| Slice | Scope |
| --- | --- |
| `107A` | SEO/GEO entitlement and account policy contract |
| `107B` | Widget-specific semantic HTML and structured-data rules |
| `107C` | Widget metadata, canonical, crawler, and indexing policy for the PRD 105 public shape |
| `107D` | Widget build-time agent/rules for SEO/GEO output and validation |
| `107E` | Roma/Bob widget controls, status, and validation report UX |
| `107F` | Prague dogfood pages for widget SEO/GEO examples through public widget coordinates |
| `107G` | Page/block SEO/GEO source contract, blocked on PRD 106 |
| `107H` | Page/block semantic HTML, metadata, canonical, and indexing rules |
| `107I` | CI/static validation against hidden text, spam, hallucinated claims, and invalid structured data |
| `107J` | Optional future locale-specific static widget artifacts, only if SEO/GEO need is proven |
| `107K` | Optional future customer page/site public artifact shape, only after page/block product scope is named |

## Required Non-Scope

Do not:

- introduce runtime SEO rendering;
- change the PRD 105 widget instance-folder default;
- add alias/shortener/public namespace systems;
- create default widget `{locale}.html`;
- make `clk.live` public serving compute SEO/GEO per request;
- make San Francisco run on public visitor traffic;
- duplicate widget source JSON for SEO/GEO;
- duplicate page/block source JSON for SEO/GEO;
- copy account assets into instance folders;
- bypass account policy entitlement;
- make Prague a privileged consumer of widget internals;
- execute page/block SEO before PRD 106 names the page/block contract.

## Verification Scope

This PRD is ready for child execution only when:

- PRD 105 instance folder taxonomy is green enough for publish/materialization work;
- public widget generation uses `index.html`, `styles.css`, and `runtime.js`;
- locale overlays are represented as `overlays/locales/{locale}.json`;
- Tokyo-worker no longer writes `translation-generation-job.json`;
- Tokyo-worker no longer materializes default `{locale}.html`, `script.{locale}.js`, `script.v*.js`, or `styles.v*.css`;
- entitlement authority is named in `ck-policy`;
- Prague dogfoods public widget coordinates only;
- PRD 106 names the Prague block/page source, translation, validation, and render contracts;
- active docs no longer present the old PRD 101 stub or former 105N as current authority.

## Archive Decision For Source Stub

The old PRD 101 stub must remain archived in `03-Executed` as historical planning evidence.

Required archive status:

```text
Historical future-feature stub.
Surviving SEO/GEO doctrine extracted to PRD 107.
Superseded by PRD 105, PRD 106, and PRD 107 where conflicting.
```
