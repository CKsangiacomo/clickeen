# 126H - PRD: Dieter

Status: PRE-EXECUTION READY - three-lane review green.
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

Dieter is a real substrate, not a placeholder. Both as-built passes agree that
`dieter/tokens/dieter-foundation-tokens.css` defines a broad foundation:

- structural spacing: `--space-*`;
- vertical rhythm: `--vertspace-*`;
- control sizes and control gaps;
- control radii and the consumed `--radius-3` / `--radius-4` aliases;
- icon size tokens;
- focus/touch tokens;
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
- Several consumers reference undefined or stale token names.
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
- Numeric `--radius-*` aliases are drift to remove. Callers move to
  `--control-radius-*`.
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

Execution gap targets:

- Replace stale vertical-rhythm token spellings, including `--hspace-*` and any
  discovered `--vspace-*`, with matching `--vertspace-*` tokens or the correct
  owning spacing token.
- Current stale vertical-rhythm consumers include Dieter component CSS,
  generated Dieter mirrors, and Admin/DevStudio preview CSS.
- Remove stale vertical-rhythm token spellings from source and docs.
- Document when agents use `--space-*` versus `--vertspace-*`.
- Do not reshape `--space-*`, `--vertspace-*`, or `--control-inline-gap-*`
  value scales in 126H unless the exact token/value change is named before
  execution. The current known execution target is stale spelling cleanup.

Compliance reason:

- This keeps the useful Clickeen vertical rhythm idea while removing stale names
  that let agents keep coding both worlds.

### Radius And Shape

Target law:

- `--control-radius-*` is the main Dieter radius scale.
- Numeric `--radius-*` aliases are not current Dieter law.
- The current alias state is inconsistent: `--radius-3` and `--radius-4` exist
  and are consumed, while `--radius-2` is referenced without definition. That
  is drift to clean, not an alias family to complete.
- Numeric radius aliases are also consumed by Admin/DevStudio generator and
  generated foundation pages. Those consumers are part of the removal blast
  radius; generator source must change before regenerated DevStudio HTML.
- Do not silently add `--radius-2` just to satisfy a stale caller.
- Execution must remove the numeric alias concept and move callers to
  `--control-radius-*`.
- Do not add compatibility aliases for `--radius-2`, `--radius-3`, or
  `--radius-4`.

Compliance reason:

- This avoids compatibility alias drift. A partial alias series that starts at
  3 teaches agents a broken token model.

### Focus And Touch Tokens

Target law:

- Focus and touch-target tokens exist in the foundation source, but they are not
  current 126H product doctrine.
- Clickeen is not a mobile app or touch-first native app.
- 126H must not import Material/Apple 44px target doctrine as Clickeen law.
- 126H must not create a focus framework, keyboard-support project, focus-trap
  system, roving-tabindex system, or mobile target-size doctrine.
- 126A owns accessibility boundaries. 126A does not authorize custom keyboard
  support, keyboard-complete parity, or AI-owned accessibility compliance
  projects.
- The current Dieter foundation tokens `--focus-ring-width`,
  `--focus-ring-offset`, and `--min-touch-target` are removed from current
  Dieter foundation law during 126H execution.
- `--focus-ring-color` is a color token and remains a 126B color-boundary
  decision, not a 126H foundation decision.
- Do not document removed foundation focus/touch tokens as reserved,
  deprecated, legacy, non-current, or future options.
- Admin/DevStudio, Roma, and Prague currently consume the foundation focus/touch
  tokens. Those references are blast radius, not product-law proof. Token
  deletion must either clean those app/runtime consumers in the same execution
  path or explicitly route the consumer to its owning PRD before deletion.
  No alias, fallback doctrine, or 44px/touch law survives.

Execution gap targets:

- Do not wire `--min-touch-target` as a 44px mobile/touch standard in 126H.
- Do not wire focus-ring tokens as a keyboard-support doctrine in 126H.
- Remove focus/touch target token claims from source/docs unless an owning PRD
  has current product law for a specific surviving token.
