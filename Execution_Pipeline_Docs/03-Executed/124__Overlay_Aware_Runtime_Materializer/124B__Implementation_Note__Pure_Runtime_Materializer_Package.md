# 124B Implementation Note - Pure Runtime Materializer Package

## Scope

124B added `packages/ck-runtime-materializer` as a pure package-local
materializer. It does not wire Roma, Tokyo-worker, public serving, R2, routes,
status files, or request-time composition.

## 124A Input Values Used

- Artifact coordinate:
  - `kind: account-instance-widget`
  - `accountPublicId`
  - `instanceId`
  - `baseLocale`
  - `requestedLocale`
- Source inputs:
  - compiled widget package files
  - saved base state
  - display name
- Evidence input:
  - `sourceReference`
  - `sourceFingerprint`
  - `schemaWidgetContractFingerprint`
  - `overlayFingerprint`

`materializerContractVersion` is package-owned and returned by 124B as
`RUNTIME_MATERIALIZER_CONTRACT_VERSION`; callers do not pass arbitrary
materializer contract strings into evidence.

## Fingerprint Byte Order

124B uses the 124A/Tokyo package fingerprint order exactly:

```text
index.html:<indexHtml.length>
styles.css:<stylesCss.length>
runtime.js:<runtimeJs.length>
```

The lines are joined with `\n`, hashed with SHA-256 through Web Crypto, and
returned as `sha256:<hex>`.

## Overlay Key Representation

124B uses the 124A current concrete saved-content path scope:

```text
current_saved_content_concrete_path
```

Overlay keys are concrete saved state paths such as:

- `headline`
- `nested.eyebrow`
- `items.0.title`
- `items.1.title`

124B does not claim reorder-safe repeated token cascade. Concrete expanded
repeated paths are supported only under the current 124A decision.

## Extraction Map

The package delegates editable text extraction and overlay application to
`@clickeen/ck-contracts/translated-value-primitives`:

- `extractSavedTextFieldsForEditableFields`
- `resolveTranslatedValues`

The fixture maps:

| Editable Field | Concrete Paths |
| --- | --- |
| `headline` | `headline` |
| `nested.eyebrow` | `nested.eyebrow` |
| `items[].title` | `items.0.title`, `items.1.title` |

## Fixture Capture Method

The base golden package was captured from the current Roma builder during
implementation with a temporary script:

```bash
pnpm --filter @clickeen/ck-runtime-materializer exec tsx tests/capture-legacy-fixture.ts
```

The temporary script imported:

```ts
buildSavedWidgetPublicPackage from roma/lib/account-instance-public-package
```

It wrote `packages/ck-runtime-materializer/tests/fixtures/base-expected.ts`.
The temporary capture script was removed before closeout so the committed tests
do not import Roma.

Source commit at capture time:

```text
c364b19477faf8af64a9e0a9158d72174355c277
```

## Command Output Summary

Commands run for this slice:

```bash
pnpm install
pnpm --filter @clickeen/ck-runtime-materializer typecheck
pnpm --filter @clickeen/ck-runtime-materializer test
pnpm typecheck
git diff --check
```

Results:

- package typecheck passed;
- package contract tests passed;
- root typecheck passed;
- diff whitespace check passed.

## V1-V8 Slice Result

| ID | Result |
| --- | --- |
| V1 Silent substitution | Clean. Missing/invalid overlay values fail; no invented values are substituted. |
| V2 Silent healing | Clean. Invalid source, overlay, root, and package shapes fail instead of being repaired. |
| V3 Silent omission | Clean after this note and the named test matrix were added. |
| V4 Fail-open control | Clean. Missing overlay/evidence/package inputs fail closed. |
| V5 Corruption-as-absence | Clean. Corrupt overlay/source paths are not treated as absent. |
| V6 Partial-success masquerade | Clean after all required test cases and implementation evidence were added. |
| V7 Masquerade/redress | Clean. This is a pure package, not a renamed service or wrapper path. |
| V8 Runtime test dependency | Clean. Tests are package verification only and are not runtime truth. |

