# PRD 124B - Pure Runtime Materializer Package

Status: EXECUTED
Parent: `124__MAMA__Overlay_Aware_Runtime_Materializer_Program.md`
Depends on: 124A GREEN
Owner: Runtime package contract

## Purpose

Implement the first real substrate for PRD 124:

```text
packages/ck-runtime-materializer
```

The package is a pure resolver:

```text
explicit schema + source state + selected locale overlay -> package files + evidence
```

124B is not plan-only. It must leave executable code, package-local tests, and
deterministic parity evidence. 124C-124H cannot execute until 124B exists.

124B must not change Roma runtime behavior. Roma integration happens in 124C.

## Execution Doctrine

124B must execute from 124A. It may not reinterpret 124A into a larger ideal
system and then add machinery to enforce that interpretation.

The materializer is not:

- a Worker;
- a service;
- an agent;
- a storage writer;
- a policy engine;
- a purge owner;
- a runtime validator;
- a product-status system;
- a route layer;
- a broad dependency engine.

It is a pure TypeScript package over explicit input.

## Code-Execution Contract

124B is complete only when these repo facts are true:

```text
Execution_Pipeline_Docs/03-Executed/124__Overlay_Aware_Runtime_Materializer/124A__Contract_Lock_Addendum.md exists
Execution_Pipeline_Docs/03-Executed/124__Overlay_Aware_Runtime_Materializer/124B__Implementation_Note__Pure_Runtime_Materializer_Package.md exists
packages/ck-runtime-materializer/package.json exists
packages/ck-runtime-materializer/tsconfig.json exists
packages/ck-runtime-materializer/src/index.ts exists
packages/ck-runtime-materializer/tests/run-runtime-materializer-contract.ts exists
pnpm-workspace.yaml includes packages/ck-runtime-materializer
pnpm --filter @clickeen/ck-runtime-materializer typecheck passes
pnpm --filter @clickeen/ck-runtime-materializer test passes
```

No later SubPRD may treat 124B as delivered until those facts are true.

If the 124A contract addendum does not exist, 124B execution stops before code.
That is not optional pre-work; it is the schema authority 124B implements.

## Test Harness Decision

124B must add a package-local contract test runner using existing repo tooling:

```text
tsx + node:assert/strict
```

Do not add Vitest/Jest or a new test framework in 124B.

Rationale:

- the repo already uses `tsx` contract/eval runners in agent packages;
- package-local deterministic tests are enough for this substrate;
- adding a test framework is broader repo machinery and not required to prove
  this package.

If a future repo-wide test framework is desired, it needs its own tooling PRD.

## Authority Gate

| Concern | Active authority for 124B |
| --- | --- |
| Product surface | None changed; package-only work |
| Account/session coordinate | Input value only; no auth/session lookup |
| Storage coordinate | Input/output value only; no storage mutation |
| Route/API boundary | None |
| Runtime/deploy surface | Local package build/test only |
| Verification surface | Package contract runner, package typecheck, forbidden import guard |

### Compliance Rationale

This is compliant because 124B creates the pure package substrate without
touching live product routes, Tokyo storage, Roma commands, Cloudflare, or
remote account data.

## Slice 0 - 124A Implementation Note Check

### Goal

Block implementation if 124A did not lock the values 124B needs.

### Required 124A Inputs

Before writing package code, the implementer must locate the 124A contract note:

```text
Execution_Pipeline_Docs/03-Executed/124__Overlay_Aware_Runtime_Materializer/124A__Contract_Lock_Addendum.md
```

That note must name:

- canonical overlay key representation;
- scalar/repeated field support scope;
- locale artifact coordinate shape;
- package fingerprint algorithm;
- evidence fields;
- preview/public parity mechanism;
- failure reason keys for materializer rejection.

### Steps

1. Read `124A__PRD__Schema_Token_Contract_Lock.md`.
2. Read `124A__Contract_Lock_Addendum.md`.
3. If the note is missing any required value, stop and update 124A first.
4. Do not choose these values inside 124B code.

