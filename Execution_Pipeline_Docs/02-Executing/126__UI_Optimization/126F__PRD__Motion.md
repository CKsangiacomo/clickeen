# 126F - PRD: Motion

Status: PRE-EXECUTION READY - three-lane review green.
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA).
Series order: 126F of 126A-126M.
KB doc: `documentation/engineering/UI/motion.md`.

This PRD is the execution authority for 126F motion. It is filled from Codex
and GLM Step 1 as-built evidence, Step 3 official-source research, and human
product direction. It decides the motion standard, names the current gaps, and
defines the blast radius for execution.

126F execution must make source and docs match this PRD. It must not create a
motion framework, `MotionProvider`, choreography library, animation registry,
enter/exit pattern library, shared animation runtime, imported Material/Apple
motion system, or widget-runtime motion doctrine.

## Step Inputs

- Step 1 Codex as-built: `audits/126F__AsBuilt_Codex.md`.
- Step 1 GLM as-built: `audits/126F__AsBuilt_GLM.md`.
- Step 3 Codex research: `research/126F_Research_Codex.md`.
- Step 3 GLM research: `research/126F_Research_GLM.md`.
- Step 4 Codex pre-execution audit: `audits/126F__Audit__Motion.md`.
- Current living doc: `documentation/engineering/UI/motion.md`.
- Dieter motion source: `dieter/tokens/dieter-foundation-tokens.css`.

## Role

126F owns Clickeen system motion mechanics: Dieter duration tokens, Dieter
easing decisions, system transition usage, system reduced-motion behavior,
system JS-driven visual motion, loading/progress motion in Clickeen chrome, and
host-compatible motion constraints for future agent-hosted UI.

126F does not own every interaction state; those belong to 126E. It owns the
motion behavior used to express those states.

126F does not own public-widget runtime motion. Public widgets are independent
product software with widget-specific JS/CSS/runtime behavior. A widget may
implement ticker, carousel, countdown, animation, interpolation, or any other
motion its product behavior needs. That motion is widget-owned behavior, not
Dieter/system motion doctrine.

126F is intentionally small. Clickeen does not need a motion engine, animation
framework, choreography library, or imported Material/Apple motion system.
Clickeen needs the existing small Dieter/system motion surface to be clean,
documented, and deterministic so agents stop inventing local timing and easing
inside system UI.

## Pre-GA Cleanup Tenet

Clickeen is pre-GA. Once the 126F motion standard is decided, execution cleans
source and docs to that standard.

- Fix source and docs to this PRD.
- Remove stale duration/easing paths and stale doc claims from active code/docs.
- Do not support old and new motion behavior in parallel.
- Do not add guards/checks/deny lists to preserve behavior that should no
  longer exist.
- Do not document removed behavior as a living option.

Compliance reason: agents need one current system-motion truth. A catalog of
old timing/easing paths gives agents leeway to reintroduce them.

## Current Reality Summary

Clickeen has a real but thin motion substrate, plus many local motion decisions.

The strong current evidence:

- `dieter/tokens/dieter-foundation-tokens.css:79-82` defines exactly three
  motion duration tokens: `--duration-snap`, `--duration-base`, and
  `--duration-spin`.
- `dieter/tokens/dieter-foundation-tokens.css:98-106` defines the global
  reduced-motion guard.
- `--duration-base` is consumed by many Dieter components, including
  dropdown-fill, textfield, textedit, popover, toggle, tabs, dropdown-actions,
  and repeater.
- `--duration-snap` is consumed by Prague `StepsPrimitive`, so it is not
  globally dead. Prague also consumes `--duration-base` in `InstanceEmbed` and
  public primitives. Prague is a real duration-token blast radius if foundation
  duration tokens change.
- Generated Tokyo Dieter token/component output mirrors inspected source.
- Some Dieter components have component-local reduced-motion blocks or hard
  transition disables. Their selector alignment is not proven as a coherent
  system.

The split current reality:

- No functional foundation easing token exists.
- `--easing-standard` appears only as fallback references.
- Button/menuactions/textrename/repeater/Bob/Roma/Admin CSS contain literal
  system motion values.
