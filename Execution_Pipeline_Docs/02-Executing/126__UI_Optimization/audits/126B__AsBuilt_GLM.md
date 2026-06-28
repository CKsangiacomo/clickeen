# 126B — As-built audit: Color (GLM, Phase-1 step 1)

> GLM independent pass — 3 facets (token definitions · consumers + hex violations · integrity/gaps). Codex writes its own; **not converged** — human reconciles at step 4. Every finding cited `file:line`. Current reality only.

**Sources read exhaustively:** `dieter/tokens/dieter-color-tokens.css` (174 lines, 143 custom properties), `dieter/tokens/dieter-foundation-tokens.css` (color-adjacent parts: 75–77, 84–87). Consumers audited: 31 CSS files across `dieter/components/*`, `roma/*`, `bob/*`, `admin/src/*`.

---

## Facet 1 — Token Definitions

### Semantic roles (`dieter-color-tokens.css:13–18`)
| Token | Resolves to | File:line |
|---|---|---|
| `--color-text` | `var(--color-system-black)` → `#212121` | `:13` |
| `--color-text-secondary` | `color-mix(in oklab, var(--color-system-black), transparent 45%)` | `:14` |
| `--role-surface` | `var(--color-system-white)` → `#ffffff` | `:15` |
| `--role-surface-bg` | `var(--color-system-white)` → `#ffffff` | `:16` |
| `--role-border` | `var(--color-system-gray-5)` → `#c7c7cc` | `:17` |
| `--focus-ring-color` | `var(--color-system-blue)` → `#007aff` | `:18` |

**Observation:** `--role-surface` and `--role-surface-bg` are aliases of the same value — two names for one color; no differentiation between foreground surface and page background.

### State engine (`dieter-color-tokens.css:21–26`)
| Token | Value | Usage |
|---|---|---|
| `--state-darken-target` | `black` | hover/pressed target (light mode) |
| `--state-lighten-target` | `white` | muted/inactive target (light mode) |
| `--state-hover-mix` | `12%` | hover = base + 12% darken-target |
| `--state-pressed-mix` | `24%` | pressed = base + 24% darken-target |
| `--state-muted-mix` | `40%` | muted = base + 40% lighten-target |
| `--state-inactive-mix` | `60%` | inactive = base + 60% lighten-target |

Components compose their own states via `color-mix(in oklab, var(--token), var(--state-*-target) var(--state-*-mix))`. No pre-baked `*-hover` tokens. **Dark-mode values are NOT defined** — the targets are hardcoded `black`/`white` for light only.

### Base palette — 13 accent hues (`dieter-color-tokens.css:29–123`)
All hexes match Apple's iOS `UIColor.system*` family verbatim:

| Token | Hex | Apple | Line |
|---|---|---|---|
| `--color-system-red` | `#ff3b30` | systemRed | `:29` |
| `--color-system-orange` | `#ff9500` | systemOrange | `:37` |
| `--color-system-yellow` | `#ffcc00` | systemYellow | `:45` |
| `--color-system-green` | `#34c759` | systemGreen | `:53` |
| `--color-system-mint` | `#00c7be` | systemMint | `:61` |
| `--color-system-teal` | `#30b0c7` | systemTeal | `:69` |
| `--color-system-cyan` | `#32ade6` | systemCyan | `:77` |
| `--color-system-blue` | `#007aff` | systemBlue | `:85` |
| `--color-system-indigo` | `#5856d6` | systemIndigo | `:93` |
| `--color-system-purple` | `#af52de` | systemPurple | `:101` |
| `--color-system-pink` | `#ff2d55` | systemPink | `:109` |
| `--color-system-brown` | `#a2845e` | systemBrown | `:117` |
| `--color-system-gray` | `#707075` | (not Apple systemGray — darker) | `:129` |

### Ramp ladder — `-1…-5` tints (65 tokens across 13 hues)
Every `-1…-5` = `color-mix(in oklab, var(--base), white N%)` with a fixed **20/40/60/80/90** ladder. Lines 31–123. **No dark-shade ramps exist** — darkening is delegated to the state engine or the single `-contrast` token.

### Contrast variants (13 tokens)
Hand-set hexes, NOT OKLAB-derived. Lines 30/38/46/54/62/70/78/86/94/102/110/118/130. Pattern: a darker, more-saturated partner of the base hue. **No `-contrast` for `gray-2…gray-6`.**

