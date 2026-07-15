# 126B - PRD: Color

Status: PRE-EXECUTION DOCTRINE RECORDED - step-5 living doctrine reconciled; step-6/7/8 artifacts pending; no step-9 execution credit.
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA).
Series order: 126B of 126A-126M.
KB doc target: `documentation/engineering/UI/color.md`.
Step 6 audit: `audits/126B__Audit__Color.md`.

This PRD is the execution-grade color-system authority for the 126 UI
Optimization Program after pre-execution review. It is filled from Codex and
GLM as-built audits, official-source research, and human product decisions.

126B does not authorize a palette redesign, dark-mode rollout, contrast gate,
theme platform, resolver, registry, or governance framework. It defines the
color source truth and deterministic color consumption rules that make Clickeen
UI agent-operable.

## Step Inputs

- Step 1 Codex as-built: `audits/126B__AsBuilt_Codex.md`.
- Step 1 GLM as-built: `audits/126B__AsBuilt_GLM.md`.
- Step 3 Codex research: `research/126B_Research_Codex.md`.
- Step 3 GLM research: `research/126B_Research_GLM.md`.
- Codex step-6 execution audit: `audits/126B__Audit__Color.md`.
- Current living doc: `documentation/engineering/UI/color.md`.
- Source token authority: `dieter/tokens/dieter-color-tokens.css`.
- Generated runtime output: `tokyo/product/dieter/tokens/*`.

The step-6 audit is binding for execution scope. If a path is not in this PRD
or in `audits/126B__Audit__Color.md`, it is outside 126B unless the human
amends this PRD before execution. Execution must not use this PRD as permission
to search the whole codebase and make new color decisions in flight.

## Role

126B owns Clickeen's color-system truth:

- Dieter color source authority;
- generated Tokyo color output truth;
- semantic color role names;
- foreground/background relationships;
- state color mechanics;
- status color semantics;
- brand/accent boundaries;
- user-authored color versus structural chrome color;
- DevStudio color reveal truth;
- undefined color/state token cleanup;
- color documentation accuracy.

126B is not:

- palette redesign;
- dark-mode work;
- dark-mode scaffolding or prework;
- AI-enforced contrast;
- M3 role taxonomy import;
- OpenAI-hosted UI clone;
- user-content color purge;
- color validation framework;
- product data work.

Color is an inner-doll domain. Dieter owns color truth. Tokyo publishes
generated product output. Roma, Bob, DevStudio, and widgets consume the token
contract. If screens hand-patch structural color, the matrioska chain breaks
and agents start inventing UI.

## 126 Pre-GA No Legacy Compatibility Tenet

Clickeen is pre-GA. This PRD must not preserve old UI drift through
compatibility shims, temporary aliases, parallel legacy paths, or "support both
old and new" transitions unless the human explicitly makes that behavior
product law in this PRD.

Once the 126B color standard is decided:

- Fix source and docs to the standard.
- Remove old drift and stale paths.
- Do not leave legacy names, classes, render paths, token aliases, wrappers, or
  local one-offs as supported alternatives.
- Do not add guard/check machinery to enforce this tenet. The PRD is the
  authority; execution must clean code and docs instead of preserving bad paths
  behind validation.

## Human Decisions

- **No redesign.** 126B does not pick a new palette or new visual language.
- **No dark mode.** Clickeen is light-mode by current product contract. 126B
  does not ship dark mode, prepare dark-mode scaffolding, create dark token
  pairs, verify dark mode, or preserve dark artifacts as supported behavior.
- **No AI contrast enforcement.** Contrast/readability findings are evidence for
  human design review only. Codex/GLM must not change palette values from WCAG
  math or source research.
- **No M3/OpenAI cloning.** Material, Apple, and OpenAI are source references.
  They do not override Clickeen product authority.
- **User-authored color is legal.** Color picker values, widget appearance
  values, gradients, shadows, and serialized user-authored color are not
  structural chrome violations.
- **Structural chrome must be deterministic.** System UI color must resolve to
  Dieter source tokens, exact semantic roles, or the explicit state formula.

## Current Reality

Clickeen has a strong color system already:

- Dieter owns color tokens in `dieter/tokens/dieter-color-tokens.css`.
- `dieter/tokens/tokens.css` imports foundation, color, and typography.
- `scripts/build-dieter.js` copies Dieter tokens into Tokyo product output.
- Roma, Bob, DevStudio, and public widgets consume Dieter/Tokyo token output.
- The palette has structure: Apple-like base hues, neutral ladders, OKLAB ramps,
  state mix controls, contrast sibling tokens, and a small semantic role layer.

