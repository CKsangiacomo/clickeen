# Widget Files

STATUS: CANONICAL ARCHITECTURE CONTRACT WITH EXPLICIT CURRENT TRANSITION

## Product Law

A Clickeen Widget is complete product software that performs one specific job.

It contains:

```text
complete Widget document composition
+ mandatory unique Core HTML/CSS/JavaScript
+ default state and Bob editing declarations
+ customer-content declarations
+ shared-capability and policy bindings
+ internal Discovery declaration
+ Widget-owned product copy
```

Bob, Roma, Tokyo-worker, Dieter, Stage, Pod, Header, localization, assets,
connectors, integrations, and public serving are shared Clickeen services. A
Widget uses them through the same system contracts as every applicable Widget.
They do not absorb the Widget's unique meaning.

## Canonical Source Folder

```text
tokyo/product/widgets/{widgetType}/
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

Real Widget-owned support files may be added when that Widget actually uses
them. The three Core files are always present; `core.js` is mandatory even when
its implementation is small.

## File Responsibilities

| File | Responsibility |
| --- | --- |
| `widget.html` | Complete readable composition for this Widget: Stage, Pod, Shell, Header, Core location, and the shared/Core source dependencies it uses |
| `core/core.html` | Unique Widget content structure and content locations |
| `core/core.css` | Unique Widget presentation |
| `core/core.js` | Unique Widget behavior |
| `spec.json` | Widget identity, exact default state, and Bob editing declarations |
| `labels/en.json` | Exact English Widget-authored ToolDrawer copy |
| `editable-fields.json` | Exact customer-content paths, types, roles, and stable array-item identities |
| `limits.json` | Bindings from Widget actions/state coordinates to generic system entitlement keys and exact Widget upsell message IDs |
| `upsell/en.json` | Complete English Widget-context sentences referenced by `limits.json` |
| `discovery.json` | Internal declaration of what the Widget is, which customer-content parts matter to search and answer systems, and how they relate |

No source file owns account tiers, customer account values, materialization,
storage, public serving, or another shared service's implementation.

## `widget.html` And Shared Composition

Every Widget folder contains its own `widget.html`. An agent can read that file
to understand the complete document the Widget uses:

```text
Stage
  -> Pod
    -> Shell
      -> shared Header
      -> Widget Core
```

Shared implementations remain under `tokyo/product/widgets/shared/` and
Dieter. They are referenced and used; they are not copied into each Widget.

All unique Widget structure, presentation, and behavior lives in `core/`.

`widget.html` and `core/core.html` are Mustache source. `widget.html` contains
exactly one `{{> core}}` reference, resolved from the adjacent Core at artifact
build; Core contains no recursive partial. Exact instance state is the render
view and the reserved `ck` object carries only system rendering context. The
same generic renderer supplies Bob preview and Roma Publish. There is no browser
template engine, runtime source fetch, Widget registry, or Widget-specific
generator branch.

During rendering, exact editable customer-content values receive stable
`data-ck-content-path` and `data-ck-content-mode` attributes. Those authored
coordinates support exact Edge overlay expression; Bob and Tokyo-worker do not
infer Widget paths.

`data-ck-content-path` carries the field's stable `identityKey`, not its current
array index. Scalar keys contain Widget type, role, and field pattern; repeated
keys additionally contain every declared `arrayItemIdentity` path and stable
ID. When translatable content belongs in an authored HTML attribute such as
`alt` or `title`, the same content slot also declares the exact target as
`data-ck-content-attribute`. Tokyo-worker applies that attribute generically;
it does not infer HTML semantics or branch on Widget type.

## One Widget Source, Two Independent Uses

```text
deploy-built Widget software + Bob browser-memory draft
-> temporary Workspace preview

Widget software + exact saved instance + allowed Publish
-> Roma materializer
-> stored index.html + styles.css + runtime.js
```

Bob receives the deploy-built Widget software it needs through the existing
generated editor-artifact path. Bob does not read an account instance's stored
public package. Roma's materializer independently generates that package only
on Publish. Public
`runtime.js` contains no Bob draft protocol, and Bob preview never defines what
must ship publicly.

## Widget Software Versus Editable Instance

Widget source is product software. It never stores one customer's choices.

One editable instance owns one complete logical state:

```text
shared instance state
  header.* / headerCta.* / appearance.headerCta.*
  stage.*
  pod.* / appearance.podBorder
  coreSize.*
  shared typography, locale, branding, and share state
