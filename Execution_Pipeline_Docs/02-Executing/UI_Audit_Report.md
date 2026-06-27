# UI Audit Report

**Purpose:** the reference for the 4-phase UI work (Dieter → Components → DevStudio → Roma). Built on the two real PRDs (`UI_PRD__Devstudio_as_a_trustworthy_Reveal_cockpit_DieterComponents.md`, `UI_PRD__Roma_UI_Refactor.md`). Each phase records **Preserve** (great, don't touch), **Fix** (real issues), **Verify** (needs a closer look). Done before execution.
**Date:** June 25, 2026.

---

## Phase 1 — Dieter (tokens)  ✅ audited

**Verdict: the token system is fundamentally sound — PRESERVE it. Do not rewrite.**

Read all four token files (`dieter-color-tokens.css`, `dieter-foundation-tokens.css`, `dieter-typography.css`, `tokens.css`). The architecture is well-built:
- **Layering is correct.** Primitives carry concrete values (raw hex only on `--color-system-*` + pure white/black). Semantic tokens (`--color-text`, `--role-surface`, `--role-border`, `--focus-ring-color`) compose via `var()`/`color-mix`. State helpers (`--state-{hover,pressed,muted,inactive}-{target,mix}`) drive depth.
- **Scales are complete** — spacing (`--space-0…10`, 4px grid), vertical rhythm (`--vertspace-*`), control sizing/radii/gaps, icon sizes, font sizes (`--fs-10…32` + fluid display), motion, elevation, line-height, the full color palette with `-contrast`/`-1…-5` ramps + gray step ramps.
- `--radius-3`/`--radius-4` are **intentional aliases** (documented "surface radius aliases used by generated previews") — not ghosts.

**Fix (real, small — at the consumer references, NOT the tokens):**
1. **`--color-surface`** — referenced in `dieter/components/button/button.css:8,190,321` (`--btn-bg: var(--color-surface)`) but **not defined**. Almost certainly meant `--role-surface` (which is defined). Repoint the references.
2. **`--color-bg`** — referenced in `admin/src/css/layout.css:185` (`background: var(--color-bg)`, **no fallback**) but **not defined**. Shell background is effectively unset. Repoint to `--role-surface-bg` (or define it).
3. **`--radius-2`** — referenced in `dieter/components/bulk-edit/bulk-edit.css:96,112` (`border-radius: var(--radius-2)`, **no fallback**) but not defined (aliases are `--radius-3/4`). bulk-edit corners silently render at 0. Repoint to `--radius-3`.
4. **`--hspace-1/2/3/4`** — referenced across ~8 components (dropdown-actions/border/shadow/upload, textedit, tabs, dieter-previews) with fallbacks, but **not a defined scale** (defined scales are `--space-*`/`--vertspace-*`). Naming left over from an incomplete migration; `tabs.css:49` even documents `--hspace-3` as if it existed. Migrate the references to the real scale.

**Verify (referenced with fallbacks, low impact — consistency only):** `--control-icon-xs/sm`, `--control-letter-spacing`, `--font-body-xsmall`, `--icon-glyph-ratio*`, `--state-muted-opacity`, `--easing-standard`, `--shadow-lg`. All render via their fallbacks; decide define-vs-remove per case.

**Method note (honest):** an automated `var()`-vs-definition diff was run and is **noisy** — it missed real definitions (e.g. `--focus-ring-color` is defined at `dieter-color-tokens.css:18`) and flagged runtime-set JS custom properties (`--picker-hue`, `--valuefield-ch`, `--workspace-canvas-*`, `--stop-color`) and a doc-comment example (`--your-token`) as false positives. The Fix list above was confirmed by reading the actual token file, not trusted to the diff.

**Preserve:** the token architecture — layering, scale design, color-mix ramp system, semantic/primitive split.

---

## Phase 2 — Components  ⏳ pending

25 components on disk (atoms, inputs, choosers, dropdowns, composites, activity displays). `registry.json` was dead cruft (already removed). Inventory of names done; **but I do not yet understand each component's real role in the product** (I wrongly called `repeater`/`object-manager` an overlap — they're not). Before auditing, I must learn what each is actually for (trace real usage). Known items so far: `textrename` is dead (removing it must also delete `admin/src/main.ts:23,258`); `command-activity` has no stencil (broken); `dropdown-border` has inline hex + inline style + inline handler. The rest must be opened one by one.

---

## Phase 3 — DevStudio  ✅ audited (3 lenses)

**Preserve:** the generation plumbing works — foundation pages are generated from source, the component generator has real guards (throws on unresolved `{{...}}` and on a no-page component), the deploy chain (`build:dieter` → R2) is real. The shell's BEM naming + attribute-state selectors are consistent. Don't rebuild the generation machinery.

**Fix:**
- **Look (dated):** verbatim Apple iOS palette; **no dark mode** anywhere; cockpit screens are dense 2010-style HTML tables (`entitlements.html`, `llm-management.html`); no skeletons, no motion (one sidebar transition only); cramped 13px body; flat surfaces. Modernize — **stay deliberately flat; shadows only on modals/popovers/menus, never on cards.**
- **CSS code:** ~100+ lines of dead subsystems (`.stack-*`/`.grid-*`/`.anchor-list`/`.visually-hidden` utilities; `.component-masonry`/`.compiler-*`/`.bob-*` grid); two pages bypass shared CSS with 245- and 114-line embedded `<style>` blocks; magic numbers (`#f4f5f7`, `280px`, `32px`); inline-style boilerplate ×43 baked into `componentRenderer.ts:153,227`.
- **Ops:** governance commits have **no actor attribution**; go **straight to `main`** skipping the governance/lint gates (those run on PRs only); color validation is regex-only; client token cache goes stale across operators; R2 sync is fire-and-forget (no rollback, no orphan cleanup); `build-dieter` silently overwrites committed source SVGs.

---

## Phase 4 — Roma  ⏳ pending (baseline verified)

**Baseline (verified):** Roma uses 0 Dieter form components; built its own parallel 762-line `.roma-*` system in `roma/app/roma.css`; 5 monolith domain files (pages 1106, builder 976, widget-defaults 718, widgets 527, assets 488); ~18 hardcoded inline-px values; leaked dev/stub copy. Tokens in `roma.css` are healthy (0 hex / 140 `var()`). Detailed preserve-vs-fix still to do.
