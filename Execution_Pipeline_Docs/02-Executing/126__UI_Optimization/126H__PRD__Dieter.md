# 126H - PRD: Dieter

Status: PRE-EXECUTION STEPS 6-7 COMPLETE - current-source audit and exact
execution/handoff plan recorded; exact-tree Step-8 review pending; no Step-9
execution credit.
Parent: `126__PRD__UI_Optimization_Program.md` (MAMA).
Series order: 126H of 126A-126M.
KB doc: `documentation/engineering/UI/dieter.md`.

This PRD is the execution authority for the Dieter substrate. It is filled from
Codex and GLM Step 1 as-built evidence, Step 3 official-source research, and
human product direction. It decides the Dieter substrate standard, names the
current gaps, and defines the blast radius for execution.

126H execution must make source and docs match this PRD. It must not create a
new framework, token taxonomy, component library, layout system, focus system,
mobile/touch doctrine, z-index system, elevation system, or compatibility alias
layer.

## Step Inputs

- Step 1 Codex as-built: `audits/126H__AsBuilt_Codex.md`.
- Step 1 GLM as-built: `audits/126H__AsBuilt_GLM.md`.
- Step 3 Codex research: `research/126H_Research_Codex.md`.
- Step 3 GLM research: `research/126H_Research_GLM.md`.
- Step 4 Codex pre-execution audit: `audits/126H__Audit__Dieter.md`.
- Current living doc: `documentation/engineering/UI/dieter.md`.
- Dieter foundation source: `dieter/tokens/dieter-foundation-tokens.css`.
- Dieter token entrypoint: `dieter/tokens/tokens.css`.

## Role

126H owns the Dieter foundation substrate: the by-reference token contract and
the non-color/non-typography/non-motion foundation map that Dieter components
build on.

126H does not own color semantics; 126B owns color. It does not own icon
origination/consumption rules; 126C owns iconography. It does not own
typography; 126D owns typography. It does not own interaction semantics; 126E
owns interactions. It does not own motion/easing; 126F owns motion. It does not
own build/deploy operations; 126G owns ops. It does not own component behavior;
126I owns components. It does not own dialog/modal stacking behavior; 126K owns
dialogs and modals. It does not own DevStudio or Roma surface refactors; 126L
and 126M own those.

126H is not a design-system redesign. Dieter already has a broad and useful
foundation substrate. 126H makes that substrate deterministic, honest, and
agent-operable.

## Pre-GA Cleanup Tenet

Clickeen is pre-GA. Once the 126H Dieter standard is decided, execution cleans
source and docs to that standard.

- Fix source and docs to this PRD.
- Remove stale token names, token aliases, wrappers, local fallbacks, and local
  one-offs from active code/docs.
- Do not support old and new Dieter substrate behavior in parallel.
- Do not add guards/checks/deny lists to preserve behavior that should no
  longer exist.
- Do not document removed behavior as a living option.

Compliance reason: agents need one current Dieter substrate truth. Keeping old
names alive in docs or aliases gives agents leeway to reintroduce them.

## Current Reality Summary

Dieter is a real substrate, not a placeholder. The renewed current-source read
shows that `dieter/tokens/dieter-foundation-tokens.css` defines a broad
foundation. Frozen as-builts describe the earlier pre-cleanup tree where noted:

- structural spacing: `--space-*`;
- vertical rhythm: `--vertspace-*`;
- control sizes and control gaps;
- the `--control-radius-*` scale; numeric `--radius-*` aliases are absent from
  current source after premature cleanup and receive no execution credit;
- icon size tokens;
- no foundation focus-width/offset or touch-target tokens; those historical
  names are absent from current Dieter foundation source;
- motion duration tokens;
- shadow tokens;
- `.sr-only`;
- global reduced-motion guard.

The token entrypoint is composed: `dieter/tokens/tokens.css` imports foundation,
color, and typography. Foundation is not standalone because shadow tokens
reference color tokens from the color file. That by-reference dependency is
current reality and must be documented honestly.

The substrate is strong. The gaps are not "Dieter has no foundation." The gaps
are consumption and drift:

- Dieter is token-defined but only partially token-consumed.
- Components still use local raw values for motion, elevation, and z-index.
- Several defined tokens are unused or not current product law.
- Most stale substrate names are absent. Two live fallback-masked references
  remain outside Dieter source: shared widget `--focus-ring-width` and
  DevStudio `--shadow-lg`.
