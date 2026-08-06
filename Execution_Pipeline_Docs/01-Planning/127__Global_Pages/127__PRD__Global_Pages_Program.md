# PRD 127 — MAMA (Master PRD): Clickeen Pages

Status: **DEFERRED PLANNING — DO NOT EXECUTE**

Owner: Clickeen product owner/architect

Date: 2026-08-05

## Product pivot — 2026-08-06

Clickeen Pages is not part of the current product. The incomplete Pages
implementation is being removed so Clickeen can remain focused on Widgets.

Pages is deferred until Clickeen deliberately chooses to build a simple Page
and website product. That future product is intended for landing pages and
simple websites. Prague is a complex, dynamic, global marketing site and is
not a target, migration consumer, or acceptance test for this program. Prague
continues on its existing Astro architecture and may embed published Clickeen
Widget Instances where appropriate.

The material below preserves planning history. It is not current-system truth,
is not an execution checklist, and must be reviewed and rewritten against the
future product and codebase before any implementation resumes.

## 1. What this program does

PRD 127 makes Pages a real Clickeen product.

A customer chooses saved Widget Instances, places each one in an ordered Page
Row, designs those Rows, and saves one Page. Clickeen writes complete Page
HTML, CSS, and JavaScript and serves the Page from `clk.live`.

Pages also includes a deterministic Optimization view over the current saved
Page output. It shows Page metadata, content-image semantics, internal links,
external links, heading structure, locale output, and generated structured
data. It routes each correction to the source that owns it: Page Builder for
Page or Row values and Bob for Widget Instance values.

This is the same simple file model Clickeen uses for Widget Instances:

```text
structured source
+ index.html
+ styles.css
+ runtime.js
```

The Web Code Generator writes those files in the browser when the customer
explicitly saves or updates. Tokyo stores and serves them. Files and
translations change only through their named customer actions; nothing
regenerates, republishes, or changes live output autonomously.

The Source PRDs are planning history. This Mama owns the program direction.
The lettered PRDs are the execution contracts.

## 2. Product tenets

1. **A Page is an ordered collection of Page Rows. Each Row contains one saved
   Widget Instance.**
2. **A Row owns how that Instance sits in this Page: Page width, background,
   border, shadow, and responsive spacing. The referenced Instance continues
   to own its content and internal Widget appearance.**
3. **A Page stores same-account Instance references and Page-owned Row design,
   not copied Instance source and not public Widget URLs.**
4. **Every Widget definition contains structured editing truth plus complete
   default `index.html`, `styles.css`, and `runtime.js`.**
5. **Every saved Widget Instance contains its structured truth plus customized
   `index.html`, `styles.css`, and `runtime.js`.**
6. **The Web Code Generator combines the Rows and referenced saved Instances into one
   Page `index.html`, `styles.css`, and `runtime.js`.**
7. **Widget, Instance, and Page HTML contains the primary customer content
   before JavaScript runs. JavaScript adds behavior; it does not create the
   product.**
8. **Create and Duplicate open an unsaved browser draft. Nothing is created in
   Tokyo until the customer clicks Save.**
9. **Save and Update are explicit customer actions. Publish only exposes files
   that were already saved.**
10. **Generate translations is the one translation action for Widgets and
   Pages. It always uses the locales currently selected in account Settings.**
11. **`baseLocale` remains the source-language authority. Locale-specific
    values live in overlays. Save as template copies complete reusable source
    and config, then clears `baseLocale`, locale, overlay/translation, and
    public-serving values from the copied template config.**
12. **Changing account Settings never changes live output. New Settings apply
    only to the next explicit Generate translations, Save, or Update action.**
13. **Roma provides Your pages, My templates, Page catalog, Page Builder, and
    Page Optimization. Page Builder reuses Bob's proven shell, Dieter
    components, ToolDrawer, Workspace, controls, dialogs, and Save
    interactions.**
14. **Page Optimization reads current saved output when the customer opens it.
    It does not crawl autonomously, change source, regenerate files, or create
    another saved report or public artifact.**
15. **Tokyo stores current Instance and Page files and serves complete output
    through `clk.live` and Cloudflare.**
