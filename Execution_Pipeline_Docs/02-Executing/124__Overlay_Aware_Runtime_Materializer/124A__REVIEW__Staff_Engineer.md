# 124A — Staff Engineer Review (Schema-Token Contract Lock)

Status: REVIEW
Reviewer: Staff engineer (independent peer review)
Date: 2026-06-25
Subject: `124A__PRD__Schema_Token_Contract_Lock.md` and the orchestrator peer
review `124A__PR.md`
Parent: `124__MAMA__Overlay_Aware_Runtime_Materializer_Program.md`

Every code claim below was verified against the working tree by grep or Read.
Where I cite a file:line, I opened the file.

## Headline

**124A the PRD is GREEN.** It is a correctly-scoped, doc-only contract lock
that honors the no-reinterpretation tenet, forbids the right machinery (Schema
service, token registry, identity DB, readiness ledger, compatibility reader),
and points 124B–124H at existing artifacts. It is the boring-correct shape for
the highest-risk slice.

**The orchestrator PR (`124A__PR.md`) is RED and must be re-issued before the
three-role gate.** It is internally sound in structure, but its evidence watch
(Slice 4) and its purge watch (Slice 5) are written as open questions where the
code already answers them; and it omits the most important reconciliation 124A
must make — the *existing* `publicPackageFingerprint` evidence mechanism that
`clk-live-routes.ts` already enforces at serve time. A reader who took the PR's
watch-items as the closeout checklist would green-light 124A without forcing it
to reconcile against the real serve-time gate, which is the one forward
defect this slice exists to prevent.

The PR's verdict (GREEN) is therefore the wrong verdict for the PR *as written*,
even though its verdict for the PRD is defensible. I split them below.

## What I verified in code (independent of both docs)

| Claim in 124A / PR | Verified in code |
| --- | --- |
| `SavedTextField.identityKey` / `fieldPattern` / `path` exist; `identityKeyForField()` builds `widgetType\|role\|path[\|identity=...]` | `packages/ck-contracts/src/translated-value-primitives.ts:21-29, 176-205` |
| `RepeatContext`, `ParsedPathStep`, `arrayItemIdentity` parsing exist and are exercised | `translated-value-primitives.ts:93-101, 186-205, 295-313` |
| Overlay storage is path-keyed (`values[path]`), concrete positional paths, single `values` body | `tokyo-worker/src/domains/account-translations/{values,overlays}.ts`; `overlays.ts:42-53` (`value_missing:${path}`, `value_unexpected:${path}`) |
| Translation Agent emits `item.path` keys, not identity keys | `agents/translation-agent/src/worker.ts:189,254-255`; `agents/translation-agent/src/index.ts:262,350` |
| Bob preview resolver (`previewL10n.js`) is concrete-path, numeric-index based, separate code path from the TS resolver | `tokyo/product/widgets/shared/previewL10n.js:36-68, 89` |
| **Serve-time fingerprint gate already exists** | `tokyo-worker/src/routes/clk-live-routes.ts:118-131` (`verifyInstancePublicPackageReady`, `publicPackageObjectMatchesExpectedFingerprint`) |
| **Package fingerprint + object-metadata evidence already exists** | `tokyo-worker/src/domains/account-instances/package-files.ts:52, 103, 106-118, 157, 168, 204-225` (SHA-256, `PUBLIC_PACKAGE_FINGERPRINT_METADATA_KEY`, build/verify) |
| **Cloudflare purge operation already exists** | `tokyo-worker/src/domains/account-instances/operations.ts:77-116, 366, 391` (`purgeClkLiveEntryCache`), also `pages/package-files.ts:4` |
| `faq.sections[].id` identity declaration exists; `spec.json` carries `idKey:"id"` | `tokyo/product/widgets/faq/editable-fields.json:29-59`; `tokyo/product/widgets/faq/spec.json:10` |
| Roma package builder emits `locales={baseLocale:state}` only (no overlay locale in runtime payload) | `roma/lib/account-instance-public-package.ts:295-318` |