- Segmented owns a component-local `180ms cubic-bezier(...)` transition variable.
- Repeater writes inline JS `style.transition` shorthands.
- Public widgets include separate carousel/ticker/autoplay/RAF/countdown motion,
  but that is widget-owned runtime behavior, not Dieter/system motion.
- Admin has a local reduced-motion guard copy and local sidebar motion.

The current weak evidence:

- `--duration-spin` is not proven as an active consumer in inspected source.
- `--duration-snap` has a Prague consumer and must be treated as a real blast
  radius before any repoint/removal decision.
- Reduced-motion behavior is not proven for JS-written inline system
  transitions.
- Motion docs describe intent more than source reality and mislabel the easing
  gap as a 126A deliverable.

## Human-Converged Product Reading

The 126F problem is not "add animation." Clickeen system UI has very little
motion today, and that is the correct product posture for now. System motion is
used by some Dieter components and Clickeen chrome. That is enough.

The problem is that the small amount of Dieter/system motion is not cleanly
governed. Agents have been able to add local literal timings, local easing, and
inline JS transitions inside system UI without one deterministic Clickeen rule.

Public widgets are not the same problem. A widget is independent product
software. Its runtime JS can be different per widget because each widget has its
own product behavior. Widget motion belongs to that widget's implementation and
documentation, not to 126F Dieter/system motion doctrine.

For Clickeen this matters because:

- Agents need named motion primitives they can use without inventing local
  timing.
- Builder/Roma operational UI should feel stable and readable, not animated for
  decoration.
- Widget runtime motion must not be confused with Dieter/system motion.
- Agent-hosted UI must respect host constraints and tool-state lifecycles.
- Reduced motion must apply where system motion actually happens, including
  JS-driven system motion.

126F therefore defines a small motion law, not a broad motion system.

The current systemic motion patterns Clickeen keeps are:

- operational UI state transitions in Dieter/components;
- simple open/close or show/hide transitions where a component already needs
  them;
- continuous/progress motion only where a real Clickeen system surface already
  owns it.

New motion patterns may be added later only when a real product surface needs
them. They must be added as named product/component behavior, not as generic
motion machinery.

## Converged Clickeen Motion Standard

### Small Motion Law

Target law:

- Clickeen motion stays minimal and purposeful.
- System motion exists only to clarify state change, reveal/hide a component,
  communicate real progress/activity, or orient the user during simple UI
  changes.
- Motion must not be decorative in operational UI.
- Do not create a motion framework, `MotionProvider`, generic choreography
  system, animation registry, enter/exit pattern library, or shared animation
  runtime.
- Component PRDs own any future component-specific choreography. 126F owns the
  tokens, reduced-motion law, and lane rules those components must follow.

Compliance reason:

- This keeps Clickeen lean and agent-operable. It gives agents deterministic
  rules without reinterpreting the task into an ideal animation system.

### System Motion And Widget Runtime Boundary

Target law:

- System motion means Bob/Roma/DevStudio/Admin chrome and Dieter components.
  System motion uses Dieter motion tokens only.
- Public-widget runtime motion means customer-facing widget behavior such as
  carousel, ticker, autoplay, count interpolation, or other widget-owned runtime
  motion.
- Public-widget runtime motion is outside Dieter/system motion doctrine. Widgets
  can use whatever motion their product behavior needs through their own JS/CSS
  runtime.
- A widget may deliberately consume Dieter tokens for shared shell styling, but
  that does not make the widget's independent runtime behavior subject to
  Dieter motion tokens.
- Widget motion requirements, including any reduced-motion behavior, belong to
  the owning widget implementation/docs or widget PRD.
- Generated Tokyo Dieter files are deploy output, not a second motion source
  authority.
- Account content/assets are not Dieter motion. If a future account-authored
  surface exposes motion as content behavior, that behavior needs its own
  product authority and cannot be smuggled in through component CSS.

Compliance reason:

- This follows current architecture: Dieter owns operational UI primitives,
  while public widgets own customer-visible runtime behavior. It prevents the
  forbidden move of forcing independent widget JS into an invented universal
  motion doctrine.

### Duration Tokens

Target law:

- Operational UI transition durations must reference Dieter `--duration-*`
  tokens. Do not use literal `ms`/`s` values in operational component CSS when
  the motion is ordinary UI transition behavior.
- The current duration set remains small: `--duration-snap`,
  `--duration-base`, and `--duration-spin`.
- Do not expand the duration scale preemptively.
- A new duration token is allowed only when a real component/product motion
  need exists and the human accepts it as Clickeen law.
- Existing dead or unproven duration tokens must be reconciled during execution:
  wire them to a real named use or remove/repoint the stale token. Do not keep
  dead tokens as supported doctrine.

Execution gap targets:

- Remove literal operational UI durations such as 80ms, 120ms, 140ms, 150ms,
  180ms, 220ms, 240ms, and 280ms where they are ordinary component/chrome
  transitions.
- Tokenize the high-traffic button/menuactions/textrename/repeater/Bob/Roma/
  Admin operational UI transition literals against the decided Dieter duration
  law.
- Reconcile `--duration-snap` and `--duration-spin` with actual consumers.
  `--duration-snap` currently has a Prague consumer; execution must verify
  whether that use remains legitimate before any repoint/removal. If any token
  has no product/component use, execution must not preserve it as dead legacy
  surface.

Compliance reason:

- This solves the actual gap: agents currently have no deterministic answer for
  "how long should this transition be?" It does not import a larger duration
  taxonomy Clickeen does not need.

### Easing

Target law:

- Clickeen uses one foundation standard easing token for ordinary operational
  UI transitions.
- `--easing-standard` is the intended foundation token name because it is
  already referenced as a fallback in current Dieter source.
- 126F standardizes `--easing-standard: ease`. That is the current effective
  fallback behavior, so this removes the dangling-token masquerade without
  changing Clickeen product feel.
- Material and Apple easing/physics guidance is useful research input, not
  automatic Clickeen law.
- Operational UI must not use bare `ease` or component-local custom curves as
  product doctrine once `--easing-standard` is defined.
- 126F does not preserve component-local easing exceptions. If a future
  component PRD needs a component-specific curve, it must name that product
  behavior explicitly and cannot inherit the current segmented local curve as
  precedent.

Execution gap targets:

- Define `--easing-standard: ease` in the Dieter foundation token source.
- Replace fallback-only `--easing-standard` references so they resolve to the
  real foundation token.
- Replace bare `ease` in operational UI transitions with the foundation token.
- Replace the segmented component's local `cubic-bezier(...)` curve with the
  standard easing token. Do not promote it to product law in 126F.
- Do not rewrite Logo Showcase or other widget-specific JS easing into Dieter
  easing. That is widget-owned runtime behavior unless the widget PRD says
  otherwise.

Compliance reason:

- This fixes the real easing gap with one named token while preserving current
  behavior. It avoids importing M3's full easing taxonomy, choosing a new feel
  by AI preference, or creating a choreography layer.

Execution gate:

- Execution must not invent a different easing curve from Material, Apple,
  OpenAI, or a local component curve.
- A future change from `ease` to another Clickeen product-feel value is a new
  human product decision, not part of 126F cleanup.

### Reduced Motion

Target law:

- Reduced motion is a real system motion-behavior requirement for the Dieter/
  system motion Clickeen actually has.
- Reduced motion must remove or neutralize movement, translation, scale,
  and JS-driven system animation where those create moving behavior.
- Simple opacity fades may remain when they clarify state and do not create
  spatial movement.
- CSS global reduced-motion rules are not enough when system motion is written
  by JS.
- Any system JS that writes inline transitions or drives animation must check
  `prefers-reduced-motion: reduce` and choose the reduced behavior directly.
- Public-widget reduced-motion behavior is widget-owned. It must be specified
  by the owning widget runtime/docs, not by Dieter motion tokens.

Execution gap targets:

- Verify and fix the global reduced-motion guard against actual moving elements.
- Remove the Admin duplicate global reduced-motion rule if it is stale
  duplication rather than an owned local need.
- Fix reduced-motion coverage for JS-written transitions in repeater behavior.
- Fix any selector mismatch where reduced-motion disables a different element
  than the element that actually transitions.

Compliance reason:

- This makes reduced-motion truthful at the system behavior site instead of
  claiming coverage from a broad CSS rule that may not govern JS system motion.

### Operational UI Consumers

Target law:

- Bob, Roma, DevStudio, Admin, and Dieter components consume Dieter motion
  tokens for operational UI transitions.
- Operational UI may use motion for state clarity and simple component
  orientation only.
- Operational UI must not add decorative animation, local timing systems, local
  easing systems, or copied product-specific literals.
- Loading/progress visual primitives belong to 126I and interaction semantics
  belong to 126E. 126F owns the duration/easing/reduced-motion behavior used by
  those primitives once they exist.

Execution gap targets:

- Remove duplicated Roma/Bob literal `transform 150ms ease` cluster-icon motion
  and route it through Dieter/component law.
- Remove Admin sidebar local motion drift or document/fix it as an operational
  UI consumer of Dieter motion tokens.
- Ensure the living motion doc tells agents exactly which token to use for
  normal operational UI transitions.

Compliance reason:

- This keeps product chrome stable and deterministic while leaving component
  visual design to the component/UI PRDs that own it.

### Public Widget Runtime Boundary

Target law:

- Public-widget runtime motion is allowed when it is part of widget product
  behavior.
- Public-widget runtime motion is not governed by Dieter operational UI duration
  or easing tokens when the motion is independent widget behavior such as ticker
  duration, carousel timing, autoplay, count interpolation, animation, or
  widget-specific JS.
- Widgets can use whatever motion their product behavior requires, because each
  widget is independent product software with its own runtime.
- Widget motion must be explicit in that widget's implementation/docs. Agents
  must not treat widget motion as a precedent for system UI motion.
- Widget motion must not claim progress, success, or activity that is not real
  widget/product state.

Execution gap targets:

- Document that current public-widget ticker/carousel/autoplay/RAF/countdown
  motion is widget-owned runtime behavior, outside Dieter/system motion law.
- Remove any 126F wording or docs that imply Dieter tokens govern independent
  widget runtime motion.
- If a widget PRD later decides reduced-motion behavior for that widget, that
  decision belongs to the widget lane, not 126F Dieter/system motion.

Compliance reason:

- This preserves widget product capability and independent runtime architecture
  without bloating Dieter motion tokens or pretending public widget behavior is
  the same as Bob/Roma/DevStudio/Admin chrome motion.

## Detailed Execution Blast Radius

Execution must inspect and update this blast radius as needed. If a listed path
does not contain a current hit, execution records that it was checked and leaves
it alone.

