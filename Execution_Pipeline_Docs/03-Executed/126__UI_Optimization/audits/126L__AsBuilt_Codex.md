# 126L DevStudio UI - As-Built Audit - Codex

Status: CODEX ONLY - Phase 1 step 1.
Scope: current DevStudio/Admin UI surface.
Process: code owns current reality. This audit does not converge with GLM, does
not choose fixes, and does not run step 4+.

## 0. Authority Boundary

126L is the DevStudio UI refactor domain. In the MAMA order, it is one of the
outermost screen refactors and runs after the 126A-126K domain planning work.

Evidence:

- `126__PRD__UI_Optimization_Program.md:133` assigns 126L to DevStudio UI
  refactor.
- `126__PRD__UI_Optimization_Program.md:139` through
  `126__PRD__UI_Optimization_Program.md:142` say DevStudio and Roma are last
  because they consume every domain beneath them.
- `126__PRD__UI_Optimization_Program.md:182` says step 1 is as-built audit.
- `126__PRD__UI_Optimization_Program.md:183` says step 2 is current reality
  plus known gaps, no fixes.
- `126__PRD__UI_Optimization_Program.md:185` reserves convergence for the human.
- `documentation/services/devstudio.md:5` defines DevStudio as the Pages cockpit
  where the one human governs the AI-operated company through rendered/source
  truth and named Pages Functions.
- `documentation/services/devstudio.md:7` says DevStudio is not Roma, Bob, a
  customer account shell, or a general admin bypass.

Compliance:

- This audit is current-state only.
- It does not redesign DevStudio.
- It does not execute the old 126L seed steps.

## 1. Service-Level DevStudio Truth

DevStudio's current service doc states the product role and runtime authorities.

Evidence:

- `documentation/services/devstudio.md:1` names DevStudio as the human cockpit.
- `documentation/services/devstudio.md:3` marks the doc current system operator
  spec.
- `documentation/services/devstudio.md:5` says DevStudio shows rendered/source
  truth and steers through named Pages Functions that validate input and commit
  to `main`.
- `documentation/services/devstudio.md:9` through
  `documentation/services/devstudio.md:11` name the account coordinate as
  `CLICKEEN`.
- `documentation/services/devstudio.md:17` names `admin/` as app source.
- `documentation/services/devstudio.md:18` names the Cloudflare Pages project
  `devstudio`.
- `documentation/services/devstudio.md:19` names
  `https://devstudio.clickeen.com` as canonical host.
- `documentation/services/devstudio.md:21` says the build command is
  `pnpm build`.
- `documentation/services/devstudio.md:22` says the build output is
  `admin/dist`.
- `documentation/services/devstudio.md:23` names Berlin login plus DevStudio
  session finish route as auth/session.
- `documentation/services/devstudio.md:24` names Pages Functions under
  `admin/functions/**` as write path.
- `documentation/services/devstudio.md:29` through
  `documentation/services/devstudio.md:38` list current sections and say hash
  routes are generated from `admin/src/html/**` and route data.
- `documentation/services/devstudio.md:40` through
  `documentation/services/devstudio.md:53` list current API routes.
- `documentation/services/devstudio.md:55` says every write uses GitHub SHA
  conflict checks.
- `documentation/services/devstudio.md:57` through
  `documentation/services/devstudio.md:69` list auth/safety gates.
- `documentation/services/devstudio.md:130` through
  `documentation/services/devstudio.md:139` list hard stops.

As-built reading:

- DevStudio's UI is a cockpit/reveal/governance app, not a product runtime
  shell.
- DevStudio may steer only through validated Pages Functions and source-control
  writes.

## 2. App Entry And Dieter Consumption

DevStudio imports Dieter tokens, selected Dieter component CSS, local app CSS,
and Dieter hydrators.

Evidence:

- `admin/index.html:13` exposes only the `#app` mount node; the visible shell is
  constructed by `admin/src/main.ts`.
