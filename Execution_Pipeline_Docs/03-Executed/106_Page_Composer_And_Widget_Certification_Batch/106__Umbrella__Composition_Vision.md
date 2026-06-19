# Clickeen Composition Vision — Umbrella for PRD 106 (Pages)

Status: Umbrella / vision lens (not a spec)
Scope: PRD 106 page composition authority.
Relationship: Sits under `strategy/ClickeenVision.md` and the PRD 105 tenets; it
explains the _intent_ and _mental model_ behind page composition and delivery so
implementation work stays grounded.

Execution split:

- `PRD106A_realignment.md` cleans up drift against this umbrella.
- `PRD106A2_WidgetShellExtraction.md` extracts FAQ's working Widget Shell into
  `packages/widget-shell/` and defines the Widget Core extension contract.
- `PRD106B_PageComposer.md` defines the Roma Page Composer product boundary.
- `PRD106C_Prague astro blocks migration to widget instances.md` ports Prague
  Astro block work into real widgets and widget instances.
- `PRD106C3` through `PRD106C6` define the new Prague-absorbing widgets as
  Widget Shell plus Widget Core deltas.
- `../../01-Planning/planning_PRD__Prague_Migration_From_Astro_Blocks_To_Page_Composer.md`
  moves Prague pages from Astro block assembly to composed Clickeen page output
  after the widget-instance ports are real.
- `../../01-Planning/110__PRD__Toxic_Flow_Deletion.md` owns the deletion/fencing
  campaign for active fake flows, duplicate truths, toxic functions, files,
  routes, tests, and LOCs that contradict this umbrella.

## PRD106 Execution Tenets

These tenets govern every PRD in the 106 series.
This section is the canonical execution contract. Child PRDs repeat the local
current-step gate on purpose so agents cannot skip the active step, but this
umbrella is the source of truth for the contract language.

- Execute one PRD step at a time.
- Do not begin the next step until the current step is green.
- Green means the step's named completion evidence exists: diff, test, `rg`
  output, screenshot, or docs diff.
- A blocker report is not green. It is evidence to stop without moving to the
  next step.
- If a step is not green, stop and report the blocker. Do not invent product
  behavior to keep moving.
- The goal is not to accommodate old drift. If existing code contradicts the
  intended architecture, delete it, fence it, or stop; do not preserve it and
  work around it.
- Long reference sections are not execution permission. The active execution
  permission is the current step only.
- When two PRDs appear to overlap, the authority table below decides ownership.
- If a required decision is missing, add it to the current PRD's
  `OPEN QUESTIONS (BLOCKERS) FOR PIETRO, PRODUCT OWNER` section and stop.

## Authority Table

| Concern                                        | Authority                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------ |
| Product mental model and non-negotiable tenets | This umbrella                                                                        |
| Realignment/deletion map against current drift | `PRD106A_realignment.md`                                                             |
| Shared Widget Shell extraction                 | `PRD106A2_WidgetShellExtraction.md`                                                  |
| Page Composer product/build path               | `PRD106B_PageComposer.md`                                                            |
| Prague block migration map                     | `PRD106C_Prague astro blocks migration to widget instances.md`                       |
| Prague factual block inventory                 | `PRD106C2_Prague astro blocks audit.md`                                              |
| Split-family Cores                             | `PRD106C3_Split_Widget.md`                                                           |
| Cards Core                                     | `PRD106C4_Cards_Widget.md`                                                           |
| Big Bang Core                                  | `PRD106C5_BigBang_Widget.md`                                                         |
| CTA Core                                       | `PRD106C6_CTA_Widget.md`                                                             |
| Prague route cutover to composed pages         | `../../01-Planning/planning_PRD__Prague_Migration_From_Astro_Blocks_To_Page_Composer.md` |
| Toxic-flow deletion/fencing                    | `../../01-Planning/110__PRD__Toxic_Flow_Deletion.md`                                 |

## Series Step Order

Execute in this order unless Pietro explicitly changes the order.

