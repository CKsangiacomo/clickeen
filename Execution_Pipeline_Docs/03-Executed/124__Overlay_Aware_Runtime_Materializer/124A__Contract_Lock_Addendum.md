# 124A Contract Lock Addendum - Overlay-Aware Runtime Materializer

Status: CONTRACT LOCK ADDENDUM
Parent: `124__PRD__Overlay_Aware_Runtime_Materializer.md`
Unblocks: `124B__PRD__Pure_Runtime_Materializer_Package.md`
Authority: current Clickeen code and documentation only

## 0. Purpose

This addendum locks the exact current contracts that 124B must execute against.
It does not define the ideal future overlay system, does not introduce a new
service boundary, and does not reinterpret overlays as alternate documents.

The implementation rule is:

```text
Schema-driven truth first.
Token/source identity is preserved as metadata and evidence.
Generated files are derived artifacts.
Tokyo stores and serves exact bytes.
No runtime visitor request invents, repairs, falls back, or composes product truth.
```

## 1. Evidence Read Before This Lock

This lock is based on these current authorities:

| Area | Current authority read |
| --- | --- |
| Babel overlay law | `documentation/architecture/BabelProtocol.md` |
| Overlay runtime law | `documentation/architecture/OverlayArchitecture.md` |
| Runtime/public serving | `documentation/architecture/RuntimeProfiles.md` |
| Storage and serving tenets | `documentation/architecture/Tenets.md` |
| Localization capability | `documentation/capabilities/localization.md` |
| Roma service boundary | `documentation/services/roma.md` |
| Tokyo-worker service boundary | `documentation/services/tokyo-worker.md` |
| Strategy context | `documentation/strategy/Clickeen-Babel.md`, `documentation/strategy/GlobalReach.md` |
| Field/token extraction | `packages/ck-contracts/src/translated-value-primitives.ts` |
| Overlay coordinate IDs | `packages/ck-contracts/src/overlay-identity.ts` |
| Overlay storage validation | `tokyo-worker/src/domains/account-translations/overlays.ts` |
| Translation values routes | `tokyo-worker/src/domains/account-translations/values.ts`, `tokyo-worker/src/routes/internal-translation-routes.ts` |
| Public package fingerprint | `tokyo-worker/src/domains/account-instances/package-files.ts` |
| Public serving/cache | `tokyo-worker/src/routes/clk-live-routes.ts` |
| Instance storage keys | `tokyo-worker/src/domains/account-instances/keys.ts` |
| Instance source docs | `tokyo-worker/src/domains/account-instances/types.ts`, `tokyo-worker/src/domains/account-instances/source.ts` |
| Instance operations | `tokyo-worker/src/domains/account-instances/operations.ts` |
| Roma save materialization | `roma/app/api/account/instances/[instanceId]/route.ts` |
| Roma source extraction | `roma/lib/account-instance-source-artifacts.ts` |
| Roma package builder | `roma/lib/account-instance-public-package.ts` |
| Roma translation bridge | `roma/lib/account-instance-translations.ts` |
| Translation Agent | `agents/translation-agent/src/index.ts`, `agents/translation-agent/src/worker.ts` |

## 2. Non-Invention Boundary

124B may implement only the pure materialization package. It may not:

- Move write authority from Roma/Tokyo.
- Add a runtime service that composes visitor requests.
- Add overlay lifecycle files, readiness files, ledgers, selected-locale pointers,
  fallback locale logic, probe flows, or compatibility readers.
- Treat translated overlays as alternate documents.
- Persist new evidence files or source fingerprints in Tokyo.
- Change public URL shape, CDN policy, or cache purge semantics.

Any contract below marked "current" is executable now. Any contract marked
"deferred" is explicitly outside 124B and must be handled by the named later
sub-PRD before code may claim that behavior.

## 3. Current Authority Chain

Current save and serve authority is:

```text
Roma current account/session
-> accountPublicId
-> Roma account instance route
-> Roma package/source materialization
-> Tokyo-worker internal account instance routes
-> R2 account instance folder
-> Tokyo public clk.live route serving stored package bytes
```

