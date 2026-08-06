# Planning PRD — Account Web Code Generator And Publication

Status: Planning — alignment input to the future PRD 127; not independently executable

Owner: Roma / Web Code Generator

Date: 2026-08-03

Carries forward: unfinished Page Composer generator and publication work from
historical PRD 106B and the PRD 110 review

Unlocks: global Clickeen Pages, stable public Page identities, and a future
Websites product built from Pages

Related planning:

- `planning_PRD__System_SEO_GEO_AEO_Widget_And_Page_Surfaces.md`

This document owns the Page generator, direct-current-file, and publication design.
The System SEO/GEO/AEO PRD owns the shared Widget/Page locale and overlay
surface-quality contract. Their accepted decisions must be consolidated into
PRD 127 before execution begins.

## Product Direction

Clickeen Pages is initially a hosted single-page publishing product.

```text
Widget = reusable software
Instance = one saved, account-owned configured Widget
Page = one account-owned ordered composition of saved Instance references
Locale = the language or language-market code used by its overlay and public URL
Overlay = the alternate values stored for that locale
```

A Page is one global product identity with the existing required `baseLocale`.
It may support explicitly selected locales such as `en-US`, `es-US`, `it-IT`,
or `de-DE`. `baseLocale` identifies the Page's base source and is never a
license to substitute base content when an exact selected overlay is missing.

A Page source is not:

- copied Widget HTML, CSS or JavaScript;
- a browser-side stack of independent `clk.live` Instance URLs;
- one source or runtime copy per locale or country;
- a navigation system or Website route tree;
- generated code a customer must paste again after every edit;
- a collection of persistent builds.

The generated Page does contain the combined HTML, CSS, and JavaScript read from
its referenced saved Instances. Those direct current files are output, not Page
source.

Page source remains structured Page truth plus ordered Instance references. On
Save or Update, the Web Code Generator resolves those references and produces
one set of three direct current public files:

```text
index.html
styles.css
runtime.js
```

The public file count is fixed regardless of the number of locales. Private
generated overlay data is stored beside the files for Tokyo locale completion;
it is not a fourth public file. Clickeen hosts the files behind one stable
Page identity and exact locale URLs.

This planning direction now includes one prerequisite exposed by the 127B peer
review. Current generated standalone Widget `index.html` is mostly structural
and JavaScript creates much of the visible customer content in the browser.
That cannot support the claimed Widget or Page SEO/GEO/AEO result.

127B therefore restores the original direct-file model. Every Widget definition
contains complete `index.html`, `styles.css`, and `runtime.js`. Bob edits those
files; every Instance saves its customized copies; and the Web Code Generator
combines the referenced Instances' exact saved files. Every tier receives
complete initial HTML. Runtime JavaScript supplies interaction and does not
construct primary content.

The Web Code Generator is the shared authority for final Instance and Page
HTML/CSS/JavaScript. It is separate from the Bob Editor Compiler, which creates
only Bob's ToolDrawer/editor. Bob and Page Builder invoke Web Code Generator in
the browser on explicit Save/Update, preview those exact files, and submit them
through Roma. Roma applies authority but does not generate another copy; Tokyo
stores and serves the submitted files.

Each Widget's `index.html` is its only Widget-specific HTML template. One
generic renderer, moved from the existing pure Bob stencil implementation into
Web Code Generator, applies structured values for all Widgets. Do not create
per-Widget TypeScript HTML writers or a Widget render switch. Existing
`ck-style-module` and `ck-runtime-module` markers are mandatory and are the only
shared-module keys used during Page assembly.
Detailed generation behavior is owned by 127B and requires product-owner
acceptance before execution.

Proposed public taxonomy:

```text
https://clk.live/{accountPublicId}/pages/{pageId}
https://clk.live/{accountPublicId}/pages/{pageId}/{locale}

https://dev.clk.live/{accountPublicId}/pages/{pageId}
https://dev.clk.live/{accountPublicId}/pages/{pageId}/{locale}
```

The root URL is a language-and-market-neutral resolver. An exact locale URL
always identifies one deterministic representation and wins over IP or browser
inference.

## Pages Product Entitlement

Pages is a separate product capability from standalone Widget publication. One
limit owns both access and total account Page inventory:

```text
pages.max

free   = 0
tier1  = 0
tier2  = 3
tier3  = 10
tier4  = unlimited
tier99  = unlimited
```

`pages.max` counts every saved account-owned Page identity, ordinary or
template and published or unpublished. An unsaved browser draft has no identity
and does not count. `0` means the Pages product is unavailable; a number is the
maximum saved Page identities the account may own; `null` means unlimited.
There is no separate `pages.enabled` or `pages.published.max` contract.
A positive or unlimited value grants Page-product access; a finite value limits
only creation of another Page identity. `0` denies Page-product actions while
the domain and retained inventory remain visible.

Unavailable does not mean hidden or disabled. Pages navigation and the Pages
domain remain visible for every tier. Free and Tier 1 see **Upgrade to get
Pages**. An account downgraded to Free or Tier 1 still sees its retained Page
inventory and sees **Upgrade to use Pages**. Page actions remain visible; attempting one opens the
existing Upgrade dialog, performs no mutation, and never calls the generator.
An entitled account below its limit may open an unsaved draft, and Roma rechecks
`pages.max` on first Save before minting an identity or writing.

Roma enforces `pages.max` on the first Save of an ordinary Page and when Save as
template creates a new Page template. The Save-as-template utility is shown only
while the current role may edit the ordinary source and the account has
same-type capacity. A tier reduction leaves Page source and public files
untouched. Roma continues to show the inventory but blocks Page product actions
through the standard Upgrade path before any write or generator call. The Web
Code Generator and Tokyo public-serving path do not infer tiers or reimplement
this limit.

Page composition is independent of standalone Instance publication. A Page may
include any exact saved, materially complete, same-account Instance even when
that Instance is not independently published. `instances.published.max`
governs standalone Widget publication; `widgets.instances.max` bounds the saved
Instance inventory available for Page composition.

This release adds no Page placement, locale, publication, or generation
entitlement. Existing Instance, localization, asset and Page-inventory policies
govern their own resources. Engineering execution limits and acceptance budgets
must never masquerade as customer entitlements.

Tier-gated product actions use this product law: keep the action visible and
clickable, keep state unchanged when blocked, open the existing Upgrade dialog,
and recheck policy at the owning Roma command or Save boundary. **Save as
template** is the named contextual-utility exception: show it only while the
ordinary source is editable and the account can create another same-type object;
otherwise omit it and add no Upsell path. Role denial, invalid source, and
impossible object-state operations remain separate failures.

## Roma Pages Product Workflow

Pages follows the same management/discovery separation as Widgets. `Pages` is
one expandable Roma navigation group with three route-owned subitems, not local
tabs:

```text
Pages
├── Your pages
├── My templates
└── Page catalog
```

**Your pages** is the default account Page inventory. It lists the account's
global Page identities, current publication/currency truth and direct Page
actions. Selecting a Page opens that Page in the Page Builder.

**My templates** lists Page templates owned by the current account. **Page
catalog** lists only Page templates owned by account `CLICKEEN`. The account
coordinate—not Tier99 or an administrator role—defines the Catalog owner.
Catalog is a read-only ownership-based view, not another object or flag.
Selecting **Use template** opens an unsaved `/page-builder/new` Page Builder
draft. Only explicit **Save** creates the ordinary Page.

The **Page Builder** is the orchestration editor for one Page. It provides:

- a preview of the complete Page in the selected locale;
- Page-owned identity, per-locale metadata/SEO, overlay, and publication controls;
- Page-level layout controls explicitly supported by Page source;
- the ordered placement list;
- add, remove, reorder and select operations over saved account Instances;
- an **Edit in Bob** action for a selected Instance placement.

The ownership boundary is strict:

```text
Page Builder edits Page source and composition
Bob edits one referenced Instance
Web Code Generator materializes the complete Page
```

Page Builder never copies or overrides Instance-owned content, configuration,
appearance, or Widget behavior. Bob never edits Page order, Page metadata,
Page overlays, or publication state.

Roma may expose the Page catalog without mutating product truth. The
first-Save and Save-as-Page-template routes enforce `pages.max` and fail closed;
hiding controls is not authorization. Pages and retained Page inventory remain
visible after a tier reduction; Page product actions use the standard Upgrade
interaction and change nothing until the account regains Page access.

## Widget and Page template law

A Widget template is a normal Widget Instance with persisted `isTemplate:
true`. A Page template is a normal Page with persisted `isTemplate: true`.
Widgets and Pages do not share objects or editors.

