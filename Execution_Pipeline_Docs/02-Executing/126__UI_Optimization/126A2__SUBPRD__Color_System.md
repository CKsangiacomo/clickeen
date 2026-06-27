# 126A2 — SubPRD: Color in Clickeen (Reference)

Status: DRAFT — reference PRD documenting the **as-built** color system. Not a
change PRD. Grounded in `dieter/tokens/dieter-color-tokens.css` +
`dieter-foundation-tokens.css` and a codebase usage pass (2026-06-27).
Parent: `126A__PRD__Dieter_Tokens.md` → `126__PRD__UI_Optimization_Program.md` (MAMA).

> **What this PRD is.** It records what "color in clickeen" means, how it is
> built, and how it composes at scale under the Brad-Frost / matrioska approach.
> It proposes **no new machinery** and **no changes** — the color system is
> world-class as-built and must be preserved, not rewritten (design freeze,
> MAMA §4). Consumer-side bugs (undefined token refs, `--hspace-*` migration)
> are owned by a separate slice, not here.

## 1. What "color in clickeen" means

Color is not a pile of hand-picked hexes. It is a **parametric, perceptually
derived system**: a small set of base colors seeded from Apple's system colors,
fed through an OKLAB derivation engine that generates every tint, shade,
contrast variant, and interaction state — evenly, automatically, by reference.

The whole thing is one application of the matrioska law at the color layer:
base → derived family → component → screen, each doll pointing inward. So a
single base change rolls outward to the entire product for free.

## 2. How it is built (the mechanics)

Source: `dieter/tokens/dieter-color-tokens.css`.

**2.1 Base tokens — the only place raw hex lives.** One hex per hue, and the
hexes are Apple's system colors verbatim:

```text
--color-system-red:    #ff3b30   /* Apple systemRed */
--color-system-orange: #ff9500   /* systemOrange */
--color-system-yellow: #ffcc00   /* systemYellow */
--color-system-green:  #34c759   /* systemGreen */
--color-system-mint:   #00c7be
--color-system-teal:   #30b0c7
--color-system-cyan:   #32ade6
--color-system-blue:   #007aff   /* systemBlue */
--color-system-indigo: #5856d6   /* systemIndigo */
--color-system-purple: #af52de   /* systemPurple */
--color-system-pink:   #ff2d55   /* systemPink */
--color-system-brown:  #a2845e
--color-system-gray:   #707075
--color-system-white:  #ffffff
--color-system-black:  #212121
```

**2.2 OKLAB derivation — the engine.** Every other color is a `color-mix(in
oklab, …)` of a base. The whole codebase runs **542** of these mixes. Two
families:

- **Hue ramps:** each base gets `-1…-5`, mixing toward white at 20/40/60/80/90%:
  `--color-system-blue-1 = color-mix(in oklab, var(--color-system-blue), white 20%)` … `-5` at 90%.
- **Neutral ladders:** `gray`, `gray-2…gray-6`, each with `step1…step5` OKLAB tints.

OKLAB is a perceptual color space. The practical effect: a lighter blue is an
evenly-spaced, hue-stable lighter blue — not the muddy, hue-shifted result of
mixing in HSL/RGB. The 20/40/60/80/90 steps look even to the eye.

**2.3 Contrast variants (accessibility, baked in).** Each base ships a
`-contrast` partner for accessible text-on-tint, e.g.
`--color-system-blue-contrast: #005cbf`. (These are hand-set hex, not
OKLAB-derived — the one place derivation is bypassed, deliberately, to hit
contrast targets.)

**2.4 Semantic / role layer — what components actually consume.** A thin
semantic tier composes from the system tokens:

```text
--color-text:          var(--color-system-black)
--color-text-secondary: color-mix(in oklab, var(--color-system-black), transparent 45%)
--role-surface:        var(--color-system-white)
--role-surface-bg:     var(--color-system-white)
--role-border:         var(--color-system-gray-5)
--focus-ring-color:    var(--color-system-blue)
```

**2.5 State engine — one scale for every interaction.** A single set of mix
controls drives hover/pressed/muted/inactive across the whole product:

```text
--state-darken-target: black;   --state-lighten-target: white;
--state-hover-mix:   12%;
--state-pressed-mix: 24%;
--state-muted-mix:   40%;
--state-inactive-mix: 60%;
```

Usage pattern (the file's own rule): a component writes
`color-mix(in oklab, var(--its-token), var(--state-hover-target) var(--state-hover-mix))`
and inherits a consistent hover everywhere — no per-component hand-tuning.

## 3. How it composes at scale (the Brad-Frost / matrioska cascade)

Measured across the codebase:

- **Atoms** — the base system tokens (§2.1). The innermost doll.
- **Molecules** — the OKLAB-derived ramps, contrast, neutral ladders, semantic
  roles, and the state engine (§2.2–2.5).
- **Components** — **23 of ~25** Dieter components reference the system tokens
  and the state engine.
- **Screens** — Roma/Bob/Admin chrome consumes Dieter; `roma.css` itself is
  token-healthy (0 hex literals, ~140 `var()` uses). The outer doll references
  inward, never inward to raw atoms it doesn't own — e.g. `roma/components`
  consumes components/roles, not raw `--color-system-*`, which is the cascade
  working as intended.

Top tokens by real usage: `--color-system-black` 381, `--color-system-white`
362, `--color-system-blue` 181, `--color-system-gray-5` 145, `gray-6` 54.

**Scale properties that fall out of by-reference composition:**

- **Rebrand = edit the base hexes.** Change `--color-system-blue` and every
  blue tint, contrast color, focus ring, and hover/pressed state recomputes in
  perceptual space, everywhere, automatically.
- **Add a color = add one base.** The engine generates its entire family.
- **Consistency is structural.** Every component reads the same state scale, so
  interaction depth is uniform across the product — not per-component guesses.
- **Accessibility is a property of the system, not an audit afterthought.**
  Contrast partners ship with every base.

## 4. Why this is world-class (brief)

Most systems are hand-picked hex mixed in HSL, which drifts, shifts hue, and
breaks on every change. clickeen took world-class source material (Apple's
system colors) and made a perceptual engine (OKLAB) the law of the *entire*
token layer — ramps, contrast, neutrals, states, shadows (foundation-tokens
shadows are OKLAB mixes too). OKLAB itself isn't novel (Tailwind v4 / OKLCH,
the CSS spec use it); what's rare is applying it **uniformly, by reference,
across the whole system**. That is the opposite of the dated, hand-picked
median — and it is why any "modernize the palette" instinct must be rejected
(see MAMA §8, the ghost-token lesson).

## 5. Authority & compliance

- **By-reference composition** (MAMA §4, matrioska): color is the reference
  chain at the innermost doll. Preserve it.
- **Design freeze** (MAMA §4 / Migration §3.6): the color system is frozen as a
  strength. This PRD documents; it does **not** redesign.
- **No new machinery** (MAMA §4 / PRD 125 §3): this PRD adds no service, store,
  gate, or registry. It records what exists.

## 6. Gaps and open items (honest)

- **Dark mode is anticipated, not shipped.** The state engine has dual
  `--state-darken-target`/`--state-lighten-target` and the palette is annotated
  "(light)", but **no dark palette block exists** in the token files, and a code
  search finds no dark-theme implementation. So the architecture is dark-ready;
  the light/dark palette pair is not. This is a real gap — and the fix is to
  *complete* the system (add the dark palette the engine already expects), never
  to replace it. (Out of scope here; a separate slice.)
- **Consumer-side bugs are not color-system defects.** `--color-surface` /
  `--color-bg` / `--radius-2` referenced-but-undefined, and `--hspace-*`
  migration, are misuse at consumers — the system is sound. Owned by the
  sibling token-fix slice, not this PRD.

## 7. Out of scope

- Redesigning or re-deriving the color system.
- Token authoring UI (DevStudio / 126C owns).
- Consumer token-reference fixes (sibling slice).
- Dark-mode implementation (separate slice, to be numbered).
- Components, screens (later tracks).
