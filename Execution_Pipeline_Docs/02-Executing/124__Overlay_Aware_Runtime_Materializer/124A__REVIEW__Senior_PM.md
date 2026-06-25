# 124A — Senior Product Manager Review

Status: REVIEW (Round 2)
Reviewer: Senior Product Manager (independent peer review)
Date: 2026-06-25
Subject: `124A__PRD__Schema_Token_Contract_Lock.md` and the orchestrator peer review `124A__PR.md` (Revision 2)
Parent: `124__MAMA__Overlay_Aware_Runtime_Materializer_Program.md`

> Round 2 re-reviews Revision 2 of `124A__PR.md` against the three
> product-side conditions I set in Round 1. I re-verified every code claim in
> the PR directly against the tree; the verification table is below. All three
> conditions are resolved. Verdict: **GREEN**.

## What I re-verified in code (not docs) for Round 2

| PR claim (Rev 2) | File / line | Verified result |
| --- | --- | --- |
| `parseClkLivePath` handles account/instance only; no locale route | `tokyo-worker/src/routes/clk-live-routes.ts:24-61` | **Confirmed.** Parser returns `instance` (account/instance/file) or `page` (account/pages/pageId/file). No locale segment, no `?locale=` read. Serve path `:103-131` never consults a locale. |
| Serve-time fingerprint gate already runs (SHA-256, 404 on mismatch) | `clk-live-routes.ts:118-131`; `tokyo-worker/src/domains/account-instances/package-files.ts:52,103` | **Confirmed.** `verifyInstancePublicPackageReady` + `publicPackageObjectMatchesExpectedFingerprint` → 404. Fingerprint is `sha256:${hex…}` at `package-files.ts:103`. |
| `identityKeyForField()` exists; internal, not wired to user-facing surfaces | `packages/ck-contracts/src/translated-value-primitives.ts:176-205` | **Confirmed.** Builds `widgetType\|role\|path\|idPath=value`. Used internally; Translation Agent emits positional `item.path` (`agents/translation-agent/src/index.ts:116,251`), overlay store keys by path (`tokyo-worker/src/domains/account-translations/values.ts:91-92`). |
| Overlay keying is positional end-to-end | `agents/translation-agent/src/index.ts:116`; `values.ts:91-92`; `tokyo/product/widgets/shared/previewL10n.js:39-65` | **Confirmed.** Producer emits `item.path`; store does `values[path]`; preview parses `path.split('.')` with numeric segments as array indices. No identity-key addressing anywhere in the chain. |
| Two distinct hashes; do not conflate | `package-files.ts:103` (SHA-256); `translated-value-primitives.ts:457-465` (FNV-1a `0x811c9dc5`/`0x01000193`) | **Confirmed.** FNV-1a backs `widgetEditableFieldsContractHash`; SHA-256 backs the serve gate. Different algorithms, different owners. |
| Purge code exists; config not bound; not operational | `tokyo-worker/src/domains/account-instances/operations.ts:77-116,366,391`; `tokyo-worker/wrangler.toml` | **Confirmed.** `purgeClkLiveEntryCache` is wired into saves; `CLOUDFLARE_ZONE_ID`/`CLOUDFLARE_API_TOKEN` are absent from `wrangler.toml`; 503 `tokyo.errors.publicCache.purgeConfigMissing` is the fail-closed path. |
| Two divergent resolvers (preview silent-returns; server throws) | `previewL10n.js:37-65` vs `translated-value-primitives.ts` | **Confirmed.** Preview does `if (typeof value !== 'string') return;` / `if (!Array.isArray(cur)) return;` — silent. Server path throws on type mismatch. |

The PR's evidence is real, not doc prose. This is the bar I set in Round 1 and Rev 2 meets it.

## Round-1 conditions: resolution

### Condition 1 — Slice 5 locale URL shape must be PICKED, not deferred (RESOLVED)

Round 1 said: the PRD's "choose using current public serving authority" is hollow because `clk-live-routes.ts` has no locale route. Rev 2's PR makes this a **binding closeout condition** (Slice 5, condition 1):

> "Pick the locale URL shape in 124A — do not defer. Verified: `parseClkLivePath` handles account/instance only; there is no locale route in `clk-live-routes.ts` today. So 'use the current public serving authority' defers to an authority that does not exist for locales. 124A must choose path-segment vs query vs prefix explicitly (Step 0 owns the exact string)."

