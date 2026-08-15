# ToolDrawer Controls

STATUS: CURRENT SYSTEM OPERATOR SPEC

Bob renders widget controls from structural `spec.json.editor.panels[]`
declarations plus the widget's adjacent English ToolDrawer labels:

```text
tokyo/product/widgets/{widgetType}/
  spec.json
  {widgetType}_tooldrawer_l10n_labels/
    en.json
```

Widgets declare controls. Bob compiles them. Dieter supplies the UI components.

## Panels

Only these panels are current:

```text
content
layout
appearance
typography
settings
```

Widget specs declare each exactly once. Missing, duplicate, or unknown panels
fail compilation. Bob emits them in the canonical order shown above.

| Panel        | Owns                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------- |
| `content`    | Header content, Core text/content, Core media choices, repeatable items, content toggles.    |
| `layout`     | Header layout, Stage/Pod layout, Core sizing, columns, gaps, arrangement, carousel behavior. |
| `appearance` | Header/Header CTA appearance, Stage/Pod appearance, Core colors, surfaces, borders, shadows. |
| `typography` | Shared typography roles.                                                                     |
| `settings`   | Runtime/product behavior such as branding and social share.                                  |

## Authoring Model

Widget specs are structured JSON. Authors use panel, cluster, field, shared
node, and template objects in `spec.json`; they do not write raw editor HTML.
Widget-authored visible copy in those objects uses exact `$label:{key}` tokens.
The matching English value lives once in the widget's `en.json` label file.

Bob compiles those structured nodes into internal ToolDrawer markup such as:

```text
<bob-panel>
<tooldrawer-cluster>
<tooldrawer-field>
```

Those tags are compiler output/internal representation, not the source format
for current widget specs.

Compiler-enforced rules:

- Path-bound fields must resolve against composed defaults.
- `dropdown-upload` binds one exact JSON path whose value is
  `null | {assetRef:string,name:string}` and requires its caller-owned copy.
- `datefield` binds one exact string path whose value is `"" | YYYY-MM-DD`.
  `date-range-picker` binds one exact JSON path whose value is
  `null | {start:YYYY-MM-DD,end:YYYY-MM-DD}` with `start <= end`.
- Both date controls require caller-owned field label, placeholder, previous
  month, next month, and Clear copy plus one exact locale. Optional `min` and
  `max` are exact civil dates; missing, malformed, impossible, reversed, or
  out-of-bounds values fail rather than being repaired.
- Panel ids must be one of the five current widget panels; unknown ids fail compile.
- Every resolved cluster must have a non-empty plain-text label; missing label
  keys and unlabeled clusters fail compile.
- Every label file must declare the exact widget type, locale `en`, all five
  widget panel labels, and no missing or unused label keys.
- Malformed source nodes fail compilation.

Product rules:

- Every Core field path must have one runtime binding.
- Related Core fields use `groupId`.
- Conditional controls use structured `showIf`.
- Repeated content uses `repeater` or `object-manager` with stable item ids.
- Widget specs use shared nodes for common controls; shared-node reuse does not
  define DOM ownership.
- English labels are authored as plain text in the adjacent label file, never
  as pre-encoded HTML entities.

Current source node shapes:

```text
labels:  {
  "components": {
    "agent-activity": {
      "title": "$label:component.agent-activity.title"
    },
    "dropdown-border": {
      "color": "$label:component.dropdown-border.color.label",
      "defaultColors": "$label:component.dropdown-border.default-colors.label",
      "enabled": "$label:component.dropdown-border.enabled.label",
      "hex": "$label:component.dropdown-border.hex.label",
      "hue": "$label:component.dropdown-border.hue.label",
      "width": "$label:component.dropdown-border.width.label"
    }
  },
  "fields": {
    "dropdown-border": { "appearance.podBorder": "$label:appearance.pod-border.dropdown-border.label" }
  }
}
panel:   { "id": "...", "clusters": [...] }
cluster: { "label": "$label:content.cluster.content.label", "initiallyOpen": true, "nodes": [...] }
shared:  { "kind": "shared", "id": "..." }
field:   { "kind": "field", "type": "...", "path": "...", "label": "$label:content.field.example.label", "attrs": {...} }
```

The current label-file shape is deliberately small:

```json
{
  "widgetType": "faq",
  "locale": "en",
  "labels": {
    "panel.content": "Content",
    "content.cluster.content.label": "Content"
  }
}
```

It is not a Bob-wide catalog and it is not fetched at runtime. The build reads
the exact adjacent file, resolves the tokens, and emits the current English
widget artifact at `/widget-editors/{widgetType}.json`. No non-English
ToolDrawer artifact or UI-language selection exists in the current implementation.