| Area | Owner | Exact paths | Verify | Must not change |
| --- | --- | --- | --- | --- |
| Dieter foundation motion | 126F / Dieter source | `dieter/tokens/dieter-foundation-tokens.css`; `dieter/tokens/tokens.css` | Search for `--duration-*`, `--easing-standard`, and `prefers-reduced-motion`; run `pnpm build:dieter` after source changes. | Do not expand the duration scale preemptively or import an external easing taxonomy. |
| Generated Dieter token output | Generated from Dieter source | `tokyo/product/dieter/tokens/**` including `tokens.css`, `tokens.shadow.css`, per-token CSS, and matching `*.shadow.css` files | Confirm generated output changed only through `pnpm build:dieter`. | Do not hand-edit generated Tokyo Dieter output. |
| Generated Dieter component output | Generated from Dieter source | `tokyo/product/dieter/components/button/button.css`; `tokyo/product/dieter/components/menuactions/menuactions.css`; `tokyo/product/dieter/components/textrename/textrename.css`; `tokyo/product/dieter/components/repeater/repeater.css`; `tokyo/product/dieter/components/repeater/repeater.js`; `tokyo/product/dieter/components/segmented/segmented.css`; `tokyo/product/dieter/components/dropdown-fill/dropdown-fill.css`; `tokyo/product/dieter/components/dropdown-border/dropdown-border.css`; `tokyo/product/dieter/components/dropdown-shadow/dropdown-shadow.css`; `tokyo/product/dieter/components/dropdown-edit/dropdown-edit.css`; `tokyo/product/dieter/components/dropdown-upload/dropdown-upload.css`; `tokyo/product/dieter/components/dropdown-actions/dropdown-actions.css`; `tokyo/product/dieter/components/textfield/textfield.css`; `tokyo/product/dieter/components/textedit/textedit.css`; `tokyo/product/dieter/components/valuefield/valuefield.css`; `tokyo/product/dieter/components/popover/popover.css`; `tokyo/product/dieter/components/toggle/toggle.css`; `tokyo/product/dieter/components/tabs/tabs.css` | Confirm generated output mirrors the edited Dieter source after build. | Do not hand-edit generated Tokyo Dieter output. |
| Dieter tokenized component motion | 126F / Dieter components | `dieter/components/dropdown-fill/dropdown-fill.css`; `dieter/components/dropdown-border/dropdown-border.css`; `dieter/components/dropdown-shadow/dropdown-shadow.css`; `dieter/components/dropdown-edit/dropdown-edit.css`; `dieter/components/dropdown-upload/dropdown-upload.css`; `dieter/components/dropdown-actions/dropdown-actions.css`; `dieter/components/textfield/textfield.css`; `dieter/components/textedit/textedit.css`; `dieter/components/valuefield/valuefield.css`; `dieter/components/popover/popover.css`; `dieter/components/toggle/toggle.css`; `dieter/components/tabs/tabs.css`; `dieter/components/repeater/repeater.css` | Search these files for `transition`, bare `ease`, and `var(--duration-base`; verify ordinary transitions use decided Dieter motion law. | Do not create component-local motion systems. |
| Dieter literal motion | 126F / Dieter components | `dieter/components/button/button.css`; `dieter/components/menuactions/menuactions.css`; `dieter/components/textrename/textrename.css`; `dieter/components/repeater/repeater.css` | Search for `150ms`, `140ms`, `80ms`, and bare `ease`; replace ordinary operational literals with decided tokens. | Do not preserve literal timing as a parallel path. |
| Segmented local curve | 126F / Dieter components | `dieter/components/segmented/segmented.css` | Search for `--seg-transition` and `cubic-bezier`; replace the local curve with the standard easing token. | Do not silently promote a component-local curve to product law. |
| JS-driven system motion | 126F / Dieter components | `dieter/components/repeater/repeater.js` | Search for `style.transition`; verify direct `prefers-reduced-motion` handling if JS keeps motion. | Do not rely on tests or the global CSS guard as runtime behavior for JS-written motion. |
| Bob operational chrome | 126F / Bob chrome | `bob/app/bob_app.css` | Search for `transition`, `150ms`, `120ms`, and `ease`; route operational chrome motion through Dieter motion law. | Do not change Bob interaction semantics owned by 126E. |
| Roma operational chrome | 126F / Roma chrome | `roma/app/roma.css` | Search for `transition`, `150ms`, `120ms`, and `ease`; route operational chrome motion through Dieter motion law. | Do not change Roma account/domain state semantics owned by 126E. |
| Admin / DevStudio chrome | 126F / Admin chrome | `admin/src/css/layout.css`; `admin/src/css/utilities.css` | Search for `transition` and `prefers-reduced-motion`; reconcile sidebar motion and duplicate global reduced-motion guard. | Do not keep duplicate global reduced-motion rules or local motion drift as a separate doctrine. |
| Prague Dieter token consumers | Prague / website consumer | `prague/src/components/StepsPrimitive.astro`; `prague/src/components/InstanceEmbed.astro`; `prague/public/styles/primitives.css` | Search for `--duration-snap`, `--duration-base`, and `--duration-spin`; if duration tokens are changed, verify Prague still uses the decided token law. | Do not treat Prague token consumption as proof that Dieter/system chrome needs extra motion doctrine. |
| Public widget runtime inspect-only boundary | Widget PRDs / widget docs | `tokyo/product/widgets/logoshowcase/widget.css`; `tokyo/product/widgets/logoshowcase/widget.client.js`; `tokyo/product/widgets/logoshowcase/spec.json`; `tokyo/product/widgets/split-carousel-media/widget.client.js`; `tokyo/product/widgets/split-carousel-media/widget.css`; `tokyo/product/widgets/split-carousel-media/spec.json`; `tokyo/product/widgets/countdown/widget.client.js`; `tokyo/product/widgets/countdown/spec.json`; `tokyo/product/widgets/cards/widget.css`; `tokyo/product/widgets/shared/stagePod.js`; `tokyo/product/widgets/shared/socialShare.js`; `tokyo/product/widgets/shared/socialShare.css` | Inspect only to document that carousel/autoplay/RAF/countdown/social-share motion is widget-owned runtime behavior outside 126F. | Do not rewrite widget runtime motion to Dieter tokens in 126F. |
| Public widget docs inspect-only boundary | Widget PRDs / widget docs | `documentation/widgets/widgets/logoshowcase.md`; `documentation/widgets/widgets/split-carousel-media.md`; `documentation/widgets/widgets/countdown.md`; `documentation/widgets/widgets/README.md`; `documentation/widgets/README.md`; `documentation/widgets/shared/ShellCore.md`; `documentation/widgets/authoring/ToolDrawerControls.md` | Verify docs do not imply Dieter/system motion governs independent widget runtime behavior. | Do not document widget runtime motion as Dieter/system doctrine. |
| Living motion docs | 126F docs | `documentation/engineering/UI/README.md`; `documentation/engineering/UI/motion.md`; `documentation/engineering/UI/dieter.md`; `documentation/services/dieter.md`; `documentation/services/devstudio.md`; `documentation/engineering/UI/interactions.md`; `documentation/engineering/UI/components.md` | Search for stale `126A`, duration-scale expansion, missing widget/system boundary, and DevStudio/Admin authority drift. | Do not document removed or widget-owned behavior as Dieter/system doctrine. |

