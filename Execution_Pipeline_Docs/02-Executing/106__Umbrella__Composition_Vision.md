# Clickeen Composition Vision — Umbrella for PRD 106 (Pages)

Status: Umbrella / vision lens (not a spec)
Scope: PRD 106 page composition authority.
Relationship: Sits under `strategy/ClickeenVision.md` and the PRD 105 tenets; it
explains the *intent* and *mental model* behind page composition and delivery so
implementation work stays grounded.

## What this doc is for

PRD 106 is precise but narrow: add pages as account-owned stacks of saved widget
instances. This doc says *why the shape is what it is*, so you don't reinvent it,
over-build it, or misread its restraint as missing scope. If a decision seems
oddly minimal, this doc is where the reason lives.

## Non-Negotiable Product System Tenets

This section is the execution gate for PRD 106. Any code, PRD language, or plan
that contradicts it is drift and must be fixed before work continues.

```text
Widgets are software types that live in the Clickeen system.
Instances are account-owned widgets users create/edit in Roma/Bob and save to
their account in Tokyo.
Pages are account-owned stacks of instances stored in Tokyo.
Bob is only the browser editor: open, edit in browser memory, save.
Roma is the app: route the user to the account, apply tier/account authority,
and save what the user does.
Tokyo is responsible for R2 storage. Nothing more.
Clickeen uses Clickeen: admin is just an account using Clickeen's own widgets.
```

The boundary is deliberately boring:

- Bob must not become a page product, policy authority, storage authority, or
  hidden server system. It edits one widget in browser memory and submits the
  user's save.
- Roma owns product orchestration: account context, tier permission, page
  composer UX, save acceptance, publish/unpublish intent, and account-facing
  errors.
- Tokyo accepts submitted files, validates only R2/file-storage safety
  boundaries such as account coordinate, path, content type, file allowlist, and
  object existence, stores them in R2, and serves already-stored public files.
  Tokyo must not become a product brain, tier brain, widget renderer, page
  composer, sanitizer, or policy subsystem.
- Pages can live physically in Tokyo/R2 because account files live there. That
  does not make Tokyo the page product authority. Roma decides what is being
  saved; Tokyo stores the submitted source/package files.
- Clickeen dogfooding does not create an admin exception. The Clickeen account
  uses the same widgets, instances, pages, save path, and public delivery path as
  any other account.

Allowed under these tenets:

```text
Bob edits one widget in browser memory; Roma submits widget package files -> Tokyo stores them.
Roma saves page source as an ordered instance stack -> Tokyo stores it.
Roma/Page Composer builds page index.html/styles.css/runtime.js -> Tokyo stores them.
clk.live serves already-stored files when the stored delivery state allows it.
```

Not allowed:

```text
Tokyo rendering widgets from private source.
Tokyo composing pages from product logic.
Tokyo enforcing tier/product policy.
Tokyo repairing invalid product state.
Tokyo inventing page source, widget source, route maps, slugs, blocks, sections,
or package registries.
Bob receiving page source or becoming a page editor.
Admin/Clickeen-only product branches.
```

## The vision in one sentence

Clickeen is a design system that ships: small, structured, self-translating
product units that compose into larger ones — widgets into pages, pages into
portable packages, and sites later — on one substrate, so building a localized
web presence becomes composition, not construction.

## The mental model: a design system, but the components are products

Anyone with a design-systems background will recognize the ladder. The important
move is getting the rungs right, because the lower rungs already exist — they're
just not named "atoms."

```
atoms       → Dieter tokens (color, type, spacing) + shared Bob/Dieter controls
molecules   → reusable control/primitive patterns (input groups, repeater rows)
organisms   → a WIDGET (FAQ, hero, pricing) — a complete, self-contained section
templates   → a PAGE (head + ordered placements, addressed by pageId in V1)
pages/sites → a SITE (collection of pages + nav/domain/routes) — future
```

A widget is **not** a molecule. It's an organism — a whole section made of many
parts. The atom/molecule layers beneath it are Dieter and the shared editor
controls. Nothing is missing from the ladder; the design system *is* the bottom
of it.

The difference from classic atomic design: in Brad Frost's world, and in every
page builder (Webflow, Framer, Notion, Gutenberg), the composable unit is a
**dumb fragment** that only exists inside its host. In Clickeen, the composable
unit is a **whole product**.

## The anchor: it's Figma's component model, for live localized web content

```
Figma:     main component → instance → placed in frames → edit main, all update
Clickeen:  widget type    → instance → placed on pages   → edit instance, all recompose
```

A page is a frame. A placement is an instance usage. Recomposition is "the
component changed everywhere." If you know Figma, you already know the model —
Clickeen applies it to live, translated, edge-served web content instead of
static design files.

## Why this is a moat (the composed unit is a *product*)

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

Edit one widget instance → every page that places it recomposes and reflects the
change after the saved input changes. This is the **asset**, not a cost. It is the
same mechanic that lets a republished widget update every external site that
embeds it. Any design that re-introduces a per-consumer rebuild cost, or treats
"this change fans out to N pages" as a problem to ration, has inverted the moat
and is wrong. Pages reference instances; they never copy them.

## The discipline: two nouns, not five layers

The atomic ladder is a **thinking tool**, not a schema. Do not mint a product
object for every rung. Clickeen deliberately collapses the whole ladder into
**two product nouns**:

```
instance  = the composable unit (any complexity, from a CTA to a full FAQ)
page      = the composition (head metadata + ordered placements)
```

Everything below `instance` is Dieter and shared controls. Everything above
`page` (site, nav, domains) is a *later* composition of the same kind, not a new
substrate.

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
renderer. It *activates* this substrate at a higher level of composition. New
output formats (pages today, sites later) inherit translation, materialization,
and serving for free. This is the multiplicative ("100⁵"), not additive, model.

