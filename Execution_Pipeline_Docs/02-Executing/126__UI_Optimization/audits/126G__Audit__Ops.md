# 126G - Current-Source Pre-Execution Audit: UI Ops

Status: STEP 6 CORRECTED AFTER RED EXACT-TREE STEP-8 REVIEW - current source and
the manual/DevStudio/Prague deploy paths are re-audited through reviewed tree
`85013bc4`; Step 7 is defined in `../126G__PRD__Ops.md`; no Step-9 execution
credit.
PRD: `../126G__PRD__Ops.md`.

## Audit Question

Does current UI ops still contain an incorrect source/build/deploy path that
126G must change, or can the exact remaining gaps be assigned once to the
owning Dieter and DevStudio slices?

## Authority Gate

| Lane | Current authority |
| --- | --- |
| Source | `dieter/**`, repo build/generator scripts, approved UI source in git. |
| Current generated repo output | Tracked `tokyo/product/dieter/**` plus generated Admin/DevStudio files. 126G removes only the tracked Dieter tree; Admin generation is a separate lane. |
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
  `scripts/build-dieter.js`, or `scripts/verify-svgs.js`; current source omits
  root `package.json`, `pnpm-workspace.yaml`, and `pnpm-lock.yaml` even though
  they supply workspace membership, allowed build dependencies, the builder,
  and the bundled dependency graph.
- Missing provenance throws. Empty provenance throws.
- Every declared manifest dependency is validated; unknown components or
  dependencies throw instead of warning and shipping.
- The builder currently asserts only the token wrapper, icon registry/directory,
  and manifest. Because the manifest is derived from output, a missing source
  component can disappear from both output and manifest without failure. Step
  9 must derive the expected path set from source transformation rules and
  compare it exactly with output, including copied-byte parity.
- Generated output is not source authority and inspected generated/source
  token/component bytes are current.

The generated manifest provenance is stale: it records `de408dda`, while the
latest committed Dieter/build input is `c299c783`. A local build exposes exactly
that generated delta. More importantly, DevStudio commits only the source token
file; a rule requiring rebuilt output to match committed generated files would
reject that valid operation. Step 9 therefore removes the generated Dieter tree
from Git rather than creating a second commit protocol. Each build emits the
current scoped SHA into ignored deploy output.

Current `getGitSha()` prefers `CF_PAGES_COMMIT_SHA`, `GITHUB_SHA`,
`VERCEL_GIT_COMMIT_SHA`, or `COMMIT_SHA` before the scoped git query. GitHub can
therefore stamp a deployment commit while a local build stamps the scoped input
commit. Step 9 removes environment deployment-SHA precedence and always derives
the scoped input commit. It also removes generated Dieter output from Git, so
local and CI builds produce the same ephemeral deploy tree without a second
generated-file commit.

`dieter/package.json` also has two false operation surfaces: `main` points to
missing `index.html`, and `prepare` regenerates deployed product output during
dependency installation. The package does have real `@clickeen/ck-contracts`
and `tldts` consumers, so those stay. 126G owns one package cleanup that removes
false `main`, install-time `prepare`, both unused Bob and Dieter GSAP
declarations, and regenerates the shared lockfile once. 126F only verifies that
result.

`scripts/verify-svgs.js` also contains a non-triggering stroke advisory owned by
126C icon authoring. Current 126C evidence reports no stroke warning. It is not
a deploy fallback or a 126G product path, so this audit does not convert it into
ops architecture.

### Cloudflare/R2 path is upload-only but does not build on every entrypoint

- `.github/workflows/cloud-dev-workers.yml` rebuilds Dieter only when Dieter
  source or its two build/verifier scripts change. The broader `tokyo_assets`
  path can still sync generated Dieter-only changes, widget/other product-root
  changes, and workflow dispatch without rebuilding.
- The documented manual sync command invokes the uploader directly and also
  bypasses the build. Once build-before-sync is added, manual remote use would
  still be able to upload uncommitted local bytes unless the existing script
  rejects scoped dirty source/build inputs.
- `pnpm --silent tokyo:r2:sync:check` is the executable JSON contract.
  Build-before-sync must capture or redirect builder progress so stdout remains
  directly parseable; ordinary non-silent pnpm lifecycle banners are outside
  that script-level contract.
- `tokyo/prague/**` is a configured sync source but is absent from both the
  worker workflow trigger and `tokyo_assets` detection. The separate Prague
  content workflow does not sync R2.
- Because the sync script uploads the Dieter root on every invocation, the sync
  script itself must build Dieter before file enumeration in dry-run and remote
  modes. That one rule covers workflow and approved manual use.
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
upload-only sync, and the 126L handoff. Step 9 must update them together to say
that Dieter generated output is ignored deploy input, the sole sync entrypoint
builds it, all four sync roots trigger CI, and local/CI use one scoped manifest
identity.