### Output

124B implementation uses named 124A values, not invented local assumptions.

### Compliance Rationale

This is compliant because schema/product law drives the package. The package
does not decide identity, URL, evidence, or failure semantics.

## Slice 1 - Workspace And Package Scaffolding

### Goal

Add the new package with repo-native workspace wiring.

### Files To Create

```text
packages/ck-runtime-materializer/
  package.json
  tsconfig.json
  README.md
  src/
    index.ts
    types.ts
    errors.ts
    html.ts
    files.ts
    runtime.ts
    overlay.ts
    fingerprint.ts
    materialize.ts
  tests/
    run-runtime-materializer-contract.ts
    fixtures/
      base-input.ts
      base-expected.ts
      locale-overlay-input.ts
```

### Workspace Changes

Update `pnpm-workspace.yaml`:

```yaml
  - packages/ck-runtime-materializer
```

Do not add a root package script, root `test` script, or Turbo `test` task in
124B. The executable authority for this PRD is the package-local script:

```bash
pnpm --filter @clickeen/ck-runtime-materializer test
```

### Package Manifest

`packages/ck-runtime-materializer/package.json` must be:

```json
{
  "name": "@clickeen/ck-runtime-materializer",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "test": "tsx tests/run-runtime-materializer-contract.ts",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@clickeen/ck-contracts": "workspace:*",
    "@clickeen/widget-shell": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^20.16.5",
    "tsx": "^4.20.6",
    "typescript": "^5.4.5"
  },
  "exports": {
    ".": "./src/index.ts"
  }
}
```

### TypeScript Config

`packages/ck-runtime-materializer/tsconfig.json` must follow package style:

```json
{
  "extends": "../../tsconfig.app-base.json",
  "compilerOptions": {
    "noEmit": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

### Compliance Rationale

This is compliant because the package is local, typed, workspace-scoped, and
has no runtime service authority. The test harness is package-local and does
not become product runtime truth.

## Slice 2 - Exported API

### Goal

Define the stable package API before porting logic.

### Required Export Surface

`src/index.ts` must export only:

```ts
export { RUNTIME_MATERIALIZER_CONTRACT_VERSION } from './types';
export { buildRuntimePackageFingerprint } from './fingerprint';
export { materializeRuntimePackage } from './materialize';
export { applyLocaleOverlayToState } from './overlay';
export type {
  RuntimeMaterializerInput,
  RuntimeMaterializerResult,
  RuntimeMaterializerSuccess,
  RuntimeMaterializerFailure,
  RuntimeMaterializerErrorReason,
  RuntimeMaterializerFileSet,
  RuntimeMaterializerEvidence,
  RuntimeMaterializerEvidenceInput,
  RuntimeMaterializerArtifactCoordinate,
  RuntimeMaterializerCompiledWidget,
  RuntimeMaterializerFileContext,
  RuntimeMaterializerLocaleOverlay,
} from './types';
```

No default export.

### Primary Function

`materializeRuntimePackage(input)` must be the only high-level package builder:

```ts
export async function materializeRuntimePackage(
  input: RuntimeMaterializerInput,
): Promise<RuntimeMaterializerResult>;
```

It must not throw for product input failures. It resolves to a discriminated
result. Internal helpers may throw only if caught and mapped before the public
result.

### Fingerprint Function

`buildRuntimePackageFingerprint(files)` must be async and must use the
deterministic byte order named by the 124A contract addendum. 124B must not
choose or default the byte order locally. If the addendum does not explicitly
name the byte order, stop before code.

Hash:

```text
sha256:<hex digest>
```

### Overlay Function

`applyLocaleOverlayToState(input)` must be exported from `src/overlay.ts`
because 124C/124D need the same resolver semantics for public and preview
conformance. It must still be pure and must not fetch or read storage.

This export is for package contract tests, 124C/124D integration, and preview
conformance. It is not direct Bob browser-preview code unless a later PRD
explicitly bundles or wires it for that surface.

### Compliance Rationale

This is compliant because later callers depend on one boring package contract,
not a set of ad hoc helpers or service-shaped APIs.

## Slice 3 - Exact Type Contract

### Goal

Make package inputs and outputs explicit enough that implementation cannot
invent missing truth.

### Input Types

`src/types.ts` must define:

```ts
import type { WidgetEditableFieldsContract } from '@clickeen/ck-contracts/translated-value-primitives';

