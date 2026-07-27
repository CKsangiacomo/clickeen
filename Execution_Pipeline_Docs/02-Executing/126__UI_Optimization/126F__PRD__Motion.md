# 126F - PRD: Motion

Status: PRE-EXECUTION STEPS 6-8 COMPLETE - exact-tree review green at
`4c5458b4`; no Step-9 execution credit.
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA).
Series order: 126F of 126A-126M.
Execution dependency: 126G must be Step-9 GREEN before 126F begins.
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

126F does not own public-widget runtime choreography. Public widgets are
independent product software with widget-specific JS/CSS/runtime behavior. A
widget may implement ticker, carousel, countdown, animation, interpolation, or
other motion its product behavior needs. Every current widget template also
loads Dieter's token entrypoint, so the Dieter global CSS reduced-motion guard
is a shared baseline. Widget-specific behavior beyond that baseline remains
widget-owned, especially JS-driven motion.

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

Clickeen has a real, deliberately small motion substrate. Premature A-H code
changes already converged the inspected operational consumers onto it; those
changes are current as-built input and receive no step-9 execution credit.

The strong current evidence:

- `dieter/tokens/dieter-foundation-tokens.css` defines the active system-motion
  token set: `--duration-snap`, `--duration-base`, and `--easing-standard`.
- `dieter/tokens/dieter-foundation-tokens.css:98-106` defines the global
  reduced-motion guard.
- `--duration-base` is consumed by many Dieter components, including
  dropdown-fill, textfield, textedit, popover, toggle, tabs, dropdown-actions,
  and repeater.
- `--duration-snap` is consumed by Prague `StepsPrimitive`, so it is not
  globally dead. Prague also consumes `--duration-base` in `InstanceEmbed` and
  public primitives. Prague is a real duration-token blast radius if foundation
  duration tokens change.
- Bob, Roma, Prague, DevStudio, and widget materialization consume inspected
  Dieter source directly.
- Button, segmented, repeater, Bob, Roma, and Admin operational motion now
  consumes `--duration-base`, `--duration-snap`, and `--easing-standard`.
- Repeater still writes inline JS `style.transition` shorthands, but it checks
  `prefers-reduced-motion` directly before enabling them.
- Public widgets include separate carousel/ticker/autoplay/RAF/countdown
  motion. Widget package generation resolves declared Dieter CSS from source
  and materialization seals it into instance `styles.css`; public widgets do
  not fetch shared Dieter CSS. Independent widget choreography and JS behavior
  remain widget-owned.
- Current living motion doctrine records the exact system/widget boundary and
  token law.

Step 6 found one remaining implementation deletion: Bob and Dieter still
declare `gsap` even though current source has no GSAP import or runtime use.
It also found one reduced-motion selector gap: the live Dieter dropdown-fill
swatch animates `::after`, while the foundation guard currently targets only
real elements. Roma's historical `.widget-defaults-field--toggle` CSS has no
runtime markup consumer and is a 126M deletion target, not motion evidence. The
126G deletes the generated Dieter tree and moves app/widget consumers to direct
source compilation/materialization. Prague remains real blast radius before
any future duration-token change. After 126G is green, 126F fixes the exact
motion gaps and acts as a preservation/regression gate rather than repeating
the motion migration.

## Human-Converged Product Reading

The 126F problem is not "add animation." Clickeen system UI has very little
motion today, and that is the correct product posture for now. System motion is
used by some Dieter components and Clickeen chrome. That is enough.

The historical problem was that the small amount of Dieter/system motion was
not cleanly governed. Current source and living documentation now carry one
deterministic Clickeen rule. The final gap audit must verify that convergence
and must not schedule the completed migration again.

Public widgets are not the same product-motion problem. A widget is independent
product software and its runtime JS can differ because each widget has its own
behavior. Dieter still supplies the shared CSS reduced-motion baseline because
the widget templates load `dieter/tokens/tokens.css`; widget implementation and
documentation own behavior beyond that baseline.

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
- Public-widget runtime choreography is outside Dieter duration/easing doctrine.
  Widgets can use the motion their product behavior needs through their own
  JS/CSS runtime.
