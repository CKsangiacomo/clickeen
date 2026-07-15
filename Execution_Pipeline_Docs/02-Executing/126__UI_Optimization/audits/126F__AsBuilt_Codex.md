# 126F Motion - Codex As-Built Audit

Status: FROZEN POINT-IN-TIME PRE-EXECUTION AS-BUILT - code changed afterward; exact working-tree provenance may be unrecorded; no step-9 execution credit.

Scope: current Clickeen motion implementation across Dieter duration tokens,
reduced-motion guards, easing-token references, Dieter component transitions,
JS-driven Dieter motion, Bob/Roma/Admin local motion, public widget motion,
generated Tokyo Dieter output, and current motion docs.

This file states current reality only. It does not select fixes, converge with
GLM, write doctrine, or execute Step 4+.

Authority boundary:

- Product surface inspected: Dieter tokens/components, generated Tokyo Dieter
  output, Bob/Roma/Admin CSS consumers, selected public widget motion.
- Account/session/storage/route/runtime/deploy authorities: not touched.
- Product data: not touched.
- Verification surface: local source/docs inspection only.

## Executive Current Reality

Clickeen has a small Dieter motion substrate and several local motion decisions
outside that substrate.

The strong current evidence:

- Dieter defines exactly three duration tokens:
  `--duration-snap`, `--duration-base`, and `--duration-spin`.
- Dieter defines a global `prefers-reduced-motion` guard.
- Many Dieter components consume `--duration-base`.
- Some Dieter components also add local `prefers-reduced-motion` overrides.
- Generated Tokyo Dieter output mirrors inspected Dieter source.

The split current reality:

- No foundation easing token is defined.
- `--easing-standard` is referenced only as a fallback in dropdown-fill.
- Button, menuactions, textrename, repeater, Bob, Roma, Admin, and public widget
  CSS contain literal motion values.
- Segmented owns a component-local `180ms cubic-bezier(...)` motion variable.
- Repeater writes inline JS `style.transition` strings at runtime.
- Public widgets include additional motion systems such as carousel scrolling,
  ticker animation, autoplay intervals, and count interpolation.

The main current gaps are contract gaps:

- Duration tokens do not cover all actual durations in use.
- `--duration-snap` and `--duration-spin` are not proven active consumers in the
  inspected source state.
- Easing is not a functional foundation layer.
- Reduced-motion coverage is mixed: a global guard exists, selected component
  guards exist, but JS-driven and public-widget motion need runtime
  verification.
- Motion docs overstate some token intent and mislabel the 126F gap as a 126A
  deliverable.

## Program And Source Authority

Evidence:

- MAMA Step 1 is independent current-system read only:
  `Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126__PRD__UI_Optimization_Program.md:182`.
- 126F owns durations, easing, and reduced motion:
  `Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126F__PRD__Motion.md:7`.
- Dieter is the design-system source authority:
  `documentation/services/dieter.md:5`.
- Dieter source is `dieter/`; generated output is `tokyo/product/dieter/**`:
  `documentation/services/dieter.md:11`.
- Consumer surfaces may consume Dieter but do not own it:
  `documentation/services/dieter.md:62`.

As-built read: Dieter owns the foundation motion substrate. Bob, Roma, Admin,
and public widgets consume or bypass it in local ways.

## Dieter Duration Tokens

Source:

- `dieter/tokens/dieter-foundation-tokens.css`.

Current token values:

- `dieter/tokens/dieter-foundation-tokens.css:79-82` defines:
  `--duration-snap: 140ms`, `--duration-base: 160ms`, and
  `--duration-spin: 600ms`.
- `dieter/tokens/tokens.css:1` imports foundation tokens.
- `tokyo/product/dieter/tokens/dieter-foundation-tokens.css:79-82` mirrors the
  same duration tokens in generated output.
- `tokyo/product/dieter/tokens/tokens.css:1` imports generated foundation
  tokens.

As-built read:

- The foundation duration layer is real but very small.
- `--duration-base` is the dominant active token.
- `--duration-snap` and `--duration-spin` are not proven active in inspected
  Dieter/Bob/Roma/Admin source. Public widget motion uses its own values rather
  than `--duration-spin`.

## Global Reduced-Motion Guard

Current global guard:

- `dieter/tokens/dieter-foundation-tokens.css:98-106` defines the global
  `@media (prefers-reduced-motion: reduce)` guard.
