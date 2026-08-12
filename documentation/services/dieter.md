# Dieter - Design System

STATUS: CURRENT SYSTEM OPERATOR SPEC

Dieter is Clickeen's shared design-system source. It owns tokens, the
high-level application Layout/Page contract, component CSS, component specs,
component snippets, icons, and component hydrators. Account data never lives
in Dieter.

## Authority

| Concern | Current authority |
| --- | --- |
| Design-system source | `dieter/**` |
| Package | `@ck/dieter` for source ownership and typechecking |
| Bob/Roma UI | Compile Dieter source directly |
| Prague UI | Compile Dieter token source directly |
| Widget runtime | Materialize required Dieter CSS into instance `styles.css` |
| Public Dieter files | R2 `dieter/icons/svg/**` only |
| Icon authoring | Human-operated `tooling/sf-symbols/**` |

There is no Dieter build bundle, generated Tokyo mirror, browser manifest, or
`window.Dieter` runtime.

## Source Layout

| Path | Purpose |
| --- | --- |
| `dieter/tokens/` | Canonical token CSS. |
| `dieter/layouts/main-container/` | Canonical `main-container > left-nav + page` layout CSS, example HTML, and spec. |
| `dieter/components/{component}/` | Component CSS, stencil, spec, and optional hydrator. |
| `dieter/components/shared/` | Small source helpers shared by existing components, including compact property-row geometry. |
| `dieter/components/index.ts` | Explicit component-hydrator exports. |
| `dieter/icons/svg/` | Generated SVG icon source deployed to R2 and consumed by product surfaces. |
| `dieter/icons/icons.json` | Input to the human-operated SF extraction tool; not a product registry. |
| `dieter/styles.css` | Bob/Roma source CSS entrypoint. |
| `tooling/sf-symbols/` | Manual SF Symbols extraction/generation tool. |

Component folders normally contain:

```text
{component}.css
{component}.html
{component}.spec.json
{component}.ts or {component}.js   # optional source hydrator
```

## Consumer Boundaries

Bob and Roma import `dieter/styles.css` in their application builds. Roma and
DevStudio directly import
`dieter/layouts/main-container/main-container.css`; that layout is deliberately
not in the broad stylesheet because Bob retains its ToolDrawer/Workspace
composition. Bob imports the source hydrators it uses and calls them
explicitly; Dieter does not install a browser global.

Prague imports the canonical token entrypoint in its application build.

Widget package generation reads canonical Dieter token and component CSS.
Instance materialization writes the required rules into that instance's
`styles.css`. Public widget HTML therefore does not fetch Dieter CSS or
JavaScript.

DevStudio reads Dieter source through its existing source generators. Its
generated reveal pages are tooling output, not a deployable Dieter runtime.
The generated Core styles page reads spacing, control geometry, radius, shadow,
and motion values from `dieter-foundation-tokens.css`. The separate Layouts
page uses the structured `main-container` contract for the shared application
shell and maps it beside Bob's separate editor composition and the public
Widget Stage/Pod/Shell/Header/Core composition. It exposes the four real
application-layout source tokens without creating another layout authority.
Authenticated edits commit back to that same foundation token file through
DevStudio's validated GitHub write path.

The shared application shell keeps the exact
`main-container > left-nav + page` taxonomy. In Full mode the navigation is a
foreground panel inset by `--space-2` on all sides over the application
muted backdrop. It is `12rem` wide and uses the shared surface, no border,
`3xl` radius, and floating shadow. The page header and content share one
centered `80rem` maximum width. Full Page padding is `--space-4`; header and
content separation use `--space-4`. Compact Page padding is `--space-4`;
header and content separation use `--space-3`. In Compact mode the same panel
DOM becomes an inset overlay over a full-width page, retains its separate
`12rem` maximum-width token, and uses the existing elevated shadow.
Roma and DevStudio use that Compact composition in narrow landscape and
portrait; consumer code owns only open state and navigation/page content.

Compact property controls share row geometry through
`dieter/components/shared/property-row.css`. Components continue to own their
specific input, switch, dropdown, popover, hover, focus, and disabled behavior.

Dieter components are consumer-agnostic primitives. They own reusable
structure, presentation, and interaction, not Widget paths, account policy, or
Bob/Roma product meaning. Visible ToolDrawer copy is supplied through the same
caller-input contract: Widget specs declare `$label:{key}` tokens and the
adjacent Widget label file owns the words. Dieter has no component copy catalog
and no consumer-specific localization shape.

This boundary is the localization support: Dieter receives exact resolved
human-language strings. It does not load a locale or choose a translation.
Bob/Roma Chrome resolves its own application copy before composing the same
primitive. Consumer-specific data, capability filtering, and state changes
stay with the owning consumer; they do not become Dieter variants or branches.
Generic binding inputs and events connect a primitive to its host without
giving Dieter ownership of the host's product meaning.