- Current widget templates load Dieter's token entrypoint. Its global CSS
  reduced-motion guard is therefore a shared runtime baseline, including for
  widget pseudo-elements after 126F execution.
- Widget JS and any behavior beyond that CSS baseline belong to the owning
  widget implementation/docs or widget PRD and must not bypass reduced motion.
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
- The current duration set remains small: `--duration-snap` and
  `--duration-base`.
- Do not add duration tokens preemptively.
- A new duration token is allowed only when a real component/product motion
  need exists and the human accepts it as Clickeen law.
- Existing dead or unproven duration tokens are not supported doctrine.

Current verification target:

- Both current duration tokens have real consumers. Step 6 verifies those
  consumers and finds regressions; it does not plan another duration migration.
- Prague is real blast radius before any future duration-token value, rename,
  or removal.

Compliance reason:

- This preserves the now-deterministic answer for ordinary operational motion:
  `--duration-snap`, `--duration-base`, and `--easing-standard`. It does not
  import a larger duration taxonomy Clickeen does not need.

### Easing

Target law:

- Clickeen uses one foundation standard easing token for ordinary operational
  UI transitions.
- `--easing-standard: ease` is current foundation law.
- Material and Apple easing/physics guidance is useful research input, not
  automatic Clickeen law.
- Operational UI must not use bare `ease` or component-local custom curves as
  product doctrine.
- 126F does not preserve component-local easing exceptions. If a future
  component PRD needs a component-specific curve, it must name that product
  behavior explicitly and cannot inherit the current segmented local curve as
  precedent.

Current verification targets:

- Verify system consumers continue to resolve through the foundation token.
- Verify no bare system easing, fallback-masked undefined easing, or custom
  operational curve has returned.
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
- Reduced motion must remove or neutralize non-essential animated movement,
  translation, scale, and JS-driven system animation.
- Direct manipulation remains functional and immediate. For example, a dragged
  repeater item must still follow the pointer; reduced motion removes its
  interpolation/transitions, not the user's positional control.
- Simple opacity fades may remain when they clarify state and do not create
  spatial movement.
- CSS global reduced-motion rules are not enough when system motion is written
  by JS.
- Any system JS that writes inline transitions or drives animation must check
  `prefers-reduced-motion: reduce` and choose the reduced behavior directly.
- Dieter's global CSS guard is the baseline for every current token-consuming
  widget. Widget-owned JS or additional motion must handle reduced motion at the
  behavior site when the CSS baseline cannot govern it.

Current verification targets:

- Verify the global and component-local reduced-motion selectors govern the
  elements that actually move.
- Verify repeater keeps its direct reduced-motion check for JS-written
  transitions.

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

Current verification targets:

- Bob, Roma, Admin, and Dieter operational transitions remain tokenized.
- The living motion doc continues to tell agents which token to use for normal
  operational UI transitions.

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

Current verification targets:

