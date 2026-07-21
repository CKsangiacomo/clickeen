# 126F - Current-Source Pre-Execution Audit: Motion

Status: STEP 6 CORRECTED AFTER RED EXACT-TREE STEP-8 REVIEW - current source and
the 126G generated/deploy handoff are re-audited through tree `61e5dbbf`; Step 7
is defined in `../126F__PRD__Motion.md`; no Step-9 execution credit.
PRD: `../126F__PRD__Motion.md`.

## Audit Question

What motion work remains after the premature 126F source changes, and what
must the final integrated execution preserve without inventing another motion
system or repeating completed work?

## Authority Gate

| Authority | Current owner |
| --- | --- |
| Product surface | Dieter/system motion in Dieter, Bob, Roma, and DevStudio/Admin operational chrome. |
| Shared baseline consumers | Bob, Roma, DevStudio/Admin, Prague, and public widgets load the Dieter token entrypoint and inherit its global CSS reduced-motion guard. |
| Product surface excluded | Widget-specific choreography and JS-driven runtime motion beyond the shared CSS baseline. |
| Token source | `dieter/tokens/dieter-foundation-tokens.css`. |
| Generated deploy output | `tokyo/product/dieter/**`, generated from Dieter source. |
| Prague boundary | Consumer of the global token entrypoint and animated pseudo-elements; verification blast radius for the selector correction. |
| Account/session, route, storage, product data | Not touched. |
| Verification | Current source grep, Dieter governance/build, mandatory Roma/Prague/widget browser evidence for the shared selector change, and owning-surface evidence for any later edits. |

## Commands And Checks

The Step-6 pass read current source and ran:

```bash
rg -n -- '--duration-(snap|base|spin)|--easing-standard' \
  dieter bob roma admin prague tokyo/product/dieter \
  documentation/engineering/UI documentation/services
rg -n --glob '*.{css,js,ts,tsx}' \
  '(transition[^;]*[0-9.]+m?s|transition[^;]*\\bease\\b|cubic-bezier\\()' \
  dieter bob roma admin
rg -n -C 5 -- '@media \\(prefers-reduced-motion: reduce\\)' \
  dieter/components
rg -n -C 3 -- 'prefers-reduced-motion|style\\.transition' \
  dieter/components/repeater dieter/tokens admin/src/css bob/app roma/app
rg -n '"gsap"|\\bgsap\\b|GreenSock' \
  --glob '!node_modules/**' --glob '!Execution_Pipeline_Docs/**' \
  --glob '!documentation/**' .
pnpm why gsap -r
cmp dieter/tokens/dieter-foundation-tokens.css \
  tokyo/product/dieter/tokens/dieter-foundation-tokens.css
cmp dieter/components/repeater/repeater.js \
  tokyo/product/dieter/components/repeater/repeater.js
pnpm dieter:governance:check
pnpm build:dieter
```

All commands completed, but the build exposed a tracked manifest provenance
delta described below. The pre-execution pass restored that generated artifact
after recording the gap; source/product state was not mutated. The only other
workspace residue remains the pre-existing untracked `tokyo/product/fonts/`,
which this pass did not touch.

## Proven Current State

### Foundation and generated output are clean

- The only active foundation durations are `--duration-snap: 140ms` and
  `--duration-base: 160ms`.
- `--easing-standard: ease` is defined once in the foundation source.
- `--duration-spin` is absent from active source and living documentation.
- Dieter source and inspected Tokyo generated token/component output match.
- Dieter governance and build are green.

`tokyo/product/dieter/manifest.json` is not current: it records `de408dda`,
while the current builder's incomplete scoped query over `dieter`,
`scripts/build-dieter.js`, and `scripts/verify-svgs.js` returns `c299c783`.
Running `pnpm build:dieter` changes only that provenance value at the audited
tree. 126G removes this generated tree from Git tracking and expands provenance
to include root `package.json` and `pnpm-lock.yaml`, which also determine built
bytes. Because 126F changes Dieter source, its Step-9 slice commits source first,
rebuilds ignored deploy output, and verifies provenance against that complete
input scope locally and in R2.

