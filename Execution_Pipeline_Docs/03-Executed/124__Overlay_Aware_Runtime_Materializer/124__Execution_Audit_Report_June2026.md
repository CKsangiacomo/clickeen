# PRD 124 — Execution Audit Report

**Date:** June 25, 2026
**Subject:** Verify execution of the 124 series (MAMA + 124A–124H) — does the shipped code do what each PRD requires?
**Audit commit:** `dd4063f1` ("Execute PRD 124 runtime materializer series") + the `packages/ck-runtime-materializer` keystone.
**Closure update:** June 27, 2026. The runtime cache-refresh blocker recorded
below was closed after the original audit. Current Tokyo-worker locale package
write/delete routes purge published locale URLs and report
`tokyo.errors.publicCache.*` visibly; current Roma reports that phase as
`cache-refresh`. 124F source-save cascade wording is superseded by the PRD 126M
source-save/localization boundary correction: source save no longer runs
translation or locale package follow-up.
**Method:** Per-PRD, code-vs-PRD verification with `file:line` evidence. 124A + 124B audited directly (incl. running the 124B contract test). 124C–124H audited via six read-only verification subagents, each given the 124A locked contract as the yardstick. This report synthesizes all nine.
**Binding tenet held throughout:** "It is prohibited to reinterpret the PRD intent into an ideal system, and then add machinery to enforce that interpretation."

---

## 0. Headline verdict

**The series is substantively EXECUTED.** The materialization core — the whole point of the program — is contract-conformant, pure, and tested. **No code-level doctrine violation was found anywhere:** no invented machinery, no status stores, no visitor-time composition, no over-architecture. The non-reinterpretation tenet held in code across every slice.

**Closure status: EXECUTED.** The original audit found executed runtime with
several follow-up gaps. The visitor-facing locale CDN freshness gap is now
closed in runtime. Remaining items in this report are historical documentation
accuracy or cleanup notes, not blockers to moving PRD 124 to `03-Executed`.

