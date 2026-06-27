# PRD 124C - Base Artifact Reroute

Status: EXECUTED
Parent: `124__MAMA__Overlay_Aware_Runtime_Materializer_Program.md`
Depends on: 124A GREEN, 124B CODE-DELIVERED
Owner: Roma account instance save path

## Purpose

Reroute current base public package generation through
`packages/ck-runtime-materializer` while preserving current public behavior.

This is the first runtime code slice. It must be boring:

```text
same base source truth -> same index.html/styles.css/runtime.js -> same Tokyo stored bytes contract
```

124C does not introduce locale artifacts, public locale URLs, Tokyo serving
changes, page serving, or dependency cascade. It changes the implementation
path for base package generation only.

## Execution Prerequisite

124B must be code-delivered before 124C execution starts. Plan-green is not
enough.

Required 124B facts:

```text
packages/ck-runtime-materializer/package.json exists
packages/ck-runtime-materializer/src/index.ts exists
packages/ck-runtime-materializer/tests/run-runtime-materializer-contract.ts exists
pnpm-workspace.yaml includes packages/ck-runtime-materializer
pnpm --filter @clickeen/ck-runtime-materializer typecheck passes
pnpm --filter @clickeen/ck-runtime-materializer test passes
```

If any fact is missing, 124C stops before wiring Roma.

## Non-Reinterpretation Tenet

124C must not reinterpret 124A/124B into a better system and then add machinery
to enforce that interpretation.

Forbidden additions in 124C:

- request-time composition;
- public URL redesign;
- locale URL exposure;
- storage migration;
- sidecar product-state objects;
- compatibility readers;
- background recomputation;
- package repair;
- product probes;
- policy evaluation inside the materializer;
- any route, worker, or service that does not already own the operation.

## Current Owner

Current base package generation lives in:

```text
roma/lib/account-instance-public-package.ts
```

The current Roma call sites are:

```text
roma/app/api/account/instances/route.ts
roma/app/api/account/instances/[instanceId]/route.ts
roma/app/api/account/instances/[instanceId]/duplicate/route.ts
```

Current Tokyo package storage/fingerprint behavior lives in:

```text
tokyo-worker/src/domains/account-instances/package-files.ts
```

## Authority Gate

| Concern | Active authority for 124C |
| --- | --- |
| Product surface | Account widget instance base public package |
| Account/session coordinate | Roma current account/session bootstrap |
| Storage coordinate | Existing Tokyo account instance package path: `accounts/{accountPublicId}/instances/{instanceId}/index.html`, `styles.css`, `runtime.js` |
| Route/API boundary | Existing Roma account instance create/save/duplicate routes and existing Tokyo account instance write routes |
| Runtime/deploy surface | Roma code path only; Tokyo public serving behavior unchanged. If merged/deployed, Roma deploy path is Cloudflare Pages Git-connected build from `main` |
| Verification surface | Roma focused tests, package tests, Tokyo package fingerprint tests, local typecheck/lint for touched packages |

### Compliance Rationale

This is compliant because the named authorities do not move. Roma remains the
command owner for account instance creation/save/duplicate. Tokyo remains the
storage owner. The materializer package receives explicit inputs and returns
bytes; it does not become an account, route, storage, policy, or serving
authority.

## Slice 1 - Call-Path Inventory Lock

### Goal

Lock the exact base-package paths before changing code.

### Steps

1. Read `roma/lib/account-instance-public-package.ts`.
2. Confirm the current split:
   - `compileWidgetForInstancePackage` calls Bob's compiled widget route;
   - `materializePublicPackageMedia` resolves account media through Tokyo;
   - `buildSavedWidgetPublicPackage` builds `index.html`, `styles.css`, and
     `runtime.js`;
   - `materializeAccountInstancePublicPackage` returns the package or exact
     route error.
3. Read the three Roma call sites:
   - create instance;
   - save existing instance;
   - duplicate instance.
4. Read `tokyo-worker/src/domains/account-instances/package-files.ts` and
   confirm Tokyo still expects the same submitted shape:
   - `indexHtml`;
   - `stylesCss`;
   - `runtimeJs`.
5. Record any discovered mismatch in this 124 folder before implementation.

### Output

An implementation note naming every function moved, kept, or left untouched.

### Compliance Rationale

This is compliant because 124C starts from current behavior and named code
owners. It prevents an agent from using the materializer as an excuse to
redesign serving, storage, or account commands.

## Slice 2 - Package Dependency Wiring

### Goal

