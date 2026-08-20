# Roma - Account App

STATUS: CURRENT SYSTEM OPERATOR SPEC

Roma is the authenticated product app. It routes the user to the current
account, enforces what that account can do, and saves account-owned work through
Tokyo.

Roma is one shared current-account, command, and materialization service used
by every Widget through the same lifecycle. It is not a Widget runtime and does
not own, infer, validate, or reinterpret a Widget's unique meaning. A Widget's
structured contract and mandatory Core HTML/CSS/JavaScript remain the software.
Roma provides the same account and Save capabilities to all of them.

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
- generation of each published Widget's complete public `index.html`, complete
  `styles.css`, and mandatory `runtime.js` through the one generic Widget
  materializer on explicit allowed Publish
- account asset commands
- Builder host flow
- team, billing, usage, AI, profile, and settings surfaces

Bob is the editor. Tokyo-worker is the R2 boundary. Berlin owns auth and account
identity. San Francisco owns AI execution.

Roma accepts authentication, authorization, policy-relevant user intent, and
other non-Clickeen input at its owning routes. It then trusts exact artifacts
and results produced by Berlin, Bob, the Widget compiler, Roma's materializer,
Tokyo-worker, and Clickeen agents. It does not add downstream shape validators,
fingerprint comparisons, result filters, or repair passes over another named
authority's output.

## Workspace Capability

Roma follows the global operational-workspace tenet in
`documentation/engineering/UI/surfaces.md`: full desktop workspace on desktop
and tablets in either orientation, with the same compact navigation/workspace
on narrow mobile landscape and portrait. Retina/4K density governs sharpness,
not layout class. Roma directly consumes Dieter's
`main-container > left-nav + page` source. The shared Page provides
`page__header > page__heading + page__actions` and `page__content`; Roma owns the navigation
tree, page content, domain composition, commands, and drawer state. The same
navigation DOM owns Full and Compact modes, with Escape/scrim close and focus
return in Compact mode. At least `600px` of usable width and height is Full; a
smaller dimension is Compact. Full presents the navigation as an 8px-inset
foreground panel; Compact presents that same panel as an 8px-inset overlay over
the full-width page. The shared Full panel is `16rem` wide, borderless, and uses the
shared surface, `3xl` radius, and Dieter elevation. Every Roma domain header
uses one stateless `RomaPageHeader` composition. Its heading part always
contains the existing navigation trigger, `h1.heading-2`, and optional
caller-owned filter or state; its actions part contains only caller-owned
commands. Ordinary domain headers and content use Dieter's `contained` width
and align to the same centered `80rem` maximum. Right-side page commands use
large Dieter Button geometry; navigation and heading-context controls retain
their medium geometry. The component owns no command, permission, state, copy,
or route behavior. Domain screens are
not replaced by mobile variants. Roma uses the Dieter Page rhythm directly.
Its navigation rows use `--control-size-lg`. Primary modules use `--space-3`
block padding and `--space-2` internal gaps, while secondary cards use
`--space-2` block padding and `--space-2` internal gaps. Inline padding
remains roomier. These are direct uses of the
existing structural spacing scale, not a second density system.

The active `/builder/:instanceId` and `/builder/new/:widgetType` routes retain
the standard Page top inset, then give the padding-free, unconstrained body
below the header to Bob. Their one Roma
header uses the same `RomaPageHeader` grammar and control roles as ordinary
domains, selecting only Dieter's `full` width so its outer width follows the
editor canvas. Its standard Roma/Dieter inline inset remains independent of
Bob's tighter internal inline and bottom workspace insets. The width mode adds
no block padding; the shared header's block-end margin is the sole gap above
Bob's visible editor surfaces, and Bob adds no top inset inside the iframe.
That Roma header is the only Builder
header. Bob owns Save truth and
borrows the far-right Roma action slot only while its exact presentation phase
is `save`, `saving`, or `saved`; Roma renders that phase and sends the one
host-Save intent but does not infer dirty state or persistence success. Compact
Roma navigation remains in this header, while Bob's compact ToolDrawer opener
belongs to the editor work area.
The `/builder` landing route remains an ordinary Roma page because no editor is
open there.

Roma's single-line text controls use Dieter Textfield, choice controls use
Dropdown Actions, and semantic table definitions use Dieter Table. Roma
retains their values, labels, validation, data, actions, and layout. Roma has no
generic long-form editor.
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
Bulk Upload cannot dismiss while work is active. The tier-drop notice resolves
only through Open settings or persisted Dismiss. The shared plan-limit/upsell
Popup may close through Escape, backdrop, or its explicit dismiss action because
the denied operation was never applied and no work is lost. Unsaved
Builder/defaults confirmation treats Escape as Keep editing and requires
explicit Discard. Native `beforeunload` remains only at the browser boundary;
in-app navigation uses the Roma unsaved-changes dialog.

Roma also composes one product-neutral consequential-command confirmation from
the current Dieter Popup and Buttons. It accepts only open state, exact title,
body, confirm label, Cancel, and Confirm callbacks. Opening, Cancel, backdrop,
and repeated events after a decision invoke no product command; one explicit
Confirm invokes the already-owned command once. The current consumers are
Widget Delete, Asset Delete, Unpublish in both Roma publication surfaces,
Remove member, and Transfer ownership. Each consumer retains its existing
route, authorization, pending state, visible error, and result handling. No
invitation command or invitation workflow is part of this composition.

