# 126F - PRD: Motion

Status: PRE-EXECUTION STEPS 6-7 CORRECTED AFTER RED STEP-8 REVIEW - mandatory
consumer verification and the 126G generated/deploy handoff are exact; fresh
exact-tree Step-8 review pending; no Step-9 execution credit.
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
- Generated Tokyo Dieter token/component output mirrors inspected source.
- Button, segmented, repeater, Bob, Roma, and Admin operational motion now
  consumes `--duration-base`, `--duration-snap`, and `--easing-standard`.
- Repeater still writes inline JS `style.transition` shorthands, but it checks
  `prefers-reduced-motion` directly before enabling them.
- Public widgets include separate carousel/ticker/autoplay/RAF/countdown motion,
  but all current widget templates load the Dieter token entrypoint and inherit
  its global CSS reduced-motion baseline. Independent widget choreography and
  JS behavior remain widget-owned.
- Current living motion doctrine records the exact system/widget boundary and
  token law.

Step 6 found one remaining implementation deletion: Bob and Dieter still
declare `gsap` even though current source has no GSAP import or runtime use.
It also found one reduced-motion selector gap: Roma's Widget Defaults toggle
animates its knob through `::after`, while the foundation guard currently
targets only real elements. The generated Dieter manifest still records the
older `de408dda` input SHA even though `c299c783` is the latest committed
Dieter/build input. Current token consumption is otherwise source-true; Prague
remains real blast radius before any future duration-token change. Step 7 fixes
these exact gaps, deletes the unused dependency, and then acts as a
preservation/regression gate rather than repeating the motion migration.

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
| Unused motion dependency | 126F / package graph | `bob/package.json`; `dieter/package.json`; `pnpm-lock.yaml` | Verify zero active GSAP references; remove both declarations through pnpm and confirm frozen-lockfile install succeeds. | Do not replace GSAP, preserve a compatibility lane, or edit unrelated dependency versions. |
| Dieter foundation motion | 126F / Dieter source | `dieter/tokens/dieter-foundation-tokens.css`; `dieter/tokens/tokens.css` | Search for `--duration-*`, `--easing-standard`, and `prefers-reduced-motion`; run `pnpm build:dieter` after source changes. | Do not add duration tokens preemptively or import an external easing taxonomy. |
| Generated Dieter token output | Generated from Dieter source | `tokyo/product/dieter/tokens/**` including `tokens.css`, `tokens.shadow.css`, per-token CSS, and matching `*.shadow.css` files | Confirm generated output changed only through `pnpm build:dieter`. | Do not hand-edit generated Tokyo Dieter output. |
| Generated Dieter component output | Generated from Dieter source | `tokyo/product/dieter/components/button/button.css`; `tokyo/product/dieter/components/menuactions/menuactions.css`; `tokyo/product/dieter/components/textrename/textrename.css`; `tokyo/product/dieter/components/repeater/repeater.css`; `tokyo/product/dieter/components/repeater/repeater.js`; `tokyo/product/dieter/components/segmented/segmented.css`; `tokyo/product/dieter/components/dropdown-fill/dropdown-fill.css`; `tokyo/product/dieter/components/dropdown-border/dropdown-border.css`; `tokyo/product/dieter/components/dropdown-shadow/dropdown-shadow.css`; `tokyo/product/dieter/components/dropdown-edit/dropdown-edit.css`; `tokyo/product/dieter/components/dropdown-upload/dropdown-upload.css`; `tokyo/product/dieter/components/dropdown-actions/dropdown-actions.css`; `tokyo/product/dieter/components/textfield/textfield.css`; `tokyo/product/dieter/components/textedit/textedit.css`; `tokyo/product/dieter/components/valuefield/valuefield.css`; `tokyo/product/dieter/components/popover/popover.css`; `tokyo/product/dieter/components/toggle/toggle.css`; `tokyo/product/dieter/components/tabs/tabs.css` | Confirm generated output mirrors the edited Dieter source after build. | Do not hand-edit generated Tokyo Dieter output. |
| Dieter tokenized component motion | 126F / Dieter components | `dieter/components/dropdown-fill/dropdown-fill.css`; `dieter/components/dropdown-border/dropdown-border.css`; `dieter/components/dropdown-shadow/dropdown-shadow.css`; `dieter/components/dropdown-edit/dropdown-edit.css`; `dieter/components/dropdown-upload/dropdown-upload.css`; `dieter/components/dropdown-actions/dropdown-actions.css`; `dieter/components/textfield/textfield.css`; `dieter/components/textedit/textedit.css`; `dieter/components/valuefield/valuefield.css`; `dieter/components/popover/popover.css`; `dieter/components/toggle/toggle.css`; `dieter/components/tabs/tabs.css`; `dieter/components/repeater/repeater.css` | Search these files for `transition`, bare `ease`, and `var(--duration-base`; verify ordinary transitions use decided Dieter motion law. | Do not create component-local motion systems. |
| Historical literal-motion sites | 126F / Dieter components | `dieter/components/button/button.css`; `dieter/components/menuactions/menuactions.css`; `dieter/components/textrename/textrename.css`; `dieter/components/repeater/repeater.css` | Verify the completed token migration remains intact; `textrename` deletion belongs to 126I. | Do not repeat the completed migration or preserve literal timing as a parallel path. |
| Segmented motion | 126F / Dieter components | `dieter/components/segmented/segmented.css` | Verify the component consumes the foundation duration/easing tokens and reduced-motion behavior. | Do not silently promote a component-local curve to product law. |
| JS-driven system motion | 126F / Dieter components | `dieter/components/repeater/repeater.js` | Search for `style.transition`; verify direct `prefers-reduced-motion` handling if JS keeps motion. | Do not rely on tests or the global CSS guard as runtime behavior for JS-written motion. |
| Bob operational chrome | 126F / Bob chrome | `bob/app/bob_app.css` | Verify operational chrome continues to consume Dieter motion tokens. | Do not change Bob interaction semantics owned by 126E. |
| Roma operational chrome | 126F / Roma chrome | `roma/app/roma.css` | Verify operational chrome continues to consume Dieter motion tokens. | Do not change Roma account/domain state semantics owned by 126E. |
| Admin / DevStudio chrome | 126F / Admin chrome | `admin/src/css/layout.css`; `admin/src/css/utilities.css` | Verify operational chrome continues to consume Dieter motion tokens and no duplicate global reduced-motion rule returns. | Do not keep duplicate global reduced-motion rules or local motion drift as a separate doctrine. |
| Prague Dieter consumer | Prague / website consumer | `prague/src/layouts/Base.astro`; `prague/src/components/StepsPrimitive.astro`; `prague/src/components/InstanceEmbed.astro`; `prague/public/styles/primitives.css` | Verify the global selector change makes `StepsPrimitive` pseudo-element transitions immediate under reduced motion and preserves normal mode. | Do not edit Prague source or treat Prague consumption as a second motion authority. |
| Public widget baseline consumer | Widget PRDs / widget docs | `tokyo/product/widgets/*/widget.html`; `tokyo/product/widgets/cards/widget.css`; materializer contract/fixture proving the token link survives materialization | Verify a current public widget with an existing CSS transition inherits the global guard in normal and reduced-motion modes. | Do not rewrite widget runtime CSS/JS or force widget choreography onto Dieter durations/easing. |
| Public widget runtime inspect-only boundary | Widget PRDs / widget docs | `tokyo/product/widgets/logoshowcase/widget.css`; `tokyo/product/widgets/logoshowcase/widget.client.js`; `tokyo/product/widgets/split-carousel-media/widget.client.js`; `tokyo/product/widgets/countdown/widget.client.js`; `tokyo/product/widgets/shared/stagePod.js`; `tokyo/product/widgets/shared/socialShare.js`; `tokyo/product/widgets/shared/socialShare.css` | Preserve widget ownership beyond the shared CSS guard, especially JS-driven motion. | Do not rewrite independent widget behavior in 126F. |
| Public widget docs inspect-only boundary | Widget PRDs / widget docs | `documentation/widgets/widgets/logoshowcase.md`; `documentation/widgets/widgets/split-carousel-media.md`; `documentation/widgets/widgets/countdown.md`; `documentation/widgets/widgets/README.md`; `documentation/widgets/README.md`; `documentation/widgets/shared/ShellCore.md`; `documentation/widgets/authoring/ToolDrawerControls.md` | Verify docs do not imply Dieter/system motion governs independent widget runtime behavior. | Do not document widget runtime motion as Dieter/system doctrine. |
| Living motion docs | 126F docs | `documentation/engineering/UI/README.md`; `documentation/engineering/UI/motion.md`; `documentation/engineering/UI/dieter.md`; `documentation/services/dieter.md`; `documentation/services/devstudio.md`; `documentation/engineering/UI/interactions.md`; `documentation/engineering/UI/components.md` | Search for stale `126A`, duration-scale expansion, missing widget/system boundary, and DevStudio/Admin authority drift. | Do not document removed or widget-owned behavior as Dieter/system doctrine. |

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

