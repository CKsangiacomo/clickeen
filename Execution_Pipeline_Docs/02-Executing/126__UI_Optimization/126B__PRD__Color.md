# 126B - PRD: Color

Status: DIRECTIONAL - Phase 1 Step 2 Codex baseline.
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA).
Series order: 126B of 126A-126M.
KB doc: `documentation/engineering/UI/color.md`.

This PRD is a baseline/directional artifact only. It is filled from Codex Step 1
as-built evidence and Step 3 official-source research. It does not converge
Codex/GLM, does not select fixes, does not write doctrine, and does not
authorize runtime implementation.

## Step Inputs

- Step 1 Codex as-built: `audits/126B__AsBuilt_Codex.md`.
- Step 1 GLM as-built: `audits/126B__AsBuilt_GLM.md` when available.
- Step 3 Codex research: `research/126B_Research_Codex.md`.
- Step 3 GLM research: external GLM artifact when available.
- Current living doc: `documentation/engineering/UI/color.md`.
- Source token authority: `dieter/tokens/dieter-color-tokens.css`.
- Generated runtime output: `tokyo/product/dieter/tokens/dieter-color-tokens.css`.

## Role

126B owns the color-system baseline for Clickeen UI: base color tokens,
semantic roles, foreground/background relationships, state color, contrast,
light/dark/adaptive behavior, status color semantics, brand/accent boundaries,
and color documentation truth.

Color is an inner-doll domain. If color is wrong at the token layer, every
component and screen inherits the problem. If screens hand-patch color, the
matrioska chain breaks.

## Current Reality Summary

Clickeen has a strong color-system intent but not a clean proven color-system
contract.

The intended model is:

- Dieter color source lives in `dieter/tokens/dieter-color-tokens.css`.
- `dieter/tokens/tokens.css:1-3` imports foundation, color, and typography.
- `scripts/build-dieter.js:265-275` copies Dieter tokens into Tokyo product
  output.
- Roma and Bob consume Dieter/Tokyo token output through their app layouts.
- `documentation/engineering/UI/color.md` is the living reference, but the CSS
  source owns actual values.

The current token file textually declares:

- Semantic roles: `--color-text`, `--color-text-secondary`,
  `--role-surface`, `--role-surface-bg`, `--role-border`,
  `--focus-ring-color` in `dieter/tokens/dieter-color-tokens.css:13-18`.
- State controls: `--state-darken-target`, `--state-lighten-target`,
  `--state-hover-mix`, `--state-pressed-mix`, `--state-muted-mix`,
  `--state-inactive-mix` in `dieter/tokens/dieter-color-tokens.css:21-26`.
- Light system palette from `dieter/tokens/dieter-color-tokens.css:28`.
- Light neutral ladder from `dieter/tokens/dieter-color-tokens.css:125`.
- OKLAB ramps and contrast partners across the hue families.

The critical current gap is that the source CSS is malformed at the opening
comment boundary. `dieter/tokens/dieter-color-tokens.css:1` opens a comment and
does not close it before `:root` begins at line 11. The first visible close
marker is embedded at line 23. The same malformed boundary exists in
`tokyo/product/dieter/tokens/dieter-color-tokens.css:1-23` and
`tokyo/product/dieter/tokens/dieter-color-tokens.shadow.css:1-23`.

Therefore the baseline must distinguish between:

- The intended color model, which is visible in source text and docs.
- The active CSS contract, which is not clean because of the malformed comment
  boundary.

## Directional Product Reading

The 126B problem is not "pick better colors." The problem is to make color a
reliable inner-doll system that agents and components can operate by reference.

The color system is already aiming at the right product shape: semantic roles,
OKLAB derivation, state controls, contrast partners, generated DevStudio reveal,
and Tokyo propagation. The current baseline failure modes are reliability and
truthfulness:

- Token source/output syntax cannot be assumed healthy.
- Docs overstate some claims and contain stale references.
- Consumers still reference undefined tokens.
- Light/dark behavior is partial and local, not a complete token contract.
- DevStudio reveal and write authority do not cover the same token set.
- Contrast has not been measured across actual pairings.

## Scope For Later Human Convergence

This PRD scopes the color decision surface. It does not decide final law.

### Token Authority

Current baseline:

- CSS source is the authority for values.
- Living docs explain the model.
- Tokyo output mirrors the source.
- Current source/output are malformed at the comment boundary.

Later convergence must decide:

- How to represent token authority in doctrine once the source is corrected in
  a later execution phase.
- Whether role tokens are the required consumption layer for components.
- How to separate base token raw values from user-authored colors.

### Semantic Roles

Current baseline:

- Roles are textually declared.
- Components also consume raw system tokens directly.
- Some role declarations may not be active due to CSS syntax.

Later convergence must decide:

- Required role set for text, surface, border, focus, status, disabled,
  selected, muted, overlay, and product-specific states.
- Whether components may directly consume `--color-system-*` tokens.

### State Color

Current baseline:

- Global state mix controls are textually declared.
- Docs mention `--state-hover-target`, which source does not define.
- Components reference missing `--state-muted-opacity`.

Later convergence must decide:

- Whether Clickeen's interaction model is state-layer based, mix-control based,
  or another explicit system.
- Required hover/pressed/muted/inactive/disabled token names.
- Whether state color is owned entirely by Dieter tokens.

### Light, Dark, And Adaptive Behavior

Current baseline:

- Token palette is labelled light.
- No complete dark token palette exists.
- Component-local dark selectors exist.
- Bob has a typed light/dark theme field and default light value.

Later convergence must decide:

- Whether 126B doctrine includes a complete light/dark/adaptive token contract.
- Whether component-local dark blocks are allowed after a token-level doctrine.
- How agent-hosted and host-system color adaptation should work.

### Contrast

Current baseline:

- Contrast partners exist by token name.
- No formal WCAG pairing audit exists.
- Accessibility docs explicitly say no formal WCAG audit is recorded.

Later convergence must decide:

- Pairing audit method.
- Which pairings are required for text, UI controls, borders, focus, disabled,
  selected, alert, status, overlay, and public widget content.
- Whether contrast checks become a build/docs gate later.

### DevStudio Reveal And Write

Current baseline:

- DevStudio generated color page declares 132 governed rows.
- Generated page exposes role/focus/state rows.
- Runtime token editor binds `[data-token-edit]`.
- Shared token handler only accepts `^--color-` and hex values.

Later convergence must decide:

- Whether DevStudio should reveal all color-related tokens it cannot write.
- Whether color-token editing remains narrow or becomes broader.
- How to prevent masquerade: DevStudio cannot show a dressed-up color system
  that differs from Dieter source truth.

### Consumer References

Current baseline:

- Undefined or missing references include `--color-surface`, `--color-bg`,
  `--color-system-gray-7`, `--color-system-gray-10`, and
  `--state-muted-opacity`.
- Public runtime fallbacks include raw hex values.
- Authoring controls include raw swatch values and user-authored color values.

Later convergence must decide:

- Which raw values are legitimate user-authored content.
- Which raw values are design-system violations.
- Which undefined references are 126B color issues versus adjacent token/
  component issues.

## Official Source Baseline

Step 3 Codex research identifies these non-binding external bars:

- Material 3 treats color as role-based infrastructure with tonal palettes,
  light/dark schemes, system tokens, component tokens, state layers, contrast
  levels, and an error role.
- Apple HIG emphasizes semantic/adaptive colors that respond to appearance
  modes, backgrounds, vibrancy, accessibility settings, and user perception.
- Apple warns against using the same color for different meanings and against
  relying on color alone.
- OpenAI Apps SDK UI guidance requires ChatGPT-hosted UI to feel native, use
  readable/system colors for structural UI, keep brand color constrained, meet
  WCAG AA contrast, support dark mode/system color scheme, and avoid visual
  patterns that fight the host.

Research does not become Clickeen doctrine until Step 4 human convergence.

## Known Gaps Only

These are baseline gaps, not selected fixes:

1. Dieter color token CSS source/output is malformed at the comment boundary.
2. Early semantic/state declarations are textually present but not safely active
   CSS.
3. No complete token-level dark palette exists.
4. Component-local dark handling exists and is not a system contract.
5. Undefined/missing color-related references remain.
6. DevStudio color reveal and DevStudio token-write scope are mismatched.
7. Contrast is not formally audited by actual pairings.
8. Docs contain stale references and an inaccurate state-token example.
9. Raw hex exists outside base token definitions in authoring/runtime contexts.
10. Existing 126B text previously drifted into prescribing fixes; Step 2 must
    not do that.

## Out Of Scope For This Baseline

- Runtime code changes.
- Product data changes.
- Palette redesign.
- Dark-mode implementation.
- DevStudio write-path changes.
- Consumer token-reference fixes.
- Step 4 convergence.
- Step 5 doctrine.
- Step 6 gap audit against doctrine.
- Step 7 executable implementation PRD.
- Step 9 execution.

## Compliance With Clickeen Architecture And Product Law

- Lean and agent-operable: color is treated as declared token truth, not
  per-screen styling.
- Source authority separation: CSS/source owns current values, official sources
  own external reference, human owns convergence.
- No reinterpretation: this PRD does not turn color into a redesign or dark-mode
  implementation pass.
- No masquerade: it separates intended model from active malformed CSS reality.
- No silent success: partial token and component wins are called partial.

## Done For Phase 1 Step 2

126B Step 2 is done when this PRD:

- Points to Step 1 Codex audit in `audits/126B__AsBuilt_Codex.md`.
- Points to Step 3 Codex research in `research/126B_Research_Codex.md`.
- States current reality and known gaps only.
- Avoids Step 4+ convergence or fixes.
- Keeps color scoped to Dieter/source token authority and consumers by
  reference.

## GLM Addendum — Phase 1 Step 2 (feedback on Codex baseline)