Roma owns one shared account upsell Popup and assembles it from truths with
different owners:

| Popup input | Owner |
| --- | --- |
| current account plan | Roma's exact system policy context |
| target eligible plan | system tier/policy matrix |
| denied capability | system entitlement contract |
| contextual body template for a Widget-bound denial | compiled Widget upsell locale artifact |
| Popup structure and lifecycle | Dieter primitive, composed by Roma |
| Popup title, Upgrade/dismiss labels, and behavior | Roma/system UI; future billing owns commercial execution |

The Widget body template may interpolate only exact system-owned values such as
`{currentPlan}` and `{targetPlan}`. The Widget does not choose those values,
write plan policy, supply an Upgrade URL, or open the Popup. Roma does not
invent Widget wording or contain Widget-name copy branches. Missing compiled
Widget copy is an artifact-production failure; Roma never substitutes a generic
body at runtime.

For a denied Builder edit, Bob sends one typed `bob:upsell` intent containing
the denied system capability and compiled Widget message identity. Roma owns
the active Builder artifact, resolves the exact body from that trusted artifact,
adds system plan truth and actions, and opens this one Popup. There is no Bob
plan-limit dialog followed by a Roma scaffold. Roma-native account commands use
the same Popup host; when a denial has no Widget-specific meaning, its contextual
body remains system-owned.

If no higher configured tier permits the exact denied demand, Roma does not
invent a target plan. The same Popup states that the account has reached the
maximum capacity currently available, presents Close only, and omits Upgrade.

The Upgrade control is deliberately scaffolding until billing is implemented.
It does not navigate to inactive Billing, purchase, mutate a plan, call a
provider, claim success, or invent a sales/contact destination. Ordinary Billing
navigation remains valid for inspecting the current plan. Opening or dismissing
the Popup preserves Bob's unsaved working state and must not invoke the Builder
discard guard. No global upsell store or parallel dialog framework is required.

Local implementation: every current compiled Widget artifact supplies exact
bindings and English templates. Bob applies one decision before draft mutation
and sends `{ capability, messageId, required }` on denial. Roma uses the exact
Boolean or numeric `required` demand to select the first higher system tier
that permits the edit, resolves the exact Widget template, and opens one Popup.
The old Bob Popup and Save-time Widget limit decision are absent.

## Runtime Routes

Roma account-shell routes include:

- `/home`
- `/profile`
- `/widgets`
- `/widgets/catalog`
- `/widgets/:instanceId`
- `/builder`
- `/builder/:instanceId`
- `/builder/new/:widgetType`
- `/assets`
- `/team`
- `/billing`
- `/usage`
- `/ai`
- `/settings`

`/home` currently preserves the Roma shell and navigation but renders no
domain-specific header, actions, placeholders, or page content.

The Widgets routes own account widget lifecycle actions. `/builder/:instanceId`
opens one saved widget instance in Bob; `/builder/new/:widgetType` composes one
non-persisted New draft.

## Auth And Account Bootstrap

Roma bootstraps account context from:

```text
GET /api/bootstrap
```

That route proxies to Berlin session bootstrap with the user bearer token. Its
browser JSON returns:

- user identity
- current account
- account role
- account public id
- account entitlement snapshot

Roma removes Berlin's signed account authz capsule from the JSON response and
writes it to the shared secure account-authz cookie. Roma uses the Berlin-issued
current account as the product account context. Browser code uses same-origin
Roma APIs. Shared httpOnly cookies carry session and account-authorization truth
across Roma and Bob on the custom `*.clickeen.com` domain.

The Berlin profile also carries `primaryLanguage` and dormant
`usePrimaryLanguageForUi`. Roma currently displays/edits primary language but
does not expose the boolean, choose a product UI locale, fetch UI translations,
or pass a UI locale into Bob.

The authenticated layout keeps one bootstrap provider mounted across Roma
route transitions. The shared `main-container`, `left-nav`, and page frame render
immediately; only `page__content` waits for the first complete, authenticated
account and authz result from Berlin. That first wait uses a content skeleton,
not implementation-status copy or a blank replacement screen.

Account mutations explicitly reconcile through the same bootstrap authority.
While that request is pending, Roma retains the already authoritative page and
the owning control shows its local pending state. A background refresh may retain
the current page only for a transient network or upstream failure and only
until the current authz safety boundary. Missing, expired, auth-required, and
forbidden authorization are never accepted or preserved as usable context.
After Berlin authentication and Roma authorization succeed, Roma trusts the
Berlin-produced account result instead of semantically revalidating it.

## Same-Origin API Model

Browser code calls Roma same-origin routes. Roma server routes call the owning
service:

| Roma route family                            | Owner behind Roma                                             |
| -------------------------------------------- | ------------------------------------------------------------- |
| `/api/session/**`                            | Berlin                                                        |
| `/api/me/**`                                 | Berlin                                                        |
| `/api/account/team/**`                       | Berlin                                                        |
| `/api/account/locales`                       | Roma account settings mutation; Berlin bootstrap read context |
| `/api/account/widgets/**`                    | Tokyo-worker through product control                          |
| `/api/account/instances/**`                  | Tokyo-worker through product control                          |
| `/api/account/assets/**`                     | Tokyo-worker through asset control                            |
| `/api/account/usage`                         | Tokyo-worker storage facts plus account policy context        |
| `/api/account/widget-defaults`               | Roma defaults document backed by Tokyo-worker                 |
| `/api/builder/:instanceId/open`              | Roma Builder-open envelope backed by Tokyo-worker             |
| `/api/builder/new/:widgetType/open`          | Roma non-persisting New-draft composition                     |
| `/widget-editors/:widgetname.json`           | Deploy-built static Bob editor artifact                       |
| `/api/account/instances/:instanceId/copilot` | Product Copilot `/turn` through Roma grants (SSE relay)       |

