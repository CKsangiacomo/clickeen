# 126G - Current-Source Pre-Execution Audit: UI Ops

Status: STEP 6 CORRECTED AFTER 126F STEP-8 REVIEW - current source re-audited
through tree `bccd4785`; Step 7 is defined in `../126G__PRD__Ops.md`; no Step-9
execution credit.
PRD: `../126G__PRD__Ops.md`.

## Audit Question

Does current UI ops still contain an incorrect source/build/deploy path that
126G must change, or can the exact remaining gaps be assigned once to the
owning Dieter and DevStudio slices?

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

All commands completed successfully. DevStudio generation produced no tracked
diff. Dieter generation exposed the stale manifest provenance delta assigned
below to 126F; that generated test delta was restored after inspection. The
dry-run enumerated 680 files under only `dieter/`, `product/`, and `prague/`.
The pre-existing untracked `tokyo/product/fonts/` was not touched.

## Proven Current State

### Build behavior is valid but local/CI identity is not deterministic

- Root `pnpm build:dieter` delegates to `@ck/dieter`, which runs
  `scripts/build-dieter.js`.
- The build verifies source SVGs without mutating them, recreates generated
  Tokyo output, bundles component JS per control, and emits the manifest.
- Local provenance resolves from the last commit affecting `dieter/`,
  `scripts/build-dieter.js`, or `scripts/verify-svgs.js`.
- Missing provenance throws. Empty provenance throws.
- Every declared manifest dependency is validated; unknown components or
  dependencies throw instead of warning and shipping.
- Generated output is not source authority and inspected generated/source
  token/component bytes are current.

The generated manifest provenance is stale: it records `de408dda`, while the
latest committed Dieter/build input is `c299c783`. A local build exposes exactly
that generated delta. 126F already owns a Dieter source change, so its exact
source-commit -> build -> generated-commit sequence repairs provenance once.
126G must not hand-edit or separately regenerate the same artifact.

Current `getGitSha()` prefers `CF_PAGES_COMMIT_SHA`, `GITHUB_SHA`,
`VERCEL_GIT_COMMIT_SHA`, or `COMMIT_SHA` before the scoped git query. GitHub's
full-history checkout then rebuilds Dieter at the generated-output commit and
uploads that uncommitted rebuild to R2 without a parity check. Local committed
output can therefore name scoped input commit A while R2 names deployment
commit B. Step 9 must remove environment deployment-SHA precedence and always
derive the scoped input commit. The workflow must fail after `pnpm build:dieter`
if `tokyo/product/dieter/**` has any tracked or untracked delta, before R2 sync.

`dieter/package.json` also has two false operation surfaces: `main` points to
missing `index.html`, and `prepare` regenerates deployed product output during
dependency installation. The package does have real `@clickeen/ck-contracts`
and `tldts` consumers, so those stay. 126G owns one package cleanup that removes
false `main`, install-time `prepare`, and the unused Dieter GSAP declaration
assigned by 126F.

`scripts/verify-svgs.js` also contains a non-triggering stroke advisory owned by
126C icon authoring. Current 126C evidence reports no stroke warning. It is not
a deploy fallback or a 126G product path, so this audit does not convert it into
ops architecture.

### Cloudflare/R2 path is correct but lacks generated parity enforcement

- `.github/workflows/cloud-dev-workers.yml` rebuilds Dieter when Dieter source
  or its two build/verifier scripts change, but currently does not prove the
  rebuilt generated tree equals git before Tokyo R2 product-root sync.
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

### Living documentation needs the deterministic-build correction

The UI ops, Dieter, DevStudio, Tokyo, Tokyo-worker, and Cloudflare operations
docs agree on source, generated output, deployed runtime, product data,
upload-only sync, and the 126L handoff. UI ops documentation must additionally
record one scoped manifest identity across local/CI and the pre-sync parity
gate; it must not describe the current mismatch as already fixed.

## Exact Step-7 Disposition

126G has one small build/package integrity write set. The generated manifest
value itself remains assigned to 126F's source-then-build sequence and the
DevStudio product UX gap remains assigned to 126L.

| Area | Integrated Step-9 disposition | Must not do |
| --- | --- | --- |
| Dieter package metadata | Remove false `main`, install-time `prepare`, and the unused Dieter GSAP declaration in one edit. | No install-time generation, false program entrypoint, or duplicate edit from 126F/126H. |
| Dieter build provenance | Remove deployment-environment SHA precedence; always derive the latest scoped Dieter/build input commit. | No second builder, manifest service, or dual provenance identity. |
| Current manifest provenance mismatch | 126F regenerates after its committed Dieter source change and proves exact scoped SHA. | No 126G hand edit or duplicate regeneration. |
| Cloudflare/R2 workflow | After build, fail on any tracked/untracked `tokyo/product/dieter/**` delta before R2 sync. | No reconciliation engine, rollback engine, or upload of uncommitted build output. |
| Product data/localization | No touch. | No account-data deploy mapping or deletion of real l10n tooling. |
| DevStudio token operation | Hand exact UI/evidence gap to 126L. | No 126G screen patch, approval flow, or new backend. |
| Documentation | Preserve unless a later execution changes an authority. | No past-state narrative as current doctrine. |

Exact deletion map: environment-SHA precedence in `scripts/build-dieter.js`;
false `main` and install-time `prepare` in `dieter/package.json`; the Dieter
GSAP declaration assigned by 126F. The workflow gains one fail-closed parity
step; it does not gain a service or new deploy lane.

## V1-V8 Pre-Execution Result

| ID | Result | Evidence/control |
| --- | --- | --- |
| V1 Silent substitution | OPEN UNTIL STEP 9 | Local and CI must derive the same scoped input SHA; deployment SHA may not substitute for source identity. |
| V2 Silent healing | PASS | SVG verification reads source and never rewrites it. |
| V3 Silent omission | OPEN UNTIL STEP 9 | Workflow must check generated parity before R2 sync; package install must not regenerate output implicitly. |
| V4 Fail-open control | PASS | Unknown manifest components/dependencies throw; account runtime keys are refused. |
| V5 Corruption-as-absence | PASS | Product/account data remains outside UI deploy roots and is not treated as generated absence. |
| V6 Partial-success masquerade | OPEN UNTIL STEP 9 | Deploy cannot report success when CI rebuilt bytes differ from committed generated output. |
| V7 Masquerade/redress | PASS | Removed local/deploy concepts are not preserved under new names; the 126L gap is assigned directly. |
| V8 Runtime test dependency | PASS | Git/source/deploy paths carry behavior; governance checks verify scoped artifacts only. |

## Step-8 Review Questions

1. Is any active build/deploy/source path missing from this authority map?
2. Is the no-code 126G disposition honest at current source?
3. Is the DevStudio commit-evidence gap assigned precisely enough to 126L
   without creating a second ops subsystem?
4. Does the plan preserve real l10n and product data while keeping R2 sync
   upload-only and explicit?