```text
Widgets
├── Your widgets     current-account Widget Instances that are not templates
├── My templates     current-account Widget templates
└── Widget catalog   CLICKEEN Widget templates

Pages
├── Your pages       current-account Pages that are not templates
├── My templates     current-account Page templates
└── Page catalog     CLICKEEN Page templates
```

For a regular account, My templates and Catalog are different collections.
Catalog always reads the underlying `CLICKEEN` templates through its dedicated
read authority; Roma does not add a special editable Catalog view for the
`CLICKEEN` account.

Catalog is read-only for every account, including `CLICKEEN`. There is no
Catalog object, flag, create/edit/delete command, publication flow, eligibility
state, copy, or synchronization. Authorized `CLICKEEN` operators manage the
underlying templates and their thumbnail, description, category, and display
order in DevStudio through the normal Roma/Tokyo authorities. Roma renders
those values as a searchable, category-filtered card Catalog and has no Catalog
write path.

My templates reuses the ordinary Widget/Page table structure. Template rows
show the Template badge and Edit, with Use template, Rename, and confirmed
Delete in the three-dot menu; they omit publication, Page currency, URL, and
code actions. DevStudio exposes **CATALOGS > Widget catalog** and **CATALOGS >
Page catalog**, edits the presentation values, and opens the existing Bob/Page
Builder for template source editing rather than implementing another editor.

**Save as template** is shown only for an editable ordinary Widget Instance or
Page while the account can create another same-type object. In Your widgets and
Your pages it lives in the object's three-dot menu; in Bob and Page Builder it
is a persistent secondary action. Otherwise it is absent, with no disabled,
lock, or Upgrade state. Roma still runs the normal role and saved-object-limit
validation when invoked. The command saves the source, then creates one new
same-type object with a new ID, customer-entered name, the same owning account,
and `isTemplate: true`. It never converts or renames the source. Source Save and
template creation remain separate outcomes.

Templates cannot publish. **Use Widget template** creates one ordinary Widget
Instance through the normal Instance-create authority. **Use Page template**
opens an unsaved Page draft; explicit Save creates one ordinary Page through
the normal Page Save/generator authority.

A Page template retains its Page-owned source and exact Instance references.
127 does not clone referenced Instances or add a multi-object template
transaction. Same-account Page templates may keep valid same-account Instance
and asset references. The global Page Catalog initially contains one blank
`CLICKEEN` Page template with no cross-account Instance dependencies. Rich
cross-account Page templates remain outside 127 until their child-Instance
behavior is decided explicitly.

Save as template copies the complete reusable source/config—including a Widget
Instance's SEO/GEO/AEO setting—and clears only `baseLocale`, any object-local
Widget locale-selection value, overlay/translation values, and public-serving
values from the copied template config. Pages do not own a selected-locale
list. Use template invokes no Translation Agent operation. The resulting
ordinary object gets its locale state only through the destination account's
normal explicit localization workflow.

When a `CLICKEEN` Catalog template directly references Clickeen-owned images,
SVGs, or videos, Use template asks the customer to **Copy assets in my assets
folder** or **Discard assets**. Copy uses the existing account-assets authority
with source fixed to `CLICKEEN` and destination fixed to the authenticated
current account, then rewrites the unsaved draft; Discard removes those external
references without a substitute. Same-account template assets require no copy.
This adds no template asset store, transaction, cleanup job, or service.

The current Widget-definition Catalog is replaced by `CLICKEEN` Widget
templates. Widget definitions remain software/package authority and stop being
customer Catalog items. The blank Page Catalog item becomes a `CLICKEEN` Page
template rather than a permanent hardcoded card.

When the user chooses **Edit in Bob**, Roma opens the selected Instance through
the normal Bob Builder authority and supplies a Roma-owned return coordinate for
the current account, Page, placement and Instance. Before Bob opens, any dirty
Page Builder draft must be saved successfully. The guard offers **Save and edit
Instance** or **Keep editing**; this transition has no silent discard path and
does not introduce a private draft store.

On Bob save or cancel, Roma revalidates the return coordinate against the
current account. The Page must still exist, the placement must still exist, and
that placement must still reference the same Instance before Roma restores the
selection. If the Page is unavailable, Roma returns to Your pages with a visible
stale-coordinate result. If the Page exists but the placement was removed or
changed, Roma returns to that Page with no replacement selection and visibly
names the stale placement. It never redirects to an arbitrary return path,
selects another placement or crosses account authority.

Bob's existing save remains an Instance save through Roma and invokes the Web
Code Generator once to produce that Instance's final three files. A successful
Instance save performs no Page mutation and invokes no Page-generation
operation. On return, Roma compares the Page's recorded numeric revisions with
current saved Instance revisions. A dependency-stale Page shows the explicit Update gate before
Page Builder can open. Only the customer's **Update page** command refreshes
the direct files and preview from current saved Page/Instance truth.

The Page Builder preview must use the files produced by the same Web Code Generator
and locale-completion code as public serving. Draft changes do not invoke
transient generation. Before first Save there is no generated preview; while an
existing Page draft is dirty, the last generated preview may remain visible as
stale. Preview must not introduce a separate Page-file output, stack public Widget URLs,
persist generated output as Page source, or make public serving depend on an
editor session.

Whether the Page Builder reuses a cleanly separable Bob editor shell or is a
smaller Roma editor is an implementation decision for PRD 127. Bob's Editor
Compiler, Instance state, save protocol and preview
messages must not be pulled into Page editing merely for visual reuse.

## Tier99 account tier

PRD 127 extends the existing single account-tier → entitlement mechanism:

```text
free, tier1, tier2, tier3, tier4 = customer account tiers
tier99                            = CLICKEEN Admin/Ops account tier
```

Tier99 is used only by the exact internal `CLICKEEN` account for Clickeen
Admin/Ops work. It is never for sale and must not appear in pricing, checkout,
upgrade, billing, customer provisioning or customer tier-mutation choices.
After every Tier99 consumer is deployed, the current tier of `CLICKEEN` is read
from the owning account authority and that exact row moves to Tier99 through an
explicit reviewed product-data operation.

Tier99 is simply added to the same account-tier types, policy matrices,
bootstrap, grants, schema, labels, and tests as every other tier. Its explicit
values match Tier 4. No `accountKind`, inheritance layer, parallel internal
policy, platform grant, or Tier99-specific Page code is introduced.

Tier99 must be explicit everywhere the closed policy-profile set is validated,
including account policy, AI policy and grants, bootstrap/capsule normalization,
Roma lifecycle/display contracts, Admin policy inspection and invariant tests.
PRD 127 must state the exact Tier99 entitlement and limit values for product-
owner approval. “Admin,” Tier 4, numeric ordering or an existing account's
effective behavior is not an entitlement definition and cannot be copied as
one. The fixed Page value for Tier99 is `pages.max = unlimited`.
Capability grants must not use numeric/range logic such as `tier >= tier4`;
Tier 4 and Tier99 receive only their explicitly declared profiles. Lifecycle
tier-drop comparison may explicitly order Tier99, but that ordering grants no
capability. Missing or unknown profiles fail closed and never fall back to Tier
4 or Tier99.

The account user role named `admin` remains an account membership role and does
not assign Tier99. After every reader accepts the value, the normal reviewed
account-data operation assigns it to the exact `CLICKEEN` account.

### Tier99 activation order

PRD 127 must execute this order without combining the steps:

1. Add Tier99 to the stored database enum/check contract without changing any
   account row.
2. Add explicit Tier99 entitlement and AI profiles and update every closed-set
   consumer found by the repository-wide profile inventory.
3. Deploy and verify Berlin, Roma, San Francisco and every retained Admin/profile
   inspection surface that consumes the closed set.
4. Prove Tier99 bootstrap/capsule truth, San Francisco grant acceptance, Tier 4
   customer separation, customer-assignment rejection and unknown-profile
   failure behavior.
5. Read the one exact `CLICKEEN` account from Berlin/account database truth and
   record its current tier; stop if the coordinate is missing or ambiguous.
6. Only then update that one account to Tier99 through the reviewed account-data
   authority.
7. Re-verify Tier99 through Berlin bootstrap, Roma product behavior, San
   Francisco grant execution and the retained Admin inspection surface.

Tokyo-worker is deployed for Tier99 only if the closed-set inventory proves it
consumes the tier/profile directly; its receipt of already-resolved entitlements
does not by itself justify Tier99-specific code.

## Purpose