Roma attaches the account authz capsule and account public id to private
Tokyo-worker calls.

Local implementation consumes Berlin's exact bootstrap/account/authz result,
Roma's exact Widget-list result, and Tokyo-worker's exact integer
`storageBytesUsed` result. HTTP/session handling, auth expiry, route
authentication, and authorization remain at their owning boundaries; browser
consumers do not normalize or cross-check those Clickeen-produced semantics.

Current account-governance routes include:

| Roma route                                      | Owner behind Roma                                |
| ----------------------------------------------- | ------------------------------------------------ |
| `DELETE /api/account`                           | Roma disabled account deletion conflict response |
| `POST /api/account/owner-transfer`              | Berlin owner-transfer governance                 |
| `POST /api/account/lifecycle/tier-drop/dismiss` | Berlin account lifecycle notice dismissal        |

## Builder Orchestration

Builder opens either a saved instance or a New draft:

1. Resolve the current Roma account and the discriminated target:
   `instanceId` for saved, `widgetType` for New.
2. Saved uses `GET /api/builder/:instanceId/open` to load and recompose the
   exact source plus account font library. New uses
   `GET /api/builder/new/:widgetType/open` to compose exact account defaults in
   memory and performs no instance/source/package/serve-state write.
3. Load the deploy-built Widget editor artifact.
4. Wait for Bob `bob:session-ready`.
5. Send one `ck:open-editor` with the deploy-built editing declarations and
   Widget software, complete `instanceData`, account font library, policy,
   account public id, optional instance id, and label. Publication status,
   timestamps, receipt, URL, and actions remain in Roma and do not enter Bob.
6. Receive `bob:open-editor-applied` or `bob:open-editor-failed`.

`NEXT_PUBLIC_BOB_URL` is required and must be an `http` or `https` origin with
no path, query, or hash. Missing or malformed Bob origin config fails Builder
instead of falling back to another origin.

Bob edits in browser memory. `save-instance` sends the current Widget document
back to Roma as `config`; Bob adds `widgetType` only while there is no saved
instance ID. On that First Save, Roma POSTs the exact `{ widgetType, config }`,
mints the ID, writes the first editable source through Tokyo-worker, upserts its
Widgets cache, replaces `/builder/new/:widgetType` with
`/builder/:instanceId` through the History API, and replies HTTP 201 with the ID
and the exact current account `baseLocale` persisted with that source. Bob
adopts both through the existing Save result into its current
`meta`/`translationSetup`, without a second open handshake, message, or iframe
remount. This keeps Bob aligned with the locale used for that Save; it does not
serialize First Save against a simultaneous account-locale PATCH across
authorities.

With an ID, Roma PUT receives `{ config }` only. Its browser ingress requires
the payload and `config` to be records, then loads the exact account-scoped
saved list fact from Tokyo-worker and uses that stored `widgetType` to select
the compiled Widget artifact. It does not read, compare, or revalidate a caller
`widgetType`. Roma then prepares the semantic source and patches the returned
`updatedAt`. Tokyo-worker writes saved source under:

```text
accounts/{accountPublicId}/instances/{instanceId}/
```

The current Widget document is one complete logical instance: its shared
Header/Stage/Pod/Core-size/appearance/typography/chrome values and its Widget
Core values travel together. Roma prepares exact config and content payloads;
Tokyo stores them together with source metadata as one atomic
`instance.source.json`.

The Builder-open envelope includes Roma's exact current-account policy snapshot
and the trusted compiled Widget limit/message association. Bob's shared edit
boundary consumes those two system artifacts directly. A denied Widget-bound
edit does not mutate the draft; Bob reports only:

```json
{
  "type": "bob:upsell",
  "capability": "[systemEntitlementKey]",
  "messageId": "[widgetUpsellMessageId]",
  "required": "[boolean|number]"
}
```

Roma resolves the current and target plan from system policy, resolves the
exact localized Widget template from the compiled artifact it already owns,
and composes the shared Popup with system-owned actions. It does not ask Bob for
plan truth or accept Widget-authored CTA behavior.

Builder preview uses Widget software plus Bob's exact browser-memory draft. It
does not require or use the stored public package as editable truth.

The local Builder-open path reads only saved source and the deploy-built editor
artifact. That artifact carries exact Widget HTML/CSS/JavaScript software for
Bob preview. Roma does not read a stored package, compare a package
fingerprint, or send `publicPackage` to Bob.

Only explicit allowed Publish uses the package contract. Roma reads the
server-only materializer artifact generated from canonical Widget source at
deploy time and combines it with the exact saved instance through one
Widget-neutral `@clickeen/ck-runtime-materializer` contract. The materializer
emits:

```text
index.html  complete base-locale semantic Widget structure and content
styles.css  complete shared and Core presentation
runtime.js  mandatory Widget and shared visitor behavior
```