## Required Documentation Repairs

Execution must repair these known doc falsehoods:

- `documentation/engineering/UI/motion.md` currently says completing
  `--easing-standard` is a 126A deliverable. Easing is 126F.
- `documentation/engineering/UI/README.md` currently maps motion to 126A. Motion
  is 126F.
- `documentation/engineering/UI/motion.md` currently implies the 126 series will
  complete a duration scale. 126F says the current duration set stays small and
  must not expand preemptively.
- `documentation/engineering/UI/motion.md` must distinguish Dieter/system motion
  from public-widget runtime motion.
- `documentation/services/devstudio.md` or related UI docs must not imply
  DevStudio has a separate motion authority; Admin/DevStudio chrome source is
  `admin/src/css/layout.css` and `admin/src/css/utilities.css` for the current
  126F blast radius.

## V1-V8 Pre-Execution Controls

| ID | 126F risk | Required control |
| --- | --- | --- |
| V1 Silent substitution | Dangling `--easing-standard` silently falls back to `ease` and masquerades as a real token. | Define `--easing-standard: ease` as current-behavior preservation, then replace fallback-only claims. |
| V2 Silent healing | Motion cleanup normalizes local timing without exposing changed behavior. | Execution must name each changed motion site in the blast radius and verify visual ownership. |
| V3 Silent omission | `--duration-spin`, the Prague `--duration-snap` consumer, or JS-driven motion gaps are ignored. | Reconcile dead/unproven tokens, current Prague token consumption, and JS motion explicitly. |
| V4 Fail-open control | Reduced-motion behavior fails open for JS-written transitions or duplicate local guards. | JS-driven system motion must check `prefers-reduced-motion` directly; duplicate guards are reconciled. |
| V5 Corruption-as-absence | Not applicable to persisted product data in 126F. | Do not touch product data. |
| V6 Partial-success masquerade | Widget/system motion claims false progress, success, or activity. | Motion must reflect real state; widget motion docs must not claim fake progress/activity. |
| V7 Masquerade/redress | Local literals or widget runtime motion are renamed as Dieter doctrine. | Replace/remove local system literals; keep widget runtime motion outside 126F. |
| V8 Runtime test dependency | Normal reduced-motion behavior depends on tests/probes instead of runtime code. | Runtime code/CSS carries the reduced-motion behavior; checks only verify execution. |