The build is not deterministic between local and GitHub execution. Current
`scripts/build-dieter.js` prefers `GITHUB_SHA` over the scoped Dieter-input
commit. A local build can therefore stamp source-input commit A while CI stamps
deployment commit B and uploads different bytes. 126G owns removal of that
environment-SHA precedence, deletion of generated output from Git, and the one
build-before-sync entrypoint. 126F cannot deploy its regenerated output until
that 126G operation path is in place.

### Operational consumers are clean

- Dieter operational transitions use the foundation duration/easing tokens.
- The inspected Bob, Roma, and Admin operational chrome has no local literal
  timing, bare easing, or custom curve.
- The old duplicate Admin global reduced-motion rule is absent.
- Segmented uses the foundation tokens rather than a local curve.
- Component-local reduced-motion selectors remain where a component owns the
  moving selector directly.

The foundation `@media (prefers-reduced-motion: reduce)` selector currently
targets `*` only. CSS pseudo-elements are not descendants matched by `*`.
`roma/app/roma.css` animates the Widget Defaults toggle knob on
`input[type='checkbox']::after`, so that transform transition remains active in
reduced-motion mode. The repo-wide pseudo-element motion scan found no other
system spatial pseudo-element transition; Dieter's swatch pseudo-element only
transitions border color. Step 9 fixes the authoritative foundation selector
once with `*, *::before, *::after` rather than adding a Roma-local exception.

### One unused framework dependency remains

- `bob/package.json` declares `gsap: ^3.13.0`.
- `dieter/package.json` declares `gsap: ^3.12.5`.
- `pnpm-lock.yaml` carries both importer entries and `gsap@3.13.0`.
- A repository source scan found no GSAP import, require, dynamic import,
  global access, or runtime use. `pnpm why gsap -r` reports only those direct
  declarations and Roma's transitive link through Bob.

Keeping an unused animation framework contradicts the lean motion law and
creates false architecture for future agents. Step 9 deletes the two
dependencies and regenerates the lockfile. It does not replace GSAP.

### JS reduced motion is source-true

`dieter/components/repeater/repeater.js` checks
`prefers-reduced-motion: reduce` before assigning either visual-state or drag
transitions. Reduced mode uses `transition: none`.

The drag transform itself remains because it is direct pointer manipulation,
not autonomous animation. Disabling it would break the product control. The
correct law is: preserve immediate manipulation; remove interpolation and
animated transition under reduced motion.

### Prague and widgets share the baseline but keep source ownership

- Prague loads the Dieter token entrypoint. `StepsPrimitive` animates
  `::before` and `::after`, so the global selector correction changes Prague
  runtime behavior even though no Prague source file is edited.
- Current public widget templates load `/dieter/tokens/tokens.css`; materialized
  widgets preserve that link. The global CSS guard is therefore a shared
  baseline for widget CSS motion.
- Prague source and widget source remain no-edit surfaces in 126F. Execution
  verifies normal/reduced behavior on Prague and one current widget. Widget JS
  and independent choreography beyond the baseline remain widget-owned.

### Living documentation records current versus target truth

`documentation/engineering/UI/motion.md` records the current two-token law,
standard easing, direct-manipulation rule, and the shared-baseline/widget-owned
boundary. It states that pseudo-element coverage is a pending 126F execution
target until the source selector actually changes.

## Exact Step-7 Disposition

There is one exact standalone cleanup set: unused dependency deletion, one
authoritative reduced-motion selector correction, and regenerated output.

