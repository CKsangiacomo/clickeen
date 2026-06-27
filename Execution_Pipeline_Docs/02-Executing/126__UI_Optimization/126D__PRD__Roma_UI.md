# 126D — Track PRD: Roma UI

Parent: `126__PRD__UI_Optimization_Program.md` (MAMA) — **track 4 of 4** (the
outermost doll, and the largest surface). Roma consumes Dieter components + the
tokenization guard from 126C; every screen must be built from components + one
shared primitive set, with no parallel `.roma-*` system.

Status: **DIRECTIONAL.** The body below is the prior draft (2026-06-23), kept in
full as seed content; it is corrected and brought to the 124/125 bar during the
Roma audit + fill (`audits/126D__Audit__Roma_UI.md`). Re-count the monolith
baselines first — `builder-domain.tsx` has already grown to 976 lines since the
draft was written.

Prior title: *Planning PRD - Roma UI Refactor*.
Prior status: EXECUTING · Owner: Roma + Dieter · 2026-06-23 · 02-Executing.
Numbering: deliberately unnumbered per product owner.

Related:

- `Execution_Pipeline_Docs/02-Executing/UI_PRD__Devstudio_as_a_trustworthy_Reveal_cockpit_DieterComponents.md`
  (owns Dieter token/showcase governance + the tokenization CI guard that already
  covers `roma/app` and `roma/components` incl. inline TSX styles — Step 5 there.
  This PRD **consumes** that guard; it does not reinvent it.)
- `dieter/components/*` (component truth: `diet-textfield`, `diet-toggle`,
  `diet-segmented`, `diet-popover`, `diet-button`, …)
- `dieter/tokens/*` (token truth — already adopted by Roma chrome; out of scope here)
- `documentation/architecture/CONTEXT.md`, `AGENTS.md` (product law: Roma owns
  account authority/routes/save; Dieter-reuse mandate; design-freeze mandate)
- `documentation/services/roma.md` (Roma surface truth)

## PRD Tenets

- Execute one step at a time. Do not start Step N+1 until Step N is green.
- Green requires named completion evidence. A blocker report stops execution; it
  does not unlock the next step.
- Do not solve missing decisions by inventing product behavior.
- If existing code contradicts this PRD, delete it, fence it, or stop; do not
  preserve it and work around it.
- **Design freeze applies:** this is convergence onto the EXISTING Dieter system
  and the EXISTING Roma layout — not a new visual language. No new styles without
  explicit product-owner approval. Ported screens match their current visual intent.
- **Tokens are already healthy; the gap is components.** Roma chrome is tokenized
  (`roma.css`: 0 hex literals / 140 `var()` uses per the DevStudio audit). This is
  NOT a token exercise. The work is: stop using the parallel `.roma-*` component
  set; use Dieter components + one shared React primitive layer.
- No new product features and no product-law changes. Roma keeps owning exactly
  what it owns. Backend/route changes remain out of scope except the mandatory
  source-save/localization boundary correction in the addendum below.

## Mandatory addendum: save is not translation

This PRD must correct the source-save/localization UX boundary during execution.
The current behavior where Roma source save can run translation or locale package
follow-up inside the same save request is not product-correct and must not
survive the Roma UI refactor.

The product law is:

```text
Save = persist widget source truth and the base runtime package.
Generate/regenerate translations = explicit localization operation.
Locale packages = derivative runtime artifacts from current source + current overlays.
```

Therefore, the Roma/Bob authoring save path must be restored to the save
authority only: save the source/base package, then return the source save result.
It must not generate translations, regenerate translations, materialize locale
packages, refresh locale public cache, or make the authoring save wait on any
locale follow-up. A translation, package, or locale-cache failure is a
localization failure, not a source-save failure.

The UI obligation for 126D is to surface this honestly instead of hiding it in
save. When a saved widget has translations that need update, Bob/Roma must show
a top-of-builder toast/banner that tells the user to open the Translations panel
and click "Generate translations". The banner is a product signal and navigation
aid. It must not auto-run translation generation, create a background queue,
invent readiness state, poll/probe runtime packages, or reinterpret save as a
localization command.

This is required because save and translation have different product intent,
authority, cost, and failure semantics:

- Source save is the user/agent persistence boundary for the widget being edited.
- Translation generation is AI-generated derivative content and requires explicit
  localization intent.
- Locale package materialization follows the localization operation that changed
  overlays; it is not part of authoring save.
- More active locales or slower model/cache work must not make Save slower,
  ambiguous, or falsely failed.
