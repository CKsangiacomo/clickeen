# Bob - Widget Editor

STATUS: CURRENT SYSTEM OPERATOR SPEC

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

## Workspace Capability

Under accepted 126 law, Bob follows the global operational-workspace tenet in
`documentation/engineering/UI/surfaces.md`. As Roma's editor, its ToolDrawer,
workspace, preview, and dialogs must remain fully operable on desktop and
tablets in either orientation and recompose for mobile landscape. Mobile
portrait does not receive a broken editing approximation. Pixel density affects
rendering fidelity, not workspace classification. Bob keeps one editor model:

```text
Bob
├── TopDrawer
│   ├── host/editor context
│   └── editor actions
└── EditorContent
    ├── ToolDrawer
    │   ├── ToolDrawerHeader
    │   └── ToolDrawerContent
    └── Workspace
        ├── Preview
        ├── StatusOverlay
        └── WorkspaceControls
```

Full mode presents `ToolDrawer | Workspace` inside `EditorContent`. Compact
mobile landscape presents the same ToolDrawer as an explicit drawer over the
full Workspace. No editor operation disappears and no separate mobile Builder
is created.

Bob does not consume Dieter's application Layout/Page contract. Its
`ToolDrawer | Workspace` structure is a distinct editor composition and remains
locally owned. Bob consumes applicable shared component contracts, including
Popup for its plan-limit prompt; Table remains available where a semantic table
is needed.

Bob operational chrome selects only the complete Dieter visual typography
classes revealed by DevStudio. It does not assemble local typography from font
family, size, weight, line-height, or tracking declarations and gives technical
strings no automatic monospace treatment. This operational rule does not alter
Bob's separate account-authored public-widget typography controls.

Bob provides that composition directly. Full mode keeps the persistent
ToolDrawer when both usable dimensions are at least `600px`. Compact mode uses
the same ToolDrawer as an overlay when either usable dimension is smaller.
Coarse-pointer mobile portrait below `600px` shows the explicit
`Rotate your device or use a larger screen` boundary. The compact drawer opens
and closes without remounting the editor session or replacing any ToolDrawer
operation.

When Roma hosts an active Bob session, Roma's `page` contains only the
full-canvas Builder body. Roma does not place a Page header, generic action
band, padding, or module frame around Bob. `TopDrawer` is Bob-owned editor
chrome, not a Roma Page header. It holds the instance label and publish state,
Save as the primary editor action, Open public widget as the applicable
secondary action, and public copy operations under More. A return control is
context navigation rather than another CTA. In Compact mode TopDrawer also
exposes the control that opens Roma's existing navigation drawer.

## Authoring Flow

The active account authoring flow is:

1. Roma resolves the current account and opened `instanceId`.
2. Roma opens one saved widget document.
3. Roma loads the deploy-built widget editor artifact.
4. Roma sends Bob a `ck:open-editor` message.
5. Bob validates the open payload and stores `{ compiled, instanceData }` in
   React state.
6. Bob edits that working state in browser memory.
7. User presses Save.
8. Bob sends the save intent to Roma.
9. Roma saves the current account instance through Tokyo-worker.

Between open and save, Bob writes no account persistence.

Ordinary control edits are path operations against the already validated open
document. Bob applies the compiled control allowlist and value contract to the
changed path, updates only affected panel controls, and sends the resulting
working state to the preview. Object, JSON, array, insert, remove, and move
operations revalidate the complete document because they can change its shape.
Bob also validates the complete document when opening and before saving.
Opening or rebuilding a panel projects the complete browser-memory working
state into that panel's controls. Changed-path updates apply only while the same
panel control surface remains mounted.

## Dieter Icons

Bob preserves Dieter `data-icon` names in compiled controls and application
chrome. Bob compiles Dieter CSS and hydrators from source. Hydration points each
approved icon slot at `/dieter/icons/svg/{name}.svg`; Bob does not import the
icon registry at runtime or inline SVG source. Decorative icons use
`aria-hidden="true"`; icon-only controls keep the accessible name on the
control. Unfamiliar ToolDrawer icon actions use the Dieter CSS tooltip contract
on hover and keyboard focus without changing their command behavior.

## Open Contract

Bob announces readiness:

```json
{
  "type": "bob:session-ready"
}
```

Roma opens Bob:

```json
{
  "type": "ck:open-editor",
  "requestId": "[requestId]",
  "widgetname": "[widgetType]",
  "baseLocale": "[baseLocale]",
  "compiled": "[compiledWidgetPayload]",
  "instanceData": "[savedInstanceData]",
  "fontLibrary": "[accountFontLibrary]",
  "policy": "[policySnapshot]",
  "accountPublicId": "[accountPublicId]",
  "instanceId": "[instanceId]",
  "publishStatus": "[published|unpublished]",
  "label": "[displayName]",
  "returnLabel": "[optional host return label]",
  "publicActions": {
    "publicUrl": "[exact published URL]",
    "iframeSnippet": "[exact iframe snippet]",
    "scriptSnippet": "[exact script snippet]"
  },
  "copilot": "[copilotRuntimeUi]",
  "translationSetup": "[translationSetup]"
}
```

Bob replies with:

```json
{
  "type": "bob:open-editor-applied",
  "requestId": "[requestId]",
  "instanceId": "[instanceId]",
  "widgetname": "[widgetType]"
}
```

or:

```json
{
  "type": "bob:open-editor-failed",
  "requestId": "[requestId]",
  "reasonKey": "[reasonKey]",
  "message": "[message]"
}
```

Open succeeds only with explicit deploy-built widget editor software, explicit saved
instance data, and the current account font library from Roma. Missing or
malformed `fontLibrary` fails open; Bob does not invent fallback font choices.

Bob also notifies Roma when the browser-memory working copy changes:

```json
{
  "type": "bob:dirty-state-changed",
  "isDirty": "[true|false]"
}
```

Bob sends host navigation intents without owning Roma routes:

```json
{
  "type": "bob:host-action",
  "action": "[open-navigation|return]"
}
```

Roma validates the Bob origin and frame source. `open-navigation` opens the
existing Roma navigation drawer. `return` follows Roma's sanitized return
coordinate and existing unsaved-work guard.

Roma replies to account commands with:

```json
{
  "type": "host:account-command-result",
  "requestId": "[requestId]",
  "ok": "[true|false]",
  "command": "[command]",
  "status": "[httpStatus]",
  "payload": "[commandPayload]"
}
```

Bob's plan-limit/upsell prompt may close through Escape, backdrop, or its
explicit Not now/Close action because dismissal loses no work. That D1 dismissal
rule does not weaken route/policy enforcement and does not decide what Upgrade
does.

Bob may also send an Upgrade intent from a plan-limit/upsell surface:

```json
{
  "type": "bob:upsell",
  "cta": "upgrade",
  "reasonKey": "[reasonKey]"
}
```

Roma owns the account-shell transition and opens its one reusable pre-GA upsell
dialog scaffold. It does not route the user to inactive Billing or duplicate
the scaffold inside Bob. Bob does not expose raw entitlement/detail strings
inside the upsell surface, and Bob/Roma must not stack the scaffold over an
existing plan-limit modal.

The scaffold is a real UI destination for developing the upsell experience; it
does not purchase, mutate a plan, call a billing provider, or claim commercial
success. Opening it preserves Bob's unsaved working state and must not invoke a
discard confirmation. Bob uses the shared native-dialog lifecycle for this
prompt. Final 126M integration re-verified this completed behavior through the
deployed Bob-to-Roma path.

## Save Contract

Save persists the one widget document currently open in Builder.

Bob sends the current working config and explicit instance coordinates back to
Roma:

- widget type
- display name
- base locale
- current config/content state

Bob sends this as a `bob:account-command` with `command: "update-instance"`.
Roma reads the deploy-built materializer artifact, materializes the browser
package files, and performs the account save command. Tokyo-worker stores the
saved source and package under:

```text
accounts/{accountPublicId}/instances/{instanceId}/
```

Save is separate from manual translation generation, publish, unpublish, rename,
duplicate, and delete. Roma does not generate translations, regenerate
translations, or mutate locale overlays from the `update-instance` command.
Bob treats the save response as source/root persistence truth only.

When translations need update, that attention belongs to the Translations panel.
[`interactions.md`](../engineering/UI/interactions.md) owns interaction feedback
behavior. The Bob/Roma UI execution PRDs own any future top-of-builder attention
surface that points the user to the Translations panel and the explicit Generate
translations action when exact stale-translation evidence exists. Bob must not
infer that state from runtime package probes, active locale count alone, or
hidden UI-authored status.

Bob account commands currently include:

- `update-instance`
- `list-assets`
- `resolve-assets`
- `upload-asset`
- `list-translations`
- `read-translation`
- `generate-translations`
- `run-copilot`
- `attach-ai-outcome`