export const RUNTIME_MATERIALIZER_CONTRACT_VERSION = 'ck-runtime-materializer:124B';

export type RuntimeMaterializerFileContext = {
  mediaType: 'application/json' | 'text/html' | 'text/css' | 'text/javascript';
  source: string;
};

export type RuntimeMaterializerCompiledWidget = {
  widgetname: string;
  displayName?: string;
  editableFields?: WidgetEditableFieldsContract;
  controls?: Array<{ path?: string }>;
  widgetPackage: {
    files: Partial<Record<string, RuntimeMaterializerFileContext>>;
  };
};

export type RuntimeMaterializerArtifactCoordinate = {
  kind: 'account-instance-widget';
  accountPublicId: string;
  instanceId: string;
  baseLocale: string;
  requestedLocale: string;
};

export type RuntimeMaterializerLocaleOverlay = {
  locale: string;
  keyKind: string; // exact value comes from 124A
  values: Record<string, unknown>;
};

export type RuntimeMaterializerEvidenceInput = {
  schemaWidgetContractFingerprint: string;
  sourceFingerprint: string;
  sourceReference: string;
  overlayFingerprint: string | null;
};

export type RuntimeMaterializerInput = {
  compiled: RuntimeMaterializerCompiledWidget;
  artifactCoordinate: RuntimeMaterializerArtifactCoordinate;
  displayName: string | null;
  state: Record<string, unknown>;
  localeOverlay?: RuntimeMaterializerLocaleOverlay;
  evidence: RuntimeMaterializerEvidenceInput;
};
```

If implementation appears to need another field, stop and update this PRD and
the 124A contract note first. Do not silently add fields during code execution.
Do not pass generic `context`, `options`, `env`, `services`, or `bindings`.

`artifactCoordinate` is the single coordinate truth. The input type must not
reintroduce top-level `instanceId`, `baseLocale`, or `requestedLocale` aliases.
Runtime payloads, locale policy, root stamping, output evidence, and failure
checks must read those values only from `artifactCoordinate`.

### Forbidden Input Fields

The input type must not include:

- `request`;
- `response`;
- `headers`;
- `fetch`;
- `env`;
- `context`;
- `session`;
- `auth`;
- `accountCapsule`;
- `tokyo`;
- `supabase`;
- `cloudflare`;
- fallback locale candidates;
- active locale lists;
- materializer contract version override;
- policy evaluators.

Policy inputs, if any, must be inert byte-affecting values named in the input
type. The package must not evaluate tier, entitlement, role, account status,
locale availability, publication permission, or distribution permission.

### Output Types

`src/types.ts` must define:

```ts
export type RuntimeMaterializerFileSet = {
  indexHtml: string;
  stylesCss: string;
  runtimeJs: string;
  dependencies: {
    instanceIds: string[];
  };
};

export type RuntimeMaterializerEvidence = {
  schemaWidgetContractFingerprint: string;
  sourceFingerprint: string;
  sourceReference: string;
  localeCoordinate: RuntimeMaterializerArtifactCoordinate;
  overlayFingerprint: string | null;
  materializerContractVersion: string;
  generatedPackageFingerprint: string;
  supportFileFingerprints: Array<{ path: string; fingerprint: string }>;
};

export type RuntimeMaterializerErrorReason =
  | 'compiled_widget_invalid'
  | 'widget_package_missing'
  | 'widget_package_file_missing'
  | 'widget_package_root_invalid'
  | 'locale_coordinate_invalid'
  | 'locale_overlay_missing'
  | 'locale_overlay_unexpected_for_base'
  | 'locale_overlay_locale_mismatch'
  | 'locale_overlay_key_missing'
  | 'locale_overlay_key_unexpected'
  | 'locale_overlay_value_invalid'
  | 'locale_overlay_scope_unsupported'
  | 'source_state_invalid';

