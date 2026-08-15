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
secondary action, and one Copy code host intent under More. Roma presents the
shared public-code Popup and performs the browser copy; Bob neither reconstructs
nor copies public values. In Compact mode TopDrawer also exposes the control
that opens Roma's existing navigation drawer.

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
state into that panel's controls. For JSON-bound Dieter controls, Bob writes the
exact value from that working state into the compiled `data-bob-path` field
marked with `data-dieter-json` before running the Dieter hydrator; the empty value authored in compiled panel
HTML is only an unbound placeholder, not product truth or a default. Changed-path
updates apply only while the same panel control surface remains mounted.
Before Bob replaces or unmounts that surface, it invokes the owning Bulk Edit,
Dropdown Actions, Border, Edit, Fill, Shadow, Upload, Object Manager, Repeater,
and Slider destroy functions; Bulk Edit releases its dialog lifecycle and
listeners, Edit detaches its Lexical root, Fill and Upload
invalidate pending asset resolution, and the collection controls release their
nested hydrators and retained draft state. Slider releases its native progress
listener.

Textfield and Valuefield use native input behavior and require no teardown.
Bob compiles exact caller labels and optional Textfield placeholders into the
panel; Dieter demonstration copy never becomes product copy. Valuefield edits
pass only when the input is finite and inside the exact caller-declared
inclusive bounds. Bob does not clamp, coerce, substitute, or enforce `step` as
a second value rule; signed caller ranges remain valid.

## Dieter Icons

Bob preserves Dieter `data-icon` names in compiled controls and application
chrome. Bob compiles Dieter CSS and hydrators from source. Hydration points each
declared icon slot at `/dieter/icons/svg/{name}.svg`; Bob does not import or
validate against an icon registry at runtime and does not inline SVG source. Decorative icons use
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
  "publicPackage": {
    "indexHtml": "[exact saved index.html]",
    "stylesCss": "[exact saved styles.css]",
    "runtimeJs": "[exact saved runtime.js]"
  },
  "fontLibrary": "[accountFontLibrary]",
  "policy": "[policySnapshot]",
  "accountPublicId": "[accountPublicId]",
  "instanceId": "[instanceId]",
  "publishStatus": "[published|unpublished]",
  "label": "[displayName]",
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
  "action": "[open-navigation|copy-code]"
}
```

Roma validates the Bob origin and frame source. `open-navigation` opens the
existing Roma navigation drawer. `copy-code` asks Roma to open the shared
public-code Popup for the exact published values already supplied in the current
Builder-open envelope.

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
Bob treats the save response as base-source and base-package persistence truth
only.

While that existing Save request is pending, TopDrawer keeps the same primary
Dieter Button, changes its exact caller-owned label to `Saving…`, sets the
Button's loading and busy state, disables repeat submission, and composes the
ordinary Dieter Spinner. The Spinner is presentation only; it does not start,
retry, complete, persist, or reinterpret the Save command.

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

Dirty/save comparison uses the current editor config directly; Bob does not
substitute an empty config when serialization fails.

## Translation Panel

Bob owns the Translations panel display for the open editor session. It does not
choose generation locales or write translation files.

The panel sends one Generate translations command with the open `instanceId`.
Roma resolves active locales and calls the Translation Agent Worker. While the
operation is running, Bob disables the button and displays transient Agent
Activity. Its static title comes from the open widget artifact's exact
`toolDrawerLabels.components["agent-activity"].title`; its dynamic rows are authored
by the Translation Agent while overlays are written. When the operation returns,
the transient Agent Activity UI disappears and Bob shows
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

## Product UI Language Scaffold

Bob's current product UI is English. ToolDrawer labels compile from each
widget's adjacent English label file, including the static Agent Activity title
and the field/component labels used by global Dieter stencils. Bulk Edit's
trigger, dialog, action, column, placeholder, and empty-state words use that
same Widget-adjacent contract. Its compiled string and boolean item controls
come directly from the existing Bulk Edit `path`, optional `row-path`, and
column declarations, so the complete modal Save batch uses the ordinary
compiled-control boundary without hidden Dropdown Fill fields. Bob also owns
the account-font capability
filtering applied to generic Dropdown Actions; Dieter does not inspect
typography paths or font metadata. Bob chrome and other reusable Dieter
component copy remain their current
English source. Bob receives no UI locale,
loads no UI-language file at runtime, and does not change an open editor
session's UI language. The person preference stored by Berlin/Michael is
dormant and is not a current Bob session input.

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
{widgetType}_tooldrawer_l10n_labels/en.json
widget.html
widget.css
widget.client.js
declared support files
```