- Current docs classify ticker/carousel/autoplay/RAF/countdown motion as
  widget-owned runtime behavior outside Dieter/system motion law. Verify that
  boundary remains intact.
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
| Unused motion dependency | 126G / one package-graph edit, verified by 126F | `bob/package.json`; `dieter/package.json`; `pnpm-lock.yaml` | 126G removes both declarations and regenerates the lockfile once; 126F verifies zero active GSAP references and frozen-lockfile install. | Do not split package/lock ownership, replace GSAP, preserve a compatibility lane, or edit unrelated dependency versions. |
| Dieter foundation motion | 126F / Dieter source | `dieter/tokens/dieter-foundation-tokens.css`; `dieter/tokens/tokens.css`; direct consumers in Bob, Roma, Prague, DevStudio, and widget materialization | Search for `--duration-*`, `--easing-standard`, and `prefers-reduced-motion`; build affected consumers and verify generated widget `styles.css` contains no runtime `@import`. | Do not add duration tokens preemptively, create a generated Dieter mirror, or import an external easing taxonomy. |
| Dieter tokenized component motion | 126F / Dieter components | `dieter/components/dropdown-fill/dropdown-fill.css`; `dieter/components/dropdown-border/dropdown-border.css`; `dieter/components/dropdown-shadow/dropdown-shadow.css`; `dieter/components/dropdown-edit/dropdown-edit.css`; `dieter/components/dropdown-upload/dropdown-upload.css`; `dieter/components/dropdown-actions/dropdown-actions.css`; `dieter/components/textfield/textfield.css`; `dieter/components/textedit/textedit.css`; `dieter/components/valuefield/valuefield.css`; `dieter/components/popover/popover.css`; `dieter/components/toggle/toggle.css`; `dieter/components/tabs/tabs.css`; `dieter/components/repeater/repeater.css` | Search these files for `transition`, bare `ease`, and `var(--duration-base`; verify ordinary transitions use decided Dieter motion law. | Do not create component-local motion systems. |
| Historical literal-motion sites | 126F / Dieter components | `dieter/components/button/button.css`; `dieter/components/menuactions/menuactions.css`; `dieter/components/textrename/textrename.css`; `dieter/components/repeater/repeater.css` | Verify the completed token migration remains intact; `textrename` deletion belongs to 126I. | Do not repeat the completed migration or preserve literal timing as a parallel path. |
| Segmented motion | 126F / Dieter components | `dieter/components/segmented/segmented.css` | Verify the component consumes the foundation duration/easing tokens and reduced-motion behavior. | Do not silently promote a component-local curve to product law. |
| JS-driven system motion | 126F / Dieter components | `dieter/components/repeater/repeater.js` | Search for `style.transition`; verify direct `prefers-reduced-motion` handling if JS keeps motion. | Do not rely on tests or the global CSS guard as runtime behavior for JS-written motion. |
| Bob operational chrome | 126F / Bob chrome | `bob/app/bob_app.css` | Verify operational chrome continues to consume Dieter motion tokens. | Do not change Bob interaction semantics owned by 126E. |
| Roma operational chrome | 126F / Roma chrome | `roma/app/roma.css` | Verify operational chrome continues to consume Dieter motion tokens. | Do not change Roma account/domain state semantics owned by 126E. |
| Admin / DevStudio chrome | 126F / Admin chrome | `admin/src/css/layout.css`; `admin/src/css/utilities.css` | Verify operational chrome continues to consume Dieter motion tokens and no duplicate global reduced-motion rule returns. | Do not keep duplicate global reduced-motion rules or local motion drift as a separate doctrine. |
| Live Dieter pseudo-element consumer | 126F / Dieter and DevStudio | `dieter/components/dropdown-fill/dropdown-fill.css`; `admin/src/html/components/dropdown-fill.html`; `admin/src/main.ts` | On `https://devstudio.clickeen.com/#/dieter/dropdown-fill`, verify `.diet-dropdown-fill__swatch::after` keeps its ordinary transition and becomes immediate under reduced motion. | Do not use Roma's dead Widget Defaults selector as evidence or add a component-local duplicate guard. |
| Prague Dieter consumer | Prague / website consumer | `prague/src/layouts/Base.astro`; `prague/src/components/StepsPrimitive.astro`; `prague/src/components/InstanceEmbed.astro`; `prague/public/styles/primitives.css` | Verify the global selector change makes `StepsPrimitive` pseudo-element transitions immediate under reduced motion and preserves normal mode. | Do not edit Prague source or treat Prague consumption as a second motion authority. |
| Dieter icon read boundary | 126G / Tokyo public serving | `tokyo-worker/src/asset-utils.ts`; Bob/Roma icon-only routes | Verify the existing public Dieter surface remains limited to `/dieter/icons/svg/**`; 126F does not alter it. | Do not expose token/component/editor files or broaden account/internal access. |
| Public widget baseline consumer | Widget PRDs / widget docs | `tokyo/product/widgets/*/widget.html`; `tokyo/product/widgets/cards/widget.css`; materializer contract/fixture proving required Dieter CSS is sealed into `styles.css` | Verify the generated Cards package `.ck-cards__card` in normal and reduced-motion modes, then smoke the current public instance routes for serving regressions. Existing pre-GA instance packages are disposable output and are not a verification dependency. | Do not restore a public token stylesheet, rewrite widget runtime, create product data, or rematerialize existing instances for this check. |
| Dieter source/deploy authority handoff | 126G | `dieter/**`; `scripts/tokyo-r2-deploy-sync.mjs`; package files; GitHub workflows | Consume 126G's direct-source app/widget compilation and SVG-only CDN delivery. | Do not recreate a Dieter builder, generated tree, manifest, shared CSS/JS runtime, or second deployment rule. |
| Public widget runtime inspect-only boundary | Widget PRDs / widget docs | `tokyo/product/widgets/logoshowcase/widget.css`; `tokyo/product/widgets/logoshowcase/widget.client.js`; `tokyo/product/widgets/split-carousel-media/widget.client.js`; `tokyo/product/widgets/countdown/widget.client.js`; `tokyo/product/widgets/shared/stagePod.js`; `tokyo/product/widgets/shared/socialShare.js`; `tokyo/product/widgets/shared/socialShare.css` | Preserve widget ownership beyond the shared CSS guard, especially JS-driven motion. | Do not rewrite independent widget behavior in 126F. |
| Public widget docs inspect-only boundary | Widget PRDs / widget docs | `documentation/widgets/widgets/logoshowcase.md`; `documentation/widgets/widgets/split-carousel-media.md`; `documentation/widgets/widgets/countdown.md`; `documentation/widgets/widgets/README.md`; `documentation/widgets/README.md`; `documentation/widgets/shared/ShellCore.md`; `documentation/widgets/authoring/ToolDrawerControls.md` | Verify docs do not imply Dieter/system motion governs independent widget runtime behavior. | Do not document widget runtime motion as Dieter/system doctrine. |
| Living motion docs | 126F docs | `documentation/engineering/UI/README.md`; `documentation/engineering/UI/motion.md`; `documentation/engineering/UI/dieter.md`; `documentation/services/dieter.md`; `documentation/services/devstudio.md`; `documentation/engineering/UI/interactions.md`; `documentation/engineering/UI/components.md` | Search for stale `126A`, duration-scale expansion, missing widget/system boundary, and DevStudio/Admin authority drift. | Do not document removed or widget-owned behavior as Dieter/system doctrine. |
| Public serving docs | 126G / Tokyo docs | `documentation/services/tokyo.md`; `documentation/services/tokyo-worker.md` | Preserve the SVG-icon-only Dieter public path. | Do not make motion execution reopen Tokyo serving architecture. |