Allow Roma to call `@clickeen/ck-runtime-materializer`.

### Steps

1. Confirm the 124B code-delivered facts from the Execution Prerequisite.
2. Add Roma's package dependency on the materializer package.
3. Do not add dependency edges from the materializer back to Roma, Tokyo-worker,
   Bob route modules, Supabase, Cloudflare bindings, or environment config.
4. Keep `compileWidgetForInstancePackage` in Roma because Bob route access is a
   Roma boundary concern.
5. Keep `materializePublicPackageMedia` in Roma because account asset
   resolution uses Roma's current account capsule and Tokyo asset-control route.

### Output

Roma can import the materializer package without creating a reverse dependency
or new subsystem.

### Compliance Rationale

This is compliant because the pure package stays below Roma. Roma brings
declared inputs to it; the package does not reach upward into account/session,
routes, storage, or integrations.

## Slice 3 - Input Adapter In Roma

### Goal

Create the smallest adapter from Roma's current data to the 124B input
contract.

### Adapter Harness Prerequisite

Before changing the adapter, choose the exact Roma-side test surface for this
reroute. The adapter is the reroute boundary, so this decision must happen
before Slice 3 implementation.

Allowed choices:

- a focused Roma `tsx`/TypeScript runner that exercises the adapter directly;
- an existing focused Roma route/unit test surface that can prove the adapter
  input and output without Cloudflare state.

The chosen harness must prove byte-exact package output, not semantic equality.

### Steps

1. Keep the public exported Roma function name
   `materializeAccountInstancePublicPackage` unless a focused code reason
   requires a rename.
2. After media resolution succeeds, build the materializer input from existing
   local variables:
   - compiled widget package files;
   - compiled editable-fields/schema contract;
   - instance id;
   - base locale;
   - requested locale equal to base locale;
   - display name;
   - media-materialized base state;
   - caller-decided byte-affecting values from current Roma inputs;
   - `sourceFingerprint` computed locally by Roma from the source/config/content
     inputs consumed by base materialization;
   - `schemaWidgetContractFingerprint` computed locally by Roma from the
     compiled widget schema/editable-fields contract used by base
     materialization.
3. Pass no overlay for 124C.
4. Pass no fallback locale candidates.
5. Pass no auth/session/request objects.
6. Pass no Tokyo client, fetch function, environment variable, route helper, or
   storage object.
7. Use the package-owned `RUNTIME_MATERIALIZER_CONTRACT_VERSION`/materializer
   output evidence. Roma must not invent or pass an arbitrary materializer
   version string.
8. Pin the `@clickeen/ck-contracts` input that governs state bytes in the
   implementation note. At minimum, record the `materializeConfigMedia` path and
   the editable-fields contract/hash used for the parity matrix.
9. Map package errors back to the current `InstancePackageFailure` shape.

124C computes source/schema fingerprints only as local materializer evidence.
It must not persist those fingerprints to Tokyo, R2 metadata, sidecar files, or
product status in this slice. Persistence and fail-closed enforcement beyond
the current `publicPackageFingerprint` remain 124E or later work.

### Output

A Roma-local adapter that calls the 124B base resolver and returns the same
public package shape the Tokyo write path already accepts.

### Compliance Rationale

This is compliant because Roma remains the only caller that knows account
context, media resolution, and route error semantics. The package receives only
declared data. Base locale generation cannot accidentally become locale serving
or request-time interpretation.

## Slice 4 - Base Resolver Reroute

### Goal

Replace Roma's internal base-file builder with the materializer package while
preserving generated output.

### Steps

1. Move or delete only the pure builder logic that 124B now owns:
   - HTML body extraction;
   - package root stamping;
   - stylesheet chunk generation;
   - runtime payload/module chunk generation;
   - index HTML generation.
2. Keep Roma-owned logic in Roma:
   - Bob compiled-widget route call;
   - Tokyo asset resolution;
   - route error shaping;
   - account/session handling.
3. Generate base output through the materializer package for create, save, and
   duplicate.
4. Preserve current output names:
   - `indexHtml`;
   - `stylesCss`;
   - `runtimeJs`.
5. Preserve current base runtime payload semantics:
   - selected locale is base locale;
   - `languages` contains only the base locale;
   - `window.CK_WIDGETS[instanceId].state` is the base state.
