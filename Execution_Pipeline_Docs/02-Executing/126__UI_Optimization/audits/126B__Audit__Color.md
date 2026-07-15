# 126B Color - Pre-Execution Gap Audit

Status: FROZEN POINT-IN-TIME PRE-EXECUTION AUDIT - code changed afterward; no step-9 execution credit.
Parent PRD: `../126B__PRD__Color.md`.
Audit date: 2026-06-28.

This is the file-level execution audit for 126B. It is not an as-built pass,
not a palette proposal, not a dark-mode plan, and not a validator plan. It
converts the as-built/research/reviewer findings into the exact color blast
radius that a later 126B implementation pass is allowed to execute.

## Authority

126B owns:

- Dieter color token source truth;
- generated Tokyo Dieter color output truth;
- exact Clickeen semantic role tokens and light-mode values;
- structural chrome color references in Dieter/Admin/Roma/Bob where they are
  color-token consumers;
- state color mechanics for hover, pressed, muted, inactive, selected, disabled,
  and focus color;
- undefined color/state token cleanup;
- DevStudio color reveal/write truth;
- color documentation accuracy.

126B does not own:

- palette redesign;
- dark-mode work, dark-mode scaffolding, or dark-mode readiness claims;
- AI-owned contrast enforcement or contrast gates;
- M3/OpenAI/Apple cloning;
- user-authored widget appearance colors;
- account/product data;
- runtime routes, save/publish/translation behavior, Cloudflare, Supabase, or
  deploy behavior;
- generated artifact hand-edits;
- a resolver, registry, validation framework, theme platform, or governance
  layer.

## Commands Used

Read-only commands used for this audit:

```bash
rg -n -e "--color-surface|--color-bg|--color-system-gray-7|--color-system-gray-10|--state-muted-opacity|--state-hover-target" dieter admin roma tokyo/product/widgets documentation/engineering/UI
rg -n "#[0-9A-Fa-f]{3,8}|rgba?\(" admin/src/css dieter/components roma/app bob/app bob/components tokyo/product/widgets
rg -n "prefers-color-scheme|data-theme|theme: 'light' \| 'dark'|dark mode|dark-ready|dark-ready|dark" bob dieter admin documentation/engineering/UI
rg -n "colorTokenPath|stripCssComments|parseCustomProperties|isColorToken|token-edit-trigger|data-token-edit=\"color\"|TOKEN_FILES|tokenPattern|valuePattern|replaceTokenValue" admin/scripts/generate-foundation-pages.mjs admin/functions/_shared/dieter-tokens.js
```

No tests, builds, preflights, commits, pushes, deploys, product data mutations,
or Cloudflare/Supabase operations were run.

## Source And Generated Authority

| Path | Evidence | 126B action | Not 126B |
| --- | --- | --- | --- |
| `dieter/tokens/dieter-color-tokens.css:1-10` | Opening comment is valid CSS but AI-confusing because the close marker is embedded in a second comment line. | Rewrite the header as a normal closed comment that states current color law plainly. | Do not change palette values as part of header cleanup. |
| `dieter/tokens/dieter-color-tokens.css:13-26` | Current source has `--color-text`, `--color-text-secondary`, `--role-surface`, `--role-surface-bg`, `--role-border`, `--focus-ring-color`, and state mix controls. | Add the exact missing 126B role tokens to this source file with light-mode values defined by the PRD. | Do not add dark token pairs, aliases for old undefined names, or a role registry. |
| `dieter/tokens/tokens.css` | Imports foundation/color/typography source tokens. | Verify import remains correct if build output changes. | Do not create a new token pipeline. |
| `tokyo/product/dieter/tokens/*` | Generated copy of Dieter token source. | Regenerate with `pnpm build:dieter` in implementation. | Do not hand-edit generated output. |
| `admin/src/html/foundations/colors.html` | Generated reveal currently shows color/role/focus/state rows and marks them editable. | Regenerate from source/generator after fixing reveal truth. | Do not hand-edit this generated page. |

## Exact Role Token Source Gaps

The current source role layer is too thin for deterministic agent operation.
The PRD, not an executor, must decide values before implementation.

