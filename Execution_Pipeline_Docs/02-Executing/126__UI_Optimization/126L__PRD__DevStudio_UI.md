# 126L - PRD: DevStudio UI

Status: CODEX BASELINE - Phase 1 step 2.
Parent: `126__PRD__UI_Optimization_Program.md`.
Audit input: `audits/126L__AsBuilt_Codex.md`.
Service doc: `documentation/services/devstudio.md`.

This is Codex baseline only. It is not final doctrine, does not converge with
GLM, does not select fixes, and does not run step 4+.

## Role

126L is the DevStudio UI screen-refactor planning domain. DevStudio is the
human cockpit for the AI-operated company and the reveal/governance surface for
Dieter and related source-controlled policy surfaces.

The current role is:

- reveal source-controlled truth;
- steer only through named validated Pages Functions;
- keep Dieter/source truth visible rather than dressed up;
- remain separate from Roma, Bob, and customer account operations.

## 126 Pre-GA No Legacy Compatibility Tenet

Clickeen is pre-GA. This PRD must not preserve old UI drift through
compatibility shims, temporary aliases, parallel legacy paths, or "support both
old and new" transitions unless the human explicitly makes that behavior product
law in this PRD.

Once the 126L DevStudio UI standard is decided:

- Fix source and docs to the standard.
- Remove old drift and stale paths.
- Do not leave legacy names, classes, render paths, token aliases, wrappers, or
  local one-offs as supported alternatives.
- Do not add guard/check machinery to enforce this tenet. The PRD is the
  authority; execution must clean the code/doc surface instead of preserving bad
  paths behind validation.

## Phase 1 Step 2 Boundary

MAMA says step 2 is baseline/directional PRD: current reality plus known gaps,
no fixes. Therefore this document:

- records what the Codex as-built audit found;
- names known gaps;
- avoids implementation prescriptions;
- does not update code;
- does not update generated pages;
- does not update product data;
- does not update living docs yet.

## Current DevStudio UI Baseline

### Service And Authority Baseline

Current reality:

- DevStudio source lives under `admin/`.
- DevStudio is a Cloudflare Pages app with output at `admin/dist`.
- Canonical host is `https://devstudio.clickeen.com`.
- Auth/session resolves through Berlin and the Clickeen admin account coordinate
  `CLICKEEN`.
- Write paths are Pages Functions under `admin/functions/**`.
- DevStudio is not Roma, Bob, a customer account shell, or a general admin
  bypass.
- DevStudio current sections are Foundations, Dieter Components, Entitlements,
  and LLM Management.

Known gaps:

- This PRD must preserve DevStudio's cockpit/reveal role and not turn it into a
  broader product admin app.

### App Shell And Navigation

Current reality:

- DevStudio is a static/hash-routed app.
- `admin/index.html` only provides the app mount; the visible shell is
  constructed at runtime by `admin/src/main.ts`.
- Route data is generated from `admin/src/html/**` through
  `admin/src/data/routes.ts`.
- Current route groups are Foundations, Dieter Components, and Policy.
- Current local count: 27 HTML pages total, 22 component pages, 3 foundation
  pages, 2 tool pages.
- Shell chrome uses local `.docs-shell`, sidebar, nav, page, and preview CSS.
- Shell CSS imports Dieter tokens but still defines local layout tokens and raw
  constants.
- Active nav state uses `aria-current="page"`.

Known gaps:

- DevStudio chrome is not purely Dieter-component-built.
- Local CSS includes raw px and hex values in layout/preview surfaces.
- Current counts must be reverified in later human convergence because old PRD
  and living-doc counts drift.
- The current route-contract e2e fixture is stale against generated component
  and tool counts.

### Source-Derived Reveal

Current reality:

- DevStudio imports Dieter tokens and selected component CSS.
- Static page fragments are imported from generated registries.
- Page rendering hydrates icons, executes embedded fragment scripts, injects
  page CSS, and runs Dieter hydrators.
- Component pages are generated from Dieter component specs/templates/CSS.
- Component generation fails governed components missing required assets,
  unresolved stencil markers, or no rendered page.
- Component renderer checks that enumerated attribute values render.
- Foundation pages are generated from Dieter token/icon source.
- Color and icon foundation pages carry generated governance counts.
- `--radius-4` is a real current surface-radius alias, not a ghost token.
- Typography page content is built from generated typography JSON.

Known gaps:

- DevStudio reveal is strong but not equivalent to complete screen-system
  convergence.
- `textrename` remains imported/hydrated and present in the Tokyo manifest, but
  current generated counts show no spec-backed generated component page.