- Replace Admin/DevStudio, Roma, and Prague app/runtime consumer references
  before removing Dieter token definitions, or route the exact consumer file to
  its owning PRD before token deletion.

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

Execution gap targets:

- Document `--shadow-elevated` as current shared source because Roma/Prague
  consume it. Any rename, value change, or removal must include those consumers
  in the execution blast radius.
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

Execution gap targets:

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
- `--radius-2` belongs to this PRD's radius decision because it is a shape alias
  gap.
- Stale vertical-rhythm token spellings belong to this PRD's space/vertical-
  rhythm decision.
- `--easing-standard` and `--duration-snap` belong to 126F.
- Icon component sizing variables and glyph ratio questions belong to 126C/126I.

Execution gap targets:

- Route `--color-surface` to 126B color convergence; do not solve it in 126H.
- Resolve `--radius-2` through the radius law; do not silently add a
  compatibility alias.
- Complete stale vertical-rhythm token spelling cleanup because `--vertspace-*`
  is current law.
- Remove fallback-masked stale names once callers are fixed.

Compliance reason:

- This keeps each fix in the owning PRD and prevents 126H from becoming a
  catch-all alias layer.

### Package And Generated Artifact Shape

Target law:

- Dieter generated artifacts and `manifest.json` are runtime/build outputs.
- `@ck/dieter` is not currently a normal programmatic JS/CSS package entrypoint
  if its package entry resolves to `index.html`.
- Consumers should use the current generated/CDN artifact path unless 126G/126I
  decide a different package contract.
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

126H execution must fix source/docs against this standard:

- Rewrite `documentation/engineering/UI/dieter.md` around the converged Dieter
  substrate contract.
- Document `tokens.css` as the composed entrypoint and document the foundation
  file's by-reference dependency on color tokens for shadows.
- Document the foundation token map plainly: `--space-*`, `--vertspace-*`,
  control sizes/gaps, radii, icon sizes, shadows, duration bridge, `.sr-only`.
- Remove focus/touch target token claims from current Dieter source/docs unless
  another owning PRD already has current product law for a specific surviving
  token.
- Do not wire 44px touch targets or keyboard/focus doctrine in 126H.
- Remove stale vertical-rhythm token spellings from source and docs.
- Resolve `--radius-2` through the decided radius law, without silently adding
  compatibility aliases.
- Route `--color-surface` to 126B.
- Route `--duration-snap` and `--easing-standard` to 126F.
- Keep `--shadow-elevated` documented as current shared source because Roma and
  Prague consume it; route future component elevation cleanup to 126I and future
  Roma/Prague app changes to the owning PRD.
- Record raw z-index/layering drift for 126I/126K; do not create a z-index
  token family in 126H.
- Record package/generated artifact shape honestly, including the current
  `@ck/dieter` package entrypoint limitation.
- Remove duplicate GLM/Codex addendum layering from the PRD; keep findings
  integrated into the standard.

## Detailed Execution Blast Radius

Execution must inspect and update this blast radius as needed. If a listed path
does not contain a current hit, execution records that it was checked and leaves
it alone.