16. **Pages is visible to every tier. `pages.max` controls use: Tier 2 gets 3,
    Tier 3 gets 10, and Tier 4 and internal Tier99 are unlimited.**
17. **Every customer can see every product domain and everything their account
    has created; access to actions is controlled by tier. Save as template
    remains the existing contextual-visibility exception.**

Work that cannot be traced to these tenets does not belong in PRD 127.

## 3. Structural execution law

127 replaces the unfinished pre-GA Page implementation. It does not wrap or
preserve it.

- When a slice installs a new owner, it deletes the obsolete owner, imports,
  tests, UI, and documentation in the same cutover.
- No compatibility readers, dual Page shapes, parallel renderers, migration
  frameworks, or transitional Page UI are required.
- Roma applies existing account, role, tier, entitlement, and Save authority.
- Bob and Page Builder edit browser-memory working copies.
- Web Code Generator writes HTML, CSS, and JavaScript in the browser.
- Tokyo stores and serves the accepted files.
- Translation Agent translates approved text when the customer explicitly
  clicks Generate translations.
- A new Worker, service, Queue, registry, validator framework, revision system,
  recovery system, or background job requires a new product-owner decision.

127 may temporarily break the pre-GA Pages surface between slices. Preserving
obsolete Page behavior is not an execution requirement.

## 4. Widget and Instance model

```text
Widget definition
= config/spec/editing files
+ default index.html
+ default styles.css
+ default runtime.js

Bob
= one browser-memory working copy of the structured source and three files

Instance Save
= Web Code Generator updates the customized three files in the browser
+ Bob submits the structured source and exact previewed files through Roma
+ Tokyo stores them in the Instance folder
```

Create and Duplicate are ordinary browser drafts:

```text
Create Instance
→ open the selected Widget definition in Bob
→ edit in browser memory
→ Save creates the Instance

Duplicate Instance
→ open a copy of the selected Instance in Bob
→ edit in browser memory
→ Save creates the new Instance
```

Before Save there is no new Instance root in Tokyo and no saved object to
count. Leaving the draft uses the existing unsaved-changes interaction.

There is no separate Widget HTML writer, server renderer, or second preview
implementation. Bob previews the same files that Save submits.

## 5. Page model

Page source contains:

- internal Page name;
- Page metadata and search-visibility choice;
- `baseLocale` for an ordinary Page;
- ordered Rows containing a Row ID, a saved same-account Instance ID, and
  Page-owned Row design;
- template/ordinary identity.

It does not contain copied Instance source, public Widget URLs, selected
account locales, build records, revisions, fingerprints, or package history.

Page creation works as follows:

```text
Create Page
→ open an unsaved Page draft in Page Builder
→ add, remove, and reorder Rows containing saved Instances
→ edit Row design, Page settings, and metadata
→ nothing is written to Tokyo

Save
→ Web Code Generator combines the selected saved Instances
→ Page Builder previews the generated Page files
→ Page Builder submits source + exact files through Roma
→ Tokyo creates or updates the Page folder
```

For an existing Page, **Save** applies Page-owned edits. **Update page** is
shown when an included Instance has changed. Update reruns Web Code Generator
with the currently saved Instances and clears the Page's small `needsUpdate`
flag after a successful save.

Saving an included Instance may mark Pages with Rows that reference it as
`needsUpdate: true`. It never regenerates those Pages. There is no dependency
graph, revision comparison, evidence record, or autonomous compiler.

If Save or Update fails, the customer sees the normal retry message. PRD 127
adds no candidate package, rollback flow, pointer, retained build, or recovery
lifecycle.

## 6. Page Builder

Customers receive:

- **Your pages** — the account's ordinary Pages;
- **My templates** — the account's Page templates;
- **Page catalog** — read-only Page templates managed by Clickeen in
  DevStudio;
- **Page Builder** — the editor for one Page or Page template;
- **Optimization** — current-output checks across the account's saved Pages.

Page Builder reuses Bob's editor structure:

```text
main-container
├── left-nav
└── page
    └── builder
        ├── topdrawer
        ├── tooldrawer
        └── workspace
```

The initial ToolDrawer contains:

1. **Content** — add, remove, reorder, select, and edit Page Rows and their
   included Instances;
