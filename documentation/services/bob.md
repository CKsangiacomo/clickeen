# Bob - Widget Editor

Bob is Clickeen's widget editor. It loads widget software and one saved widget
instance, edits the instance in browser memory, previews the working state, and
delegates persistence back to Roma.

For platform context see:

- `documentation/architecture/CONTEXT.md`
- `documentation/architecture/AssetManagement.md`
- `documentation/services/roma.md`
- `documentation/services/tokyo-worker.md`

## Product Role

Bob owns:

- editor session state
- spec-driven controls
- in-memory widget edits
- sandboxed preview
- save intent
- account asset use intent while editing
- Copilot prompt surface while editing

Roma owns the current account, policy, account routes, and save/upload commands.
Tokyo-worker owns R2 storage. Widget software lives in the system product tree.

## Authoring Flow

The active account authoring flow is:

1. Roma resolves the current account and target `instanceId`.
2. Roma opens one saved widget document.
3. Roma loads the compiled widget software.
4. Roma sends Bob a `ck:open-editor` message.
5. Bob validates the open payload and stores `{ compiled, instanceData }` in
   React state.
6. Bob edits that working state in browser memory.
7. User presses Save.
8. Bob sends the save intent to Roma.
9. Roma saves the current account instance through Tokyo-worker.

Between open and save, Bob writes no account persistence.

## Open Contract

Bob announces readiness:

```js
{
  type: 'bob:session-ready';
}
```

Roma opens Bob:

```js
{
  type: ('ck:open-editor',
    requestId,
    widgetname,
    compiled,
    instanceData,
    policy,
    accountPublicId,
    instanceId,
    label,
    source,
    meta);
}
```

Bob replies with:

```js
{
  type: ('bob:open-editor-applied', requestId);
}
```

or:

```js
{
  type: ('bob:open-editor-failed', requestId, error);
}
```

Open succeeds only with explicit compiled widget software and explicit saved
instance data from Roma.

## Save Contract

Save persists the one widget document currently open in Builder.

Bob sends current document metadata and working config back to Roma:

- widget type
- display name
- source metadata
- current config/content state
- generated browser package files

Roma performs the account save command. Tokyo-worker stores the saved source and
package under:

```text
accounts/{accountPublicId}/instances/{instanceId}/
```

Save is separate from translation generation, publish, unpublish, rename,
duplicate, and delete.

Dirty/save comparison uses the current editor config directly; Bob does not
substitute an empty config when serialization fails.

## Widget Software

Widget software is system software stored in:

```text
tokyo/product/widgets/{widgetType}/
```

The deployed software authority is:

```text
product/widgets/{widgetType}/
```

Each widget package contains:

```text
spec.json
widget.html
widget.css
widget.client.js
editable-fields.json
limits.json
pages/*.json
```

`spec.json` carries defaults and editor structure. `editable-fields.json`
carries editable/translatable field contracts. `limits.json` carries widget
capability context.

## Compiler

Bob compiles widget `spec.json` into:

- `compiled.panels[]`
- `compiled.controls[]`
- runtime media URLs
- editor binding metadata
- AI context metadata

Compiler source lives under `bob/lib/compile`.

The compile API is:

```text
GET /api/widgets/{widgetname}/compiled
```

Compiled payloads are consumed by Roma Builder and Bob session state.

## Controls

Editor controls are defined by widget specs using the Bob ToolDrawer DSL.

Common primitives include:

- `<bob-panel>`
- `<tooldrawer-field>`
- `<tooldrawer-cluster>`
- Dieter-backed form controls

Controls emit edit operations. The edit engine applies those operations to the
current in-memory instance state.

## Preview

Bob preview loads the widget runtime in a sandboxed iframe and streams working
state updates:

```js
{
  type: ('ck:state-update', widgetname, state, device, theme);
}
```

Widget runtime sends:

```js
{
  type: 'ck:ready';
}
```

Preview represents the in-memory working copy. Public snippets point at the
published static URL:

```text
https://clk.live/{accountPublicId}/{instanceId}
```

Roma Builder owns public widget copy actions for the current account and opened
instance. Bob does not construct public URLs, iframe snippets, or script embed
snippets from editor state. Unpublished instances expose no live snippets.

## Account Assets

Bob uses account assets while editing through Roma.

Hosted Builder asset commands are:

- `list-assets`
- `resolve-assets`
- `upload-asset`

Roma executes those commands through current-account asset routes. Tokyo-worker
stores accepted files under:

```text
accounts/{accountPublicId}/assets/{filename}
```

Dropdown fill controls use this route chain to upload and assign files. SVG
logos are accepted vector assets when Roma/Tokyo-worker accept the upload.

Bob does not expose account asset proxy routes. Account asset list, upload,
resolve, and delete operations stay behind Roma current-account routes.

## Localization

Bob edits the base locale in the active session.

The Translations panel asks Roma to generate missing or changed translated
values. Tokyo-worker stores translated locale values under:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

Translation generation is an explicit operation after save.

## Copilot

Bob owns the chat surface and current in-memory context. Roma grants and routes
AI execution for the current account. San Francisco executes the AI operation and
returns structured editor operations or outcomes.

## Deploy Plane

Bob is a Cloudflare Pages app with Git-connected deploy from `main`.

Cloud-dev host:

```text
https://bob.dev.clickeen.com
```

Build contract:

```text
root: bob/
command: pnpm build:cf
output: bob/.vercel/output/static
```

Before any Cloudflare Pages, custom-domain, DNS, or Pages config operation, run:

```bash
pnpm cf:api:preflight
```

Runtime evidence comes from cloud-dev Cloudflare surfaces.