Implement the missing deterministic generator, direct-current-file publication and
global edge-serving path:

```text
Page Builder Page source
+ exact saved Instance index.html, styles.css, and runtime.js
+ exact Page and Instance overlays
→ browser-imported Web Code Generator
→ one Page index.html
+ one Page styles.css
+ one Page runtime.js
+ private generated locale data
→ Tokyo-worker stores the direct current files
→ root route selects an approved locale
→ Tokyo applies that locale's source/overlay values on a CDN miss
→ CDN serves complete HTML from the exact locale URL
→ the same published output can mount on an external site through clickeen.js
```

The generator has four primary responsibilities:

1. Construct one valid semantic Page structure from exact saved Instances.
2. Consolidate and deduplicate CSS without weakening Instance isolation.
3. Consolidate and deduplicate JavaScript while preserving independent Instance
   behavior.
4. Emit private generated locale data keyed by locale with complete Page and
   Instance values and Page metadata for every selected non-base locale. The
   populated base-locale HTML comes from the saved Instance HTML; every
   non-base entry comes from its same-code overlays.

For Page composition, each referenced Instance's semantic root is placed in
initial `index.html` inside an open declarative Shadow DOM template. The Page
does not stack public Widget URLs and does not run the public installer for
each child. Its one stylesheet is referenced by the Page document and each
shadow root, and its one runtime initializes behavior against those open roots.

SEO is not post-processing. The generator validates and materializes each
selected locale as a whole document. Tokyo applies the exact overlay values;
it does not author, translate, repair or infer content.

The generator also owns the public attribution boundary. Every tier receives
complete semantic initial HTML. Free Widget Instances additionally receive one
visible contextual link to the global Clickeen product and matching truthful
Clickeen application identity. This output is
baked into `index.html`; runtime JavaScript does not create it. Paid branding
follows `branding.remove`. Enhanced customer SEO/GEO/AEO follows the separate
saved Instance choice plus `embed.seoGeo.enabled` for Widget Instances. Every
ordinary Page receives Page SEO/GEO/AEO output because Page access already
begins at Tier 2; Pages have no SEO toggle. Neither policy changes the
three-file baseline.
Every generated document includes neutral
`<meta name="generator" content="Clickeen">` provenance without claiming
ownership of customer content.

Distributed Free attribution uses `rel="nofollow noreferrer"`. The mandatory
Clickeen identity graph does not include customer `mainEntity` or Widget-content
schema; those require an authorized enabled Instance choice. Retained Pages after
a downgrade remain visible in Roma, but Page product actions are tier-gated
before any generator call.

The global URL and Clickeen application identity are constants within Web Code
Generator, not another service, map, or runtime lookup. The Widget definition's
display name supplies the contextual visible credit. Locale truth remains in
the existing locale authority. Generated schema identifies Clickeen as
software/service and schema publisher, never as author of customer content.

## Current Truth

This is target planning, not deployed behavior. Today:

- Roma stores Page `source.json` but keeps Page publication unavailable.
- Roma already exposes one combined `/pages` inventory/source editor for Page
  metadata, current localization fields and placements, and placement Edit
  already opens Bob with a normalized `returnTo` Page route. It does not yet
  provide the route-owned Your pages/My templates/Page catalog structure,
  last-generated complete Page preview, same-placement restoration or explicit
  direct-file Current/Needs update UX defined here.
- the shared policy/profile contracts currently stop at Tier 4. Execution reads
  the exact `CLICKEEN` account through Berlin/account DB truth, then updates it
  through the normal reviewed account-data path only after every reader accepts
  Tier99. Tier99 is target PRD 127 behavior, not deployed truth.
- the shared policy registry has no `pages.max`; current Roma Page routes do not
  implement the Tier 2+ 0/0/3/10/unlimited/unlimited Pages product policy.
- Tokyo-worker rejects Page publication and returns `404` for public Page paths.
- no active generator creates Page HTML/CSS/runtime, `overlays.json`, or
  Page-level SEO output;
- current Widget localization uses one root runtime plus exact locale overlay
  files and `?locale=` serving; the exact locale URL/cache contract in this
  planning set is not deployed.

Historical PRDs remain evidence, not current runtime authority.

## Authority Gate

| Concern                                          | Active authority                                                                                                              |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Product surface                                  | Roma Pages                                                                                                                    |
| Page inventory, templates, and catalog            | Roma Pages                                                                                                                    |
| Page draft, composition and preview              | Roma Page Builder                                                                                                             |
| Referenced Instance editing                      | Bob through Roma Builder orchestration                                                                                        |
| Page-to-Bob return coordinate                    | Roma navigation and unsaved-work authority                                                                                    |
| Stored account tier                              | Berlin/account database truth                                                                                                 |
| Tier entitlement profiles                        | `@clickeen/ck-policy` shared matrices/contracts                                                                               |
| Page product availability/inventory              | shared `pages.max` policy resolved by Roma first Save and Save-as-Page-template creation                                       |
| Tier99 assignment                                | normal reviewed account-data operation for exact account `CLICKEEN`                                                           |
| Account/session coordinate                       | Berlin bootstrap → Roma current `accountPublicId`                                                                             |
| Page source, overlay values, and placement order | Roma                                                                                                                          |
| Instance HTML/CSS/JavaScript and overlays        | referenced account Instance, edited in Bob through its owning routes                                                          |
| Saved Instance direct files and overlays         | Tokyo-worker/R2 through Roma Instance routes                                                                                  |
| Instance Save contract                           | Bob → browser Web Code Generator → Roma Instance route → Tokyo-worker                                                          |
| SEO/GEO/AEO contract                             | System SEO/GEO/AEO planning, consolidated into PRD 127                                                                        |
| Page code generation and validation              | Web Code Generator imported by Page Builder in the browser                                                                      |
| Current Page direct-file storage and serve state | Tokyo-worker/R2                                                                                                               |
| Locale selection policy                          | System SEO/GEO/AEO contract, consolidated into PRD 127                                                                        |
| Locale selection execution                       | Tokyo-worker edge resolver over explicit choice, available locales, browser language, and approved Cloudflare country mapping |
| Exact overlay application                        | Tokyo-worker using only current `index.html` and `overlays.json`                                                              |
| CDN caching and invalidation                     | Tokyo-worker/Cloudflare CDN                                                                                                   |
| Public identity                                  | `clk.live` Page root and exact locale URLs                                                                                    |
| Verification                                     | Roma routes/UI, Tokyo-worker routes, public locale URLs, and exact R2 coordinates                                             |

Tokyo-worker remains opaque to Page source and Instance composition. A public
request must never make Tokyo resolve Page source, traverse Instance references,
concatenate Widget files or generate overlay values. Tokyo may only select
an approved locale and apply the generator-produced source/overlay values to the Page
structure, then cache the complete response.

If implementation proves that an authority must move, execution stops and PRD
127 returns to Planning.

## Taxonomy

### Page

The stable global product identity: `accountPublicId + pageId`.

### Page source

Editable structured Page truth: base-locale Page values, exact locale
overlays, and ordered Instance references.

### Base locale

The existing required `baseLocale` coordinate used by Clickeen source,
translation, overlay, and completeness contracts. It identifies base Page
values and never acts as a silent fallback for another selected locale.

### Locale

The language or language-market code used by the overlay filename, exact public
URL, cache key, and generated `overlays.json`, for example `it`, `it-IT`, or
`en-US`.

### Overlay

The exact alternate Page or Instance values stored for one non-base locale.
The selected `baseLocale` reads saved source values. Every other selected
locale reads the same-code overlay. Missing values do not fall back to the base
or another locale.

### Generation

The deterministic Web Code Generator operation that writes the Page's direct
current serving files on explicit Save or Update.

### Direct current files

The exact three public generator outputs plus private overlay data stored for
Tokyo. A Page does not own a package, build history, `builds/` collection, or
active-build selector.

### Serve state

The publication state and minimal revisions needed for public serving and
Current/Needs update. It is not a second source, overlay store, package
integrity record, or build pointer.

## Source Contract

The Page source stores one base-locale value set and the selected exact locale
list. Each non-base locale is stored as one separate exact Page overlay file:

```ts
type LocaleCode = string; // approved language-region coordinate, e.g. it-IT

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type PageLocaleValues = Record<string, JsonValue>;

type PageSourceCommon = {
  pageId: string;
  accountPublicId: string;
  displayName: string;
  pageValues: PageLocaleValues;
  placements: Array<{
    placementId: string;
    instanceId: string;
  }>;
  revision: number;
  createdAt: string;
  updatedAt: string;
};

type AccountPage = PageSourceCommon & {
  isTemplate: false;
  baseLocale: string;
  locales: LocaleCode[];
};

type AccountPageTemplate = PageSourceCommon & {
  isTemplate: true;
  // baseLocale, selected locales and Page overlay files are forbidden
};

type AccountPageSource = AccountPage | AccountPageTemplate;
```

This is directional schema, not approved execution code. For ordinary Pages,
`locales` is the customer-controlled list of Page locales; it contains no
metadata or mapping.
The `baseLocale` serves saved `pageValues` only when its exact code appears in
that list. Every selected non-base locale has one exact file at the path below,
and that locale is also its exact public URL/cache coordinate. The
`baseLocale` cannot have an overlay file. There is no second locale registry,
alias, or mapping from a public locale to another overlay name.

Storage coordinate:

```text
accounts/{accountPublicId}/pages/{pageId}/source.json
accounts/{accountPublicId}/pages/{pageId}/overlays/locales/{locale}.json
```

The source never contains copied Instance files or generated HTML/CSS/JS.
It contains Page-owned base values and locale selection. Exact Page overlay
files are separate Page truth, not generated output. This lets Translation
Agent write several locales independently without one write replacing another.

Base Page source contains the required title and optional description/social
values. Each exact non-base Page overlay contains the corresponding exact
localized values for the fields that exist in base source. Locale identity
comes from the exact object path, robots remains Page-wide source, and canonical
URLs, alternate relationships, and text direction are deterministic output
derived from the public Page coordinate and selected locale list.

The generator must not invent marketing copy, image descriptions, offers,
prices, structured-data claims, canonical URLs outside the declared public
coordinate, or missing translations.

## Locked Product Decisions

1. Every Page has the existing required `baseLocale` used throughout Clickeen.
2. Locales are explicitly selected. `baseLocale` reads saved base source;
   every selected non-base locale reads its same-code overlay. The system does
   not add a locale because a visitor comes from a country.
4. Page source stores ordered Instance references, not copied Widget output.
5. A placement follows the current saved account Instance identified by
   `instanceId`.
6. The generator consumes each exact saved Instance `index.html`, `styles.css`,
   `runtime.js`, and overlays. It does not recreate an Instance from newer
   Widget software. A later software release changes nothing until explicit
   Instance Save changes those files.
7. Generation happens only when the customer explicitly chooses **Save** or
   **Update page**. Preview uses the last saved direct files. **Publish** only
   exposes already-current files, and no generation happens on a public
   request.
8. The Page owns one current set of three public files plus private overlay
   data, not packages or persistent builds.
9. `index.html` is the shared semantic structure; `styles.css` and `runtime.js`
   are shared; `overlays.json` is keyed directly by locale and contains the
   complete values for every selected non-base locale. Base-locale values come
   from saved source and are present in populated `index.html`.
10. Primary content is applied by Tokyo before the HTML response is returned.
    The browser never fetches overlays or assembles the Page.
11. Each exact locale has a stable public URL and complete initial HTML.
12. The root is an `x-default`-equivalent resolver, not an implicit
    English or US Page.
13. Explicit locale URL and user choice outrank browser/IP inference.
14. Missing or corrupt source/overlay values fail visibly; no locale silently
    falls back to the base locale or another locale.
15. Shared CSS and runtime contributions are emitted once per exact
    contribution, not once per placement or locale.
16. Every value that can vary by locale and affect visible HTML, attributes,
    behavior, style, metadata, or schema is declared in the owning editable
    field contract and present in source or the exact overlay. Shared CSS/runtime
    bytes contain no locale values.
17. Saving an included Instance or changing/deleting one of its locale overlays
    performs no Page mutation and invokes no Page generator. Roma derives Page
    currency by comparing the recorded numeric revisions with current saved
    truth;
    only explicit **Update page** incorporates those changes.
18. A failed Save or Update never masquerades as current. The operation reports
    the ordinary retry error and never advances Page serving state.
19. Page currency is derived on Page list, open, Save, Update, and Publish. This
    PRD adds no mutation-time Page scan, status writer, graph service, reverse
    index, Queue, or workflow engine.
20. A Page has no customer navigation, shared header/footer, Website route tree
    or customer domain model in this release.
21. A future Website references stable Page identities and adds routes,
    navigation, chrome, domains and site-wide policy without replacing the Page
    Generator.
22. `free` and Tier 1 through Tier 4 remain customer tiers; Tier99 is the
    non-sellable Admin/Ops account tier assigned only to exact account
    `CLICKEEN` and absent from customer sale/assignment flows.
23. Tier99 uses the same stored-tier and entitlement machinery as every other
    profile; no parallel Admin policy system is added.
24. Customer-facing or billing operations can never assign Tier99.
25. The account role `admin` does not imply or assign the Tier99 account profile.
26. In the first Pages release, one saved `instanceId` may appear at most once in
    a Page. Repeated placements remain rejected until the stamped-root,
    initialization and editor identity contracts explicitly support them.
27. Pages is available through one `pages.max` entitlement: `free=0`, `tier1=0`,
    `tier2=3`, `tier3=10`, `tier4=unlimited`, `tier99=unlimited`.
28. `pages.max` counts all account-owned Page identities, not only published
    Pages. This release adds no separate Page availability, published-Page,
    placement or locale entitlement.
29. A Page may include an exact saved, materially complete, same-account
    Instance without independently publishing it. `instances.published.max`
    remains the standalone Widget-publication limit.
30. A/B testing selects between two normal existing Instance identities or two
    normal existing Page identities. It creates no variant Page/Instance type,
    package copy or parallel source authority.
31. PRD 127 preserves A/B compatibility but does not implement experiment
    assignment, allocation, analytics or decision machinery unless that scope is
    separately approved.

## Explicit Non-Goals

- Website authoring, menus, navigation or arbitrary application hosting.
- One source/runtime/package per locale or country.
- IP-dependent variants hidden behind one canonical content URL.
- Browser-side overlay loading, translation or primary Page assembly.
- Iframe installation, runtime-only install snippets, or separate public
  installers for Widgets and Pages.
- Calling the public installer for each child Instance inside a generated Page.
- Public-request Page code generation or Instance traversal.
- Per-Page free-form Widget content overrides.
- Copying generated Page code into customer systems as a second source.
- Platform-specific Shopify, WordPress, Wix or other publication adapters.
- A dependency graph, Queue, Durable Object, workflow framework, retry platform
  or reverse-placement index.
- A persistent build registry, active-build pointer or build-history product.
- Page entitlements beyond the single `pages.max` account-inventory limit.
- An A/B experiment router, allocator, analytics system or separate variant
  storage model.
- A parallel Admin account kind, entitlement resolver or platform-grant system.
- Selling, advertising or customer-assigning Tier99.
- Numeric tier comparisons that make Tier99 inherit Tier 4 implicitly.

## Generator Input Contract

For each placement, Roma loads the exact saved Instance `index.html`,
`styles.css`, `runtime.js`, and overlay truth through the owning account route.
Current persisted coordinates include:

```text
accounts/{accountPublicId}/instances/{instanceId}/index.html
accounts/{accountPublicId}/instances/{instanceId}/styles.css
accounts/{accountPublicId}/instances/{instanceId}/runtime.js
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
accounts/{accountPublicId}/instances/{instanceId}/serve-state.json
```

PRD 127 keeps the existing locale-overlay model. The same locale code is used by
Page source, Instance-file/overlay lookup, the exact public URL, the cache
key, and generated `overlays.json`. For a Page locale such as `it-IT`, every
placed Instance must provide `it-IT` from its saved base-locale HTML or
`overlays/locales/it-IT.json`.
There is no Page-to-Instance locale mapping, alias, or reuse layer. Page Builder
cannot create Page-owned overrides for missing Instance truth.

The existing localization integration surface remains account locale policy,
`l10n.locales.max`, Bob translation management and preview, Translation Agent
request/result coordinates, Roma overlay routes, Tokyo storage keys, locale
files, and materializer overlay completeness. Translation Agent may translate
declared language-owned fields. It may not invent or infer market-specific
offers, prices, currencies, assets, links or claims. PRD 127 preserves the
existing rule that `l10n.locales.max` counts selected non-base locale overlays.

The generator accepts a placement only when:

- the Instance belongs to the current account;
- the three saved Instance files are materially complete under their owning
  Widget contract; independent Instance publication status is irrelevant;
