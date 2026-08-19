# 126L — As-built audit: DevStudio UI (GLM, Phase-1 step 1)

> GLM independent pass. **Not converged.** Evidence from session-wide ops/governance audits + admin/ greps.

## Reveal cockpit
- **Generated pages:** foundation (colors/icons/typography from token source) + component (23 spec-backed components from specs/stencils/CSS). Guards: throws on unresolved `{{...}}` stencils, no-page components.
- **Render scale:** diet-icon ~1256×, dropdown-fill ~519×, btn-ic ~269×, textfield ~129×, popover ~126×, toggle ~84×, segmented ~18× across generated HTML.
- **Hydrators:** `admin/src/main.ts` imports + calls hydrators (incl. orphaned `hydrateTextrename` at `:23,258`).
- **Registries:** `admin/src/data/dieterComponents.ts`, `admin/functions/_shared/dieter-tokens.js`, `admin/src/data/typography.generated.json`.
- **Preview CSS:** `admin/src/css/dieter-previews.css` (component preview wrappers — has 2 `#f4f5f7` hex violations).

## Governance (steer)
- **Token editor:** edits color (`--color-*` + hex) and typography (`--fs-*`/`--lh-*`) values via GitHub Contents API. Regex validation. Commit message `dieter(devstudio): ${token} ${value}`. **No actor attribution.**
- **PR-only verify:** `devstudio-verify.yml` runs on PRs, not on direct commits to main. Token edits go to main → skip PR verify.

## DevStudio chrome (dated)
- **Look:** flagged dated by earlier audit (iOS palette, no dark mode, dense cockpit tables, cramped 13px body). Out of scope to redesign — 126L's job is to keep reveal trustworthy, not redesign chrome.
- **Dead CSS:** ~100+ lines of `.stack-*`/`.grid-*`/`.anchor-list`/`.visually-hidden` utilities + `.component-masonry`/`.compiler-*`/`.bob-*` grid.

## Honest gaps
- Token editor lacks actor attribution (governance gap).
- Chrome redesign out of scope (design freeze).
- `hydrateTextrename` orphaned at `main.ts:23,258`.
- `dieter-previews.css` has 2 hex violations.

— end GLM as-built, 126L.
