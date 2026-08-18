# Dieter components — the library reference

**Living, canonical reference — how to use each component.**

- Canonical doctrine: this document.
- Current execution PRD: [`127__PRD__UI_Localization_And_Design_System_Passes.md`](../../../Execution_Pipeline_Docs/02-Executing/127__UI_Localization_And_Design_System_Passes/127__PRD__UI_Localization_And_Design_System_Passes.md).
- **Source of truth:** `dieter/components/*` (the `.css`, `.html`, `.spec.json`,
  `.ts`, or `.js` files present for each declared contract) and
  `dieter/components/index.ts`.
- System mechanics (hydration model, spec binding, build): see [`dieter.md`](dieter.md). This doc is the per-component lookup; that doc explains the system once.

## Catalog (31 non-empty source directories including `shared`)

Legend: ✅ exported from `index.ts` · Direct host import · ⊘ no custom hydrator.

| Group       | Component          | Hydrate / binding                                                               | Status |
| ----------- | ------------------ | ------------------------------------------------------------------------------- | ------ |
| atoms       | `badge`            | Caller-owned compact state label                                                | ⊘      |
| atoms       | `button`           | Native button/link, spec `string`, `data-size`/`data-type`                      | ⊘      |
| atoms       | `icon`             | — (CSS-only wrapper)                                                            | ⊘      |
| atoms       | `spinner`          | Caller-owned progress status; decorative inside a labelled Button              | ⊘      |
| atoms       | `tabs`             | Native radio-group behavior, caller-owned labels                                | ⊘      |
| atoms       | `segmented`        | Native radio-group behavior, caller-owned labels                                | ⊘      |
| atoms       | `toggle`           | Native checkbox behavior                                                        | ⊘      |
| atoms       | `slider`           | `hydrateSlider` / `destroySlider`, numeric binding                              | ✅     |
| inputs      | `datefield`        | `hydrateDatefield` / `destroyDatefield`, empty or exact civil-date string       | ✅     |
| inputs      | `date-range-picker`| `hydrateDateRangePicker` / `destroyDateRangePicker`, null or exact range JSON   | ✅     |
| inputs      | `textfield`        | Native one-line string input                                                    | ⊘      |
| inputs      | `valuefield`       | Native finite-number input with caller bounds                                   | ⊘      |
| choosers    | `choice-tiles`     | `hydrateChoiceTiles`, `string`                                                  | ✅     |
| choosers    | `object-manager`   | `hydrateObjectManager` / `destroyObjectManager`, top-level object composition   | ✅     |
| choosers    | `repeater`         | `hydrateRepeater` / `destroyRepeater`, nested inline collection editing         | ✅     |
| choosers    | `bulk-edit`        | `hydrateBulkEdit` / `destroyBulkEdit`, `row-path`                               | ✅     |
| dropdowns   | `dropdown-fill`    | `hydrateDropdownFill` / `destroyDropdownFill`, exact fill JSON                  | ✅     |
| dropdowns   | `dropdown-actions` | `hydrateDropdownActions` / `destroyDropdownActions`, `string`                   | ✅     |
| dropdowns   | `dropdown-border`  | `hydrateDropdownBorder` / `destroyDropdownBorder`, exact border JSON            | ✅     |
| dropdowns   | `dropdown-shadow`  | `hydrateDropdownShadow` / `destroyDropdownShadow`, exact shadow JSON            | ✅     |
| dropdowns   | `dropdown-upload`  | `hydrateDropdownUpload` / `destroyDropdownUpload`, exact asset JSON             | ✅     |
| dropdowns   | `dropdown-edit`    | `hydrateDropdownEdit` / `destroyDropdownEdit`, exact inline HTML string         | ✅     |
| dropdowns   | `menuactions`      | native action row, unbound                                                      | ⊘      |
| feedback    | `banner`           | Caller-owned persistent message, actions, and dismissal                         | ⊘      |
| composites  | `popover`          | — (CSS/HTML/spec; container)                                                    | ⊘      |
| structural  | `table`            | semantic table visual base and overflow shell                                   | ⊘      |
| structural  | `data-table`       | controlled operational composition over Table                                  | ⊘      |
| structural  | `popup`            | blocking native-dialog visual structure                                         | ⊘      |
| activity    | `agent-activity`   | — (transient narration strip)                                                   | ⊘      |
| operational | `tooltip`          | Caller-owned label or description from `data-tooltip`                           | ⊘      |
| other       | `shared/`          | helpers (`account-assets`, `dialog-lifecycle`, `dropdownToggle`) — not rendered | —      |

## Component Contract

Every ToolDrawer field type has one inspectable Dieter contract: stencil, spec,
CSS, and behavior source only when native behavior is insufficient. A missing
required spec is a failure, not optional success. Explicit presentation-only
primitives such as `icon` are named exceptions, not a second contract.