1. Read this umbrella and confirm the product tenets.
2. Execute `PRD106A_realignment.md` drift audit steps.
3. Execute `PRD106A2_WidgetShellExtraction.md`.
4. Execute `PRD106B_PageComposer.md`.
5. Execute `PRD106C2_Prague astro blocks audit.md`.
6. Execute `PRD106C_Prague astro blocks migration to widget instances.md`.
7. Execute widget Core PRDs one at a time: Split, Cards, Big Bang, CTA.
8. Execute `../../01-Planning/planning_PRD__Prague_Migration_From_Astro_Blocks_To_Page_Composer.md`.
9. Execute `../../01-Planning/110__PRD__Toxic_Flow_Deletion.md`.

Do not merge steps across PRDs. A PRD may reference another PRD, but it may not
silently execute another PRD's authority.

## What this doc is for

PRD 106 is precise but narrow: add pages as account-owned composed output from
saved widget instances. This doc says _why the shape is what it is_, so you
don't reinvent it, over-build it, or misread its restraint as missing scope. If
a decision seems oddly minimal, this doc is where the reason lives.

## Non-Negotiable Product System Tenets

This section is the execution gate for PRD 106. Any code, PRD language, or plan
that contradicts it is drift and must be fixed before work continues.

```text
Widgets are Clickeen-authored software units that produce browser-readable code.
Widget instances are account-owned saved widgets users create/edit in Roma/Bob.
Pages are account-owned browser-readable code composed from X widget instances.
Bob is only the browser editor: open, edit in browser memory, save.
Roma is the app: route the user to the account, apply tier/account authority,
and save what the user does.
Roma Pages arranges widget instances; it does not edit the instances it uses.
Tokyo stores and serves R2 files. Nothing more.
Clickeen uses Clickeen: admin is just an account using Clickeen's own widgets.
```

The boundary is deliberately boring:

- Bob must not become a page product, policy authority, storage authority, or
  hidden server system. It edits one widget in browser memory and submits the
  user's save.
- Roma owns product orchestration: account context, tier permission, page UX,
  save acceptance, publish/unpublish intent, and account-facing errors. In the
  page domain, Roma owns selecting, ordering, saving, composing, and publishing
  widget instances as a page; it does not own editing those instances.
- Tokyo accepts exact files from Roma, validates only R2/file-storage safety
  boundaries such as account coordinate, allowed path, content type, file
  allowlist, and object existence, stores those bytes in R2, and serves
  already-stored public files. Tokyo must not become a product brain, tier
  brain, widget renderer, page composer, dependency tracker, SEO/GEO system,
  sanitizer, readiness engine, or policy subsystem.
- Pages live physically in Tokyo/R2 because they are browser-readable files.
  That does not make Tokyo the page product authority. Roma decides what is
  being saved, why it changed, and when it must be regenerated; Tokyo stores
  the submitted files.
- Clickeen dogfooding does not create an admin exception. The Clickeen account
  uses the same widgets, instances, pages, save path, and public delivery path as
  any other account.

Allowed under these tenets:

```text
Bob edits one widget instance in browser memory; Roma saves browser-readable files -> Tokyo stores them.
Roma composes X saved widget instances into page index.html/styles.css/runtime.js -> Tokyo stores them.
Roma Pages can select, order, remove, and save widget instances as a page.
clk.live serves already-stored files when Roma-submitted file-serving state allows it.
```

Not allowed:

```text
Tokyo rendering widgets from private source.
Tokyo composing pages from product logic.
Tokyo tracking which pages use which widget instances.
Tokyo deciding that an instance save should recompose pages.
Tokyo deduping CSS/runtime, generating SEO/GEO metadata, or deciding readiness.
Tokyo enforcing tier/product policy.
Tokyo repairing invalid product state.
Tokyo inventing page source, widget source, route maps, slugs, blocks, sections,
website workspaces, publish folders, or package registries.
Bob receiving page state or becoming a page editor.
Roma Pages editing instance config/content, creating page-owned overrides,
forking instances, or freezing instance snapshots.
Admin/Clickeen-only product branches.
```

## The vision in one sentence

Clickeen is a design system that ships: small, structured, self-translating
product units that compose into larger ones — widget instances into pages, pages
into sites in a separate approved PRD — on one substrate, so building a
localized web presence becomes composition, not construction.

