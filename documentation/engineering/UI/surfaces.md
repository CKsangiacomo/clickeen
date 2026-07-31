# Surfaces In Clickeen UI

**Living, canonical reference for the surface design primitive.**

Canonical doctrine: this document.
Execution PRD: [`126J__PRD__Surfaces.md`](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126J__PRD__Surfaces.md).

Surfaces are the containers and planes that hold content. They are not product
apps, routes, or runtime surfaces.

## Definition

A UI surface is a visible plane used by layouts and components. Use this
vocabulary: navigation plane, header/action band, canvas/work area,
module/section, item/card, table/list, inspector/tool, preview, and
overlay/dialog. The app background is a backdrop. Layout helpers are not
surfaces.

Surfaces organize content. Layouts compose surfaces. Screens and product apps
compose layouts.

## Ownership

Dieter owns reusable tokens, controls, visual contracts, shared dialog
mechanics, and one high-level application Layout/Page contract. DevStudio and
Roma consume that contract directly while owning their routes, navigation
content, open state, page content, commands, domain composition, and product
behavior. Bob retains its distinct `ToolDrawer | Workspace` editor layout.

The shared application taxonomy is:

```text
main-container
├── left-nav
└── page
    ├── page__header
    │   └── page__actions
    └── page__content
```

`left-nav` and `page` are the only direct children of `main-container`. A
compact-navigation scrim is a control inside `page`, not a third layout child.
The source contract is
`dieter/layouts/main-container/main-container.{html,css,spec.json}`. DevStudio
reveals its Full, Compact-closed, and Compact-open examples and edits its four
layout tokens through the existing foundation-token write path.
`main-container` and `page` use `--role-surface-muted`; `left-nav` uses
`--role-surface`. In Full mode `left-nav` is `20rem` wide, inset by
`--space-2` on all four sides, borderless, and uses `3xl` radius plus the
floating shadow. The Page header and content share one centered `80rem`
maximum width. In Compact mode the same `20rem` inset panel overlays the
full-width page and uses the existing elevated shadow. Consumer content uses
`--role-surface` for contained primary surfaces.

Preserve the existing backdrop, white/muted surfaces, borders, and shadows. This
program does not create a new depth or tonal ramp.

Native operational fields, Table, and Popup use the small Dieter contracts
defined in [`components.md`](components.md). Dieter owns their shared
appearance and structural mechanics. Apps retain labels, validation, values,
data, policy, behavior, and composition.

## Current Direction

Bob is the strongest directional editor reference because it uses a clear tool
drawer, toolbar, canvas, and preview plane hierarchy. DevStudio and Roma
implement the accepted Full/Compact operational shell with one inset navigation
tree while retaining their own route and domain composition. Bob keeps its
specialized editor portrait boundary.

## Global Workspace Capability Tenet

Clickeen does not derive layout capability from raw hardware resolution or an
obsolete universal width breakpoint:

```text
resolution -> sharpness
available workspace -> layout
form factor -> expected product experience
```

Retina and 4K device pixels improve rendering fidelity; they do not turn a
physically small device into a desktop workspace. Operational applications use
usable CSS width and height, aspect ratio, safe areas, and whether the real
workspace composition fits. They do not infer product capability from pixel
density or a single `max-width` rule.

The supported operational-workspace contract is:

- desktop: full desktop workspace;
- tablet portrait: full desktop workspace;
- tablet landscape: full desktop workspace;
- mobile landscape: compact workspace with accessible navigation drawer;
- mobile portrait: DevStudio and Roma use the same compact navigation drawer
  and full-width page; a specialized editor may expose a clear boundary only
  when its real composition cannot remain operable there.

The operational shell remains intentionally simple:

```text
full workspace:    persistent left navigation | flexible work area
compact workspace: menu button                | full-width work area
```

Navigation remains fixed and the work area receives all remaining space.
Compact mode overlays the same navigation as an accessible drawer; it does not
introduce different routes, operations, or domain layouts. Tables retain their
information and may scroll instead of becoming unrelated mobile card feeds.

Bob uses the same nested composition: `ToolDrawer | preview/workspace` when it
fits, and an explicit ToolDrawer button/drawer plus full preview/workspace in
compact mode. This is the same editor, not a mobile variant.

Desktop workspace on tablet remains touch-operable. Compact mode in mobile
landscape or portrait changes composition, not product authority or available
operations.
Constrained split-screen/windowed contexts respond to the usable workspace they
actually provide.

This law applies immediately to Roma, Bob Builder, and DevStudio and guides
future Clickeen operational editors and dashboards. Public widgets and content
surfaces retain their own container-responsive runtime contracts, while still
following the same distinction between rendering resolution and usable layout
space.

World-class execution means predictable allocation and complete operability,
not more layout machinery. Dieter supplies CSS/HTML/spec source, not a shell
framework or runtime controller. Roma and DevStudio retain small local shell
code for product state; Bob retains its editor layout and current explicit
portrait boundary. No device registry or domain-by-domain mobile redesign is
part of this law.

## Rules For Agents

- Do not use "surface" to mean Bob, Roma, DevStudio, a route, or a deployed app.
- Do not create a surface taxonomy during unrelated work.
- When a PRD or code task says "surface," identify the actual container or
  plane in the UI.
- Use Dieter tokens and components by reference; do not hand-create one-off
  planes when a named primitive exists.
- Do not classify a Retina/4K screen as desktop from hardware pixels or collapse
  full-screen tablets into mobile mode through a generic breakpoint.

This document owns the detailed surface standard. The 126J execution PRD owns
the code-gap map and implementation sequence.