Premature A-H changes already closed the exact token-integrity, named hardcode,
DevStudio reveal, unsupported dark-artifact, and living-document defects. Those
changes are current as-built input, not step-9 execution credit. The remaining
real gap is consumer adoption: some components and surfaces still bypass the
existing semantic role/state layer and consume primitive colors directly.
Contrast remains evidence for human review, not AI-enforced doctrine.

## Resolved Audit Correction

The Codex as-built audit incorrectly claimed that
`dieter/tokens/dieter-color-tokens.css` was malformed at the opening comment and
that early role/state tokens might be inactive CSS.

That is resolved: the `*/` on line 10 closes the opening CSS comment, and
`:root` plus `--color-text`, `--role-surface`, `--focus-ring-color`, and the
state controls are active CSS.

The header and role/state source are now AI-legible. Step 6 verifies current
source and must not schedule that completed cleanup again.

## Required Direction

### 1. Color Source Truth

Dieter color tokens are the source authority. Tokyo output is generated product
output. Roma, Bob, DevStudio, and widgets are consumers, not color authorities.

Execution rules:

- Color values originate in Dieter source tokens.
- Generated output must match source after `pnpm build:dieter`.
- Consumers must not define competing structural color truth.
- Docs explain the model but do not override source.

Why this is compliant: Clickeen is agent-operated. Agents need one named color
authority, not scattered screen-level styling decisions.

### 2. AI-Legible Token Source

The color token source must be readable by agents without ambiguity.

Execution rules:

- Clean confusing token comments/headers in source.
- Keep generated output matched to source through the Dieter build.
- Do not add a parser, validator, or governance layer for this cleanup.

Why this is compliant: this improves agent-operability without adding framework
machinery or reinterpretation.

### 3. Exact Semantic Role Layer

126B defines this small Clickeen role layer. These exact token names and values
are the execution target. Values are the current light-mode contract only; they
are not dark-mode scaffolding and they are not contrast doctrine.

| Token | Value | Meaning |
| --- | --- | --- |
| `--role-surface` | `var(--color-system-white)` | foreground content surface |
| `--role-on-surface` | `var(--color-system-black)` | primary content on a foreground surface |
| `--role-surface-bg` | `var(--color-system-white)` | app/page/workspace background surface |
| `--role-surface-muted` | `var(--color-system-gray-6-step4)` | subdued panel, preview, and code/path surface |
| `--role-border` | `var(--color-system-gray-5)` | standard structural border |
| `--role-text` | `var(--color-text)` | primary text |
| `--role-text-secondary` | `var(--color-text-secondary)` | supporting text |
| `--role-focus` | `var(--focus-ring-color)` | focus indicator color when focus is styled |
| `--role-primary-action` | `var(--color-system-blue)` | primary action fill/accent |
| `--role-on-primary-action` | `var(--color-system-white)` | content on primary action fill |
| `--role-error` | `var(--color-system-red)` | error/destructive status color |
| `--role-on-error` | `var(--color-system-white)` | content on error fill when needed |
| `--role-success` | `var(--color-system-green)` | success status color |
| `--role-on-success` | `var(--color-system-white)` | content on success fill when needed |
| `--role-warning` | `var(--color-system-orange)` | warning status color |
| `--role-on-warning` | `var(--color-system-white)` | content on warning fill when needed |
| `--role-info` | `var(--color-system-blue)` | informational status color |
| `--role-on-info` | `var(--color-system-white)` | content on info fill when needed |
| `--role-muted` | `var(--color-text-secondary)` | low-emphasis text/icon/border color |
| `--role-selected-fill` | `var(--color-system-blue-5)` | selected/current item fill |
| `--role-selected-text` | `var(--color-system-blue)` | text/icon on selected fill |
| `--role-selected-border` | `var(--color-system-blue)` | selected/current border |
| `--role-disabled-fill` | `var(--color-system-gray-6-step5)` | unavailable control fill |
| `--role-disabled-text` | `color-mix(in oklab, var(--color-system-black), transparent 60%)` | unavailable text/icon |
| `--role-disabled-border` | `var(--color-system-gray-6)` | unavailable border |

Existing `--color-text`, `--color-text-secondary`, and `--focus-ring-color`
remain as current source tokens. 126B adds role aliases for deterministic
consumption; it does not create compatibility aliases for undefined names.

Do not import the full M3 taxonomy. Do not create a role resolver, registry, or
theme platform.

Why this is compliant: roles are structured substrate. They let agents operate
the UI by product meaning instead of inventing color choices.

### 4. Role And Primitive Consumption

Structural UI chrome should use Dieter tokens and roles. Components may use
primitive color tokens only for named cases where the primitive itself is the
product truth.

Allowed primitive-use cases:

- color picker swatches and color-system reveal rows;
- DevStudio/source-inspection UI that is explicitly showing a primitive token;
- component plumbing that immediately resolves into an allowed role/state
  formula.