## The mental model: a design system, but the components are products

Anyone with a design-systems background will recognize the ladder. The important
move is getting the rungs right, because the lower rungs already exist — they're
just not named "atoms."

```text
Dieter          -> tokens, spacing, typography, controls
widget          -> FAQ, Hero, CTA, Split, Countdown, Logo Showcase
widget instance -> account-owned saved widget output
page            -> browser-readable code composed from X widget instances
site            -> collection of pages + nav/domain/routes - not PRD 106
```

A widget is **not** a molecule. It's an organism — a whole section made of many
parts. The atom/molecule layers beneath it are Dieter and the shared editor
controls. Nothing is missing from the ladder; the design system _is_ the bottom
of it.

The difference from classic atomic design: in Brad Frost's world, and in every
page builder (Webflow, Framer, Notion, Gutenberg), the composable unit is a
**dumb fragment** that only exists inside its host. In Clickeen, the composable
unit is a **whole product**.

## Widget Shell

Every normal widget uses the same FAQ-proven product architecture:

```text
Widget = Widget Shell + Widget Core

Widget Shell:
Stage
  Pod
    ck-headerLayout
      Header
      Widget Core
```

The Widget Shell is already working in FAQ. It includes Stage, Pod, Header, CTA,
Header layout, Header CTA appearance, Stage/Pod layout, Stage/Pod appearance,
Typography, locale switcher, branding/settings, editable-fields translation,
Bob preview, Roma save/materialization, and public runtime/package behavior.

This is a product architecture primitive, so the execution target is a shared
repo package:

```text
packages/widget-shell/
```

`packages/widget-shell` owns the shell contract, shell defaults, shell controls,
shell renderer/helpers, shell CSS/runtime helpers, and shell validation. FAQ is
the proof and extraction source; the package is the surviving authority.

Widget source folders own only widget-specific Core software:

```text
widget core schema
widget core defaults
widget core controls
widget core editable fields
widget core CSS/runtime
```

The current physical location for widget source may still be
`tokyo/product/widgets/{widget}/`, but that does not make Tokyo the widget
architecture owner. Those files are repo product source consumed by Bob/Roma
materialization and Tokyo validation/storage paths. Tokyo stores account source
and generated artifacts; it does not own or decide the Widget Shell.

Header has one meaning across normal widgets:

```text
Header = title + optional subtitle + optional CTA
```

The working paths are `header.*` and `headerCta.*`. Do not invent widget-specific
`headline`, `subheadline`, `copy`, `primaryCta`, `secondaryCta`, `button`,
`eyebrow`, or duplicate Header/CTA/layout paths for normal widgets.

For every new or migrated widget, the only expected change is what renders
inside the Widget Core div. Core is the generic widget-owned slot where
widget-specific software begins:

```text
FAQ Core div                     -> FAQ software: sections/questions/answers
Split Media Core div             -> one image/video visual
Split Instance Core div          -> one embedded account-owned widget instance
Split Carousel Media Core div    -> 2-6 image/video visuals plus carousel runtime
Split Carousel Instance Core div -> 2-6 embedded account-owned widget instances plus carousel runtime
Cards Core div                   -> Cards software: cards/items/treatments
Countdown Core div               -> Countdown software: timer/countdown content
Logo Showcase Core div           -> Logo Showcase software: logo strips/items
CTA Core div                     -> empty; Shell Header/CTA only
Big Bang Core div                -> Big Bang software: large typography/content treatment
```

This rule exists so agents do not rebuild a new editor, layout model,
appearance model, translation system, or runtime shell for every widget. Widgets
differ by the software inside the Core div, not by architecture.

Because every widget has a Core div, the shared Widget Shell owns generic Core
div sizing. Bob UI must not expose the word "Core" to users. Each widget
provides user-facing labels for that Core div, such as `FAQs`, `Visual`,
`Cards`, `Logos`, or `Timer`; Bob renders shared Core sizing controls using the
widget's label.

This is also how Countdown and Logo Showcase reach gold standard without
rebuilding the product twice. They are rebased onto the shared Widget Shell, and
their remaining work becomes only their Core: timer behavior for Countdown and
logo-strip/media behavior for Logo Showcase.

