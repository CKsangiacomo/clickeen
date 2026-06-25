# PRD 124 — Peer Review (Staff-Engineer)

Status: REVIEW
Reviewer: External advisor
Date: 2026-06-25
Subject: `124__PRD__Overlay_Aware_Runtime_Materializer.md`
Stage: 02-Executing

## Scope of this review

Independent staff-engineer peer review of PRD 124 as it stands after the two
recent additions (§0 and §2). It covers: elegant engineering and scalability;
compliance to architecture and tenets; overarchitecture and unnecessary
complexity; academic abstraction / pre-work / gold-plating; and whether the
executable core is simple, boring, and on-target. It ends with a concrete code /
vectors / blast-radius breakdown and the items that are non-deferrable before
Step 3.

## The two additions being considered

- **§0 — Core delta with legacy SaaS.** Legacy SaaS is surface-first (surface on
  top, data underneath). Clickeen is the inverse: schema-first, with the surface
  demoted to a derived output at the bottom of the truth stack
  (`schema -> token identities -> overlays -> resolved artifacts -> surfaces`).
- **§2 — Composition law.** The widget is the universal schema-backed atom that
  composes upward: `widget -> page -> site`, and `widget -> email / report /
  feed / crawler artifact / answer-engine artifact / future surface`. Legacy
  builds "separate kingdoms"; Clickeen keeps one schema-token substrate and emits
  many surfaces.

§2 is the stronger of the two. §0 says *schema* is above surfaces; §2 says the
*widget atom* is the unit that composes into all of them. Together they reframe
PRD 124 from "the locale-serving change" into "the founding composition law for
every surface."

### Why that reframe governs the whole review

These additions are strategically correct, but they **invert the risk profile.**
The blast radius of a materializer-contract error is no longer "locale widgets
serve wrong" — it is "every future surface (page / site / email / report / feed /
answer) inherits a flawed substrate." §0/§2 raise the ceiling and the stakes
simultaneously. That makes **Step 0 the highest-risk artifact in the system**,
and it makes the open items named at the end of this review non-deferrable: a
flawed seed contracts forward into every surface.

## 1) Elegant engineering and scalability

### Genuinely elegant

- **The pure resolver is the keystone.** `materializeRuntimeArtifact(input) ->
  files + evidence`, combined with §11's hard "must not fetch / call / infer /
  repair / mutate / purge / record" list, is a pure transform. Pure functions are
  trivially testable, relocatable, and free of temporal coupling — which is
  exactly why the package → Worker → agent promotion path is "relocate, not
  rewrite." This is the single best decision in the PRD.
- **Fingerprint-as-content-address makes CDN correctness fall out of the data
  model.** Immutable support files keyed by fingerprint (§18) mean old versions
  never need invalidation; the URL embodies the version. Standard hashed-asset
  pattern, done right.
- **Sparse overlays scale by delta, not artifact size.** N locales = N small
  value maps over one source, not N widget copies. Storage and cascade cost track
  the overlay delta.
- **§2's composition law is scalable in the way that matters.** One substrate →
  many surfaces. Adding email does not add a product; it adds a resolver output
  over existing atoms.

### Where elegance hits walls

- **Cascade fan-out is the scalability crux, and 124 has no executor for it.**
  The evidence model encodes dependencies on schema / token-identity-map /
  widget-software / Dieter / materializer-version (§12, §13). A change at any of
  those layers marks every dependent artifact stale. For a Dieter token, that is
  potentially every published artifact in every account. The PRD has the *law*
  right (mismatch → cascade required) but the *executor* is absent — Step 6 only
  "documents / tests how mismatches mark artifacts stale"; it does not build bulk
  rematerialization, a queue, or a fan-out throttle. The model can *express*
  "everything is stale"; 124 cannot *resolve* everything. This is the #1
  scalability gap.
- **Per-save synchronous cascade in a Pages function undermines the pure-function
  elegance.** §14 step 4 makes a save resolve base + cascade all active locale
  artifacts inline. For a high-locale account that is N materializations in one
  Cloudflare Pages function with CPU / wall limits. The package is "queueable"
  per the contract, but Steps 2–5 are synchronous Roma-driven. Elegant contract,
  inelegant trigger. The queue is allowed-but-deferred, and the risk is it is
  deferred past the timeout cliff.

## 2) Compliance to architecture and tenets

### Strongly compliant

Roma keeps command authority; Tokyo keeps byte authority; the materializer owns
only deterministic resolution (§6) — matches Tenet 2. Babel bodies stay pure
`{values:…}` with evidence in artifact metadata, not overlay bodies (§8, §12) —
matches BabelProtocol and OverlayArchitecture. Fail-closed on mismatch (§12/§13)
matches Tenet 3 and the V1/V5 core violations. Partial-result law (§17) matches
V6. Tokyo must not compose on visitor requests (§18/§20) matches Tenet 11.
`sourceRef` always base instance, A/B out of scope (§7) — resolves the earlier
variation-instance contradiction cleanly.