- `textrename` has generated template/CSS imports without matching generated
  spec coverage.
- Generated HTML drift detection is still listed as an ops gap.

### Token Editor UI

Current reality:

- DevStudio has a color/typography token value editor.
- The editor opens from `[data-token-edit]` triggers.
- It creates a local `devstudio-token-editor` overlay and appends it to
  `document.body`.
- The overlay contains a form with token selector, value input, live diff, cancel,
  and confirm commit actions.
- Token reads and writes route through `admin/functions/_shared/dieter-tokens.js`
  and source-controlled Dieter token files.
- Token editing is values-only for color and typography values.
- Token value writes validate editable token names and values before replacing
  CSS declarations.
- Token value writes use GitHub file SHA and return conflict state on upstream
  SHA conflict.

Known gaps:

- The token editor overlay is local DevStudio UI, not a Dieter modal.
- Its injected panel has no inspected `role="dialog"` or `aria-modal`.
- It is not a token/schema/component editor.

### Policy Tool Pages

Current reality:

- DevStudio has two tool pages: Entitlements and LLM Management.
- Entitlements fetches and saves entitlement and AI runtime matrices through
  local API routes.
- LLM Management reads configured model/provider capability data from
  `window.__CK_LLM_MANAGEMENT__` and `window.__CK_AI_ACCESS__`.
- Both pages carry local inline CSS and are part of the DevStudio UI surface.

Known gaps:

- These tool pages are not Dieter component source.
- Their inline styling and governance behavior must be classified during later
  convergence instead of omitted from the DevStudio UI domain.

### Build And Static Output

Current reality:

- `admin/scripts/build-static.mjs` runs generated static registries, bundles
  `src/main.ts` with esbuild, resolves `@dieter/*` aliases, handles raw imports,
  and writes `admin/dist/index.html`.
- DevStudio build output is static app assets plus Pages Functions.

Known gaps:

- Build/static generation is part of the DevStudio UI surface and must be
  included in later screen planning.
- No code/build changes happen in this Step 2 baseline.

## Known Stale Prior-PRD Content

The previous 126L body was an older DevStudio/Dieter cleanup seed and contained
executable steps such as removing `textrename`, changing radius references, and
tokenizing inline values.

Current baseline corrections:

- Those steps are not executable in Phase 1 Step 2.
- The old "ghost token `--radius-4`" claim is stale against current 126H
  foundation/radius alias findings.
- `textrename` is current drift evidence, not a Step 2 deletion decision.
- Old page/component counts are stale and must not be reused without re-audit.

## Comparative Baseline

| Area | Current Strength | Current Gap |
| --- | --- | --- |
| Service authority | Clear cockpit role and Berlin/CLICKEEN boundary | Must not expand into admin bypass |
| Hash routes | Generated from static HTML modules | Static counts drift and need recheck |
| Component reveal | Spec/template/CSS-derived with guards | Some dirs/components outside spec-backed pages |
| Foundation reveal | Token/icon/typography-source-derived | Prior radius/ghost-token language stale |
| Token editor | Values-only source commit lane | Local overlay, limited token kinds, no inspected dialog ARIA |
| Policy tools | Entitlements/LLM Management expose governance data | Inline local CSS and mixed read/write behavior |
| Shell chrome | Uses Dieter tokens and local responsive shell | Local raw constants and not fully component-built |
| Build/tests | Static registries and Dieter alias build path | Generated drift detection and stale route fixture remain ops gaps |

## Compliance To Architecture, Product, And Product Law

Architecture:

- Keeps DevStudio in its named authority lane.
- Keeps Dieter source truth as the inner system.
- Keeps DevStudio write behavior tied to Pages Functions and source files.
- Keeps screen planning separate from source code execution.

Product:

- No redesign.
- No behavior change.
- No generated output change.
- No account/customer data operation.

Product law:

- No code changes.
- No Step 4+ convergence.
- No AI convergence of Codex and GLM.
- No new enforcement machinery.
- No reinterpretation into an ideal DevStudio system.

## Out Of Scope For This Step

- Removing `textrename`.
- Changing radius tokens.
- Tokenizing CSS.
- Rebuilding generated pages.
- Changing token editor behavior.
- Updating `documentation/services/devstudio.md` or `documentation/engineering/UI/*`.
- Running DevStudio deploy/build changes.
- Any runtime code change.

## Codex Baseline Done

- Step 1 input exists: `audits/126L__AsBuilt_Codex.md`.
- Step 2 baseline exists in this file.
- Step 3 source research exists: `research/126L_Research_Codex.md`.
- This file remains directional and non-binding until human convergence.