The default direction is role-based consumption.

Focus indicator color uses `--role-focus`; it is not a primitive-color
exception.

Execution rules:

- Component-local aliases such as `--btn-bg`, `--btn-hover-bg`, or
  `--tile-selected-bg` are allowed only as plumbing.
- Local aliases must resolve back to Dieter roles, allowed primitives, or the
  Dieter state formula.
- Local aliases do not become color authority.

Why this is compliant: this reduces AI guessing and keeps the color contract
inside Dieter instead of per-component local decisions.

### 5. Exact State Color Mechanics

Hover, pressed, muted, inactive, selected, and disabled color must be boring and
explicit. Components must not invent local darken/lighten recipes.

Existing Dieter state tokens:

- `--state-darken-target`
- `--state-lighten-target`
- `--state-hover-mix`
- `--state-pressed-mix`
- `--state-muted-mix`
- `--state-inactive-mix`

Required formula:

| State | Meaning | Required color rule |
| --- | --- | --- |
| Default | normal enabled component state | use the base semantic role or allowed primitive token unchanged |
| Hover | pointer/intent preview on enabled interactive controls | `color-mix(in oklab, <base>, var(--state-darken-target) var(--state-hover-mix))` |
| Pressed | active mouse/touch press on enabled interactive controls | `color-mix(in oklab, <base>, var(--state-darken-target) var(--state-pressed-mix))` |
| Muted | lower-emphasis text, icon, border, or supporting chrome | `color-mix(in oklab, <base>, var(--state-lighten-target) var(--state-muted-mix))` or `--role-muted` |
| Inactive | present but not currently active/current | `color-mix(in oklab, <base>, var(--state-lighten-target) var(--state-inactive-mix))` |
| Selected | chosen/current item | use `--role-selected-fill`, `--role-selected-text`, and `--role-selected-border`; selected hover/pressed derive from selected fill using the same hover/pressed formulas |
| Disabled | unavailable control or action | use `--role-disabled-fill`, `--role-disabled-text`, and `--role-disabled-border`; disabled controls do not receive hover/pressed state colors |
| Focus | focus indicator where focus is styled | use `--role-focus`; focus does not replace hover/pressed/selected color |

Forbidden state-color patterns:

- hardcoded hover/pressed/selected/disabled hex values in component chrome;
- custom per-component state percentages;
- direct raw `black`/`white` state mixes instead of Dieter state target tokens;
- opacity-only disabled styling unless backed by an explicit Dieter disabled
  state role;
- one-off selected blue tints outside selected semantic roles;
- hover/pressed effects on disabled controls;
- undefined state references such as `--state-muted-opacity`.

Why this is compliant: state color is operational behavior. Agents need a small
repeatable spec for simple UI states instead of re-deciding color per component.

### 6. Keep User-Authored Color Legal

Raw color is not automatically a violation.

Legitimate user/content color includes:

- color picker swatches;
- user-selected widget colors;
- gradient stops;
- shadow values that are part of user-authored appearance;
- serialized user-authored colors in widget/runtime data.

Structural chrome hardcodes are different and must be tokenized or explicitly
resolved to a Dieter role/primitive.

Completed structural chrome cleanup, retained as regression evidence:

- `admin/src/css/dieter-previews.css` uses `var(--role-surface-muted)` at the
  two former structural-gray sites.
- `admin/src/css/layout.css` keeps the existing `0 24px 32px` shadow geometry
  and sources its shadow color through
  `color-mix(in oklab, var(--color-system-black), transparent 72%)`.

Widget runtime defaults/fallbacks must be documented separately as
user/content defaults or runtime fallbacks, not mixed with chrome violations.

Current legal user-authored/inspector color hits are classified in
`audits/126B__Audit__Color.md` and must not be purged: Dieter color picker
swatches/placeholders, picker gradients, selected color serialization, shadow
color serialization, text editor shadow fallback, and widget `spec.json`
product defaults.

Current widget runtime fallback/default colors are also classified in the audit:
`tokyo/product/widgets/shared/appearance.js`,
`tokyo/product/widgets/shared/stagePod.js`,
`tokyo/product/widgets/shared/socialShare.css`, and the Countdown widget default.
126B fixes only the Countdown undefined token reference; it does not redesign
widget appearance or create widget color doctrine.

Implementation re-runs the same raw-color scan after changes only as
verification that no new structural hardcodes were introduced.

Why this is compliant: Clickeen serves user-authored content and widgets.
Product/user content color is not the same authority as application chrome.

### 7. Resolved Undefined Color/State Integrity Defects

Undefined references are integrity bugs. Current source contains zero references
to the resolved names below. Preserve that absence; do not restore aliases.