The governing component product law is:

- Dieter components are consumer-agnostic primitives. They own reusable
  structure, presentation, and interaction; they do not inspect Widget paths,
  account policy, Bob domains, Roma domains, or another consumer's product
  meaning.
- Consumer-specific data, capability filtering, state transitions, and product
  composition remain in the owning consumer. A consumer-specific need does not
  create a Dieter branch, special case, or variant.
- Visible and accessible human-language copy is caller input. Components
  receive exact resolved strings; they do not load a locale, select a
  translation, keep a copy catalog, or use a different localization contract
  for each consumer.
- ToolDrawer copy always follows the same route: Widget specs use
  `$label:{key}`, the adjacent Widget label file supplies the exact words, Bob
  resolves them while compiling the Widget editor artifact, and the component
  receives the resolved string. Bob/Roma Chrome resolves its own application
  copy before composing the same primitive.
- A component may expose generic values, events, slots, and binding inputs. A
  host adapter may connect those to its state, but the component must not
  interpret the host's product domain.
- Dieter does not install a custom keyboard-navigation program or a blue
  focus-ring treatment across components. Native controls retain their native
  input, selection, and dismissal behavior. Blue presentation communicates an
  actual selected or active product state; ordinary hover and editing use
  neutral component surfaces.
- Shared presentation belongs in an existing Dieter primitive or shared Dieter
  source. Components may share geometry without merging their distinct jobs.
  Any source that violates these rules is a component defect to correct in its
  owning pass, not a precedent for another exception.
- Dieter JSON controls expose the consumer-neutral `data-dieter-json` marker,
  and generic multi-path component edits emit `dieter-ops`. Host-owned paths
  remain separate from that component protocol.
- Consumers destroy every hydrated root they render before replacing its DOM.
  DevStudio is currently the only consumer that hydrates Datefield and Date
  Range Picker; Bob and Roma have no date-specific host or compiler path.
  Dropdown Edit destruction detaches its Lexical root; Fill and Upload cancel
  pending media resolution; Bulk Edit releases its dialog lifecycle and
  listeners; Object Manager and Repeater release their child controls,
  listeners, dialogs, and active collection state.
- Button is one `.diet-button` primitive. Its direct children determine whether
  it is text-only, icon-only, or icon-and-text; those are not separate Button
  classes or variants.
- Button requires `data-size="small|medium|large"` and
  `data-type="primary|secondary|tertiary|quaternary"`. Type expresses visual
  hierarchy, not the wording or function of the action: primary is the filled
  blue emphasis, secondary is the quiet gray treatment, and tertiary is the
  blue outlined treatment inherited from the former line Button. Quaternary
  has no resting background or border and reveals its state treatment on
  interaction. Size owns the Button box, spacing, radius, and text typography.
  Small, medium, and large use the measured proportion set respectively:
  `1.5rem/1.75rem/2.5rem` height, `.75rem/.875rem/1rem` text,
  `.25rem/.375rem/.5rem` child gap, and `.5rem/.5rem/1rem` inline padding.
  Their proportional radii are `.1875rem/.25rem/.375rem`.
- Button composition is explicit and bounded: omit Icon for text-only, omit
  label for icon-only, or compose both. Direct child order places an Icon before
  or after the label; Button CSS does not reorder children. Icon-only Buttons
  put their accessible name on the Button. Consumers do not invent another
  visual type in local CSS or create a separate icon-button component.
- A child `.diet-icon` owns an explicit glyph size independently through numeric
  `data-size`. When that attribute is absent, Button size supplies the direct
  Icon's proportional default: `.75rem` for small, `1rem` for medium, and
  `1.25rem` for large. An explicit numeric Icon size remains authoritative when
  a composition deliberately needs it. Button labels have no hidden padding.
- Button loading is one state of the same Button, not a second action control.
  The caller owns the asynchronous command, disables the Button, sets
  `data-loading="true"` and `aria-busy="true"`, and supplies the exact loading
  label. Button composes the ordinary current-color Spinner before that label
  and derives its size from the Button's existing icon ladder. Spinner never
  starts, retries, completes, or interprets the command.
- Choice Tiles is a two- or three-option string chooser with one `sm|md|lg`
  size authority on its root. Small, medium, and large use proportional
  `4rem/4.5rem/5rem` minimum heights, `.5rem/.5rem/.75rem` block padding,
  `.25rem/.5rem/.5rem` internal gaps, and `.25rem/.375rem/.5rem` radii.
  Inline padding remains `.5rem`; the row gap is `.25rem` at small and `.5rem`
  at medium/large so the constrained ToolDrawer width remains usable. Its
  unsized Icons use the tile-specific
  `1rem/1.25rem/1.25rem` ladder instead of a second rendered Icon-size input.
  Large uses `0.9375rem` text with a `1.25rem` line height; small and medium
  retain their corresponding Button typography.
  Labels wrap rather than truncate, so the caller's exact wording remains
  visible. Dieter owns no group or option words; Widget ToolDrawer instances
  supply both from their adjacent label file.
