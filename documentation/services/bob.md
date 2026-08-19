# Bob - Widget Editor

STATUS: CURRENT SYSTEM OPERATOR SPEC

Bob is Clickeen's widget editor. It loads widget software and one saved widget
instance, edits the instance in browser memory, previews the working state, and
delegates persistence back to Roma.

Bob is one shared service used by every Widget through the same structured
editing contract. It is not the Widget, and it does not own, infer, validate,
or reinterpret a Widget's unique product meaning. That meaning belongs to the
Widget's structured contract and mandatory Core HTML/CSS/JavaScript.

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

For Widget-bound tier limits, Bob is the shared user-intent enforcement host,
not the policy or copy owner. Roma supplies the exact account policy snapshot;
the compiled Widget contract maps its unique edit coordinate to a generic
system capability and an exact Widget upsell message identity. Bob applies
that one decision before mutating its browser-memory draft. An allowed edit is
applied normally. A denied edit leaves the draft unchanged and sends the
capability/message identity to Roma for the single shared account upsell Popup.
Bob does not own plan names, target-plan selection, Upgrade behavior, or a
parallel popup.

Bob verifies browser origin because the Roma/Bob iframe is an external browser
security boundary. After that origin is established, Bob trusts Roma's exact
open envelope and every deploy-built Clickeen artifact inside it. Bob accepts
direct human edits and model-produced edit operations at their owning ingress;
it does not install a second semantic validation layer over system-produced
Widget software, saved state, fonts, assets, packages, or Roma command results.

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
locally owned. Bob consumes applicable shared component contracts; Table
remains available where a semantic table is needed. Roma hosts the shared
account upsell Popup outside Bob rather than asking Bob to compose another
plan-limit dialog.

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

When Roma hosts an active Bob session, Roma's `page` contains the full-canvas
Builder plus a slim Roma-owned header composed from the frozen Dieter
`page__header` part (`h1.heading-6` instance label in the standard domain
register plus `page__actions` publication controls; no border, shadow, or
local shell restatement). It carries the
instance label and the same Roma publication control used by Widgets
inventory. `TopDrawer`
is Bob-owned editor chrome and contains editing tools, dirty state, and Save
only; it has no publication state, Publish/Republish/Unpublish command, public
URL/code action, or release receipt. In Compact mode TopDrawer also exposes the
control that opens Roma's existing navigation drawer.

## Authoring Flow

The active account authoring flow is:

1. Roma resolves the current account and either an opened `instanceId` or a New
   `widgetType`.
2. For a saved target, Roma reads the exact atomic source document.
   For New, Roma composes defaults into a browser draft without any instance
   storage operation.
3. Roma loads the deploy-built Widget editor artifact.
4. Roma sends Bob a `ck:open-editor` message.
5. After the browser-origin check, Bob trusts the Roma-produced open envelope
   and stores `{ compiled, instanceData }` in React state.
6. Bob edits that working state in browser memory.
7. User presses Save.
8. Bob sends the save intent to Roma.
9. Roma prepares the editable source payload and Tokyo-worker writes one exact
   atomic `instance.source.json`. A later explicit allowed Publish owns package
   materialization.

Between open and save, Bob writes no account persistence.