- `admin/src/main.ts:1` imports `@dieter/tokens/tokens.css`.
- `admin/src/main.ts:2` through `admin/src/main.ts:4` import Dieter popover,
  valuefield, and toggle CSS.
- `admin/src/main.ts:5` through `admin/src/main.ts:8` import local DevStudio
  tokens, layout, preview, and utility CSS.
- `admin/src/main.ts:11` through `admin/src/main.ts:27` import Dieter hydrators.
- `admin/src/main.ts:28` imports icon CSS as raw CSS.
- `admin/src/main.ts:53` stores the entitlement matrix.
- `admin/src/main.ts:55` through `admin/src/main.ts:65` define showcase account
  asset stubs that do not allow asset upload in the Dieter showcase.
- `admin/src/main.ts:67` through `admin/src/main.ts:68` expose entitlement
  globals.
- `admin/src/main.ts:151` through `admin/src/main.ts:156` expose read-only LLM
  management data from the contract configuration.
- `admin/src/main.ts:163` through `admin/src/main.ts:173` creates `.docs-shell`,
  the sidebar, and the main content region at runtime.
- `admin/src/main.ts:175` through `admin/src/main.ts:182` creates the brand
  header and nav container.
- `admin/src/main.ts:186` through `admin/src/main.ts:219` iterates route groups
  and creates nav section/link DOM.
- `admin/src/main.ts:221` through `admin/src/main.ts:227` maps nav clicks to
  hash navigation.
- `admin/src/main.ts:235` through `admin/src/main.ts:239` marks the active page
  with `aria-current="page"`.

As-built reading:

- DevStudio consumes Dieter directly.
- DevStudio also has local shell/chrome CSS and local utility layers.
- The Dieter showcase is intentionally not a live account asset editor.
- The DevStudio shell is runtime-built local DOM, not a Dieter shell component
  and not static HTML authored in `admin/index.html`.

## 3. Hash Routes And Navigation

DevStudio routes are built from static generated HTML modules and hash paths.

Evidence:

- `admin/src/data/routes.ts:1` imports Dieter component CSS by name.
- `admin/src/data/routes.ts:2` imports static showcase modules.
- `admin/src/data/routes.ts:27` exports `showcaseModules`.
- `admin/src/data/routes.ts:57` through `admin/src/data/routes.ts:58` build
  pages from discovered static showcase paths.
- `admin/src/data/routes.ts:60` through `admin/src/data/routes.ts:76` map each
  static path to a `ShowcasePage`.
- `admin/src/data/routes.ts:65` through `admin/src/data/routes.ts:68` attach
  component CSS for component pages.
- `admin/src/data/routes.ts:78` exports `showcasePages`.
- `admin/src/data/routes.ts:80` builds `showcaseIndex`.
- `admin/src/data/routes.ts:89` through `admin/src/data/routes.ts:121` group
  pages into Foundations, Dieter Components, and Policy nav groups.
- `admin/scripts/generate-static-registries.mjs:47` discovers HTML pages from
  `admin/src/html`.
- `admin/scripts/generate-static-registries.mjs:59` through
  `admin/scripts/generate-static-registries.mjs:70` writes
  `showcase.generated.ts`.
- `admin/src/data/showcase.generated.ts:2` through
  `admin/src/data/showcase.generated.ts:28` import 27 static HTML fragments.
- `admin/src/data/showcase.generated.ts:30` starts the generated static module
  map keyed by source HTML path.
- `admin/src/main.ts:629` defines `renderFromHash`.
- `admin/src/main.ts:630` parses the hash path.
- `admin/src/main.ts:632` through `admin/src/main.ts:634` route to the first
  nav item when no hash path is present.
- `admin/src/main.ts:637` through `admin/src/main.ts:640` handle unknown pages.
- `admin/src/main.ts:643` through `admin/src/main.ts:646` attach page CSS and
  icon CSS for icons.
