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

Bob also exposes a narrow `@clickeen/bob/control-host` module for non-editor
surfaces that must reuse Builder control presentation. That export is limited to
compiled-control DOM helpers, Dieter media loading, Dieter hydrator execution,
show-if visibility, and field value serialization/parsing. It does not export
Bob session state, live edit application, preview binding, save behavior, or
account persistence. Roma Widget Defaults uses this presentation seam to bind
compiled controls to the account defaults draft document while Roma remains the
save authority.

## Builder Copilot

Builder Copilot uses Bob's compiled controls as the editable surface. The Bob
compiler emits Copilot vocabulary on each compiled control. Bob builds a control
snapshot from the current compiled widget and browser-memory instance state,
including current values and `showIf` visibility.

Bob handles deterministic Copilot turns locally before any network call:

- capability questions such as "what can you edit?"
- save/publish explanations
- translation explanations
- simple ambiguity prompts for visible controls
- out-of-domain redirects back to widget editing

For edit-looking prompts, Bob scopes the model-backed payload to visible controls
that match the current compiler-owned Builder vocabulary. If no visible control
matches, Bob answers locally instead of asking San Francisco to guess a product
target. Widget package source is not sent as Copilot prompt context.

When a prompt maps to more than one visible control, Bob asks a clarification
question and renders the compiler-owned choice labels as buttons. The pending
choice lives only in the Copilot browser-memory thread. Clicking a choice, or
typing a unique choice label/token, binds the next turn to that selected
visible control before any San Francisco request is made. A non-matching answer
fails visibly instead of being reinterpreted as a hidden target.

Model-backed turns still route through Roma to San Francisco, but San Francisco
receives an explicit Builder envelope: `instanceId`, `widgetType`,
`activeLocale`, `snapshotHash`, `turnClass`, optional `resolvedTarget`, the
scoped current control snapshot, `userMessage`, and `sessionId`. Bob remains the
owner of the open working copy and visible Builder-control meaning.

When San Francisco returns valid edit ops, Bob applies them immediately to the
browser-memory working copy and preview through the same in-memory op path used
by manual controls. Bob stores one inverse op set for a one-turn Undo. This does
not save, publish, or mutate account persistence; the user still saves through
the normal Roma save path.

Repeatable controls preserve item identity. If a compiled array control exposes
`itemIdPath`, Copilot insert values must include that id field and remove ops
must name `itemId`; index-based remove is accepted only for array controls with
no item identity.

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