- Dropdown Actions is an immediate string chooser. At rest it shows the
  caller-supplied field label and current value; its hover treatment discloses
  the control without adding a permanent chevron. Opening it places the
  existing Popover over the row, repeats only the caller-supplied label in the
  header, and presents Menu Actions. Choosing an option updates the bound
  value and closes the Popover immediately; there is no Apply footer.
  The attached Popover inherits the row's `sm|md|lg` radius. Opening the
  control does not add a separate blue border or tint to the covered row; the
  Popover itself communicates the open state.
  `data-size="sm|md|lg"` is the component's single geometry and typography
  authority: the trigger is `1.25rem/1.5rem/1.75rem` high and uses
  `.6875rem/.8125rem/.875rem` text. Current ToolDrawer instances use `md`.
  The component owns no visible wording: label, placeholder, group labels,
  option labels, and badges are caller inputs. Its selected checkmark follows
  the Menu Actions size ladder at `.75rem/1rem/1.25rem`; it is not pinned to a
  separate glyph size. Bob projects the exact Roma-owned typography-family
  library into its consumer choices; Dropdown Actions does not inspect
  typography paths or font metadata.
- Menu Actions is one native, unbound action row for menus and Popovers. It
  owns only its `sm|md|lg` row geometry, typography, radius, padding, states,
  and optional trailing Icon size. The size ladder is
  `1rem/1.25rem/1.5rem` high, `.6875rem/.8125rem/.875rem` text, and
  `.75rem/1rem/1.25rem` for an unsized direct Icon. The complete
  caller-supplied label stays left aligned and the optional Icon/check stays
  fixed on the right. The caller owns the action, semantic role, selection,
  dismissal, disabled condition, and every visible word. Menu Actions has no
  binding, hydrator, visual variant, AI-specific treatment, or locale source.
- Clickable property-menu rows use the existing shared two-rail structure.
  The complete caller label stays on the leading rail. The trailing rail is
  right aligned; its dynamic text yields and receives the end ellipsis before
  any fixed chip or Icon. When text and a visual are both present, the text is
  authored first and the visual second. Rest and hover keep identical rail
  geometry; hover belongs to the complete row.
  Dropdown Actions, Border, Edit, Fill, Shadow, and Upload all use this rest
  structure. Their standard top-level Popovers repeat only the caller label
  and inherit the trigger's `sm|md|lg` radius. This shared presentation does
  not merge the components' jobs: immediate selection, rich-text editing, fill
  editing, shadow editing, and single-file upload remain their existing
  component behaviors.
- Dropdown Border edits one exact object:
  `{enabled:boolean,width:number,color:string}`. Root `sm|md|lg` owns the
  trigger, Popover radius, typography, Icon, and nested-control sizing at
  `1.25rem/1.5rem/1.75rem` row heights, `.25rem/.375rem/.5rem` radii,
  `.6875rem/.8125rem/.875rem` text, and `.75rem/1rem/1.25rem` Icons. The
  closed trigger shows width followed by the fixed color chip for an active
  border and only the existing `square.slash` Icon when there is no border.
  Its Popover repeats only the
  caller's field label, places Enabled directly below the header, and hides the
  color and width controls while disabled. Disabling preserves the exact
  stored width and color; changing one property does not rewrite another. At
  the current medium ToolDrawer size, its dependent controls use one
  `.5rem` vertical rhythm. Hue and Width share a `2.5rem` label rail, and the
  Slider input consumes the complete remaining row width so both tracks align.
  The shared Slider primitive provides that flexible range behavior; Border
  only owns its two equal label rails. The wider Popover uses a shallower
  saturation/value canvas at `8rem/9rem/10rem` for `sm|md|lg`. Color swatches
  sit centered in their grid cells with `0.125rem` removed from each dimension.
  Their corners use the component radius minus `0.125rem`. They have no resting
  stroke except white, which retains one gray edge against the white surface;
  selection uses a one-pixel blue outline.
  The component consumes the exact structured value supplied by the Widget
  contract and does not create fallback, repaired, or diagnostic states.
  Dieter owns no visible words. Each
  Widget's adjacent ToolDrawer label file supplies the component labels and
  exact field labels; Bob joins those labels with the global Dieter stencil.