- Some current scales overlap in unclear ways.
- `--shadow-elevated` is not consumed by Dieter components, but it is consumed
  by Roma and Prague. It is therefore real product blast radius, not a token
  that can be removed as unused.

## Human-Converged Product Reading

The 126H problem is not "invent a better design system." The foundation is
already broad and in some places more granular than the external north stars.
The problem is that agents do not have one clear Dieter substrate contract.

For Clickeen this matters because:

- Agents build and refactor UI. If Dieter substrate rules are unclear, agents
  invent local values.
- Components must consume the substrate by reference when Dieter owns the
  category.
- Unused tokens and fallback-masked drift mislead agents about current law.
- Generated artifacts and app runtimes consume Dieter; they do not own
  Dieter source truth.
- 126I, 126L, and 126M need a stable Dieter substrate before component and
  surface refactors execute.

126H therefore states the substrate contract. It does not create a new
framework, token taxonomy, component library, layout system, focus system, or
mobile/touch doctrine.

## Converged Clickeen Dieter Standard

### Dieter Contract

Target law:

- Dieter source is the system UI substrate authority.
- Dieter tokens are named source decisions.
- Dieter components consume Dieter tokens by reference when Dieter owns that
  substrate category.
- Generated Dieter artifacts are outputs, not source truth.
- App runtimes consume Dieter artifacts; they do not redefine Dieter source
  truth.
- Component-specific exceptions are allowed only when the owning component PRD
  names the exception. Local one-offs must not become hidden substrate.

Compliance reason:

- This names the existing matrioska contract without inventing a new design
  system. It gives agents a deterministic source/consumer model.

### Foundation Token Map

Target law:

- `--space-*` is the structural spacing scale.
- `--vertspace-*` is the real Dieter vertical-rhythm scale. It stays.
- `--control-size-*` defines visual control sizing. It does not define mobile
  touch targets.
- `--control-inline-gap-*` defines control internal gaps. Equal numeric values
  across `--space-*`, `--vertspace-*`, control gaps, padding, or radius tokens
  are not automatically defects. Execution cleans stale spellings and unclear
  authority only; it must not collapse current token authorities just because
  values overlap.
- `--control-radius-*` is the primary radius scale.
- Numeric `--radius-*` aliases are absent. Callers use
  `--control-radius-*`; step 6 verifies they stay absent.
- `--icon-size-*` defines system icon dimensions. Icon use rules remain 126C.
- `--shadow-*` defines shared elevation values only if actually consumed.
- Duration token decisions bridge to 126F.
- `.sr-only` remains a utility for screen-reader-only text where 126A semantics
  require it.

Compliance reason:

- This pins the existing substrate map without adding new token families.

### Space And Vertical Rhythm

Target law:

- `--space-*` is for structural layout spacing.
- `--vertspace-*` is for compact vertical rhythm inside dense UI where the
  design needs finer rhythm than the structural grid. It is current law.

Current verification targets:

- Numeric radius aliases and stale `--hspace-*` / `--vspace-*` vertical-rhythm
  spellings are absent from Dieter source, generated mirrors, Admin/DevStudio,
  and living docs. Step 6 verifies they stay absent.
- Current docs explain when agents use `--space-*` versus `--vertspace-*`.
- Do not reshape `--space-*`, `--vertspace-*`, or `--control-inline-gap-*`
  value scales in 126H unless the exact token/value change is named before
  execution. No spacing migration is currently scheduled.

Compliance reason:

- This keeps the useful Clickeen vertical rhythm idea while removing stale names
  that let agents keep coding both worlds.

### Radius And Shape

Target law:

- `--control-radius-*` is the main Dieter radius scale.
- Numeric `--radius-*` aliases are not current Dieter law.
- Historical audits found `--radius-3` and `--radius-4` aliases plus an
  undefined `--radius-2` consumer. Current source contains none of those names;
  that premature cleanup is current as-built input, not completed execution.
- Do not silently restore `--radius-2`, `--radius-3`, or `--radius-4` to satisfy
  a stale caller or historical document.
- Step 6 must verify all current callers use `--control-radius-*`; it must not
  recreate the already-removed numeric alias concept.