The current boundary covers every visible ToolDrawer label already migrated in
this staged pass, including widget-declared labels, widget panel names, and the
static Agent Activity title. The compiler emits that title as
`compiled.toolDrawerLabels.components["agent-activity"].title`; Bob renders it
while the Translation Agent continues to own the dynamic activity-row words.
Choice Tiles likewise receives its group label and every option label from the
same resolved Widget label file; the Dieter stencil owns no words and allows
those exact values to wrap inside the tile.
Datefield and Date Range Picker use the same copy route when a Widget declares
them: the ordinary field label and placeholder plus
`previous-month-label`, `next-month-label`, and `clear-label` are exact
`$label:{key}` inputs resolved from that Widget's adjacent file. The locale is
an exact caller input used by Dieter `Intl` formatting; Dieter has no locale
catalog or English fallback. No current Widget declares either control, so the
eight current English editor/materializer artifact pairs contain neither and
remain unchanged.
Dropdown Border follows the same ownership rule for everything visible inside
the ToolDrawer. `editor.labels.components.dropdown-border` names its global
stencil inputs; `editor.labels.fields.dropdown-border` maps only
compiler-generated field paths to their caller labels. Widget-authored fields
keep their ordinary adjacent `label` token. Bob joins these sources without
teaching Dieter or the compiler which Widget is using the component.
Bulk Edit follows the same rule: its trigger, dialog, actions, column labels,
placeholders, and empty-state copy are ordinary `$label` inputs owned by the
adjacent Widget label file. Dieter owns only the generic array-table workflow;
it has no Logo Showcase, upload, account-asset, or policy branch.
The compiler derives each column's exact string or boolean item coordinate from
the declared Bulk Edit `path`, optional `row-path`, and `columns`. Do not add
hidden child fields to another component merely to make Bulk Edit columns
editable.
Copy inside other reusable Dieter stencils and shared compiler modules remains
with those current sources until its component pass moves it deliberately.

`default-item` values remain widget content defaults, not ToolDrawer labels.
They stay in `spec.json` and follow the widget content/editable-field contract.
Object Manager and Repeater do not derive or repair them. Every repeated object
must carry a stable non-empty `id`; each declared new-item object carries the
same shape with `id: ""`, and the owning collection component assigns the new
id when the user adds it.

## Visible Hierarchy And Initial State

The authoring hierarchy is fixed:

```text
Panel > Section (cluster) > optional Group > Control
```

A panel title names the domain once. Every resolved cluster supplies one
visible section name. A control group supplies a heading only when it adds meaning below the
section; if its label equals the section label, Bob suppresses the duplicate
visible heading while retaining the control metadata used by Copilot.
Blank or omitted group labels remain absent; Bob never turns a technical
`groupId` into customer-visible or Copilot-facing copy.

Sections start collapsed unless their source explicitly sets
`"initiallyOpen": true`. The Content panel is the only exception in current
widget specs: its shared `Header` section and one primary `Content` section are
explicitly open when a widget is opened. They remain ordinary collapsible
sections after that initial render. All sections in Layout, Appearance,
Typography, and Settings start collapsed.

Bob owns the HTML boundary: resolved label values are plain strings, the
shared codec escapes them when compiler modules serialize internal ToolDrawer
attributes, the parser decodes each internal attribute exactly once, and final
rendered markup escapes it exactly once. Label files must not contain
pre-encoded labels, options, or parameters; compiler modules must use the one
shared codec rather than local replacements.

Do not add code that silently drops unknown fields, missing state paths, or
required component copy.

## Conditional Controls

`showIf` is authored as structured JSON. Bob compiles it into the internal
ToolDrawer condition expression.

Current operators:

```text
equals
notEquals
in
isTrue
isFalse
all
any
hasLinks
```

Every `showIf` condition references existing default state by `path`, except
`hasLinks`, which receives one or more existing field paths in `args`.

## Shared Nodes

Current shared editor nodes:

```text
header-content
header-content-no-header-cta
header-layout
header-layout-no-header-cta
core-size
header-appearance
header-appearance-no-header-cta
stagepod-layout
stagepod-appearance
stagepod-corners
settings-behavior
```

The shared typography panel uses:

```json
{
  "id": "typography",
  "shared": {
    "id": "typography",
    "roleLabels": {
      "widgetRole": "$label:typography.role.widget-role.label"
    }
  }
}
```

The common widget contract owns labels for `title`, `body`, `button`, and
`localeSwitcher`. Widgets declare label tokens, in visible order, for every
widget-specific typography role and may override a common label when its
product meaning is broader. The adjacent English file owns those resolved
widget-role values. Missing, malformed, unknown, or unused labels fail widget
compilation; roles are never silently omitted.

## Structured Field Types

Current widget specs and Dieter components use these field families:

```text
bulk-edit
choice-tiles
dropdown-actions
dropdown-border
dropdown-edit
dropdown-fill
dropdown-shadow
dropdown-upload
object-manager
repeater
segmented
slider
textfield
toggle
valuefield
```

Bob compiles structured field nodes into Dieter-backed controls.
Widgets do not paste Dieter component markup directly.
Every structured field type requires both its Dieter stencil and spec; missing
source fails widget generation. Toggle uses its native checkbox behavior.
Dropdown triggers are native buttons, and `dropdown-actions` applies the
selected value immediately.

`dropdown-edit` declares an inline rich-text field. Every such field has the
same Dieter behavior: Bold, Italic, Underline, Strikethrough, Link, selected-
only Clear formatting, line breaks, and pasted inline formatting. Widgets do
not opt individual fields into or out of links. The field value remains the
existing compact inline HTML string; empty is exactly `""`. Each Widget's
adjacent ToolDrawer label file supplies the exact ten Dropdown Edit component
labels, including **Add link**, **Remove link**, and the accessible **Close
link editor** name. Widget-authored Dropdown Edit fields also receive their
field label and placeholder from that adjacent file. The two shared Header
fields currently receive their field label and placeholder from Bob's Header
module; that caller-copy move belongs to the Bob UI pass, not Dieter. Bob joins
the current caller values to the global Dieter stencil during the existing
editor-artifact build. A selected unlinked range gets one **Add link** action.
An existing link shows its URL read-only and changes that same action to
**Remove link**; changing the URL is remove then add. There is no Apply,
Update, or second link action.

Slider labels, Toggle labels, and every Tabs group/option label are caller
inputs. Slider's Dieter hydrator owns only progress presentation; Toggle and
Tabs retain native checkbox/radio behavior. None of these primitives loads a
locale or owns visible copy. Tabs has no current Widget ToolDrawer declaration.

Compact property rows use one Dieter geometry contract: labels occupy the
leading side and dropdown values, switches, text fields, and numeric fields
terminate on the same trailing rail. On clickable property-menu rows, the
complete field label never truncates. Dynamic trailing text yields first and
receives the end ellipsis; a fixed chip or Icon remains visible. Compound
trailing values author text before the visual, and rest and hover preserve the
same geometry. Dropdown Actions, Border, Edit, Fill, Shadow, and Upload all use
that shared rest structure; their standard top-level Popovers repeat only the
caller label and inherit the row's `sm|md|lg` radius. Each dropdown's actual
editing, selection, or upload workflow remains component-owned. Numeric fields
use one content-sized trailing editor bounded by the remaining row rather than
a fixed slot. Toggle rows are native labels, so the complete visible row
activates the checkbox. Component stencils render labels exactly as authored
and do not inject punctuation. Text fields and numeric fields share the same
resting row geometry; text fields use the row as their editing surface, while
numeric fields use complete-row hover and one neutral trailing edit surface
that grows with the exact value while preserving the shared right rail.

`textfield` requires exact caller `label` copy and may receive an exact caller
`placeholder`; Widget-authored values use `$label:` keys from that Widget's
adjacent ToolDrawer label file. The compiler never replaces a missing caller
placeholder with Dieter demonstration copy. `valuefield` receives its numeric
meaning from the caller: declare the exact inclusive `min` and `max` when the
field is bounded. A signed field declares a signed range. Bob and Roma reject
non-finite and out-of-bounds edits without clamping or rewriting the draft;
`step` remains native input metadata rather than a second acceptance rule.

`dropdown-fill` uses explicit fill modes in field attrs. Use the hyphenated
attribute name `fill-modes` in authored specs and list only the exact
`color,gradient,image,video` modes that the field supports. The compiler does
not infer media capability from a path or label. Each Widget declares the
exact Dropdown Fill component-label shape under
`editor.labels.components["dropdown-fill"]`, declares labels for shared
generated Fill paths under `editor.labels.fields["dropdown-fill"]`, and owns
those English values in its adjacent ToolDrawer label file. Dieter receives
the resolved strings; it owns no visible Fill wording. The exact component
shape includes **Enabled**; there is no separate remove-fill label because the
component's Enabled-off action writes exact `none`. Multiple declared modes use
Dieter's existing Segmented primitive, while a single declared mode hides that
selector without changing the field contract.

`dropdown-upload` is the single-file account-asset field. It binds one exact
JSON path as `null | {assetRef:string,name:string}`; there is no companion
metadata path. Its caller supplies the field label and placeholder. When a
Widget declares the component, that Widget also declares the exact
`editor.labels.components["dropdown-upload"]` keys `upload`, `replace`,
`remove`, `uploadAssetError`, and `previewAssetError`, and its adjacent English
ToolDrawer label file owns those five resolved strings. Dieter receives those
words and uses the existing account-assets client; it does not own a locale,
file policy, storage path, or Widget-specific rule. None of the eight current
Widget specs declares this field, so do not add unused Widget labels or a fake
product example merely to exercise the component.