Agent Activity owns a required caller-supplied title, a required array of
narration rows, its `sm`/`md` structure, and its active presentation. It does
not own caller wording. Bob supplies the static title from the open widget
artifact and renders Translation Agent event messages as the rows.

Choice Tiles owns two- and three-option selection structure, interaction,
selected presentation, and one proportional `sm|md|lg` tile geometry. Its
minimum-height ladder is `4rem/4.5rem/5rem` and its Icon ladder is
`1rem/1.25rem/1.25rem`; labels wrap instead of truncating. The
component owns no visible wording. Widget ToolDrawer instances supply the
group label and every option label from the Widget's adjacent ToolDrawer label
file.

Dropdown Actions owns the compact immediate-choice row and its attached
Popover composition. The closed row shows caller-supplied label and current
value, hover discloses interaction without a resting chevron, and choosing a
Menu Action updates the value and closes immediately. Its root
`data-size="sm|md|lg"` owns the `1.25rem/1.5rem/1.75rem` row heights and
`.6875rem/.8125rem/.875rem` typography; current ToolDrawer instances use `md`.
The attached Popover inherits the row's size-specific radius. Opening the
control does not add a separate blue border or tint to the covered row.
All visible wording remains caller input. Its selected checkmark inherits the
Menu Actions `sm|md|lg` Icon size instead of carrying a fixed size. Bob owns
the separate typography-family capability filter; the Dieter component does
not inspect typography paths, weights, or styles.

Dropdown Actions, Dropdown Border, Dropdown Edit, Dropdown Fill, Dropdown
Shadow, and Dropdown Upload use the shared clickable property-menu row rule.
The complete field label occupies the leading rail. The trailing rail is right
aligned and contains dynamic value text followed by any fixed chip or Icon;
only that dynamic text truncates. Rest and hover use the same rail geometry,
and hover belongs to the complete row. Each standard top-level Popover repeats
only the caller label and follows the trigger's `sm|md|lg` radius. This is
shared presentation authority, not shared component behavior: each dropdown
retains its existing editing or selection job.

Dropdown Border owns one global border-editing component, not a family of
Widget-specific border controls. Its exact value is
`{enabled:boolean,width:number,color:string}`. Root `sm|md|lg` sizing applies
to the trigger, attached Popover, text, `square.slash` no-border Icon, and
nested controls. Enabled sits immediately below the caller-supplied Popover
header; disabling it hides but does not replace the stored color and width.
Its closed row renders width before the color chip, or only `square.slash`
when no border is present. Its current medium work area uses one `.5rem`
vertical rhythm. Hue and Width share one `2.5rem` label rail, and the shared
Slider primitive gives its range input the complete remaining inline space so
the two tracks align; Border only supplies the equal label rails. It uses the
added width with a shallower `8rem/9rem/10rem` saturation/value canvas for
`sm|md|lg`. Color swatches are centered and `0.125rem` smaller in both
dimensions, with corners using the component radius minus `0.125rem`. They
have no resting stroke except white, which keeps one gray edge; the selected
swatch uses a one-pixel blue outline. It consumes
the exact structured Widget value and
does not create fallback, repaired, or diagnostic states. Dieter owns
structure, styling, and behavior but no visible words. Widget specs declare
use and exact state paths, while their
adjacent ToolDrawer label files supply field and component labels through
Bob's existing compiler.

Dropdown Edit owns one global inline rich-text editing component. Every
`dropdown-edit` use supports Bold, Italic, Underline, Strikethrough, links,
selected-only Clear formatting, line breaks, and pasted inline formatting.
The link sheet has one contextual action in one stable position. Selected
unlinked text gets an editable URL field and **Add link**; an existing link
shows its URL read-only and changes that action to **Remove link**. Changing a
URL is remove then add. There is no Apply, Update, or second link action. The
link action is not a per-Widget capability. Toolbar actions use the existing
medium Button geometry with the existing 1.25rem Icon size. The separate
link-sheet close action keeps the medium Button's default 1rem Icon.
The Popover header, editor, and toolbar use one `.5rem` vertical rhythm.
Opening the Popover does not select text. The pinned Lexical dependency is
bundled with Dieter and runs locally in Bob; it makes no external runtime call.
Dieter exports the existing compact inline HTML value instead of a Lexical
document, so Bob's browser-memory and save contracts do not change. Every
visible field, toolbar, and link-sheet word is caller input resolved from the
consuming Widget's adjacent ToolDrawer label file. Dieter contains no Widget
branch, Widget label catalog, locale folder, storage authority, or persistence
behavior.