The four rows I bolded are the gap. Both 124A and the PR discuss evidence, purge,
and serve-time behavior as if they are greenfield contracts to define. They are
not. A package fingerprint, an object-metadata evidence field, a serve-time
fingerprint match that 404s on mismatch, and a Cloudflare purge operation
already exist and are load-bearing in production. 124A's Slice 4 and Slice 5
must **reconcile against and extend** them, not define them from scratch.

## Rubric

### 1) Elegant engineering and scalability

The contract is elegant and scales the right way:

- **One identity law, many surfaces.** Scalar identity = path (no indirection);
  repeated identity = path + `arrayItemIdentity` + saved ids. Identity work is
  scoped *only* to repeaters — scalars pay zero tax. This is the minimal rule
  that makes overlays reorder-safe for repeated structures without inventing an
  identity layer for the 80% case that doesn't need it.
- **Sparse overlays.** The `{ "values": { path: text } }` body is preserved
  (`overlays.ts:24-36` enforces exactly this shape), so an overlay is a pure
  value delta, not a copied document. This is the matrioska-by-reference law,
  honored.
- **Pure resolver.** 124A re-locks the MAMA promise that the materializer
  fetches nothing, mutates nothing, purges nothing, records no status
  (`124A__PRD__Schema_Token_Contract_Lock.md:74-84`). `resolveTranslatedValues`
  in `translated-value-primitives.ts:524-534` is already this pure function;
  124B is an extraction/widening, not a reinvention.

No elegance objection.

### 2) Compliance to architecture and tenets

Mapping to AGENTS.md gates and `Tenets.md`:

| Gate / tenet | 124A position | Verdict |
| --- | --- | --- |
| Plan Gate (written checklist for shared contracts) | Slices 1–8 are exactly this | PASS |
| Authority Gate (name active authority before decisions) | Authority table at PRD lines 52–62 names Roma/Berlin/Tokyo/Translation Agent | PASS |
| Tenet 2 (named authorities own boundaries) | Preserved — each system keeps its current role | PASS |
| Tenet 3 / V1 / V3 (no silent substitution/omission, no fallback) | Slice 6 locks fallback=`no` for requested locale; deferred repeated fields must be *non-claimed*, not silently omitted (PRD lines 416-418) | PASS — this is the strongest part |
| Tenet 9 (overlays are exact files) | Preserved — Slice 4 excludes evidence from overlay bodies (PRD line 305) | PASS |
| Tenet 11 (public runtime serves stored artifacts) | Preserved — Slice 5 locks stored evidenced bytes, no visitor-time composition | PASS |
| No-reinterpretation tenet | Stated verbatim at PRD line 34; honored — 124A forbids Schema service/registry/identity DB/readiness ledger/compatibility reader (PRD line 47) | PASS |
| MAMA CDN/cost law | Slice 5 preserves stored-byte serving, no visitor-time materialization | PASS |
| Materializer-is-pure | Re-asserted | PASS |

No tenet violation in the PRD. The PRD is compliant.

### 3) Overarchitecture / unnecessary complexity