## Verification Checklist

Execution is not complete until these checks are run and reconciled:

- Search Dieter source for operational `transition` literals in the blast radius.
- Search Dieter source for `--easing-standard` references and definitions.
- Search for active `--duration-snap` and `--duration-spin` consumers.
- Search `prague/src/components/StepsPrimitive.astro`,
  `prague/src/components/InstanceEmbed.astro`, and
  `prague/public/styles/primitives.css` for Dieter duration-token consumers
  before changing/removing any duration token.
- Search `dieter/components/repeater/repeater.js` for JS-written transition
  shorthands and reduced-motion handling.
- Search Bob/Roma/Admin chrome for operational motion literals.
- Verify `admin/src/css/layout.css` and `admin/src/css/utilities.css` are covered
  for Admin/DevStudio motion.
- Search `documentation/engineering/UI/README.md` and
  `documentation/engineering/UI/motion.md` for stale `126A`, duration-scale
  expansion, and widget/system boundary errors.
- Run `pnpm build:dieter` after source motion changes.
- Run focused lint/type checks for changed Dieter/Bob/Roma/Admin files if code
  changes occur in execution.
- After merged code changes that affect Bob, Roma, Prague, DevStudio/Admin app
  source, verify Cloudflare Pages Git build state and cloud-dev runtime surface
  checks for the owning Pages project.
- After merged code changes that affect Tokyo Dieter generated output or product
  roots, verify the GitHub Actions `cloud-dev workers deploy` R2 sync step and
  R2 evidence through the repo Cloudflare command path.
- Verify no motion framework, choreography registry, shared animation runtime,
  or widget-motion token doctrine was added.

### Source Research Bar

Current official-source input:

- Material frames motion as purposeful state/spatial orientation and publishes
  duration/easing guidance.
- Apple treats motion as comfort/stability behavior and exposes Reduce Motion
  and Prefer Cross-Fade Transitions.
- OpenAI Apps SDK hosted UI is iframe/bridge/host-state constrained; motion
  should reflect tool and widget state, not independent animation narrative.

Converged implication:

- Clickeen evaluates Dieter/system motion by purpose, state truth, token
  consistency, reduced-motion behavior, and host constraints.
- Official source values are research inputs and north stars, not automatic
  Clickeen token tables.
- Clickeen keeps motion small because the product is an operational,
  agent-operated system, not an animation-heavy consumer app.

Compliance reason:

- This uses original-source research only and applies it through Clickeen
  product authority instead of importing another company's motion system.

## Out Of Scope For This PRD

- No product data repair.
- No generated deploy as part of the PRD text update itself.
- No motion framework, animation registry, `MotionProvider`, or choreography
  library.
- No imported Material/Apple/OpenAI motion system.
- No broad animation redesign.
- No new duration scale unless later execution proves and human accepts a real
  component/product need.
- No visual primitive decisions owned by 126I.
- No interaction-state decisions owned by 126E.

## GLM Input Integrated

GLM's independent as-built and research passes are integrated into the
converged standard above. This section preserves the high-signal findings that
shaped the final product law.

### What Codex's baseline gets right
- "three duration tokens and a global reduced-motion guard exist" — correct, verified
  `dieter-foundation-tokens.css:79-106`.
- "no easing tokens; literal `120ms`/`150ms ease` remains in product/component CSS" — correct
  in spirit: the four product-UI literals (`roma.css:378,445`; `bob_app.css:280,463`) and the
  button/menuactions `150ms` literals (`button.css:34,215,344`; `menuactions.css:34`) confirm this.

