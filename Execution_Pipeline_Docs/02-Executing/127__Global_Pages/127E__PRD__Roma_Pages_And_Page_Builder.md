# 127E — Roma Pages and Page Builder

Status: **DEPLOYED AND VERIFIED — FINAL THREE-LENS REVIEW PENDING**

Parent: `127__PRD__Global_Pages_Program.md`

Depends on: deployed and verified 127A–127D

## Goal

Implement **Your pages** and a Page-specific builder by reusing the proven Bob
editor shell, Dieter components, and Roma product patterns.

Page Builder edits one ordinary Page. Bob continues to edit one Widget
Instance or Widget template. 127F later reuses the completed Page Builder for
Page templates. 127E does not prebuild that template mode, create another
application shell, copy Bob, or introduce a generic editor framework.

## Customer result

- Pages remains visible in Roma navigation for every tier.
- Your pages lists retained ordinary Pages.
- Create page opens an unsaved browser draft.
- Page Builder manages Page identity, ordered Instances, metadata, locales, and
  Page actions.
- Edit in Bob slides the existing Bob editor over Page Builder while the Page
  draft and Workspace remain mounted; **Done, go back to the page** slides Bob
  out to the same Page state.
- Save and Update explicitly invoke the browser Web Code Generator.
- Publish exposes a saved Current Page and never generates.
- Needs update blocks a fresh entry into normal Page editing and blocks
  Publish until explicit Update succeeds. If Bob Save sets the flag while Page
  Builder is already open, the retained Page draft stays available and Update
  becomes its required next persistence action.

My templates and Page catalog are completed in 127F. 127E must not add a
temporary hardcoded Catalog model or template-editing mode.

## Routes and navigation

```text
/pages                 Your pages
/page-builder/new             Unsaved blank Page draft
/page-builder/{pageId}        Page Builder for one saved Page
```

Opening `/page-builder/new` or `/page-builder/{pageId}` keeps Pages active in `left-nav`.
Direct routes use the same Berlin/Roma account, role, tier, and `pages.max`
checks as visible actions.

Free/Tier1 or downgraded accounts still see Pages and retained rows. Attempts
to create, open for editing, Save, Update, Publish, or mutate a Page use the
existing Upgrade dialog and change nothing. Storage remains visible and is not
deleted on downgrade.

## Reuse Bob and Dieter

Page Builder reuses the existing builder layout/taxonomy:

```text
main-container
├── left-nav
└── page
    └── builder
        ├── topdrawer
        ├── tooldrawer
        └── workspace
```

Reuse, rather than reimplement:

- Roma shell and responsive main-container behavior;
- Bob `topdrawer`, `tooldrawer`, and `workspace` layout components where their
  contracts are product-neutral;
- Dieter typography, colors, spacing, controls, buttons, icon buttons, fields,
  tables, toggles, accordions, dialogs, popovers, and status treatments;
- existing control/section rendering utilities where they accept Page-owned
  schema without Widget-specific assumptions;
- existing Save state, dirty-state, unsaved-leave dialog, error presentation,
  and responsive preview controls where applicable.

Only extract/reuse code that is already genuinely shared. Do not add a broad
editor framework, compatibility wrapper, duplicate Dieter primitive, or Page
copy of Bob CSS.

Page Builder hosts the existing Bob editor as a sliding layer when the customer
edits an included Instance. It does not import or recreate Bob's Widget editor
inside Page controls. Page Builder remains mounted behind Bob, preserving its
browser draft, active panel, placement order, Workspace position, and unsaved
Page edits. The only Page-context host action added to Bob is **Done, go back to
the page**.

The Page Builder differs from Bob only where the product differs:

- Bob edits one Instance's structured truth and three files;
- Page Builder edits Page source and ordered Instance references;
- Bob owns Widget content/appearance/behavior controls;
- Page Builder owns Page identity, composition, metadata, translation actions,
  and Page actions. Account Settings remains the selected-locale authority.

## Structural cutover boundary

127E replaces the current all-in-one Pages component instead of adding Page
Builder to it:

| Current code | Final responsibility |
| ------------ | -------------------- |
| `roma/components/pages-domain.tsx` | Thin Pages domain/page wrapper and route composition only. Its inline list, detail editor, localization-rules editor, publication/embed helpers, and form orchestration are deleted. |
| `roma/components/use-roma-pages.ts` | Account Page loading/cache transport only, importing the deployed 127A Page contracts instead of declaring another Page source. |
| Your pages inventory | One named list component using the existing Dieter table/filter/action patterns. |
| Page Builder | One named Page Builder shell composed from TopDrawer, ToolDrawer sections, and Workspace; reuse product-neutral Bob/Dieter pieces directly. |
| Page-specific controls | Named Content and SEO/GEO/AEO panel components; Page name stays in TopDrawer; no Languages, Translations, or Meta panel, generic editor framework, or second component registry. |
| Page iframe/public-code helper | Delete it; published Page actions reuse 127C's direct URL and shared `clickeen.js` dialog. |

The final file names may follow the existing Roma casing convention, but these
responsibilities may not be recombined into another single domain file. 127E
does not refactor unrelated Widgets, Assets, Settings, or Bob domains.

## Your pages

Use the existing Dieter table contract and Roma page-header/action patterns.

Header:

- title: **Pages**;
- filter beside the title: Show all, Published, Unpublished, Needs update;
- one primary create action at the normal right-side action location;
- no other Page-domain header action in 127E.

Columns:

| Column    | Behavior                                 |
| --------- | ---------------------------------------- |
| Page      | Internal Page name; sortable             |
| Published | Dieter toggle; sortable                  |
| Status    | Current or Needs update; sortable        |
| Languages | Current account Settings locales with saved Page output |
| Page ID   | Secondary/smaller text                   |
| Actions   | Edit/Update and Dieter three-dot actions |

Rows are generous enough for readable status/actions and follow the same
Dieter table spacing used by the accepted Widgets/Assets tables.

Behavior:

- Current Page: Edit is available;
- Needs update Page: Update page replaces Edit as the immediate action;
- a published current Page exposes **Copy URL** and **Copy code** through the
  same public-action dialog used by published Widget Instances;
- **Copy code** contains the shared `clickeen.js` snippet from 127C with that
  Page's public URL; it never offers an iframe or a Page-specific loader;
- three-dot popover contains Rename and Delete;
- Delete requires unpublish and existing Dieter confirmation;
- no Needs fixing state appears.

## Starting a Page

Create page opens `/page-builder/new` with an unsaved browser-memory draft:

- no Page ID;
- no Tokyo object;
- no generator call;
- no publication state;
- base source initialized from 127A's accepted blank ordinary Page shape.

Leaving with changes uses the existing Dieter unsaved-changes dialog. Discard
removes only browser memory. Save is the first operation that creates a Page.

When the customer clicks first Save, Page Builder mints a compact Page ID in
the browser with the shared `createCompactPageId()` contract, runs Web Code
Generator with that ID, and submits the complete create payload. Roma no longer
mints a different ID inside the create route. If generation fails, Tokyo is not
called. If Save fails, the browser keeps the unsaved draft, nothing is reported
as saved, and the customer receives the normal retry message. 127E adds no
partial-root lifecycle, cleanup state, or recovery workflow.

## Page Builder structure

### TopDrawer

Reuse Bob's top editor bar/layout. It contains the Page's current identity and
status plus this exact action hierarchy:

- editable Page name (`displayName`);
- Current or Needs update status for an ordinary Page;
- **Save** or **Update page** as the contextual primary action;
- **Publish** as the secondary action for a saved Current unpublished Page;
- **Open public page** as the secondary action for a saved Current published
  Page;
- **More** for a published Page contains **Copy URL**, **Copy code**, and
  **Unpublish**;
- **More** for an unpublished saved Page contains **Delete**;
- an unsaved Page exposes only **Save**;
- a Page that Needs update exposes **Update page** through the accepted 127D
  gate before normal Page Builder actions appear.

Delete never appears for a published Page. Copy URL and Copy code never appear
for an unpublished Page. The actions use 127C's existing direct Page URL,
shared public-code dialog, publication operations, and Dieter button/popover
patterns; 127E adds no second public-action contract.