| Historical token | Historical owner path | Current requirement |
| --- | --- | --- |
| `--color-surface` | `dieter/components/button/button.css` | Resolved to `--role-surface`; keep the old name absent. |
| `--color-bg` | `admin/src/css/layout.css` | Resolved to `--role-surface-bg`; keep the old name absent. |
| `--color-system-gray-7` | `roma/app/roma.css` | Resolved to `--role-surface-muted`; do not extend the gray ladder. |
| `--color-system-gray-10` | Countdown source/generated fixture | Resolved to `--color-system-gray-6-step5`; keep the old name absent. |
| `--state-muted-opacity` | dropdown border/shadow | Resolved to the preserved literal `0.45`; do not invent an alias. |
| `--state-hover-target` | living color doc | Resolved to `--state-darken-target`; do not document nonexistent state-target names. |

Non-color token spelling issues belong to their owning PRDs and must not be
preserved in color docs.

Why this is compliant: missing token truth creates silent substitution and
corruption-as-absence risk. Agents must not build on undefined names.

### 8. Contrast Evidence Is Human-Owned

Contrast findings are advisory evidence for human design review.

126B may expose:

- weak foreground/background pairings;
- existing `-contrast` sibling tokens;
- places where `-contrast` tokens are defined but unused;
- likely effect of switching a token reference.

126B must not:

- make AI-enforced color decisions from contrast findings;
- mechanically switch to `-contrast` tokens;
- add contrast gates;
- claim WCAG compliance.

Why this is compliant: this follows 126A's human-owned contrast decision and
prevents agents from turning source research into doctrine.

### 9. DevStudio Reveal/Write Truth

126B chooses the narrow outcome:

- DevStudio may reveal source-backed color, role, focus, and state rows.
- Rows that the current write path cannot edit must not render as editable token
  controls. They render as static/read-only source truth.
- 126B does not expand DevStudio write authority.
- 126B does not narrow source truth to only editable rows.

Current baseline:

- `admin/scripts/generate-foundation-pages.mjs` reads
  `dieter/tokens/dieter-color-tokens.css`, parses custom properties, and reveals
  `--color-*`, `--role-*`, `--focus-*`, and selected `--state-*` rows.
- The generator renders non-writable role/focus/state/non-hex rows as static
  source truth rather than editable controls.
- `admin/functions/_shared/dieter-tokens.js` accepts only `^--color-` tokens
  with hex values.

Completed baseline to preserve:

- Preserve the narrow write lane.
- Non-`^--color-` rows and non-hex rows do not render
  `data-token-edit="color"`.
- `admin/src/html/foundations/colors.html` reflects the corrected generator.
- Do not hand-edit generated reveal output.

Why this is compliant: this prevents masquerade and partial-success claims
without creating a broader token editor project. DevStudio UI/write-lane
changes beyond read-only truth belong to 126L or a DevStudio-specific PRD.

## Dark Mode Law

Clickeen is light-mode by current product contract.

Observed dark-mode artifacts are not support:

- Bob has a typed `theme: 'light' | 'dark'` field and defaults to light.
- Some Dieter components contain local dark selectors.
- Generated segmented examples contain a `dark` segment value as example content.
- There is no complete Dieter-owned dark-mode token contract.
- Roma, Bob, and DevStudio must not be described as supporting dark mode today.
- No UI may expose a dark-mode toggle, setting, or affordance from these
  artifacts unless a later dark-mode PRD ships a complete supported dark
  palette and behavior contract.

Current dark artifact paths are listed in `audits/126B__Audit__Color.md`.
Execution removes source-level Dieter dark CSS blocks and dark-mode example
affordances:

- remove `@media (prefers-color-scheme: dark)` from
  `dieter/components/valuefield/valuefield.css`;
- remove `@media (prefers-color-scheme: dark)` and `[data-theme="dark"]`
  selectors from `dieter/components/segmented/segmented.css`;
- remove `@media (prefers-color-scheme: dark)` from
  `dieter/components/dropdown-actions/dropdown-actions.css`;
- remove `@media (prefers-color-scheme: dark)` from
  `dieter/components/dropdown-edit/dropdown-edit.css`;
- remove `@media (prefers-color-scheme: dark)` from
  `dieter/components/textfield/textfield.css`;
- remove `@media (prefers-color-scheme: dark)` from
  `dieter/components/textedit/textedit.css`;
- replace the segmented component `Theme/Light/Dark` icon-only example in
  `dieter/components/segmented/segmented.spec.json` with a `View/Grid/List`
  example using approved existing icons `circle.grid.2x2` and
  `line.3.horizontal.decrease.circle`;
- regenerate generated Dieter/Admin outputs from source.

Bob's typed `theme: 'light' | 'dark'` field remains only as current internal
session shape. 126B does not expose it, document it as product support, or use
it as dark-mode scaffold.