| Required token | Current source state | Execution target |
| --- | --- | --- |
| `--role-surface` | exists | keep as foreground content surface. |
| `--role-on-surface` | missing | add as content color on foreground surface. |
| `--role-surface-bg` | exists | keep as app/page/workspace background surface. |
| `--role-surface-muted` | missing | add as subdued panel, preview, and code/path surface. |
| `--role-border` | exists | keep as standard structural border. |
| `--role-text` | missing | add as alias to current primary text role. |
| `--role-text-secondary` | missing | add as alias to current supporting text role. |
| `--role-focus` | missing | add as alias to current focus-ring source. |
| `--role-primary-action` / `--role-on-primary-action` | missing | add as primary action fill/content pair. |
| `--role-error` / `--role-on-error` | missing | add as error/destructive status pair. |
| `--role-success` / `--role-on-success` | missing | add as success status pair. |
| `--role-warning` / `--role-on-warning` | missing | add as warning status pair. |
| `--role-info` / `--role-on-info` | missing | add as informational status pair. |
| `--role-muted` | missing | add as low-emphasis text/icon/border role. |
| `--role-selected-fill` / `--role-selected-text` / `--role-selected-border` | missing | add as selected/current item roles. |
| `--role-disabled-fill` / `--role-disabled-text` / `--role-disabled-border` | missing | add as unavailable control roles. |

## Undefined Token Cleanup

Undefined color/state references are 126B integrity bugs. Implementation must
replace the references below exactly; it must not keep aliases for old names.

| Path | Evidence | 126B action | Not 126B |
| --- | --- | --- | --- |
| `dieter/components/button/button.css:8` | `--btn-bg: var(--color-surface)` is undefined. | Replace with `--btn-bg: var(--role-surface)`. | Do not add `--color-surface` as a compatibility alias. |
| `dieter/components/button/button.css:190` | `--btn-bg: var(--color-surface)` is undefined. | Replace with `--btn-bg: var(--role-surface)`. | Do not redesign button variants. |
| `dieter/components/button/button.css:321` | `--btn-bg: var(--color-surface)` is undefined. | Replace with `--btn-bg: var(--role-surface)`. | Do not rewrite button behavior. |
| `admin/src/css/layout.css:185` | `.devstudio-page` uses undefined `--color-bg`. | Replace with `--role-surface-bg`. | Do not add `--color-bg` as a compatibility alias. |
| `roma/app/roma.css:494` | Widget-defaults contract error path block uses undefined `--color-system-gray-7`. | Replace with `--role-surface-muted`. | Do not extend the gray ladder. |
| `tokyo/product/widgets/countdown/widget.css:3` | Countdown item default uses undefined `--color-system-gray-10`. | Replace with an existing token, `--color-system-gray-6-step5`, as the current widget product default. | Do not create widget color doctrine or extend the gray ladder. |
| `roma/tests/fixtures/124c-base-package-expected.json` | Bundled expected package includes the Countdown CSS with `--color-system-gray-10`. | Update fixture only if the Countdown source change changes the generated expected package. | Do not edit fixture instead of source. |
| `dieter/components/dropdown-border/dropdown-border.css:273` | Disabled border controls use undefined `--state-muted-opacity` fallback. | Replace with `opacity: 0.45;` to preserve current rendered behavior while deleting the undefined token. | Do not create a new opacity token or disabled-state framework in 126B. |
| `dieter/components/dropdown-shadow/dropdown-shadow.css:274` | Disabled shadow controls use undefined `--state-muted-opacity` fallback. | Replace with `opacity: 0.45;` to preserve current rendered behavior while deleting the undefined token. | Do not redesign dropdown behavior. |
| `documentation/engineering/UI/color.md:84` | Example uses nonexistent `--state-hover-target`. | Replace with `--state-darken-target`. | Do not document old target names. |

## Raw Color Classification

Raw color is not automatically a violation. 126B classifies current hits before
execution so implementation does not improvise.

### Structural Chrome To Fix