GLM reviewed Codex's baseline against the GLM step-1 as-built (`audits/126B__AsBuilt_GLM.md`) and step-3 research (`research/126B_Research_GLM.md`). Critique only — no merge, no convergence, no fix selection (human, step 4).

### Codex gets right
- The framing — "make color a reliable inner-doll system agents can operate by reference" — is correct.
- The `--color-surface`/`--color-bg` undefined-token finding — confirmed by GLM (button.css:8,190,321; layout.css:185).
- The "no complete dark palette" finding — confirmed by GLM (light-only, state engine static, only 6/25 components have dark rules, dead `[data-theme="dark"]`).
- The "contrast not formally audited" gap — confirmed (GLM measured specific pairs in 126A accessibility; the `-contrast` ramp is 10/13 dead).
- The scope-for-convergence structure (token authority, roles, state, light/dark, contrast, DevStudio, consumers) is the right decision surface.

### Key item to VERIFY — Codex's malformed-CSS-comment finding
Codex claims `dieter-color-tokens.css:1` opens a comment that doesn't close before `:root` at line 11, with the first close marker at line 23 — meaning the semantic roles (13–18) and state engine (21–26) may be **inactive CSS**. GLM's read: line 10 has `/* Dieter Color Tokens */` whose trailing `*/` closes the comment from line 1 (CSS: `/*` opens, next `*/` closes, regardless of intervening `/*`). If correct, lines 11+ ARE active. **This is a critical disagreement — must be resolved at step 4 by rendering the page and checking whether `--color-text`, `--role-surface`, etc. resolve in the browser.** If Codex is right, the entire semantic-role layer is dead CSS and every component falls back to raw `--color-system-*` primitives — which would explain the bypass pattern GLM found (153× black, 118× white refs vs single-digit role refs).

### Where Codex under-claimed — GLM as-built now quantifies
1. **Role/state bypass — Codex: "components also consume raw system tokens directly." GLM: QUANTIFIED.** 515 token refs total; role tokens (`--role-*`) see single-digit usage; `--color-system-black` alone = 153×, `--color-system-white` = 118×. The 216 `color-mix(in oklab, …)` calls confirm components synthesize tints from primitives, not from role tokens. The role layer exists but is largely bypassed (or dead, per the malformed-CSS question above).
2. **`-contrast` adoption — Codex: "contrast partners exist." GLM: 10 of 13 are DEAD.** Only `gray-contrast` (button, segmented), `orange-contrast` (bob_app, admin), `green-contrast` (admin tools) are consumed. Within `dieter/components/` specifically, ONLY `gray-contrast` is used. The other 10 are defined, never referenced.
3. **Hex violations — Codex: "raw hex exists." GLM: classified.** 28 raw literals → only **3 genuine chrome violations** (2× `#f4f5f7` in `admin/src/css/dieter-previews.css:107,166`, 1× `rgba(12,16,24,0.28)` in `admin/src/css/layout.css:155`). The rest are color-picker parametric surfaces (6), design-tool seed defaults (9), the hue-rainbow gradient (8), and comparison literals (2). clickeen's chrome is 99% token-compliant.

### Findings Codex missed
4. **Gray naming discrepancy:** `--color-system-gray` (`#707075`) ≠ Apple `systemGray` (`#8E8E93`) — it's darker. Its `-contrast` (`#636366`) = Apple `systemGray2`. Apple `systemGray6` (`#E5E5EA`) is absent. `--color-system-gray-7` is referenced but undefined (ladder stops at gray-6).
5. **Ramp uniformity:** the 20/40/60/80/90 ladder is perceptually even through step 4 (OKLAB L ≈0.079/step blue, 0.090/step gray); step 5 compresses to ~half (asymptote at white). No dark-shade ramps exist — darkening is delegated to state engine or the single hand-set `-contrast` hex.
6. **`--role-surface` and `--role-surface-bg` are identical aliases** — two names for `#ffffff`, no differentiation between foreground surface and page background.

### GLM research additions
7. **M3's "on-X pairing" is the structural innovation clickeen lacks:** M3 guarantees contrast by construction (paired fill+content roles at complementary tones). clickeen relies on ad-hoc `color-mix` per component. (research §M3)
8. **OpenAI's `light-dark()` mechanism:** dark mode without a separate palette — one token resolves both themes. clickeen's current approach (static black/white state targets) can't do this without redefining the targets per theme. (research §OpenAI)
9. **"Primary = grayscale" divergence:** OpenAI's primary action is grayscale; M3's is brand-colored. clickeen currently has no "primary" role at all (components use `--color-system-blue` directly). Step-4 decision: what is clickeen's primary? (research §OpenAI, §M3)

### GLM flag for human
- The malformed-CSS question (§above) is the single most important item to resolve before any color work proceeds. If the semantic roles are dead CSS, the entire role abstraction is phantom, and the "bypass" finding isn't a consumption choice — it's a necessity (the roles don't exist at runtime). This changes the convergence decision significantly.

— end GLM addendum. Not converged; human reconciles 126B at step 4.
