# Color In Clickeen

Living reference for color doctrine.

- Canonical doctrine: this document.
- Execution PRD: [`126B__PRD__Color.md`](../../../Execution_Pipeline_Docs/03-Executed/126__UI_Optimization/126B__PRD__Color.md).
- Source of truth: `dieter/tokens/dieter-color-tokens.css`.
- Consumers compile or materialize this source directly; there is no generated
  Tokyo token mirror.

This document is not a palette redesign, dark-mode rollout, contrast gate, theme platform,
resolver, registry, or validation framework. It defines current light-mode color
truth so agents can code UI deterministically.

## Source Truth

Dieter owns color values. Tokyo output is generated from Dieter. Roma, Bob,
DevStudio, and widgets consume the token contract.

The shared role contract contains four structural roles plus error:

```text
--role-surface-bg
--role-surface
--role-surface-muted
--role-border
--role-error
```

Their exact meanings are:

| Token | Meaning |
| --- | --- |
| `--role-surface-bg` | Outer application and page canvas. |
| `--role-surface` | Contained surfaces such as tables, popups, fields, and neutral controls. |
| `--role-surface-muted` | Secondary chrome such as navigation planes and muted controls. |
| `--role-border` | Structural and control boundaries. |
| `--role-error` | Error text and error boundaries; it is not structural chrome or an error-fill contract. |

Text uses `--color-text` and `--color-text-secondary`. Focus indicators use
`--focus-ring-color`. Dieter components own their selected, disabled, action,
and feedback presentation through their existing component CSS and the palette
or state controls below. Do not add a semantic role until a real shared
consumer contract requires one.

Use primitive `--color-system-*` tokens only when the primitive itself is the
product truth: color picker swatches, token reveal UI, serialized user-authored
color, a widget product default explicitly owned by that widget, or an existing
Dieter component contract.

A palette ramp or contrast sibling may modify an existing component-owned
status color. The modifier does not become a new cross-system status authority.

## State Color

State color uses Dieter state controls:

```text
--state-darken-target
--state-lighten-target
--state-hover-mix
--state-pressed-mix
--state-muted-mix
--state-inactive-mix
```

Use these formulas:

```css
/* hover */
color-mix(in oklab, var(--base-token), var(--state-darken-target) var(--state-hover-mix))

/* pressed */
color-mix(in oklab, var(--base-token), var(--state-darken-target) var(--state-pressed-mix))

/* muted */
color-mix(in oklab, var(--base-token), var(--state-lighten-target) var(--state-muted-mix))

/* inactive */
color-mix(in oklab, var(--base-token), var(--state-lighten-target) var(--state-inactive-mix))
```

Selected and disabled presentation remains owned by each Dieter component's
source contract. Reuse the state controls above where that component derives
state color; do not create speculative global selected or disabled roles.

Do not invent component-local state percentages, undefined state names, or
opacity-only disabled behavior as color doctrine.

## User Color Boundary

User-authored and widget-authored colors are legal product data:

- color picker values;
- gradients;
- shadows;
- serialized widget appearance;
- widget runtime defaults.

These are not structural chrome violations. This doctrine only fixes undefined widget
token references explicitly listed in the PRD.

## DevStudio Reveal

DevStudio reveals color source truth. Its current write lane accepts only
`--color-*` token edits with literal three- or six-digit hex values.

Therefore:

- writable `--color-*` three- or six-digit hex rows render edit controls;
- the five role rows plus focus, state, and derived `color-mix(...)` rows
  render read-only chips;
- This doctrine does not expand DevStudio write authority.

## Contrast

Contrast/readability findings are evidence for human design review. Agents do
not enforce contrast, switch to `-contrast` siblings automatically, or add
contrast gates.

## Dark Mode

Clickeen does not ship dark mode today. Listed dark-mode artifacts are deletion
gaps. They do not authorize dark-mode scaffolding, dark token pairs, future
theme claims, toggles, or theme support.

If dark mode is desired later, it needs its own PRD.