- Do not add compatibility aliases for `--radius-2`, `--radius-3`, or
  `--radius-4`.

Compliance reason:

- This avoids compatibility alias drift. A partial alias series that starts at
  3 teaches agents a broken token model.

### Focus And Touch Tokens

Target law:

- Historical foundation source defined focus-ring width/offset and a minimum
  touch-target token. Current source contains none of them after premature
  cleanup; they are not 126H product doctrine and must not return.
- Clickeen is not a mobile app or touch-first native app.
- 126H must not import Material/Apple 44px target doctrine as Clickeen law.
- 126H must not create a focus framework, keyboard-support project, focus-trap
  system, roving-tabindex system, or mobile target-size doctrine.
- 126A owns accessibility boundaries. 126A does not authorize custom keyboard
  support, keyboard-complete parity, or AI-owned accessibility compliance
  projects.
- `--focus-ring-width`, `--focus-ring-offset`, and `--min-touch-target` are
  absent from current Dieter foundation source and current non-fixture app,
  generated-Dieter, and living-doc consumers. One shared public-widget source
  still references `--focus-ring-width` with an effective `2px` fallback; it is
  a Step-9 deletion target, not a reason to restore the token.
- `--focus-ring-color` is a color token and remains a 126B color-boundary
  decision, not a 126H foundation decision.
- Do not document removed foundation focus/touch tokens as reserved,
  deprecated, legacy, non-current, or future options.
- Historical Admin/DevStudio, Roma, and Prague consumers were part of the
  cleanup blast radius. Current app source contains no consumer. The one shared
  widget reference is fixed directly without restoring an alias, fallback
  doctrine, or 44px/touch law.

Regression verification:

- Do not wire `--min-touch-target` as a 44px mobile/touch standard in 126H.
- Do not wire focus-ring tokens as a keyboard-support doctrine in 126H.
- Replace `var(--focus-ring-width, 2px)` in
  `tokyo/product/widgets/shared/socialShare.css` with literal `2px`, preserving
  current visible focus behavior; update the byte-exact Roma package fixture and
  verify every widget package remains green.
- Verify removed focus/touch target token names remain absent from Dieter,
  generated output, app consumers, shared widget source, and living docs.

Compliance reason:

- This prevents 126H from backdooring mobile/touch or keyboard accessibility
  doctrine after 126A already bounded the accessibility program.

### Elevation And Shadows

Target law:

- Dieter currently has three shadow tokens. Do not expand to a Material-style
  elevation system.
- Shared elevation must either consume current `--shadow-*` tokens or be owned
  locally by the component PRD as a component-specific exception.
- `--shadow-elevated` has real Roma and Prague app/runtime consumers. It
  remains current shared token source unless an owning Roma/Prague/component PRD
  changes those consumers.
- Dieter components do not currently consume `--shadow-elevated`; that is a
  component blast-radius fact for 126I, not permission for 126H to delete a
  product-used token.
- Raw repeated modal/popover-like shadows are drift unless a component PRD owns
  them.
- DevStudio's token-editor panel references undefined `--shadow-lg` behind a
  raw fallback. 126L replaces the masked fallback with current
  `var(--shadow-elevated)` and browser-verifies the panel. 126H must not define
  `--shadow-lg`.

Remaining routing targets:

- Keep `--shadow-elevated` documented as current shared source because
  Roma/Prague consume it. Any rename, value change, or removal must include
  those consumers in the execution blast radius.
- Route repeated raw shadow values that clearly duplicate a shared Dieter
  elevation role to 126I.
- Leave component-specific shadows to 126I when the component owns a real
  exception.

Compliance reason:

- This makes the existing elevation substrate honest without adding new levels,
  overlays, materials, or a shadow framework.

### Layering And Z-Index

Target law:

- 126H does not create a `--z-*` token family.
- Current raw z-index literals must be documented as current component reality,
  not treated as a hidden system.
- Dialog/modal/popover layering belongs to 126K and component implementation
  details belong to 126I.

Remaining routing targets:

- Do not add a z-index scale in 126H.
- Record current z-index/layering drift for 126I/126K execution.

Compliance reason:

- This avoids inventing a global stacking system before the owning dialog/modal
  and component PRDs decide real behavior.

### Undefined And Drift Token References

Target law:

