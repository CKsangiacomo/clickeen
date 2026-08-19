# 126A — As-built audit: Accessibility (GLM, Phase-1 step 1)

Status: FROZEN POINT-IN-TIME PRE-EXECUTION AS-BUILT - code changed afterward; exact working-tree provenance may be unrecorded; no step-9 execution credit.

> GLM independent pass — 3 facets (focus + keyboard · ARIA + semantics · contrast + touch-target + motion + sr-only). Codex writes its own; **not converged** — the human reconciles at step 4. Every finding cited `file:line`. Contrast ratios computed with the WCAG 2.1 relative-luminance formula (AA body = 4.5:1, AA large = 3:1, AAA = 7:1/4.5:1). Current reality only — no recommendations, no convergence.

---

## Facet 1 — Focus + Keyboard

### Per-component focus + keyboard table

Legend — Focus: ✅ visible ring · ❌ suppressed (`outline:none`) · ➖ n/a. KB: keys with handlers; "native" = host default.

#### dieter/components/*
| Component | Focus CSS | tabindex | Keyboard |
|---|---|---|---|
| bulk-edit | `.diet-bulk-edit__input:focus` ✅ 2px ring `bulk-edit.css:119-121` | `-1` close/add `bulk-edit.ts:461,488,516` | Escape `:342`; outside-click `:373-375`; focus-in `:333` |
| button | none in `.ts` | conditional via template `button.html:1`,`button.spec.json:13` | none |
| choice-tiles | none | none | ArrowLeft/Right `choice-tiles.ts:70-78`; `aria-checked` `:89` |
| dropdown-actions | header `:focus-visible` ❌ `dropdown-actions.css:33-34`; `:76` ❌ | n/a | trigger.focus() `:172,178,226,250,257,267`; Escape delegated `dropdownToggle.ts:89-95` |
| dropdown-border | header ❌ `dropdown-border.css:37-38`; `:144` ❌; inner ✅ 2px `:261-262` | `-1` `dropdown-border.html:49,58` | Escape delegated `dropdownToggle.ts:89-95`; outside-click `:71-87` |
| dropdown-edit | header ❌ `dropdown-edit.css:37-38`; `:96` ❌ | `-1` `dropdown-edit.html:18,108` | Enter/Escape editor `dropdown-edit.ts:92-100`; focus editor `:13`, link `:377-378` |
| dropdown-fill | header ❌ `dropdown-fill.css:35-36`; `:144` ❌; gradient-stop ✅ 2px `:270-272,303-305` | `-1` `dropdown-fill.html:56,112,469,520` | Escape delegated `dropdownToggle.ts` |
| dropdown-fill-gradient / media-controller | (shared) / none | — | none; `aria-expanded` `media-controller.ts:43` |
| dropdown-shadow | header ❌ `dropdown-shadow.css:38-39`; `:136` ❌; inner ✅ 2px `:254-255` | `-1` `dropdown-shadow.html:54,63` | Escape delegated `dropdownToggle.ts:89-95` |
| dropdown-upload | header ❌ `dropdown-upload.css:35-36`; `:109` ❌ | `-1` `dropdown-upload.html:49,77,107` | Escape delegated `dropdownToggle.ts:89-95` |
| menuactions | none | none | none |
| object-manager | none | none | none |
| popaddlink | `:focus-within` hooks (no ring) `popaddlink.css:37,42` | none | Enter/Escape `popaddlink.ts:92-100` |
| repeater | none | none | none; `aria-pressed` `repeater.js:247` |
| segmented | none | `-1` buttons `segmented.html:6` | none (native radiogroup); `aria-pressed` `segmented.ts:6` |
| shared/dropdownToggle | none | none | **global Escape `:89-95`; global outside-click `:71-87`; `aria-expanded` `:37`** |
| slider | `:focus-visible` ✅ 2px `slider.css:71-73` | n/a | (native range) |
| tabs | none in `.ts` | roving `0` active `tabs.ts:9`, `-1` inactive `:11`; `aria-selected` `:7` | ArrowRight/Down, Left/Up `tabs.ts:37-39`; focus follows `:53`. **No Home/End** |
| textedit | `outline:none` ❌ `textedit.css:137` | none | Enter/Escape link input `textedit.ts:119-127`; editor focus `:167` |
| textfield | `:focus-within` hooks `textfield.css:48-49,54-55`; `:71` ❌ | none | Enter `textfield.ts:26-31`; focus on click `:16` |
| textrename | ❌ `textrename.css:46`; `:98` ❌ | none | Enter/Escape `textrename.ts:62-73`; focus+select `:91-92` |
| toggle | none | none | Enter `:8-13`; Space/Enter switch `:18-24` |
| valuefield | `:focus-within` hooks `valuefield.css:60,64`; `:78` ❌ | none | Enter `valuefield.ts:31-36`; focus on click `:20` |

