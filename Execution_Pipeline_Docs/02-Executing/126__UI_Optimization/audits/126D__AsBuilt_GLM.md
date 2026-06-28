# 126D — As-built audit: Typography (GLM, Phase-1 step 1)

> GLM independent pass. Codex writes its own; **not converged**. Source: `dieter/tokens/dieter-typography.css` (134 lines) read in full.

---

## 1. Font families (`:3–4`)

| Token | Stack |
|---|---|
| `--font-ui` | `"Inter Tight", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif` |
| `--font-mono` | `"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace` |

## 2. Size scale (`:12–22`) — 11 px-named tokens

`--fs-10` (0.625rem) through `--fs-32` (2rem). Gaps at 17/19/21-23/25-31. Selective, not linear.

## 3. Fluid display (`:25–27`)

`--fs-fluid-display-1/2/3` via `clamp()`: 36→60px, 30→48px, 24→40px. No breakpoint system.

## 4. Line-heights (`:29–32`)

`--lh-tight` (1.15), `--lh-normal` (1.4), `--lh-loose` (1.5), `--lh-body` (1.5), `--lh-body-ui` (1.35). Note: `--lh-body` = `--lh-loose` = 1.5 (duplicate).

## 5. Utility classes (26 selectors, `:35–134`)

- **Display** (`.display-1/2/3`): 600 weight, fluid, `color: inherit`.
- **Body** (9 variants `.body-xxs`→`.body-website-xlarge`): 400 weight, `--lh-body-ui`.
- **Headings** (`h1–h6`): 700/600/600/500/500/500 weight, `--lh-tight`, `color: inherit`.
- **Labels** (7 variants): 500 weight, **`color: var(--color-system-black)`** hardcoded (`:110–116`).
- **Captions** (2): 500 weight, **`color: color-mix(in oklab, var(--color-system-black), transparent 55%)`** (`:118–119`).
- **Overlines** (2): 700/600 weight, uppercase, **`color: var(--color-system-gray)`** / color-mix (`:122–134`).

## 6. Findings

### Critical — color seam (126B boundary)
Labels, captions, and overlines **hardcode color** in typography utility classes (`:110–134`). If dark mode is added (126B), these break: black text on dark background. Typography should own type mechanics (family/size/weight/leading), not color semantics.

### Token-level findings
- **No letter-spacing token** — values inlined (`-0.02em`, `-0.01em`, `0.08em`). No `--ls-*`.
- **No weight token** — inlined (400/500/600/700). No `--fw-*`.
- **`--fs-12` defined but unused** by utility classes.
- **`--fs-body` = `--fs-16`** and **`--fs-ui` = `--fs-15`** — semantic aliases duplicating px-named tokens.
- **Redundant class defs:** `.body-xl` at `:60` AND `:68`; `.body-m` at `:58` AND `:69`.
- **Widget typography** (`CKTypography.applyTypography`) NOT verified this pass — separate runtime pipeline per Codex.

## 7. Honest gaps
- Widget type system not audited.
- Token consumer usage not grepped this pass.
- Text-resize behavior not tested.

— end GLM as-built, 126D.