6. Preserve social-share inclusion semantics from current code.
7. Preserve package-root invalid failure semantics.
8. Preserve missing widget package failure semantics.
9. Preserve byte-exact state serialization:
   - the `runtime.js` payload must match current `JSON.stringify` output;
   - state object key order must not drift through adapter reconstruction;
   - parity must compare exact `index.html`, `styles.css`, and `runtime.js`
     strings, not semantic equivalence.

### Output

Roma's public package generation calls the package for base artifacts and
returns the same externally observable bytes for supported current cases.

### Compliance Rationale

This is compliant because it is an implementation reroute, not a product
behavior change. It keeps the current base artifact contract intact while
placing deterministic byte generation in the schema-aware package required by
124B.

## Slice 5 - Tokyo Contract Preservation

### Goal

Keep Tokyo storage and fingerprint behavior unchanged.

### Steps

1. Do not change the submitted package field names unless 124B output requires a
   Roma-local mapping back to the current Tokyo shape.
2. Do not change Tokyo's package object keys:
   - `index.html`;
   - `styles.css`;
   - `runtime.js`.
3. Do not change Tokyo's package content types.
4. Do not change Tokyo's package fingerprint algorithm in 124C.
5. Do not write materializer evidence to R2 in 124C unless 124A/124B already
   made it part of the submitted package shape and Tokyo currently accepts it.
6. If 124B evidence differs from Tokyo's current package fingerprint, keep the
   124B evidence local to Roma/package tests and leave Tokyo behavior unchanged.

### Output

Tokyo receives the same package shape it receives today.

### Compliance Rationale

This is compliant because 124C must not turn a Roma reroute into a Tokyo storage
contract migration. CDN and public serving remain protected because stored
bytes and package agreement behavior remain stable.

## Slice 6 - Error And Failure Mapping

### Goal

Fail in the same command boundary without hiding partial work.

### Steps

1. Preserve existing create/save/duplicate command order:
   - compile;
   - account policy gate;
   - media resolution;
   - package materialization;
   - source artifact materialization;
   - Tokyo write.
2. If materializer input is invalid, return the current 422
   `InstancePackageFailure` style.
3. If widget package files are missing, return the current package-missing
   reason keys.
4. If media resolution fails, preserve current media-resolution reason keys.
5. Do not submit source artifacts to Tokyo when package generation fails.
6. Do not submit package bytes to Tokyo when source artifact generation fails.
7. Do not claim create/save/duplicate success unless the existing Tokyo write
   path succeeds.
8. Materializer error mapping must be total. Every
   `RuntimeMaterializerErrorReason` must map to a current Roma
   `InstancePackageFailure`/reason-key shape, with no internal package reason or
   stack detail leaking through.

Required materializer reasons to map:

```text
compiled_widget_invalid
widget_package_missing
widget_package_file_missing
widget_package_root_invalid
locale_coordinate_invalid
locale_overlay_missing
locale_overlay_unexpected_for_base
locale_overlay_locale_mismatch
locale_overlay_key_missing
locale_overlay_key_unexpected
locale_overlay_value_invalid
locale_overlay_scope_unsupported
source_state_invalid
```

Implementation should use an exhaustive switch or equivalent compile-time guard
so a new package reason cannot silently bypass Roma error shaping.

### Output

Failure behavior remains command-scoped and visible to Roma callers.

### Compliance Rationale

This is compliant with V1-V8 because it avoids silent substitution, silent
omission, and partial-success masquerade. The command either produces the exact
declared package/source pair or fails in the owning Roma route.

## Slice 7 - Focused Tests

### Goal

Prove the reroute preserves base behavior.

### Required Tests

1. Package-level base fixture test:
   - current source input;
   - generated `index.html`, `styles.css`, and `runtime.js` match the current
     expected base fixture.
   - the base fixture must be captured from the current Roma builder before the
     reroute, or the test must compare old-builder output to materializer output
     during the reroute. 124C must not regenerate a new expected fixture from
     the new package path and call that parity.
2. Roma adapter test:
   - media-materialized state goes into package input;
   - no overlay is passed;
   - requested locale equals base locale.
   - source/schema fingerprints are computed locally and passed as evidence;
   - materializer contract version comes from the package-owned constant/output.
3. Create route test or existing focused equivalent:
   - create still submits `publicPackage.indexHtml/stylesCss/runtimeJs`.
4. Save route test or existing focused equivalent:
   - save still submits the same package shape.
5. Duplicate route test or existing focused equivalent:
   - duplicate still regenerates base package for the new instance id.
6. Error mapping test:
   - missing widget package file returns the current route failure shape.
7. Dependency guard test:
   - materializer package has no forbidden imports;
   - Roma is the only new caller in 124C.
