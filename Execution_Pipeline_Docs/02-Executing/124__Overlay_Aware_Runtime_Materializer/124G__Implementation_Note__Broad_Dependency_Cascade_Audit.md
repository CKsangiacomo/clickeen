# 124G Implementation Note - Broad Dependency Cascade Audit

Status: implemented locally

124G adds no broad re-resolution executor. It records the current dependency
contract for stored account widget packages so future broad operations cannot
hide behind runtime guessing, visitor-time checks, or background repair.

The audit found one local materializer contract defect: stylesheet links from
`widget.html` were preserved in generated `index.html` while the same sources
were consolidated into `styles.css`. That would make `./widget.css` appear as a
runtime external file even though it is not a generated package file. The
materializer now strips stylesheet links from generated body HTML and keeps the
single package stylesheet reference in the document head.

## Dependency Classification

| Dependency | Current package behavior | Owner | Existing artifacts affected by later dependency change | Required future action |
| --- | --- | --- | --- | --- |
| `spec.json` | source/schema input before package generation | Widget source | existing stored bytes do not change | explicit account command or future broad re-resolution |
| `editable-fields.json` | schema/token contract input before locale overlay generation/materialization | Widget source + Babel contract | existing stored bytes do not change | explicit account command or future broad re-resolution |
| `limits.json` | Roma policy/save/publish gate input, not embedded runtime byte source | Widget source + Roma policy | existing stored bytes do not change | current command gate; no standalone 124G fan-out |
| `widget.html` | body skeleton sealed into `index.html` after materialization | Widget source | existing stored bytes do not change | explicit account command or future broad re-resolution |
| `widget.css` | sealed into generated `styles.css` | Widget source | existing stored bytes do not change | explicit account command or future broad re-resolution |
| `widget.client.js` | sealed into generated `runtime.js` | Widget source | existing stored bytes do not change | explicit account command or future broad re-resolution |
| `tokyo/product/widgets/shared/*.css` used by materializer | selected shared CSS modules are sealed into `styles.css` | Shared widget runtime | existing stored bytes do not change | explicit account command or future broad re-resolution |
| `tokyo/product/widgets/shared/*.js` used by materializer | selected shared JS modules are sealed into `runtime.js` | Shared widget runtime | existing stored bytes do not change | explicit account command or future broad re-resolution |
| `/dieter/**` stylesheet references | preserved as external `@import` references in `styles.css`; not sealed | Dieter product root | yes, public behavior can change without package rewrite | Dieter deploy evidence; future immutable support-file PRD if contract changes |
| `/fonts/**` references | external Tokyo static reference | Tokyo font product root | yes, public behavior can change without package rewrite | font deploy evidence; no visitor-time package recompute |
| Account asset references | external account asset delivery from account asset folder | Account asset library through Roma/Tokyo-worker | yes, asset replacement changes delivered media without package rewrite | account asset command evidence; no package rewrite implied |
| Materializer contract | evidence-producing resolver; current version `ck-runtime-materializer:124B` | `packages/ck-runtime-materializer` | existing stored bytes do not change | future broad re-resolution only when new version requires it |
| Widget Shell markers | marker strings sealed into `styles.css`/`runtime.js` chunks | `@clickeen/widget-shell` | existing stored bytes do not change | explicit account command or future broad re-resolution |

## Sealed-Bytes Rule

Generated account widget package files are product bytes:

```text
index.html
styles.css
runtime.js
```

When widget source, shared widget runtime, widget-shell markers, or the
materializer change after package generation, existing account package files
remain the stored bytes until a named account command regenerates them or a
future broad re-resolution command mutates exact coordinates. Tokyo public
serving must not compare stored package bytes to current widget source on
visitor requests.

## External Reference Rule

The current materializer preserves `/dieter/**` stylesheet references as
external `@import` references. Tokyo also serves `/fonts/**` and account asset
URLs from their owning roots. These references can affect already-stored package
behavior without rewriting the package files.

124G does not solve mutable external-reference risk by copying those assets
into account package folders, adding visitor-time checks, or creating an
expected-version store. A later PRD must explicitly change the package contract
if Dieter/font/account-asset dependencies become content-addressed support
files.