export type RuntimeMaterializerFailure = {
  ok: false;
  error: {
    reason: RuntimeMaterializerErrorReason;
    reasonKey: string;
    detail?: string;
    paths?: string[];
  };
};

export type RuntimeMaterializerSuccess = {
  ok: true;
  files: RuntimeMaterializerFileSet;
  evidence: RuntimeMaterializerEvidence;
};

export type RuntimeMaterializerResult =
  | RuntimeMaterializerSuccess
  | RuntimeMaterializerFailure;
```

Evidence input values are inert facts supplied by the caller from the 124A
contract. The package must not compute schema/source/overlay fingerprints from
storage, fetches, or service calls. It must echo the inert evidence inputs into
`RuntimeMaterializerEvidence` and add only the generated package fingerprint
and support-file fingerprints it computes from emitted bytes.

`materializerContractVersion` is not caller supplied. The package must write
`RUNTIME_MATERIALIZER_CONTRACT_VERSION` into output evidence. Arbitrary caller
strings must not become evidence.

For base locale materialization, `overlayFingerprint` must be `null`. For
non-base locale materialization, `overlayFingerprint` must be a non-empty
string. Missing or mismatched evidence fails with `locale_coordinate_invalid`
or `source_state_invalid`, according to the exact 124A failure mapping.

Reason keys must map to current `coreui.errors.*` style where the current Roma
builder already has one. New package-only reasons must stay internal until Roma
maps them in 124C.

### Compliance Rationale

This is compliant because the package receives exact declared truth and returns
exact files/evidence or explicit failure. It cannot reach outside its input.

## Slice 4 - Current Roma Builder Port Map

### Goal

Port/copy only pure byte-generation logic from Roma into the package while
leaving Roma runtime behavior unchanged until 124C.

### Current Source File

```text
roma/lib/account-instance-public-package.ts
```

### Port Into Package

Port/copy the equivalent pure logic into package files:

| Current Roma logic | New package file |
| --- | --- |
| `fileSource` | `src/files.ts` |
| `escapeHtml` | `src/html.ts` |
| `escapeAttribute` | `src/html.ts` |
| `extractBody` | `src/html.ts` |
| `readHtmlAttribute` | `src/html.ts` |
| `extractStylesheetSources` | `src/html.ts` |
| `stripScripts` | `src/html.ts` |
| `resolveProductPath` | `src/files.ts` |
| `chunkMarkerId` | `src/files.ts` |
| `styleChunk` | `src/runtime.ts` |
| `runtimeModuleChunk` | `src/runtime.ts` |
| `packageSource` | `src/files.ts` |
| `stampPackageRoot` | `src/html.ts` |
| `socialShareEnabled` | `src/runtime.ts` |
| `buildStyles` | `src/runtime.ts` |
| `buildRuntime` | `src/runtime.ts` |
| `buildIndexHtml` | `src/html.ts` |
| `buildSavedWidgetPublicPackage` | `src/materialize.ts` |

### Keep In Roma Until 124C

The following must not move in 124B:

| Roma responsibility | Reason |
| --- | --- |
| `compileWidgetForInstancePackage` | Calls Bob route / `NextRequest` |
| `materializePublicPackageMedia` | Uses Roma account capsule and Tokyo asset-control route |
| `parseExactResolvedAssetPayload` | Tokyo/Roma asset-control boundary |
| `materializeAccountInstancePublicPackage` route-facing wrapper | Public runtime integration belongs to 124C |
| `InstancePackageFailure` route status mapping | Roma route boundary |

### Import Rules

Package source may import from:

```text
@clickeen/ck-contracts
@clickeen/ck-contracts/translated-value-primitives
@clickeen/widget-shell
node:crypto only if Web Crypto is not used and typecheck passes
```

Package source must not import from:

```text
roma/
bob/
tokyo-worker/
sanfrancisco/
agents/
next
react
wrangler
@cloudflare/*
```

### Compliance Rationale

This is compliant because only pure string/byte construction moves. Account,
route, storage, policy, and media authority stay outside the package.

## Slice 5 - Legacy Fixture Capture And Parity

### Goal

Prevent the package from self-validating new output as “expected.”

### Fixture Rule

124B must prove base parity against the current Roma builder output. The
expected fixture must be captured before the new package path is used as the
source of expected output.

Implementation steps:

1. Add a temporary local capture script during implementation.
2. Run current Roma `buildSavedWidgetPublicPackage` against the fixture input.
3. Commit the captured expected bytes in `tests/fixtures/base-expected.ts`.
4. Remove the temporary script before closeout.
5. Record the capture command and source commit in the 124B implementation
   note.

Do not keep a dual-build Roma import in committed package tests. The committed
package test runner must test the package against committed fixture bytes.

Forbidden method:

- generate expected output from the new package and call it parity.

### Fixture Input

`tests/fixtures/base-input.ts` must include one deterministic compiled widget
fixture with:

- `widgetname`;
- `displayName`;
- `widget.html` with exactly one root:
  `data-ck-widget="[widgetname]" data-role="root"`;
- a stylesheet reference to `./widget.css`;
- a script reference to `./widget.client.js`;
- widget CSS source;
- widget client JS source;
- a base state object with at least:
  - one scalar string;
  - one nested scalar string;
  - one boolean enabling social share;
  - one repeated item using the current 124A concrete saved-content path scope.

This single fixture proves package-local parity for one deterministic widget
shape. It does not prove parity across all widget types. Cross-widget dual-build
parity belongs to 124C when Roma wires the package.

### Expected Output

`tests/fixtures/base-expected.ts` must export:

```ts
export const baseExpectedPackage = {
  indexHtml: '...',
  stylesCss: '...',
  runtimeJs: '...',
};
```

The output must include the current markers from `@clickeen/widget-shell`:

- `WIDGET_SHELL_STYLE_CHUNK_END`;
- `WIDGET_SHELL_RUNTIME_PAYLOAD_START`;
- `WIDGET_SHELL_RUNTIME_PAYLOAD_END`;
- `WIDGET_SHELL_RUNTIME_MODULE_END`.

### Compliance Rationale

This is compliant because parity is anchored to current behavior. It prevents a
paper-green package from silently changing runtime bytes.

## Slice 6 - Base Locale Materializer

### Goal

Implement current base package generation in the package.

### Required Behavior

For
`artifactCoordinate.requestedLocale === artifactCoordinate.baseLocale`:

1. `localeOverlay` must be absent.
2. Runtime payload contains:
   - `artifactCoordinate.instanceId`;
   - `artifactCoordinate.baseLocale`;
   - `locales` with exactly one key: base locale;
   - selected locale equal to base locale;
   - selected state equal to input state.
3. `window.CK_LOCALE_POLICY` contains:
   - `artifactCoordinate.baseLocale`;
   - `languages: [artifactCoordinate.baseLocale]`.
4. `window.CK_WIDGETS[artifactCoordinate.instanceId]` contains:
   - `artifactCoordinate.instanceId`;
   - `locale`;
   - `baseLocale`;
   - `state`;
   - `locales`.
5. Root stamping removes any existing `data-ck-instance-id` and writes
   `artifactCoordinate.instanceId`.
6. Package root validation requires exactly one top-level root matching
   `compiled.widgetname`.
7. Social-share CSS/JS inclusion preserves current Roma behavior.
8. Widget client chunk remains last when present.
9. Output field names are:
   - `indexHtml`;
   - `stylesCss`;
   - `runtimeJs`.

### Failure Mapping

Base materialization must fail with:

| Case | Reason |
| --- | --- |
| Missing `widgetPackage` or `widget.html` | `widget_package_missing` |
| Referenced CSS/JS source missing | `widget_package_file_missing` |
| Invalid/missing root | `widget_package_root_invalid` |
| Base locale with overlay | `locale_overlay_unexpected_for_base` |
| Invalid state object | `source_state_invalid` |

### Compliance Rationale

This is compliant because it preserves base behavior as pure byte generation
and rejects invalid input without repair.

## Slice 7 - Locale Overlay Materializer

### Goal

Implement one non-base locale materialization path according to 124A scope.

### Coordinate Rules

For
`artifactCoordinate.requestedLocale !== artifactCoordinate.baseLocale`:

1. `localeOverlay` is required.
2. `localeOverlay.locale` must equal `artifactCoordinate.requestedLocale`.
3. Exactly one locale overlay may be supplied.
4. No fallback locale candidates are accepted.
5. Runtime payload must contain:
   - base locale state;
   - requested locale state;
   - selected locale equal to requested locale.
6. `window.CK_LOCALE_POLICY.languages` must include:
   - base locale;
   - requested locale.
7. `compiled.editableFields` is required for non-base materialization.
   Missing, invalid, or widget-mismatched editable-fields contracts fail before
   overlay application with the 124A-named compiled-widget failure.

### Overlay Application Rules

The package must:

1. Clone the input state before applying overlay values.
2. Apply overlay values only to the 124A-supported text-field scope.
3. Derive the required overlay key set from `compiled.editableFields + state`
   through current `@clickeen/ck-contracts/translated-value-primitives`
   primitives or the exact helper named by 124A. It must not implement a local
   ad hoc schema traversal.
4. Reject missing required overlay keys inside supported scope.
5. Reject unexpected overlay keys inside supported scope.
6. Reject non-string overlay values.
7. Materialize concrete expanded repeated paths when those paths are present in
   the current 124A saved-content path scope.
8. Reserve `locale_overlay_scope_unsupported` for attempts to claim
   reorder-safe repeated token cascade, which 124A defers beyond 124B.
9. Never replace missing overlay values with base values while claiming locale
   success.
10. Never drop unexpected overlay values.

### Key Representation

The implementation must use the single canonical overlay key representation
named by 124A. If 124A says current Babel concrete paths are the implementation
scope, use concrete paths. If 124A says token identity keys, 124B must not
invent a conversion; it must wait for the full producer/storage/reader decision
named by 124A.

### Compliance Rationale

This is compliant because locale materialization is one source plus one exact
overlay. It is not a precedence resolver or alternate document builder.

## Slice 8 - Fingerprint And Evidence

### Goal

Return deterministic evidence without persisting anything.

### Fingerprint Helper

`src/fingerprint.ts` must implement:

```ts
export async function buildRuntimePackageFingerprint(
  files: RuntimeMaterializerFileSet,
): Promise<string>;
```

`materializeRuntimePackage` must call this helper and therefore must be async:

```ts
export async function materializeRuntimePackage(
  input: RuntimeMaterializerInput,
): Promise<RuntimeMaterializerResult>;
```

Use `crypto.subtle.digest('SHA-256', bytes)` where available in the package
test runtime. If the runtime lacks Web Crypto, import `createHash` from
`node:crypto` in `src/fingerprint.ts` only and keep the same public async
contract. Do not use a different hash algorithm. If the `node:crypto` fallback
is implemented, the package test runner must cover the branch that ships; do
not leave an untested fallback path.

### Evidence Fields

Evidence must include:

- `schemaWidgetContractFingerprint`;
- `sourceFingerprint`;
- `sourceReference`;
- `localeCoordinate`;
- `overlayFingerprint`;
- `materializerContractVersion`, populated from the package-owned
  `RUNTIME_MATERIALIZER_CONTRACT_VERSION` constant;
- `generatedPackageFingerprint`;
- `supportFileFingerprints`.

`supportFileFingerprints` is an empty array when 124B emits no separate
immutable support files.

The schema, source, and overlay evidence fields come from `input.evidence` as
inert caller-supplied provenance. `localeCoordinate` comes from
`input.artifactCoordinate`. `materializerContractVersion` comes from the
package-owned constant. The package must not fetch, inspect storage, or invent
missing provenance to populate evidence.

### Persistence Rule

124B must not write evidence to:

- R2;
- metadata;
- sidecar files;
- package status files;
- readiness records;
- Supabase.

### Compliance Rationale

This is compliant because evidence is returned to the caller. Persistence and
public-serving interpretation belong to later authorities.

## Slice 9 - Package Contract Test Runner

### Goal

Prove the package in isolation using deterministic contract tests.

### Test File

Create:

```text
packages/ck-runtime-materializer/tests/run-runtime-materializer-contract.ts
```

Use:

```ts
import assert from 'node:assert/strict';
```

Do not use Playwright for 124B package tests.

### Required Test Cases

The runner must execute these cases and throw on failure:

1. `base package matches legacy fixture`
   - materialize base fixture;
   - assert `indexHtml`, `stylesCss`, `runtimeJs` equal `baseExpectedPackage`.
2. `base evidence fingerprint is deterministic`
   - materialize same input twice;
   - assert fingerprint equal.
3. `base evidence is complete`
   - assert output evidence echoes schema/widget contract fingerprint, source
     fingerprint, source reference, `localeCoordinate`, null overlay
     fingerprint, the package-owned materializer contract version, generated
     package fingerprint, and support-file fingerprints.
4. `runtime bytes use artifact coordinate`
   - assert runtime payload, locale policy, root stamp, and evidence use only
     `artifactCoordinate.instanceId`, `artifactCoordinate.baseLocale`, and
     `artifactCoordinate.requestedLocale`.
5. `invalid artifact coordinate fails`
   - empty account, instance, base locale, or requested locale;
   - expect `locale_coordinate_invalid`.
6. `base with overlay fails`
   - requested locale equals base;
   - overlay supplied;
   - expect `locale_overlay_unexpected_for_base`.
7. `non-base without overlay fails`
   - requested locale differs from base;
   - overlay absent;
   - expect `locale_overlay_missing`.
8. `non-base overlay locale mismatch fails`
   - overlay locale differs from requested locale;
   - expect `locale_overlay_locale_mismatch`.
9. `non-base missing editable fields fails`
   - omit `compiled.editableFields`;
   - expect the 124A-named compiled-widget failure.
10. `non-base scalar overlay succeeds`
   - exact required keys supplied;
   - generated runtime payload contains requested locale state.
11. `non-base evidence is complete`
   - assert output evidence echoes schema/source/overlay provenance and contains
     a non-empty overlay fingerprint;
   - assert `materializerContractVersion` equals
     `RUNTIME_MATERIALIZER_CONTRACT_VERSION`.
12. `missing overlay key fails`
   - expect `locale_overlay_key_missing`.
13. `unexpected overlay key fails`
   - expect `locale_overlay_key_unexpected`.
14. `invalid overlay value fails`
   - non-string value in overlay;
   - expect `locale_overlay_value_invalid`.
15. `repeated overlay scope`
    - assert concrete expanded repeated-path overlay values materialize under
      the current 124A scope;
    - assert reorder-safe repeated token cascade is not claimed in 124B.
16. `missing widget html fails`
    - expect `widget_package_missing`.
17. `missing referenced CSS or JS fails`
    - expect `widget_package_file_missing`.
18. `invalid root fails`
    - zero roots, multiple roots, wrong widget type;
    - expect `widget_package_root_invalid`.
19. `forbidden imports guard`
    - read `src/**/*.ts`;
    - assert none contains forbidden import strings:
      `roma/`, `@roma/`, `bob/`, `@clickeen/bob`, `tokyo-worker/`,
      `sanfrancisco/`, `agents/`, `next`, `react`, `wrangler`,
      `@cloudflare`, `supabase`, `process.env`.

### Test Output

The runner must print concise pass/fail lines and exit non-zero on failure. It
may stop on first failure or aggregate failures, but success must mean every
required test case ran.

### Compliance Rationale

This is compliant because tests prove package behavior and import boundaries.
They do not become runtime truth, product probes, or deployment evidence.

## Slice 10 - Typecheck And Repo Commands

### Goal

Make acceptance commands exact.

### Required Commands

After implementation, run:

```bash
pnpm install
pnpm --filter @clickeen/ck-runtime-materializer typecheck
pnpm --filter @clickeen/ck-runtime-materializer test
pnpm typecheck
git diff --check
```

If `pnpm install` changes the lockfile, include the lockfile in the 124B commit.

Do not claim 124B complete if package tests are skipped because no harness
exists. The harness is part of 124B.

### Compliance Rationale

This is compliant because the package has direct executable checks. It does not
depend on Playwright or deployed runtime to prove pure materialization.

## Slice 11 - No Roma Runtime Integration

### Goal

Keep 124B package delivery separate from 124C runtime reroute.

### Steps

1. Do not add `@clickeen/ck-runtime-materializer` to `roma/package.json` in
   124B.
2. Do not change Roma route code in 124B.
3. Do not change `roma/lib/account-instance-public-package.ts` behavior in 124B
   unless the change is explicitly limited to exporting/capturing a legacy
   fixture and does not affect runtime.
4. Do not change Tokyo-worker package write/read/serve behavior in 124B.
5. Do not change Bob preview behavior in 124B.

### Output

124B delivers a package that no runtime surface calls yet.

### Compliance Rationale

This is compliant because it prevents paper-green package work from becoming a
silent runtime behavior change.

## Slice 12 - Package README

### Goal

Document the local package contract where future implementers will look.

### Required README Sections

`packages/ck-runtime-materializer/README.md` must include:

- purpose;
- pure input/output contract;
- forbidden imports/dependencies;
- no storage/no route/no policy authority;
- package test command;
- relationship to 124B/124C;
- evidence persistence rule.

### Compliance Rationale

This is compliant because docs live with the new package and do not promote the
package into a runtime service.

## Slice 13 - Closeout Gate

### Steps

1. Confirm all files from Slice 1 exist.
2. Confirm package manifest matches Slice 1.
3. Confirm workspace includes the package.
4. Confirm exported API matches Slice 2.
5. Confirm input/output types match Slice 3.
6. Confirm pure Roma builder logic has a documented extraction map.
7. Confirm base output matches legacy fixture.
8. Confirm full evidence output matches Slice 3 and Slice 8.
9. Confirm non-base overlay tests pass for 124A-supported scope.
10. Confirm forbidden import guard passes.
11. Confirm no Roma runtime path calls the package.
12. Confirm no Tokyo/R2/Supabase/Cloudflare writes occur.
13. Run required commands from Slice 10.
14. Record V1-V8 audit.

### Acceptance

- `packages/ck-runtime-materializer` exists.
- The package builds and tests in isolation.
- The package has no runtime dependency on Roma, Tokyo-worker, Cloudflare
  bindings, Supabase, San Francisco, Bob, Next, React, or environment variables.
- Base resolver preserves current behavior through a legacy fixture.
- Locale resolver follows 124A scope.
- Concrete expanded repeated paths materialize under the current 124A scope;
  reorder-safe repeated token cascade remains out of 124B scope.
- Evidence output is complete, deterministic, and not persisted by the package.
- No runtime behavior changes.
- 124C can depend on a real package, not a prose-only plan.

## Required Documentation Updates

124B must update:

- this PRD;
- `packages/ck-runtime-materializer/README.md`;
- `124B__Implementation_Note__Pure_Runtime_Materializer_Package.md` with:
  - 124A input values used;
  - exact fingerprint byte order named by 124A;
  - whether overlay key derivation used `identityKey`, concrete `path`, or
    another exact representation named by 124A;
  - confirmation that concrete expanded repeated paths are supported under the
    exact 124A decision, while reorder-safe repeated token cascade is not
    claimed;
  - extraction map;
  - fixture capture method;
  - command output summary.

Update canonical docs only if package creation changes current-system claims.
Expected outcome: no canonical operator doc changes until 124C.
