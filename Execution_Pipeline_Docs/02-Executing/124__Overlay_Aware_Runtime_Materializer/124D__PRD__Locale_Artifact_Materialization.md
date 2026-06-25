# PRD 124D - Locale Artifact Materialization

Status: EXECUTING
Parent: `124__MAMA__Overlay_Aware_Runtime_Materializer_Program.md`
Depends on: 124A GREEN, 124B CODE-DELIVERED, 124C CODE-DELIVERED
Owner: Roma + Translation Agent + Tokyo overlay/package storage + materializer contract

## Purpose

Materialize active non-base locale artifacts from exact source plus exact Babel
locale overlays.

124D turns this:

```text
saved source + one active non-base locale overlay
```

into this:

```text
stored evidenced locale package bytes
```

It does not expose public locale serving. 124E owns public stored-byte serving
and CDN behavior.

## Product Law

Babel overlays are token/value overlays, not alternate documents.

Translation Agent writes the overlay value map. Roma owns the account command
that turns saved source plus that overlay into generated locale package bytes.
Tokyo-worker stores exact overlay files and exact generated package files. The
materializer only resolves explicit input into files.

124D must not move these authorities.

## Non-Reinterpretation Tenet

124D must not reinterpret locale overlays into an ideal localization platform
and then add machinery around that interpretation.

Forbidden additions in 124D:

- alternate localized source documents;
- request-time overlay composition;
- fallback locale behavior;
- overlay precedence stacks;
- A/B or personalization overlays;
- public locale serving;
- selected-locale pointers;
- generation ledgers;
- lifecycle/status files;
- storage walks that decide work;
- repair or backfill routines;
- compatibility readers for old overlay shapes;
- Translation Agent package generation.

## Precondition Gate

124D may begin only after all conditions are true:

1. 124A names the canonical overlay key representation for 124B/124D.
2. 124A names the locale artifact storage coordinate and evidence fields.
3. 124B exposes the non-base locale resolver for the 124A-supported overlay
   scope.
4. 124C reroutes base generation through the package without changing public
   base behavior.
5. Translation Agent overlay-key compatibility has one closed decision:
   - current overlay keys are accepted for 124D; or
   - Translation Agent/Roma/Tokyo overlay key changes are part of 124D; or
   - reorder-safe repeated token cascade is explicitly unsupported/non-claimed
     until its full key-chain change is assigned.

If any precondition is not closed, 124D stops before implementation. The agent
must not infer the missing contract.

Plan-green is not enough for 124D execution. 124D calls the 124B materializer
package and depends on the 124C base reroute contract, so both must exist in code
before locale package materialization is wired.

## Authority Gate

| Concern | Active authority for 124D |
| --- | --- |
| Product surface | Account widget instance non-base locale package artifact |
| Account/session coordinate | Roma current account/session bootstrap and account active-locale state |
| Source coordinate | Tokyo saved instance source: `instance.config.json` and `instance.content.json` |
| Overlay coordinate | Tokyo Babel overlay path: `accounts/{accountPublicId}/instances/{instanceId}/overlays/locales/{locale}.json` |
| Generated package coordinate | `accounts/{accountPublicId}/instances/{instanceId}/locales/{locale}/index.html`, `styles.css`, `runtime.js` |
| Route/API boundary | Existing Roma translation/account-locale routes plus existing or narrowly extended Tokyo internal account-instance package write route |
| Runtime/deploy surface | Roma Pages plus Tokyo-worker only if package storage route is extended; public serving remains unchanged |
| Verification surface | Roma translation route tests, Translation Agent overlay tests if key output changes, Tokyo storage tests if package write route changes, package tests, R2 evidence after deploy only when deploy is claimed |

### Compliance Rationale

This is compliant because every operation uses the owner that already controls
that truth: Roma decides account/locale commands, Translation Agent writes
overlays, Tokyo stores artifacts, and the materializer resolves explicit data.
No new subsystem becomes the owner of locale truth.

## Slice 1 - Closed Contract Check

### Goal

Confirm 124D has enough schema/product law to execute without invention.

