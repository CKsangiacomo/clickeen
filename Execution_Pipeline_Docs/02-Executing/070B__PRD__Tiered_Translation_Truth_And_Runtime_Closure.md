# PRD 070B — Tiered Translation Truth and Runtime Closure

Status: READY TO EXECUTE AFTER PRD 070A BOUNDARY CLOSURE
Date: 2026-03-15
Owner: Product Dev Team
Priority: P0 (product truth + commercial truth)

Execution dependency:
- PRD 070B required PRD 070A to close the product boundary first.
- Translation truth needs one product owner, one backend boundary, one save path, and one consumer contract.
- The current split-brain architecture keeps reintroducing drift, so PRD 070B is sequenced after PRD 070A on purpose.

Environment contract:
- Read truth: `local` repo/runtime code + `cloud-dev` real product runtime
- Write order: `local` first, then `cloud-dev`
- Canonical local startup: `bash scripts/dev-up.sh`
- Integration truth for the real customer/product lane: `cloud-dev`

Current real-lane constraint:
- There is currently exactly one real cloud-dev proof lane:
  - one account: seeded `admin`
  - one effective tier: `tier3`
  - one testable widget: `FAQ`
- Therefore `cloud-dev` can prove only the `tier3 FAQ` lane today.
- Lower-tier behavior must be verified in `local` through policy/contract checks until real cloud-dev lower-tier accounts exist.

---

## One-line objective

Make translations a single honest system across all tiers:
- one tier contract
- one deterministic desired locale set
- one instance lifecycle model
- one readiness model
- no confusion between what is `allowed` and what is actually `ready` in Tokyo

Operational framing:
- PRD 070 executes locale as the first real overlay proof in the product
- the forward architecture is not "a translation system"
- the forward architecture is "Roma owns overlay intent, generators produce overlays when Roma says so, Tokyo owns overlay-ready truth"

---

## Core truth model

PRD 070 is not a "make the current twists work" project.

It exists because the current system still takes too many turns to answer simple questions like:
- what locales does this instance want?
- what locales are actually ready right now?
- what locales should Bob or Venice show?

If the system needs multiple reinterpretation steps, overlay inference, or product/commercial guesswork to answer those questions, the architecture is wrong.

PRD 070 must therefore be executed as a truth-refactor, not as a patch/tweak pass.

### Three questions, three owners

There are only three product-truth questions in this PRD:

1. What locales does this instance want?
   - Owner: Roma product settings + persisted account locale state
   - Contract:
     - Roma materializes the deterministic desired locale set once.
     - That saved Roma locale list is the only desired-locale source.
     - No downstream system may choose, infer, expand, or reinterpret it.

2. What locales are actually ready for the current fingerprint?
   - Owner: Tokyo/Tokyo-worker artifact truth
   - Contract:
     - `ready` means Tokyo has the exact current-fingerprint artifact.
     - Overlay presence, queued jobs, prior-fingerprint artifacts, and account settings do not count as `ready`.
     - No upstream or downstream surface may manufacture a second readiness definition.

3. What locales should consumers and editors show?
   - Owner:
     - account/editor host surfaces consume Roma desired truth + Tokyo ready truth
     - public consumer surfaces consume Tokyo/Venice ready truth only
   - Contract:
     - Bob and Venice are consumers of truth, not locale-policy interpreters.
     - Builder/editor and public/runtime surfaces read the same Tokyo current locale artifact pointers.
     - Builder differs only in interaction gating, not by requiring a separate pointer surface.
     - Account-mode Bob may show `desired` and `ready`.
     - MiniBob/public Bob may show `ready` only.
     - Action gating comes from policy; locale visibility comes from truth.

### Consequence

The intended architecture is simple and boring:
- Roma owns one desired locale set
- San Francisco translates only the locales Roma tells it to
- Tokyo owns one ready-locale truth for the current fingerprint
- Bob and Venice display that truth

Everything in PRD 070 must make the system closer to that model.
Anything that preserves or adds extra turns is architectural drift, even if it "fixes" a local symptom.

### Locale is the first overlay proof

PRD 070 must be read as locale executed through the general overlay architecture.

The target overlay architecture is:
1. Roma decides what overlays are available to the user and records what overlays the user wants.
2. Generator services produce overlays only because Roma told them to.
3. Tokyo stores those overlays/artifacts and is the canonical owner of whether they are actually ready.
4. Consumers/editors read that actual ready truth; they do not infer it.

For locale, that means:
- Roma decides and persists the desired locale overlay set.
- San Francisco generates locale overlays only for the locales Roma requests.
- Tokyo/Tokyo-worker own whether the locale overlay/artifact exists for the current fingerprint.
- Bob/Venice consume that ready truth.

This is intentionally the same architecture Clickeen should later use for:
- multilingual email overlays
- A/B email overlays
- instance copy experiments
- personalization overlays
- any future Babel overlay dimension

Therefore PRD 070 must not introduce locale-only ownership rules that would fail for other overlay types.

---

## Top-level tenets

These tenets are the architectural memory for PRD 070.

1. Binary readiness only
   - There is one current base content fingerprint.
   - A locale is `Ready` only if Tokyo has the artifact for that exact fingerprint.
   - Everything else is not-ready/internal/commercial state.

2. One deterministic desired locale set
   - Entitlements decide which locale options Roma may show.
   - The user checks/unchecks locales in Roma and saves.
   - That saved Roma locale list is the one canonical desired locale set.
   - No downstream system gets to reinterpret it.

3. Pipeline reconciles, nothing more
   - On save, for each locale in the desired set:
     - if Tokyo already has the exact current-fingerprint artifact -> skip
     - if Tokyo does not have it -> generate and write it
   - That is the pipeline job. No second policy brain.

4. No fallbacks
   - Missing locale artifacts are system failures.
   - Venice/runtime must not hide them with base-language fallback.
   - Fallbacks weaken discipline and reward broken write paths.