`spec.json` carries defaults, editor structure, and ToolDrawer label tokens.
`{widgetType}_tooldrawer_l10n_labels/en.json` carries the exact English values
for those tokens, the five widget panel names, and migrated ToolDrawer copy
such as Agent Activity's title; Dropdown Border, Dropdown Edit, Dropdown Fill,
Dropdown Shadow and—when declared—Dropdown Upload field/component labels; and
Object Manager/Repeater collection labels and actions.
The Widget spec declares the exact state path and label-token coordinates; Bob
joins them with the one Dieter component without Widget-specific compiler
branches. `editable-fields.json`
carries editable/translatable field contracts. `limits.json` carries widget
capability context.

## Editor Artifact Build

The widget build compiles each canonical `spec.json` with its exact adjacent
English ToolDrawer label file into:

- `compiled.panels[]`
- `compiled.controls[]`
- `compiled.toolDrawerLabels`
- editor binding metadata
- AI context metadata

Compiler source lives under `bob/lib/compiler*`.
`scripts/widgets/generate-artifacts.ts` reads widget and Dieter source directly
from the repo and emits ignored editor artifacts under
`roma/public/widget-editors/` plus server-only materializer artifacts under
`roma/generated/`.
Normal product requests do not fetch Tokyo source, fetch Dieter stencils, or
compile controls.

The current editor artifact remains the English artifact at the existing URL.
Label files are build input; Bob does not fetch them, choose a locale, or
resolve label tokens at runtime. The compiler rejects missing and unused label
keys instead of substituting copy.

The editor artifact API is:

```text
GET /widget-editors/{widgetname}.json
```

Bob has same-origin static proxy routes for shared runtime resources:

```text
GET /dieter/icons/svg/{icon}
GET /fonts/**
```

Builder preview does not load widget source through a Bob `/widgets/**` proxy.
Roma opens the instance with its saved `index.html`, `styles.css`, and
`runtime.js` package. Bob boots that exact package in the sandboxed iframe, then
streams unsaved browser-memory state into the running instance runtime.

The Bob-local AI API route is a guard route only:

```text
POST /api/ai/widget-copilot -> 409
```

Copilot turn traffic must run through the Roma account route.

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

Menu Actions is Dieter's unbound native action row. Bob supplies exact Chrome
wording for application commands such as Copy code and uses the same primitive
inside Dropdown Actions compiled from Widget-owned labels. Menu Actions does
not write instance state or interpret those commands; the enclosing Bob or
Dropdown Actions flow owns the action, selection, and dismissal.

Object Manager and Repeater compile from the same Widget-owned collection
truth. The Widget declares the array path, item template, exact new-item
object, stable-id coordinate, limits, structural permission, and every word.
Bob resolves those `$label` inputs from the adjacent English ToolDrawer file
and joins them to the global Dieter stencils. Object Manager owns top-level
object editors and, only when declared, the Add plus drafted reorder/delete
workflow. Repeater owns inline add/remove/reorder for either a top-level or
nested declared array. Nested fields retain neutral `data-path`; only each true
outer collection field also carries `data-bob-path`. Child arrays fold into
their parent before one exact outer JSON array reaches the ordinary
browser-memory control host; neither Bob nor
Dieter infers an item shape, default, permission, or Widget-specific action.
The FAQ section-title derived control retains its adjacent Widget-owned label in
compiled control metadata. Logo Showcase's declared add-open selector targets
its exact sibling Bulk Edit without a Widget branch in Dieter.