2. **SEO/GEO/AEO** — base and locale-specific Page title, description, social
   title, social description, social image, search visibility, and Generate
   translations.

The internal Page name belongs in TopDrawer beside Page identity and actions;
it is not duplicated in a one-field Page panel.

Selecting a Row in Content or Workspace opens one Page-owned Row editor in the
existing ToolDrawer. The accepted Row controls are:

- Layout: full-bleed on/off, full or contained Widget content, required
  contained maximum width in pixels (1200 initially), and optional minimum Row
  height in pixels;
- Style: the existing Dieter Fill value (none, color, gradient, account image,
  or account video), the existing Dieter Border value, and the existing
  Dieter Shadow value;
- Spacing: desktop and mobile top/right/bottom/left padding.

Neutral defaults preserve the referenced Instance exactly: full content
width, transparent/no fill, no border, no shadow, and zero Page padding.
The outer Row always spans Page width. Full bleed chooses whether Row Style
applies to the outer Row or its inner content wrapper; content width and
responsive pixel padding always apply to that inner wrapper.
Animation belongs to Row ownership, but 127 does not authorize an effect list,
timing contract, or runtime implementation until the product owner accepts the
exact choices. Execution must not invent them from the visual reference.

SEO/GEO/AEO shows base metadata for every draft or template. Its locale
selector and Generate translations action exist only for a saved ordinary
Page. A Page template has no `baseLocale`, overlays, locale selector, or
translation action.

SEO/GEO/AEO asks for one required public value: **Page title**. Description,
social-title override, social-description override, and social image are
optional. Social title uses the effective locale Page title when its override
is empty; social description uses the effective locale Page description when
its override is empty. These are public-output fallbacks, not copied Page
values. Search visibility defaults to **Index this page** and offers only
**Index this page** (`index,follow`) and **Hide this page**
(`noindex,follow`). Page Builder does not infer public metadata from the
internal Page name or arbitrary Widget content.

The top of SEO/GEO/AEO shows the active metadata locale and **Generate
translations**. Base shows the Page source values. Selecting an exact locale
shows that locale's translated title, description, and supplied social-text
overrides in the same SEO and Sharing sections. Search visibility and social
image remain shared and do not change with the selected locale. Generate
translations always reads the locales selected in account Settings and uses
the existing Translation Agent operation; it does not create a Page-owned
locale list or another translation system.

Title controls use Dieter Textfield. Description controls use one small Dieter
Textarea: a compact Textfield-style label/value trigger opens a Dieter Popover
containing a plain native textarea. It supports label, value, placeholder,
path, disabled state, and maximum length; focuses the textarea on open; updates
the browser Page draft while typing; and closes through the existing Popover
lifecycle. It has no rich-text formatting, HTML, links, internal persistence,
or Page-specific variant. Page Save remains the persistence boundary.

Content renders the Page's ordered Rows as a compact ToolDrawer list. Each Row
shows Instance name, Widget type, and **Edit in Bob**. Selecting it selects and reveals
the same Row in Workspace and opens its Page-owned Layout, Style, and Spacing
settings. The Row and its design are Page source; only the editor selection
outline and controls are editor-only.

**Add widget** opens a large Dieter Popup containing the existing **Your
widgets** inventory in selection mode: the same current-account Instance facts,
published-status filter, sorting, Dieter Table, loading, empty,
filtered-empty, and error behavior. Each eligible ordinary Instance offers
**Add to page**; an Instance already on the Page remains visible as **On page**.
Choosing Add creates one neutral Row containing that Instance reference in the
browser Page draft, closes the Popup, and selects that Row in Workspace. The current Your widgets inventory
has no search control, so 127 does not invent Popup-only search.

**Manage order** follows Dieter Object Manager's existing top-level collection
interaction. A medium Dieter Popup lists Rows with `sm` Dieter icon
buttons for move up, move down, and remove, plus Cancel and Save. Its Save
applies only to the browser Page draft; Page Save remains the persistence
boundary. Dirty dismissal uses Object Manager's existing Keep editing/Discard
behavior. Page Builder does not force Rows through Bob's Repeater
hydrator and does not add a Page-specific drag system.

