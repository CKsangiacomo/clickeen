# Color In Clickeen

Living reference for color doctrine.

- Canonical doctrine: this document.
- Execution PRD: [`126B__PRD__Color.md`](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126B__PRD__Color.md).
- Source of truth: `dieter/tokens/dieter-color-tokens.css`.
- Generated output: `tokyo/product/dieter/tokens/**`.

This document is not a palette redesign, dark-mode rollout, contrast gate, theme platform,
resolver, registry, or validation framework. It defines current light-mode color
truth so agents can code UI deterministically.

## Source Truth

Dieter owns color values. Tokyo output is generated from Dieter. Roma, Bob,
DevStudio, and widgets consume the token contract.

Structural chrome uses semantic roles:

```text
--role-surface
--role-on-surface
--role-surface-bg
--role-surface-muted
--role-border
--role-text
--role-text-secondary
--role-focus
--role-primary-action
--role-on-primary-action
--role-error
--role-on-error
--role-success
--role-on-success
--role-warning
--role-on-warning
--role-info
--role-on-info
--role-muted
--role-selected-fill
--role-selected-text
--role-selected-border
--role-disabled-fill
--role-disabled-text
--role-disabled-border
```

Use primitive `--color-system-*` tokens only when the primitive itself is the
product truth: color picker swatches, token reveal UI, serialized user-authored
color, or a widget product default explicitly owned by that widget.

A palette ramp or contrast sibling may modify a named semantic status only
when its base meaning already uses the corresponding semantic role and no
value-equivalent modifier role exists. The modifier does not become status
authority.

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

Selected state uses `--role-selected-fill`, `--role-selected-text`, and
`--role-selected-border`. Disabled state uses `--role-disabled-fill`,
`--role-disabled-text`, and `--role-disabled-border`.

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
`--color-*` token edits with literal hex values.

Therefore:

- writable `--color-*` hex rows render edit controls;
- role, focus, state, and derived `color-mix(...)` rows render read-only chips;
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