- `admin/src/main.ts:648` renders the HTML page.
- `admin/src/main.ts:650` wraps page chrome.
- `admin/src/main.ts:651` sets active nav.
- `admin/src/main.ts:652` sets the document title.
- `admin/src/main.ts:653` replaces main content.
- `admin/src/main.ts:665` listens for hash changes.
- `admin/src/main.ts:666` renders initial hash state.

Current counts from local read:

- `admin/src/html/**`: 27 HTML pages.
- `admin/src/html/components`: 22 component pages.
- `admin/src/html/foundations`: 3 foundation pages.
- `admin/src/html/tools`: 2 tool pages.
- `admin/src/data/showcase.generated.ts`: 27 HTML imports.
- `e2e/devstudio/route-contract.spec.ts:15` still expects 20 Dieter component
  routes.
- `e2e/devstudio/route-contract.spec.ts:41` still expects one Policy route.

As-built reading:

- DevStudio is a generated static hash-routed app.
- It has no server-side UI router and no separate design-system admin app.
- The route groups are generated from the current static page folder structure.
- The route-contract test fixture is stale against current generated counts of
  22 component pages and 2 tool pages.

## 4. Render And Hydration Loop

DevStudio renders static HTML fragments, hydrates icons, executes fragment
scripts, injects page CSS, and runs Dieter hydrators.

Evidence:

- `dieter/components/index.ts:18` exports `textrename`.
- `admin/src/main.ts:23` imports `hydrateTextrename`.
- `admin/src/main.ts:242` through `admin/src/main.ts:250` hydrate `[data-icon]`
  nodes from the icon registry.
- `admin/src/main.ts:253` defines `hydrateDieterComponents`.
- `admin/src/main.ts:254` through `admin/src/main.ts:268` call Dieter hydrators
  for choice tiles, textfield, valuefield, textedit, textrename, dropdowns,
  tabs, menuactions, segmented, and popaddlink.
- `admin/src/main.ts:258` runs `hydrateTextrename`.
- `admin/src/main.ts:271` through `admin/src/main.ts:279` re-execute scripts
  from HTML fragments.
- `admin/src/main.ts:452` defines `renderHtmlPage`.
- `admin/src/main.ts:453` reads the raw HTML module.
- `admin/src/main.ts:456` clones the template content.
- `admin/src/main.ts:457` hydrates icons in the clone.
- `admin/src/main.ts:458` executes scripts.
- `admin/src/main.ts:459` through `admin/src/main.ts:465` inject page CSS into
  style tags.
- `admin/src/main.ts:466` appends cloned content.
- `admin/src/main.ts:467` hydrates Dieter components.
- `admin/src/main.ts:480` through `admin/src/main.ts:563` wrap pages in
  `.devstudio-page` chrome when the page fragment does not already provide it.
- `admin/src/main.ts:654` hydrates Dieter components again after page mount.
- `admin/src/main.ts:655` hydrates the typography page.
- `admin/src/main.ts:656` through `admin/src/main.ts:662` wire token edit
  triggers.

As-built reading:

- DevStudio reveal is live-rendered from static generated fragments.
- Hydration is broad and includes `hydrateTextrename`.
- The wrapper adds chrome around fragments without changing the source HTML
  files.
- Current runtime behavior treats `textrename` as a hydrated component even
  though generated spec-backed governance coverage is missing.

## 5. Component Page Generation And Guards

DevStudio component pages are generated from Dieter component source.

Evidence:

- `admin/scripts/generate-component-pages.ts:10` points at `dieter/components`.
- `admin/scripts/generate-component-pages.ts:11` points at
  `admin/src/html/components`.
- `admin/scripts/generate-component-pages.ts:17` defines `readComponentSources`.
- `admin/scripts/generate-component-pages.ts:22` through
  `admin/scripts/generate-component-pages.ts:24` read component directories.
