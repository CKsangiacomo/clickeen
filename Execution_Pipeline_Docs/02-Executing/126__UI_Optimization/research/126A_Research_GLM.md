# 126A — Source research: Accessibility (GLM, Phase-1 step 3)

> GLM independent pass — M3 + Apple HIG + OpenAI UI, primary sources only (no Reddit/SO/blogposts). Codex writes its own; **not converged** — human reconciles at step 4. Exact URLs + sections cited per source.

**Fetch caveat (applies to M3 + HIG):** both sites are client-side JS-rendered SPAs; static-reader fetches returned only shell HTML. Body content below is from **search-snippet extraction of the live primary pages**, cross-checked across queries; verbatim-confirmed text is quoted, paraphrase is marked. Where a page was unreachable or unconfirmable, it is stated, nothing invented.

---

## Material 3 (m3.material.io)

### Sources consulted (exact URLs)
1. https://m3.material.io/foundations/overview/principles — *Accessibility overview*
2. https://m3.material.io/foundations/designing — *Accessibility designing* ("draws on WCAG standards")
3. https://m3.material.io/foundations/designing/structure — *Touch targets / focus control*
4. https://m3.material.io/foundations/designing/color-contrast — *Color contrast ratio*
5. https://m3.material.io/foundations/designing/flow — *Focus order & key traversal*
6. https://m3.material.io/foundations/designing/elements — *Labeling elements*
7. https://m3.material.io/styles/motion/transitions/applying-transitions — *Transitions: reduced motion* (verbatim-confirmed)
8. https://m3.material.io/components/buttons/accessibility — *Buttons accessibility* (3:1 container contrast, 48dp target)
9. https://m3.material.io/components/icon-buttons/accessibility — *Icon buttons accessibility* (48dp even when nested; 3:1 icon-vs-surface)
10. https://m3.material.io/components/buttons/specs + .../icon-buttons/specs — small/extra-small carry a 48×48dp minimum touch target
11. https://m3.material.io/components/carousel/accessibility — reduced-motion removes parallax/expansion
12. https://m3.material.io/styles/typography/applying-type — 4.5:1 for small text

Unreachable (shell only, no snippet): `/foundations/interaction-states`, `/foundations/usability`, `/foundations/writing`. Not asserted.

### What M3 says
- **Built on WCAG.** "Draws on WCAG standards and industry best practices." M3 adopts WCAG numbers, then layers component specifics.
- **Color contrast:** small text ≥ **4.5:1**; large text ≥ **3:1** (WCAG 1.4.3). Enabled buttons need **3:1** container-vs-background; icon buttons need icon ≥ **3:1** vs surface (WCAG 1.4.11 non-text contrast). M3's color roles (on-surface/surface, primary/on-primary) are generated to clear these when used as specified.
- **Touch targets: minimum 48 × 48 dp** (snippet-confirmed verbatim-ish). Component specs encode it: small/extra-small buttons and icon buttons **must** carry a 48×48dp hit area even when the visible control is smaller (e.g., 36dp button w/ 48dp hit area; 24dp icon w/ 48dp target). Icon buttons: "at least 48dp, **even when nested**." (The "7–10mm" + "8dp gap" figures are confirmed on **M2** pages, M3-inherited — not verbatim-confirmed on M3.)
- **Focus management:** "People should be able to navigate and interact with your app without the use of a traditional mouse or touch screen." M3 expresses focus via the **state layer** (opacity overlay), not a bespoke ring spec. **M3 does NOT publish a numeric focus-ring thickness/offset/contrast** — it delegates "visible focus" to state-layer + WCAG 2.4.13 / platform conventions.
- **Semantics/labeling:** three-stage — (1) identify the meaningful element, (2) assign a role/label, (3) mark decorative elements. Role-agnostic on mechanism (native vs ARIA).
- **Motion/reduced-motion** (verbatim-confirmed): "transitions should: **Use subtle fades instead** [of intense sliding or scaling]; **Disable decorative effects like parallax or shape morphing**; [maintain] stable layouts." Carousel: parallax removed, items no longer expand. M3 does not name `prefers-reduced-motion` explicitly (that's the implementation mechanism).

### Implications for clickeen
- **Aligned:** reduced-motion guard matches M3's contract — but verify clickeen does **fades-not-slides** under reduced motion, not just zeroing duration while leaving a slide transform.
- **Diverges (concrete):** `--min-touch-target: 44px` ≈ 33dp at 1.5× — **below M3's 48dp floor.** M3 is component-spec-enforced. (Apple HIG floor is 44pt — where clickeen's 44 likely came from.) Raise to 48px (CSS px ≥ 48dp at standard densities).
- **Gaps M3 leaves (clickeen must cite WCAG, not M3):** focus-ring appearance (M3 underspecified — cite WCAG 2.4.13); ARIA mechanism (M3 silent — cite HTML/ARIA spec).