Ordinary control edits are path operations against the trusted open document.
Bob applies the operation declared by the compiled control, updates only the
affected panel controls, and sends the resulting working state to the preview.
Object, JSON, array, insert, remove, and move operations use that same declared
editing contract; they do not trigger a whole-document semantic revalidation.
Opening or rebuilding a panel projects the complete browser-memory working state
into that panel's controls. For JSON-bound Dieter controls, Bob writes the exact
value from that working state into the compiled `data-bob-path` field marked
with `data-dieter-json` before running the Dieter hydrator; the empty value
authored in compiled panel HTML is only an unbound placeholder, not product
truth or a default. Changed-path updates apply only while the same panel control
surface remains mounted.

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
  "instanceData": "[exactDraftData]",
  "fontLibrary": "[accountFontLibrary]",
  "policy": "[policySnapshot]",
  "accountPublicId": "[accountPublicId]",
  "instanceId": "[instanceId|null]",
  "label": "[displayName]",
  "copilot": "[copilotRuntimeUi]",
  "translationSetup": "[translationSetup]"
}
```

The compiled editor artifact carries exact deploy-built `widgetSoftware`:
`widgetHtml`, `coreHtml`, `coreCss`, `coreJs`, and the ordered shared/Core style
and script sources. Bob uses that source only for preview. It creates no
registry, runtime source fetch, route, or account object.

The open contract contains no publication status, timestamps, public actions,
or stored `publicPackage`; release truth is Roma-owned and public bytes are not
editable truth. A New draft opens with `instanceId: null`, and a saved but
never-published instance also opens normally.

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

Roma sends explicit deploy-built Widget editor software, exact instance data,
the optional saved instance identity, and the current account font library as
one authoritative open envelope.
Bob uses those values directly and never invents fallback font choices. If Roma
cannot produce the envelope, Roma returns the owning operation failure and does
not open the session; Bob does not independently guard or reinterpret the
system-produced fields after receipt.

Bob also notifies Roma when the browser-memory working copy changes:

```json
{
  "type": "bob:dirty-state-changed",
  "isDirty": "[true|false]"
}
```

Bob sends its one host intent without owning Roma routes:

```json
{
  "type": "bob:host-action",
  "action": "open-navigation"
}
```

Roma validates the Bob origin and frame source. `open-navigation` opens the
existing Roma navigation drawer. Publication does not cross the Roma-to-Bob
protocol.

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

Bob sends `save-instance` with its complete draft. When the open envelope has
no instance identity, Bob includes `widgetType` with `config`; Roma POSTs that
exact First Save and replies HTTP 201 with the minted ID and exact current
account `baseLocale` persisted for the source.
The Builder host adopts the ID in the visible URL without a route remount; Bob
adopts the ID and `baseLocale` from that same result into its current
`meta`/`translationSetup` without a second `ck:open-editor` or another message.
This does not serialize First Save against a simultaneous account-locale PATCH.
Later Save uses the same command but its body contains `config` only. Roma uses
the account/instance coordinate and Tokyo's stored list fact for Widget
identity; Bob does not resend `widgetType`. Publication and cache state never
enter this command/result protocol.

When Bob's generic edit boundary denies a Widget-bound action, Bob sends only
the exact denied system capability and Widget-owned message identity from the
trusted compiled artifact:

```json
{
  "type": "bob:upsell",
  "capability": "[systemEntitlementKey]",
  "messageId": "[widgetUpsellMessageId]",
  "required": "[boolean|number]"
}
```

Roma already owns the active Builder session and compiled Widget artifact. It
uses that identity to obtain the exact localized Widget body template, combines
it with system-owned current/target plan truth and system-owned actions, and
opens one Roma-hosted Dieter Popup. `required` is the exact attempted Boolean
or numeric demand and lets Roma select the first higher system tier that
actually permits the edit. Bob never sends plan names, renders the template,
chooses a target plan, supplies CTA copy, or opens a second dialog.
Dismissal loses no work because the denied operation never changed the draft.

Local implementation: every current compiled Widget artifact carries its exact
limit-to-message map and English templates. Bob's common operation gate applies
the system decision before manual, Product Copilot, or undo mutation. On denial
it sends the exact three values above and leaves the draft unchanged. The old
Bob `UpsellPopup` and Save-time Widget limit decision are absent.

## Save Contract

Save persists the one widget document currently open in Builder.

That document is the complete logical instance, not merely the Widget Core or
the set of currently rendered ToolDrawer controls. It includes the exact
instance-owned shared state (`header.*`, `headerCta.*`, `stage.*`, `pod.*`,
`coreSize.*`, shared appearance/typography/chrome) and the exact Widget Core
namespace such as `faq.*`. Bob does not split or store that document.

Bob sends the current working config and exact command coordinate back to Roma:

- optional instance id as command/session metadata (`null` for New)
- Widget type only for First Save, while no saved instance identity exists
- one complete logical instance document containing every shared and Core
  value

Rename and base-locale changes remain separate owned operations.

Bob sends this as a `bob:account-command` with `command: "save-instance"`.
Without an ID, Roma creates the first saved source and returns HTTP 201 with
the minted ID and the exact current account `baseLocale` persisted for that
source. Bob adopts both from the existing Save result into its current
`meta`/`translationSetup` without another open or message. This keeps Bob
coherent with that completed Save; it does not serialize First Save against a
simultaneous account-locale PATCH across authorities. With an ID, Bob sends
`{ config }` only; Roma obtains Widget identity from Tokyo's saved list fact
and updates the source without comparing a caller `widgetType`. Tokyo-worker
stores editable source under:

```text
accounts/{accountPublicId}/instances/{instanceId}/
```

Roma resolves the complete logical document into exact config/content payloads,
and Tokyo-worker writes one canonical atomic `instance.source.json`. A later explicit
allowed Publish asks Roma's materializer to generate the served complete
`index.html`, complete `styles.css`, and mandatory `runtime.js`. Bob never
generates or persists those files.

The Save contract is source-only. The complete browser-memory document is
trusted Widget-instance truth from Bob. Bob preview is an editing concern and
does not require a stored public package. Bob does not add a second
whole-document validator before sending the Save intent, and Roma does not
reconstruct a Widget schema from the ToolDrawer surface.

Save also does not re-run Widget tier limits. The generic Bob edit boundary has
already applied Roma's exact policy truth to every accepted Widget-bound edit,
so the resulting complete draft is trusted Clickeen truth. Roma saves it;
Tokyo-worker stores it. Rechecking the same Widget limit during
Save, materialization, storage, or public serving would duplicate the owning
decision and violate closed-system trust.

Save is separate from manual translation generation, publish, unpublish, rename,
duplicate, and delete. Roma does not generate translations, regenerate
translations, or mutate locale overlays from the `save-instance` command.
Bob treats the Save response as editable-source persistence truth only.

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

- `save-instance`
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

The panel requires a saved instance identity. On New it shows **Save this
widget before generating translations.** and sends nothing. After first Save, it
sends one Generate translations command with the adopted `instanceId`.
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

Widget upsell copy is a separate Widget-owned locale artifact. The build joins
its exact message ids to `limits.json`; Bob transports the selected compiled
identity but does not render or localize the body. Roma owns selection and
composition in the account UI locale. Until product UI locale selection is
activated, the compiled English Widget upsell messages are the current product
artifact; there is no runtime language fallback.

## Widget Software

Widget software is system software stored in:

```text
tokyo/product/widgets/{widgetType}/
```

The deployed software authority is:

```text
product/widgets/{widgetType}/
```

Canonical Widget software contains:

```text
widget.html
spec.json
editable-fields.json
limits.json
discovery.json
labels/en.json
upsell/
  en.json
