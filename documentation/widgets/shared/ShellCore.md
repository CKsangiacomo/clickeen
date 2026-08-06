# Shell And Core

STATUS: CURRENT SYSTEM OPERATOR SPEC

Every current widget is one Shell plus one Core.

Shell is the shared widget substrate. Core is the widget-specific body.

## Shell-Owned State

Shell owns these state families:

```text
header.*
headerCta.*
stage.*
pod.*
coreSize.*
localeSwitcher.*
appearance.headerCta.*
appearance.localeSwitcher*
appearance.podBorder
behavior.showBacklink
behavior.socialShare.*
typography.globalFamily
typography.roles.title
typography.roles.body
typography.roles.button
typography.roles.localeSwitcher
typography.roleScales.title
typography.roleScales.body
typography.roleScales.button
typography.roleScales.localeSwitcher
```

Widget defaults are merged over Shell factory defaults. Specs may provide
intentional overrides such as `typography` or `uiLabels`, but must not copy or
fork Shell-owned systems.

Shell contract authority:

```text
packages/widget-shell/src/contract.ts
packages/widget-shell/src/defaults.ts
packages/widget-shell/src/controls.ts
packages/widget-shell/src/modules.ts
```

Bob compiler composes Shell factory defaults with widget defaults. Roma account
widget defaults are a separate account document.

## Shared Runtime APIs

Widget clients call these shared globals from `tokyo/product/widgets/shared/`:

| Global | Source file | Operator role |
| --- | --- | --- |
| `CKWidgetRuntime.register` | `runtime.js` | Registers the widget initializer and builds runtime context. |
| `CKWidgetRuntime.bindStateUpdates` | `runtime.js` | Applies `ck:state-update` messages for the same widget/instance and refreshes preview typography data before the widget handler runs. |
| `CKHeader.applyHeader` | `header.js` | Renders Header title, subtitle, Header CTA, and Header layout. |
| `CKStagePod.applyStagePod` | `stagePod.js` | Applies Stage/Pod layout, background, padding, border, and sizing. |
| `CKCoreSize.applyCoreSize` | `coreSize.js` | Applies Core width/height sizing variables. |
| `CKTypography.applyTypography` | `typography.js` | Applies shared typography roles and locale/script font behavior. |
| `CKBranding.applyBacklink` | `branding.js` | Applies/removes shared Clickeen backlink branding. |
| `CKSocialShare.apply` | `socialShare.js` | Applies shared social share UI. |
| `CKLocaleSwitcher.applyLocaleSwitcher` | `localeSwitcher.js` | Applies shared locale switcher UI for delivered overlays. |
| `CKSurface.applyCardWrapper` | `surface.js` | Applies shared card-wrapper surface styling where the widget uses it. |
| `CKAppearance` / `CKFill` helpers | `appearance.js`, `fill.js` | Resolve fill, color, border, radius, and shadow values. |

If a widget client requires one of these helpers and it is missing, runtime must
fail closed with an explicit error. Optional helper use is documented in the
individual widget spec. Do not add local fallbacks in the widget.

## Core-Owned State

Core state lives under the widget namespace:

| Widget | Core namespace |
| --- | --- |
| `big-bang` | `bigBang.*` |
| `calltoaction` | `calltoaction.*` |
| `cards` | `cards.*` |
| `countdown` | `countdown.*` |
| `faq` | `faq.*` |
| `logoshowcase` | `logoshowcase.*` |
| `split-carousel-media` | `splitCarouselMedia.*` |
| `split-media` | `splitMedia.*` |

Core owns product body content, widget-specific layout, widget-specific
appearance, item arrays, and widget-specific runtime behavior.

## DOM Shape

Widgets use this Shell/Core hierarchy:

```text
[data-role="stage"]
  [data-role="pod"]
    [data-role="root"][data-ck-widget="{widgetType}"]
      .ck-headerLayout
        .ck-header
          [data-role="header-title"]
          [data-role="header-subtitle"]
          [data-role="header-cta"]
        .ck-headerLayout__body
          Core DOM
```

Core DOM stays inside `.ck-headerLayout__body`, which stays inside the shared
Pod. Widget Core does not create a second layout system.

Stable Shell roles:

```text
[data-role="stage"]
[data-role="pod"]
[data-role="root"]
[data-role="header-title"]
[data-role="header-subtitle"]
[data-role="header-cta"]
```

Stable Core roles are documented in each widget operator spec. Widget clients
resolve those roles directly and throw when required hooks are missing.

## Hard Stops

- Do not add Shell paths under a Core namespace.
- Do not put Core DOM outside the Pod.
- Do not create widget-local Header, branding, share, or locale switcher systems.
- Do not add runtime state healing for missing Core defaults.
- Do not add account-owned assets or account coordinates to product defaults.
