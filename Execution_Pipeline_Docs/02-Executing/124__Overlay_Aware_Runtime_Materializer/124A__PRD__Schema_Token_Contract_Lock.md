# PRD 124A - Schema-Token Contract Lock

Status: EXECUTING
Parent: `124__MAMA__Overlay_Aware_Runtime_Materializer_Program.md`
Owner: Roma + Babel + Tokyo-worker contract
Blocks: 124B, 124C, 124D, 124E

## Purpose

124A locks the exact schema-token, evidence, URL, failure, cache, Translation
Agent, and preview/public parity contracts before runtime code changes.

This is a contract-lock PRD. It must produce decisions and documentation only.
It must not change runtime behavior, storage behavior, serving behavior, or
remote product data.

## Execution Doctrine

124A executes from schema certainty, not runtime guessing.

Agents may operate only declared truth:

- current schema artifacts;
- current source and overlay authorities;
- exact token identity rules;
- exact artifact evidence;
- exact failure results;
- exact verification surfaces.

If schema and authority do not name something, 124A must not invent it,
backfill it, repair it, infer it, or serve around it.

Tenet: It is prohibited to reinterpret PRD 124 intent into an ideal system and
then add machinery to enforce that interpretation.

## Current Substrate Rule

For PRD 124, schema means existing artifacts:

```text
widget spec
editable-fields.json
saved instance source/content
saved ids named by arrayItemIdentity
```

No new Schema service, token registry, identity database, product-status store,
readiness ledger, compatibility reader, or hidden validation system may be
introduced by 124A.

## Authority Gate

| Concern | Active authority for 124A |
| --- | --- |
| Product surface | Account widget instance runtime package |
| Account/session coordinate | Roma current account from Berlin bootstrap/authz |
| Storage coordinate | `accounts/{accountPublicId}/instances/{instanceId}/` |
| Overlay coordinate | `overlays/locales/{locale}.json` under the owning instance |
| Route/API boundary | Roma account routes; Tokyo-worker internal account-instance and translation routes |
| Runtime/deploy surface | Future 124B package only; no runtime deploy in 124A |
| Public serving surface | Tokyo-worker `clk.live` / `dev.clk.live` stored-byte serving |
| Verification surface | This PRD/addendum plus current docs/code citations; no product runtime mutation |

### Compliance Rationale

The authority gate is compliant because it names existing product boundaries
before any contract decision. It prevents 124A from inventing intermediary
subsystems or moving authority into the materializer.

## System Interaction Contract

124A must preserve these boundaries:

- Roma may read and write account instance/package state only through the
  current account authority and Tokyo-worker routes.
- Translation Agent writes overlay values only through the existing Roma grant
  and Tokyo-worker overlay write boundary.
- Tokyo-worker validates and stores exact overlay/package bytes. It does not
  resolve product meaning.
- The materializer fetches nothing, mutates nothing, purges nothing, and records
  no product status.
- Bob preview uses the parity mechanism chosen in Slice 7.
- Public serving reads stored evidenced bytes only.

### Compliance Rationale

This is compliant because every system keeps its current product role. 124A
locks a contract over the existing system instead of inventing a new operation
plane.

## Slice 1 - Authority And Artifact Inventory

### Goal

Name the current files, services, and docs that already own schema, source,
overlay, package generation, package storage, preview resolution, and public
serving.

### Steps

1. Read and cite the current operator docs:
   - `documentation/architecture/BabelProtocol.md`
   - `documentation/architecture/OverlayArchitecture.md`
   - `documentation/architecture/RuntimeProfiles.md`
   - `documentation/services/roma.md`
   - `documentation/services/tokyo-worker.md`
   - `documentation/capabilities/localization.md`
2. Read and cite the current runtime code:
   - `roma/lib/account-instance-public-package.ts`
   - `tokyo-worker/src/routes/clk-live-routes.ts`
   - `tokyo-worker/src/domains/account-instances/package-files.ts`
   - `packages/ck-contracts/src/translated-value-primitives.ts`
   - `tokyo/product/widgets/*/editable-fields.json`
   - `tokyo/product/widgets/shared/previewL10n.js`, if present.
3. Write the inventory in this PRD or a `124A__Contract_Lock_Addendum.md`.

### Output

A table with:

- concern;
- current authority;
- current artifact/code path;
- current behavior;
- whether 124A changes it.

124A should change no runtime behavior.

### Compliance Rationale

This is compliant because it starts from current product truth and current
authorities. It prevents agents from idealizing a new schema system and then
building machinery around that ideal.

## Slice 2 - Schema-Token Identity Contract

### Goal

Lock token identity using current schema artifacts.

### Contract

Scalar fields:

```text
token identity = schema path
```

Repeated fields:

```text
token identity = schema path + arrayItemIdentity + saved item ids
```

Example:

```text
header.title -> token:header.title

faq.sections[].faqs[].question
+ faq.sections[].id = pricing
+ faq.sections[].faqs[].id = refunds
-> token:faq.sections[pricing].faqs[refunds].question
```

### Steps

1. Inventory scalar translatable paths from current `editable-fields.json`
   files.
