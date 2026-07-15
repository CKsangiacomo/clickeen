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

Dieter owns reusable tokens, controls, visual contracts, and shared dialog
mechanics. Roma and DevStudio own their shell, navigation, workspace, domain
layout, responsive composition, and host-layout CSS. Delete app-local CSS only
when it is dead or duplicates an accepted Dieter-owned contract; do not mass
rename app layout classes to satisfy a taxonomy.

Preserve the existing backdrop, white/muted surfaces, borders, and shadows. This
program does not create a new depth or tonal ramp.

Native operational fields and tables use the small Dieter contracts defined in
[`components.md`](components.md). Dieter owns their shared appearance and state
mechanics. Apps retain labels, validation, values, data, policy, behavior,
density, and composition.

## Current Direction

Bob is the strongest current directional reference because it already uses a
clear editor shell, tool drawer, toolbar, canvas, and preview plane hierarchy.
Roma and DevStudio still have surface/layout drift that their execution PRDs
must converge through their own refactors.

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
- mobile portrait: no broken editor/dashboard approximation; present a clear
  rotate-device or larger-screen boundary.

The operational shell remains intentionally simple:

```text
full workspace:    persistent left navigation | flexible work area
compact workspace: menu button                | full-width work area
```

Navigation remains narrow and the work area receives all remaining space.
Compact mode overlays the same navigation as an accessible drawer; it does not
introduce different routes, operations, or domain layouts. Tables retain their
information and may scroll instead of becoming unrelated mobile card feeds.

Bob uses the same nested composition: `ToolDrawer | preview/workspace` when it
fits, and an explicit ToolDrawer button/drawer plus full preview/workspace in
compact mode. This is the same editor, not a mobile variant.

Desktop workspace on tablet remains touch-operable. Mobile-landscape compact
mode changes composition, not product authority or available operations.
Constrained split-screen/windowed contexts respond to the usable workspace they
actually provide.

This law applies immediately to Roma, Bob Builder, and DevStudio and guides
future Clickeen operational editors and dashboards. Public widgets and content
surfaces retain their own container-responsive runtime contracts, while still
following the same distinction between rendering resolution and usable layout
space.

World-class execution means predictable allocation and complete operability,
not more layout machinery. Roma, Bob, and DevStudio retain local shell code; no
shared shell framework, device registry, or domain-by-domain mobile redesign is
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