## Current Documentation Reconciliation

The living motion documentation already records these current truths; step 6
verifies them rather than scheduling another rewrite:

- Motion is owned by 126F.
- `--easing-standard` is a real Dieter foundation token.
- The duration set stays small and is not expanded preemptively.
- Dieter/system motion and public-widget runtime motion are separate lanes.
- DevStudio/Admin chrome consumes Dieter/system motion tokens; it does not own a
  separate motion authority.

## Final Step-7 Execution Disposition

126F has one small motion cleanup. The former public Dieter CSS read-boundary
work was deleted by 126G because apps compile source and widget packages seal
their required CSS.
It has no product-data or managed-service configuration write set. The existing
Git-connected deploy path will publish the Tokyo-worker and Dieter changes and
must be verified through its existing GitHub/R2 authorities. The premature motion
migration is current as-built input but receives no Step-9 execution credit.
The final integrated Step-9 plan carries this exact slice:

1. Through one 126G-owned package-graph edit, remove the unused `gsap`
   declarations from both `bob/package.json` and `dieter/package.json`; combine
   Dieter's false `main` and install-time `prepare` deletion in that same edit;
   regenerate `pnpm-lock.yaml` once through pnpm so all GSAP importer and
   package/snapshot entries disappear. 126F verifies the result and never owns a
   second package or lockfile edit.
