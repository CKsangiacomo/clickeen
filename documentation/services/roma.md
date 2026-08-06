# Roma - Account App

STATUS: CURRENT SYSTEM OPERATOR SPEC

Roma is the authenticated product app. It routes the user to the current
account, enforces what that account can do, and saves account-owned work through
Tokyo.

For platform context see:

- `documentation/architecture/CONTEXT.md`
- `documentation/architecture/AccountManagement.md`
- `documentation/architecture/AssetManagement.md`
- `documentation/engineering/CloudflareOperations.md`

## Product Role

Roma owns the current-account product shell:

- account bootstrap
- domain navigation
- account policy and tier enforcement
- account widget instance commands
- account page commands
- account asset commands
- Builder host flow
- team, billing, usage, AI, profile, and settings surfaces

Bob is the editor. Tokyo-worker is the R2 boundary. Berlin owns auth and account
identity. San Francisco owns AI execution.

## Workspace Capability

Roma follows the global operational-workspace tenet in
`documentation/engineering/UI/surfaces.md`: full desktop workspace on desktop
and tablets in either orientation, with the same compact navigation/workspace
on narrow mobile landscape and portrait. Retina/4K density governs sharpness,
not layout class. Roma directly consumes Dieter's
`main-container > left-nav + page` source. The shared Page provides
`page__header`, `page__actions`, and `page__content`; Roma owns the navigation
tree, page content, domain composition, commands, and drawer state. The same
navigation DOM owns Full and Compact modes, with Escape/scrim close and focus
return in Compact mode. At least `600px` of usable width and height is Full; a
smaller dimension is Compact. Full presents the navigation as an 8px-inset
foreground panel; Compact presents that same panel as an 8px-inset overlay over
the full-width page. The shared Full panel is `16rem` wide, borderless, and uses the
shared surface, `3xl` radius, and Dieter elevation. Page headers and domain
content align to the same centered `80rem` maximum width. Domain screens are
not replaced by mobile variants. Roma uses the Dieter Page rhythm directly.
Its navigation rows use `--control-size-lg`. Primary modules use `--space-3`
block padding and `--space-2` internal gaps, while secondary cards use
`--space-2` block padding and `--space-2` internal gaps. Inline padding
remains roomier. These are direct uses of the
existing structural spacing scale, not a second density system.

The active `/builder/:instanceId` route is the explicit editor exception. Its
`page` omits the Roma Page header and gives its padding-free, unconstrained
body entirely to Bob. Bob's own TopDrawer supplies editor context and actions;
Roma does not add another title or action band above the iframe. The `/builder`
landing route remains an ordinary Roma page because no editor is open there.

Roma's single-line text controls use Dieter Textfield, choice controls use
Dropdown Actions, multiline content uses Textedit, and semantic table
definitions use Dieter Table. Roma retains their values, labels, validation,
data, actions, and layout.
Page-header filters compose Dieter's icon-text Button, Popover, and Menu
Actions primitives; they sit directly beside the page title, show the current
filter in the trigger without a redundant chevron, and omit the field-style
popover heading. The opposite header edge is reserved for page actions. Roma
owns the selected filter and row filtering.
Tables preserve every column and own horizontal overflow through the Dieter
wrapper. Checkboxes, hidden file inputs, modules, toolbars, and specialized
composition remain locally owned. Primary Roma modules use the shared surface,
radius, spacing, and floating elevation; secondary cards use the existing
muted surface without rebuilding another card system.

Roma operational text selects only the complete Dieter visual typography
classes revealed by DevStudio. It does not assemble local typography from font
family, size, weight, line-height, or tracking declarations. Semantic Table
column headers use `label-s`; every body header/data cell uses `body-s`; action
controls retain their Dieter component typography.

## Accepted Dialog And Upsell Law

Under accepted 126 law, Roma's blocking dialogs consume Dieter Popup and follow
the dismissal matrix in `documentation/engineering/UI/dialogs-and-modals.md`.
Add Instances discards its temporary selection on Escape/Cancel and never
closes by backdrop. Bulk Upload
cannot dismiss while work is active. The tier-drop notice resolves only through
Open settings or persisted Dismiss. A plan-limit prompt may close through
Escape, backdrop, or its explicit Close action because no work is lost. Unsaved
Builder/defaults confirmation treats Escape as Keep editing and requires
explicit Discard. Native `beforeunload` remains only at the browser boundary;
in-app navigation uses the Roma unsaved-changes dialog.

