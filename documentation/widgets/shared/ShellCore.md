# Widget Frame, Shell, Header, And Core

STATUS: CURRENT SYSTEM OPERATOR SPEC

Every widget has one presentation frame and one Shell. Shell contains exactly
one Header and one Core. Reusable code, common account defaults, and Shell
ownership are separate concerns.

## Product Model

```text
Stage
  Pod
    Shell [data-ck-widget][data-ck-instance-id]
      Header
      Core
```

- **Stage** is the outer presentation canvas. It owns host placement, canvas
  mode, alignment, outer padding, background, shadows, floating behavior, and
  iframe resize reporting.
- **Pod** is the inner presentation surface. It owns content width, inner
  padding, background, border, radius, and shadows.
- **Shell** is the two-slot composition contract. Its direct product children
  are Header and Core, and nothing else.
- **Header** owns title, subtitle, optional Header CTA, their appearance, and
  Header layout inside Shell.
- **Core** is the widget-specific body. It owns Core geometry, including
  `coreSize.*`, plus the widget namespace such as `cards.*` or `faq.*`.

The Shell element also carries widget type and materialized instance identity.
Those attributes let the runtime locate one widget, load its exact payload, and
scope DOM operations. Runtime identity is not another product layer.

## State Ownership

| Concern | Owner |
| --- | --- |
| `stage.*` | Stage presentation frame |
| `pod.*`, `appearance.podBorder` | Pod presentation frame |
| `header.*`, `headerCta.*`, `appearance.headerCta.*` | Header |
| `coreSize.*` | Core geometry |
| `{widgetNamespace}.*` | Widget Core |
| Header typography roles | Header |
| Widget-specific typography roles | Core |
| `typography.globalFamily` | Widget-wide presentation |
| Locale switcher state and appearance | Locale delivery chrome |
| Backlink state | Branding chrome and product policy |
| Social-share state | Share chrome |

Typography, fill, appearance, localization preview, branding, locale switching,
and social sharing use shared runtime implementations. Shared implementation
does not make those concerns Shell children.

## Common Account Defaults

Account defaults distinguish values common to every widget type from
widget-specific Core defaults:

```text
common
widgets.{widgetType}.core
```

`common` is a persistence/default scope, not a DOM owner. It may contain Stage,
Pod, Header, shared Core geometry, typography, and chrome defaults because one
account value seeds every widget type. Code must not infer Shell ownership from
that storage scope.

New instances merge the exact common defaults with the selected widget's Core
defaults and reject conflicts. Saved instance configuration remains one exact
flat runtime state.

## Shared Runtime APIs

Widget clients consume shared helpers from `tokyo/product/widgets/shared/`:

| Global | Responsibility |
| --- | --- |
| `CKWidgetRuntime` | Finds the Shell instance anchor, resolves exact instance state, registers initialization, and scopes preview updates. |
| `CKHeader` | Renders Header content, Header CTA, and Header layout. |
| `CKStagePod` | Applies Stage and Pod presentation. |
| `CKCoreSize` | Applies Core geometry. |
| `CKTypography` | Applies typography state to its declared Header, Core, or chrome scope. |
| `CKBranding` | Applies product-policy branding chrome. |
| `CKSocialShare` | Applies share chrome to Stage or Pod. |
| `CKLocaleSwitcher` | Applies locale chrome for delivered overlays. |
| `CKSurface`, `CKAppearance`, `CKFill` | Provide reusable rendering primitives without owning product state. |

Required helpers fail visibly when missing. Widget code must not create local
fallback implementations.

## Core Namespaces

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

Core owns body content, widget-specific layout and appearance, repeatable items,
and widget-specific runtime behavior.

## Hard Stops

- Do not describe Stage, Pod, typography engines, locale, branding, or share as
  Shell children.
- Do not add another product layer between Pod and Shell.
- Do not put anything beside Header and Core inside Shell.
- Do not classify state ownership through manually maintained path-prefix
  families.
- Do not create widget-local copies of shared runtime primitives.
- Do not silently heal missing or invalid persisted state.