126B explicitly excludes:

- dark-mode implementation;
- dark-mode scaffolding or prework;
- dark token pairs;
- full adaptive palette design;
- `light-dark()` migration;
- M3 tone inversion;
- Apple dynamic color cloning;
- global OpenAI-hosted dark-mode rules for internal Clickeen tools;
- claims that Roma, Bob, DevStudio, or widgets support dark mode.

If dark mode is desired later, it needs its own PRD. 126B must not preserve dark
artifacts as supported behavior or describe Clickeen as dark-ready.

Why this is compliant: this acknowledges existing artifacts without letting
agents reinterpret 126B into a dark-mode project.

## Official Source Research Boundary

Material, Apple, and OpenAI are source references, not automatic Clickeen law.

Useful source takeaways:

- role-based color is a strong pattern;
- primitive -> semantic -> component layering is a strong pattern;
- status colors need semantic meaning;
- brand/accent color must not collide with structural text/background meaning;
- OpenAI-hosted surfaces have host-specific color expectations.

Non-adopted by default:

- full M3 26-role taxonomy;
- M3 global brand-as-primary doctrine;
- OpenAI grayscale-primary rule for all internal Clickeen tools;
- dark mode for all Clickeen surfaces;
- automated WCAG/contrast enforcement.

Why this is compliant: research informs Clickeen doctrine; it does not replace
human product authority.

## Detailed Blast Radius

126B step-6 audit may inspect only the color-related truth surface below.
Completed cleanup entries are regression evidence; remaining implementation is
limited to role/state adoption proven by the final gap audit.

| Area | May change | Must not change |
| --- | --- | --- |
| `dieter/tokens/dieter-color-tokens.css` | header cleanup, exact role/state token definitions, undefined color/state cleanup | palette redesign, dark palette, contrast enforcement values |
| `dieter/tokens/tokens.css` | verify import integrity; no expected change | new token pipeline or resolver |
| `tokyo/product/dieter/tokens/*` | generated output from `pnpm build:dieter` | hand edits to generated output |
| `dieter/components/**/*.css` | structural color refs, role/state formula adoption, undefined color/state ref cleanup | component behavior rewrites, visual redesign, keyboard/focus work |
| `bob/app/**`, `bob/components/**` | structural chrome color refs only where 126B-owned, status color role usage if already present | save flow, translation generation, preview runtime, product data |
| `bob/lib/compiler/media.ts` | no expected change; verify generated Dieter media remains by-reference if touched by build docs | compiler behavior change |
| `roma/app/**`, `roma/components/**` | structural chrome color refs only where 126B-owned | account routes, save/publish/data behavior, Roma UI refactor outside 126M |
| `admin/src/css/**` | hardcoded structural chrome colors only where listed in the file-level table | DevStudio write authority expansion, UI redesign |
| `admin/src/html/foundations/colors.html` | generated/revealed text through generation only | hand-edit generated truth that should come from source |
| `admin/functions/_shared/dieter-tokens.js` | verify current write lane only; no expected 126B change | broad token editor expansion |
| `admin/scripts/generate-foundation-pages.mjs` | make non-writable role/focus/state rows static/read-only in generated color reveal | new governance framework |
| `tokyo/product/widgets/**` | classify runtime defaults/fallbacks in docs; change only if a structural chrome color is proven inside product UI | purge user-authored color or widget runtime appearance values |
| `documentation/engineering/UI/color.md` | rewrite to current 126B law | dark-ready claims, contrast compliance claims, stale token/path documentation |
| `documentation/engineering/UI/dieter.md` | remove/narrow dark-ready color claims | broad Dieter refactor |
| `documentation/engineering/UI/components.md` | cross-reference role/state color consumption rules | component API expansion not decided by 126I |
| `documentation/engineering/UI/interactions.md` | align selected/disabled/error/success/warning/info meaning with 126E | new interaction framework |
| `documentation/engineering/UI/accessibility.md` | keep contrast human-owned; no contrast gate | accessibility compliance expansion |
| `documentation/engineering/UI/ops.md` | only if build/generated-output wording changes | new ops governance system |
| `documentation/services/devstudio.md` | only if DevStudio reveal/read-only behavior changes | DevStudio product/write-lane expansion |

Current documentation reconciliation:

- `documentation/engineering/UI/color.md` now cites the correct 126B authority
  and records current role/state, light-mode, contrast, and undefined-token law.
- Non-color token issues such as `--radius-*` and `--hspace-*` remain routed to
  their owning PRDs and must not become 126B work.

### Completed File-Level Cleanup Baseline

Every row in this table describes cleanup already present in current source.
It is preserved as regression evidence only. The final executable PRD must not
repeat these actions unless step 6 proves a new current mismatch.