- saved Instance HTML contains one valid populated stamped Widget root;
- saved CSS and runtime contributions satisfy exact chunk/behavior contracts;
- every selected Page locale exists in source or as an exact same-code overlay
  for every placed Instance;
- each required Instance overlay is exact and complete;
- the exact saved files and numeric saved revision are valid.

Missing or malformed input fails materialization. The generator never drops a
placement, substitutes another locale, repairs markers or uses base-locale
content as a localized fallback.

## Generator Contract

### 1. Validate global Page source

- Validate account and Page coordinates.
- Validate the required `baseLocale` and exact selected-locale membership.
- Validate unique locale keys and their language/region semantics.
- Preserve placement order exactly.
- Reject duplicate placement IDs.
- Reject unsupported repeated use of one `instanceId` until the stamped-root
  and runtime contracts explicitly support it.

### 2. Resolve exact Instance contributions

- Load every Instance's exact saved three files and required overlays through
  the Roma → Tokyo-worker account boundary.
- Verify account and Instance identity.
- Validate the exact saved three-file contract.
- Extract the populated stamped root, declared locale slots, stable CSS chunks,
  and runtime behavior chunks from those files.
- Resolve the same locale code from every placed Instance's source or overlay.
- Record the exact numeric saved Instance revision used by the result.

### 3. Emit `index.html`

The generator emits one populated base-locale semantic structure containing:

- one doctype, `<html>`, `<head>` and `<body>`;
- one Page main container;
- every placement exactly once and in order;
- stable semantic field markers for overlay application;
- markerized per-Instance data/configuration required by runtime behavior;
- one reference to `styles.css`;
- one deferred reference to `runtime.js`.

Each placement is a stable host containing
`<template shadowrootmode="open">` with the saved Instance's semantic root and
a reference to the Page's one `styles.css`. Child primary content therefore
exists in the first Page response. `runtime.js` enters the open placement roots
to initialize behavior; it never constructs those roots or their content.

It removes nested Instance document shells. It does not embed a privileged
default-language head or require JavaScript for primary content.

### 4. Emit `styles.css`

The generator collects style modules by stable identity and exact bytes:

```text
same module id + same bytes → emit once
same module id + different bytes → fail
different module ids → preserve both
```

The stylesheet contains only Page layout and the shared/Instance contributions
required by the approved locale set. It does not duplicate modules by
placement or locale, rewrite selectors or invent Page theme tokens.
Values that vary by locale must be declared by the owning editable field
contract and applied through marked HTML fields. They must not be buried in
locale-specific stylesheet bytes.

### 5. Emit `runtime.js`

The generator emits each required shared behavior module and each Widget
enhancer once where its existing contract supports all matching roots, plus
deterministic placement state where interaction requires it. Runtime behavior
enhances the completed per-Instance HTML; `runtime.js` contains no
locale-specific values and does not construct primary content.

The runtime does not fetch `overlays.json`, translate content or construct the
primary document. If a value that varies by locale is absent from the owning
HTML/overlay field contract, materialization fails. Unsupported
singleton behavior fails certification rather than receiving a Page-local
patch.

### 6. Emit `overlays.json`

The generator writes Page-owned and Instance-owned values into one map keyed
directly by each selected non-base locale. Base-locale values already exist in
populated `index.html`; every non-base entry is generated from its same-code
overlays. Every key is also the public URL/cache coordinate. Each non-base
locale includes all required content, asset, metadata, and structured-data
values needed to complete the document.

The file:

- contains no copied HTML/CSS/runtime package;
- contains no hidden default locale or fallback chain;
- contains no invented values;
- is deterministic for identical source bytes;
- is never fetched by a visitor or crawler.

### 7. Validate every locale document

For every locale, the generator validates:

- complete visible initial content;
- one title, description, robots policy and self-canonical URL;
- correct language/region and text direction;
- unique generated coordinates;
- coherent headings, links and image semantics under the approved severity
  policy;
- source-grounded structured data and social metadata when declared;
- the complete locale relationship set used by `hreflang` output.

The generator reports source problems; it does not rewrite customer truth to make
validation pass.

## Direct Current Files And Storage Contract

```text
accounts/{accountPublicId}/pages/{pageId}/
  source.json
  serve-state.json
  index.html
  styles.css
  runtime.js
  overlays.json  # private locale data
```

The Web Code Generator generates exactly three public files. `overlays.json` is
private generated locale data used by Tokyo, not a public Page file.
`source.json` is product input; `serve-state.json` owns publication and
current-file state. Assets remain under the account asset authority and are
referenced, not copied.

Roma submits the exact direct current files shown in Page Builder. Tokyo writes
them at the Page root and advances `serve-state.json` only after the complete
Save or Update succeeds. There are no fingerprinted package paths, selected
package pointers, previous-package retention, Build records, or package
integrity/fingerprint families.

`overlays.json` remains one logical generator output, but its physical encoding
is not frozen forever. PRD 127 must measure deterministic output bytes and
Tokyo cold-miss parse/application cost at the accepted Page, Instance and
locale test envelope. The generator must avoid repeating shared values. A later
internal representation may optimize reads without changing
Page identity, source authority, exact locale URLs or the three-file public
output contract; it may not recreate locale package trees or package history.

## Root Resolver, Locale Delivery And Cache

### Global route

An exact locale URL bypasses root selection and always returns that exact
representation. For a root Page request, Tokyo selects among available
locales using this precedence:

1. available browser-language match;
2. the saved account country-to-locale mapping using Cloudflare country as a
   hint;
3. Page `baseLocale`.

The root returns a temporary redirect to the selected exact URL. The redirect
is not shared-cacheable because browser language and country may differ between
visitors. Country is only a hint and never creates content. PRD 127 adds no
remembered choice, cookie, preference store, chooser, or consent authority.

### Locale route

On a CDN miss, Tokyo-worker:

1. validates Page publication and current direct-file revision;
2. validates the exact locale coordinate;
3. reads only current `index.html` and `overlays.json`;
4. applies that locale's exact source/overlay values server-side;
5. returns complete ordinary HTML with correct status, metadata and language;
6. caches that completed response under the exact locale URL.

Tokyo does not read `source.json` or any Instance on this path. Browsers and
crawlers never fetch `overlays.json`.

Cloudflare caching must be explicit for Worker-produced HTML. Exact locale
URLs use normal URL cache identity; they do not vary content invisibly by IP,
cookie or `Accept-Language`.

### Invalidation

Changing Page source, an Instance, or an overlay does not replace the Page's
direct current files and therefore does not purge public Page cache. Only a
successful explicit **Save** or **Update page** invalidates the published Page
coordinates whose completed response changed:

- an exact-locale output change purges only that exact locale URL;
- shared structure change purges every published locale URL;
- CSS/runtime is purged only when its bytes change;
- available-locale change purges the root resolver and affected locale URLs;
- unpublish/delete purges root and all locale URLs.

Each completed locale head carries matching `rel="alternate" hreflang` links,
and the stable root is the `x-default` coordinate. PRD 127 adds no sitemap or
discovery subsystem.

## Save, Publish, Update And Failure

### Draft save

Opening Blank page creates only a browser draft. Before **Save**, no Page ID is
minted, no Page source is written to Tokyo, and the generator does not run.

**Save** is explicit customer authority. Page Builder invokes the Web Code
Generator in the browser, shows the resulting direct files, and submits source,
overlays, and those exact files through Roma to Tokyo. If generation or storage
fails, Save fails and the ordinary retry error appears; nothing is reported as
saved.

If an included Instance or required overlay changed while an existing Page
draft was open, Save preserves the Page-authored source but performs no generate.
The Page remains Needs update until the customer explicitly chooses **Update
page**. Save never silently absorbs a concurrent dependency change.

### Save or Update direct current files

1. Roma validates current Page source, `baseLocale`, and overlay keys.
2. Roma resolves every exact saved Instance and required overlay.
3. Roma produces and validates all three public files plus private locale data.
4. Tokyo validates and writes the direct current files at the Page root.
5. Tokyo records the minimal Page/Instance revisions required for Current or
   Needs update, independently of publication.
6. If the Page is already published, Tokyo purges only the affected stable,
   locale, CSS, and runtime coordinates.

No partial write is reported as saved or Current.

### Publish

Publish requires already-saved Current direct files and changes only
publication state. It does not invoke the generator.

### Included Instance or overlay update

After a successful Instance save or Instance-overlay create/update/delete, that
operation ends with its owning source. Instance Save has already used the Web
Code Generator for the Instance itself; none of these operations scans or
writes Pages, purges a Page cache, or invokes Page generation. Roma later
derives a referencing Page's currency by comparing the saved numeric revisions
recorded by its last successful Save/Update with current saved truth.