127F later adds its accepted Template badge and Save-as-template actions to
this same TopDrawer. They are not 127E work.

Do not add two generic bars above the editor or duplicate Roma domain chrome.

### ToolDrawer

The first Page Builder ToolDrawer has two Page-specific panels. Page name
belongs in TopDrawer and is not duplicated in a one-field panel.

1. **Content**
   - compact ordered placement rows showing Instance name and Widget type;
   - synchronized placement selection with Workspace;
   - Add widget through the Your-widgets selection Popup;
   - Manage order through the Dieter Object Manager interaction;
   - Edit in slide-in Bob;
   - show an unavailable placement with **Remove from page** only when its
     saved Instance is missing; authentication, network, or invalid-data
     failures block Page load and are never presented as a missing Instance.

2. **SEO/GEO/AEO**
   - required Page title through Dieter Textfield;
   - optional meta description through Dieter Textarea;
   - optional social-title override through Dieter Textfield;
   - optional social-description override through Dieter Textarea;
   - optional social image through Dieter Dropdown Upload, restricted to
     images and using the existing account-assets operation;
   - search visibility with **Index this page** and **Hide this page**;
   - active metadata locale selector;
   - Generate translations through the existing Translation Agent operation.

   Every ordinary Page receives Page SEO/GEO/AEO output. There is no Page SEO
   toggle because Pages already require Tier 2-or-higher access.

127F later reuses these two panels for Page templates and applies the accepted
template restrictions. 127E adds no template branches or controls.

Do not expose Widget content, appearance, typography, or behavior controls in
Page Builder; those belong to Bob.

## SEO/GEO/AEO interaction

SEO/GEO/AEO contains two ordinary ToolDrawer sections:

1. **SEO** — Page title, meta description, and search visibility;
2. **Sharing** — social title, social description, and social image.

The panel header contains the active metadata locale selector and **Generate
translations**. Base is the default view and shows the Page source values. For
a saved ordinary Page, the selector also shows the exact locales currently
selected in account Settings; selecting one displays that locale's translated
Page title, meta description, social-title override, and social-description
override in the same SEO and Sharing controls. There is no separate Languages,
Translations, or Meta panel and no second set of metadata fields.

An unsaved ordinary Page shows only Base. Generate translations and the locale
options are hidden until the Page has been saved and has a `pageId` and Tokyo
overlay root.

The Page title is the only required public field. It starts empty and Page Save
requires the customer to provide it. Do not copy the internal Page name or
infer a title or description from arbitrary Widget content. Meta description,
both social overrides, and social image are optional.

Page metadata has no hard character limit. Search engines decide how much of a
title or description to display from the available rendered width and may use
different visible Page text for a query. Page Builder therefore:

- shows a neutral live character count for Page title, meta description,
  social title, and social description;
- gives concise helper text that search engines may truncate or rewrite the
  displayed result;
- does not set `maxlength`, reject Save, show an error, or change validity when
  a count crosses an advisory length;
- validates only that Page title is not empty.

The count and helper text use existing Dieter field presentation. They do not
introduce an SEO scorer, warning service, preview simulator, or another input
component.

Page Builder exposes no structured-data field or schema editor. Web Code
Generator automatically writes the localized `WebPage` JSON-LD and any
supported visible FAQ contribution defined by 127B from the saved Page and
Instance fields.

An empty social title displays **Uses Page title when empty**. An empty social
description displays **Uses Meta description when empty**. These are visible
effective-value rules, not copied values in the browser draft or saved Page
source. The effective values are locale-specific: an ordinary Page locale uses
that locale's Page title and description unless that locale has corresponding
social overrides.

Search visibility defaults to **Index this page** (`index-follow`). The only
other choice is **Hide this page** (`noindex-follow`). Use the existing Dieter
Dropdown Actions control with those customer labels. Do not expose a third
`noindex-nofollow` option or raw robots syntax.

Use existing Dieter controls directly:

- Textfield for Page title and social title;
- the Dieter Textarea defined below for meta description and social
  description;
- Dropdown Upload for the social image, accepting images only and retaining
  the normal upload, preview, replace, remove, account-asset, and Upgrade
  behavior;
- Dropdown Actions for search visibility.