- `admin/scripts/generate-component-pages.ts:30` through
  `admin/scripts/generate-component-pages.ts:35` locate spec, template, and CSS.
- `admin/scripts/generate-component-pages.ts:37` skips empty component dirs.
- `admin/scripts/generate-component-pages.ts:38` skips dirs without specs.
- `admin/scripts/generate-component-pages.ts:39` through
  `admin/scripts/generate-component-pages.ts:42` fail governed components that
  lack HTML or CSS.
- `admin/scripts/generate-component-pages.ts:68` through
  `admin/scripts/generate-component-pages.ts:85` clean generated output.
- `admin/scripts/generate-component-pages.ts:88` through
  `admin/scripts/generate-component-pages.ts:98` fail unresolved stencil
  markers.
- `admin/scripts/generate-component-pages.ts:107` renders component docs.
- `admin/scripts/generate-component-pages.ts:108` through
  `admin/scripts/generate-component-pages.ts:110` fail components that render no
  page.
- `admin/src/data/componentRegistry.ts:54` through
  `admin/src/data/componentRegistry.ts:78` build `componentSources` from
  generated spec/template/CSS modules.
- `admin/src/data/componentRegistry.generated.ts:45` imports the `textrename`
  HTML template.
- `admin/src/data/componentRegistry.generated.ts:69` imports the `textrename`
  CSS.
- `admin/src/data/componentRegistry.generated.ts:73` through
  `admin/src/data/componentRegistry.generated.ts:96` define the generated spec
  module map; `textrename` is absent from that map in current output.
- `admin/src/data/componentRenderer.ts:163` through
  `admin/src/data/componentRenderer.ts:242` render component docs from specs and
  component templates.
- `admin/src/data/componentRenderer.ts:215` through
  `admin/src/data/componentRenderer.ts:220` throw when attribute values do not
  render.

Current counts from local read:

- Dieter component dirs excluding `shared`: 25.
- Dieter `*.spec.json`: 22.
- Generated component pages: 22.
- Generated spec imports: 22.
- Generated template imports: 23.
- Generated CSS imports: 24.
- Generated `textrename` template/CSS imports exist without matching generated
  spec import.

As-built reading:

- The component reveal loop is source-derived and guarded.
- Some component directories exist without spec-backed generated pages.
- Counts in older docs/PRD text that say 21, 23, or 27 need re-verification
  before later steps.

## 6. Foundation Pages And Typography

DevStudio foundation pages are generated from Dieter token/icon source and
hydrated at runtime.

Evidence:

- `admin/scripts/generate-typography-json.cjs:4` says DevStudio needs actual
  class rules and names Dieter typography tokens as source of truth.
- `admin/scripts/generate-typography-json.cjs:5` points at
  `dieter/tokens/dieter-typography.css`.
- `admin/scripts/generate-typography-json.cjs:17` reads the token CSS.
- `admin/scripts/generate-typography-json.cjs:30` through
  `admin/scripts/generate-typography-json.cjs:50` extracts class rules.
- `admin/scripts/generate-typography-json.cjs:52` writes
  `typography.generated.json`.
- `admin/src/main.ts:566` through `admin/src/main.ts:627` build typography page
  rows from generated typography sections.
- `admin/src/main.ts:570` sets the typography page governance count.
- `admin/scripts/generate-foundation-pages.mjs:82` generates color token edit
  triggers.
- `admin/scripts/generate-foundation-pages.mjs:102` writes color governance
  count.
- `admin/scripts/generate-foundation-pages.mjs:159` writes icon governance
  count.
- `admin/src/html/foundations/colors.html:2` carries
  `data-governance-count="132"`.
- `admin/src/html/foundations/colors.html:4` uses `border-radius:
  var(--radius-4)`.
- `admin/src/html/foundations/icons.html:2` carries
  `data-governance-count="157"`.
