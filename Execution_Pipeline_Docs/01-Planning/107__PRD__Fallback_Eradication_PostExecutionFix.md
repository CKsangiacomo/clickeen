# PRD 107 - Post-Execution Fix: False-Done Fallback Eradication

Status: EXECUTABLE - DELETION PRD
Owner: Product + Architecture
Date: 2026-06-13

This document exists because the PRD 107 post-execution audit found rows marked
complete while the code still preserves PRD 107 violations. This is not a new
optimization PRD. This is a correction pass for false-done execution.

## Product Law

Clickeen is a closed system. Named product services trust each other's
contracts. A service does not probe, sanitize, normalize, reconstruct, or
second-guess another service's truth. If truth is invalid, it fails at the
owning boundary.

This law is the authority for every item below. Any implementation that adds a
new local normalizer, sanitizer, probe, repair helper, fallback default, generic
error redress, warning-only path, retry-to-success path, or runtime self-test to
keep the old product path alive is a PRD 107 failure.

## Scope

Fix only the rows below. These rows were previously called complete but are not
complete under the product law.

Do not expand into unrelated cleanup. Do not preserve the violating workflow for
active callers. Active callers that depend on the violation are part of the
deletion target until they reach the named boundary failure or are deleted as
fake/dead/duplicate workflow.

## External Audit Inputs Kept

The independent execution-verification audit is not accepted as a green audit.
Its bottom-line claim that the remaining exposure is only process/durability is
false under current code. This fix PRD keeps only the useful inputs:

- `TW-107-CACHE-PURGE-IGNORED` is genuinely open while `D-107k` remains pending.
- PRD action/status bookkeeping is contradictory: shipped/evidenced rows still
  have locked gate rows.
- `WSH-107-01` needs an explicit evidence row or an explicit open/split status.
- `SF-107-06` and `SF-107-07` need explicit mapping to the rows that actually
  deleted their workflows, or they remain untraceable.
- Per-slice source/runtime delete:add ratio must be audited per slice. Aggregate
  deletion ratio does not satisfy a slice gate unless the PRD explicitly says
  the slice is grouped.
- Downstream-block proof should be retained as durable evidence where practical,
  but retained proof is not the product fix. The product fix remains deletion or
  collapse of the toxic workflow.

## Correct Execution Process

Execute one slice only. Do not touch the next slice.

At the start of each slice, name product truth:

- what owns source truth;
- what owns package truth, if applicable;
- what owns publish/serve truth, if applicable;
- where failure must happen.

Then identify the toxic workflow:

- the exact V1-V8 behavior;
- the full blast radius;
- every caller that currently depends on the violation.

Delete or collapse the toxic workflow:

- do not preserve it with new wrappers;
- do not add product-runtime prove/check/validate/finalize/preflight/probe/
  self-test ceremonies;
- do not count documentation edits as LOC reduction;
- do not count PRD evidence edits as LOC reduction;
- source/runtime/product-code execution must be deletion-led wherever a toxic
  workflow exists.

The original 3x deletion rule is not a hard gate for this post-fix PRD. Prefer
net deletion. If a slice cannot meet 3x deletion because the violation is a
small boundary propagation fix, record a source/runtime LOC exception with the
exact reason. Additions are allowed only for minimal failure propagation or
typed boundary routing. Additions are forbidden if they create preservation
code: new normalizers, probes, validators, preflights, compatibility wrappers,
self-tests, or fallback helpers.

Run focused stale-symbol scans for:

- old fallbacks;
- renamed fallbacks;
- optional inference;
- string-prefix error transport;
- partial mutation paths;
- generic error redress;
- warning-only continuation;
- new ceremony helpers.

Run only relevant gates:

- `git diff --check`;
- affected typecheck/lint/build/validate commands;
- no runtime product test dependency added.

Run external proof from outside product runtime. The proof must show:

- valid path succeeds;
- invalid/missing truth fails visibly at the owning boundary;
- no downstream mutation/success happens;
- no partial success masquerades as green.

Retain proof durably when practical, but only outside product runtime. Durable
proof may be a package-level regression test, a checked-in harness, or a precise
evidence artifact, provided it does not become a runtime dependency, product
preflight, probe, self-test, validator, or ceremony that decides whether normal
product work can proceed.

Only after self-audit is clean, spawn exactly two validators:

- Validator 1: skipped blast radius.
- Validator 2: V1-V8 still present or newly introduced.

If either validator is RED, stop. Do not argue. Do not add ceremonies. Do not
pad with docs. Fix the exact workflow by deletion/collapse and repeat from
self-audit.

If both validators are GREEN, update evidence truthfully with durable commit
SHAs, commit the slice, push, reread this process, then move to the next slice.

## Violation Language

| Type | Name | Definition | Required action |
| --- | --- | --- | --- |
| V1 | Silent substitution | Missing, invalid, stale, or malformed product truth is replaced with an invented value. | Delete the workflow or fail visibly at the named boundary. |
| V2 | Silent healing | Invalid persisted/user/product state is normalized, coerced, repaired, or rewritten without visible failure. | Delete the workflow or make the corruption fail visibly. |
| V3 | Silent omission | Required product input, artifact, operation, edit, module, event, or policy is dropped while the caller sees success. | Delete the success path. |
| V4 | Fail-open control | Security, policy, entitlement, rate-limit, containment, or budget enforcement turns off when a dependency is missing, malformed, or unavailable. | Fail closed with typed visible failure. |
| V5 | Corruption-as-absence | Corrupt stored state is treated as missing/new/empty and later overwritten or ignored. | Return a typed corrupt/invalid failure; do not mutate. |
| V6 | Partial-success masquerade | Some requested work is rejected, filtered, dropped, or ignored while the product claims the full operation succeeded. | All requested work succeeds or the boundary fails visibly. |
| V7 | Masquerade/redress | The same toxic workflow is moved, wrapped, renamed, hidden in detail, genericized, retried, logged-and-continued, warning-only, or legacy-continuity-gated while still reaching success or mutation. | Treat as a new P0 PRD 107 violation. |
| V8 | Runtime test dependency | The running product depends on tests, synthetic probes, self-validation, helper checks, source-order checks, or internal validation rituals to decide whether normal product work can proceed. | Delete the ceremony and the preserved workflow. |

## Fix Ledger

### PF-107-1 - Roma Page Create and Stored Page Source

Status: COMPLETE
Original rows: AB-19, AB-20, R107-ROMA-001, R107-ROMA-002
Likely files:

- `roma/app/api/account/pages/route.ts`
- `roma/lib/account-page-direct.ts`

False done claim:

- PRD 107 says Roma rejects invalid supplied page metadata/robots before Tokyo
  create.
- PRD 107 says Roma does not trim, coerce, drop, or force invalid stored page
  source fields into a healed page.

Observed violation:

- `pageMetadataFromCreatePayload` turns non-object `metadata` into default page
  metadata.
- account-page direct still reconstructs Tokyo page source truth by dropping or
  forcing fields such as `canonicalUrl`, localization booleans, and
  `missingLocaleBehavior`.

Surviving authority:

- Create request truth belongs to the Roma create boundary only for declared
  creation defaults.
- Stored page source truth belongs to Tokyo `source.json`.
- Roma may consume Tokyo source truth, but must not rewrite it into a different
  valid page.

Correct execution:

- Delete create-time healing for supplied invalid metadata.
- Keep only explicitly declared absence defaults, if product owner has declared
  them.
- Delete stored-source reconstruction. Invalid stored source fails at the Roma
  page read/load boundary before open/list/composition/publish success.
- Prove invalid supplied metadata writes no Tokyo page source.
- Prove corrupt stored source produces visible failure and no package/publish
  mutation.

Done when:

- Invalid supplied page metadata fails before `createAccountPageInTokyo`.
- Invalid stored Tokyo page source fails before page open/list/composition/
  publish/package success.
- No replacement normalizer preserves the old behavior.

Evidence:

- Implementation commit: `eac372ed`.
- Product truth: Roma owns page create request defaults only for absent declared
  create fields. Tokyo owns stored page source truth and source save stamping.
- Source/runtime LOC: `36 insertions(+), 117 deletions(-)` across PF-107-1
  product files.
- Local gates: `git diff --check`; `pnpm --filter @clickeen/roma typecheck`;
  `pnpm --filter @clickeen/roma lint`; `pnpm --filter @clickeen/tokyo-worker
  typecheck`. Tokyo-worker has no lint script.