Legitimate Upgrade controls remain during pre-GA upsell development. Roma owns
one small reusable account upsell scaffold: Roma-native Upgrade actions open it,
and Bob's typed `bob:upsell` intent opens the same component. Roma does not route
Upgrade to inactive Billing or add a global upsell store/framework. The scaffold
performs no purchase, plan mutation, provider call, fake success, or invented
contact operation. When the intent starts in a plan-limit prompt, Roma replaces
that prompt instead of stacking dialogs. Ordinary Billing navigation remains
valid for inspecting the current plan.

The Builder discard guard remains on
real navigation only. Final 126M integration re-verified this behavior through
the deployed Bob-to-Roma intent path.

**Everything is visible to every tier; access is controlled by tier.** This is
the normative rule for new or changed Roma surfaces, not a claim that every
legacy surface has been audited. Roma keeps domains, retained account objects,
and tier-gated actions visible. An
attempted action that the current tier does not allow makes no product change
and opens the standard Upgrade dialog. This law does not grant cross-account
visibility or bypass role authorization. The complete interaction contract is
owned by `documentation/engineering/UI/interactions.md`.

## Runtime Routes

Roma account-shell routes include:

- `/home`
- `/profile`
- `/widgets`
- `/widgets/catalog`
- `/widgets/:instanceId`
- `/builder`
- `/builder/:instanceId`
- `/pages`
- `/page-builder/new`
- `/page-builder/:pageId`
- `/assets`
- `/team`
- `/billing`
- `/usage`
- `/ai`
- `/settings`

`/home` currently preserves the Roma shell and navigation but renders no
domain-specific header, actions, placeholders, or page content.

The Widgets routes own account widget lifecycle actions.
`/builder/:instanceId` opens one widget instance in Bob for editing.

## Auth And Account Bootstrap

Roma bootstraps account context from:

```text
GET /api/bootstrap
```

That route proxies to Berlin session bootstrap with the user bearer token and
returns:

- user identity
- current account
- account role
- account public id
- signed account authz capsule
- account entitlement snapshot

Roma uses the Berlin-issued current account as the product account context.
Browser code uses same-origin Roma APIs. Shared httpOnly cookies carry session
truth across Roma and Bob on the custom `*.clickeen.com` domain.

The authenticated layout keeps one bootstrap provider mounted across Roma
route transitions. The shared `main-container`, `left-nav`, and page frame render
immediately; only `page__content` waits for the first complete, internally
consistent account and authz payload. That first wait uses a content skeleton,
not implementation-status copy or a blank replacement screen.

Account mutations explicitly reconcile through the same bootstrap authority.
While that request is pending, Roma retains the already validated page and the
owning control shows its local pending state. A background refresh may retain
the current page only for a transient network or upstream failure and only
until the current authz safety boundary. Missing, malformed, mismatched,
near-expired, expired, auth-required, and forbidden bootstrap results are never
accepted or preserved as usable context.

## Same-Origin API Model

Browser code calls Roma same-origin routes. Roma server routes call the owning
service:

| Roma route family           | Owner behind Roma                                      |
| --------------------------- | ------------------------------------------------------ |
| `/api/session/**`           | Berlin                                                 |
| `/api/me/**`                | Berlin                                                 |
| `/api/account/team/**`      | Berlin                                                 |
| `/api/account/locales`      | Roma account settings mutation; Berlin bootstrap read context |
| `/api/account/widgets/**`   | Tokyo-worker through product control                   |
| `/api/account/instances/**` | Tokyo-worker through product control                   |
| `/api/account/assets/**`    | Tokyo-worker through asset control                     |
| `/api/account/pages/**`     | Tokyo-worker through product control                   |
| `/api/account/usage`        | Tokyo-worker storage facts plus account policy context |
| `/api/account/widget-defaults` | Roma defaults document backed by Tokyo-worker        |
| `/api/builder/:instanceId/open` | Roma Builder-open envelope backed by Tokyo-worker    |
| `/widget-editors/:widgetname.json` | Deploy-built static Bob editor artifact       |
| `/api/account/instances/:instanceId/copilot` | San Francisco through Roma grants       |

Roma attaches the account authz capsule and account public id to private
Tokyo-worker calls.

Current account-governance routes include:

| Roma route | Owner behind Roma |
| --- | --- |
| `DELETE /api/account` | Roma disabled account deletion conflict response |
| `POST /api/account/owner-transfer` | Berlin owner-transfer governance |
| `POST /api/account/lifecycle/tier-drop/dismiss` | Berlin account lifecycle notice dismissal |

## Builder Orchestration

Builder opens one saved widget instance:

1. Resolve the current Roma account and `instanceId`.
2. Load the saved instance source, saved public package, and account font
   library in parallel through `GET /api/builder/:instanceId/open`.
3. Load the deploy-built widget editor artifact.
4. Wait for Bob `bob:session-ready`.
5. Send `ck:open-editor` with deploy-built editor software, saved instance data,
   the exact saved `index.html`, `styles.css`, and `runtime.js` package, account
   font library, policy, account public id, instance id, label, publish state,
   exact public-action values or `null`, and optional return label.
6. Receive `bob:open-editor-applied` or `bob:open-editor-failed`.

`NEXT_PUBLIC_BOB_URL` is required and must be an `http` or `https` origin with
no path, query, or hash. Missing or malformed Bob origin config fails Builder
instead of falling back to another origin.

Bob edits in browser memory and generates the exact browser package for each
valid working state. The saved package in the open envelope establishes the
persisted baseline; Bob does not treat those loaded bytes as the current
savable package. Save becomes available only after Web Code Generator succeeds
for the open working state, then sends that config and exact generated package
to Roma. Roma performs the current-account save command and Tokyo-worker writes
the submitted source plus exact package under:

```text
accounts/{accountPublicId}/instances/{instanceId}/
```

The saved package is persistence/open baseline truth. Bob uses Web Code
Generator for the preview package, including the initial working state and
every later valid change. Roma does not provide a second source-widget preview
package and does not generate browser files.

Create and save accept the exact `index.html`, `styles.css`, and `runtime.js`
that Bob generated for the submitted config. Roma validates the account command
and current save policy, including the Widget `limits.json` mappings, then
submits those exact files with the source to Tokyo-worker. Duplicate remains a
new account operation and does not copy locale authority from the source
instance. Tokyo-worker stores submitted package files; it does not render,
compile, infer, or repair their bytes.

When the existing source-save command changes a saved instance, Roma saves the
source and base package only. It does not generate translations, regenerate
translations, mutate locale overlays, or make the authoring save wait on
localization. Save returns source/root save truth:
`ok: true` when the source/base package was saved, or the exact source-save
failure when it was not. Translation failure is localization failure, not
source-save failure.

Translation generation is a separate explicit operation from the Translations
panel. Roma resolves the current account active locales for that command,
applies the current tier limit, loads the saved instance source from
Tokyo-worker, mints a Translation Agent grant, and calls the Translation Agent
Worker. Translation Agent calls San Francisco `/model/chat` and writes overlays
via Tokyo-worker. Translation Agent returns one ordered terminal result for
every requested locale. Roma validates that complete result set and returns
`requestedLocales`, `translatedLocales`, and exact `failedLocales`; a valid
partial result remains an HTTP `200` product result. The command ends after
those exact overlay outcomes; it does not create, publish, or cache runtime
files.
`PUT /api/account/instances/{instanceId}/translations/{locale}` is the exact
editor-authorized overlay-value mutation boundary. It accepts one complete
saved-field value map and delegates it to Tokyo-worker; Tokyo rejects base-locale
overlays, missing paths, and extra paths. It does not generate or rebuild
runtime files.
When the command is invoked through hosted Bob, Translation Agent may stream
Agent Activity while it operates. Roma forwards that activity to Bob; Roma does
not author it, summarize it, poll for it, persist it, or convert it into product
status.

Account language settings choose which languages are available to widgets. Roma
writes that account configuration to Supabase. Adding a language does not call
the Translation Agent or regenerate any Widget package; each widget remains missing
that translation until its Translations panel explicitly generates it.

Removing a language deletes its exact overlay from saved account instances
through Tokyo-worker. If deletion fails after the settings write, Roma returns
the saved settings with `localeCleanup.ok: false` and the exact failed
coordinate. The account setting remains the user decision and account truth.