| Area | Owner | Exact files / path shapes | Verify | Must not change |
| --- | --- | --- | --- | --- |
| Dieter foundation source | 126H / Dieter substrate | `dieter/tokens/dieter-foundation-tokens.css`; `dieter/tokens/tokens.css` | Verify `--space-*`, `--vertspace-*`, control sizes/gaps, `--control-radius-*`, icon sizes, shadows, `.sr-only`, and reduced-motion import shape. Remove numeric radius aliases and focus/touch target tokens from current 126H law. | Do not add token families, compatibility aliases, focus systems, mobile/touch doctrine, or z-index tokens. |
| Color token boundary | 126B, not 126H | `dieter/tokens/dieter-color-tokens.css`; `dieter/components/button/button.css`; generated mirrors in `tokyo/product/dieter/tokens/` and `tokyo/product/dieter/components/button/button.css` | Route `--color-surface` and focus-ring color decisions to 126B; do not solve color naming in 126H. | Do not add color aliases or contrast/color doctrine in 126H. |
| Generated Dieter token output | Generated from Dieter source | `tokyo/product/dieter/tokens/dieter-foundation-tokens.css`; `tokyo/product/dieter/tokens/dieter-foundation-tokens.shadow.css`; `tokyo/product/dieter/tokens/tokens.css`; `tokyo/product/dieter/tokens/tokens.shadow.css` | Generated output changes only through `pnpm build:dieter`. | Do not hand-edit generated output. |
| Vertical rhythm consumers | 126H / Dieter substrate | `dieter/components/dropdown-upload/dropdown-upload.css`; `dieter/components/dropdown-edit/dropdown-edit.css`; `dieter/components/textfield/textfield.css`; `dieter/components/dropdown-fill/dropdown-fill.css`; `dieter/components/dropdown-actions/dropdown-actions.css`; `dieter/components/textedit/textedit.css`; `dieter/components/dropdown-shadow/dropdown-shadow.css`; `dieter/components/dropdown-border/dropdown-border.css`; `dieter/components/tabs/tabs.css`; generated mirrors in `tokyo/product/dieter/components/`; Admin/DevStudio consumer `admin/src/css/dieter-previews.css` | Replace stale `--hspace-*` references, and any discovered `--vspace-*` references, with current `--vertspace-*` or the correct owning spacing token. | Do not document stale spelling as a supported or prohibited pattern after cleanup. |
| Radius consumers | 126H / Dieter substrate | `dieter/components/bulk-edit/bulk-edit.css`; `dieter/components/object-manager/object-manager.css`; `dieter/components/popover/popover.css`; `dieter/components/repeater/repeater.css`; generated mirrors in `tokyo/product/dieter/components/`; DevStudio/Admin generator and consumers: `admin/scripts/generate-foundation-pages.mjs`, `admin/src/html/foundations/colors.html`, `admin/src/html/foundations/icons.html`, `admin/src/html/foundations/typography.html`, `admin/src/css/utilities.css`, `admin/src/css/layout.css`, `admin/src/css/dieter-previews.css` | Replace `--radius-2`, `--radius-3`, and `--radius-4` consumers with `--control-radius-*`. Update generator source before regenerated DevStudio HTML. Move all consumers before removing aliases. | Do not define or preserve numeric radius aliases. |
| Focus/touch token consumers | 126H routes app/runtime cleanup to owning PRDs before token deletion | Source tokens: `dieter/tokens/dieter-foundation-tokens.css`, `dieter/tokens/dieter-color-tokens.css`; generated mirrors in `tokyo/product/dieter/tokens/`; Admin/DevStudio consumers: `admin/src/css/utilities.css`, `admin/scripts/generate-foundation-pages.mjs`, `admin/src/html/foundations/colors.html`, `admin/src/html/foundations/typography.html`, `admin/src/html/tools/entitlements.html`; Roma consumers: `roma/app/roma.css`; Prague consumers: `prague/public/styles/primitives.css`, `prague/src/components/InstanceEmbed.astro`, `prague/src/blocks/site/nav/Nav.astro`; docs: `documentation/engineering/UI/dieter.md`, `documentation/engineering/UI/color.md` | Remove focus/touch from 126H doctrine. Before deleting token definitions, replace every consumer with the owning current value or route the consumer to its owning PRD. | Do not preserve these as Dieter law, add aliases, create focus/touch doctrine, or import 44px target law. |
| Shadow/elevation substrate | 126H source, 126I/126L/126M app/component blast radius | `dieter/tokens/dieter-foundation-tokens.css`; generated token mirrors in `tokyo/product/dieter/tokens/`; Dieter component shadow consumers in `dieter/components/choice-tiles/choice-tiles.css`, `dieter/components/textedit/textedit.css`, `dieter/components/popover/popover.css`; raw-shadow Dieter components in `dieter/components/bulk-edit/bulk-edit.css`, `dieter/components/object-manager/object-manager.css`, `dieter/components/slider/slider.css`, `dieter/components/toggle/toggle.css`, `dieter/components/dropdown-fill/dropdown-fill.css`, `dieter/components/dropdown-border/dropdown-border.css`, `dieter/components/dropdown-shadow/dropdown-shadow.css`, `dieter/components/segmented/segmented.css`; real `--shadow-elevated` app consumers in `roma/app/roma.css`, `prague/src/components/StepsPrimitive.astro`, `prague/src/blocks/subpage-cards/subpage-cards.astro`, `prague/public/styles/primitives.css` | Keep `--shadow-elevated` as current shared source while Roma/Prague consume it. Route raw component shadow cleanup to 126I. Any shadow token rename/value/removal must include generated tokens plus Roma/Prague app consumers. | Do not remove a product-used token as "unused"; do not expand to an elevation system. |
| Z-index/layering drift | 126I / 126K, recorded by 126H | `dieter/components/bulk-edit/bulk-edit.css`; `dieter/components/object-manager/object-manager.css`; `dieter/components/dropdown-fill/dropdown-fill.css`; `dieter/components/textedit/textedit.css`; `dieter/components/segmented/segmented.css`; `dieter/components/popover/popover.css`; `dieter/components/tabs/tabs.css` | Record raw layering reality for 126I/126K; do not invent `--z-*`. | Do not add a z-index token family in 126H. |
| Motion boundary | 126F, not 126H | `dieter/tokens/dieter-foundation-tokens.css`; `dieter/components/dropdown-fill/dropdown-fill.css`; generated mirrors in `tokyo/product/dieter/` | Route `--duration-snap` and `--easing-standard` to 126F. | Do not decide motion/easing in 126H. |
| Icon boundary | 126C / 126I, not 126H | `dieter/tokens/dieter-foundation-tokens.css`; `dieter/components/icon/icon.css`; `dieter/components/button/button.css`; `dieter/components/menuactions/menuactions.css`; `dieter/components/textedit/textedit.css` | Keep `--icon-size-*` as substrate; route icon consumption/sizing/rendering details to 126C/126I. | Do not add icon origination or component icon rules in 126H. |
| Screen-reader utility | 126A semantics + 126H utility source | `dieter/tokens/dieter-foundation-tokens.css`; `dieter/components/dropdown-shadow/dropdown-shadow.html`; `dieter/components/dropdown-border/dropdown-border.html`; `dieter/components/textedit/textedit.html`; `dieter/components/textedit/textedit-dom.ts`; `dieter/components/repeater/repeater.html`; `dieter/components/tabs/tabs.html`; `dieter/components/tabs/tabs.css`; `dieter/components/toggle/toggle.html`; `dieter/components/toggle/toggle.css` | Preserve `.sr-only` utility where semantics require hidden text/control labels. | Do not turn `.sr-only` into keyboard-support or focus doctrine. |
| Package/artifact shape | 126G / 126H docs | `dieter/package.json`; `documentation/services/dieter.md`; `documentation/engineering/UI/dieter.md`; `tokyo/product/dieter/manifest.json` | Document current package/artifact shape honestly; generated/CDN artifacts are current consumer path. | Do not invent a new package registry or package entrypoint in 126H. |
| Living Dieter docs | 126H docs | `documentation/engineering/UI/README.md`; `documentation/engineering/UI/dieter.md`; `documentation/services/dieter.md`; `documentation/engineering/UI/ops.md`; `documentation/engineering/UI/color.md`; `documentation/engineering/UI/iconography.md`; `documentation/engineering/UI/typography.md`; `documentation/engineering/UI/motion.md`; `documentation/engineering/UI/components.md`; `documentation/engineering/UI/dialogs-and-modals.md`; `documentation/engineering/UI/surfaces.md` | Rewrite Dieter docs around the current substrate contract; fix stale track mapping, stale build path, source-of-truth path, component count, dark-ready language, focus/touch claims, `svg_new` source-layout claim, and radius/vertspace law. | Do not document removed token names or dead patterns as current doctrine. |
| Product data and deploy boundary | Not 126H | `documentation/services/tokyo.md`; `documentation/services/tokyo-worker.md`; account runtime paths `accounts/{accountPublicId}/...` in docs | State that Dieter substrate execution does not mutate account/runtime product data or deploy state. | Do not touch product data or deploy artifacts outside generated Dieter output from build. |