| Sub-PRD | Verdict | One-line |
|---|---|---|
| **124A** Schema-Token Contract Lock | **EXECUTED** | 681-line addendum complete; no runtime change under A; contract conforms to 124B |
| **124B** Pure Materializer Package | **EXECUTED** | Keystone conforms to §8/§9/§10/§14; 21-case contract test passes incl. legacy byte-parity + purity guard |
| **124C** Base Artifact Reroute | **EXECUTED-WITH-GAPS** | Base reroute clean + byte-parity verified; Impl Note overclaims scope; dup version constant |
| **124D** Locale Materialization | **EXECUTED-WITH-GAPS** | Atomic, no-base-fallback, coordinate-consistent; scope overclaim (=124E's serving); preview-parity V3 gap |
| **124E** Tokyo Serving & CDN | **EXECUTED** | Core serving clean + tested (§12 headers, fail-closed miss, no composition); locale URL purge now wired for published locale package write/delete |
| **124F** Current Cascade Ops | **SUPERSEDED / EXECUTED BY CURRENT BOUNDARY** | Source-save localization cascade superseded by PRD 126M; explicit translation generation and account locale settings own locale package materialization |
| **124G** Broad Dependency Audit | **EXECUTED-WITH-GAPS** | No-machinery invariant holds (only `stripStylesheetLinks` added); evidence labeling missing/mis-labeled |
| **124H** Composition Boundary | **EXECUTED** | Page serving 404, publish 422, page source instance-ref, zero future-surface code |

---

## 1. What's clean (credit where due)

Before the gaps, the audit confirmed a lot of correct, disciplined execution:

- **Fingerprint byte-exact.** `packages/ck-runtime-materializer/src/fingerprint.ts:9-20` reproduces Tokyo's algorithm exactly (`[index.html:<str.length>, …].join('\n')`, SHA-256 via Web Crypto, `sha256:<hex>`). Tokyo's `buildInstancePublicPackageFingerprint` is the same algorithm. (124B §8, 124E.)
- **Evidence complete and honest.** `materialize.ts:142-151` returns all 8 §9.2 fields; `supportFileFingerprints: []`. Crucially, **only `publicPackageFingerprint` + `materializerContractVersion` are persisted to R2 and enforced; `sourceFingerprint`/`schemaWidgetContractFingerprint`/`overlayFingerprint` are caller-provenance echoes only** — exactly as 124A §9 prescribed. The edge does not overclaim enforcement it doesn't have. (124C `roma/lib/account-instance-public-package.ts:240,290`; 124E `package-files.ts:303-388`.)
- **Failure contract exhaustive.** Every §10 reason key mapped in `errors.ts:3-40`, with `:{path}` suffixes for file_missing/key_missing/key_unexpected. `materialize.ts:106-114` + `overlay.ts:37-70` reject base-with-overlay, non-base-without-overlay, locale mismatch, missing/unexpected/non-string values, scope-unsupported.
- **Purity test-enforced.** The `forbidden imports guard` test (one of 21) asserts the package imports no `roma/|tokyo-worker|next/|react|process.env`. Materializer never fetches/mutates/purges. (124B §14.7.)
- **V6 atomicity holds for materialization.** Locale packages are all-or-nothing: first failure stops remaining locales, `ok:false` + failed coordinate returned, no "some fields translated" success. (124D `account-instance-locale-package.ts:171-284`; 124F cascade.)
- **Fail-closed visitor-miss, NO base fallback.** `clk-live-routes.ts:150-169` → `localeNotAvailable()` = `404 "Locale not available"`, `no-store`, no path to base serving. Tested. (124E.)
- **Zero request-time composition / zero forbidden machinery.** Grep confirms no scanner, scheduler, event bus, status store, readiness ledger, compatibility reader, storage-walk, or broad re-resolution executor anywhere. Page serving is correctly disabled (404); page publish 422; page source stays `{placementId, instanceId}`. (124G, 124H.)
- **Genuine reroute, not a masquerade.** Git confirms 7 legacy builder functions deleted from Roma in `dd4063f1`; logic now lives only in the package. `buildSavedWidgetPublicPackage` is a thin async wrapper, body replaced. (124C.)
- **Locale storage coordinate is consistent** across Roma write, Tokyo read, and materializer input — the circular-coordinate blocker from peer review is resolved. Overlay at `accounts/{a}/instances/{i}/overlays/locales/{locale}.json`; package at `accounts/{a}/instances/{i}/locales/{locale}/{file}`. (124D `keys.ts:22-33`.)

---

## 2. Per-PRD findings (condensed)

### 124A — EXECUTED
Doc-only contract PRD; the addendum is the deliverable. All 8 slices + drift control + green criteria + V-audit present. No runtime change made under 124A (code landed under the B–F execution commit). Identity (§5), overlay body (§6), input contract (§7) all match the 124B implementation. **No findings.**

### 124B — EXECUTED
21-case contract runner passes (`tsx tests/run-runtime-materializer-contract.ts`, exit 0), including `base package matches legacy fixture` (byte-parity vs Roma legacy builder), `fingerprint contract stays deterministic`, `base/non-base evidence is complete`, all failure cases, `forbidden imports guard` (purity), and `repeated overlay scope` (reorder-safety correctly not claimed). **No findings.**

### 124C — EXECUTED-WITH-GAPS
- ✓ Base reroute clean: legacy builder genuinely replaced, byte-parity fixture (`roma/tests/fixtures/124c-base-package-expected.json`, predates reroute), exhaustive error map with `assertNever`, source/schema fingerprints correctly provenance-only on base path.
- ⚠ **GAP (attribution):** Impl Note claims *"no locale artifacts, public locale URLs, Tokyo serving changes… were added"* — false against the tree. That code is 124D/124E's, shipped in the same commit. Code is correctly partitioned by function; the note overclaims narrow scope.
- ⚠ **NIT:** Tokyo hardcodes `EXPECTED_MATERIALIZER_CONTRACT_VERSION = 'ck-runtime-materializer:124B'` (`tokyo-worker/.../package-files.ts:72`), duplicating the package constant (`types.ts:3`) — two sources of truth, drift risk.

### 124D — EXECUTED-WITH-GAPS
- ✓ Locale materialization clean: atomic, no-base-fallback, coordinate-consistent (circular blocker resolved), failure keys mapped.
- ✓ The "public locale serving exists" question is **resolved**: that route (`clk-live-routes.ts:150-169`) is legitimately 124E's implementation. 124D's Impl Note claim that it doesn't expose public serving is stale wording, not a code defect.
- ⚠ **GAP (V3 silent omission):** Preview parity is conformance-only with **no recorded rationale**. Bob preview bypasses the materializer entirely — `bob/components/Workspace.tsx:87-97` resolves client-side via `resolveTranslatedValues`. 124A §11 allows conformance-only parity *if* the rationale is recorded; it isn't.

### 124E — EXECUTED-WITH-GAPS
- ✓ Core serving clean + tested (typecheck + 7 tests): §12 headers exact, fail-closed miss (404 no-store, no base fallback), generated-package-fingerprint evidence agreement, no request-time composition, no edge source/schema/overlay overclaim. Impl Note accurate.
- ✓ Locale purge follow-up is closed in current runtime:
  `buildClkLiveEntryCachePurgeFiles` includes base and exact locale URLs, and
  the internal locale package `PUT`/`DELETE` routes call published-locale cache
  purge before returning success. Cache purge failures remain visible as
  `tokyo.errors.publicCache.*`, which Roma maps to phase `cache-refresh`.
- NIT: duplicate materializer contract version literals remain a cleanup risk.

### 124F — EXECUTED-WITH-GAPS
- Historical note: 124F save-time localization follow-up is superseded by the PRD 126M
  save/localization boundary correction. Current save behavior no longer
  runs localization follow-up inside account-instance source save.
- Current explicit translation generation materializes locale packages and
  reports exact `localePackages` failure coordinates. Current account locale
  settings follow-up also reports locale package/cache-refresh failure through
  its overlay update response. Locale package write/delete cache refresh is
  owned by Tokyo-worker.

### 124G — EXECUTED-WITH-GAPS
- ✓ No-machinery invariant **holds** (the doctrine-level concern is clean): grep confirms zero scanner/scheduler/status-store/event-bus/compatibility-reader. The only 124G-attributable code change is the materializer's `stripStylesheetLinks` (`html.ts:51-53`) — pure HTML normalization. Residual risk honestly stated (no "solved" overclaim). Future stale-enumeration correctly named-but-not-implemented.
- ⚠ **GAP (labeling):** PRD Slice 4/8/9 require explicit current-vs-target evidence labeling. The Impl Note lists fields flat, implicitly misrepresenting `sourceFingerprint`/`schemaWidgetContractFingerprint`/`overlayFingerprint` as current persisted truth when they are **not** persisted to R2 (correctly provenance-only). And `materializerContractVersion` is labeled target-state but is now actually persisted. The contract is honored; the doc is wrong.
- ⚠ **GAP:** External-reference table (Slice 3) omits the per-row columns (cache behavior, deploy path, immutability flag) — collapsed into prose.

### 124H — EXECUTED
Doc boundary review; all invariants verified: public page serve → 404 (`clk-live-routes.ts:139-141`), page publish → 422 `coreui.errors.page.publishUnavailable`, page source stays `{placementId, instanceId}` (`account-page-source.ts:46-48`), grep confirms zero `pagePackage`/`siteRoute`/`emailRender`/`compositionRegistry`/`appDataModel`. **No findings.**

---

## 3. Cross-cutting systemic findings

### S1 — Locale CDN freshness (closed after original audit)
The original audit found a real visitor-facing risk: locale package writes and
deletes could leave stale locale URLs at the edge. Current runtime closes that
gap. `purgeClkLiveEntryCache` accepts `locales`, the purge file builder includes
locale entry/support URLs, and the internal locale package `PUT`/`DELETE` routes
purge published locale URLs before returning success. Cache refresh failures are
visible and map to the locale package `cache-refresh` phase.

### S2 — Implementation Notes overclaim scope (🟡, documentation)
124B–124E shipped as one monolithic commit (`dd4063f1`). Consequently the 124C and 124D Impl Notes — which each assert "I did not add the next slice's surface" — are false against the current tree. The **code** is correctly partitioned by function; the **notes** read as if each slice shipped alone. This is the exact overclaim pattern PRD 124 doctrine forbids ("success must never hide a failure," "claim exactly what the evidence shows"). Fix: rewrite the 124C/124D Impl Notes to describe what shipped in the commit honestly, or split the attribution.

### S3 — Evidence discipline is sound but mis-documented (🟡, documentation)
124G confirms only `publicPackageFingerprint` + `materializerContractVersion` are persisted+enforced; the other three fingerprints are provenance-only. This is **correct** per 124A §9. But the 124G Impl Note lists them flat as "current," misrepresenting target-state fields as persisted truth. Fix: add the PRD-mandated current-vs-target column to the 124G evidence table.

### S4 — Preview parity is conformance-only with no rationale (🟡, V3)
Bob preview bypasses the materializer (`Workspace.tsx:87-97`). 124A §11 permits this *if* recorded; it isn't. Fix: record the rationale in the 124D note, or route preview through the materializer.

### S5 — Duplicate materializerContractVersion source of truth (NIT)
Tokyo hardcodes the literal (`package-files.ts:72`); the package owns the constant (`types.ts:3`). Drift risk on the next contract bump. Fix: have Tokyo import the constant from the package.

---

## 4. Prioritized action list

For the team — these are findings, not a decree. Owners are the natural PRD/slice that introduced the surface.

**Closed after original audit:**
1. **(S1) Locale purge/cache-refresh wiring** is closed in current runtime.
   Tokyo-worker includes exact locale URLs in the purge set, locale package
   write/delete routes purge published locale URLs, and Roma maps public cache
   failures to the `cache-refresh` locale package phase.
2. **(S1) Purge credentials** remain an operational deployment concern, not an
   open PRD 124 implementation blocker.

**Documentation accuracy (no code behavior change):**
3. **(S2) Historical note:** 124C + 124D Impl Notes overclaimed slice-only
   scope because 124B-124E shipped together; current runtime remains
   partitioned by authority.
4. **(S3) Historical note:** 124G evidence labeling should be read as an audit
   note, not current persisted truth.
5. **(S4) Historical note:** Bob preview parity remains conformance-only; current
   operator docs and runtime keep preview separate from public materialization.

**Cleanups:**
6. **(S5) De-duplicate `materializerContractVersion`** — Tokyo imports the package constant.
7. **(124E) Add any desired extra test assertions** for locale support-file
   cache headers; current Tokyo locale serving tests already cover stored bytes,
   fail-closed missing/mismatch behavior, and no request-time composition.
8. **(124G) Expand historical external-reference tables** if future archaeology
   needs per-row cache/deploy/immutability labels.

---

## 5. What this audit did NOT do (honesty)

- Did **not** re-run the roma/tokyo-worker test suites (read-only audit), except the 124B keystone contract test (passed, exit 0). Subagents reported test presence and structure; only 124E's subagent re-ran its three verification commands (passed).
- Did **not** verify deploy/runtime state — purge secrets, R2 contents, edge cache behavior are unverified from the repo.
- Did **not** assess correctness of the locale *translation* quality, only the materialization/serving contract.

---

## 6. Source-citation index (key files)

- **124B:** `packages/ck-runtime-materializer/src/{fingerprint.ts:9-20, materialize.ts:100-153, overlay.ts:36-81, errors.ts:3-40}`, `tests/run-runtime-materializer-contract.ts` (21 cases).
- **124C:** `roma/lib/account-instance-public-package.ts:215-258` (reroute), `roma/tests/fixtures/124c-base-package-expected.json` (byte-parity); git `dd4063f1` (7 builder fns deleted). NIT: `tokyo-worker/.../package-files.ts:72`.
- **124D:** `roma/lib/account-instance-locale-package.ts:106,171-284` (atomic), `tokyo-worker/.../keys.ts:22-33` (coordinate), `bob/components/Workspace.tsx:87-97` (preview bypass).
- **124E:** `tokyo-worker/src/routes/clk-live-routes.ts:99-104,150-169,23-32` (headers, serve, fail-closed), `domains/account-instances/package-files.ts:303-388` (evidence), `operations.ts:77-119` (purge), `wrangler.toml` (no CF vars).
- **124F:** save-time localization follow-up history is superseded by PRD 126M; current
  locale settings follow-up remains in `roma/app/api/account/locales/route.ts`.
- **124G:** `packages/ck-runtime-materializer/src/html.ts:51-53` (only code change), grep-empty no-machinery, Impl Note L64-91 (labeling).
- **124H:** `tokyo-worker/src/routes/clk-live-routes.ts:139-141` (page 404), `roma/.../publish/route.ts` (422), `roma/lib/account-page-source.ts:46-48` (instance-ref), grep-empty no-future-surface.