- Undefined no-fallback references are bugs.
- Fallback-masked stale token names are drift, not compatibility law.
- Do not add aliases by default to make stale names survive.
- `--color-surface` belongs to 126B because it is a color naming split between
  component caller and role color tokens.
- Historical `--radius-2` belonged to this PRD's radius decision; current source
  no longer contains it and must not recreate it.
- Stale vertical-rhythm token spellings belong to this PRD's space/vertical-
  rhythm decision.
- `--easing-standard` and `--duration-snap` belong to 126F.
- Icon component sizing variables and glyph ratio questions belong to 126C/126I.

Current verification targets:

- Verify historical `--color-surface`, numeric radius aliases, and stale
  vertical-rhythm spellings remain absent; do not add compatibility aliases.
- Route any newly discovered drift to its owning PRD rather than creating a
  126H catch-all alias layer.

Compliance reason:

- This keeps each fix in the owning PRD and prevents 126H from becoming a
  catch-all alias layer.

### Package And Generated Artifact Shape

Target law:

- Dieter generated artifacts and `manifest.json` are runtime/build outputs.
- `@ck/dieter` is a build/typecheck task package, not a programmatic JS/CSS
  package entrypoint.
- Current `main: index.html` is false because the file does not exist; current
  `prepare` wrongly regenerates deploy output during install. 126G removes both
  together with Dieter's unused GSAP declaration in one package edit.
- Consumers use the current generated/CDN artifact path.
- Real `@clickeen/ck-contracts` and `tldts` dependencies stay because current
  source imports them.
- Manifest-vs-DevStudio registry shape drift is evidence for 126I and 126G, not
  a reason for 126H to invent a new registry.

Compliance reason:

- This documents the current artifact shape without creating a new package or
  registry system.

### Source Research Bar

Current official-source input:

- Material supports named tokens, explicit substrate decisions, and separation
  between visual size and interaction target.
- Apple supports system primitives, spacing/layout discipline, and source
  resources over visual copies.
- OpenAI supports constrained, structured UI primitives for agent-hosted
  surfaces.

Converged implication:

- These sources support Dieter's by-reference substrate premise.
- They do not authorize copying M3 shape/elevation scales, Apple materials, a
  mobile/touch target doctrine, OpenAI hosted UI composition, or any new
  machinery into 126H.
- Dieter is already strong enough at the foundation-definition layer. 126H's
  job is to make it honest and consumed, not bigger.

Compliance reason:

- This uses first-party research as directional evidence while keeping
  Clickeen's product authority and 126 domain boundaries intact.

## Execution Gap Targets

Step 6 verifies the renewed source and living-doc contract. Current docs record
`tokens.css`, the by-reference shadow/color dependency, and the foundation map.
Remaining 126H work is one behavior-preserving shared-widget cleanup plus exact
handoffs to 126G, 126I/126K, and 126L:

- Replace the one shared-widget `--focus-ring-width` fallback reference with its
  current effective literal `2px`; update the byte-exact fixture and tests.
- Do not wire 44px touch targets or keyboard/focus doctrine in 126H.
- Verify stale vertical-rhythm token spellings remain absent.
- Verify historical `--radius-2` and `--color-surface` references remain absent;
  do not restore them through compatibility aliases.
- Route `--duration-snap` and `--easing-standard` to 126F.
- Keep `--shadow-elevated` documented as current shared source because Roma and
  Prague consume it; route future component elevation cleanup to 126I and future
  Roma/Prague app changes to the owning PRD.
- Route DevStudio's undefined `--shadow-lg` fallback to 126L for direct
  replacement with `--shadow-elevated` and browser verification.
- Record raw z-index/layering drift for 126I/126K; do not create a z-index
  token family in 126H.
- Route false Dieter `main`, install-time `prepare`, and unused Dieter GSAP to
  126G's one package edit. Preserve real `@clickeen/ck-contracts` and `tldts`.

## Detailed Execution Blast Radius

Execution must inspect and update this blast radius as needed. If a listed path
does not contain a current hit, execution records that it was checked and leaves
it alone.