5. Translation generation and embed consumption are separate systems
   - Translation system concern: generate and store the right artifacts in Tokyo.
   - Embed/runtime concern: choose among artifacts that already exist in Tokyo.
   - Consumer behavior must not redefine translation truth.

5A. Locale follows the general overlay architecture
   - Roma owns overlay availability, overlay selection, and generation intent.
   - Generator services execute only from Roma-owned intent.
   - Tokyo/Tokyo-worker own stored-overlay/artifact truth and ready truth.
   - Consumers/editors read actual overlay truth; they do not invent it.
   - Locale is the first implemented overlay proof of this model, not a special architecture.

6. Consumer locale policy must be built from `ready`, not `allowed`
   - plan allowance is commercial truth.
   - `allowed` is the saved Roma locale set within that allowance.
   - `ready` is Tokyo artifact truth.
   - Embed/IP/switcher logic may operate only on the ready set.

7. Missing locales must not poison ready locales
   - One non-ready locale must not block locales that are already ready.
   - Higher-tier customers must not become less reliable because they are allowed more locales.

8. Tokyo/Tokyo-worker are delivery systems, not product-policy systems
   - Their job is to guarantee display truth and cheap serving.
   - They own artifact integrity, pointer correctness, and cache economics.
   - They do not own entitlement interpretation, locale intent, workflow semantics, or UX policy.

9. Babel must inherit the same rules
   - Generalize seams now.
   - Implement locale only now.
   - Every future overlay dimension must still follow:
     - one desired state
     - one actual artifact truth
     - one reconciliation loop

10. Consumer readiness must converge by write-path trigger, not by request-time cleverness
   - `readyLocales` is a point-in-time consumer projection of Tokyo truth.
   - Save-triggered overlay convergence must be durably enqueued and retried by the system; it must not depend on best-effort request callbacks.
   - When a locale becomes ready for a published instance/current fingerprint, the system must trigger consumer-pointer reconciliation.
   - Venice must not query or reconstruct readiness dynamically at request time.
   - The embed must not wait for a future manual save to pick up already-ready locales.

11. Session-minted entitlement truth only
   - The account bootstrap authz capsule is the product-path entitlement/policy truth for the session.
   - Roma terminates the browser session and passes that truth downstream on product routes.
   - Downstream product-path services may verify that capsule, but they must not recompute or reinterpret entitlements on save, localization, l10n status, layer edits, or published-surface convergence.
   - If entitlement truth changes, the system must mint a new session/capsule instead of re-resolving policy mid-session.

---

## Terminology lock

In PRD 070:
- `plan allowance` means what the tier/entitlements permit in principle
- `allowed` means the saved Roma locale set that is permitted by entitlements and selected by the user
- `ready` means Tokyo has the artifact for the exact current base fingerprint
- `consumer pointer` means the ready-only locale policy used by embed/runtime consumers
- `overlay` means any generated/stored variant layer whose desired state is Roma-owned and whose actual ready state is Tokyo-owned

If wording elsewhere drifts, this section plus the top-level tenets win.

---

## Binary readiness truth

There is exactly one current base content revision for a widget.

For each allowed locale, the only customer-facing question is:

`Does Tokyo have the translation artifact for this exact current base fingerprint?`

If yes:
- the locale is `Ready`

If no:
- the locale is `Not ready`

This is intentionally binary.

The following do not count as `Ready`:
- the locale is allowed on the account
- the locale appears in Roma or Bob
- a job is queued or running
- a translation exists for an old base fingerprint
- a translation was generated but has not reached Tokyo for the current base fingerprint

This PRD treats all of those as internal or commercial facts, not product readiness.

---

## Deterministic locale-set rule

There is one deterministic chain from plan policy to Tokyo artifacts:

1. Entitlements decide which locale options Roma may show.
2. The user checks/unchecks locales in Roma settings and saves.
3. That saved Roma locale list becomes the canonical desired locale set.
4. The translation pipeline reconciles Tokyo against that desired locale set for the current base fingerprint.

For each locale in that desired locale set:
- if Tokyo already has the exact current-fingerprint artifact -> skip
- if Tokyo does not have it -> generate it and write it

That is the whole rule.
The pipeline does not reinterpret policy after that point, and runtime does not reinterpret it either.

---

## No-fallback rule

Clickeen owns the full stack, so a missing locale artifact is a write-path bug, not a serve-time condition to hide.

Forbidden:
- serve-time English fallback when a requested locale is not ready
- any runtime substitution that makes the product appear multilingual when Tokyo does not have the current-fingerprint artifact

Rule:
- fix the write path
- do not paper over missing Tokyo artifacts at read time

---

## Priority rationale

PRD 070 is P0 because translation is the first executable proof of the Babel overlay model.

For the current product reality, this PRD closes three things only:
- trigger
- context
- truth

If any one of those three stays broken, the product cannot honestly claim multilingual capability.

---

## Execution-start confirmed failures

These are not speculative. They were confirmed in repo/runtime truth at execution start.
The original Paris-era trigger failures that motivated PRD 070A have already been removed and are not the current failure set.

### A. Current confirmed product/runtime failures

1. Account-mode `ready` truth is still derived from overlay presence instead of explicit Tokyo artifact truth.
   - `roma/lib/account-l10n.ts`
   - Current account snapshot computes `readyLocales` from overlay rows for the current base fingerprint rather than from the consumer artifact/pointer plane in Tokyo.
   - Result: Bob/Roma account surfaces can still treat authoring-state presence as readiness even though customer truth is supposed to mean "Tokyo has the current artifact."

2. MiniBob still boots through Bob URL discovery instead of the same host-owned editor envelope used by Roma and DevStudio.
   - `prague/src/blocks/minibob/minibob.astro`
   - `bob/lib/session/useSessionBoot.ts`
   - Result: Bob still owns one public boot path where it discovers instance/runtime truth itself instead of simply editing from host-provided truth.

3. MiniBob locale visibility is still incorrectly entangled with MiniBob action gating.
   - `bob/components/LocalizationControls.tsx`
   - Current `minibobTranslationsLocked` behavior collapses visible locales back to the base locale after personalization use.
   - Result: the product cannot express the intended contract of "view all ready locales, limited actions."