| File | Completed baseline action | Why 126B owns it |
| --- | --- | --- |
| `dieter/tokens/dieter-color-tokens.css` | Header and exact role tokens are current source truth. | Source color authority. |
| `dieter/components/button/button.css` | Button surfaces use `--role-surface`; no undefined `--color-surface` remains. | Dieter component consumes the defined semantic role. |
| `dieter/components/dropdown-border/dropdown-border.css` | Disabled opacity is explicit `0.45`; no undefined state token remains. | Avoids inventing a disabled-state framework. |
| `dieter/components/dropdown-shadow/dropdown-shadow.css` | Disabled opacity is explicit `0.45`; no undefined state token remains. | Avoids redesigning dropdown behavior. |
| `admin/src/css/layout.css` | DevStudio uses `--role-surface-bg`; the existing shadow geometry uses the token-derived black mix. | DevStudio chrome has no undefined/hardcoded structural color at these sites. |
| `admin/src/css/dieter-previews.css` | Both former raw gray sites use `var(--role-surface-muted)`. | DevStudio preview chrome consumes the semantic role. |
| `admin/scripts/generate-foundation-pages.mjs` | Non-writable role/focus/state/non-hex rows no longer render as editable color controls. | Generated reveal does not masquerade write authority. |
| `admin/src/html/foundations/colors.html` | Generated output reflects the corrected generator. | Generated reveal output; no hand edits. |
| `roma/app/roma.css` | The former undefined gray site uses `--role-surface-muted`. | Roma chrome consumes a defined role token. |
| `tokyo/product/widgets/countdown/widget.css` | Countdown uses defined `--color-system-gray-6-step5`. | Widget default no longer consumes an undefined token. |
| `roma/tests/fixtures/124c-base-package-expected.json` | Fixture reflects current bundled widget CSS. | Test fixture mirrors package output. |
| `dieter/components/valuefield/valuefield.css` | Unsupported dark-scheme behavior is absent. | Unsupported Dieter dark behavior does not survive. |
| `dieter/components/segmented/segmented.css` | Unsupported dark-scheme and `data-theme="dark"` behavior is absent. | Unsupported Dieter dark behavior does not survive. |
| `dieter/components/dropdown-actions/dropdown-actions.css` | Unsupported dark-scheme behavior is absent. | Unsupported Dieter dark behavior does not survive. |
| `dieter/components/dropdown-edit/dropdown-edit.css` | Unsupported dark-scheme behavior is absent. | Unsupported Dieter dark behavior does not survive. |
| `dieter/components/textfield/textfield.css` | Unsupported dark-scheme behavior is absent. | Unsupported Dieter dark behavior does not survive. |
| `dieter/components/textedit/textedit.css` | Unsupported dark-scheme behavior is absent. | Unsupported Dieter dark behavior does not survive. |
| `dieter/components/segmented/segmented.spec.json` | The example is `View/Grid/List` with approved operational icons. | DevStudio examples expose no dark-mode affordance. |
| `admin/src/html/components/segmented.html` | Generated output reflects the current segmented spec. | Generated component output; no hand edits. |
| `tokyo/product/dieter/components/segmented/segmented.spec.json` | Generated output reflects the current Dieter spec. | Generated component spec output; no hand edits. |
| `tokyo/product/dieter/tokens/*` | Generated token output reflects Dieter source. | Generated output remains source-derived. |
| `tokyo/product/dieter/components/button/button.css` | Generated button CSS reflects Dieter source. | Generated output remains source-derived. |
| `tokyo/product/dieter/components/dropdown-border/dropdown-border.css` | Generated dropdown CSS reflects Dieter source. | Generated output remains source-derived. |
| `tokyo/product/dieter/components/dropdown-shadow/dropdown-shadow.css` | Generated dropdown CSS reflects Dieter source. | Generated output remains source-derived. |
| `tokyo/product/dieter/components/valuefield/valuefield.css` | Generated output reflects Dieter source and contains no unsupported dark behavior. | Generated component output. |
| `tokyo/product/dieter/components/segmented/segmented.css` | Generated output reflects Dieter source and contains no unsupported dark behavior. | Generated component output. |
| `tokyo/product/dieter/components/dropdown-actions/dropdown-actions.css` | Generated output reflects Dieter source and contains no unsupported dark behavior. | Generated component output. |
| `tokyo/product/dieter/components/dropdown-edit/dropdown-edit.css` | Generated output reflects Dieter source and contains no unsupported dark behavior. | Generated component output. |
| `tokyo/product/dieter/components/textfield/textfield.css` | Generated output reflects Dieter source and contains no unsupported dark behavior. | Generated component output. |
| `tokyo/product/dieter/components/textedit/textedit.css` | Generated output reflects Dieter source and contains no unsupported dark behavior. | Generated component output. |
| `documentation/engineering/UI/color.md` | Living law records the correct PRD, role/state rules, light-mode boundary, human-owned contrast evidence, and 126B undefined-token ownership. | Living color doc. |
| `documentation/engineering/UI/dieter.md` | Living law makes no dark-ready color claim. | Dieter documentation matches 126B. |
| `documentation/engineering/UI/components.md` | Living law cross-references role/state color consumption without expanding component APIs. | Components consume color roles/states. |
| `documentation/engineering/UI/interactions.md` | Living law separates 126E interaction meaning from 126B state color. | Prevents state/color ownership drift. |
| `documentation/engineering/UI/accessibility.md` | Living law keeps contrast as human design evidence, not a gate. | Prevents AI contrast enforcement. |
| `documentation/engineering/UI/ops.md` | Source/generated authority wording is current. | Source/generated authority accuracy. |
| `documentation/services/devstudio.md` | DevStudio reveal/write wording is current. | DevStudio reveal/write truth. |