Roma owns one product-neutral public-action contract for Widgets and
Pages. It builds the direct public URL and shared `clickeen.js` installer
snippet from the current account public id, the exact Widget Instance or Page
id, and the configured public-serving origin. Widget Builder availability also
uses the publish status returned by the Builder-open envelope.
It sends that exact complete set to Bob, where TopDrawer presents Open public
widget and one Copy code intent under More. Roma answers that intent with the
same Dieter Popup used by the Widgets inventory; the Popup presents the exact
public URL and `clickeen.js` installer and owns browser copy. Bob does not
reconstruct or copy those values. Unpublished instances receive
`publicActions: null` and expose no public action. Bob's `bob:host-action`
message carries only
`open-navigation`, `return`, `copy-code`, `use-template`, or
`save-as-template` intent; Roma retains navigation,
public-action, and unsaved-work authority.
The copied public URL is slashless:

```text
{public-serving-origin}/{accountPublicId}/{instanceId}
{public-serving-origin}/{accountPublicId}/pages/{pageId}
```

The copied installer uses the same configured public-serving origin and exact
public URL:

```html
<script
  src="{public-serving-origin}/clickeen.js"
  data-clickeen="{public-serving-origin}/{accountPublicId}/{instanceId}"
  defer
></script>
```

There is no public iframe option, product-specific installer, or installer that
loads a product's `runtime.js` directly. The direct public URL remains
available independently of the installer.

Web Code Generator writes public-coordinate placeholders for the support files
inside the exact generated `index.html`:

```text
/__CK_PUBLIC_ACCOUNT_ID__/__CK_PUBLIC_INSTANCE_ID__/styles.css
/__CK_PUBLIC_ACCOUNT_ID__/__CK_PUBLIC_INSTANCE_ID__/runtime.js
```

Tokyo completes those placeholders from the validated public route. The
resulting absolute paths resolve correctly from Roma's slashless public URL.

## Widgets Domain

Roma's Widgets navigation group has three routes, not local page tabs:

- **Your widgets** at `/widgets` lists ordinary current-account Instances;
- **My templates** at `/widgets/templates` lists current-account Instances with
  `isTemplate: true`; and
- **Widget catalog** at `/widgets/catalog` lists `CLICKEEN`-owned Widget
  templates through the fixed-owner Catalog read.

**Your widgets** is the default account-instance inventory. It uses one
semantic Dieter Table whose columns are Widget, Instance name, Published,
Instance ID, and Actions. Published uses a left-aligned Dieter Toggle and, only
for a published instance, a small Copy code action that opens Roma's shared
public-code Popup. Edit is the direct row action; Save as template, Rename,
Duplicate, and Delete remain in one ellipsis menu when each action is valid.
The header status filter and the Widget, Instance
name, and Published sorts run over the validated account list in the browser.
Their headers use the shared `xs` Dieter sort control: the active
sort is black and inactive sorts are gray.

**My templates** reuses the Dieter table. A row carries a Template badge and
Edit, with Use template, Rename, and Delete in its ellipsis menu. It has no
publish, locale, translation, public URL, or Copy code controls. **Widget
catalog** is a read-only card view of `CLICKEEN` Widget templates, ordered and
described by each template's `catalogPresentation`. Its left category menu and
search filter only the loaded response. **Use template** opens an ID-less Bob
draft; no Instance exists before Save. Widget software definitions remain the
Widget type/editor authority but are not Catalog items.

Changing routes does not change the account command or storage authority.
Publication remains a controlled command: the toggle changes only after the
existing Roma command succeeds and the authoritative instance list refreshes.

It owns:

- list
- create
- duplicate
- rename
- publish
- unpublish
- delete

`GET /api/account/widgets` returns only ordinary saved Instance rows. Each row
contains its Widget label resolved from the current Widget definition:

```text
{ accountId, instances[] }
```

`GET /api/account/widget-templates` returns current-account Widget templates;
when a template has Catalog presentation, the exact saved presentation is part
of that row.
`GET /api/account/widget-catalog` and its exact-id read return only
`CLICKEEN`-owned Widget templates. The Catalog routes accept no owner coordinate
and have no write method.

The Widgets list payload does not carry Create, Duplicate, or Publish
availability booleans. Tier limits do not hide catalog items and do not disable
monetization controls in the list. Create, Duplicate, and Publish remain
clickable user-intent actions.
Role and instance-state rendering stay separate from tier monetization: Roma
client code derives read-only versus mutable controls from the current account
role and the instance publish state, while tier upgrade decisions happen only in
command routes.