- `dieter/tokens/dieter-foundation-tokens.css:60` through
  `dieter/tokens/dieter-foundation-tokens.css:62` define `--radius-3` and
  `--radius-4` as surface radius aliases.

As-built reading:

- Colors, typography, and icons are generated reveal surfaces.
- The color generator still references `--radius-4` in generated page CSS at
  `admin/scripts/generate-foundation-pages.mjs:104` and
  `admin/scripts/generate-foundation-pages.mjs:113`.
- `--radius-4` is not automatically invalid in current Dieter foundation because
  126H found radius aliases are real and intentional. The older 126L seed text
  that calls it a ghost token is stale.
- Current generated HTML and current token source agree that `--radius-4` exists
  as a radius alias.

## 7. Token Editor UI

DevStudio has an overlay token editor for color and typography token values.

Evidence:

- `admin/src/main.ts:282` defines `DieterTokenKind`.
- `admin/src/main.ts:337` defines `openTokenEditor`.
- `admin/src/main.ts:340` creates the overlay element.
- `admin/src/main.ts:341` assigns `devstudio-token-editor`.
- `admin/src/main.ts:343` through `admin/src/main.ts:367` inject an editor
  form with close button, token select, value input, live diff, cancel, and
  confirm commit.
- `admin/src/main.ts:369` appends the overlay to `document.body`.
- `admin/src/main.ts:371` hydrates icons in the overlay.
- `admin/src/main.ts:379` through `admin/src/main.ts:385` close on backdrop or
  close controls.
- `admin/src/main.ts:292` through `admin/src/main.ts:306` fetch token values
  from `/api/dieter/tokens/{kind}`.
- `admin/src/main.ts:308` through `admin/src/main.ts:321` posts token value
  changes to `/api/dieter/tokens/{kind}/value`.
- `admin/src/css/utilities.css:56` through `admin/src/css/utilities.css:64`
  style the fixed overlay with `z-index: 40`.
- `admin/src/css/utilities.css:66` through `admin/src/css/utilities.css:75`
  style the panel.
- `admin/src/css/utilities.css:94` through
  `admin/src/css/utilities.css:110` style and focus the select/input controls.
- `admin/src/css/utilities.css:113` through
  `admin/src/css/utilities.css:123` style diff status.
- `admin/functions/_shared/dieter-tokens.js:5` through
  `admin/functions/_shared/dieter-tokens.js:18` map color and typography token
  files.
- `admin/functions/_shared/dieter-tokens.js:97` through
  `admin/functions/_shared/dieter-tokens.js:119` validates editable token names
  and values before replacing CSS declarations.
- `admin/functions/_shared/dieter-tokens.js:150` through
  `admin/functions/_shared/dieter-tokens.js:161` writes updated token CSS to
  GitHub with the source file SHA.
- `admin/functions/_shared/dieter-tokens.js:163` through
  `admin/functions/_shared/dieter-tokens.js:168` returns conflict state on
  upstream SHA conflict.
- `admin/functions/_shared/dieter-tokens.js:249` through
  `admin/functions/_shared/dieter-tokens.js:258` read tokens.
- `admin/functions/_shared/dieter-tokens.js:261` through
  `admin/functions/_shared/dieter-tokens.js:270` start token value writes.

As-built reading:

- The token editor is a values-only governance UI for colors and typography.
- It is an ad hoc DevStudio overlay, not a Dieter modal component.
- The injected panel has no inspected `role="dialog"` or `aria-modal`.
- It uses Pages Functions and source token files as write authority.
- The token API has explicit invalid-value and conflict states; this audit does
  not change those states.

## 8. Policy Tool Pages

DevStudio has two tool pages under `admin/src/html/tools`.

Evidence:

- `admin/src/html/tools/entitlements.html:1` through
  `admin/src/html/tools/entitlements.html:35` include local inline CSS for the
  entitlements surface, including raw `8px`, `12px`, and `96px` values.