Popover owns only the floating surface and label/body structure. Its standard
header contains the caller-supplied label and no decorative Icon. Header and
body align through the same outer Popover padding. Callers own trigger state,
body content, selection, and any genuine action.

Popover owns one independent width contract: `row`, `wide`, or `extra-wide`.
`row` matches the closed property row, `wide` extends the open surface 40px to
the right, and `extra-wide` extends it 80px. The left edge remains aligned with
the closed row. Dropdown Border, Fill, and Shadow own `wide` as their global
default; Dropdown Edit owns `extra-wide`. The expanded surface is positioned
above the ToolDrawer and workspace rather than resizing either one, and its
position follows the row while the containing surface scrolls or resizes.
Border, Fill, and Shadow use their added width for one direct nine-column,
two-row color palette. Edit gives its added width to the editor and toolbar.
Dropdown Actions and Dropdown Upload retain row width.

Bulk Edit is a generic array-table composite with caller-declared text and
checkbox columns. It contains no Logo Showcase, upload, account-asset, or
account-policy behavior. Its trigger, dialog, action, column, placeholder, and
empty-state words are caller inputs; ToolDrawer consumers resolve them from
their Widget-adjacent label file.

Color source keeps one small shared role layer:
`--role-surface-bg`, `--role-surface`, `--role-surface-muted`,
`--role-border`, and `--role-error`. Text and focus retain their existing
`--color-text`, `--color-text-secondary`, and `--focus-ring-color`
authorities. Dieter does not carry unused action, feedback, selected,
disabled, or `on-*` role families.

Operational typography is selected only through the complete visual classes
revealed by DevStudio Typography: `display-*`, `heading-*`, `body-*`,
`label-*`, `caption*`, and `overline*`. Consumers do not assemble typography
from font-family, size, weight, line-height, or tracking values and do not add a
monospace exception for technical strings. The source contains only live
font-size and line-height tokens; DevStudio edits those shared values through
one Typography-page action rather than attaching a misleading editor to every
visual-class row.

Dieter Table uses `label-s` for column headers and `body-s` for every body
header/data cell. Its body and row-header cells use `--role-surface`; only the
column-header band uses `--role-surface-muted`. The shared table is a
borderless `2xl` surface with floating elevation, `--space-2`/`--space-4` cell
padding, direct role-border horizontal dividers, no vertical rules or zebra
stripes, and small preview and action column composition classes. Apps own
data and behavior, not another table presentation. When an app makes a column
sortable, its header uses a `small` quaternary Dieter Button containing a 12px
Dieter Icon. Dieter renders inactive
sort controls with `--color-system-gray-3` and the active ascending or
descending control with `--color-system-black`; the app still owns sort state
and direction.

## Icon Delivery

New or changed icons are generated manually with `tooling/sf-symbols/**`, then
committed as:

```text
dieter/icons/icons.json
dieter/icons/svg/{name}.svg
```

The Tokyo product-root sync deploys the SVG source files directly to:

```text
/dieter/icons/svg/{name}.svg
```

The exporter gives every selected SF glyph the same optical-canvas treatment,
so consumers use ordinary Dieter size tokens without icon-specific correction.
`icons.json` is not deployed or consulted by product runtime. Product controls
keep their accessible name on the control; decorative icons are painted from
the declared SVG URL and remain semantically hidden. Button and Icon are
independent contracts: Button owns action geometry, its
primary/secondary/tertiary/quaternary visual hierarchy, spacing, and centered
child layout. Direct child order places an optional Icon before or after the
label. An unsized direct Icon receives the Button-size default of
`.75rem`/`1rem`/`1.25rem` for small/medium/large, while an explicit numeric Icon
size remains authoritative. Omitting Icon or label
yields the text-only or icon-only Button composition.

Account-uploaded assets and fonts remain under
`accounts/{accountPublicId}/...`; they are not Dieter icons.

## Verification

From repo root:

```bash
pnpm --filter @ck/dieter typecheck
pnpm dieter:governance:check
pnpm validate:widgets
```

Run the focused Bob, Roma, Prague, DevStudio, or widget-package build when that
consumer changed. `pnpm tokyo:r2:sync:check` must list only
`dieter/icons/svg/**` under the Dieter deploy root.

## Operator Rules

- Edit Dieter source, never a generated mirror.
- Keep `tooling/sf-symbols/**` as the manual icon-authoring lane.
- Do not add a Dieter bundle, manifest, registry service, browser global, or
  compatibility copy.
- Do not add external vertical margins to reusable controls; host layout owns
  outside spacing.
- Do not use runtime CSS `@import` in generated widget packages.
- Do not inline repeated SVG bytes into compiled panels or application chrome.
- Public widgets may use declared Dieter icon URLs; they do not fetch shared Dieter
  CSS or JavaScript.