4. The public MiniBob boot/runtime contract is still under-specified for Bob.
   - `venice/app/api/instance/[publicId]/route.ts`
   - Current public instance payload exposes config plus consumer locale policy, but not a canonical Bob-ready localization snapshot contract for host boot.
   - Result: MiniBob host boot has to invent a bridge unless PRD 070 defines the public truth shape explicitly.

5. Runtime truth is still split across three concepts with no single explicit surface:
   - saved Roma desired locale set
   - Tokyo artifact/pointer truth
   - consumer ready-only locale policy
   - Result: the architecture is much closer to correct than the old Paris history, but the remaining truth seams are still the real product problem.

6. Bob translation truth and commercial upsell are still mixed in one surface.
   - `bob/components/LocalizationControls.tsx`
   - The translation panel still contains MiniBob upsell behavior and copy.
   - Result: product truth and commercial gating remain coupled in a surface that should primarily communicate translation state.

7. Phase-2 prompt-policy closure is only partially a live problem now.
   - `sanfrancisco/src/agents/l10nTranslationCore.ts`
   - Current code already carries `widgetType`, `string` vs `richtext`, and Unicode-aware literal detection.
   - Result: PRD 070 Phase 2 should be treated as verification/tightening of the current lane, not as invention of a new prompt-policy subsystem.

### B. Current architecture risks and scope boundaries

8. The touched generation seam must remain generic without turning into a framework project.
   - `roma/lib/account-save-aftermath.ts`
   - The live implementation still writes `layer: 'locale'` directly at the persistence boundary.
   - Result: PRD 070 should preserve a layer-capable seam where touched, but must not respond by building a generalized orchestration subsystem.

9. Venice runtime code is still locale-specific, and PRD 070 must not widen that into a generic runtime-composition project.
   - `venice/app/e/[publicId]/route.ts`
   - Current runtime fetches one locale pointer and one locale pack directly.
   - Result: PRD 070 must keep runtime work limited to the ready-only consumer contract and avoid premature multi-layer composition work.

10. The consumer-pointer slice is narrower than the old history.
    - `tokyo-worker/src/domains/render.ts`
    - Current live-surface sync already validates only `readyLocales` before moving the live pointer.
    - Result: PRD 070 should focus on making the ready set honest and convergent, not on rewriting the Tokyo live-pointer model from scratch.

---

## Execution diagnosis

The execution problem is simpler than the history:
- account-mode `ready` truth is still weaker than Tokyo artifact truth
- MiniBob boot and locale visibility are not yet aligned with the host-backed editor model
- UI truth still mixes translation truth and commercial gating in some surfaces
- the remaining work is mostly truth closure, not new architecture

The practical diagnosis is:
- the system still takes too many turns to answer simple locale questions
- therefore the remaining work must remove turns, not patch around them
- the right fixes are owner/truth refactors, not compatibility shims

PRD 070 must be read as:
- collapse to one desired-locale source
- collapse to one ready-locale source
- make Bob/Venice consume those truths without reinterpretation

It must not be read as:
- keep the current inference chain but make it pass more cases
- add more labels, guards, or fallback derivations so the current twists become less painful

### Current branch closure notes

As of the current executing branch/worktree:
- account-mode `readyLocales` now read from explicit Tokyo current-fingerprint artifact truth
- MiniBob is host-booted and may view all ready locales while remaining action-limited by policy
- the Bob translation panel no longer carries MiniBob upsell copy inside translation truth
- host/public localization payloads are system-owned truth; Bob must fail on malformed MiniBob/account localization snapshots instead of normalizing them
- Roma now passes minted `policyProfile` into the account-l10n generation request
- San Francisco now derives `l10n.instance.v1` profile/provider policy from `@clickeen/ck-policy` plus env-configured providers
- Roma l10n status now uses a lighter shared base-context path instead of piggybacking on the full overlay snapshot load

---

## Pre-execution readiness

There are no architectural blockers left from PRD 070A.

The current live boundary is sufficient for execution:
- Roma owns the product save/locale aftermath path
- San Francisco owns translation generation
- Tokyo/Tokyo-worker own artifact and live-pointer truth
- Venice owns public consumer/runtime reads
- Bob remains the editor consumer of that truth

Former concerns that are already closed and are not PRD 070 blockers:
- Berlin bootstrap no longer repairs account state on the hot path
- the signed account capsule no longer carries locale-settings truth
- bootstrap no longer fans out live budget usage for capsule minting

### Required pre-execution decisions

1. Convergence trigger owner is already the Roma write path for the active proof lane.
   - The current real lane is:
     - Roma save/locales aftermath
     - synchronous call to San Francisco account l10n generation
     - Tokyo overlay/config writes
     - Tokyo live-pointer sync
   - PRD 070 must preserve and tighten this lane first.
   - Do not invent a new queue/callback orchestration model just to close consumer-pointer convergence for the proof lane.

2. Free-tier system locale must be materialized by the Roma locale-settings command before persistence.
   - Roma is the product control plane and must decide the one system-chosen additional locale.
   - Berlin persists the resulting saved locale list exactly as decided.
   - Downstream systems consume that saved locale list only; they do not independently choose the free-tier locale.
   - Current deterministic rule for this repo/runtime:
     - if `baseLocale !== 'en'`, materialize `en`
     - else materialize `es`

3. Status-path optimization is not a precondition for PRD 070 closure.
   - The current account l10n status path is heavier than ideal.
   - That is a valid follow-up if the touched fix is tiny.
   - It must not delay the truth-closure slices unless it is directly required by one of them.

---

## Non-negotiable decisions

These decisions operationalize the top-level tenets.
If duplicated wording appears elsewhere in this PRD, the top-level tenets and these decisions are the canonical version.

### 1. One translation state machine for all instance kinds

Curated and user instances must use the same translation lifecycle.