- Bob must tell the truth: saved source remains saved even when translations need
  attention.

Execution compliance for this addendum:

- Roma account instance save route returns source/base save success or failure
  only.
- Translation generation/regeneration remains owned by the translation route and
  the Translations panel action.
- The top banner/toast appears only as a stale-translation attention signal and
  points to the Translations panel.
- If the codebase lacks exact persisted/evaluable stale-translation evidence, the
  execution pass must stop and name the missing authority; it must not infer
  staleness from runtime package probes or invented UI state.
- `documentation/services/roma.md` and the relevant Bob/Roma detail docs must be
  updated in the same PR to reflect the restored boundary.

## Authority

| Concern                              | Authority                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------ |
| Visual design / layout               | Product owner; current Roma layout is the frozen baseline                      |
| Component truth                      | `dieter/components/*` (`diet-textfield`, `diet-toggle`, `diet-segmented`, …)   |
| Token truth                          | `dieter/tokens/*` (already adopted — out of scope)                             |
| Tokenization CI guard                | DevStudio Design Governance PRD §3.6 / Step 5 (consumed here, not reinvented)  |
| Roma product surfaces / routes / save| Roma (product law unchanged; save/localization boundary corrected by addendum) |
| What the "shared Roma primitive" set is | This PRD, Step 0 decision                                                     |

## 1. Why (product truth)

Roma is the account app the human and the AI workforce operate. Its UI currently
feels subpar / prototype-y. Root cause, verified against the repo: Roma is
unfinished scaffolding built function-first that stopped one layer short of its
own design system. Specifically:

- Roma loads Dieter components from CDN but uses almost none. Verified usages:
  `diet-textfield` 0, `diet-toggle` 0, `diet-segmented` 0, `diet-popover` 0,
  `diet-button` 0; only `diet-btn-txt` is used (158×), plus Dieter typography /
  token CSS.
- Roma built a parallel 72-class component system (`.roma-input`, `.roma-table`,
  `.roma-modal`, `.roma-card`, `.roma-field`, `.roma-grid`, `.roma-toolbar`) in
  one 762-line `roma/app/roma.css`.
- Roma has no shared React primitive layer, so every domain screen is a one-off
  that drifts (different table shapes, empty-state copy, toolbars, modals).
- Five monolith domain components can't be polished: `pages-domain.tsx` 1,106
  lines, `builder-domain.tsx` 869, `widget-defaults-domain.tsx` 719,
  `widgets-domain.tsx` 527, `assets-domain.tsx` 488.
- Several surfaces leak dev/stub copy and lack loading/empty/error states.

Bob (the editor) uses Dieter properly and sets the bar. Roma must converge to the
same bar so the product reads as one designed system, not "backend with a UI." The
human supervises the UI layer by looking at rendered truth — a Roma that drifts
from Dieter is a supervision blind spot, the same failure mode the DevStudio
Design Governance PRD names.

## 2. Verified current state (the baseline this PRD fixes)

- **Component adoption:** `diet-textfield` 0, `diet-toggle` 0, `diet-segmented`
  0, `diet-popover` 0, `diet-button` 0; `diet-btn-txt` 158.
- **Parallel system:** 72 `.roma-*` / `.rd-*` classes in `roma/app/roma.css`
  (762 lines).
- **Tokens:** HEALTHY — 0 hex literals / 140 `var()` uses. Not a token problem.
- **Monoliths:** pages 1,106; builder 869; widget-defaults 719; widgets 527;
  assets 488.
- **Inline ad-hoc styles:** 12 `style={{…}}` with hardcoded px, bypassing
  `--space-*` tokens.
- **Leaked stub / dev copy:** `pagePublishingUnavailable = true` + "Page
  publishing is unavailable until page package generation is enabled"
  (`pages-domain.tsx:316,786`); disabled IP-localization checkbox
  `checked={false} disabled readOnly` (`pages-domain.tsx:829`); "Billing
  provider integration is not connected" (`billing-domain.tsx:12`); "Broader
  usage reporting is not connected in Roma yet" (`usage-domain.tsx:56`);
  "Invitations are Berlin-owned… Berlin acceptance flow" (`team-domain.tsx:225`);
  raw error keys in user-facing strings.
- **Weak states:** `home`, `ai`, `billing` have no loading/empty/error handling.

## 2.1 Surviving authorities and deletion targets

