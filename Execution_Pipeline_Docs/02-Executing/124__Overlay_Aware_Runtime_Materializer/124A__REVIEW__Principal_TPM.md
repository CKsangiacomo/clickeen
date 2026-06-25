# 124A — Principal TPM Review (Schema-Token Contract Lock)

Status: REVIEW
Reviewer: Principal Technical Program Manager (independent peer review)
Date: 2026-06-25
Subject: `124A__PRD__Schema_Token_Contract_Lock.md` and `124A__PR.md` (orchestrator peer review)
Parent: `124__MAMA__Overlay_Aware_Runtime_Materializer_Program.md`

## Verdict

**GREEN.** 124A is the correct contract-first seed slice, it honors the
no-reinterpretation tenet, and the orchestrator's peer review is sound. This
review agrees with the GREEN recommendation and sharpens four watch-items into
binding closeout conditions with evidence grounded in current code and the
Cloudflare ops path. The orchestrator's review is accurate; the one place it was
open ("does the purge path exist today?") is closed below with a concrete answer
that does not change the verdict but tightens Slice 5.

## Scope And Method

This is a contract-lock PRD (decisions + docs only, no runtime code). The review
verifies the proposed contracts against current runtime code, current storage
shape, current overlay-key shape, and the current Cloudflare CDN/purge operation
path. Every claim below is tied to a file or a doc line.

## Rubric 1 — Cohesive And Cost-Effective Architecture

**Pass.** The contract 124A locks produces the cost shape MAMA mandates and is
the right economic baseline.

- Pre-materialized immutable artifacts: confirmed in code. Roma
  `buildSavedWidgetPublicPackage` (`roma/lib/account-instance-public-package.ts`)
  materializes `index.html` / `styles.css` / `runtime.js` at save time. Tokyo
  stores exact submitted bytes (`writeInstancePublicPackage`). Public serving
  (`clk-live-routes.ts`) does a single `env.TOKYO_R2.get(key)` and returns stored
  bytes — no visitor-time composition, no overlay reads on the request path.
- CDN-friendly headers: `cacheControlForGeneratedFile` already sets
  `public, max-age=60, s-maxage=300, stale-while-revalidate=86400` on entry files
  and `public, max-age=31536000, immutable` on the (future) immutable support
  path. This matches the CDN law pretty-URL-entry + immutable-support contract.
- Fail-closed serving: `verifyInstancePublicPackageReady` + fingerprint match
  (`publicPackageObjectMatchesExpectedFingerprint`) return 404 on any
  marked/unmarked package mismatch. No healing, no fallback.

**Economics check vs alternatives.** The alternative (request-time composition)
would put overlay reads + materialization on every visitor hit. 124A's
pre-materialized + immutable-support model is the cost-effective choice and is
the industry-standard pattern for content-addressed localized artifacts. Sound.

## Rubric 2 — Systems Clarity; No Invented Subsystems

**Pass.** 124A preserves clean boundaries and invents no new subsystem. Verified
against the authority tables in `Overview.md`, `tokyo-worker.md`, and the MAMA
Authority Law.