2. Inventory repeated translatable paths and their `arrayItemIdentity` entries.
3. Confirm where saved item ids live in current saved source/content.
4. Reconcile the contract with current `SavedTextField.identityKey`,
   `SavedTextField.fieldPattern`, and concrete `SavedTextField.path` in
   `packages/ck-contracts/src/translated-value-primitives.ts`.
5. Choose exactly one canonical identity representation for 124B. No dual-read
   compatibility mode is allowed.
6. Define exact failure for:
   - missing schema path;
   - missing `arrayItemIdentity` declaration for repeated fields;
   - missing saved item id;
   - duplicate saved item id within the same repeated scope;
   - overlay key that cannot map to a schema token.

### Output

A locked identity contract:

- scalar rule;
- repeated rule;
- identity representation;
- whether the canonical representation reuses or supersedes current
  `identityKey` / `fieldPattern` / `path`, with rationale;
- failure reason keys or reason-key naming convention;
- examples from at least one scalar field and one repeated field.

### Compliance Rationale

This is compliant because it uses the current schema substrate rather than
creating a new identity layer. It preserves schema-first operation while
avoiding academic identity indirection for scalar fields.

## Slice 3 - Translation Agent Overlay-Key Compatibility

### Goal

Decide whether current Babel overlay keys can drive locale materialization under
the locked schema-token identity contract.

### Current Truth

Current Babel docs say overlay files use exact concrete field paths such as:

```text
sections.0.faqs.0.question
```

Current repeated identity law requires mapping repeated fields through
`arrayItemIdentity` and saved ids before claiming reorder-safe cascade.

### Steps

1. Inspect current Translation Agent output shape.
2. Inspect Tokyo-worker overlay validation.
3. Compare current overlay keys to the locked identity contract from Slice 2.
4. Choose exactly one 124A decision:
   - current overlay keys already map exactly to schema-token identity;
   - 124D must update the full overlay-key chain to emit and accept required
     keys;
   - 124D must limit locale cascade to scalar/path-keyed fields until repeated
     identity support exists.

### Output

A single compatibility decision with evidence:

```text
translation_overlay_key_compatibility = compatible | requires_full_overlay_key_chain_change | scalar_only_initially
```

If the decision is `requires_full_overlay_key_chain_change`, 124D is blocked
until the owner and exact output/read/write shape are named for:

- Translation Agent output;
- Roma translation routes;
- Tokyo-worker overlay validation and storage;
- Bob preview overlay consumption;
- Babel and OverlayArchitecture docs.

Translation Agent-only token-key overlays are not allowed because current
Babel/Tokyo/Bob behavior is concrete-path based.

### Compliance Rationale

This is compliant because it refuses to claim product capability that the
current overlay shape cannot support. It preserves fail-visible behavior and
prevents silent substitution in repeated structures.

## Slice 4 - Artifact Evidence Contract

### Goal

Define the exact evidence fields generated artifacts must carry.

### Contract

Evidence names real independently moving inputs only:

```text
schema/widget contract fingerprint
source fingerprint
source reference
locale coordinate
overlay fingerprint for non-base locale
materializer contract version
generated package fingerprint
support-file fingerprints
```

Do not create separate evidence fields for concepts that cannot move
independently in the current system.

### Steps

1. Define `schema/widget contract fingerprint` from current real files:
   - widget spec;
   - `editable-fields.json`;
   - widget package inputs consumed by materialization;
   - identity declarations such as `arrayItemIdentity`.
2. Define `source fingerprint` from saved instance source/config/content inputs
   consumed by materialization.
3. Define `overlay fingerprint` from exact overlay values for one non-base
   locale.
4. Define `generated package fingerprint` from generated artifact bytes.
5. Define `support-file fingerprints` from immutable support files.
6. Define the exact fingerprint method:
   - hash algorithm;
   - byte input order;
   - JSON canonicalization rule, if JSON is hashed;
   - invalid/malformed input failure result.
7. Define where evidence lives:
   - object metadata;
   - submitted package metadata;
   - response payloads as echo/proof only.
8. Explicitly exclude evidence from:
   - Babel overlay bodies;
   - sidecar readiness/status objects;
   - serve-time recomputation as product truth.

### Output

A table:

- evidence field;
- exact input;
- owner;
- where stored;
- when mismatch fails closed.

Response payload evidence is not product truth. Stored artifact metadata and
package metadata are the evidence authority.

For 124B specifically, source/schema/overlay fingerprints are caller provenance
echoes, not enforceable product evidence. 124B owns only the generated package
fingerprint it computes from returned bytes. 124B must export the
`materializerContractVersion` value; 124C/Roma must pass that owned package
constant instead of inventing a caller string. 124C/124E own computation,
persistence, and fail-closed enforcement for source/schema/overlay evidence.

### Compliance Rationale

This is compliant because artifact evidence proves cascade truth without adding
runtime probes, readiness markers, or repair logic. It preserves Tokyo-worker as
stored-byte authority and Babel overlays as pure value maps.

## Slice 5 - Public Locale URL, Artifact Paths, And CDN Contract

### Goal

Lock the public coordinate and cache shape before 124E.