#### roma/components/*
| Component | Focus | KB |
|---|---|---|
| assets-domain | none | **Modal `role=dialog aria-modal` `:428-429` — NO Escape, NO trap, NO outside-click** |
| pages-domain | none | **Modal `:942` — NO Escape, NO trap, NO outside-click** |
| roma-account-notice-modal | none | **Modal `:87` — NO Escape, NO trap** |
| widgets-domain | none | Rename Enter/Escape `:459-467`; **Modal `:593` — NO Escape, NO trap** |
| builder-domain | none | `beforeunload`/`popstate`/capture-click `:865-867`; `window.confirm` `:832`; iframe `:964` (no focus handoff) |
| widget-defaults-domain | none | click interceptor `:408-418` **mouse-only** |
| others (accept-invite, account-locale-settings, ai, billing, home, profile, team, team-member, usage, settings, roma-nav, roma-shell, roma-sign-out) | none | native only |

#### bob/components/*
| Component | Focus | KB |
|---|---|---|
| TdMenu | none | **`role="tablist"` `:53` but NO arrow-key handler** |
| UpsellPopup | none | **Escape `:23-29`; outside-click `:38`; autofocus close `:16-19`** |
| CopilotPane | none | Enter-to-send (no Shift) `:696-700` |
| ToolDrawer / Workspace | `tabIndex={-1}` segmented `ToolDrawer.tsx:230,256`; `Workspace.tsx:432,458` | none (native radio) |
| others | none | none |

#### admin/src/*
| Component | Focus | KB |
|---|---|---|
| main.ts | none | clicks only `:208,379-382,657,428,420`. **Token modal: NO Escape, NO Enter/Space on trigger** |
| css/layout.css | `.nav-link:focus-visible { outline: none }` ❌ `:127-128` | — |
| css/utilities.css | token-editor `:focus` ✅ 2px ring `:107-110` | — |

### Focus + keyboard gaps (file:line)
1. **Focus suppressed, no replacement:** `admin/css/layout.css:127-128` (nav links); `bob/app/bob_app.css:121,125-129` (instance-title input); every dropdown header `dropdown-{actions,border,edit,fill,shadow,upload}/*.css :focus-visible { outline:none }`; `textfield.css:71`, `textrename.css:46,98`, `textedit.css:137`, `valuefield.css:78` (bare `outline:none`). dropdown-actions & dropdown-edit define **no replacement ring anywhere**.
2. **Modals with no Escape / focus-trap / outside-click** (despite `role=dialog aria-modal`): `roma assets-domain.tsx:428`, `pages-domain.tsx:942`, `roma-account-notice-modal.tsx:87`, `widgets-domain.tsx:593`; `admin/src/main.ts:337-450` (token editor overlay).
3. **Click-only, keyboard-inaccessible:** `admin/src/main.ts:657` (token-edit trigger: `<div>`+click, no role/tabindex/Enter/Space); `widget-defaults-domain.tsx:408-418` (mouse-only interceptor); `bob/TdMenu.tsx:53` (`role=tablist` with no arrow keys — compare `dieter/tabs.ts:37-53` which does implement them).
4. **Roving/arrow gaps:** `dieter/tabs.ts` has no Home/End; `bob/ToolDrawer.tsx:230,256` + `Workspace.tsx:432,458` hardcode `tabIndex={-1}` (no roving); `choice-tiles.ts:70-78` ArrowLeft/Right only, no Home/End.
5. **No focus restoration on close:** dropdown-border/fill/shadow/upload/edit (except editor) don't call `trigger.focus()` on close (dropdown-actions does). All 4 roma modals + bob UpsellPopup don't restore focus to the invoking trigger.
6. **media-controller.ts** doesn't route through `dropdownToggle.ts` → no Escape, no outside-click.
7. **iframe focus:** `builder-domain.tsx:964-970` embeds Bob via iframe with no focus handoff across the frame boundary.

