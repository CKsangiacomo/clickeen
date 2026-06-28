# 126C - PRD: Iconography

Status: DIRECTIONAL - Phase 1 Step 2 Codex baseline.
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA).
Series order: 126C of 126A-126M.
KB doc: `documentation/engineering/UI/iconography.md`.

This PRD is a baseline/directional artifact only. It is filled from Codex Step 1
as-built evidence and Step 3 official-source research. It does not converge
Codex/GLM, does not select fixes, does not write doctrine, and does not
authorize runtime implementation.

## Step Inputs

- Step 1 Codex as-built: `audits/126C__AsBuilt_Codex.md`.
- Step 1 GLM as-built: `audits/126C__AsBuilt_GLM.md` when human compares.
- Step 3 Codex research: `research/126C_Research_Codex.md`.
- Step 3 GLM research: external GLM artifact when available.
- Current living doc: `documentation/engineering/UI/iconography.md`.
- Source icon authority: `dieter/icons/svg/*` and `dieter/icons/icons.json`.
- Generated runtime output: `tokyo/product/dieter/icons/**`.

## Role

126C owns the iconography baseline for Clickeen UI: source SVG set, manifest,
active build/copy path, presentation wrapper, naming, sizing, currentColor,
consumer adapters, accessibility semantics, missing-icon behavior, public
widget icon paths, and brand-vs-operational icon boundaries.

Iconography is an inner-doll domain. Icons are not tiny decoration pasted onto
screens; they are operational symbols that agents and humans rely on to identify
actions and states. If icon authority is unclear, every component can invent
its own meaning or failure mode.

## Current Reality Summary

Clickeen has a real icon source set and deployed icon substrate, but it does not
yet have one complete icon contract.

The strong current evidence:

- `dieter/icons/icons.json:1-5` declares manifest metadata.
- Current parse found 157 manifest symbols.
- Current parse found 157 source SVGs in `dieter/icons/svg`.
- Current parse found 157 Tokyo SVGs in `tokyo/product/dieter/icons/svg`.
- Current parse found no missing names between source SVG filenames and manifest
  symbols.
- Current source SVGs are fill-only `currentColor` in the inspected state.
- `scripts/build-dieter.js` is the active build path. It processes/verifies
  SVGs, copies `icons.json` and `icons/svg`, and asserts output.

The current multi-representation reality:

- Bob uses `tokyo/product/dieter/icons/icons.json` geometry through
  `bob/lib/icons.ts`.
- Admin/DevStudio uses raw SVG imports generated from `dieter/icons/svg`.
- Public widgets use CSS mask URLs, restricted allowlists, regex-valid Dieter
  icon names, and local inline SVGs depending on widget.
- `diet-icon` is CSS-only presentation, not a runtime component/hydrator.

The current weak evidence:

- Accessibility semantics are consumer-dependent.
- Missing icon behavior differs by consumer.
- DevStudio preview labels drift from `.diet-icon` CSS mapping.
- `build-icons.mjs` exists but is not the active product build path.
- Docs overstate the generated registry/hydrator story.

## Directional Product Reading

The 126C problem is not "replace the icons." The current 157-icon set has real
source parity and currentColor discipline. The problem is that icon authority,
rendering, and semantics are split across several paths.

For Clickeen this matters because:

- Agents operate structured UI. A missing or silent icon can hide an operation.
- Humans need icon-only controls to expose accessible action names.
- Dense builder and Roma UI need icons to clarify commands, not become unlabeled
  symbols.
- Public widgets and hosted agent surfaces need icon assets to load reliably
  under resource/CSP constraints.

## Scope For Later Human Convergence

This PRD scopes the iconography decision surface. It does not decide final law.

### Source And Manifest Authority

Current baseline:

- Source SVGs and `icons.json` are count/name aligned in the inspected state.
- Active build copies both to Tokyo.
- Count mismatch handling and name-parity enforcement are not equally strong
  across scripts.