- External proof: temporary outside-runtime harness showed invalid supplied
  metadata and non-object create payload make zero Tokyo create calls; page
  settings caller no longer forces localization repair; invalid submitted source
  fails at Tokyo with zero R2 puts; valid create/save succeeds and Tokyo stamps
  version/updatedAt after validation.
- Validator 1: initial RED on `roma/components/pages-domain.tsx` settings
  caller forcing localization fields, then GREEN after deletion.
- Validator 2: GREEN. No V1-V8 remains or was introduced for this slice.

### PF-107-2 - Builder Copilot Boundary

Status: COMPLETE
Original rows: AB-12, AB-13
Likely files:

- `roma/app/api/account/instances/[instanceId]/copilot/route.ts`
- `roma/lib/ai/account-copilot.ts`
- `sanfrancisco/src/agents/widgetCopilotCore.ts`
- `sanfrancisco/src/agents/widgetCopilotCsProduct.ts`

False done claim:

- PRD 107 says Copilot cannot apply/drop partial work while claiming full
  success.
- PRD 107 says invalid structured edit output fails before success response
  construction.

Observed violation:

- Roma converts San Francisco copilot failure into HTTP 200 assistant copy.
- San Francisco filters invalid `controls` entries into a smaller safe catalog.

Surviving authority:

- Roma/Bob own the control catalog contract they send to San Francisco.
- San Francisco owns the copilot model/output boundary.
- Neither service may filter malformed cross-service truth into a smaller
  successful request.

Correct execution:

- Delete HTTP 200 error relabeling for San Francisco copilot failure.
- Delete filtered survivor control catalog behavior.
- Invalid control catalog or model ops must fail the copilot boundary.
- No partial operation set may be returned as success after malformed requested
  work was dropped.

Done when:

- Valid copilot request succeeds.
- Malformed controls fail visibly.
- Mixed valid/invalid model ops fail visibly.
- Roma returns a failure status for copilot boundary failure, not assistant
  success copy.

Evidence:

- Implementation commit: `5fec74c5`.
- Product truth: Roma/Bob own the control catalog contract before grant/usage
  reservation. San Francisco owns model-output interpretation before session
  mutation or `ops_applied` success. Bob remains the downstream edit-apply
  guard and must not manufacture missing indexed structures.
- Source/runtime LOC exception: `303 insertions(+), 36 deletions(-)`. This slice
  could not be deletion-led by ratio because the prior violating paths were
  small filter/relabel branches, while the fix required explicit all-or-nothing
  boundary rejection before grant reservation, SF session mutation, and Bob
  downstream mutation. No added code preserves the old survivor-filter or
  HTTP-200 redress workflow.
- Local gates: `git diff --check`; `pnpm --filter @clickeen/roma typecheck`;
  `pnpm --filter @clickeen/roma lint`; `pnpm --filter @clickeen/sanfrancisco
  typecheck`; `pnpm --filter @clickeen/bob typecheck`; `pnpm --filter
  @clickeen/bob lint`.
- External proof: temporary outside-runtime harness showed malformed controls
  fail before continuation; invalid numeric, array, and tokenized model ops fail
  before San Francisco session mutation; Bob rejects an out-of-range indexed set
  path before mutation; valid model op succeeds; Roma preserves San Francisco
  failure status as non-2xx.
- Validator 1: multiple RED passes on skipped pre-grant control validation,
  model-op target validation, numeric/array bounds, tokenized set bounds, and
  downstream Bob set behavior, then GREEN after fixes.
- Validator 2: multiple RED passes on shallow kind/path validation, path healing,
  numeric range omission, and tokenized set bounds, then GREEN after fixes. No
  V1-V8 remains or was introduced for this slice.

### PF-107-3 - Berlin Auth Provider Config Boundary

Status: OPEN
Original row: R107-BERLIN-008
Likely files:

- `berlin/src/auth/config.ts`
- `berlin/src/index.ts`
- `berlin/src/auth/routes.ts`

False done claim:

- PRD 107 says missing/empty allowed-provider policy fails with
  `berlin.errors.auth.config_missing` before OAuth/session work.

Observed violation:

- Missing `BERLIN_ALLOWED_PROVIDERS` no longer defaults to Google, but the typed
  config failure is caught and redressed into generic `berlin.errors.unexpected`.

Surviving authority:

- Berlin owns auth provider policy.
- Missing provider policy is Berlin service misconfiguration and must fail at the
  auth boundary with the named reason.

Correct execution:

- Preserve the typed provider-policy failure through the route boundary.
- Do not hide the reason in generic unexpected error detail.
- Do not add a fallback provider, warning, probe, or compatibility mode.

Done when:

- Missing provider policy fails start and callback before OAuth ticket/session
  mutation.
- The response exposes the named provider-policy reason.
- Declared valid provider still succeeds.

### PF-107-4 - Session Max-Age Truth

Status: OPEN
Original row family: auth/session cleanup from CKC-107-03 evidence
Likely files:

- `admin/functions/_shared/cookies.js`
- `roma/lib/auth/session.ts`
- Berlin session finish/refresh response callers as needed

False done claim:

- PRD evidence says authz/session expiry reconstruction/fallback was deleted
  from Roma and Admin.

Observed violation:

- Admin and Roma still parse malformed Berlin max-age truth and fall back to
  local defaults before setting cookies.

Surviving authority:

- Berlin owns session token max-age truth in finish/refresh payloads.
- Roma/Admin consume Berlin session truth and set cookies; they do not invent
  expiry.

Correct execution:

- Delete fallback max-age reconstruction in Roma/Admin.
- Missing or malformed Berlin max-age fails before cookie issuance.
- Do not silently omit cookie max-age unless that is a declared Berlin contract.

Done when:

- Valid Berlin finish/refresh payload sets cookies with Berlin-provided max-age.
- Missing/malformed max-age fails visibly before cookie issuance.
- No local `15 * 60` or `30 days` session max-age fallback remains in consuming
  code.

### PF-107-5 - Fill Truth in Dieter and Widget Runtime

Status: OPEN
Original rows: WRT-107-FILL-BAD-STATE-TO-TRANSPARENT, PRD107-DIETER-002 overlap
Likely files:

- `dieter/components/dropdown-fill/fill-parser.ts`
- generated Dieter runtime under `tokyo/product/dieter/components/dropdown-fill/`
- `tokyo/product/widgets/shared/fill.js`

False done claim:

- PRD 107 says bad/empty/string-shorthand fill no longer becomes invented color,
  gradient, none, or transparent visual state.
- PRD 107 says malformed image/video fill fails before visual mutation.

Observed violation:

- Dieter fill parser still defaults malformed image/video buckets.
- Widget runtime still infers fill `type` from sibling fields and defaults media
  fill fields.
- Runtime still treats `null` or string transparent as successful none-like
  state in paths that were claimed removed.

Surviving authority:

- Authored `CKFill` object owns fill truth.
- Dieter may emit declared fill truth.
- Widget runtime consumes declared fill truth and mutates DOM only after accepted
  truth.

Correct execution:

- Delete fill type inference from sibling fields.
- Delete image/video bucket defaults that reconstruct authored state.
- Delete bad-string/empty-object success paths unless explicitly declared as a
  product contract.
- Regenerate generated Dieter artifact only from source changes.

Done when:

- Valid explicit fill succeeds.
- Invalid/malformed fill fails before background/media-layer mutation.
- Existing media layer is not cleared on invalid fill.
- No renamed fill normalizer preserves the old behavior.

### PF-107-6 - Tokyo Public Cache Purge Success Masquerade

Status: OPEN
Original row: TW-107-CACHE-PURGE-IGNORED
Related decision: D-107k
Likely files:

- `tokyo-worker/src/domains/account-instances/operations.ts`
- `tokyo-worker/src/domains/pages/package-files.ts`
- `tokyo-worker/src/routes/internal-page-routes.ts`
- `tokyo-worker/src/routes/clk-live-routes.ts`

False done claim:

- PRD 107 marks nearby publish/page rows complete while D-107k remains pending
  and the cache purge violation remains inventoried.

Observed violation:

- Missing Cloudflare config skips purge while publish/save continues.
- Purge fetch failure is caught and ignored while publish/save can still return
  success.

Surviving authority:

- Publish/serve truth is the Tokyo public serving boundary.
- Cache purge is either part of publish integrity or explicitly out of PRD 107.
- It cannot remain an unresolved row while dependent rows claim complete
  coverage.

Correct execution:

- First resolve D-107k in the PRD.
- If cache purge is in PRD 107, delete the skip-and-success workflow: missing
  purge config or purge failure must fail the publish/save boundary before
  success is reported.