This matches my condition exactly, including the verified absence of a locale route. The vectors table now lists "Locale URL deferred (Slice 5) → 124E invents a route shape ad hoc → contract drift, CDN mis-config" with blast radius "public locale surface." The PR also flags that `RuntimeProfiles.md` update is not conditional ("it is new — no locale route exists today").

**One residual note (non-blocking).** The PR's binding condition says "Step 0 owns the exact string" and lists the three options, but does not itself recommend one. That is acceptable for a contract lock — the decision is forced into 124A's scope rather than deferred — but the PM-level concern from Round 1 stands: path-segment (`/{account}/{instance}/{locale}`) is the crawler/hreflang-friendlier shape and aligns with the Babel/GlobalReach moat; query-param keeps legacy `clk.live` links alive. 124A's Step 0 must name the legacy-link redirect consequence either way. The PR forces the decision; it does not pre-make it. That is the correct division of labor.

### Condition 2 — Slice 2 `identityKey` reuse must be stated as real 124D migration work (RESOLVED)

Round 1 said: "reuse the existing `identityKey`" implies zero-cost reuse, but overlay files, preview, and serving are positional today, so reuse is real migration. Rev 2's PR makes this a **binding closeout condition** (Slice 2, condition 2):

> "`identityKey` reuse is real migration work, not zero-cost. `identityKey` is an internal contract helper; it is **not** wired to any user-facing overlay surface today (Translation Agent emits positional `item.path`; Tokyo validates positional paths). So 'reuse identityKey' means 124D must change the producer/consumer chain to emit and accept identity keys. 124A must state this explicitly so 124B/124D do not assume a drop-in reuse and then reach for a compatibility reader when it isn't."

This is exactly the framing I required. The vectors table now includes the row "`identityKey` assumed drop-in (Slice 2) → 124D hits a non-wired surface → reaches for compatibility reader (forbidden) → Translation Agent + locale chain." That names the forbidden-reader hazard I was protecting against. The migration scope (producer/consumer chain) is stated in product terms, not as a contract tweak.

### Condition 3 — Name the live V1 product hazard: reorder of repeated field after overlays → silent wrong translation (RESOLVED)

Round 1 said: the positional-reorder wrong-translation bug is a present V1, not a future risk, and 124A must state it as the defect being fixed. Rev 2's PR makes this a **binding closeout condition** (Slice 2, condition 3):

> "Today, a builder who reorders a repeated field (e.g. an FAQ section) after overlays are generated silently gets the wrong translation under the wrong item in preview (and, once locale serving ships, in serve). That is a present-day V1 (silent substitution) on exactly the surface Babel protects. The identity contract exists to make that fail-closed instead of silent. Naming it keeps the contract honest about what it's for."

And Slice 8 adds: "V1–V8 audit must specifically re-check the live reorder→wrong-translation hazard (Slice 2) is fail-closed under the locked contract." The vectors table carries "compatible left on menu (Slice 3) → silent wrong-item translation (V1) → every localized repeated-field widget."

This names the hazard, names the surface (FAQ/repeated fields), names the blast radius, and ties the identity contract to closing it. The Round 1 reframing — from "nice seed contract" to "fix for an active wrong-content bug" — is now the PR's stated rationale.

## Rubric (Round 2)

### 1) Elegant product UX and scalability

**The product UX bar is correctly set and the URL decision is now forced into scope.** A visitor in `fr` hitting `clk.live` must get French bytes with no wrong-language fallback; preview must equal publish; a missing locale fails closed. 124A names all three. Condition 1 closes the URL-shape gap that was the largest UX deficit in Round 1.

**Scalability remains correct:** overlay-as-value-map scales linearly with active locales, never duplicates the widget, no visitor-time composition. The CDN/cost law (stored evidenced bytes, short-TTL entry, immutable support files) is preserved.

**One UX item the PR does not reach (non-blocking, correctly out of 124A scope):** if Slice 3 lands on `scalar_only_initially`, the builder-facing TranslationsPanel must show *which* fields are and aren't localized and why, or a builder who reorders an FAQ and sees French go wrong will file it as "translation broken." This is a 124D UX concern; the PR's failure table covers the serve-side "repeated-field overlay excluded" case but the panel visibility is downstream. I am not blocking on it because it is correctly 124D's surface, but 124D should pick it up.

