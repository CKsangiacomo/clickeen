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
behavior.seoGeoAeoEnabled
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

## Generation And Runtime Boundary

Web Code Generator consumes Shell and Core structured state. It generates the
complete Header, Stage/Pod, sizing, typography, branding, social-share,
locale-switcher, and Core content markup into `index.html`, with their
presentation in `styles.css`.

Shared `runtime.js` exposes only behavior support through
`window.CKWidgetRuntime`:

```text
assertWidgetRoot
contextFor
isComposedPage
register
resolveInstanceId
roots
```

Widget-local interactive runtimes register against already-generated DOM.
Shared runtime also binds Header CTA, social-share, locale-switcher,
preview-ready, and iframe-resize behavior. There is no generic state-update
message, runtime typography-data channel, or Shell/Core content renderer.

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

Stable Core roles are documented in each Widget operator spec. Web Code
Generator requires only the template hooks each generation step actually
fills; it is not a general Widget-local hook validator. Interactive Widget
runtimes resolve only the generated behavior hooks they bind and fail
explicitly when a required hook is missing.

## Hard Stops

- Do not add Shell paths under a Core namespace.
- Do not put Core DOM outside the Pod.
- Do not create widget-local Header, branding, share, or locale switcher systems.
- Do not add runtime state healing for missing Core defaults.
- Do not add account-owned assets or account coordinates to product defaults.
- Do not move generated Shell/Core content rendering into `runtime.js`.
