# FAQ Widget

STATUS: LOCAL CANONICAL CORE IMPLEMENTATION — NOT DEPLOYED

## Purpose

FAQ presents grouped questions and answers in list, accordion, grid, or masonry
layouts. FAQ owns that meaning and behavior. Stage, Pod, Header, Bob, Roma,
materialization, localization, account policy, storage, and serving remain
shared Clickeen services.

## Source

```text
tokyo/product/widgets/faq/
  widget.html
  spec.json
  editable-fields.json
  limits.json
  discovery.json
  labels/
    en.json
  upsell/
    en.json
  core/
    core.html
    core.css
    core.js
```

The deleted `widget.css` and `widget.client.js` have no alias or compatibility
wrapper.

## File Ownership

| File | FAQ responsibility |
| --- | --- |
| `widget.html` | Complete Stage/Pod/Shell/Header/Core composition and declared shared/Core sources |
| `core/core.html` | FAQ sections, questions, answers, identities, accessibility relationships, and Discovery microdata locations |
| `core/core.css` | FAQ layouts, cards, links, accordion presentation, and FAQ typography variables |
| `core/core.js` | FAQ accordion, startup expansion, and deep-link interaction |
| `spec.json` | FAQ defaults and Bob controls |
| `editable-fields.json` | Exact customer-content paths and repeated-item identities |
| `limits.json` | Generic entitlement bindings and exact FAQ message identities |
| `discovery.json` | Internal FAQ/search/answer-system meaning |
| `labels/en.json` | Exact English FAQ ToolDrawer copy |
| `upsell/en.json` | Exact English FAQ-context denial messages |

Core JavaScript is mandatory. It does not create the initial FAQ, contain the
editable instance, host Bob, materialize, localize, enforce tiers, or serve the
Widget.

## Contract

| Concern | Value |
| --- | --- |
| `widgetname` | `faq` |
| display name | FAQ |
| Core namespace | `faq.*` |
| panels | `content`, `layout`, `appearance`, `typography`, `settings` |

Core state families remain:

```text
faq.appearance
faq.behavior
faq.displayCategoryTitles
faq.geo
faq.layout
faq.sections
```

Each section and question carries its stable saved `id`. The Widget compiler
owns default identity production. Bob, Roma, materialization, and Tokyo-worker
trust the resulting instance truth rather than repairing or revalidating it.

## Authored HTML Contract

`widget.html` contains exactly one `{{> core}}` Mustache partial. The build
resolves it from `core/core.html`. Bob preview and Roma Publish use the same
compiled software with different exact state inputs:

```text
compiled FAQ software + Bob draft -> temporary Workspace preview
compiled FAQ software + saved source + allowed Publish -> stored package
```

FAQ Core directly authors every section/question loop, stable DOM identity,
question-to-answer relationship, accordion controls, and accessibility
reference. Complete saved questions and answers therefore exist in generated
HTML before JavaScript.

## Editable Customer Content

```text
header.title
header.subtitleHtml
headerCta.label
faq.sections[].title
faq.sections[].faqs[].question
faq.sections[].faqs[].answer
```

Header title/subtitle, questions, and answers retain the existing compact
inline-rich-text behavior. Each materialized value has its exact
`data-ck-content-path` and `data-ck-content-mode` attribute. Tokyo-worker uses
those generic authored coordinates for selected-locale Edge expression; it has
no FAQ path list.

## Editor Composition

FAQ retains the canonical ToolDrawer sequence:

1. Content — shared Header, section-title setting, Sections Object Manager,
   and nested question/answer Repeater.
2. Layout — shared Header/Core/Stage/Pod layout plus FAQ list, accordion, grid,
   masonry, columns, gaps, and card padding.
3. Appearance — shared Header/Stage/Pod appearance plus FAQ icons, links, and
   Q&A-card surface.
4. Typography — Section title, Question, and Answer roles after shared roles.
5. Settings — FAQ accordion/deep-link behavior plus shared locale, branding,
   social share, and **Enable SEO/GEO** controls.