## What PRD 106 is, in this frame

PRD 106 adds the **page** noun and the Roma-owned workflow that composes it.

- A page is an ordered stack of widget instances + page head metadata.
- V1 pages are object-addressed by `pageId`, not slug-addressed by route.
- Hero, Split, CTA, image/title, and similar page-shaped surfaces are not blocks.
  They are widgets — hypersimple, self-contained, full-width. No containers, no
  nesting in V1.
- Roma's **Page Composer** produces a page package from the already-saved widget
  packages (each instance's `index.html`/`styles.css`/`runtime.js`) into **one**
  page document — not 20 iframes. It extracts fragments, preserves order, dedupes
  shared Dieter/runtime, and submits the resulting three page files to Tokyo.
- Output is **crawlable HTML first** for the Clickeen-hosted page URL (content
  in the initial response, head metadata/canonical/JSON-LD server-side when
  valid) so hosted pages are legible to search engines *and* AI answer systems
  (SEO + GEO). JS only enhances.
- Pages live physically in an account **website workspace**
  (`accounts/{id}/website/…`) because Tokyo stores account files. Product
  authority remains Roma. Edge serving reads published artifacts only — never
  source.

The restraint is intentional: no container/slot system, no embedded-instance
nesting (a widget inside a widget — explicitly deferred until stacking proves
insufficient), no sites/domains/nav, no drag-drop canvas, no A/B or
personalization in V1. Stack full-width widgets, ship portable page packages,
host or embed them, and add depth only when a real need proves it.

## V1 public coordinates

V1 uses object coordinates:

```text
single widget: https://clk.live/{accountPublicId}/{instanceId}
composed page: https://clk.live/{accountPublicId}/pages/{pageId}
```

This deliberately avoids V1 slug, route-map, redirect, alias, and old-slug
behavior. Pretty URLs, site routes, custom domains, and nav are future website
work. Page composition does not need them to prove the product.

## Portable delivery, not a website takeover

A Clickeen page package is portable content:

```text
page index.html
page styles.css
page runtime.js
```

The same package can be served on `clk.live`, injected into Prague, or embedded
into WordPress/Shopify/Squarespace as a whole composed page package. This is the
point: Clickeen does not have to own the customer's whole website to make its
composed widgets useful.

Prague keeps its own nav, URLs, markets, locales, and site chrome. Customer
sites keep their own nav/header/footer. Clickeen injects whole page packages; it
does not take over site routing in V1.

Selected-placement delivery is not V1. If product later needs it, it needs a
deliberate selection contract. It must not sneak in through page placement IDs,
blocks, sections, or route maps.

Generic client-side embeds can visually place Clickeen content into another
site. That is not the same as guaranteeing first-paint SEO on the customer's
domain. Customer-domain SEO/GEO needs a separately scoped server-side/plugin,
custom-domain, or proxy integration. The hosted `clk.live` page must be
crawlable; customer-domain SEO is later delivery work unless explicitly scoped.

## Where it climbs next

The ladder keeps going, and the substrate climbs with it:

```
token → control → widget → page → site → …
```

A **site** is the next organism up: a composition of pages plus nav/domain/global
settings. It will get translation, materialization, edge-serving, and
AI-operability for free, because those are properties of the substrate, not of
any one layer. The future features people ask about — placement copy overrides,
translated page metadata, personalization, A/B variants, campaign variants, site
nav, custom domains — all target *pages and placements*. None of them requires a
new presentation primitive.

## Invariants for anyone (human or LLM) working under this umbrella

1. There are two product nouns: **instance** and **page**. Do not invent a third
   for a layer of the ladder. There is no "block."
2. Page-shaped surfaces are **widgets**. If a section needs real interactivity,
   that's still a widget — not a new object, and not page-level code.
3. Pages **reference** instances; they never copy instance source. Editing an
   instance propagates to all pages by recomposition. That propagation is the
   product, not a cost.
4. One substrate: one editor (Bob), one translation model (editable-fields → San
   Francisco → overlays), one renderer/runtime contract, one materialization
   path. No parallel systems.
5. Fail visibly. Missing locales, missing referenced instances, stale markers,
   invalid sources fail at the named boundary. No silent healing, no request-time
   invention.
6. Materialize, don't assemble-at-request. Pages are composed to static,
   edge-served artifacts. No app-shell-only pages, no stacked iframes, no
   request-time composition of public output. Embeds consume already-materialized
   page packages.
7. Localization is a property of every unit at every level, at near-zero marginal
   cost. Locale is a runtime parameter, never baked into identity.
8. Add depth only when a concrete need proves it (the nesting/container decision
   is the canonical example). Defer is the default; objectify is the exception.

## How to read PRD 106 with this lens

- When the PRD says **"Hero, Split, CTA, image/title are widgets"** → it's
  refusing to add a rung to the ladder as an object. (Invariant 1, 2.)
- When it says **"compose packages, not iframes"** → that's the materialization
  invariant; the page is one document. (Invariant 6.)
- When it says **"edit an instance, every page recomposes"** → that's the moat,
  stated as a feature. (Invariant 3.)
- When it **defers embedded instance references / containers** → that's
  discipline, not an oversight. (Invariant 8.)
- When it insists on **crawlable HTML and server-side head metadata** → that's
  the substrate's "materialize, don't assemble" rule applied to hosted-page
  SEO/GEO.
  (Invariant 6.)
- When it puts pages in a separate **website workspace** (not under
  `instances/`) → source/publish/delivery separation; edge serves output only.
  (Invariant 5, 6.)

If a proposed change violates an invariant — most often by adding a second
presentation primitive, copying source instead of referencing it, or treating
propagation as a cost — it is off-vision, regardless of how reasonable it looks
in isolation.
