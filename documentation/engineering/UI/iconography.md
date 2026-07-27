# Iconography In Clickeen

Living reference for iconography doctrine.

- Canonical doctrine: this document.
- Execution PRD: [`126C__PRD__Iconography.md`](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126C__PRD__Iconography.md).
- Source artifact pair: `dieter/icons/icons.json` and `dieter/icons/svg/*`.
- Human origination tool: `tooling/sf-symbols`.
- Deploy propagation: the Tokyo product-root sync copies
  `dieter/icons/svg/**` directly to R2 `dieter/icons/svg/**`.

This document is not an icon-redesign program. The current 157 Dieter icons are the
approved operational icon set. Agents consume existing icons; they do not add,
rename, reshape, replace, or originate icons.

The approved set is the current SF Symbols port. Its dot-notation names and
manifest geometry format are product source truth; agents do not rename,
reshape, or reinterpret that format.

## Source And Delivery

New Dieter icons are human-originated through `tooling/sf-symbols`, then
committed as the source artifact pair:

```text
dieter/icons/icons.json
dieter/icons/svg/{icon.name}.svg
```

There is no Dieter icon build or generated Tokyo copy. The GitHub product-root
deployment copies committed SVG source bytes directly to R2. `icons.json`
remains source/compile-time data and is not deployed.

## Consumer Lanes

Agents must use the lane that owns the UI they are editing:

| Lane | Consumption rule |
| --- | --- |
| Dieter component source | Use approved icon slots such as `data-icon="approved.name"`; no raw SVG drops. |
| Bob compiler/output | Bob preserves Dieter `data-icon` slots; source hydration points them at `/dieter/icons/svg/{name}.svg`. |
| Bob app chrome | Use the same Dieter `data-icon` contract; icons stay decorative and control names live on controls. |
| DevStudio/Admin | Generated raw SVG imports are Admin tooling/reveal only, not product runtime doctrine. Missing icons render an explicit `[missing icon: name]` marker. |
| Roma product UI | Use the same Dieter operational-icon contract through the implementation lane specified by the 126M execution PRD; do not create a Roma-only icon system. |
| Prague static site | `DieterIcon.astro` paints approved Tokyo `/dieter/icons/svg/name.svg` URLs through a CSS mask so icons inherit `currentColor`; Prague validates rendered Dieter names against the manifest and uses numeric Dieter sizes only. |
| Public widgets | Widget-owned code may use approved Dieter names as CSS masks/static URLs where that widget schema exposes operational Dieter icons. Do not create a shared widget icon service. |
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
interactive control size. Component/control `data-size="sm|md|lg"` APIs are not
icon glyph sizing and stay with their owning component PRDs.

## Color And State

Dieter source SVGs and rendered operational icons use `currentColor`.

Icon hover, active, selected, disabled, and pressed appearance comes from the
owning parent/control state. This doctrine does not create icon-specific color variants,
filled/outlined variants, optical sizes, weights, or scales.

## Semantics

Source SVGs do not carry product semantics.

- Decorative icons are hidden from semantic output.
- Icon-only controls put the accessible name on the control.
- Icons next to visible text are decorative unless the icon adds independent
  product meaning.
- Meaningful standalone icons require an explicit label rule in the consumer.
- Missing icons in tooling/reveal paths must be visible as missing truth, not
  silently omitted.

## Account Asset Boundary

Dieter icons are operational system icons. Account/customer/admin SVG assets are
account assets and move through account asset authority and account asset
routes. They may be SVG files, but they do not become Dieter icons and Dieter
icons must not be sourced from account asset storage.
