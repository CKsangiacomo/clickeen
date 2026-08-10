# Iconography In Clickeen

Living reference for iconography doctrine.

- Canonical doctrine: this document.
- Execution PRD: [`126C__PRD__Iconography.md`](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126C__PRD__Iconography.md).
- Source SVGs: `dieter/icons/svg/*`.
- SF extraction input: `dieter/icons/icons.json`.
- Human origination tool: `tooling/sf-symbols`.
- Deploy propagation: the Tokyo product-root sync copies
  `dieter/icons/svg/**` directly to R2 `dieter/icons/svg/**`.

The current 159 Dieter icons are the human-selected operational icon library.
Agents consume that library; icon selection and origination remain human-owned.
The system does not maintain a second approval list, ask whether an icon may be
used, or validate the library against itself.

The selected icons are the current SF Symbols port. Their dot-notation names
and generated SVG geometry are product source truth.

## Source And Delivery

New Dieter icons are human-originated through `tooling/sf-symbols`.
`icons.json` is the extraction input and the generated SVG files are the Dieter
source consumed by the product:

```text
dieter/icons/icons.json
dieter/icons/svg/{icon.name}.svg
```

The exporter places every SF path on the same optical coordinate canvas rather
than cropping each icon to its ink bounds. Consumers therefore get consistent
relative sizing from the SVG itself; they do not compensate icon by icon.

The GitHub product-root deployment copies committed SVG source bytes directly
to R2. `icons.json` is not a runtime registry and is not deployed.

## Consumer Lanes

Agents must use the lane that owns the UI they are editing:

| Lane | Consumption rule |
| --- | --- |
| Dieter component source | Declare the selected icon name in the component's existing `data-icon` input; no raw SVG copies. |
| Bob compiler/output | Bob preserves Dieter `data-icon` slots; source hydration points them at `/dieter/icons/svg/{name}.svg`. |
| Bob app chrome | Use the same Dieter `data-icon` contract; icons stay decorative and control names live on controls. |
| DevStudio/Admin | Generate the reveal and raw SVG imports directly from `dieter/icons/svg/**`; load Dieter's Icon CSS once at the DevStudio application boundary because any component reveal may compose an Icon. This is tooling, not a product runtime icon system. |
| Roma product UI | Use the same Dieter operational-icon contract through the implementation lane specified by the 126M execution PRD; do not create a Roma-only icon system. |
| Prague static site | `DieterIcon.astro` paints the declared Tokyo `/dieter/icons/svg/name.svg` URL through a CSS mask so icons inherit `currentColor`; Prague uses numeric Dieter sizes only. |
| Public widgets | Widget-owned schemas may offer field-specific icon choices and widget code renders those declared Dieter names as CSS masks/static URLs. Do not create a shared widget icon service or global approval catalog. |
| Account assets | SVG assets uploaded by accounts, including the admin account, are account assets. They are not Dieter icons. |

## Sizing

`diet-icon` and `[data-icon]` are CSS-only presentation primitives. There is no
browser icon runtime.

Allowed glyph sizes are numeric only:

```text
12, 16, 20, 24, 28, 32, 36, 40
```

These map to `--icon-size-12` through `--icon-size-40`. Non-numeric
`diet-icon` size aliases are not supported.

Icon glyph size is separate from wrapper size, component slot size, and
interactive control size. Button uses `small|medium|large`; other components
may retain their own `sm|md|lg` APIs. Neither is an Icon glyph size. An unsized
Icon that is a direct Button child receives the Button-context `.75rem` glyph
size. Supplying numeric `data-size` deliberately overrides that context and
remains the Icon's own authority.

Button composition uses direct child order: an Icon authored before the label
renders before it, and an Icon authored after the label renders after it.
Omitting the Icon produces a text-only Button. There is no position attribute
or CSS reordering. Icon-only Buttons remain the same Button primitive and
require an accessible name on the control.

## Color And State

Dieter source SVGs and rendered operational icons use `currentColor`.

Icon hover, active, selected, disabled, and pressed appearance comes from the
owning parent/control state. The common SVG canvas supplies optical sizing; the
system does not add icon-specific size overrides, color variants, weights, or
consumer compensation tables.

## Semantics

Source SVGs do not carry product semantics.

- Decorative icons are hidden from semantic output.
- Icon-only controls put the accessible name on the control.
- Icons next to visible text are decorative unless the icon adds independent
  product meaning.
- Meaningful standalone icons require an explicit label rule in the consumer.

## Account Asset Boundary

Dieter icons are operational system icons. Account/customer/admin SVG assets are
account assets and move through account asset authority and account asset
routes. They may be SVG files, but they do not become Dieter icons and Dieter
icons must not be sourced from account asset storage.