Allowed difference:
- ownership/authz rules

Forbidden differences:
- save triggers
- locale seeding behavior
- status semantics
- readiness semantics
- Tokyo-readiness rules

### 2. Tier changes limits and quality, not lifecycle semantics

Tier may change:
- max locales
- max custom locales
- AI profile/provider quality

Tier must not change:
- what `allowed` means
- what `ready` means
- whether a curated instance can translate
- whether UI truth is honest

### 3. "Ready in X languages" has one meaning

There is one current base content revision for the widget.

For each allowed locale, customer truth is binary:
- `Ready`
  - Tokyo has the locale translation artifact for that exact current base fingerprint
- `Not ready`
  - Tokyo does not have the locale translation artifact for that exact current base fingerprint

Nothing else counts.

Not enough:
- locale allowed on account
- locale listed in picker
- locale job queued
- locale overlay row exists
- locale translation exists only for an old base fingerprint
- locale translation was generated somewhere but is not in Tokyo for the current base fingerprint

Required:
- locale corresponds to the current base fingerprint
- locale artifact exists in Tokyo

This is the only customer-facing readiness rule in this PRD.
Everything else is internal pipeline state.

### 4. Base locale is the implied locale, not English

Forward contract:
- the implied locale is the account `baseLocale`
- tier caps count total locales including the base locale
- runtime and UI must not keep pretending English is universally implied if base locale differs

This PRD intentionally converges the commercial/runtime language model around `baseLocale`, not around a hardcoded English special case.

### 5. Translation policy must exist, but PRD 070 scope stays minimal

Translation quality is not "whatever the model happens to do."

But PRD 070 is not allowed to turn into a broad AI quality platform build.

PRD 070 scope is limited to:
- widget-type-aware prompt context
- text-type-aware prompt context (`string` vs `richtext`)
- Prague-string prompt parity as a minimum quality bar
- removal of Latin-script assumptions in current heuristics

Deferred beyond PRD 070:
- glossary platform work
- back-translation scoring
- broad semantic quality scoring
- multi-family prompt packs beyond the minimum needed to remove current bad assumptions
- dedicated telemetry expansions beyond what already exists

### 6. No Latin-script assumptions

Translation planning, heuristics, and QA must work when base content is authored in:
- CJK scripts
- RTL scripts
- accented Latin scripts
- mixed-script product strings

Heuristics like "no `[a-zA-Z]` means non-translatable" are forbidden in the forward model.

### 7. Customer-facing language must separate `allowed` from `ready`

Every surface that talks about translations must expose:
- `Allowed locales`
- `Ready locales`

For PRD 070 shorthand:
- `Allowed locales` in product/API surfaces means the canonical saved locale set that is permitted by entitlements and selected in Roma
- it does not mean the full theoretical locale catalog that the plan could permit in principle

Forbidden labels:
- `Configured` when ready count is zero
- any marketing or product copy that uses account settings count as proof of delivery

Internal/debug surfaces may additionally expose:
- queued
- running
- failed
- superseded

But those are pipeline states, not customer capability claims.

### 8. No hidden fallback claim inflation

If a locale is missing for the current revision:
- do not count it as available
- do not market it as available
- do not hide the gap behind a soft UI label

This does not change the public runtime no-fallback contract.
It makes the product and marketing tell the truth about that contract.

### 9. No serve-time fallbacks

Missing locale artifacts are product failures, not graceful-degradation opportunities.

Forbidden:
- base-language fallback in Venice for missing locale artifacts
- any runtime fallback that lets Bob/Roma/marketing claim readiness that Tokyo does not have
- architectural decisions that reduce pressure to make the pipeline reach `Ready`

Required:
- missing locale artifacts remain visible as `Not ready`
- failures are surfaced through status/UI truth, not hidden by read-time substitution

### 10. Generalize the seams now, implement locale only now

PRD 070 must not hardcode more locale-only architecture into the system.

In scope now:
- generalize the touched scheduler seam so it can carry `layer` and `layerKey` semantics cleanly
- preserve the existing generic state/storage key shape: `(publicId, layer, layerKey, baseFingerprint)`

Still true for PRD 070:
- locale is the only implemented generation strategy
- locale is the only required customer-facing proof lane

Out of scope for PRD 070:
- geo generation
- industry generation
- account/ABM generation
- behavior generation
- experiment generation
- Venice multi-layer composition
- cross-layer quality validation

Rule:
- generalize the interface/seam once
- implement only locale behavior in this PRD
- do not build Babel Phase 2 here
- do not turn `enqueueL10nJobs()` into a broad Babel abstraction exercise

Additional architectural rule:
- locale must be implemented as an overlay type using the same owner model we want for all overlays
- do not create locale-specific ownership that Roma, Tokyo, or future generators would have to undo later

### 11. Translation generation and locale consumption are separate systems

Translation generation is a supply-side system.

Its job is only:
- take the current base content
- determine which locale artifacts are needed
- write the correct current-fingerprint locale artifacts to Tokyo

It is not concerned with:
- embed UI
- switcher UX
- IP-based locale selection
- how a consumer later chooses among ready locales

Locale consumption is a separate consumer/runtime system.

Its job is:
- select among locale artifacts that already exist in Tokyo
- optionally default by IP
- optionally expose a manual locale switcher

PRD 070 must keep this boundary explicit:
- translation-system truth ends at `artifact exists in Tokyo for the current base fingerprint`
- consumer truth begins at `which ready artifact do we expose/use`

Overlay generalization of that same rule:
- Roma owns "should this overlay exist?"
- the generator owns "produce it now"
- Tokyo owns "it exists and is ready"
- the consumer owns "select among ready overlays"

### 12. Tokyo/Tokyo-worker are delivery systems, not product-policy systems

Tokyo/Tokyo-worker must stay boring.

Their concern is only:
1. guarantee display truth
   - if the system says a widget/locale/version should be shown, Tokyo must have the exact bytes for it
   - pointers must resolve to the exact artifact intended for display