There is no panel-level Save, metadata generator, SEO score, keyword tool,
social-preview simulator, or Page-specific form system. Every edit changes the
browser Page draft, and Page Save remains the only persistence action.

## Dieter Textarea

127E adds one small reusable Dieter `Textarea` component because Dieter has no
plain multiline field and its rich-text Textedit/Dropdown Edit controls are
wrong for metadata. It is a composition of existing Textfield presentation and
Popover behavior, not another editor:

- closed state shows a compact Textfield-style label and one-line truncated
  value, or its placeholder when empty;
- activating the field opens an attached Dieter Popover containing a plain
  native `<textarea>` using existing Textfield typography, focus, color,
  border, radius, and size tokens;
- opening focuses the textarea;
- typing updates the bound browser value and the collapsed preview
  immediately;
- outside click or Escape closes it through the existing Popover lifecycle;
- closing neither persists nor discards the current browser value;
- the React binding supports label, value, placeholder, disabled, and size;
- the value is plain text: no HTML, formatting palette, links, rich-text
  parsing, Apply button, internal Save, or component-owned remote operation.

The component contract, CSS, and framework-neutral hydrator live under
`dieter/components/textarea/`. Roma's thin React binding renders that exact
Dieter markup and classes because Dieter deliberately has no React/Next
dependency. The image-upload binding follows the same rule and uses the
existing Dieter Dropdown Upload contract. Neither binding creates a second
visual component or duplicate CSS contract.

### Workspace

The Workspace uses all available editor space and previews the complete Page
composition.

When Bob slides in, Workspace and the Page draft remain mounted behind it. Bob
does not replace Page Builder's route or browser state. After a successful Bob
Save, closing Bob refreshes only that placement from the saved Instance while
preserving every Page-owned draft edit.

Each placement has one editor-only wrapper keyed by its saved Instance ID.
Selecting a Content row selects and reveals that wrapper in Workspace;
selecting a Workspace placement selects and reveals its Content row. The
selected treatment belongs only to Page Builder and uses existing Dieter
color, typography, and spacing. It is not written into Page source, Widget
files, generated Page files, or public output.

- For an unsaved or dirty draft, the editor canvas reads each referenced saved
  Instance's exact files through the existing authenticated account authority
  and mounts those files one-for-one in open Shadow DOM, in Page order. It does
  not call `generatePage`, consolidate/deduplicate code, create Page files,
  apply a public locale, or claim byte equality with public output.
- For a saved Current Page, it previews the exact saved Page files.
- When the customer chooses Save or Update, the newly generated Page files
  replace the draft composition preview in Workspace before submission. Those
  exact generated bytes are the bytes sent through Roma and stored by Tokyo.
- It never stacks public `clk.live` Widget URLs.
- It never creates a second locale renderer or constructs primary content from
  state in visitor-style JavaScript.
- Final Page files are generated only when the customer chooses Save or Update.

This editor canvas is the Page equivalent of arranging saved building blocks;
it is not a second Page renderer or serving path. `generatePage` remains the
only operation that creates Page HTML/CSS/JavaScript, and it has only explicit
Save/Update input coordinates as defined by 127B.

Responsive/device controls reuse Bob/Dieter controls where they apply.

## Content placement rows

The normal Content view is a compact list rather than a Table because it lives
inside ToolDrawer. Every available row contains:

- Instance name in `body-s`;
- Widget type in `body-xs` using secondary text;
- an `sm` `line2` Dieter text button labeled **Edit**;
- row selection that synchronizes with Workspace.

The list order is the Page order, so it does not add position badges, Instance
IDs, publication toggles, storage coordinates, or other Your-widgets facts.
An unavailable saved reference remains in place, names the unavailable Widget,
and exposes **Remove from page**.

The selected row uses `aria-current` and one small Page-owned selected-row rule
composed from existing Dieter tokens. Do not add a selected-role token or a
generic selectable-list component.

## Adding Instances

Content's **Add widget** action opens a large Dieter Popup containing a custom
selection version of the existing **Your widgets** inventory. It reuses the
same current-account Instance response, published-status filter, sorting,
Dieter Table patterns, loading, empty, filtered-empty, and error states. It is
not a second inventory or a small selector. The current Your widgets inventory
does not have search, so the Popup does not add its own search control. If
search is added later, it must be added to the shared inventory behavior and
consumed by both surfaces.