No overarchitecture in the PRD. The single point to police is identity
representation (Slice 2 step 5: "choose exactly one canonical identity
representation"). The PRD offers the bracket-id example
(`faq.sections[pricing].faqs[refunds].question`) which, if locked as canonical,
would *supersede* the existing `identityKey` (`widgetType|role|path|...`) form.
That supersession is the one move that would drag in exactly the
compatibility-reader machinery 124A forbids. The PRD's own step 5
("Reconcile … whether the canonical representation reuses or supersedes current
`identityKey`") correctly flags this as a decision to close — it does not
presuppose the bracket form. So the PRD is clean; the risk lives in the
*decision 124A must make*, not in the PRD text.

### 3b) Academic abstractions / pre-work / gold-plating

Two items to police, both in Slice 4 (evidence):

1. **The evidence list names 8 fingerprint kinds** (PRD lines 269-277). The
   MAMA evidence law says "do not invent separate fingerprints for concepts
   that do not move separately in the current system." In the *current* system
   there is exactly **one** fingerprint that moves and is checked at serve time:
   the package fingerprint (`buildInstancePublicPackageFingerprint`, SHA-256
   over index+styles+runtime, stored as object `customMetadata`). The proposed
   `schema/widget contract fingerprint`, `source fingerprint`, `overlay
   fingerprint`, `support-file fingerprints`, and `materializer contract
   version` are *additional* fingerprints. Some are defensible (overlay
   fingerprint for a non-base locale *does* move independently once 124D lands),
   but the PRD lists them as a flat set without saying which are
   serve-time-checked vs. build-time-recorded vs. echo-only. That ambiguity is
   the gap — not gold-plating per se, but an unsplit list that invites a later
   implementer to compute and check all of them.

2. **No fingerprint method is locked.** Slice 4 step 6 says "define the exact
   fingerprint method" as a to-do. But a method already exists and is
   load-bearing: SHA-256 over a newline-joined payload
   (`package-files.ts:96-104`). If 124A locks a different canonicalization for
   the *new* evidence fields without saying it reuses the existing
   SHA-256/payload scheme, 124B will grow a second fingerprint implementation
   alongside the existing one. That is a V1/V6 vector (spurious cascade or
   false stability) and it is the PR's strongest watch-item — but the PR frames
   it as "must lock that fingerprint computation lives in one shared module,"
   which is right in principle yet silent about the fact that *one already
   exists in `package-files.ts` and another exists in
   `translated-value-primitives.ts:457-465`* (`widgetEditableFieldsContractHash`,
   FNV-1a). The current system therefore already has **two** hash
   implementations for two different concerns; 124A must not accidentally create
   a third.

### 4) Simple, boring, on-target

For the most part, yes. The PRD starts from current truth (Slice 1 inventory),
reconciles against existing substrate (Slice 2 names `identityKey`/`fieldPattern`
by type), and refuses to claim capability the overlay shape can't support
(Slice 3). That is the boring-correct posture.

The one place it stops being boring is Slice 4 + Slice 5, where it talks about
evidence, fingerprint method, and purge as contracts *to define* rather than
*existing mechanisms to reconcile against*. That drift is mild in the PRD (it's
still framed as "define from current real files" in step 1), but it is
amplified by the PR, which treats "does the purge path exist?" and "fingerprint
in one shared module" as open watch-items when both are answerable today by
opening `operations.ts` and `package-files.ts`.

### 5) Docs to update (DEV perspective)

124A is doc-only and its own rule is "update canonical docs only if a lock
changes current-system truth" (PRD line 495). Conditional candidates the PRD and
PR already enumerate are correct. I add one the PR missed:

- **`documentation/architecture/OverlayArchitecture.md`** currently states
  (line 64) "Runtime overlay files use concrete paths such as
  `sections.0.faqs.0.question`" and (line 15) "Public `clk.live` currently
  serves published package bytes … It does not read locale overlay files." If
  Slice 3 locks `scalar_only_initially` or `requires_full_overlay_key_chain_change`,
  *both* of these current-truth sentences change. The PRD's
  "Required Documentation Updates" list names this file but the PR's doc-watch
  section does not call out these specific load-bearing sentences. 124A must
  treat them as the test of whether a doc update is triggered.

No new doc-creation needed. The condition is: if Slice 3's decision contradicts
either of those two sentences, OverlayArchitecture.md is stale on the day 124A
closes and must be fixed in the same commit (AGENTS.md "Documentation
Discipline": confirmed mismatch is fixed with the behavior change that exposed
it — here, the contract change that exposes it).

## Slice-by-slice (delta on the PR)

I agree with the PR's per-slice ratings except where noted.

- **Slice 1** — agree, boring-correct.
- **Slice 2** — agree. The PR's two watch-items (reuse vs supersede
  `identityKey`; saved-id presence fail-closed) are the right two decisions. I
  add: the existing `extractSavedTextFieldsForEditableFields`
  (`translated-value-primitives.ts:325-351`) *already* throws
  `saved_text_field_identity_duplicate` on duplicate id and
  `saved_text_field_identity_missing` on missing identity declaration. Slice 2's
  failure table (step 6) should reuse these reason keys, not invent new ones.
- **Slice 3** — agree this is the crux. The PR correctly says the decision must
  be evidence-backed from runtime output, not doc prose. I verified the runtime
  output: Translation Agent keys overlays by `item.path` (concrete positional
  paths, `worker.ts:254`), and Tokyo validates overlay keys against
  `savedContentOverlayFields(content)` which returns `{ path }` per field
  (`values.ts:52-54`). The path *is* positional concrete
  (`sections.0.faqs.0.question`). So the evidence the PR asks for already
  exists in this review: **current overlay keys are positional-concrete, not
  identity-keyed.** Slice 3's honest answer is therefore either
  `scalar_only_initially` (repeated-field locale reorder-unsafe, claimed as an
  explicit limitation) or `requires_full_overlay_key_chain_change` (124D must
  change Translation Agent output, Roma routes, Tokyo validation, Bob preview,
  and both docs). `compatible` is not available for repeated fields. 124A must
  say which of the two it is; it cannot land as a menu.
- **Slice 4** — **PR is insufficient here.** The PR's watch-item ("single-source
  fingerprint computation") is correct in principle but misses that a
  serve-time fingerprint gate *already exists* and is *already* the evidence
  authority for the base package. Slice 4 must:
  1. Name `buildInstancePublicPackageFingerprint` / `PUBLIC_PACKAGE_FINGERPRINT_METADATA_KEY` / `verifyInstancePublicPackageReady` as the existing evidence mechanism it extends.
  2. Split the 8-field evidence list into (a) serve-time-checked (package FP today; + overlay FP for non-base locale under 124D) vs (b) build-time-recorded-only (schema/source/support/materializer-version FPs) vs (c) response-echo-only. The PRD's flat list does not split these and the PR does not force the split.
  3. Lock the fingerprint method by pointing at the existing SHA-256/payload scheme (`package-files.ts:96-104`) and stating whether new evidence fields reuse it or introduce a new canonicalization — and if new, why a second implementation is unavoidable (it probably isn't).
  4. Reconcile the existing second hash (`widgetEditableFieldsContractHash`, FNV-1a, `translated-value-primitives.ts:457-465`) — is that the "schema/widget contract fingerprint" or is it dead weight 124A should retire? The PRD and PR don't mention it.

  This is the single most important correction. The whole point of a
  contract-lock slice is to force this reconciliation *before* 124B implements a
  parallel evidence scheme.
- **Slice 5** — **PR is wrong to leave purge as an open question.** The PR's
  watch-item asks "does the purge operation path exist today?" It does:
  `purgeClkLiveEntryCache` (`operations.ts:77-116`) hits the Cloudflare
  `/zones/{id}/purge_cache` endpoint and is called on instance
  publish/unpublish (`operations.ts:366, 391`). Slice 5 step 8 must lock this
  as the existing entry-refresh path, name its preflight requirement
  (`PUBLIC_CACHE_PURGE_*` env config, gated by
  `tokyo.errors.publicCache.purgeConfigMissing`), and state that the materializer
  does not call it (Roma owns it, as MAMA says). The PR's framing ("or no purge
  authority exists yet and entry freshness relies on short TTL") is factually
  wrong for the current system and would lead 124B/124E to design a stale-TTL
  fallback that already isn't needed.
- **Slice 6** — agree, strongest slice. The "explicitly non-claimed, not
  silently omitted" rule for deferred repeated fields is exactly the V3 guard.
- **Slice 7** — agree the likely outcome is conformance-only (Bob preview is
  browser JS, `previewL10n.js`, separate code path; materializer will be server
  TS). The PR's "conformance suite must be a CI gate" watch is correct and is
  the load-bearing addition. I add: the parity suite must cover the
  *positional→identity* mapping failure modes specifically (reorder within a
  repeated section is the case where the two resolvers will diverge silently if
  Slice 3 chose `requires_full_overlay_key_chain_change` but only one side got
  the change).
- **Slice 8** — agree. The "no unresolved placeholder unless assigned to a named
  sub-PRD with explicit limitation" rule is the right closeout bar.

## Vectors and blast radius (contract-lock specific)

| Vector (if 124A locks it wrong) | Failure mode | Blast radius | Caught by 124A today? |
| --- | --- | --- | --- |
| Slice 4 evidence not reconciled to existing `publicPackageFingerprint` serve gate | 124B adds a parallel evidence scheme; serve-time checks ignore build-time evidence or vice versa; spurious 404 or stale serve | every served artifact, public-facing | **NO — neither 124A nor the PR names the existing gate** |
| Slice 5 purge left as "short-TTL-only maybe" | 124E builds a stale-TTL fallback for a purge path that already works; locale entry stale until TTL | per-coordinate, silent | **NO — PR frames existence as open** |
| Slice 2 supersede `identityKey` with bracket form | dual-read/migration; the compatibility-reader machinery 124A forbids | all of 124B–124D, every repeated-field locale | YES (PRD step 5 forces the decision; PR watch 1) |
| Slice 3 `compatible` claimed without evidence | repeated-field locale cascade serves wrong item after reorder | every localized repeated-field widget | YES (PR watch; this review supplies the missing evidence: positional) |
| Slice 4 second hash impl (next to SHA-256 + FNV-1a) | false cascade or false stability | every served artifact | PARTIAL (PR watch, but silent on existing 2 hashes) |
| Slice 7 parity suite not CI-gated | preview ≠ publish divergence | per-instance, silent | YES (PR watch) |
| Slice 2 invents new reason keys next to `saved_text_field_identity_*` | two vocabularies for the same failures | 124B–124D error handling | NO — not mentioned by PRD or PR |

## Verdict

- **124A (the PRD): GREEN.** Compliant, correctly scoped, honors the
  no-reinterpretation tenet, points downstream at real artifacts. The gaps
  above are decisions 124A *must close* in Slice 4 and Slice 5 before Slice 8
  closeout — they are within 124A's own scope and do not change the plan.

- **`124A__PR.md` (the orchestrator peer review): RED — re-issue required.**
  Its Slice 4 and Slice 5 watch-items are written as open questions the code
  already answers, and it omits the existing `publicPackageFingerprint`
  serve-time gate that is the single most important thing 124A's evidence
  contract must reconcile against. A reader executing the PR's checklist would
  green-light 124A without forcing the reconciliation that prevents the
  program-wide forward defect this slice exists to prevent. The PR's
  per-slice structure, V1/V3 mapping, and blast-radius table are sound; its
  defects are (a) the purge "open question," (b) the silent-on-existing-gate
  evidence watch, and (c) silence on the existing two hash implementations.

## Blockers before the PR can be GREEN (and before 124A Slice 8 closeout)

1. **Slice 4 must name the existing evidence mechanism.** Cite
   `tokyo-worker/src/domains/account-instances/package-files.ts:52,96-104,106-118,157,168,204-225`
   (`PUBLIC_PACKAGE_FINGERPRINT_METADATA_KEY`, SHA-256 package fingerprint,
   `verifyInstancePublicPackageReady`) and state which of the 8 proposed
   evidence fields extend it vs. are new. Split the list into
   serve-time-checked / build-time-recorded / echo-only.
2. **Slice 5 must close the purge question as "exists."** Cite
   `tokyo-worker/src/domains/account-instances/operations.ts:77-116,366,391`
   (`purgeClkLiveEntryCache`) and lock it as the entry-refresh owner/path with
   its preflight requirement. Strike the "no purge authority exists yet"
   branch.
3. **Slice 4 must reconcile the existing two hash implementations.** State
   whether `widgetEditableFieldsContractHash` (FNV-1a,
   `translated-value-primitives.ts:457-465`) is the "schema/widget contract
   fingerprint" or retired, and whether new evidence fields reuse the SHA-256
   payload scheme (`package-files.ts:96-104`) or need a new canonicalization
   with a stated reason.
4. **Slice 2 failure table must reuse existing reason keys**
   (`saved_text_field_identity_missing`,
   `saved_text_field_identity_duplicate`,
   `saved_text_field_identity_path_invalid`,
   `saved_text_field_identity_scope_invalid`) instead of inventing a parallel
   vocabulary.
5. **Slice 3 decision must be one of `scalar_only_initially` or
   `requires_full_overlay_key_chain_change`,** with the evidence this review
   supplies (Translation Agent keys by `item.path` = concrete positional;
   Tokyo validates against concrete `field.path`). `compatible` is not
   available for repeated fields and must not remain on the menu.