126F has one small standalone cleanup slice and no product-data,
managed-service configuration, route, or deploy-path code write set. The
existing Git-connected deploy path will publish changed Dieter output and must
be verified through its existing GitHub/R2 authorities. The premature motion
migration is current as-built input but receives no Step-9 execution credit.
The final integrated Step-9 plan carries this exact slice:

1. Remove the unused `gsap` dependency from `bob/package.json`. The single
   126G-owned Dieter package cleanup removes Dieter's unused `gsap` declaration
   together with its false `main` and install-time `prepare` metadata; regenerate
   `pnpm-lock.yaml` through pnpm so all GSAP importer and package/snapshot
   entries disappear without editing `dieter/package.json` twice.
2. Prove no active source imports or references GSAP, then run Bob typecheck,
   Dieter typecheck/build, Dieter governance, and the repo frozen-lockfile
   install check required by CI.
3. Update the one foundation reduced-motion selector in
   `dieter/tokens/dieter-foundation-tokens.css` from `*` to
   `*, *::before, *::after`. Do not add a Roma-local guard. Verify the Roma
   Widget Defaults toggle becomes immediate under reduced motion while its
   checked/unchecked product state still changes.
4. Through 126G, make `scripts/build-dieter.js` derive manifest provenance from
   the latest commit affecting the complete scoped Dieter/build inputs in every
   environment: `dieter/**`, `scripts/build-dieter.js`,
   `scripts/verify-svgs.js`, root `package.json`, and `pnpm-lock.yaml`.
   CI-provided deployment SHAs must not replace that identity.
   Remove `tokyo/product/dieter/**` from Git tracking and ignore it. Make the
   single R2 sync entrypoint run `pnpm build:dieter` before file enumeration in
   both workflow and documented manual use.