### What Codex under-claims / misses
1. **Duration-token reconciliation.** Codex lists "three duration tokens" as current reality
   but under-specifies consumer reality. The pre-execution sweep found `--duration-snap`
   consumers in `prague/src/components/StepsPrimitive.astro` and additional
   `--duration-base` consumers in Prague `InstanceEmbed` and `primitives.css`, so Prague is
   part of the duration-token blast radius. `--duration-spin` still has no proven source
   consumer. A "complete the easing scale" deliverable that adds more tokens without first
   reconciling current token usage would make this worse.
2. **The button — the highest-traffic component — is not tokenized at all.** Codex's
   "several Dieter components consume `--duration-base`" is true but masks that `button.css`
   uses literal `150ms ease` in three identical five-property blocks (`:34-39`, `:215-219`,
   `:344-349`) and consumes zero tokens. `150ms` matches no token (snap=140, base=160). This is
   a stronger statement than Codex's "literal timings remain."
3. **The only non-`ease` easing in the codebase is hidden inside a component.**
   `segmented/segmented.css:17,67,105` defines `--seg-transition: 180ms cubic-bezier(0.76, 0.05,
   0.24, 0.95)` — a component-local token, not a foundation token. Codex's "no easing tokens"
   is true at the foundation layer but incomplete: there *is* an easing decision already made,
   and it lives in the wrong place. 126F decides to replace it with `--easing-standard: ease`
   instead of promoting it to product law.
4. **JS-driven motion bypasses the reduced-motion guard.** Codex's "reduced-motion coverage is
   unverified beyond the global guard" is correct but understated. GLM's audit identifies a
   concrete instance: `repeater/repeater.js:594,665,707` writes inline `style.transition`
   strings (`140ms ease`, `80ms ease`) at runtime. The global `*` media-query rule
   (`dieter-foundation-tokens.css:99-106`) only sets `transition-duration`/`animation-duration`
   with `!important`; whether that reliably beats a runtime inline `transition` shorthand is a
   specificity edge case GLM flagged rather than asserted. Either way this is a *named,
   locatable* gap, not an unspecified one.
5. **`--easing-standard` is referenced as a fallback twice** (`dropdown-fill.css:254,287`) but
   never defined — so it always resolves to `ease`. This is the single sharpest evidence that
   the easing layer is non-functional, and Codex's baseline does not name it.
6. **Roma/Bob copy-paste drift.** `roma.css:378` and `bob_app.css:280` are the same rule
   (`transform 150ms ease` on `.diet-btn-ic__icon`) duplicated across products. Codex's
   "product/component CSS" lumps these together; the drift point — same selector, same literal,
   two files — is a tokenization target worth naming.

### What Needed Correction During Pre-Execution
- Component-local reduced-motion blocks do exist in current source:
  `segmented.css`, `textrename.css`, `toggle.css`, `textfield.css`, `tabs.css`,
  and `valuefield.css`. The correct execution target is not to pretend they do
  not exist; it is to verify selector alignment and remove any stale local
  duplication that does not correspond to actual movement.
- `--duration-snap` has a Prague consumer. The correct execution target is not
  "delete both non-base tokens blindly"; it is to verify current consumers and
  remove/repoint only tokens with no legitimate product/component use.

### Where evidence is thin (for both passes)
- Runtime behaviour of the global `*` `!important` rule vs. inline `style.transition`
  (`repeater.js`) is not verified in either pass. Flagged, not asserted.
- No Dieter/Bob/Roma/Admin system `@keyframes`/`animation` was found in the inspected system
  source. Public widgets do have animation/RAF/ticker behavior, and that remains outside 126F.
  There is no system spinner/entrance/exit animation to audit despite the `--duration-spin`
  token implying one was intended.

### Net
Codex's baseline direction (easing is the gap; literals remain; reduced-motion
needs checking) is right. It was under-specified: it did not name Prague
duration-token consumers, the un-tokenized button, the hidden segmented bezier,
the dangling `--easing-standard` references, the repeater JS reduced-motion
hole, or the Roma/Bob duplication. Those targets are integrated into the
converged standard and execution gap targets above.