An empty Content panel says **This page has no widgets yet** and shows one
primary **Add widget** action. The empty Workspace says **Add a widget to start
your page** and opens the same Popup; this is one operation, not a second add
flow.

**Edit in Bob** keeps Page Builder mounted and slides the existing Bob editor
over it. Bob remains the one Widget Instance editor and saves through its normal
authority. The only Page-context host action added to Bob is **Done, go back to
the page**, which slides Bob out and restores the same Page draft, panel, Row
order, Workspace position, and Page edits. Bob's existing unsaved
Widget interaction applies before closing. A successful Bob Save—not opening
or closing the panel—marks a saved referencing Page `needsUpdate: true` through
127D and refreshes the edited Row in the retained Page draft. An unsaved
Page has no stored flag; it simply keeps its browser draft and uses the latest
saved Instance on first Save.

While Bob is hosted from a Page, it shows one non-blocking contextual sentence:
**You're editing the saved widget. Other pages using it will also need
updating.** It does not add a warning dialog or a Page-local Widget override.

This interaction adds no Bob return route, `returnTo` coordinate, remote Page
draft, duplicate Widget editor, or Page-before-Bob Save requirement.

The exact Page controls may be refined during 127E, but Page Builder must use
existing Bob/Dieter patterns rather than inventing another editor system.

Customer wording is fixed: **Save applies your Page edits. Update page
refreshes the Page from the latest saved Widgets.**

The first release is one ordered vertical Page. It is not a Website,
navigation system, or general-purpose site builder.

## 7. Localization and overlays

The translation model is the existing Clickeen model:

```text
account Settings owns the selected locales
→ customer clicks Generate translations
→ Translation Agent translates the approved Widget or Page fields
→ locale-specific values are saved as overlays
→ the customer explicitly Saves or Updates generated output
```

Generate translations always uses the locales currently selected in account
Settings. A Page does not maintain a second selected-locale list.

Generate translations requires a saved ordinary Widget Instance or Page. An
unsaved draft has no Tokyo identity or overlay root and therefore cannot run
the operation. Templates never show or run Generate translations.

For Pages, Translation Agent translates Page-owned text such as:

- Page title;
- description;
- social title;
- social description.

It uses the same Translation Agent and operation already used for Instance
content, including the existing request/grant, Roma/Tokyo coordinate,
provider, permission, activity, and per-locale result behavior. PRD 127
creates no Page translator, metadata translation service, translation
revision, stale-result system, or persisted translation-job lifecycle.

Every requested locale still receives the ordinary terminal success or error
result. Removing a special partial-result lifecycle does not hide a failed
locale or turn a partial operation into full success.

127A gives an ordinary Page the same locale-overlay convention already used by
Instances, under this Page root:

```text
accounts/{accountPublicId}/pages/{pageId}/overlays/locales/{locale}.json
```

Generated `overlays.json` contains only values used to complete locale output:

```json
{
  "it-IT": {
    "page": {
      "title": "Titolo italiano",
      "description": "Descrizione italiana"
    },
    "rows": {
      "ROW_ID": {
        "header.title": "Titolo del widget"
      }
    }
  }
}
```

It does not contain `baseLocale`, selected-locales settings, publication state,
tiers, policies, revisions, fingerprints, or generation evidence.

Changing account locales or market settings does not remove overlays, change a
published Page, purge a URL, or run any product operation. The changed Settings
are used by the next explicit Generate translations, Save, or Update action.
On that next Page Save or Update, the saved Page receives the account's current
`baseLocale`; changing Settings by itself still changes nothing live.

## 8. Web Code Generator

Web Code Generator is shared browser-compatible repository code. It is not a
Worker, service, API, model call, Queue, or public-request dependency.

It is separate from the Bob Editor Compiler:

- Bob Editor Compiler builds the ToolDrawer from editing contracts.
- Web Code Generator writes final public HTML, CSS, and JavaScript.

For Widget Instances it:

- starts from the Widget definition's complete `index.html`, `styles.css`, and
  `runtime.js`;
- applies the structured Instance values;
- produces the exact files Bob previews and saves.

For Pages it:

- reads the ordered saved Instance files supplied by Page Builder;
- places every Instance's semantic HTML directly in the initial Page HTML;
- consolidates shared CSS and genuine runtime behavior;
- writes Page metadata, one localized `WebPage` JSON-LD block, and only
  supported content-specific structured data that matches visible content;
- writes `overlays.json` from saved locale-specific values;
- returns one complete Page `index.html`, `styles.css`, and `runtime.js`.

Repeated fields use the existing generic stencil renderer. 127B extends its
loop context so generated elements receive concrete paths such as
`faq.sections.0.faqs.1.answer`. It does not add per-Widget TypeScript writers.

The generator receives the same resolved account assets and typography data
already available to Bob or Page Builder. It does not discover those inputs
through another service.

Page CSS follows one simple rule:

- shared Widget structure rules are included once per Widget type;
- each Row receives its own generated Page layout/style/spacing values and its
  Instance receives its own generated CSS custom-property values;
- each declarative Shadow DOM template links the Page's single
  `./styles.css`; the browser fetches that URL once and reuses it;
- two differently styled Instances of the same Widget remain independent.

No selector rewriting, CSS registry, module framework, or heuristic optimizer
is authorized.

`runtime.js` contains only JavaScript required for behavior. It never creates
the primary Widget or Page content.

## 9. SEO, GEO, AEO, and Clickeen distribution

Every Widget Instance and Page has complete readable HTML regardless of tier.

For Widget Instances:

- 127B adds **Enable SEO/GEO/AEO** to Bob and makes it visible to every
  customer;
- it is off by default;
- if the customer cannot use it, attempting to enable it opens the existing
  Upgrade modal and leaves it off;
- when enabled for an entitled account, Web Code Generator emits the approved
  metadata and source-backed structured data.

For Pages:

- Pages begin at Tier 2;
- SEO/GEO/AEO is therefore always part of an ordinary Page;
- there is no Page SEO toggle, Page SEO entitlement branch, or persisted Page
  SEO boolean.

Page Builder edits the current Page's title, description, social metadata,
search visibility, and locale overlays. The separate Pages **Optimization**
view reads current saved Page files and reports:

- metadata completeness by Page and locale;
- semantic content images and whether their saved source supplies meaningful,
  empty-decorative, or missing alternative text;
- internal Page links, their link text, and whether the destination saved Page
  exists and is published;
- external links, their link text, and locally knowable malformed or missing
  destinations;
- heading structure, document language, and the structured data generated from
  visible source.

The report never becomes a fifth public Page file. It is derived on request
from current saved Page output. A Widget-owned finding opens that saved
Instance in Bob; a Page- or Row-owned finding opens Page Builder. CSS Row
backgrounds are decorative and are not falsely reported as content images
requiring HTML `alt`. Checking whether an external website currently returns
an HTTP error would require an explicit product-owner-approved operation and
is not part of 127. No autonomous crawler, score, or recommendation engine is
authorized.

Every ordinary Page contains one `WebPage` JSON-LD block in its initial HTML.
For each exact-locale response, that block contains the exact locale Page URL
and `@id`, the effective localized Page title, the optional effective localized
description, `inLanguage`, and the optional supplied social image. Additional
content-specific schema is allowed only when a supported Widget declares it
from visible source content. Of the current Widgets, only FAQ may contribute
`FAQPage` data from its visible questions and answers. No other content schema
is inferred.

Web Code Generator writes this JSON-LD into `index.html` using the same locale
and public-coordinate markers already required for metadata. Tokyo completes
those markers for the requested exact locale before Cloudflare caches the HTML.
This is part of the existing generated Page document, not another service,
schema subsystem, or customer control.

Web Code Generator uses only approved customer source and Clickeen product
truth. It does not invent keywords, claims, locations, descriptions, schema
values, or search outcomes.

Free Widget Instances include the approved visible link to the global Clickeen
product and truthful static structured data connecting the Clickeen application
and the customer Instance. Paid branding removal and customer SEO/GEO/AEO
remain separate existing capabilities.

## 10. Files and storage

An ordinary saved Page uses one current Page root:

```text
accounts/{accountPublicId}/pages/{pageId}/
  source.json
  serve-state.json
  overlays/
    locales/
      {locale}.json
  overlays.json
  index.html
  styles.css
  runtime.js
```