This materializer is the sole generator of the logical files that will be served.
Roma invokes it only on explicit allowed Publish. Tokyo-worker receives the resulting
strings and stores them together in one atomic published `serve-state.json`; it
never creates, compiles, renders, or alters Widget HTML/CSS/JavaScript.

The shared render producer serializes stable content-slot identities literally
inside the quoted `data-ck-content-path` attribute, including repeated-identity
`=` selectors, while retaining normal HTML escaping for unsafe characters.
This is producer output, not a Tokyo decoding rule or a Widget-specific path.

Initial public content and presentation exist before `runtime.js` runs. The
materializer may
apply the same shared services for every Widget, but it may not branch on
Widget type or interpret Core meaning. Roma submits those exact files through
the Publish operation; the saved source remains unchanged. Publish uses the
exact base locale already stored on that editable instance. Duplicate creates
the destination instance with the destination account's current base locale;
it does not copy locale authority from the source instance. Tokyo-worker trusts and stores the submitted
logical members; it does not render, compile, validate, infer, fingerprint, or repair
Widget package bytes. New composes an unsaved browser draft and writes
nothing; first Save creates editable source; later Save updates editable
source; Duplicate creates new unpublished editable source. None generates a
public package.

Local implementation: the materializer trusts each current Widget's compiled
software and saved source, writes complete semantic HTML and complete CSS,
includes mandatory visitor-behavior JavaScript, and emits no package
fingerprint. Every Publish writes that Widget's Discovery baseline
title/description. When the exact saved **Enable SEO/GEO** value and system
entitlement are both true, the Widget's authored content-derived output is
present; FAQ Core's current rich-result example authors
FAQPage/Question/Answer microdata around the exact visible content.

Typography materialization preserves each font authority. Google records keep
their Google specification. Global `source: "tokyo"` records convert their
declared `/fonts/special/**` path to an absolute URL under the configured
`NEXT_PUBLIC_TOKYO_URL` origin. Account-uploaded records resolve through the
current account asset authority. Roma does not rewrite a global font as an
account asset, and saved public packages do not point global fonts at
`clk.live`. The authoritative account library and Widget contract already
produce the exact common and Core typography data. Materialization consumes
that system truth directly; it does not run a second account-font or complete
typography validator before Tokyo persistence.

When the source-Save command changes a saved instance, Roma saves the editable
source only. It does not generate a base package, generate translations, regenerate
translations, mutate locale overlays, or make the authoring save wait on
localization. Save returns source-save truth:
`ok: true` when the complete source was saved, or the exact source-save
failure when it was not. Translation failure is localization failure, not
source-save failure.

Roma does not re-evaluate Widget-bound tier limits during Save. Bob's shared
editing boundary already used Roma's exact policy snapshot before accepting
each governed manual or Copilot edit, so the complete draft is trusted
Clickeen truth. Save stores that exact accepted draft through Tokyo-worker.
Account commands that originate in Roma—such as first Save, Duplicate,
Publish, locale changes, or uploads—remain Roma-owned policy boundaries and are
gated once when their own user intent occurs.

Translation generation is a separate explicit operation from the Translations
panel. Roma resolves the current account active locales for that command,
applies the current tier limit, loads the saved instance source from
Tokyo-worker, mints a Translation Agent grant, and calls the Translation Agent
Worker. Translation Agent calls San Francisco `/model/turn` in structured mode
and writes overlays via Tokyo-worker. Translation Agent returns one ordered terminal result for
every requested locale. Roma trusts that Translation Agent result and returns
its `requestedLocales`, `translatedLocales`, and exact `failedLocales`; a
partial result remains an HTTP `200` product result. The command ends after
those exact overlay outcomes; it does not create, publish, or cache runtime
files.
`PUT /api/account/instances/{instanceId}/translations/{locale}` is the exact
editor-authorized overlay-value mutation boundary. It accepts one complete
saved-field value map at the external editor ingress and delegates the accepted
Clickeen artifact to Tokyo-worker. Tokyo trusts and stores it; it does not
revalidate the accepted field contract. The operation does not materialize
runtime files.
`DELETE /api/account/instances/{instanceId}/translations/{locale}` is the
authenticated explicit deletion boundary for that one exact account-instance-
locale overlay, including the pre-GA positional-coordinate cutover. It delegates
the exact delete to Tokyo-worker and does not introduce a broad storage-prefix
operation, Serve migration, or compatibility path.
When the command is invoked through hosted Bob, Translation Agent may stream
Agent Activity while it operates. Roma forwards that activity to Bob; Roma does
not author it, summarize it, poll for it, persist it, or convert it into product
status.

Account language settings choose which languages are available to widgets. Roma
writes that account configuration to Supabase. Adding a language does not call
the Translation Agent or materialize any widget; each widget remains missing
that translation until its Translations panel explicitly generates it.

Removing a language deletes its exact overlay from saved account instances
through Tokyo-worker. If deletion fails after the settings write, Roma returns
the saved settings with `localeCleanup.ok: false` and the exact failed
coordinate. The account setting remains the user decision and account truth.