### Two real tensions

- **§0/§2 are vision content placed in an EXECUTING-stage doc.** The repo
  enforces a boundary: `documentation/` = current truth;
  `Execution_Pipeline_Docs/02-Executing/` = executable slices. §2 enumerates
  site / email / report / feed / crawler / answer surfaces that do not exist as
  authorities yet (pages are not even served). The substance is correct and the
  sections self-narrow ("PRD 124 ships one coordinate"), but a strict reading
  says that surface enumeration belongs in strategy, not an executing PRD. Minor,
  but it is a doc-stage smell.
- **Preview/public parity (§19) asserts compliance without naming enforcement.**
  Bob preview runs `tokyo/product/widgets/shared/previewL10n.js` (browser JS);
  public runs the materializer (server TS). §19 demands identical token
  semantics across both runtimes, but names no parity mechanism — no shared code
  path, no conformance suite. That is a latent V1/V6 vector: preview shows one
  thing, publish serves another, and nothing in the PRD enforces agreement except
  an assertion.

## 3) Overarchitecture / unnecessary complexity

The PRD is disciplined about *system* overarchitecture (explicit out-of-scope,
no product-status stores, no Worker until proven). The overarchitecture risk
lives in the **document** and in **one layer**:

- **§0 + §2 are ~140 lines of vision before the executable law in an EXECUTING
  doc.** Legitimate use (prevents a locale-only hack), but heavy. The line "the
  contract must remain compatible with later page, site, email, report, crawler,
  and answer-engine compositions" (§2) is **speculative generality** — it asks
  the implementer to keep an undefined future compatible. Replace it with the
  *concrete* invariants future-compatibility actually requires (e.g., "`sourceRef`
  stays an extensible discriminated union; evidence keys are append-only"), which
  are testable, instead of "be compatible with answer engines someday," which is
  aspirational.
- **The real overarchitecture risk is the schema-token-identity layer (§10) if
  implemented naively.** §10 states "a path is not the deepest identity"
  *universally*. For repeated structures that is essential (reorder survival).
  For scalar fields (`header.title`) identity == path, and building a
  token-identity indirection for every scalar is overhead with no use case —
  exactly the "engines without wires" failure. **Step 0 must scope identity to
  where it earns its keep (array / repeated structures, via the existing
  `arrayItemIdentity`), and leave scalar text path-keyed.** This is the single
  most important overarchitecture guard in the whole PRD.

## 3b) Academic abstractions, pre-work, meta-work, gold-plating

- **"Schema" and "token identity" reification risk.** The PRD names them as
  first-class entities, but they do not exist as named artifacts today — the
  substrate is `editable-fields.json` (field contracts with `arrayItemIdentity`)
  + `spec.json` + saved stable ids (verified by grep: no `tokenIdentity` /
  `schemaToken` / `identityMap` symbol exists in `packages/` or
  `tokyo/product/widgets/`). There is a real risk the implementation builds a
  grand `Schema` / `TokenIdentityMap` abstraction *on top of* these boring
  working files. That is academic: reifying a naming layer over artifacts that
  already are the schema. §10's Step-0 audit (lines 404–411) is the right
  antidote — it forces "name the current representation." If Step 0 concludes
  "schema = editable-fields.json + spec.json; token identity = field-path +
  arrayItemIdentity tuple," that is boring and correct. If it concludes "we need
  a new Schema service," that is meta-work. Push hard for the former.
- **Evidence-set gold-plating.** §12 requires ~10 fingerprints per artifact
  (schema fp, token-identity-map fp, source fp, overlay fp, widget-package fp,
  materializer-version, package fp, support-file fps…). The essential cascade
  triggers are source / overlay / package / materializer-version. "Schema fp" and
  "schema token identity map fingerprint" as *separate* fields presuppose they
  are independently versioned — if both are derived from editable-fields.json +
  spec.json, they move together and the split is redundant. Collapse the evidence
  set to fingerprints that map to real, independently-versioned inputs; the rest
  is pre-work that will never fire independently.
- **§2 surface-enum gold-plating.** Seven listed future surfaces where one
  sentence carries the same discipline.

## Code surfaces, vectors, and blast radius

### Code surfaces the PRD actually touches (verified to exist)

| Surface | Change in 124 | Risk class |
| --- | --- | --- |
| `packages/ck-runtime-materializer/` (NEW) | pure resolver, extracted from Roma | contract-seed (highest leverage) |
| `roma/lib/account-instance-public-package.ts` | refactor to call materializer; `locales={baseLocale:state}` → per-locale resolved | behavior-preservation (Step 2) |
| Roma save / publish / active-locale routes (`roma/app/api/account/instances/**`, `…/account/locales`) | trigger cascade per §13/§14/§15/§16 | sync-cascade timeout |
| `tokyo-worker/src/routes/clk-live-routes.ts` | coordinate-aware serve + evidence check (today: single `R2.get(key)`) | fail-closed correctness |
| `tokyo-worker/src/domains/account-instances/{package-files,serve-state}.ts` | evidence storage / validation | stale-mix rejection |
| `agents/translation-agent/` | must emit identity-keyed overlays for §10 to hold — NOT in PRD owners | hidden cross-PRD dependency |
| `tokyo/product/widgets/shared/previewL10n.js` | must match materializer semantics (§19) | preview / public divergence |
| `tokyo/product/widgets/*/editable-fields.json` | the schema / identity seed (`arrayItemIdentity`) | over-build vs boring |
| CDN purge path | entry-HTML purge on cascade — owner / trigger unspecified | stale-entry serving |

### Vectors and blast radius

| Vector | Failure mode | Blast radius |
| --- | --- | --- |
| Identity substrate (V1) | overlays stay positional → after a reorder the overlay applies to the wrong item (silent substitution) | per-instance, but *silent* — hardest to detect |
| Identity over-build (§3/§3b) | token-identity indirection on every scalar → dead complexity, slower resolves | system-wide drag, forever |
| Existing-data migration (V5/V1) | first evidence check flags every existing unmarked package / positional overlay as mismatch → mass 404, or falls back → silent serve | **system-wide** on cutover |
| Cascade fan-out, no executor (V6 / outage) | schema / widget / Dieter / materializer-version change marks everything stale; nothing regenerates → mass 404 or stale serve | **entire public surface, all accounts** |
| Sync save cascade | save resolves N locales inline → Pages timeout / partial → V6 | per-account, on save |
| Preview / public parity (V1/V6) | JS resolver ≠ TS resolver → user previews X, visitors see Y | per-instance, silent |
| Purge authority gap | entry HTML not purged on cascade → stale locale served | per-coordinate, silent |
| Redundant fingerprints | schema fp vs token-identity-map fp contradict → false cascade or false stability | per-artifact, spurious |
| Translation Agent identity-keyed dependency | §10 requires identity-keyed overlays; producer change is out of scope → law cannot hold when 124 ships | every localized instance |

The two additions **expand the blast radius definitionally**: the materializer
contract is now the seed for every surface, so a Step-0 contract error propagates
to page / site / email / report / feed / answer surfaces when they arrive.
Forward-propagating, multi-surface.

## 4) Why the boring core is right and moves toward the goal

Strip §0/§2 (vision) and the over-built identity layer, and what remains is
genuinely boring:

- **Boring core.** Take the package-build logic already in
  `roma/lib/account-instance-public-package.ts`, pull it into a pure function in
  `packages/ck-runtime-materializer`, add one parameter (the overlay coordinate),
  store via Tokyo, serve via the existing clk-live route. It is literally "the
  function that is already in Roma, extracted, made pure, taught to accept an
  overlay." No new service, no new infrastructure, no new authority.
- **Boring cascade.** One function, called with different coordinates on different
  triggers (save → base + locales; overlay write → that locale; locale add/remove
  → generate / delete).
- **Boring CDN.** Hashed-asset + index-pointer — the pattern every build tool has
  used for fifteen years.
- **Boring failure.** Mismatch → 404; missing → 404; partial → name the
  coordinate, never claim success. The fail-closed primitives the system already
  uses everywhere.

It moves directly at the goal: it closes the exact gap (overlays written but not
served), makes public files derived truth (the matrioska law), keeps Roma /
Tokyo / San Francisco authorities and Babel purity intact, and produces the
host-neutral resolver that later surfaces and the agent inherit. Every step in
§22 preserves existing behavior before adding new. It is a
refactor-with-a-new-capability, not a rewrite.

## Bottom line — non-deferrable before Step 3

The additions are the right strategic move — PRD 124 should be a foundational
law, not a feature, and §0/§2 make that unmistakable. But they raise the stakes
enough that three items flip from "deferred" to **non-deferrable before Step 3
ships**, because a flawed seed contracts into every future surface:

1. **Scope identity to repeaters.** Token-identity via existing `arrayItemIdentity`
   + saved stable ids for array items; scalar text stays path-keyed. Do not build
   identity-for-every-path.
2. **Close the Translation-Agent identity-keyed dependency**, or confirm current
   overlays already carry identity — otherwise §10 is a law the system cannot
   satisfy on day one.
3. **Decide cascade scope vs cascade executor.** Either narrow 124's *evidenced*
   dependencies to what it can *execute* (source / overlay / locale, per
   instance), or explicitly defer schema / widget / Dieter / materializer-version
   cascade (with mass-404-on-cutover as the accepted interim). Do not leave
   system-wide fan-out implied-but-unowned.

Plus two cheap fixes: collapse the redundant evidence fingerprints to real
versioned inputs; name the entry-HTML CDN purge owner (the materializer must not
purge per §11, so Roma).

None of these change the destination — they are what makes the seed contract
safe to inherit.
