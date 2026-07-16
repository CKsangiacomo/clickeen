# 126G - Current-Source Pre-Execution Audit: UI Ops

Status: STEP 6 COMPLETE - current source audited at tree `2ab7de30`; Step 7 is
defined in `../126G__PRD__Ops.md`; no Step-9 execution credit.
PRD: `../126G__PRD__Ops.md`.

## Audit Question

Does current UI ops still contain an incorrect source/build/deploy path that
126G must change, or is the remaining work a clean handoff to the DevStudio UI
slice?

## Authority Gate

| Lane | Current authority |
| --- | --- |
| Source | `dieter/**`, repo build/generator scripts, approved UI source in git. |
| Generated repo output | `tokyo/product/dieter/**` and generated Admin/DevStudio files. |
| Deployed runtime | Existing Cloudflare Pages, Workers, and R2 deploy paths. |
| Product data | Product routes/workers and `accounts/{accountPublicId}/...`; never a UI deploy root. |
| DevStudio source mutation | Berlin-authenticated Pages Functions -> GitHub Contents API -> Dieter token source. |
| Verification | Repo build/check commands, GitHub Actions run SHA, Cloudflare Pages project SHA, and R2 read-back only when the owning authority changes. |

## Commands And Checks

The Step-6 pass read current source and ran:

```bash
pnpm build:dieter
pnpm dieter:governance:check
pnpm --filter @clickeen/devstudio check:functions
pnpm --filter @clickeen/devstudio typecheck
node scripts/tokyo-r2-deploy-sync.mjs --dry-run --json
rg -n -i \
  'unknown|local upload|override|reconcil|rollback|orphan|product/l10n' \
  scripts/build-dieter.js scripts/tokyo-r2-deploy-sync.mjs \
  documentation/engineering/UI/ops.md \
  documentation/engineering/CloudflareOperations.md \
  documentation/services/tokyo.md documentation/services/tokyo-worker.md
```

All checks passed. Dieter and DevStudio generation produced no tracked diff.
The dry-run enumerated 680 files under only `dieter/`, `product/`, and
`prague/`. The pre-existing untracked `tokyo/product/fonts/` was not touched.

## Proven Current State

### Build truth is clean

- Root `pnpm build:dieter` delegates to `@ck/dieter`, which runs
  `scripts/build-dieter.js`.
- The build verifies source SVGs without mutating them, recreates generated
  Tokyo output, bundles component JS per control, and emits the manifest.
- Local provenance resolves from the last commit affecting `dieter/`,
  `scripts/build-dieter.js`, or `scripts/verify-svgs.js`; CI may provide the
  full build commit SHA.
- Missing provenance throws. Empty provenance throws.
- Every declared manifest dependency is validated; unknown components or
  dependencies throw instead of warning and shipping.
- Generated output is not source authority and inspected generated/source
  parity is current.

`scripts/verify-svgs.js` also contains a non-triggering stroke advisory owned by
126C icon authoring. Current 126C evidence reports no stroke warning. It is not
a deploy fallback or a 126G product path, so this audit does not convert it into
ops architecture.

### Cloudflare/R2 deploy truth is clean

- `.github/workflows/cloud-dev-workers.yml` rebuilds Dieter when Dieter source
  or its two build/verifier scripts change, then runs the existing Tokyo R2
  product-root sync.
- A generated Tokyo product-root-only change runs upload-only sync and does not
  pretend to rebuild source.
- `scripts/tokyo-r2-deploy-sync.mjs` maps only current git-authored roots:
  `tokyo/product/widgets -> product/widgets`,
  `tokyo/product/dieter -> dieter`, `tokyo/roma -> product/roma`, and
  `tokyo/prague -> prague`.
- `accounts/**` is refused because it is product/runtime data, not because it is
  a legacy deploy concept.
- The sync uploads current local files. It does not list/delete remote objects,
  reconcile orphans, or implement rollback; docs state that limitation.
- Real localization tooling and account locale overlays remain outside this
  UI-ops deploy mapping and are not deletion targets.

### DevStudio's real remaining gap belongs to 126L

- DevStudio's server reads current token source, validates editable value
  shape, commits through GitHub Contents API, handles SHA conflict, and returns
  `commitSha`, `contentSha`, and updated tokens.
- The client receives the response but retains only `tokens`; it discards the
  returned commit SHA and shows generic `committed. CI will rebuild...` copy.
- The direct GitHub commit path triggers normal push deployment, but the
  PR/manual `devstudio-verify` workflow is not itself visible to that in-product
  operation.
- 126L owns the operator experience: visible token/old/new/commit evidence and
  direct-commit verification status using existing authorities. 126G must not
  create an ops API, approval workflow, event ledger, or second deploy system.

### Living documentation is current

The UI ops, Dieter, DevStudio, Tokyo, Tokyo-worker, and Cloudflare operations
docs agree on source, generated output, deployed runtime, product data,
upload-only sync, and the 126L handoff. No current documentation rewrite is
required by 126G.

## Exact Step-7 Disposition

There is no standalone 126G implementation write set.

| Area | Integrated Step-9 disposition | Must not do |
| --- | --- | --- |
| Dieter build/generation | Preserve; re-run checks only if another slice changes it. | No second builder, manifest service, or generated-source authority. |
| Cloudflare/R2 workflows | Preserve; owning changed slice supplies existing deploy proof. | No reconciliation engine, rollback engine, or fake remote proof. |
| Product data/localization | No touch. | No account-data deploy mapping or deletion of real l10n tooling. |
| DevStudio token operation | Hand exact UI/evidence gap to 126L. | No 126G screen patch, approval flow, or new backend. |
| Documentation | Preserve unless a later execution changes an authority. | No past-state narrative as current doctrine. |

Exact deletion map: none. The stale paths described by the old audit are
absent from current source.

## V1-V8 Pre-Execution Result

| ID | Result | Evidence/control |
| --- | --- | --- |
| V1 Silent substitution | PASS | Build provenance must be non-empty and traceable; no `unknown` fallback remains. |
| V2 Silent healing | PASS | SVG verification reads source and never rewrites it. |
| V3 Silent omission | PASS | Build, generated output, workflows, DevStudio mutation, localization, and account-data boundaries are all mapped. |
| V4 Fail-open control | PASS | Unknown manifest components/dependencies throw; account runtime keys are refused. |
| V5 Corruption-as-absence | PASS | Product/account data remains outside UI deploy roots and is not treated as generated absence. |
| V6 Partial-success masquerade | PASS | Upload-only sync is documented as upload-only; no remote reconciliation claim is made. |
| V7 Masquerade/redress | PASS | Removed local/deploy concepts are not preserved under new names; the 126L gap is assigned directly. |
| V8 Runtime test dependency | PASS | Git/source/deploy paths carry behavior; governance checks verify scoped artifacts only. |

## Step-8 Review Questions

1. Is any active build/deploy/source path missing from this authority map?
2. Is the no-code 126G disposition honest at current source?
3. Is the DevStudio commit-evidence gap assigned precisely enough to 126L
   without creating a second ops subsystem?
4. Does the plan preserve real l10n and product data while keeping R2 sync
   upload-only and explicit?