## Required Documentation Repairs

Execution must repair these known doc falsehoods:

- `documentation/engineering/UI/dieter.md` currently lists `dieter/scripts/*`
  as source of truth; root `scripts/build-dieter.js` is the active build
  script and `dieter/scripts/` must not be presented as active UI ops truth.
- `documentation/engineering/UI/dieter.md` currently says there are about 27
  components; the current component folder count is 26.
- `documentation/engineering/UI/dieter.md` currently says the build path is
  `dieter/scripts/build-dieter.js`; active build is root `scripts/build-dieter.js`.
- `documentation/engineering/UI/dieter.md` currently says the engine is
  dark-ready. 126B says no dark mode and no dark-ready scaffolding.
- `documentation/engineering/UI/dieter.md` currently lists focus/touch target
  tokens as foundation doctrine. 126H removes them from current Dieter law.
- `documentation/engineering/UI/README.md` currently maps Dieter/color/type/
  motion/icon/component tracks to stale 126 letters. It must map Dieter to 126H
  and keep the remaining track references aligned to the current PRD series.
- `documentation/services/dieter.md` currently lists `dieter/icons/svg_new/` as
  an optional icon override input. 126C and 126G say that lane is not current
  product law; living Dieter docs must remove it as source truth. The
  `scripts/build-dieter.js` `svg_new` block is a blocking stale-concept cleanup
  routed to 126C/126G execution, not a living Dieter source path for 126H docs.