- Roma stays the save/package authority; Tokyo stays the stored-byte authority;
  the materializer stays a pure resolver (124A repeats the "fetches nothing,
  mutates nothing, purges nothing" constraint verbatim from MAMA).
- Translation Agent stays behind the Roma grant + Tokyo overlay-write boundary
  (`writeAccountInstanceTranslatedLocaleValues` in `values.ts` validates against
  saved `content.fields[].path`).
- 124A explicitly forbids the machinery traps (Schema service, token registry,
  identity DB, readiness ledger, compatibility reader). This is the correct
  anti-overarchitecture discipline for a seed slice.
- The authority gate in 124A names every current product boundary before any
  decision, matching the AGENTS.md Plan Gate.

One clarity note (not a blocker): 124A's System Interaction Contract says
"Tokyo-worker validates and stores exact overlay/package bytes. It does not
resolve product meaning." Current code confirms this — Tokyo validates overlay
keys against the saved content field map (`assertLocaleOverlayValuesMatchSavedTextFields`),
not against a derived widget contract. The contract lock is faithful to runtime.

## Rubric 3 — SaaS World-Class / Competitive Technical Parity

**Mostly pass; one honest weakness.**

Where it matches or beats incumbents:

- **Content-addressed artifacts.** The `sha256` package fingerprint stored as R2
  `customMetadata` and re-checked at serve time (`publicPackageFingerprint`) is
  the right pattern. It is how best-in-class composable-content platforms prove
  artifact provenance. 124A's evidence law generalizes this to schema/source/
  overlay fingerprints — correct direction.
- **Fail-closed serving.** Fingerprint mismatch → 404 (not fallback) is the
  correct competitive posture. Many legacy CMSes serve stale/healed content;
  124A forbids that explicitly (Slice 6, fallback always `no`).
- **Evidence/version contracts.** Locking evidence fields to "real independently
  moving inputs" is the right discipline and beats systems that fingerprint
  concepts that do not move separately.

Where it is weaker (must be acknowledged, not hidden):

- **Purge operation maturity.** Best-in-class localized-content platforms own a
  first-class, observable cache-invalidation path. Clickeen's purge path is a
  worker-internal `fetch` to the Cloudflare purge API gated on two optional env
  vars that are not bound in `tokyo-worker/wrangler.toml` `[vars]` (see
  Rubric 4 / Vector table). This is below incumbent parity and is the single
  biggest operational-risk item. 124A does not need to fix it, but Slice 5 must
  lock the honest interim (short-TTL + named gap) rather than imply a managed
  purge path exists.
- **Dual resolver implementations.** Preview (`previewL10n.js` browser JS) and
  the server substrate (`translated-value-primitives.ts`) are two separate
  path-resolution codebases today (see Rubric 4). Incumbents with strong
  preview/public parity share one resolver. 124A allows conformance-only parity
  with a CI gate; that is an acceptable interim if — and only if — the CI gate is
  locked as mandatory.

## Rubric 4 — Docs To Update (Product/System-Operations Perspective)

This is where 124A has real work. The Cloudflare ops path that Slice 5 assumes is
NOT a first-class managed operation today, and that truth must be reflected
honestly in the contract and in docs.

**Verified Cloudflare purge/CDN operation path (current truth):**

- `documentation/engineering/CloudflareOperations.md` Command Decision Map has NO
  cache-purge / CDN-invalidation command. It covers R2 reads/writes, Pages
  project config, DNS, and worker/R2 deploys. There is no `cf:purge` or
  `cf:cache` script in root `package.json`.
- The only purge path is in-worker: `purgeClkLiveEntryCache`
  (`tokyo-worker/src/domains/account-instances/operations.ts:77`) calls the
  Cloudflare `/purge_cache` API using `env.CLOUDFLARE_ZONE_ID` and
  `env.CLOUDFLARE_API_TOKEN`.
- `tokyo-worker/wrangler.toml` `[vars]` does NOT bind either var.
  `documentation/services/tokyo-worker.md` lists both as `no` (optional) "for
  Cloudflare purge support when purge is enabled."
- The purge call is wired into save operations (`operations.ts:366` and `:391`).
  If the config is absent, the code throws `503 purgeConfigMissing` — i.e., the
  save FAILS CLOSED, it does not silently skip purge. This is the correct
  fail-closed posture, but it means purge-efficacy depends on those two values
  being live secrets in cloud-dev, which is not documented as a hard requirement.

**Implication for 124A Slice 5 (binding closeout condition):**

The orchestrator's Slice 5 watch-item left purge as an open menu ("existing path
OR short-TTL-only until a later PRD"). The code-grounded answer is: the purge
*operation* exists and is wired to saves, but it is not a managed, documented,
preflight-gated repo operation. Slice 5 must lock ONE of these, not leave both on
the table:

1. Purge is active in cloud-dev via live `CLOUDFLARE_ZONE_ID` +
   `CLOUDFLARE_API_TOKEN` secrets on the `tokyo-assets-dev` worker — and Slice 5
   names that as the entry-refresh mechanism with the secret-presence
   requirement stated as a deploy contract; OR
2. Purge is NOT reliably active, and Slice 5 locks short-TTL
   (`max-age=60, s-maxage=300, swr=86400`) as the explicit interim freshness
   bound, and names "managed Cloudflare cache-purge operation" as a documented
   gap for a later approved PRD (likely 124E or 124F).

Option 2 is the honest lock unless evidence proves option 1.

**Docs that must change if 124A locks alter current serving/storage truth:**

- `documentation/engineering/CloudflareOperations.md` — MUST add a cache-purge
  section (or explicitly state purge is worker-internal and not a repo command)
  if 124A's Slice 5 lock implies a managed purge path. Today the doc is silent on
  purge, which is a latent ops gap independent of 124A.
- `documentation/services/tokyo-worker.md` — the env table marks
  `CLOUDFLARE_ZONE_ID` / `CLOUDFLARE_API_TOKEN` as `no` (optional). If Slice 5
  locks purge as the entry-refresh mechanism, these become required and the doc
  must say so. If Slice 5 locks short-TTL-only, the doc should state purge is
  not active.
- `documentation/architecture/RuntimeProfiles.md` — if the public locale URL /
  cache shape changes current runtime truth (e.g. per-locale entry paths), this
  doc's public-serving section must update.
- `documentation/architecture/OverlayArchitecture.md` +
  `documentation/architecture/BabelProtocol.md` — if Slice 2/3 locks change the
  overlay-key form (they likely will not if `scalar_only_initially` is chosen,
  but WILL if repeated identity is locked).
- `documentation/capabilities/localization.md` — if materialization scope
  (`scalar_only_initially`) changes stated capability.
- `documentation/ai/agents/translation-agent.md` — if overlay-key output shape
  changes. Evidence below shows current output is path-keyed, so if 124A keeps
  path keys, no change; if it moves to identity keys, this doc must change.

If 124A only records future execution contracts without changing current-system
claims, the updates stay inside the 124 folder — consistent with 124A's own
closeout rule. This is the expected case for Slices 1, 4, 6, 7, 8.

## Code-Verified Evidence (grounds for the watch-items)

These are the facts the orchestrator's review flagged as "unconfirmed" or left as
menus. All are now confirmed against code.

| Claim in orchestrator PR | Verified evidence in code |
| --- | --- |
| `identityKeyForField()` / `RepeatContext` / `SavedTextField` exist as identity substrate | CONFIRMED: `packages/ck-contracts/src/translated-value-primitives.ts:176-205` (identity composite = `widgetType\|role\|path\|identityPath=value`) |
| Tokyo overlay storage is path-keyed (`values[path]`, `value_missing:${path}`) | CONFIRMED: `tokyo-worker/src/domains/account-translations/overlays.ts:38-53` and `values.ts:89-93` |
| Translation Agent emits `item.path` keys (positional vs identity "unconfirmed") | CONFIRMED PATH-KEYED: `agents/translation-agent/src/index.ts:116` (`path: item.path`), `:251`, `:316`. The producer/consumer chain is concrete-path-keyed end to end. |
| `previewL10n.js` exists as Bob preview resolver | CONFIRMED: `tokyo/product/widgets/shared/previewL10n.js`. `applyTranslatedValues` (line 36) is a SEPARATE browser-JS path resolver from the server `resolveTranslatedValues` in `translated-value-primitives.ts`. |
| Purge path "assumed-but-absent" (Slice 5 open menu) | CONFIRMED PARTIALLY: purge CODE exists and is wired to saves (`operations.ts:77-119, 366, 391`), but the two required env vars are NOT in `wrangler.toml [vars]` and are marked optional in the service doc. No repo `cf:purge` command exists. |
| Fingerprint dual-implementation risk (Slice 4) | PARTIALLY MITIGATED TODAY: the package fingerprint is computed in ONE place (`buildInstancePublicPackageFingerprint`, `package-files.ts:93`, sha256 over joined file lengths + content). Roma does NOT compute it; Roma submits bytes, Tokyo computes and stores. The dual-implementation risk is a FUTURE one for the new schema/source/overlay evidence fields 124A introduces — the orchestrator's "one shared module" condition is correct for those new fields. |

## Vectors And Blast Radius (Contract-Lock Specific)

| # | Vector (if 124A locks it wrong) | Failure mode | Blast radius | Mitigation 124A must lock |
| --- | --- | --- | --- | --- |
| V1 | Identity representation supersede (Slice 2) | Replacing the existing `widgetType\|role\|path\|...` `identityKey` with a bracket-id form forces dual-read/migration compatibility machinery — exactly what 124A forbids | All of 124B–124D; every repeated-field locale | Lock REUSE of the existing `identityKey` form unless structurally wrong. Do not supersede. |
| V2 | Overlay-key compatibility decided without evidence (Slice 3) | Claiming `compatible` for repeated fields when the chain is path-keyed → reorder serves wrong item (silent substitution V1) | Every localized repeated-field widget | Lock `scalar_only_initially` unless/until 124D ships identity-keyed overlays end to end. Current evidence supports `scalar_only_initially`. |
| V3 | Purge path implied-but-not-managed (Slice 5) | Operator believes a managed purge exists; in reality saves fail-closed on missing secrets OR rely on 300s TTL → stale locale served up to 5 min | Per-coordinate, silent | Lock short-TTL as the explicit interim; name the managed-purge gap for a later PRD. Do not leave as menu. |
| V4 | Preview/public dual-resolver drift (Slice 7) | `previewL10n.js` (browser JS, silently returns on type mismatch) diverges from `translated-value-primitives.ts` (server TS, throws) → preview shows content publish rejects, or vice versa | Per-instance, silent | If conformance-only parity is chosen, lock the conformance suite as a CI gate on every change to either resolver. Shared resolver is preferred if feasible. |
| V5 | Dual fingerprint implementations for new evidence fields (Slice 4) | Roma and Tokyo compute schema/source/overlay fingerprints differently → false cascade or false stability at serve | Every served artifact | Lock fingerprint computation in ONE shared module used by both build and serve validation; lock canonicalization (sorted keys or RFC 8785), hash algo, byte order. |
| V6 | Saved-id presence assumption (Slice 2) | Repeated identity rule assumes every repeater item has a stable id; instances lacking ids fail closed | Per-instance, visible | State explicitly whether fail-closed for id-less instances is the data-readiness contract, or whether id-backfill is a prerequisite owned elsewhere. |
| V7 | Any Slice left as a menu, not a lock (Slice 8) | 124B implements against an undecided contract → hidden decisions leak into code | Program-wide | Slice 8 closeout forbids unassigned placeholder/compatibility language. Correct gate. |

## Slice-By-Slice Assessment (Principal-TPM view)

- **Slice 1 (inventory):** Sound. Correctly boring.
- **Slice 2 (identity):** Sound IF the reuse-vs-supersede decision is locked to
  reuse. The substrate (`identityKeyForField`) already exists; superseding it
  introduces the compatibility machinery 124A forbids. Saved-id presence (V6)
  must be stated as a data-readiness contract.
- **Slice 3 (overlay-key compatibility):** THE crux. Evidence is now conclusive:
  the chain is concrete-path-keyed (Translation Agent `item.path`, Tokyo
  `values[path]`, Bob `previewL10n` path parsing). The honest decision is
  `scalar_only_initially` for repeated fields unless 124D ships full identity-keyed
  overlays. This is a legitimate, explicitly-claimed product limitation, not a
  gap to hide.
- **Slice 4 (evidence):** Sound, with the shared-fingerprint-module condition
  locked. Note today's package fingerprint is single-source (Tokyo); the
  dual-impl risk is only for the NEW schema/source/overlay fields.
- **Slice 5 (URL/CDN):** Sound shape; purge path must be locked honestly (V3).
  Choose short-TTL interim unless proven otherwise.
- **Slice 6 (failure):** Strongest slice. "Explicitly non-claimed, not silently
  omitted" for deferred repeated fields is the correct V3 guard.
- **Slice 7 (parity):** Sound IF conformance suite is a CI gate. Two resolver
  implementations already exist and already have subtle behavioral differences
  (throw vs silent-return). Drift is a current reality, not a hypothetical.
- **Slice 8 (closeout):** Correct gate.

## V1–V8 Audit (Contract-Lock Scope)

124A changes no runtime code, so no runtime V1–V8 violation is possible from 124A
alone. The audit applies to whether the CONTRACT as locked would permit a later
runtime violation:

| ID | Contract-level risk | 124A posture |
| --- | --- | --- |
| V1 Silent substitution | Reorder served wrong item if repeated identity claimed without support | Slice 3 + Slice 6 guard against it; must lock `scalar_only_initially` |
| V2 Silent healing | N/A — contract-only | 124A forbids healing explicitly |
| V3 Silent omission | Deferred repeated fields silently dropped | Slice 6 "explicitly non-claimed" rule is the guard |
| V4 Fail-open control | Purge missing → serve stale silently | Current code fails CLOSED (503 on missing purge config); Slice 5 must not weaken this |
| V5 Corruption-as-absence | N/A — contract-only | 124A forbids |
| V6 Partial-success masquerade | Locale cascade claims success with repeated fields dropped | Slice 6 + Slice 8 closeout forbid |
| V7 Masquerade/redress | N/A — contract-only | 124A forbids |
| V8 Runtime test dependency | Conformance suite becoming runtime truth | Slice 7 limits conformance to a CI gate, not runtime |

No contract-level V1–V8 hole found provided the closeout conditions (V1–V7 above)
are met.

## Closeout Conditions (binding, before Slice 8 sign-off)

These convert the orchestrator's "watch-items (decide, don't menu)" into explicit
gating conditions. All are within 124A's own scope; none require changing the plan.