Roma owns public widget action truth for the current account and opened saved
instance. One shared publication control is rendered in Widgets inventory rows
and Roma's shared Builder header. That header retains the one Roma grammar and
vertical rhythm while selecting full-width geometry for Bob's canvas. It
derives Publish/Republish/Unpublish and the
published receipt from exact `updatedAt`, `publishedAt`, and publication status,
and builds public URL/code actions from the current account and instance
coordinate. Bob receives none of those facts or actions.
Publish and Republish remain immediate explicit commands. An Unpublish intent
opens the shared confirmation in both the inventory and Builder header; the
dialog names the exact Widget, says it will go offline while saved source
remains, and sends the existing Unpublish command only after explicit confirm.

Tokyo is the single timestamp writer. Save and Rename each return `updatedAt`
strictly later than the previous `updatedAt` and any `publishedAt`.
Publish/Republish returns `publishedAt` strictly later than both the exact
source revision it commits and the prior `publishedAt`. Roma compares those
authoritative coordinates directly; it adds no validator
or same-millisecond workaround.

Publish never silently Saves a dirty draft. Roma mirrors Bob's dirty boolean
only to disable Publish/Republish; the Builder header carries no separate
**Save first** hint text or Republish tooltip, because the disabled control and
the Save control already express that state. Unpublish remains available
because it does not consume the draft. A successful publication
command updates Roma's publication facts without reopening Bob. Cache eviction
is not a Roma result or UI concern: Tokyo schedules it after the owning
mutation, and no Roma route, banner, retry state, or user copy observes it.
The copied public URL is slashless:

```text
{public-serving-origin}/{accountPublicId}/{instanceId}
```

Generated package HTML must not depend on that URL being folder-normalized. The
runtime materializer writes exact root-relative support-file paths inside
`index.html`:

```text
/{accountPublicId}/{instanceId}/styles.css
/{accountPublicId}/{instanceId}/runtime.js
```

## Widgets Domain

Roma `/widgets` and `/widgets/catalog` are the account widget management
surfaces. Widgets is one expandable Roma navigation group, using the same
left-navigation pattern as Settings. Its route-owned subitems are **Your
widgets** at `/widgets` and **Widget catalog** at `/widgets/catalog`; they are
not local page tabs.

**Your widgets** is the default account-instance inventory. It uses one
semantic Dieter Table whose columns are Widget, Instance name, Published,
Instance ID, and Actions. Published uses a left-aligned Dieter Toggle and, only
for a published instance, a small Copy code action that opens Roma's shared
public-code Popup. Edit is the direct row action; Rename, Duplicate, and Delete
remain in one ellipsis menu. The header status filter and the Widget, Instance
name, and Published sorts are client-side projections over the authoritative
account list. Their headers use the shared `small` Dieter sort control. The active
sort uses `chevron.up.2` or `chevron.down.2` with
`--color-system-black`; inactive sorts use `chevron.down.dotted.2` with
`--color-system-gray`. On a cache-cold first load, that same Table and all five
headers remain mounted; one status row spanning the columns says
`Loading widgets...`. Roma does not replace the inventory with a loose loading
paragraph and then shift into a Table.

Rename, Duplicate, and Delete use the same unbound Dieter Menu Actions row.
Roma owns their exact Chrome wording and command handlers; Menu Actions owns
only the shared row presentation and does not interpret or persist the command.

**Widget catalog** renders the canonical widget definitions as Dieter-styled
cards. A catalog card opens a new unsaved draft of that widget type; it creates
no instance, identity, source, package, serve state, overlay, or inventory row.
Leaving before first Save leaves nothing behind. It does not represent, count,
or group saved account instances. Roma renders only catalog
metadata supplied by the owning definition and does not invent descriptions,
categories, badges, or preview media.

Changing routes does not change the account command or storage authority.
Publication remains a controlled command: the shared Roma control changes only
after the existing command succeeds and the exact instance facts refresh.
Roma immediately patches/upserts its module-scoped Widgets cache after Save so
the durable inventory reflects first creation and later divergence without a
five-minute stale window. Cache eviction is outside this product state.

It owns:

- list
- new-draft composition and first-Save creation
- duplicate
- rename
- publish
- unpublish
- delete

`GET /api/account/widgets` returns the full widget catalog plus saved account
instances:

```text
catalog[] + instances[]
```

The Widgets list payload does not carry New, Duplicate, or Publish
availability booleans. Tier limits do not hide catalog items and do not disable
monetization controls in the list. New, Duplicate, and Publish remain
clickable user-intent actions.
Role and instance-state rendering stay separate from tier monetization: Roma
client code derives read-only versus mutable controls from the current account
role and the instance publish state, while tier upgrade decisions happen only in
command routes.

Roma loads widget catalog definitions from Tokyo-worker and loads saved instance
rows through the account instance coordinate/list-facts helpers. After current
account resolution, those two independent reads start together and are awaited
once. The instance-facts failure retains deterministic priority when both fail;
otherwise the definitions failure is returned. Roma adds no cache, timeout,
probe, retry, fallback, or alternate read to this cold path. Tokyo-worker
returns stored `displayName` as string or `null`; Roma applies the UI fallback
label for product rendering.