core/
  core.html
  core.css
  core.js
declared support files
```

Each Widget's `widget.html` composes Stage, Pod, Shell, Header, Core, and the
shared capabilities it uses, including localization, typography, branding,
social sharing, and other
system-owned behavior. Core HTML exposes the Widget's structure, Core CSS owns
its unique presentation, and mandatory Core JavaScript owns its behavior. Bob
consumes the structured contract;
it does not absorb Core or generate a Widget-specific editor path.

Local source state: Big Bang, Cards, Countdown, FAQ, and Logo Showcase use the
canonical folder and no longer have `widget.css` or `widget.client.js`. The
universal generator has no Widget branch, runtime source-kind discriminator,
or compatibility path.

`spec.json` carries defaults, editor structure, and ToolDrawer label tokens.
`labels/en.json` carries the exact English values
for those tokens, the five widget panel names, and migrated ToolDrawer copy
such as Agent Activity's title; Dropdown Border, Dropdown Edit, Dropdown Fill,
Dropdown Shadow and—when declared—Dropdown Upload field/component labels; and
Object Manager/Repeater collection labels and actions.
The Widget spec declares the exact state path and label-token coordinates; Bob
joins them with the one Dieter component without Widget-specific compiler
branches. `editable-fields.json`
carries editable/translatable field contracts. `limits.json` maps each unique
Widget coordinate governed by tier policy to a generic system entitlement and
the exact message id for that denial. It contains no tier values, plan names,
CTA destination, or Widget-owned policy decision. `upsell/{locale}.json`
contains the Widget-owned, localized contextual body templates referenced by
those message ids. A complete template may use the system-owned
`{currentPlan}` and `{targetPlan}` values; it does not own either value or the
Upgrade action. This upsell copy is separate from ToolDrawer labels because it
is consumed by Roma's account-policy surface, not rendered as editor-control
Chrome. The binding does not declare a second Save/publish enforcement phase;
it is consumed once by the editing host at the governed user intent.

When no higher configured tier permits the denied demand, Roma uses
system-owned maximum-capacity copy and exposes no Upgrade action. Bob neither
invents a target plan nor substitutes another Widget message.

## Editor Artifact Build

The Widget build compiles each canonical `spec.json`, its exact adjacent English
ToolDrawer label file, `limits.json`, and its exact Widget upsell locale file
into:

- `compiled.panels[]`
- `compiled.controls[]`
- `compiled.toolDrawerLabels`
- the exact localized Widget upsell message map referenced by `limits.json`
- editor binding metadata
- AI context metadata

Compiler source lives under `bob/lib/compiler*`.
`scripts/widgets/generate-artifacts.ts` reads widget and Dieter source directly
from the repo and emits ignored editor artifacts under
`roma/public/widget-editors/` plus server-only materializer artifacts under
`roma/generated/`.
Normal product requests do not fetch Tokyo source, fetch Dieter stencils, or
compile controls.

The compiler may fail its own build when git-authored source cannot produce the
declared artifact. That is source-artifact production and repository
verification, not a runtime validator over a Clickeen-produced editor artifact.
After the compiler emits the artifact, Bob and Roma trust it directly.

Every Widget-bound limit reference must resolve to one exact message in the
selected Widget upsell locale at artifact-production time. There is no generic
runtime fallback, inherited message, or reconstruction from the entitlement
key. Bob and Roma consume the complete compiled association without a second
copy check.

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

Builder preview does not load Widget authoring source through a Bob
`/widgets/**` proxy and does not read account-instance package files. The
existing generated editor-artifact path carries the deploy-built Widget
software in addition to the compiled controls. Bob combines that software with
the one browser-memory draft in Workspace.

Every current editor artifact carries its deploy-built Widget software. Workspace
renders that software with the exact current draft and never boots the
instance's stored package or sends draft state to public `runtime.js`.

The Bob-local AI API route is a guard route only:

```text
POST /api/ai/widget-copilot -> 409
```

Copilot turn traffic must run through the Roma account route.

Editor artifacts contain Bob controls and the deploy-built source needed for
temporary preview. They contain neither an account public package nor the
server-only materializer artifact. Bob does not fetch authoring source or reuse
a stored public package as editable truth.

## Controls

Editor controls are defined by widget specs using the Bob ToolDrawer DSL.

Common primitives include:

- `<bob-panel>`
- `<tooldrawer-field>`
- `<tooldrawer-cluster>`
- Dieter-backed form controls

Controls emit edit operations. The edit engine applies those operations to the
current in-memory instance state.

Before applying an operation that is bound by `limits.json`, the common edit
engine evaluates only that candidate operation against the exact Roma-supplied
policy snapshot and the compiled Widget binding. This is one generic gate for
manual controls, collection controls, and Product-Copilot-produced operations;
it is not a Widget-specific handler. Denial leaves the working state unchanged
and emits the bound capability/message identity to Roma. Acceptance creates the
new browser-memory Clickeen truth, which downstream Save trusts.

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
bound contract drives manual controls and Copilot choices. The library includes
the system Google fonts and seven global
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
document and save authority. The shared controls produce one exact typography
selection from the authoritative account library. Roma trusts that
system-produced draft; it does not revalidate the selection at the package
boundary.

## Builder Copilot

Product Copilot requires a saved instance identity. On New its action is
disabled with **Save this widget before using Copilot.** and sends nothing.
After first Save, turns route through Roma with a bounded `currentDraftContext`
capsule. Bob builds that capsule from the open browser-memory draft:
`instanceId`, widget identity, active locale, draft signature, visible editable
controls with current values, unavailable capabilities, and bounded
`conversationHistory` from Bob's structured model history. `showIf`-hidden
controls are excluded from the capsule. Widget package source is not sent as
Copilot prompt context.

Conversational Product Copilot turns use the Widget/session orientation and the
deploy-built edit-control catalog supplied by Clickeen. Bob trusts that catalog.
Product Copilot owns the governed model turn and the one-tool-call step
boundary. It transports the model's `apply_widget_ops` request. Bob owns the
actual external edit-request acceptance against the exact compiled controls
and current draft, then applies the accepted batch when its originating draft
signature is still current.

Bob consumes the exact compiled control metadata. Temporal boot readiness is a
separate UI state, and a legitimately empty show-if projection advertises no
`draft_edit` action; neither case repairs or substitutes compiled artifact
truth.

Bob does not pre-route user language with regex/control matching before the
agent sees the turn. The Copilot turn streams `ProductCopilotTurnEvent` frames
(`agent_turn_started`, `text_delta`, `tool_call`, `model_step_finished`,
`agent_turn_finished`, `agent_turn_error`, `agent_turn_stopped`). Bob renders
`text_delta` incrementally and executes a buffered `tool_call` only after the
matching `model_step_finished`. Bob remains the owner of the open working copy,
model-visible Product Copilot thread context, draft concurrency, and reversible
application of Product-Copilot-produced operations. San Francisco does not
store Product Copilot thread state.

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
step count, stop flag) and the active HTTP request handle. It consumes the
existing Widget session transport directly. `transport.runCopilot` returns a
`CopilotRequestHandle` carrying the `requestId` and a `completed` promise; it
does not block on the whole agent turn. `transport.cancelCopilot` dispatches the
`cancel-copilot` host command for that `requestId`.

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

The preview contract is Bob-owned editing behavior. It must not determine the
public package or require JavaScript so Clickeen can render, localize, host, or
serve a saved instance.

Target preview path:

```text
deploy-built Widget software
+ one browser-memory draft
+ instance/device/locale/resource preview context
-> existing Workspace iframe
-> temporary preview
```

The iframe remains isolated editing UI. It loads the selected Widget software
once and stays alive through ordinary draft edits. Manual controls,
undo/redo, Product Copilot, Save, and preview all use the same draft. Switching
Widget or instance may reset the temporary preview, but it always starts from
deploy-built Widget software plus the new exact draft and does not load that
instance's stored serving package.

The Widget software comes through the existing generated editor artifact. Bob
does not create another Widget registry, source proxy, preview service, package
endpoint, or account storage object. The source
contract used to express state in authored HTML is the same contract used later
by Publish; Bob contains no second FAQ renderer.

Every current deployed Widget preview renders authored HTML and CSS into the
isolated iframe from `compiled.widgetSoftware` and the exact draft. It executes
the authored preview behavior inside that temporary document. Ordinary edits
update that same preview from Bob's draft; there is no stored-package read,
`publicPackage` session field, public-runtime Blob, or public
`ck:state-update`/`ck:ready` protocol. Public `runtime.js` contains no Bob
editor receiver.

Because ordinary edits replace the preview body's rendered content inside the
same iframe, shared visitor bindings must be reusable: social-share document
delegation is installed once, and Stage/Pod disconnects its previous
`ResizeObserver` before observing the newly rendered Stage. Editing therefore
does not accumulate listeners or observers.

When an in-memory edit introduces an unresolved account media or font
reference, Bob keeps the last successfully rendered preview visible and
resolves the dependency through Roma on its existing path. Resolution failure
is an explicit preview error. A later valid dependency resolution clears that
dependency error. This editor behavior does not redefine the public package.

Global `source: "tokyo"` fonts are not account dependencies. Preview loads their
declared `/fonts/special/**` paths through Bob's same-origin Tokyo proxy.

Preview represents the in-memory working copy. Public snippets point at the
published static URL:

```text
https://clk.live/{accountPublicId}/{instanceId}
```

Roma owns public-widget action truth for the current account and opened
instance. Roma's shared publication controls construct the exact public URL and
complete iframe snippet and present Open public widget plus one Copy code intent
in the Roma Builder header and Widgets inventory. The Builder-open envelope
sends no publication facts or actions to Bob, and Bob's TopDrawer remains an
editing surface. Unpublished instances expose no live actions.

`runtime.js` is behavior-only and is never offered as a standalone embed. A
script-only copy option would omit the materialized HTML and CSS.

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
Bob's session transport is the account-asset UI adapter: it trusts Roma's exact
result and carries a Roma-owned account-plan denial as generic host intent.
Fill or Upload may emit the generic Dieter upsell event for that exact reason;
Bob transports it to Roma and does not render another Popup. Because upload
size/storage are account-service capabilities rather than unique Widget state,
Roma supplies the system-owned contextual body. Dieter never parses Roma
payloads or decides which account-policy reasons qualify.

## Localization

Bob edits the base locale in the active session.

The Translations panel shows one explicit account operation:

```text
Generate translations
```

Bob sends only the opened `instanceId` to Roma. Roma resolves the account,
active locales, tier, saved instance source, and Translation Agent grant. Bob
does not send locale authority for generation.

The normal Save command is editable-source persistence only. Roma does not
generate a public package, generate translations, regenerate translations, or
mutate locale overlays. Bob treats the Save response as source persistence
truth.

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

- Do not put Widget-specific meaning, rendering, persistence, or service
  branches in Bob.
- Do not validate, filter, normalize, fingerprint, or reconcile a Widget
  contract, saved document, package, font library, asset result, or command
  result produced by another Clickeen authority.
- Do not make client JavaScript create the initial public Widget; saved HTML and
  CSS are complete before browser interaction starts.
- Do not add account persistence inside Bob.
- Do not save package files from Bob.
- Do not let Bob choose account locales, tier policy, model availability, or storage paths.
- Do not put plan names, target-plan selection, Widget upsell copy, CTA behavior,
  or a duplicate upsell Popup in Bob. Bob carries the exact compiled denial
  identity to Roma.
- Do not re-run Widget limits on Save after Bob's common edit boundary accepted
  the browser-memory draft.
- Do not create Bob account asset API routes; asset commands go through Roma.
- Do not treat Builder preview as public serving evidence.
