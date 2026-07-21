# 126B - PRD: Color

Status: PRE-EXECUTION STEPS 6-8 COMPLETE - exact-tree review green at
`4b480e50`; no Step-9 execution credit.
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

Earlier changes already closed the exact token-integrity, named hardcode,
DevStudio read-only reveal, Dieter dark-artifact, and living-document defects.
Those changes are current as-built input, not Step-9 execution credit. The
current-source audit found only three bounded 126B gaps: Bob retains an unused
theme shape and direct status primitives, Logo Showcase bypasses the focus role
at one link-focus site, and DevStudio's generated reveal accepts more hex shapes
than its write API. Broader component and surface adoption belongs to the named
126I, 126L, and 126M owners. Contrast remains evidence for human review, not
AI-enforced doctrine.

## Resolved Audit Correction

The Codex as-built audit incorrectly claimed that
`dieter/tokens/dieter-color-tokens.css` was malformed at the opening comment and
that early role/state tokens might be inactive CSS.

That is resolved: the opening CSS comment closes before `:root`, and
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
  formula;
- a palette ramp or contrast sibling used only as a modifier on an explicitly
  named semantic status when the current role layer has no value-equivalent
  surface/contrast role. The status base meaning must still use its semantic
  role.

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
- The generator renders non-writable role/focus/state rows as static source
  truth, but its current 3-8-digit hex check can still mark color values
  writable that the backend rejects.
- `admin/functions/_shared/dieter-tokens.js` accepts only `^--color-` tokens
  with hex values.

Step-9 target:

- Preserve the narrow write lane.
- Non-`^--color-` rows and values outside exact three- or six-digit hex do not
  render `data-token-edit="color"`.
- `admin/src/html/foundations/colors.html` is regenerated from the corrected
  generator; current six-digit source values should produce no output diff.
- Do not hand-edit generated reveal output.

Why this is compliant: this prevents masquerade and partial-success claims
without creating a broader token editor project. DevStudio UI/write-lane
changes beyond read-only truth belong to 126L or a DevStudio-specific PRD.

## Dark Mode Law

Clickeen is light-mode by current product contract. Current Dieter source and
examples contain no dark behavior. Bob's remaining `theme: 'light' | 'dark'`
preview field is unused: it is posted to widgets, but no widget message receiver
reads it. Step 9 deletes that field, its default, its Workspace plumbing, and its
documentation. It is not preserved as internal shape or future scaffolding.

126B adds no dark tokens, provider, toggle, media selector, compatibility path,
readiness claim, or verification lane. A future dark-mode product decision needs
its own PRD.

## Official Source Research Boundary

External design systems support the small pattern already chosen here:
primitive color -> semantic role -> component/surface consumption. They do not
authorize a Material taxonomy import, Apple dynamic-color clone, OpenAI visual
clone, global brand-as-primary rule, or automated contrast enforcement.

## Final Executable Plan

The Step-6 current-source audit is the file-level authority. Step 9 must execute
these slices independently and in order. A failed gate stops the domain; later
slices do not begin.

### Slice B1 - Bob Color Truth And Theme Deletion

Change only:

- `bob/lib/session/sessionTypes.ts`: delete `PreviewSettings.theme` and its
  default;
- `bob/components/Workspace.tsx`: delete unused theme reads, refs, message
  properties, dependencies, and reset dependency;
- `bob/app/bob_app.css`: delete the audited unused editable-title, title-input,
  rename-error, and every dead `.settings-panel__*` selector; keep the only live
  `.settings-panel__error`, replace only its value-equivalent base red
  border/text references with `--role-error`, and preserve its pale background
  and geometry;
- `bob/components/ToolDrawer.tsx`: replace only value-equivalent session-error
  border/text red with `--role-error`; preserve its pale background;
- `documentation/services/bob.md`: remove `theme` from the documented preview
  message;
- `documentation/engineering/UI/color.md`: record the narrow legal use of a
  palette ramp/contrast sibling as a modifier only when a semantic status base
  is already role-backed and no value-equivalent modifier role exists.

Do not change widget state, locale, typography, device, host, iframe lifecycle,
save, translation, Copilot, account, or product-data behavior.

Green gate:

1. Local scans prove all audited dead selectors and the theme path are absent;
   Bob typecheck/lint/build and relevant focused tests are green; living color
   doctrine matches the modifier rule.
2. Local browser proof covers preview device switching and iframe updates;
   intercepted failed save exercises the live ToolDrawer session error without
   a remote product write.
3. Commit and push occur before cloud proof.
4. `pnpm cf:api:preflight` is green. Bob and Roma Pages latest deployment commit
   hashes and the Roma cloud-dev workflow `head_sha` equal the B1 commit.
   Deployed Roma Builder proves preview behavior and a captured
   `ck:state-update` has no `theme` property.

### Slice B2 - Logo Showcase Focus Role

Change only `tokyo/product/widgets/logoshowcase/widget.css`: the logo-link focus
outline uses `--role-focus`. The active carousel dot remains the widget's blue
product default.

Green gate:

1. Widget validation/build, `pnpm tokyo:r2:sync:check`,
   `pnpm --filter @clickeen/roma test:instance-package`, and keyboard focus
   browser proof are green. Only the Logo Showcase CSS expectation changes in
   the package fixture.