| Area                 | Survives                                 | Delete / replace                                                                                                          |
| -------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Shell + layout       | `roma-shell`, `roma-nav`, `roma-layout`  | keep                                                                                                                      |
| Token usage          | `var(--*)` in `roma.css`                 | keep (healthy)                                                                                                            |
| Parallel components  | —                                        | `.roma-input` / `.roma-table` / `.roma-modal` / `.roma-card` / `.roma-field` → Dieter components + shared primitives; CSS deleted as replaced |
| Dieter components loaded but unused | —                          | adopt `diet-textfield` / `diet-toggle` / `diet-segmented` / `diet-popover` where the `.roma-*` equivalents are            |
| Domain monoliths     | behavior                                 | split into subcomponents (list / editor / placements / settings / forms)                                                  |
| Leaked dev / stub copy | —                                      | map to user copy; one honest "not available" treatment for genuinely-unbuilt features                                     |

## 3. The fix, per surface

### 3.1 Shared Roma primitive layer (the keystone)

One small set of React primitives under `roma/components/ui/`, built on Dieter:
`DataTable`, `PageHeader`, `EmptyState`, `FormField`, `Modal`, `Toast`. Domains
consume these instead of improvising. This is what makes screens converge.

### 3.2 Adopt Dieter components for real

Replace `.roma-input` → `diet-textfield`; `.roma-modal` → a `Modal` primitive on
Dieter; `.roma-field` → `FormField`; toggles → `diet-toggle`; segmented choices →
`diet-segmented`. Delete the replaced `.roma-*` CSS. No new visual language —
Dieter is the design.

### 3.3 Break the monoliths

Split each >~400-line domain into subcomponents (list view / editor / placements /
settings / forms). Behavior unchanged; structure refinable.

### 3.4 Fix leaked copy + states

Map raw reason keys to user copy; one honest "not available" treatment for
genuinely-unbuilt features (no scattered hardcoded feature-off booleans); add
loading/empty/error to every domain.

### 3.5 Tokenize the last mile (coordinate with DevStudio)

DevStudio owns the tokenization guard **and** cleaning the ~12 inline-px sites. Roma's
role here is **verification** (Step 6): confirm 0 remain after DevStudio's pass; clean
only residual Roma-only sites DevStudio didn't reach. Do not re-edit the same lines.

## Coordination + execution rules (cross-PRD)

- **Ownership split.** This PRD makes Roma *consume* Dieter. The sibling
  `UI_PRD__Devstudio_as_a_trustworthy_Reveal_cockpit_DieterComponents.md` owns Dieter
  itself (derived pages, `textrename` cleanup, ghost token, tokenization guard, token
  editor) — don't duplicate that work here.
- **Inline-px is owned by DevStudio.** DevStudio owns the tokenization guard *and*
  cleaning the ~20 inline-px sites in Roma/Bob. Roma's Step 6 is **verification only**
  if DevStudio already cleaned them — do not re-edit the same lines.
- **Sequence.** Roma starts after DevStudio's guard + Dieter cleanup are live (Roma
  consumes Dieter; the guard is what keeps Roma honest).
- **Start from clean git.** Commit any in-flight doc/taxonomy cleanup before code
  work — don't mix doc churn into code commits.
- **Honest stubs, not invented behavior.** When Roma hits a stub surface
  (billing/usage/pages "not available"), clean the UI state honestly; do not build
  the feature behind it.
- **Re-audit Step 0.** The §2 counts are a baseline; recount on the real code first.
- **Proof is visual.** UI changes need before/after browser screenshots — lint/typecheck
  green is not sufficient.
- **Docs are part of done.** `roma.md` must match the executed behavior.
- **No new framework.** The shared primitive layer is a small set on Dieter, not a
  component framework. This is cleanup/convergence.
- **Save/localization boundary is mandatory.** The addendum above is an execution
  requirement for this PRD even though the old draft said no route changes and
  listed Bob out of scope. That old scope language cannot be used to preserve the
  current save-time translation cascade.

## 4. Steps