Page-owned overlays are separate exact Page truth under the existing
localization authority. Translation Agent or the customer edits one exact
locale through Roma→Tokyo; an accepted write advances the Page revision but
does not run Web Code Generator. The customer later chooses **Update page** to
assemble current Page and Instance overlay truth into generated
`overlays.json`. Deleting an Instance overlay required by a Page makes that
Page derive as **Needs update**; exact Update then fails visibly until the
missing truth is restored or the Page composition is corrected. It never falls
back.

There is no background retry platform. **Update page** is one explicit direct
customer command against current saved truth.

### Failure

- invalid source or overlay truth blocks Save/Update;
- a failed Save/Update reports the ordinary retry error and does not claim
  success;
- dependency mismatch is **Needs update**; there is no Needs fixing state;
- an already-published Page that becomes Needs update continues serving its
  last successfully saved direct files until the customer updates it;
- Tokyo never substitutes another locale or base-locale content.

### Unpublish and delete

- unpublish changes serve state and purges stable plus locale URLs while
  preserving private source and direct current files;
- a published Page must be unpublished before deletion;
- delete removes only that Page's exact Page root;
- referenced Instances and account assets remain unchanged.

## Public Delivery And Future Websites

A published Widget Instance URL returns a complete direct document. A stable
Page URL redirects to a selected exact-locale URL, which returns the complete
Page document:

```text
Widget Instance: https://clk.live/{accountPublicId}/{instanceId}
Page:            https://clk.live/{accountPublicId}/pages/{pageId}
```

External websites install either product with the same contract:

```html
<script
  src="https://clk.live/clickeen.js"
  data-clickeen="https://clk.live/ACCOUNT/PUBLIC-PRODUCT"
  defer
></script>
```

`clickeen.js` is one globally cached, product-neutral public loader. It creates
an open Shadow DOM mount at the script position, fetches the already-completed
public output, mounts visible semantic content and approved source-backed
structured data, attaches the product CSS, and loads behavior-only
`runtime.js` when needed. It does not generate, translate, publish, read
private source/overlays, or know Widget/Page types.

The host site retains ownership of its title, description, canonical,
alternate links, robots, and social metadata. A direct Page URL owns its full
document head. The stable Page redirect and public completed
HTML/CSS/JavaScript allow credential-free cross-origin reads. Multiple snippets
mount independently and idempotently.
There is no iframe option and no snippet that loads only the artifact runtime.

Clickeen-generated Pages use the declarative Shadow DOM composition above,
not `clickeen.js` per child. Future WordPress, Shopify, Wix, or other adapters
may emit this same snippet/public URL; they do not create another renderer or
artifact contract.

Clickeen provides managed hosting for structured global Pages, not general
application hosting. A future Website may map routes to global Page identities:

```text
Website
├── /        → pageId-home
├── /about   → pageId-about
└── /contact → pageId-contact
```

The Website may add domains, routes, shared navigation, chrome and site-wide
policy. It must reuse Page source, overlays, exact locale URLs, and the Web Code Generator rather than copy
Page source or create a second Page-file output.

## A/B Compatibility

A/B testing is selection between normal product identities:

```text
Instance experiment → existing Instance A | existing Instance B
Page experiment     → existing Page A     | existing Page B
```

Each variant keeps its normal source, direct files, overlays, publication, and
cache authority. The experiment layer never copies source/files or creates an
`ab-page`, `ab-instance` or variant-owned runtime artifact. Existing Instance
and Page inventory/publication policy naturally determines whether an account
can hold and publicly serve both variants. Instance A/B requires two normally
published Instances, so the existing `instances.published.max=1` prevents it on
free/Tier 1. Page A/B requires two normal Pages; `pages.max=0` prevents it on
free/Tier 1, while Tier 2 and above can use two of their normal Pages.

PRD 127 must preserve this identity and entitlement compatibility. It does not
add experiment assignment, allocation, persistence, analytics or learning
machinery unless the product owner separately includes that scope.

## Execution Checklist

The categories below separate code, product data, deployment evidence and docs;
they are not permission to reorder the work. PRD 127 must preserve this slice
order:

1. Tier99 database contract: commit and push, deploy the reviewed schema change,
   and verify that no account row changed.
2. Tier99 consumers and explicit policy profile: commit and push, deploy every
   closed-set consumer, then verify the profile and customer exclusions.
3. Tier99 product data: re-read exact account `CLICKEEN` and its current tier
   from the owning authority; update only that row to Tier99; then reverify
   every owning surface. Do not guess or hardcode its pre-migration tier.
4. Page contracts and product code: commit and push the accepted Roma,
   generator, Tokyo and shared-contract slice before its deployments.
5. Page product data and standalone public proof: create only through owning
   routes after the deployed code is verified.

No deployment step may precede the commit/push that supplies its code, and no
product-data mutation may be bundled into a schema or consumer deployment.

### Code changes

- [ ] Add explicit `tier99` support to the shared account, entitlement, AI-policy,
      bootstrap/capsule, Roma display and invariant-test profile sets.
- [ ] Inventory every closed tier/profile set before implementation; the known
      list includes `@clickeen/ck-policy`, `@clickeen/ck-contracts` AI and model
      management profiles, Berlin bootstrap normalization, San Francisco grant
      acceptance, Roma account context/formatting/account-notice lifecycle,
      Admin entitlement ordering and their tests.
- [ ] Add `tier99` to the stored account-tier database contract through a reviewed
      Supabase migration.
- [ ] Define Tier99 entitlements/limits explicitly in the same policy matrices;
      copy nothing implicitly from Tier 4.
- [ ] Reject Tier99 in every customer pricing, checkout, upgrade, provisioning
      and tier-mutation path.
- [ ] Remove capability/Admin behavior inferred from Tier 4 or numeric tier
      ordering; explicitly update lifecycle tier-drop ordering without using it
      to grant capability.
- [ ] Add one `pages.max` shared-policy limit with exact values
      `free=0`, `tier1=0`, `tier2=3`, `tier3=10`, `tier4=null`, `tier99=null`.
- [ ] Enforce `pages.max` through the existing Roma policy and saved-object
      creation path over all account-owned Page identities; opening
      `/page-builder/new` performs no mutation and adds no Page limit logic to the
      generator or Tokyo serving.
- [ ] Define fail-closed tier-reduction behavior for existing Pages without
      silently deleting, rewriting or publishing Page truth.
- [ ] Add Roma `Pages > Your pages`, `Pages > My templates`, and
      `Pages > Page catalog` route-owned navigation, with Your pages as default.
- [ ] Add the same `Your widgets > My templates > Widget catalog` structure;
      Catalog reads only `CLICKEEN`-owned templates, not Widget definitions.
- [ ] Show Save as template only for an editable ordinary source while the
      account has same-type capacity: in the list-row three-dot menu and as a
      persistent secondary editor action. Retain the normal server validation,
      then save the source and create a new named Instance/Page snapshot.
- [ ] Keep a Page template's exact saved Instance references; do not clone
      child Instances during Save as template or Use template.
- [ ] Persist only the minimal `isTemplate` designation; add no Catalog object,
      flag, registry, source format, or publication route.
- [ ] Implement Use Widget template as one independent ordinary Instance and
      Use Page template as an unsaved `/page-builder/new` draft whose explicit Save
      creates one ordinary Page.
- [ ] Make Catalog read-only for every account, including `CLICKEEN`; edit
      underlying `CLICKEEN` templates only through DevStudio using normal
      Roma/Tokyo authorities.
- [ ] Add no child cloning, asset-copy transaction, pending output, or
      template-operation commit record. Direct Catalog source assets use the
      existing account-assets authority through the explicit copy/discard
      choice.
- [ ] Templates preserve complete reusable source/config, including Widget SEO
      state, while locale, translation, and public-serving values are cleared
      from the copied template config.
- [ ] Delete the definition-backed Widget catalog and hardcoded blank Page card
      after `CLICKEEN` template Catalogs are proven.
- [ ] Implement one Page Builder authority for Page-owned draft/composition,
      last-generated preview and publication controls.
- [ ] Implement Page placement selection and the Roma → Bob → Roma return flow
      without duplicating Instance editing inside Page Builder.
- [ ] Guard dirty Page drafts with Save and edit Instance / Keep editing before
      Bob opens; add no silent discard or private draft persistence machinery.
- [ ] Revalidate account, Page, placement and Instance return coordinates and
      visibly handle removed/stale targets without substitution.