Roma loads Widget definitions only to label ordinary rows and validate Widget
commands, and loads saved Instance rows through the account
instance coordinate/list-facts helpers. Tokyo-worker
returns stored `displayName` as string or `null`; Roma applies the UI fallback
label for product rendering.

Create and duplicate enforce `widgets.instances.max` at command time before
minting a new instance id or calling Tokyo-worker create/write routes. Publish enforces
`instances.published.max` at command time from Roma-computed list-facts rows.
Over-tier Create, Duplicate, and Publish return HTTP 402 `UPGRADE_REQUIRED`.
Missing or malformed policy limits return a Roma policy contract failure, not
unlimited usage and not a disabled list-time control.

Create and duplicate mint the new instance id in Roma only after the command
gate passes. Publish and unpublish are account
product actions; Roma sends the exact product transition to Tokyo-worker for R2
`serve-state.json` mutation.

`POST /api/account/instances/{instanceId}/save-as-template` is the Widget
snapshot command. A customer editor supplies only a distinct template name.
For the exact `CLICKEEN` account, DevStudio supplies the distinct name plus the
four required Catalog presentation values in that same request. Roma opens
the ordinary saved source, checks `widgets.instances.max`, reads its exact saved
three-file package, then mints a new instance id and creates a template with the
split config/content and file bytes unchanged except for the new content
identity. The command does not save the source, generate files, copy locale or
publication state. Capacity exhaustion returns the same Widget creation policy
gate contract used by ordinary instance creation.

`PATCH /api/account/instances/{instanceId}` is the narrow presentation-only
operation for a `CLICKEEN` Widget template. It preserves the template source
and three files and changes only `catalogPresentation`. Other accounts and
ordinary Instances are rejected. DevStudio reaches it through its authenticated
Roma proxy; customer Catalog routes remain read-only.

Templates count under `widgets.instances.max`. Roma hides Save as template when
the current role or visible capacity makes it invalid; the command rechecks the
same normal limit. Catalog Use remains visible at a tier limit and sends that
attempt to the existing Upgrade interaction without creating an Instance.
Catalog thumbnails are exact `CLICKEEN` public asset paths served by Tokyo. If
reusable source contains CLICKEEN assets, the explicit Copy/Discard dialog
completes before the unsaved Bob draft opens.

## Assets Domain

Roma `/assets` is the account asset library surface.

It owns:

- list account assets
- upload account assets
- resolve account asset references
- delete exact account asset references
- copy selected `CLICKEEN` Catalog assets into the current account
- show storage usage facts returned from the same account asset authority

The page header owns Upload asset, Upload in bulk, and Refresh list. The
account-dependent commands remain inside the Roma account boundary and report
only their current actions and busy state to that header. The asset table uses
the Dieter table contract; Asset, Type, and Size use the same inline label plus
`xs` Dieter icon-button sorting pattern as the Widgets table. Dieter renders
the active sort control black and inactive sort controls gray.

The active asset route chain is:

```text
Roma current account
  -> accountPublicId
  -> /api/account/assets/**
  -> Tokyo-worker
  -> accounts/{accountPublicId}/assets/{filename}
```

Admin assets use the same path under:

```text
accounts/CLICKEEN/assets/{filename}
```

Roma treats malformed successful Tokyo asset delete responses as upstream
contract failures. A delete is success only when the response names the current
account public id, the exact asset reference, and `deleted: true`.

`POST /api/account/catalog-assets/copy` is an editor command with the exact body
`{ assetRefs: string[] }`. Each value is the account-local asset ref stored in
the Catalog template config, such as `hero.png`. Roma supplies no source or
destination account choice: Tokyo fixes the source to `CLICKEEN` and the
destination is the authenticated current account. Roma forwards the current
upload-size and storage limits to one Tokyo asset-domain operation and accepts
success only when every expected source ref has one valid account-local
destination ref.

Tier policy controls whether the account may upload another asset. Account
management controls retained storage after a downgrade. If current usage is
above the new `storage.bytes.max`, Roma keeps the inventory visible and usable,
shows the authoritative 30-day grace state, accepts ordinary user-authorized
exact deletes, and keeps over-limit Upload as an Upgrade-gated action. Roma does
not run automatic quota cleanup. After the deadline, account management directs
Tokyo-worker to delete the most recently uploaded assets until usage fits the
allowance. This automatic cleanup is accepted product law but is not implemented
in the current runtime.

## Pages Domain