Later convergence must decide:

- Which file owns icon truth: SVG directory, manifest, or both with required
  parity.
- Whether name parity must be hard-gated.
- How source mutation by SVG processing is allowed to work.

### Active Build Path

Current baseline:

- `scripts/build-dieter.js` is active.
- `dieter/scripts/build-icons.mjs` exists but no active product build output
  consumes it.
- Optional `icons/svg_new` override path is wired but inactive.

Later convergence must decide:

- Whether `build-icons.mjs` remains documentation-relevant.
- Whether optional override lanes are allowed and how they are authorized.
- How docs describe only live paths.

### Presentation Wrapper

Current baseline:

- `diet-icon` is CSS-only.
- Size tokens exist from 12 to 40.
- Current `.diet-icon` size labels do not map one-to-one to the token ladder.

Later convergence must decide:

- Whether `diet-icon` becomes a real component contract or stays presentation.
- Required size naming and mapping.
- How glyph size relates to component/hit-target size.

### Consumer APIs

Current baseline:

- Bob throws on missing icons.
- Admin skips unknown icons.
- Public widgets vary by allowlist, regex-only, and local inline SVGs.

Later convergence must decide:

- Required missing-icon behavior.
- Whether all consumers must use one registry or whether multiple delivery
  modes are acceptable.
- Whether widget-local SVGs are allowed outside Dieter.

### Accessibility Semantics

Current baseline:

- Source SVGs do not encode accessibility semantics.
- Admin forces decorative SVG semantics.
- Bob SVG strings are bare; wrappers often add `aria-hidden`.
- Icon-only controls usually need labels at the control level, but this is local.

Later convergence must decide:

- Decorative icon rule.
- Meaningful icon rule.
- Icon-only control labeling rule.
- Whether the icon API should encode semantics or leave them to the consumer.

### Color And Rendering Style

Current baseline:

- Source SVGs use `fill="currentColor"`.
- Bob emits inline currentColor SVGs.
- Public widget CSS masks use parent styling.
- Social Share uses local stroke SVGs outside Dieter.

Later convergence must decide:

- Whether fill-only currentColor is Clickeen's system icon style.
- Whether stroke local SVGs can remain outside Dieter.
- Whether selected/unselected icon states require paired variants.

### Brand Vs Operational Icons

Current baseline:

- Roma brand SVGs exist separately from Dieter icons.
- Dieter icons are operational symbols.

Later convergence must decide:

- Whether brand assets are outside 126C operational icon doctrine.
- How hosted agent UI should avoid injecting app logos where the host already
  provides app identity.

## Official Source Baseline

Step 3 Codex research identifies these non-binding external bars:

- Material 3 treats icon buttons as compact single-action controls with clear
  action labels and separate hit-target requirements.
- Material and Apple both anchor icons in coherent system sets, not ad hoc SVG
  art.
- Apple SF Symbols provides a platform-aligned symbol model with weights,
  scales, rendering modes, localization/direction behavior, and vector editing.
- OpenAI Apps SDK UI guidance expects icons to fit ChatGPT's host visual world,
  use system colors, support accessibility, and respect hosted resource/CSP
  constraints.

Research does not become Clickeen doctrine until Step 4 human convergence.

## Known Gaps Only

These are baseline gaps, not selected fixes:

1. Multiple active icon representations exist.
2. `diet-icon` is CSS-only and not an exported component/hydrator.
3. DevStudio icon preview labels drift from `.diet-icon` CSS sizing.
4. Missing-icon behavior differs by consumer.
5. Accessibility semantics are local/consumer-owned.
6. Active build docs overstate `build-icons.mjs`.
7. `svg_new` override path is wired but inactive and potentially source-mutating.
8. Public widgets include local icon paths outside one central Dieter contract.
9. Count/name parity is currently good, but hard gate evidence is uneven.
10. Existing docs include stale 126 mapping and hydrator/build claims.

## Out Of Scope For This Baseline