| Area | Owner | Exact files / path shapes | Verify | Must not change |
| --- | --- | --- | --- | --- |
| Dieter foundation source | 126H / Dieter substrate | `dieter/tokens/dieter-foundation-tokens.css`; `dieter/tokens/tokens.css` | Verify `--space-*`, `--vertspace-*`, control sizes/gaps, `--control-radius-*`, icon sizes, shadows, `.sr-only`, and reduced-motion import shape. Verify numeric radius aliases and historical focus/touch target tokens remain absent. | Do not add token families, compatibility aliases, focus systems, mobile/touch doctrine, or z-index tokens. |
| Color token boundary | 126B, not 126H | `dieter/tokens/dieter-color-tokens.css`; `dieter/components/button/button.css`; generated mirrors in `tokyo/product/dieter/tokens/` and `tokyo/product/dieter/components/button/button.css` | Verify historical `--color-surface` remains absent and `--focus-ring-color` remains 126B-owned; do not solve color naming in 126H. | Do not add color aliases or contrast/color doctrine in 126H. |
| Generated Dieter token output | Generated from Dieter source | `tokyo/product/dieter/tokens/dieter-foundation-tokens.css`; `tokyo/product/dieter/tokens/dieter-foundation-tokens.shadow.css`; `tokyo/product/dieter/tokens/tokens.css`; `tokyo/product/dieter/tokens/tokens.shadow.css` | Generated output changes only through `pnpm build:dieter`. | Do not hand-edit generated output. |
| Vertical rhythm consumers | 126H / Dieter substrate | `dieter/components/dropdown-upload/dropdown-upload.css`; `dieter/components/dropdown-edit/dropdown-edit.css`; `dieter/components/textfield/textfield.css`; `dieter/components/dropdown-fill/dropdown-fill.css`; `dieter/components/dropdown-actions/dropdown-actions.css`; `dieter/components/textedit/textedit.css`; `dieter/components/dropdown-shadow/dropdown-shadow.css`; `dieter/components/dropdown-border/dropdown-border.css`; `dieter/components/tabs/tabs.css`; generated mirrors in `tokyo/product/dieter/components/`; Admin/DevStudio consumer `admin/src/css/dieter-previews.css` | Verify all current consumers use `--vertspace-*` or the correct owning spacing token and stale spellings remain absent. | Do not document stale spelling as a supported or prohibited pattern. |
| Radius consumers | 126H / Dieter substrate | `dieter/components/bulk-edit/bulk-edit.css`; `dieter/components/object-manager/object-manager.css`; `dieter/components/popover/popover.css`; `dieter/components/repeater/repeater.css`; generated mirrors in `tokyo/product/dieter/components/`; DevStudio/Admin generator and consumers: `admin/scripts/generate-foundation-pages.mjs`, `admin/src/html/foundations/colors.html`, `admin/src/html/foundations/icons.html`, `admin/src/html/foundations/typography.html`, `admin/src/css/utilities.css`, `admin/src/css/layout.css`, `admin/src/css/dieter-previews.css` | Verify current source/generated consumers use `--control-radius-*` and contain no numeric aliases. Record premature cleanup as current input only. | Do not define or preserve numeric radius aliases. |
| Historical focus/touch token blast radius | 126H cleanup/verification | Foundation/color source and generated mirrors; Admin/DevStudio, Roma, Prague, living docs; `tokyo/product/widgets/shared/socialShare.css`; `roma/tests/fixtures/124c-base-package-expected.json` | Replace the live widget `var(--focus-ring-width, 2px)` with literal `2px`, update the byte-exact fixture, run the all-widget package matrix, and verify all other historical names remain absent. | Do not restore Dieter focus/touch tokens, remove visible focus, add aliases/frameworks, or import 44px target law. |
| Shadow/elevation substrate | 126H source, 126I/126L/126M app/component blast radius | `dieter/tokens/dieter-foundation-tokens.css`; generated token mirrors in `tokyo/product/dieter/tokens/`; raw-shadow Dieter components listed by the 126H audit; real `--shadow-elevated` consumers in Roma/Prague; `admin/src/css/utilities.css` token-editor panel | Keep `--shadow-elevated`; route raw component shadows to 126I; 126L replaces undefined `--shadow-lg` fallback with current `--shadow-elevated` and browser-verifies. | Do not remove a product-used token, define `--shadow-lg`, retain a fallback-masked dead name, or expand to an elevation system. |
| Z-index/layering drift | 126I / 126K, recorded by 126H | `dieter/components/bulk-edit/bulk-edit.css`; `dieter/components/object-manager/object-manager.css`; `dieter/components/dropdown-fill/dropdown-fill.css`; `dieter/components/textedit/textedit.css`; `dieter/components/segmented/segmented.css`; `dieter/components/popover/popover.css`; `dieter/components/tabs/tabs.css` | Record raw layering reality for 126I/126K; do not invent `--z-*`. | Do not add a z-index token family in 126H. |
| Motion boundary | 126F, not 126H | `dieter/tokens/dieter-foundation-tokens.css`; `dieter/components/dropdown-fill/dropdown-fill.css`; generated mirrors in `tokyo/product/dieter/` | Route `--duration-snap` and `--easing-standard` to 126F. | Do not decide motion/easing in 126H. |
| Icon boundary | 126C / 126I, not 126H | `dieter/tokens/dieter-foundation-tokens.css`; `dieter/components/icon/icon.css`; `dieter/components/button/button.css`; `dieter/components/menuactions/menuactions.css`; `dieter/components/textedit/textedit.css` | Keep `--icon-size-*` as substrate; route icon consumption/sizing/rendering details to 126C/126I. | Do not add icon origination or component icon rules in 126H. |
| Screen-reader utility | 126A semantics + 126H utility source | `dieter/tokens/dieter-foundation-tokens.css`; `dieter/components/dropdown-shadow/dropdown-shadow.html`; `dieter/components/dropdown-border/dropdown-border.html`; `dieter/components/textedit/textedit.html`; `dieter/components/textedit/textedit-dom.ts`; `dieter/components/repeater/repeater.html`; `dieter/components/tabs/tabs.html`; `dieter/components/tabs/tabs.css`; `dieter/components/toggle/toggle.html`; `dieter/components/toggle/toggle.css` | Preserve `.sr-only` utility where semantics require hidden text/control labels. | Do not turn `.sr-only` into keyboard-support or focus doctrine. |
| Package/artifact shape | 126G implementation / 126H docs | `dieter/package.json`; `pnpm-lock.yaml`; `documentation/services/dieter.md`; `documentation/engineering/UI/dieter.md`; `tokyo/product/dieter/manifest.json` | 126G removes false `main`, install-time `prepare`, and unused Dieter GSAP once; preserve explicit scripts, real dependencies, and generated/CDN consumer path. | Do not invent a package registry/entrypoint or edit the package again in 126F/126H. |
| Living Dieter docs | 126H docs | `documentation/engineering/UI/README.md`; `documentation/engineering/UI/dieter.md`; `documentation/services/dieter.md`; `documentation/engineering/UI/ops.md`; `documentation/engineering/UI/color.md`; `documentation/engineering/UI/iconography.md`; `documentation/engineering/UI/typography.md`; `documentation/engineering/UI/motion.md`; `documentation/engineering/UI/components.md`; `documentation/engineering/UI/dialogs-and-modals.md`; `documentation/engineering/UI/surfaces.md` | Verify the renewed current contract remains consistent: current track mapping, root build path, source authority, 25/24 counts, light-mode boundary, no foundation focus/touch or numeric-radius aliases, no `svg_new` source lane, and current vertspace law. | Do not document removed token names or dead patterns as current doctrine. |
| Product data and deploy boundary | 126H source deploy / account data excluded | `tokyo/product/widgets/shared/socialShare.css`; canonical R2 `product/widgets/shared/socialShare.css`; account runtime paths `accounts/{accountPublicId}/...` | Deploy the one git-authored widget-source cleanup through the normal workflow after 126G parity is green; read back the source object. | Do not mutate account product data, published instance snapshots, or R2 directly. |

