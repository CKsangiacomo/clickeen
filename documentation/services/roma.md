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
only through Open settings or persisted Dismiss. A plan-limit prompt may close through
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
valid for inspecting the current plan. Roma's native dialogs and Bob's typed
intent implement this behavior directly. The Builder discard guard remains on
real navigation only. Final 126M integration re-verified this behavior through
the deployed Bob-to-Roma intent path.

## Runtime Routes

Roma account-shell routes include:

- `/home`
- `/profile`
- `/widgets`
- `/widgets/catalog`
- `/widgets/:instanceId`
- `/builder`
- `/builder/:instanceId`
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

The Berlin profile also carries `primaryLanguage` and dormant
`usePrimaryLanguageForUi`. Roma currently displays/edits primary language but
does not expose the boolean, choose a product UI locale, fetch UI translations,
or pass a UI locale into Bob.

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
| `/widget-editors/:widgetname.json`           | Deploy-built static Bob editor artifact                       |
| `/api/account/instances/:instanceId/copilot` | Product Copilot `/turn` through Roma grants (SSE relay)       |

Roma attaches the account authz capsule and account public id to private
Tokyo-worker calls.

Current account-governance routes include:

| Roma route                                      | Owner behind Roma                                |
| ----------------------------------------------- | ------------------------------------------------ |
| `DELETE /api/account`                           | Roma disabled account deletion conflict response |
| `POST /api/account/owner-transfer`              | Berlin owner-transfer governance                 |
| `POST /api/account/lifecycle/tier-drop/dismiss` | Berlin account lifecycle notice dismissal        |

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
   and exact public-action values or `null`.
6. Receive `bob:open-editor-applied` or `bob:open-editor-failed`.

`NEXT_PUBLIC_BOB_URL` is required and must be an `http` or `https` origin with
no path, query, or hash. Missing or malformed Bob origin config fails Builder
instead of falling back to another origin.

Bob edits in browser memory. Save sends the current widget document back to
Roma. Roma performs the current-account save command and Tokyo-worker writes the
saved source plus generated package under:

```text
accounts/{accountPublicId}/instances/{instanceId}/
```

The Builder preview uses that same saved package as its runtime base. Roma does
not provide a second source-widget preview package.

Create, save, and duplicate all use the same package contract: Roma reads the
server-only materializer artifact generated from canonical widget source at
deploy time. That artifact carries English-resolved Core defaults and the exact
adjacent ToolDrawer label source while raw `spec.json` retains its label
tokens. Roma materializes account asset references in the current account
config, then delegates deterministic base byte generation to
`@clickeen/ck-runtime-materializer` for `index.html`, `styles.css`, and
`runtime.js`. Roma submits those exact files with the source to Tokyo-worker.
Roma derives the package base locale from current account settings. Duplicate is
a new account operation; it does not copy locale authority from the source
instance. Tokyo-worker stores the submitted files; it does not render, compile,
infer, or repair widget package bytes. Tokyo-worker records a package
fingerprint on newly saved source and package objects so package reads, publish,
and public serving can reject mixed package state deterministically.

Typography materialization preserves each font authority. Google records keep
their Google specification. Global `source: "tokyo"` records convert their
declared `/fonts/special/**` path to an absolute URL under the configured
`NEXT_PUBLIC_TOKYO_URL` origin. Account-uploaded records resolve through the
current account asset authority. Roma does not rewrite a global font as an
account asset, and saved public packages do not point global fonts at
`clk.live`. Materialization also requires every common and widget-declared
typography role, its saved role scale, and explicit tracking and line-height
presets. Missing required typography structure and invalid account-font
selections fail before Tokyo persistence.

When the existing source-save command changes a saved instance, Roma saves the
source and base package only. It does not generate translations, regenerate
translations, mutate locale overlays, or make the authoring save wait on
localization. Save returns base-source and base-package save truth:
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
overlays, missing paths, and extra paths. It does not materialize runtime files.
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

Roma owns public widget action truth for the current account and opened
instance. It builds the public URL and iframe/script snippets from the current
account public id, the exact instance id, the configured public-serving
origin, and the publish status returned by the Builder-open envelope.
It sends that exact complete set to Bob, where TopDrawer presents Open public
widget and one Copy code intent under More. Roma answers that intent with the
same Dieter Popup used by the Widgets inventory; the Popup presents the exact
URL, iframe, and script values and owns browser copy. Bob does not reconstruct
or copy those values. Unpublished instances receive `publicActions: null` and
expose no public action. Bob's `bob:host-action` message carries only
`open-navigation` or `copy-code` intent; Roma retains navigation,
public-action, and unsaved-work authority.
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
name, and Published sorts are client-side projections over the validated
account list. Their headers use the shared `small` Dieter sort control. The active
sort uses `chevron.up.2` or `chevron.down.2` with
`--color-system-black`; inactive sorts use `chevron.down.dotted.2` with
`--color-system-gray`.

Rename, Duplicate, and Delete use the same unbound Dieter Menu Actions row.
Roma owns their exact Chrome wording and command handlers; Menu Actions owns
only the shared row presentation and does not interpret or persist the command.

**Widget catalog** renders the canonical widget definitions as Dieter-styled
cards. A catalog card creates an instance of that widget type; it does not
represent, count, or group saved account instances. Roma renders only catalog
metadata supplied by the owning definition and does not invent descriptions,
categories, badges, or preview media.

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

`GET /api/account/widgets` returns the full widget catalog plus saved account
instances:

```text
catalog[] + instances[]
```