1. Slice 2: lock identity representation to REUSE of the existing `identityKey`
   form (do not supersede), and state saved-id presence as a data-readiness
   contract.
2. Slice 3: lock `scalar_only_initially` for repeated fields, evidence-backed by
   the path-keyed chain (Translation Agent `item.path`, Tokyo `values[path]`,
   Bob `previewL10n`). Assign full identity-keyed overlay support to 124D.
3. Slice 4: lock ONE shared module for all NEW evidence-field fingerprint
   computation, with canonicalization rule + hash algo + byte order specified.
4. Slice 5: lock the purge interim honestly — short-TTL as the freshness
   mechanism; name managed Cloudflare purge as a documented gap for a later PRD,
   OR prove purge secrets are live in cloud-dev and name them as a deploy
   requirement. Do not leave as a menu.
5. Slice 7: if conformance-only parity, lock the conformance suite as a CI gate
   on every change to either resolver.

## Final Verdict Line

**VERDICT: GREEN.** 124A is the correct contract-first seed slice, honors the
no-reinterpretation tenet, preserves clean system boundaries, and produces a
cost-effective fail-closed serving architecture. The orchestrator's peer review
is accurate and its GREEN recommendation is endorsed. Five binding closeout
conditions above (within 124A's own scope) must be met at Slice 8; the most
consequential is Slice 5 — lock the purge interim honestly, because the managed
purge operation path 124A's CDN law implies does not exist as a first-class repo
operation today.