- Dropdown Fill edits one exact fill object through one consumer-agnostic
  component. The caller explicitly declares its allowed `color`, `gradient`,
  `image`, and/or `video` modes through `fill-modes`; Dieter never infers a
  mode from a Widget path, label, or consumer. The closed property row uses
  the shared leading-label/trailing-value geometry, with value text before its
  fixed chip, and exact `none` uses the system `square.slash` Icon. Its attached
  Popover uses the component-owned `wide` work area and exactly one vertical
  composition: caller label, Enabled, the existing icon-only Segmented
  selector when multiple modes were declared, then the active editor. Enabled
  off writes exact `none` and hides dependent controls; re-enabling in the same
  open component session restores the exact prior fill. There is no separate
  remove-fill row, second enabled field, or Fill-only tab system.

  Toggle, Segmented, Slider, Textfield, and Button use the Dropdown Fill
  root's `sm|md|lg` size; the current product ToolDrawer uses `md`. The
  icon-only mode selector uses the established 1.25rem toolbar Icon size at
  every root size, keeping those mode glyphs as legible as the rich-editor
  toolbar without changing the surrounding Segmented geometry.
  Gradient-stop add/remove is one Dieter Button with two ordinary pre-rendered
  Dieter Icons; the component changes which Icon is visible without dynamically
  replacing an Icon source, and its local hidden rule removes the inactive Icon
  from layout. Solid color
  and gradient editing use the shared Slider/Textfield geometry,
  the compact `6rem/7rem/8rem` color-canvas ladder, a trailing opacity value,
  one Hex row, and one direct nine-column two-row palette. Swatches are two pixels smaller
  than their grid cells, only white retains a gray resting edge, and selection
  uses a one-pixel blue outline. Image and video use the same compact surface
  height ladder while retaining their existing upload, choose, and remove
  behavior. Selecting image or video without an asset writes exact `none` and
  the closed row shows only the centered `square.slash` Icon; it does not retain
  or display the prior mode's chip. Gradient edits preserve the declared
  `linear|radial|conic` kind and exact stop values. Image and video modes use
  the supplied account-assets client. The caller-owned client consumes its
  owning host's exact response and presents any exact upload upsell reason; Dieter only
  dispatches that supplied generic reason. The primitive does not own an
  account, route, policy reason set, or Widget-specific media rule. All visible and accessible
  words are caller inputs from the Widget-adjacent ToolDrawer label file.
  There is no inferred media capability, component copy catalog, fallback
  fill, repaired value, or compatibility value shape.

- Dropdown Shadow edits one exact object:
  `{enabled:boolean,inset:boolean,x:number,y:number,blur:number,spread:number,color:string,alpha:number}`.
  Its closed row shows exact opacity followed by the base-color chip while
  enabled, including `0%`; disabled shows only `square.slash`. The attached
  `wide` Popover repeats the caller label, places Enabled first, then reveals a
  live non-clickable shadow preview, exact Horizontal/Vertical/Blur/Spread/
  Opacity sliders with trailing `px`/`%` values, and the compact color editor.
  `axis="x|y|both"` hides only the irrelevant offset row and never rewrites the
  hidden coordinate. Disabling hides dependent controls and preserves every
  exact property. Each interaction changes only its owned property; `inset`
  and unrelated values remain untouched. All visible and accessible words are
  supplied through the Widget-adjacent ToolDrawer label contract. The
  component has no default shadow, invalid mode, repair, fallback, native
  color-picker shortcut, Widget branch, or consumer-specific behavior.
  The same shaped Widget contract supplies the composition copy around internal
  shadows: the caller-specific link label plus the common layer and
  below/above-content option labels. Linking changes only the `linked` path;
  it never copies `all` into side objects or merges side objects into `all`.
  Shared Widget rendering uses the exact object as an outside or inset CSS
  shadow and rejects an `inset` mismatch rather than repairing it. Stage adds
  in-document visual gutters for its outside shadow; FAQ applies its declared
  inside shadow to each Q&A card through the shared surface primitive.
- Dropdown Upload owns the single-file workflow for one caller-owned field. It
  binds one exact value, `null | {assetRef:string,name:string}`: `null` means no
  selected file, and the object identifies one account asset and its exact
  filename. The closed property row shows the caller label and either the
  caller placeholder or filename; only the trailing filename truncates. Its
  row-width Popover repeats the caller label, presents one preview area and one
  native file input, and exposes Upload for an empty value or Replace and
  Remove for a selected value. Upload uses the supplied account-assets client;
  Roma/Tokyo remain the policy and storage authorities. Dieter does not impose
  file limits, infer a Widget path, persist a second metadata field, author
  visible copy, or own a locale catalog. The caller supplies the label,
  placeholder, action words, and failure copy. Product Widget use resolves the
  five component words from that Widget's adjacent ToolDrawer label file.
  Preview kind is resolved from the account asset's exact content type rather
  than guessed from the filename. The caller-owned asset client decides
  whether an upload failure is an upsell request or the component's
  caller-supplied error state; Dieter owns neither Roma response parsing nor
  account-plan reason keys. DevStudio examples are local component
  demonstrations, not account storage.