- If cache purge is split, mark it explicitly split and remove any evidence that
  claims PRD 107 completed cache-mutation coverage.
- Do not add a probe/retry-to-success cache ceremony.

Done when:

- D-107k is no longer pending.
- The PRD no longer claims cache purge as complete while code skips it.
- If implemented here, invalid/missing purge truth fails before publish/save
  success.

### PF-107-7 - Package Readiness Metadata Mismatch

Status: OPEN
Original row family: AB-17/18 and page publish/package readiness follow-up
Likely files:

- `tokyo-worker/src/domains/account-instances/package-files.ts`
- `tokyo-worker/src/domains/pages/package-files.ts`
- `tokyo-worker/src/routes/clk-live-routes.ts`

False done claim:

- PRD 107 evidence says public package readiness and serve truth are aligned.

Observed violation:

- Package readiness checks require file existence/text only.
- Public serve requires `httpMetadata.contentType`.
- Publish can therefore succeed on files that live serve will reject.

Surviving authority:

- Public package truth belongs to Tokyo package files and their required serving
  metadata.
- Publish readiness must not claim success for artifacts the public serve
  boundary cannot serve.

Correct execution:

- Collapse readiness and serve requirements into one authority.
- Do not add a separate probe ceremony.
- Required public package artifacts either satisfy the serve contract or publish
  fails before success.

Done when:

- Valid package files with required metadata publish and serve.
- Missing/malformed required serve metadata fails before publish success.
- No duplicate package-truth reconciliation path is added.

### PF-107-8 - Tokyo Page Create Partial Mutation Plane

Status: OPEN
Original row family: AB-24 / page source-create boundary
Likely files:

- `tokyo-worker/src/routes/internal-page-routes.ts`
- `tokyo-worker/src/domains/pages/source.ts`
- `tokyo-worker/src/domains/pages/serve-state.ts`

False done claim:

- PRD 107 says page create materializes durable source plus declared initial
  unpublished serve-state without partial mutation.

Observed violation:

- Page create writes source, then writes serve-state. If serve-state write
  fails, source can remain visible as a half-created page.

Surviving authority:

- Tokyo owns page source truth.
- Tokyo owns page serve-state truth.
- Page create must not claim success or leave a product-visible half-created page
  if the declared create contract includes both artifacts.

Correct execution:

- Collapse page create so the product cannot observe partial create success.
- Prefer deletion/collapse of the split mutation plane over rollback ceremony.
- If a separate serve-state artifact is still required, creation must fail
  without leaving a page that list/open treats as valid.

Done when:

- Valid create produces the declared page truth.
- Serve-state write failure does not produce page create success.
- List/open/publish cannot observe a half-created valid page.

### PF-107-9 - Evidence Durability, Traceability, and PRD State Repair

Status: OPEN
Original area: PRD evidence/status tables
Likely file:

- `Execution_Pipeline_Docs/01-Planning/107__PRD__Fallback_Eradication.md`

False done claim:

- Evidence rows use `this commit`, which is not durable after later commits.
- Some action/status rows and decision rows do not line up with evidence rows.
- Some inventory rows are claimed indirectly without explicit evidence mapping.

Observed violation:

- The PRD contains many evidence rows with `this commit`.
- D-107k remains pending while related evidence implies completion.
- `AI-107-0`, `AI-107-H`, and `AI-107-M` remain locked while completed rows
  claim those gates were satisfied.
- `WSH-107-01` has no explicit evidence row or final status.
- `SF-107-06` and `SF-107-07` are claimed as folded into other work, but the PRD
  does not make the mapping durable.
- Some slices rely on aggregate deletion ratio instead of per-slice source/
  runtime delete:add evidence.
- Some downstream-block proofs were temporary and are not retained as durable
  audit artifacts.

Correct execution:

- This is documentation truth repair only. It does not count toward source LOC
  reduction.
- Replace `this commit` with actual commit SHAs.
- Mark rows found false by this post-execution audit as reopened/superseded by
  this fix PRD until code is corrected.
- Resolve or split D-107k explicitly.
- Set `AI-107-0`, `AI-107-H`, and `AI-107-M` to their truthful state, not to a
  convenient completed state.