| Step | Action                                                                                                                                                       | Completion evidence                                                                                                                       | NOT_ALLOWED                                                                                          |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 0    | **Preflight / baseline:** record exact counts (component usages, `.roma-*` class list, monolith line counts, leaked-copy inventory, missing-states inventory); pick the reference domain (propose `widgets`); confirm a Dieter component exists for every `.roma-*` being replaced; lock the shared-primitive list. | This PRD updated with the baseline table + reference-domain + primitive-list decision.                                                    | Starting porting from stale counts; inventing primitives with no Dieter backing.                     |
| 1    | **Shared primitive layer:** `DataTable`, `PageHeader`, `EmptyState`, `FormField`, `Modal`, `Toast` built on Dieter under `roma/components/ui/`.             | Primitives exist, typed, used by at least one fixture; no new visual language.                                                            | A framework; primitives that bypass Dieter; styling that isn't tokens.                               |
| 2    | **Reference domain (`widgets`) ported** onto primitives + Dieter components; `.roma-*` classes used there deleted.                                           | `widgets-domain.tsx` uses the primitive layer + Dieter components; replaced `.roma-*` CSS gone; visual parity vs current.                 | Redesigning widgets; leaving replaced classes "as backup".                                           |
| 3    | **Port remaining domains** (`pages`, `assets`, `team`, `profile`, `settings`, `usage`, `billing`, `ai`, `home`) onto the same primitives + Dieter components. | Each domain built from the primitive layer; tables/empty-states/modals no longer one-offs; parallel `.roma-*` CSS retired.                | Per-domain forks of the primitives; new visual language on any screen.                               |
| 4    | **Break the 5 monoliths** into subcomponents.                                                                                                                | Each former monolith under a named subcomponent structure (<~400 lines each, or justified); behavior unchanged.                           | Behavior changes; logic moved across ownership boundaries.                                           |
| 5    | **Copy + states pass:** reason-key → user copy map; one honest unavailable treatment; loading/empty/error on every domain.                                   | No raw reason keys or dev/internal copy in the UI; every domain has the three states.                                                     | Hiding unbuilt features silently; inventing product behavior to fill gaps.                           |
| 6    | **Verify inline-px tokenization** (DevStudio owns the cleanup + guard): if DevStudio already cleaned the sites, Roma *verifies* 0 remain and cleans only residual Roma-only sites DevStudio didn't reach; do not re-edit sites DevStudio fixed.                                            | 0 inline `style={{px}}` bypassing tokens in Roma components; guard green.                                                                 | Reinventing the guard; scoping it down to pass dirty code.                                           |
| 7    | **Docs sync:** `roma.md` gains "Roma uses Dieter + the shared primitive layer; no parallel component system."                                                | Docs diff in the same PR as the final code step.                                                                                          | Deferring docs; leaving `roma.md` describing the parallel system as current.                         |

## 5. Out of scope

- A new visual language / redesign (design freeze; Dieter is the design).
- Token authoring / governance (DevStudio Design Governance PRD owns).
- Roma product-law changes, new features, backend / route changes beyond the
  mandatory source-save/localization boundary correction in this PRD.
- Bob, Prague, DevStudio, widget-software surfaces, except the top-of-builder
  stale-translation attention banner required by the addendum.
- The tokenization CI guard itself (DevStudio PRD Step 5 owns; this PRD consumes it).

## 6. Acceptance criteria

- Zero parallel component system: no hand-rolled `.roma-input` / `.roma-table` /
  `.roma-modal` / `.roma-card` / `.roma-field` components; Dieter components +
  shared primitives used instead (`roma.css` shrinks materially).
- Dieter components actually used: `diet-textfield` / `toggle` / `segmented` /
  `popover` present where forms / choices / overlays are.
- Every domain screen built from the shared primitive layer; no one-off tables /
  empty-states / modals.
- The 5 monoliths each under a named subcomponent structure.
- No raw reason keys or dev/internal copy in the UI; one honest unavailable
  treatment; every domain has loading / empty / error states.
- Visual parity with current Roma (no redesign); DevStudio tokenization guard
  green on Roma incl. inline TSX.
- Roma product law remains unchanged. Save behavior is corrected to the product
  law above: source/base save does not run translation generation/regeneration or
  locale package follow-up, and stale translations are surfaced as an explicit
  Translations-panel action.

## 7. Planning review (per pipeline README)

1. **Elegant, scales?** Yes — one primitive layer + Dieter adoption abolishes the
   parallel system; every future domain gets consistency for free. O(1) per addition.
2. **Compliant with architecture / tenets?** Yes — kills a duplicate-truth
   violation (a parallel component system); reuses Dieter (the ratified design
   system); stays inside Roma's boundary (no product-data or product-law changes).
3. **Avoids over-architecture?** Yes — a small primitive set, not a framework; no
   new visual language; consumes the existing DevStudio guard instead of building one.
4. **Moves toward intended architecture?** Directly — Roma converges to the one
   design system the rest of the product already runs on, closing a supervision
   blind spot for the one human who steers the UI.