Segmented controls keep native radio truth. Logo Showcase Widget options,
Dropdown Fill modes, Bob's Manual/Copilot mode, and Desktop/Mobile preview all
compose direct Segment content; Bob does not mirror checked state through a
nested Button or `aria-pressed` helper.

Dropdown Edit is the shared Dieter inline rich-text control. Bob compiles every
Widget `type="dropdown-edit"` declaration with that Widget's adjacent English
field and component labels, then binds its existing compact inline HTML string
to the control. The locally bundled Lexical engine owns editing only; Bob still
owns the browser-memory draft, undo, preview, and Save boundary. Every Dropdown
Edit field supports inline emphasis, links, line breaks, selected-only format
clearing, and pasted inline formatting. The link sheet presents one contextual
Widget-labeled action: **Add link** for selected unlinked text or **Remove
link** for an existing link; its close action also receives its accessible name
from the exact Widget-owned component-label shape. The URL input is private
Dropdown Edit UI, so it does not resolve to or mutate Bob's bound rich-text
path while the user types. It has no Apply/Update, second link action, nested
Popover, or standalone link component. No
per-field link flag, Widget branch, runtime catalog fetch, or Lexical storage
document exists.

Dropdown Fill is the shared Dieter exact-JSON fill control. Every source field
declares its supported modes through `fill-modes`; Bob does not infer media
capability from the field path, label, or Widget. The compiler joins the exact
Dropdown Fill component-label shape and shared generated field labels from the
Widget's adjacent ToolDrawer English file into the one Dieter stencil. Bob
supplies the current account-assets client and continues to own only the
browser-memory draft and existing asset commands. Gradient values retain their
declared `linear|radial|conic` kind; the removed CSS-only gradient shape is not
accepted as a compatibility value. The Dieter primitive owns Enabled and its
existing Segmented mode selector. Bob receives only the exact fill input event;
it does not own a parallel enabled field, remove-fill action, mode UI, or Fill
layout rule.

Dropdown Shadow is the shared Dieter exact-JSON shadow editor. The compiler
joins its exact fourteen component/composition labels and every generated Stage/Pod/card
field label from the Widget-adjacent English file into the one global stencil.
Bob prebinds the exact browser-memory object before hydration and receives one
whole-object edit at the declared path. The linked toggle and the active Shadow
object each write only their own declared path; Bob does not copy `all` into the
four side values or merge the side values back into `all`. Hidden linked and
unlinked values therefore remain exact browser-memory truth. Dieter emits no
multi-path edit and does not inspect Widget paths. Bob's shared host destroys Shadow with the other retained dropdowns
before panel replacement.

Dropdown Upload is the shared Dieter single-file account-asset editor. It
compiles as one JSON control at one Widget path and binds exact `null` or
`{assetRef:string,name:string}` browser-memory truth. The compiler joins the
exact five component words from the declaring Widget's adjacent English label
file; it does not retain the retired second metadata path or source marker.
The component uses Bob's existing account-assets client and current-account
command chain. None of the five current Widget specs declares it, so current
editor artifacts contain no Upload control and this component pass does not
invent one.

The shared Widget runtime renders Stage, Pod, and supported Core-card shadows
from that exact object. Internal shadows are real comma-separated inset
`box-shadow` values, never directional gradient substitutions. Stage outside
shadow receives deterministic document gutters derived from its exact signed
offset, blur, and spread; Bob accepts the resulting width/height resize message
and removes only its loading backdrop after Widget ready so the Stage shadow is
visible in preview.

For Dropdown Border, Edit, Fill, and Shadow, Bob's existing stencil compiler
passes Dieter's `row|wide|extra-wide` Popover width through the generated
control. Border, Fill, and Shadow resolve their component-owned `wide` default;
Edit resolves `extra-wide`. An explicit Widget field attr may select another
contract value without changing the dropdown's actual job. `row` matches the
closed row; `wide` and `extra-wide` add 40px or 80px to the open surface's
right edge. Dieter's shared Popover positioning keeps the left edge on the row
and overlays the workspace so Bob does not resize the ToolDrawer, workspace, or
editor session. The width choice does not change the control's value or
behavior.