## V1-V8 Pre-Execution Controls

| ID | 126H risk | Required control |
| --- | --- | --- |
| V1 Silent substitution | Undefined tokens like `--radius-2` or `--color-surface` get invented aliases. | Route to owning PRD or replace callers with current tokens; do not silently add aliases. |
| V2 Silent healing | Stale `--hspace-*` / `--vspace-*` / numeric radius aliases are normalized into compatibility paths. | Remove stale names from source/docs after callers are updated. |
| V3 Silent omission | A substrate gap or app/runtime consumer is dropped because it belongs to another PRD. | Route each gap explicitly to 126B/126C/126F/126I/126K/126L/126M as applicable; include Admin/DevStudio, Roma, and Prague consumers before token deletion. |
| V4 Fail-open control | Fallback-masked stale references keep working and hide bad substrate truth. | Remove fallback-masked stale names once callers are fixed. |
| V5 Corruption-as-absence | Broken token references are treated as missing/no-op and left in source. | Undefined no-fallback references and would-be deleted token consumers are bugs/blast radius and must be fixed or routed. |
| V6 Partial-success masquerade | `--shadow-elevated` is treated as unused because Dieter components do not consume it, while Roma/Prague still do; focus/touch or radius cleanup is called complete while app/runtime consumers still reference removed names. | App/runtime consumers count as real blast radius; do not remove/de-scope product-used tokens as fake doctrine or call cleanup complete ahead of consumers. |
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
- Verify no product data or deploy operation is performed by 126H execution.

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
- `--radius-3` and `--radius-4` are consumed aliases, not ghost tokens.
- Dieter is token-defined but only partially token-consumed.
- `--color-surface` and `--radius-2` are undefined no-fallback references.
- Stale vertical-rhythm token spellings must be removed, not preserved as
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