- `admin/src/html/tools/entitlements.html:281` through
  `admin/src/html/tools/entitlements.html:292` fetch the entitlement matrix.
- `admin/src/html/tools/entitlements.html:294` through
  `admin/src/html/tools/entitlements.html:315` save entitlement cells.
- `admin/src/html/tools/entitlements.html:317` through
  `admin/src/html/tools/entitlements.html:328` fetch the AI runtime matrix.
- `admin/src/html/tools/entitlements.html:330` through
  `admin/src/html/tools/entitlements.html:338` save AI runtime cells.
- `admin/src/html/tools/llm-management.html:1` through
  `admin/src/html/tools/llm-management.html:28` include local inline CSS for the
  LLM Management surface, including raw `4px` and `280px` values.
- `admin/src/html/tools/llm-management.html:122` through
  `admin/src/html/tools/llm-management.html:126` read from
  `window.__CK_LLM_MANAGEMENT__` and `window.__CK_AI_ACCESS__`.

As-built reading:

- Entitlements is an interactive governance tool page with API reads and writes.
- LLM Management is a reveal page for configured model/provider capability
  data.
- Both tool pages carry local inline UI styling outside Dieter component source.

## 9. Shell And Local CSS

DevStudio shell/chrome is local CSS around source-derived pages.

Evidence:

- `admin/src/css/tokens.css:1` through `admin/src/css/tokens.css:4` import
  Inter Tight and Dieter tokens.
- `admin/src/css/tokens.css:6` through `admin/src/css/tokens.css:11` define
  shell-specific layout tokens.
- `admin/src/css/layout.css:20` through `admin/src/css/layout.css:26` define
  `.docs-shell`.
- `admin/src/css/layout.css:28` through `admin/src/css/layout.css:41` define the
  sidebar.
- `admin/src/css/layout.css:74` through `admin/src/css/layout.css:105` define
  nav groups and lists.
- `admin/src/css/layout.css:120` through `admin/src/css/layout.css:129` define
  current-page and focus-visible nav styles.
- `admin/src/css/layout.css:131` through `admin/src/css/layout.css:136` define
  main content layout.
- `admin/src/css/layout.css:144` through `admin/src/css/layout.css:173` define
  responsive sidebar behavior, including the mobile sidebar transition at
  `admin/src/css/layout.css:153`.
- `admin/src/css/layout.css:181` through `admin/src/css/layout.css:186` define
  `.devstudio-page`.
- `admin/src/css/layout.css:188` through `admin/src/css/layout.css:194` define
  `.devstudio-page-layout` and include raw `padding: 32px`.
- `admin/src/css/layout.css:218` through `admin/src/css/layout.css:223` define
  `.devstudio-page-section` and include raw `padding: 32px`.
- `admin/src/css/dieter-previews.css:79` through
  `admin/src/css/dieter-previews.css:90` use raw `240px`, `280px`, and `40px`
  in component masonry sizing.
- `admin/src/css/dieter-previews.css:101` through
  `admin/src/css/dieter-previews.css:108` include raw `20px` padding and
  `#f4f5f7`.
- `admin/src/css/dieter-previews.css:160` through
  `admin/src/css/dieter-previews.css:167` include raw `16px` padding and
  `#f4f5f7`.
- `admin/src/css/utilities.css:140` through
  `admin/src/css/utilities.css:146` include a global reduced-motion override.

As-built reading:

- DevStudio consumes Dieter tokens but still has local shell primitives and raw
  constants.
- Some local CSS uses raw px and hex values for preview/chrome.
- These are current-state gaps only; this audit does not select tokenization or
  layout changes.
- Motion behavior exists in local shell CSS and reduced-motion utilities, so
  later UI convergence must audit motion per surface rather than assume no
  motion layer exists.

## 10. Build Pipeline

DevStudio build resolves Dieter aliases, raw modules, generated registries, and
static output.

Evidence:

- `admin/scripts/build-static.mjs:8` imports `generateStaticRegistries`.
- `admin/scripts/build-static.mjs:33` through
  `admin/scripts/build-static.mjs:39` resolve imports, including Dieter aliases.
- `admin/scripts/build-static.mjs:41` through
  `admin/scripts/build-static.mjs:60` define raw imports.
- `admin/scripts/build-static.mjs:62` through
  `admin/scripts/build-static.mjs:69` define the Dieter alias plugin.
- `admin/scripts/build-static.mjs:71` through
  `admin/scripts/build-static.mjs:90` write `admin/dist/index.html`.
- `admin/scripts/build-static.mjs:92` through
  `admin/scripts/build-static.mjs:95` generate static registries and recreate
  dist.
- `admin/scripts/build-static.mjs:97` through
  `admin/scripts/build-static.mjs:110` run esbuild on `src/main.ts`.
- `admin/scripts/build-static.mjs:112` writes HTML.

As-built reading:

- DevStudio is built as a static app plus Pages Functions.
- Generated registries are part of the build surface.

## 11. Current Known Gaps Only

These are current-state gaps. They are not fixes.

- The existing 126L PRD body contains stale executable steps from an older
  DevStudio/Dieter cleanup draft and should not govern this Phase 1 Step 2.
- The old "ghost token `--radius-4`" claim is stale against the current
  foundation/radius alias reality documented in 126H.
- `textrename` remains imported/hydrated and present in the Tokyo manifest, but
  it lacks spec-backed generated governance page coverage in current counts.
- Generated page counts in old docs/PRD text are stale and must be rechecked
  when later human convergence occurs.
- DevStudio chrome/preview CSS uses local raw px and hex values.
- Token editor overlay lacks inspected dialog ARIA and remains a local
  DevStudio overlay.
- Entitlements and LLM Management tool pages include inline local CSS and API or
  global-data wiring that must be treated as DevStudio UI, not as Dieter
  component source.
- The route-contract e2e fixture is stale against generated component/tool
  counts.
- DevStudio exposes color/typography token value editing, not full token/schema
  editing.
- Generated HTML drift detection is identified as a gap in `ops.md`.

## 12. Explicit Non-Decisions

- No DevStudio redesign.
- No code changes.
- No token changes.
- No token editor behavior changes.
- No removal of `textrename`.
- No replacement of DevStudio shell CSS.
- No generated page regeneration in this step.
- No update to living UI docs in this step.
- No Step 4+ convergence.

## 13. Compliance Check

Architecture compliance:

- Keeps DevStudio as the reveal/governance cockpit.
- Keeps source Dieter files as the design-system truth.
- Keeps Pages Functions as the steering/write authority.
- Separates DevStudio UI from Roma/Bob product surfaces.

Product compliance:

- No redesign or product behavior change.
- No account data mutation.
- No managed-service operation.
- No deploy.

Product-law compliance:

- No code changes.
- No product data changes.
- No AI convergence with GLM.
- No final doctrine.
- No machinery added to enforce a reinterpretation.

## 14. V1-V8 Pre-Execution Audit

This is documentation only and did not execute product behavior. Content check:

- V1 Silent substitution: avoided. Stale prior claims are named instead of
  replaced with invented current truth.
- V2 Silent healing: avoided. DevStudio raw CSS and overlay gaps are recorded,
  not repaired in prose.
- V3 Silent omission: avoided. Shell, generated pages, token editor, build, and
  service authority are included.
- V4 Fail-open control: not applicable; no controls changed.
- V5 Corruption-as-absence: avoided. Unverified old counts are called stale.
- V6 Partial-success masquerade: avoided. Generated reveal is strong but not
  treated as complete UI convergence.
- V7 Masquerade/redress: avoided. Token editor and showcase are not renamed as a
  complete admin platform.
- V8 Runtime test dependency: not applicable; no runtime probes or tests added.