The following current raw-color hits are explicitly not 126B implementation
changes: Dieter color picker swatches and gradients, user-selected border/fill/
shadow color serialization, text editor shadow fallback, widget `spec.json`
product defaults, and shared widget runtime fallback colors documented in the
audit.

### Role/State Adoption Blast Radius

126B sets the color standard for every component and surface. It does not turn
the current 126B implementation pass into a vague whole-product color rewrite.
Known role/state bypass exists and must be closed by the owning execution slice
when that component or surface is executed.

This is not legacy compatibility. These paths are not blessed as alternatives.
They are the current adoption inventory for 126I components, 126L DevStudio, 126M
Roma, and Bob UI execution to consume with the 126B standard.

| Area | Current files with primitive/state color usage | Required future use of 126B |
| --- | --- | --- |
| Dieter components | `dieter/components/dropdown-fill/dropdown-fill.css`, `dieter/components/dropdown-upload/dropdown-upload.css`, `dieter/components/choice-tiles/choice-tiles.css`, `dieter/components/dropdown-shadow/dropdown-shadow.css`, `dieter/components/dropdown-shadow/dropdown-shadow.ts`, `dieter/components/bulk-edit/bulk-edit.css`, `dieter/components/repeater/repeater.js`, `dieter/components/repeater/repeater.css`, `dieter/components/popaddlink/popaddlink.css`, `dieter/components/textfield/textfield.css`, `dieter/components/agent-activity/agent-activity.css`, `dieter/components/button/button.css`, `dieter/components/popover/popover.css`, `dieter/components/tabs/tabs.css`, `dieter/components/textedit/textedit.css`, `dieter/components/slider/slider.css`, `dieter/components/menuactions/menuactions.css`, `dieter/components/toggle/toggle.css`, `dieter/components/dropdown-border/dropdown-border.css`, `dieter/components/dropdown-border/dropdown-border.ts`, `dieter/components/valuefield/valuefield.css`, `dieter/components/dropdown-edit/dropdown-edit.css`, `dieter/components/dropdown-actions/dropdown-actions.css`, `dieter/components/object-manager/object-manager.css`, `dieter/components/segmented/segmented.css`, `dieter/components/textrename/textrename.css` | 126I must apply role consumption and state formulas when these components are executed, except exact 126B token-integrity fixes listed above. |
| DevStudio chrome | `admin/src/css/utilities.css`, `admin/src/css/layout.css`, `admin/src/css/dieter-previews.css` | 126B fixes exact undefined/hardcoded entries; 126L applies broader DevStudio UI color adoption. |
| Bob UI | `bob/app/bob_app.css`, `bob/components/Workspace.tsx`, `bob/components/ToolDrawer.tsx`, `bob/components/CopilotPane.tsx` | Bob UI work must use 126B roles/states without changing save, translation, preview, or product data flows. |
| Roma UI | `roma/app/roma.css` | 126B fixes the exact undefined token; 126M applies broader Roma UI color adoption. |

## Verified Baseline And Remaining Gap

Current baseline includes the cleaned token header, generated-output parity,
the exact role/state definitions, resolved undefined names, named structural
hardcode cleanup, widget/runtime color classification, truthful DevStudio
reveal, removed dark artifacts, and current living docs.

The remaining gap is semantic role/state adoption in the exact 126I, 126L, and
126M consumers proven by step 6, plus human review of contrast evidence. This is
not permission for a whole-product color rewrite.

These are execution categories, not a license to build a resolver, validator,
registry, governance platform, theme system, or dark-mode scaffold.

## Known Gaps To Close

1. Role/state consumption remains thin in some component and surface consumers;
   step 6 must name exact current files/lines.