## The anchor: it's Figma's component model, for live localized web content

```text
browser:   one HTML/CSS/JS artifact -> renders one thing
Clickeen:  one widget instance      -> renders one widget
Clickeen:  X widget instances       -> renders one page
```

A page is not a new engine. It is the same browser-readable output model as a
single widget instance, but with X widget instances composed together before the
files are served.

## Why this is a moat (the composed unit is a _product_)

The novelty is not composition — composition is everywhere. The novelty is that
Clickeen's composable unit is, simultaneously, all four of these at once:

1. **Independently shippable** — a widget ships standalone, embedded on external
   sites, viral ("Made with Clickeen").
2. **Auto-localized** — one substrate (`editable-fields` → San Francisco →
   locale overlays) translates every unit across the supported locale set at
   near-zero marginal cost.
3. **Content-addressed and materialized** — every unit becomes a deterministic
   public artifact; propagation is free.
4. **AI-operable** — every unit is structured, contracted, and tokenized, so AI
   can author, translate, compose, and operate it.

No competitor combines all four. A Webflow section isn't a standalone product; a
Gutenberg block doesn't translate itself; a Figma component isn't edge-served.
That combination is why there is no prior art to copy — and why this is defensible.

## The moat property to never invert: propagation is the product

Edit one widget instance -> every page that uses it recomposes and reflects the
change after the saved input changes. This is the **asset**, not a cost. It is the
same mechanic that lets a republished widget update every external site that
embeds it. Any design that re-introduces a per-consumer rebuild cost, or treats
"this change fans out to N pages" as a problem to ration, has inverted the moat
and is wrong. Pages compose instances; they do not become a second instance
truth.

This is the atomicity rule: the widget instance is the editable unit. A page can
use the instance, but it cannot edit, override, fork, or snapshot it. If a user
wants to change an instance, they open that instance in Bob. Roma Pages then
recomposes every page that uses the updated instance.

## The WordPress test

This is the simplest product test for PRD 106:

1. A user creates a widget instance in Clickeen, saves it, copies the embed line,
   and pastes it into a WordPress div. WordPress shows that one Clickeen widget
   instance.
2. The user creates more widget instances in Clickeen.
3. The user opens Clickeen Pages, selects several widget instances, orders them,
   saves/publishes the page, copies the page embed line, and pastes it into the
   same kind of WordPress div. WordPress now shows X Clickeen widget instances
   stacked together.
4. The user then edits one of those widget instances in Clickeen and saves it.
   WordPress keeps the same pasted page embed line, but the page now shows the
   updated instance inside the stack.

That works because WordPress is only the host. It is not the source of truth and
does not need a repaste when Clickeen content changes. Clickeen owns the stable
URL and the browser-readable files behind it. A single-instance embed points to
one widget instance's files; a page embed points to files composed from X widget
instances. Updating an instance regenerates the instance files and recomposes
every page file that uses it.

If this workflow fails, PRD 106 has failed. A page that goes stale after an
instance edit is just copied HTML, not Clickeen composition.

## The discipline: no fourth noun

The atomic ladder is a **thinking tool**, not a schema. Do not mint a product
object for every rung. Clickeen deliberately keeps this concern to three product
words:

```text
widget instance = one account-owned widget compiled to browser-readable files
page            = X widget instances compiled together to browser-readable files
```

Everything below `widget instance` is widget/Dieter/editor implementation.
Everything above `page` (site, nav, domains) is not PRD 106 unless Pietro,
Product Owner, explicitly adds it to this PRD series.

> Historical note: an earlier draft introduced a separate "block" object. It was
> **removed**. Hero, Split, CTA, image/title, and similar page-shaped surfaces are widgets. There is no block.
> Do not reintroduce one. The urge to formalize every atomic layer as its own
> object is the over-architecture trap; resist it.

## The shared substrate (what every level reuses)

This is the PRD 105 machinery, and it is the reason pages cost almost nothing to
add:

```
account-owned source  (instance.config.json + instance.content.json)
declared translatable fields  (editable-fields.json)
concrete-path extraction → San Francisco translation
locale overlays  (overlays/locales/{locale}.json)
deterministic materialization → public artifacts (index.html, styles.css, runtime.js)
content-addressed, edge-served, fail-visibly (no silent healing)
```

A page does not get a second editor, a second translation model, or a second
renderer. It _activates_ this substrate at a higher level of composition. New
output formats (pages today, sites in a separate approved PRD) inherit
translation, materialization, and serving for free. This is the multiplicative
("100⁵"), not additive, model.

## Page Composer

Page Composer is the Roma-owned, dependency-aware materializer for pages. It is
not the product noun "page" and not a page editor. It is the workflow that turns
selected widget instances into one clean page output.

Page Composer owns:

- Listing/selecting account-owned widget instances for a page.
- Ordering/removing selected instances.
- Saving page composition source beside the page files as
  `accounts/{account}/pages/{page}/source.json`.
- Knowing which pages use which widget instances through Roma Pages service
  state, so saving an instance can trigger recomposition of every affected page.
- Reading the current browser-readable files for each selected widget instance.
- Composing one page `index.html`, one page `styles.css`, and one page
  `runtime.js`.
- Deduping shared CSS/runtime contributions so a page does not become junk
  repetitive code when multiple instances share Dieter/runtime assets.
- Keeping per-instance runtime state isolated while producing one page runtime.
- Producing crawlable, semantic, SEO/GEO-friendly page HTML: real initial
  content, ordered sections, page title/description/robots/canonical, and
  structured data where valid.
- Coordinating page-level localization across the included instances: IP/country
  language selection, page default locale, and an optional Clickeen-owned
  top-of-page language switcher. Page Composer does not create a second
  translation system; it resolves one page locale context and every included
  instance follows that context.
- Failing visibly when an instance is missing, unowned, invalid, stale, or not
  ready to compose.

Page Composer does not own:

- Editing widget instance config/content.
- Page-specific instance overrides.
- Forking or snapshotting instances.
- Blocks, sections, slots, route maps, site nav, or custom domains.
- Request-time rendering.
- Tokyo product authority.
- Customer host-nav language integration as the default product path. Clickeen
  can manually wire Prague/site language controls to Clickeen-owned pages
  because it controls that site, but normal customer pages use IP localization
  and the optional Clickeen page switcher.

It is "smart" only at the composition boundary: dependencies, dedupe, clean
browser files, SEO/GEO output, readiness, and clear failure states. It must stay
dumb about editing and product shape.

## Prague Block Migration Reality

Prague has valuable Astro block work. That work is not discarded, but it is not
product architecture. The migration path is to port the block implementation,
layout behavior, content shape, responsive behavior, assets, and SEO semantics
into the shared Widget Shell as Widget Core implementation, then save those as
normal Clickeen widgets and account-owned widget instances. FAQ proves the
Shell; `packages/widget-shell/` is the surviving implementation authority.

The surviving Prague-derived widget targets in Tokyo are:

```text
big-bang              -> migrated widget target
calltoaction          -> migrated widget target
cards                 -> migrated widget target
split-media           -> shipped Split-family media target
split-carousel-media  -> shipped Split-family media carousel target
```

Deleted or deferred Prague-derived targets are not compatibility surfaces:
`hero`, `steps`, legacy polymorphic `split`, and `cardgrid` must not remain
customer widget targets. "Compiles in Bob" is only the halfway line. A finished
migration must have:

- useful non-empty defaults, not blank scaffold instances;
- the shared Widget Shell package, not a Prague-derived editor architecture;
- Bob controls only for the Widget Core that changes;
- faithful responsive layout and visual behavior from the Astro block;
- translatable field contracts matching the real authored content;
- public output that visually matches the intended Prague section;
- materialized widget instance files that Page Composer can stack without
  special cases.

The hard part is not naming. The hard part is refusing to import Prague layout
vocabulary as new widget architecture. Prague blocks use rows, columns,
variants, tile grids, media placement, and per-block CTA behavior. PRD106A2
extracts FAQ's proven shell into `packages/widget-shell/`; PRD106C then adds
only the new Widget Core and its required controls. Prague
vocabulary must not become page-level columns, a new block object, or duplicate
Header/CTA/layout state.

