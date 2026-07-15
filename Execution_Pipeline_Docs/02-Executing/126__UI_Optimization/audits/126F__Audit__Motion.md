# 126F - Pre-Execution Audit: Motion

Status: FROZEN POINT-IN-TIME PRE-EXECUTION AUDIT - code changed afterward; no step-9 execution credit.
PRD: `../126F__PRD__Motion.md`.

This audit hardens 126F for execution. It does not change runtime code. It
records the exact blast radius, pre-execution source evidence, documentation work,
verification gates, and V1-V8 controls needed before executing the motion
cleanup.

Post-execution current truth lives in `../126F__PRD__Motion.md`,
`documentation/engineering/UI/motion.md`, `documentation/engineering/UI/dieter.md`,
`documentation/services/dieter.md`, and runtime source. After execution,
`--easing-standard` is defined as a foundation token, `--duration-spin` is
removed from active source/living docs because no current consumer exists, and
system motion literals were replaced by Dieter motion tokens. Do not use the
pre-execution findings below as supported current behavior.

## Authority Gate

| Authority | 126F execution authority |
| --- | --- |
| Product surface | Dieter/system motion in Dieter components, Bob chrome, Roma chrome, Admin/DevStudio chrome, and Prague token consumers when foundation duration tokens change. |
| Product surface excluded | Public-widget runtime motion. Widgets own carousel, ticker, autoplay, countdown, RAF, and other widget-specific motion. |
| Account/session coordinate | Not touched in 126F motion execution. |
| Storage coordinate | Not touched. Generated Tokyo Dieter output is deploy output from Dieter source, not a storage authority. |
| Route/API boundary | Not touched. |
| Runtime/deploy surface | Dieter source build output, Bob/Roma/Prague/DevStudio Pages only if source files change. |
| Verification surface | Source grep, Dieter build, focused app checks for changed surfaces, docs grep, and post-merge Cloudflare/runtime evidence when changed files affect deployed Pages or Tokyo R2 surfaces. |

Compliance reason: this keeps 126F inside the actual Dieter/system motion
authority and prevents the recurring AI failure of turning widget runtime
behavior into a universal system doctrine.

## Source Evidence Snapshot

Commands run during pre-execution audit:

- `rg -n -- '--duration-(snap|base|spin)|--easing-standard|prefers-reduced-motion|transition:|animation:|@keyframes|style\.transition|requestAnimationFrame' dieter/tokens dieter/components bob/app roma/app admin/src/css tokyo/product/widgets documentation/engineering/UI/README.md documentation/engineering/UI/motion.md documentation/engineering/UI/dieter.md documentation/services/dieter.md documentation/services/devstudio.md documentation/engineering/UI/interactions.md documentation/engineering/UI/components.md`
- `rg -n -- '@media \(prefers-reduced-motion: reduce\)' dieter admin bob roma tokyo/product/widgets`
- `rg -n -- '--duration-snap|--duration-spin|--easing-standard' .`

Pre-execution source findings:

- `dieter/tokens/dieter-foundation-tokens.css:80-82` defines
  `--duration-snap`, `--duration-base`, and `--duration-spin`.
- `dieter/tokens/dieter-foundation-tokens.css:99` defines the global
  reduced-motion media query.
- `admin/src/css/utilities.css:140` duplicates a global reduced-motion rule.
- `dieter/components/dropdown-fill/dropdown-fill.css:254,287` references
  `--easing-standard` as a fallback-only token. No foundation definition exists.
- `dieter/components/button/button.css:34,215,344`,
  `dieter/components/menuactions/menuactions.css:34`,
  `dieter/components/textrename/textrename.css:48,100`, and
  `dieter/components/repeater/repeater.css:169` contain Dieter component
  literal durations/easing.
- `dieter/components/segmented/segmented.css:17,67,105,178` owns a
  component-local `180ms cubic-bezier(...)` transition variable.
- `dieter/components/repeater/repeater.js:594,665,707` writes inline
  `style.transition` at runtime.
- `bob/app/bob_app.css:280,463` and `roma/app/roma.css:378,445` contain
  literal operational chrome motion.
- `admin/src/css/layout.css:154` contains local sidebar motion.
- `prague/src/components/StepsPrimitive.astro:266,282,407` consumes
  `--duration-snap`; `prague/src/components/StepsPrimitive.astro:291` consumes
  `--duration-base`.
