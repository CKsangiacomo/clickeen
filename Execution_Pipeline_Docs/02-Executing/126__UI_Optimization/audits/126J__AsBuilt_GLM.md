# 126J — As-built audit: Surfaces (GLM, Phase-1 step 1)

> GLM independent pass. **Not converged.** Verified via `grep` + session-wide inventories.

---

## Bob — the bar (full consumer)
- **CSS:** loads tokens.css + 6 component CSS from `/dieter` CDN in `layout.tsx`.
- **Proxy:** `bob/app/dieter/[...path]/route.ts` — edge route proxying Tokyo static Dieter artifacts.
- **Compile:** `bob/lib/compiler/*` reads `/dieter/manifest.json` + stencils → compiles widget CSS/JS bundles.
- **Components per pane:** ToolDrawer (object-manager, segmented, repeater, bulk-edit, dropdown-edit), Workspace (button, segmented), TopDrawer/CopilotPane (btn-txt), TranslationsPanel (agent-activity, textfield).
- **Icons:** `bob/lib/icons.ts` imports `tokyo/product/dieter/icons/icons.json`.

## DevStudio (admin/) — reveal + governance
- **Render:** 23 generated component HTML pages (`admin/src/html/components/*`); components rendered from CDN at scale (diet-icon ~1256×, dropdown-fill ~519×, etc.).
- **Generate:** foundation pages (colors/icons/typography) from token source; component pages with guards (throws on unresolved stencils/no-page).
- **Registry:** `admin/src/data/dieterComponents.ts`, `admin/functions/_shared/dieter-tokens.js`.
- **Own chrome:** dated (per the audit — flagged but out of scope for 126J).

## Roma — convergence target (tokens adopted, components absent)
- **Tokens:** loads tokens.css (`roma/app/layout.tsx`); `roma/app/roma.css` = 762 lines, 0 hex literals, ~140 `var()` uses. **Token-healthy.**
- **Components:** `diet-btn-txt` ~160× + 4 strays (diet-btn-ic, diet-textedit, diet-dropdown-edit, diet-dropdown-actions, diet-choice-tiles). `diet-textfield/toggle/segmented/popover` = **0**.
- **Parallel system:** ~48 `.roma-*`/`.rd-*` classes in `roma/app/roma.css` (762 lines) across all 14 domain screens.
- **14 domain screens:** `roma/components/*-domain.tsx` (home, widgets, pages, assets, builder, team, team-member, billing, usage, settings, profile, ai, widget-defaults, accept-invite).
- **5 monoliths:** pages-domain.tsx (1,106 lines), builder-domain.tsx (976), widget-defaults-domain.tsx (718), widgets-domain.tsx (527), assets-domain.tsx (488).

## Honest gaps
- Roma consumption counts are a 2026-06-27 snapshot — drift as code moves.
- DevStudio showcase counts not re-counted this pass (from earlier inventory).
- Bob consumption not re-counted (from earlier inventory).

— end GLM as-built, 126J.