## Current Documentation Reconciliation

The renewed pass corrected the formerly stale living-doc claims: root
`scripts/build-dieter.js` is the build authority; current counts are 25 source
directories including `shared` and 24 runtime components; the system is
light-mode only; numeric radius and foundation focus/touch aliases are not
current law; track letters match 126; and `svg_new` is not documented as a
source lane. The living Dieter doc must remain honest that one shared-widget
focus-width reference and false Dieter package metadata are pending Step 9; it
must not claim those deletions already happened.

## Final Step-7 Execution Disposition

126H has one direct behavior-preserving source cleanup and three explicit
handoffs. It does not change Dieter token source or account product data.

1. In `tokyo/product/widgets/shared/socialShare.css`, replace
   `var(--focus-ring-width, 2px)` with literal `2px`. Keep the visible focus
   outline and offset unchanged.
2. Mechanically update the same embedded CSS in
   `roma/tests/fixtures/124c-base-package-expected.json`; run
   `pnpm --filter @clickeen/roma test:instance-package` and require all eight
   widget package parity cases to pass.
3. Let 126G make the only `dieter/package.json` edit: remove Dieter GSAP, false
   `main`, and install-time `prepare`; preserve explicit `build`/`typecheck` and
   real `@clickeen/ck-contracts`/`tldts` dependencies.