2. guarantee cheap serving
   - artifacts must be written in an R2/CDN-friendly shape
   - immutable/cacheable paths and pointers must keep serving costs low

Tokyo/Tokyo-worker must not become responsible for:
- plan semantics
- entitlement interpretation
- deciding what locales the customer meant
- translation workflow semantics
- UI/product wording
- fallback behavior

Therefore:
- Roma settings + entitlements decide what should exist
- the translation pipeline reconciles Tokyo to that desired state
- Tokyo/Tokyo-worker guarantee artifact integrity, pointer correctness, and cache economics

### 13. Consumer/embed locale policy must be built from `ready`, not `allowed`

Commercial truth and consumer truth are different.

- `plan allowance` = what the account/tier paid for in principle
- `allowed` = the saved Roma locale set within that plan allowance
- `ready` = what Tokyo actually has for the current base fingerprint

Consumer/embed policy must use only the ready set.

Forbidden:
- using plan-allowed locales or the wider entitlement set as the embed consumer locale set
- using the saved allowed locale set as if it were already ready
- blocking already-ready locales because another allowed locale is still missing
- making higher-tier customers less reliable because they are allowed more locales

Required:
- the consumer locale set must contain only locales that are ready in Tokyo
- non-ready allowed locales stay visible in Bob/Roma as `Not ready`
- non-ready allowed locales must not poison already-ready consumer locales

### 13A. MiniBob may view ready locales but must not gain locale governance

MiniBob is a public consumer/editor trial, not an account locale-control plane.

Rule:
- MiniBob may display every locale already present in the instance consumer pointer
- this visibility comes from consumer `ready` truth, not from MiniBob account/governance entitlements
- MiniBob does not gain the ability to:
  - add/remove locales
  - save locale settings
  - trigger translation generation
  - publish
  - perform account-governed locale writes

In short:
- MiniBob action limits remain policy-driven
- MiniBob locale visibility remains consumer-truth-driven
- do not collapse visible locales to the base locale merely because MiniBob cannot govern them

### 14. Consumer pointer contract

Pre-GA rule: do not preserve a misleading field shape for compatibility.

PRD 070 requires a clean consumer locale-policy contract:
- `baseLocale`
- `readyLocales`
  - ordered locales that are ready in Tokyo for the current base fingerprint
- `ip.enabled`
- `ip.countryToLocale`
  - mapping may resolve only to locales in `readyLocales`
- `switcher.enabled`
- `switcher.locales` (optional)
  - ordered subset of `readyLocales` chosen by the user for the embed dropdown

Rules:
- `readyLocales` must always include `baseLocale`
- `switcher.locales`, when present, must be a subset of `readyLocales`
- if `switcher.locales` is absent, the switcher may default to `readyLocales`
- query-param/manual locale selection is honored only for locales in `readyLocales`
- IP-based locale selection is honored only for locales in `readyLocales`

This consumer pointer contract is separate from account locale settings.
It must not be used to express entitlement or plan state.

### 15. Missing locales must not block already-ready locales

For consumer/runtime publication:
- a locale that is not ready must stay out of the consumer pointer
- a locale that is ready must remain usable even if other allowed locales are still not ready

This is the critical business rule:
- upgrading to more languages must not make the widget less reliable

Therefore:
- premium customers must not get a larger all-or-nothing runtime blast radius just because they are allowed more locales
- Tokyo integrity checks must validate the consumer ready set, not the commercial allowed set

### 16. Consumer-pointer convergence must be bounded

The consumer pointer is a point-in-time projection, not a request-time query.

That means PRD 070 must explicitly prevent indefinite lag between:
- Bob/Roma showing a locale as `Ready`
- embed/runtime exposing that locale in the consumer pointer

Required:
- when locale generation succeeds for a published instance and the current base fingerprint, the system must trigger consumer-pointer reconciliation
- this reconciliation must reuse existing write-path/convergence machinery where possible

Forbidden:
- requiring a future manual save before a newly-ready locale appears in the consumer pointer
- moving readiness resolution into Venice request time
- solving pointer lag with request-time fallback or request-time policy reconstruction

---

## Tier contract (forward)

Source of truth for exact caps and profile mapping remains `ck-policy`.
This section records only the tier behavior PRD 070 execution depends on.

### Minibob

- Account-governance additional locales: 0
- User-selectable additional locales: 0
- Async translation pipeline: disabled as a MiniBob-triggered action
- AI profile: `free_low`
- Public consumer visibility: MiniBob may view every locale already present in the instance consumer pointer; this is not a MiniBob governance entitlement increase

### Free

- Total locales max: 2
- User-selectable additional locales: 0
- Additional locale source: system-chosen only, but that choice must be materialized once into the saved Roma locale list; downstream systems must not choose it independently
- Current deterministic rule:
  - if `baseLocale !== 'en'`, materialize `en`
  - else materialize `es`
- Async translation pipeline: enabled only for the single additional system locale
- AI profile: `free_low`

### Tier1

- Total locales max: 4
- User-selectable additional locales max: 3
- Async translation pipeline: enabled
- AI profile: `paid_standard`

### Tier2

- Total locales max: unlimited
- User-selectable additional locales max: unlimited
- Async translation pipeline: enabled
- AI profile: `paid_premium`

### Tier3

- Total locales max: unlimited
- User-selectable additional locales max: unlimited
- Async translation pipeline: enabled
- AI profile: `paid_premium`

### Internal / curated premium

- Internal execution profile only.
- Not a customer tier and must not become the only working translation lane.

---

## Canonical status model

PRD 070 uses one simple status model.

Customer truth:
- `Ready`
- `Not ready`

Internal execution states:
- `queued`
- `running`
- `failed`
- `superseded`

Internal bookkeeping may additionally use:
- `dirty`
- `succeeded`

Rules:
- `Ready` means Tokyo has the artifact for the current base fingerprint
- `Not ready` means Tokyo does not have it yet
- customer/product surfaces must derive truth from `allowedCount` and `readyCount`
- internal execution states must not be reused as product labels