Local implementation: New and Duplicate do not enforce
`widgets.instances.max`. New writes nothing; Duplicate writes an immediate
unpublished editable copy and opens it in Bob. First Save of a New draft mints
the instance and writes its exact source. Publish enforces
`instances.published.max` at command time. Roma first uses its computed
list-facts rows as a fast precheck before invoking the materializer. It then
passes its exact `instances.published.max` value with the exact generated
package and exact saved `sourceUpdatedAt` to Tokyo-worker for the final
account-scoped transition. Tokyo applies that passed decision against current
source/publication truth through the account's one Durable Object coordinator;
it does not resolve tier policy again.
An ordinary over-capacity Publish returns HTTP 402 `UPGRADE_REQUIRED` before
materialization. In the rare overlap after the precheck, a contender can spend
transient materializer work, but Tokyo returns HTTP 409
`coreui.errors.instance.commandInProgress` before storing that contender package
or changing publication state. If source changed after Roma materialized it,
Tokyo returns HTTP 409 `coreui.errors.instance.sourceChanged` before the atomic
publication write. After a winner commits, a later attempt receives the same
HTTP 402 capacity result. Republish consumes no additional slot. New and
Duplicate remain available, and there is no queue or automatic retry.

That account coordinator serializes every existing-instance Save, Rename,
Publish/Republish, Unpublish, and Delete. First Save and Duplicate create new
coordinates and do not use this existing-instance critical section. An overlap
returns the generic command-in-progress result and mutates nothing. The Durable
Object stores no source, package, policy, count, or publication truth.

For existing-instance Delete, Tokyo's exact product commit is deletion of
`instance.source.json`, the inventory/open/public-serving visibility anchor.
Roma trusts that command response and has no cleanup state. Only after the
response exists does Tokyo schedule residual instance-prefix cleanup through
`waitUntil`; absence, throw, rejection, partial completion, or pending cleanup
cannot change the response. Any remaining bytes are unreachable and outside
the account asset quota.

Roma consumes the git-authored policy matrix as system truth. It does not add a
runtime malformed-policy validator or silently reinterpret a limit as unlimited
usage. Authoring/build verification belongs to the authority that produces the
policy artifact and is not a product-runtime dependency.

The Roma surface receiving that exact denial opens the same shared account
upsell Popup. These are system account commands rather than edits to a unique
Widget coordinate, so the system owns their contextual body as well as current
plan, target plan, and CTA behavior. Roma does not pretend that Widget-owned
copy exists where the denied action has no Widget-specific meaning.

First Save and Duplicate mint a new instance id, store
editable source, and create no browser package. New mints and stores nothing.
Publish and
unpublish are separate account product actions; only allowed Publish invokes
materialization before Roma sends the exact product transition and package to
Tokyo-worker.

Tokyo's physical commit shape is atomic on both sides: First Save writes an
unpublished `serve-state.json` first and `instance.source.json` last; later
Save/Rename each replace the source object once. Delete commits by removing the
exact source object; residual prefix cleanup is deferred and product-inert.
Publish replaces one
`serve-state.json` containing `status`, `publishedAt`, and exact logical
`publicPackage` `{ indexHtml, stylesCss, runtimeJs }`. The public file paths
remain logical views of those members, not separate R2 objects.

The pre-GA storage cutover is complete for all four legacy saved cloud-dev
instances under `CLICKEEN`; the two public instances were Republished through
Roma. No compatibility reader or migration-on-read exists, and retained split
legacy objects are unreachable.

## Assets Domain

Roma `/assets` is the account asset library surface.

It owns:

- list account assets
- upload account assets
- resolve account asset references
- delete exact account asset references
- show storage usage facts returned from the same account asset authority

The page header owns Upload asset, Upload in bulk, and Refresh list. The
account-dependent commands remain inside the Roma account boundary and report
only their current actions and busy state to that header. The asset table uses
the Dieter table contract; Asset, Type, and Size use the same inline label plus
`small` Dieter icon-button sorting pattern as the Widgets table. Active sort
controls use `chevron.up.2` or `chevron.down.2` with
`--color-system-black`; inactive controls use `chevron.down.dotted.2` with
`--color-system-gray`.

The active asset route chain is:

```text
Roma current account
  -> accountPublicId
  -> /api/account/assets/**
  -> Tokyo-worker
  -> accounts/{accountPublicId}/assets/{filename}
```

The browser-facing upload route requires an `editor` or higher in an `active`
current account before it forwards accepted upload metadata and bytes. This is
Roma product policy. Tokyo-worker verifies service/account authorization and
owns raw upload and storage safety, but does not repeat the account-status
decision.

Admin assets use the same path under:

```text
accounts/CLICKEEN/assets/{filename}
```

Roma trusts Tokyo-worker's exact asset-delete operation result. Tokyo-worker
owns whether the R2 deletion completed; Roma does not revalidate a successful
system result against the command it just sent.

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
of the control host. Before running Dieter hydrators, the shared host projects
the exact current draft values into the compiled controls. It then synchronizes
the hydrated control surface from that same draft, dispatching external control
updates only when the projected value actually changes; compiled empty fields
are not defaults or fallback values.
JSON controls use Dieter's `data-dieter-json` marker and generic component
operations use `dieter-ops`; `data-bob-path` remains the host-owned field
coordinate. Roma destroys hydrated Dropdown Actions, Border, Edit, Fill,
Shadow, Upload, Object Manager, Repeater, and
Slider roots before replacing or unmounting the Widget Defaults control surface. Collection child hydrators and
drafts therefore have the same lifecycle in Roma as in Bob; Slider releases
its native progress listener. Slider values remain exact Roma draft values and
the shared Slider hydrator owns only their visual progress presentation.
Textfield values remain exact strings and retain exact caller placeholders.
Valuefield control metadata retains the caller's inclusive `min` and `max`;
Roma changes the Widget Defaults draft only for a finite value inside those
bounds. Invalid input stays visible in the native field but does not clamp,
coerce, substitute, or mutate the draft.
Nested Object Manager/Repeater controls keep neutral `data-path` coordinates;
Roma binds only the true outer `data-bob-path` collection field and receives
one exact array update. Segmented controls rely on the same native radio state
as Bob and require no Roma state-mirroring behavior.

