# 124A — Senior Product Manager Review

Status: REVIEW
Reviewer: Senior Product Manager (independent peer review)
Date: 2026-06-25
Subject: `124A__PRD__Schema_Token_Contract_Lock.md` and the orchestrator peer review `124A__PR.md`
Parent: `124__MAMA__Overlay_Aware_Runtime_Materializer_Program.md`

## What I verified in code (not docs) before reviewing

A PM review grounded in CODE/VECTORS/BLAST RADIUS has to look at the surfaces a
visitor and a builder actually touch. I read the runtime, not just the PRDs:

| Surface | File | What it actually does today |
| --- | --- | --- |
| Bob preview locale resolver | `tokyo/product/widgets/shared/previewL10n.js` | Applies overlays by **positional concrete path** (`sections.0.faqs.0.question`). Parses `path.split('.')` and treats numeric segments as array indices. No identity-key addressing. |
| Public serving | `tokyo-worker/src/routes/clk-live-routes.ts` | Serves base-locale bytes only. **No locale URL segment. No locale-aware R2 read. No per-locale purge.** `?locale=` is not read here. |
| Locale switcher (visitor-facing) | `tokyo/product/widgets/shared/localeSwitcher.js` | Sets `?locale=<locale>` query param and reloads. In `translations` preview mode it routes through the host instead. This is the user-facing locale affordance. |
| Overlay storage | `tokyo-worker/src/domains/account-translations/values.ts` | Stores/validates overlays keyed by **concrete field path** (`Object.keys(content.fields)`). `assertLocaleOverlayValuesMatchSavedTextFields` compares path sets. |
| Translation Agent output | `agents/translation-agent/src/index.ts` | Emits `{ path, value }` where `path` is the producer item path. `parseTranslationResult` keys by `item.path`. |
| Identity machinery | `packages/ck-contracts/src/translated-value-primitives.ts` | `identityKeyForField()` builds identity keys (`widgetType|role|path|idPath=value`) and detects duplicate ids. **Exists, but is NOT used by overlay files, preview, or serving.** |
| Public package builder | `roma/lib/account-instance-public-package.ts` | `buildRuntime` emits `locales = { [baseLocale]: state }` and `localePolicy.languages = [baseLocale]`. Single-locale payload. |
| Saved instance ids | `tokyo/product/widgets/faq/spec.json` | Repeater items carry stable ids (`id: "s1"`, `id: "q1"`, …). So the reorder-safe substrate the identity rule needs is present in real saved data. |

## Rubric

### 1) Elegant product UX and scalability

**The product goal 124A seeds is correct and the UX bar is right.** A visitor
in locale `fr` who hits a `clk.live` URL must get French bytes; a builder's Bob
preview must equal what publishes; there must be no wrong-language fallback when
a locale is missing. 124A names these exact outcomes (preview/public parity in
Slice 7, `fallback must always be no` in Slice 6, locale URL in Slice 5).

**But 124A under-specifies the most user-visible product decision: the locale
URL shape itself.** Slice 5 step 1 says "choose exact explicit locale URL shape
using current public serving authority unless 124E explicitly adds a route."
The current public serving authority (`clk-live-routes.ts`) has **no locale
route at all** — `?locale=` is a query param the switcher writes but the serving
route never reads. So every option here is net-new product behavior:

- `/{accountPublicId}/{instanceId}?locale=fr` (query) — current switcher writes
  this; requires `clk.live` to read the query and serve a different entry HTML.
- `/{accountPublicId}/{instanceId}/{locale}` (path segment) — cleaner for
  crawlers/hreflang (matters for the Babel/GlobalReach moat), but changes the
  coordinate and breaks every existing published link unless redirected.
- `/{locale}/{accountPublicId}/{instanceId}` — prefix style.

This is not a contract detail. It is the single most consequential product/UX
decision in the whole program because it decides (a) what URL a visitor sees
and shares, (b) whether search engines can index per-locale pages, and (c)
whether already-published `clk.live` links keep working. 124A must pick one,
state the shareability/crawler/legacy-link consequences explicitly, and assign
the redirect-or-not decision to a named sub-PRD. Leaving it as "choose using
current authority" is hollow when there is no current authority to choose from.

**Scalability to many locales: good.** The overlay-as-value-map model scales
linearly with active locales (one overlay file per locale per instance) and
never duplicates the widget. That is the right product shape.

### 2) Compliance to architecture and tenets

**Passes.** The no-reinterpretation tenet is stated verbatim and the substrate
rule forbids inventing a Schema service, token registry, identity DB, status
store, or compatibility reader — exactly the legacy-SaaS machinery AGENTS.md
and the MAMA program forbid. The authority gate names Roma/Tokyo/Translation
Agent before any decision. Identity is scoped to repeaters (anti-overarchitecture)
and scalars stay path-keyed. This is compliant product law.

