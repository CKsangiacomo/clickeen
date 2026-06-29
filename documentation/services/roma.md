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

## Runtime Routes

Roma account-shell routes include:

- `/home`
- `/profile`
- `/widgets`
- `/widgets/:instanceId`
- `/builder`
- `/builder/:instanceId`
- `/pages`
- `/assets`
- `/team`
- `/billing`
- `/usage`
- `/ai`
- `/settings`

`/widgets` owns account widget lifecycle actions. `/builder/:instanceId` opens
one widget instance in Bob for editing.

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
| `/api/widgets/:widgetname/compiled` | Bob compiler payload proxy/read route          |
| `/api/account/instances/:instanceId/copilot` | San Francisco through Roma grants       |
| `/api/account/instances/:instanceId/copilot/outcome` | San Francisco outcome/linkage path |

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
2. Load the Builder-open envelope through `GET /api/builder/:instanceId/open`.
3. Load the compiled widget payload.
4. Wait for Bob `bob:session-ready`.
5. Send `ck:open-editor` with compiled widget software, saved instance data,
   policy, account public id, instance id, label, and source.
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

Create, save, and duplicate all use the same package contract: Roma compiles the
widget software, materializes account asset references in the current account
config, then delegates deterministic base byte generation to
`@clickeen/ck-runtime-materializer` for `index.html`, `styles.css`, and
`runtime.js`. Roma submits those exact files with the source to Tokyo-worker.
Roma derives the package base locale from current account settings. Duplicate is
a new account operation; it does not copy locale authority from the source
instance. Tokyo-worker stores the submitted files; it does not render, compile,
infer, or repair widget package bytes. Tokyo-worker records a package
fingerprint on newly saved source and package objects so package reads, publish,
and public serving can reject mixed package state deterministically.

When the existing source-save command changes a saved instance, Roma saves the
source and base package only. It does not generate translations, regenerate
translations, materialize locale packages, refresh locale public cache, or make
the authoring save wait on locale follow-up. Save returns source/base save truth:
`ok: true` when the source/base package was saved, or the exact source-save
failure when it was not. A translation, locale package, or locale-cache failure
is localization failure, not source-save failure.

Translation generation is a separate explicit operation from the Translations
panel. Roma resolves the current account active locales for that command,
applies the current tier limit, loads the saved instance source from
Tokyo-worker, mints a Translation Agent grant, and calls the Translation Agent
Worker. Translation Agent calls San Francisco `/model/chat` and writes overlays
via Tokyo-worker. After accepted overlay generation, Roma materializes the
matching locale package bytes for the generated locales through the locale
package helper. If locale package materialization or public cache refresh fails,
the translation command reports the exact `localePackages` failure coordinates
instead of claiming full localization success.
Locale package refresh is a separate explicit operation:
`POST /api/account/instances/:instanceId/translations/packages`. It reads the
current saved source and existing translation overlays, materializes generated
locale package bytes for active non-base locales, writes them through
Tokyo-worker, and refreshes locale public cache when required. It does not call
the Translation Agent, does not generate or regenerate translated text, and is
not part of save. The optional body `{ "locales": ["es"] }` limits the same
operation to named active non-base locales; it is an explicit coordinate subset,
not background batching or a status system.
When the command is invoked through hosted Bob, Translation Agent may stream
Agent Activity while it operates. Roma forwards that activity to Bob; Roma does
not author it, summarize it, poll for it, persist it, or convert it into product
status.

Account language settings are also an overlay operation. When the user saves
active locales in Roma Settings, Roma compares the previous active locales to
the new active locales, writes the account locale settings to Supabase, then
runs overlay follow-up for saved account instances. Removed active locales
delete exact overlay files and generated locale package files through
Tokyo-worker. Added active locales are generated through the same Translation
Agent Worker path and then materialized into generated locale package bytes. If
overlay or locale-package follow-up fails after the settings write, Roma returns
the saved settings with `overlayUpdate.ok: false`; it does not pretend follow-up
work fully completed.
For published instances, locale package delete/write follow-up includes Tokyo
public cache refresh; a refresh failure is reported as phase `cache-refresh`.
If active locales and locale policy are unchanged, Roma returns no overlay
work. Roma does not ask Bob and does not create a background locale job; saving
settings is the user decision. `overlayUpdate.cost` records the direct
synchronous surface as saved instance count times changed non-base locale count,
using the current `l10n.locales.max` cap for reference.

Roma Builder owns public widget copy actions for the current account and opened
instance. It builds the public URL and iframe/script snippets from the current
account public id, the exact instance id, the configured public-serving
origin, and the publish status returned by the Builder-open envelope.
Unpublished instances do not expose copyable public code.
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

Roma `/widgets` is the account widget management surface.

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

## Pages Domain

Roma owns the account page product surface. Account pages are stacks of saved
widget instances. Page source and any generated page packages live in Tokyo under:

```text
accounts/{accountPublicId}/pages/{pageId}/
```

Roma validates current-account access, policy, page source shape, page source
save stamps, list summaries, and placement product rules. It asks Tokyo-worker
to read or write the named account page object. Current account page publish is
disabled until Roma has a real page package writer. Public page copy/open actions
are disabled until that writer exists. While a page is published, Roma requires
unpublish before page source edit or delete.

Current page source references saved widget instances by placement id and
instance id. It does not embed widget source and does not currently store child
widget artifact references. Any shift to generated child artifact coordinates,
child evidence, or page package materialization belongs to a future Page Package
PRD.

## Team, Profile, Settings

Berlin owns person identity, account membership, roles, invitations, ownership,
and account lifecycle records. Roma renders those surfaces and sends mutations
through same-origin routes backed by Berlin.

Roma owns Settings > Widget Defaults. That surface edits only the current
account defaults document through `/api/account/widget-defaults`; it does not
open a Bob editing session and does not save widget instances. The UI consumes
compiled Builder panel HTML and Dieter media, binds controls to the Roma draft
defaults document, and saves the full document back through the same Roma route.

Widget Defaults must fail closed when compiled Builder controls are unavailable,
when Dieter media or hydration fails, or when the rendered controls do not cover
every requested Shell/Core default path. Metadata coverage alone is not enough:
the rendered `[data-bob-path]` set is the editable surface. Runtime Dieter media
URLs are served on Roma through `/dieter/*`, proxied to Tokyo, because compiled
controls use same-origin Dieter URLs.

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
forwards the request for governed model execution. Roma attaches outcome
linkage fields such as `surfaceId: roma.builder` and the opened `instanceId`
as the artifact id when forwarding Product Copilot outcomes. Linkage is not
attribution.

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
| `NEXT_PUBLIC_CLK_LIVE_URL` | Public widget serving origin for copy/open snippets. |
| `BERLIN_BASE_URL` | Berlin auth/session authority. |
| `PRODUCT_COPILOT_BASE_URL` | Product Copilot worker origin where used. |
| `SANFRANCISCO_BASE_URL` | San Francisco model execution authority. |
| `TRANSLATION_AGENT` | Cloudflare service binding for Translation Agent Worker. |
| `TOKYO_ASSET_CONTROL` | Cloudflare service binding for account asset operations. |
| `TOKYO_PRODUCT_CONTROL` | Cloudflare service binding for product/account instance and page operations. |
| `USAGE_KV` | Usage/account metrics KV binding. |
| `SUPABASE_URL` | Roma account locale/settings route database URL; supplied in cloud-dev CI/env. |
| `SUPABASE_SERVICE_ROLE_KEY` | Roma service-role account locale/settings writes; supplied as a secret. |

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