### Neutral ladder (`dieter-color-tokens.css:126–171`)
| Token | Hex | Apple | Line |
|---|---|---|---|
| `--color-system-white` | `#ffffff` | systemBackground (light) | `:126` |
| `--color-system-black` | `#212121` | label (near-black, not #000) | `:127` |
| `--color-system-black-secondary` | `#2C2C30` | (clickeen-specific cool secondary) | `:128` |
| `--color-system-gray` | `#707075` | (NOT systemGray `#8e8e93` — darker) | `:129` |
| `--color-system-gray-contrast` | `#636366` | systemGray2 | `:130` |
| `--color-system-gray-2` | `#808085` | (clickeen-specific step) | `:131` |
| `--color-system-gray-3` | `#8e8e93` | systemGray | `:132` |
| `--color-system-gray-4` | `#aeaeb2` | systemGray3 | `:133` |
| `--color-system-gray-5` | `#c7c7cc` | systemGray4 | `:134` |
| `--color-system-gray-6` | `#d1d1d6` | systemGray5 | `:135` |

Sub-ramps: `gray-step1…5` per gray (30 tokens, same 20/40/60/80/90 OKLAB-toward-white ladder). Lines 137–171.

**Observation:** `gray-3/4/5/6` map cleanly to Apple systemGray/systemGray3/4/5. The bare `gray` (`#707075`) does NOT match Apple systemGray (`#8e8e93`). Apple systemGray6 (`#E5E5EA`) is absent.

### Foundation color-adjacent tokens
- `--focus-ring-width: 2px`, `--focus-ring-offset: 2px`, `--min-touch-target: 2.75rem` (`dieter-foundation-tokens.css:75–77`).
- `--shadow-elevated`, `--shadow-floating`, `--shadow-inset-control` — all use `color-mix(in oklab, var(--color-system-black), transparent N%)` (`:85–87`). Only places foundation references color tokens.

**Token count:** 143 CSS custom properties in `dieter-color-tokens.css`.

---

## Facet 2 — Consumers + Hex Violations

### Token consumers — 515 references across 31 files
**Top consumers:** `dropdown-fill.css` (63), `roma.css` (54), `button.css` (52), `bob_app.css` (52), `dropdown-shadow.css` (27), `dropdown-border.css` (27).

**Most-consumed tokens:** `--color-system-black` (153×), `--color-system-white` (118×), `--color-system-blue` (73×), `--color-system-gray-5` (36×), `--color-text[-primary]` (34×).

**Structural finding:** the role/state abstraction layer (`--role-*`, `--state-*`) is largely **bypassed** — components reach past it to raw `--color-system-*` primitives. State tokens see only single-digit usage. The 216 `color-mix(in oklab, …)` calls confirm components routinely synthesize their own tints/shades from primitives rather than consuming pre-defined steps.

### OKLAB `color-mix` consumers — 216 lines across 30 files
Legitimate escape hatch for tints/shades not pre-tokenized. Top: `button.css` (39), `dropdown-fill.css` (37), `bob_app.css` (29). Canonical patterns: `color-mix(in oklab, var(--color-system-black), transparent NN%)` for muted text; `color-mix(in oklab, var(--color-system-white), var(--color-system-blue) N%)` for tinted hover backgrounds.

### Hex violations — 28 raw literals → 3 genuine chrome violations
After classification: color-picker surfaces (6, parametric), design-tool seed defaults (9, user content), hue-rainbow gradient (8, intrinsic), comparison literals (2) = legitimate. **3 genuine violations:**

| File:line | Value | Context |
|---|---|---|
| `admin/src/css/dieter-previews.css:107` | `#f4f5f7` | `.component-wrapper` background — hardcoded gray panel |
| `admin/src/css/dieter-previews.css:166` | `#f4f5f7` | Same gray, duplicated |
| `admin/src/css/layout.css:155` | `rgba(12,16,24,0.28)` | `.docs-shell__sidebar` box-shadow — hardcoded shadow color |

Plus 1 defensible fallback: `textedit.css:167` — `var(--shadow-floating, rgba(12,16,24,0.12)…)` — the literal is the fallback for a token.

**No hex violations in roma/components/*.tsx, bob/components/*.tsx, or admin/src/*.tsx inline styles.**

---

## Facet 3 — Integrity + Gaps

### (A) Dark mode — NOT shipped
Light-only. The state engine (`--state-darken/lighten-target`) is static `black`/`white`, never redefined. Of 25 dieter components, only 6 carry dark rules; the other 19 + all roma/bob/admin have zero. `segmented.css:275–283` has `[data-theme="dark"]` but **no JS anywhere sets `data-theme`** — dead code. Dark blocks flip a few surface backgrounds to hardcoded grays but never touch `--color-text`, `--role-surface`, or the system palette.

### (B) `-contrast` ramp adoption — 10 of 13 DEAD
Real consumers: `gray-contrast` (button.css:181–316, segmented.css:242), `orange-contrast` (bob_app.css:398, admin entitlements.html:199), `green-contrast` (admin tools, 3 uses). Within `dieter/components/` specifically, **only `--color-system-gray-contrast` is consumed.** The other 10 contrast variants are defined but never referenced.

### (C) Undefined-token bugs — confirmed (no fallback = live bugs)
| Token | Referenced at | Defined? | Impact |
|---|---|---|---|
| `--color-surface` | `button.css:8,190,321` (`--btn-bg: var(--color-surface)`) | **NO** | button bg unresolved; feeds broken hover/pressed `color-mix` |
| `--color-bg` | `admin/src/css/layout.css:185` | **NO** | shell background unset |
| `--radius-2` | `bulk-edit.css:96,112` | **NO** (only `--radius-3/4`) | corners render square |

Plus fallback-masked: `--hspace-1/2/3/4` (12 consumers, all have fallbacks, render but inert), `--color-system-gray-7` (referenced, never defined — ladder stops at gray-6).

### (D) Ramp perceptual check — even, with expected top-step compression
Ladder: 20/40/60/80/90% white via `color-mix(in oklab, …)`. Computed OKLAB L steps are constant through step 4 (blue ≈0.079/step, gray ≈0.090/step); step 5 compresses to ~half as the ramp asymptotes at white. Ramps are lighter-only — no `-N` darker ramp exists. The only darker shade per hue is the single hand-picked `-contrast` hex.

---

— end GLM as-built, 126B. Independent pass; awaits Codex's and human convergence (step 4).