### Steps

1. Read the final 124A contract.
2. Record the canonical overlay key representation:
   - concrete path;
   - token identity;
   - or another exact 124A-approved representation.
3. Record whether repeated text fields are in scope.
4. Record the locale artifact storage coordinate chosen by 124A.
5. Record the artifact evidence fields chosen by 124A/124B.
6. Record the 124B materializer function that accepts non-base locale input.
7. Stop if any entry above is missing or unresolved.

### Output

A 124D implementation note naming the exact key, artifact path, evidence, and
scope that implementation will use.

### Compliance Rationale

This is compliant because schema and product contracts lead execution. An agent
cannot fill gaps with a preferred localization design.

## Slice 2 - Overlay-Key Compatibility Work

### Goal

Make Translation Agent/Roma/Tokyo overlay values compatible with the 124A
identity decision.

### Steps

1. If 124A accepts current concrete paths, make no Translation Agent key-format
   change.
2. If 124A requires token identity keys, update the whole overlay chain in one
   coordinated slice:
   - Roma item construction;
   - Translation Agent item parsing/output;
   - Translation Agent Tokyo write body;
   - Tokyo overlay body acceptance;
   - Roma overlay read normalization;
   - Bob preview consumption if it reads the same overlay values.
3. If reorder-safe repeated token cascade is requested before the overlay-key
   chain supports it, reject that claim with the exact unsupported/non-claimed
   result from 124A/124B. Current 124A supports concrete expanded repeated paths
   when the overlay key set exactly matches `instance.content.json`.
4. If overlay key shape changes, already-stored old-shape overlays fail
   explicitly for locale package materialization and must be regenerated through
   the named Roma/Translation Agent operation before materialization. 124D must
   not add dual readers, compatibility readers, repair jobs, or silent backfill.
5. Roma overlay read normalization must only adapt the single 124A-approved
   stored representation into the materializer input shape.
6. Do not support both old and new overlay key formats.
7. Do not silently translate only scalar fields while claiming full locale
   artifact materialization.

### Output

One accepted overlay key representation across producer, storage, reader,
preview, and materializer.

### Compliance Rationale

This is compliant because overlay identity is schema/token truth. Dual readers
or partial claimed support would create legacy compatibility machinery and
silent omission.

## Slice 3 - Roma Locale Materialization Command

### Goal

Add a Roma-owned command that materializes one active non-base locale.

### Steps

1. Create a Roma helper near current account instance package/translation code.
2. Input must include:
   - account public id;
   - current account capsule;
   - request id;
   - instance id;
   - base locale;
   - requested non-base locale;
   - saved instance source/config/content loaded through Tokyo;
   - compiled widget package from Bob;
   - exact overlay values loaded through Tokyo;
   - caller-decided byte-affecting account values already used by 124C.
3. Confirm requested locale is active on the account and is not the base locale.
4. Use the existing Roma/Tokyo read path for the overlay:
   `readAccountInstanceTranslationValues`.
5. Use the same Roma media-resolution step as 124C before calling the package.
6. Call the 124B materializer with requested locale and exactly one overlay.
7. Use the same byte-stable state serialization path as 124C:
   - media-materialized state enters the package without key-order drift;
   - exact locale `runtime.js` bytes are compared in tests;
   - materializer contract version comes from the 124B package-owned constant.
8. Pass evidence without inventing a new authority:
   - source/schema evidence inputs come from the 124C-owned Roma computation;
   - overlay fingerprint comes from the exact locale overlay body;
   - generated package fingerprint comes from the materializer/Tokyo package
     fingerprint algorithm.
9. Return generated files plus evidence to the caller that will write them to
   Tokyo.

### Output

A Roma helper that can materialize exactly one active non-base locale artifact.

### Compliance Rationale

This is compliant because Roma already owns account active locales, saved
instance commands, Bob compile access, and Tokyo reads. The helper brings exact
truth to the materializer; it does not make the materializer fetch, infer, or
decide account policy.

## Slice 4 - Tokyo Locale Package Storage

### Goal

Store generated locale package bytes without exposing public serving.

