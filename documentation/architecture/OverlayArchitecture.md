# Overlay Architecture (Canonical)

STATUS: CANONICAL CURRENT MODEL

This file is the canonical overlay architecture for Clickeen.

It defines how all instance/content overlays must work across authoring, generation, publication, and runtime consumption. Localization is the first live overlay layer. Future layers must fit this contract instead of inventing parallel pipelines.

For system context, see [CONTEXT.md](./CONTEXT.md), [BabelProtocol.md](./BabelProtocol.md), and [documentation/widgets/WidgetBuildContract.md](/Users/piero_macpro/code/VS/clickeen/documentation/widgets/WidgetBuildContract.md).

---

## Hard Invariants

1. Every widget instance has exactly one authored base document.
2. The base document is the only authoring root. Overlays are never co-equal roots, editors, or identities.
3. Every overlay is relative to one immutable `baseFingerprint`.
4. If the base changes, overlay freshness is re-evaluated against the new `baseFingerprint`.
5. Every overlay layer has an explicit allowlisted patch surface.
6. Every overlay layer has exactly one authority that selects its active `layerKey`.
7. Consumer paths are read-only. They do not generate, heal, backfill, or choose “best available” overlays.
8. Builder preview and public runtime consume the same published overlay truth. Builder differs only in interaction gating.
9. A layer is selectable only when its artifact is current for the active `baseFingerprint`.
10. If a selectable overlay artifact is missing for the active `baseFingerprint`, that is a named system failure at the owning boundary.
11. System-generated overlay convergence is Tokyo/Tokyo-worker owned. Queue delivery is a trigger, not workflow truth.
12. Operator-authored and user-authored layers still publish through Tokyo/Tokyo-worker and obey the same fingerprint/readiness rules, but they do not automatically get queue/work-item orchestration.
13. Tokyo/Tokyo-worker publish one composition contract for the active base. Consumers must not fork selection, readiness, or precedence logic.
14. No new overlay layer may ship without a declared selector, allowlist, precedence, readiness rule, publication contract, and lifecycle model.

---

## Canonical Concepts

### Base Document

The saved widget document for one `publicId`.

- Authored in Bob
- Saved by Roma
- Stored canonically in Tokyo
- Locale-free and overlay-free as identity

### Base Fingerprint

The fingerprint of the exact base snapshot an overlay is derived from.

- Binds every overlay artifact to one immutable base version
- Prevents stale overlays from silently becoming current truth
- Is part of overlay identity, not optional metadata

### Layer

A named overlay dimension.

Examples:
- `locale`
- `geo`
- `industry`
- `account`
- `experiment`
- `behavior`
- `user`

### Layer Key

The concrete selected value inside a layer.

Examples:
- `fr`
- `DE`
- `healthcare`
- `acct_salesforce_enterprise`
- `exp_12:b`
- `returning-user`

### Overlay Artifact

A validated, allowlisted patch artifact for one:

- `publicId`
- `layer`
- `layerKey`
- `baseFingerprint`

The artifact may be stored internally as ops/text/meta packs, but product semantics are always the same: it is derived, fingerprint-bound, and not a second root.

### Selection Contract

The rule that selects zero, one, or many `layerKey` values for a request or preview context.

Every layer must define:
- who owns selector truth
- whether the layer is single-select or multi-select
- deterministic ordering when multiple keys are allowed

### Published Overlay Truth

The runtime-consumable artifact set for the active base.

Consumers read only published/current artifacts. They do not inspect draft, generation, or repair state.

This is not the same thing as instance `published` / `unpublished`.
Instance publish state is a separate Tokyo-owned per-instance serve flag that answers only whether Venice may serve the instance at all.
Overlay publication answers which overlay artifacts are current/servable for that instance once serving is allowed.

### Published Composition Contract

The Tokyo/Tokyo-worker-published contract that all consumers read for the active base.

It defines:
- which layers are product-active for the surface
- canonical precedence
- which keys are current/ready for exposure
- any selector mappings that consumers are allowed to use

Consumers may resolve raw request context locally, but they must not invent independent selection, readiness, or precedence rules.

### Work Item

The durable Tokyo/Tokyo-worker record that owns convergence of overlay artifacts for the current base.

Only system-generated layers use durable convergence work items by default.

Operator-authored and user-authored layers still use the same base fingerprint, allowlist, publication, and readiness rules, but they do not inherit queue/work-item orchestration unless a PRD explicitly requires it.

---

## System Planes

### 1. Authoring Plane

Systems:
- Bob
- Roma

Responsibilities:
- edit base truth
- save base truth
- request overlay convergence when base changes

Must not:
- own overlay generation
- own overlay lifecycle truth
- invent alternate runtime composition paths

### 2. Overlay Control Plane

Systems:
- Tokyo
- Tokyo-worker
- San Francisco when generation is AI-assisted

Responsibilities:
- compute or validate `baseFingerprint`
- store canonical overlay rows/artifacts
- own durable work items for system-generated layers
- publish runtime-consumable overlay artifacts
- publish one composition contract consumed by all runtime surfaces
- expose ready/current keys to consumers