---

## Translation policy contract

This section uses `transport plane` and `policy plane` as execution shorthand only.
PRD 070 does not introduce new subsystems here.

### A. Transport plane

The transport plane is responsible for:
- allowlist extraction
- planning snapshots
- fingerprint diffing
- job scheduling
- retries
- overlay persistence
- Tokyo pack publication
- consumer-pointer reconciliation trigger
- structural output safety

This plane is necessary and remains in scope.

### B. Policy plane

The policy plane is responsible for:
- what translation instructions are sent
- what context is provided
- how terminology is constrained
- how locale-specific behavior is handled
- what quality signals are measured after generation

This plane is underbuilt today.

For PRD 070, only the minimum missing parts are in scope.

### C. Instance prompt specialization

Instance l10n must stop using a single generic prompt across all widget content.

PRD 070 minimum requirement:
- prompt builder accepts at minimum:
  - `widgetType`
  - locale
  - text type (`string` vs `richtext`)
  - optionally path-derived role hints only where they already exist cheaply in current contracts

For the current FAQ proof lane, the minimum meaningful distinction is:
- short string content
- long richtext content

Hard rule:
- PRD 070 must not require a new metadata system just to classify prompt roles.
- Use variables already present in current runtime contracts first.

### D. Structural safety remains mandatory, but it is not the same thing as translation quality

Structural safety stays in scope:
- placeholders
- HTML tag parity
- anchor integrity

But PRD 070 does not introduce a full semantic scoring platform.

### E. Prague parity rule

Instance l10n must reach at least the same level of contextual prompt quality already present in Prague-string translation.

It is unacceptable for marketing-page translation to have richer prompt context than product widget translation.

---

## Deferred beyond PRD 070

These are valid future directions, but they are not required to close the current madness:
- glossary injection platform work
- back-translation confidence scoring
- semantic quality scoring
- broad locale-family prompt packs
- account/domain tone bundles
- expanded prompt/policy telemetry
- non-locale overlay generation strategies (`geo`, `industry`, `experiment`, `account`, `behavior`)
- Venice multi-layer runtime composition
- cross-layer coherence validation for composed Babel outputs

These belong in the next PRD after the first real non-base FAQ outputs exist and can actually be evaluated.

---

## Babel seam contract

This section is a guardrail, not additional scope.

- `enqueueL10nJobs()` remains a simple scheduler
- the touched scheduler seam must stop hardcoding `layer = 'locale'`
- current call sites stay locale-only in PRD 070
- keep the existing generic `(publicId, layer, layerKey, baseFingerprint)` state/storage shape
- do not introduce runtime composition work or new overlay strategies here

This matters because PRD 070 is not building a translation-only subsystem.
It is proving the general overlay architecture on the locale lane first.

The forward overlay rule is:
- Roma decides the desired overlay state
- the generator reconciles desired state into artifacts
- Tokyo stores and exposes actual-ready overlay truth

So the seam must stay generic enough for:
- locale overlays
- email-language overlays
- A/B overlays
- personalization overlays
- future Babel overlay types

But PRD 070 still implements locale only.

---

## Trigger rules

### Human/system model

The product mental model for translations must stay simple:

1. entitlements determine which locale options Roma may show
2. the user checks/unchecks locales in Roma settings and saves
3. that saved Roma locale list becomes the canonical desired locale set
4. the user saves base content
5. the translation pipeline is triggered for the current base fingerprint
6. for each desired locale:
   - if Tokyo already has the exact current-fingerprint artifact -> do nothing
   - if Tokyo does not have it -> generate it and write it
7. each locale becomes `Ready` only when Tokyo has the artifact for that exact current base fingerprint

Internal orchestration details are not product truth.
Embed/runtime consumption details are also not translation-system truth.

For PRD 070, the customer-facing/system-facing story is:
- choose locales in Roma
- save base content
- pipeline reconciles Tokyo to that desired locale set
- Bob shows `allowed` and `ready`
- embed/runtime later chooses only among the locales that are already `Ready`

If any implementation path requires more turns than that story, the implementation is wrong for PRD 070.
The response is to simplify the owner/truth path, not to add another inferred state.

### A. Base save with text change

For every desired non-base locale:
- check whether Tokyo already has the exact current-fingerprint artifact
- if yes: skip
- if no:
  - mint the required execution entitlement/grant for automatic translation work
  - mark stale/superseded as needed
  - schedule translation generation
  - on success, write the correct artifact to Tokyo

Translation-system responsibility ends when Tokyo matches the desired locale set for the current base fingerprint.

This applies equally to:
- user instances
- curated instances

### B. Account locale change

When locales are added:
- the saved Roma locale list changes the canonical desired locale set
- every published instance owned by the account, including curated owned instances, must be evaluated
- newly desired locales must be seeded into the translation pipeline
- ready state must be granted only from successful current-fingerprint artifacts in Tokyo
- newly desired but not-yet-ready locales must not be projected into the consumer pointer prematurely

When locales are removed:
- removed locales leave the desired locale set immediately
- removed locales must stop counting toward allowed/ready counts
- Tokyo artifact/state policy must be resynced accordingly

### C. Publish

Publish remains a public-runtime command, not a save command.

But multilingual readiness must be explicit:
- publish/runtime consumption remains separate from translation generation
- locale readiness remains separately visible
- a locale is not considered ready until Tokyo has the artifact for the current base fingerprint
- consumer publication must project only the current ready set, never the full allowed set
- one missing locale must not block already-ready locales from being consumable

This PRD does not reopen PRD 54/61 live-pointer architecture.
It fixes translation truth without coupling that truth to any one consumer.

---

## UI contract

### Roma Settings

Roma settings are the canonical control plane for the desired locale set.

Rules:
- entitlements/plan determine which locale options may be shown as selectable
- the saved checked locale list is the desired locale set the system must use
- downstream systems must not invent a second interpretation of that saved list

They must not imply:
- ready locales exist in Tokyo for the current base content

### Bob localization panel

