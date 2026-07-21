# Motion in Clickeen

**Living, canonical reference - motion.**

Canonical doctrine: this document.
Execution PRD: [`126F__PRD__Motion.md`](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126F__PRD__Motion.md).

Source of truth: `dieter/tokens/dieter-foundation-tokens.css`, Dieter component
CSS/JS, and system chrome CSS in Bob, Roma, and DevStudio/Admin.

## Scope

This document owns Dieter/system motion only:

- Dieter components.
- Bob/Roma operational chrome.
- DevStudio/Admin operational chrome.

Public-widget runtime motion is widget-owned product behavior. Carousel,
ticker, autoplay, countdown, interpolation, and other widget-specific motion
belong to the owning widget implementation and docs, not to Dieter duration or
easing law. Every public widget template also loads Dieter's token entrypoint,
so Dieter's global CSS reduced-motion guard is the shared baseline for CSS
motion. Widget-owned CSS/JS may add behavior beyond that baseline, especially
for JS-driven motion, but must not bypass it.

Prague loads Dieter's token entrypoint and consumes Dieter duration tokens in
current static-site primitives. Any change to the global reduced-motion guard
or a foundation duration token must verify those Prague consumers; their
consumption does not make Prague motion a second Dieter authority.

## Tokens

```text
--duration-snap: 140ms
--duration-base: 160ms
--easing-standard: ease
```

Use `--duration-base` for ordinary operational UI transitions. Use
`--duration-snap` for quick state snaps where the component already has a real
state-change need.

System UI must not hardcode local `ms`, `s`, `ease`, or `cubic-bezier(...)`
values for ordinary transitions. If a future component needs different motion,
that need must be named by the owning product/component PRD first.

## Reduced Motion

Dieter ships the global reduced-motion guard from
`dieter/tokens/dieter-foundation-tokens.css`. Current source covers real
elements only. PRD 126F execution must extend that one authoritative selector
to `::before` and `::after`; until then pseudo-elements are a known uncovered
case, not completed product behavior.

Components may also carry local reduced-motion rules when they own the moving
selector directly. If system JS writes inline transition or animation behavior,
that JS must check `prefers-reduced-motion: reduce` directly and choose the
reduced behavior at runtime.

Direct manipulation remains functional and immediate under reduced motion. A
dragged item still follows the pointer; reduced motion removes interpolation
and animated transitions, not the user's positional control.

## Operating Rule

Clickeen system motion stays small. Motion exists only to clarify state change,
reveal or hide a component, communicate real progress/activity, or orient the
user during simple UI changes.

Motion must not imply progress, activity, success, or completion that the
owning product state has not actually reached.

Do not create a motion framework, `MotionProvider`, choreography registry,
animation runtime, enter/exit library, or imported Material/Apple/OpenAI motion
system.