`source.json` is Page editing truth. `serve-state.json` contains only
`published` and `needsUpdate`. `overlays.json` contains locale values only.

A Page template has complete reusable Page source/config and three generated
files. Only its ordinary-Page locale, overlay/translation, and public-serving
config values are absent. Page values, Rows, settings, and direct asset
references remain reusable.

There are no build folders, package versions, candidate folders, selected
pointers, revision objects, file fingerprints, retained history, or cleanup
machinery.

## 11. Publish and public serving

Publish exposes already-saved files. It never invokes Web Code Generator or
Translation Agent.

The stable Page URL is:

```text
https://clk.live/{accountPublicId}/pages/{pageId}
```

Exact locale URLs add the resolved locale. The stable route uses browser
language first, then matches Cloudflare's country code to an available
regional locale, then uses `baseLocale`. It selects only among locale output
already saved for that Page. The exact locale response contains complete
localized HTML so crawlers can read the content and metadata without running
JavaScript.

CSS and JavaScript are shared across locales. Locale-specific values come from
`overlays.json`. Cloudflare caches the completed exact-locale response.

Changing Settings alone does not affect this output. Saved locale output
changes only after the named Generate translations and Save/Update actions.

Both Widget Instances and Pages can also be mounted on another website with
the shared iframe-free loader:

```html
<script
  src="https://clk.live/clickeen.js"
  data-clickeen="https://clk.live/ACCOUNT/PUBLIC-PRODUCT"
  defer
></script>
```

The loader mounts already-generated output. It does not generate, translate,
save, publish, or inspect private source.

## 12. Templates, catalogs, and tiers

Save as template creates a separately named snapshot. It does not convert the
source Instance or Page. The snapshot keeps the complete reusable source and
config—including the Widget SEO/GEO/AEO setting—and clears only locale,
translation, and public-serving values from the copied template config.

- **My templates** contains templates owned by the current account.
- **Widget catalog** and **Page catalog** show read-only templates managed by
  Clickeen in DevStudio.
- **Use template** opens a new unsaved browser draft.
- Templates cannot publish and carry no locale, translation, or public-serving
  state.
- DevStudio manages each Catalog template's thumbnail, description, category,
  and display order. Roma renders the read-only left category menu, search, and
  template cards.
- My templates reuses the ordinary Widget/Page table. Each row shows the
  Template badge and Edit, with Use template, Rename, and confirmed Delete in
  the three-dot menu. Publication, Page currency, URL, and code actions are
  absent.
- DevStudio exposes **CATALOGS > Widget catalog** and **CATALOGS > Page
  catalog**. It edits Catalog presentation values and opens the existing Bob or
  Page Builder for template source editing; it does not create another editor.
- When reusable source from a `CLICKEEN` Catalog template contains images,
  SVGs, or videos, the customer chooses **Copy assets in my assets folder** or
  **Discard assets** before the unsaved draft opens. Copy reuses the existing
  account-assets authority; Discard removes those external references without
  inventing replacements.

The first Page Catalog contains one blank Clickeen Page template. It carries no
Instance references, so using it creates an empty unsaved Page draft in the
customer account. Rich cross-account Page templates and copying child Instances
are outside PRD 127. Account-owned Page templates may keep same-account
Instance and asset references because they remain inside that account. The
copy/discard choice applies only to direct reusable source assets, not to
cross-account child Instances.

`pages.max` follows the existing entitlement system:

| Tier     | `pages.max`       |
| -------- | ----------------- |
| `free`   | `0`               |
| `tier1`  | `0`               |
| `tier2`  | `3`               |
| `tier3`  | `10`              |
| `tier4`  | unlimited (`null`) |
| `tier99` | unlimited (`null`) |

Existing Pages remain visible after downgrade. Unavailable actions use the
existing Upgrade interaction. Tier changes do not delete stored Pages.

Tier99 is simply one non-sellable tier used by the internal `CLICKEEN` account
for Admin/Ops. It uses the existing tier, policy, bootstrap, and persistence
systems. It creates no Admin subsystem or bypass.

## 13. Execution slices