The localization panel must show:
- `Translations`
- base locale
- allowed locale count
- ready locale count
- per-locale status

Replace the current misleading empty-state model.

Count semantics:
- the count used for the target translation set must derive from the saved Roma locale list, not the wider theoretical plan catalog
- `ready` remains the subset of that target set that exists in Tokyo for the current base fingerprint

Allowed examples:
- `29 allowed, 0 ready`
- `29 allowed, 12 ready`
- `29 allowed, 29 ready`
- `Base`
- `Ready`
- `Not ready`
- `Save to update translations.`
- `Updating translations...`

Forbidden examples:
- `Translations Configured` when nothing is ready
- plan/entitlement upsell copy inside the translation panel
- billing/quota copy inside the translation panel

### Marketing / sales copy

The product may only claim:
- the count of locales that are actually ready for the supported proof lane

Until then:
- no "available in 29 languages" value prop

---

## Execution phases

### Phase 1 — Pipeline closure

Goal:
- make the real translation triggers work for the only real proof lane

Scope:
- verify and preserve the Roma save-aftermath trigger for curated and user lanes
- verify and preserve curated published instances in account-locale aftermath
- fix the scheduler dead-end by removing hardcoded locale-only seam assumptions where touched
- allow `enqueueL10nJobs()` to carry a defaulted `layer` seam cleanly without changing its core job as a scheduler
- make the pipeline reconcile the canonical saved locale set against Tokyo current-fingerprint artifacts deterministically
- preserve the same Tokyo artifact-write contract for translation output

Acceptance:
- the curated FAQ lane in `cloud-dev` actually leaves `Pending` after a qualifying base save
- locale enablement on an account reaches curated published instances too

Additional constraint:
- preserve the existing generic state/storage model
- do not ship new non-locale overlay strategies in PRD 070
- `enqueueL10nJobs()` must not grow into a broad multi-dimension orchestration abstraction

### Phase 2 — Minimal prompt-policy closure

Goal:
- verify and tighten the minimum prompt-policy contract without building a quality platform

Scope:
- confirm `widgetType` and text type (`string` vs `richtext`) are present end-to-end on the instance l10n lane
- close any remaining gap vs Prague-string prompt context where it still exists
- preserve Unicode/non-Latin handling and fix only any remaining heuristic misclassifications

Acceptance:
- instance translation is provably widgetType-aware and text-type-aware on the active lane
- non-Latin base content is handled as real source content, not misclassified literal content

### Phase 3 — Truth-model closure

Goal:
- define and expose one canonical status model

Scope:
- add canonical allowed/ready count semantics to the API/UI contract
- stop using configuration-only labels as readiness labels
- align docs and product copy around base-locale and Tokyo-ready truth
- make the saved Roma locale list the single canonical target locale set across API/UI/runtime
- replace entitlements-shaped consumer locale sets with ready-shaped consumer locale sets
- define the consumer pointer contract around `readyLocales`
- define ordered `switcher.locales` subset semantics for embed consumers
- define consumer locale resolution precedence: explicit selection, then IP, then base locale
- add a write-path consumer-pointer reconciliation trigger when a locale becomes ready for a published instance/current fingerprint

Acceptance:
- every localization UI can distinguish allowed vs ready
- no shipped product copy treats allowed locales as delivered translations
- there is one canonical saved target locale set, and all touched surfaces derive from it consistently
- consumer/embed policy never treats allowed locales as ready locales
- non-ready allowed locales do not block already-ready locales from being consumable
- switcher-only, IP-only, and IP+switcher embed modes are supported by the consumer contract
- a newly-ready locale reaches the consumer pointer without requiring another manual save

### Phase 4 — Tier/provider closure

Goal:
- make tier/provider semantics match runtime behavior

Scope:
- keep AI profile selection tier-bound and explicit
- verify the active lower/paid profile mapping on the touched lane

Rule:
- treat this as acceptance closure, not as a separate architecture/build stream

Acceptance:
- lower/paid tier differences are visible as caps/quality, not as broken state machines

### Phase 5 — Proof closure

Goal:
- prove the system honestly with the environments that actually exist

Scope:
- `cloud-dev`: prove the one real `tier3 FAQ` lane end-to-end
- `local`: verify lower-tier policy/contract behavior
- update canonical docs only after runtime behavior is shipped

Acceptance:
- `cloud-dev` real lane works
- local lower-tier verification is explicit and reproducible
- no one claims broader proof than the environments actually provide

---

## Execution guardrails

This PRD must be executed with the smallest possible blast radius.

### Red lines

Forbidden during PRD 070 execution:
- new services
- new queues
- new databases or schema migrations
- fallback behavior
- broad refactors justified as "cleanup"
- Babel Phase 2 implementation
- Tokyo/Tokyo-worker policy logic expansion
- preserving a wrong pre-GA contract only for compatibility if a cleaner replacement is already possible

### Elegant-engineering rule

Every change must satisfy all four:
- fixes one confirmed broken behavior
- preserves or improves the architectural boundary
- reduces future rewrite debt
- does not introduce a second interpretation of locale truth

If a change fails any of those four, it is out of scope for PRD 070.

Additional hard rule:
- if a fix makes the system take more turns to answer:
  - what is desired?
  - what is ready?
  - what should be shown?
  then it is not an acceptable PRD 070 fix

### Smallest-diff rule

Execution should prefer:
- one guard-clause removal over a new abstraction
- one query extension over a new read path
- one parameter seam over a generalized subsystem
- one contract rename over dual-contract drift
- one honest label over a derived status taxonomy

PRD 070 is allowed to refactor when the refactor removes turns.
It is not allowed to preserve a twisty truth path just because a smaller patch can make that path limp along.

### Execution slices

To keep blast radius controlled, execution proceeds in these slices:

1. Desired-locale-truth slice
   - Roma saved locale settings remain the only desired-locale source
   - no downstream path chooses locales independently
   - free/system-chosen locale behavior is materialized once at the Roma boundary and then treated as ordinary saved truth