- Runtime code changes.
- Product data changes.
- Replacing the icon set.
- New icon library selection.
- Accessibility implementation.
- Build pipeline changes.
- Step 4 convergence.
- Step 5 doctrine.
- Step 6 gap audit against doctrine.
- Step 7 executable implementation PRD.
- Step 9 execution.

## Compliance With Clickeen Architecture And Product Law

- Lean and agent-operable: iconography is treated as named source/manifest
  truth, not per-screen decoration.
- Source authority separation: code/source owns current icon reality, official
  sources own external reference, human owns convergence.
- No reinterpretation: this PRD does not turn iconography into a redesign or new
  icon-library pass.
- No masquerade: it separates active build paths from inactive/generated claims.
- No silent success: current count parity is not overstated as complete contract
  proof.

## Done For Phase 1 Step 2

126C Step 2 is done when this PRD:

- Points to Step 1 Codex audit in `audits/126C__AsBuilt_Codex.md`.
- Points to Step 3 Codex research in `research/126C_Research_Codex.md`.
- States current reality and known gaps only.
- Avoids Step 4+ convergence or fixes.
- Keeps iconography scoped to Dieter source/manifest authority and consumers by
  reference.

## GLM Addendum — Phase 1 Step 2 (feedback on Codex baseline)

GLM reviewed Codex's baseline against the GLM step-1 as-built (`audits/126C__AsBuilt_GLM.md`) and step-3 research (`research/126C_Research_GLM.md`). Critique only — no merge, no convergence.

### Codex gets right
- The "157-SVG source set, generated/source registry, Tokyo deploy copy, currentColor rendering, tokenized sizing" summary — confirmed by GLM.
- The "diet-icon exists as CSS presentation, not as a typed exported component" finding — confirmed (no .ts, not in index.ts).
- The "inactive svg_new override lane" — confirmed DOES NOT EXIST on disk.

### GLM adds (verified, file:line)
1. **Size-scale degeneracy — likely missed by Codex.** `diet-icon` data-size variants xs/sm/md/lg ALL resolve to `--icon-size-16` (16px). 4 named sizes, 1 rendered value (`icon.css` lines for each variant). This is the opposite of both M3 (optical-size axis adapts detail per size) and SF Symbols (each scale is redrawn for optical balance).
2. **3 of 8 icon-size tokens unused.** `--icon-size-24/28/32` (`foundation-tokens.css:68-70`) are defined but the wrapper consumes only 12/16/20/36/40. Dead tokens.
3. **Roma ZERO adoption — quantified.** Grep for `diet-icon`/`data-icon` across roma/ returns 0 files. Consistent with Roma's parallel `.roma-*` system.
4. **The SF-Symbols port identity — research insight.** clickeen's manifest (`icons.json`) IS the SF Symbols format: `fontSize: 28` (the SF Symbols Medium-scale grid), dot-notation naming, path-data + geometry. This is a direct, deliberate Apple SF Symbols port, not a custom icon system. (research §Apple HIG)
5. **Generated `.d.ts` Tokyo path unverified.** Not found at `tokyo/product/dieter/icons/icons.d.ts` — may be at `tokyo/product/dieter/icons.d.ts` (dieter root). The build writes to `dieter/dist/`; the sync path needs confirmation.
6. **Icon accessibility not enforced.** The wrapper doesn't set `aria-label`/`role="img"`/`aria-hidden`. Consumer-dependent — some components add `aria-hidden="true"` on decorative icons, some don't. All three primaries require labels on informational icons. (research §all)

### GLM flag for human
- The size-scale degeneracy (#1) is the most important icon-specific finding: it's not just "icons are 16px" — it's that the NAMED SIZE API lies (xs/sm/md/lg suggest 4 different sizes but render identical). Step-4 decision: either differentiate the sizes (use the unused 24/28/32 tokens) or collapse the API (remove the dead variant names).

— end GLM addendum. Not converged; human reconciles 126C at step 4.