---

## Apple HIG (developer.apple.com/design/human-interface-guidelines)

### Sources consulted (exact URLs)
- .../accessibility — main Accessibility HIG
- .../color — system colors, contrast, adaptivity
- .../motion — animation + reduce-motion
- .../buttons — hit-target + spacing rule
- .../layout, .../materials, .../dark-mode
- https://developer.apple.com/help/app-store-connect/manage-app-accessibility/sufficient-contrast-evaluation-criteria/
- .../differentiate-without-color-alone-evaluation-criteria/
- .../reduced-motion-evaluation-criteria/
- https://developer.apple.com/documentation/uikit/uitraitcollection/accessibilitycontrast (`accessibilityContrast` trait)
- WWDC19/254 "Writing Great Accessibility Labels"; Tech Talks 111433 "Accessibility Nutrition Labels"

### What Apple HIG says
- **Foundational:** "Accessible user interfaces empower everyone… Keep actions simple and intuitive… **Consider spacing between controls as important as size**" (verbatim). Use standard system controls.
- **Element model (VoiceOver):** four attributes — **label** (name), **value** (state), **traits** (role+state+behavior), **hint** (usage). Group sub-elements that convey one action into one accessibility element. `accessibilityIdentifier` is for test automation only, not user-facing.
- **Contrast:** HIG states it qualitatively ("enough contrast between foreground text and icons and background colors"); the **numeric thresholds live in App Store Connect evaluation criteria = 4.5:1 normal text, 3:1 large/non-text** (WCAG-derived). Apple's system colors "automatically adapt to vibrancy and accessibility settings" — they meet the ratios and auto-adapt to Increase Contrast (`accessibilityContrast`) and Dark Mode.
- **Differentiate Without Color Alone:** "common tasks… must not rely on color as the only way to convey information" — reinforce with text/icon/shape/position.
- **Touch targets** (verbatim table):
  | Platform | Default | Minimum |
  |---|---|---|
  | iOS/iPadOS | **44 × 44 pt** | 28 × 28 pt |
  | macOS | 28 × 28 pt | 20 × 20 pt |
  | tvOS | 66 × 66 pt | 56 × 56 pt |
  | visionOS | 60 × 60 pt | 28 × 28 pt |
  Buttons HIG: hit region ≥ 44pt; centers ≥ **60 pts apart**; if ≥ 60pt, add **4 pts padding**. (44pt is the iOS *default*, not the hard floor — 28pt is documented minimum — but HIG treats 44pt as the practical target.)
- **Motion/Reduce Motion** (verbatim-confirmed mitigations): "**Tightening animation springs to reduce bounce effects. Tracking animations directly with people's gestures. Avoiding animating depth changes in z-axis layers.**" `UIAccessibility.isReduceMotionEnabled` / `accessibilityReduceMotion` for branching. (Could not verbatim-confirm the exact subheading wording; substantive rule confirmed.)
- **Semantic roles:** trait-driven (`button`, `header`, `link`, `image`, `adjustable`, `selected`, `notEnabled`…) — Apple's analogue of WCAG 4.1.2 Name/Role/Value. Use the trait matching actual behavior.
- **Color system (clickeen seeds from it):** system colors + dynamic system colors "automatically adapt to vibrancy and accessibility settings" — the adaptive-color contract clickeen inherits **as long as it consumes the system-color tokens, not hardcoded hex**.