- Menu Actions remains a separate menu-row primitive with the single
  `sm|md|lg` size API described above. Low-level geometry tokens remain
  internal source mechanics.
- `textedit` is deleted because it had no product consumer.
- Textfield is one native caller-labelled one-line string editor with no custom
  hydrator. Its required `sm|md|lg` size owns the row height, radius, label and
  value typography, spacing, hover, editing, and disabled presentation. At rest
  the complete leading label remains visible and only the trailing current
  value may ellipsize; while editing the label yields the complete row writing
  surface. Placeholder text is optional exact caller copy. Textfield does not
  invent a placeholder, binding path, validation, product meaning, or locale.
- Valuefield is one native caller-labelled finite-number editor with no custom
  hydrator. Its required `sm|md|lg` size owns the row and a content-sized
  trailing numeric editor. Rest keeps the exact value on the shared right rail;
  hover belongs to the complete row, and editing reveals one neutral trailing
  surface whose width grows with the numeric content while remaining bounded
  by the available row. The caller declares the exact inclusive `min` and
  `max` that belong to that field; signed values remain legal when the caller
  declares a signed range. Hosts reject non-finite and out-of-bounds edits
  without clamping, coercing, substituting, or changing the current draft.
  Native `step` remains browser input metadata, not a second Dieter validation
  rule.
- Datefield and Date Range Picker share one private Dieter civil-date calendar
  presentation while remaining two separate field contracts. Datefield binds
  only `"" | "YYYY-MM-DD"`. Date Range Picker binds only
  `null | {start:"YYYY-MM-DD",end:"YYYY-MM-DD"}` with exact keys and
  `start <= end`. Both use Gregorian civil dates without timezone conversion,
  accept optional exact `min`/`max` bounds, and reject malformed, impossible,
  reversed, or out-of-bounds truth instead of repairing it.
- Their closed `sm|md|lg` rows use the shared property-row model and a calendar
  Icon. The attached one-month `extra-wide` Popover composes the existing
  Popover, Button, and Icon primitives. Datefield commits one selected day and
  closes. Date Range Picker keeps the first day provisional only inside the
  open surface, previews the interval on hover, and commits on the second day;
  choosing an earlier second day restarts the provisional range. Same-day
  ranges are valid. Clear commits the exact empty value for that field. Escape
  or outside dismissal discards only a provisional range and preserves the
  prior committed value.
- Every human-language input is caller-owned: field label, placeholder,
  Previous month, Next month, and Clear. The caller also supplies the exact
  locale; Dieter derives the month heading, weekday labels, date names, and
  closed value through `Intl`. Dieter owns no locale file, English fallback,
  native browser date-picker skin, timezone policy, preset, Apply workflow, or
  second public Calendar component. No current Widget declares either field,
  so the five current Widget artifacts and product data remain unchanged.
  DevStudio is their only current consumer and exercises their real source
  lifecycle directly; product-host integration belongs to the pass that adds a
  real caller.
- Toggle is a native checkbox HTML/CSS/spec contract with no custom hydrator.
  Its required `sm|md|lg` size owns the complete row, label typography, switch
  rail, hover, checked, and disabled presentation. The complete row is
  the native label and activates the checkbox. A disabled Toggle presents one
  disabled state on the complete row; consumers do not dim or resize only the
  switch. Every visible label is exact caller copy.
- Slider is one native range input with a required `sm|md|lg` size and exact
  caller label. Its small Dieter hydrator owns only the visual progress CSS
  variables on initial render, native input, and the existing `external-sync`
  signal after a host or compound editor projects an exact numeric value.
  Hosts continue to own the numeric value and binding, and call `destroySlider`
  before replacing the hydrated control surface. Slider invents no unit,
  trailing readout, clamp, validation copy, or product meaning; a compound
  editor may compose its own caller-labelled value rail around the primitive.
- Tabs is one native caller-labelled radio group. Checked and disabled state
  come from the native inputs; CSS owns the shared baseline, selected marker,
  size ladder, and states. Dieter installs no tab roles, roving tabindex,
  arrow-key handler, or focus-moving controller. There is currently no Widget
  ToolDrawer Tabs declaration; DevStudio reveals the primitive directly.
- Segmented is one native radio group with `sm|md|lg` geometry and
  `txt|ic|ictxt` content shapes. The radio input is the sole checked and
  disabled authority; Dieter CSS owns the rail, selected surface, typography,
  Icon ladder, hover, and disabled presentation. The rail keeps a two-pixel
  inset around the selected surface, and hovering a selected segment does not
  replace or wash out that selected surface. Each segment contains
  direct presentational content rather than a nested Button, and no hydrator
  mirrors state through `aria-pressed`. Visible labels, icon-only accessible
  names, and the group name are exact caller inputs. Widget options resolve
  through the adjacent Widget label file; Bob Chrome remains Bob-owned copy.
