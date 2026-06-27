# Color in Clickeen

**Living, canonical reference for the clickeen color system.**
Seeded 2026-06-27 from the as-built tokens; improved in place as UI program 126 executes.

- Authority (why this home exists): [`126__PRD__UI_Optimization_Program.md` §12](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126__PRD__UI_Optimization_Program.md).
- Driving PRD: [`126A2__SUBPRD__Color_System.md`](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126A2__SUBPRD__Color_System.md).
- **Source of truth for the values:** `dieter/tokens/dieter-color-tokens.css` + `dieter-foundation-tokens.css`. This doc explains them; the CSS is authoritative.

## What color means in clickeen

Color is not a pile of hand-picked hexes. It is a **parametric, perceptually
derived system**: a small set of base colors seeded from Apple's system colors,
fed through an OKLAB engine that generates every tint, shade, contrast variant,
and interaction state — evenly, automatically, by reference.

It is the matrioska (Brad-Frost atomic) law at the color layer: base → derived
family → component → screen, each doll pointing inward. One base change rolls
outward to the entire product for free.

## How it is built

Source: `dieter/tokens/dieter-color-tokens.css`.

**Base tokens — the only place raw hex lives.** One hex per hue; the hexes are
Apple's system colors verbatim:

| token | hex | Apple |
| --- | --- | --- |
| `--color-system-red` | `#ff3b30` | systemRed |
| `--color-system-orange` | `#ff9500` | systemOrange |
| `--color-system-yellow` | `#ffcc00` | systemYellow |
| `--color-system-green` | `#34c759` | systemGreen |
| `--color-system-mint` | `#00c7be` | |
| `--color-system-teal` | `#30b0c7` | |
| `--color-system-cyan` | `#32ade6` | |
| `--color-system-blue` | `#007aff` | systemBlue |
| `--color-system-indigo` | `#5856d6` | systemIndigo |
| `--color-system-purple` | `#af52de` | systemPurple |
| `--color-system-pink` | `#ff2d55` | systemPink |
| `--color-system-brown` | `#a2845e` | |
| `--color-system-gray` | `#707075` | |
| `--color-system-white` / `--color-system-black` | `#ffffff` / `#212121` | |

**OKLAB derivation — the engine.** Every other color is a `color-mix(in oklab, …)`
of a base. The codebase runs **542** of these mixes. Two families:

- **Hue ramps:** each base gets `-1…-5`, mixing toward white at 20/40/60/80/90%:
  `--color-system-blue-1 = color-mix(in oklab, var(--color-system-blue), white 20%)` … `-5` at 90%.
- **Neutral ladders:** `gray`, `gray-2…gray-6`, each with `step1…step5` OKLAB tints.

OKLAB is a perceptual color space. The practical effect: a lighter blue is an
evenly-spaced, hue-stable lighter blue — not the muddy, hue-shifted result of
mixing in HSL/RGB. The 20/40/60/80/90 steps look even to the eye.

**Contrast variants (accessibility, baked in).** Each base ships a `-contrast`
partner for accessible text-on-tint, e.g. `--color-system-blue-contrast: #005cbf`.
Hand-set hex, deliberately not derived, to hit contrast targets.

**Semantic / role layer — what components actually consume.** A thin tier
composes from the system tokens:

```text
--color-text:           var(--color-system-black)
--color-text-secondary: color-mix(in oklab, var(--color-system-black), transparent 45%)
--role-surface:         var(--color-system-white)
--role-surface-bg:      var(--color-system-white)
--role-border:          var(--color-system-gray-5)
--focus-ring-color:     var(--color-system-blue)
```

**State engine — one scale for every interaction.** A single set of mix controls
drives hover/pressed/muted/inactive across the whole product:

```text
--state-darken-target: black;   --state-lighten-target: white;
--state-hover-mix:    12%;
--state-pressed-mix:  24%;
--state-muted-mix:    40%;
--state-inactive-mix: 60%;
```

A component writes
`color-mix(in oklab, var(--its-token), var(--state-hover-target) var(--state-hover-mix))`
and inherits consistent hover everywhere — no per-component hand-tuning.

## How it composes at scale (the cascade)

Measured across the codebase:

- **Atoms** — the base system tokens. The innermost doll.
- **Molecules** — OKLAB-derived ramps, contrast, neutral ladders, semantic roles, the state engine.
- **Components** — **23 of ~25** Dieter components reference the system tokens + state engine.
- **Screens** — Roma/Bob/Admin chrome consume Dieter; `roma.css` is token-healthy (0 hex literals, ~140 `var()` uses). The outer doll references inward, not inward to raw atoms it doesn't own (e.g. `roma/components` consumes components/roles, not raw `--color-system-*`) — the cascade working as intended.

Top tokens by real usage: `--color-system-black` 381, `--color-system-white`
362, `--color-system-blue` 181, `--color-system-gray-5` 145, `gray-6` 54.

**Scale properties that fall out of by-reference composition:**

- **Rebrand = edit the base hexes.** Change `--color-system-blue` and every blue tint, contrast color, focus ring, and hover/pressed state recomputes in perceptual space, everywhere, automatically.
- **Add a color = add one base.** The engine generates its entire family.
- **Consistency is structural.** Every component reads the same state scale, so interaction depth is uniform across the product.
- **Accessibility is a property of the system, not an afterthought.** Contrast partners ship with every base.

## Why this is world-class

Most systems are hand-picked hex mixed in HSL, which drifts, shifts hue, and
breaks on every change. clickeen took world-class source material (Apple's
system colors) and made a perceptual engine (OKLAB) the law of the *entire*
token layer — ramps, contrast, neutrals, states, shadows (foundation shadows are
OKLAB mixes too). OKLAB itself isn't novel (Tailwind v4 / OKLCH, the CSS spec use
it); what's rare is applying it **uniformly, by reference, across the whole
system**. That is the opposite of the dated, hand-picked median.

## Gaps (honest)

- **Dark mode is anticipated, not shipped.** The state engine has dual
  `--state-darken-target` / `--state-lighten-target` and the palette is annotated
  "(light)", but **no dark palette block exists** in the token files, and a code
  search finds no dark-theme implementation. The architecture is dark-ready; the
  light/dark palette pair is not. The fix is to *complete* the system (add the
  dark palette the engine already expects), never to replace it.
- **Consumer-side bugs are not color-system defects.** `--color-surface` /
  `--color-bg` / `--radius-2` referenced-but-undefined, and `--hspace-*`
  migration, are misuse at consumers — the system above is sound. Owned by a
  sibling token-fix slice, not this reference.