## Evidence And Compatibility

Current generated materializer evidence includes:

```text
schemaWidgetContractFingerprint
sourceFingerprint
sourceReference
localeCoordinate
overlayFingerprint
materializerContractVersion
generatedPackageFingerprint
supportFileFingerprints
```

Current Tokyo stored package metadata includes `publicPackageFingerprint` for
base package files. Locale package metadata also includes account, instance,
base locale, requested locale, source updated-at, and materializer contract
version. `supportFileFingerprints` is present in the materializer evidence shape
but currently empty because PRD 124 does not create content-addressed support
files.

Materializer compatibility rule:

- same `materializerContractVersion` is compatible;
- a new version must explicitly declare old artifact serve-compatibility or
  require exact-coordinate re-resolution;
- 124G does not create an expected-current version lookup for public serving.

## Existing Unmarked Artifact Rule

Base package compatibility remains only where current Tokyo code already allows
unmarked base package objects. Locale package serving requires the 124D/124E
metadata contract; unmarked locale packages are not valid public locale
artifacts.

124G does not add compatibility readers, storage repair, backfill, or mutation
of unmarked artifacts.

## Future Broad Re-Resolution Gate

A later broad operation must name all of the following before it can mutate
account artifacts:

- dependency that changed;
- exact artifact evidence field affected;
- account/instance coordinate source;
- operator authority and command path;
- maximum coordinate count and cost ceiling;
- failure response shape with exact incomplete coordinates;
- deploy/Cloudflare evidence path;
- V1-V8 audit method;
- stale-coordinate enumeration command or report, if stale coordinates must be
  discovered.

Future stale-coordinate enumeration cannot be visitor-time lookup, hidden
scheduler, unbounded storage scan that mutates product data, product status
store, or background repair. It must be an explicit operator/audit command with
named coordinate source and failure shape.

## Deployment Evidence Rule

Broad dependency deploy evidence belongs to the dependency owner:

- widget source, shared widget runtime, Dieter, and fonts: Tokyo product-root
  deploy evidence;
- Tokyo-worker serving changes: GitHub Actions `cloud-dev workers deploy`;
- Roma command/materializer invocation changes: Cloudflare Pages Git-connected
  build from `main`;
- R2 evidence reads: after `pnpm cf:preflight`;
- Pages/API/config evidence reads: after `pnpm cf:api:preflight`.

Local build success alone does not prove broad runtime freshness.

## Verification

124G verification is documentation and code inventory, not runtime mutation:

```bash
rg -n "dieter|font|asset|widget\\.css|widget\\.client|shared|materializerContractVersion|schemaWidgetContractFingerprint|sourceFingerprint|publicPackageFingerprint|overlayFingerprint|@import|runtime.js|styles.css|index.html" packages/ck-runtime-materializer roma/lib tokyo-worker/src documentation/widgets documentation/architecture/RuntimeProfiles.md documentation/architecture/AssetManagement.md documentation/services/tokyo.md documentation/services/tokyo-worker.md
pnpm --filter @clickeen/ck-runtime-materializer typecheck
pnpm --filter @clickeen/tokyo-worker typecheck
pnpm --filter @clickeen/roma typecheck
pnpm typecheck
git diff --check
```

## V1-V8 Audit

| ID | Result |
| --- | --- |
| V1 Silent substitution | Pass: no missing dependency is replaced with invented freshness. |
| V2 Silent healing | Pass: no stored package is repaired or normalized. |
| V3 Silent omission | Pass: broad dependency residual risk is explicit. |
| V4 Fail-open control | Pass: no new serving control is added or relaxed. |
| V5 Corruption-as-absence | Pass: unmarked locale package artifacts remain invalid. |
| V6 Partial-success masquerade | Pass: 124G does not claim broad freshness is solved. |
| V7 Masquerade/redress | Pass: no scheduler, watcher, scanner, or wrapper command is added. |
| V8 Runtime test dependency | Pass: checks support the audit and do not become runtime truth. |
