# 124A — Staff-Engineer Re-Review (Round 2)

Status: REVIEW (Round 2 — gating Rev 2 of `124A__PR.md`)
Reviewer: Staff-engineer role
Date: 2026-06-25
Subject: `124A__PR.md` (Revision 2) — orchestrator peer review of `124A__PRD__Schema_Token_Contract_Lock.md`
Parent: `124__MAMA__Overlay_Aware_Runtime_Materializer_Program.md`

> Round 1 gave the PR a RED with five blockers while affirming the 124A PRD
> itself GREEN. Round 2 confirms whether Rev 2 resolves each blocker. Every
> claim below was verified against the working tree, not the PR's prose.

## Final verdict: GREEN

Rev 2 closes all five Round-1 blockers with verified-grounded binding closeout
conditions. The PR no longer frames answered-by-the-tree questions as open
menus; it decides them and points at the exact code that decides them. Two
minor accuracy notes are recorded below (non-blocking — they sharpen claims the
PR already makes honestly; they do not contradict it).

## Per-blocker resolution table

| # | Round-1 blocker | Resolved? | Evidence (verified in tree) |
| --- | --- | --- | --- |
| 1 | Slice 4: extend the existing `publicPackageFingerprint` serve-time gate; split the 8-field evidence into serve-checked / build-recorded / echo-only | **Yes** | Serve-gate is real and live: `verifyInstancePublicPackageReady` (`package-files.ts:204`) + `publicPackageObjectMatchesExpectedFingerprint` (`:111-118`) → 404 at `clk-live-routes.ts:118-131`. SHA-256 build at `package-files.ts:93-104` (`crypto.subtle.digest('SHA-256')`), written to R2 `customMetadata.publicPackageFingerprint` at `:157`. PR Slice 4 condition 1 names this mechanism and says "extend, not parallel"; condition 2 splits the 8 PRD fields into the three tiers (serve-checked = generated package fingerprint; build-recorded = source/overlay/schema/materializer-version/support-file fingerprints; echo-only = response payload). Condition 4 locks JSON canonicalization. Match is exact. |
| 2 | Slice 5: close the purge paths honestly (not leave it as a menu) | **Yes** | `purgeClkLiveEntryCache` exists (`operations.ts:77-119`) and is wired into saves (`:366,:391`), BUT fails closed (`503 tokyo.errors.publicCache.purgeConfigMissing`) because `CLOUDFLARE_ZONE_ID` / `CLOUDFLARE_API_TOKEN` are **not bound** in `tokyo-worker/wrangler.toml [vars]` (only `PUBLIC_SERVING_BASE_URL` is). No `cf:purge` in `package.json`. PR Slice 5 condition 2 locks "short-TTL entry freshness as the serving interim" and names "bind purge config + add a repo purge operation" as a documented gap for 124E/124F, with explicit instruction not to assert purge as a current capability. The PRD's two-branch menu (PRD Slice 5 step 8) is collapsed to one honest decision. |
| 3 | Slice 4: reconcile the two existing hashes (SHA-256 package fingerprint vs FNV-1a identity hash) | **Yes** | SHA-256 (`package-files.ts:103`) and FNV-1a (`translated-value-primitives.ts:457-465`, constants `0x811c9dc5` / `0x01000193`) are genuinely distinct: distinct algorithms, distinct modules, distinct purposes. PR Slice 4 condition 3 states SHA-256 backs package/artifact fingerprints (the serve-gate uses it), FNV-1a backs internal identity keys, they are not interchangeable, and each must be owned by one shared module. Reconciliation is honest. **Accuracy note (non-blocking):** the FNV-1a function `widgetEditableFieldsContractHash` hashes the *widget editable-fields contract*, and a tree-wide grep shows it is **defined but never called** — no consumer in `ck-contracts`, `tokyo-worker`, or `roma`. So "used for identity keys" overstates slightly; it is *intended* for contract fingerprinting but dormant today. The PR's reconciliation still holds (the two hashes must not be conflated regardless of whether FNV is currently invoked), but 124B should decide whether to wire this existing function as the schema/widget contract fingerprint (Slice 4 condition 2) or supersede it. |
| 4 | Slice 2: reuse existing `saved_text_field_identity_*` reason keys, not invent | **Yes** | Reason keys are real and exactly as cited: `saved_text_field_identity_invalid` (`:173`), `saved_text_field_identity_missing` (`:188`), `saved_text_field_identity_path_invalid` (`:193`), `saved_text_field_identity_scope_invalid` (`:199`), `saved_text_field_identity_duplicate` (`:346`). PR Slice 2 condition 1 and Slice 6 both instruct reusing these keys. Match is exact. |
| 5 | Slice 3: drop `compatible` from the menu (Translation Agent keys by positional `item.path`) | **Yes** | End-to-end positional keying verified: Translation Agent emits `item.path` (`agents/translation-agent/src/index.ts:116,124,344-350`); overlay validation `assertLocaleOverlayValuesMatchSavedTextFields` keys exclusively by `field.path` (`tokyo-worker/src/domains/account-translations/overlays.ts:42` — `args.fields.map((field) => field.path)`); overlay values are stored/read keyed by positional path (`values.ts:91-92`). The `identityKey` is computed and propagated through the save chain but is **not consulted** on the overlay read/write/validate path. PR Slice 3 collapses the PRD's three-option menu to a binary decision (`scalar_only_initially` vs `requires_full_overlay_key_chain_change`) and explicitly removes `compatible`. `compatible` appears nowhere in live code, so this is collapsing a PRD menu, not fighting existing behavior — correct. |