Because Widget Defaults is a Roma-owned editing host, a governed Widget edit is
gated at this same raw user-edit boundary through the compiled `limits.json`
binding and exact Roma policy truth before the defaults draft changes. A denial
opens Roma's shared upsell Popup using the bound Widget message identity. An
accepted defaults draft is trusted at Save; the persistence route does not
re-run the same Widget limit. This is the same generic capability contract Bob
uses, not a second Roma Widget policy or a Widget-name branch.

The persisted defaults split is `common` plus
`widgets.{widgetType}.core`. `common` means one account default reused across
widget types; it does not mean Shell ownership. The retired `shell` bucket is
not part of the current contract and has no alias or compatibility path.

Widget Defaults requires its deploy-built Builder controls and Dieter source.
An unavailable dependency is an explicit surface failure, not a reason to
invent a second control surface. The rendered `[data-bob-path]` set is the
editable surface only; it is not a schema, validator, or allowlist for the
persisted document. Non-editable Widget state remains in the full draft and
round-trips unchanged. Roma compiles the shared Dieter CSS and hydrators from
source; compiled Widget artifacts do not carry per-control Dieter media lists.

Widget Defaults is the second account-bound typography editor host. It uses the
same current account `fontLibrary` and family transition resolver as Bob for
both common and Widget Core defaults.
Each accepted family transition updates all three values in one draft-state
update. GET returns Tokyo's exact current document without comparing Widget
state to ToolDrawer controls. The account-backed controls expose only available
choices. Because the PUT body is browser input, Roma admits its font library
and common/Core typography selections once at `/api/account/widget-defaults`
before they become stored Clickeen truth. Tokyo and later consumers do not
repeat that validation.

Every initial account font library includes the seven global Clickeen special
fonts as `source: "tokyo"` records. Account-uploaded fonts remain separate
`source: "account-asset"` records owned by that account.
Roma trusts the authoritative system font library; it does not re-count or
revalidate the seven product records at Widget Defaults Save.

New writes nothing; first/later Save and Duplicate write editable source only.
Explicit allowed Publish is the sole package materialization path.

Widget Defaults consumes exact deploy-built `CompiledWidget` artifacts. It
selects the repeated common control surface once from one exact artifact,
selects each Widget's own Core controls from that Widget's artifact, and
preserves compiler order. Every non-empty projected panel is introduced by its
exact compiler-supplied `panel.label`, assigned as DOM text and followed by the
unchanged selected-control HTML. Empty panels remain absent. Roma does not
infer a label from an id, keep a second panel-label map, or substitute missing
copy. Panel filtering is a UI projection, not validation.
The browser-facing save route is the single document/typography admission
boundary. After it accepts the draft and authoritative account font library,
Tokyo stores the exact document and later consumers trust it without a second
validator. Raw user/Dieter event admission, capability gating, show-if
presentation, hydrator lifecycle, authentication, authorization, and Tokyo
storage failures remain at their owning boundaries.

Account deletion is disabled in the current runtime. Roma does not offer the
delete-account settings action and `DELETE /api/account` returns an explicit
conflict until one account-root deletion operation owns both Berlin DB cleanup
and Tokyo/R2 account storage cleanup.

## AI

Roma grants Builder Copilot access for the current account, calls Product
Copilot `/turn`, and relays the SSE stream back to Bob. Bob sends a
`CopilotTurnRequest` through Roma: an `initial` turn carries `userMessage`,
while a `continuation` carries `priorModelStepId`, `toolCallId`, `toolName`,
and `toolResult`. Both kinds carry `sessionId`, `userTurnId`, optional
`selectedModel`, bounded `conversationHistory`, and a `currentDraftContext`
capsule with widget identity, locale, draft signature, editable controls/current
values, available draft actions, and unavailable capabilities. Roma authorizes
the route by reading the exact account-scoped saved-instance fact, without
loading its source or comparing that source with Bob's draft. It then mints the
account grant and pipes the Product Copilot event stream through. Bob keeps
apply and Undo in browser memory; Roma does not forward those editor actions to
a separate outcome or learning route.

Roma owns the hosted stream's `AbortController`, keyed by the original
`run-copilot` request id. Bob's `cancel-copilot` host command carries that exact
active stream id in its body and has a separate command id for the cancellation
acknowledgement. Roma aborts and removes the controller at the target stream id,
then replies on the cancellation command id. Bob marks Stop immediately as its
UI truth and ignores late turn events; Roma owns terminating the hosted network
work. Roma's Cloudflare runtime enables `enable_request_signal`, so aborting the
browser-to-Roma request reaches the route's `request.signal` and propagates to
the Product Copilot request.

Roma is the sole AI grant signing authority. It holds
`ROMA_AI_GRANT_PRIVATE_KEY_PEM`; San Francisco, Translation Agent, and
Tokyo-worker hold only the matching public key and accept only issuer `roma`.
The Roma-issued grant is authoritative: `streamCopilotTurn` constructs the
upstream `/turn` body from the accepted external request and writes the grant
last, so the caller cannot overwrite it. Grant signing and downstream signature
verification are authorization boundaries, not semantic revalidation of a
Clickeen artifact.