### Steps

1. Use the locale artifact coordinate selected by 124A:
   `accounts/{accountPublicId}/instances/{instanceId}/locales/{locale}/`.
2. If Tokyo needs a new internal write operation, implement it inside the
   existing account-instance package domain, not as a separate storage system.
3. Authorize writes with Roma's account capsule, not a Translation Agent grant.
4. Store only generated package bytes and evidence required by 124A/124B:
   - `index.html`;
   - `styles.css`;
   - `runtime.js`;
   - content types;
   - the 124A locale package custom metadata keys:
     `publicPackageFingerprint`, `localePackageAccountPublicId`,
     `localePackageInstanceId`, `localePackageBaseLocale`,
     `localePackageLocale`, `localePackageSourceUpdatedAt`,
     `materializerContractVersion`.
5. Do not store overlay values inside generated package metadata.
6. Do not store lifecycle/status files.
7. Do not add a public read/serve path in 124D.
8. Preserve the overlay file untouched; generated package bytes are derived
   artifacts beside source/overlay truth, not replacements for either.

### Output

Tokyo can accept exact generated locale package bytes at the 124A coordinate,
but public requests cannot yet serve them.

### Compliance Rationale

This is compliant because Tokyo already owns account artifact storage. Locale
package files are stored bytes for future CDN serving, not a runtime overlay
reader or a second source document.

### Metadata Law

The locale package metadata is intentionally narrow:

- `publicPackageFingerprint` is generated from the locale package bytes.
- Coordinate metadata binds the package to the account public id, instance id,
  base locale, and requested locale.
- `localePackageSourceUpdatedAt` echoes the current published source pointer
  `updatedAt` value loaded by Roma for this command.
- `materializerContractVersion` comes from the 124B package-owned constant.
- Source/schema/overlay fingerprints are not persisted as enforceable Tokyo
  serving truth in 124D.

This keeps 124D executable with the existing R2 custom metadata pattern and
does not invent manifests, sidecar status files, or visitor-time overlay checks.

## Slice 5 - Translation Generation Integration

### Goal

Materialize locale artifacts after successful overlay generation.

### Steps

1. Keep Translation Agent responsible only for generating and writing overlay
   value files.
2. After `generateAccountInstanceTranslations` confirms every requested overlay
   write succeeded, have Roma materialize generated locale artifacts for those
   same active non-base locales.
3. Process locales in deterministic active-locale order.
4. If a locale artifact write succeeds, keep that stored artifact.
5. On the first locale artifact failure, stop processing remaining locales.
6. Return the existing Roma failure envelope with an explicit materialization
   result payload that names:
   - completed locale coordinates;
   - skipped locale coordinates not attempted after the failure;
   - failed locale coordinate;
   - failed phase;
   - full success as false, or the existing equivalent `ok: false` field.
7. The failed coordinate must include:
   - account public id;
   - instance id;
   - locale;
   - phase: overlay read, materializer, or package write.
8. Do not claim full success unless every requested locale has both:
   - a stored overlay file; and
   - a stored generated locale package artifact.
9. Do not roll back prior successful overlay files or locale package files.
10. Do not call this partial completion; it is explicit coordinate-scoped
   success/failure evidence.
11. The completed/skipped/failed coordinate payload must be visible in the Roma
    command response. 124F owns broader account-admin locale status UX. 124D
    must not create lifecycle files, readiness files, generation ledgers, or
    persistent status objects.

### Output

Generation of active non-base locale overlays also produces locale package
artifacts for the same completed locales.

### Compliance Rationale

This is compliant with current Babel failure law: prior successful writes remain
because they are real artifacts, but Roma must not masquerade incomplete work as
full success. The result tells the user/operator exactly which coordinate did
not complete.

## Slice 6 - Account Active-Locale Settings Integration

### Goal

Preserve the existing account settings operation while adding package artifact
creation for newly generated overlays.

### Steps

1. Keep active-locale setting writes owned by Roma account settings.
2. Keep removed-locale overlay deletion owned by Roma/Tokyo.
3. When an active locale is removed, delete the generated locale package
   artifact for that locale through the same account-owned follow-up boundary as
   overlay deletion.