Roma owns authenticated account Page commands. A Page is an ordered collection
of saved Widget Instances. Its direct files live in Tokyo under:

```text
accounts/{accountPublicId}/pages/{pageId}/
  source.json
  serve-state.json
  overlays/locales/{locale}.json
  overlays.json
  index.html
  styles.css
  runtime.js
```

Roma validates current-account access, role, `pages.max`, exact Page source,
and the exact browser-generated file payload. First Save is the only operation
that creates a Page: the browser supplies the complete ordinary Page source,
including its `pageId` and `baseLocale`; Roma checks the limit, validates the
submitted base locale against current Settings without replacing it, then asks
Tokyo-worker to store the source, files, and root serving overlays as
`{ published: false, needsUpdate: false }`. Later
ordinary Save uses the same Page PUT with `operation: "save"`, replaces those
exact values only while the Page is Current, and preserves serving state.
Explicit Update uses that same boundary with `operation: "update"`; after its
browser-generated files store successfully, Tokyo clears `needsUpdate`. A draft
left without Save exists only in browser memory.

Current Page source references saved Widget Instances by placement id and
instance id. It does not embed or copy Instance source. Page templates have no
locales. Roma does not generate or translate Page files. Saving a referenced
Instance or writing its translated locale values marks the Page Needs update.
Ordinary Save and Publish then return the Page update error; Unpublish remains
available and preserves the flag. A published Needs-update Page keeps serving
its last saved files. Delete accepts only an unpublished Page and never deletes
referenced Instances or assets. Roma owns the visible status, Update action,
and Page Builder flow.

`GET /api/account/pages` returns the ordinary Page inventory as
`{ accountId, pages: [{ source, serveState, savedLocales }] }`. `savedLocales`
is the exact saved output-locale set: the source base locale followed by the
locale keys present in root `overlays.json`. Page Builder reads and writes one
metadata overlay through
`GET|PUT /api/account/pages/{pageId}/translations/{locale}`. That authoring
write preserves `needsUpdate` and does not rebuild root output. Rename uses
`POST /api/account/pages/{pageId}/rename`; it changes only
`source.json.displayName`. Publish compares the saved output locales with the
current Settings base and active locales and rejects an incomplete saved
package before requesting Tokyo publication.

`POST /api/account/pages/{pageId}/save-as-template` is the Page snapshot
command. A customer editor supplies only a distinct template name. For the
exact `CLICKEEN` account, DevStudio supplies the distinct name plus the four
required Catalog presentation values in that same request. Roma opens the
ordinary saved Page, checks `pages.max`, then mints a new Page id and creates a
template from its exact values, robots, placements, and three saved files.
Base-locale, overlay, translation, and serving state are absent from the new
template. Capacity denial is a direct command failure and does not open an
unrelated policy path; it uses the same `pages.max` gate contract as ordinary
Page Save.

`PATCH /api/account/pages/{pageId}` is the matching presentation-only operation
for a `CLICKEEN` Page template. It preserves Page source and the three files and
changes only `catalogPresentation`. Other accounts and ordinary Pages are
rejected; the customer Page Catalog has no write method.

The shared Roma public-action contract accepts the Page coordinate and
returns `/ACCOUNT/pages/PAGEID` plus the same `clickeen.js` snippet shape used
for a Widget. Page actions therefore need no Page-specific marketing URL,
iframe helper, or runtime-only install option.

Roma's Pages navigation group has three views on one Edge route: **Your pages**
at `/pages`, **My templates** at `/pages?view=templates`, and the read-only
**Page catalog** at `/pages?view=catalog`. My templates lists current-account
Pages with `isTemplate: true`; its rows show Template, Edit, and an ellipsis
menu for Use, Rename, and Delete, but no serving or locale controls. Page catalog reads only
`CLICKEEN` Page templates, filters their saved presentation values in the
browser, and opens `/page-builder/new?catalog={pageId}` without creating a
Page. The initial Catalog item is one real blank Page template, not a hardcoded
card. `CLICKEEN` templates are read-only in Roma and are managed through
DevStudio.

