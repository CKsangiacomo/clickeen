# PRD 070B — Tiered Translation Truth and Runtime Closure

Status: BLOCKED BY PRD 070A
Date: 2026-03-15
Owner: Product Dev Team
Priority: P0 (product truth + commercial truth)

Execution dependency:
- PRD 070B must not execute until PRD 070A has closed the product boundary.
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
   - When a locale becomes ready for a published instance/current fingerprint, the system must trigger consumer-pointer reconciliation.
   - Venice must not query or reconstruct readiness dynamically at request time.
   - The embed must not wait for a future manual save to pick up already-ready locales.

11. Session-minted entitlement truth only
   - The account bootstrap authz capsule is the product-path entitlement/policy truth for the session.
   - Paris may verify that capsule on account product routes.
   - Paris must not recompute or reinterpret entitlements on save, localization, l10n status, layer edits, or published-surface convergence.
   - If entitlement truth changes, the system must mint a new session/capsule instead of re-resolving policy mid-session.

---

## Terminology lock

In PRD 070:
- `plan allowance` means what the tier/entitlements permit in principle
- `allowed` means the saved Roma locale set that is permitted by entitlements and selected by the user
- `ready` means Tokyo has the artifact for the exact current base fingerprint
- `consumer pointer` means the ready-only locale policy used by embed/runtime consumers

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

## Current confirmed failures

These are not speculative. They are confirmed in current repo/runtime truth.

### A. Current confirmed product/runtime failures

1. Curated save aftermath explicitly skips translation scheduling.
   - `paris/src/domains/account-instances/save-aftermath-handlers.ts`
   - Current branch: `if (!textDiff.textChanged || context.source === 'curated')`
   - Result: the curated FAQ lane can save base content without ever enqueuing locale generation.

2. Account locale aftermath ignores curated published instances.
   - `paris/src/domains/l10n/account-handlers.ts`
   - Current aftermath scan walks `widget_instances` only, not `curated_widget_instances`.
   - Result: enabling account languages in Roma does not seed the one curated FAQ lane that matters.

3. Builder status lies about readiness.
   - `bob/components/LocalizationControls.tsx`
   - Current rule: if locales are allowed but no materialized locale overlays exist, status label becomes `Configured`.
   - Result: the UI represents entitlement/configuration as if it were successful translation output.

4. Runtime truth is split across three different concepts with no single honest surface:
   - account locales allowed
   - internal generation/materialization state
   - actual ready/not-ready truth in Tokyo for the current base content

5. Instance translation policy is materially under-specified.
   - `sanfrancisco/src/agents/l10nTranslationCore.ts`
   - Current instance l10n prompt is generic: locale + JSON/safety rules + generic fluency instruction.
   - Provider/model routing is tier/grant-aware, but the translation policy is still effectively one generic prompt reused across providers.
   - Missing today:
     - widget-type-aware instructions
     - text-type awareness (`string` vs `richtext`)
     - at least the same level of context already used by Prague-string translation
   - Result: the system is good at producing structurally safe translations, not necessarily high-quality localized product copy.

6. Current heuristics contain Latin-script assumptions.
   - `sanfrancisco/src/agents/l10nTranslationCore.ts`
   - `isLikelyNonTranslatableLiteral()` currently treats strings with no `[a-zA-Z]` characters as non-translatable literals.
   - Result: base content authored in non-Latin scripts can be incorrectly skipped or misclassified by the translation path.

7. The repo already demonstrates richer translation context elsewhere, but not for instance l10n.
   - `sanfrancisco/src/agents/l10nPragueStrings.ts`
   - Prague strings translation already passes explicit context like `chunkKey` and `blockKind`, while instance l10n does not pass equivalent widget/field context.
   - Result: system-owned Prague translation is more context-aware than the actual product widget translation path.

8. The current generic prompt contains instructions that sound responsible but do not constitute translation policy.
   - `sanfrancisco/src/agents/l10nTranslationCore.ts`
   - Example: `Silently self-check fluency before final output.`
   - Result: the prompt looks safer than it is. The output policy is still generic and under-specified.

### B. Current architecture risks and scope boundaries

10. Generation orchestration is still locale-hardcoded even though the layer model is already broader.
    - `packages/l10n/src/index.ts`
    - Shared contracts already define a broader layer model (`locale`, `geo`, `industry`, `experiment`, `account`, `behavior`, `user`).
    - `paris/src/domains/l10n/enqueue-jobs.ts`
    - Current orchestration still hardcodes `const layer = 'locale'`.
    - Result: the scheduler seam is at risk of becoming future rewrite debt even though the surrounding state model is already generic.

11. Venice runtime code is still locale-specific, and PRD 070 must not widen that into a generic runtime-composition project.
    - `venice/app/e/[publicId]/route.ts`
    - Current runtime fetches one locale pointer and one locale pack directly.
    - Result: PRD 070 must keep runtime work limited to the ready-only consumer contract and avoid premature multi-layer composition work.

