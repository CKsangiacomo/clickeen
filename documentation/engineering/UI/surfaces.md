# Surfaces In Clickeen UI

**Living, canonical reference for the surface design primitive.**

Authority: [`126J__PRD__Surfaces.md`](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126J__PRD__Surfaces.md).

Surfaces are the containers and planes that hold content. They are not product
apps, routes, or runtime surfaces.

## Definition

A UI surface is a visible plane used by layouts and components:

- page background;
- app canvas;
- side rail;
- toolbar plane;
- panel;
- content module;
- card;
- table/list plane;
- modal/dialog plane;
- popover/dropdown plane.

Surfaces organize content. Layouts compose surfaces. Screens and product apps
compose layouts.

## Current Direction

Bob is the strongest current directional reference because it already uses a
clear editor shell, tool drawer, toolbar, canvas, and preview plane hierarchy.
Roma and DevStudio still have surface/layout drift that 126J/126L/126M must
converge through their own refactors.

## Rules For Agents

- Do not use "surface" to mean Bob, Roma, DevStudio, a route, or a deployed app.
- Do not create a surface taxonomy during unrelated work.
- When a PRD or code task says "surface," identify the actual container or
  plane in the UI.
- Use Dieter tokens and components by reference; do not hand-create one-off
  planes when a named primitive exists.

126J owns the detailed surface standard and the code gaps. This doc records the
term boundary so agents do not build app-consumption prose in its place.