---

## Facet 2 — ARIA + Semantics

### Per-component ARIA inventory (counts + key attributes; all `file:line` in source)

**dieter/components/** — ARIA/`role=` density: `dropdown-fill.html` 133, `dropdown-border.html` 55, `dropdown-shadow.html` 54, `bulk-edit.ts` 20, `dropdown-upload.html` 18, `dropdown-actions.html` 11, `dropdown-edit.html` 6, `repeater.html` 5, `textedit.html` 4, `choice-tiles.html` 4, `tabs.ts` 3 (`aria-selected` `:7`; `label[role=tab]` `:30,32`), `toggle.html` 2, `textrename.html` 2, 1 each: valuefield, textfield, segmented, popover, popaddlink, button, agent-activity, + several `.ts`.

Key facts:
- `agent-activity.html:1` — `role="status" aria-live="polite"` (**only live region in dieter**).
- `bulk-edit.html:18` — `role="dialog" aria-modal="true" aria-label` (**only dieter modal with `aria-modal`**).
- `dropdown-edit.html:7`, `dropdown-upload.html:38`, `textedit.html:13` — `role="dialog"` **NO `aria-modal`**.
- Triggers: `textedit.html:2` uses native `<button>`; `dropdown-{edit,upload,actions,border,fill,shadow}` + `textrename` use `<div role="button">`.
- `textrename.html:2` — `role="button"` but **no `aria-haspopup`/`aria-expanded`** despite toggling.
- `popover.html` — trigger `<button>` has no `aria-haspopup`/`aria-expanded`; container has no `role="dialog"`/`role="tooltip"`.
- `menuactions.html` / `object-manager.html` — **no ARIA at all**; object-manager reorder/delete icon buttons (`:61,64,67`) have no `aria-label`.
- Switch pattern split: `toggle.html:9`, `dropdown-shadow.html:177`, `dropdown-border.html:172` use `aria-labelledby`; `repeater.html:41-42` uses `aria-label`.
- Radio/tile double-semantics: `choice-tiles.html:2,12-18` (hidden `<input type=radio>` + `<button role=radio aria-checked>`); `tabs.html:2` + `tabs.ts:6-7` (hidden radio + `role=tab` on a `<label>`, not a `<button>`); `segmented.html:1-6` (hidden radio + `aria-pressed` on button, not `role=radio`).
- `role="listbox"` swatches use `<button aria-pressed>` (toggle pattern), not `role="option"`/`aria-selected` — listbox-with-toggles mismatch (`dropdown-border/fill/shadow`).
- **No native `<dialog>` element anywhere.** All modals are `<div role="dialog">`.
- `aria-busy` used once only: `roma-sign-out-button.tsx:28`.

**roma/components/** — role=8 (4×`presentation` backdrops, 4×`dialog`), aria-*=~12, `<button>`=~57. Full landmarks (`<nav>` roma-nav:45, `<main>` roma-shell:39, `<aside>` :36, `<header>` :41) + heading hierarchy. **Roma never uses `role=tablist/listbox`, `aria-selected/expanded/haspopup/pressed/hidden/live`, or `role=status` — its 4 modals are its only ARIA surface. Roma has ZERO live regions** (loading/error states are static `<section>` text). `<iframe title="Bob Builder">` `builder-domain.tsx:968` is correctly titled. `aria-current="page"` `roma-nav.tsx:22` is the sole `aria-current`.

**bob/components/** — role=14, aria-*=~26, `<button>`=13. `UpsellPopup.tsx:41` is the only bob modal (`role=dialog aria-modal=true`); `TranslationsPanel.tsx:94` + `Workspace.tsx:396,406` `role=status`/`aria-live`; `Workspace.tsx:401`,`ToolDrawer.tsx:278,297`,`useTdMenuHydration.ts:76` `role=alert`. **Bob has no `<main>`/`<header>`/`<h1-6>`.** `TdMenu.tsx:53-65` = full tablist/tab/aria-selected/aria-orientation markup but no arrow-key handler.

**admin/src/** — `html/components/*` are rendered per-size mirrors of dieter templates (same ARIA set, expanded). Tools: `entitlements.html:251`, `llm-management.html:120` use `aria-live=polite`. `data/*.ts` render dieter markup by reference (no direct ARIA).

### ARIA inconsistencies (file:line)
- `aria-modal` inconsistent: bulk-edit has it; dropdown-edit/upload/textedit don't.
- Trigger element inconsistent for the same class: native `<button>` (textedit) vs `<div role=button>` (other dropdowns, textrename).
- Switch labeling: `aria-labelledby` (toggle, dropdown-shadow/border) vs `aria-label` (repeater).
- `role=tab` lands on a `<label>` (tabs.ts:6), not a `<button>`; segmented uses `aria-pressed` not `role=radio` (diverges from choice-tiles).
- Live regions: 1 in dieter (agent-activity), 5 in bob, **0 in roma**.
- Icon-only buttons unlabeled: object-manager `:61,64,67`, menuactions, conditional `button.html:1`.

---

## Facet 3 — Contrast + Touch-target + Motion + sr-only

### A. Color contrast (computed; AA body 4.5:1, large 3:1)
| # | Pair (text → bg) | Hexes | Ratio | AA body | Cite |
|---|---|---|---|---|---|
| 1 | `--color-text` → `--role-surface` | `#212121`→`#fff` | **16.03** | PASS | color-tokens.css:13,15 |
| 2 | `--color-text-secondary` → white | `#878787`→`#fff` | **4.04** | **FAIL** | :14; repeater.css:39, popover.css:41 |
| 3 | `.caption` → white | `#969696`→`#fff` | **2.84** | **FAIL** | typography.css:118,119 |
| 4 | `.overline` (gray) → white | `#707075`→`#fff` | **4.39** | **FAIL** (10px) | typography.css:126,127 |
| 5 | `.overline-small` → white | `#969696`→`#fff` | **2.84** | **FAIL** | typography.css:130,133 |
| 6 | primary btn white → blue | `#fff`→`#007aff` | **4.52** | PASS (barely) | button.css:146,147 |
| 7 | primary btn hover | `#fff`→`#0062cc` | **5.95** | PASS | button.css:149 |
| 8 | `line1` blue → white | `#007aff`→`#fff` | **4.52** | PASS | button.css:172,174 |
| 9 | `line2` gray-contrast → white | `#636366`→`#fff` | **5.41** | PASS | button.css:181,183 |
| 10 | toggle ON label black → white | `#212121`→`#fff` | 16.03 | PASS | toggle.css:113,114 |
| 11 | toggle OFF label (black@45%) | `#878787`→`#fff` | **4.04** | **FAIL** | toggle.css:76 |
| 12 | toggle knob white → green track | `#fff`→`#34c759` | **1.87** | n/a (decorative) | toggle.css:97,106 |
| 13 | segmented active blue → white | `#007aff`→`#fff` | 4.52 | PASS | segmented.css:41,211,219 |
| 14 | textfield placeholder (black@45%) | `#969696`→`#fff` | **2.84** | **FAIL** | textfield.css:78 |
| 15 | textfield disabled (black@40%) | `#a0a0a0`→`#fff` | **2.50** | **FAIL** | textfield.css:83 |
| 16 | textfield dark-mode black → gray-5 | `#212121`→`#c7c7cc` | 9.78 | PASS | textfield.css:146 |
| 17 | dropdown-fill invalid (orange) | `#ff9500`→`#fff` | **1.95** | **FAIL** | dropdown-fill.css:74 |
| 18 | dropdown-fill asset msg (orange) | `#ff9500`→`#fff` | **1.95** | **FAIL** | dropdown-fill.css:514 |
| 19 | dropdown-border invalid (orange) | `#ff9500`→`#fff` | **1.95** | **FAIL** | dropdown-border.css:75 |
| 20 | dropdown-fill gradient-stop-add label (gray-2) | `#808085`→`#fff` | **3.80** | **FAIL** | dropdown-fill.css:282 |
| 21 | prague `ck-badge` (black@25%) | `#bcbcbc`→`#fff` | **1.92** | **FAIL** | primitives.css:155,153 |
| 22 | prague primary btn white → pink | `#fff`→`#ff2d55` | **3.45** | **FAIL** (body) | primitives.css:70,71 |
| 23 | prague primary hover | `#fff`→`#c92546` | 4.95 | PASS | primitives.css:74 |
| 24 | admin error diff (red) | `#ff3b30`→`#fff` | **3.15** | **FAIL** | utilities.css:119 |
| 25 | admin success diff (green) | `#34c759`→`#fff` | **1.87** | **FAIL** | utilities.css:123 |

**The `-contrast` ramp is defined but UNUSED.** Every hue has a `-contrast` sibling (`red-contrast #bf4424` :30, `orange-contrast #bf7000` :38, `green-contrast #279543` :54, `blue-contrast #005cbf` :86…). Only `gray-contrast` is consumed (button `line2`, segmented inactive). Pairs #17-19, 22, 24-25 fail because the component used the base hue instead of its `-contrast` sibling (orange-contrast on white = 4.66 PASS; green-contrast = 4.42 ≈ borderline).

### B. Touch-target (`--min-touch-target: 2.75rem`/44px, foundation-tokens.css:77)
**`--min-touch-target` is referenced by ZERO dieter components — only prague `primitives.css` consumes it.** The control-size ladder caps at `--control-size-xl: 2rem` (32px) (foundation-tokens.css:32), so 44px is structurally unreachable from dieter tokens. Every `diet-*` interactive control (button xs-xl 16–32px, toggle 16–24px, tab 20–28px, segment 24–32px, slider thumb 10–14px, textfield/valuefield 20–28px, dropdown headers 24px, swatches 24–28px, repeater remove 20px) **fails 44px**. Only prague `ck-btn--md` (primitives.css:58, 44px) and `selector-element` (:178, 46px) honor it; prague `ck-btn--sm` (:51, 36px) explicitly overrides below.

### C. Reduced-motion (`@media (prefers-reduced-motion: reduce)`, foundation-tokens.css:99-106)
Global `*` guard zeroes animation/transition-duration + forces scroll-behavior:auto. Duplicated in admin `utilities.css:140-147` and the shadow-DOM variant. **Per-component explicit overrides:** toggle (toggle.css:127-129), tabs (tabs.css:98-100), segmented (segmented.css:259-263), valuefield (valuefield.css:138-142), textrename (textrename.css:128-133), textfield (textfield.css:139-141 — partial: targets `__field` but the real transition is on `__control/__inner` :39, so relies on the global guard). **No explicit override (rely on global guard):** button, popover, repeater, dropdown-fill swatches/stops. **Gap:** prague `primitives.css` ships transitions + NO reduced-motion block of its own — it depends on the consumer page having loaded the global guard.

### D. `.sr-only` (foundation-tokens.css:92-96)
Canonical 1px-clip pattern. **Three parallel "visually-hidden" implementations exist:** `.sr-only` (used for hidden radio/checkbox in tabs, toggle, segments — the core CSS-only state mechanism; concrete markup `textedit-dom.ts:59,64`), `.visually-hidden` (admin `utilities.css:1-11` — admin does not consume `.sr-only`), and inline reimplementations (`diet-segment__sr` segmented.css:246-256; dropdown-fill alpha-label dropdown-fill.css:634-640).

### E. As-built defects found during the audit (current-state breakage, not recommendations)
1. **`--color-surface` referenced but never defined** — `button.css:8,190,321` (`--btn-bg: var(--color-surface)`); only `--role-surface` exists (color-tokens.css:15). Default button bg resolves invalid/unset unless a consumer locally defines it.
2. **`--hspace-3`/`--hspace-2` referenced but never defined** — `tabs.css:50,59,64` (`--hspace-3`); `textfield.css:4`, `dropdown-fill.css:10`, `dropdown-border.css:11`, `dropdown-shadow.css:12` (`--hspace-2`). Token files define `--vertspace-*`/`--space-*`, no `--hspace-*`. They fall back to literals only because every usage includes a fallback.
3. **`--min-touch-target` (44px) dead in dieter** — defined, consumed by zero `diet-*` components; ladder caps at 32px.
4. **The `-contrast` WCAG ramp is dead** — defined for every hue, consumed only for gray; failing contrast pairs use the base hue the `-contrast` sibling was designed to fix.

— end GLM as-built, 126A. Independent pass; awaits Codex's and human convergence (step 4).
