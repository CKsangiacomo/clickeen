# PRD 127 — MAMA (Master PRD): Clickeen Pages

Status: **APPROVED FOR EXECUTION**

Owner: Clickeen product owner/architect

Date: 2026-08-05

## 1. What this program does

PRD 127 makes Pages a real Clickeen product.

A customer chooses saved Widget Instances, orders them in Page Builder, and
saves one Page. Clickeen writes complete Page HTML, CSS, and JavaScript and
serves the Page from `clk.live`.

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

1. **A Page is an ordered collection of saved Widget Instances.**
2. **A Page stores same-account Instance references, not copied Instance
   source and not public Widget URLs.**
3. **Every Widget definition contains structured editing truth plus complete
   default `index.html`, `styles.css`, and `runtime.js`.**
4. **Every saved Widget Instance contains its structured truth plus customized
   `index.html`, `styles.css`, and `runtime.js`.**
5. **The Web Code Generator combines the referenced saved Instances into one
   Page `index.html`, `styles.css`, and `runtime.js`.**
6. **Widget, Instance, and Page HTML contains the primary customer content
   before JavaScript runs. JavaScript adds behavior; it does not create the
   product.**
7. **Create and Duplicate open an unsaved browser draft. Nothing is created in
   Tokyo until the customer clicks Save.**
8. **Save and Update are explicit customer actions. Publish only exposes files
   that were already saved.**
9. **Generate translations is the one translation action for Widgets and
   Pages. It always uses the locales currently selected in account Settings.**
10. **`baseLocale` remains the source-language authority. Locale-specific
    values live in overlays. Save as template copies complete reusable source
    and config, then clears `baseLocale`, locale, overlay/translation, and
    public-serving values from the copied template config.**
11. **Changing account Settings never changes live output. New Settings apply
    only to the next explicit Generate translations, Save, or Update action.**
12. **Roma provides Your pages, My templates, Page catalog, and Page Builder.
    Page Builder reuses Bob's proven shell, Dieter components, ToolDrawer,
    Workspace, controls, dialogs, and Save interactions.**
13. **Tokyo stores current Instance and Page files and serves complete output
    through `clk.live` and Cloudflare.**
14. **Pages is visible to every tier. `pages.max` controls use: Tier 2 gets 3,
    Tier 3 gets 10, and Tier 4 and internal Tier99 are unlimited.**
15. **Every customer can see every product domain and everything their account
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
- ordered placements containing a placement ID and a saved same-account
  Instance ID;
- template/ordinary identity.

It does not contain copied Instance source, public Widget URLs, selected
account locales, build records, revisions, fingerprints, or package history.

Page creation works as follows:

```text
Create Page
→ open an unsaved Page draft in Page Builder
→ add, remove, and reorder saved Instances
→ edit Page settings and metadata
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

Saving an included Instance may mark Pages that reference it as
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
- **Page Builder** — the editor for one Page or Page template.

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

1. **Content** — add, remove, reorder, and edit included Instances;
2. **SEO/GEO/AEO** — base and locale-specific Page title, description, social
   title, social description, social image, search visibility, and Generate
   translations.

The internal Page name belongs in TopDrawer beside Page identity and actions;
it is not duplicated in a one-field Page panel.

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

Content renders the Page's ordered placements as compact ToolDrawer rows. Each
row shows Instance name, Widget type, and **Edit**, and selecting the row
selects and reveals the same placement in Workspace. Selecting a placement in
Workspace selects the matching Content row. This is editor-only browser state;
it never changes the Widget or Page files.

**Add widget** opens a large Dieter Popup containing the existing **Your
widgets** inventory in selection mode: the same current-account Instance facts,
published-status filter, sorting, Dieter Table, loading, empty,
filtered-empty, and error behavior. Each eligible ordinary Instance offers
**Add to page**; an Instance already on the Page remains visible as **On page**.
Choosing Add adds one reference to the browser Page draft, closes the Popup,
and selects that placement in Workspace. The current Your widgets inventory
has no search control, so 127 does not invent Popup-only search.

**Manage order** follows Dieter Object Manager's existing top-level collection
interaction. A medium Dieter Popup lists placements with `sm` Dieter icon
buttons for move up, move down, and remove, plus Cancel and Save. Its Save
applies only to the browser Page draft; Page Save remains the persistence
boundary. Dirty dismissal uses Object Manager's existing Keep editing/Discard
behavior. Page Builder does not force placements through Bob's Repeater
hydrator and does not add a Page-specific drag system.

An empty Content panel says **This page has no widgets yet** and shows one
primary **Add widget** action. The empty Workspace says **Add a widget to start
your page** and opens the same Popup; this is one operation, not a second add
flow.

**Edit in Bob** keeps Page Builder mounted and slides the existing Bob editor
over it. Bob remains the one Widget Instance editor and saves through its normal
authority. The only Page-context host action added to Bob is **Done, go back to
the page**, which slides Bob out and restores the same Page draft, panel,
placement order, Workspace position, and Page edits. Bob's existing unsaved
Widget interaction applies before closing. A successful Bob Save—not opening
or closing the panel—marks a saved referencing Page `needsUpdate: true` through
127D and refreshes the edited placement in the retained Page draft. An unsaved
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
    "placements": {
      "PLACEMENT_ID": {
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
- each placement receives its own generated CSS custom-property values;
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

Free Widget Instances include the approved visible Clickeen attribution and
truthful static structured data connecting Clickeen, the Widget product, and
the customer Instance. Paid branding removal and customer SEO/GEO/AEO remain
separate existing capabilities.

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
config values are absent. Page values, placements, settings, and direct asset
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
   - defines the Page source and overlay fields;
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
   - implements Page composition, CSS isolation, concrete repeater paths,
     locale-value assembly, and approved SEO output.

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
   - implements Your pages, Page Builder, Page controls, explicit Save/Update,
     unsaved changes, the Instances-browser Popup, and the slide-in Bob editing
     experience while Page Builder remains mounted.

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
- an SEO agent, crawler, score, recommendation, or learning system.

## 15. Failure behavior

Failure is intentionally ordinary:

- if Generate translations fails, show the normal error and let the customer
  retry;
- if Web Code Generator fails, Save or Update fails and nothing is reported as
  saved;
- if storage or publication fails, show the normal error and let the customer
  retry;
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
- Content rows and Workspace selection stay synchronized without changing
  saved or generated files;
- Manage order follows the Dieter Object Manager interaction and changes only
  the browser Page draft; no custom drag system or Repeater adapter exists;
- slide-in Bob preserves the browser Page draft, adds only **Done, go back to
  the page**, and introduces no return route or remote draft state;
- Pages contain complete initial HTML with consolidated CSS and JavaScript;
- repeated fields retain concrete editable paths;
- two differently styled Instances of the same Widget remain independent on
  one Page;
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
- Widget authoring/shared documentation and all affected Widget docs;
- policy, Supabase, Cloudflare, and public installation documentation when the
  owning slice changes those current systems.

PRD 127 is complete only when all six execution slices are deployed and
verified, obsolete owners are removed, current documentation matches runtime,
and the product obeys the tenets above.