4. If generated package deletion fails after settings save, report explicit
   follow-up failure with account public id, instance id, locale, and phase
   `locale-package-delete`.
5. Do not leave the response implying removed-locale artifacts are fully cleaned
   up when only the overlay was deleted.
6. For added locales, rely on the same generation helper from Slice 5 so
   overlay generation and locale package materialization stay one account-owned
   operation.
7. If overlay follow-up fails after the settings write, keep current behavior:
   account settings remain saved and response reports explicit follow-up
   failure.
8. Include locale artifact failure details in that explicit follow-up failure
   when materialization fails after overlay generation.
9. Do not ask Bob to decide follow-up work.
10. Do not create a separate product-state file for the follow-up.

### Output

Account active-locale changes preserve current user/account semantics and add
explicit locale artifact materialization where overlays are generated.

### Compliance Rationale

This is compliant because account locale settings are the user's account truth.
Generated overlay/package artifacts are follow-up artifacts governed by Roma and
Tokyo, not a second account setting or lifecycle layer.

## Slice 7 - Failure Contract

### Goal

Make all failure modes exact and non-silent.

### Failure Cases

- requested locale is base locale;
- requested locale is not active on the account;
- requested locale overlay is missing;
- overlay body is malformed;
- overlay keys are missing or unexpected for the supported 124A scope;
- reorder-safe repeated token cascade is requested before the overlay-key-chain
  PRD supports it;
- saved instance source/content is malformed;
- compiled widget package is missing or invalid;
- media resolution fails;
- materializer rejects input;
- Tokyo package write fails.

### Steps

1. Map each failure to an explicit Roma route error shape.
2. Include the exact account/instance/locale coordinate when the error is
   locale-specific.
3. Do not replace missing overlay values with base values.
4. Do not drop unexpected overlay values.
5. Do not serve or write the base artifact as the locale artifact.
6. Do not claim the locale artifact exists unless Tokyo accepted the generated
   package bytes.

### Output

Coordinate-specific failure behavior that respects V1-V8.

### Compliance Rationale

This is compliant because it preserves source-truth fidelity and rejects silent
substitution, silent omission, fail-open control, and partial-success
masquerade.

## Slice 8 - Focused Tests

### Goal

Prove locale artifact materialization without public serving.

### Required Tests

1. Materializer package test:
   - source plus one non-base overlay produces locale `index.html`,
     `styles.css`, and `runtime.js`.
2. Roma helper test:
   - active non-base locale is accepted;
   - base locale is rejected;
   - inactive locale is rejected;
   - missing overlay is rejected.
3. Overlay key test:
   - missing expected key fails;
   - unexpected key fails;
   - concrete expanded repeated paths materialize when the overlay key set
     exactly matches `instance.content.json`;
   - reorder-safe repeated token cascade returns the exact unsupported result.
4. Tokyo storage test if a storage route is added:
   - locale package bytes store at the 124A coordinate;
   - content types are correct;
   - evidence/fingerprint metadata is present;
   - no public route serves the bytes in 124D.
5. Translation generation integration test:
   - successful overlay generation triggers package materialization for the same
     active locales;
   - failure after one locale stops remaining locale processing, returns
     completed/skipped/failed coordinates, and does not claim full success.
6. Account locale settings test:
   - added locale generation reports locale artifact failure through the
     existing `overlayUpdate` failure shape.
   - removed locale deletion reports `locale-package-delete` follow-up failure
     when generated package deletion fails after settings save.
7. Byte-stable state serialization test:
   - exact locale `runtime.js` bytes are compared;
   - media-materialized state key order does not drift from 124C.
8. Command response visibility test:
   - completed/skipped/failed coordinates are present in the Roma response;
   - no lifecycle/status/readiness file is written.

### Output

Focused tests that prove the generated locale artifact exists only through
explicit source plus overlay materialization.

### Compliance Rationale

This is compliant because tests prove the owning command behavior. They do not
become runtime checks, product status, or serving gates.