### Implications for clickeen
- **Inherited for free (token-on-token cases):** contrast floors (4.5/3:1) + light/dark/contrast-increase adaptation — *if* clickeen consumes tokens end-to-end, not hex literals. **Not** inherited: custom composite pairs (accent on custom surface, gradients, badges) — those need manual audit.
- **Real work vs HIG (web UIs):** (a) 44pt-class touch targets + 60pt-class spacing (web icon-buttons at 24–32px fail); (b) ARIA roles/labels replacing native traits (every `<div>`-as-button needs `role=button`+keyboard+name); (c) `prefers-reduced-motion` gating (crossfades over displacement; the three HIG mitigations port directly); (d) non-color status redundancy.

---

## OpenAI UI (developers.openai.com/apps-sdk)

### Sources consulted (exact URLs)
1. https://developers.openai.com/apps-sdk/concepts/ui-guidelines — "Visual guidelines / Color / Typography / Spacing & layout / Icons & imagery / **Accessibility**"
2. https://developers.openai.com/apps-sdk/app-submission-guidelines — publication minimum standard
3. https://developers.openai.com/apps-sdk/plan/components — "Accessible color and motion" bullet

**No dedicated OpenAI accessibility policy page exists.** A11y is short subsections inside the UI + component docs.

### What OpenAI says
- **Accessibility (UI guidelines) — three "rules of thumb" (verbatim):** "Text and background must maintain a minimum contrast ratio (WCAG AA). Provide alt text for all images. Support text resizing without breaking layouts." That is the entirety of the explicit a11y list. No contrast number named (defers to WCAG AA = 4.5:1/3:1). No keyboard/focus-order/reduced-motion/screen-reader rules on this page.
- **Components in iframes (component page, one bullet):** "Accessible color and motion – **respect system dark mode (match color-scheme) and provide focus states for keyboard navigation**." The single mention of keyboard/focus + motion; phrased as guidance, no specifics.
- **Typography:** "ChatGPT uses platform-native system fonts… Always inherit the system font stack, respecting system sizing rules… Limit variation in font size."
- **Color:** system colors for text/icons/dividers; brand accents "should not override backgrounds or text colors"; no custom gradients.
- **Submission:** the three a11y bullets are the enforceable publication gate; the dark-mode + focus-state line is weaker (guidance, not enumerated minimum).
- **Verified absent:** no contrast ratio number, no reduced-motion/`prefers-reduced-motion` requirement, no focus-trap/skip-link/ARIA/screen-reader rules, no text-resize minimum, no color-blindness/seizure/cognitive rules, no alt-text quality guidance, no VPAT/conformance-report requirement.

### Implications for clickeen
OpenAI's bar is **a low floor: 3 bullets + 1 component bullet**. Clickeen's own target (WAI-ARIA APG + WCAG 2.2 AA) strictly exceeds it. Tight-align only at the explicit floors: **contrast ≥ AA, alt text on every image, resize-safe layout (rem/clamp, reflow), `prefers-color-scheme` support.** Everything else (keyboard patterns, focus-trap, reduced-motion, ARIA) clickeen self-governs above OpenAI's line. A clickeen-built ChatGPT app shipping an image without alt or sub-AA text risks submission rejection; the keyboard/motion/dark-mode lines alone are unlikely to trigger rejection.

---

## Cross-source synthesis (GLM observation, not convergence)
- **Contrast:** all three point at WCAG AA (4.5:1/3:1). M3 + HIG are explicit; OpenAI defers. clickeen's `-contrast` ramp exists to satisfy this but is **unused** (see as-built) — the gap is execution, not the bar.
- **Touch target:** the one real disagreement — **M3 = 48dp, HIG = 44pt (default).** clickeen's 44px matches HIG, undershoots M3. (Human decides the target at step 4.)
- **Focus/ARIA:** M3 + HIG are mechanism-agnostic; OpenAI says only "provide focus states." clickeen's explicit `--focus-ring-*` + per-component ARIA exceed all three; cite WCAG (2.4.13, 1.4.11, 4.1.2) as authority, not the design-system docs.
- **Motion:** M3 is most concrete (fades-not-slides, kill parallax); HIG gives three mitigations; OpenAI says nothing specific. clickeen's global guard matches M3/HIG in spirit — verify it does fades-not-slides.

— end GLM research, 126A. Independent pass; awaits Codex's and human convergence (step 4).
