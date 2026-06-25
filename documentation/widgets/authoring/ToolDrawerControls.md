# ToolDrawer Controls

STATUS: CURRENT SYSTEM OPERATOR SPEC

Bob renders widget controls from structured `spec.json.editor.panels[]`.

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
- Malformed source nodes fail compilation.

Product rules:

- Every Core field path must have one runtime binding.
- Related Core fields use `groupId`.
- Conditional controls use structured `showIf`.
- Repeated content uses `repeater` or `object-manager` with stable item ids.
- Widget specs use shared nodes for Shell controls.
- Current product panel IDs are fixed to the five panels above even though the
  compiler accepts arbitrary non-empty panel ids.

Current source node shapes:

```text
panel:   { "id": "...", "clusters": [...] }
cluster: { "label": "...", "nodes": [...] }
shared:  { "kind": "shared", "id": "..." }
field:   { "kind": "field", "type": "...", "path": "...", "attrs": {...} }
```

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

`dropdown-fill` uses explicit fill modes in field attrs. Use the hyphenated
attribute name `fill-modes` in authored specs. `dropdown-upload` requires a
`meta-path`; the compiler rejects missing upload metadata paths.

State-bound fields use `path`. Visual grouping uses `groupId`; it is not a data
path. Template children are allowed only inside controls that already own that
template behavior.

## Dieter Mapping

Bob loads Dieter stencils from the Tokyo product root:

```text
dieter/components/{type}/{type}.html
dieter/components/{type}/{type}.spec.json
```

Runtime component CSS/JS comes from the generated artifact manifest:

```text
tokyo/product/dieter/manifest.json
```

Do not treat `dieter/components/registry.json` as shipped runtime truth.
The generated manifest is the deploy artifact contract.

## Hard Stops

- Do not create new panel ids.
- Do not add controls for missing defaults.
- Do not add widget-local UI components for a control Dieter already owns.
- Do not place content controls in `appearance`.
- Do not place styling controls in `content`.
- Do not add unbound controls.