1. **127A — Page Source and Policy**
   - defines Page source, ordered Rows, Row design, and overlay fields;
   - adds `pages.max` and Tier99 through existing policy/tier systems;
   - adds Page-owned text to the existing Generate translations operation;
   - deletes the obsolete pre-GA Page source/routes/UI instead of preserving
     compatibility.

2. **127B — Web Code Generator**
   - creates the shared browser code that writes complete Instance and Page
     HTML/CSS/JS;
   - converts all Widgets to complete three-file definitions;
   - removes visitor-side primary-content construction and the obsolete
     materializer path;
   - implements Row composition, CSS isolation, concrete repeater paths,
     locale-value assembly, approved SEO output, and pure current-output
     inspection for Page Optimization.

3. **127C — Page Publication and Public Serving**
   - stores and serves the direct Page files;
   - implements publish/unpublish/delete, exact-locale completion, Cloudflare
     caching, and the shared `clickeen.js` installer.

4. **127D — Page Update State**
   - adds the small `needsUpdate` flag when a referenced Instance changes;
   - implements the explicit Update page action;
   - adds no revision comparison, graph, evidence record, Queue, or automatic
     generation.

5. **127E — Roma Pages and Page Builder**
   - implements Your pages, Page Builder, Row controls, Page Optimization,
     explicit Save/Update, unsaved changes, the Instances-browser Popup, and
     the slide-in Bob editing experience while Page Builder remains mounted.

6. **127F — Templates and Catalogs**
   - implements Widget/Page My templates, read-only Clickeen Catalogs, Save as
     template, Use template, explicit cross-account source-asset copy/discard,
     DevStudio Catalog presentation values, and Roma Catalog discovery through
     existing product authorities.

Execution order:

```text
127A → 127B → 127C → 127D → 127E → 127F
```

## 14. Explicit exclusions

PRD 127 does not authorize:

- a Web Code Generator Worker, API, Queue, or network service;
- another Widget renderer, Page renderer, or per-Widget TypeScript HTML writer;
- a shared validator framework;
- file revisions, fingerprints, generated-from evidence, package versions,
  pointers, retained builds, rollback, or recovery machinery;
- autonomous generation, translation, publication, or locale cleanup;
- a dependency graph, fan-out job, or background compiler;
- another locale registry or metadata translation system;
- per-locale CSS or JavaScript;
- iframe installation or runtime-only product rendering;
- Websites, navigation, Prague migration, A/B testing, or a generic editor;
- an autonomous SEO agent, crawler, score, recommendation, or learning system;
- external-link network checking without a separate product-owner decision;
- Row animation effects or timing invented during execution.

## 15. Failure behavior

Failure is intentionally ordinary:

- if Generate translations fails, show the normal error and let the customer
  retry;
- if Web Code Generator fails, Save or Update fails and nothing is reported as
  saved;
- if storage or publication fails, show the normal error and let the customer
  retry;
- if a saved Page cannot be loaded or inspected in Optimization, show that
  Page's normal error/Retry and do not omit it or call it clean;
- never report success for an operation that failed.

PRD 127 adds no new failure-state product, stale-result lifecycle, partial
translation lifecycle, rollback system, or recovery workflow.

## 16. Verification and documentation

The program must prove:

- all Widget definitions and saved Instances contain complete initial HTML;
- Bob previews and saves the same customized files;
- Create and Duplicate write nothing before Save;
- Page Builder generates only on explicit Save or Update;
- Add widget reuses the Your widgets inventory in a Dieter Popup rather than a
  second picker/inventory;
- Add widget creates one neutral Page Row containing the selected saved
  Instance; Row design stays Page-owned and never changes that Instance;
- Content Rows and Workspace selection stay synchronized;
- Layout, Style, and Spacing controls reuse Dieter values and update only the
  browser Page draft until Save;
- Manage order follows the Dieter Object Manager interaction and changes only
  ordered Rows in the browser Page draft; no custom drag system or Repeater
  adapter exists;
- slide-in Bob preserves the browser Page draft, adds only **Done, go back to
  the page**, and introduces no return route or remote draft state;
- Pages contain complete initial HTML with consolidated CSS and JavaScript;
- repeated fields retain concrete editable paths;
- two differently styled Instances of the same Widget remain independent on
  one Page;