5. Commit the Dieter source/package/build changes, then run `pnpm build:dieter`
   and prove the ignored output is generated from that committed input and
   `manifest.json.gitSha` equals the latest commit affecting `dieter/`,
   `scripts/build-dieter.js`, or `scripts/verify-svgs.js`. Do not commit generated
   Dieter output.
6. Re-run the source and documentation checks against the execution-start
   tree.
7. If later 126 domains introduce or alter system motion, require those exact
   files to use the existing two durations, standard easing, and reduced-motion
   law before the owning slice can close.
8. Run `pnpm dieter:governance:check` and `pnpm build:dieter` after the Dieter
   dependency change and whenever Dieter source changes later. Generated Tokyo
   Dieter output must match source and must not be hand-edited.
9. Push the exact source commit, verify the existing
   `cloud-dev workers deploy` run at that SHA, and read back the generated
   foundation token file plus manifest from canonical R2 `dieter/**`. Do not
   perform a manual R2 mutation.
10. Only after that deployed-byte proof, verify browser behavior in normal and
   reduced-motion modes for the Roma Widget Defaults toggle, Prague
   `StepsPrimitive` pseudo-elements, and the current public Cards widget. Record
   the tested selectors and computed transition durations. If cloud-dev has no
   current public Cards instance, this gate is RED; do not silently substitute
   another widget or create product data under 126F.