| Area | Step-9 disposition | Must not do |
| --- | --- | --- |
| Unused GSAP declarations | Delete Bob's declaration; 126G removes Dieter's declaration in its single package edit; regenerate `pnpm-lock.yaml`. | No duplicate Dieter package edit, replacement library, wrapper, or compatibility path. |
| Foundation reduced-motion selector | Add `*::before` and `*::after` beside `*`; regenerate Tokyo token output; browser-verify Roma, Prague, and one public widget consumer. | No Roma/Prague/widget-local duplicate guard or broad motion rewrite. |
| Generated manifest | Build after the Dieter source commit and inspect the ignored deploy output plus R2 read-back. | No hand-authored, committed, or stale generated provenance. |
| Deterministic build/deploy path | 126G removes CI deployment-SHA precedence, removes generated output from Git, and makes the sole sync entrypoint build first. | No second manifest identity, manual bypass, or generated-file commit protocol. |
| Dieter foundation/components | Preserve and regression-check if another domain changes them. | No new token, curve, framework, or repeated migration. |
| Generated Tokyo Dieter output | Regenerate after source changes; inspect local output and deployed R2 bytes. | No Git tracking or hand edits. |
| Roma chrome | Mandatory browser verification of the Widget Defaults toggle in normal and reduced-motion modes because the global Dieter selector changes its runtime behavior. | No Roma-local guard or layout redesign. |
| Bob/Admin chrome | Source regression-check; browser-verify only if an owning later slice changes those files. | No interaction or layout redesign under 126F. |
| Prague | Source no edit; browser verification required for `StepsPrimitive` under normal/reduced motion. | No cleanup of site-local motion in 126F. |
| Public widgets | Source no edit; after exact-SHA deploy and R2 read-back, browser verification is required for the current public Cards widget. | Widget-specific JS choreography stays widget-owned; no universal widget-motion doctrine. If no public Cards instance exists, fail the gate rather than silently substituting or creating product data. |
| Product data/services | No product-data or service mutation. Normal Git deployment, exact-SHA workflow verification, R2 read-back, and post-deploy browser evidence are mandatory verification. | No direct R2 mutation, DB/route/queue/policy change, or deploy-path implementation outside 126G. |

Exact deletion/change map: Bob's package declaration, Dieter's declaration in
the 126G-owned combined package edit, their mechanically unreachable lockfile
entries, one foundation selector, tracked generated Dieter output, and stale
manifest provenance. Current source contains none of the other stale motion
behavior the old point-in-time audit described.

## V1-V8 Pre-Execution Result

| ID | Result | Evidence/control |
| --- | --- | --- |
| V1 Silent substitution | PASS | Easing resolves through the defined foundation token; no fallback masquerade remains. |
| V2 Silent healing | PASS | No runtime or persisted state is normalized; Step 7 records current behavior exactly. |
| V3 Silent omission | PASS | Prague consumers, pseudo-elements, component-local selectors, JS-written transitions, GSAP declarations, and manifest provenance are explicitly covered. |
| V4 Fail-open control | OPEN UNTIL STEP 9 | Foundation selector must cover real and pseudo-elements; the manual sync build bypass must be removed; repeater keeps its direct runtime branch. |
| V5 Corruption-as-absence | PASS / N/A | 126F touches no persisted product data. |
| V6 Partial-success masquerade | OPEN UNTIL STEP 9 | The exact deletion and browser/deploy evidence are named; no source change may be called deployed before the build/sync and R2 read-back succeed. |
| V7 Masquerade/redress | PASS | GSAP is deleted without a replacement wrapper; completed migration is not repeated; widget motion stays outside Dieter law. |
| V8 Runtime test dependency | PASS | CSS/JS carries behavior; checks only verify it. |

## Step-8 Review Questions

1. Does the product law preserve immediate direct manipulation while removing
   animated interpolation under reduced motion?
2. Is the exact GSAP deletion complete, with no active consumer or required
   package surface omitted?
3. Does `*, *::before, *::after` fix the one real pseudo-element gap without
   creating local exceptions or changing direct manipulation?
4. Is generated manifest provenance repaired in the correct commit/build order?
5. Are Prague and public-widget boundaries exact?
6. Does the final plan avoid fake deploy/visual work while still catching drift
   introduced by later 126 slices?