- Object Manager and Repeater are the two collection-editing primitives, with
  deliberately separate jobs. Object Manager renders each top-level object's
  caller-declared editor. `allow-structure="true"` adds one explicit top-level
  workflow: immediate Add plus a Popup draft for reorder/delete, saved as one
  exact array update. `allow-structure="false"` renders only the object
  editors; it emits no structural controls or behavior. Cancel closes a clean
  draft, while a dirty draft uses the existing caller-labelled
  keep-editing/discard flow. Object Manager never infers an object shape,
  label, Widget path, minimum, or structural permission. Its existing Add
  action composes the ordinary Dieter `plus` Icon before its caller label and
  alone uses the `--color-system-indigo-5` surface with the existing Button
  state progression. Manage items retains the ordinary secondary Button.
- Repeater owns inline item add/remove/reorder for a declared collection,
  whether that collection is top-level or nested inside an Object Manager. It
  renders the caller template for every exact item, adds an exact caller-supplied
  `default-item`, removes subject to the declared `min`, and reorders through
  one explicit drag mode. The exact array is its only bound value. Existing
  values and every new default item must carry a stable non-empty `id`; the
  component assigns new ids only into caller-declared empty `id` coordinates.
  It does not derive an item shape from current values or template fields. Its
  compact root and item insets preserve the same leading and trailing
  alignment in rest and reorder states; the reorder completion action remains
  in the top header rail, and the Add action composes the ordinary Dieter
  `plus` Icon before its caller label.
- Nested collection fields retain consumer-neutral `data-path` coordinates.
  Only each actual host-bound outer collection field also receives Bob's
  `data-bob-path`; child components fold their exact array into the parent
  before the outer field emits. Both primitives require one `sm|md|lg` root
  size, use the existing Button,
  Icon, Textfield, Toggle, Popup, Tooltip, and child-hydrator contracts, and
  expose JSON only through `data-dieter-json`. All visible and accessible words
  are caller inputs. Widget ToolDrawer uses receive those exact strings from
  the adjacent Widget label file; Dieter has no collection copy catalog or
  Widget branch.
- The six dropdown triggers are native buttons.
- `dropdown-actions` is one immediate-choice listbox workflow; its dead
  footer/apply branch is gone.
- Dropdown Edit is the consumer-agnostic inline rich-text primitive for every
  ToolDrawer field declared with `type="dropdown-edit"`. Its closed row shows
  the leading portion of the current value and applies an end ellipsis only
  when the trailing rail cannot fit it. Its attached Popover contains a
  writing surface plus Bold, Italic, Underline, Strikethrough, Link, and Clear
  formatting actions. Link is available for every Dropdown Edit field: a text
  selection opens an editable URL field with one **Add link** action; a
  selection or caret inside an existing link shows its URL read-only with that
  same action position changed to **Remove link**. Changing a URL is the clear
  remove-then-add flow. There is no Apply or Update action and no second link
  button. The URL field, contextual action, and caller-labelled close action
  are one internal Dropdown Edit link sheet, not a nested Popover or separate
  component. An added href is the exact caller-entered string; Dropdown Edit
  does not trim, prefix, reserialize, or silently repair it. Public Widget
  rendering does not own URL acceptance. The consuming Widget's declared field
  contract admits raw human URL/protocol input once through the generic Bob
  editing boundary; materialization and public Core then consume that exact
  Clickeen href without revalidation, normalization, filtering, or silent
  omission. Existing public Widget URL-safety guards are implementation debt.
  Toolbar actions use the
  existing medium Button geometry with the
  existing `1.25rem` Icon size; the separate link-sheet close action keeps the
  medium Button's default `1rem` Icon. Clear formatting affects the selected
  formatting and does not remove links. The component does not preselect text
  when it opens. Its Popover header, editor, and toolbar use one `.5rem`
  vertical rhythm.
  Dropdown Edit uses the pinned, locally bundled Lexical editor engine. It does
  not call an external runtime service and does not introduce a new persisted
  document format: Bob's browser-memory value remains the existing compact
  inline HTML string using `strong`, `em`, `u`, `s`, `a`, and `br`. Empty is
  exactly `""`. Widget-adjacent ToolDrawer label files supply the exact ten-key
  Dropdown Edit component-action/accessibility shape, including the close
  action, through the existing compiler join. The declaring control remains
  responsible for its field label and placeholder. Dieter owns no product
  copy or Widget-specific behavior.
- Object Manager dialog lifecycle remains owned by the dialog contract.

Bulk Edit and Object Manager follow the exact dismissal contract in
[`dialogs-and-modals.md`](dialogs-and-modals.md). Saving either dialog applies
local edits to Bob's working state; account persistence remains Bob's separate
Save command.