| Path | Evidence | 126B action |
| --- | --- | --- |
| `admin/src/css/dieter-previews.css:107` | `.component-wrapper` background uses `#f4f5f7`. | Replace with `var(--role-surface-muted)`. |
| `admin/src/css/dieter-previews.css:166` | preview wrapper background uses `#f4f5f7`. | Replace with `var(--role-surface-muted)`. |
| `admin/src/css/layout.css:155` | mobile sidebar shadow uses `rgba(12, 16, 24, 0.28)`. | Keep `0 24px 32px`; replace shadow color with `color-mix(in oklab, var(--color-system-black), transparent 72%)`. |

### Legal User/Authored/Inspector Color

These are not 126B chrome violations:

- `dieter/components/dropdown-fill/dropdown-fill.html:183-238,349-404` swatches;
- `dieter/components/dropdown-fill/dropdown-fill.html:318` hex placeholder;
- `dieter/components/dropdown-fill/dropdown-fill.css:603-610` hue picker gradient;
- `dieter/components/dropdown-fill/fill-types.ts:43-44` gradient defaults;
- `dieter/components/dropdown-fill/dropdown-fill.ts:540` serialized selected color;
- `dieter/components/dropdown-fill/dropdown-fill-gradient.ts:552` serialized gradient stop;
- `dieter/components/dropdown-border/dropdown-border.html:103-158` swatches;
- `dieter/components/dropdown-border/dropdown-border.ts:34,329` selected color/default white handling;
- `dieter/components/dropdown-border/dropdown-border.css:216` picker RGB surface;
- `dieter/components/dropdown-shadow/dropdown-shadow.html:108-163` swatches;
- `dieter/components/dropdown-shadow/dropdown-shadow.ts:48,212,335,386` shadow color defaults/serialization;
- `dieter/components/dropdown-shadow/dropdown-shadow.css:209` picker RGB surface;
- `dieter/components/textedit/textedit.css:167` fallback shadow value inside `--shadow-floating` fallback;
- widget `spec.json` raw color values under `tokyo/product/widgets/**`, because they are widget product defaults/user content, not app chrome.

### Widget Runtime Defaults To Classify, Not Purge

| Path | Evidence | 126B action |
| --- | --- | --- |
| `tokyo/product/widgets/shared/appearance.js:57` | Shadow default falls back to `#000000`. | Document as widget runtime appearance default; do not purge under 126B. |
| `tokyo/product/widgets/shared/stagePod.js:145` | Shadow default falls back to `#000000`. | Document as widget runtime appearance default; do not purge under 126B. |
| `tokyo/product/widgets/shared/socialShare.css:8,143-166,204-206,225,249-264,287-291` | CSS uses token fallbacks such as `#111`, `#fff`, `#000`, `#1c7cff`. | Classify as shared widget runtime fallback color, not internal app chrome. Do not redesign in 126B. |
| `tokyo/product/widgets/countdown/widget.css:3` | Undefined token used as widget default. | Fix only the undefined token reference as listed above. |

## Role/State Adoption Inventory

GLM's as-built finding is correct: role/state consumption is not clean today.
The codebase uses many direct `--color-system-*` primitives and local
`color-mix(in oklab, ...)` recipes. This audit does not pretend those patterns
are already compliant. It assigns the work to the owning implementation slices
so 126B does not become a vague whole-product refactor.

126B sets the standard:

- structural chrome consumes the exact roles in this PRD;
- state color uses the exact formulas in this PRD;
- allowed primitives are color picker/reveal/product-default cases only;
- component-local aliases are plumbing, not authority.

The following files are the known role/state adoption blast radius. The 126B
implementation pass may fix only the exact entries listed in the file-level
table above unless a later human-amended execution plan explicitly brings more
of this inventory into 126B. The remaining items are not documented as legacy;
they must be closed by the owning 126I/126L/126M/Bob/Roma/component execution
slice that touches the component or screen.

