# Motion in Clickeen

**Living, canonical reference - motion.**

Authority: [`126F__PRD__Motion.md`](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126F__PRD__Motion.md).

Source of truth: `dieter/tokens/dieter-foundation-tokens.css`, Dieter component
CSS/JS, and system chrome CSS in Bob, Roma, and DevStudio/Admin.

## Scope

126F owns Dieter/system motion only:

- Dieter components.
- Bob/Roma operational chrome.
- DevStudio/Admin operational chrome.

Public-widget runtime motion is widget-owned product behavior. Carousel,
ticker, autoplay, countdown, interpolation, and other widget-specific motion
belong to the owning widget implementation and docs, not to Dieter motion law.

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
`dieter/tokens/dieter-foundation-tokens.css`.

Components may also carry local reduced-motion rules when they own the moving
selector directly. If system JS writes inline transition or animation behavior,
that JS must check `prefers-reduced-motion: reduce` directly and choose the
reduced behavior at runtime.

## Operating Rule

Clickeen system motion stays small. Motion exists only to clarify state change,
reveal or hide a component, communicate real progress/activity, or orient the
user during simple UI changes.

Do not create a motion framework, `MotionProvider`, choreography registry,
animation runtime, enter/exit library, or imported Material/Apple/OpenAI motion
system.
