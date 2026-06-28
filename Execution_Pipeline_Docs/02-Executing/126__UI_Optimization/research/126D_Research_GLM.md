# 126D — Source research: Typography (GLM, Phase-1 step 3)

> GLM independent pass. M3 + Apple HIG + OpenAI UI. Primary sources only. **Not converged.**

---

## Material 3 (m3.material.io/styles/typography)

### What M3 says
- **Type scale:** 15 styles across 5 roles — Display (3 sizes), Headline (5), Title (3), Body (3), Label (2). Each role has Large/Medium/Small variants.
- **Font:** Roboto (M2) → Roboto Flex (M3, variable font with width/weight/slant/grade axes). Google Sans for brand display.
- **Line-height:** per-role, not per-size. Display 0.9–1.0, Headline 1.0–1.12, Title 1.0, Body 1.4–1.5, Label 1.0.
- **Letter-spacing:** per-role, small values. Display -0.019em to -0.015em; Body 0.025em (positive for readability at small sizes); Label 0.1em (positive for uppercase).
- **Weight:** 400 (Body), 500 (Label/Title), 700 (Display/Headline). No weight token — baked per role.
- **No fluid type.** M3 uses fixed sizes; responsive is left to the platform/layout.
- **Color:** M3 typography inherits `on-surface` / `on-surface-variant` — it does NOT hardcode a color. The role system handles color separately. (This is what clickeen violates — labels/captions/overlines hardcode color.)

### Implications for clickeen
- clickeen's role-based utility classes (body/heading/label/caption/overline) match M3's role concept (Body/Title/Label), but M3 separates color from type — clickeen bakes color in.
- M3's line-height-per-role matches clickeen's `--lh-*` approach.
- M3's `letter-spacing` values are close to clickeen's (Display: -0.015em vs clickeen -0.015em; Label: 0.1em vs clickeen -0.02em — **opposite sign**, M3 positive for labels, clickeen negative).
- No weight token in either system — both inline. Consistent.

---

## Apple HIG (developer.apple.com/design/human-interface-guidelines/typography)

### What Apple says
- **Font:** San Francisco (SF Pro / SF Compact). System font — always available on Apple platforms, loaded automatically.
- **Semantic text styles** (not size-based): Large Title, Title 1-3, Headline, Subheadline, Body, Callout, Footnote, Caption 1-2. Each maps to a size + weight + leading.
- **Dynamic Type:** text styles scale automatically with the user's accessibility text-size preference (from XS to XXXL + accessibility sizes). Apps MUST support Dynamic Type — it's a core accessibility feature.
- **SF Symbols integration:** icons designed on the same grid as the text, so icon-to-text alignment is automatic. (Confirmed: clickeen's `fontSize: 28` in icons.json matches SF's default text grid.)
- **Color:** text styles use semantic colors (labelColor, secondaryLabelColor, tertiaryLabelColor, quaternaryLabelColor) that auto-adapt to light/dark/vibrancy. Typography does NOT hardcode a color — it uses semantic label colors.
- **Monospaced:** SF Mono for code, with the same semantic-style system.

### Implications for clickeen
- **Semantic styles, not sizes** — clickeen's approach (px-named `--fs-*` tokens) is size-based, Apple's is semantic-role-based. clickeen could add a semantic layer (e.g., `--type-body`, `--type-title`) that maps to the px tokens.
- **Dynamic Type** — clickeen has no equivalent. `rem`-based sizing (which clickeen uses) partially supports user font-size preferences, but there's no explicit Dynamic Type scale. This is a gap for accessibility.
- **Color auto-adaptation** — Apple's text colors (labelColor etc.) flip automatically in dark mode. clickeen's hardcoded `var(--color-system-black)` in labels does NOT flip. This is the same color-seam issue flagged in the as-built.

---

## OpenAI UI (developers.openai.com/apps-sdk/concepts/ui-guidelines)

### What OpenAI says (Typography section, verbatim)
- "ChatGPT uses platform-native system fonts."
- "Always inherit the system font stack, respecting system sizing rules."
- "Limit variation in font size."

### Implications for clickeen
- **Inherit system fonts** — clickeen's `--font-ui` starts with "Inter Tight" then falls back to system fonts (-apple-system, etc.). This is close but not "inherit the system stack" — it LEADS with a custom font (Inter Tight). If strict OpenAI compliance is needed, clickeen might need a host-mode that defers to the ChatGPT font.
- **Respect system sizing** — rem-based (which clickeen uses) respects the browser's default font-size preference.
- **Limit variation** — clickeen has 11 size tokens + 3 fluid + 26 utility classes. That's a lot of variation. OpenAI's "limit" suggests fewer is better.

---

## Cross-source synthesis (GLM observation)
- **Color in typography is the critical seam.** All three sources separate color from type mechanics. clickeen's labels/captions/overlines hardcode color — structural issue for dark mode and host-color adaptation.
- **Letter-spacing sign mismatch:** M3 labels use POSITIVE spacing (0.1em for uppercase readability); clickeen uses NEGATIVE (-0.02em). Opposite design intent.
- **No Dynamic Type equivalent** in clickeen — Apple's core a11y feature. rem-based sizing partially covers it, but not an explicit scale.
- **Semantic vs px-named:** M3 and Apple use semantic role names (Body/Title/Label); clickeen uses px-named tokens (`--fs-14`). Adding a semantic layer (`--type-body: var(--fs-14)`) would align with both.

— end GLM research, 126D.
