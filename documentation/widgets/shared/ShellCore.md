# Widget Frame, Shell, Header, And Core

STATUS: CURRENT SYSTEM OPERATOR SPEC

Every widget has one presentation frame and one Shell. Shell contains exactly
one Header and one Core. Reusable code, common account defaults, and Shell
ownership are separate concerns.

Core is the Widget's unique software boundary: mandatory HTML, CSS, and
JavaScript. Core JavaScript owns Widget behavior but is never the initial
content renderer, materializer, localizer, validator, preview host, or serving engine.
Stage, Pod, Shell, Header, and their behavior are shared system composition
used identically by every Widget.

## Product Model

```text
Stage
  Pod
    Shell [data-ck-widget][data-ck-instance-id]
      Header
      Core
```

- **Stage** is the outer presentation canvas. It owns host placement, canvas
  mode, alignment, outer padding, background, outside/inside shadows, floating behavior, and
  iframe resize reporting.
- **Pod** is the inner presentation surface. It owns content width, inner
  padding, background, border, radius, and outside/inside shadows.
- **Shell** is the two-slot composition contract. Its direct product children
  are Header and Core, and nothing else.
- **Header** owns title, subtitle, optional Header CTA, their appearance, and
  Header layout inside Shell.
- **Core** is the widget-specific body. It owns Core geometry, including
  `coreSize.*`, plus the widget namespace such as `cards.*` or `faq.*`.

The dependency direction is always Core using a generic Clickeen capability.
Shared Widget services never inspect Widget identity or interpret a Core
namespace.

The Shell element also carries widget type and materialized instance identity.
Those attributes let visitor behavior locate and scope the exact Widget DOM.
They do not load an editable-state payload. Runtime identity is not another
product layer.

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
| Common typography role behavior | Widget Foundation |
| Widget-specific typography role behavior | Widget `spec.json` |
| Locale switcher state and appearance | Locale delivery chrome |
| Backlink state | Branding chrome and product policy |
| Social-share state | Share chrome |

Typography, fill, appearance, and branding use shared source/build
composition. Locale switching and social sharing additionally use shared
visitor behavior. Shared implementation does not make those concerns Shell
children.

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

Widget Defaults renders one Bob-owned/system common-control section and one
selected Widget's Core controls from one selected editor artifact. The account
document stores exact `common` values and sparse complete Core overrides. For a
selected Widget, a present `widgets.{widgetType}.core` is the complete effective
Core; when absent, the exact deploy-built Widget baseline is effective. Roma
does not merge the two, backfill the account, or mutate it on read. New combines
the exact common values with that effective Core and writes nothing. The saved
instance remains one exact logical state and Tokyo stores its metadata, config,
and content together in one atomic source artifact.

Typography behavior is deploy-built software, not account state. The producer
combines Foundation-owned common behavior with the selected Widget's unique
role behavior and emits one complete role/script map. Bob preview and Roma
Publish use that same map without role-name branches or runtime defaults.

## Instance State And Persistence

Header, Stage, Pod, and Core are separate software owners inside one Widget,
not separate persisted instances. One account instance contains one complete
logical state with every namespace in the State Ownership table. A change to
`header.title`, `stage.background`, `pod.padding.desktop.all`, or
`faq.sections` is therefore a change to the same browser-memory draft and the
same saved instance coordinate.

Bob receives and edits the complete logical document. Roma prepares its exact
semantic source payloads and Tokyo stores their physical representation:

```text
instance.source.json   source metadata + exact config + exact base-locale content
```

New composes a non-persisted draft. First Save creates editable source and
later Save updates it. Only explicit allowed Publish invokes Roma's one generic Widget materializer with the exact
saved state. The materializer composes this shared frame and the selected Core
and is Roma's sole generator of complete `index.html`, complete `styles.css`,
and mandatory `runtime.js`. Tokyo-worker writes the atomic source document or
stores the required logical HTML/CSS/JavaScript together with publication state
inside one atomic `serve-state.json`; locale overlays remain separate exact
artifacts under the single instance folder. It does not generate or reinterpret
Widget software.

Changing common account defaults seeds future instances through New-draft
composition and first Save. Changing shared or Core source affects future
materializations only. Neither change silently mutates an already-stored
instance or public package.

## Account Policy Is Outside Shell And Core

Tier limits and upsell UI are not Widget state, Shell composition, Core
behavior, or public runtime. A Widget declares the unique coordinate-to-policy
binding in `limits.json` and the complete localized denial context in
`upsell/{locale}.json`. That contract is compiled for Bob/Roma product use; it
is never materialized into `index.html`, `styles.css`, or `runtime.js`.

Account policy owns the entitlement decision and exact current/target plan.
Roma owns Popup composition and the system CTA; Dieter owns Popup mechanics.
The Widget owns only its contextual template. Bob transports the exact denial
identity from its generic edit boundary. None of Stage, Pod, Shell, Header,
Core, Tokyo-worker, or public serving participates or provides fallback copy.

## Shared Services And Capability APIs

The shared Widget system exposes generic composition and capabilities from
`tokyo/product/widgets/shared/`. Roma materializes their exact HTML/CSS/JS state
the same way for every Widget during Publish. Bob previews them through Bob's
existing editing authority:

