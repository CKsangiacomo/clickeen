# PRD 124H - Composition Boundary Review

Status: EXECUTED
Parent: `124__MAMA__Overlay_Aware_Runtime_Materializer_Program.md`
Depends on: 124A GREEN, 124B GREEN, 124C GREEN, 124D GREEN, 124E GREEN, 124F GREEN, 124G GREEN
Owner: Architecture + Product Strategy

## Purpose

Validate that PRD 124 contracts support future composition boundaries without
expanding PRD 124 execution scope.

124H is a contract boundary review. It is not implementation of pages, sites,
emails, reports, feeds, crawler artifacts, answer artifacts, or apps.

## Composition Law

Clickeen is bottom-up:

```text
schema -> tokens -> widgets -> pages -> sites/emails/reports/feeds -> apps
```

Surfaces are downstream expressions. They are not the source of product truth.

PRD 124 must leave future composition possible by making widget artifacts:

- schema-addressed;
- token/overlay aware;
- evidenced;
- host-neutral;
- stored-byte serveable;
- referenceable without copying source truth.

Host-neutral means widget artifacts expose stable product coordinates and
evidence without depending on Bob/Roma editor runtime, account session, or
visitor-time service calls. It does not mean 124H creates a universal embed
runtime or abstraction layer.

## Non-Reinterpretation Tenet

124H must not reinterpret future composition into current product scope.

Forbidden additions in 124H:

- page package generation;
- page public serving;
- site routing;
- email rendering/sending;
- crawler/answer artifact generation;
- app data models;
- app command routes;
- global composition registry;
- composition dependency engine;
- runtime composition on visitor requests;
- copied widget source inside page/site/email/app documents.

## Current Product Boundary

Current account Pages exist as source:

```text
accounts/{accountPublicId}/pages/{pageId}/source.json
```

Current public page serving is disabled until Roma writes real page packages.
Tokyo-worker returns `404` for public page serving today.

124H must not change that.

Current code verification for this boundary:

- Tokyo-worker page publish returns `422 coreui.errors.page.publishUnavailable`
  until Roma page package generation exists.
- Public page serving returns `404` while page package serving is unavailable.
- Current Roma page source stores widget instance placements as
  `{ placementId, instanceId }`; it does not embed widget source and does not
  currently store child artifact references as page source truth.

## No Readiness State

This SubPRD creates no readiness flag, readiness record, runtime gate, status
file, or product precondition. "Boundary review" means documentation and
contract review only.

## Precondition Gate

124H may not make Page boundary claims until current Roma page routes, Tokyo
page source/package routes, and public page serving behavior are inventoried.

If current page behavior differs from the stated disabled-public-serving
boundary, stop and record the mismatch before continuing.

## Authority Gate

| Concern | Active authority for 124H |
| --- | --- |
| Product surface | Future composition contract only |
| Account/session coordinate | None |
| Storage coordinate | No storage mutation |
| Route/API boundary | No runtime route change |
| Runtime/deploy surface | Documentation/contract only |
| Verification surface | Documentation consistency and current code inventory |

### Compliance Rationale

This is compliant because 124H keeps future surfaces strategic/contractual. It
does not implement a new surface or mutate current runtime behavior.

## Slice 1 - Current Composition Inventory

### Goal

Name what exists today and what is not yet implemented.

### Steps

1. Read current Pages docs and code:
   - Roma pages routes;
   - Tokyo page source/package routes;
   - public page serving behavior.
2. Record that account Pages are current source surfaces but page package
   generation/public serving is disabled.
3. Record that widgets are current generated public artifacts.
4. Record that sites, emails, reports, feeds, crawler artifacts, answer
   artifacts, and apps are not current runtime surfaces in PRD 124.
5. Stop if any future surface is being treated as current product truth.

### Output

A current/future composition boundary table.

### Compliance Rationale

This is compliant because it separates current runtime truth from strategic
direction.

## Slice 2 - Widget Artifact Reference Contract

### Goal

Ensure future composers can reference widget artifacts without copying widget
source truth.

### Steps

1. Confirm widget artifact coordinates from 124A/124E can be referenced by:
   - account public id;
   - instance id;
   - locale when applicable;
   - artifact file/entry coordinate;
   - evidence/fingerprint.
2. Confirm a composer does not need to copy `instance.config.json` or
   `instance.content.json` into its own source document to render the widget
   artifact.
3. Confirm a composer can carry placement/layout metadata separately from widget
   source truth.