| Area | Current files with primitive/state color usage | Owning execution lane |
| --- | --- | --- |
| Dieter components | `dieter/components/dropdown-fill/dropdown-fill.css`, `dieter/components/dropdown-upload/dropdown-upload.css`, `dieter/components/choice-tiles/choice-tiles.css`, `dieter/components/dropdown-shadow/dropdown-shadow.css`, `dieter/components/dropdown-shadow/dropdown-shadow.ts`, `dieter/components/bulk-edit/bulk-edit.css`, `dieter/components/repeater/repeater.js`, `dieter/components/repeater/repeater.css`, `dieter/components/popaddlink/popaddlink.css`, `dieter/components/textfield/textfield.css`, `dieter/components/agent-activity/agent-activity.css`, `dieter/components/button/button.css`, `dieter/components/popover/popover.css`, `dieter/components/tabs/tabs.css`, `dieter/components/textedit/textedit.css`, `dieter/components/slider/slider.css`, `dieter/components/menuactions/menuactions.css`, `dieter/components/toggle/toggle.css`, `dieter/components/dropdown-border/dropdown-border.css`, `dieter/components/dropdown-border/dropdown-border.ts`, `dieter/components/valuefield/valuefield.css`, `dieter/components/dropdown-edit/dropdown-edit.css`, `dieter/components/dropdown-actions/dropdown-actions.css`, `dieter/components/object-manager/object-manager.css`, `dieter/components/segmented/segmented.css`, `dieter/components/textrename/textrename.css` | 126I component execution, except exact 126B undefined-token fixes listed above. |
| DevStudio chrome | `admin/src/css/utilities.css`, `admin/src/css/layout.css`, `admin/src/css/dieter-previews.css` | 126B for exact undefined/hardcoded fixes; 126L for broader DevStudio UI refactor. |
| Bob UI | `bob/app/bob_app.css`, `bob/components/Workspace.tsx`, `bob/components/ToolDrawer.tsx`, `bob/components/CopilotPane.tsx` | Bob/UI refactor lane using 126B standard; not Bob save/translation runtime. |
| Roma UI | `roma/app/roma.css` | 126B for exact undefined-token fix; 126M for broader Roma UI refactor. |

## Dark Artifacts

| Path | Evidence | 126B action | Not 126B |
| --- | --- | --- | --- |
| `bob/lib/session/sessionTypes.ts:21` | Typed `theme: 'light' | 'dark'` exists and defaults to light elsewhere. | Document that this field is not shipped dark-mode support. | Do not expose a dark-mode toggle or build dark mode. |
| `dieter/components/valuefield/valuefield.css:144` | local `@media (prefers-color-scheme: dark)`. | Remove the dark media block from source. | Do not replace with dark token scaffolding. |
| `dieter/components/segmented/segmented.css:266,275-280` | local dark media/theme selectors. | Remove the dark media block and `[data-theme="dark"]` selectors from source. | Do not build theme support. |
| `dieter/components/dropdown-actions/dropdown-actions.css:140` | local dark media block. | Remove the dark media block from source. | Do not broaden. |
| `dieter/components/dropdown-edit/dropdown-edit.css:224` | local dark media block. | Remove the dark media block from source. | Do not broaden. |
| `dieter/components/textfield/textfield.css:143` | local dark media block. | Remove the dark media block from source. | Do not broaden. |
| `dieter/components/textedit/textedit.css:295` | local dark media block. | Remove the dark media block from source. | Do not broaden. |
| `dieter/components/segmented/segmented.spec.json:188-204,264` | Example content exposes `Theme`, `Light`, and `Dark`. | Replace with a `View/Grid/List` example using `circle.grid.2x2` and `line.3.horizontal.decrease.circle`; regenerate Admin output. | Do not create any dark-mode example or affordance. |
| `admin/src/html/components/segmented.html:149-230` | Generated component page exposes the source `Theme/Light/Dark` example. | Regenerate from the fixed segmented spec only. | Do not hand-edit generated examples under 126B. |
| `tokyo/product/dieter/components/segmented/segmented.spec.json` | Generated spec mirror exposes the source `Theme/Light/Dark` example. | Regenerate from the fixed Dieter segmented spec only. | Do not hand-edit generated output. |
| `tokyo/product/dieter/components/valuefield/valuefield.css` | generated mirror of source dark media block. | Regenerate from source after removal. | Do not hand-edit generated output. |
| `tokyo/product/dieter/components/segmented/segmented.css` | generated mirror of source dark media/theme selectors. | Regenerate from source after removal. | Do not hand-edit generated output. |
| `tokyo/product/dieter/components/dropdown-actions/dropdown-actions.css` | generated mirror of source dark media block. | Regenerate from source after removal. | Do not hand-edit generated output. |
| `tokyo/product/dieter/components/dropdown-edit/dropdown-edit.css` | generated mirror of source dark media block. | Regenerate from source after removal. | Do not hand-edit generated output. |
| `tokyo/product/dieter/components/textfield/textfield.css` | generated mirror of source dark media block. | Regenerate from source after removal. | Do not hand-edit generated output. |
| `tokyo/product/dieter/components/textedit/textedit.css` | generated mirror of source dark media block. | Regenerate from source after removal. | Do not hand-edit generated output. |
| `documentation/engineering/UI/color.md:119-123` | Claims architecture is dark-ready and tells agents to complete dark palette. | Replace with current law: no dark mode, no dark-ready claim, no 126B dark work. | Do not leave future-work instructions. |
| `documentation/engineering/UI/dieter.md:78` | Says engine is dark-ready. | Replace/remove to match 126B law. | Do not document unsupported readiness. |