The Widgets list payload does not carry Create, Duplicate, or Publish
availability booleans. Tier limits do not hide catalog items and do not disable
monetization controls in the list. Create, Duplicate, and Publish remain
clickable user-intent actions.
Role and instance-state rendering stay separate from tier monetization: Roma
client code derives read-only versus mutable controls from the current account
role and the instance publish state, while tier upgrade decisions happen only in
command routes.

Roma loads widget catalog definitions from Tokyo-worker and loads saved instance
rows through the account instance coordinate/list-facts helpers. Tokyo-worker
returns stored `displayName` as string or `null`; Roma applies the UI fallback
label for product rendering.

Create and duplicate enforce `widgets.instances.max` at command time before
minting a new instance id, compiling package bytes, materializing source, or
calling Tokyo-worker create/write routes. Publish enforces
`instances.published.max` at command time from Roma-computed list-facts rows.
Over-tier Create, Duplicate, and Publish return HTTP 402 `UPGRADE_REQUIRED`.
Missing or malformed policy limits return a Roma policy contract failure, not
unlimited usage and not a disabled list-time control.

Create and duplicate mint the new instance id in Roma only after the command
gate passes, so the generated browser package and the saved source use the same
account instance identity from the start. Publish and unpublish are account
product actions; Roma sends the exact product transition to Tokyo-worker for R2
`serve-state.json` mutation.

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

Admin assets use the same path under:

```text
accounts/CLICKEEN/assets/{filename}
```

Roma treats malformed successful Tokyo asset delete responses as upstream
contract failures. A delete is success only when the response names the current
account public id, the exact asset reference, and `deleted: true`.

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

The persisted defaults split is `common` plus
`widgets.{widgetType}.core`. `common` means one account default reused across
widget types; it does not mean Shell ownership. The retired `shell` bucket is
not read as an alias and is rejected as invalid stored truth.

Widget Defaults must fail closed when compiled Builder controls are unavailable,
when Dieter source hydration fails, or when the rendered controls do not cover
every requested common/Core default path. Metadata coverage alone is not enough:
the rendered `[data-bob-path]` set is the editable surface. Roma compiles the
shared Dieter CSS and hydrators from source; compiled widget artifacts do not
carry per-control Dieter media lists.

Widget Defaults is the second account-bound typography editor host. It uses the
same current account `fontLibrary`, family transition resolver, and relational
family/weight/style validator as Bob for both common and widget Core defaults.
Each accepted family transition updates all three values in one draft-state
update. GET and PUT reject exact invalid typography paths before Tokyo
persistence. The account-backed controls expose only available choices.

Every initial account font library includes the seven global Clickeen special
fonts as `source: "tokyo"` records. Account-uploaded fonts remain separate
`source: "account-asset"` records owned by that account.
Roma rejects a Widget Defaults document unless all seven product records are
present and exact, and rejects any additional Tokyo font record.

Account instance create, save, and duplicate materialize the candidate public
package before the Tokyo write. Package materialization applies the same
account-font validator before font asset resolution, so direct or replayed
invalid typography cannot reach source persistence or public package bytes.

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
values, available draft actions, and unavailable capabilities. Roma resolves
account and widget identity from the saved instance context, mints the account
grant, and pipes the Product Copilot event stream through. Bob keeps apply and
Undo in browser memory; Roma does not forward those editor actions to a
separate outcome or learning route.

Roma is the sole AI grant signing authority. It holds
`ROMA_AI_GRANT_PRIVATE_KEY_PEM`; San Francisco, Translation Agent, and
Tokyo-worker hold only the matching public key and accept only issuer `roma`.
The Roma-issued grant is authoritative: `streamCopilotTurn` constructs the
upstream `/turn` body from validated fields only and writes the grant last, so
the caller cannot overwrite it.

Product Copilot model selection is also Roma-owned. Bob may send a selected
model from the UI, but Roma validates it against
`@clickeen/ck-contracts/ai-model-management` Product Copilot managed models
before minting a grant. Roma refuses to mint a Product Copilot grant if the
selected model, default model, or runtime policy model set drifts outside that
managed config. Paid Product Copilot grant policy must include every managed
Product Copilot model; free policy may remain narrower. The picker owns no model
truth, and Roma does not silently substitute another provider or model.

Roma validates current-account and widget authority plus the full
`CopilotTurnRequest` through the shared `parseCopilotTurnRequest` parser in
`@clickeen/ck-contracts/ai` before any usage reservation or grant issuance.
The route instance id must match `currentDraftContext.instanceId`, and the
context `widgetType` must match the loaded Tokyo instance row. Usage is
reserved only on the initial turn; continuations pass `skipTurnReservation`.
Roma does not duplicate the Product Copilot brain's edit-control catalog
validation. Invalid edit-control context travels to the Product Copilot contract
as degraded edit context: conversation may continue, while the
`apply_widget_ops` tool is unavailable until Bob supplies valid edit controls.
Specific Copilot context failures are returned to Bob with their reason/issue
details instead of being collapsed into a generic upstream failure.

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
compatibility flags: nodejs_compat, nodejs_compat_populate_process_env
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
| `USAGE_KV`                      | Roma request-rate-limit counters and current monthly Copilot turn counters. Counter corruption and missing bindings fail closed. Cloudflare KV has no compare-and-swap, so simultaneous Copilot requests can reserve from the same observed count. |
| `SUPABASE_URL`                  | Roma account settings database URL; supplied in cloud-dev CI/env.                                                                                                                                                                                  |
| `SUPABASE_SERVICE_ROLE_KEY`     | Roma service-role account settings writes; supplied as a secret.                                                                                                                                                                                   |
| `ROMA_AI_GRANT_PRIVATE_KEY_PEM` | Roma-only RS256 signing key for Product Copilot and Translation Agent grants.                                                                                                                                                                      |

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