4. Confirm evidence can name child widget artifact inputs.
5. Referenceable means future parent materializers may consume child artifact
   coordinates/evidence as explicit inputs during parent artifact generation.
6. Referenceable does not mean visitor-time embedding, iframe/live fetch
   composition, or parent public serving that calls child public URLs to
   assemble output unless a future surface PRD explicitly owns that delivery
   model.
7. Future composers must reference product coordinates and evidence, not scrape
   or treat public CDN URLs as source truth.
8. Public URLs are delivery coordinates, not composition source authority.
9. Do not create a composition registry in 124H.

### Output

A reference contract for future page/site/email composition PRDs.

### Compliance Rationale

This is compliant because widget truth remains owned by the widget instance.
Future surfaces compose by reference and evidence, not by duplicated source
documents.

## Slice 3 - Page Composition Boundary

### Goal

Define what a future page package PRD must own.

### Future Page PRD Must Name

- page source schema;
- widget instance reference shape;
- layout/ordering authority;
- locale behavior for page-level and child widget artifacts;
- child artifact evidence fields;
- page package materializer owner;
- Roma page command authority;
- Tokyo page package storage coordinate;
- public page URL and CDN behavior;
- cascade behavior when a child widget changes;
- failure response shape.
- operator-visible handling for missing, stale, or failed child widget
  artifacts.

### Steps

1. Confirm PRD 124 widget artifact evidence can be a child input.
2. Confirm current page source should reference widget instances, not embed
   widget source.
3. Confirm current page source shape remains widget instance references plus
   layout/source metadata. 124H does not shift current page source from instance
   references to artifact references.
4. Any shift from page source instance references to artifact references belongs
   to the future Page Package PRD.
   That future PRD must not inherit an assumption that current page source
   already references generated artifacts.
5. Future page/surface PRDs must define whether parent locale and child widget
   locale must match, how missing child locale artifacts fail, and whether a
   parent can reference base child artifacts from a non-base parent locale.
6. Future page/surface PRDs must make composition-time fail-closed states
   operator-visible in the owning authoring/admin surface; a failure response
   shape alone is not enough product truth for human or agent operation.
7. No fallback locale is implied by 124H.
8. Confirm current page package serving remains disabled until a separate Page
   Package PRD implements the items above.
9. Do not add page materialization to PRD 124.

### Output

Named future Page Package PRD requirements.

### Compliance Rationale

This is compliant because pages are the next composition surface but not part of
the source-instance locale materializer execution scope.

## Slice 4 - Sites, Emails, Reports, Feeds, And Answer Artifacts

### Goal

Define the composition questions future rendered surfaces must answer.

### Future Surface PRDs Must Name

- source authority;
- schema/token identity;
- child artifact reference model;
- overlay/locale behavior;
- materializer owner;
- storage coordinate;
- serving/delivery coordinate;
- evidence fields;
- command authority;
- cascade law;
- failure response shape;
- operator-visible stale/missing-child artifact behavior;
- verification surface.

### Steps

1. Confirm 124 widget artifact contracts are reusable as child rendered
   artifacts.
2. Confirm each future surface needs its own source and command authority.
3. Confirm delivery-specific requirements stay outside 124:
   - site routing/sitemap;
   - email sending/deliverability;
   - report export/access;
   - feed format/crawling;
   - answer-engine citation/update behavior.
4. Confirm future rendered-surface PRDs must make missing, stale, or failed
   child artifacts visible to the owning operator/agent surface instead of
   hiding them inside a stored package failure.
5. Do not implement any future surface in 124H.

### Output

Future surface PRD checklist.

### Compliance Rationale

This is compliant because it preserves the bottom-up architecture while keeping
surface-specific execution in the correct future authority.

## Slice 5 - Apps Boundary

### Goal

Keep the schema-first apps thesis aligned with PRD 124 without collapsing apps
into materialized surfaces.

### Steps

1. Confirm widgets/pages/sites/emails/reports/feeds mostly render truth.
2. Confirm apps operate truth.
3. Confirm the materializer is one substrate capability, not the app substrate.
4. Record that future apps require:
   - schema domain;
   - source authority;
   - command authority;
   - integration boundary;
   - agent home;
   - materialized surfaces.
5. Do not add app routes, app schemas, app databases, or app agents in 124H.

### Output

Apps boundary note for strategy/docs.

### Compliance Rationale

This is compliant because it respects the matrioska law without turning PRD 124
into an all-apps platform build.

## Slice 6 - Evidence Propagation Rule

### Goal

Define how future compositions reference child artifact evidence.

### Steps