- Add explicit evidence/status for `WSH-107-01`.
- Add explicit mapping for `SF-107-06` and `SF-107-07`, or mark them open.
- Record per-slice source/runtime delete:add ratio. If a slice is grouped for
  ratio purposes, the grouping must be declared before execution evidence.
- Retain external proof durably where practical without adding product-runtime
  proof/check/validate/finalize/preflight/probe/self-test behavior.

Done when:

- Evidence rows are durable and traceable.
- False done rows no longer claim complete without a later fix commit.
- Documentation states actual implementation truth.
- Every inventory row called done has either a direct evidence row or an explicit
  covered-by mapping.
- Proof retention is durable enough to audit and does not become runtime
  ceremony.

## Required Validator Prompts

Use these prompts after the self-audit is clean for each slice. Replace
`<SLICE>` with the active `PF-107-*` slice id and slice name.

### Validator 1: Blast Radius

You are validator 1 for PRD 107 post-execution fix slice `<SLICE>` in
`/Users/piero_macpro/code/VS/clickeen`. Do not edit files. Validate only the
current uncommitted diff.

Product law:
Clickeen is a closed system. Named product services trust each other's
contracts. A service does not probe, sanitize, normalize, reconstruct, or
second-guess another service's truth. If truth is invalid, it fails at the
owning boundary.

Question: has any part of the blast radius for this slice been ignored or
skipped during execution?

Check:

- the files named in the active slice;
- active callers of the deleted workflow;
- stale aliases or renamed fallback paths;
- generic error relabeling;
- partial mutation paths;
- product-runtime prove/check/validate/finalize/preflight/probe/self-test
  ceremonies added to preserve the old workflow;
- PRD evidence updates for implementation truth.

Return exactly:

GREEN if no skipped blast radius remains, with concise evidence.
RED if anything remains skipped, with exact file/path/function and why it must
be fixed before moving on.

### Validator 2: V1-V8

You are validator 2 for PRD 107 post-execution fix slice `<SLICE>` in
`/Users/piero_macpro/code/VS/clickeen`. Do not edit files. Validate only the
current uncommitted diff for V1-V8.

Product law:
Clickeen is a closed system. Named product services trust each other's
contracts. A service does not probe, sanitize, normalize, reconstruct, or
second-guess another service's truth. If truth is invalid, it fails at the
owning boundary.

V1 Silent substitution: missing/invalid/stale/malformed truth is replaced with
an invented value.
V2 Silent healing: invalid persisted/user state is normalized, coerced,
repaired, or rewritten without visible failure.
V3 Silent omission: required input/artifact/operation/edit/module/event/policy
is dropped while success continues.
V4 Fail-open control: security/policy/entitlement/rate-limit/containment/budget
enforcement turns off when dependency missing/malformed/unavailable.
V5 Corruption-as-absence: corrupt stored state is treated as
missing/new/empty, then ignored or overwritten.
V6 Partial-success masquerade: some requested work is
dropped/rejected/filtered while product claims full success.
V7 Masquerade/redress: the same toxic workflow is moved, renamed, wrapped,
hidden in detail, genericized, retried, logged-and-continued, warning-only, or
legacy-continuity-gated while still reaching success or mutation.
V8 Runtime test dependency: the running product depends on tests, synthetic
probes, self-validation, helper checks, source-order checks, or internal
validation rituals to decide whether normal product work can proceed.

Return exactly:

GREEN if the new code does not violate V1-V8 for this slice, with concise
evidence.
RED if any V1-V8 remains or was introduced, with exact file/path/function and
violation type.

## Execution Order

Execute in this order unless a slice is explicitly split or blocked:

1. PF-107-1 - Roma Page Create and Stored Page Source.
2. PF-107-2 - Builder Copilot Boundary.
3. PF-107-3 - Berlin Auth Provider Config Boundary.
4. PF-107-4 - Session Max-Age Truth.
5. PF-107-5 - Fill Truth in Dieter and Widget Runtime.
6. PF-107-6 - Tokyo Public Cache Purge Success Masquerade.
7. PF-107-7 - Package Readiness Metadata Mismatch.
8. PF-107-8 - Tokyo Page Create Partial Mutation Plane.
9. PF-107-9 - Evidence Durability, Traceability, and PRD State Repair.

At the end of each slice, reread this document and the PRD 107 execution
process before moving to the next slice.