2. Account-ready-truth slice
   - Roma account-mode status reads `ready` from explicit Tokyo artifact truth
   - account surfaces stop treating overlay presence as customer-ready truth
3. Consumer-pointer slice
   - consumer policy uses ready locales only
   - switcher/IP contract follows the ready set only
   - newly-ready locales converge into the consumer pointer without another manual save
4. MiniBob-contract slice
   - public runtime exposes a Bob-ready localization snapshot for host boot
   - MiniBob may view all ready locales while remaining action-limited by policy
5. Prompt-policy slice
   - verify `widgetType`
   - verify text type
   - verify Unicode/non-Latin handling and fix only remaining gaps
6. UI-truth slice
   - Bob/Roma labels and counts
   - translation truth stays separate from commercial upsell
7. Proof slice
   - verify the real `cloud-dev` lane

Each slice should land cleanly before widening the touch set.

### Stop conditions

Stop and re-evaluate if execution starts to require:
- a second desired-locale source besides saved Roma settings
- a second readiness definition besides Tokyo current-fingerprint artifact truth
- Bob or Venice deriving locale truth instead of consuming it
- consumer/runtime dependence on non-ready locales
- Tokyo/Tokyo-worker making entitlement decisions
- generalized multi-layer runtime composition
- glossary/scoring/telemetry work before the real lane is green

---

## Immediate execution order

Do the work in this order:

1. Close account-mode `ready` truth on explicit Tokyo artifact truth instead of overlay presence.
2. Separate consumer locale policy from commercial locale policy so embed/runtime uses only `ready` locales.
3. Add write-path reconciliation so newly-ready locales converge into the consumer pointer without another manual save, reusing the existing Roma aftermath -> San Francisco -> Tokyo/Tokyo-worker lane.
4. Define and ship the public MiniBob host-boot contract so Prague/Venice can open Bob with a full localization snapshot while keeping MiniBob action-limited by policy.
5. Fix the touched generation seam so orchestration is not dead-ended on `layer = 'locale'`, without turning it into Babel soup or rebuilding the active proof lane.
6. Verify the live prompt-policy contract: `widgetType`, text type, and Unicode/non-Latin handling; fix only real remaining gaps.
7. Replace misleading UI labels and remove translation/commercial truth mixing.
8. Verify the real FAQ `cloud-dev` lane.

Hard rule:
- do not delay steps 1 through 4 with glossary, scoring, or telemetry work.
- do not use Babel scale concerns as an excuse to build geo/industry/ABM runtime features in this PRD.
- do not build translation-quality infrastructure before the first real non-base FAQ output exists.

This is the boring product-critical sequence:
- make `ready` honest
- fix the consumer-ready contract
- bound consumer-pointer lag
- close MiniBob on the same truth
- preserve one deterministic locale-set rule
- verify the active context lane
- fix the UI truth
- then prove the lane

---

## Acceptance matrix

### Cloud-dev real-lane acceptance

The following must be green on the only real proof lane:
- account: seeded `admin`
- tier: `tier3`
- widget: `FAQ`
- instance kind: curated and user-owned copy, if both are in scope during execution

Required proof:
1. enable locales in Roma
2. save base FAQ
3. non-base locales move through queued/running/succeeded rather than staying `Pending forever`
4. Builder shows truthful `allowed` and `ready` counts
5. Tokyo contains the non-base locale artifact for the current base fingerprint revision
6. rendered non-base FAQ copy can be validated by a consumer without English fallback or stale-fingerprint ambiguity
7. consumer/embed policy exposes only `ready` locales, not merely `allowed` locales
8. if only a subset of allowed locales are ready, the consumer still serves that ready subset correctly
9. embed supports:
   - switcher only
   - IP only
   - IP + switcher
10. the user can choose whether to show the switcher and which ordered ready locales appear in it
11. the saved Roma locale list is the only target locale set used by the pipeline; there is no second policy interpretation downstream
12. after a locale becomes ready for the current published fingerprint, the consumer pointer converges without requiring another manual save

### Local tier-contract acceptance

Because `cloud-dev` does not currently provide real lower-tier accounts, the following must be proven in `local`:
- MiniBob view-all-ready / limited-actions behavior
- Free single-system-materialized-locale behavior
- Tier1 locale-cap behavior
- Tier2/Tier3 unlimited-cap behavior
- AI profile selection by tier
- non-Latin base-content handling
- minimal prompt-context behavior (`widgetType` + text type)
- touched generation seams remain layer-capable while only locale strategy is implemented

This is policy/contract verification in `local`, not claimed customer-runtime proof.
It is the only truthful lower-tier validation model given current environments.

---

## Out of scope

This PRD does not reopen:
- PRD 54 live-pointer architecture
- PRD 61 save cutover architecture
- Prague strings localization
- generalized multi-dimensional personalization overlays implementation
- adding more cloud-dev accounts just to pretend proof breadth

This PRD is specifically about fixing translation-by-tier truth for the product that actually exists.

---

## Execution start decision

This PRD is approved to move to `02-Executing`.

Execution starts with these confirmed answers:

1. Yes: one elegant lifecycle model is used across curated and user instances.
2. Yes: tiering changes only caps/quality, not basic translation semantics.
3. Yes: the plan removes misleading product/UI truth instead of papering over it.
4. Yes: the proof model stays honest about the fact that `cloud-dev` currently proves only the `admin tier3 FAQ` lane.
5. Yes: the named AI profiles in the tier contract exist in current policy/runtime (`free_low`, `paid_standard`, `paid_premium`).

---

## Expected follow-on canonical doc updates after execution

When this ships, update:
- `documentation/capabilities/localization.md`
- `documentation/services/roma.md`
- `documentation/services/bob.md`
- `documentation/services/sanfrancisco.md`
- `documentation/services/venice.md`
- `documentation/services/tokyo-worker.md`
- `documentation/architecture/CONTEXT.md`

Do not move PRD 070 to `03-Executed` until those canonical docs match the shipped runtime.