### 2) Compliance to architecture and tenets

**Passes.** The no-reinterpretation tenet is stated verbatim in the PRD and the PR enforces "extend, do not rebuild" against verified existing machinery (`publicPackageFingerprint`, `identityKeyForField`, `saved_text_field_identity_*` reason keys, positional overlay keys). The substrate rule forbids Schema service / token registry / identity DB / status store / readiness ledger / compatibility reader — exactly the legacy-SaaS machinery the MAMA program and AGENTS doctrine forbid. Identity is scoped to repeaters; scalars stay path-keyed. Authority gate names Roma/Tokyo/Translation Agent before any decision.

**The two-hash reconciliation (Slice 4, condition 3) is the strongest new tenet guard.** Stating that SHA-256 owns package/artifact fingerprints and FNV-1a owns internal identity keys, that they are not interchangeable, and that each is owned by one shared module used by both build and serve — this closes a real conflation vector (false pass/fail at serve) that the Round 1 review did not surface. It is compliant product law.

### 3) Overarchitecture / unnecessary complexity

**No overarchitecture.** This is the discipline I most want to protect and it holds in Rev 2 as it did in Round 1. The Rev 2 correction — "extend existing mechanisms, do not describe them as greenfield" — is anti-overarchitecture applied to the PR's own framing. No readiness ledger, no status store, no probe ritual, no compatibility reader, no second fingerprint path. The three-tier evidence split (serve-checked / build-recorded / echo-only) classifies existing inputs rather than inventing new ones.

**No new complexity introduced by the binding conditions.** Each condition narrows a menu to a decision or restates an existing mechanism; none adds a subsystem.

### 4) Simple, boring, on-target from a product perspective

**Yes.** The boring-correct path — lock identity, evidence, URL, failure, parity — is what 124A does in the right order, and Rev 2's binding conditions remove the three places Round 1 found the PRD soft-pedaling or deferring. The reorder→wrong-translation V1 is now named as a present defect. The `identityKey`-reuse-as-migration framing is honest. The locale URL is forced, not deferred.

**The `scalar_only_initially` limitation is handled correctly as an explicitly-claimed limitation, not a silent omission** (Slice 6 failure table + V3 guard). This is the strongest part of the contract.

### 5) Docs to update (vision/architecture/system perspective)

The PR's documentation list is correct and now includes the two corrections Round 1 implied:

| Doc | Required update | PR condition |
| --- | --- | --- |
| `documentation/architecture/RuntimeProfiles.md` | Locale URL/cache shape is new current truth (no locale route exists today) | PR explicitly states "it is new — no locale route exists today" |
| `documentation/capabilities/localization.md` | Slice 3 = `scalar_only_initially` → repeated-field locale cascade limitation must be stated | PR lists this update |
| `documentation/services/tokyo-worker.md` | State purge is code-present but config-unbound (current-truth correction) | PR adds this — corrects an existing doc that would otherwise overclaim |
| `documentation/architecture/BabelProtocol.md` / `OverlayArchitecture.md` | If identity/overlay-key form changes (positional → identity) | PR lists conditional on the lock |
| `documentation/ai/agents/translation-agent.md` | If overlay-key output shape changes | PR lists conditional on the lock |

Strategy docs (`Clickeen-Babel.md`, `GlobalReach.md`) need no change unless 124A's locks contradict the source-plus-overlay thesis — they do not. The `GlobalReach.md` crawler/hreflang consequence of the chosen locale URL shape is a 124E/doc concern once Step 0 picks the string.

## Vectors and blast radius (product/UX, Round 2)