2. Commit and push occur before cloud proof.
3. `pnpm cf:preflight` is green. The `cloud-dev workers deploy`, Roma
   cloud-dev, and Prague cloud-dev workflow `head_sha` values equal the B2
   commit and are green.
4. R2 read-back proves
   `product/widgets/logoshowcase/widget.css` contains `--role-focus` and no
   longer contains the old focus declaration. Do not read, rematerialize, or
   edit a published account instance for this proof.

### Slice B3 - DevStudio Reveal/Write Predicate Parity

Change only `admin/scripts/generate-foundation-pages.mjs`: writable color rows
accept exactly three- or six-digit hex values, matching the existing backend
contract in `admin/functions/_shared/dieter-tokens.js`.

Update `documentation/engineering/UI/color.md` and
`documentation/services/devstudio.md` from ambiguous "literal hex" wording to
the exact three- or six-digit write contract.

`admin/functions/_shared/dieter-tokens.js` is read-only evidence. Regenerate
`admin/src/html/foundations/colors.html`; current six-digit source data should
produce no generated diff.

Green gate:

1. Source comparison proves generator and backend use the same 3/6-digit value
   shape; `pnpm build:devstudio` is green; generated output is unchanged.
2. Commit and push occur before cloud proof.
3. `pnpm cf:api:preflight` is green and the DevStudio Pages latest deployment
   commit hash equals the B3 commit.
4. Deployed color foundations reveal current source colors as editable and
   role/focus/state rows as read-only. Current product tokens contain no invalid
   hex shapes, so source comparison plus the build owns invalid-shape parity.

## Exact Blast Radius

| Direct Step-9 files | Read-only authorities | Routed, not 126B |
| --- | --- | --- |
| `bob/lib/session/sessionTypes.ts` | `dieter/tokens/dieter-color-tokens.css` | Dieter component-wide adoption -> 126I |
| `bob/components/Workspace.tsx` | `tokyo/product/widgets/shared/runtime.js` | Broad DevStudio chrome -> 126L |
| `bob/app/bob_app.css` | `tokyo/product/widgets/shared/branding.js` | Broad Roma chrome -> 126M |
| `bob/components/ToolDrawer.tsx` | `tokyo/product/widgets/shared/socialShare.js` | Other Bob controls -> 126I; hosted ToolDrawer/workspace screen -> 126M |
| | `bob/components/TopDrawer.tsx` and `bob/components/td-menu-content/useTdMenuHydration.ts` | |
| `documentation/services/bob.md` | `admin/functions/_shared/dieter-tokens.js` | Prague marketing copy -> Prague content authority |
| `tokyo/product/widgets/logoshowcase/widget.css` | `dieter/tokens/dieter-color-tokens.css` | User-authored/widget appearance color -> unchanged |
| `roma/tests/fixtures/124c-base-package-expected.json` | `roma/tests/instance-package-fixtures.ts` | Published account instance rematerialization -> forbidden proof mutation |
| `admin/scripts/generate-foundation-pages.mjs` | `documentation/engineering/CloudflareOperations.md` | |
| `documentation/engineering/UI/color.md` | `.github/workflows/cloud-dev-workers.yml` | |
| `documentation/services/devstudio.md` | `.github/workflows/cloud-dev-roma-app.yml` | |
| | `.github/workflows/cloud-dev-prague-app.yml` | |
| `admin/src/html/foundations/colors.html` only if generation changes it | GitHub Actions and Pages runtime evidence | |

No Dieter token or generated Tokyo Dieter file should change. No R2 account
instance, overlay, translation, Supabase, Tokyo-worker, San Francisco, Berlin,
Roma source, or product data is in scope.

## V1-V8 Pre-Execution Controls

- **V1:** no missing role or theme truth is replaced with an invented value.
- **V2:** delete the unused theme path; do not alias or normalize it.
- **V3:** each slice names source, generated, documentation, deploy, and runtime
  proof surfaces.
- **V4:** DevStudio reveal uses the same accepted value shape as its write API.
- **V5:** invalid color shapes remain non-writable instead of becoming absent or
  silently corrected.
- **V6:** local success is not deploy success; every slice requires pushed cloud
  evidence.
- **V7:** unsupported dark behavior is deleted, not renamed as readiness.
- **V8:** checks prove the product but do not become product runtime dependencies.

## Done For 126B

126B Step 9 is done only after all three slices are independently green and the
final exact tree proves:

- Bob no longer carries or documents an unused theme capability;
- Bob's named status chrome and Logo Showcase focus use existing semantic roles;
- DevStudio reveal and write authority accept the same color value shapes;
- the palette, token source, generated Dieter product output, user-authored
  colors, product data, and unrelated runtime behavior did not change;
- living docs remain accurate; and
- the final V1-V8 audit is green.

## Compliance With Clickeen Architecture And Product Law

- One source authority remains: Dieter owns color; consumers reference meaning.
- Deletion wins over preserving an unsupported theme shape.
- Reveal truth matches write truth without a new framework.
- Each direct change is small, behavior-specific, and independently deployable.
- Human authority over palette, contrast, product content, and future dark-mode
  scope remains intact.