Product Copilot model selection is also Roma-owned. Bob may send a selected
model from the UI, but Roma validates it against
`@clickeen/ck-contracts/ai-model-management` Product Copilot managed models
before minting a grant because the selection originates with the user. Roma
trusts the git-authored default and runtime policy model set; it does not
revalidate those Clickeen-produced artifacts against each other at request
time. Paid Product Copilot grant policy includes the managed paid model set;
free policy may remain narrower. The picker owns no model truth, and Roma does
not silently substitute another provider or model.

Roma authenticates the current account, authorizes the route through the exact
account-scoped saved-instance fact, and accepts the externally reachable
`CopilotTurnRequest` through the shared `parseCopilotTurnRequest` transport
parser in `@clickeen/ck-contracts/ai` before usage reservation or grant
issuance. That one browser-ingress parser admits non-empty user/assistant text
history and the distinct assistant tool-only branch carrying `toolCall` plus an
optional exact `toolResult`; it never substitutes placeholder text. Roma then
trusts Bob's accepted `currentDraftContext` and history plus the Product
Copilot event stream as Clickeen-produced truth. It does not reload Tokyo
source or cross-check source semantics during the turn. Usage is reserved only
on the initial turn; continuations pass `skipTurnReservation`.

Product Copilot consumes Roma's accepted typed turn directly, and Bob projects
the exact compiled edit-control metadata plus current draft values without a
degraded substitute. Acceptance of the external HTTP request, Bob's
edit-operation decision for the model-produced tool request, and signed grant
authority remain.

Roma does not infer Copilot failure meaning from HTTP status alone. San
Francisco/Product Copilot must return explicit reason keys for invalid Product
Copilot requests; provider/upstream failures remain provider/upstream failures.
The browser-facing response is `content-type: text/event-stream` with
`cache-control: no-store`; Roma relays the Product Copilot frames transparently.

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
compatibility flags: nodejs_compat, nodejs_compat_populate_process_env, enable_request_signal
```

Before any Cloudflare Pages, custom-domain, DNS, or Pages config operation, run:

```bash
pnpm cf:api:preflight
```

Runtime evidence comes from cloud-dev Cloudflare surfaces.

Required runtime configuration:

| Name                            | Purpose                                                                                                                                                                                                                                            |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_BOB_URL`           | Bob Builder iframe origin.                                                                                                                                                                                                                         |
| `NEXT_PUBLIC_TOKYO_URL`         | Tokyo public static/resource origin.                                                                                                                                                                                                               |
| `NEXT_PUBLIC_CLK_LIVE_URL`      | Public widget serving origin for copy/open snippets.                                                                                                                                                                                               |
| `BERLIN_BASE_URL`               | Berlin auth/session authority.                                                                                                                                                                                                                     |
| `PRODUCT_COPILOT_BASE_URL`      | Product Copilot worker origin where used.                                                                                                                                                                                                          |
| `TRANSLATION_AGENT`             | Cloudflare service binding for Translation Agent Worker.                                                                                                                                                                                           |
| `TOKYO_ASSET_CONTROL`           | Cloudflare service binding for account asset operations.                                                                                                                                                                                           |
| `TOKYO_PRODUCT_CONTROL`         | Cloudflare service binding for product/account instance operations.                                                                                                                                                                                |
| `USAGE_KV`                      | Roma request-rate-limit counters and current monthly Copilot turn counters. The binding is required; Roma consumes its own stored counter truth without a downstream semantic validator or fallback. Cloudflare KV has no compare-and-swap, so simultaneous Copilot requests can reserve from the same observed count. |
| `SUPABASE_URL`                  | Roma account settings database URL; supplied in cloud-dev CI/env.                                                                                                                                                                                  |
| `SUPABASE_SERVICE_ROLE_KEY`     | Roma service-role account settings writes; supplied as a secret.                                                                                                                                                                                   |
| `ROMA_AI_GRANT_PRIVATE_KEY_PEM` | Roma-only RS256 signing key for Product Copilot and Translation Agent grants.                                                                                                                                                                      |

Cloudflare Pages config evidence uses:

```bash
pnpm cf:api:preflight
```

## Hard Stops

- Do not add Widget-name branches or Widget-specific state meaning to Roma.
- Do not validate, filter, normalize, fingerprint, or reconcile Bob drafts,
  compiled Widget artifacts, materializer bytes, Tokyo results, policy files,
  font libraries, or agent results produced by Clickeen authorities.
- Do not materialize an empty application shell whose initial Widget content
  depends on client JavaScript.
- Do not hardcode Widget-specific upsell wording in Roma. Resolve the exact
  compiled Widget message identity and combine it only with system-owned plan
  truth and actions.
- Do not host a second upsell dialog in Bob or recheck a Widget-bound limit at
  Save or later Publish materialization after the owning edit boundary accepted
  the draft.
- Do not substitute generic upsell copy when a Widget-bound message is missing.
- Do not bypass Roma for account mutations from browser code.
- Do not let Bob, Prague, or DevStudio write account instances directly.
- Do not move Tokyo/R2 byte storage into Roma.
- Do not treat settings save as a background job when the user made a direct settings change.
- Do not silently substitute provider/model/locale/account state when an upstream owner rejects the operation.