Bob's visible control taxonomy is `Panel > Section > optional Group > Control`.
Widget specs own the five fixed widget panel ids and label-token coordinates;
the adjacent English file owns widget-authored ToolDrawer copy. Bob rejects
unknown panels, unresolved labels, unused English entries, and unlabeled
sections. Resolved panel labels travel in the compiled artifact instead of
being re-created by compiler and UI consumers. Group
labels remain semantic control metadata, but the UI does not repeat a group
heading when it is identical to its enclosing section label.
Technical group ids are never converted into UI or Copilot labels; an absent
semantic group label remains absent.

Sections start collapsed unless the structured widget contract explicitly sets
`initiallyOpen`. On initial widget open, only the shared Header section and one
primary Content section are open; both remain user-collapsible. Layout,
Appearance, Typography, and Settings sections start collapsed. This policy is
compiled once and is shared by Builder and Roma's compiled-control consumers.

Resolved labels and source attribute values are never HTML-encoded. Bob parses each
internal ToolDrawer attribute into its raw value once and escapes it once when
rendering final markup. Every-widget contract tests enforce the taxonomy,
initial-state, and entity round-trip rules.

Typography family controls are account-independent in compiled widget
artifacts. Session open binds them to the current account `fontLibrary`; that
bound contract drives manual controls, Copilot choices, and normal config
validation. The library includes the system Google fonts and seven global
`source: "tokyo"` special fonts for every account, plus any account-uploaded
font records. Bob contains no separate default-account font catalog. A family
change is expanded through the shared account-font resolver into one atomic
family/weight/style edit.

Bob also exposes a narrow `@clickeen/bob/control-host` module and paired
`@clickeen/bob/control-host.css` stylesheet for non-editor surfaces that must
reuse Builder control behavior and presentation. Those exports are limited to
compiled-control DOM helpers and cluster/group presentation, Dieter hydrator
execution and cleanup, show-if visibility, Dieter JSON field
serialization/parsing, and the pure
account-font family transition adapter. It does not export
Bob session state, live edit application, preview binding, save behavior, or
account persistence. Roma Widget Defaults uses this presentation seam to bind
compiled controls to the account defaults draft document while Roma remains the
document and save authority. Persisted typography is accepted only when Roma's
package boundary confirms that the selected family, weight, and style belong to
the current account library.

## Builder Copilot

Product Copilot turns route through Roma with a bounded `currentDraftContext`
capsule. Bob builds that capsule from the open browser-memory draft:
`instanceId`, widget identity, active locale, draft signature, visible editable
controls with current values, unavailable capabilities, and bounded
`conversationHistory` from Bob's structured model history. `showIf`-hidden
controls are excluded from the capsule. Widget package source is not sent as
Copilot prompt context.

Conversational Product Copilot turns require the widget/session orientation,
but they do not require a valid edit-control catalog. If Builder control
metadata is invalid or unavailable, Bob still allows the turn so Product
Copilot can answer, clarify, suggest, refuse, or report an error. The
`apply_widget_ops` tool remains unavailable until the edit context is valid.

Bob does not pre-route user language with regex/control matching before the
agent sees the turn. The Copilot turn streams `ProductCopilotTurnEvent` frames
(`agent_turn_started`, `text_delta`, `tool_call`, `model_step_finished`,
`agent_turn_finished`, `agent_turn_error`, `agent_turn_stopped`). Bob renders
`text_delta` incrementally and executes a buffered `tool_call` only after the
matching `model_step_finished`. Bob remains the owner of the open working copy,
model-visible Product Copilot thread context, terminal draft validation, and
reversible draft apply. San Francisco does not store Product Copilot thread
state.

Product Copilot model picker state is display/input state only. Bob renders the
model options and default model that Roma sends in the Builder-open payload.
Bob sends a `selectedModel` override only when Roma explicitly set
`allowModelPicker: true`; when no picker is allowed, Bob sends no selected model
and Roma/San Francisco use the policy default. Bob does not own model lists,
model availability, provider keys, provider catalog monitoring, or automatic
alternate model selection.