## Additional verified findings (support the PR's new claims)

- **Slice 2 reorder hazard is real and present-day.** Because overlays key
  positionally (`overlays.ts:42`), a builder who reorders a repeated field
  after overlays are generated gets the wrong translation under the wrong item
  with **no failure** — the positional paths still match the schema, validation
  passes, the wrong value renders. This is a live V1 (silent substitution) on
  exactly the surface 124A's identity contract exists to close. PR Slice 2
  condition 3 names this hazard correctly.
- **Slice 2 condition 2 ("identityKey reuse is real migration work") is
  accurate.** `identityKey` is wired through Roma
  (`account-instance-translations.ts:160,176`,
  `account-instance-source-artifacts.ts:134`) and tokyo-worker source/normalize,
  but the overlay validation surface (`overlays.ts:38-53`) and the overlay value
  map both key by `path` and ignore `identityKey`. So "reuse identityKey" means
  124D must change the producer/consumer chain (Translation Agent output, Roma
  translation routes, Tokyo overlay validation, Bob preview) to emit and accept
  identity keys — it is not drop-in. The PR states this explicitly, which is
  exactly the warning that prevents 124B/124D from reaching for a compatibility
  reader when reuse turns out to require real wiring.
- **Slice 7 two-implementation divergence is real.** `previewL10n.js` silently
  `return`s on every type/shape mismatch (bare `return;` at lines 37, 38, 40,
  42, 49, 53, 57, 60, 61, 63, 65 — no throw), while the server path
  (`translated-value-primitives.ts:173,188,193,199,209,346`) throws. Two
  implementations, opposite failure modes. PR Slice 7's CI-gate requirement is
  the correct and minimal response given the browser/server split makes a shared
  resolver unlikely.

## Rubric

### 1) Elegant engineering & scalability
The PR's strength is that it adds **zero new machinery**. Every binding closeout
condition extends something already in the tree: the serve-gate, the SHA-256
fingerprint, the FNV-1a hash, the identity reason keys, the purge code path.
This is the cheapest possible correct design — the cost is documentation and
contract locking, not new modules. Scalability is preserved because no new
runtime surface is introduced; the materializer stays a pure resolver and
Tokyo-worker stays a stored-byte authority. No concerns.