Bulk Edit is a generic array-table editor. Its current column controls are text
and checkbox, declared by the caller. It does not contain Logo Showcase,
upload, account-asset, or account-policy behavior. The caller supplies its
trigger, dialog, action, column, placeholder, and empty-state words; a Widget
ToolDrawer use supplies all of them through that Widget's adjacent label file.
Bob derives each exact string or boolean item path from the same declared
`path`, optional `row-path`, and `columns`; no hidden child fields or
consumer-specific allowlist is required.
Its exported destroy function removes root listeners and destroys the shared
dialog lifecycle before a consumer replaces the hydrated DOM, including while
the dialog is open.

Dieter Popover owns the attached floating surface, padding, radius, shadow,
header/body structure, and open-state presentation. Its standard header is a
caller-supplied label only; it does not invent a decorative header Icon or
visible copy. Header and body share the Popover's outer inline alignment rather
than applying a second header inset. The caller owns the trigger, open state,
body content, selection, and any real workflow action. A component with a
genuine close or command action composes that action explicitly rather than
receiving a decorative Popover control.

Popover width is independent from control size. Its exact contract is
`row|wide|extra-wide`: `row` matches the closed property row, `wide` adds 40px
to its right edge, and `extra-wide` adds 80px. All three keep the same left
edge. Dropdown Border, Fill, and Shadow own `wide` as their global component
default; Dropdown Edit owns `extra-wide`. This gives current medium ToolDrawer
uses the intended work area without repeating width attrs through every
Widget. A caller may still choose another contract value for a concrete use.
The expanded Popover overlays the workspace without resizing the ToolDrawer or
changing the dropdown's `sm|md|lg` height, typography, Icon, or radius
contract. Border, Fill, and Shadow render their 18-color palettes as one direct
nine-column grid, yielding two rows in their default wide Popovers. Edit gives
the extra width directly to its writing surface and toolbar. Actions and Upload
remain row-width. Wide and extra-wide Popovers also remain inside the viewport
with an 8px vertical inset; this is shared Popover geometry, not a date-specific
positioning exception.

Per-component source documentation records markup, `data-*` attributes,
binding, behavior/hydration, variants, sizes, states, and semantics. Step 6 maps
the exact source lines that diverge from this contract; it does not reopen the
contract.

## Application Inputs And Tables

Applications compose forms from Dieter's actual input contracts. Single-line
text uses `textfield`, immediate choices use `dropdown-actions`, and ToolDrawer
inline rich text uses `dropdown-edit`. Apps retain labels, values, layout, and
product behavior; they do not create a parallel generic field family. There is
no current generic long-form application editor.

Dieter Table owns width, alignment, borders, base spacing, and horizontal
overflow. Roma owns table data and state. DevStudio retains policy-specific
columns, editable-cell composition, data, and mutation behavior. Dieter does
not own sorting, pagination, data policy, or a React table abstraction.
DevStudio and Roma consume those input contracts directly. Dieter, Roma, and
DevStudio tables consume `table`.

Table column headers, row headers, and body cells all use the shared surface.
Table is a borderless `lg` surface with no elevation. The column-header
underline uses `--color-system-gray-step3`; body-row dividers use
`--color-system-gray-step5`. There are no vertical rules or zebra stripes.
Cells use `--space-3` block and `--space-4` inline padding. Column
headers use `label-s`; every body `th` and `td` uses `body-s`; action controls
retain their Dieter component typography. Technical values receive no separate
monospace treatment. Preview and action columns use the small Table-owned
composition classes rather than consumer-local base styling.

Sortable headers remain app-owned behavior composed inside Dieter Table. Their
control is a `small` quaternary `.diet-button` with a 12px `.diet-icon`:
inactive columns use `chevron.down.dotted.2` with
`--color-system-gray`; the active column uses `chevron.up.2` or
`chevron.down.2` with `--color-system-black`. Dieter owns the color treatment
through `aria-sort`; apps own the exact icon derived from their selected
column and direction, plus row ordering.

Data Table is the operational composition over that unchanged Table base. It
owns reusable slots and presentation for native controlled selection, the
selected-count Badge, caller-composed batch actions, sortable headers, row
actions, loading, empty, filtered-empty, and pagination. It does not fetch,
store, filter, sort, page, select, or mutate records and has no hydrator or
React abstraction. The caller owns every record, state transition, command,
visible word, and accessible label. Roma may use this composition when an
operational domain actually needs bulk selection; the current Table remains
the right primitive for ordinary static or app-owned tabular layouts.

