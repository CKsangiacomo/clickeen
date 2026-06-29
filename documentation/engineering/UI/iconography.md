# Iconography In Clickeen

Living reference for 126C iconography doctrine.

- Authority: [`126C__PRD__Iconography.md`](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126C__PRD__Iconography.md).
- Source artifact pair: `dieter/icons/icons.json` and `dieter/icons/svg/*`.
- Human origination tool: `tooling/sf-symbols`.
- Deploy propagation: root `scripts/build-dieter.js` copies verified source icons
  to `tokyo/product/dieter/icons/**`.

126C is not an icon-redesign program. The current 157 Dieter icons are the
approved operational icon set. Agents consume existing icons; they do not add,
rename, reshape, replace, or originate icons.

## Source And Build

New Dieter icons are human-originated through `tooling/sf-symbols`, then
committed as the source artifact pair:

```text
dieter/icons/icons.json
dieter/icons/svg/{icon.name}.svg
```

The ordinary Dieter build is propagation only:

```bash
pnpm build:dieter
```

That build verifies manifest/source parity and `currentColor` source SVGs, then
copies the artifacts into `tokyo/product/dieter/icons/**`. It does not mutate
committed source SVGs and is not an icon authoring path.

## Consumer Lanes

Agents must use the lane that owns the UI they are editing:

| Lane | Consumption rule |
| --- | --- |
| Dieter component source | Use approved icon slots such as `data-icon="approved.name"`; no raw SVG drops. |
| Bob compiler/output | Bob compiler replaces Dieter `data-icon` slots from `tokyo/product/dieter/icons/icons.json`. |
| Bob app chrome | Only named Bob chrome files use `bob/lib/icons.ts` directly; icons stay decorative and control names live on controls. |
| DevStudio/Admin | Generated raw SVG imports are Admin tooling/reveal only, not product runtime doctrine. Missing icons render an explicit `[missing icon: name]` marker. |
| Prague static site | `DieterIcon.astro` renders approved Dieter icon names from Tokyo `/dieter/icons/svg/name.svg`; Prague validates rendered Dieter names against the manifest. |
| Public widgets | Widget-owned code may use approved Dieter names as CSS masks/static URLs where that widget schema exposes operational Dieter icons. Do not create a shared widget icon service. |
| Account assets | SVG assets uploaded by accounts, including the admin account, are account assets. They are not Dieter icons. |

## Sizing

`diet-icon` is a CSS-only presentation wrapper. It is not a runtime component.

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
owning parent/control state. 126C does not create icon-specific color variants,
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