+ Widget Core state under {widgetNamespace}.*
```

Bob edits that complete state in browser memory.

The existing physical source split remains:

```text
instance.config.json   every saved value except declared base-locale content
instance.content.json  exact declared base-locale customer-content values
```

They are two files for one logical instance. The same saved value is never
owned by both files.

Create writes the first editable source. Save updates that source. Neither
action creates the public package.

## Structured Contracts

### `spec.json`

The existing Bob compiler and Dieter control DSL remain the systemic editor
contract. `spec.json` owns Widget identity, defaults, the canonical Content,
Layout, Appearance, Typography, and Settings declarations, shared control
clusters, Widget fields/conditions, presets, and normalization rules.

Shared Clickeen defaults and Widget Core defaults compose into one complete
default instance state. Bob consumes the compiled contract; it does not become
the Widget or a persistence schema.

### `editable-fields.json`

This file declares exact customer-content ownership for saving and
localization. Array-backed content includes stable item identities.

The saved content document retains the concrete physical path and carries the
derived stable `identityKey`. Overlay values use that stable key. Reordering an
array therefore keeps translation with the same item; a newly added ID remains
explicit untranslated source content until Generate Translations; and a
deleted ID has no current rendered content slot.

It is not a complete Widget schema, DOM template language, or ToolDrawer
allowlist for the rest of the instance.

### ToolDrawer labels

The adjacent `labels/en.json` file owns Widget-authored Bob copy. The build resolves the
copy into the compiled editor artifact. Bob does not fetch the source file while
editing.

## Limits And Upsell Copy

System policy owns tiers, entitlement values, decision timing, current and
target plans, and the system CTA.

`limits.json` owns only:

```text
generic system capability key
+ Widget action/state coordinate or metric
+ exact Widget messageId
```

It contains no tier value, plan name, pricing, Popup mechanics, CTA behavior,
or Widget-authored enforcement timing.

`upsell/en.json` has this systemic form:

```json
{
  "widgetType": "faq",
  "locale": "en",
  "messages": {
    "questions-per-section.max": "Your current plan is {currentPlan}. Upgrade to {targetPlan} to add more questions to this section."
  }
}
```

The Widget owns the contextual sentence. The system supplies exact plan names
and the CTA. Roma composes one Popup; Dieter owns its mechanics.

Every referenced message must exist exactly once. There is no generic fallback
sentence. Ordinary account commands such as Publish, upload, or locale changes
use system-owned context because they contain no unique Widget editing meaning.

Core and the public package know nothing about tiers or upsells.

## Discovery

`discovery.json` is internal Widget software. It tells Clickeen:

1. what the Widget is;
2. its Clickeen-owned baseline Discovery defaults;
3. which declared customer-content paths carry its important meaning; and
4. how those parts relate.

It does not contain tiers, Bob controls, output templates, HTML tags, JSON-LD
templates, public routes, customer overrides, or materializer code.

The shared system owns **Enable SEO/GEO** and its tier rule. The user does not
edit `discovery.json`. Roma's materializer consumes the internal declaration,
exact saved state, and system policy only during Publish. Every FAQ Publish
writes the declared baseline title and meta description. FAQ Core's authored
FAQPage/Question/Answer microdata is emitted only when the saved
`behavior.seoGeo.enabled` value and system `embed.seoGeo.enabled` flag are both
true. The generic render seam attaches each exact declared part and related
relationship to its matching editable content slot; Widget Core owns how those
annotations become the Widget's unique search markup. Shared services contain
no FAQ branch and derive no customer metadata.

## Create, Edit/Save, Publish, Serve

The four actions remain separate:

```text
Create
  -> write initial editable source and open the new unpublished instance in Bob

Edit / Save
  -> edit one browser-memory draft and update editable source