- [ ] Use the last direct files produced by explicit Save or Update page for preview;
      add no draft-change generator, separate Page-file output, or public-Widget stack.
- [ ] Approve the Page localization shape: `source.json` owns one `baseLocale`
      and selected locale list; each non-base locale is one separate exact
      `overlays/locales/{locale}.json` file, with no default fallback, alias,
      registry, or locale-to-overlay mapping.
- [ ] Keep locale overlays, Translation Agent, Bob, Roma, Tokyo, exact URLs, and
      cache keys on the same locale code; preserve generic locales and never
      infer a region.
- [ ] Keep `l10n.locales.max` counting selected non-base overlays; add no
      separate locale entitlement.
- [ ] Validate and store the three direct public files plus private overlay data
      through the one Roma→Tokyo Save/Update operation, with no package or
      persistent build product.
- [ ] Move required pure materializer behavior into one browser-compatible Web
      Code Generator and delete the obsolete materializer authority.
- [ ] Use each Widget's `index.html` through one generic renderer; add no
      Widget-type HTML writer branches.
- [ ] Implement semantic `index.html`, CSS/runtime deduplication and exact
      `overlays.json` generation.
- [ ] Validate every selected locale as a complete semantic document with
      matching Page metadata, canonical URL, alternates, and schema.
- [ ] Implement Roma → Tokyo direct current-file Save/Update.
- [ ] Implement the neutral root resolver and exact locale routes.
- [ ] Implement explicit CDN caching and targeted invalidation.
- [ ] Derive Page currency from the minimal recorded numeric Page/Instance
      revisions on list/open/Save/Update/Publish;
      dependency mutations perform no Page write, cache purge, or generator call.
- [ ] Accept exact saved, materially complete, same-account Instance files
      in Pages regardless of standalone publication status; keep
      `instances.published.max` scoped to standalone Widget publication.
- [ ] Define separate engineering envelopes for batched Page currency
      derivation and one explicit Page Update, with deterministic failure rules.
- [ ] Implement **Update page** through the owning Roma Page route with the same
      generator/Save contract as Save; do not add a Queue, workflow engine,
      autonomous generator or background retry system.
- [ ] Preserve A/B compatibility as selection between normal identities; add no
      experiment router, allocator, analytics or variant storage in this scope.
- [ ] Remove Page publication stubs and obsolete unavailable tests.
- [ ] Remove any execution path based on base/default Page locale, locale Page
      copies, packages, or persistent Page builds.

### Product data changes — only after Tier99 consumer deployment

- [ ] Re-read the one exact account `CLICKEEN` through Berlin/account DB truth;
      stop if the coordinate is missing or ambiguous.
- [ ] Update that exact account to Tier99 through the reviewed account-data
      authority after code and policy support
      are deployed and verified in every closed-set consumer.
- [ ] Change no customer account to Tier99.
- [ ] Perform no direct account R2 mutation during code implementation.
- [ ] Create test Pages and overlays only through owning product routes.
- [ ] Delete only exact legacy development Pages the product owner confirms are
      disposable, through the existing Page route before the strict contract
      deploy. If customer Page data exists, stop; do not invent migration code.
- [ ] Do not mark an existing Page published without verified complete direct
      current files.

### Deploy/runtime verification

- [ ] Run focused materializer, Roma and Tokyo-worker checks.
- [ ] Verify the Supabase migration workflow before relying on Tier99 account
      truth.
- [ ] Run the shared policy/contract invariants plus focused Berlin bootstrap,
      Roma account lifecycle, San Francisco grant and Admin policy-inspection
      checks.
- [ ] Deploy and verify Berlin and San Francisco Workers, Roma Pages and every
      retained Admin/profile inspection surface before the Admin account data
      migration.
- [ ] Verify Berlin bootstrap/capsule and Roma display report Tier99 for the
      migrated Admin account and preserve Tier 4 for a customer fixture.
- [ ] Verify Tier 4 cannot reach Admin-only entitlements and no customer route
      can assign Tier99.
- [ ] Verify missing/unknown tier profiles fail closed without Tier 4/Tier99
      fallback.
- [ ] Verify `pages.max` at first Save: free/Tier 1 cannot create Pages, Tier 2
      owns at most three, Tier 3 at most ten, and Tier 4/Tier99 are unlimited;
      saved unpublished and published Pages count identically while an unsaved
      `/page-builder/new` draft does not count.
- [ ] Verify direct Page routes enforce the same policy even when navigation is
      bypassed, while generator/Tokyo serving contains no tier branch.
- [ ] After the Admin account migration, re-verify the owning Berlin, Roma, San
      Francisco and Admin surfaces before any Page proof relies on Tier99.
- [ ] Confirm the schema, Tier99 consumer and Page code slices were each
      committed and pushed before their respective deployments.
- [ ] Verify Roma's Cloudflare Pages deployment and Tokyo-worker's Worker deploy.
- [ ] Publish a Page containing multiple real Instances and at least two exact
      locales with complete overlays.
- [ ] Open that Page from Your pages and verify complete Page preview plus
      Page-owned controls.
- [ ] Edit a selected placement in Bob, save, return to the same Page/placement
      context, verify the Update gate blocks editing, then explicitly update and
      verify the refreshed preview.
- [ ] Repeat the return flow through Bob cancel and verify the same validated
      Page/placement context.
- [ ] Remove/change the placement while Bob is open and verify visible stale
      return handling with no substituted placement or arbitrary redirect.
- [ ] Attempt Edit in Bob with a dirty Page draft and verify it cannot navigate
      until the Page save succeeds or the user keeps editing.
- [ ] Save an included Instance and verify the Page later derives Needs update
      without a Page write or generator call; force explicit Update failure and
      verify Roma reports the failure and leaves the Page Needs update.
- [ ] Verify one neutral root resolver and two stable exact locale URLs.
- [ ] Verify complete initial HTML and locale-specific SEO at each URL.
- [ ] Verify CDN hits do not read Page source, Instances or overlays from child
      coordinates.
- [ ] Verify CSS/runtime contributions occur once and remain shared.
- [ ] Edit one locale overlay and prove referencing Pages derive Needs update
      without a Page write or cache/direct-file change; after explicit Update, prove
      only changed Page response coordinates are invalidated.
- [ ] Edit one included Instance and verify referencing Pages derive Needs
      update without changing Page file bytes; then explicitly update one Page.
- [ ] Publish a Page containing a saved, materially complete but independently
      unpublished Instance and prove no standalone public Instance was created.
- [ ] Exercise the accepted maximum Your pages currency fixture; verify batched
      currency derivation is exact, no generator runs, and one explicit Update
      page command can update one stale Page.
- [ ] Measure `overlays.json` bytes plus Tokyo cold-miss parse/application time
      at the accepted maximum Instance/locale fixture.
- [ ] Force malformed source/overlay/module conflicts and prove visible
      failure without partial replacement.
- [ ] Unpublish and prove root plus locale URLs stop serving.

### Documentation changes

- [ ] After deployment, update current Account Management, Berlin, Roma,
      San Francisco, Michael/schema and shared policy documentation with Tier99
      as the non-sellable `CLICKEEN` Admin/Ops account tier using the same
      authorities.
- [ ] Update current architecture/service docs only with deployed behavior.
- [ ] Update Roma, Tokyo-worker, overlay/localization and Global Reach docs
      together when the contract ships.
- [ ] Update `WhyClickeen.md`, `MarketPosition.md`, `seo-geo.md`, the Widget
      operator manual, and Shell branding documentation with the same
      baseline/Free-distribution/customer-enhancement split.
- [ ] Reconcile historical PRD claims without rewriting history.

## Verification Matrix