None of that intelligence belongs in Tokyo. Tokyo does not know the selected
instance list, dependency graph, recomposition reason, CSS/runtime dedupe plan,
SEO/GEO intent, or page readiness meaning. If Tokyo has to understand any of
those things for a page to work, the boundary is wrong. Roma Page Composer sends
finished `index.html`, `styles.css`, and `runtime.js`; Tokyo stores and serves
those files.

## What PRD 106 is, in this frame

PRD 106 adds the **page** noun and the Roma-owned workflow that composes it.

- A page is multiple widget instances compiled together into browser-readable
  code.
- PRD 106 pages are object-addressed by `pageId`, not slug-addressed by route.
- Hero, Split, CTA, image/title, and similar page-shaped surfaces are not blocks.
  They are widgets — hypersimple, self-contained, full-width. No containers, no
  nesting unless Pietro explicitly approves that product behavior.
- Roma composes already-saved widget instance files into **one** page document:
  not 20 iframes, not request-time assembly, not a separate page engine.
- Roma Pages is an arrangement surface only: bulk-select existing widget
  instances through a large selection surface, order/remove references in the
  page stack, save the page, and publish the resulting page files. It must not
  edit instance config/content inline.
- Output is **crawlable HTML first** for the Clickeen-hosted page URL (content
  in the initial response, head metadata/canonical/JSON-LD server-side when
  valid) so hosted pages are legible to search engines _and_ AI answer systems
  (SEO + GEO). JS only enhances.
- Pages live physically beside instances in account R2 storage. The page source
  follows the same source/output split as widget instances:
  `accounts/{account}/pages/{page}/source.json`,
  `accounts/{account}/pages/{page}/index.html`,
  `accounts/{account}/pages/{page}/styles.css`, and
  `accounts/{account}/pages/{page}/runtime.js`. Product authority remains Roma.
  Tokyo stores these files and serves already-stored public output only; Tokyo
  does not interpret `source.json`.

The restraint is intentional: no container/slot system, no generic
embedded-instance nesting, no sites/domains/nav, no drag-drop canvas, no A/B or
personalization. Compose full-width widget instances into page files, host or
embed them, and add depth only when a real need proves it and the product owner
approves the new scope. Split-family embedded-instance widgets are reserved
future names only: `split-instance` and `split-carousel-instance` remain
deferred until a real account-instance selector component and package
dependency path exist. They must not be faked through `instance-picker`,
Prague `accountInstanceRef`, page placement IDs, or a hidden generic nesting
model.

## Approved PRD 106 public coordinates

PRD 106 uses object coordinates:

```text
single widget: https://clk.live/{accountPublicId}/{instanceId}
composed page: https://clk.live/{accountPublicId}/pages/{pageId}
```

This deliberately avoids slug, route-map, redirect, alias, and old-slug
behavior. Pretty URLs, site routes, custom domains, and nav are NOT_ALLOWED in
PRD 106 unless Pietro explicitly approves them in a separate PRD. Page
composition does not need them to prove the product.

## Portable delivery, not a website takeover

A Clickeen page is portable browser-readable content:

```text
accounts/{account}/pages/{page}/source.json
accounts/{account}/pages/{page}/index.html
accounts/{account}/pages/{page}/styles.css
accounts/{account}/pages/{page}/runtime.js
```

The same files can be served on `clk.live`, injected into Prague, or embedded
into WordPress/Shopify/Squarespace as one composed page. This is the point:
Clickeen does not have to own the customer's whole website to make its composed
widgets useful.

Prague keeps its own nav, URLs, markets, locales, and site chrome. Customer
sites keep their own nav/header/footer. Clickeen injects whole page output; it
does not take over site routing in PRD 106.

Selected-instance delivery from a page is NOT_ALLOWED in PRD 106 unless Pietro
explicitly approves it in a separate PRD. It must not sneak in through placement
IDs, blocks, sections, or route maps.