Publish
  -> apply publication capacity, then materialize and store browser files

Serve
  -> return the already-stored published files
```

New starts from complete Widget/account defaults. Duplicate starts from exact
saved source, creates a new unpublished identity, and opens the duplicate in
Bob. The Template catalog is not another source model: it is the list of normal
saved instances selected by the CLICKEEN admin account for reuse. Creating from
one is a cross-account Duplicate into a new unpublished customer-owned
instance. Catalog listing and that cross-account copy are follow-on product
implementation; they do not require a template schema, table, storage root, or
runtime compatibility path.

## Publish-Time Package

Only explicit allowed Publish invokes Roma's Widget-neutral materializer:

```text
Widget and shared software
+ exact saved instance source
+ exact account resources and system policy used by generated output
-> Roma materializer
-> index.html
-> styles.css
-> runtime.js
-> Tokyo-worker exact storage
```

All three package files are mandatory:

- `index.html` contains complete meaningful base-locale Header and Core content
  before JavaScript runs;
- `styles.css` contains complete shared and Core presentation; and
- `runtime.js` contains the Widget and shared visitor behavior without Bob,
  initial-content rendering, package materialization, or public localization.

Save does not generate or replace these files. If a user Saves newer edits to a
published instance, the last published package remains public until the user
Publishes again.

For a selected locale, Tokyo-worker expresses every present stable-coordinate
value from the exact stored overlay in returned meaningful HTML before client
JavaScript. Content added since the last Generate operation remains intentional
untranslated base-source content; deleted identities have no rendered slot. It
does not store another locale package.

## Account Instance Root

```text
accounts/{accountPublicId}/instances/{instanceId}/
  instance.config.json
  instance.content.json
  serve-state.json
  index.html
  styles.css
  runtime.js
  overlays/
    locales/
      {locale}.json
```

The browser package is absent for a never-published instance. Publish stores or
replaces the exact three package objects and publication truth through the
existing Tokyo-worker authority and purges the instance's one Cloudflare cache
tag. There is no release registry, alternate root, fingerprint path, or
compatibility package.

## Uniform Shared-Service Law

Every applicable Widget uses a given Clickeen service through the same
contract. If a real Widget proves a missing capability, augment the owning
service once without a Widget-name branch or Widget-specific path meaning.

Clickeen is internally trusted. A named authority consumes another named
authority's exact output without revalidation, normalization, filtering,
repair, projection through editor controls, or a second schema. External human,
browser, provider, upload, and model input is accepted at its owning ingress.

Authoring and build checks prove source outside product runtime. They do not
become runtime validators or probes.

## Current Source State

Big Bang, Cards, Countdown, FAQ, and Logo Showcase all use this canonical
source contract locally. Their retired flat `widget.css`, `widget.client.js`,
and legacy ToolDrawer-label paths are absent. No compatibility workflow,
old/new source discriminator, or Widget-name compiler branch reads two shapes.

The generator supports focused `--widget {widgetType}` work and normal
all-Widget generation through the same universal compiler. Both modes produce
the same Bob editor and Roma materializer artifact contracts.

## Required Checks

For current all-Widget proof:

```bash
node scripts/widgets/generate-artifacts.mjs
node scripts/widgets/generate-artifacts.mjs --check
git diff --check -- tokyo/product/widgets documentation/widgets
```

These are build/operator evidence only.

## Hard Stops

- Do not put unique Widget meaning outside Core and structured contracts.
- Do not make `core.js` a renamed `widget.client.js` initial renderer or shared
  service orchestrator.
- Do not make Create or Save generate public files.
- Do not put tier values, Popup mechanics, or CTA behavior in Widget source.
- Do not expose `discovery.json` as a user editor.
- Do not invent Discovery output in Bob or Tokyo-worker.
- Do not add a Widget-specific shared-service branch.
- Do not revalidate trusted Clickeen output downstream.
- Do not use Bob controls as a persistence allowlist.
- Do not add a second source/package/storage path.
- Do not preserve the flat client architecture under another name.
- Do not create a second Widget source shape or compatibility compiler path.