4. Let 126L replace DevStudio's fallback-masked `--shadow-lg` declaration with
   `var(--shadow-elevated)` and browser-verify the token editor.
5. Let 126I/126K own exact component shadow/layering behavior; 126H adds no
   elevation or z-index taxonomy.
6. Update living Dieter docs with current-versus-target package and stale-token
   truth. Do not state pending deletions as completed before Step 9.
7. After normal Git deployment, verify the existing workers workflow used the
   126G build/parity gate and read back
   `product/widgets/shared/socialShare.css` from canonical R2. Do not mutate
   `accounts/**` or silently rematerialize published instance snapshots.

Exact deletion map:

- shared widget source and byte-exact fixture: delete the dead
  `var(--focus-ring-width, 2px)` spelling while preserving `2px` behavior;
- 126G package slice: delete Dieter GSAP, false `main`, and install-time
  `prepare` once;
- 126L DevStudio slice: delete undefined `--shadow-lg` and its raw fallback by
  consuming current `--shadow-elevated`.

Exact no-touch boundary: Dieter foundation token values/scales, visible focus
semantics, account/runtime product data, published instance snapshots,
Cloudflare configuration, Roma/Tokyo routes, Berlin, San Francisco, and Babel
operation state.

## V1-V8 Pre-Execution Controls

| ID | 126H risk | Required control |
| --- | --- | --- |
| V1 Silent substitution | Undefined tokens like `--focus-ring-width`, `--shadow-lg`, `--radius-2`, or `--color-surface` get invented aliases. | Preserve effective widget behavior directly, consume current `--shadow-elevated` in 126L, and never add aliases. |
| V2 Silent healing | Stale `--hspace-*` / `--vspace-*` / numeric radius aliases return as compatibility paths. | Preserve their verified absence; do not add aliases. |
| V3 Silent omission | Shared widget source/fixture, package metadata, or DevStudio fallback is dropped because it belongs to another surface. | Execute the one H cleanup and route package/DevStudio/component work once to 126G/126L/126I/126K. |
| V4 Fail-open control | Fallback-masked stale references hide bad substrate truth. | Delete widget `--focus-ring-width` spelling and DevStudio `--shadow-lg` fallback; do not restore definitions. |
| V5 Corruption-as-absence | Broken token references are treated as missing/no-op and left in source. | Undefined no-fallback references and would-be deleted token consumers are bugs/blast radius and must be fixed or routed. |
| V6 Partial-success masquerade | `--shadow-elevated` is treated as unused because Dieter components do not consume it, or the historical focus/touch/radius cleanup is credited as execution. | App/runtime consumers count as real blast radius; preserve product-used tokens and record the cleaned names only as current input until step-9 verification. |
| V7 Masquerade/redress | Numeric radius aliases, focus/touch tokens, or old spacing spellings are renamed as current law. | Delete/remove drift instead of redressing it as current doctrine. |
| V8 Runtime test dependency | Dieter correctness depends on tests/probes instead of source/doc truth. | Source/docs carry the substrate law; checks only verify execution. |

## Verification Checklist

Execution is not complete until these checks are run and reconciled:

- Search Dieter source, generated Dieter output, Admin/DevStudio source, and
  docs for `--hspace-*`, `--vspace-*`, and stale vertical-rhythm names.
- Search Dieter source and generated output for `--radius-2`, `--radius-3`, and
  `--radius-4`.
- Search Dieter, Admin/DevStudio, Roma, Prague, generated Dieter output, and UI
  docs for `--focus-ring-width`, `--focus-ring-offset`, `--focus-ring-color`,
  and `--min-touch-target`. Verify `--focus-ring-color` remains routed to 126B.