- full-bleed Row background and contained Widget content compile through one
  outer Row and one inner content container;
- Page Optimization derives findings from saved output, routes each correction
  to Page Builder or Bob, and stores no report/public artifact;
- Generate translations uses the locales currently selected in Settings;
- `overlays.json` contains locale-specific values only;
- Page SEO/GEO/AEO is always present and no Page SEO toggle exists;
- changing Settings does not mutate live output;
- no obsolete Page implementation, visitor-side primary-content renderer,
  materializer, or unauthorized subsystem remains;
- V1–V8 pass independently.

After each slice deploys, update only the current-truth documentation affected
by that slice, including as applicable:

- `documentation/architecture/CONTEXT.md`, `Overview.md`, `Tenets.md`,
  `OverlayArchitecture.md`, and `AccountManagement.md`;
- `documentation/capabilities/localization.md`, `seo-geo.md`, and
  `multitenancy.md`;
- `documentation/services/roma.md`, `bob.md`, `tokyo-worker.md`, and
  `berlin.md`;
- Page source/Row ownership, Page Builder, Page Optimization, and Web Code
  Generator documentation, including the static-Widget, font, scroll, error,
  and Bob-slide runtime contracts;
- Widget authoring/shared documentation and all affected Widget docs;
- policy, Supabase, Cloudflare, and public installation documentation when the
  owning slice changes those current systems.

PRD 127 is complete only when all six execution slices are deployed and
verified, obsolete owners are removed, current documentation matches runtime,
and the product obeys the tenets above.

## 17. Program reopen and required closeout

The 2026-08-06 execution proved the original six slices, but later product and
browser review exposed that the accepted contract was incomplete:

- Page source stored only bare child/Instance IDs and could not persist
  Page-owned Row design;
- Page Builder stacked Instances but could not design Rows;
- the Pages product exposed only four metadata fields and no current-output
  Optimization view;
- draft preview required JavaScript initializers even for static Widgets,
  trapped generated font declarations inside Shadow DOM, stopped mounting
  later Widgets after the first error, showed an error beside a still-visible
  canvas, and mounted Bob as a fixed viewport layer without a slide.

Therefore the previous green closeout is superseded. 127A, 127B, 127E, and
127F require corrective execution and all affected slices require regression
verification. 127C's four-file public serving and 127D's explicit Update model
remain the intended authorities, but must be reverified against the corrected
Row package.

The prior work installed:

- 127A installed the current Page source, policy, tier, and translation
  authorities.
- 127B installed the browser Web Code Generator and complete initial HTML for
  Widget Instances and Pages.
- 127C installed direct Page publication, localized public serving, caching,
  and the shared `clickeen.js` installer.
- 127D installed the small explicit Page `needsUpdate` state and customer-run
  Update page action.
- 127E installed Your pages and the Bob/Dieter-based Page Builder.
- 127F installed normal Widget/Page templates, read-only Clickeen Catalogs,
  and DevStudio Catalog management through Roma and Tokyo.

Each lettered PRD retains its prior execution evidence as history, not proof
that this corrected program is complete. The system uses one global Clickeen
product-attribution link, `https://clickeen.com/`, and retains the named
authorities and explicit customer actions in this Mama. No excluded registry,
Queue, synchronization service, autonomous compiler, revision system, or
parallel renderer remains. The final alignment gate also decomposed Roma's
renamed Widget-list god owner into its existing controller, table, row-action,
dialog, and composition responsibilities, and directly proved the existing
Bob/Roma SEO/GEO/AEO entitlement path. It introduced no route, storage owner,
policy owner, or CSS system. Final route reconciliation added `/profile`,
`/pages`, and `/page-builder/**` to Roma's existing authenticated middleware
boundary. Roma verification run `31108288849` passed on commit `b544d1fe`,
Cloudflare Pages deployment `99e5c115-cba9-4bec-8b72-ded405a1fc97` deployed
that exact commit, and unauthenticated production requests to Your pages, Page
catalog, new/existing Page Builder, and Profile all return `307` to Login while
preserving the requested path. Those checks must be rerun after the corrective
execution above; PRD 127 is not currently closed.