8. Byte-exact state serialization test:
   - compare exact `runtime.js` strings;
   - fail on state key-order drift.
9. All-widget dual-build parity matrix:
   - `big-bang`;
   - `calltoaction`;
   - `cards`;
   - `countdown`;
   - `faq`;
   - `logoshowcase`;
   - `split-carousel-media`;
   - `split-media`.

The matrix must compare current Roma builder output to materializer-rerouted
output for exact `index.html`, `styles.css`, and `runtime.js` bytes. One
synthetic fixture is not enough for 124C deploy/merge evidence.

### Output

Focused tests that prove the base artifact reroute without relying on public
serving or Cloudflare state.

### Compliance Rationale

This is compliant because tests prove the code contract at the owning layer.
They do not become product truth, runtime checks, or customer-visible state.

## Slice 8 - Runtime Verification

### Goal

Verify through the owner of the changed truth.

### Steps

1. Run package tests for `@clickeen/ck-runtime-materializer`.
2. Run focused Roma tests for account instance package generation.
3. Run focused Tokyo package-file tests only if the submitted package shape or
   type imports changed.
4. Run Roma typecheck or focused workspace typecheck.
5. Do not claim deploy or merge readiness until byte-exact parity, the
   all-widget dual-build matrix, total error mapping, and the Roma adapter
   harness evidence are complete.
6. If deployment is requested with 124C execution, use the repo Cloudflare
   operation path from `documentation/engineering/CloudflareOperations.md`.
7. Runtime evidence, if deploy is claimed, comes from Cloudflare Pages build
   state and the cloud-dev Roma/account instance package path.
8. If 124C is not deployed, closeout must explicitly state that no
   deploy/runtime claim was made.

### Output

Evidence that the reroute works before any deploy claim.

### Compliance Rationale

This is compliant because verification follows the owning surfaces: package for
pure byte generation, Roma for account commands, Tokyo only if its contract is
touched, Cloudflare only for deploy/runtime evidence.

## Slice 9 - 124C Closeout Gate

### Steps

1. Confirm generated base public package behavior is unchanged.
2. Confirm no non-base locale artifact is generated.
3. Confirm no public locale URL is exposed.
4. Confirm Tokyo package fingerprint behavior is unchanged.
5. Confirm materializer evidence is not persisted as a product-status system.
6. Confirm create, save, and duplicate still route through existing Roma account
   instance authorities.
7. Confirm 124B was code-delivered before Roma wiring.
8. Confirm byte-exact parity passed for `index.html`, `styles.css`, and
   `runtime.js`.
9. Confirm the all-widget dual-build parity matrix passed.
10. Confirm every materializer error reason has a total Roma mapping.
11. Confirm source/schema fingerprints remain local evidence only and are not
    persisted as product truth in 124C.
12. Record commit/push/deploy state for the code change.
13. Reconcile whether verification stopped at local package/Roma checks or
   included deployed Roma runtime evidence.
14. Record V1-V8 audit.

### Acceptance

- Existing create/save/duplicate behavior is unchanged for base artifacts.
- Public base serving still reads `index.html`, `styles.css`, and `runtime.js`
  from the existing account instance folder.
- Roma calls the package for base artifact byte generation.
- Tokyo package storage and package fingerprint behavior are unchanged.
- Focused package/Roma checks pass.
- Byte-exact all-widget parity passes before any deploy/merge claim.
- Roma adapter harness is chosen and passing.
- Source/schema fingerprint computation ownership is local to Roma in 124C and
  does not create persistence/enforcement beyond current Tokyo package
  fingerprint behavior.
- No locale serving is exposed.

## Required Documentation Updates

124C changes current runtime implementation, so update docs only where the
current-system owner statement changes:

- `documentation/services/roma.md`: Roma now delegates deterministic base byte
  generation to `@clickeen/ck-runtime-materializer` after Roma-owned compile,
  policy, and media resolution.
- `documentation/services/tokyo-worker.md`: only if the submitted package shape,
  metadata, or storage behavior changes. Expected outcome: no Tokyo doc change.
- `documentation/architecture/RuntimeProfiles.md`: only if runtime file
  locations or base public package semantics change. Expected outcome: no
  RuntimeProfiles doc change.
- Local 124 implementation note: always record the function extraction/reroute
  map from Slice 1, 124B code-delivered evidence, chosen Roma adapter harness,
  all-widget parity matrix, state-serialization parity evidence, and
  source/schema fingerprint inputs.