1. Child artifacts carry their own evidence.
2. Parent artifacts must record references to child artifact coordinates and
   fingerprints/evidence required by the parent source contract.
3. Parent artifacts must not copy child source bodies as their own source truth.
4. Public serving of a parent artifact must not recompute child evidence on
   visitor requests unless that exact evidence is already part of the parent
   stored package contract.
5. Future parent serving must not fetch child artifacts or child source on
   visitor requests to decide freshness unless that future surface PRD
   explicitly defines stored parent evidence semantics.
6. Parent/child evidence mismatch handling belongs to the future surface PRD.

### Output

A parent/child evidence rule for future composition work.

### Compliance Rationale

This is compliant because composition remains reference/evidence based. It
prevents copied documents and visitor-time composition.

## Slice 7 - Future PRD Map

### Goal

Name future work without expanding 124.

### Future PRDs

- Page Package Materializer PRD;
- Page Locale Artifact PRD;
- Page Public Serving/CDN PRD;
- Page Child-Widget Cascade PRD;
- Site Composition PRD;
- Email Artifact Materializer PRD;
- Report/Feed/Answer Artifact PRDs;
- Schema-First App Substrate PRDs by domain.

This map is not an approved roadmap, execution authorization, or dependency
registry. Each future PRD must be separately approved with its own authority
gate.

### Steps

1. Record each future PRD as future, not current.
2. Do not add implementation steps for those PRDs in 124H.
3. Link future PRDs back to the 124 contracts they can reuse:
   - schema-token identity;
   - overlay law;
   - materializer purity;
   - stored-byte serving;
   - evidence;
   - command-owned cascade.
4. Future child-widget cascade PRDs must name maximum child count, maximum
   regenerated parent coordinates per command, cost ceiling, failure response
   shape, and whether cascade stops on first failure or attempts all named
   coordinates.
5. Future surface PRDs must name the operator-visible UX or agent-facing command
   response for stale, missing, or failed child artifacts. 124H does not define
   that UX, but it requires future surfaces to own it.

### Output

Future PRD dependency map.

### Compliance Rationale

This is compliant because future work is named without being smuggled into the
current source-instance locale materializer program.

## Slice 8 - Documentation Updates

### Goal

Capture composition boundaries in the right docs.

### Steps

1. Update current-system docs only if a current-system statement changes.
2. Update strategy docs only for strategy framing.
3. Do not put future PRD content into widget operator docs.
4. Do not claim page package serving is current.

### Required Docs

- 124 implementation note: current/future composition boundary table.
- `documentation/strategy/SchemaFirstApps.md`: update only if apps boundary
  wording needs clarification.
- `documentation/strategy/WhyClickeen.md`: update only if the bottom-up
  composition thesis changes.
- `documentation/architecture/CONTEXT.md`: update only if current-system
  composition truth changes. Expected outcome: no CONTEXT change.
- `documentation/widgets/README.md`: update only if current widget composition
  claims change.
- `documentation/services/roma.md` and `documentation/services/tokyo-worker.md`:
  update only if current Pages statements need clarification.
- `documentation/architecture/RuntimeProfiles.md`: update only if current/future
  page package layout claims need clarification.

### Output

Docs stay separated between current operator truth and strategy.

### Compliance Rationale

This is compliant because docs do not promote future surfaces into current
runtime truth.

## Slice 9 - 124H Closeout Gate

### Steps

1. Confirm future composition risks are documented.
2. Confirm future PRDs are named.
3. Confirm PRD 124 scope remains source instance plus locale artifact.
4. Confirm no future surface is treated as current product truth.
5. Confirm no page/site/email/app implementation step was added.
6. Confirm no copied widget source truth is required for composition.
7. Confirm current page source remains instance-reference based, and that any
   artifact-reference shift is assigned to a future Page Package PRD.
8. Confirm future surface PRDs must own operator-visible handling for
   stale/missing child artifacts.
9. Record commit/push/deploy state.
10. Reconcile whether verification stopped at documentation/code inventory.
11. Record V1-V8 audit.

### Acceptance

- Future composition risks are documented.
- Required future PRDs are named.
- PRD 124 implementation scope remains `source instance + locale artifact`.
- No future surface is treated as current product truth.
- Schema-first app boundary is preserved: apps operate truth; the materializer
  resolves artifacts.
- Current page source remains widget-instance-reference based until a future
  Page Package PRD explicitly changes it.
- Future composition failure/staleness visibility is owned by future surface
  PRDs, not hidden in PRD 124.