## DevStudio Reveal/Write Truth

| Path | Evidence | 126B action | Not 126B |
| --- | --- | --- | --- |
| `admin/scripts/generate-foundation-pages.mjs:42-82` | Generator reveals `--color-*`, `--role-*`, `--focus-*`, and selected `--state-*` rows as `data-token-edit="color"`. | Change generated reveal so rows that the write path cannot edit do not render as editable token controls. Use static/read-only output for role/focus/state rows. | Do not expand write authority under 126B. |
| `admin/functions/_shared/dieter-tokens.js:5-15,87-111` | Color write lane accepts only `^--color-` tokens with hex values. | Preserve current write lane. | Do not create broad token writing, role writing, or non-hex writing in 126B. |
| `admin/src/html/foundations/colors.html` | Generated page currently exposes non-writable rows as editable. | Regenerate from the fixed generator. | Do not hand-edit generated output. |

## Documentation Blast Radius

These docs must be reconciled by the implementation pass when color behavior is
changed.

| Path | Current issue | 126B target |
| --- | --- | --- |
| `documentation/engineering/UI/color.md:7` | Driving PRD points to nonexistent `126A2__SUBPRD__Color_System.md`. | Point to `126B__PRD__Color.md`. |
| `documentation/engineering/UI/color.md:76-85` | State example uses current engine but also references nonexistent `--state-hover-target`. | Use the exact 126B state formula and real state target tokens. |
| `documentation/engineering/UI/color.md:104-123` | Contrast/dark wording overclaims accessibility and dark readiness. | Keep contrast human-owned; state that dark mode is not shipped, not dark-ready, and not 126B work. |
| `documentation/engineering/UI/color.md:124-127` | Routes `--color-surface` and `--color-bg` to an unnamed sibling slice. | Route `--color-surface` and `--color-bg` cleanup to 126B; route non-color spacing/radius issues to owning PRDs only if those docs own them. |
| `documentation/engineering/UI/dieter.md:78` | Dark-ready claim. | Remove/narrow to match current light-mode color law. |
| `documentation/engineering/UI/components.md` | Component color consumption must align with 126B and 126I. | Cross-reference role/state consumption without expanding component API. |
| `documentation/engineering/UI/interactions.md` | State meaning must align with 126E and 126B. | 126E owns what state happened; 126B owns how state is colored. |
| `documentation/engineering/UI/accessibility.md` | Must not contradict human-owned contrast. | Keep contrast as human design review evidence, no gate. |
| `documentation/engineering/UI/ops.md` | Only relevant if build/generated-output wording changes. | Keep source/generated authority accurate without new ops machinery. |
| `documentation/services/devstudio.md` | Only relevant if DevStudio reveal behavior changes. | State reveal/write truth without expanding DevStudio write lane. |

## Generated Artifacts

Do not hand-edit generated artifacts.

