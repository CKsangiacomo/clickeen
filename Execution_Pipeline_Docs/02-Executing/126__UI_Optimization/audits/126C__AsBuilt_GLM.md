# 126C — As-built audit: Iconography (GLM, Phase-1 step 1)

> GLM independent pass. Codex writes its own; **not converged** — human reconciles at step 4. Every finding cited `file:line`.

---

## 1. SVG source — 157 icons, SF-Symbols naming

**Location:** `dieter/icons/svg/` — **157 SVG files** (confirmed `ls | wc -l` = 157).

**Naming convention:** Apple SF-Symbols dot-notation. Samples: `square.and.arrow.up.svg`, `arrow.down.svg`, `arrow.left.svg`, `arrow.right.svg`, `arrow.counterclockwise.svg`, `arrow.down.document.svg`, `arrow.down.left.svg`, `arrow.down.right.svg`, `app.translucent.svg`, `arrow.trianglehead.2.counterclockwise.svg`.

## 2. Manifest — `dieter/icons/icons.json`

**Fields:** `version: "4.0"`, `precision: 2`, `fontSize: 28`, `symbols: { … }`.
**Symbol count:** 157 (confirmed `grep -c '"path"'` = 157). Matches SVG count (157 = 157).

**Per-symbol structure:** each symbol has a `regular` rendition containing:
- `path` — SVG path draw-command string (the icon geometry).
- `geometry` — `{ width: 28, height: 28, advanceWidth: <float>, bounds: { x1, y1, x2, y2 } }`.

**Format:** font-icon-style (fontSize, advanceWidth, bounds) — not a simple name→URL mapping.

## 3. Build pipeline — `dieter/scripts/build-icons.mjs`

**Process (lines 1–60):**
1. Reads all `.svg` from `dieter/icons/svg/`.
2. Each: **svgo** optimize (`npx --yes svgo -q -o …`); fallback copy if svgo fails (`:21–25`).
3. Name conversion (`toIconName`, `:27–29`): strip `.svg`, replace `_`/spaces → `-`, lowercase.
4. Writes optimized SVGs to `dieter/dist/icons/{name}.svg`.
5. Generates `dieter/dist/icons.d.ts` — `IconName` union + `IconEntry` + `registry`/`iconPath()` declarations.
6. Generates `dieter/dist/icons.js` — `registry` array + `iconPath(name)` function.

**Key facts:** `ROOT` = `dieter/` (`:12`). Fails hard if svg dir missing/empty (`:32–37`). Registry path prefix: `/dieter/icons/{name}` (`:41`). `IconName` union = all names, pipe-joined, sorted (`:43`).

**Not verified:** exact Tokyo-deployed path for `icons.d.ts`/`icons.js` — not found at `tokyo/product/dieter/icons/icons.d.ts`; may be at `tokyo/product/dieter/icons.d.ts` (dieter root).

## 4. `diet-icon` wrapper — `dieter/components/icon/icon.css`

**CSS-only.** No `.ts`, no `.html`, no `.spec.json`. NOT in `index.ts`.

**Size variants (`data-size`):**
| Variant | Token | Value |
|---|---|---|
| (default) | `--icon-size-20` | 1.25rem (20px) |
| `xxs` | `--icon-size-12` | 0.75rem (12px) |
| `xs` | `--icon-size-16` | 1rem (16px) |
| `sm` | `--icon-size-16` | 1rem (16px) |
| `md` | `--icon-size-16` | 1rem (16px) |
| `lg` | `--icon-size-16` | 1rem (16px) |
| `xl` | `--icon-size-20` | 1.25rem (20px) |
| `2xl` | `--icon-size-36` | 2.25rem (36px) |
| `3xl` | `--icon-size-40` | 2.5rem (40px) |

**Gap — size-scale degeneracy:** `xs`/`sm`/`md`/`lg` ALL resolve to `--icon-size-16` (16px). Four named sizes, one rendered value. Either intentional placeholder or a bug.

## 5. Icon size tokens — `dieter-foundation-tokens.css:65–72`

8 tokens: `--icon-size-12/16/20/24/28/32/36/40`. The wrapper consumes 5 of 8 (12, 16, 20, 36, 40). Tokens 24, 28, 32 are defined but unused by the wrapper.

## 6. `svg_new/` override — DOES NOT EXIST

Confirmed: `ls dieter/icons/svg_new/` → `No such file or directory`. Referenced conditionally in `build-dieter.js` but not on disk. Inactive.

## 7. Consumer inventory

**dieter/components/** — 18 files reference `diet-icon`/`data-icon` (all the dropdown/button/tile `.html` stencils + textedit-dom.ts + bulk-edit.ts).
**admin/src/** — 18 files (main.ts + generated component HTML + foundations/icons.html).
**bob/** — `TdMenu.tsx`, `lib/compiler/stencils.ts`.
**roma/** — **ZERO.** Roma does not use `diet-icon`.

## 8. Color rendering

SVG paths designed for `currentColor` fill (verified by `verify-svgs.js` failing non-`currentColor`). `diet-icon` does NOT set color — icons inherit from parent. Accessibility is consumer-dependent (some add `aria-hidden="true"` on decorative icons).

## 9. Honest gaps

- **Roma zero adoption** (consistent with parallel `.roma-*` system).
- **Size-scale degeneracy** (xs/sm/md/lg = 16px).
- **Generated `.d.ts` Tokyo path** unverified.
- **Icon accessibility** — no `aria-label`/`role="img"` in the wrapper; consumer-dependent.
- **No search/categorization metadata** — 157 icons, flat list, no tags.

— end GLM as-built, 126C.