**One tenet risk to name.** Slice 2 step 5 says "Choose exactly one canonical
identity representation for 124B. No dual-read compatibility mode is allowed."
That is the right call — but the orchestrator's watch-item 1 is correct: the
honest reading of the code is that overlay files, preview, and serving all use
**positional concrete paths today**, while `identityKey` is an internal
calculation not yet wired to any user-facing surface. So "reuse the existing
`identityKey`" is not free — it means making positional files and a positional
preview resolver adopt identity addressing, which is a real migration of the
overlay shape, not a zero-cost reuse. 124A must state this honestly rather than
implying reuse is the no-migration path.

### 3) Overarchitecture / unnecessary complexity

**No overarchitecture found.** This is the discipline I most want to protect in
this PRD and it holds. No readiness ledger, no status store, no probe ritual,
no compatibility reader. The evidence contract (Slice 4) names only
independently-moving inputs and explicitly excludes evidence from overlay
bodies and serve-time recomputation. The failure contract (Slice 6) forces
fail-closed with no fallback for requested locales. The "explicitly non-claimed,
not silently omitted" rule for deferred repeated fields is the exact V3 guard.

**One complexity flag from a UX/cognitive-load angle.** If Slice 3 lands on
`scalar_only_initially`, the product UX is: "FAQ reorder works for scalar text
but FAQ translations silently stop applying after a reorder." That is
defensible as an explicit, surfaced limitation — but only if the Bob
TranslationsPanel **shows the user which fields are and aren't localized**, and
why. 124A's failure table covers "repeated-field overlay excluded by a
`scalar_only_initially` decision" but says nothing about the **builder-facing
visibility** of that exclusion. A builder who reorders an FAQ, sees the French
preview go wrong, and has no panel message explaining "repeated-field
translations are paused until X" will file a bug. That UX detail belongs in
124A or 124D, not deferred to operator instinct.

### 4) Simple, boring, on-target from a product perspective

**Mostly yes, with one product gap that is larger than the PRD admits.** The
boring-correct path is: lock identity, evidence, URL, failure, parity. That is
what 124A does and it is the right order.

The gap the PRD soft-pedals: **the positional-overlay reorder bug is a live V1
today, not a future risk.** Right now, with zero code from 124B, a builder can:

1. Save an FAQ instance with two Q&As in order [q1, q2].
2. Generate French overlays → overlay stores `sections.0.faqs.0.question = "q1-fr"`, `sections.0.faqs.1.question = "q2-fr"`.
3. Reorder to [q2, q1] in the editor and save.
4. The positional overlay now keys the **q2 source text** to the **q1-fr
   translation**. Every subsequent French preview/serve shows the wrong answer
   under the wrong question, silently.

This is silent substitution (V1) on the exact product surface Babel is meant to
protect. The preview resolver (`previewL10n.js`) and the overlay store
(`values.ts`) both address by array index, so nothing catches it. 124A is the
right place to name this as the product gap being closed — but it should state
it as a present defect, not just a contract to prevent. This reframes 124A from
"nice seed contract" to "locks the fix for an active wrong-content bug," which
is more honest about why the work matters and why `scalar_only_initially` is not
a safe long-term resting place for any widget with repeated fields.

### 5) Docs to update (vision/architecture/system perspective)

124A's own rule — update canonical docs only if a lock changes current-system
truth — is correct. Given what the code actually shows, the following are not
conditional; they will be required once 124A closes its decisions:

| Doc | Required update if 124A locks… |
| --- | --- |
| `documentation/capabilities/localization.md` | Slice 3 = `scalar_only_initially` → the "Source Text" section's claim that producers receive positional paths for repeated fields must add the explicit limitation that repeated-field locale cascade is paused. |
| `documentation/capabilities/localization.md` (Public Serving Boundary) | Slice 5 locale URL → the doc currently states "Public visitor requests do not read locale overlay files" and shows only base URLs. A new locale coordinate changes stated capability. |
| `documentation/architecture/BabelProtocol.md` / `OverlayArchitecture.md` | Slice 2 identity decision → if canonical identity changes the positional-key form these docs describe, the overlay-key contract section changes. |
| `documentation/strategy/GlobalReach.md` (Search And Answer Engines section) | Slice 5 locale URL shape → the crawler/hreflang/sitemap loop depends on whether localized artifacts exist at crawlable path-segment coordinates. Query-param locales are crawlable; the doc's strategic claim should match the chosen shape. |

The strategy docs (`Clickeen-Babel.md`, `GlobalReach.md`) are vision and likely
need no change unless 124A's locks contradict the source-plus-overlay thesis —
they do not.

## Vectors and blast radius (product/UX)