| Vector | Failure mode a user hits | Blast radius | Status after Rev 2 |
| --- | --- | --- | --- |
| Locale URL deferred to non-existent authority (Slice 5) | 124E invents the URL under pressure; shareable links, hreflang, legacy `clk.live` links inconsistent | Every localized public surface, every account, every locale, forward-permanent | **Closed** — decision forced into 124A Step 0 |
| `identityKey` treated as drop-in reuse (Slice 2) | 124D bridges positional↔identity with an ad-hoc compatibility shim (forbidden reader) or silently misapplies translations after reorder | Every repeated-field widget, every locale | **Closed** — stated as real migration work |
| Reorder of repeated field while overlays are positional (LIVE V1) | Visitor sees q1's French answer under q2's question; builder's preview shows the same wrong content | Per-instance × per-locale; silent; no panel surfaces it | **Closed as naming** — hazard named; identity contract is the fix; Slice 8 re-check mandated |
| `compatible` left on Slice 3 menu | Claim repeated-field locale cascade works → silent wrong-item translation (V1) | Every localized repeated-field widget | **Closed** — PR forces binary decision, drops `compatible` |
| Two-hash conflation (Slice 4) | FNV-1a identity hash mistaken for SHA-256 serve-gate fingerprint → false pass/fail at serve | Every served artifact | **Closed** — reconciliation mandated, one shared module per hash |
| Purge assumed operational (Slice 5) | Stale locale served; or 503s on save once config-bound code runs unconfigured | Per-coordinate / per-save | **Closed** — short-TTL interim locked; config gap documented |
| Parity suite not CI-gated (Slice 7) | Preview shows correct locale, published artifact shows base/wrong locale — silent divergence | Per-instance, silent, erodes "preview = publish" | **Closed** — CI-gating mandated |
| `scalar_only_initially` with no builder-facing visibility | Builder reorders FAQ, French goes wrong, no panel message, bug filed as "translation broken" | Every repeated-field widget in every localized account | **Open, non-blocking** — correctly 124D's surface; 124D should pick it up |

## V1–V8 product-lens audit (Round 2)

| ID | Audit question | 124A result after Rev 2 |
| --- | --- | --- |
| V1 | Does the lock let wrong content substitute for missing/stale truth? | The reorder-position-overlay V1 is now **named as a present defect** and the identity rule is its fix. Slice 8 re-checks it. Closed. |
| V2 | Does the lock normalize/repair invalid overlay state silently? | No — failure contract is fail-closed. |
| V3 | Does the lock silently drop repeated-field translations if deferred? | Guarded: "explicitly non-claimed, not silently omitted." Strongest part of the PRD. |
| V4 | Does enforcement fail open on a missing dependency? | No — fallback always `no` for requested locale; purge fails closed (503). |
| V5 | Does it treat corrupt overlay state as missing? | No — validation compares path sets and fails. |
| V6 | Does it claim full success after partial work? | Closeout gate forbids unassigned placeholder language. |
| V7 | Does the same failing workflow continue under a new wrapper? | N/A at contract stage. |
| V8 | Does normal product work depend on tests/probes? | Parity suite is a CI gate, not runtime truth — correct, and CI-gating is now mandated so it cannot drift into a readiness signal. |

## Assessment of the orchestrator peer review (`124A__PR.md`, Rev 2)

The Rev 2 review is technically sound, evidence-grounded, and closes all three of my Round 1 conditions. Specifically:

- **It verified before it asserted.** Every mechanism in the "Existing machinery" table was checked against code, and I re-checked each claim independently. The claims hold.
- **It forced decisions where Round 1 found deferrals.** Slice 3's `compatible` is dropped; Slice 5's locale URL is forced into Step 0; Slice 2's `identityKey` reuse is named as migration.
- **It surfaced a vector Round 1 missed.** The two-hash conflation (SHA-256 vs FNV-1a) and the "one shared module per hash" rule is a stronger tenet guard than my Round 1 review provided.
- **It was honest about what is not operational.** The purge-config gap (code present, config unbound, 503 fail-closed) is now stated as a documented limitation rather than assumed capability, and the `tokyo-worker.md` doc update corrects the current-truth record.

The PR does not pre-recommend a locale URL shape (it forces the decision into Step 0 without picking). That is the correct division of labor for a contract lock and is not a deficiency.

## Verdict

**GREEN.**

All three Round 1 conditions are resolved by binding closeout conditions grounded in verified code. The PR forces the three decisions Round 1 found deferred or soft-pedaled (locale URL shape, `identityKey`-as-migration, reorder V1 naming), drops the unrealistic `compatible` option from Slice 3, reconciles the two hashes, mandates CI-gating for the parity suite, and corrects the purge-is-operational assumption. No overarchitecture, no compatibility reader, no reinterpretation of PRD intent. One non-blocking item remains and is correctly out of 124A scope: the builder-facing TranslationsPanel visibility for a `scalar_only_initially` limitation belongs to 124D. Forward to the three-role gate.