Inside the Popup, management actions are replaced with **Add to page**. Only
saved ordinary Instances from the current account are eligible. Templates,
cross-account objects, and public Widget URLs are not eligible. An Instance
already placed on the Page remains visible with **On page** instead of another
Add action. Choosing **Add to page** adds that Instance reference to the
browser Page draft, closes the Popup, selects the new placement, and reveals it
in Workspace.

Adding/removing/reordering changes only the browser Page draft until Save.
Workspace updates immediately. Removing a placement never deletes or changes
the saved Instance. Duplicate use of the same Instance is rejected in the first
release.

When the Page has no placements, Content says **This page has no widgets yet**
and shows a primary **Add widget** action. Workspace says **Add a widget to
start your page** and opens the same Popup. These are two entry points to one
operation, not two implementations.

## Managing placement order

Page placements are top-level Page objects, so ordering follows the Dieter
Object Manager pattern already used by Bob for top-level Widget collections.
**Manage order** appears when the Page has more than one placement and opens a
medium Dieter Popup. Each row shows the Instance name and existing `sm`,
neutral Dieter icon buttons for move up, move down, and remove. The Popup uses
the existing Object Manager Cancel, Save, Keep editing, and Discard behavior.

Object Manager Save applies the working order/removals to the browser Page
draft and closes the Popup. It never invokes Web Code Generator, Roma, or
Tokyo; only Page Save or Update persists the resulting Page draft.

Do not use Repeater as a Page data adapter. Bob's Repeater is for nested inline
items and its Add operation creates a new default item; Page Builder selects an
existing saved Instance instead. Do not add custom drag-and-drop behavior or a
new Page collection component.

## Editing an Instance in Bob

**Edit in Bob** slides the existing Bob editor over Page Builder. It is
available for any saved Instance already in the Content list, including while
the Page itself is unsaved or dirty, because Page Builder stays mounted and no
Page navigation occurs. Bob continues to edit and save only that Instance
through its normal authority.

Bob adds one Page-context host action: **Done, go back to the page**. If Bob has
unsaved Widget changes, Bob's existing Save/Discard/Keep editing interaction
applies before it closes. Done slides Bob out and restores the exact retained
Page draft and Workspace context; it does not use a route, `returnTo`
coordinate, Page reload, remote draft, or Page-before-Bob Save gate.

The Page-hosted Bob TopDrawer shows one non-blocking contextual sentence:
**You're editing the saved widget. Other pages using it will also need
updating.** It does not show a warning dialog and does not imply that the edit
is local to this Page.

After a successful Bob Save, 127D marks any saved Page that references the
Instance `needsUpdate: true`. Page Builder refreshes the edited placement from
the saved Instance. Opening, closing, or canceling Bob does not change the flag
and never regenerates the Page. An unsaved Page has no stored Page flag; its
first Save simply uses the latest saved Instance.

## SEO/GEO/AEO translation UX

Generate translations in SEO/GEO/AEO uses the same localization operation as
Instance translations:

```text
base Page title/metadata
→ customer has already saved the ordinary Page
→ operation reads the locales currently selected in account Settings
→ Translation Agent writes each exact Page overlay to
  pages/{pageId}/overlays/locales/{locale}.json
→ customer reviews/edits them
→ explicit Page Save assembles them into generated overlays.json
```

Generate translations is hidden for an unsaved draft. It appears only for a
saved ordinary Page because only that Page has a `pageId` and Tokyo overlay
root.

The Translation Agent does not invoke Web Code Generator. Save/Update does not
invoke Translation Agent. A missing exact title, or missing exact value for an
optional metadata field that the customer supplied in the base locale, is
shown as an incomplete locale and blocks Publish rather than silently using
another locale. Page-owned overlay writes do not set `needsUpdate`; the
customer's explicit Save applies those Page edits. First Save is never blocked
by missing translations: the Page must exist before Generate translations can
run.