Roma exposes `/page-builder/new` or `/page-builder/{pageId}` as Page Builder.
A new Page exists only in browser memory until Save. Page Builder
uses the same shared editor shell taxonomy as Bob—TopDrawer, ToolDrawer and
Workspace—but has only two Page-owned panels: Content and SEO/GEO/AEO. Content
shows ordered saved Instance references, reuses the Your-widgets inventory
facts/filter/sort/Table behavior in its Add-widget Popup, and uses the Dieter
Object Manager interaction for ordering. SEO/GEO/AEO edits the Page title,
optional descriptions/sharing fields, search visibility and exact metadata
locale overlays. Generate translations calls the existing Translation Agent
against the locales selected in Settings. Page Builder keeps every successful
overlay, names any failed locales, and waits for explicit Save/Update before it
regenerates Page files. Publish names missing required locales and never runs
translation or generation.

Editing a placement opens the existing Bob editor as a layer while Page
Builder remains mounted. Bob's single Page-host action, **Done, go back to the
page**, closes that layer and returns to the exact browser Page draft. Bob Save
updates the saved Instance. A saved Page that references it then requires
explicit Update; an unsaved Page simply keeps using the newly saved Instance in
its browser draft. Bob does not save or regenerate the Page. Page Save and Update run Web Code Generator in
the browser and submit its exact files. Publish only changes publication state.
All Page blocking Popups use Dieter's existing native-dialog lifecycle; Roma
adds no Page dialog framework or global editor state.

Page templates count under `pages.max`. Save as template appears only while
the account role and visible capacity allow it, and the command enforces the
same normal Page limit. Page Catalog remains visible below Tier 2; attempting
Use opens the existing Upgrade interaction and creates no draft or Page.
Catalog thumbnails are exact `CLICKEEN` asset paths served by Tokyo. The first
blank Page template has no child Instances to copy. A later direct Page-owned
Catalog asset uses the same explicit Copy/Discard dialog as Widget Catalog;
127F does not clone referenced child Instances.

A fresh open of a Page marked Needs update shows the blocking Update dialog.
If Bob Save marks the already-mounted Page Needs update, the current browser
session stays visible and Update becomes its next Page persistence action; the
fresh-entry dialog does not reopen on top of that retained session.

`pages.max = 0` keeps retained Page inventory visible but makes Page detail,
Save, Rename, metadata-overlay write, Publish, Unpublish, and Delete routes
return the standard `UPGRADE_REQUIRED` result without calling Tokyo. A positive
or unlimited limit allows existing-Page actions; first Save separately enforces
the finite count.

## Team, Profile, Settings

Berlin owns person identity, account membership, roles, invitations, ownership,
and account lifecycle records. Roma renders those surfaces and sends mutations
through same-origin routes backed by Berlin.

Roma owns Settings > Widget Defaults. That surface edits only the current
account defaults document through `/api/account/widget-defaults`; it does not
open a Bob editing session and does not save widget instances. The UI consumes
deploy-built Builder panel HTML, binds controls to the Roma draft defaults
document, and saves the full document back through the same Roma route. It uses
Bob's paired `@clickeen/bob/control-host` and
`@clickeen/bob/control-host.css` exports for compiled-control behavior and
presentation; Roma owns the surrounding page and draft state, not a second copy
of the control host.

Widget Defaults must fail closed when compiled Builder controls are unavailable,
when Dieter source hydration fails, or when the rendered controls do not cover
every requested Shell/Core default path. Metadata coverage alone is not enough:
the rendered `[data-bob-path]` set is the editable surface. Roma compiles the
shared Dieter CSS and hydrators from source; compiled widget artifacts do not
carry per-control Dieter media lists.

Widget Defaults is the second account-bound typography editor host. It uses the
same current account `fontLibrary`, family transition resolver, and relational
family/weight/style validator as Bob for both Shell and Widget Core defaults.
Each accepted family transition updates all three values in one draft-state
update. GET and PUT reject exact invalid typography paths before Tokyo
persistence. The account-backed controls expose only available choices.

Account instance create and save require the candidate public package before
the Tokyo write. Roma validates the submitted config and current Widget limits;
Web Code Generator validates account-font selections and resolved font assets
before Bob can submit a successful generated package.

Account deletion is disabled in the current runtime. Roma does not offer the
delete-account settings action and `DELETE /api/account` returns an explicit
conflict until one account-root deletion operation owns both Berlin DB cleanup
and Tokyo/R2 account storage cleanup.

## AI

