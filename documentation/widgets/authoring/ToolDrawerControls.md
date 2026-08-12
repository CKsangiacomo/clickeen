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

| Panel | Owns |
| --- | --- |
| `content` | Header content, Core text/content, Core media choices, repeatable items, content toggles. |
| `layout` | Header layout, Stage/Pod layout, Core sizing, columns, gaps, arrangement, carousel behavior. |
| `appearance` | Header/Header CTA appearance, Stage/Pod appearance, Core colors, surfaces, borders, shadows. |
| `typography` | Shared typography roles. |
| `settings` | Runtime/product behavior such as branding and social share. |

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
- `dropdown-upload` requires `meta-path`; missing upload metadata fails compile.
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
Copy inside other reusable Dieter stencils and shared compiler modules remains
with those current sources until its component pass moves it deliberately.

`default-item` values remain widget content defaults, not ToolDrawer labels.
They stay in `spec.json` and follow the widget content/editable-field contract.

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
missing upload metadata.

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
textedit
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
adjacent ToolDrawer label file supplies the field label, placeholder, and the
exact Dropdown Edit component labels, including **Add link** and **Remove
link**. Bob joins those values to the global Dieter stencil during the existing
editor-artifact build. A selected unlinked range gets one **Add link** action.
An existing link shows its URL read-only and changes that same action to
**Remove link**; changing the URL is remove then add. There is no Apply,
Update, or second link action.

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
use stable slots rather than content-measured widths. Toggle rows are native
labels, so the complete visible row activates the checkbox. Component stencils
render labels exactly as authored and do not inject punctuation. Text fields
and numeric fields share the same resting row geometry; text fields use the row
as their editing surface, while numeric fields keep hover, focus, and editing
inside the compact trailing value slot.

`dropdown-fill` uses explicit fill modes in field attrs. Use the hyphenated
attribute name `fill-modes` in authored specs. `dropdown-upload` requires a
`meta-path`; the compiler rejects missing upload metadata paths.

State-bound fields use `path`. Visual grouping uses `groupId`; it is not a data
path. Template children are allowed only inside controls that already own that
template behavior.

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
projects exact current JSON values into `data-bob-path` fields before running
Dieter hydrators, so a compiled empty JSON field is only an unbound placeholder
and never a runtime default or fallback. Other control values remain on their
existing host binding path.

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
