# 126I — As-built audit: Components (GLM, Phase-1 step 1)

> GLM independent pass. **Not converged.** Verified via `ls`, `grep`, and earlier session-wide component inventories.

---

## Component inventory — 27 directories

| Group | Component | Files | Hydration | Spec | Status |
|---|---|---|---|---|---|
| atoms | button | css/html/spec/ts | `hydrateButton` (index.ts:11) | ✅ | active |
| atoms | icon | css only | — (CSS-only) | ❌ | active (presentation wrapper) |
| atoms | tabs | css/html/spec/ts | `hydrateTabs` (index.ts:14) | ✅ | active |
| atoms | segmented | css/html/spec/ts | `hydrateSegmented` (index.ts:15) | ✅ | active |
| atoms | toggle | css/html/spec/ts | `hydrateToggle` (NOT in index.ts) | ✅ | active (export gap) |
| atoms | slider | css/html/spec | — (no .ts) | ✅ | active (native range) |
| inputs | textfield | css/html/spec/ts | `hydrateTextfield` (index.ts:9) | ✅ | active |
| inputs | valuefield | css/html/spec/ts | `hydrateValuefield` (index.ts:10) | ✅ | active |
| inputs | textedit | css/html/spec/ts (+6 modules) | `hydrateTextedit` (index.ts:2) | ✅ | active (largest, 7 .ts) |
| inputs | textrename | css/html/ts | `hydrateTextrename` (index.ts:18) | ❌ MISSING | active (spec gap) |
| choosers | choice-tiles | css/html/spec/ts | `hydrateChoiceTiles` (index.ts:17) | ✅ | active |
| choosers | object-manager | css/html/spec/**js** | — (hand-written IIFE, NOT in index.ts) | ✅ | active (runtime via manifest) |
| choosers | repeater | css/html/spec/**js** | — (hand-written IIFE, NOT in index.ts) | ✅ | active (runtime via manifest) |
| choosers | bulk-edit | css/html/spec/ts | `hydrateBulkEdit` (index.ts:12) | ✅ | active |
| dropdowns | dropdown-fill | css/html/spec/ts (+6 modules) | `hydrateDropdownFill` (index.ts:4) | ✅ | active (largest dropdown) |
| dropdowns | dropdown-actions | css/html/spec/ts | `hydrateDropdownActions` (index.ts:3) | ✅ | active |
| dropdowns | dropdown-border | css/html/spec/ts | `hydrateDropdownBorder` (index.ts:5) | ✅ | active |
| dropdowns | dropdown-shadow | css/html/spec/ts | `hydrateDropdownShadow` (index.ts:6) | ✅ | active |
| dropdowns | dropdown-upload | css/html/spec/ts | `hydrateDropdownUpload` (index.ts:7) | ✅ | active |
| dropdowns | dropdown-edit | css/html/spec/ts | `hydrateDropdownEdit` (index.ts:8) | ✅ | active |
| dropdowns | menuactions | css/html/spec/ts | `hydrateMenuactions` (index.ts:13) | ✅ | active |
| dropdowns | popaddlink | css/html/spec/ts | `hydratePopAddLink` (index.ts:16) | ✅ | active |
| composites | popover | css/html/spec | — (CSS/HTML only, no .ts) | ✅ | active (container) |
| activity | agent-activity | css/html/spec | — (CSS/HTML only, no .ts) | ✅ | active |
| activity | command-activity | **EMPTY DIR** | — | — | **DEAD** (zero refs) |
| other | shared/ | 3 helper .ts | — (not rendered) | — | utility (account-asset-resolve, account-assets, dropdownToggle) |

**Counts:** 27 dirs. ~24 spec-backed. ~20 TS-exported (index.ts). 2 hand-written JS IIFEs. 3 CSS-only. 1 dead. 1 missing spec. 1 not exported (toggle).

## Contract shapes (4 patterns)
1. **Spec + HTML + CSS + TS** — the full pattern (button, textfield, dropdown-*, etc.). Governed by DevStudio + hydrated via index.ts.
2. **Spec + HTML + CSS + hand-written JS** (object-manager, repeater). Governed by DevStudio showcase but NOT TS-exported — hydrates via manifest runtime media (window.Dieter).
3. **CSS-only** (icon, popover, agent-activity). Not TS-exported, not hydrated (presentation or CSS-driven).
4. **Spec + HTML + CSS + TS without spec** (textrename). Ships + hydrates but misses DevStudio spec governance.

## Component-local tokens (good pattern)
- `--seg-*` (segmented), `--btn-*` (button), `--tog-*` (toggle), `--ma-*` (menuactions). Each component namespaces its internal tokens. Preserves the by-reference principle at the component level.

## Known drift
- `dropdown-fill.css:603-610` — raw hex hue-rainbow (intrinsic to color picker).
- `textedit.css:167` — raw rgba fallback for `--shadow-floating`.
- Hardcoded modal/popover widths (object-manager 320/520px, bulk-edit 980/860px, popaddlink 360px, popover 320px).
- Dropdown stencils carry inline `style="--value…"` and inline `oninput="…"` (behavior-in-markup).

## Consumption
- **Bob:** full consumer — ToolDrawer (composites: repeater, object-manager, bulk-edit, dropdown-edit), Workspace (button, segmented), TranslationsPanel (agent-activity, textfield). Plus compiler reads manifest + stencils.
- **Roma:** **ZERO** Dieter form components consumed (diet-textfield/toggle/segmented/popover absent). Only `diet-btn-txt` (~160×) + 4 strays. Runs parallel `.roma-*` system.
- **Admin/DevStudio:** renders all spec-backed components from CDN in generated showcase pages.

## Honest gaps
- `textrename` dead weight (missing spec, orphaned hydrate at admin/src/main.ts:23,258).
- `command-activity` empty dir (zero refs).
- `toggle` has .ts but not exported from index.ts (export gap).
- `object-manager` vs `repeater` distinction not fully documented (both in tool drawer).
- No shared Modal/DataTable/EmptyState primitive — each screen improvises.

— end GLM as-built, 126I.