| Generated path | Source/action |
| --- | --- |
| `tokyo/product/dieter/tokens/*` | Regenerated from `dieter/tokens/*` by `pnpm build:dieter`. |
| `tokyo/product/dieter/components/button/button.css` | Regenerated from `dieter/components/button/button.css`. |
| `tokyo/product/dieter/components/dropdown-border/dropdown-border.css` | Regenerated from `dieter/components/dropdown-border/dropdown-border.css`. |
| `tokyo/product/dieter/components/dropdown-shadow/dropdown-shadow.css` | Regenerated from `dieter/components/dropdown-shadow/dropdown-shadow.css`. |
| `tokyo/product/dieter/components/valuefield/valuefield.css` | Regenerated from `dieter/components/valuefield/valuefield.css`. |
| `tokyo/product/dieter/components/segmented/segmented.css` | Regenerated from `dieter/components/segmented/segmented.css`. |
| `tokyo/product/dieter/components/segmented/segmented.spec.json` | Regenerated from `dieter/components/segmented/segmented.spec.json`. |
| `tokyo/product/dieter/components/dropdown-actions/dropdown-actions.css` | Regenerated from `dieter/components/dropdown-actions/dropdown-actions.css`. |
| `tokyo/product/dieter/components/dropdown-edit/dropdown-edit.css` | Regenerated from `dieter/components/dropdown-edit/dropdown-edit.css`. |
| `tokyo/product/dieter/components/textfield/textfield.css` | Regenerated from `dieter/components/textfield/textfield.css`. |
| `tokyo/product/dieter/components/textedit/textedit.css` | Regenerated from `dieter/components/textedit/textedit.css`. |
| `admin/src/html/foundations/colors.html` | Regenerated by `admin/scripts/generate-foundation-pages.mjs`. |
| `admin/src/html/components/segmented.html` | Regenerated from `dieter/components/segmented/segmented.spec.json`. |
| `roma/tests/fixtures/124c-base-package-expected.json` | Expected output fixture; update only if source-generated output changes. |

## Explicit Non-Scope

Do not touch:

- `roma/app/api/**`;
- `bob/app/api/**`;
- Roma/Bob save, publish, translation generation, account, auth, or data flows;
- `tokyo-worker/**`;
- account runtime data under `accounts/{accountPublicId}/**`;
- Cloudflare Pages/Worker/R2 deploy paths;
- Supabase migrations;
- dark-mode UI, dark-mode toggle, or dark-mode palette work;
- contrast gates, runtime validators, product probes, token resolver registries,
  or governance scripts.

## V1-V8 Risk Map

| ID | 126B risk | Paths most exposed | Control |
| --- | --- | --- | --- |
| V1 Silent substitution | Missing token replaced with invented color. | undefined-token table. | Use exact PRD/audit replacements only; no invented fallback values. |
| V2 Silent healing | Undefined names preserved as aliases. | `--color-surface`, `--color-bg`, `--state-muted-opacity`. | Delete/replace bad references; do not add compatibility aliases. |
| V3 Silent omission | Widgets/docs/DevStudio/generated output missed from color blast radius. | `tokyo/product/widgets/**`, `admin/scripts/**`, UI docs. | Audit includes classification and docs table; implementation must reconcile each touched authority. |
| V4 Fail-open control | CSS fallbacks hide missing token truth. | Countdown, dropdown opacity, socialShare fallbacks. | Fix 126B-owned undefined refs; classify legal widget fallbacks instead of treating them as system truth. |
| V5 Corruption-as-absence | Unsupported dark behavior or missing tokens treated as optional absence. | docs, Bob theme field, component dark blocks. | Remove source dark behavior listed in this audit; keep Bob field non-affordance; fix missing tokens. |
| V6 Partial-success masquerade | DevStudio shows rows as writable when write lane rejects them. | generator and generated color page. | Non-writable rows render read-only/static; write lane stays narrow. |
| V7 Masquerade/redress | Dark artifacts renamed as dark-ready support. | `color.md`, `dieter.md`, Bob theme field, Dieter dark CSS. | Remove source dark CSS/example affordances and readiness claims; no scaffolding. |
| V8 Runtime test dependency | Normal product work depends on contrast checks or validation rituals. | docs/checks. | Contrast is evidence only; no runtime gates or validators. |

## Audit Verdict

Before this audit existed, 126B still left too much classification to the future
executor. The current PRD must consume this audit and expose exact role values,
exact undefined-token replacements, exact DevStudio reveal/write behavior, and
file-level blast radius before any 126B implementation pass begins.