## Slice 9 - Runtime Verification

### Goal

Verify through the owning surfaces.

### Steps

1. Run materializer package tests.
2. Run Roma translation/materialization tests.
3. Run Translation Agent tests/evals only if overlay key output changes.
4. Run Tokyo package storage tests only if Tokyo write behavior changes.
5. Run focused typecheck/lint for touched packages.
6. If deployed, use the correct deploy evidence:
   - Roma Pages Git-connected build from `main` for Roma changes;
   - GitHub Actions `cloud-dev workers deploy` for Translation Agent or
     Tokyo-worker changes.
7. If deployed and remote R2 evidence is needed, run `pnpm cf:preflight` before
   R2 reads.
8. If not deployed, closeout must state no deploy/runtime claim was made.

### Output

Evidence matching the surfaces actually changed.

### Compliance Rationale

This is compliant because verification follows the source of truth: Roma for
account command behavior, Translation Agent for overlay production only when its
output changes, Tokyo/R2 for stored bytes, and Cloudflare only for deploy
claims.

## Slice 10 - 124D Closeout Gate

### Steps

1. Confirm one active non-base locale can materialize from exact source plus
   exact overlay.
2. Confirm no public locale URL is exposed.
3. Confirm Translation Agent still writes only overlay values.
4. Confirm Roma owns package materialization after overlay success.
5. Confirm Tokyo stores generated locale package bytes only through the selected
   124A coordinate.
6. Confirm no base artifact is written as a locale artifact.
7. Confirm no alternate localized source document exists.
8. Confirm concrete expanded repeated paths materialize under current 124A
   scope and reorder-safe repeated token cascade is not claimed.
9. Confirm locale artifact byte-stability uses the same state serialization
   gate as 124C.
10. Confirm completed/skipped/failed coordinate evidence is returned through the
    Roma command response and broader admin/status UX is handed to 124F.
11. Confirm source/schema/overlay evidence is not persisted as lifecycle/status
    truth in 124D.
12. Record commit/push/deploy state.
13. Reconcile whether verification stopped at local checks or included deployed
   runtime/R2 evidence.
14. Record V1-V8 audit.

### Acceptance

- One active non-base locale can materialize from exact source plus exact
  overlay.
- Missing or unexpected overlay keys fail explicitly.
- No base artifact is served or stored as the requested locale artifact.
- Translation Agent does not generate package bytes.
- Public locale serving remains unavailable until 124E.
- Multi-locale generation reports exact incomplete coordinates when a later
  locale fails.
- Broader account-admin visibility for locale artifact status is assigned to
  124F unless 124D explicitly wires existing UI without adding status files.

## Required Documentation Updates

Update current-system docs only for behavior that changes in 124D:

- `documentation/architecture/BabelProtocol.md`: add that successful active
  locale overlay generation now has a Roma-owned generated locale package
  materialization step; Babel overlay bodies remain exact `{ "values": ... }`.
- `documentation/architecture/OverlayArchitecture.md`: add the generated
  locale artifact behavior and explicitly state public serving is still not
  exposed until 124E.
- `documentation/ai/agents/translation-agent.md`: update only if overlay key
  output or response semantics change; otherwise state Translation Agent still
  writes overlays only.
- `documentation/services/roma.md`: document Roma's locale artifact
  materialization command and failure shape.
- `documentation/services/tokyo-worker.md`: document the locale package storage
  path/metadata only if Tokyo storage behavior changes.
- `documentation/architecture/RuntimeProfiles.md`: update only if 124A/124D
  adds locale package files to the account instance runtime layout.
- `documentation/capabilities/localization.md`: update overlay generation and
  active-locale settings behavior to state that successful active non-base
  overlay generation also materializes generated locale package artifacts, and
  artifact failures are reported through explicit follow-up failure.

Strategy docs such as `documentation/strategy/WhyClickeen.md`,
`documentation/strategy/Clickeen-Babel.md`, and
`documentation/strategy/GlobalReach.md` do not change unless 124D changes the
strategic claim. Expected outcome: no strategy doc change.