2. Prove no active source imports or references GSAP, then run Bob typecheck,
   Dieter typecheck, Dieter governance, and the repo frozen-lockfile
   install check required by CI.
3. Update the one foundation reduced-motion selector in
   `dieter/tokens/dieter-foundation-tokens.css` from `*` to
   `*, *::before, *::after`. Do not add a local guard. Verify the live
   `.diet-dropdown-fill__swatch::after` transition in DevStudio becomes
   immediate under reduced motion while swatch selection still changes.
4. Complete 126G first: delete the legacy Dieter builder and generated tree;
   compile/materialize Dieter source directly; deploy only SVG icons from
   Dieter through the existing product-root workflow.
5. After 126G is green, verify Bob, Roma, Prague, DevStudio, and generated
   widget `styles.css` consume the edited source without a shared Dieter
   CSS/JavaScript request.
6. Re-run the source and documentation checks against the execution-start
   tree.
7. If later 126 domains introduce or alter system motion, require those exact
   files to use the existing two durations, standard easing, and reduced-motion
   law before the owning slice can close.
8. Run `pnpm dieter:governance:check`, Dieter typecheck, widget validation, and
   focused consumer builds after Dieter source changes.
9. Push the exact source commit and verify the Git-connected deployments at
   that SHA. Do not perform a manual R2 mutation.
10. Verify browser behavior in normal and reduced-motion modes for DevStudio
   `.diet-dropdown-fill__swatch::after`, Prague route
   `https://prague.dev.clickeen.com/us/en/widgets/faq/` selector
   `.ck-stepsCanvas[data-variant='value-props'] .ck-steps__tile::before`, and
   the generated Cards package `.ck-cards__card`. Record computed transition
   durations. Smoke the current public instance routes for serving regressions,
   but do not create, save, rematerialize, or require a particular pre-GA
   instance as test infrastructure.

Exact current deletion map:

- `bob/package.json`, `dieter/package.json`, and `pnpm-lock.yaml`: 126G owns one
  combined package-graph edit that deletes both unused GSAP declarations,
  Dieter's false `main`/install-time `prepare`, and mechanically regenerates the
  lockfile; 126F only verifies.
- `dieter/tokens/dieter-foundation-tokens.css`: expand the global reduced-motion
  selector to cover `::before` and `::after`.
- `tokyo/product/dieter/**`, `scripts/build-dieter.js`, and
  `scripts/verify-svgs.js`: deleted by 126G and must not return.
- `scripts/tokyo-r2-deploy-sync.mjs`: deploys only committed Dieter SVG icon
  bytes under `dieter/icons/svg/**`.
- `pnpm-workspace.yaml`: remains package source truth and is included in
  workflow triggers; it is not edited unless execution-start source proves an
  actual required package-graph correction.
- `.gitignore`: contains no compatibility rule for a deleted generated tree.
- `.github/workflows/cloud-dev-workers.yml`: 126G watches all four sync roots,
  all complete Dieter inputs including `pnpm-workspace.yaml`, deletes
  `dieter_artifacts`, and syncs the current product roots directly.
- `.github/workflows/cloud-dev-roma-app.yml`: watches authoritative Dieter
  source needed by Bob/Roma.
- Tokyo public serving remains the 126G-owned SVG-icon-only route. 126F makes
  no Tokyo route changes.

No GSAP compatibility wrapper, substitute animation package, or replacement
motion abstraction is permitted. Current source otherwise contains no stale
system duration token, component-local operational timing/easing path,
duplicate Admin reduced-motion doctrine, or unguarded JS transition to delete.

Exact source no-touch but verification boundary:

- public-widget source/docs remain unedited; one current widget is
  browser-verified because its sealed CSS contains the changed global guard;
- Prague source remains unedited, but `StepsPrimitive` is browser-verified
  because its pseudo-elements consume the changed global guard;
- interaction semantics owned by 126E;
- visual primitives owned by 126I;
- product data, policy, direct R2 mutation, Supabase, Berlin, San Francisco, and
  Tokyo operation or serving code.