- Search `tokyo/product/widgets/shared/socialShare.css` and the Roma byte-exact
  fixture for `--focus-ring-width`; after cleanup require no hit and preserve
  literal `2px` visible focus behavior.
- Search Admin/DevStudio for `--shadow-lg`; after 126L cleanup require no hit,
  verify `--shadow-elevated` consumption, and browser-check the token editor.
- Verify `dieter/package.json` has no `main`, `prepare`, or GSAP after the
  126G-owned edit; verify `@clickeen/ck-contracts`, `tldts`, `build`, and
  `typecheck` remain.
- Search Dieter docs for `dark-ready`, `dieter/scripts/build-dieter.js`, and
  stale component count.
- Search UI docs for stale 126 track mapping and `dieter/icons/svg_new/`.
- Search Roma/Prague for `--shadow-elevated` before changing/removing any
  shadow token.
- Search Dieter source for `--color-surface`, `--duration-snap`, and
  `--easing-standard` and verify routing to owning PRDs.
- Run `pnpm build:dieter` after Dieter source changes.
- Run `pnpm --filter @ck/dieter typecheck` after Dieter component/source
  changes.
- Run `pnpm --filter @clickeen/roma test:instance-package` after the shared
  widget source/fixture cleanup and require all eight package parity cases.
- Run `pnpm dieter:governance:check` after Dieter generated-artifact changes.
- Run `pnpm --filter @clickeen/devstudio generate` and
  `pnpm --filter @clickeen/devstudio build` if Admin/DevStudio generator,
  preview, or foundation HTML consumers change.
- Run focused Roma checks, at minimum `pnpm --filter @clickeen/roma lint` or
  the owning build/typecheck command, if Roma runtime consumers change.
- Run focused Prague checks, at minimum `pnpm --filter @clickeen/prague build`
  or `pnpm --filter @clickeen/prague typecheck`, if Prague runtime consumers
  change.
- Capture before/after visual evidence for affected Dieter previews/components
  and any touched Admin/DevStudio, Roma, or Prague consumers. Visual parity is
  required unless the human explicitly approves a visual change.
- Verify generated `tokyo/product/dieter/**` changes come from build only.
- Verify the normal Git workflow deploys/read-backs only the changed product
  widget source (plus other owning 126 outputs); no direct R2 write or account
  product-data mutation is performed by 126H.

## Out Of Scope For This PRD

- No redesign or new visual language.
- No new z-index token family.
- No breakpoint/grid/layout token system.
- No elevation expansion.
- No focus framework.
- No keyboard-support project.
- No mobile/touch target doctrine.
- No contrast enforcement.
- No color naming decision beyond routing `--color-surface` to 126B.
- No typography, iconography, motion, build/deploy, component behavior redesign,
  dialog/modal behavior redesign, DevStudio redesign, Roma refactor, or Prague
  refactor. Exact token-consumer cleanup listed in the blast radius is in scope
  when needed to remove stale Dieter substrate tokens safely.
- No compatibility alias layer.

## GLM Input Integrated

GLM's independent as-built and research passes are integrated into the
converged standard above. This section preserves the high-signal findings that
shaped the final product law.

Confirmed GLM findings:

- The foundation substrate is broad and useful.
- `--vertspace-*` is a distinct Clickeen vertical-rhythm idea, not an M3 copy.
- Historical source consumed `--radius-3` and `--radius-4`; current source has
  removed them in favor of `--control-radius-*`.
- Dieter is token-defined but only partially token-consumed.
- Historical source contained undefined no-fallback `--color-surface` and
  `--radius-2` references; current source contains neither.
- Stale vertical-rhythm token spellings are absent and must not be restored as
  documented concepts.
- Some defined tokens are unused or not current product law.
- Elevation is partially tokenized and partially raw/ad hoc.
- Z-index/layering uses raw literals and is not a Dieter token system.
- Foundation shadows depend on color tokens through the composed token
  entrypoint.
- External research supports named substrate decisions, but not importing a
  larger design-system model.

Converged implication:

- 126H must preserve the strong foundation, delete or route drift, and prepare
  126I/126K/126L/126M to consume Dieter deterministically. It must not make
  Dieter bigger or turn Dieter into a new UI framework.