Only shared Header and the primary FAQ Content section start open.

## Limits And Upsell

| System capability | FAQ coordinate/metric | Message |
| --- | --- | --- |
| `branding.remove` | `behavior.showBacklink` | `branding.remove` |
| `widget.socialShare.enabled` | `behavior.socialShare.enabled` | `social-share.enable` |
| `embed.seoGeo.enabled` | `behavior.seoGeo.enabled` | `seo-geo.enable` |
| `items.group.small.max` | `faq.sections[]` count | `sections.max` |
| `items.group.medium.max` | `faq.sections[].faqs[]` per-section count | `questions-per-section.max` |
| `items.group.large.max` | `faq.sections[].faqs[]` total count | `questions-total.max` |

Bob applies one generic decision before a manual, Product Copilot, or undo
mutation. A denial leaves the draft unchanged and sends Roma the exact
`{ capability, messageId, required }`. Roma selects the first higher system
tier that permits `required`, inserts system current/target plan names into the
exact FAQ message, and opens one shared Popup. Save does not repeat the limit.
Core and the public package contain none of this commercial UI.

## Discovery

`discovery.json` declares:

- kind `faq`;
- baseline title `FAQ by Clickeen`;
- baseline description `Questions and answers published with Clickeen.`;
- section-title, question, and answer parts; and
- the exact question `answers` answer relationship using section/question
  identities.

Every Publish writes the baseline title and meta description. When both the
saved `behavior.seoGeo.enabled` value and system
`embed.seoGeo.enabled` flag are true, FAQ Core's authored schema.org
`FAQPage`/`Question`/`Answer` microdata surrounds the exact visible content
slots. The generic render seam attaches FAQ's declared parts and `answers`
relationship to those matching slots; FAQ Core alone turns those annotations
into FAQ search markup. The user does not edit `discovery.json`; no shared
service contains FAQ markup or derives customer metadata.

## Core Behavior

FAQ retains list, accordion, grid, and masonry presentation. Accordion startup
uses one existing authority:

```text
expandAll -> open every question
else expandFirst -> open the first question
else -> start closed
```

`multiOpen` governs later interaction. Deep links use the exact question item
anchor and open their target without making the rich-text question link itself
an accordion toggle.

## Lifecycle

- New and Duplicate write unpublished editable source only and open the new
  instance in Bob.
- Bob previews compiled FAQ software plus one browser-memory draft.
- Save updates `instance.config.json` and `instance.content.json` only.
- A clean explicit Publish/Republish invokes Roma's generic materializer.
- Roma alone generates complete `index.html`, complete `styles.css`, and
  mandatory visitor-behavior `runtime.js`.
- Tokyo-worker stores the exact bytes and publication truth.
- Base serving returns stored files. Selected-locale serving applies the exact
  overlay to semantic content slots through Cloudflare `HTMLRewriter` before
  JavaScript.

## Local Verification

```bash
node scripts/widgets/generate-artifacts.mjs --widget faq
node scripts/widgets/generate-artifacts.mjs --widget faq --check
git diff --check -- tokyo/product/widgets/faq documentation/widgets/widgets/faq.md
```

Inspect the focused generated editor/materializer artifacts and materialized
FAQ HTML/CSS/JavaScript. Cloud-dev and live product truth require an authorized
deploy and owner-surface verification; neither has been performed by the local
PRD 129 pass.

## Hard Stops

- Do not restore `widget.client.js` or turn `core.js` into the same pipeline.
- Do not put FAQ paths or meaning in Bob, Roma, Tokyo-worker, Dieter, or shared
  Widget code.
- Do not make Create or Save generate public files.
- Do not make Bob preview read a stored package.
- Do not move tier/Popup behavior into Core or public runtime.
- Do not localize initial public content in JavaScript.
- Do not migrate another Widget in the FAQ pass.