| Vector (if 124A locks it wrong) | Failure mode a user hits | Blast radius |
| --- | --- | --- |
| Locale URL shape left as "current authority" when none exists (Slice 5) | 124E invents the URL under deadline pressure; shareable links, hreflang, and already-published `clk.live` links get inconsistent treatment | Every localized public surface, every account, every locale, forward-permanent |
| Identity decision implies "reuse" when overlay files are actually positional (Slice 2) | 124B bridges positional↔identity with an ad-hoc compatibility shim (the forbidden reader) or silently misapplies translations after reorder | Every repeated-field widget (faq, cards, big-bang), every locale |
| Reorder of repeated field while overlays are positional (LIVE today, not 124A-future) | Visitor sees q1's French answer under q2's question; builder's preview shows the same wrong content | Per-instance × per-locale; silent; no panel surfaces it |
| `scalar_only_initially` with no builder-facing visibility | Builder reorders FAQ, French goes wrong, no panel message, bug filed as "translation broken" | Every repeated-field widget in every localized account |
| Parity suite not CI-gated (Slice 7) | Preview shows correct locale, published artifact shows base/wrong locale (or vice versa) — silent divergence | Per-instance, silent, erodes the "preview = publish" product promise |
| Purge path assumed-but-absent (Slice 5) | Builder edits source, French entry HTML serves stale bytes up to TTL | Per-locale × per-instance, silent for the TTL window |

## V1–V8 product-lens audit

| ID | Audit question for this contract | 124A result |
| --- | --- | --- |
| V1 | Does the lock let wrong content substitute for missing/stale truth? | The reorder-position-overlay vector is a present V1; 124A's identity rule is the fix and is correctly scoped. Must be stated as present, not future. |
| V2 | Does the lock normalize/repair invalid overlay state silently? | No — failure contract is fail-closed. |
| V3 | Does the lock silently drop repeated-field translations if deferred? | Guarded: "explicitly non-claimed, not silently omitted." Strongest part of the PRD. |
| V4 | Does enforcement fail open on a missing dependency? | No — fallback always `no` for requested locale. |
| V5 | Does it treat corrupt overlay state as missing? | No — validation compares path sets and fails. |
| V6 | Does it claim full success after partial work? | Closeout gate forbids unassigned placeholder language. |
| V7 | Does the same failing workflow continue under a new wrapper? | N/A at contract stage. |
| V8 | Does normal product work depend on tests/probes? | Parity suite is a conformance gate, not runtime truth — correct as long as it is CI-gated and not reinterpreted as a readiness signal. |

## Assessment of the orchestrator's peer review (`124A__PR.md`)

The orchestrator review is technically sound and I agree with five of its six
watch-items. Two corrections from the product/UX side:

1. **Slice 3 "THE crux" is resolvable now, not just "the highest-leverage
   decision."** The orchestrator flags the contradiction between
   `identityKeyForField()` existing and overlay files being positional. The code
   resolves it: overlay files, the preview resolver, and the Translation Agent
   output are **all positional today**; `identityKey` is an internal helper not
   wired to any user-facing surface. So the evidence-backed Slice 3 decision is
   almost certainly `requires_full_overlay_key_chain_change` (or
   `scalar_only_initially` as the interim). 124A should be told this is
   knowable from the code, not an open empirical question — and the work of
   changing the overlay-key chain (124D) is real migration work, not a contract
   tweak.

2. **The orchestrator's Slice 5 watch-item is understated.** It frames the
   purge-path menu as a "stale-locale-serving window" risk. From the product
   side the bigger risk is the **locale URL shape** decision, which the
   orchestrator does not call out at all. That URL is the visitor-facing
   coordinate and the crawler-facing coordinate; it is the single most
   consequential product decision in the program and 124A currently defers it
   to a non-existent "current authority." This is the one place the
   orchestrator review missed a load-bearing item.

## Verdict

**GREEN, with two conditions that must close before Slice 8.**

124A is a compliant, non-overarchitected, correctly-ordered contract lock that
honors the no-reinterpretation tenet and the V1/V3 discipline. It is the right
seed slice. Green-lighting is appropriate because the two conditions below are
within 124A's own scope (decisions it must close, not plan changes):

1. **Slice 5 must pick the locale URL shape explicitly** (path segment vs query
   param vs prefix), name the shareability/hreflang/legacy-link consequences,
   and assign the redirect decision to a named sub-PRD — not defer to a
   "current public serving authority" that does not exist in code today.

2. **Slice 2 must represent the identity decision honestly**: "reuse the
   existing `identityKey`" means migrating positional overlay files and a
   positional preview resolver to identity addressing, which is real work in
   124D, not a zero-migration reuse. The PRD should state this so 124B/124D are
   not surprised into building the forbidden compatibility reader.

One non-blocking product recommendation: name the **positional-reorder
wrong-translation bug as a present V1 defect** that 124A's identity rule fixes,
and require that a `scalar_only_initially` decision include builder-facing
visibility in the TranslationsPanel (assigned to 124D) so the limitation is
surfaced to the user, not hidden.
