# Roma - Account App

Roma is the authenticated product app. It routes the user to the current
account, enforces what that account can do, and saves account-owned work through
Tokyo.

For platform context see:

- `documentation/architecture/CONTEXT.md`
- `documentation/architecture/AccountManagement.md`
- `documentation/architecture/AssetManagement.md`
- `documentation/architecture/CloudflareOperations.md`

## Product Role

Roma owns the current-account product shell:

- account bootstrap
- domain navigation
- account policy and tier enforcement
- account widget instance commands
- account page commands
- account asset commands
- Builder host orchestration
- team, billing, usage, AI, profile, and settings surfaces

Bob is the editor. Tokyo-worker is the R2 boundary. Berlin owns auth and account
identity. San Francisco owns AI execution.

## Runtime Routes

Roma account-shell routes include:

- `/home`
- `/profile`
- `/widgets`
- `/builder`
- `/builder/:instanceId`
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
| `/api/ai/**`                | San Francisco through Roma grants                      |

Roma attaches the account authz capsule and account public id to private
Tokyo-worker calls.

## Builder Orchestration

Builder opens one saved widget instance:

1. Resolve the current Roma account and `instanceId`.
2. Load the Builder-open envelope through `GET /api/builder/:instanceId/open`.
3. Load the compiled widget payload.
4. Wait for Bob `bob:session-ready`.
5. Send `ck:open-editor` with compiled widget software, saved instance data,
   policy, account public id, instance id, label, source, and metadata.
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
widget software, materializes the current account config into `index.html`,
`styles.css`, and `runtime.js`, then submits those exact files with the source
to Tokyo-worker. Tokyo-worker stores the submitted files; it does not render,
compile, infer, or repair widget package bytes. Tokyo-worker records a package
fingerprint on newly saved source and package objects so package reads, publish,
and public serving can reject mixed package state deterministically.

Translation generation is a separate explicit operation from the Translations
panel. Roma resolves the current account active locales for that command, but
generation is currently unavailable until San Francisco owns a real async
generation endpoint. Roma fails that command visibly instead of routing it
through Tokyo-worker.

Roma Builder owns public widget copy actions for the current account and opened
instance. It builds the public URL and iframe/script snippets from the current
account public id, the concrete instance id, the configured public-serving
origin, and the publish status returned by the Builder-open envelope.
Unpublished instances do not expose copyable public code.

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

Create and duplicate mint the new instance id in Roma before calling
Tokyo-worker so the generated browser package and the saved source use the same
account instance identity from the start.

Publish and unpublish are account product actions. Roma applies account policy
and sends the exact product transition to Tokyo-worker for R2 `serve-state.json`
mutation.

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

## Team, Profile, Settings

Berlin owns person identity, account membership, roles, invitations, ownership,
and account lifecycle records. Roma renders those surfaces and sends mutations
through same-origin routes backed by Berlin.

Account deletion is disabled in the current runtime. Roma does not offer the
delete-account settings action and `DELETE /api/account` returns an explicit
conflict until one account-root deletion operation owns both Berlin DB cleanup
and Tokyo/R2 account storage cleanup.

## AI

Roma grants Builder Copilot access for the current account and calls San
Francisco. Bob sends prompt and current in-memory config through Roma. Roma
resolves account and widget identity from the saved instance context.

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

Before any Cloudflare Pages, custom-domain, DNS, or Pages config operation, run:

```bash
pnpm cf:api:preflight
```

Runtime evidence comes from cloud-dev Cloudflare surfaces.