Roma grants Builder Copilot access for the current account and calls San
Francisco. Bob sends the Product Copilot request through Roma: `instanceId`,
`sessionId`, `userMessage`, bounded `conversationHistory`, and a
`product-copilot.context` capsule with widget identity, locale, draft
signature, editable controls/current values, available draft actions, and
unavailable capabilities. Roma validates that capsule, resolves account and
widget identity from the saved instance context, mints the account grant, and
forwards the request for governed model execution. Bob keeps apply and Undo in
browser memory; Roma does not forward those editor actions to a separate
outcome or learning route.

Roma is the sole AI grant signing authority. It holds
`ROMA_AI_GRANT_PRIVATE_KEY_PEM`; San Francisco, Translation Agent, and
Tokyo-worker hold only the matching public key and accept only issuer `roma`.

Product Copilot model selection is also Roma-owned. Bob may send a selected
model from the UI, but Roma validates it against
`@clickeen/ck-contracts/ai-model-management` Product Copilot managed models
before minting a grant. Roma refuses to mint a Product Copilot grant if the
selected model, default model, or runtime policy model set drifts outside that
managed config. Paid Product Copilot grant policy must include every managed
Product Copilot model; free policy may remain narrower. The picker owns no model
truth, and Roma does not silently substitute another provider or model.

Roma validates current-account and widget authority plus the top-level Copilot
envelope. It does not duplicate the Product Copilot brain's edit-control
catalog validation. Invalid edit-control context travels to the Product Copilot
contract as degraded edit context: conversation may continue, while
`draft_edit` is unavailable until Bob supplies valid edit controls. Specific
Copilot context failures are returned to Bob with their reason/issue details
instead of being collapsed into a generic upstream failure.

Roma does not infer Copilot failure meaning from HTTP status alone. San
Francisco/Product Copilot must return explicit reason keys for invalid Product
Copilot requests; provider/upstream failures remain provider/upstream failures.

## Deploy Plane

Roma is a Cloudflare Pages app with Git-connected deploy from `main`.

Cloud-dev host:

```text
https://roma.dev.clickeen.com
```

Build contract:

```text
root: roma/
command: pnpm build:cf
output: roma/.vercel/output/static
```

Package commands:

```bash
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/roma lint
pnpm --filter @clickeen/roma build:cf
```

Cloudflare Pages config:

```text
project: roma-dev
output: .vercel/output/static
compatibility flags: nodejs_compat, nodejs_compat_populate_process_env
```

Before any Cloudflare Pages, custom-domain, DNS, or Pages config operation, run:

```bash
pnpm cf:api:preflight
```

Runtime evidence comes from cloud-dev Cloudflare surfaces.

Required runtime configuration:

| Name | Purpose |
| --- | --- |
| `NEXT_PUBLIC_BOB_URL` | Bob Builder iframe origin. |
| `NEXT_PUBLIC_TOKYO_URL` | Tokyo public static/resource origin. |
| `NEXT_PUBLIC_CLK_LIVE_URL` | Public serving origin for direct public URLs and shared `clickeen.js` installer snippets. |
| `BERLIN_BASE_URL` | Berlin auth/session authority. |
| `PRODUCT_COPILOT_BASE_URL` | Product Copilot worker origin where used. |
| `TRANSLATION_AGENT` | Cloudflare service binding for Translation Agent Worker. |
| `TOKYO_ASSET_CONTROL` | Cloudflare service binding for account asset operations. |
| `TOKYO_PRODUCT_CONTROL` | Cloudflare service binding for product/account instance and page operations. |
| `USAGE_KV` | Roma request-rate-limit counters and current monthly Copilot turn counters. Counter corruption and missing bindings fail closed. Cloudflare KV has no compare-and-swap, so simultaneous Copilot requests can reserve from the same observed count. |
| `SUPABASE_URL` | Roma account settings database URL; supplied in cloud-dev CI/env. |
| `SUPABASE_SERVICE_ROLE_KEY` | Roma service-role account settings writes; supplied as a secret. |
| `ROMA_AI_GRANT_PRIVATE_KEY_PEM` | Roma-only RS256 signing key for Product Copilot and Translation Agent grants. |

Cloudflare Pages config evidence uses:

```bash
pnpm cf:api:preflight
```

## Hard Stops

- Do not bypass Roma for account mutations from browser code.
- Do not let Bob, Prague, or DevStudio write account instances directly.
- Do not move Tokyo/R2 byte storage into Roma.
- Do not treat settings save as a background job when the user made a direct settings change.
- Do not silently substitute provider/model/locale/account state when an upstream owner rejects the operation.