When a `tool_call` carries a valid `apply_widget_ops` batch and the matching
`model_step_finished` arrives, Bob applies the batch to the browser-memory
working copy and preview through the same in-memory op path used by manual
controls. Bob then opens a continuation carrying the tool result and the
`priorModelStepId`, so the agent can finish or request another step. Inverse
undo ops accumulate across the steps of one turn so a single Undo reverses the
whole applied batch. This does not save, publish, or mutate account persistence;
the user still saves through the normal Roma save path.

Repeatable controls preserve item identity. If a compiled array control exposes
`itemIdPath`, Copilot insert values must include that id field and remove ops
must name `itemId`; index-based remove is accepted only for array controls with
no item identity.

### Copilot turn lifecycle

The CopilotPane tracks two facts per active turn: the active turn state
(`userTurnId`, current `modelStepId`, buffered tool call, accumulated undo ops,
step count, stop flag) and the active HTTP request handle. `session.runCopilot`
returns a `CopilotRequestHandle` carrying the `requestId` and a `completed`
promise; it does not block on the whole agent turn. `session.cancelCopilot`
dispatches the `cancel-copilot` host command for that `requestId`.

The input control is a single Send/Stop toggle. Send opens an initial turn;
Stop is UI truth. Bob marks the active turn stopped immediately on its own Stop
action and does not wait for a server `agent_turn_stopped` event through the
stream it is about to abort. Late events for a stopped turn are ignored and no
further continuation is sent. Already-applied ops remain and can be undone.

Bob enforces a tier step limit read from the signed policy
(`limits.maxTurnsPerThread`, default 30) and refuses a continuation past that
limit with a visible assistant message. Bob keeps a structured model history
(`bob/lib/copilot/model-history.ts`) of user/assistant entries plus tool calls
and results; this is the history sent on each request and is separate from the
visible text-only chat bubbles.

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

Global `source: "tokyo"` fonts are not account dependencies. Preview loads their
declared `/fonts/special/**` paths through Bob's same-origin Tokyo proxy.

Preview represents the in-memory working copy. Public snippets point at the
published static URL:

```text
https://clk.live/{accountPublicId}/{instanceId}
```

Roma owns public-widget action truth for the current account and opened
instance. It constructs the exact public URL and iframe/script snippets and
sends either that complete set or `null` in the Builder-open envelope. Bob
fails a published open when that set is incomplete and presents Open public
widget plus one Copy code intent in TopDrawer. Roma handles that intent with
the same public-code Popup used by the Widgets inventory. Bob never constructs
or copies those values from editor state. Unpublished instances expose no live
actions.

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

Dropdown Fill uses this route chain to upload and assign media. The
consumer-agnostic Dropdown Upload component uses the same existing route chain
when a Widget declares one single-file field; none of the five current Widget
specs does. SVG logos are accepted vector assets when Roma/Tokyo-worker accept
the upload.

Bob does not expose account asset proxy routes. Account asset list, upload,
resolve, and delete operations stay behind Roma current-account routes.
Bob's existing session transport is the account-asset UI adapter: it validates
the exact Roma response shapes and classifies the two current account-plan
upload denial reason keys through the caller-owned asset client. Fill or Upload
then emits the existing generic Dieter upsell event for an exact classified
reason. Dieter never parses Roma payloads or decides which account-policy
reasons qualify.

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
the save response as base-source and base-package persistence truth.

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
AI execution for the current account and relays the Product Copilot SSE stream.
San Francisco executes each model step and streams `text_delta`, `tool_call`,
`model_step_finished`, and `model_step_error` through Product Copilot. Bob
renders text deltas incrementally, executes a tool batch only after its
`model_step_finished`, applies valid editor operations locally, accumulates
inverse undo ops across the turn, and preserves `userTurnId`/`modelStepId`
correlation in the conversation.

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

| Name                    | Purpose                                                                   |
| ----------------------- | ------------------------------------------------------------------------- |
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