## Exact Step-7 Disposition

126G has one small build/package integrity write set. The generated manifest
value itself remains assigned to 126F's source-then-build sequence and the
DevStudio product UX gap remains assigned to 126L.

| Area | Integrated Step-9 disposition | Must not do |
| --- | --- | --- |
| Dieter package metadata | Remove false `main`, install-time `prepare`, and the unused Dieter GSAP declaration in one edit. | No install-time generation, false program entrypoint, or duplicate edit from 126F/126H. |
| Dieter build provenance | Remove deployment-environment SHA precedence; always derive the latest commit affecting `dieter/**`, both build scripts, root `package.json`, `pnpm-workspace.yaml`, or `pnpm-lock.yaml`. | No second builder, dependency registry, manifest service, or dual provenance identity. |
| Generated-output completeness | Emit all artifacts and manifest first; then derive the expected path set from actual source transforms, compare expected and generated sets exactly, and byte-compare copied artifacts before success/sync. | No second output manifest, hand-maintained registry, or warning-and-ship path. |
| Generated Dieter output | Remove `tokyo/product/dieter/**` from Git tracking and ignore it; keep it as the builder's ephemeral deploy output. Make Bob import the source icon registry. | No generated-file commit protocol, compatibility copy, or hand edit. |
| Cloudflare/R2 path | Make the sync script build before enumeration in dry-run and remote modes; preserve JSON stdout under `pnpm --silent`; reject tracked and untracked scoped manual remote input through scoped porcelain status while permitting unrelated/ignored files; add `tokyo/prague/**`, root `package.json`, `pnpm-workspace.yaml`, and `pnpm-lock.yaml` to workflow trigger/detection; delete `dieter_artifacts`; remove generated paths from workflow triggers. Prove a clean remote run through exact-SHA Actions, not a manual test upload. | No manual bypass, untracked-byte gap, second deploy lane, reconciliation engine, rollback engine, or successful manual remote probe. |
| Product data/localization | No touch. | No account-data deploy mapping or deletion of real l10n tooling. |
| DevStudio token operation | Hand exact UI/evidence gap to 126L. | No 126G screen patch, approval flow, or new backend. |
| Documentation | Preserve unless a later execution changes an authority. | No past-state narrative as current doctrine. |

Exact deletion map: environment-SHA precedence in `scripts/build-dieter.js`;
false `main` and install-time `prepare` in `dieter/package.json`; the Bob and
Dieter GSAP declarations in 126G's one package-graph edit; all tracked
`tokyo/product/dieter/**` files;
generated-path workflow triggers; and the `dieter_artifacts` workflow variable.
The existing builder gains one source-derived completeness assertion and the
existing sync entrypoint gains one build call; no service, registry, or deploy
lane is added.

## V1-V8 Pre-Execution Result

| ID | Result | Evidence/control |
| --- | --- | --- |
| V1 Silent substitution | OPEN UNTIL STEP 9 | Local and CI must derive the same complete scoped input SHA; deployment SHA plus tracked or untracked manual bytes may not substitute for committed source identity. |
| V2 Silent healing | PASS | SVG verification reads source and never rewrites it. |
| V3 Silent omission | OPEN UNTIL STEP 9 | Complete package/workspace/lock inputs, source-derived output parity, manual dry-run, Prague-only, DevStudio, and workflow paths must all reach the sole sync entrypoint; package install must not regenerate output implicitly. |
| V4 Fail-open control | OPEN UNTIL STEP 9 | Unknown manifest dependencies already throw; missing/unexpected output, build bypass, and tracked/untracked scoped manual remote upload must also fail. |
| V5 Corruption-as-absence | PASS | Product/account data remains outside UI deploy roots and is not treated as generated absence. |
| V6 Partial-success masquerade | OPEN UNTIL STEP 9 | A DevStudio source commit cannot be called successful deployment until its build/sync run reaches R2; 126L exposes that evidence. |
| V7 Masquerade/redress | OPEN UNTIL STEP 9 | Delete committed generated-tree and `dieter_artifacts` vocabulary rather than preserving them under another wrapper. |
| V8 Runtime test dependency | PASS | Git/source/deploy paths carry behavior; governance checks verify scoped artifacts only. |

## Step-8 Review Questions

1. Is any active build/deploy/source path missing from this authority map?
2. Does the package/build/workflow write set cover every current R2 sync path
   without creating a second deploy lane?
3. Is the DevStudio commit-evidence gap assigned precisely enough to 126L
   without creating a second ops subsystem?
4. Does the plan preserve real l10n and product data while keeping R2 sync
   upload-only and explicit?