2. State color mechanics need adoption only through the owning 126I/126L/126M
   slices where current bypass is proven.
3. Contrast pair findings remain human review evidence, not AI enforcement.

## Out Of Scope For 126B Implementation

- Palette redesign.
- Full dark-mode implementation.
- Dark-mode scaffolding or prework.
- Claims that any Clickeen surface supports dark mode.
- Automated contrast gates that decide palette values.
- Full M3 taxonomy import.
- Global OpenAI hosted-UI rules for internal tools.
- Removal of legitimate user-authored colors.
- Color resolver/registry/governance platform.
- Product data changes.

## V1-V8 Pre-Execution Risk Controls

- **V1 silent substitution:** undefined color/state tokens must be replaced with
  real Dieter roles/formulas, not invented fallback values.
- **V2 silent healing:** do not normalize bad color references into supported
  aliases; remove or replace them.
- **V3 silent omission:** blast radius must include Dieter source, generated
  output, consumers, DevStudio, widgets classification, and docs.
- **V4 fail-open control:** CSS fallbacks must not hide missing source truth.
- **V5 corruption-as-absence:** missing tokens are bugs, not optional
  decoration.
- **V6 partial-success masquerade:** DevStudio must not reveal rows as writable
  if the write path cannot edit them.
- **V7 masquerade/redress:** dark-mode artifacts must not be renamed as support,
  readiness, or future-compatible scaffolding.
- **V8 runtime test dependency:** no contrast gates, validation rituals, or
  runtime probes become normal product dependencies.

## Execution Checklist

The final 126B execution/check slice is green only when it preserves the
completed baseline and closes only the current adoption gaps proven by step 6:

1. `dieter/tokens/dieter-color-tokens.css` is AI-legible and contains the exact
   role/state tokens required by this PRD.
2. `pnpm build:dieter` regenerates Tokyo Dieter token output from source.
3. Generated Tokyo token output matches Dieter source.
4. `pnpm build:devstudio` regenerates and verifies DevStudio generated surfaces
   when DevStudio generated color/foundation/component pages change.
5. `pnpm --filter @clickeen/roma test:instance-package` runs if
   `roma/tests/fixtures/124c-base-package-expected.json` changes.
6. The already-removed 126B undefined references remain absent; step 9 changes
   only newly proven semantic-role adoption gaps.
7. The completed structural-chrome replacements remain present; no duplicate
   cleanup is scheduled.
8. User-authored/widget runtime colors are classified separately from structural
   chrome and not purged.
9. DevStudio reveal continues rendering non-writable role/focus/state/non-hex
   rows as static/read-only source truth.
10. Contrast evidence remains evidence only; no AI-owned palette changes or
   gates are introduced.
11. Dieter source dark CSS blocks and dark-mode component examples listed in the
   file-level table are removed, and docs do not describe dark support,
   readiness, or scaffolding.
12. `documentation/engineering/UI/color.md` reflects this PRD.
13. Related UI docs listed in the blast-radius table do not contradict this PRD.
14. No compatibility aliases, legacy paths, validation frameworks, or
   dark-mode scaffolding are introduced.

## Done For 126B

126B is done when implementation makes the color system truthful and
agent-operable:

- Dieter color authority is explicit.
- Generated output matches Dieter source.
- Token comments/docs are AI-legible.
- The exact Clickeen semantic role layer is defined.
- Components and surface refactors have a clear, binding rule for role versus
  primitive token use.
- Hover, pressed, muted, inactive, selected, and disabled colors have the
  explicit Dieter-owned state recipe and adoption inventory.
- Undefined color/state token references are resolved.
- Structural raw chrome colors are replaced with exact 126B roles/formulas.
- User-authored color remains legal and documented.
- Contrast evidence is exposed without AI-owned palette decisions.
- DevStudio reveal/write behavior is truthful.
- Unsupported dark CSS/example affordances are removed, and dark mode is
  documented as not shipped and not in 126B scope.
- `documentation/engineering/UI/color.md` tells future agents how to code color
  deterministically without inventing palettes, states, contrast doctrine, or
  dark-mode work.

## Compliance With Clickeen Architecture And Product Law

- Lean and agent-operable: color is structured token truth, not per-screen
  styling.
- Source authority separation: Dieter owns color values; Tokyo publishes output;
  consumers consume; docs explain.
- No reinterpretation: 126B does not become palette redesign, dark-mode rollout,
  dark-mode prework, M3 clone, OpenAI clone, or contrast-enforcement machinery.
- No masquerade: DevStudio and docs must not claim capabilities that the source
  and write paths do not support.
- No silent substitution: undefined tokens are treated as bugs, not missing
  optional decoration.
- Human authority preserved: palette decisions, contrast decisions, and
  dark-mode product scope remain human-owned.