Dirty/save comparison uses the current editor config directly; Bob does not
substitute an empty config when serialization fails.

## Translation Panel

Bob owns the Translations panel display for the open editor session. It does not
choose generation locales or write translation files.

The panel sends one Generate translations command with the open `instanceId`.
Roma resolves active locales and calls the Translation Agent Worker. While the
operation is running, Bob disables the button and displays transient Agent
Activity rows authored by the Translation Agent while overlays are written. When
the operation returns, the transient Agent Activity UI disappears and Bob shows
durable command-result feedback from Roma's response: success, no accepted
work, command failure, or exact per-locale translation failures. Bob refreshes
previewable translated locales only when
Roma reports at least one `translatedLocales` result.

Bob does not create persistent translation jobs, poll operation status, or
invent locale authority. Bob also does not expose user translation overrides or
a field-level overlay editor. Saved locale overlay files remain
Tokyo-worker/R2 state.

Agent Activity is a core product UI concept. Bob renders the agent's narration;
it does not summarize, reinterpret, probe, reconcile, or persist it.

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
editable-fields.json
limits.json
widget.html
widget.css
widget.client.js
declared support files
```

`spec.json` carries defaults and editor structure. `editable-fields.json`
carries editable/translatable field contracts. `limits.json` carries widget
capability context.

## Editor Artifact Build

The widget build compiles each canonical `spec.json` once into:

- `compiled.panels[]`
- `compiled.controls[]`
- editor binding metadata
- AI context metadata

Compiler source lives under `bob/lib/compiler*`.
`scripts/widgets/generate-artifacts.ts` reads widget and Dieter source directly
from the repo and emits ignored editor artifacts under
`roma/public/widget-editors/` plus server-only materializer artifacts under
`roma/generated/`.
Normal product requests do not fetch Tokyo source, fetch Dieter stencils, or
compile controls.

The editor artifact API is:

```text
GET /widget-editors/{widgetname}.json
```

Bob has same-origin static proxy routes for shared runtime resources:

```text
GET /dieter/icons/svg/{icon}
GET /l10n/**
```

Builder preview does not load widget source through a Bob `/widgets/**` proxy.
Roma opens the instance with its saved `index.html`, `styles.css`, and
`runtime.js` package. Bob boots that exact package in the sandboxed iframe, then
streams unsaved browser-memory state into the running instance runtime.

The Bob-local AI API routes are guard routes only:

```text
POST /api/ai/widget-copilot -> 409
POST /api/ai/outcome -> 409
```

Copilot traffic must run through Roma account routes.

Editor artifacts contain no raw widget HTML, CSS, JavaScript, or materializer
package. Roma's server-only materializer reads a separate build artifact.

## Controls

Editor controls are defined by widget specs using the Bob ToolDrawer DSL.

Common primitives include:

- `<bob-panel>`
- `<tooldrawer-field>`
- `<tooldrawer-cluster>`
- Dieter-backed form controls

Controls emit edit operations. The edit engine applies those operations to the
current in-memory instance state.

Typography family controls are account-independent in compiled widget
artifacts. Session open binds them to the current account `fontLibrary`; that
bound contract drives manual controls, Copilot choices, and normal config
validation. Bob contains no default-account font catalog. A family change
is expanded through the shared account-font resolver into one atomic
family/weight/style edit.

Bob also exposes a narrow `@clickeen/bob/control-host` module and paired
`@clickeen/bob/control-host.css` stylesheet for non-editor surfaces that must
reuse Builder control behavior and presentation. Those exports are limited to
compiled-control DOM helpers and cluster/group presentation, Dieter hydrator
execution, show-if visibility, field value serialization/parsing, and the pure
account-font family transition adapter. It does not export
Bob session state, live edit application, preview binding, save behavior, or
account persistence. Roma Widget Defaults uses this presentation seam to bind
compiled controls to the account defaults draft document while Roma remains the
document and save authority. Persisted typography is accepted only when Roma's
package boundary confirms that the selected family, weight, and style belong to
the current account library.

## Builder Copilot

Product Copilot turns route through Roma with a bounded
`product-copilot context` capsule. Bob builds that capsule from the open
browser-memory draft: `instanceId`, widget identity, active locale, draft
signature, visible editable controls with current values, unavailable
capabilities, and bounded `conversationHistory` from Bob's browser-memory
Copilot thread. `showIf`-hidden controls are excluded from the capsule. Widget
package source is not sent as Copilot prompt context.

Conversational Product Copilot turns require the widget/session orientation,
but they do not require a valid edit-control catalog. If Builder control
metadata is invalid or unavailable, Bob still allows the turn so Product
Copilot can answer, clarify, suggest, refuse, or report an error. Draft edits
remain unavailable until the edit context is valid.

Bob does not pre-route user language with regex/control matching before the
agent sees the turn. The Product Copilot brain returns one typed result kind:
`answer`, `clarification`, `suggestion`, `draft_edit`, `refusal`, or `error`.
Bob remains the owner of the open working copy, model-visible Product Copilot
thread context, terminal draft validation, and reversible draft apply.
San Francisco does not store Product Copilot thread state.

Product Copilot model picker state is display/input state only. Bob renders the
model options and default model that Roma sends in the Builder-open payload.
Bob sends a `selectedModel` override only when Roma explicitly set
`allowModelPicker: true`; when no picker is allowed, Bob sends no selected model
and Roma/San Francisco use the policy default. Bob does not own model lists,
model availability, provider keys, provider catalog monitoring, or automatic
alternate model selection.

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

Bob preview loads the saved instance package in a sandboxed iframe and streams
working state updates into its runtime:

```json
{
  "type": "ck:state-update",
  "widgetname": "[widgetType]",
  "state": "[workingState]",
  "device": "[desktop|mobile]"
}
```

Widget runtime sends:

```json
{
  "type": "ck:ready"
}
```

`ck:ready` acknowledges the first state applied by one iframe document. Bob's
generic `Loading preview...` status therefore belongs only to that initial
iframe boot and resets only when a different saved public package recreates the
iframe document. It is not an edit-progress signal.

When an in-memory edit introduces an unresolved account media or font
reference, Bob keeps the last successfully rendered preview visible, resolves
the dependency through Roma, materializes the resolved URL, and sends the
updated state to the existing iframe. Resolution failure is an explicit preview
error. A later valid dependency resolution clears that dependency error; Bob
does not reload the iframe, repeat `ck:ready`, or present an iframe failure as a
ready preview.

Preview represents the in-memory working copy. Public snippets point at the
published static URL:

```text
https://clk.live/{accountPublicId}/{instanceId}
```

Roma owns public-widget action truth for the current account and opened
instance. It constructs the exact public URL and iframe/script snippets and
sends either that complete set or `null` in the Builder-open envelope. Bob
fails a published open when that set is incomplete, presents the supplied
actions in TopDrawer, and performs the user-requested browser copy. Bob never
constructs those values from editor state. Unpublished instances expose no
live actions.

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

The Translations panel shows one explicit account operation:

```text
Generate translations
```

Bob sends only the opened `instanceId` to Roma. Roma resolves the account,
active locales, tier, saved instance source, and Translation Agent grant. Bob
does not send locale authority for generation.

The normal save command is source/base persistence only. Roma does not generate
translations, regenerate translations, or mutate locale overlays. Bob treats
the save response as source/root persistence truth.

After Roma returns, Bob refreshes the overlay list only when at least one locale
translated and lets the user preview active locales that have saved overlay
values in the actual widget preview.
Bob does not render the overlay value map as editable fields or inspection
rows. Tokyo-worker stores translated locale values under:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

Translation generation remains an explicit operation from the Translations
panel. When translations need update after source edits,
[`interactions.md`](../engineering/UI/interactions.md) owns the feedback behavior
and the Bob/Roma UI execution PRDs own the placement that points the user to
Generate translations.

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
output: bob/.cloudflare/output/static
```

Package commands:

```bash
pnpm --filter @clickeen/bob typecheck
pnpm --filter @clickeen/bob lint
pnpm --filter @clickeen/bob build:cf
```

Cloudflare Pages config:

```text
project: bob-dev
output: .cloudflare/output/static
compatibility flags: nodejs_compat_populate_process_env, nodejs_compat
```

Runtime env:

| Name | Purpose |
| --- | --- |
| `NEXT_PUBLIC_TOKYO_URL` | Tokyo public static/resource origin for widget software and Dieter media. |

Before any Cloudflare Pages, custom-domain, DNS, or Pages config operation, run:

```bash
pnpm cf:api:preflight
```

Runtime evidence comes from cloud-dev Cloudflare surfaces.

## Hard Stops

- Do not add account persistence inside Bob.
- Do not save package files from Bob.
- Do not let Bob choose account locales, tier policy, model availability, or storage paths.
- Do not create Bob account asset API routes; asset commands go through Roma.
- Do not treat Builder preview as public serving evidence.