Current translation authority is:

```text
Roma current account/session and locale settings
-> saved instance source from Tokyo
-> Translation Agent grant minted by Roma
-> Translation Agent exact path-preserving values
-> Tokyo-worker translation write route
-> accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

124B sits below Roma as a pure package library. It does not become an authority.

## 4. Artifact Coordinates

### 4.1 Account Instance Root

Current account instance root:

```text
accounts/{accountPublicId}/instances/{instanceId}
```

`accountPublicId` is the compact account public ID validated by current
contracts. `instanceId` is the compact instance ID validated by current
contracts.

### 4.2 Source Files

Current source files inside the instance root:

```text
instance.config.json
instance.content.json
serve-state.json
```

`instance.config.json` carries non-text widget/config/runtime state and the
current `publicPackageFingerprint` when present.

`instance.content.json` carries saved user-visible text as:

```ts
{
  fields: {
    [concretePath: string]: {
      value: string;
      identityKey?: string;
      fieldPattern?: string;
      status: "ok" | "changed";
    }
  };
  updatedAt: string;
}
```

### 4.3 Overlay Files

Current translated overlay file:

```text
accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json
```

The base locale has no overlay file.

### 4.4 Current Public Package Files

Current public package files in the same instance root:

```text
index.html
styles.css
runtime.js
```

Current public serving URLs:

```text
https://dev.clk.live/{accountPublicId}/{instanceId}
https://clk.live/{accountPublicId}/{instanceId}
https://dev.clk.live/{accountPublicId}/{instanceId}/index.html
https://dev.clk.live/{accountPublicId}/{instanceId}/styles.css
https://dev.clk.live/{accountPublicId}/{instanceId}/runtime.js
```

Locale-specific public URLs are not current truth. 124B must not define them.
124E owns that later public serving decision.

### 4.5 Future Locale Package Storage Coordinate

124D needs a non-public storage coordinate before 124E can serve locale bytes.
This storage coordinate is locked here so 124D does not invent one locally.

Generated non-base locale package files must live under the same account
instance authority:

```text
accounts/{accountPublicId}/instances/{instanceId}/locales/{locale}/index.html
accounts/{accountPublicId}/instances/{instanceId}/locales/{locale}/styles.css
accounts/{accountPublicId}/instances/{instanceId}/locales/{locale}/runtime.js
```

Rules:

- This is storage only. It does not expose a public URL.
- 124D may add the internal Tokyo write/delete/read operations needed to store
  these exact bytes.
- 124E owns public serving implementation, CDN headers, purge semantics, and
  visitor-facing miss behavior for the locked public URL shape in section 4.6.
- Locale package files are derived artifacts. They do not replace
  `instance.config.json`, `instance.content.json`, or
  `overlays/locales/{locale}.json`.
- Initial locale package metadata uses the same generated package fingerprint
  mechanism as base package bytes plus explicit coordinate metadata defined
  below. Source/schema/overlay fingerprints remain local provenance until a
  later PRD defines their persistence/enforcement.

Initial 124D/124E locale package R2 custom metadata keys, written on each of
the three locale files and read by 124E:

```text
publicPackageFingerprint
localePackageAccountPublicId
localePackageInstanceId
localePackageBaseLocale
localePackageLocale
localePackageSourceUpdatedAt
materializerContractVersion
```

Rules:

- `publicPackageFingerprint` is the generated locale package fingerprint,
  computed from the locale package bytes with the same file order and algorithm
  as the current base package fingerprint.
- `localePackageAccountPublicId`, `localePackageInstanceId`,
  `localePackageBaseLocale`, and `localePackageLocale` must match the public
  request coordinate and current published source pointer.
- `localePackageSourceUpdatedAt` must match the `updatedAt` value on the
  current published source pointer Tokyo already reads for base serving.
- `materializerContractVersion` must match the 124B package-owned exported
  contract version expected by 124E.
- All three locale files must carry identical values for these metadata keys.
- These keys do not store overlay values, readiness, lifecycle status, or
  source/schema/overlay fingerprints.

### 4.6 Future Public Locale URL Coordinate

124E owns public serving implementation, cache headers, purge semantics, and
visitor-facing miss behavior. The public URL shape itself is locked here so
Tokyo route parsing does not invent it.

Production:

```text
https://clk.live/{accountPublicId}/{instanceId}/locales/{locale}
https://clk.live/{accountPublicId}/{instanceId}/locales/{locale}/index.html
https://clk.live/{accountPublicId}/{instanceId}/locales/{locale}/styles.css
https://clk.live/{accountPublicId}/{instanceId}/locales/{locale}/runtime.js
```

Cloud-dev:

```text
https://dev.clk.live/{accountPublicId}/{instanceId}/locales/{locale}
https://dev.clk.live/{accountPublicId}/{instanceId}/locales/{locale}/index.html
https://dev.clk.live/{accountPublicId}/{instanceId}/locales/{locale}/styles.css
https://dev.clk.live/{accountPublicId}/{instanceId}/locales/{locale}/runtime.js
```

Collision rules:

- `/{accountPublicId}/{instanceId}` remains the base entry URL.
- `/{accountPublicId}/{instanceId}/index.html`, `/styles.css`, and
  `/runtime.js` remain base package file URLs.
- `/{accountPublicId}/pages/{pageId}` remains page parsing and must not be
  consumed by locale parsing.
- `locales` is a reserved literal segment after the instance id for locale
  packages.
- Locale serving must not infer locale from query params, headers, cookies,
  country, browser language, account settings, or storage walks.
- 124E may reject malformed locale tokens, encoded slashes, backslashes, `..`,
  and invalid package file names before storage lookup.

## 5. Schema, Token, And Overlay Identity Lock

### 5.1 Schema Source

Current widget text schema comes from:

```text
tokyo/product/widgets/{widgetType}/editable-fields.json
```

Roma extracts saved source text from the current widget config by calling the
editable-fields contract helpers, then writes concrete saved text fields to
`instance.content.json`.

### 5.2 Current Saved Field Identity

Current saved field identity has two layers:

1. Durable overlay key: the concrete saved content path.
2. Token/source identity metadata: `identityKey` and `fieldPattern` stored on
   the saved content field when available.

Current durable overlay body keys are concrete paths such as:

```text
headline
sections.0.faqs.0.question
items.2.title
```

Current overlay files do not use `identityKey` as the `values` key.

### 5.3 Identity Key Format

Current scalar identity key creation in `ck-contracts`:

```text
{widgetType}|{role}|{editableFieldPath}
```

Current repeated identity key creation:

```text
{widgetType}|{role}|{editableFieldPath}|{identityPath}={identityValue}|...
```

Repeated fields require `arrayItemIdentity` in the widget editable-fields
contract before the helper can produce an identity key.

### 5.4 124B Supported Overlay Key Scope

124B may apply the current concrete saved content path value map only.

Allowed:

```text
base source state
+ one locale overlay whose keys exactly match instance.content.json field paths
-> generated localized package bytes
```

Allowed for current repeated fields:

```text
Concrete expanded repeated paths already present in instance.content.json,
provided the overlay has the exact same concrete path set.
```

Not allowed to claim in 124B:

```text
Reorder-safe repeated token cascade across array reorders.
```

Reason: the current overlay body stores concrete paths, not token identity keys.
The current system stores `identityKey` metadata, but Tokyo overlay validation
and Translation Agent writes still use concrete saved paths as the durable
overlay body keys. Reorder-safe repeated cascade requires a full overlay-key
chain change and belongs to a later PRD, not 124B.

## 6. Overlay Body Contract

Current overlay body is exactly:

```json
{
  "values": {
    "[concrete saved content path]": "[translated string]"
  }
}
```

Current rules:

- The overlay document must have exactly one top-level key: `values`.
- Every `values` key must be a non-empty concrete path.
- Every `values` value must be a string.
- No account, instance, locale, lifecycle, source revision, hash, pointer,
  readiness, or fallback metadata may appear in the overlay body.
- The overlay value set must exactly match the saved source field path set.
- Missing path is failure.
- Unexpected path is failure.
- Invalid string value is failure.
- Base locale must not have an overlay.
- Runtime materialization uses one locale value map at a time.
- No fallback stack exists.

## 7. 124B Materializer Input Contract

124B receives already-resolved inputs. It does not fetch R2, read accounts,
call Roma, call Tokyo, call Translation Agent, inspect account settings, or
make product decisions.

### 7.1 Base Locale Input

Base package materialization input:

```ts
{
  artifactCoordinate: {
    kind: "account-instance-widget";
    accountPublicId: string;
    instanceId: string;
    baseLocale: string;
    requestedLocale: string; // equals baseLocale for base materialization
  };
  compiled: RuntimeMaterializerCompiledWidget;
  state: Record<string, unknown>;
  displayName: string;
  evidence: RuntimeMaterializerEvidenceInput;
}
```

Base output must embed only the base locale state, matching the current Roma
package builder behavior:

```text
window.CK_LOCALE_POLICY = { baseLocale, languages: [baseLocale] }
window.CK_WIDGETS[instanceId].locales = { [baseLocale]: state }
window.CK_WIDGETS[instanceId].selectedLocale = baseLocale
```

### 7.2 Non-Base Locale Input

Non-base package materialization input:

```ts
{
  artifactCoordinate: {
    kind: "account-instance-widget";
    accountPublicId: string;
    instanceId: string;
    baseLocale: string;
    requestedLocale: string; // non-base locale
  };
  compiled: RuntimeMaterializerCompiledWidget;
  state: Record<string, unknown>;
  displayName: string;
  localeOverlay: {
    locale: string;
    keyKind: "current_saved_content_concrete_path";
    values: Record<string, unknown>;
  };
  evidence: RuntimeMaterializerEvidenceInput;
}
```

124B must derive the expected concrete path set from the same current field
contract path expansion used by Roma source extraction, then apply the one
provided overlay map to a cloned base state. It must not call Tokyo to validate
again, because 124B is not the storage authority.

For non-base materialization, `compiled.editableFields` is required. Missing,
invalid, or widget-mismatched editable-fields contracts fail as
`compiled_widget_invalid`.

`artifactCoordinate` is the single coordinate truth. 124B must not reintroduce
top-level `accountPublicId`, `instanceId`, `baseLocale`, or `requestedLocale`
aliases.

## 8. Package Fingerprint Contract

Current generated public package fingerprint is executable and already exists
in Tokyo-worker.

124B must reproduce this exact algorithm for generated package output:

```ts
const payload = [
  `index.html:${indexHtml.length}`,
  indexHtml,
  `styles.css:${stylesCss.length}`,
  stylesCss,
  `runtime.js:${runtimeJs.length}`,
  runtimeJs,
].join("\n");