### 2) Compliance to architecture / tenets
- **Schema-first matrioska:** identity locks over existing `editable-fields.json`
  + `arrayItemIdentity` + saved ids. No copied documents. Compliant.
- **Materializer purity:** re-affirmed (Slice 5: "materializer must not purge";
  "Tokyo serves stored evidenced bytes only"). Compliant.
- **Fail-closed (V1/V3/V5):** Slice 6 holds `Fallback = no` for requested
  locale; Slice 3 makes deferred repeated fields *explicitly non-claimed* (not
  silently omitted — the V3 guard). The serve-gate already fails closed (404).
  Compliant.
- **No-reinterpretation tenet:** stated verbatim in the PR header and honored —
  the PR rebinds 124A to existing artifacts rather than re-deriving an ideal
  system. Compliant.
- **CDN/cost law:** stored evidenced bytes, short-TTL entry, immutable
  fingerprinted support files, no visitor-time composition. Compliant.

### 3) Overarchitecture
None. The PR explicitly forbids the Schema service, token registry, identity DB,
readiness ledger, and compatibility reader. It scopes identity to repeaters
only (scalars = bare path). It collapses three open menus (Slice 3
compatibility, Slice 5 purge, Slice 5 locale URL) into decisions. This is the
opposite of overarchitecture — it is the PR pulling 124A *back* onto existing
rails.

### 3b) Academic abstractions / pre-work / gold-plating
None introduced by the PR. The one existing artifact that borders on dormant —
`widgetEditableFieldsContractHash` (defined, never called) — is pre-existing,
not added by this PR, and the PR's reconciliation condition correctly treats it
as "decide whether to wire or supersede in 124B" rather than building beside it.
No gold-plating.

### 4) Simple / boring / on-target
The PR is at the right altitude for a contract-lock review: it cites line
numbers, names the exact mechanism to extend, and converts open questions into
binding conditions within 124A's own scope (no plan change required). The
vector table is concrete and each row maps to a verified failure mode with a
stated blast radius. The two accuracy notes (FNV function dormant; identityKey
not consulted on overlay path) make the PR's claims *more* honest, not less —
the PR already says "identityKey is not wired to any user-facing overlay surface
today," which the code confirms.

### 5) Docs to update (dev perspective)
The PR's Documentation Updates section is correctly conditional and scoped. Two
items worth flagging for 124A execution (not blockers for this review):
- `documentation/services/tokyo-worker.md` should record the **current-truth
  correction** that purge is code-present but config-unbound (PR already lists
  this — confirmed it is not currently documented as a gap).
- If Slice 3 lands as `scalar_only_initially`,
  `documentation/capabilities/localization.md` must claim the limitation
  explicitly (PR lists this). The `widgetEditableFieldsContractHash` dormancy
  should be noted in whichever doc owns the contract-fingerprint contract so
  124B picks the right owner instead of building a parallel hash.

## Minor accuracy notes (non-blocking, for 124A execution)

1. **FNV-1a function is dormant.** `widgetEditableFieldsContractHash`
   (`translated-value-primitives.ts:457`) has no caller in the tree. The PR's
   "two-hash reconciliation" remains valid (the hashes must not be conflated
   regardless), but 124B should explicitly decide: wire this as the
   schema/widget contract fingerprint, or supersede it. Leaving it
   defined-but-uncalled while adding a parallel contract fingerprint would
   create exactly the dual-implementation drift the PR warns against.
2. **Line citation `package-files.ts:52`** is the metadata-key *constant name*,
   not the fingerprint logic; the fingerprint authority is `:103` (build) and
   `:157` (write). Harmless — the constant is part of the mechanism — but the
   precise authority lines are `:93-104` and `:157`.

Neither note changes the verdict. Both sharpen claims the PR already makes
honestly.

## Recommendation

Forward to the three-role gate. All five Round-1 blockers are resolved with
verified evidence. The PR's binding closeout conditions are within 124A's own
scope and require no plan change.
