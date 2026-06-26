# DevStudio × Dieter — Deep Sanity Pass Findings (interim)

**Date:** June 25, 2026
**Scope:** Independent read-only sanity pass across **both** DevStudio and Dieter, run *before* executing `UI_PRD__Devstudio_as_a_trustworthy_Reveal_cockpit_DieterComponents.md`. Purpose: verify the PRD's baseline claims against real code, because DevStudio's whole value is "reveal Dieter truth, never masquerade" — so the foundation must be trusted before steering.
**Status:** INTERIM — Dieter source + DevStudio foundation-page derivation + deploy chain + inline-px + Roma numbers verified; a few items still open (listed §4).

## 0. Headline

**The DevStudio PRD's two concrete "fix" steps are based on a wrong audit. Do NOT execute Steps 1 and 2 as written.** Two of two spot-checks of the PRD's §2 "current state" were factually wrong. The PRD's *diagnostic* claims (deploy chain real, inline-px drift) hold, and its *derivation* thesis (foundation pages generated from source) holds — but its *gap list* cannot be trusted and must be re-derived from code.

This is exactly why the sanity pass comes first.

## 1. REFUTED PRD claims (do not execute)

### 1a. `--radius-4` is NOT a ghost token — PRD Step 1 would cause a visual regression
PRD claim: *"`--radius-4` is referenced on the colors page but never defined… chips render with no border-radius today. Fix: replace with `--control-radius-md`."*

**False on every count.** Evidence:
- `dieter/tokens/dieter-foundation-tokens.css:60-62` — `--radius-3`/`--radius-4` are **deliberate aliases**, with the comment *"Surface radius aliases used by generated DevStudio/Dieter previews."* `--radius-4 = var(--control-radius-lg)` (0.5rem).
- Used correctly in 6 admin CSS files (`utilities.css`, `layout.css`, `dieter-previews.css`), the page generator (`generate-foundation-pages.mjs:104,113`), the **generated** `colors.html`, and 3 real Dieter components (`popover.css:42`, `object-manager.css:35`, `bulk-edit.css:30`).
- Chips therefore render at `--control-radius-lg` (0.5rem) — **not** "no border-radius."

**Harm:** the PRD's Step 1 "fix" (`→ --control-radius-md`, 0.375rem) would *shrink* the radius — a visual change that violates the PRD's own design-freeze mandate. **Delete Step 1.** There is nothing to fix.

### 1b. `textrename` deletion plan is incomplete — PRD Step 2 breaks the admin build
PRD claim: *"`textrename` is dead — no consumer imports it. Delete the component, registry entry, export, built output, Overview row."*

**Partly false and incomplete.** Evidence:
- `admin/src/main.ts:23` imports `hydrateTextrename`; `:258` calls `hydrateTextrename(scope)`. So a consumer **does** import and invoke it — the "no consumer" rationale is wrong.
- BUT `rg "diet-textrename" admin/src` returns **no markup** → the hydrate call is orphaned (queries `.diet-textrename` elements that don't exist). So the component *is* effectively unused and removable.
- **The PRD's Step 2 omits `admin/src/main.ts:23,258`.** Delete only what the PRD lists and the admin bundle breaks on a dangling `hydrateTextrename` import.

**Fix:** Step 2 must also remove the import (`admin/src/main.ts:23`) and the hydrate call (`:258`). Then it's safe.

## 2. CONFIRMED PRD claims

- **Deploy chain is real.** `.github/workflows/cloud-dev-workers.yml:195` runs `pnpm build:dieter`; `:199` runs `tokyo-r2-deploy-sync.mjs --remote`; gated on `tokyo/product/dieter/` changes (`:128`). *(Open sub-item: confirm the exact source trigger — whether a `dieter/tokens/**` commit fires it directly, or only downstream `tokyo/product/dieter/` writes. Read `on:`/`paths:` to close.)*
- **Inline-px drift is real.** ~18 hardcoded-px inline styles in Roma TSX: `accept-invite-domain.tsx` `padding:'32px'` ×4; `team-member-domain.tsx` / `team-domain.tsx` `gap:'12px'` ×several; `profile-domain.tsx` `'8px'`/`'12px'`; `login/page.tsx` `18`/`'6px 0 0'`. PRD's "Roma ~16" is accurate. (These are the DevStudio Step 3 tokenization targets.)
- **Foundation-page derivation is faithful** (the core "reveal, never masquerade" thesis holds for these surfaces). `generate-foundation-pages.mjs` reads `dieter-color-tokens.css` + `icons.json` and writes `colors/icons/typography.html` via async `fs.writeFile` with a `<!-- Generated… Do not edit directly. -->` header. `data-governance-count` attributes carry real derived counts.
- **Roma PRD baseline numbers hold.** `roma/app/roma.css` = 762 lines (exact). Monoliths: `pages-domain.tsx` 1106, `widget-defaults-domain.tsx` 718, `widgets-domain.tsx` 527, `assets-domain.tsx` 488 — all match; `builder-domain.tsx` is now **976** (PRD said 869; +107 from uncommitted edits in the tree). Dieter component adoption in Roma = **0** (`diet-textfield/toggle/segmented/popover/button` absent).

## 3. New drift the PRDs missed

- **Dieter components using `--radius-4`** (`popover`, `object-manager`, `bulk-edit`) — relevant context the DevStudio PRD's "kill `--radius-4`" step completely overlooked; those components depend on the alias.
- **`builder-domain.tsx` has grown to 976 lines** (uncommitted) — the Roma PRD's monolith baseline is already stale by 107 lines; re-count before executing Step 4.

## 4. Open items (remaining pass)

1. **Component-page generator guards** — `generate-component-pages.ts`: verify the PRD's claim it throws on unresolved `{{...}}` and on a component that renders no page. (Foundation generator verified; component generator not yet.)
2. **Systematic ghost-token diff** — `--radius-4` is confirmed NOT a ghost and foundation tokens are intentional/commented; a full `var()`↔definition diff across all token files (`dieter-color-tokens.css`, typography, `tokens.css`) + all consumers is still needed to rule out other ghosts.
3. **Exact counts** — icons "157" and typography "33 roles": derive from `icons.json` + `typography.generated.json` to confirm.
4. **Dead-component sweep** — beyond `textrename`: cross-check `registry.json` vs actual consumers.
5. **Masquerade backstop** — does CI/build re-run the generators and fail on drift (hand-edited "generated" files)? The "Do not edit directly" header is a convention, not enforcement. Confirm whether anything catches it.
6. **Frozen visual baseline** — `PRD__DevStudio_Cloudflare_Migration.md` Appendix A hash-frozen pages: intact, or drifted since?

## 5. Recommendation

- **Strike DevStudio PRD Step 1** (no-op at best, visual regression at worst).
- **Amend Step 2** to include `admin/src/main.ts:23,258` before any deletion.
- Re-derive the PRD's gap list from this pass, not from the PRD's §2 audit.
- Keep Steps 3–5 (inline-px tokenization, loop verification, docs) — those diagnoses are confirmed.
- Then proceed to the Roma UI refactor (its baseline numbers verified; safe to plan against).