generatedPackageFingerprint =
  "sha256:" + sha256Hex(new TextEncoder().encode(payload));
```

Important details:

- The length used by current code is JavaScript string `.length`, not UTF-8
  byte length.
- File order is fixed: `index.html`, `styles.css`, `runtime.js`.
- The fingerprint includes both labels and file contents.
- The current R2 custom metadata key is `publicPackageFingerprint`.
- Tokyo uses this fingerprint to reject mixed source/package state.

124B must compute `generatedPackageFingerprint` from the package bytes it
returns. It must not accept this value from the caller.

## 9. Evidence Contract For 124B

124B must return evidence, but 124B does not own evidence persistence.

Current Tokyo persists only `publicPackageFingerprint` on source/config and R2
package metadata. Source/schema/overlay fingerprints are not current persisted
product truth.

For 124B, evidence is caller provenance echo plus the generated package
fingerprint computed from returned bytes. It is not enforceable source/schema
proof until a later PRD defines computation, persistence, and fail-closed
checks for those fields.

### 9.1 Evidence Input

124B evidence input:

```ts
{
  sourceReference: string;
  sourceFingerprint: string;
  schemaWidgetContractFingerprint: string;
  overlayFingerprint: string | null;
}
```

124B treatment:

- `sourceReference`: caller-supplied current source coordinate.
- `sourceFingerprint`: caller-supplied provenance echo. 124B echoes it but does
  not treat it as persisted product evidence.
- `schemaWidgetContractFingerprint`: caller-supplied provenance echo. 124B
  echoes it but does not treat it as persisted product evidence.
- `overlayFingerprint`: `null` for base; non-empty string required for
  non-base. 124B echoes it but does not treat it as persisted product evidence.
- `materializerContractVersion`: owned by the 124B package as an exported
  contract constant and returned only in evidence output. Callers must not pass
  arbitrary materializer contract strings into 124B evidence.

124C owns local source/schema evidence computation for adapter/materializer
calls. Public-serving enforcement of source/schema/overlay fingerprints is not
part of initial 124E; any future decision to persist those fingerprints in
Roma/Tokyo and make mismatches fail closed must be explicitly scoped in a later
PRD. 124B must not invent that persistence.

### 9.2 Evidence Output

124B evidence output:

```ts
{
  localeCoordinate: {
    kind: "account-instance-widget";
    accountPublicId: string;
    instanceId: string;
    baseLocale: string;
    requestedLocale: string;
  };
  sourceReference: string;
  sourceFingerprint: string;
  schemaWidgetContractFingerprint: string;
  overlayFingerprint: string | null;
  materializerContractVersion: string;
  generatedPackageFingerprint: string;
  supportFileFingerprints: [];
}
```

Current support file fingerprint list is always empty in 124B because current
serving has no immutable support-file package contract. `styles.css` and
`runtime.js` are current entry files, not immutable support files.

## 10. Failure Reason Key Contract

124B must return explicit failures. It must not repair, coerce, omit, or fall
back. Existing current reason keys must be used where current code already has
one. Package-only reasons remain package-owned until 124C maps them into Roma.

| Failure | 124B reason | 124B reasonKey |
| --- | --- | --- |
| Compiled widget invalid | `compiled_widget_invalid` | `coreui.errors.widget.compiled.invalid` |
| Widget package missing | `widget_package_missing` | `coreui.errors.widget.packageMissing` |
| Widget package file missing | `widget_package_file_missing` | `coreui.errors.widget.packageMissing:{path}` |
| Widget package root invalid | `widget_package_root_invalid` | `coreui.errors.widget.packageRootInvalid` |
| Artifact coordinate invalid | `locale_coordinate_invalid` | `coreui.errors.instance.invalidPayload` |
| Source/base state invalid | `source_state_invalid` | `coreui.errors.instance.content.invalid` |
| Base input includes overlay | `locale_overlay_unexpected_for_base` | `locale_overlay_unexpected_for_base` |
| Non-base input missing overlay | `locale_overlay_missing` | `tokyo.translation.notFound` |
| Non-base overlay locale differs from requested locale | `locale_overlay_locale_mismatch` | `locale_overlay_locale_mismatch` |
| Non-base input lacks valid compiled editable fields | `compiled_widget_invalid` | `coreui.errors.widget.compiled.invalid` |
| Overlay value is not a string | `locale_overlay_value_invalid` | `coreui.errors.instance.invalidPayload` |
| Overlay missing expected path | `locale_overlay_key_missing` | `tokyo.translation.value_missing:{path}` |
| Overlay has unexpected path | `locale_overlay_key_unexpected` | `tokyo.translation.value_unexpected:{path}` |
| Reorder-safe repeated token behavior requested | `locale_overlay_scope_unsupported` | `locale_overlay_scope_unsupported` |
| Non-base missing overlay fingerprint evidence | `source_state_invalid` | `coreui.errors.instance.content.invalid` |

124B may include diagnostic detail, but success must never hide a failure in
one of the rows above.

## 11. Preview/Public Parity Lock

Current public serving does not read overlays or materialize locale artifacts
at request time. Current preview/public parity for overlay-aware artifacts is
therefore not implemented in runtime code.

124B parity obligation:

```text
Provide one pure package materializer API whose output can be used by both
future Roma save/public materialization and future Bob/Roma preview materialization.
```

124B may not modify Bob preview, public routes, or URL routing. 124D owns
preview integration. 124E owns public serving/storage integration.

## 12. CDN And Cache Lock

Current public serving headers for `index.html`, `styles.css`, and `runtime.js`
are:

```text
Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=86400
CDN-Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=86400
Cloudflare-CDN-Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=86400
```

Current cache purge covers:

```text
/{accountPublicId}/{instanceId}
/{accountPublicId}/{instanceId}/
/{accountPublicId}/{instanceId}/index.html
/{accountPublicId}/{instanceId}/styles.css
/{accountPublicId}/{instanceId}/runtime.js
```

124B must not change this. Locale-specific immutable artifacts and locale-aware
purge semantics are 124E work.

## 13. Deferred Contracts

These are explicitly not 124B:

| Contract | Owner |
| --- | --- |
| Roma reroute from current builder to package library | 124C |
| Source/schema/overlay fingerprint persistence and public-serving enforcement beyond initial 124E coordinate metadata | Later evidence PRD |
| Bob/Roma preview integration through same materializer | 124D |
| Locale-specific public serving, cache, purge, and visitor-miss behavior | 124E |
| Locale-specific cache purge semantics | 124E |
| Immutable support file package contract | 124E |
| Reorder-safe repeated token overlay storage | Later overlay-key-chain PRD |
| A/B variation materialization | Later A/B PRD |
| Personalization materialization | Later personalization PRD |
| Pages/sites/emails/apps composition | Later composition PRDs |

## 13.1 Addendum Drift Control

This addendum locks current runtime truth for 124B. Any later runtime-changing
slice that supersedes a locked section must update or explicitly supersede that
section in the same change.

Required revalidation triggers:

- 124C changes Roma package materialization or source/evidence ownership;
- 124D changes preview or locale materialization behavior;
- 124E changes public URL shape, cache headers, purge semantics, stored artifact
  paths, or evidence enforcement;
- any later overlay-key-chain PRD changes durable overlay key representation.

This is contract hygiene only. It must not create a registry, lifecycle store,
readiness ledger, compatibility reader, or runtime probe.

## 14. 124B Green Criteria

124B is code-executable when it does all of the following:

1. Produces base `index.html`, `styles.css`, and `runtime.js` with byte parity
   against the current Roma package builder for current base inputs.
2. Produces non-base locale package files by applying exactly one current
   concrete-path overlay map to a cloned base state.
3. Rejects missing, unexpected, or non-string overlay values explicitly.
4. Computes `generatedPackageFingerprint` with the current Tokyo algorithm.
5. Returns the complete evidence object in Section 9.
6. Keeps support-file evidence empty until 124E defines immutable support files.
7. Does not fetch, write, publish, purge, validate through Tokyo, or touch
   public serving.
8. Does not claim reorder-safe repeated token cascade.

## 15. Core Violation Audit

| ID | Result |
| --- | --- |
| V1 Silent substitution | Clean. This addendum locks current paths/values and forbids invented fallback values. |
| V2 Silent healing | Clean. Invalid overlays and states remain explicit failures. |
| V3 Silent omission | Clean. 124B required inputs, outputs, evidence, and deferrals are named. |
| V4 Fail-open control | Clean. Missing overlay/evidence/field contracts fail closed. |
| V5 Corruption-as-absence | Clean. Invalid overlay/source/package state is not treated as missing or empty. |
| V6 Partial-success masquerade | Clean. 124B success requires one complete package plus full evidence. |
| V7 Masquerade/redress | Clean. 124B is a package library, not a wrapper around the old builder with a new name. |
| V8 Runtime test dependency | Clean. Normal runtime remains byte serving; tests verify contracts but do not become product gates. |