Generate translations reports the exact locales that failed while keeping each
successful overlay written by the existing Translation Agent. When at least one
locale succeeds, Page Builder reloads the saved overlays and marks the browser
draft dirty so the customer can review and Save the generated Page files. It
does not hide a partial result behind a generic success or failure message.
When Settings contains no non-base locale, the operation reports **No
translation languages are available for this page.** It does not claim that
translations were generated and does not make the Page draft dirty.

Country is not a Page Builder variant. Regional locales such as `en-US`,
`en-GB`, `it-IT`, and `zh-CN` are the customer-selected exact versions. 127C
uses country only as a hint to select among them.

## Save, Update, Publish, and errors

### Save

```text
customer chooses Save
→ validate browser Page draft
→ mint the compact Page ID in browser on first Save only
→ run Web Code Generator in Page Builder
→ show the exact generated result in Workspace
→ submit source + direct files + generated overlays.json
  through Roma
→ Roma applies the normal account, role, tier, entitlement, and Save checks
→ Tokyo stores the complete result
→ success marks clean and Current
```

First Save creates the Page identity. A failed first Save creates nothing that
is reported as saved. Later failed Saves show:

> We couldn't save this page. Try again.

There is no persistent Needs fixing state.

### Update page

Opening a Needs update Page shows the 127D modal before normal editing. Update
explicitly runs the same Page generator against current saved Instances and
stores the complete result. If Bob Save sets Needs update while Page Builder is
already mounted, the retained Page draft remains visible and Update becomes
the required next persistence action. Success leaves or opens Page Builder as
Current. Failure remains Needs update and shows:

> We couldn't update this page. Try again.

### Publish

Publish is available only for ordinary saved Current Pages with complete
required locales and tier access. It invokes 127C Publish only. It never runs
generation or translation. When required saved locale output is missing, Roma
names those exact locales in the existing Page Builder error message.

### Unpublish and delete

Unpublish retains the Page and stops public serving. Delete requires unpublish,
confirmation, and removes only the Page—not referenced Instances or assets.

## State ownership

- React/browser state owns unsaved Page draft and dirty state.
- 127A source owns saved Page fields and placements.
- 127B owns deterministic generated files.
- 127C/Tokyo owns stored files and publication.
- 127D owns the stored `needsUpdate` boolean and Current/Needs update UI
  meaning.
- Existing localization authority owns Page overlays and Translation Agent
  commands.
- Dieter owns UI primitives and styling.

No UI state becomes a second persisted Page truth.

## Code work

- [x] Replace `roma/components/pages-domain.tsx` with a thin Pages wrapper plus
      named Your-pages and Page-Builder components; delete its inline legacy
      editor, account-country-rule editor, publication/embed helpers, and form
      orchestration.
- [x] Make `use-roma-pages.ts` import 127A Page contracts and retain only Page
      loading/cache transport; delete its local Page-source contract.
- [x] Reuse/extract the proven product-neutral Bob builder shell components.
- [x] Build Page-specific TopDrawer/ToolDrawer/Workspace composition using
      Dieter; add no duplicate primitive or CSS system.
- [x] Implement Your pages with accepted Dieter table/filter/action patterns.
- [x] Implement `/page-builder/new` as browser-only draft and existing unsaved dialog.
- [x] Keep editable Page name in TopDrawer and implement only Content and
      SEO/GEO/AEO panels from 127A fields.
- [x] Add the small Dieter Textarea composition and use it for Page meta and
      social descriptions; add no Page-specific textarea or rich-text editor.
- [x] Implement SEO/GEO/AEO with the fixed required/optional fields, social
      fallback copy, image-only Dropdown Upload, the two search-visibility
      choices, the active metadata locale selector, and the existing Generate
      translations operation; show neutral live character counts without
      setting a validation threshold; add no separate
      Languages/Translations/Meta panel, schema editor, panel Save, or
      metadata-generation operation.
- [x] Implement **Add widget** as a large Dieter Popup reusing the Your widgets
      inventory response, current filter/sort/Table/states, and **Add to page**
      row actions; add no Popup-only search.
- [x] Implement compact Content placement rows and two-way Content/Workspace
      selection using browser-only state.