| Concern                     | Required proof                                                                                     |
| --------------------------- | -------------------------------------------------------------------------------------------------- |
| Base locale                 | one Page identity has the required `baseLocale`; exact selected locales never silently fall back    |
| Page entitlement            | `pages.max` alone governs total Page identities: 0/0/3/10/unlimited/unlimited across free–Tier99   |
| Composition publication     | a saved complete Instance may compose into a Page without becoming independently published         |
| Direct public files         | exactly one current `index.html`, `styles.css`, and `runtime.js`                                  |
| Private locale data         | stored for Tokyo completion; never a browser file                                                  |
| Locale completeness         | every published locale has complete source or overlay values                                       |
| Initial HTML                | exact locale URL returns complete semantic HTML before JavaScript                                  |
| Public composition boundary | Tokyo reads only current Page direct files, never source or Instances                             |
| Direct public documents      | Widget URL and Page exact-locale URL return complete output; stable Page URL redirects            |
| Shared external install      | one cached `clickeen.js` mounts either product in open Shadow DOM without host-metadata takeover  |
| In-Page composition          | child Instances exist in initial declarative Shadow DOM; no child public URL/loader call          |
| Obsolete embeds              | iframe and runtime-only install options are absent from code, UI, tests, and documentation        |
| CSS/runtime dedupe          | identical contributions emit once across placements/locales                                        |
| Account isolation           | cross-account Instance reference fails before Save/Update                                           |
| SEO truth                   | each locale has one exact metadata/canonical/schema authority                                      |
| Clickeen distribution       | Free Widget HTML has one approved visible product link plus matching identity; paid branding policy and customer SEO policy stay separate |
| Global routing              | root selection uses approved precedence; exact URL always wins                                     |
| Cache                       | repeated locale requests are CDN hits; targeted invalidation preserves unrelated locales           |
| Page currency               | list/open/Save/Update/Publish derive Current or Needs update from minimal numeric revisions           |
| Overlay response cost       | maximum fixture proves deterministic overlay bytes and acceptable Tokyo cold-miss cost             |
| Editor ownership            | Page Builder changes only Page truth; Bob changes only the selected Instance                       |
| Editor return               | save/cancel revalidates and restores the same Page/placement, or visibly reports the stale target  |
| Dirty Page draft            | Bob opens only after successful Page save; Keep editing preserves the draft with no silent discard |
| Generated preview            | preview uses the last Save/Update direct files and never creates a second Page renderer             |
| Failure                     | failed Save/Update reports the ordinary retry error and never advances serve state                  |
| Unpublish/delete            | exact Page state changes; referenced Instances/assets remain unchanged                             |
| Template visibility         | current-account templates appear in My templates; only `CLICKEEN` templates appear in global Catalog |
| Save as template            | shown only while usable; source saves and one new named snapshot is created; no Upsell path |
| Page template references    | Save/use keeps Page-owned source; 127 adds no child-Instance cloning                                  |
| Use template                | no Widget/Page is created before explicit Save; an explicit asset-copy choice remains a normal asset operation |
| Catalog writes              | none; DevStudio manages the underlying `CLICKEEN` template and its thumbnail, description, category, and order |
| Template snapshot          | complete reusable source/config is copied; only locale, translation, and public-serving values are cleared |
| Template translation       | no Translation Agent call; the destination ordinary object gets locale state through its normal workflow |
| Catalog source assets      | explicit copy/discard choice; Copy reuses account assets and Discard removes external references |

## V1–V8 Design Audit

| ID                            | Required behavior                                                                                         |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| V1 Silent substitution        | missing overlay/Instance/SEO/tier truth fails; no profile falls back to Tier 4 or Tier99                  |
| V2 Silent healing             | invalid source, overlays, markers or direct files are not repaired                                       |
| V3 Silent omission            | every placement/contribution/overlay remains explicit; Page draft work is not dropped                |
| V4 Fail-open control          | Page/template creation, Catalog ownership, publication, return, and Tier99 checks fail closed             |
| V5 Corruption-as-absence      | corrupt source/direct-file/overlay or stale return target remains an explicit error                       |
| V6 Partial-success masquerade | Save, template creation, generate/install, Update and publication remain distinct                         |
| V7 Masquerade/redress         | no duplicate/Catalog flag/definition card or parallel Admin policy survives under another name            |
| V8 Runtime test dependency    | public delivery depends only on current stored files and CDN state, never tests or probes                 |

## Acceptance Criteria

- Every Page has the existing required `baseLocale`.
- Page source remains structured truth plus ordered Instance references.
- Pages is governed by one total-identity `pages.max` policy:
  `free=0`, `tier1=0`, `tier2=3`, `tier3=10`, `tier4/tier99=unlimited`.
- No separate Page availability, placement, locale or published-Page
  entitlement is introduced.
- Page composition accepts exact saved complete same-account Instances without
  independently publishing them; standalone Widget publication retains its own
  meter.
- The generator emits exactly three direct current public files regardless of
  locale count; private locale data remains internal to Tokyo.
- No package, persistent `builds/`, active-build selector, or locale-derived copy is
  introduced.
- Every exact locale URL returns complete initial HTML and self-consistent
  SEO truth.
- Every Free Widget Instance contains one generated visible contextual link to
  the global Clickeen product and matching truthful Clickeen application
  identity in initial HTML.
- `branding.remove` and `embed.seoGeo.enabled` remain separate policies; neither
  changes the complete semantic HTML baseline.
- Every generated Free attribution uses the one real global Clickeen URL and
  stable Clickeen application schema ID.
- Neutral root selection uses Cloudflare market evidence without hiding variants
  behind one content URL.
- Shared CSS/runtime contributions are not repeated per placement or locale.
- Browsers/crawlers never fetch overlays or assemble the Page.
- Tokyo public requests never resolve Page source or child Instances.
- CDN caching and targeted invalidation are proven.
- Saving an included Instance performs no Page operation; referencing Pages
  later derive Needs update without generating or changing their direct files.
- Currency-derivation or explicit-Update failure reports the exact Page result,
  leaves it Needs update, and never claims full success.
- Roma exposes Your pages, My templates, and Page catalog as Pages navigation
  subitems, with Your pages as the default inventory.
- Widgets exposes Your widgets, My templates, and Widget catalog with the same
  ownership rule; Widget definitions no longer masquerade as Catalog items.
- Save as template is shown only while role, ordinary-source state, and
  same-type capacity allow it; it creates a new named snapshot after source
  Save, never converts the source, and reports partial outcomes exactly.
- Saving or using a Page template keeps its Page-owned source; 127 does not
  clone referenced Instances.
- `CLICKEEN`-owned templates are the global Catalog; customer templates remain
  account-scoped; ordinary Clickeen-owned objects remain private.
- Catalog is read-only for everyone. Authorized `CLICKEEN` operators manage the
  underlying templates and their presentation values through DevStudio; Roma
  renders the category menu, search, and cards without a Catalog write path.
- Templates retain complete reusable source/config but carry no locale,
  translation, or public-serving values, cannot publish, and do not invoke
  Translation Agent. Use template creates independent ordinary objects, and
  writes no Widget/Page object before Save; any explicit asset copy is a
  separate normal account-assets operation.
- Direct Catalog source assets use the explicit copy/discard choice and the
  existing account-assets authority. No child cloning, asset-copy transaction,
  pending object, or template-operation commit machinery is introduced.
- Selecting a current Page opens one Page Builder that previews and edits
  Page-owned truth and composition; selecting a stale Page opens the Update
  gate and no editable draft until Update succeeds.
- Selecting an included Instance opens that Instance in Bob; save/cancel returns
  to the same validated Page/placement when it still exists, and successful
  Instance save presents the Update gate before editing or preview refresh.
- Dirty Page work is saved successfully before Bob opens or remains in Page
  Builder through Keep editing; it is never silently discarded.
- Stale/deleted return coordinates fail closed with visible Page/placement
  handling and never select a substitute or cross accounts.
- Page Builder does not duplicate Instance controls, and Bob does not gain Page
  editing authority.
- Page preview uses the direct files produced by explicit Save or Update page rather
  than a separate Page-file output, draft-change generator, or stack of public Widget URLs.
- `free` and Tier 1–4 remain customer profiles; Tier99 is the internal
  Admin/Ops tier assigned only to `CLICKEEN` and
  absent from every customer sale/assignment path.
- Tier99 uses the same explicit entitlement machinery, and the `CLICKEEN`
  account is updated only after runtime support exists.
- Tier 4 and Tier99 behavior are proven without numeric
  tier comparisons or a parallel Admin policy system.
- A/B compatibility uses two normal Page or Instance identities and adds no
  experiment-specific source/file type or execution machinery.
- Failed replacement never masquerades as current.
- No Website, navigation, graph, Queue, workflow engine, copied-code authority
  or compatibility file path is introduced.

## Open Decisions Before Execution

The System SEO/GEO/AEO PRD owns the single exhaustive **PRD 127 Decision
Ledger**. This Web Code Generator PRD must not maintain a second list that can drift.
Its direct decision dependencies are D1, D3–D5 and D8–D13; D2 and D6–D7 remain
shared release dependencies. No execution agent may treat an unapproved ledger
item as implementation discretion.

Until that ledger is resolved in PRD 127 and peer review confirms that existing
Instance markers/overlays can support exact composition, this PRD remains
Planning.