### Contract

```text
pretty coordinate URL -> short TTL entry HTML
fingerprinted support files -> immutable long TTL CSS/JS
```

### Steps

1. Choose exact explicit locale URL shape using current public serving
   authority unless 124E explicitly adds a route.
2. Define base-locale URL behavior.
3. Define non-base-locale URL behavior.
4. Choose exact entry artifact storage path.
5. Choose exact immutable support artifact storage path.
6. Define cache headers for entry artifacts.
7. Define cache headers for immutable support files.
8. Define the exact entry refresh mechanism:
   - existing Tokyo/Cloudflare purge operation path, including required
     preflight; or
   - no purge authority exists yet and entry freshness relies on short TTL until
     a later approved PRD adds a managed Cloudflare operation.
9. State that the materializer must not purge.
10. State that Tokyo-worker serves stored evidenced bytes only.

### Output

A locked path/cache table:

- public URL;
- R2 key shape;
- cache headers;
- purge or TTL-only owner/path;
- serving owner;
- fail-closed result.

### Compliance Rationale

This is compliant because CDN/caching is product law. It preserves public
serving economics by avoiding visitor-time materialization, request-time overlay
reads, and mutable CSS/JS cache mixing.

## Slice 6 - Failure Contract

### Goal

Define exact failure outcomes so later code cannot hide invalid state.

### Steps

Define failure result for:

- missing source;
- malformed source;
- missing schema field;
- missing saved repeated item id;
- duplicate repeated item id;
- missing overlay for requested non-base locale;
- malformed overlay body;
- unexpected overlay key within the supported materialization scope chosen in
  Slice 3;
- missing overlay key within the supported materialization scope chosen in
  Slice 3;
- repeated-field overlay excluded by a `scalar_only_initially` decision;
- stale artifact evidence;
- incompatible materializer contract version;
- missing immutable support file;
- content type metadata mismatch.

### Output

A failure table:

- condition;
- owner that detects it;
- HTTP status if exposed through a route;
- reason key;
- product response shape;
- whether any fallback is allowed.

Fallback must always be `no` for requested locale artifacts.

If repeated identity is deferred, repeated fields must be explicitly
non-claimed for locale materialization. They must not be silently omitted.

### Compliance Rationale

This is compliant because it makes invalid states explicit and fail-closed. It
does not add repair, fallback, probe, or compatibility behavior.

## Slice 7 - Preview/Public Parity Contract

### Goal

Ensure Bob preview and public materialization resolve the same schema-token
truth.

### Steps

Default parity mechanism:

- shared resolver code used by Bob preview and 124B materializer.

Conformance-only parity is allowed only if 124A records why shared resolver
code is not feasible without adding runtime machinery.

If conformance-only parity is chosen, the conformance suite must run the same
source, overlay, and expected resolved state through both preview and
materializer resolution.

Define required parity cases:

- scalar text overlay;
- repeated text overlay if repeated identity is supported;
- missing key failure;
- unexpected key failure;
- no fallback locale;
- no alternate document;
- Bob preview visible failure for the same invalid overlay cases public
  materialization rejects.

### Output

A parity decision and required test cases for 124B/124D.

### Compliance Rationale

This is compliant because preview is a product promise. Parity must be proven by
shared schema logic or conformance, not by runtime probes or human QA ritual.

## Slice 8 - 124A Closeout Gate

### Goal

Decide whether 124B may start.

### Steps

1. Confirm Slices 1-7 are complete.
2. Confirm no runtime code changed under 124A.
3. Confirm every unresolved item is explicitly assigned to 124B-124H.
4. Run doc checks.
5. Record V1-V8 audit for the contract.
6. Record whether any addendum section is current truth that later runtime
   slices must revalidate.

### Acceptance

124A is complete only when:

- current schema substrate is named;
- scalar and repeated token identity rules are locked;
- Translation Agent compatibility is decided;
- evidence fields are locked;
- locale URL and cache shape are locked;
- failure table is locked;
- preview/public parity mechanism is locked;
- 124B can implement without inventing missing product truth.
- no Slice 2-7 output contains unresolved placeholder or compatibility language
  unless assigned to a named later SubPRD with an explicit product limitation.
- later runtime-changing slices are required to update or explicitly supersede
  any locked addendum section they invalidate.

## Required Documentation Updates

124A must update docs only if it changes canonical current-system claims:

- `documentation/architecture/BabelProtocol.md`
- `documentation/architecture/OverlayArchitecture.md`
- `documentation/architecture/RuntimeProfiles.md`, if public URL/cache shape
  changes current runtime truth
- `documentation/capabilities/localization.md`
- `documentation/ai/agents/translation-agent.md`, if overlay key output changes
- `documentation/services/roma.md`
- `documentation/services/tokyo-worker.md`
- `documentation/strategy/Clickeen-Babel.md`, if the Babel strategy claim
  changes
- `documentation/strategy/GlobalReach.md`, if public locale serving semantics
  change
- relevant `documentation/widgets/shared/**` docs, if preview/runtime locale
  behavior changes

If 124A only records future execution contracts, the updates remain inside this
124 folder.
