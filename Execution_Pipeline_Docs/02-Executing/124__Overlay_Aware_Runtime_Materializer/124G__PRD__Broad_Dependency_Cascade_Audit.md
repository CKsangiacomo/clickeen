# PRD 124G - Broad Dependency Cascade Audit

Status: EXECUTING
Parent: `124__MAMA__Overlay_Aware_Runtime_Materializer_Program.md`
Depends on: 124A GREEN, 124B GREEN, 124C GREEN, 124D GREEN, 124E GREEN, 124F GREEN
Owner: Architecture + DevOps/Product Operations

## Purpose

Audit broad dependency movement and define the contract for future broad
re-resolution.

124G does not implement mass re-resolution. It answers:

- which broad dependencies can make generated artifacts no longer current;
- which dependencies are already sealed into stored package bytes;
- which dependencies remain external references;
- what evidence/version fields must exist before future broad operations;
- what authority must approve and operate any broad re-resolution.

124G also records the honest residual risk: after this audit, there is still no
system-wide executor that can re-resolve every published artifact after a broad
base-layer change. Widget software, Dieter/static files, shared runtime, or
materializer changes can make many stored artifacts stale until a named account
command regenerates them, public serving rejects them from already-available
evidence, or a later broad re-resolution PRD implements the authority gate
defined here.

## Product Law

Stored runtime artifacts are product bytes, not live views over widget source.
Public serving must not discover broad dependency changes on visitor requests.

Broad dependency movement is not handled by hidden runtime machinery. It is
handled by explicit evidence contracts and named operator commands.

The missing system-wide executor is explicit residual risk, not hidden product
behavior. 124G must not imply that broad dependency freshness is solved until a
future named broad re-resolution command exists.

## Non-Reinterpretation Tenet

124G must not reinterpret broad dependency freshness into a legacy orchestration
system.

Forbidden additions in 124G:

- broad dependency service;
- event bus;
- scheduler;
- background regeneration job;
- runtime scanner;
- public-request dependency lookup;
- product status store;
- readiness marker;
- repair/backfill routine;
- storage walk that mutates product data;
- compatibility reader for old package shapes;
- hidden automatic mass re-resolution.

## Authority Gate

| Concern | Active authority for 124G |
| --- | --- |
| Product surface | Generated account widget package artifacts and their broad dependency evidence |
| Account/session coordinate | None for audit; future operation must name an account/coordinate authority |
| Storage coordinate | Existing Tokyo account instance package/locale package paths |
| Route/API boundary | No runtime route change in 124G |
| Runtime/deploy surface | Documentation and contract only unless later PRD implements a named operation |
| Verification surface | Documentation consistency checks and focused code inventory |

### Compliance Rationale

This is compliant because 124G is a contract/audit slice. It does not mutate
product data, serving behavior, or broad account coordinates.

## Slice 1 - Broad Dependency Inventory

### Goal

Name the current broad dependencies that can affect generated package bytes.

### Dependencies To Inventory

- widget `spec.json`;
- widget `editable-fields.json`;
- widget `limits.json`;
- widget `widget.html`;
- widget `widget.css`;
- widget `widget.client.js`;
- widget shared runtime files under `tokyo/product/widgets/shared/`;
- Dieter files referenced by generated packages;
- font/product static files referenced by generated packages;
- materializer package version/contract;
- runtime shell markers from `@clickeen/widget-shell`;
- account asset references used by generated packages.

### Steps

1. Read widget docs and source folders.
2. For each dependency, record whether it is:
   - sealed into generated package bytes;
   - referenced by generated package bytes through a URL/import;
   - part of schema/token identity;
   - part of materializer evidence/version.
3. Record the current code fact where package builder behavior already proves
   the sealed/external split:
   - widget CSS/JS pulled from compiled widget files are sealed into package
     bytes;
   - `/dieter/**` stylesheet references remain live external `@import`
     references.
4. Record the current owner:
   - widget source;
   - shared widget runtime;
   - Dieter;
   - Tokyo deploy asset;
   - account asset;
   - materializer package.
5. Record whether existing generated artifacts must change when that dependency
   changes.
6. Stop if any dependency cannot be classified without guessing.

### Output

A dependency classification table in the 124 folder.

### Compliance Rationale

This is compliant because broad dependency handling starts from named source
truth and existing generated artifact behavior. It avoids implicit fan-out.

## Slice 2 - Sealed-Bytes Rule

### Goal

Define what happens when a dependency was already embedded into stored package
bytes.

### Steps

1. Identify dependencies included directly inside `index.html`, `styles.css`, or
   `runtime.js`.
   Current Roma package building inlines widget CSS and widget client/runtime
   JavaScript into stored package bytes.
2. Record that existing public artifacts continue serving their stored bytes
   until an explicit account command regenerates them or public serving rejects
   them from evidence already available under the 124E public serving contract.
3. Do not treat a widget source deploy as automatic mutation of stored account
   package bytes.
