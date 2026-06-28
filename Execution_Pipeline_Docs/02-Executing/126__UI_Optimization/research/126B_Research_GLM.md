# 126B — Source research: Color (GLM, Phase-1 step 3)

> GLM independent pass — M3 + Apple HIG + OpenAI UI, primary sources only. Codex writes its own; **not converged**. Apple HIG color research was partially interrupted; HIG content below is supplemented by the GLM as-built's verbatim Apple system-color mapping documentation (facet 1) + the 126A accessibility research's HIG section. Marked where supplemental.

---

## Material 3 (m3.material.io)

### Sources consulted
- https://m3.material.io/styles/color/overview
- https://m3.material.io/styles/color/roles (canonical roles page)
- https://m3.material.io/styles/color/system/how-the-system-works
- https://m3.material.io/foundations/designing/color-contrast
- (unreachable SPA bodies — content via WebSearch snippets from m3.material.io pages only)

### What M3 says

**Color roles — 26 standard roles in 6 groups:**
1. **Primary** — key components/actions (primary, on-primary, primary-container, on-primary-container)
2. **Secondary** — less prominent (same family pattern)
3. **Tertiary** — contrasting accents (same)
4. **Error** — error/warning (same)
5. **Surface** — containers/backgrounds (surface, on-surface, on-surface-variant, surface-container-lowest…highest, surface-bright, surface-dim, outline, outline-variant, inverse-surface, inverse-on-surface)
6. **Fixed accents** (new in M3 — don't flip between light/dark): primary-fixed, primary-fixed-dim, secondary-fixed, etc.

**The "on-X pairs X" rule is the core accessibility mechanism:** each fill role has a paired content role (on-primary over primary) that guarantees contrast by construction.

**Architecture — seed → algorithm → roles:**
1. Start with a **source color** (brand seed).
2. Feed into the **M3 color algorithm** (HCT color space — Hue/Chroma/Tone, perceptually uniform).
3. Algorithm generates **5 tonal palettes** (primary, secondary, tertiary, neutral, neutral-variant/error), each a 0–100 tone scale.
4. **Roles = palette + tone selection.** Deterministic: e.g., light-theme `primary` = tone 40, `on-primary` = tone 100.

**Dark mode = tone inversion, not separate palette.** Same role taxonomy; only the tone assigned changes. Surfaces flip from high-tone (light) to low-tone (dark); accents move higher. Fixed accents are the exception — same tone in both themes.

**Contrast:** adopts WCAG. Normal text ≥ 4.5:1, large text ≥ 3:1, non-text ≥ 3:1. Enforced structurally by the on-X pairing (the paired content role is generated at the tone that clears contrast).

**Custom/brand colors:** brand = the seed. Full palette generated from it. Extended/custom colors can be harmonized (hue/chroma adjusted toward the source) so they don't clash. Static brand colors (logo, trademark) bypass tonal remapping.

### Implications for clickeen
- **Role taxonomy adoption:** clickeen could map tokens to M3's 26-role taxonomy (primary/on-primary/container/on-container per hue) instead of raw `--color-system-*` primitives. The on-X pairing makes contrast a token-level guarantee.
- **HCT + tone (0–100) instead of hex ramps:** brand color as a seed; tones derived algorithmically. Re-theming (light/dark, tenant brand swaps) becomes "swap the seed, regenerate" — fits clickeen's matrioska cascade.
- **Dark mode via tone inversion, not a separate palette:** author tone rules, derive both. Exception: brand-fixed colors that don't flip.
- **Contrast by construction (on-X pairing):** contrast checked at seed/generation time, not per-component.
- **Brand color as seed:** the cascade-friendly path. Trademark colors as fixed/extended.
- **Gaps M3 leaves (clickeen must cite WCAG, not M3):** focus-ring appearance (M3 underspecified — cite WCAG 2.4.13); ARIA mechanism (M3 silent).

---

## Apple HIG (developer.apple.com/design/human-interface-guidelines)

*Note: the dedicated HIG color-page agent was interrupted. Content below is from the GLM as-built's verbatim Apple system-color mapping (facet 1) + the 126A accessibility HIG research. Flagged as supplemental.*

### Sources consulted (supplemental)
- https://developer.apple.com/design/human-interface-guidelines/color (not directly fetched this pass)
- https://developer.apple.com/help/app-store-connect/manage-app-accessibility/sufficient-contrast-evaluation-criteria/ (from 126A research)
- clickeen's `dieter-color-tokens.css` — the Apple system-color hex values are the SOURCE OF TRUTH for clickeen's palette; all 13 hues + the gray ladder are documented verbatim in the as-built facet 1.

### What Apple HIG says (supplemental — from 126A + token mapping)

**System colors:** Apple defines a canonical set of system colors (systemBlue `#007AFF`, systemGreen `#34C759`, systemRed `#FF3B30`, etc.) — clickeen's base palette is seeded from these verbatim (confirmed in as-built facet 1).

**Dynamic system colors:** Apple's system colors "automatically adapt to vibrancy and accessibility settings" — they meet contrast ratios AND auto-adapt to Increase Contrast and Dark Mode. clickeen inherits this adaptation contract **as long as it consumes the system-color tokens, not hardcoded hex.**

**Contrast:** HIG states it qualitatively; the numeric thresholds live in App Store Connect evaluation criteria = **4.5:1 normal text, 3:1 large/non-text** (WCAG-derived).

**Dark mode:** Apple's approach is automatic — each system color has a light/dark pair that flips automatically. The semantic naming (labelColor, systemBackgroundColor, separatorColor) abstracts the pair. clickeen's `--color-system-*` tokens currently carry only the light values.

**Touch targets (color-adjacent):** iOS 44×44pt default, 28×28pt minimum. (Relevant to color because target size affects perceived color/contrast at small sizes.)

### Implications for clickeen (supplemental)
- **Inherited for free (token-on-token):** contrast floors + light/dark/contrast-increase adaptation — *if* clickeen consumes tokens end-to-end. **Not inherited:** custom composite pairs (accent on custom surface, gradients, badges).
- **The Apple system-color hexes in clickeen's tokens are the LIGHT values only.** Apple defines dark equivalents for every system color — clickeen does not carry them. Dark mode requires the dark-value pair.
- **The `gray` naming discrepancy:** clickeen's `--color-system-gray` (`#707075`) does NOT match Apple's `systemGray` (`#8E8E93`). This is a clickeen-specific darkening of the gray base. If Apple-accuracy is desired, this is a divergence to resolve at step 4.

### Verification gap
The dedicated Apple HIG color page was not fetched in this pass. Before 126B closes, the human (or a follow-up with a browser) should verify the exact HIG color-page content, especially: the full dynamic-color contract, the dark-mode system-color values, and any HIG guidance on custom palettes.

---

## OpenAI UI (developers.openai.com/apps-sdk)

### Sources consulted
- https://developers.openai.com/apps-sdk/concepts/ui-guidelines — Color section
- https://developers.openai.com/apps-sdk/plan/components — "Accessible color and motion"
- https://raw.githubusercontent.com/openai/apps-sdk-ui/main/src/styles/variables-primitive.css — tier-1 primitive tokens (fetched directly from GitHub)
- https://raw.githubusercontent.com/openai/apps-sdk-ui/main/src/styles/variables-semantic.css — tier-2 semantic tokens + dark-mode mapping
- https://raw.githubusercontent.com/openai/apps-sdk-ui/main/src/styles/globals.css — `color-scheme`/`data-theme` mechanism

### What OpenAI says

**Color guidance — 4 rules of thumb (verbatim):**
- "Use system colors for text, icons, and spatial elements like dividers."
- "Partner brand accents such as logos or icons should not override backgrounds or text colors."
- "Avoid custom gradients or patterns that break ChatGPT's minimal look."
- "Use brand accent colors on primary buttons inside app display modes."

**Key:** text/icons/dividers = system colors. Brand color = primary buttons/accents/badges ONLY. No brand color on backgrounds or text. No gradients.

**3-tier token architecture (from the actual CSS):** primitive → semantic → component. Structurally identical to M3 and HIG.

**Primitives:** Gray (22 steps, `--gray-0` to `--gray-1000`) + 8 hue families (green, red, pink, orange, yellow, purple, blue), each 13 steps. Every gray uses CSS `light-dark()` — light/dark co-defined per token.

**Primary = grayscale, NOT brand hue.** `--color-background-primary-solid: light-dark(--gray-900, --gray-950)`. Hue families are for status (green=success, red=error), not primary action. This is a deliberate divergence from M3 (where primary = seed color).

**Dark mode — effectively required:** "respect system dark mode (match color-scheme)." Achieved via `light-dark()` per-token + `data-theme` + `color-scheme`. No separate dark palette to author — `light-dark()` makes one token resolve to both.

**Contrast:** "WCAG AA" (one line). 4.5:1 normal, 3:1 large. No AAA, no non-text, no focus-indicator specifics.

**Brand restrictions:** no custom gradients, no brand on backgrounds/text, brand confined to CTAs/badges/accents. No explicit "avoid ChatGPT green" rule.

### Implications for clickeen
1. **Dark mode is mandatory for any clickeen surface inside ChatGPT.** Token-level `light-dark()` pairing or `data-theme` + `color-scheme`. This is the hardest requirement and the easiest to fail.
2. **Brand/accent = primary CTA/badges only.** Never on backgrounds, body text, or gradients.
3. **Structural colors must defer to host system colors** when embedded. clickeen needs a "host-mode" where semantic tokens re-bind to the host palette.
4. **WCAG AA is the only contrast floor** for ChatGPT-hosted surfaces. One number, one test.
5. **3-tier token architecture (primitive/semantic/component)** is the convergence point — clickeen's tokens structured this way map cleanly to all three host systems.
6. **"Primary = grayscale" is a real divergence from M3.** If clickeen adopts M3's "primary = brand color" globally, it violates OpenAI's expectation inside ChatGPT. Step-4 decision.

---

## Cross-source synthesis (GLM observation, not convergence)
- **Contrast:** all three → WCAG AA (4.5:1/3:1). M3 + HIG explicit; OpenAI defers.
- **Dark mode:** all three require it. M3 via tone inversion; Apple via auto-adapting dynamic colors; OpenAI via `light-dark()` per-token. clickeen ships NONE.
- **Token architecture:** all three use 3-tier (primitive/semantic/component). clickeen has 2-tier (primitive `--color-system-*` → semantic `--role-*`) with the semantic tier largely bypassed.
- **Brand color:** M3 = the seed (generates full palette); Apple = system-tinted; OpenAI = grayscale primary + brand on CTA only. clickeen = Apple system colors as the base palette (seeded from Apple, not user-configurable).
- **The `on-X pairing` (M3) is the structural innovation clickeen lacks:** guaranteed contrast by construction. clickeen relies on ad-hoc `color-mix` per component.

— end GLM research, 126B. Independent pass; awaits Codex's and human convergence (step 4).