Exact current deletion map:

- `bob/package.json`: delete the unused `gsap` dependency.
- `dieter/package.json`: 126G owns one combined cleanup that deletes the unused
  `gsap` dependency plus false `main` and install-time `prepare`; 126F must not
  make a second edit to the same file.
- `pnpm-lock.yaml`: mechanically remove both importer entries and the now
  unreachable `gsap` package/snapshot entries through pnpm.
- `dieter/tokens/dieter-foundation-tokens.css`: expand the global reduced-motion
  selector to cover `::before` and `::after`.
- `tokyo/product/dieter/**`: 126G removes the generated tree from Git tracking
  and ignores it; `pnpm build:dieter` still recreates it as deploy input.
- `scripts/build-dieter.js`: 126G removes environment deployment-SHA precedence
  so local and CI builds use the same scoped input identity.
- `scripts/tokyo-r2-deploy-sync.mjs`: 126G makes the one sync entrypoint build
  Dieter before enumeration for CI and manual use.
- `.github/workflows/cloud-dev-workers.yml`: 126G watches all four sync roots,
  deletes `dieter_artifacts`, and uses the one build-before-sync entrypoint.

No GSAP compatibility wrapper, substitute animation package, or replacement
motion abstraction is permitted. Current source otherwise contains no stale
system duration token, component-local operational timing/easing path,
duplicate Admin reduced-motion doctrine, or unguarded JS transition to delete.

Exact source no-touch but verification boundary:

- public-widget runtime source/docs remain unedited, but one current widget is
  browser-verified because it loads the changed global guard;
- Prague source remains unedited, but `StepsPrimitive` is browser-verified
  because its pseudo-elements consume the changed global guard;
- interaction semantics owned by 126E;
- visual primitives owned by 126I;
- product data, routes, policy, R2, Supabase, Berlin, San Francisco, and Tokyo
  operation code.

If execution-start drift introduces a concrete violation, the owning changed
file is added to the integrated plan and fixed directly. That is drift repair,
not authorization for a new motion abstraction.

## V1-V8 Pre-Execution Controls

| ID | 126F risk | Required control |
| --- | --- | --- |
| V1 Silent substitution | A consumer reintroduces bare easing or a fallback-masked undefined token. | Verify every system transition resolves through current foundation tokens. |
| V2 Silent healing | Motion cleanup normalizes local timing without exposing changed behavior. | Execution must name each changed motion site in the blast radius and verify visual ownership. |
| V3 Silent omission | The unused GSAP dependency, Prague consumers, pseudo-element motion, or JS-driven motion is ignored. | Execute the exact package/selector/generated-output map and retain Prague/JS coverage. |
| V4 Fail-open control | Reduced-motion behavior fails open for pseudo-elements or JS-written transitions. | Foundation CSS covers real elements plus both pseudo-elements; JS-driven system motion checks `prefers-reduced-motion` directly. |
| V5 Corruption-as-absence | Not applicable to persisted product data in 126F. | Do not touch product data. |
| V6 Partial-success masquerade | Git, CI, or R2 claims current Dieter output while generated bytes/provenance differ. | CI fails on build failure, missing required artifacts, invalid manifest dependencies, or incorrect provenance; it then syncs and proves the deployed R2 bytes before browser verification. |
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
  `*::after`; test the Roma Widget Defaults toggle, Prague `StepsPrimitive`, and
  the current public Cards widget transition with reduced motion enabled, only
  after the exact-SHA deploy and R2 read-back are green.
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
- After committing Dieter source/build changes, run `pnpm build:dieter`; verify
  the ignored output is complete and manifest provenance equals the latest
  committed Dieter/build input SHA across `dieter/**`, both build scripts, root
  `package.json`, and `pnpm-lock.yaml`, locally and under GitHub Actions.
- Verify the exact source commit deploys successfully and canonical R2 bytes
  are read back before running the Roma, Prague, and public Cards browser checks.
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