4. Do not make Tokyo public serving compare stored bytes to current widget
   source on request.
5. Public serving must not compare stored artifacts to current
   widget/Dieter/materializer/account asset source on visitor requests.
6. Do not rewrite stored packages from a deploy hook in 124G.

### Output

A sealed-bytes rule for generated package artifacts.

### Compliance Rationale

This is compliant because stored package files are the public artifact. Broad
source movement does not silently mutate account-owned bytes.

## Slice 3 - External Reference Rule

### Goal

Define dependencies that remain live external references from generated package
bytes.

### Steps

1. Identify generated package references to external static paths such as
   `/dieter/**`, `/fonts/**`, account asset URLs, and product static files.
   Current Roma package building keeps `/dieter/**` stylesheet references as
   live external `@import` references rather than inlining them into account
   package bytes.
2. For each external reference, record:
   - owning root;
   - cache behavior;
   - deploy path;
   - whether content is immutable/content-addressed;
   - whether a change affects already-stored packages without regenerating
     package bytes.
3. If a referenced dependency is mutable and can change generated runtime
   behavior, record it as a broad dependency risk.
4. Do not solve mutable external reference risk by adding visitor-time checks.
5. Do not silently copy external dependencies into account packages unless a
   later PRD explicitly changes the package contract.

### Output

An external-reference risk table.

### Compliance Rationale

This is compliant because it exposes real current coupling without inventing
runtime machinery.

## Slice 4 - Evidence And Version Contract

### Goal

Define the minimum artifact evidence needed to detect current/future broad
dependency mismatch.

### Steps

1. Read the 124A evidence contract.
2. Separate current persisted evidence from target-state evidence:
   - current persisted package truth includes `publicPackageFingerprint`;
   - `materializerContractVersion`, `sourceFingerprint`,
     `schemaWidgetContractFingerprint`, and `overlayFingerprint` are target-state
     evidence fields until 124B-124E code-deliver them.
3. Confirm generated packages record the materializer contract version only
   after 124B/124C code-deliver that field.
4. Confirm generated packages record source/widget/materializer fingerprints
   required by 124A only after 124C/124E code-deliver those fields.
5. Confirm locale packages record the same evidence plus requested locale only
   after 124D/124E code-deliver locale package evidence.
6. Define materializer contract compatibility:
   - same version is compatible;
   - new version must declare old artifact serve-compatibility or require
     explicit re-resolution;
   - unknown version fails closed only if public serving has a named expected
     version source from 124A/124E.
7. Do not add package-body status fields.
8. Do not add public-serving recomputation of evidence.
9. Do not invent an expected-version store in 124G.

Broad dependency mismatch detection is for operator/audit/future command
decisions unless 124E already names the evidence as public-request-readable.
124G must not create an expected-current dependency lookup for public serving.

Operator stale-artifact enumeration is not implemented by 124G. A future broad
re-resolution PRD must explicitly name how an operator asks "which coordinates
are stale after this dependency changed" before it can mutate account artifacts
at scale.

### Output

An evidence/version compatibility table.

### Compliance Rationale

This is compliant because artifact evidence is generated at write time and used
by the owning serving/storage boundary. It does not become a runtime discovery
system.

## Slice 5 - Existing Unmarked Artifact Rule

### Goal

Handle artifacts that predate the new evidence contract without silent fallback.

### Steps

1. Inventory current base package behavior for unmarked source/package files.
2. Keep existing base compatibility only where current Tokyo code already
   allows it.
3. For new locale artifacts created by 124D, require the new evidence contract;
   no unmarked locale artifact may be served by 124E.
4. Any marked/unmarked mix must fail closed according to existing Tokyo package
   agreement behavior.
5. Do not add compatibility readers for old locale package paths or bodies.
6. Do not rewrite unmarked artifacts in 124G.

### Output

A precise unmarked-artifact compatibility rule.

### Compliance Rationale

This is compliant because old artifact handling remains explicit and bounded.
It avoids silent fallback and hidden data repair.

## Slice 6 - Future Broad Re-Resolution Authority

### Goal

Define the gate for any later broad re-resolution operation without
implementing it.

### Required Authority Before Future Implementation

Any future broad re-resolution PRD must name:

- the dependency that changed;
- the exact artifact evidence field affected;
- the account/instance coordinate source;
- the operator authority;
- the command path;
- the maximum coordinate count per operation;
- the cost ceiling;
- the failure response shape;
- the deploy/Cloudflare evidence path;
- the V1-V8 audit method;
- the operator stale-coordinate enumeration command or report, if the operation
  depends on finding all artifacts affected by a broad dependency change.

### Steps

1. State that 124G implements no broad re-resolution code.
2. State that a future broad operation cannot run from public serving.
3. State that a future broad operation cannot run from a hidden background
   process.
4. State that a future broad operation must receive exact coordinates from a
   named product/operator authority before it mutates account artifacts.
