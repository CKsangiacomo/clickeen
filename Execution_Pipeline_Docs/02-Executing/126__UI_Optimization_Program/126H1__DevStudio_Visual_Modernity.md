# 126H1 — DevStudio: Visual Modernity

**Parent:** 126 MAMA. **Runs:** now (parallel with 126B–G — it's `admin/` code, independent of the Dieter component audits). **Depends on:** 126A (tokens).

## Problem
DevStudio reads as a dated admin panel, not a 2026 cockpit: verbatim Apple iOS palette with no dark mode, dense 2010-style HTML tables, no skeletons or motion, cramped 13px body, text-only nav, flat surfaces.

## Work
1. Modern color identity + real dark mode (`prefers-color-scheme` / `data-theme`). Not the verbatim iOS palette.
2. Replace the dense `<table>` cockpit screens (Policy Editor `entitlements.html`, LLM Management `llm-management.html`) with a modern data-grid / card-row surface.
3. Add a state language: skeletons/shimmer, structured empty + error components (no more plain "Loading…" text).
4. Add a motion language — route fades, modal scale+fade, list mount — using the existing `--duration-snap/base` tokens (defined but unused in the shell).
5. Modernize nav (icon + label, clear active indicator), elevation hierarchy (the `--shadow-*` tokens exist but are unused), modern focus rings, status badges with leading dots/icons.
6. Body text 14px default.

## Done when
DevStudio looks like a current product cockpit; dark mode works; every async surface goes skeleton → content → (error|empty) with a real component.

## Not in scope
Dieter component internals (126B–G). Roma (126I). A from-scratch brand redesign (modernize the existing identity; a new brand needs owner approval).