`dropdown-shadow` binds the exact object
`{enabled,inset,x,y,blur,spread,color,alpha}`. Every Widget declares the exact
fourteen-key component/composition-label shape under
`editor.labels.components["dropdown-shadow"]` and supplies generated Stage,
Pod, and applicable card field labels—including each inside-shadow link label—under
`editor.labels.fields["dropdown-shadow"]`. The adjacent English file owns all
of those words. The component/composition shape includes the layer label and
the below/above-content option labels; Bob does not author them. Use
`axis: "x"|"y"|"both"` only to hide irrelevant offset
rows; it does not change the stored object. Shadow owns no fallback value,
label, validation state, or Widget-specific behavior.

State-bound fields use `path`. Visual grouping uses `groupId`; it is not a data
path. Template children are allowed only inside controls that already own that
template behavior.

`object-manager` owns one top-level object array. Its caller declares
`allow-structure` explicitly. `true` exposes Add and one Popup draft for
reorder/delete; `false` renders only each object's declared editor and must not
emit structural UI. The caller supplies the item-label template, label path,
minimum when applicable, default object when structure is enabled, and every
dialog/action word. Widget copy resolves from
`editor.labels.components["object-manager"]` plus the exact path under
`editor.labels.fields["object-manager"]`.

`repeater` owns inline add/remove/reorder for one declared object array, whether
that array is a top-level control or nested inside Object Manager. Its caller supplies the exact
item template, exact `default-item`, `min`/`max` when applicable, and add,
remove, move, reorder, and optional editable-label words. Add
copies only that declared object and assigns only its declared empty id fields;
no item schema is inferred from current data or markup. Reorder mode changes
only order; ordinary nested controls continue to edit their existing paths.
Nested fields keep neutral `data-path` coordinates. Compilation adds
`data-bob-path` only to the true outer host-bound collection input, so nested
fields and child collections fold into one exact parent array before Bob or
Roma receives it. When a caller declares `add-open`, it supplies one exact
selector for the related action; the component does not search for a consumer
or Widget.

`segmented` declares one native radio group. The root `sm|md|lg` size owns the
rail and default Icon/text geometry; `txt`, `ic`, and `ictxt` describe only the
caller-provided content. Each option label or icon-only accessible name and the
group name come from caller copy. There is no nested Button, separate checked
state, or Segmented hydrator.

Dropdown Border, Dropdown Edit, Dropdown Fill, and Dropdown Shadow may declare
`attrs["popover-width"]` as `row`, `wide`, or `extra-wide`. `row` matches the
closed row; `wide` and `extra-wide` extend only the open Popover 40px or 80px
to the right. Omit the attr for the component-owned default: `wide` for Border,
Fill, and Shadow; `extra-wide` for Edit. Do not repeat those defaults through
Widget specs. This width does not change the field's existing `sm|md|lg`
control size, state path, labels, or editing behavior. Dropdown Actions and
Dropdown Upload remain row-width and do not use this attribute.

## Dieter Mapping

The widget artifact generator reads Dieter stencils from source:

```text
dieter/components/{type}/{type}.html
dieter/components/{type}/{type}.spec.json
```

Bob and Roma compile Dieter CSS and hydrators from source. Compiled widget
artifacts contain panel HTML and do not contain per-control Dieter media lists.
They also do not contain current instance or account-default values. The host
projects exact current JSON values into outer `data-bob-path` fields marked with
`data-dieter-json` before running Dieter hydrators, so a compiled empty JSON field is only an unbound placeholder
and never a runtime default or fallback. Other control values remain on their
existing host binding path.

Dieter `defaults.context` values are DevStudio reveal examples, not product
copy. For the completed component contracts, product compilation receives field
labels, placeholders, options, columns, and component action words from the
resolved Widget ToolDrawer label contract. The compiler does not borrow those
missing words from an example context.

Dieter stencil icon names remain `data-icon` references in compiled panel HTML.
Source hydration renders them as CDN-backed CSS masks from
`/dieter/icons/svg/{name}.svg`. Bob must not replace those references with
literal SVG markup.

## Hard Stops

- Do not create new panel ids.
- Do not add controls for missing defaults.
- Do not add widget-local UI components for a control Dieter already owns.
- Do not place content controls in `appearance`.
- Do not place styling controls in `content`.
- Do not add unbound controls.
- Do not place English widget-authored ToolDrawer copy directly in `spec.json`.
- Do not create a central all-widget ToolDrawer catalog.
- Do not add non-English files until a separately approved localization stage
  defines and verifies their exact runtime use.