- [x] Implement **Manage order** through the Dieter Object Manager Popup
      interaction with move up/down/remove and local Cancel/Save/discard
      behavior; add no drag system or Repeater adapter.
- [x] Implement same-account Instance placement removal and slide the existing
      Bob editor over the still-mounted Page Builder.
- [x] Add only the Bob host action **Done, go back to the page**; add no Bob
      return route, `returnTo` coordinate, remote Page draft, or duplicate
      Widget editor.
- [x] Implement Translation Agent commands/status through existing authority.
- [x] Mint the compact Page ID in browser memory on first Save and make Roma
      validate, not replace, that submitted ID.
- [x] Invoke 127B only on Save/Update and submit exact result through Roma.
- [x] Implement 127D update gate and Current/Needs update UI only.
- [x] Implement 127C Publish/Unpublish/Delete controls.
- [x] Reuse one Widget/Page public-action dialog for Copy URL and Copy code,
      emitting 127C's `clickeen.js` contract and no iframe/runtime-only option.
- [x] Delete obsolete Roma Pages UI, temporary cards, Needs fixing UI, and
      duplicate builder styles/components, including the iframe helper.

## Verification

Prove:

- Page Builder visibly reuses Bob/Dieter shell and components without changing
  Bob behavior;
- `pages-domain.tsx` is a thin wrapper and no longer owns Page loading, list,
  editor sections, localization rules, publication, or embed-code generation;
- `/page-builder/new` writes nothing before Save;
- unsaved-leave dialog uses existing Dieter interaction;
- Page fields map exactly to 127A source;
- SEO/GEO/AEO requires only Page title, keeps optional values empty when the
  customer leaves them empty, and shows the social fallback rules without
  copying fallback values into Page source;
- metadata fields show neutral live character counts but have no hard or
  advisory validation threshold; only an empty Page title blocks Save;
- Base and exact-locale metadata use the same SEO and Sharing controls, while
  search visibility and social image remain shared;
- Generate translations and locale selection appear only for a saved ordinary
  Page and use account Settings plus the existing Translation Agent operation;
- no Languages, Translations, or Meta panel or duplicate metadata form exists;
- Dieter Textarea uses Textfield/Popover contracts, edits plain text in browser
  state, and introduces no Page-only control, rich-text behavior, or remote
  operation;
- search visibility defaults to Index this page and exposes exactly the two
  accepted customer choices;
- Translation Agent writes exact Page overlays and never runs generator;
- draft composition runs no final Page generation;
- dirty draft composition preview does not claim byte equality;
- the exact generated Workspace result shown on Save/Update equals the
  submitted/stored files;
- Add widget reuses Your widgets facts, filters, sorting, table patterns, and
  states without a second inventory;
- the Add-widget Popup has no Popup-only search, shows an already-placed
  Instance as **On page**, and returns with the new placement selected;
- Content rows and Workspace placements select and reveal each other without
  mutating Page source or generated/public files;
- empty Content and Workspace actions open the same Add-widget operation;
- Manage order matches Dieter Object Manager behavior, applies only to the
  browser Page draft, and introduces no drag system, Repeater adapter, or new
  generic collection component;
- slide-in Bob preserves an unsaved or dirty browser Page draft and returns to
  its exact Page Builder context through **Done, go back to the page**;
- Bob Save—not slide open/close—sets Needs update for a saved referencing Page,
  refreshes that placement, and never regenerates the Page automatically;
- Bob's existing unsaved Widget interaction runs before the slide-in editor can
  close;
- Publish never generates;
- published Widget and Page dialogs use the same `clickeen.js` snippet shape;
- Page Copy code contains the Page public URL, while Copy URL returns the
  complete direct `clk.live` document URL;
- TopDrawer exposes exactly the accepted Save/Update primary action, contextual
  Publish or Open-public secondary action, and published/unpublished More
  actions without an additional action band;
- no iframe, artifact-`runtime.js`, or Page-specific install option remains;
- Upgrade behavior follows existing product law;
- no duplicate UI primitives, editor framework, temporary Catalog, or stale
  `save_failed` code remains.

## Failure behavior

