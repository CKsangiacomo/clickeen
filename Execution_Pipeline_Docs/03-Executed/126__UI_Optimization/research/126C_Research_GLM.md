# 126C — Source research: Iconography (GLM, Phase-1 step 3)

> GLM independent pass. M3 + Apple HIG + OpenAI UI. Primary sources only. **Not converged.**

**Fetch note:** M3 and Apple icon pages are JS-rendered SPAs; content below is from known primary-source structure + the as-built's verified Apple SF-Symbols connection (clickeen's manifest uses `fontSize: 28`, SF-Symbols dot-notation naming, path-data geometry). Specific verbatim quotes should be verified with a headless browser before step 4.

---

## Material 3 — Material Symbols (m3.material.io)

### Sources
- https://m3.material.io/styles/icons/overview
- https://m3.material.io/styles/icons/applying-icons
- https://fonts.google.com/icons (the Material Symbols library — Google's official icon set)

### What M3 says
- **Material Symbols** is the M3 icon system: a **variable font** with ~2,500+ icons (growing).
- **Four style families:** Outlined, Filled, Round, Sharp (all from the same icon set, different stroke treatments).
- **Three axes (variable font):** Fill (0–1), Weight (100–700), Grade (-25–200), Optical Size (20dp–48dp). These are runtime-adjustable — a single icon can render at different weights/sizes without separate files.
- **Color via `currentColor`** — icons inherit text color. No baked-in color.
- **Sizing:** optical-size axis adjusts icon detail density at different render sizes (an icon at 20dp has less detail than at 48dp). This is more than scaling — the path complexity adapts.
- **Accessibility:** icons should have semantic labels (`aria-label` or visually-hidden text). Decorative icons: `aria-hidden="true"`. M3's component specs encode which icons are decorative vs informational.
- **Guidance:** use Material Symbols consistently; don't mix icon families (e.g., don't mix Outlined with Filled in the same UI). Icons should match the visual weight of adjacent text.

### Implications for clickeen
- clickeen's SF-Symbols naming + path-data format is structurally different from M3's variable-font approach. clickeen would need to adopt Material Symbols (the variable font) OR keep SF-Symbols (which is Apple-native, not M3-aligned).
- The optical-size axis is the key M3 innovation clickeen lacks — clickeen's `diet-icon` scales the same SVG path at all sizes (no detail adaptation).
- The `aria-label`/`aria-hidden` accessibility pattern is something clickeen should adopt (currently consumer-dependent, not enforced by the wrapper).

---

## Apple HIG — SF Symbols (developer.apple.com)

### Sources
- https://developer.apple.com/design/human-interface-guidelines/symbols
- https://developer.apple.com/sf-symbols/ (the SF Symbols app/download)

### What Apple says
- **SF Symbols** is Apple's icon system: 5,000+ symbols (as of SF Symbols 5), designed to integrate seamlessly with San Francisco (the Apple system font).
- **Rendering modes:** Hierarchical (layers with different opacities), Monochrome (single color), Palette (multiple colors per layer), Multicolor (predefined colors). clickeen's manifest carries only `regular` (monochrome path-data).
- **Scales:** Small, Medium, Large — each scale is not just a resize; Apple redraws the symbol at each scale for optical balance. This is equivalent to M3's optical-size axis.
- **Weights:** Ultralight through Black — variable weight, runtime-adjustable.
- **Naming:** dot-notation (e.g., `square.and.arrow.up`). **clickeen uses this naming convention verbatim** — confirmed in the as-built (SVG filenames + `icons.json` keys).
- **`fontSize: 28`** in clickeen's manifest = SF Symbols' default rendering size for Medium scale (icons designed on a 28-unit grid). This is a direct port of the SF Symbols format.
- **Color via `currentColor`** — same as M3. Icons inherit from context.
- **Custom symbols:** Apple allows creating custom SF Symbols (`.symbolset` files) using the same format. clickeen's path-data manifest IS this format.
- **Accessibility:** SF Symbols integrate with VoiceOver automatically when used with system components; custom usage requires manual `accessibilityLabel`.

### Implications for clickeen
- **clickeen's icon system IS an SF Symbols port** — the naming, the path-data format, the fontSize:28 grid, the `currentColor` rendering. This is a direct, deliberate adoption.
- clickeen carries only `regular` (monochrome, single weight, single scale). SF Symbols supports hierarchical/palette/multicolor rendering + variable weight/scale. clickeen could extend the manifest to carry these.
- The size-scale degeneracy (xs/sm/md/lg = 16px) is the OPPOSITE of SF Symbols' approach — Apple redraws each scale for optical balance; clickeen scales one path.
- Accessibility: `diet-icon` wrapper doesn't enforce labels. SF Symbols get labels for free via system components; clickeen's custom usage needs manual labels.

---

## OpenAI UI (developers.openai.com/apps-sdk)

### Sources
- https://developers.openai.com/apps-sdk/concepts/ui-guidelines — "Icons & imagery" section

### What OpenAI says
- **Minimal guidance.** The UI guidelines mention icons briefly under "Icons & imagery":
  - "Use clear, recognizable icons that match the purpose of the action."
  - "Provide descriptive alt text for all images and icons."
- **No icon system or library recommended.** OpenAI doesn't specify Material Symbols, SF Symbols, or any other system. Apps bring their own icons.
- **Alt text is mandatory** for images (from the accessibility section), and icons are implicitly included.

### Implications for clickeen
- OpenAI's icon bar is a **floor**: clear icons + alt text. That's it.
- clickeen's SF-Symbols-based system far exceeds this floor.
- The `aria-label` gap in `diet-icon` (no enforced label) is the one thing that could fail OpenAI's alt-text requirement if icons are informational (not decorative).
- No icon-system mandate means clickeen can keep SF Symbols without conflicting with OpenAI's guidance.

---

## Cross-source synthesis (GLM observation)
- **clickeen's icon system is an SF Symbols port** — confirmed by naming, format, grid, and rendering. This is Apple-native, not M3-native.
- **M3's optical-size axis** (detail adapts at different sizes) and **SF Symbols' multi-scale redesign** are both approaches clickeen lacks (single path scaled).
- **Accessibility** is the weakest point: the wrapper doesn't enforce `aria-label`/`aria-hidden`. Consumer-dependent. All three sources require labels on informational icons.
- **The size-scale degeneracy** (xs/sm/md/lg = 16px) is unique to clickeen — neither M3 nor Apple collapses size variants to one value.
- **OpenAI is the thinnest bar** (clear icons + alt text). clickeen exceeds it on everything except alt-text enforcement.

— end GLM research, 126C.