12. The scheduler seam issue is narrower than a full Babel rewrite.
    - `paris/src/domains/l10n/enqueue-jobs.ts`
    - `enqueueL10nJobs()` is fundamentally a locale scheduling function today and should stay simple.
    - The core issue is not that the whole function is "Babel soup"; it is that one hardcoded layer constant creates a dead end for future dimensions.
    - Result: PRD 070 should fix the seam precisely, not turn the scheduler into a six-dimension architecture project.

13. Consumer locale policy is still too entitlements-shaped.
    - `paris/src/domains/account-instances/published-convergence.ts`
    - `paris/src/domains/account-instances/create-handler.ts`
    - `tokyo-worker/src/domains/render.ts`
    - Current flow derives `availableLocales` from account/policy selection and then asks Tokyo to validate that entire set before moving the live pointer.
    - Result: if a higher-tier customer is allowed more locales, they can end up with a larger all-or-nothing failure surface even when many locale artifacts are already ready.

14. Current live-surface sync is too globally coupled for Babel.
    - `tokyo-worker/src/domains/render.ts`
    - Current rule: for every locale in the consumer locale policy, Tokyo requires a live text pointer before advancing the live pointer.
    - Result: one missing locale can block the whole consumer surface if the consumer locale set is not strictly the already-ready set.
    - This is the wrong blast radius for a premium multilingual product.

---

## Execution diagnosis

The execution problem is simpler than the history:
- the trigger does not reliably fire on the only real lane
- translation context is too generic
- UI truth is misleading
- consumer locale policy is derived from `allowed` instead of `ready`

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

- Total locales: base locale only
- User-selectable additional locales: 0
- Async translation pipeline: disabled
- AI profile: `free_low`

### Free

- Total locales max: 2
- User-selectable additional locales: 0
- Additional locale source: system-chosen only, when allowed by product policy
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
- remove curated save skip from save aftermath
- include curated published instances in account locale aftermath
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
- add the minimum missing translation context without building a quality platform

Scope:
- pass `widgetType` into the instance-l10n prompt policy
- pass text type (`string` vs `richtext`) into the instance-l10n prompt policy
- reach Prague-string prompt-context quality as a minimum bar
- remove Latin-script assumptions from translation heuristics

Acceptance:
- instance translation no longer runs on one generic prompt with only locale context
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

### Smallest-diff rule

Execution should prefer:
- one guard-clause removal over a new abstraction
- one query extension over a new read path
- one parameter seam over a generalized subsystem
- one contract rename over dual-contract drift
- one honest label over a derived status taxonomy

### Execution slices

To keep blast radius controlled, execution proceeds in these slices:

1. Trigger slice
   - curated save aftermath
   - curated account-locale aftermath
2. Deterministic-locale-set slice
   - scheduler/input path uses the saved Roma locale set as the only desired set
3. Consumer-pointer slice
   - consumer policy uses ready locales only
   - switcher/IP contract follows the ready set only
4. Prompt-policy slice
   - `widgetType`
   - text type
   - remove Latin-script assumption
5. UI-truth slice
   - Bob/Roma labels and counts
6. Proof slice
   - verify the real `cloud-dev` lane

Each slice should land cleanly before widening the touch set.

### Stop conditions

Stop and re-evaluate if execution starts to require:
- a second desired-locale source besides saved Roma settings
- consumer/runtime dependence on non-ready locales
- Tokyo/Tokyo-worker making entitlement decisions
- generalized multi-layer runtime composition
- glossary/scoring/telemetry work before the real lane is green

---

## Immediate execution order

Do the work in this order:

1. Remove curated save skip.
2. Include curated published instances in account locale aftermath.
3. Fix the scheduler seam so touched orchestration is not dead-ended on `layer = 'locale'`, without turning `enqueueL10nJobs()` into Babel soup.
4. Separate consumer locale policy from commercial locale policy so embed/runtime uses only `ready` locales.
5. Add write-path reconciliation so newly-ready locales converge into the consumer pointer without another manual save.
6. Add minimal prompt context: `widgetType` + text type.
7. Remove the Latin-script assumption in current heuristics.
8. Replace misleading UI labels with honest counts.
9. Verify the real FAQ `cloud-dev` lane.

Hard rule:
- do not delay steps 1 and 2 with glossary, scoring, or telemetry work.
- do not use Babel scale concerns as an excuse to build geo/industry/ABM runtime features in this PRD.
- do not build translation-quality infrastructure before the first real non-base FAQ output exists.

This is the boring product-critical sequence:
- fix the trigger
- generalize the seam
- fix deterministic locale-set reconciliation
- fix the consumer-ready contract
- bound consumer-pointer lag
- fix the context
- fix the truth
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
- Minibob base-only behavior
- Free system-locale-only behavior
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
- `documentation/services/paris.md`
- `documentation/services/roma.md`
- `documentation/services/bob.md`
- `documentation/services/sanfrancisco.md`
- `documentation/architecture/CONTEXT.md`

Do not move PRD 070 to `03-Executed` until those canonical docs match the shipped runtime.