| Failure                                | Required result                                           |
| -------------------------------------- | --------------------------------------------------------- |
| Leave dirty unsaved draft              | Existing unsaved-changes dialog; no remote mutation.      |
| Page/Instance source is invalid        | Show exact product error; do not omit/repair.             |
| Required locale metadata is incomplete | Show incomplete locale; do not substitute.                |
| Save generation/storage fails          | Show normal retry; do not claim saved.                    |
| Update fails                           | Remain Needs update; keep update gate.                    |
| Direct mutation route lacks access     | Existing Upgrade/auth failure; change nothing.            |
| Bob has unsaved Widget changes on Done | Existing Save/Discard/Keep editing interaction.           |
| Referenced Instance is missing          | Keep its position; show unavailable placement explicitly. |
| Referenced Instance cannot be read safely | Block Page load and show Retry; never treat it as missing. |
| Add-widget inventory fails to load      | Keep Page draft; show the existing inventory error/Retry.  |
| Manage-order Popup is dismissed dirty   | Existing Keep editing/Discard interaction; no Page write.  |

## Documentation after deployment

Update current truth in:

- `documentation/architecture/CONTEXT.md` and `Overview.md`;
- `documentation/services/roma.md` and `bob.md`, including the slide-in host
  boundary and **Done, go back to the page** action;
- `documentation/capabilities/localization.md`, `seo-geo.md`, and
  `multitenancy.md`;
- `documentation/engineering/UI/interactions.md` and dialogs/modal ownership
  where the reused interactions are documented;
- Dieter/layout documentation only if a genuinely shared component contract
  changed.

## Definition of done

127E is done when Your pages and the Bob/Dieter-based Page Builder work through
the accepted authorities; Add widget reuses the Your widgets inventory in a
Dieter Popup; Content and Workspace selection stay synchronized; placement
ordering follows the existing Dieter Object Manager interaction; slide-in Bob
preserves Page Builder state and closes through the one accepted host action;
Content and SEO/GEO/AEO editing, locale-specific metadata, translation, and
Instance editing are clear;
Save/Update/Publish remain distinct; Needs update gates correctly; no duplicate
editor, return route, remote draft, drag system, Repeater adapter, temporary
Catalog, template-editing pre-work, or duplicate UI remains; focused and broad
checks pass; current
documentation matches runtime; and an independent V1–V8 audit is GREEN.

## Execution evidence

- Implementation commit: `c44bf50cc24cb1ae1440a0a7758b0539efaaf128`.
- Final correction commit: `ec4592dbfc75c9236749ac15ace2dd41697480e6`.
- GitHub `cloud-dev roma app verify` run `31088896071`: green, including
  Roma Page source, Roma Page Builder, Web Code Generator, Bob, lint,
  typecheck, and both Cloudflare Pages build contracts.
- GitHub `cloud-dev roma app verify` run `31090773807`: green against the final
  correction commit, including Roma Page Builder, Page source, Web Code
  Generator, Bob, lint, typecheck, and both Pages build contracts.
- Cloudflare Pages production: `roma-dev` and `bob-dev` both report the exact
  implementation commit with deploy status `success`.
- Authenticated `CLICKEEN` runtime proof: opening `/page-builder/new` wrote no
  Page; Add widget opened the shared inventory Popup; Save created a visible
  inventory row; Delete removed it; the account returned to zero Pages.
- Authenticated placement proof: the Page Workspace mounted the selected
  Widget through direct open Shadow DOM; slide-in Bob preserved the Page route;
  **Done, go back to the page** restored the mounted Page draft; the saved test
  Page and its placement were then deleted and the account again returned to
  zero Pages.
- Authenticated final-correction proof: `/page-builder/new` wrote no remote
  Page before Save; Save produced `Current`; a partial Translation Agent result
  named failed locale `de-DE`; Publish named all missing exact locales and
  changed no public state; the temporary Page `UESJ19E044` was deleted through
  the Page Builder confirmation flow.
- Cloudflare Pages production: `roma-dev` and `bob-dev` both report exact final
  correction commit `ec4592dbfc75c9236749ac15ace2dd41697480e6` with deploy
  status `success`.

The slice remains blocked from final completion until the required Staff
Engineer, Senior PM, and Principal TPM execution reviews are all green.
