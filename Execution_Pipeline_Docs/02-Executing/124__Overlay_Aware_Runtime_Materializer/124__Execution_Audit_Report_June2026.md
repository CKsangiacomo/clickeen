# PRD 124 — Execution Audit Report

**Date:** June 25, 2026
**Subject:** Verify execution of the 124 series (MAMA + 124A–124H) — does the shipped code do what each PRD requires?
**Audit commit:** `dd4063f1` ("Execute PRD 124 runtime materializer series") + the `packages/ck-runtime-materializer` keystone.
**Method:** Per-PRD, code-vs-PRD verification with `file:line` evidence. 124A + 124B audited directly (incl. running the 124B contract test). 124C–124H audited via six read-only verification subagents, each given the 124A locked contract as the yardstick. This report synthesizes all nine.
**Binding tenet held throughout:** "It is prohibited to reinterpret the PRD intent into an ideal system, and then add machinery to enforce that interpretation."

---

## 0. Headline verdict

**The series is substantively EXECUTED.** The materialization core — the whole point of the program — is contract-conformant, pure, and tested. **No code-level doctrine violation was found anywhere:** no invented machinery, no status stores, no visitor-time composition, no over-architecture. The non-reinterpretation tenet held in code across every slice.

**Five sub-PRDs are EXECUTED-WITH-GAPS; three are fully EXECUTED.** The gaps cluster into exactly two buckets:

1. **One real product risk — locale CDN freshness.** Locale packages can be served stale for up to 24h after an operator changes them, and the cascade reports `ok:true` success while the edge is stale. Root cause: purge is not wired into any locale cascade path and ignores locales even when called; purge config is unverified. (124E + 124F.)
2. **Documentation-accuracy gaps, not code defects.** The 124C/124D Implementation Notes overclaim narrow scope (because 124B–124E shipped as one monolithic commit, each slice's "I didn't add the next slice's surface" claim is false against the tree), and the 124G note mislabels target-state evidence as current. The *code* is correctly partitioned; the *notes* overclaim.

Everything else is NIT-level (a missing test assertion, a duplicate version string, collapsed table columns).

| Sub-PRD | Verdict | One-line |
|---|---|---|
| **124A** Schema-Token Contract Lock | **EXECUTED** | 681-line addendum complete; no runtime change under A; contract conforms to 124B |
| **124B** Pure Materializer Package | **EXECUTED** | Keystone conforms to §8/§9/§10/§14; 21-case contract test passes incl. legacy byte-parity + purity guard |
| **124C** Base Artifact Reroute | **EXECUTED-WITH-GAPS** | Base reroute clean + byte-parity verified; Impl Note overclaims scope; dup version constant |
| **124D** Locale Materialization | **EXECUTED-WITH-GAPS** | Atomic, no-base-fallback, coordinate-consistent; scope overclaim (=124E's serving); preview-parity V3 gap |
| **124E** Tokyo Serving & CDN | **EXECUTED-WITH-GAPS** | Core serving clean + tested (§12 headers, fail-closed miss, no composition); **locale purge not wired; purge config unverified** |
| **124F** Current Cascade Ops | **EXECUTED-WITH-GAPS** | Materialization cascade exemplary (honest coords); **cache-refresh/purge phase absent → V6 success-lie**; no no-op-save guard |
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
- 🔴 **GAP (locale purge):** `purgeClkLiveEntryCache` (`operations.ts:77`) ignores locales — `void args.locales` at `:83`, purge list is base-only (`:94-101`). A removed/updated locale stays edge-reachable up to 24h (`swr=86400`) with no force-purge path.
- 🟡 **GAP (purge config):** `CLOUDFLARE_ZONE_ID`/`CLOUDFLARE_API_TOKEN` absent from `wrangler.toml` (expected for secrets, but unverified). If unset at deploy, every publish/unpublish throws `503 purgeConfigMissing`.
- NIT: two PRD-required tests missing (locale `styles.css`/`runtime.js` short-TTL assertion; stale-window doc test). Shared code path, low impact.

### 124F — EXECUTED-WITH-GAPS
- Historical note: 124F source-save follow-up was later superseded by the PRD
  126D source-save/localization boundary correction. Current save behavior no
  longer runs localization follow-up inside account-instance source save.
- 🔴 **BLOCKER (V6, cache phase):** `purgeClkLiveEntryCache` is called only on publish/unpublish base transitions (`operations.ts:366,391`), **never on locale write/delete**. So source-save/overlay-write/locale-settings cascades regenerate packages but the old locale entry HTML stays at the edge — and the response reports `ok:true` full success. That is the V6 full-success-lie pattern, for the cache-refresh phase.
- 🔴 **BLOCKER (response contract):** No cascade response shape carries the purge/cache-refresh phase field the PRD requires (since 124E selected purge).
- ⚠ **GAP:** No no-op-save guard on `PUT /instances/{instanceId}` — every save regenerates all active locales (the locales-settings route *does* guard via `resolveActiveLocaleDelta`; the source PUT doesn't).
- ⚠ **GAP:** "Removed locale still publicly reachable" not surfaced in the response (and with purge absent, removed locales *will* serve until TTL).
- ⚠ **GAP:** Two of three cascade surfaces (overlay-write non-SSE, locale-settings) return honest JSON that no Bob/UI consumer renders. Source-save is consumed (`useSessionSaving.ts:71-92`); the others aren't.

### 124G — EXECUTED-WITH-GAPS
- ✓ No-machinery invariant **holds** (the doctrine-level concern is clean): grep confirms zero scanner/scheduler/status-store/event-bus/compatibility-reader. The only 124G-attributable code change is the materializer's `stripStylesheetLinks` (`html.ts:51-53`) — pure HTML normalization. Residual risk honestly stated (no "solved" overclaim). Future stale-enumeration correctly named-but-not-implemented.
- ⚠ **GAP (labeling):** PRD Slice 4/8/9 require explicit current-vs-target evidence labeling. The Impl Note lists fields flat, implicitly misrepresenting `sourceFingerprint`/`schemaWidgetContractFingerprint`/`overlayFingerprint` as current persisted truth when they are **not** persisted to R2 (correctly provenance-only). And `materializerContractVersion` is labeled target-state but is now actually persisted. The contract is honored; the doc is wrong.
- ⚠ **GAP:** External-reference table (Slice 3) omits the per-row columns (cache behavior, deploy path, immutability flag) — collapsed into prose.

### 124H — EXECUTED
Doc boundary review; all invariants verified: public page serve → 404 (`clk-live-routes.ts:139-141`), page publish → 422 `coreui.errors.page.publishUnavailable`, page source stays `{placementId, instanceId}` (`account-page-source.ts:46-48`), grep confirms zero `pagePackage`/`siteRoute`/`emailRender`/`compositionRegistry`/`appDataModel`. **No findings.**

---

## 3. Cross-cutting systemic findings

### S1 — Locale CDN freshness is the one real product risk (🔴)
This is the only finding that affects visitors. Compounding evidence across 124E + 124F:

- Locale package write/delete does **not** trigger purge (`operations.ts` — purge called only at `:366,391` on publish/unpublish).
- Even when purge runs, it discards locales (`void args.locales`, `:83`) and purges only base URLs.
- Purge config (`CLOUDFLARE_ZONE_ID`/`CLOUDFLARE_API_TOKEN`) is absent from `wrangler.toml` — unverified whether set as secrets.
- Cascade responses report `ok:true` while the edge can serve a stale/removed locale for up to 24h (`swr=86400`).

**Effect:** an operator changes a locale (translate, add, remove); the system reports success; a visitor can still see the old state for hours. This is the V6 full-success-lie for the cache phase, and it contradicts 124E Slice 6 step 10 ("distinguish 'artifact written but cache refresh failed' from full success").

**Fix surface (for the team):** wire locale URL purge into the cascade paths (124F), include locale URLs in the purge set (124E `operations.ts`), add a `cache-purge`/`entry-refresh` phase to the cascade response contract (124F), confirm the Cloudflare secrets are set in cloud-dev/prod (ops), and surface "removed locale may still serve until TTL" when purge isn't confirmed.

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

**Before claiming production-ready locale serving:**
1. **(S1) Wire locale purge into cascade paths** + include locale URLs in the purge set + add the cache-refresh phase to cascade response shapes. (124E `operations.ts`; 124F cascade responses.) — *the one visitor-facing risk.*
2. **(S1) Confirm `CLOUDFLARE_ZONE_ID`/`CLOUDFLARE_API_TOKEN` are set** in cloud-dev/prod (as secrets). Unverified from the repo. (Ops.)

**Documentation accuracy (no code behavior change):**
3. **(S2) Rewrite 124C + 124D Impl Notes** to describe the monolithic delivery honestly (the locale-serving attribution is 124E's).
4. **(S3) Add current-vs-target labeling** to the 124G evidence table.
5. **(S4) Record the preview-parity conformance-only rationale** in the 124D note (or route preview through the materializer — a code decision).

**Cleanups:**
6. **(S5) De-duplicate `materializerContractVersion`** — Tokyo imports the package constant.
7. **(124F) Add a no-op-save guard** on `PUT /instances/{instanceId}` (the locales-settings route already has one).
8. **(124F) Name a UI owner** for overlay-write/locale-settings cascade failure detail (source-save is handled; the other two aren't).
9. **(124E) Add the two missing test assertions** (locale support-file short-TTL; stale-window doc test).
10. **(124G) Expand the external-reference table** to the per-row columns Slice 3 requires.

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
- **124F:** source-save follow-up history is superseded by PRD 126D; current
  locale settings follow-up remains in `roma/app/api/account/locales/route.ts`.
- **124G:** `packages/ck-runtime-materializer/src/html.ts:51-53` (only code change), grep-empty no-machinery, Impl Note L64-91 (labeling).
- **124H:** `tokyo-worker/src/routes/clk-live-routes.ts:139-141` (page 404), `roma/.../publish/route.ts` (422), `roma/lib/account-page-source.ts:46-48` (instance-ref), grep-empty no-future-surface.