- `prague/src/components/InstanceEmbed.astro:220,357` and
  `prague/public/styles/primitives.css:44,193` also consume `--duration-base`.
- Public widget motion exists in widget-owned code, for example
  `tokyo/product/widgets/logoshowcase/widget.css:147,180`,
  `tokyo/product/widgets/logoshowcase/widget.client.js:609,613`,
  `tokyo/product/widgets/split-carousel-media/widget.css:67`, and
  `tokyo/product/widgets/countdown/widget.client.js:848`.

Correction to earlier evidence:

- `--duration-snap` is not globally dead because Prague consumes it. Prague also
  consumes `--duration-base` outside `StepsPrimitive`. Execution must verify
  Prague duration-token consumers before changing/removing any duration token.
- `--duration-spin` had no proven source consumer in the pre-execution sweep.
- Component-local reduced-motion media blocks exist in Dieter components.
  Execution must verify selector alignment instead of claiming all component
  reduced-motion behavior is only global.

## Execution Blast Radius

| Area | Exact paths | Execution requirement | Must not do |
| --- | --- | --- | --- |
| Dieter foundation motion | `dieter/tokens/dieter-foundation-tokens.css`; `dieter/tokens/tokens.css` | Define `--easing-standard: ease`; reconcile only the decided motion tokens; keep duration set small unless a real product/component need is accepted. | Do not import Material/Apple/OpenAI token tables or create a motion scale because the sources have one. |
| Generated Dieter output | `tokyo/product/dieter/tokens/**` including `tokens.css`, `tokens.shadow.css`, per-token CSS, and matching `*.shadow.css`; `tokyo/product/dieter/components/**` | Update only through `pnpm build:dieter` after Dieter source edits. | Do not hand-edit generated Tokyo Dieter files. |
| Dieter component CSS | `dieter/components/button/button.css`; `menuactions/menuactions.css`; `textrename/textrename.css`; `repeater/repeater.css`; `segmented/segmented.css`; dropdown/textfield/textedit/valuefield/popover/toggle/tabs files | Replace ordinary system UI literals with the decided Dieter token law; replace segmented local curve with the standard easing token. | Do not leave old literal paths as supported alternatives. |
| Dieter JS motion | `dieter/components/repeater/repeater.js`; inspect `dieter/components/textedit/textedit.ts` RAF usage | If JS writes visual transition behavior, it must handle reduced motion directly. | Do not rely on a test/probe or broad CSS claim as runtime behavior. |
| Bob chrome | `bob/app/bob_app.css` | Tokenize/reconcile operational chrome motion without changing 126E save/interaction semantics. | Do not redesign Bob or change interaction state ownership. |
| Roma chrome | `roma/app/roma.css` | Tokenize/reconcile operational chrome motion without changing account/domain state behavior. | Do not change Roma route/session/account authority. |
| Admin/DevStudio chrome | `admin/src/css/layout.css`; `admin/src/css/utilities.css` | Reconcile local sidebar motion and duplicate reduced-motion guard against Dieter/system authority. | Do not preserve duplicate global guard as a separate Admin doctrine. |
| Prague token consumers | `prague/src/components/StepsPrimitive.astro`; `prague/src/components/InstanceEmbed.astro`; `prague/public/styles/primitives.css` | If `--duration-snap` or `--duration-base` changes, verify Prague still follows decided token law. | Do not misclassify Prague consumption as public-widget runtime motion. |
| Public widgets | `tokyo/product/widgets/logoshowcase/widget.css`; `tokyo/product/widgets/logoshowcase/widget.client.js`; `tokyo/product/widgets/logoshowcase/spec.json`; `tokyo/product/widgets/split-carousel-media/widget.client.js`; `tokyo/product/widgets/split-carousel-media/widget.css`; `tokyo/product/widgets/split-carousel-media/spec.json`; `tokyo/product/widgets/countdown/widget.client.js`; `tokyo/product/widgets/countdown/spec.json`; `tokyo/product/widgets/cards/widget.css`; `tokyo/product/widgets/shared/stagePod.js`; `tokyo/product/widgets/shared/socialShare.js`; `tokyo/product/widgets/shared/socialShare.css`; `documentation/widgets/**` | Inspect only to maintain the system/widget boundary. Widget motion remains widget-owned. | Do not rewrite widget ticker/carousel/autoplay/countdown motion to Dieter tokens in 126F. |
| UI documentation | `documentation/engineering/UI/README.md`; `documentation/engineering/UI/motion.md`; `documentation/engineering/UI/dieter.md`; `documentation/services/dieter.md`; `documentation/services/devstudio.md`; `documentation/engineering/UI/interactions.md`; `documentation/engineering/UI/components.md` | Replace false or stale motion claims with current 126F law and required handoffs. | Do not document removed behavior, old paths, or widget runtime motion as Dieter/system doctrine. |