Generic client-side embeds can visually place Clickeen content into another
site. That is not the same as guaranteeing first-paint SEO on the customer's
domain. Customer-domain SEO/GEO needs a separately scoped server-side/plugin,
custom-domain, or proxy integration. The hosted `clk.live` page must be
crawlable; customer-domain SEO/GEO is NOT_ALLOWED in PRD 106 unless Pietro
explicitly scopes the delivery integration.

## Where it climbs next

The ladder keeps going, and the substrate climbs with it:

```
token → control → widget → page → site → …
```

A **site** is the next organism up: a composition of pages plus nav/domain/global
settings. It will get translation, materialization, edge-serving, and
AI-operability for free, because those are properties of the substrate, not of
any one layer. Next-scope features people ask about — translated page metadata,
personalization, A/B variants, campaign variants, site nav, custom domains — all
target pages. None of them requires a new presentation primitive, and none of
them is agent-approved scope inside PRD 106.

## Invariants for anyone (human or LLM) working under this umbrella

1. There are three product words in this concern: **widget**, **widget
   instance**, and **page**. Do not invent a fourth. There is no "block."
2. Page-shaped surfaces are **widgets**. If a section needs real interactivity,
   that's still a widget — not a new object, and not page-level code.
3. Every normal widget uses the shared Widget Shell package extracted from FAQ.
   The only part that changes per widget is Widget Core and its exact controls.
4. Header always means title, optional subtitle, and optional CTA using
   `header.*` and `cta.*`. Do not invent duplicate copy/CTA paths.
5. Pages are composed from widget instances. Editing a widget instance
   propagates to all pages by recomposition. That propagation is the product,
   not a cost.
6. Widget instances are atomic. A page can arrange instances; it cannot own
   instance edits, page-specific overrides, instance forks, or frozen snapshots.
7. One substrate: one editor (Bob), one translation model (editable-fields → San
   Francisco → overlays), one renderer/runtime contract, one materialization
   path. No parallel systems.
8. Fail visibly. Missing locales, missing referenced instances, stale markers,
   and invalid page inputs fail at the named boundary. No silent healing, no
   request-time invention.
9. Materialize, don't assemble-at-request. Pages are composed to static,
   edge-served browser files. No app-shell-only pages, no stacked iframes, no
   request-time composition of public output.
10. All Page Composer intelligence lives in Roma. Tokyo has no page-composition
    business: no dependencies, no recomposition decisions, no CSS/runtime dedupe,
    no SEO/GEO generation, no readiness semantics, and no product-shaped page
    source.
11. Tokyo does not own widget architecture. Widget Shell authority belongs in
    `packages/widget-shell`; widget folders contribute Core software; Tokyo
    stores and serves account files.
12. Localization is a property of every unit at every level, at near-zero marginal
    cost. Locale is a runtime parameter, never baked into identity.
13. Add depth only when a concrete need proves it and Pietro approves it (the
    nesting/container decision is the canonical example). Blocked is the default;
    objectify is the exception.

## How to read PRD 106 with this lens

- When the PRD says **"Hero, Split, CTA, image/title are widgets"** → it's
  refusing to add a rung to the ladder as an object. (Invariant 1, 2.)
- When it says **"compose files, not iframes"** → that's the materialization
  invariant; the page is one browser-readable document. (Invariant 6.)
- When it says **"edit an instance, every page recomposes"** → that's the moat,
  stated as a feature. (Invariant 3.)
- When it **blocks embedded instance references / containers** → that's
  discipline, not an oversight. (Invariant 8.)
- When it insists on **crawlable HTML and server-side head metadata** → that's
  the substrate's "materialize, don't assemble" rule applied to hosted-page
  SEO/GEO.
  (Invariant 6.)
- When someone proposes `website/`, `publishes/`, route maps, or a page package
  registry → that's the old AI-invented architecture coming back. PRD 106 pages
  use the same simple account R2 shape as instances:
  `accounts/{account}/pages/{page}/source.json`, `index.html`, `styles.css`,
  `runtime.js`.
  (Invariant 5, 6, 8.)

If a proposed change violates an invariant — most often by adding a second
presentation primitive, copying source instead of referencing it, or treating
propagation as a cost — it is off-vision, regardless of how reasonable it looks
in isolation.