- The guard sets `animation-duration: 0.001ms !important`,
  `animation-iteration-count: 1 !important`, `transition-duration: 0.001ms
  !important`, and `scroll-behavior: auto !important`.
- `tokyo/product/dieter/tokens/dieter-foundation-tokens.css:98-106` mirrors the
  same guard in generated output.
- `admin/src/css/utilities.css:140-147` duplicates the same reduced-motion guard
  in Admin CSS.

As-built read:

- A global reduced-motion mechanism exists.
- Admin has a separate copy of the guard outside Dieter token output.
- Runtime effect on JS-written inline transition shorthands was not browser
  verified in this pass.

## Foundation Easing Gap

Current easing evidence:

- No `--easing-*` token is declared in
  `dieter/tokens/dieter-foundation-tokens.css:79-82`.
- `dieter/components/dropdown-fill/dropdown-fill.css:254` references
  `var(--easing-standard, ease)`.
- `dieter/components/dropdown-fill/dropdown-fill.css:287` references
  `var(--easing-standard, ease)`.
- `tokyo/product/dieter/components/dropdown-fill/dropdown-fill.css:254` and
  `tokyo/product/dieter/components/dropdown-fill/dropdown-fill.css:287` mirror
  those fallback references.

As-built read:

- `--easing-standard` is fallback-only today.
- The effective fallback is `ease`.
- Easing exists as local CSS decisions, not as a foundation token layer.

## Dieter Tokenized Component Motion

Representative `--duration-base` consumers:

- `dieter/components/dropdown-fill/dropdown-fill.css:27` transitions background
  and border color with `var(--duration-base, 160ms) ease`.
- `dieter/components/textfield/textfield.css:39` transitions background and
  border color with `var(--duration-base, 160ms) ease`.
- `dieter/components/textedit/textedit.css:28` transitions background and color
  with `var(--duration-base, 160ms) ease`.
- `dieter/components/textedit/textedit.css:273` transitions opacity, transform,
  height, and margin with `var(--duration-base) ease`.
- `dieter/components/dropdown-actions/dropdown-actions.css:25` transitions
  background and border color with `var(--duration-base, 160ms) ease`.
- `dieter/components/dropdown-actions/dropdown-actions.css:133` transitions
  opacity with `var(--duration-base, 160ms) ease`.
- `dieter/components/popover/popover.css:19-20` transitions opacity and
  transform with `var(--duration-base, 160ms) ease`.
- `dieter/components/toggle/toggle.css:68` and
  `dieter/components/toggle/toggle.css:100` use `--duration-base` for switch and
  knob transitions.
- `dieter/components/tabs/tabs.css:71` transitions opacity with
  `var(--duration-base, 160ms) ease`.
- `dieter/components/repeater/repeater.css:82-85` transitions border color,
  background color, and box shadow with `var(--duration-base, 160ms) ease`.

As-built read:

- Many Dieter transitions use `--duration-base`.
- Most still use bare `ease`.
- Many use `160ms` fallback literals, so token absence would still preserve a
  local duration.

## Dieter Literal Motion

High-use literal motion:

- `dieter/components/button/button.css:34-39` defines a five-property
  `150ms ease` transition block.
- `dieter/components/button/button.css:215-220` repeats the same five-property
  `150ms ease` block.
- `dieter/components/button/button.css:344-349` repeats the same five-property
  `150ms ease` block.
- `dieter/components/menuactions/menuactions.css:34` uses `150ms ease`.
- `dieter/components/textrename/textrename.css:48-52` uses `150ms ease`.
- `dieter/components/textrename/textrename.css:100-103` uses `150ms ease`.
- `dieter/components/repeater/repeater.css:169` uses literal `140ms ease` for
  placeholder height and margin.

As-built read:

- Button motion is not tokenized.
- The `150ms` literal does not match current `140ms` or `160ms` duration tokens.
- Repeater has both tokenized and literal motion.

## Segmented Local Motion

Current segmented evidence:

- `dieter/components/segmented/segmented.css:17` defines
  `--seg-transition: 180ms cubic-bezier(0.76, 0.05, 0.24, 0.95)`.
- `dieter/components/segmented/segmented.css:67` repeats the same variable.
- `dieter/components/segmented/segmented.css:105` repeats the same variable.
- `dieter/components/segmented/segmented.css:178` consumes `--seg-transition`
  for background and box-shadow.

As-built read:

- A non-`ease` curve exists today.
- It is component-local, not a foundation easing token.
- It uses `180ms`, which is not one of the current duration tokens.

## JS-Driven Dieter Motion

Repeater runtime motion:

- `dieter/components/repeater/repeater.js:594` writes inline
  `border-color 140ms ease, background-color 140ms ease, box-shadow 140ms ease`.
- `dieter/components/repeater/repeater.js:665` writes inline
  `transform 80ms ease`.
- `dieter/components/repeater/repeater.js:707` clears the inline transition.

As-built read:

- JS runtime motion bypasses duration/easing token references.
- Interaction with the global reduced-motion guard was not browser verified.
- This is a concrete runtime-verification risk, not a proven browser outcome in
  this audit.

## Component-Level Reduced-Motion Guards

Component-local guards observed:

- `dieter/components/segmented/segmented.css:258-263` disables segmented surface
  transition.
- `dieter/components/tabs/tabs.css:97-100` disables tab label transition.
- `dieter/components/textrename/textrename.css:128-132` disables text rename
  transition.
- `dieter/components/toggle/toggle.css:126-129` disables toggle switch/knob
  transitions.
- `dieter/components/valuefield/valuefield.css:138-142` disables valuefield
  input transition.
- `dieter/components/textfield/textfield.css:139-141` disables textfield field
  transition.

Selector alignment concerns:

- `dieter/components/textfield/textfield.css:39` transitions
  `.diet-textfield__control`, while `dieter/components/textfield/textfield.css:140`
  disables `.diet-textfield__field`.
- `dieter/components/valuefield/valuefield.css:56` transitions the valuefield
  control, while `dieter/components/valuefield/valuefield.css:139-140` disables
  `.diet-valuefield__input`.

As-built read:

- Component-local reduced-motion blocks do exist.
- Coverage is partial and selector alignment needs verification.
- The audit must not claim components rely only on the global guard.

## Bob And Roma Motion

Bob:

- `bob/app/bob_app.css:279-284` uses `transition: transform 150ms ease` for
  cluster icon rotation.
- `bob/app/bob_app.css:456-464` uses `transition: opacity 120ms ease` for iframe
  opacity/status behavior.
- `bob/components/td-menu-content/useTdMenuHydration.ts:58-61` schedules render
  work with RAF; this is batching, not visual motion by itself.

Roma:

- `roma/app/roma.css:377-382` uses `transition: transform 150ms ease` for widget
  defaults cluster icon rotation.
- `roma/app/roma.css:438-445` uses `transition: transform 120ms ease` for widget
  defaults checkbox knob.
- `roma/app/roma.css:678-697` contains modal CSS, and modal markup exists in
  `roma/components/roma-account-notice-modal.tsx:86-87` and
  `roma/components/widgets-domain.tsx:592-593`, but inspected modal CSS contains
  no transition declarations.

As-built read:

- Bob and Roma contain literal product CSS motion outside Dieter duration tokens.
- Bob and Roma duplicate the `transform 150ms ease` cluster-icon pattern.

## Admin / DevStudio Motion

Admin local motion:

- `admin/src/css/layout.css:149-155` uses literal `transition: transform 220ms
  ease` for mobile docs sidebar motion.
- `admin/src/css/utilities.css:140-147` defines a global reduced-motion guard.

As-built read:

- Admin has local literal motion and a local guard copy.
- Admin motion is not fully routed through Dieter foundation tokens.

## Public Widget Motion

Dieter token loading:

- `tokyo/product/widgets/logoshowcase/widget.html:7` loads Dieter tokens.
- `tokyo/product/widgets/split-carousel-media/widget.html:7` loads Dieter tokens.
- `tokyo/product/widgets/countdown/widget.html:7` loads Dieter tokens.
- `packages/ck-runtime-materializer/src/runtime.ts:43-47` preserves `/dieter/`
  stylesheet imports into package CSS.

Literal widget transitions:

- `tokyo/product/widgets/cards/widget.css:51` uses `140ms ease`.
- `tokyo/product/widgets/countdown/widget.css:173` uses `0.2s ease`.
- `tokyo/product/widgets/split-carousel-media/widget.css:67` uses `240ms ease`
  and `280ms ease`.
- `tokyo/product/widgets/logoshowcase/widget.css:241-243` uses `160ms ease`.

Tokenized widget transition examples:

- `tokyo/product/widgets/shared/socialShare.css:124-128` uses
  `var(--duration-base, 160ms)`.