5. State that failures must name exact incomplete coordinates.
6. State that existing artifacts remain as stored bytes unless the future
   operation explicitly regenerates them or public serving rejects them from
   evidence already available under the 124E public serving contract.
7. State that future stale-coordinate enumeration cannot be a storage scan that
   mutates product data, a visitor-time lookup, a hidden scheduler, or an
   unbounded background repair. It must be an explicit operator/audit command
   with named coordinate source, maximum coordinate count, and failure shape.

### Output

A future-operation gate, not a broad operation.

### Compliance Rationale

This is compliant because it preserves agent-operable authority without adding
legacy orchestration machinery.

## Slice 7 - Deployment And Cloudflare Evidence

### Goal

Define how broad dependency deploys are evidenced.

### Steps

1. For widget source/shared runtime/Dieter deploy changes, use the repo's Tokyo
   product-root deploy path.
2. For Tokyo-worker serving evidence changes, use GitHub Actions
   `cloud-dev workers deploy`.
3. For Roma code changes, use Cloudflare Pages Git-connected build from `main`.
4. For R2 product-root evidence, run `pnpm cf:preflight` before R2 reads.
5. For Cloudflare Pages/API/config evidence, run `pnpm cf:api:preflight` before
   API reads.
6. Do not claim broad runtime freshness from local build success alone.

### Output

Deployment evidence rules for future broad dependency work.

### Compliance Rationale

This is compliant because broad dependency deploy evidence comes from the owning
deploy surface, not from local assumptions.

## Slice 8 - Audit Tests And Checks

### Goal

Prove the audit contract is internally consistent.

### Required Checks

1. Documentation consistency check:
   - `documentation/services/tokyo.md`;
   - `documentation/services/tokyo-worker.md`;
   - widget authoring/shared docs;
   - 124A/124B/124E evidence docs.
2. Code inventory check:
   - generated package builder inputs;
   - materializer evidence inputs;
   - public serving evidence reads;
   - external static references.
3. No implementation check:
   - 124G does not add runtime routes;
   - 124G does not add scanners;
   - 124G does not add status files;
   - 124G does not add mass mutation commands.
4. Current-vs-target evidence check:
   - current code does not claim target-state evidence fields exist until the
     owning earlier slice code-delivers them;
   - audit tables label target-state evidence as deferred when the field is not
     yet persisted.
5. Future stale-enumeration check:
   - 124G records the need for a future operator stale-coordinate enumeration
     surface, but adds no route, scanner, scheduler, or product status store.

### Output

Audit evidence for the contract, not runtime behavior.

### Compliance Rationale

This is compliant because checks support the audit and do not become product
truth or runtime validation.

## Slice 9 - 124G Closeout Gate

### Steps

1. Confirm every broad dependency is classified.
2. Confirm sealed-byte dependencies and external references are separated.
3. Confirm evidence/version compatibility rules are explicit.
4. Confirm existing unmarked artifacts have a bounded rule.
5. Confirm future broad re-resolution requires a separate named authority and
   command.
6. Confirm target-state evidence fields are not represented as current persisted
   code truth before their owning earlier slices code-deliver them.
7. Confirm the future stale-coordinate enumeration need is sequenced without
   adding an implementation in 124G.
8. Confirm no runtime scanner/status store/broad mutation command was added.
9. Record commit/push/deploy state.
10. Reconcile whether verification stopped at documentation/code inventory or
   included deployed evidence.
11. Record V1-V8 audit.

### Acceptance

- Broad dependency changes can be reasoned from artifact evidence and dependency
  classification.
- No broad mass re-resolution runs without a later named authority and
  blast-radius controls.
- Materializer contract version compatibility rules are explicit.
- Target-state evidence fields are labeled as target-state until code-delivered.
- Existing unmarked artifacts are handled without silent fallback.
- Future operator stale-coordinate enumeration is named as required future scope,
  without adding hidden runtime machinery in 124G.
- 124G adds no hidden runtime machinery.

## Required Documentation Updates

Update current-system docs only for clarified contracts:

- `documentation/services/tokyo.md`: account runtime shape, sealed generated
  package bytes, and external reference caveats if changed.
- `documentation/services/tokyo-worker.md`: public serving evidence and
  unmarked artifact behavior if changed.
- `documentation/widgets/README.md`: broad dependency classification for widget
  source/shared runtime changes.
- `documentation/widgets/authoring/WidgetFiles.md`: generated package dependency
  behavior if changed.
- `documentation/widgets/shared/ShellUtilities.md`: shared runtime files as
  broad dependencies if changed.
- `documentation/architecture/RuntimeProfiles.md`: artifact evidence/version
  fields if changed.
- `documentation/architecture/AssetManagement.md`: account asset references as
  external dependencies of generated packages if the audit changes current
  asset/runtime claims.
- Dieter/product static documentation: update the owning Dieter/static runtime
  reference doc if the audit changes current claims about generated package
  dependencies or cache behavior.
- 124 implementation note: dependency classification table and future broad
  re-resolution gate.