Must not:
- let queue messages become workflow truth
- let consumer reads heal missing state
- let each consumer redefine selection, readiness, or precedence

### 3. Consumer Plane

Systems:
- Venice
- Builder preview in Bob
- Prague when serving overlay-backed content

Responsibilities:
- resolve raw context inputs
- consume the published composition contract
- compose published artifacts in deterministic order
- render

Must not:
- generate overlays
- backfill overlays
- silently downgrade to stale or other-layer output
- fork selection, readiness, or precedence logic

### 4. Policy / Context Plane

Systems:
- Berlin
- Michael where relational/account metadata is required

Responsibilities:
- own account/account-member truth
- own entitlements and policy inputs
- provide deterministic context inputs used by overlay selection

Must not:
- become a second overlay storage or composition plane

---

## Layer Contract

Every layer must declare these fields before implementation:

1. `layer`
2. `layerKey` schema
3. selector authority
4. single-select vs multi-select
5. allowlisted paths
6. authoring model:
   - system-generated
   - operator-authored
   - user-authored
7. publication artifact shape
8. readiness rule for exposure
9. precedence in composition
10. where the layer is allowed:
   - Builder preview
   - public runtime
   - Prague/runtime content
11. lifecycle model:
   - direct publication on write
   - system-generated convergence via durable work item

If any of those are unclear, the layer is not ready to implement.

---

## Canonical Precedence

When multiple layers are active, composition order is fixed and deterministic.

Last write wins.

1. base document
2. locale
3. geo
4. industry
5. experiment
6. account
7. behavior
8. user

If a layer is not active for the request, it is skipped.
If a layer is not product-supported yet, it does not get a shadow pipeline.

---

## Current Product-Active Status

This section matters because architecture scope is wider than current product scope.

- `locale`
  - Product-active
  - System-generated
  - Single-select at runtime
  - Read-only preview in Builder
- `user`
  - Legacy/residual concept only
  - Not part of the active Builder authoring loop
  - Must not be used as justification for ambient Builder overlay complexity
- `geo`, `industry`, `account`, `experiment`, `behavior`
  - Architecturally valid overlay layers
  - Not product-active in the current widget authoring/runtime path unless a PRD explicitly activates them

This means current implementation work should generalize the platform contract without shipping speculative user-facing behavior for inactive layers.

---

## Lifecycle

### Base Save

1. Bob edits one widget.
2. Roma saves the base document to Tokyo.
3. Tokyo/Tokyo-worker compute or validate the current `baseFingerprint`.
4. Tokyo/Tokyo-worker determine which active overlay layers now require convergence.
5. Tokyo/Tokyo-worker write or update durable work items for those layers.

Base save success is base success.
Overlay convergence is follow-up system work unless a PRD defines a stricter publish boundary.

### Overlay Convergence

1. Worker reads the durable work item.
2. Worker compares the current base with the overlay artifact’s required base.
3. Worker generates or validates the next overlay artifact for the exact `baseFingerprint`.
4. Worker publishes the runtime-consumable artifact.
5. Worker exposes the key as ready only after the artifact is current and complete.

### Authored Layer Publication

For operator-authored and user-authored layers:

1. A named authoring boundary writes the overlay candidate.
2. Tokyo/Tokyo-worker validate allowlist compliance and `baseFingerprint`.
3. Tokyo/Tokyo-worker publish the runtime-consumable artifact at the named boundary.
4. The layer becomes selectable only after the published/current artifact exists.

No queue/work-item pipeline is implied unless a PRD explicitly requires asynchronous convergence.

### Consumption

1. Consumer resolves raw request or preview context.
2. Consumer reads the published composition contract for the active base.
3. Consumer selects `layerKey` values only within that contract.
4. Consumer loads only current published artifacts for the active `baseFingerprint`.
5. Consumer composes them in canonical precedence order.
6. Consumer renders.

No read-path healing.
No inline generation.
No “best available” fallback.

---

## Guardrails

- Do not model overlays as copies of the full widget config unless a PRD explicitly requires it.
- Do not let any layer create a second widget identity.
- Do not let Builder own per-layer truth that Tokyo/Tokyo-worker should own.
- Do not let a new layer invent a new storage plane if Tokyo/Tokyo-worker should own it.
- Do not create queue/work-item scaffolding for operator-authored or user-authored layers unless a PRD explicitly requires asynchronous convergence.
- Do not build generic overlay machinery that current product layers do not need yet.
- Do not preserve l10n-specific names as permanent architecture just because localization shipped first.

The correct move is:
- preserve the good primitives
- generalize the contract
- delete conflicting residue

---

## Admission Checklist For A New Layer

Before a new overlay layer is implemented, the PRD must answer:

1. What customer/product problem does this layer solve?
2. Who selects the `layerKey`?
3. Is the layer single-select or multi-select?
4. Which paths may it touch?
5. Is it generated, operator-authored, or user-authored?
6. What makes it current/ready for exposure?
7. Does Builder preview it, public runtime consume it, or both?
8. Where does it sit in precedence?
9. What is the failure behavior when the selected artifact is missing?

If the PRD cannot answer these, do not start from the repo. The architecture is not ready.