- `tokyo/product/widgets/shared/socialShare.css:253-256` uses
  `var(--duration-base, 160ms)`.

Animation and JS-driven widget motion:

- `tokyo/product/widgets/logoshowcase/widget.css:147` uses
  `animation: ck-ls-ticker var(--ls-ticker-duration, 10s) linear infinite`.
- `tokyo/product/widgets/logoshowcase/widget.css:180-187` defines
  `@keyframes ck-ls-ticker`.
- `tokyo/product/widgets/logoshowcase/widget.client.js:273-275` validates
  carousel `transitionMs`.
- `tokyo/product/widgets/logoshowcase/widget.client.js:604-613` implements a
  custom `easeInOutQuad` RAF scroll animation.
- `tokyo/product/widgets/logoshowcase/widget.client.js:693-699` calls animated
  scrolling for carousel paging.
- `tokyo/product/widgets/logoshowcase/widget.client.js:726-730` drives autoplay
  interval behavior.
- `tokyo/product/widgets/logoshowcase/widget.client.js:790` sets
  `--ls-ticker-duration`.
- `tokyo/product/widgets/split-carousel-media/widget.client.js:221-224`
  validates carousel transition mode.
- `tokyo/product/widgets/split-carousel-media/widget.client.js:382` applies
  transition mode to `dataset.transition`.
- `tokyo/product/widgets/split-carousel-media/widget.client.js:426-430` drives
  autoplay interval.
- `tokyo/product/widgets/countdown/widget.client.js:789-790` participates in
  timer tick behavior.
- `tokyo/product/widgets/countdown/widget.client.js:844-848` uses
  `requestAnimationFrame` for number interpolation.

As-built read:

- Public widgets have motion behavior beyond Dieter foundation tokens.
- Logo Showcase has the clearest continuous animation.
- No widget reduced-motion media/query handling was found in the inspected
  public widget files except inherited global CSS if Dieter tokens apply in the
  runtime context.

## Generated Tokyo Dieter Output

Generated output:

- `tokyo/product/dieter/manifest.json:3-27` lists generated component entries.
- `tokyo/product/dieter/manifest.json:29-49` lists JS-bearing components.
- Local `cmp` inspection found generated Tokyo Dieter foundation tokens and
  relevant inspected component CSS/JS matched the source Dieter files.

As-built read:

- For Dieter components/tokens inspected here, Tokyo output mirrors source.
- Public widgets remain separate product packages with their own motion.

## Docs Drift

Observed docs drift:

- `documentation/engineering/UI/motion.md:12-14` describes token intent:
  snap for quick state snaps, base for default transitions, spin for spinners.
- Current source reality differs: toggle uses `--duration-base` at
  `dieter/components/toggle/toggle.css:68` and
  `dieter/components/toggle/toggle.css:100`; segmented uses local `180ms
  cubic-bezier` at `dieter/components/segmented/segmented.css:17`; no
  `--duration-spin` consumer was found in inspected source.
- `documentation/engineering/UI/motion.md:23-25` says the easing gap is a
  `126A` deliverable, but the current PRD domain is 126F.
- `documentation/engineering/UI/motion.md:36` names "Spinners / agent-activity"
  as motion locations; the concrete animation found in this pass is Logo
  Showcase continuous carousel.

As-built read:

- Current docs describe the intended thin layer but understate actual local
  motion and public-widget motion.
- Step 4+ should not start from doc claims alone.

## Known Gaps Only

This section records current gaps without choosing fixes:

- No functional foundation easing token layer.
- `--easing-standard` is fallback-only.
- Literal durations in Dieter, Bob, Roma, Admin, and public widgets are not
  governed by Dieter duration tokens.
- Button transitions are not tokenized.
- Segmented owns a local cubic-bezier and duration.
- Repeater writes inline JS transitions.
- Public widgets have independent carousel/ticker/autoplay/count interpolation
  motion.
- Component-local reduced-motion coverage exists but is partial.
- Public-widget reduced-motion behavior was not proven.
- Docs drift from current source reality.

## Gaps And Unknowns

- This audit is repo-source only.
- Runtime browser behavior was not inspected.
- The interaction between global reduced-motion `!important` rules and
  JS-written inline transition shorthands was not verified.
- Deployed Cloudflare/R2 surfaces were not inspected.
- Account-owned product data was not read or mutated.
- No build, lint, typecheck, Playwright, or runtime verification was run.
- No code behavior was changed.
