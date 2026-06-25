# 124C Implementation Note - Base Artifact Reroute

## Scope

124C reroutes Roma base public package byte generation through
`@clickeen/ck-runtime-materializer`.

No locale artifacts, public locale URLs, Tokyo serving changes, storage
migrations, sidecar evidence objects, background recomputation, or request-time
composition were added.

## Function Map

| Current Function/Concern | 124C Result |
| --- | --- |
| `compileWidgetForInstancePackage` | Kept in Roma. Bob compiled route access remains a Roma boundary concern. |
| `materializePublicPackageMedia` | Kept in Roma. Account asset resolution remains a Roma/Tokyo account authority. |
| Roma HTML/body extraction helpers | Removed from Roma; owned by `@clickeen/ck-runtime-materializer`. |
| Roma root stamping helper | Removed from Roma; owned by `@clickeen/ck-runtime-materializer`. |
| Roma stylesheet/runtime chunk helpers | Removed from Roma; owned by `@clickeen/ck-runtime-materializer`. |
| Roma `buildSavedWidgetPublicPackage` | Kept as an async Roma adapter around the materializer package. |
| `materializeAccountInstancePublicPackage` | Kept as the route-facing Roma wrapper. |
| Create/save/duplicate routes | Unchanged call path; they still call `materializeAccountInstancePublicPackage`. |
| Tokyo package write shape | Unchanged: `indexHtml`, `stylesCss`, `runtimeJs`, `dependencies`. |

## 124B Code-Delivered Evidence

Confirmed before 124C wiring:

- `packages/ck-runtime-materializer/package.json` exists.
- `packages/ck-runtime-materializer/src/index.ts` exists.
- `packages/ck-runtime-materializer/tests/run-runtime-materializer-contract.ts` exists.
- `pnpm-workspace.yaml` includes `packages/ck-runtime-materializer`.
- `pnpm --filter @clickeen/ck-runtime-materializer typecheck` passed.
- `pnpm --filter @clickeen/ck-runtime-materializer test` passed.

## Roma Adapter Harness

Chosen harness:

```bash
pnpm --filter @clickeen/roma test:instance-package
```

The harness proves:

- all-widget exact byte parity for the current widget set;
- no overlay is passed for base artifacts;
- requested locale equals base locale;
- create/save/duplicate route files still call
  `materializeAccountInstancePublicPackage`, check `publicPackage.ok`, and pass
  `publicPackage.value` to the existing Tokyo write command;
- duplicate still mints a new `instanceId` and regenerates a base package for
  that id;
- adapter evidence plumbing is local and complete:
  - source reference;
  - source fingerprint;
  - schema/widget contract fingerprint;
  - `overlayFingerprint: null`;
  - package-owned materializer contract version;
  - generated package fingerprint;
- missing referenced package file maps to the current Roma validation shape;
- exact runtime state serialization is unchanged;
- Roma is the only 124C caller of the materializer package.

## All-Widget Parity Matrix

Expected bytes were captured from the pre-reroute Roma builder into:

```text
roma/tests/fixtures/124c-base-package-expected.json
```

The committed matrix covers:

- `big-bang`
- `calltoaction`
- `cards`
- `countdown`
- `faq`
- `logoshowcase`
- `split-carousel-media`
- `split-media`

Each matrix case compares exact `index.html`, `styles.css`, and `runtime.js`
strings. The fixture capture used a temporary copy of the previous Roma builder
from `HEAD`; the temporary capture files were removed after fixture generation.

## State Serialization Evidence

The runner compares exact `runtime.js` strings against captured legacy bytes.
This catches key-order drift in the serialized state payload.

## Source/Schema Fingerprint Inputs

124C computes local evidence only:

- source reference: `accounts/{accountId}/instances/{instanceId}/base`;
- source fingerprint: SHA-256 over Roma's local base-source input envelope;
- schema/widget contract fingerprint:
  - editable fields hash from `widgetEditableFieldsContractHash` when present;
  - otherwise a controls-based local fingerprint.

Those values are passed only to the materializer call and returned in package
evidence. They are not persisted to Tokyo, R2 metadata, sidecars, status files,
or Supabase in 124C.

## Runtime And Storage Boundaries

- Tokyo package keys remain `index.html`, `styles.css`, and `runtime.js`.
- Tokyo fingerprint behavior is unchanged.
- Public base serving still reads stored package bytes from the existing account
  instance folder.
- No non-base locale package is generated.
- No public locale URL is exposed.

## Verification Summary

Commands run:

```bash
pnpm --filter @clickeen/roma test:instance-package
pnpm --filter @clickeen/roma typecheck
pnpm --filter @clickeen/ck-runtime-materializer typecheck
pnpm --filter @clickeen/ck-runtime-materializer test
pnpm typecheck
git diff --check
```

All passed before 124C review. The initial review gate found missing
route-focused and evidence-focused proof; those blockers were fixed by adding
explicit route-source focused-equivalent assertions and adapter evidence
assertions to `roma/tests/run-instance-package-reroute.ts`.

## V1-V8 Slice Result

| ID | Result |
| --- | --- |
| V1 Silent substitution | Clean. Bad materializer input maps to explicit Roma validation failure. |
| V2 Silent healing | Clean. Package/root/source errors are not repaired. |
| V3 Silent omission | Clean. Create/save/duplicate package shape, all-widget parity, and error mapping are covered by the harness. |
| V4 Fail-open control | Clean. Missing package bytes or invalid materializer input fail the command. |
| V5 Corruption-as-absence | Clean. Corrupt package/source shapes are not treated as missing defaults. |
| V6 Partial-success masquerade | Clean. Roma still writes source/package only after package generation succeeds. |
| V7 Masquerade/redress | Clean. This is a direct adapter call, not a renamed service or background path. |
| V8 Runtime test dependency | Clean. Tests verify local contracts and are not runtime product dependencies. |