If execution-start drift introduces a concrete violation, the owning changed
file is added to the integrated plan and fixed directly. That is drift repair,
not authorization for a new motion abstraction.

## V1-V8 Pre-Execution Controls

| ID | 126F risk | Required control |
| --- | --- | --- |
| V1 Silent substitution | A consumer reintroduces bare easing or a fallback-masked undefined token. | Verify every system transition resolves through current foundation tokens. |
| V2 Silent healing | Motion cleanup normalizes local timing without exposing changed behavior. | Execution must name each changed motion site in the blast radius and verify visual ownership. |
| V3 Silent omission | The unused GSAP dependency, Prague consumers, pseudo-element motion, or JS-driven motion is ignored. | Execute the exact package/source-consumer map and retain Prague/JS coverage. |
| V4 Fail-open control | Reduced-motion behavior fails open for pseudo-elements or JS-written transitions. | Foundation CSS covers real elements plus both pseudo-elements; JS-driven system motion checks `prefers-reduced-motion` directly. |
| V5 Corruption-as-absence | Not applicable to persisted product data in 126F. | Do not touch product data. |
| V6 Partial-success masquerade | A consumer build or deployment is claimed green after only source checks passed. | Build each affected consumer and verify the exact deployed app/widget surfaces before closure. |
| V7 Masquerade/redress | Local literals or widget runtime motion are renamed as Dieter doctrine. | Replace/remove local system literals; keep widget runtime motion outside 126F. |
| V8 Runtime test dependency | Normal reduced-motion behavior depends on tests/probes instead of runtime code. | Runtime code/CSS carries the reduced-motion behavior; checks only verify execution. |

## Verification Checklist

Execution is not complete until these checks are run and reconciled:

- Search active source for GSAP imports/references before deletion and confirm
  only package/lockfile entries existed.
- Confirm `rg -n 'gsap' bob/package.json dieter/package.json pnpm-lock.yaml`
  returns no hits after deletion and `pnpm install --frozen-lockfile` succeeds.
- Run `pnpm --filter @clickeen/bob typecheck` and
  `pnpm --filter @ck/dieter typecheck` after the dependency deletion.
- Search Dieter source for operational `transition` literals in the blast radius.
- Verify the foundation reduced-motion selector covers `*`, `*::before`, and
  `*::after`; test DevStudio `.diet-dropdown-fill__swatch::after`, the exact
  Prague selector, and generated Cards `.ck-cards__card` with reduced motion
  enabled. After the exact-SHA deploy is green, smoke current public instance
  routes without making their pre-existing generated bytes a 126F dependency.
- Search Dieter source for `--easing-standard` references and definitions.
- Search for active `--duration-snap` consumers.
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
- After changing Dieter source, run Dieter typecheck/governance, widget
  validation, and focused consumer builds. Verify no generated Dieter mirror
  or runtime CSS import appears.
- Verify the exact source commit deploys successfully before DevStudio, Prague,
  and Cards browser checks.
- Run focused lint/type checks for changed Dieter/Bob/Roma/Admin files if code
  changes occur in execution.
- After merged code changes that affect Bob, Roma, Prague, DevStudio/Admin app
  source, verify Cloudflare Pages Git build state and cloud-dev runtime surface
  checks for the owning Pages project.
- After merged code changes that affect widget product roots, verify the GitHub
  Actions `cloud-dev workers deploy` R2 sync step through the repo Cloudflare
  command path.
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
- No additional duration tokens unless later execution proves and human accepts a real
  component/product need.
- No visual primitive decisions owned by 126I.
- No interaction-state decisions owned by 126E.

## GLM Input Integrated

GLM's independent input remains frozen historical provenance. The earlier tree
contained literal timings, a segmented custom curve, fallback-only easing, and
unguarded repeater motion. Current source has resolved those findings. Prague
remains real token blast radius, and selector-level reduced-motion behavior
still requires step-6 verification. Historical findings must not be presented
as current execution targets.