## Required Documentation Updates

Execution must update `documentation/engineering/UI/motion.md` so it says:

- Motion is intentionally small and Dieter/system-owned.
- Easing belongs to 126F, not 126A.
- `--easing-standard` is standardized as `ease` to preserve current behavior
  while removing fallback-only masquerade.
- Clickeen is not completing a broad duration scale preemptively.
- `--duration-snap` has a Prague consumer, Prague has additional
  `--duration-base` consumers, and `--duration-spin` must be reconciled by
  actual use, not preserved as an assumed spinner token.
- Public-widget runtime motion is widget-owned and outside 126F.
- Reduced-motion coverage must be described by actual source behavior, including
  JS-written system motion.

Execution must check related UI docs for:

- stale DevStudio/Admin authority claims;
- stale UI index claims, including motion mapped to 126A;
- motion responsibility incorrectly assigned to 126A, 126E, 126I, or widget docs;
- public widget motion described as system doctrine;
- removed behavior documented as a living option.

Compliance reason: future agents read `documentation/engineering/UI/**` during
implementation. Leaving false docs creates the same drift 126 is meant to
remove.

## V1-V8 Pre-Execution Audit

| ID | Risk | 126F control |
| --- | --- | --- |
| V1 Silent substitution | `--easing-standard` silently falls back to `ease` and masquerades as a real token. | Define `--easing-standard: ease` as current-behavior preservation, then replace fallback-only claims. |
| V2 Silent healing | Literal timings are normalized without naming changed behavior. | Each changed site must be listed in execution notes and verified against owning surface behavior. |
| V3 Silent omission | `--duration-spin`, Prague `--duration-snap`, component reduced-motion selector drift, or JS inline transitions are skipped. | Execution checklist must cover all listed paths before marking 126F done. |
| V4 Fail-open control | Reduced motion fails open for JS-written transitions or duplicated guards. | Runtime code/CSS must carry the behavior directly; JS visual motion must check reduced motion directly. |
| V5 Corruption-as-absence | Not applicable to persisted product data. | Do not touch product data. |
| V6 Partial-success masquerade | Motion implies progress/activity that is not real. | System and widget docs must say motion reflects actual state only. |
| V7 Masquerade/redress | Local literals or widget runtime motion are renamed as Dieter doctrine. | Replace/remove local system literals; keep widgets outside 126F system law. |
| V8 Runtime test dependency | Reduced motion works only when a test/probe is run. | Tests verify behavior; runtime CSS/JS implements behavior. |

## Three-Lane Review Inputs

The three review agents must verify:

- Staff Engineer: file-level blast radius is complete, no motion framework or
  imported taxonomy is implied, generated output ownership including shadow
  token outputs is clear, and `--duration-snap`/`--duration-spin` handling is
  source-true.
- Senior PM: system motion remains minimal and purposeful, public widgets keep
  product-owned runtime motion, and docs explain the product reason without
  creating user-facing copy work.
- Principal TPM: execution is cohesive/cost-effective, no subsystem is invented,
  V1-V8 controls are explicit, and docs/verification gates are sufficient for
  build, Bob/Roma/Prague/DevStudio Cloudflare Pages, and Tokyo R2 deploy reality.

## Pre-Execution Green Criteria

126F is green for execution only when:

- PRD and audit agree on Dieter/system scope and widget exclusion.
- Prague `--duration-snap` and `--duration-base` consumption is acknowledged.
- `--duration-spin` remains a named pre-execution reconciliation target. It was
  resolved during execution by removal from active source/living docs because no
  current consumer exists.
- `--easing-standard: ease` is decided as current-behavior preservation.
- Component-local reduced-motion blocks and JS-written transitions are both in
  blast radius.
- Documentation updates in `documentation/engineering/UI/**` and
  `documentation/services/**` are named.
- Post-merge Bob/Roma/Prague/DevStudio Cloudflare Pages and Tokyo R2
  verification gates are named for changed deployed surfaces.
- All three review lanes return green with no blocking gaps.