| Capability | Responsibility |
| --- | --- |
| Widget host | Composes the Shell instance anchor. |
| Header | Expresses Header content, Header CTA, and Header layout. |
| Stage/Pod | Expresses Stage and Pod presentation. |
| Core size | Expresses Core geometry. |
| Typography | Expresses typography state in its declared Header, Core, or chrome scope. |
| Branding | Expresses product-policy branding chrome. |
| Social share | Expresses share chrome on Stage or Pod. |
| Locale switcher | Expresses locale chrome for exact delivered locale choices. |
| Surface, appearance, and fill | Provide reusable presentation primitives without owning product state. |

All built Widgets now materialize their authored source and shared composition
into complete HTML/CSS. Bob previews the same compiled software plus its draft,
and public JavaScript owns only visitor behavior: FAQ disclosure, Cards link
interaction, Countdown progression, and Logo Showcase motion. Big Bang has no
dynamic Core behavior but still supplies mandatory `core/core.js`. No Core
client constructs initial content, applies shared state, or binds Bob state
updates.

Source/build composition owns the presence of required shared capabilities.
Core does not add visitor-time probes or local fallback implementations to
re-prove system-authored composition.

Each capability has one Widget-neutral contract. If a missing capability is
proven by a current Widget flow, augment the shared owner once for every
applicable Widget. Never add a Widget-name branch or path-specific semantic
adapter.

## Publish-Time Materialization

Each Widget's `widget.html` shows the complete Stage/Pod/Shell/Header/Core
composition while shared implementations remain shared. On explicit allowed
Publish, Roma's generic materializer combines that trusted source with the
complete exact saved instance:

```text
per-Widget widget.html + shared capabilities + Core + exact saved state
-> index.html with complete base-locale Header and Core content
-> styles.css with complete shared and Core presentation
-> runtime.js with mandatory Widget and shared visitor behavior
```

Explicit Save remains Bob's editable-source persistence boundary. Publish is
the separate release/materialization boundary. Public requests never invoke
materialization.

For a non-base locale request, Tokyo applies the exact trusted overlay into the
declared semantic HTML content slots before responding. Public JavaScript does
not create or localize initial content.

Bob preview remains an editing concern under Bob's existing authority. It does
not read or execute an account instance's stored package. The deploy-built
Widget software and Bob's one current draft express the same shared
frame and selected Core temporarily in the existing isolated Workspace iframe.
Public JavaScript does not receive Bob state messages or render, materialize,
localize, host, or serve an instance.

Preview and Publish are independent consumers of the same authored
composition:

```text
Widget composition + draft -> Bob preview
Widget composition + saved source -> Publish materializer -> public package
```

They do not consume one another's output and do not maintain two Widget
meanings.

## Shadow Rendering

Stage, Pod, and supported Core card surfaces retain one exact shadow shape:
`{enabled,inset,x,y,blur,spread,color,alpha}`. Outside contexts use
`inset:false`; inside contexts use `inset:true`. The owning editor/source
contract emits that exact shape and shared presentation consumes it unchanged,
without another validation or repair pass.

Inside-shadow groups retain `linked`, `layer`, and exact `all/top/right/bottom/left`
objects. Linked rendering uses `all`; unlinked rendering produces one ordered
comma-separated inset `box-shadow` list from top, right, bottom, and left.
Switching linked state changes only `linked`; it does not overwrite the hidden
objects. `layer` selects below- or above-content composition without changing
the shadow values. Directional gradients are not an internal-shadow runtime.

Because Stage is the outer iframe surface, an enabled Stage outside shadow also
sets document gutters derived from its exact signed offsets, blur, and spread.
The Stage remains inside those gutters, and iframe resize reporting includes
them. Disabled or zero-opacity outside shadow adds no gutter. Pod and Core-card
outside shadows need no document gutter because they are already inside Stage.

Supported Core card surfaces consume the materialized generic surface
variables in their authored CSS. A Core does not calculate or reinterpret the
trusted shadow values in visitor JavaScript.

## Core Namespaces

| Widget | Core namespace |
| --- | --- |
| `big-bang` | `bigBang.*` |
| `cards` | `cards.*` |
| `countdown` | `countdown.*` |
| `faq` | `faq.*` |
| `logoshowcase` | `logoshowcase.*` |

Core owns body content, widget-specific layout and appearance, repeatable items,
and widget-specific interaction. Shared system services remain outside Core.

## Closed-System Trust

The compiler-produced Widget contract, Bob-produced complete draft,
materializer-produced package, and Tokyo-stored artifacts are Clickeen system
truth. Each downstream owner consumes the complete artifact without another
schema check, allowlist projection, filter, normalization, repair, or semantic
reconciliation. Authoring/build checks prove the producer's work outside normal
runtime and never become a public-runtime dependency.

## Hard Stops

- Do not describe Stage, Pod, typography engines, locale, branding, or share as
  Shell children.
- Do not add another product layer between Pod and Shell.
- Do not put anything beside Header and Core inside Shell.
- Do not put tier, entitlement, denial, Popup, CTA, or upsell behavior in
  Shell, Header, Core, or the public package.
- Do not classify state ownership through manually maintained path-prefix
  families.
- Do not create widget-local copies of shared runtime primitives.
- Do not make Core JavaScript construct initial public content.
- Do not make shared code branch on Widget identity or Core paths.
- Do not add downstream validators for trusted Clickeen artifacts.
- Do not silently heal or substitute authoritative truth.