Dieter Popup owns the blocking native `<dialog>` appearance and structural
slots: header, body, footer, and actions, with small, medium, and large sizes.
The Popup is one continuous elevated surface: it has no outer stroke or
internal header/footer rules, uses the shared `2xl` radius, and provides one
`--space-6` outer inset with `--space-6` separation between the structural
sections. When a visible title is present it uses the existing `heading-4`
treatment and names the dialog. A caller may omit the visible title only when
it supplies the exact alternate accessible name.

The optional dismiss presentation is one medium quaternary Dieter Button with
the `multiply` Icon. The caller supplies its accessible label and binds it to
an already-approved dismissal path. Popup owns no Close word and never decides
whether dismissal is allowed. Product owners keep workflow state, copy,
validation, persistence, and the accepted dismissal behavior. Bulk Edit,
Object Manager, DevStudio token editing, and Roma blocking dialogs consume
Popup without adding a second modal framework.

The shared plan-limit/upsell surface is one Roma-hosted composition of Popup.
For a Widget-bound denial, its body is the exact localized template supplied by
the compiled Widget artifact; Roma/system policy supplies current and target
plan values; Roma/system UI supplies the title, CTA labels, and behavior.
Dieter owns none of those inputs and never reads a capability, message id,
locale file, plan, or Upgrade destination. It provides the same caller-owned
body/action slots and dialog mechanics as any other Popup. Missing Widget copy
cannot be repaired by a Dieter fallback or default.

## Agent Activity Contract

Agent Activity renders one caller-supplied title and one or more
caller-supplied narration rows. Dieter owns the multi-row structure, `sm`/`md`
sizes, active presentation, and transient status semantics; it owns none of the
visible words. In Bob's ToolDrawer, the open widget artifact supplies the
static title from `compiled.toolDrawerLabels.components["agent-activity"].title`, and
Translation Agent events supply the dynamic rows.

The active component uses `--color-system-purple-5` as its surface and a
one-pixel rotating conic highlight. Transparent leading and trailing sections
leave most of the perimeter quiet: the conic border remains transparent through
25%, travels from `--color-system-purple` to `--color-system-indigo-3` at 99%,
then returns to transparent. The third background layer keeps the existing
surface behind the transparent border sections. Its
three-second linear rotation communicates live agent operation, not percentage
progress. Reduced motion keeps the same highlight static.

## Status And Feedback Primitives

Badge is compact, non-interactive state text. Its neutral, info, positive,
warning, and critical tones own only presentation; the caller supplies the
complete label and optional Dieter Icon. Badge does not infer status from data
or own a locale source.

Banner is a persistent parent-width message composition with default, caution,
and critical tones. The caller may supply title, description, Icon, actions,
semantic live-region inputs, and a labelled dismiss action. Banner does not
invent recovery, auto-dismiss, error mapping, or product policy. Every Banner
is borderless. Default—including description-only composition—uses
`--color-system-teal-4`; caution uses `--color-system-yellow-4`; critical keeps
`--color-system-red-5`. Each Icon accent follows the same tone family.

Spinner is current-color progress presentation at small, medium, and large.
As a standalone status it receives a caller-owned accessible label. Inside a
labelled Button it is decorative. Reduced motion keeps a static progress glyph;
the caller remains the sole authority for whether work is actually pending.

## Tooltip Contract

Unfamiliar icon-only actions use one governed Dieter Tooltip contract. A label
names an otherwise unfamiliar control; a description adds caller-owned context
through an exact `aria-describedby` target. Top, right, bottom, and left
placement are presentation inputs. Tooltip content wraps, is non-interactive,
and uses `--color-system-blue-contrast` at 85% surface opacity. It never
replaces the trigger's accessible name. Native `title` is not the
designed tooltip system. This contract does not create a tooltip controller or
move product copy into Dieter.

## Per-Component Consumption

Current ToolDrawer composites include Repeater, Object Manager, and Bulk Edit;
Menu Actions is composed inside dropdown menus. Tabs has no current Widget
consumer. Link editing is internal to Dropdown Edit and is not a separate
component or compiler field type.

Component color consumption follows [`color.md`](color.md): structural chrome
uses its role tokens and state formulas; user-authored color controls keep their
own product values. This document owns the component contract; the 126I
execution PRD maps component-by-component adoption.

Component icon slots follow [`iconography.md`](iconography.md): declare Dieter
icon names through the owning component input, keep `currentColor`, keep state
on the parent/control, and put icon-only control names on the control.
The `icon` component is a CSS-only `diet-icon` wrapper with numeric glyph sizes.
The 126I execution PRD owns component-by-component API cleanup beyond those
iconography rules.

Current inventory detail: Dieter components are source modules imported
directly by each application only where that application actually uses them;
there is no universal consumer and no runtime component manifest.
`shared/` contains helpers and is not a rendered component.
DevStudio generates 29 source-backed component pages. Historical 126 audits
remain point-in-time evidence.
