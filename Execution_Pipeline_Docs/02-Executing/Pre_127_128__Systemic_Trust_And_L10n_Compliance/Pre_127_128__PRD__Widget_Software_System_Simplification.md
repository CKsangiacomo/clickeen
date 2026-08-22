# Pre-127/128 — Widget Software System Simplification

Status: **WSSS-v2 LOCAL IMPLEMENTATION COMPLETE — M01–M09 CLOSED; R1 COMPLETE;
R2 OWNER-AUTHORIZED; R3 READ-ONLY RECONCILIATION REQUIRED; R4–R6 NOT
AUTHORIZED**

Owner: Clickeen product owner/architect

Date: 2026-08-21

Placement: the product owner explicitly requires this PRD to live beside the
other Pre-127/128 work in this directory. Placement does not authorize work.
Only the exact current manifest approval in Section 13.5 authorizes its bounded
local implementation. Section 13.5 records the later release stages actually
authorized; managed configuration, legacy R2 deletion, and product-data actions
remain separate gates.

## Non-Negotiable Plug-And-Play Law

Clickeen and its Widgets are one closed, first-party product system. A Widget
is native Clickeen software, not a foreign object that Bob, Roma, Tokyo-worker,
or another downstream service must distrust, reinterpret, or defend against.

For the user, the system is plug-and-play: the user chooses any correctly
declared Clickeen Widget and the same generic lifecycle opens, edits, saves,
publishes, stores, and serves it smoothly. Adding another Widget must require
its Widget-owned software and structured declarations, not Widget-specific
changes throughout shared services.

The owning authoring/producer boundary accepts the Widget source and produces
the trusted Clickeen artifact once. Downstream named authorities consume that
exact artifact. They do not add another Widget registry, allowlist, codebook,
guard, filter, validator, normalization, repair pass, or compatibility path to
re-prove it. Authentication, authorization, external input acceptance, and
producer completeness remain at their legitimate ingress or producing
boundaries; they are not repeated as downstream semantic distrust.

The governing test for every audit finding and execution plan is:

> Can another correctly declared Clickeen Widget be added and immediately use
> the existing open, edit, Save, Publish, storage, and serving lifecycle without
> changing shared-service source code?

If not, the shared system is not yet truly plug-and-play.

## 1. Goal

Make Clickeen's shared Widget system simple, Widget-agnostic, performant, and
operable by AI agents for hundreds of completely different Widgets.

A Widget remains independent software. Clickeen provides one generic system
through which a user can open, edit, Save, Publish, store, and serve any Widget.

The program removes only architecture that a complete audit proves is
duplicated, fixed to the current Widget set, Widget-specific inside a shared
service, unnecessarily repeated, obsolete, or on the normal path without a
current product purpose.

## 2. Fixed Mental Model

The mental model is not an audit conclusion. It is the product law against
which the audit runs.

```text
independent Widget software
  structured contract
  mandatory unique Core HTML/CSS/JavaScript
  exact Widget-owned labels and declarations
          |
          v
one generic Clickeen lifecycle
  discover -> open -> edit in Bob -> Save through Roma
  -> Publish through Roma's generic materializer
  -> store and serve through Tokyo-worker
```

The Widget owns what it is and does. Shared Clickeen services own only the
generic capabilities used by every applicable Widget.

The architecture must make these statements true:

1. A new Widget is added as Widget software, not as branches throughout the
   system.
2. Adding a Widget requires no hand-authored Widget-name, Widget-code, Core-path,
   or Widget-role change in Bob, Roma, Tokyo-worker, Dieter, or another shared
   service.
3. Generated outputs may change because the existing source producer discovers
   the new Widget. Shared source code must not require a manual accommodation.
4. Opening, editing, saving, or publishing one Widget operates that Widget and
   the shared system it uses. It does not load, compile, validate, or retain all
   other Widgets merely because they exist.
5. Catalog-wide work is allowed only where the actual product operation is the
   catalog. That work uses the smallest exact catalog truth needed for that
   operation.
6. An all-Widget build may necessarily process every Widget once. It must not
   repeat that same production work through several wrappers, lifecycle hooks,
   validation commands, or CI steps.
7. Shared services consume the exact artifact produced by the owning Clickeen
   authority. They do not reconstruct Widget truth through another registry,
   codebook, allowlist, validator, or repair layer.
8. The final architecture is easier for a new agent to trace than the current
   architecture. Removing machinery must not be replaced by renamed machinery.

## 3. Widget Folder Boundary

The current Widget source topology is presumed correct and remains stable:

```text
tokyo/product/widgets/{widgetType}/
  widget.html
  spec.json
  editable-fields.json
  limits.json
  discovery.json
  labels/en.json
  upsell/en.json
  core/core.html
  core/core.css
  core/core.js
```

This program does not begin by redesigning those files, moving Widget meaning
into a shared service, centralizing Widget l10n, or making the five existing
Widgets more alike.

A Widget declaration may be considered for an execution plan only if its slice
audit proves one of the following through a current or concretely reachable
flow:

- the declaration is duplicated by another current authority;
- the declaration is obsolete and has no producer, generated-artifact,
  runtime, deploy, or product consumer;
- the declaration contradicts the current Widget's real product behavior; or
- a current shared capability cannot express required behavior through the
  existing contract.

Audit proof never authorizes a declaration change by itself. Every addition,
deletion, or reinterpretation of a Widget declaration requires an explicit
product-owner decision before it may enter a frozen execution plan. An agent
may not invent a new Widget-folder shape or shared capability during the audit.

## 4. Why This PRD Is Built In Passes

The implementation cannot be planned honestly in one writing pass.

The present architecture contains layers created at different times. A file may
look redundant while still owning a build, deploy, generated-artifact, storage,
or runtime boundary. Conversely, a familiar file may remain only because later
systems were built around it.

Therefore this PRD is progressively completed:

```text
Draft 1
  fixed mental model + audit slices + repeatable audit steps

For each slice
  read-only audit
  -> evidence and classification
  -> owner decisions when required
  -> exact execution plan for that slice
  -> independent plan audit
  -> frozen slice

After every slice is frozen
  owner approves the complete implementation manifest
  -> primary agent executes one slice at a time
```

Draft 1 is executable only as an audit procedure. It is not authority to change
product code, product data, generated artifacts, CI, deployments, or managed
services.

## 5. Program Outcomes

When the eventual implementation is complete:

- every current Widget retains its unique software, meaning, editing contract,
  preview behavior, saved-source behavior, and published behavior;
- shared services carry generic Widget identity coordinates where the lifecycle
  requires them, but contain no manually maintained Widget list or
  Widget-specific semantic branch;
- one selected-Widget product operation does no accidental all-Widget work;
- catalog operations use compact catalog truth rather than complete editing or
  materialization artifacts unless the audit proves those artifacts are truly
  required;
- Widget source is resolved into its required artifacts by one understandable
  producer path;
- generation and validation have distinct, truthful jobs;
- build, test, CI, and deploy paths do not repeat the same work or advertise a
  check that runs nothing;
- obsolete code, files, arguments, generated indexes, checks, and documentation
  are deleted rather than retained as compatibility layers;
- the real lifecycle is documented once through its named authorities; and
- an agent can add or operate another Widget without rediscovering historical
  exceptions.

## 6. Scope

### 6.1 Included for audit

- the existing Widget source-to-artifact path;
- Widget discovery, identity, and catalog summaries;
- Bob's generic editor artifact, open, edit, and preview consumption;
- Roma's catalog, New, Widget Defaults, Builder, Save, and Publish consumption;
- Roma's generic materializer artifact selection;
- Tokyo-worker's Widget definition, instance-coordinate, storage, and serving
  handoffs used by those flows;
- `@clickeen/widget-foundation`, `@clickeen/ck-contracts`, and other shared
  packages reached by the exact lifecycle;
- generated Widget source indexes and generated editor/materializer artifacts;
- root, Bob, Roma, Tokyo-worker, Widget, CI, and deploy commands reached by
  those flows;
- current manuals that describe those authorities; and
- performance and scaling costs of the real five-Widget implementation and its
  direct growth with Widget count.

### 6.2 Included only as verification inputs

- the five current Widget folders;
- their exact generated editor and materializer outputs;
- public package generation and serving behavior; and
- cloud-dev deployment/runtime evidence after an implementation is separately
  authorized.

Being a verification input does not make a Widget's unique declarations an
optimization target.

### 6.3 Excluded

- changing what an existing Widget means or does;
- changing the required Widget-folder structure without an explicit later
  owner decision based on audit evidence;
- creating a new Widget;
- PRD 127 localization implementation;
- PRD 128 agent-runtime or release implementation;
- Prague;
- DevStudio;
- redesigning public Widget visitor UI or copy;
- changing customer-authored content or translation overlays;
- new registries, loaders, caches, compatibility readers, adapters,
  meta-frameworks, schema versions, or migration systems invented as part of
  the simplification;
- product-data mutation during audit or planning; and
- code changes, commit, push, deployment, or live mutation before the complete
  manifest is frozen and separately authorized.

## 7. Governing Laws

Every slice must preserve:

1. **Widget software ownership.** Unique meaning and behavior stay in the
   Widget's structured contract and Core.
2. **Generic shared services.** Shared services may carry the generic Widget
   identity coordinate required by the lifecycle, but never Widget-specific
   meaning, a private Core rule, or a manually maintained Widget list.
3. **Named authority trust.** A downstream service consumes the exact successful
   artifact produced by its named Clickeen authority.
4. **Browser-memory editing.** Bob owns the unsaved draft; Roma owns Save and
   Publish; Tokyo-worker owns storage and serving.
5. **Publish-only materialization.** New writes nothing, Save writes editable
   source, and explicit allowed Publish alone generates the public package.
6. **No fallback or healing.** Simplification may not hide missing truth or
   repair persisted truth.
7. **Producer validation remains at the producer.** Removing duplicated checks
   must not remove external ingress, authentication, authorization, compiler
   source acceptance, storage transport, or other real boundary protection.
8. **Deletion before invention.** Prefer removing proven obsolete machinery and
   connecting existing authorities directly. A new abstraction requires owner
   approval and a proved current need.
9. **No runtime test dependency.** Tests and audits prove the product; the
   product never depends on them.
10. **Documentation is operator truth.** The owning manuals change with the
    behavior that ships.

## 8. Roles During This Program

### Product owner/architect

- owns the fixed mental model;
- decides any change to product behavior, Widget declarations, named
  authorities, shared-capability contracts, storage shape, or user workflow;
- approves each slice's frozen execution plan; and
- approves the final implementation manifest and any product-data operation.

### Primary agent

- reads the complete governing and routed documentation itself;
- owns the integrated audit record and PRD edits;
- traces and classifies evidence;
- writes each slice's proposed execution plan;
- implements approved changes after the final manifest is authorized;
- runs verification and reconciliation; and
- never delegates coding or final architectural judgment.

### Subagents

- perform bounded read-only product, code, performance, history, or independent
  audit work;
- report evidence to the primary agent;
- do not edit source, generated files, tests, CI, docs, product data, or remote
  services; and
- do not turn an audit lead into an implementation requirement.

### Independent audit agent

- reads the settled slice plan or implementation diff fresh;
- checks scope, product law, retained boundaries, and V1–V8;
- reports concrete blockers only; and
- makes no edits.

## 9. Status Model

Each slice has exactly one status:

| Status | Meaning |
| --- | --- |
| `NOT STARTED` | Only Draft-1 audit questions exist. |
| `AUDITING` | Read-only evidence collection is active. |
| `DECISION REQUIRED` | Evidence requires product-owner judgment before planning. |
| `PLANNING` | Evidence is sufficient and the primary is writing the exact execution plan. |
| `PLAN AUDIT` | A read-only independent agent is reviewing the proposed slice plan. |
| `FROZEN` | Evidence, decisions, allowed changes, and verification are approved. |
| `FROZEN — NO ACTION` | The completed audit proves that the slice requires no implementation; the evidence and independent audit are approved. |
| `IMPLEMENTING` | The primary is executing only the frozen plan. |
| `VERIFYING` | Implementation is settled and owner-specific checks are running. |
| `CLOSED` | Implementation, docs, V1–V8, and required runtime reconciliation pass. |

No slice may skip from `NOT STARTED` to `IMPLEMENTING`.

## 10. Repeatable Per-Slice Audit Process

The following process is executed in full for every slice. It is the same
whether the slice ultimately contains twenty changes or no changes.

### Step 1 — Reset context

The primary agent reads completely:

- `AGENTS.md`;
- `documentation/README.md`;
- `documentation/architecture/CONTEXT.md`;
- `documentation/architecture/Tenets.md`;
- `documentation/strategy/WhyClickeen.md`;
- this complete PRD;
- every current manual routed to the slice; and
- any exact Widget operator manual used as verification evidence.

The PRD records the read set. A subagent summary never replaces the primary
agent's reading.

### Step 2 — Freeze the audit baseline

Record:

- local branch;
- local HEAD SHA;
- tracking branch and remote SHA;
- worktree state;
- current generated-artifact state;
- current deployed SHA for any runtime surface used as evidence; and
- commands used to establish that state.

A moving or unexplained dirty baseline stops the audit. Existing user changes
are preserved and explicitly separated.

Audit commands must be proven check-only commands. If a generator, compiler,
build, test, or measurement can rewrite source, generated artifacts, caches, or
another tracked state, run it only through an existing check-only mode or in an
isolated disposable worktree/directory whose outputs cannot enter the audit
baseline. If neither route is proven safe, stop and request authorization; do
not call the mutating command read-only.

### Step 3 — Recreate the actual product flow

Start from what the user does, not from a search result.

For every flow inspected, record:

- product surface;
- account/session coordinate;
- selected Widget or catalog coordinate;
- route/API boundary;
- source artifact;
- generated artifact;
- storage coordinate;
- runtime/deploy surface; and
- verification surface.

The audit must distinguish:

- a catalog operation that legitimately observes many Widgets;
- a selected-Widget operation that should observe only one Widget; and
- an all-Widget producer/build operation that legitimately processes the whole
  source set once.

### Step 4 — Trace producer to final consumer

For each artifact, argument, registry, index, check, or generated file, trace:

```text
authoring source
-> producer
-> generated output
-> deploy packaging
-> runtime consumer
-> user-visible or product result
```

Do not call code dead because repository search finds no direct import. Prove
that generated output, build tools, package exports, deploy scripts, Workers,
Pages bundles, R2 sync, and runtime consumers do not use it.

### Step 5 — Measure real cost

Where the slice has a scale or performance claim, record current evidence:

- source and generated bytes;
- compressed transfer bytes where applicable;
- browser requests and decoded payload retained for the operation;
- server/Worker bundle contribution;
- generator/compiler executions and duration;
- build/test/CI invocations;
- network or storage reads made by the real flow; and
- whether cost is constant, selected-Widget-sized, catalog-sized, or repeated
  all-Widget work.

Measure the current five-Widget system first. A direct 100-Widget projection
must show its formula and assumptions. It is evidence, not a fabricated load
test or arbitrary performance budget.

### Step 6 — Establish why the current design exists

Use current docs, code, blame, and relevant execution history to explain why
the machinery was introduced and which later authority may have replaced its
purpose.

History explains risk; it does not preserve obsolete code automatically.

### Step 7 — Classify every candidate

Each candidate receives one classification:

| Classification | Meaning |
| --- | --- |
| `KEEP — OWNER` | Current named authority or necessary product behavior. |
| `KEEP — BOUNDARY` | Authentication, authorization, external ingress, transport, producer completeness, or storage safety. |
| `KEEP — CATALOG` | Necessary work for an actual catalog-wide operation. |
| `SIMPLIFY` | Same required product behavior can use fewer existing paths or artifacts. |
| `DELETE — PROVEN DEAD` | No source, generated, deploy, runtime, product, or operator consumer remains. |
| `DELETE — SUPERSEDED` | A current named authority now owns the work and the old path only duplicates it. |
| `OWNER DECISION` | Product behavior, authority, contract, storage, or Widget declaration would change. |
| `DEFER — SEPARATE PRODUCT` | Real issue outside this PRD's scope. |
| `THEORETICAL — NO WORK` | No current or concretely reachable flow proves a problem. |

### Step 8 — Write the finding ledger

Every actionable finding must include:

```text
Finding ID
Slice and audit step
Current user/product flow
Exact trigger conditions
Reachability: happening now | concretely reachable | proven dead | latent | theoretical
Source/line evidence
Generated/build/deploy/runtime evidence
Current owner and consumer
Why the design exists
Observed complexity or cost
Product behavior that must remain exact
Smallest deletion or simplification through existing authorities
Potential authority/product/data effect
Classification
```

Search results without this evidence do not enter a plan.

### Step 9 — Stop for owner decisions

The slice becomes `DECISION REQUIRED` if a proposed disposition would:

- change user-visible behavior;
- add, remove, or reinterpret a Widget declaration;
- change a named authority;
- create or expand a shared capability;
- alter New, Save, Publish, localization, storage, or public-package law;
- introduce a file shape, schema, registry, adapter, compatibility path, or
  migration;
- mutate product data; or
- change a product workflow rather than simplify its implementation.

The primary presents the exact evidence and alternatives. It does not infer the
owner's answer.

### Step 10 — Write that slice's execution plan

Only after findings and owner decisions are complete does the primary fill the
slice's execution-plan section.

The plan must specify:

```text
Approved finding IDs
Exact outcome
Preserved product behavior
Named authorities
Exact files allowed to change
Exact files/surfaces prohibited from changing
Deletions
Smallest code rewiring
Generated-artifact consequences
Test changes or deletions
CI/build/deploy consequences
Documentation changes
Product-data effect
Implementation order
Focused verification per step
Final slice verification
Independent V1–V8 questions
Deployment/runtime evidence when later authorized
Stop conditions
```

The plan must contain no placeholder decision and no speculative machinery.

### Step 11 — Independently audit and freeze the plan

A fresh read-only agent verifies:

- every planned change resolves a proved finding;
- no planned file or behavior exceeds the slice scope;
- no Widget-specific shared-service meaning is introduced;
- required ingress/security/producer boundaries remain;
- the plan reduces machinery rather than renaming it;
- verification proves preserved product behavior; and
- V1–V8 have explicit coverage.

The primary corrects real blockers. The owner approves any changed decision.
Only then is the slice marked `FROZEN`.

## 11. Repeatable Execution Process After All Slices Are Frozen

No product-code execution starts until every slice is either `FROZEN` or
explicitly `FROZEN — NO ACTION` and the owner approves the complete manifest.

For each active implementation slice:

1. reset context and baseline again;
2. copy only that slice's frozen finding IDs into the active work checklist;
3. implement the smallest ordered change through existing authorities;
4. generate derived files only through their owning producer;
5. run the focused check after each material step;
6. stop on any unexpected file, generated diff, behavior, authority, or data
   requirement;
7. reconcile the owning current manuals;
8. run the slice's full checks;
9. run an independent V1–V8 audit on the settled diff;
10. correct and re-audit any blocker; and
11. mark the slice closed only when code, generated artifacts, tests, docs, and
    evidence agree.

Before implementing each later slice, compare its frozen baseline, evidence,
allowed file set, checks, and assumptions with the repository produced by all
earlier implementation slices. If an earlier change invalidated any part of
that plan, the later slice returns to `AUDITING`. The primary repeats the
affected read-only evidence steps, obtains any required owner decision, rewrites
the plan, runs a fresh independent plan audit, and refreezes it. The final
manifest receives a new version and requires fresh product-owner approval
before implementation resumes. A stale frozen plan or unapproved manifest
version is never executed merely because an earlier version was approved.

The primary agent edits and integrates. Subagents remain read-only.

## 12. Audit And Planning Slices

The slices follow the product lifecycle. They are not teams or permission to
make changes in the named files.

### Slice 0 — Baseline And Complete Widget Lifecycle

Status: **FROZEN — NO ACTION**

Purpose: establish one evidence-backed map of the current system before
optimizing any part of it.

Audit:

1. Record source, generated, build, deploy, and runtime topology for all five
   current Widgets.
2. Trace Catalog -> New -> Bob open -> edit -> First Save -> later Save ->
   Publish/Republish -> Tokyo storage -> public serve.
3. Trace Settings -> Widget Defaults separately because it is a different
   account editing host.
4. Name every authority, artifact, route, package, and storage coordinate.
5. Record baseline artifact sizes, generator invocations, bundle sizes, and
   existing runtime evidence.
6. Establish which operations are selected-Widget, catalog-wide, or
   build-wide.

Required output:

- baseline ledger;
- lifecycle map;
- authority and artifact map;
- current performance table;
- audit read set; and
- routed audit questions for Slices 1–8.

#### Slice 0 audit record

Baseline:

- branch: `main`;
- local and `github/main` SHA:
  `dd8fe00eb77598d821d128b334d79463cfc6c83f`;
- worktree at audit start: clean except this untracked PRD;
- check-only source generation: one definition index containing five Widget
  entries and five editor/materializer artifact pairs verified with no
  worktree change; and
- signed-in browser evidence was unavailable in this session. Runtime behavior
  below is therefore source-, build-, storage-, and manual-proven; it is not
  presented as live signed-in UI proof.

Audit read set: `AGENTS.md`; `documentation/README.md`;
`documentation/architecture/CONTEXT.md`;
`documentation/architecture/Tenets.md`;
`documentation/architecture/RuntimeProfiles.md`;
`documentation/strategy/WhyClickeen.md`; this complete PRD;
`documentation/widgets/README.md`;
`documentation/widgets/authoring/README.md`;
`documentation/widgets/authoring/ToolDrawerControls.md`;
`documentation/widgets/authoring/WidgetAuthoringChecklist.md`;
`documentation/widgets/authoring/WidgetFiles.md`;
`documentation/widgets/shared/README.md`;
`documentation/widgets/shared/ShellCore.md`;
`documentation/widgets/shared/ShellUtilities.md`;
`documentation/widgets/widgets/README.md`;
`documentation/widgets/widgets/{big-bang,cards,countdown,faq,logoshowcase}.md`;
`documentation/services/{bob,roma,tokyo-worker,tokyo}.md`;
`packages/ck-runtime-materializer/README.md`;
`documentation/engineering/CloudflareOperations.md`;
`documentation/engineering/CloudflarePagesCloudDevChecklist.md`; and
`documentation/engineering/PlaywrightE2E.md`.

Current lifecycle:

| Operation | Current scope | Exact current work |
| --- | --- | --- |
| Catalog | Catalog-wide plus current-account inventory | Roma loads all Tokyo Widget definitions and current-account instance facts, then projects compact cards. |
| New | Selected user intent implemented with catalog-wide/defaults-wide reads | Roma lists all definitions, selects one type, reads the complete account Widget Defaults document, composes one non-persisted draft, then fetches one editor artifact. New writes nothing. |
| Saved Builder open | Selected instance plus account-wide defaults read | Roma reads one exact saved source and the complete defaults document for the font library, then fetches one editor artifact. |
| Bob open/edit/preview | Selected-Widget | Bob keeps one compiled contract and one browser-memory draft. Preview uses the selected deploy-built Widget software plus that draft. |
| First Save | Selected-Widget | Bob sends the draft and type; Roma uses the selected materializer contract to split editable source; Tokyo writes unpublished serve state and exact source. No public package is generated. |
| Later Save | Selected-Widget | Roma replaces exact editable source for the existing instance. No public package is generated. |
| Publish/Republish | Selected instance, with account policy/default observations | Roma reads exact saved source, selects one materializer artifact, reads account font defaults, materializes one complete package, and sends it to Tokyo. Tokyo atomically replaces published serve state. |
| Public serve | Selected stored instance/package | Tokyo reads the selected stored package and exact overlay when requested. It does not read the Widget catalog or compile Widget source. |
| Widget Defaults | Current all-Widget UI; product judgment deferred to Slice 5 | Roma reads the complete defaults document, fetches every referenced editor artifact, renders shared controls plus every Widget Core section, and writes the complete defaults document. |

Exact route/package map:

| Step | Route/API | Owning package/service |
| --- | --- | --- |
| Catalog | Roma `/widgets/catalog` -> `GET /api/account/widgets` -> Tokyo `GET /__internal/widgets/definitions`, `GET /__internal/accounts/{accountPublicId}/instances`, and current `GET /__internal/instances/{instanceId}/list-facts` fan-out | Roma + Tokyo-worker definition/source authorities |
| New | Roma `/builder/new/{widgetType}` -> `GET /api/builder/new/{widgetType}/open` -> Tokyo `GET /__internal/widgets/definitions` and `GET /__internal/accounts/{accountPublicId}/widget-defaults` -> one `GET /widget-editors/{widgetType}.json` | Roma Builder open + Tokyo definitions/defaults + generated Bob editor artifact |
| Saved open | Roma `/builder/{instanceId}` -> `GET /api/builder/{instanceId}/open` -> Tokyo `GET /__internal/instances/{instanceId}` and `GET /__internal/accounts/{accountPublicId}/widget-defaults` -> one `GET /widget-editors/{widgetType}.json` | Roma + Tokyo-worker + Bob |
| First Save | Bob `save-instance` -> Roma `POST /api/account/instances` -> Tokyo `POST /__internal/instances` | Bob browser-memory document + Roma source preparation + Tokyo storage |
| Later Save | Bob `save-instance` -> Roma `PUT /api/account/instances/{instanceId}` -> Tokyo `GET /__internal/instances/{instanceId}/list-facts` then `PUT /__internal/instances/{instanceId}` | Same named authorities; exact saved coordinate |
| Publish/Republish | Roma `POST /api/account/instances/{instanceId}/publish` -> Tokyo account-instance/list-fact reads, `GET /__internal/instances/{instanceId}`, and `GET /__internal/accounts/{accountPublicId}/widget-defaults` -> `@clickeen/ck-runtime-materializer` -> Tokyo `POST /__internal/instances/{instanceId}/publish` | Roma policy/materialization + Tokyo atomic serve state |
| Public serve | Tokyo `/{accountPublicId}/{instanceId}` and logical package-member paths | Tokyo-worker exact stored package/overlay serving |
| Widget Defaults | Roma `/settings/widget-defaults` -> `GET/PUT /api/account/widget-defaults` -> Tokyo `GET/PUT /__internal/accounts/{accountPublicId}/widget-defaults` | Roma editing host + Bob control-host + Tokyo storage |

Authority and artifact map:

```text
git-authored Widget software
  tokyo/product/widgets/{widgetType}/...
        |
        | generate-artifacts producer
        +-> roma/public/widget-editors/{widgetType}.json
        |     selected Builder/Bob; all artifacts on Widget Defaults
        +-> roma/generated/widgets/{widgetType}.json
        |     selected logical Save/Publish/translation/default operation
        +-> roma/generated/widget-materializer-artifacts.ts
              static all-Widget import index

Widget folders
        |
        | definition-source producer
        +-> tokyo-worker/src/generated/widget-definition-sources.ts
              Tokyo definition list -> Roma Catalog/New/account setup

Bob exact browser-memory draft
        -> Roma Save -> Tokyo instance.source.json
Roma explicit Publish + selected materializer
        -> Tokyo serve-state.json containing complete public package
Tokyo public request
        -> selected serve-state package (+ exact selected overlay)
```

Current account storage coordinates:

- `accounts/{account}/instances/{instance}/instance.source.json`;
- `accounts/{account}/instances/{instance}/serve-state.json`;
- `accounts/{account}/instances/{instance}/overlays/locales/{locale}.json`; and
- `accounts/{account}/widget-defaults.json`.

Current source and artifact baseline:

| Artifact set | Files | Raw bytes | Summed gzip bytes | Classification |
| --- | ---: | ---: | ---: | --- |
| Five Widget-owned source folders | 50 | 467,041 | — | Authoritative Widget software |
| Shared Widget source | 18 | 106,301 | — | Shared git-authored capability source |
| Editor artifacts | 5 | 5,881,978 | 392,307 | One selected in Builder; all five in current Widget Defaults |
| Materializer artifacts | 5 | 623,329 | 101,840 | Logically selected, statically imported as one all-Widget set |
| Tokyo definition index | 1 | 1,775 | — | Tracked all-Widget generated source index |

One selected editor artifact currently transfers approximately 0.96–1.41 MB
decoded JSON, or 64–89 KB gzip. Expanded panel HTML dominates it. The five
materializer sources contribute a measured 645,469-byte minified chunk in the
current exact-SHA local Roma Pages output. An in-memory Tokyo-worker bundle
measured 424,256 bytes, of which 197,234 bytes came from the five imported
`spec.json` and `editable-fields.json` sources. These are baseline measurements,
not deletion conclusions.

Build-wide facts established for later slices:

- the artifact producer discovers and produces all Widgets by default and has
  a focused `--widget` mode;
- `validate:widgets` performs a definition check, an artifact write, then an
  artifact check;
- root lint, typecheck, build, Roma lifecycle hooks, and Roma Pages build call
  the same producer through overlapping paths;
- a Widget-source push reaches Worker deploy, Roma verification, and the
  git-authored product-root sync; and
- the R2 sync currently walks all four roots and PUTs every file, rather than
  comparing the changed Widget root.

Current source-explicit producer invocation counts for `W` Widgets:

| Operation | Widget-pair compilations |
| --- | ---: |
| `validate:widgets` / root lint | `2W` |
| root typecheck | `3W` including Roma `pretypecheck` |
| Roma Pages verification workflow | `7W` |
| Worker/R2 workflow pre-deploy | `5W` |
| direct Roma Git-connected Pages build | `2W` |
| direct Bob Pages build | `0W` |

At the current `W=5`, the Roma verification path therefore performs 35
Widget-pair compilations and the Worker/R2 path performs 25.

Known deployed evidence: Bob and Roma Git-connected Pages production
deployments and the exact-SHA Roma verification/reachability runs passed at
`dd8fe00e`; live Bob `/bob` returned 200, Roma `/home` returned the expected
307 authentication redirect, and their commit-specific endpoints matched.
Tokyo-worker and the product-root sync last changed successfully at
`4f069315`; no Tokyo/Worker/R2 input changed between that SHA and `dd8fe00e`,
and Tokyo `/healthz` returned `{"up":true}`. Signed-in Builder UI inspection
was unavailable and is not claimed.

Concrete evidence routed to later slices, without disposition here:

1. New performs an all-definition lookup and complete-defaults read before
   selecting one Widget.
2. Tokyo's compact definition consumers do not currently use the large
   `editableFields` payload returned with every definition.
3. Generated materializer selection is logically per Widget but the index
   statically imports all materializer payloads.
4. Widget Defaults currently requires all five expanded editor contracts; its
   scalable product interaction belongs to Slice 5 and cannot be invented by
   the audit.
5. Widget software bytes are duplicated inside and across generated artifacts,
   including presently unconsumed `coreCss`/`coreJs` copies; shared source is
   embedded once per Widget; whether and how either duplication can be removed
   belongs to Slice 3.
6. Eight shared browser modules are described by the owning manual as
   historical and are not referenced by any built Widget, but remain in the R2
   product root. Their complete consumer/deploy proof belongs to Slices 1 and
   7.
7. A fixed five-Widget overlay codebook, a few fixed Core-role identities, and
   fixed Widget choices in preflight/test code require exact reachability and
   authority classification in Slices 2, 4, and 7.
8. `widgetCode` remains threaded through stored/runtime contracts even though
   the account-first key helper does not use it. Any removal has a Tokyo/data
   consequence and belongs to Slice 6 plus an owner decision if required.
9. Slice 8 must identify the exact owner manuals, operator commands, and
   historical architecture claims affected by the frozen Slices 1–7, then
   produce one current Widget lifecycle and one AI-operable build/deploy map
   without adding a permanent audit or validation system.

Slice 0 establishes evidence only. It does not authorize a baseline tool,
product change, declaration change, generated-file change, or permanent audit
report.

Execution plan: **NO ACTION.** Slice 0's required output is the evidence above.
No product implementation exists for this slice. Freeze requires an independent
review that the baseline is complete and makes no premature disposition.

### Slice 1 — Widget Software Authority And Declaration Boundary

Status: **CLOSED**

Purpose: prove that the Widget folder remains the independent software
authority and identify only concrete declaration-level exceptions.

Audit:

1. Verify the current source topology and exact responsibility of each file.
2. Verify that the five Widgets declare their unique meaning without relying
   on Widget-specific shared-service branches.
3. Trace each declared file into generated and runtime consumers.
4. Distinguish intentional Widget differences from duplicated system
   machinery.
5. Prove whether any declaration is obsolete before proposing deletion.
6. Record any genuinely missing shared capability as `OWNER DECISION`; do not
   design it in this slice.

Required output:

- declaration/consumer matrix;
- explicit statement of which Widget files remain unchanged;
- any proved dead or contradicted declaration findings; and
- owner decisions, if any.

#### Slice 1 audit record

The default result is proved: the current Widget folder shape is the readable
software authority and does not need redesign. Every one of the 50
Widget-owned files across Big Bang, Cards, Countdown, FAQ, and Logo Showcase
has a current source, build, editor, materializer, or runtime consumer.

Declaration/consumer matrix:

| Widget member | Exact authority and current consumer | Disposition |
| --- | --- | --- |
| `widget.html` | Complete readable composition; the producer resolves its exact shared and Core source references into editor and materializer software. | `KEEP — OWNER` |
| `core/core.html` | Unique mandatory semantic Widget markup used by Bob preview and Publish materialization. | `KEEP — OWNER` |
| `core/core.css` | Unique Widget presentation included in preview and complete public `styles.css`. | `KEEP — OWNER` |
| `core/core.js` | Mandatory unique Widget initializer/behavior included in complete public `runtime.js`. | `KEEP — OWNER` |
| `spec.json` | Widget identity, description, Core defaults, and structured editor declaration. | `KEEP — OWNER`, except `S1-D1` |
| `editable-fields.json` | Exact customer-content identity used by preview, Save source splitting, translation field selection, and Publish. | `KEEP — OWNER` |
| `discovery.json` | Unique search/answer semantics used by the selected Publish materializer. | `KEEP — OWNER` |
| `labels/en.json` | Widget-owned ToolDrawer meaning resolved once by the producer and rendered by Bob. | `KEEP — OWNER` |
| `limits.json` | Widget-owned editing limits enforced on real Bob edits. | `KEEP — OWNER` |
| `upsell/en.json` | Widget-owned complete messages paired exactly with `limits.json` IDs. | `KEEP — OWNER` |

All five generated editor and materializer artifacts carry the same active
shared software set selected explicitly by each `widget.html`:

- CSS: `composition`, `header`, `localeSwitcher`, `stagePod`, and
  `socialShare`;
- JavaScript: `runtime`, `header`, `localeSwitcher`, `stagePod`, and
  `socialShare`; and
- the selected Widget's exact Core CSS and JavaScript.

Those active modules remain. No current shared service contains a Widget-name
branch in the selected runtime. Fixed role semantics found in the shared style
renderer are recorded separately in Slice 4 because they are a shared-service
behavior decision, not evidence that the Widget folder is wrong.

Findings:

| ID | Current evidence | Why it exists | Cost and preservation | Classification |
| --- | --- | --- | --- | --- |
| S1-F01 | `shared/{appearance.js,branding.js,coreSize.js,fill.js,previewL10n.js,surface.js,typography-data.js,typography.js}` are referenced by no current Widget and are absent from all ten generated artifacts. Both hand-maintained shared CSS/JavaScript key arrays in `packages/widget-foundation/src/modules.ts` also have no consumer; one contains the stale names. The owning manual identifies the files as historical. Read-only R2 evidence proves all eight currently exist under `product/widgets/shared/`; the friendly route returned 200 for `appearance.js`. | They were the pre-static-first visitor-time appearance/fill/typography system superseded by authored composition, Bob source preview, Widget Core software, and Roma Publish materialization. | 65,699 source bytes, eight live objects/PUTs, and two dead arrays. Delete the files and both arrays; preserve the actual ten active source files and prove their generated order/content remains exact. The separately authorized Slice 7 reconciliation removes the complete raw remote prefix. | `DELETE — SUPERSEDED` |
| S1-D1 | FAQ and Logo Showcase each declare `normalization.idRules`; the Bob compiler parses and emits them, but no Bob, Roma, Tokyo, materializer, or test consumer reads `compiled.normalization`. Current human Add IDs are minted by Dieter Repeater/Object Manager, while Product Copilot insert admission already requires an exact ID. | The declarations predate the current explicit ID-producing controls and model-edit admission. | The blocks, parser/types, and emitted editor bytes are inert today. Removing them changes authored Widget declarations, so the audit cannot infer permission. Adding a new runtime normalization consumer is rejected because no current need exists. | `OWNER DECISION` |

#### Slice 1 owner decision OD-S1-01 — APPROVED

Delete the two proved-inert `normalization.idRules` blocks and their
compiler-only parser, types, and emitted field. Preserve Dieter Repeater and
Object Manager ID minting and Product Copilot exact-ID admission. Do not add a
replacement normalization workflow or reinterpret another Widget declaration.

#### Slice 1 execution plan

Approved findings: `S1-F01` and `S1-D1` under `OD-S1-01`.

Exact outcome: the eight superseded shared browser modules, their stale module
keys, the two inert normalization declarations, and the compiler machinery
that exists only to carry those declarations are deleted. The Widget folder
shape, every required Widget-owned file, all ten active shared modules, and all
current Widget behavior remain.

Named authorities and allowed implementation files:

- Widget shared-source authority:
  `tokyo/product/widgets/shared/{appearance.js,branding.js,coreSize.js,fill.js,previewL10n.js,surface.js,typography-data.js,typography.js}`;
- both unconsumed shared-module arrays in
  `packages/widget-foundation/src/modules.ts`, preserving the used public-
  package marker constants in that file;
- the exact inert declaration blocks in
  `tokyo/product/widgets/{faq,logoshowcase}/spec.json`;
- compiler-only normalization files/fields in
  `bob/lib/compiler/modules/normalization.ts`,
  `bob/lib/compiler.server.ts`, `bob/lib/compiler.shared.ts`, and
  `bob/lib/types.ts`;
- ignored editor/materializer outputs only through their existing producer;
  and
- owning current manuals:
  `documentation/widgets/shared/ShellUtilities.md`,
  `documentation/widgets/authoring/WidgetFiles.md`,
  `documentation/widgets/widgets/{faq,logoshowcase}.md`, and
  `documentation/services/bob.md` where those exact contracts are described.

Prohibited changes: every other Widget declaration or Core file; Dieter ID
creation; Product Copilot edit admission; active shared CSS/JavaScript; Bob
editing behavior; Roma/Tokyo storage or routes; public package shape; l10n;
Prague; DevStudio; account data; and any replacement validator, compatibility
path, or normalization mechanism.

Ordered implementation:

1. Delete the eight exact superseded shared JavaScript files and delete both
   unconsumed `WIDGET_SHARED_CSS_MODULE_KEYS` and
   `WIDGET_SHARED_RUNTIME_MODULE_KEYS` arrays. Retain the used package marker
   exports in `modules.ts`. The actual active CSS/JavaScript sources and each
   Widget's explicit asset declarations remain authoritative and unchanged.
2. Delete the exact FAQ and Logo Showcase `normalization.idRules` blocks.
   Delete the compiler normalization module and remove only its import,
   parsing, type, and output fields.
3. Generate all five editor/materializer pairs once through the existing
   producer. Confirm normalization is absent and each artifact retains the
   exact active shared module paths and its Core HTML/CSS/JavaScript.
4. Reconcile only the named current manuals. Do not describe the historical
   modules or normalization metadata as a retained compatibility contract.

Generated-artifact effect: generated editor artifacts lose the inert
normalization member. Active software assets remain byte/order equivalent.
Materializer behavior and public package bytes remain unchanged.

Test/CI effect: update only exact compiler expectations that include the
deleted normalization field. Add no source-text compliance test or new CI
gate. Slice 7 separately removes the raw R2 mirror and redundant command graph.

Product-data effect: **none**. Deployment effect when later authorized: Bob
and Roma deploy-built artifacts may change. The eight current R2 objects are
not manually deleted in this slice; approved Slice 7 removes the complete raw
Widget mirror and reconciles its exact remote prefix.

Actual final CI/deploy surfaces: Roma verification; Bob and Roma Git-connected
Pages; Tokyo-worker because the shared Widget Foundation package changes; and
the existing Prague verification workflow because Widget source paths are one
of its unchanged triggers. Prague code/runtime is excluded and is not an
acceptance surface. Under the final Slice 7 graph, Widget source no longer
causes raw R2 sync.

Post-deploy/runtime evidence, only after separate push/deploy authorization:
reconcile exact GitHub/Pages/Worker SHAs; require Bob/Roma canonical and commit-
specific reachability; open and preview all five current Widgets through the
authenticated Roma/Bob owner surface; prove current Add/Copilot ID behavior;
and prove generated active asset inventories. Existing published packages are
unchanged until an explicit Republish, which is not authorized by this plan.

Focused verification:

- global source search proving the eight files/keys and all normalization
  symbols are absent;
- all-five generation followed by all-five check, plus focused FAQ and Logo
  Showcase checks;
- exact generated active-style/script/Core inventory for all five Widgets;
- Bob editor-contract tests and typecheck;
- Widget Foundation typecheck;
- `git diff --check`; and
- independent V1–V8, especially no missing active module/Core behavior (V3),
  no replacement ID workflow (V7), and no runtime test dependency (V8).

Stop conditions: any real consumer of one of the eight modules or normalization
output, any change outside the exact two declaration blocks, any active asset
loss/order change, or any storage/product-data consequence returns the slice
to `AUDITING`.

Independent audit of this Slice 1 evidence record: **PASS**.
Independent audit of this Slice 1 execution plan: **PASS**. The exact deletion
set, preserved active software, generated effects, tests, deploy surfaces,
product-data boundary, and V1–V8 gate are executable without scope invention.

#### Slice 1 execution record

M01 completed locally on 2026-08-21. The eight approved historical shared
modules, both unused module arrays, and the inert FAQ/Logo normalization path
were deleted without replacement. All ten generated artifacts retain the exact
active style/script/Core inventory. All-five and focused generation checks,
Bob editor-contract/typecheck, Widget Foundation typecheck, diff-check, and the
independent settled-diff V1–V8 audit passed. No product data or remote state was
read or changed.

### Slice 2 — Widget Discovery, Identity, And Catalog Truth

Status: **CLOSED**

Purpose: ensure discovery and catalog operations identify Widgets generically
without a manually maintained current-Widget codebook or complete-artifact work
on selected-Widget paths.

Audit:

1. Trace how Widget types are discovered from source.
2. Trace every generated source index, definition list, code/codebook, reverse
   map, and catalog summary.
3. Trace Catalog listing and New-open lookup separately.
4. Prove which callers need only compact catalog truth and which need one exact
   Widget contract.
5. Trace Widget identity through First Save, later Save, Publish, storage, and
   public serving.
6. Identify parameters or stored fields retained for a superseded coordinate
   only after proving every current consumer.
7. Measure catalog-size work on the catalog path and on selected-Widget paths.

Required output:

- identity and discovery flow;
- current manual/generated registry inventory;
- catalog-summary contract evidence;
- selected-Widget lookup cost;
- exact keep/delete/simplify findings; and
- any storage or product-data decision gate.

#### Slice 2 audit record

Current identity flow:

1. Both existing producers discover Widget directories generically by the
   presence of `spec.json`; neither uses a hand-maintained current-Widget list.
2. The Tokyo definition producer currently generates one tracked source index
   that imports every complete `spec.json` and `editable-fields.json`.
3. Tokyo constructs the complete definition array and exposes it to three Roma
   callers: Catalog, selected New, and created-account defaults setup.
4. Catalog needs every Widget but only `widgetType`, `displayName`, and
   `description`.
5. New needs one exact Widget but currently downloads the complete list and
   scans it before loading one selected editor artifact.
6. Created-account setup deliberately observes all current Widget types because
   the current persisted defaults document contains every current Core.
7. First Save stores the required `widgetType`; later Save and Publish use that
   exact stored type to select the Widget contract/software. Public serving
   uses the account/instance/package coordinate and never loads the catalog.

Measured current cost:

| Item | Current five Widgets | Direct 100-Widget projection |
| --- | ---: | ---: |
| Complete specs + editable fields imported into the Worker | 203,344 raw source bytes | ~4.07 MB |
| Contribution to measured minified Worker bundle | 115,238 of 250,904 bytes | Linear in full declarations |
| Complete definition response | 5,637 raw / 840 gzip | ~112 KB raw |
| Exact compact catalog summaries | 368 raw / 165 gzip | ~6.6 KB raw |
| Selected New identity/default baseline | Currently the complete 5,637-byte definition list plus an `O(N)` scan | Final New uses one selected Roma materializer; no selected Tokyo definition transport remains |
| Core-default portion of account defaults | 10,009 bytes | ~200,180 bytes before common/font metadata |

Findings:

| ID | Current flow and evidence | Required preservation | Classification |
| --- | --- | --- | --- |
| S2-F01 | The generated Tokyo definition source imports complete specs/editable fields, although all current definition callers need only type/name/description and translation now reads the selected Roma materializer contract. Metadata-only Widget changes also do not change the generated import-path index, so the Worker deployment input can remain stale while R2 source changes. | Tokyo remains the definition authority; exact catalog order/copy; one source-owned producer; no R2 runtime catalog or new registry. Emit exact compact definition literals from the existing producer and remove `editableFields`/`widgetCode` from the definition transport. | `SIMPLIFY`; definition `editableFields` is `DELETE — SUPERSEDED` |
| S2-F02 | Every selected New calls the all-definition route and scans it. | Preserve exact missing-Widget failure, exact effective defaults, no New write, and one selected editor artifact. Under approved `OD-S5-02`, New already selects the deploy-built Roma materializer for the authoritative Core baseline, so that existing artifact also supplies exact selected Widget identity; do not add a second selected-definition endpoint. | `SIMPLIFY`, executed in Slice 5 |
| S2-F03 | Created-account defaults setup lists all current Widget types. | The current complete defaults snapshot intentionally needs all current types unless the owner changes that contract under `S2-F08`. | `KEEP — OWNER` |
| S2-F04 | The code-to-type reverse map, codebook listing helper, Tokyo definition lookup/wrappers, code-length predicate, and related exports have no active source consumer after `OD-S5-02` assigns New to the selected materializer. | Retain only the compact definition collection. Delete all dead Tokyo definition-domain lookup/wrappers in the atomic Slice 2/3 checkpoint; Slice 6 deletes the `ck-contracts` codebook and exports once its one live First-Save forward consumer is removed. | `DELETE — PROVEN DEAD`, completed across Slices 2 and 6 |
| S2-F05 | `widgetCode` is threaded through key/source/serve/overlay/delete/public signatures, but `accountInstanceRoot` explicitly ignores it and every physical key is account + instance. | Preserve exact account/instance/locale paths and public behavior. Code-only parameter removal is coordinated with Slice 6. | `DELETE — SUPERSEDED` |
| S2-F06 | First Save derives a code from a manual five-Widget codebook, stores it in `instance.source.json`, and transports it even though Roma drops it and no current coordinate/runtime consumer uses it. A sixth correctly declared Widget therefore still requires a shared-service edit. | `widgetType` remains the sole required stored Widget software identity. Removing a stored field and deciding the exact existing-data disposition requires `OD-S6-01`. | `OWNER DECISION` |
| S2-F07 | Top-level `widgetType` selects the exact contract/software for later Save, Publish, and stable content identity. | Never replace it with a code or runtime folder inference. | `KEEP — OWNER` |
| S2-F08 | Existing accounts store one complete all-Widget defaults map created once. A newly deployed Widget appears in Catalog but an older account lacks `widgets[widgetType]`, so New returns missing truth; every New also reads the `O(N)` document. | A correctly declared Widget must become usable by an existing account without hand repair or silent healing. The exact defaults/storage/UI contract is a product-owner decision coordinated with Slice 5 and Slice 6. | `OWNER DECISION` |
| S2-F09 | Atomic source stores required top-level `widgetType` and an unconsumed duplicate `content.widgetType`; no active reader uses the nested value. | Keep top-level `widgetType` and all real content coordinates. Removing the nested stored field requires the same explicit stored-shape/data disposition as `OD-S6-01`. | `OWNER DECISION` |
| S2-F10 | Roma's materializer index and the two current source-directory scans are generated build packaging, not hand registries. | Keep generic source discovery. Slice 3 may change static materializer loading; do not invent a central runtime registry to deduplicate two small build scans. | `KEEP — OWNER` |

Decisions are routed to the authority that owns their actual effect:

- `OD-S6-01` owns deletion/data disposition for `widgetCode` and the duplicate
  nested stored `content.widgetType`; and
- `OD-S5-02` owns the plug-and-play Widget Defaults contract for a Widget
  deployed after an account already exists.

Those decisions are now approved, but their storage/defaults changes remain in
Slices 5 and 6. They do not broaden Slice 2.

#### Slice 2 execution plan

Approved findings in this slice: `S2-F01` and the dead Tokyo definition-domain
lookup/wrapper portion of `S2-F04`. `S2-F02`, `S2-F03`,
and `S2-F08` are resolved by the approved Slice 5 plan because approved
`OD-S5-02` makes the selected materializer the New/default-baseline authority.
The codebook/reverse/predicate portion of `S2-F04`, plus `S2-F05`, `S2-F06`,
and `S2-F09`, is resolved once by Slice 6. `S2-F07` and `S2-F10` remain
unchanged.

Atomic implementation gate: Slices 2 and 3 are one implementation checkpoint.
The compact domain consumer, compact tracked generated source, and unified
producer land together. Neither slice is committed, checked as complete, or
deployed in an interim state; the old generator may not overwrite the compact
source and no temporary compatibility shape is permitted.

Exact outcome: Tokyo exposes one compact, sorted definition collection. Until
Slice 5 changes account setup, Catalog and account setup retain that collection
operation; the final system uses it for Catalog only. Definition transport
contains exactly `widgetType`, `displayName`, and `description`. Already-dead
selected-definition machinery is removed. Slice 6 deletes the entire obsolete
codebook/reverse chain once. No selected Tokyo definition route is added.

Named authorities and allowed implementation files:

- Tokyo definition domain and route:
  `tokyo-worker/src/domains/widget-definitions.ts` and
  `tokyo-worker/src/routes/internal-widget-definition-routes.ts`;
- the tracked generated compact source
  `tokyo-worker/src/generated/widget-definition-sources.ts`, only through the
  Slice 3 producer;
- Roma's existing Tokyo definition collection client/types in
  `roma/lib/account-instance-direct.ts`, the Catalog consumer
  `roma/app/api/account/widgets/route.ts`, and the interim created-account
  consumer `roma/app/api/session/finish/route.ts`;
- new exact behavior test `tokyo-worker/tests/run-widget-definitions.ts`, its
  `test:widget-definitions` command in `tokyo-worker/package.json`, and current
  Roma `roma/tests/run-widgets-route-cold-path.mjs` fixtures; and
- `documentation/services/{roma,tokyo-worker}.md` plus
  `documentation/widgets/authoring/WidgetFiles.md` where the definition
  contract is described.

Prohibited changes: Widget source shape or declarations; Catalog copy/order;
New/default composition in this slice; the created-account all-Widget operation
before Slice 5; First/later Save; forward `resolveWidgetOverlayCode` until
Slice 6; account defaults/storage; public serving; a selected definition route;
a runtime registry/cache/discovery path; Prague; DevStudio; or product data.

Ordered implementation:

1. Define the exact compact Tokyo definition result as
   `{widgetType, displayName, description}`. The generated compact array is
   already sorted and complete; Tokyo returns that exact array without remap or
   re-sort, and Roma Catalog returns its exact entries without reconstructing
   the same three fields.
2. Keep the collection call for Catalog and, until Slice 5 changes the defaults
   contract, for created-account setup. Slice 5 removes the New collection call
   while composing effective defaults from the selected materializer.
3. Delete the proven-dead Tokyo definition-domain lookup and forward/reverse
   wrappers while rewriting that domain to consume the compact generated
   array. Slice 6 deletes the underlying forward/reverse `ck-contracts`
   codebook, exports, and code-length predicate together after removing the
   last real First-Save consumer.
4. Land the compact tracked generated source with Slice 3's one-producer
   implementation; never create a second generator or hand-maintained catalog.
5. Reconcile the named current manuals.

Generated-artifact effect: the tracked Tokyo definition source becomes compact
literals with no full `spec.json` or `editable-fields.json` imports. That
generation change is owned and executed once by Slice 3.

Test/CI effect: add `tokyo-worker/tests/run-widget-definitions.ts` and exact
package command `test:widget-definitions` for the sorted compact list and
retained auth/method boundaries. Update exact Roma
Catalog/account-setup fixtures for the compact contract. Slice 5 owns New's
selected materializer/defaults behavior tests. Do not add source-string guards.

Product-data effect: **none**. Deployment effect when later authorized through
the atomic Slice 2/3 checkpoint: Roma verification, Bob and Roma Git-connected
Pages, and Tokyo-worker. No R2 source or account object changes; other Workers
are not semantic acceptance surfaces.

Post-deploy/runtime evidence, only after separate push/deploy authorization:
reconcile exact GitHub/Pages/Worker SHAs; prove authenticated Catalog returns
the same ordered type/name/description cards; prove the private compact Tokyo
collection through its owning route; and use Slice 5's final New evidence for
the removed list scan. Do not create, Save, Publish, or mutate an account
instance for this definition proof.

Focused verification:

- compact list route/domain behavior;
- current Roma Catalog cold-path and interim account-setup behavior;
- Tokyo-worker and Roma typechecks;
- all-five producer check after Slice 3 emits the compact source;
- before/after definition payload and Worker-bundle measurements;
- exact Catalog content/order;
- `git diff --check`; and
- independent V1–V8, especially no selected default/fallback (V1), no omitted
  Catalog/account-setup truth (V3/V6), and no replacement registry (V7/V8).

Stop conditions: a current definition consumer proves it needs editable-field
truth, compact collection truth cannot preserve Catalog/account setup, a
storage/default/product-data consequence appears in this slice, or a manual
Widget registry is required.

Independent audit of this Slice 2 evidence record: **PASS**.
Independent audit of this Slice 2 execution plan: **PASS** as one atomic
checkpoint with Slice 3. The compact collection is trusted directly, no
selected Tokyo endpoint is invented, and the codebook/data work remains in
Slice 6.

### Slice 3 — Widget Artifact Producer, Compiler, And Generated Outputs

Status: **CLOSED**

Purpose: establish one understandable source-to-artifact production path whose
outputs are consumed directly.

Audit:

1. Trace `spec.json`, labels, editable fields, limits, upsell, discovery,
   Widget HTML/Core, shared source, and Dieter source through the producer.
2. Record each validation performed by the source owner and distinguish it from
   downstream revalidation.
3. Trace editor artifacts, materializer artifacts, generated indexes, and any
   duplicated embedded shared source.
4. Prove which outputs are required by Bob, Roma, Tokyo-worker, deploy, or
   verification.
5. Measure raw/compressed artifacts and per-Widget versus shared duplication.
6. Trace focused generation, all-Widget generation, and check mode.
7. Identify generated output that exists only because another historical path
   expects it.

Required output:

- exact source-to-output graph;
- one producer/boundary-validation map;
- artifact size and duplication table;
- required versus obsolete generated-output classification; and
- proposed producer simplifications based only on proved consumers.

#### Slice 3 audit record

The Widget artifact producer is the correct owning boundary. It currently
discovers each Widget, resolves Widget-owned labels, parses and validates the
structured declarations, compiles Dieter stencils, verifies the Widget shell
and Core, and emits deploy-built editor and materializer artifacts. Those
producer checks remain. Bob, Roma, and Tokyo must not reproduce them at
runtime.

The current output graph is:

```text
one Widget folder
  -> resolve labels + parse declarations + compile Dieter/Widget software
  -> one editor artifact for Bob
  -> one materializer artifact for Roma
all discovered Widget types
  -> one generated Roma materializer lookup source

separate second discovery script
  -> one Tokyo source index importing every spec + editable-fields file
```

Finding ledger:

| ID | Current flow and evidence | Why it exists | Cost/violation | Classification |
| --- | --- | --- | --- | --- |
| S3-F01 | `WidgetSoftware` contains `coreCss` and `coreJs`, while the exact same Core sources are already members of `styles` and `scripts`. Runtime consumers use `styles`/`scripts`; repository consumers of the two direct fields are the type, producer, fixture, and documentation only. | PRD 129 introduced a complete software envelope while the existing ordered asset collections were also retained. | 55,228 duplicate raw bytes across five Widgets in each artifact family; 110,456 across editor and materializer output. | `DELETE — SUPERSEDED` |
| S3-F02 | `roma/generated/widget-materializer-artifacts.ts` statically imports all materializer JSON, while First Save, later Save, Publish, translation preparation, and default seeding each logically select one Widget type. Current Roma build evidence contains all five payloads in one 645,469-byte minified chunk. | The generated synchronous lookup replaced runtime compilation and correctly made materialization deploy-built, but selected lookup was implemented as one eager object. | Selected operations carry catalog-sized server bundle input: 623,329 raw bytes at five Widgets; current-mean projection 12,466,580 raw bytes at 100. | `SIMPLIFY` |
| S3-F03 | `scripts/generate-widget-definition-sources.mjs` independently discovers the same folders and generates a Tokyo index that imports complete `spec.json` and `editable-fields.json`; the main artifact producer independently reads both again. Current Tokyo definition consumers use only compact identity/display fields, and current First Save uses the Roma materializer artifact's editable-fields contract. | Tokyo originally needed a deploy-bundled definition authority for Catalog/New/account initialization before the Roma artifact path became complete. | Two discovery/production paths; 197,234 bytes of the measured 424,256-byte in-memory Worker bundle come from five full source imports. The full five-definition JSON is about 5,600 bytes versus 336 bytes for exact compact type/display/description truth. | `SIMPLIFY`, dependent on Slice 2's exact compact-definition disposition |

Retained architecture:

| Item | Disposition | Reason |
| --- | --- | --- |
| Widget-folder parsing, label resolution, editable-field/limits/upsell/discovery checks, shell/Core checks, Mustache parsing, and Dieter stencil compilation | `KEEP — BOUNDARY` | These are the one legitimate producer-completeness boundary. |
| Expanded Dieter panel HTML in the editor artifact | `KEEP — OWNER` | Bob consumes deploy-built markup for one selected Widget; compiling it in Bob would recreate runtime compilation and validation machinery. |
| Widget software present in both editor and materializer artifact families | `KEEP — OWNER` | Bob browser preview and Roma server materialization are distinct deploy/runtime consumers. A new runtime loader or cross-surface cache would add machinery and coupling. |
| Shared source embedded inside each self-contained Widget artifact | `KEEP — OWNER` for this pass | A selected artifact must carry the exact shared software that Widget uses. The audit found repetition but no smaller existing authority that removes it without a new loader/cache. |
| Focused `--widget`, all-Widget, and check modes | `KEEP — OWNER` | They are real producer modes; Slice 7 owns removing repeated invocations and making validation check-only. |

No Widget declaration or folder member changes in this slice. No product data,
public package contract, Bob editing contract, Save law, or Publish law changes.

#### Slice 3 execution plan

Approved findings: `S3-F01`, `S3-F02`, and `S3-F03`, with `S3-F03` executed
only after Slice 2 freezes the compact Tokyo definition contract.

Atomic implementation gate: this plan lands with Slice 2 as one checkpoint.
The compact Tokyo domain consumer, compact tracked generated source, unified
producer, and package commands must agree in the same settled diff. No interim
commit, check, deploy, old-generator rewrite, or compatibility payload is
allowed.

Outcome: one producer accepts every Widget once, emits the same two required
artifact families without duplicate Core fields, emits the one compact Tokyo
definition source, and exposes each Roma materializer artifact as one
deploy-built Pages static asset. Roma Edge functions read the exact selected
asset through Pages' existing `env.ASSETS` binding. Selected flows transfer and
decode one materializer payload. Until Slice 5 removes the current created-
account snapshot operation, that deliberately all-Widget flow requests each
Widget type and therefore reads one asset per requested type; it does not
regain an eager all-payload bundle.

Implementation evidence corrected the original loader assumption before this
checkpoint could close. Next 15.5.2 sets Edge entries to `asyncChunks: false`;
the attempted static dynamic-import map therefore compiled all five payloads
into the initial 591,766-byte `edge-chunks/1141.js`, and every affected route
listed that chunk in `middleware-manifest.json`. Chunk-name comments, switches,
or wrapper modules could only rename the same eager bytes. The existing Pages
`ASSETS` binding is the smallest named Roma deploy authority that can return
one selected deploy-built artifact without a new service, route, registry,
cross-service request, cache, fallback, or compatibility path. The producer
still owns completeness; Roma performs only static-asset transport and JSON
decoding and trusts the exact artifact.

Named producers/consumers and allowed implementation files:

- `.gitignore`, only to keep the producer-owned
  `roma/public/widget-materializers/` output root derived and untracked;
- producer: `scripts/widgets/generate-artifacts.ts` and
  `scripts/widgets/generate-artifacts.mjs` only if its CLI contract changes;
- `scripts/generate-widget-definition-sources.mjs` for deletion after its
  output is owned by the main producer;
- exact root producer commands in `package.json`;
- `packages/widget-foundation/src/widget-software.ts`;
- `packages/ck-runtime-materializer/tests/fixtures/base-input.ts` and
  `packages/ck-runtime-materializer/tests/run-runtime-materializer-contract.ts`;
- `roma/generated/widget-materializer-artifacts.ts` only through generation;
- `roma/public/widget-editors/*.json` and
  `roma/public/widget-materializers/*.json` only through generation;
- `tokyo-worker/src/generated/widget-definition-sources.ts` only through
  generation;
- Roma selected readers:
  `roma/lib/account-instance-public-package.ts`,
  `roma/lib/account-instance-translations.ts`, and
  `roma/lib/account-widget-defaults-materialization.ts`;
- exact Roma selected routes:
  `roma/app/api/account/instances/route.ts`,
  `roma/app/api/account/instances/[instanceId]/route.ts`, and
  `roma/app/api/account/instances/[instanceId]/publish/route.ts`;
- behavior fixtures/tests:
  `bob/tests/run-editor-contract.ts`,
  `roma/tests/run-instance-save-boundary.ts`,
  `roma/tests/run-translation-outcomes.ts`,
  `roma/tests/run-widget-defaults-panels.mjs`,
  `roma/tests/run-widget-defaults-typography.ts`, and
  `roma/tests/run-widget-command-gates.ts`, only where exact behavior/fixtures
  change; the focused `roma/tests/run-widget-materializer-artifacts.ts` Pages-
  asset transport test and its exact `roma/package.json` command; plus Slice
  2's exact Tokyo definition test; and
- current manuals:
  `documentation/widgets/authoring/WidgetFiles.md`,
  `documentation/services/{bob,roma,tokyo-worker}.md`, and
  `packages/ck-runtime-materializer/README.md`.

Prohibited changes:

- `tokyo/product/widgets/{widgetType}/**` declarations or Core behavior;
- Bob editing/runtime behavior, Dieter stencils, public package shape, Tokyo
  account storage, overlays, l10n, Prague, DevStudio, and product data; and
- any runtime discovery service, manual Widget registry, cross-service/network
  artifact request, compatibility reader, validator, application cache, or
  fallback. The existing Pages `ASSETS` binding is the named static-deploy
  authority, not a new service or discovery path.

Ordered implementation:

1. Remove `coreCss` and `coreJs` from `WidgetSoftware`, its producer object,
   generated artifacts, fixtures, and owning documentation. Keep exact Core
   source once in the ordered `styles` and `scripts` assets and rerun the
   focused renderer/materializer checks.
2. Emit each materializer JSON as
   `roma/public/widget-materializers/{widgetType}.json`. Generate one small
   static map from Widget type to that exact path. Its asynchronous reader uses
   the existing Cloudflare Pages `env.ASSETS.fetch()` binding, fails when a
   declared deploy asset is unavailable, JSON-decodes the response without
   semantic revalidation, and returns `null` only for an input absent from the
   generated map. Await it at First Save, later Save, Publish, translation
   preparation, public-package preparation, and the interim created-account
   defaults loop. The first five request one selected type; the interim loop
   deliberately requests every current type until Slice 5 deletes that
   snapshot operation. Do not add a network fallback, alternate local reader,
   application cache, schema validator, or compatibility shape.
3. Apply Slice 2's approved compact-definition contract. Make the main producer
   emit the exact sorted compact Tokyo definition literals from the already-
   read Widget authority, remove the second discovery generator, remove its
   package-command references, and remove complete spec/editable-field imports
   from the Worker bundle.
4. Generate all derived outputs once through the owning producer; inspect that
   only expected generated shapes changed.
5. Reconcile the exact named manuals with the producer/output graph.

Focused verification:

- check-only all-five and focused-one Widget generation;
- exact five-Widget source-to-artifact parity for required fields;
- Widget foundation and runtime materializer tests/typecheck;
- Bob compiler/editor and preview contracts;
- Roma First Save, later Save, Publish, translation-contract, and Widget
  Defaults initialization checks;
- focused Pages-asset reader behavior proving unknown input performs no read,
  one known type reads exactly its one generated path, and an unavailable
  declared asset fails without substitution;
- Roma production build proving zero materializer payload bytes in the Edge
  server chunks and five separate static materializer assets in the Pages
  output;
- Tokyo-worker typecheck/build proving the compact definition source and
  measuring the removed full-source contribution;
- `git diff --check`; and
- independent V1–V8 review, specifically no missing Core CSS/JS (V3), no
  unknown-Widget fallback (V1/V4), no partial artifact generation (V6), and no
  runtime loader/validation ritual replacing producer work (V7/V8).

Product-data effect: **none**. Deployment effect when implementation is later
authorized: the final dependency graph builds/deploys Bob and Roma Pages and
Tokyo-worker. Roma verification also runs. No raw R2 root changes. The
git-authored Tokyo product root and account data are unchanged.

Post-deploy/runtime evidence, only after separate push/deploy authorization:
reconcile local/GitHub/Pages/Worker SHA; require Bob and Roma commit-specific
and canonical reachability; require Tokyo health and compact Catalog behavior;
open each current Widget through authenticated Roma/Bob and prove one selected
artifact/preview; prove New creates no source object; and inspect one locally
materialized package for complete Core CSS/JavaScript. Do not Save, Publish, or
Republish a cloud instance merely to verify this slice. Any product-data
operation requires a separately approved exact instance coordinate.

Stop conditions: an actual consumer of direct `coreCss`/`coreJs`, inability to
serve one exact selected materializer through the existing Pages `ASSETS`
binding without a fallback or second runtime authority, a Tokyo consumer
requiring complete editable-field definition payloads, a new Widget
declaration, or any storage/data consequence returns this slice to `AUDITING`.

Independent audit of this Slice 3 execution plan: **PASS** as one atomic
checkpoint with Slice 2. The producer, generated outputs, selected versus
interim all-type consumers, tests, deploy effects, and V1–V8 gate are exact.

#### Slices 2–3 execution record

`M02` is **CLOSED**. One producer now emits the editor artifacts, five separate
Pages materializer assets, the generated exact-path reader, and the exact
sorted compact Tokyo definition array. Duplicate direct Core fields and the
second definition generator are gone; Core remains once in the exact ordered
style/script assets. The generated path reader uses an own-key-safe `Map`,
returns `null` without an asset read for every unknown input, and fails a known
unavailable or malformed asset without substitution, fallback, cache, or
semantic revalidation.

All-five and focused generation checks, the named Bob, Widget Foundation,
runtime-materializer, Tokyo-worker, and Roma behavior/type checks, Roma
production Pages build, Tokyo Worker dry-run, and `git diff --check` passed.
The production output contains exactly five materializer JSON assets; a
recursive scan of all 115 Edge Worker JavaScript/JSON files contains zero
materializer payloads. The independent settled-diff audit passed V1–V8. No
product data or remote state was read or changed.

### Slice 4 — Bob Selected-Widget Open, Edit, And Preview

Status: **CLOSED**

Purpose: prove that Bob operates one selected Widget through one generic
compiled contract and retains no Widget-set or Widget-semantic machinery.

Audit:

1. Trace Roma's exact open envelope into Bob.
2. Trace the selected editor artifact, controls, labels, Widget software, and
   preview sources.
3. Trace Manual, Undo, Product Copilot, asset, translation-panel, and Save
   paths only where they consume the same generic Widget contract.
4. Search for Widget identities, Core-path meaning, role-name behavior, fixed
   registries, and alternate preview paths in Bob/shared code.
5. Prove which Bob checks are browser/model/user ingress and which repeat an
   already-produced Widget artifact.
6. Measure selected-artifact transfer, decode, retained memory, render, and
   any accidental catalog-wide work.
7. Verify that Widget-owned labels remain distinct from Bob-owned editor
   Chrome.

Required output:

- Bob selected-Widget journey;
- artifact and authority consumption map;
- generic versus Widget-specific code findings;
- retained ingress boundaries;
- selected-Widget performance evidence; and
- exact simplification candidates.

#### Slice 4 audit record

Bob's central scaling architecture is already correct. A normal Builder open
fetches one exact editor artifact, accepts one Roma open envelope at the iframe
security boundary, retains one compiled contract plus one browser-memory draft,
and renders one selected preview. It does not list the Widget catalog, compile
Widget source, persist account state, or read a stored public package. At five
Widgets the selected artifact is 64–89 KB over the current compressed live
transfer and 0.96–1.41 MB decoded; adding catalog entries does not increase the
number of Bob artifact requests or artifacts retained for that open session.

The fixed five ToolDrawer panel identities are shared editor product structure,
not five Widget names. The selected Widget supplies their exact labels and
compiled content. Bob's separate Translations item is Bob Chrome. Browser
origin/source checks, human/model edit admission, command correlation, policy
enforcement at the user-intent boundary, show-if projection, and Dieter control
hydration/teardown remain.

Findings:

| ID | Current flow and evidence | Why it exists | Required preservation | Classification |
| --- | --- | --- | --- | --- |
| S4-F01 | `controlHostClusterId` and `namespaceControlHostClusterIds` in `bob/components/td-menu-content/dom.ts` regex-check the namespace and deploy-compiled cluster IDs and reject duplicate compiled IDs before prefixing them. The producer already owns exact cluster IDs; Bob and Roma Widget Defaults call this on trusted compiled HTML. | Namespacing was added so multiple compiled control hosts do not collide, and validation was bundled with that real composition job. | Keep deterministic prefixing and `aria-controls` rewiring; remove only the second proof of producer truth. | `DELETE — SUPERSEDED` |
| S4-F02 | `bob/components/td-menu-content/linkedOps.ts` contains exact root paths `layout.itemPaddingLinked` and `layout.itemPadding`. No current Widget declares those paths; FAQ declares `faq.layout.itemPaddingLinked` and namespaced side values, so the branches are unreachable and do not implement current FAQ behavior. | Historical linked-padding behavior survived after the Core state moved under the Widget namespace. | Preserve every currently reached shared Stage/Pod, header CTA, radius, shadow, preset, and typography transition. | `DELETE — PROVEN DEAD` |
| S4-F03 | `packages/widget-foundation/src/widget-styles.ts` selects a fluid-size formula by the literal role names `title`, `bigBang`, `timer`, and `cardTitle`. The latter three are unique current Widget role identities inside a shared renderer. | PRD 129 centralized typography rendering while preserving different display-role scaling curves. | Current Big Bang, Countdown, Cards, and shared-title visual sizing across preview and Publish must not change accidentally. | `OWNER DECISION` |
| S4-F04 | The same shared renderer contains role-name line-height maps for common and Widget-unique identities such as `section`, `question`, `answer`, `timer`, and `label`, including script-specific values. | Centralization preserved per-role and per-script typography behavior that previously existed in the Widget system. | Current locale-specific and role-specific line-height output in Bob preview and published packages. | `OWNER DECISION` |

The audit rejects these apparent simplifications:

- compiling Dieter stencils in Bob at runtime;
- splitting the selected editor artifact into a runtime source loader;
- keeping a catalog cache in Bob;
- incrementally patching Widget-specific preview DOM instead of rendering from
  the exact browser-memory draft; and
- moving Widget labels into Bob Chrome.

Each would add machinery or make Bob own Widget meaning. The large compiled
panel HTML is therefore retained pending the producer/output changes in Slice
3 and the all-Widget Widget Defaults work in Slice 5.

#### Slice 4 owner decision OD-S4-01 — APPROVED

Preserve every current typography result through the smallest complete,
generic role-behavior metadata in the existing Widget software contract. The
artifact producer owns and validates that metadata once. Bob preview and Roma
Publish consume the same emitted Widget software. The shared renderer no
longer branches on Widget-unique role names. Do not standardize away current
visual behavior and do not add a Widget-name/path branch.

#### Slice 4 execution plan

Approved findings: `S4-F01`–`S4-F04` under `OD-S4-01`.

Exact outcome: Bob namespaces trusted compiled control IDs without revalidating
them; the two dead root item-padding operations are deleted; and the shared
style renderer consumes one complete generic typography-behavior map emitted
inside `WidgetSoftware`. Bob preview and Roma Publish therefore preserve the
same current CSS without any Widget-name or Widget-role branch in shared code.

Exact generic contract:

```ts
type WidgetTypographyBehavior = {
  roles: Record<
    string,
    {
      fluidSize: 'min-plus-growth' | 'proportional';
      normalLineHeight: Record<TypographyScript, string>;
    }
  >;
};

type TypographyScript =
  | 'latin'
  | 'japanese'
  | 'korean'
  | 'zhHans'
  | 'zhHant'
  | 'arabic'
  | 'hebrew'
  | 'thai'
  | 'devanagari'
  | 'bengali'
  | 'cyrillic';
```

Current Widget specs declare `typographyBehavior.roles` only for their unique
roles. Widget Foundation owns common roles. The producer combines both,
expands every supported script to a complete exact value, and requires
one-to-one coverage with the composed `defaults.typography.roles` before
emitting the complete map in `WidgetSoftware`. Missing or extra role behavior
fails artifact production; runtime code has no default or guessed value.

Exact behavior preserved:

- `min-plus-growth`: common `title` and unique `bigBang`, `timer`, and
  `cardTitle`; every other current role is `proportional`;
- common `title`: `var(--lh-tight)` for every non-CJK script; Japanese `1.28`,
  Korean `1.26`, Simplified and Traditional Chinese `1.24`;
- common `body`: `var(--lh-body)` for every non-CJK script; Japanese `1.58`,
  Korean `1.54`, both Chinese scripts `1.52`;
- common `button`: `var(--lh-tight)` for every non-CJK script; Japanese `1.24`,
  Korean `1.22`, both Chinese scripts `1.2`;
- common `localeSwitcher`: `var(--lh-tight)` for every script;
- Big Bang `bigBang`: `normal`;
- Cards `cardTitle` and `cardCopy`: `normal`;
- Countdown `timer`: `1`; `label`: `var(--lh-tight)`;
- FAQ `section`: `var(--lh-tight)` for every non-CJK script, then `1.3`,
  `1.3`, `1.28`, `1.28` for Japanese,
  Korean, Simplified Chinese, and Traditional Chinese;
- FAQ `question`: `var(--lh-tight)` for every non-CJK script, then `1.38`,
  `1.36`, `1.34`, `1.34`;
- FAQ `answer`: `var(--lh-body)` for every non-CJK script, then `1.62`,
  `1.58`, `1.56`, `1.56`; and
- the unconsumed shared `heading` entry is deleted.

Named authorities and allowed implementation files:

- `bob/components/td-menu-content/{dom,linkedOps}.ts`;
- `packages/widget-foundation/src/{widget-software,widget-styles,index}.ts`;
- the exact raw Widget declaration type in `bob/lib/compiler.shared.ts`;
- `scripts/widgets/generate-artifacts.ts`;
- `tokyo/product/widgets/{big-bang,cards,countdown,faq}/spec.json` only for
  approved unique-role behavior metadata;
- generated editor/materializer artifacts only through the producer;
- behavior fixtures/tests:
  `bob/tests/{run-editor-contract,run-typography-contract}.ts`,
  `packages/ck-runtime-materializer/tests/fixtures/base-input.ts`,
  `packages/ck-runtime-materializer/tests/run-runtime-materializer-contract.ts`,
  and `roma/tests/run-widget-defaults-typography.ts` only where their exact
  compiled/software/CSS fixtures change; and
- current manuals:
  `documentation/widgets/authoring/{WidgetFiles,ToolDrawerControls}.md`,
  `documentation/widgets/shared/ShellCore.md`,
  `documentation/widgets/widgets/{big-bang,cards,countdown,faq}.md`,
  `documentation/engineering/UI/typography.md`,
  `documentation/services/{bob,roma}.md`, and
  `packages/ck-runtime-materializer/README.md` only where they own the changed
  generic typography contract.

Prohibited changes: Widget Core HTML/CSS/JavaScript; user-editable typography
values; labels/l10n; Dieter stencils; Bob session/edit/Save behavior; Roma
materialization semantics; Tokyo storage/serving; a Widget-name/path branch;
a runtime behavior fallback; Prague; DevStudio; and product data.

Ordered implementation:

1. In Bob control-host DOM composition, retain deterministic namespace
   prefixing and `aria-controls` rewiring; delete only the regex and duplicate-
   ID re-proofs over producer-owned compiled IDs.
2. Delete only the unreachable root `layout.itemPaddingLinked` recognition and
   its root `layout.itemPadding*` expansion. Preserve every reached linked
   Stage/Pod/Header/radius/shadow/preset/typography operation.
3. Add the exact generic behavior type to Widget Foundation and the approved
   unique-role declarations to the four affected specs. Define common-role
   behavior once in Widget Foundation.
4. Make the existing producer combine common and unique behavior, expand the
   complete script map, prove exact role coverage once, and emit it inside both
   required artifact families' `WidgetSoftware`.
5. Replace `fluidSize` and normal-line-height role-name maps in
   `widget-styles.ts` with direct lookup of the complete emitted behavior.
   Delete the unused `heading` behavior. Add no fallback branch.
6. Generate all five artifacts once and reconcile the exact owning manuals.

Generated-artifact effect: every editor/materializer artifact gains the
complete generic typography behavior in its existing `WidgetSoftware`. No
editable config, Core software, labels, public package shape, or stored source
field changes.

Test/CI effect: add durable CSS behavior assertions, not source-shape guards.
Prove every current role, all four CJK variants, and one representative
non-CJK script; prove Bob preview and Publish derive identical typography CSS
from the same state/software. Update only affected artifact fixtures.

Product-data effect: **none**. Deployment effect when later authorized: Bob
and Roma deploy-built artifacts/packages; the final dependency graph also
verifies/deploys Tokyo-worker because Widget Foundation changes and runs the
existing Prague verification because the four Widget specs changed, but those
are incidental deployment surfaces, not acceptance owners or permission to
change Prague. Tokyo account data and public URLs do not change; a later
Republish remains a separate user operation.

Focused verification:

- all-five generation followed by all-five check;
- exact one-to-one role/script behavior coverage in all five artifacts;
- Bob editor-contract/control-host/typography behavior tests and typecheck;
- Widget Foundation and runtime-materializer tests/typechecks;
- Roma typecheck and materializer behavior checks;
- preview/Publish CSS parity for all preserved rules;
- `git diff --check`; and
- independent V1–V8, especially no guessed missing behavior (V1), no role
  omission (V3/V6), no weakened producer boundary (V4), and no renamed
  Widget-specific switch (V7).

Post-deploy/runtime evidence, only after separate push/deploy authorization:
reconcile the exact GitHub, Bob Pages, Roma Pages, and Tokyo-worker SHAs;
require Bob/Roma canonical and commit-specific reachability plus Tokyo health;
open all five current Widgets through authenticated Roma/Bob and compare the
rendered typography CSS at the current title/body/button/locale-switcher and
unique-role states against the frozen pre-change values. Use local
materialization of the same exact state/software to prove preview/Publish CSS
parity. Do not Save, Publish, Republish, or rewrite any account object for this
proof.

Stop conditions: any current CSS value cannot be represented exactly by the
generic map, a source role lacks an exact behavior, a Widget declaration beyond
the approved metadata must change, or preview/package output diverges.

Independent audit of this Slice 4 execution plan: **PASS**. The complete
11-script behavior contract, exact emitted CSS, allowed paths, behavior tests,
deploy surfaces, product-data boundary, and V1–V8 gate are executable.

#### Slice 4 execution record

`M03` is **CLOSED**. Bob now trusts producer-owned compiled control IDs while
retaining deterministic namespace prefixing and `aria-controls` rewiring, and
the two unreachable root item-padding operations are gone without changing
FAQ's namespaced operation or any reached linked operation. Widget Foundation
owns the four common typography-role behaviors; the four affected Widget specs
own only their unique roles. The artifact producer composes those authorities,
requires exact role coverage and all 11 scripts, and emits one complete generic
behavior map consumed directly by both Bob preview and Roma Publish. The shared
renderer contains no Widget-role switch or fallback, and every prior formula
and line-height value is preserved.

All-five generation/checks, exact editor/materializer behavior-map parity,
all-role/all-script rendering, Bob behavior/type checks, Widget Foundation and
runtime-materializer checks, Roma typography/type checks, Bob and Roma
production builds, and `git diff --check` passed. The independent settled-diff
audit passed V1–V8. No product data or remote state was read or changed.

### Slice 5 — Roma Catalog, New, Widget Defaults, Save, And Publish

Status: **CLOSED**

Purpose: make Roma's product operations generic and ensure each operation loads
only the truth its real job requires.

Audit:

1. Trace Widgets Catalog and inventory cold paths.
2. Trace New-open default composition and exact selected-Widget artifact
   lookup.
3. Trace saved Builder open and First/later Save.
4. Trace Widget Defaults common controls and Widget-specific Core controls,
   including what the current all-Widget page actually renders and retains.
5. Trace Publish/Republish materializer artifact selection and package
   generation.
6. Distinguish legitimate Roma product policy, user-input admission, and UI
   projection from fixed-Widget or duplicated artifact machinery.
7. Measure requests, transferred/decoded artifacts, retained state, server
   bundle contribution, and N-Widget growth for each distinct operation.
8. Stop for owner direction if a scalable Widget Defaults result requires a
   user-visible interaction change.

Required output:

- separate Catalog, New, saved Builder, Widget Defaults, Save, and Publish
  flow maps;
- selected versus all-Widget cost table;
- materializer selection evidence;
- product/UI decisions, if required; and
- exact keep/delete/simplify findings.

#### Slice 5 audit record

Roma's generic lifecycle is correct: Catalog is catalog-wide, Builder hosts one
selected Widget, New writes nothing, Save writes editable source only, and
Publish alone materializes one complete package. The audit does not combine
those distinct jobs or move them out of Roma.

Current cost by operation:

| Operation | Current artifact/service work | Growth |
| --- | --- | --- |
| Your Widgets | Compact definition catalog + account instance facts + eager prefetch of up to eight distinct editor artifacts | Account instances plus up to eight selected-artifact downloads even when no Builder opens |
| Catalog | Compact definitions + account instance facts | Catalog/account-instance sized; legitimate catalog work |
| New | All Tokyo definitions + complete defaults document + one selected editor artifact | Accidental catalog read plus account defaults plus selected artifact |
| Saved Builder | One exact source + complete defaults document for font library + one selected editor artifact | Selected instance; defaults document grows with Widget catalog |
| First/later Save | One selected materializer contract + one selected source write | Selected after Slice 3 removes eager bundle packaging |
| Publish/Republish | Roma account-wide instance facts + exact source/materializer/defaults + Tokyo's own account-wide capacity read | Duplicate account-wide reads plus selected materialization |
| Widget Defaults | Complete defaults document + every editor artifact + every common/Core control host | Linear in total Widget catalog and all controls |

Findings:

| ID | Current flow and evidence | Why it exists | Cost/required preservation | Classification |
| --- | --- | --- | --- | --- |
| S5-F01 | `widgets-domain.tsx` prefetches editor artifacts for up to eight distinct instance Widget types on every Your Widgets mount. `prefetchWidgetEditorArtifact` has no other product consumer. | Added to reduce a later Builder navigation wait through the browser cache. | At the current five Widgets it downloads all five artifacts: about 392 KB compressed and 5.88 MB decoded, even when the user opens none. Builder must still fetch exactly one artifact when selected. | `DELETE — SUPERSEDED` |
| S5-F02 | New-open calls the all-definition endpoint and scans it for the requested type before composing one draft. Roma already has the deploy-built selected materializer lookup and the exact selected account-default entry. | Tokyo definitions were the available Widget-existence authority before complete per-Widget generated artifacts existed in Roma. | One selected New must retain explicit missing-Widget failure, exact defaults, and zero writes; it need not transfer/scan the catalog. | `SIMPLIFY` |
| S5-F03 | Publish loads exact account instance facts and returns the fast Roma policy/upsell `402` before source loading or materialization; Tokyo separately repeats the count at the atomic publication transition. | The two checks own distinct current jobs: Roma gives the deterministic early product-policy result, while Tokyo protects the race-sensitive storage commit. With a full account and a saved source that references a since-deleted asset, removing the precheck changes the current `402` into a later materialization `422` after more work. | Keep both decisions. Slice 6A reduces Roma's facts acquisition to one request; it does not delete the fast precheck or Tokyo's final enforcement. Preserve the current error priority and denied-path cost. | `KEEP — OWNER` |
| S5-F04 | `loadAccountWidgetInstanceFacts` first requests all IDs, then Roma sends one internal HTTP request per instance with concurrency eight. Catalog/Inventory reaches this on every uncached refresh. | Tokyo initially exposed exact selected pointer facts plus a lightweight ID list; Roma composed the account view. | `N+1` Roma-to-Tokyo requests for one account view. Tokyo remains the storage/fact authority and may aggregate the same exact reads behind one account-facts request; no stored index or compatibility path is required. | `SIMPLIFY`, coordinated with Slice 6 |
| S5-F05 | Widget Defaults `Promise.all` fetches every editor artifact, retains every `CompiledWidget`, requires every Core host to hydrate before Save, and renders every Widget section. | The first implementation mirrored the full defaults document as one complete page and reused the exact Builder controls. | Five Widgets: 5.88 MB decoded/~392 KB gzip plus every control host. Current-mean 100-Widget projection: ~117.6 MB decoded/~7.85 MB gzip and 100 Core sections. The saved document and full-document Save law may remain, but the user interaction cannot be chosen by an agent. | `OWNER DECISION` |
| S5-F06 | The common defaults controls come from `compiledWidgets[widgetTypes[0]]`. Changing the alphabetically first Widget can therefore change common UI labels; current Big Bang already supplies a different body group label than the other four. | Reusing one compiled Widget avoided a second common-control compiler/artifact. | Account-wide common defaults must not acquire meaning from an arbitrary first Widget. The exact UI ownership depends on the Widget Defaults interaction decision. | `OWNER DECISION` |
| S5-F07 | The complete defaults document is seeded only when the account is created. Catalog discovers a later deployed Widget, but that existing account has no `widgets[widgetType]`, so New cannot compose the Widget. | The first implementation treated defaults as a snapshot of the catalog existing at account creation. | This is a concrete plug-and-play blocker for the next Widget. The product must define either effective baseline-plus-account-override truth or an explicit owner-routed onboarding operation; a read-time fallback/backfill is forbidden. | `OWNER DECISION`, paired with S2-F08 |

Retained choices:

- compact Catalog work on `/widgets/catalog`;
- the complete account defaults document as the current account-owned source
  until `OD-S5-02` defines how a later Widget enters an existing account;
- one selected editor artifact for Builder;
- one selected materializer for Save/Publish;
- exact current-account/session/policy and user-input boundaries;
- full-document Widget Defaults Save; and
- Roma's fast capacity/upsell precheck before materialization; and
- Roma's one generic materializer and Tokyo's atomic publication result.

Splitting the defaults storage document, adding a defaults cache/service, or
putting Widget controls in Roma is rejected: none is required to remove the
proved waste.

#### Slice 5 owner decision OD-S5-01 — APPROVED

Widget Defaults presents one selected Widget Core at a time. The account-wide
common section remains separate and its wording is owned by the shared system,
not borrowed from whichever Widget sorts first. The page fetches and hydrates
only the selected Widget editor artifact while preserving one coherent draft,
Discard, Save, and unsaved-navigation boundary.

#### Slice 5 owner decision OD-S5-02 — APPROVED

Effective defaults are the deployed Widget baseline composed with explicit
account overrides. A correctly deployed later Widget therefore works
immediately for every existing account. The account document no longer claims
to be a complete snapshot of every deployed Widget. Composition is an explicit
Roma-owned product contract, not a missing-value fallback, silent backfill, or
read-time storage mutation.

#### Slice 5 execution plan

Approved changes: `S5-F01`, `S5-F02`, and `S5-F04`–`S5-F07` under
`OD-S5-01` and `OD-S5-02`, plus the final disposition of `S2-F02`, `S2-F03`,
and `S2-F08`. `S5-F03` is explicitly retained.

Exact defaults authority:

```text
effective selected Core
  = exact stored complete account Core override, when that Widget has one
  = otherwise the deployed selected materializer Core defaults

new Widget config
  = exact stored account common defaults
  + effective selected Core
```

The account defaults document continues to store exact account-owned
`fontLibrary`, exact account-owned `common`, and a `widgets` map containing only
explicit per-Widget Core overrides. An absent Widget override explicitly means
the deployed baseline under this approved contract; it is not missing truth,
a fallback, repair, or backfill. Existing complete Widget entries are valid
complete replacements—not partial merge patches—and remain byte-untouched until
an explicit user Save. The first real Core edit clones the exact effective Core
and stores that complete edited override. New accounts start with `widgets: {}`.

Exact product outcome: Catalog remains compact and catalog-wide; New loads one
selected materializer and the account defaults concurrently and writes
nothing; Your Widgets stops prefetching editor artifacts; Widget Defaults shows
one separate common section plus one selected Widget Core, retaining one
editor artifact; and Publish lets Tokyo make the sole commit-time capacity
decision while Roma preserves its distinct fast pre-materialization capacity/
upsell result.

Named authorities and allowed implementation files:

- Widget Defaults UI/host:
  `roma/components/widget-defaults-domain.tsx` and
  `roma/components/widget-defaults-builder-controls.tsx` only if its existing
  host contract needs direct adaptation;
- inventory/editor artifact loading:
  `roma/components/widgets-domain.tsx` and
  `roma/components/widget-editor-artifact.ts`;
- Roma Widget Defaults copy/style:
  `roma/l10n/widget-defaults/en.json` and `roma/app/roma.css` only for the
  selector/layout through existing Dieter tokens/components;
- defaults contract/storage client/composition:
  `roma/lib/account-widget-defaults-{contract,direct,materialization}.ts`;
- `roma/app/api/account/widget-defaults/route.ts` and
  `roma/app/api/session/finish/route.ts`;
- selected New in `roma/lib/builder-open.ts`; the existing Publish route is a
  preserved behavior surface, not an implementation target;
- inventory aggregation consumers:
  `roma/app/api/account/widgets/route.ts` and
  `roma/lib/account-instance-direct.ts` after Slice 6 supplies one account-
  facts response;
- Bob common typography ownership in
  `bob/l10n/editor/typography/en.json` and
  `bob/lib/compiler/modules/typography.ts`;
- only Big Bang's current common-body override in
  `tokyo/product/widgets/big-bang/{spec.json,labels/en.json}`;
- exact selected-Core artifact fields in `bob/lib/types.ts` and
  `scripts/widgets/generate-artifacts.ts`, coordinated with Slice 3;
- `roma/public/widget-editors/*.json` only through the owning producer;
- `roma/package.json` only for the exact new behavior-test commands;
- Roma behavior tests:
  `roma/tests/{run-widget-defaults-typography,run-builder-new-open,run-publish-route}.ts`,
  `roma/tests/{run-widget-defaults-panels,run-widgets-route-cold-path}.mjs`,
  and the surviving behavior portions of
  `roma/tests/{run-instance-save-boundary,run-widget-command-gates}.ts`;
- Bob/Tokyo behavior tests:
  `bob/tests/{run-editor-contract,run-typography-contract}.ts`,
  `tokyo-worker/tests/{run-account-widget-defaults,run-publication-capacity}.ts`;
  and
- current manuals:
  `documentation/architecture/{Overview,AccountManagement}.md`,
  `documentation/widgets/authoring/{WidgetFiles,ToolDrawerControls}.md`, and
  `documentation/services/{bob,roma,tokyo-worker}.md` only where they own the
  changed Defaults/New/Publish behavior.

Prohibited changes: Widget Core software; Widget-owned labels for unique roles;
Dieter component creation; a defaults service/cache/index; separate per-Widget
storage files; silent account backfill; read-time mutation; existing product-
data rewrites; Bob session/edit/Save; public package shape; Prague; DevStudio;
and l10n outside the named owners.

Ordered implementation:

1. Make common typography role wording exclusively Bob-owned. Widget
   `roleLabels` may name only unique Widget roles; the producer enforces that
   boundary. Delete Big Bang's `body` override and its now-unused Widget label.
   Common controls may be rendered from the selected artifact, but their
   meaning no longer varies with the selected Widget.
2. Emit exact Widget-owned Core defaults in each selected editor artifact so
   Widget Defaults consumes the same producer-owned baseline already carried
   by the materializer path used for New and Publish.
3. Change created-account defaults initialization to write exact common/font
   truth with `widgets: {}`. Remove the definition collection and all-Widget
   materializer reads from session finish.
4. Make Widget Defaults GET return the exact stored account defaults document
   plus Tokyo's compact Widget definitions for the selector.
5. Replace the all-Widget `Promise.all`, `compiledWidgets`, and every-Core-host
   state with one selected Widget type, one selected `CompiledWidget`, one
   common host, and one selected Core host. Use Roma's existing
   `DieterDropdownActions` with the existing Widget Defaults heading as its
   accessible label and the exact compact-Catalog display names as options; add
   no explanatory or fragment copy. Initial selection is the first exact
   catalog entry and is browser UI state only, never persisted.
6. On selection, fetch one editor artifact and replace the prior compiled
   artifact in memory. Preserve the account draft across selection. Compose
   the selected effective Core from deployed baseline plus the stored override.
   Merely selecting a Widget creates no stored entry; the first real Core edit
   creates/updates that Widget's explicit override from the edited effective
   Core.
7. Preserve the existing full-document Save, Discard, Save receipt, and
   unsaved-navigation boundary through the same Roma-to-Tokyo defaults route.
8. Change New to load the selected materializer and account defaults
   concurrently. Delete its Tokyo definition collection lookup. Compose exact
   common plus baseline-plus-override Core; retain explicit unknown-Widget
   failure and zero writes.
9. Delete Your Widgets editor-artifact prefetch and then delete the now-
   unconsumed `prefetchWidgetEditorArtifact` helper. Builder still fetches one
   artifact when selected.
10. Preserve Roma's fast Publish account-capacity precheck before source load/
    materialization and Tokyo's final atomic capacity enforcement. Through
    Slice 6A, the Roma precheck consumes one aggregated exact-facts request.
    Prove its current `402` priority over later source/asset/materialization
    failures and preserve the exact upgrade projection.
11. Make `/api/account/widgets` consume Slice 6's one account-facts result.
12. Reconcile only the owning current manuals after all behavior checks pass.

Generated-artifact effect: selected editor artifacts expose their exact
Widget-owned Core baseline. No Widget folder topology, Core software, public
package, or stored instance source changes.

Test/CI effect: change durable behavior tests only. Prove selected artifact
counts, effective defaults, untouched-entry omission, exact common labels, New
no-write, Tokyo `402` projection, and one-request inventory. Add no
source-string or catalog-size runtime gate. Extend the two current Widget
Defaults behavior suites; add exact `roma/tests/run-builder-new-open.ts` and
`roma/tests/run-publish-route.ts` with matching Roma package commands for the
two route boundaries that currently lack executable behavior coverage.

Product-data effect: **none during implementation/deployment**. Existing
defaults objects are not migrated or rewritten. A later explicit Widget
Defaults Save remains the owner operation and writes the approved current
contract. Existing instances and published packages remain unchanged.

Focused verification:

- new-account setup writes no per-Widget snapshots and makes no definition or
  all-materializer read;
- an existing account with no override opens all five current Widgets and a
  fixture later Widget from the deployed baseline;
- existing complete stored entries preserve their exact effective Core;
- Widget Defaults initial load and every selection retain exactly one editor
  artifact and one Core host;
- common wording is identical for every selected Widget;
- selection alone and Save with untouched Widgets create no override entry;
- edited Core, Discard, Save, receipt, and unsaved-navigation behavior;
- New uses the selected materializer, never lists definitions, fails explicitly
  for unknown type, and writes nothing;
- Publish obtains account facts in one request, retains Roma's early `402`
  before materialization, and retains Tokyo's final atomic capacity result;
- one-request inventory/cold-path behavior after Slice 6;
- focused defaults, New, Save, Publish, compiler, cold-path, Roma/Bob/Tokyo
  tests and typechecks;
- all-five generation/check, Roma production build, and `git diff --check`;
  and
- independent V1–V8, especially approved absence semantics versus fallback
  (V1), no read-time insertion/healing (V2/V5), no untouched override omission
  error (V3), and no partial all-five behavior (V6).

Deployment effect when later authorized: Roma verification; Bob and Roma
Git-connected Pages; Tokyo-worker for the coordinated Slice 6 facts contract;
and the existing Prague verification when the Big Bang spec changes. Prague is
an incidental verification surface only and remains excluded from changes and
acceptance. No raw Widget R2 mirror remains after Slice 7.

Post-deploy/runtime evidence, only after separate push/deploy authorization:
reconcile exact GitHub/Pages/Worker SHAs; use an authenticated existing account
to prove Catalog order/copy, Your Widgets with no eager editor-artifact
requests, Widget Defaults with one selected Core/artifact at a time, all five
selection transitions, and New for each current Widget with no source write.
Read exact existing defaults before and after and require byte-identical remote
truth because no Save is performed. Verify the Publish control and Tokyo `402`
mapping with local/route behavior evidence only; do not Publish, Republish, or
modify product data for acceptance.

Stop conditions: composition changes any current effective defaults, a later
Widget still requires account repair, switching selection loses draft work,
common meaning changes by Widget, Publish cannot preserve the exact Tokyo
capacity result, or implementation requires a new service/cache/storage file.

Independent audit of this Slice 5 execution plan: **PASS**. The complete-
replacement defaults contract, selected-Widget interaction, retained Roma
early-402/Tokyo atomic-enforcement boundary, exact tests/deploy surfaces, and
V1–V8 gate are executable.

#### Slice 5 execution record

M05 is **CLOSED**. New-account defaults now store exact common/font truth with
an empty Widget-override map. Effective Core truth is the exact stored complete
override when one exists and otherwise the exact deploy-built selected-Widget
baseline; neither path merges, repairs, or writes during a read. Widget
Defaults preserves one full draft while rendering one Bob-owned common host
and one Widget-type-bound selected Core host from one editor artifact. A real
Core edit creates one complete override; selection and common-only edits do
not. New reads one selected materializer plus exact account defaults and writes
nothing. Your Widgets performs no editor-artifact prefetch. Roma's early
pre-materialization capacity decision and Tokyo's final atomic decision remain
unchanged.

The owning compiler, Roma lifecycle/defaults surfaces, sparse Tokyo defaults
test, generated editor artifacts, focused behavior suites, and the seven named
manuals were reconciled. All-five generation and parity checks, Bob/Roma/Tokyo
focused tests and typechecks, Roma's production build, and `git diff --check`
passed. Two fresh read-only reviews passed, including V1–V8. No account object,
product data, remote configuration, deployment, or other remote state was read
or changed.

### Slice 6 — Tokyo-Worker Storage, Serving, And Exact Handoffs

Status: **CLOSED**

Purpose: keep Tokyo-worker a Widget-neutral physical storage/serving authority
and remove only arguments or interpretation superseded by the current atomic
instance coordinate.

Audit:

1. Trace Widget definitions exposed to Roma.
2. Trace First Save, later Save, Rename, Duplicate, Publish, Unpublish, Delete,
   translation overlays, and public serving coordinates.
3. Trace every Widget identity/code argument into the current account-first
   R2 key functions and stored artifacts.
4. Prove whether a field or argument still owns product/runtime meaning before
   proposing removal.
5. Preserve private binding, signed grant, authz, public host/path,
   publication, upload-byte, R2, and transport boundaries.
6. Verify Tokyo does not compile or reinterpret Widget software.
7. Determine whether any simplification affects existing stored product data;
   if so, stop for owner authorization and a separate exact data plan.

Required output:

- Roma-to-Tokyo command and artifact map;
- storage-coordinate and stored-field consumer map;
- retained boundary list;
- exact superseded parameter/field findings; and
- explicit product-data effect: none, read-compatible, or owner decision.

#### Slice 6 audit record

Tokyo-worker's physical model is already Widget-neutral: one account/instance
coordinate, one atomic editable source, one atomic serve state containing the
complete public package, and exact locale overlay files. It does not compile
Widget source or branch on Widget Core behavior. Public host/path/publication,
private binding, signed grant, upload bytes, R2 existence, transport, source-
revision, and per-account command-coordination boundaries remain.

The stable physical coordinate is exactly:

```text
accounts/{accountPublicId}/instances/{instanceId}/
```

Findings:

| ID | Current flow and evidence | Why it exists | Cost/required preservation | Classification |
| --- | --- | --- | --- | --- |
| S6-F01 | `packages/ck-contracts/src/overlay-codebooks.ts` manually maps the five current Widget names to three-letter codes. Tokyo resolves a code on First Save, stores `widgetCode`, returns it, and threads it through source, serve-state, overlay, delete, translation, and public-serving helpers. `accountInstanceRoot` explicitly ignores the argument; every current key is account + instance only. Reverse-code helpers have no product consumer. | The codebook was introduced for an older overlay/instance coordinate. The account-first coordinate stopped using it immediately afterward, but its field and parameters remained. | Every new Widget currently needs a manual shared-code entry despite no storage/runtime meaning. Removing it changes a stored source field/future write shape, so the owner must approve the exact data disposition. | `OWNER DECISION` |
| S6-F02 | Account inventory returns IDs only; Roma then performs one private HTTP request per ID to obtain list facts. Tokyo already owns every R2 read used to construct those facts. | The ID enumeration and selected list-fact endpoints were separated to keep the original list response light. | `N+1` service requests for one Inventory/Catalog refresh. Preserve exact source-visibility anchoring and facts; aggregate the same reads behind one Tokyo account-facts request without a stored registry/index. | `SIMPLIFY`, paired with S5-F04 |
| S6-F03 | Atomic `instance.source.json` stores required top-level `widgetType` and an unconsumed duplicate `content.widgetType`. Active source uses the top-level value and the selected editable contract; no current reader consumes the nested duplicate. | `content` was formerly its own document and was embedded unchanged when source became atomic. | Preserve top-level `widgetType` and every real content coordinate. Removing the duplicate changes future/stored source shape and therefore shares the explicit data decision below. | `OWNER DECISION` |

Retained storage/serving work:

| Item | Disposition | Reason |
| --- | --- | --- |
| `instance.source.json`, `serve-state.json`, and exact overlay files | `KEEP — OWNER` | They are the current atomic source, publication/package, and locale truths. |
| Source object as inventory/public visibility anchor | `KEEP — OWNER` | Delete commits by removing it; residual serve state/overlays are unreachable and cannot become public. |
| Per-account Durable Object coordination | `KEEP — BOUNDARY` | It serializes existing-instance commands and source-revision/capacity commit facts without creating persistent product truth. |
| Tokyo publish-time count using Roma's exact limit | `KEEP — OWNER` | It is the commit-time decision over current physical publication facts. Slice 5 retains Roma's distinct fast pre-materialization policy check; Slice 6A only reduces that check's facts acquisition to one request. |
| Account/instance/type/base-locale/timestamps in the logical source | `KEEP — OWNER` | They describe the complete saved instance and have current Save, open, materialize, translation, and serving consumers. |
| Source read before serving `styles.css`/`runtime.js` | `KEEP — OWNER` | It is the visibility anchor that prevents asynchronously cleaned residual serve state from being served after Delete. |
| Cache-tag eviction, residual cleanup, and bounded cache freshness | `KEEP — OWNER` | Product truth completes before product-inert cleanup/eviction; removing it would change live serving behavior. |

The audit rejects a publication counter object, catalog database, migration-on-
read, compatibility key, cache registry, or stored facts index. Tokyo can
aggregate existing exact R2 reads for `S6-F02` without creating new truth.

#### Slice 6 owner decision OD-S6-01 — APPROVED

Delete the obsolete `widgetCode` codebook/field/response/helper chain and omit
the duplicate nested `content.widgetType` from future source writes. Required
top-level `widgetType` remains the sole stored Widget software identity.
Existing inert JSON members remain untouched in existing source objects; no
product-data rewrite, migration-on-read, compatibility reader, or silent
healing is added. An ordinary later Save writes the then-current exact source
contract because Save is already the owning user operation.

#### Slice 6 execution plan

Approved findings: `S6-F01`–`S6-F03` under `OD-S6-01`, plus the final
disposition of `S2-F05`, `S2-F06`, and `S2-F09`.

Exact outcome: Roma loads an account's exact instance facts through one
account-scoped Tokyo request; every physical key remains byte-identical;
top-level `widgetType` remains the sole stored Widget software identity; and
the obsolete codebook, `widgetCode` chain, and nested `content.widgetType`
future-write duplicate are deleted without touching existing account objects.

This plan has two ordered implementation phases because Slice 5
consumes the aggregate facts route:

1. Slice 6A adds account-facts aggregation and switches Roma to it.
2. Slice 5 consumes that route and completes Defaults/New/Publish.
3. Slice 6B removes obsolete identity/source fields after all final consumers
   are settled.

#### Slice 6A — one account-facts handoff

Add the existing-authority route:

```text
GET /__internal/accounts/{accountPublicId}/instances/list-facts
```

Tokyo lists the existing source visibility anchors, reads the same current
source pointers internally, constructs and sorts the same exact facts, and
returns them once. It creates no stored index, summary, counter, registry, or
cache. One failed/corrupt source read fails the complete facts operation; Tokyo
does not filter, omit, or turn that record into absence. Keep the IDs-only
account route for locale/account operations that need
only IDs and keep the selected `/{instanceId}/list-facts` route for Save and
Copilot. Roma's `loadAccountWidgetInstanceFacts` becomes one Tokyo call.

#### Slice 6A execution record

M04 is **CLOSED**. Tokyo-worker now returns the complete exact account-instance
facts through the one account-scoped route above, and Roma consumes that result
with one internal request. The narrower IDs-only and selected-instance paths,
source visibility anchor, exact sort, whole-operation failure behavior, Roma's
early publication-capacity decision, and Tokyo's final atomic capacity decision
remain intact. Focused Tokyo and Roma behavior tests, both typechecks, the
Tokyo Worker dry-run, and `git diff --check` passed. A fresh read-only V1–V8
audit passed. No product data or remote state was read or changed.

#### Slice 6B — read-compatible identity cleanup

1. Remove `widgetCode` from key/helper signatures while proving every exact R2
   key remains `accounts/{account}/instances/{instance}/...`.
2. Remove it from source/pointer/types, route responses, serve-state/overlay/
   translation/delete/transition/public call chains, and First-Save derivation.
3. Delete the forward codebook, its package export, and its barrel export after
   the Slice 2 reverse helpers and every live forward consumer are gone.
4. Keep required top-level `widgetType` in the source row and every semantic
   identity-key calculation.
5. Remove only the duplicate nested `content.widgetType` from Roma's source
   producer and Tokyo's content type. Future First Save, later Save, Duplicate,
   and Rename write the exact new source shape.
6. Existing stored extra JSON members remain unreferenced and untouched until
   an ordinary explicit owner operation rewrites that source. Readers continue
   consuming their current typed fields; add no compatibility reader,
   migration, cleanup job, or healing branch.

Named authorities and allowed implementation files:

- contract export cleanup:
  `packages/ck-contracts/package.json`, `packages/ck-contracts/src/index.ts`,
  `packages/ck-contracts/src/overlay-identity.ts`, and deletion of
  `packages/ck-contracts/src/overlay-codebooks.ts`;
- Roma exact facts/source clients and producer:
  `roma/lib/account-instance-direct.ts` and
  `roma/lib/account-instance-source-artifacts.ts`;
- exact Roma route consumers that directly change:
  `roma/app/api/account/instances/[instanceId]/duplicate/route.ts` and
  `roma/app/api/account/widgets/route.ts`;
- Tokyo instance authority:
  `tokyo-worker/src/domains/account-instances/{keys,types,source,serve-state,delete,operations}.ts`;
- Tokyo overlay/translation authority:
  `tokyo-worker/src/domains/account-translations/{overlays,values}.ts`;
- Tokyo routes:
  `tokyo-worker/src/routes/{internal-instance-routes,clk-live-routes}.ts`;
- exact facts-route test `tokyo-worker/tests/run-account-instance-facts.ts`,
  its `test:instance-facts` command in `tokyo-worker/package.json`,
  `roma/tests/run-widgets-route-cold-path.mjs`, and exact identity/serving
  fixtures in
  `roma/tests/{run-instance-save-boundary,run-translation-outcomes}.ts` and
  `tokyo-worker/tests/{run-publication-capacity,run-content-slot-overlays,run-cache-eviction}.ts`;
  and
- current manuals:
  `documentation/architecture/{Overview,AccountManagement,OverlayArchitecture}.md`,
  `documentation/capabilities/localization.md`, and
  `documentation/services/{roma,tokyo-worker,tokyo}.md` only where they own
  account facts, source identity, overlays, or serving.

If implementation search finds another live `widgetCode` call in the same
proved chain, it may enter the allowed set only after the primary records its
exact consumer role in the slice evidence. An unrelated file is a stop, not
implicit scope.

Prohibited changes: physical account keys; public URLs; package bytes; overlay
coordinates/values; top-level `widgetType`; source visibility anchoring;
authorization; timestamps; cache eviction; deletion semantics; publication
state/capacity; account data; migration/cleanup scripts; a stored facts index;
Prague; DevStudio; and CI/deploy rewiring.

Generated-artifact effect: none beyond the already coordinated compact
definition/artifact contracts in Slices 2–3. Test/CI effect: update behavior
fixtures for the exact current source type and one-request facts route; add no
legacy-shape reader test or source-text compliance gate. Add exact
`tokyo-worker/tests/run-account-instance-facts.ts` and package command
`test:instance-facts`; Roma's existing cold-path behavior test proves the one
cross-service request.

Product-data effect: **none**. No remote object is read-modify-written by this
implementation or deployment. Old extra members remain inert. A later ordinary
Save is a user-authorized source replacement, not migration machinery.

Focused verification:

- account facts return the same deterministic facts through one Roma-to-Tokyo
  request; IDs-only and selected-fact consumers retain their smaller paths;
- no runtime `widgetCode`, codebook export, reverse map, or First-Save
  derivation remains;
- no new instance content writes nested `widgetType`, while top-level
  `widgetType` and stable editable-field identity keys remain exact;
- byte-identical before/after keys for source, serve state, and overlays;
- First Save, later Save, Duplicate, Rename, Delete, Publish, Unpublish,
  translation, public serve, and locale overlay behavior;
- source anchoring, cache eviction, publication capacity, corruption failure,
  and command coordination behavior;
- `@clickeen/ck-contracts`, Tokyo-worker, and Roma typechecks plus focused
  account-facts/cold-path/Save/Copilot/translation tests;
- Tokyo-worker bundle measurement, `git diff --check`, and independent V1–V8,
  especially no key/default substitution (V1), no legacy rewrite (V2/V5), no
  omitted source/overlay behavior (V3/V6), and no compatibility wrapper (V7).

Deployment effect when later authorized: Roma verification; Bob and Roma
Git-connected Pages through their shared package dependencies; and the current
Worker deployment set affected by `packages/ck-contracts/**`—Berlin, Product
Copilot, Translation Agent, San Francisco, and Tokyo-worker. Only Roma and
Tokyo-worker are product acceptance owners for this slice; the other Workers
receive the shared-contract deploy and must remain healthy. No Prague or raw
Widget R2 change belongs to this slice.

Post-deploy/runtime evidence, only after separate push/deploy authorization:
reconcile the exact GitHub, Pages, and five Worker SHAs; require health from all
deployed Workers; use one authenticated existing account to prove Inventory and
Catalog return the same exact facts through one Roma-to-Tokyo request; and read
existing base and locale public URLs to prove source visibility, package, and
overlay coordinates remain unchanged. Compare exact source/default object
bytes before and after and require no remote writes. Do not Save, Duplicate,
Rename, Delete, Publish, Unpublish, or generate a translation for this proof.

Stop conditions: any exact physical key changes, a real runtime consumer of
`widgetCode` or nested `content.widgetType` is proved, an existing source object
must be rewritten to operate, aggregation requires new stored truth, or public/
overlay/package behavior changes.

Independent audit of this Slice 6 execution plan: **PASS**. The ordered 6A/5/
6B dependency, whole-operation facts failure, exact inert-field cleanup,
unchanged keys/data, tests/deploy surfaces, and V1–V8 gate are executable.

#### Slice 6B execution record

M06 is **CLOSED**. The obsolete Widget-code codebook, package exports, stored
field, response field, helper parameters, and source/serve/overlay/translation/
delete/public call chain are deleted. Required top-level `widgetType` remains
the sole stored Widget software identity. First Save, later Save, Duplicate,
and Rename write the current source shape without a duplicate nested
`content.widgetType`; existing older extra JSON bytes remain untouched until an
explicit owning source operation replaces that object. No compatibility
reader, migration, repair, registry, or alternate identity was added.

All physical source, serve-state, overlay, overlay-prefix, and cache-tag keys
remain byte-identical. Focused account-facts, First/later Save, Rename,
publication/capacity, Delete/source-anchor, public package, overlay,
translation, cache, Roma command, and Widget-definition behavior checks passed,
as did contracts/Tokyo/Roma typechecks, the Tokyo Worker dry-run, exact source
searches, and `git diff --check`. Three fresh read-only reviews passed,
including V1–V8. No account object, product data, deployment, managed
configuration, or other remote state was read or changed.

### Slice 7 — Build, Validation, CI, Deploy, And Performance

Status: **FROZEN**

Purpose: make source production, validation, build, CI, and deployment truthful,
non-redundant, and understandable to agents.

Audit:

1. Expand root, package, Turbo, Pages, Worker, and R2-sync command graphs.
2. Count every Widget generation and validation invocation for lint,
   typecheck, build, Pages build, Worker deploy, and product-root sync.
3. Identify commands named as checks that mutate generated state.
4. Identify workflow commands that refer to absent scripts or otherwise run no
   real check.
5. Identify duplicated test coverage, source-text compliance tests, temporary
   probes, or historical gates without a current behavior boundary.
6. Record generator time, build time, bundle sizes, artifact bytes, and deploy
   inputs on the current five-Widget baseline.
7. Identify which costs legitimately scale with the catalog once and which are
   accidental repetition.
8. Trace git-authored Widget software into the one documented R2 sync and
   Pages/Worker deploy paths.
9. Preserve required deploy preflights and owning-surface evidence.

Required output:

- command DAG;
- generation/check/build invocation count;
- current performance and bundle baseline;
- truthful-check versus mutation table;
- keep/delete/simplify CI and test findings; and
- exact deploy effects for every proposed change.

#### Slice 7 audit record

Current command DAG, with `W` equal to the Widget count:

| Command/path | Full-catalog artifact passes | Pair compilations |
| --- | ---: | ---: |
| `generate:widgets` | one write | `W` |
| `validate:widgets` | one write plus one check | `2W` |
| root lint | validation | `2W` |
| root typecheck | validation plus Roma `pretypecheck` | `3W` |
| root build | validation plus Roma `prebuild` | `3W` |
| Bob `build:cf` | none | `0` |
| Roma `build` | Roma `prebuild` | `W` |
| Roma `build:cf` | explicit write plus Vercel-triggered `prebuild` | `2W` |
| Roma GitHub verification | lint + typecheck + Roma build | `7W` |
| Worker/R2 workflow | lint + typecheck | `5W` |
| PR architecture gates | lint + typecheck | `5W` |
| Git-connected Roma Pages | Roma `build:cf` | `2W` |

A Widget-source commit therefore performs `14W`, or 70 pair compilations at
the current five Widgets, across Roma verification, Worker verification, and
Git-connected Roma Pages. The legitimate work is `O(W)` once at each actual
check or production boundary; the multiplication is accidental.

Measured current evidence:

| Evidence | Current result |
| --- | --- |
| One all-five artifact pass | approximately 0.56–0.62 seconds in CI logs |
| Roma verification run `32538724634` | 3m05s: lint 9s, typecheck 33s, Bob build 39s, Roma build 61s |
| Worker/R2 run `32536867513` | 10m45s; R2 sync alone 9m07s |
| R2 deploy input | 588 files / 2,026,760 bytes: 68 Widget, 165 Dieter icons, 7 fonts, 348 Prague |
| Live Pages build scope | Bob and Roma both use `path_includes: ["*"]` |
| Roma-only commit `dd8fe00e` | Roma and Bob both rebuilt/deployed; Bob queue-to-deploy 5m38.7s, Roma 3m29.2s |
| Historical shared modules | all eight remain live in R2 and the friendly route serves them |

Findings:

| ID | Current/reachable evidence | Smallest correction and preservation | Classification |
| --- | --- | --- | --- |
| S7-F01 | `validate:widgets` checks the tracked definition source, writes every ignored editor/materializer artifact, then checks the files it just wrote. Root lint/typecheck/build inherit it; Roma adds lifecycle writers. Exact logs show “wrote 5” immediately before “verified 5.” The ignored outputs do not exist in a clean checkout, so the current disk-comparison `--check` cannot become truthful merely by deleting the preceding writer. | Make the producer's check mode compile the complete derived artifacts in memory without writing or comparing ignored build output; compare only tracked generated source. Remove validation from generic lint/typecheck/build. Keep Roma `pretypecheck` and `prebuild` as the one necessary production pass for their direct clean-checkout commands; delete the unrelated `pretest:widget-defaults-typography` and the extra writer in `build-roma-cf`. Roma verification becomes `2W`; Git-connected Roma Pages `W`; a normal Widget software push becomes `3W`; a compact-definition change also triggers the Worker `W`, for `4W`. A PR adds its separate applicable `W` proof. Coordinate tracked compact output with Slice 3. | `SIMPLIFY` |
| S7-F02 | Worker CI invokes Roma `test:ui-copy`, but no such package script exists. Filtered pnpm prints that fact and exits successfully. | Delete the absent command and name the step for its one real contract. Do not invent a replacement test. | `DELETE — PROVEN DEAD` |
| S7-F03 | The R2 script walks all four roots and starts one Wrangler PUT process for every object. Ten changed Widget files caused 588 PUTs; a Dieter button file outside the mapped icon root also caused 588 PUTs. Source deletions never delete remote objects. | Preserve exact mappings/MIME/root/account protections and retries. For normal pushes to retained in-scope Dieter-icon/font roots, feed the existing `before..after` diff to the same script, PUT only added/modified mapped files, and DELETE only exact removed mapped keys. Keep full sync for explicit dispatch/script changes; narrow Dieter detection to `dieter/icons/svg/**`; remove Widget/build scripts from R2 detection. Prague is excluded: its mapping, triggers, full-sync behavior, and remote objects do not change, and delta/delete never operates on Prague keys. Because `OD-S7-02` removes the Widget mapping entirely, all current raw `product/widgets/**` objects are reconciled once as a separately authorized exact-key managed-service operation, not through retained-root delta mode. | `SIMPLIFY` |
| S7-F04 | Root lock/workspace/package paths can trigger the Worker workflow, but current changed-surface detection maps them to no Worker, so the workflow checks everything and deploys nothing while later reachability verifies the old deployment. | Treat lock/workspace dependency-graph changes as affecting Worker bundles but not R2. Remove root `package.json` as a Worker deploy trigger when it changes only root tooling. Keep existing surface detection and secret boundaries. | `SIMPLIFY` |
| S7-F05 | Active suites contain source-string/absence assertions rather than behavior: most of Roma `run-instance-save-boundary`, parts of runtime-materializer, Bob Save, Roma Builder Save, Tokyo cache/publication tests, and almost all of Roma `run-widget-command-gates`. Dormant source-only Copilot/asset/command gate scripts remain in package scripts. | Delete source-shape assertions and dormant compliance files/scripts; keep, rename, or relocate the real transport, materializer, Save, cache, publication, Playwright, and public-action behavior assertions. Do not change the separate DevStudio guard in this Widget pass. | `DELETE/SIMPLIFY` |
| S7-F06 | Workflow patterns `scripts/verify/**` and `tokyo/product/themes/**` point to no current tracked files. | Delete the dead path declarations. | `DELETE — PROVEN DEAD` |
| S7-F07 | Raw git-authored Widget source is uploaded to `product/widgets/**` and served through `/widgets/**`. Current active-source tracing finds no Bob, Roma, Save, Publish, public-package, or visitor consumer; the only repository read of the deployed FAQ spec is the R2 preflight. Current manuals nevertheless call this the deployed Widget software authority. | This is a named product/storage authority choice, not an inferred deletion. If retained, incremental sync still applies. If removed, keep git source and generated artifacts as authorities, remove only the raw Widget R2 mapping/friendly route/preflight dependency, and reconcile the storage manuals. | `OWNER DECISION` |

Required keeps:

- `generate:widgets` as the explicit mutating producer and a check mode that
  proves producibility in memory without creating ignored output;
- Roma `pretypecheck` and `prebuild` as the single production invocation for
  each direct clean-checkout command; Roma `build:cf` adds no second writer;
- Git-connected Cloudflare Pages and GitHub Worker deployment;
- exact changed-surface selection and Worker secret preflights;
- R2 canonical-root/MIME/account refusal/retry rules for every retained root;
- `tokyo:r2:sync:check` as a truthful read-only command;
- runtime reachability and optional Playwright owning-surface evidence; and
- Prague and DevStudio internals outside this slice.

The PR architecture source-text guards that mention retired local runtime and
DevStudio are recorded for their own authority; this Widget program does not
use their presence as permission to change DevStudio.

#### Slice 7 owner decision OD-S7-01 — APPROVED

Use stable dependency-wide include sets. Bob watches `bob/**`, `dieter/**`,
`packages/**`, its build script, root `package.json`, `tsconfig.app-base.json`,
and root workspace/lock inputs. Roma watches
`roma/**`, `bob/**`, `dieter/**`, `packages/**`,
`tokyo/product/widgets/**`, Widget/build scripts, and root workspace/lock
inputs including root `package.json` and `tsconfig.app-base.json`. The same
dependency classification conditionally skips the Bob
contract build in Roma verification when no Bob/shared input changed.
Cloudflare Git integration remains the only Pages deployment authority. The
managed configuration change must use a preflight-gated repeatable command and
exact read-back.

#### Slice 7 owner decision OD-S7-02 — APPROVED

Remove the raw deployed `product/widgets/**` mirror, its `/widgets/**` friendly
route, and the FAQ-spec preflight dependency. Git Widget folders remain the
authoring source; generated Roma/Bob/Tokyo artifacts remain deploy-built
inputs; and Tokyo account serve state remains public runtime truth. The later
authorized deployment must remove the exact remote prefix and prove it absent.
Prague remains excluded and unchanged.

#### Slice 7 execution plan

Approved findings: `S7-F01`–`S7-F07` under `OD-S7-01` and `OD-S7-02`.

Exact command outcome:

| Boundary | Frozen result |
| --- | --- |
| `pnpm generate:widgets` | One unified producer invocation writes editor/materializer outputs and tracked compact Tokyo definitions. |
| `pnpm validate:widgets` | The same producer compiles complete outputs in memory, writes/deletes nothing, does not require ignored output, and compares only tracked generated source. |
| Focused Widget check | `node scripts/widgets/generate-artifacts.mjs --widget <type> --check` compiles only that Widget in memory. |
| Root lint | `turbo lint`; `0W`. |
| Root typecheck | `turbo typecheck`; Roma `pretypecheck` supplies its one required `W` production pass. |
| Root build | l10n plus Turbo build; Roma `prebuild` supplies its one required `W` production pass. |
| Roma `build:cf` | No explicit preliminary writer; Vercel-triggered Roma `prebuild` supplies exactly `W`. |
| Roma verification | lint `0W` + typecheck `W` + Roma build `W` = `2W`. |
| Worker/PR verification | one applicable typecheck/producer pass = `W`. |
| Roma Pages | one Roma build = `W`. |

A normal Widget software main push therefore performs `3W` across Roma
verification and Roma Pages. A compact-definition change also changes tracked
Tokyo source and adds the Worker `W`, for `4W`. A PR has its own separate
applicable `W` proof. The current `14W` multiplication is removed.

Named authorities and allowed implementation files:

- root/package command DAG: `package.json`, `roma/package.json`, and
  `scripts/build-roma-cf.mjs`;
- unified producer/check behavior in `scripts/widgets/generate-artifacts.*`;
- `.github/workflows/cloud-dev-{roma-app,workers}.yml`;
- retained-root sync in `scripts/tokyo-r2-deploy-sync.mjs`;
- raw mirror route/mapping removal in
  `tokyo-worker/src/asset-utils.ts` and `tokyo-worker/wrangler.toml`;
- R2 preflight removal in `scripts/cloudflare/r2.mjs`;
- a Bob/Roma-only Pages build-watch command in
  `scripts/cloudflare/api.mjs` and its root package command;
- the exact source-only/mixed test files and package-script entries listed
  below; and
- owning current manuals through Slice 8 after shipped behavior is known.

Prohibited changes: `.github/workflows/cloud-dev-prague-app.yml`; Prague sync
mapping, triggers, full-sync behavior, remote keys, application, or manuals;
DevStudio code/workflows/guards/config/manuals; Git-connected Pages deployment
authority; Worker secrets/grants; R2 bucket/root/account protections; account
data; runtime probes; a generated audit report; or a replacement source-text
compliance suite.

##### Slice 7A — truthful producer and command graph

1. Make unified producer check mode compile complete selected/all-Widget
   outputs in memory without writing or comparing ignored artifacts; compare
   only its tracked compact Tokyo source. Preserve explicit mutating generation
   and focused/all modes.
2. Remove `validate:widgets` prefixes from root lint/typecheck/build. Keep root
   `validate:widgets` as the explicit non-writing producer-completeness command.
3. Keep Roma `pretypecheck` and `prebuild`. Delete
   `pretest:widget-defaults-typography` and the extra generator call in
   `scripts/build-roma-cf.mjs`.
4. Delete the successful no-op Worker invocation of nonexistent Roma
   `test:ui-copy`; do not invent a replacement.

##### Slice 7B — GitHub and Pages dependency truth

Update Roma verification inputs to retain Roma, Bob, Dieter, packages, Widget
source, Widget/build scripts, current app build scripts, root `package.json`,
workspace/lock, `tsconfig.app-base.json`, and its workflow; remove dead
`tokyo/product/themes/**` and `scripts/verify/**`. Condition only the Bob Pages
contract build on the exact Bob/shared dependency set; do not infer other
conditional test deletion.

Final Cloudflare Pages `path_includes` are:

```text
Bob
  bob/**
  dieter/**
  packages/**
  scripts/build-bob-cf.mjs
  package.json
  pnpm-lock.yaml
  pnpm-workspace.yaml
  tsconfig.app-base.json

Roma
  roma/**
  bob/**
  dieter/**
  packages/**
  tokyo/product/widgets/**
  scripts/widgets/**
  scripts/build-roma-cf.mjs
  package.json
  pnpm-lock.yaml
  pnpm-workspace.yaml
  tsconfig.app-base.json
```

Add exact command `cf:pages:sync-bob-roma-build-watch` to the existing
Cloudflare API operator:

- dry-run by default and require `--apply` for mutation;
- hard-limit targets to the current Bob and Roma Pages project names;
- patch only `source.config.path_includes`;
- preserve repository owner/name, branch, build config, excludes,
  environments, bindings, secrets, and domains;
- read back both projects and fail unless the exact arrays match; and
- never accept or modify Prague or DevStudio.

Cloudflare Git integration remains the only Pages deploy authority. Local code
implementation does not apply this managed configuration.

##### Slice 7C — Worker and retained R2 roots

In the Worker workflow:

- remove raw `tokyo/product/widgets/**`, dead `tokyo/product/themes/**`, dead
  `scripts/verify/**`, and `scripts/widgets/**` triggers;
- narrow Dieter R2 triggering to `dieter/icons/svg/**`;
- retain font, Prague, Worker/package-owner, sync-script, workspace/lock,
  `tsconfig.app-base.json`, and workflow inputs;
- remove root `package.json` as a Worker trigger;
- treat workspace/lock/tsconfig changes as Worker bundle inputs, not R2; and
- keep workflow dispatch deploying all Workers and running the existing full
  retained-root R2 sync, with every current secret/grant preflight intact.

Remove `tokyo/product/widgets -> product/widgets` from the sync map, remove the
Tokyo `/widgets/** -> product/widgets/**` friendly mapping/route, and remove
the FAQ R2 preflight read. Retain credential, bucket/list, canonical-root,
account refusal, MIME, retry, and failure behavior.

For ordinary Dieter-icon/font pushes, feed the exact `before..after` diff to
the same sync owner: PUT added/modified/new-rename targets and DELETE exact
deleted/old-rename keys. A failed PUT or DELETE fails the workflow. Prague
changes retain their current trigger and full-sync behavior. Workflow dispatch
or sync-script changes perform full retained-root sync. Delta/delete must never
operate on Prague keys. `tokyo:r2:sync:check` remains read-only and reports the
retained roots.

The existing raw remote `product/widgets/**` prefix is a separate later
managed-service operation:

1. freeze the exact current key list (baseline: 68 keys);
2. deploy and verify the mapping/route removal so `/widgets/**` is absent/404;
3. obtain explicit managed-service authorization;
4. delete each exact frozen key through the existing R2 owner command—never a
   broad prefix delete or unresolved glob;
5. re-list and require zero `product/widgets/**` keys; and
6. prove Dieter/font/Prague inventories equal their frozen expected state and
   `accounts/**` was never targeted.

##### Slice 7D — behavior-test preservation and noise deletion

Delete wholly source-only Roma suites
`roma/tests/run-copilot-route-gates.ts` and
`roma/tests/run-account-asset-gates.ts` and their package scripts. In mixed
suites, delete only prose/source/absence assertions and retain real behavior:

- `run-instance-save-boundary`: retain real Tokyo transport/failure behavior;
- `run-widget-command-gates`: retain `buildWidgetPublicActions` behavior;
- Roma Builder Save: retain phase admission/browser harness, delete production-
  source/config regex assertions;
- Bob Save: retain actual state transitions, origin/source admission, and
  initial state, delete production-source/CSS regex assertions;
- runtime materializer: retain materialization, delete only forbidden-import
  source scanning;
- Tokyo cache: retain scheduling/failure isolation, delete route/workflow
  source assertions; and
- Tokyo publication: retain MemoryR2, coordination, atomicity, source revision,
  capacity, corruption, and Delete behavior; delete trailing source-text
  assertions.

Rename a surviving test command only when necessary to state its actual
behavior. Add no architecture-text replacement test. Preserve the separate
DevStudio guard unchanged.

Generated-artifact effect: no new artifact. Slice 7 changes when/where the
settled Slice 1–6 producer runs; it does not change semantic artifact content.

Product-data effect: **none**. Local code/CI changes, Pages config mutation,
Git-connected deploy, and exact R2 deletion are separate authorization stages.

Focused/final verification:

- focused changed-Widget checks and one aggregate `pnpm validate:widgets`;
- byte/content worktree snapshot before/after final validation proving no
  write or deletion;
- root lint/typecheck/build and Bob/Roma lint/typecheck/build contracts;
- every surviving Bob/Roma/Tokyo/materializer behavior suite;
- Worker and Widget Foundation typechecks;
- retained-root full dry-run plus delta add/modify/delete/rename/failure tests;
- every non-deploy workflow command exists and runs;
- before/after producer invocation counts and build times;
- dry-run Pages configuration diff; after separate authorization, exact
  read-back of both projects;
- after separate deployment authorization, exact GitHub/Pages/Worker SHA and
  owning live-route evidence;
- after separate R2 authorization, exact 68-key inventory/delete/zero/readback
  and retained-root reconciliation;
- `git diff --check`; and
- independent V1–V8, especially complete dependency watches/behavior coverage
  (V3), retained auth/root guards (V4), full-operation failure (V6), no renamed
  producer/mirror/source gate (V7), and no runtime check dependency (V8).

Stop conditions: validation cannot stay non-writing from a clean checkout;
direct app dependencies fall outside the include sets; a behavior assertion
cannot be separated from source prose; Prague or DevStudio must change; R2
delta needs a broad key operation; any `accounts/**` target appears; or a
workflow can report success after a partial producer/deploy/sync result.

Independent audit of this Slice 7 execution plan: **PASS**. The truthful
producer DAG, exact Pages dependency sets, retained-root delta boundary,
separate 68-key managed-service operation, behavior-test preservation, Prague/
DevStudio exclusions, and V1–V8 gate are executable.

Independent evidence audit: **PASS.** The audit record, scope boundary,
measured command/deploy evidence, owner decisions, and V1–V8 classification
have no remaining blocker. This is not an execution-plan audit and does not
authorize implementation.

### Slice 8 — Documentation, AI Operability, And Final Architecture

Status: **FROZEN**

The audit is complete and every owner decision is approved. This plan executes
last, against the settled implementation truth from Slices 1–7.

Purpose: reconcile one real lifecycle that an agent can operate without
historical exceptions or contradictory manuals.

Audit:

1. Compare current manuals with the proved runtime and build paths from Slices
   0–7.
2. Identify historical files, modules, checks, commands, and product paths
   described as current.
3. Identify current paths that remain undocumented or documented in more than
   one contradictory way.
4. Test whether a fresh agent can answer: where a Widget lives, how it is
   discovered, how one artifact is produced, how Bob opens it, how Roma saves
   and publishes it, how Tokyo stores/serves it, how to verify it, and how to
   deploy it.
5. Confirm that the final plan creates no runtime registry, compatibility path,
   validation ritual, or permanent audit machinery.
6. Produce the documentation and operability reconciliation input that will be
   used in the final implementation manifest after Slice 8 itself is frozen.

Required output:

- documentation mismatch ledger;
- final target lifecycle;
- one operator command/deploy map;
- manifest-ready documentation and operability reconciliation input;
- final no-scope-expansion audit; and
- owner approval gate for code execution.

#### Slice 8 audit record

Documentation mismatch ledger:

| ID | Current/reachable mismatch | Disposition |
| --- | --- | --- |
| S8-F01 | Root `documentation/README.md` says Bob reads Widget definitions/assets from Tokyo. Bob actually receives Roma's same-origin deploy-built `/widget-editors/{widgetType}.json`; Tokyo supplies shared Dieter/font resources, storage, and serving. | `SIMPLIFY`: correct the root product journey and keep Prague/DevStudio out of this lifecycle explanation. |
| S8-F02 | Tokyo-worker calls the definitions endpoint “list/read,” but only the collection list exists. | `SIMPLIFY` to the final compact Catalog collection; no selected Tokyo definition route exists. |
| S8-F03 | New/defaults manuals do not name the later-Widget gap for existing accounts. | `SIMPLIFY` under approved `OD-S5-02`: document deployed baseline plus explicit account overrides only after implementation. |
| S8-F04 | Roma's Widget Defaults description omits that it loads every artifact and takes common wording from the arbitrary first Widget. | `SIMPLIFY` under approved `OD-S5-01`: document one selected Core and Bob-owned common wording only after implementation. |
| S8-F05 | Manuals describe one main Widget producer while root generation invokes two independent discovery/generation paths. | `SIMPLIFY` with S2/S3; do not document a producer scheduled for deletion as target architecture. |
| S8-F06 | `pnpm validate:widgets` is documented as verification although it writes ignored artifacts before checking them; root lint/typecheck/build repeat it. | `SIMPLIFY` with Slice 7: one explicitly mutating producer and a genuinely read-only in-memory producer check. |
| S8-F07 | Big Bang, Cards, Countdown, and Logo Showcase manuals run catalog-wide validation for one-Widget work; FAQ already documents the focused mode. | `SIMPLIFY`: one-Widget work uses the focused producer/check; aggregate work intentionally checks all Widgets once. |
| S8-F08 | Worker CI invokes nonexistent Roma `test:ui-copy`. | `DELETE — PROVEN DEAD` with S7-F02. |
| S8-F09 | Translation Agent smoke silently falls from an optional environment-selected instance to one hardcoded instance, then Big Bang, then the first account instance, despite mutating overlay truth. | `SIMPLIFY`: require one explicit exact instance coordinate and never redirect the operation to unrelated product data. |
| S8-F10 | Current manuals repeat execution history: SHAs, dates, cutover inventories, one-off instance IDs/counts, agent-closure, and owner-acceptance narratives. | `DELETE — SUPERSEDED` from current manuals; history remains in `Execution_Pipeline_Docs/`, while concise current laws such as “no compatibility reader” remain. |
| S8-F11 | Manuals accurately describe current `coreCss/coreJs`, normalization, Publish precheck, split list-facts, `widgetCode`, Pages/R2 sync, and defaults behavior. Their final dispositions are now frozen, including preservation of the Publish precheck. | Change each statement only with its corresponding implemented and verified disposition; never present the planned target as shipped truth. |
| S8-F12 | The root/Widget/Cloudflare manuals describe the upload-only R2 product mirror, so local historical-module deletion alone would leave deployed truth. | Reconcile only through the approved S7-F03/S7-F07 deployment result and exact remote evidence. |

The two PR architecture absence gates that mention retired local runtime and
DevStudio are historical source-text checks, but DevStudio is explicitly
outside this program. They are routed to that separate authority and are not
an implementation entry here.

Target lifecycle, conditional only on the frozen owner decisions:

```text
one Widget folder
  -> one source producer
     -> one selected Roma/Bob editor artifact
     -> one selected Roma materializer artifact
     -> one compact Tokyo catalog definition

Catalog
  -> compact summaries only

New
  -> selected Widget + exact effective defaults
  -> unsaved Bob browser-memory draft
  -> no storage write

Bob
  -> selected compiled contract + current draft
  -> edit and preview only

Save
  -> Roma applies the selected contract
  -> Tokyo atomically stores instance.source.json

Publish
  -> Roma loads the selected materializer
  -> complete index.html/styles.css/runtime.js
  -> Tokyo atomically stores serve-state.json

Serve
  -> Tokyo serves the selected stored package or exact locale overlay
  -> no catalog, source generation, rebuilding, or validation
```

The exact effective-defaults authority and Widget Defaults interaction are the
approved Slice 5 contracts; this target text is not current manual truth until
that code passes its frozen plan.

Target operator map:

| Operation | Required target |
| --- | --- |
| Explicit artifact production | `pnpm generate:widgets`: one mutating unified producer invocation. |
| Focused one-Widget proof | `node scripts/widgets/generate-artifacts.mjs --widget <type> --check`: one non-writing in-memory pass. |
| Aggregate Widget proof | `pnpm validate:widgets`: one genuinely read-only all-Widget producer-completeness pass. |
| Lint/typecheck/build | No validation writer hidden in lint; each direct command generates only the build input it actually requires once. |
| Pages deployment | Git-connected `main` remains the only authority, with the owner-approved build scope. |
| Worker/R2 deployment | `cloud-dev workers deploy`, exact changed surfaces, exact retained-root writes/deletes, and owning read-back. |
| Runtime proof | Focused behavior tests plus exact deployed Roma/Bob/Tokyo/public evidence; no source-text compliance ritual. |
| Translation smoke | One required explicit saved-instance coordinate; no instance fallback. |

Manual reconciliation ownership after dispositions freeze:

- S1: `ShellUtilities.md`, `WidgetFiles.md`, and affected Widget manuals for
  the approved normalization deletion;
- S2/S3: root `documentation/README.md`, `WidgetFiles.md`, `bob.md`, `roma.md`,
  `tokyo-worker.md`, `CONTEXT.md`, `Tenets.md`, `supernova.md`, and the runtime-
  materializer README;
- S4: `ToolDrawerControls.md`, `ShellCore.md`, `bob.md`, and affected Widget
  manuals for the approved generic typography behavior;
- S5/S6: `roma.md`, `tokyo-worker.md`, `tokyo.md`, `Overview.md`,
  `AccountManagement.md`, and `ShellCore.md` after `OD-S5-01`, `OD-S5-02`,
  and `OD-S6-01`;
- S7: Widget authoring/operator verification sections,
  `CloudflareOperations.md`, `CloudflarePagesCloudDevChecklist.md`, and
  `PlaywrightE2E.md`; and
- current-history cleanup only in the exact owner manuals touched by the
  frozen implementation, preserving current law and routing history to
  `Execution_Pipeline_Docs/`.

A fresh agent should need one chain: root README -> Widget authoring/producer
-> Bob selected open/preview -> Roma New/Save/Publish -> Tokyo storage/serve ->
Cloudflare deploy -> focused local versus deployed verification. No registry,
compatibility path, permanent audit report, or historical closure narrative is
part of that chain.

#### Slice 8 execution plan

Approved findings: `S8-F01`–`S8-F12`, each bound to the settled implementation
finding and approved decision named in the audit ledger.

Exact outcome: current documentation describes one shipped Widget lifecycle
and one truthful operator path. It contains no stale raw-R2 authority, second
producer, mutating check, selected Tokyo definition read, arbitrary Widget
Defaults copy owner, stored Widget codebook, historical closure narrative, or
instance-selecting translation fallback.

##### Slice 8A — exact translation-smoke coordinate

Allowed code file: `scripts/e2e/roma-translation-agent-runtime-smoke.mjs`.

1. Delete `DEFAULT_INSTANCE_ID` and every Big Bang/first-account-instance
   fallback.
2. Require exact environment input `E2E_TRANSLATION_INSTANCE_ID`.
3. Reject absence and surrounding-whitespace healing synchronously before
   loading auth state or making any network request. After authentication,
   reject a coordinate not present in the exact account inventory before any
   overlay-mutating operation.
4. Preserve the current explicit Translation Agent operation, exact result,
   overlay verification, and restoration requirements for the authorized
   selected instance.

Changing the script is authorized by the implementation manifest. Running the
mutation is not: it requires separate product-data authorization naming the
exact disposable/restorable instance coordinate.

##### Slice 8B — current manual reconciliation

Allowed documentation files, only where the settled implementation changes
their current truth:

- `documentation/README.md`;
- `documentation/widgets/README.md`;
- `documentation/widgets/authoring/{README,WidgetFiles,WidgetAuthoringChecklist,ToolDrawerControls}.md`;
- `documentation/widgets/shared/{README,ShellCore,ShellUtilities}.md`;
- `documentation/widgets/widgets/{README,big-bang,cards,countdown,faq,logoshowcase}.md`;
- `documentation/services/{bob,roma,tokyo,tokyo-worker}.md`;
- `documentation/architecture/{CONTEXT,Tenets,Overview,AccountManagement}.md`;
- `documentation/capabilities/supernova.md`;
- `documentation/engineering/{CloudflareOperations,CloudflarePagesCloudDevChecklist,PlaywrightE2E}.md`;
- `packages/ck-runtime-materializer/README.md`; and
- no other manual unless an earlier frozen slice stops and explicitly adds its
  named owner document before implementation resumes.

The manuals must state the shipped facts:

1. one Widget folder is accepted by one producer;
2. the producer emits one selected editor artifact, one selected materializer
   artifact, and one compact Tokyo Catalog definition;
3. Catalog consumes compact collection truth; New consumes the selected Roma
   materializer plus exact account defaults and writes nothing;
4. Bob owns one browser-memory draft and preview; Save persists editable source
   through Roma; Publish alone creates the complete package; Tokyo stores and
   serves it;
5. effective defaults are deployed Widget baseline plus explicit account
   overrides; Widget Defaults shows separate system-owned common controls and
   one selected Widget Core;
6. top-level `widgetType` is the stored software identity; there is no
   `widgetCode` codebook or duplicate nested type contract;
7. `pnpm generate:widgets` mutates derived outputs, while focused `--check` and
   `pnpm validate:widgets` are genuinely non-writing;
8. root lint/typecheck/build, Git-connected Pages, Worker selection, retained
   R2 roots, and exact verification commands follow the frozen Slice 7 DAG;
9. raw Widget source is not an R2 or Bob/Roma runtime-artifact authority;
   Tokyo Pages remains the exact canonical `/product/widgets/**` source
   projection, while Tokyo-worker `/widgets/**` is not a friendly source
   route; and
10. Translation smoke requires one explicit instance coordinate and never
    chooses product data for the operator.

Delete obsolete commands, SHAs, dates, cutover inventories, one-off IDs/counts,
agent-closure, and owner-acceptance narratives from current manuals. Preserve
concise current laws; history remains in `Execution_Pipeline_Docs/`.

Prohibited files/surfaces: Prague and DevStudio code, workflows, configuration,
internals, and manuals; public Widget copy; account data; a compatibility
manual; a permanent audit document; planned target text before the
corresponding implementation passes; and any new registry/check/probe.

Generated-artifact effect: none. Test/CI effect: no new documentation gate.
The translation script receives no new harness or check mode. Local evidence
is `node --check` plus direct missing/whitespace executions that must terminate
before auth-state or network access. Exact account-membership success is proved
only by the separately authorized real smoke, because its current successful
path immediately enters the overlay-mutating operation; it is not part of
local non-mutating acceptance.

Product-data effect: **none**. Documentation reconciliation and script changes
do not run Translation Agent or write overlays.

Focused/final verification:

- every documented command exists and matches the settled package/workflow;
- four current per-Widget manuals use focused check mode and aggregate guidance
  runs all Widgets exactly once;
- `pnpm validate:widgets` leaves the complete settled worktree unchanged;
- a fresh read-only agent reconstructs the exact chain:

  ```text
  Widget source
    -> unified producer
    -> selected Bob/Roma artifacts + compact Tokyo Catalog definitions
    -> New from selected materializer + effective defaults
    -> Bob browser-memory edit/preview
    -> Save editable source
    -> Publish complete package
    -> Tokyo exact storage/serve
    -> Git-connected Pages / GitHub Worker deployment
    -> focused local and exact deployed verification
  ```

- exact search proves current manuals contain no deleted command/path/authority
  claim or historical closure prose covered by this manifest;
- `node --check` for the translation smoke plus non-mutating missing and
  surrounding-whitespace rejection before auth/network access; exact valid-
  coordinate membership and generation are deferred to the separately
  authorized product-data smoke;
- `git diff --check`; and
- independent V1–V8, especially no instance fallback (V1), no coordinate
  trimming (V2), no omitted current authority/command (V3), no partial docs
  masquerading as completion (V6), and no audit/test ritual (V7/V8).

Deployment reconciliation: Slice 8 itself has no runtime deployment or
managed-service mutation. During local implementation, current manuals are
updated to the exact settled repository behavior and must explicitly name any
known deployed-state mismatch that remains behind a separate release gate;
they may not claim that an unapplied Pages configuration or undeleted R2
object is already reconciled. After the separately authorized integrated
push and its automatic rollout, exact Git/Pages/Worker/R2 read-back is the
shipped-truth acceptance gate and the documentation SHA is verified on
`github/main`. If deployed truth diverges, the release remains incomplete and
the owning manual names that exact mismatch through a separately authorized
follow-up rather than claiming completion.

Stop conditions: any earlier slice changes its frozen outcome, a documented
command does not exist, local manuals would claim an unapplied deployed target
instead of naming the exact mismatch, the translation script cannot reject
before mutation, or correct docs would require Prague/DevStudio/public-copy/
product-data scope. A deployed mismatch blocks later shipped-truth acceptance;
it does not authorize local code or documentation to fabricate completion.

Independent audit of this Slice 8 execution plan: **PASS**. The exact current-
manual allowlist, translation-coordinate mutation boundary, shipped lifecycle,
operator map, exclusions, and V1–V8 gate are executable.

Independent evidence audit: **PASS.** The mismatch ledger, conditional target
lifecycle, operator map, exclusions, decision dependencies, and V1–V8
classification have no remaining blocker. This is not an execution-plan audit
and does not authorize implementation.

## 13. PRD Ledgers

These ledgers are populated progressively inside this PRD. Empty rows mean the
audit has not happened; they do not mean the system passed.

### 13.1 Baseline ledger

| Slice | Branch | Local SHA | Remote SHA | Worktree | Deployed evidence | Read set | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | `main` | `dd8fe00e` | `dd8fe00e` (`github/main`) | Only this untracked PRD | Exact-SHA Bob/Roma Pages and Roma CI; latest applicable Tokyo deploy; health/reachability recorded | Exact read set in Slice 0 record | Frozen — no action |
| 1 | `main` | `dd8fe00e` | `dd8fe00e` (`github/main`) | Only this PRD | Read-only R2 list and friendly-route 200 prove all eight historical shared objects are currently deployed | Core + complete Widget authoring/shared/operator and Bob/Roma/Tokyo routed manuals | Frozen |
| 2 | `main` | `dd8fe00e` | `dd8fe00e` (`github/main`) | Only this PRD | Slice 0 build/deploy baseline; no separate live assertion | Core + Widget/Roma/Tokyo/overlay/runtime/history routed evidence | Frozen |
| 3 | `main` | `dd8fe00e` | `dd8fe00e` (`github/main`) | Only this PRD | Slice 0 build/deploy baseline | Core + Widget producer/Bob/Roma/Tokyo manuals | Frozen |
| 4 | `main` | `dd8fe00e` | `dd8fe00e` (`github/main`) | Only this PRD | Exact selected editor transfers and Bob/Roma deployment baseline | Core + complete Bob/Widget/Roma routed manuals | Frozen |
| 5 | `main` | `dd8fe00e` | `dd8fe00e` (`github/main`) | Only this PRD | Slice 0 build/deploy baseline | Core + complete Roma/Bob/Widget/Tokyo routed manuals | Frozen |
| 6 | `main` | `dd8fe00e` | `dd8fe00e` (`github/main`) | Only this PRD | Slice 0 build/deploy baseline | Core + complete Tokyo/Roma/storage/public-serving routed manuals | Frozen |
| 7 | `main` | `dd8fe00e` | `dd8fe00e` (`github/main`) | Only this PRD | Live Pages config/deploys, exact GitHub run logs, R2 preflights/list/friendly route | Core + Cloudflare/Pages/Playwright/Runtime/Tokyo manuals and exact workflow/script graph | Frozen |
| 8 | `main` | `dd8fe00e` | `dd8fe00e` (`github/main`) | Only this PRD | Uses frozen Slice 0 and live Slice 7 evidence; no new mutation | All owning manuals implicated by Slices 1–7 | Frozen |

### 13.2 Finding ledger

| ID | Slice | Flow | Reachability | Evidence | Classification | Decision | Plan status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S1-F01 | 1 | Shared Widget source/deploy | Happening as source/deploy accumulation; superseded in product runtime | Eight historical JS modules absent from all current declarations/artifacts | `DELETE — SUPERSEDED` | None; remote object reconciliation depends on Slice 7 | Frozen S1/S7 plan |
| S1-D1 | 1 | FAQ/Logo compiled editor declarations | Happening as inert generated data; no runtime consumer | `normalization.idRules` parsed/emitted but never consumed | `OWNER DECISION` | OD-S1-01 approved | Frozen S1 plan |
| S2-F01 | 2 | Catalog/New/account setup/Worker bundle | Happening now | Full specs/editable fields imported for compact definition consumers | `SIMPLIFY`; superseded payload deletion | None | Frozen atomic S2/S3 plan |
| S2-F02 | 2 | Selected New | Happening now | All-definition list and scan for one type | `SIMPLIFY` | OD-S5-02 approved | Frozen S5 plan |
| S2-F03 | 2 | Created-account defaults setup | Reachable on account creation | All current types deliberately observed under current snapshot contract | `KEEP — OWNER` under current contract; simplified by approved defaults contract | OD-S5-02 approved | Frozen S5 plan |
| S2-F04 | 2 | Code/reverse-map helpers | Proven dead | No active source consumers | `DELETE — PROVEN DEAD` | None | Frozen S2/S6 plan |
| S2-F05 | 2 | Storage/helper signatures | Happening now; semantically inert | `widgetCode` ignored by physical key authority | `DELETE — SUPERSEDED` | OD-S6-01 approved | Frozen S6 plan |
| S2-F06 | 2 | First Save/stored source/transport | Happening now | Manual codebook supplies unconsumed stored `widgetCode` | `OWNER DECISION` | OD-S6-01 approved | Frozen S6 plan |
| S2-F07 | 2 | Save/Publish/content identity | Happening now and required | Top-level `widgetType` selects exact software/contract | `KEEP — OWNER` | None | Frozen — no change |
| S2-F08 | 2 | Existing account opens newly deployed Widget | Concretely reachable for the next Widget | Complete defaults snapshot lacks later Widget entry | `OWNER DECISION` | OD-S5-02 approved | Frozen S5 plan |
| S2-F09 | 2 | Atomic source | Happening now as unconsumed duplicate | Nested `content.widgetType` has no active reader | `OWNER DECISION` | OD-S6-01 approved | Frozen S6 plan |
| S2-F10 | 2 | Build-time discovery/maps | Happening now and required | Generated indexes and generic directory scans | `KEEP — OWNER` | None | Frozen — no change |
| S3-F01 | 3 | Artifact production | Happening now | Duplicate direct Core fields in both artifact families | `DELETE — SUPERSEDED` | None | Frozen atomic S2/S3 plan |
| S3-F02 | 3 | Selected Save/Publish/materializer read | Happening now | Static all-materializer import chunk | `SIMPLIFY` | None | Frozen atomic S2/S3 plan |
| S3-F03 | 3 | Definition/artifact generation | Happening now | Two discovery generators; full sources in Worker | `SIMPLIFY` | Approved S2 compact contract | Frozen atomic S2/S3 plan |
| S4-F01 | 4 | Bob/Roma compiled control hydration | Happening now | Runtime regex/duplicate proof over producer IDs | `DELETE — SUPERSEDED` | None | Frozen S4 plan |
| S4-F02 | 4 | Bob linked edit expansion | Proven dead | Root item-padding paths match no Widget | `DELETE — PROVEN DEAD` | None | Frozen S4 plan |
| S4-F03 | 4 | Preview/Publish typography sizing | Happening now | Shared renderer branches on unique Widget role names | `OWNER DECISION` | OD-S4-01 approved | Frozen S4 plan |
| S4-F04 | 4 | Preview/Publish typography line height | Happening now | Shared role-name/script maps contain Widget semantics | `OWNER DECISION` | OD-S4-01 approved | Frozen S4 plan |
| S5-F01 | 5 | Your Widgets inventory | Happening now | Eager prefetch downloads up to eight editor artifacts | `DELETE — SUPERSEDED` | None | Frozen S5 plan |
| S5-F02 | 5 | Selected New | Happening now | Catalog-wide definition lookup for one Widget | `SIMPLIFY` | Coordinates with frozen S2-F02 | Frozen S5 plan |
| S5-F03 | 5 | Publish/Republish | Happening now and required | Roma fast pre-materialization 402 and Tokyo atomic commit-time enforcement own distinct error-priority/consistency jobs | `KEEP — OWNER` | None | Frozen — preserve both; S6A reduces facts transport only |
| S5-F04 | 5 | Account Widget inventory | Happening now | ID list followed by one private request per instance | `SIMPLIFY` | Coordinates with S6-F02 | Frozen S6A/S5 plan |
| S5-F05 | 5 | Widget Defaults UI | Happening now; grows linearly | Every editor artifact/control host loaded and rendered | `OWNER DECISION` | OD-S5-01 approved | Frozen S5 plan |
| S5-F06 | 5 | Widget Defaults common controls | Happening now | Copy/meaning taken from arbitrary first Widget | `OWNER DECISION` | OD-S5-01 approved | Frozen S5 plan |
| S5-F07 | 5 | Existing-account New after Widget deploy | Concretely reachable for the next Widget | Defaults snapshot seeded only at account creation | `OWNER DECISION` | OD-S5-02 approved | Frozen S5 plan |
| S6-F01 | 6 | First Save/storage/public/overlay helpers | Happening now; semantically inert | Manual `widgetCode` has no physical coordinate consumer | `OWNER DECISION` | OD-S6-01 approved | Frozen S6B plan |
| S6-F02 | 6 | Account instance facts | Happening now | Tokyo exposes IDs; Roma fans out N private reads | `SIMPLIFY` | Coordinates with S5-F04 | Frozen S6A/S5 plan |
| S6-F03 | 6 | Atomic source | Happening now as unconsumed duplicate | Nested `content.widgetType` duplicates top-level authority | `OWNER DECISION` | OD-S6-01 approved | Frozen S6B plan |
| S7-F01 | 7 | Generation/lint/typecheck/build/CI | Happening now | Mutating validation and 14 repeated all-Widget passes per Widget push | `SIMPLIFY` | None | Frozen S7 plan |
| S7-F02 | 7 | Worker CI | Happening now as successful no-op | Missing Roma `test:ui-copy` script | `DELETE — PROVEN DEAD` | None | Frozen S7 plan |
| S7-F03 | 7 | Git-authored R2 deployment | Happening now | 588 PUTs for 10 mapped files and for one unmapped Dieter change; no deletes | `SIMPLIFY` | OD-S7-02 approved | Frozen S7 plan; remote delete separately gated |
| S7-F04 | 7 | Worker dependency deploy | Concretely reachable | Root dependency paths trigger checks but select no Worker deployment | `SIMPLIFY` | None | Frozen S7 plan |
| S7-F05 | 7 | Focused/CI tests | Happening now or dormant | Source-shape/absence tests duplicate prose/history; real behavior assertions separable | `DELETE/SIMPLIFY` | None | Frozen S7 plan |
| S7-F06 | 7 | Workflow triggers | Proven dead | Missing `scripts/verify/**` and empty `tokyo/product/themes/**` | `DELETE — PROVEN DEAD` | None | Frozen S7 plan |
| S7-F07 | 7 | Raw Widget R2 mirror/friendly route | Happening now; no active product consumer found | 68 raw objects deployed; Bob/Roma/Save/Publish/public serve consume generated/stored truth instead | `OWNER DECISION` | OD-S7-02 approved | Frozen S7 plan; remote delete separately gated |
| S8-F01 | 8 | Root product journey | Current documentation mismatch | Bob editor-artifact authority described falsely | `SIMPLIFY` | Depends on frozen S2/S3 | Frozen S8 plan |
| S8-F02 | 8 | Tokyo definition manual | Current documentation mismatch | List route called list/read | `SIMPLIFY` | Depends on frozen S2 compact collection | Frozen S8 plan |
| S8-F03 | 8 | New/defaults manuals | Current omission | Later-Widget defaults gap unnamed | `OWNER DECISION` | OD-S5-02 approved | Frozen S8 plan |
| S8-F04 | 8 | Widget Defaults manual | Current omission | All-artifact cost/arbitrary first wording unnamed | `OWNER DECISION` | OD-S5-01 approved | Frozen S8 plan |
| S8-F05 | 8 | Producer manuals | Current mismatch | Two producers described as one | `SIMPLIFY` | Depends on frozen S2/S3 | Frozen S8 plan |
| S8-F06 | 8 | Verification manuals | Current mismatch | Mutating `validate:widgets` described as check | `SIMPLIFY` | Depends on frozen S7-F01 | Frozen S8 plan |
| S8-F07 | 8 | Per-Widget manuals | Happening now | Four manuals run catalog-wide validation for one Widget | `SIMPLIFY` | Depends on frozen S7-F01 | Frozen S8 plan |
| S8-F08 | 8 | Worker CI manual truth | Happening no-op | Nonexistent script | `DELETE — PROVEN DEAD` | None | Frozen S8 plan |
| S8-F09 | 8 | Translation smoke | Concretely reachable mutation | Optional coordinate silently selects unrelated instances | `SIMPLIFY` | None | Frozen S8 plan; execution remains data-gated |
| S8-F10 | 8 | Current manuals | Happening now | SHAs/dates/cutover/closure history mixed with operator truth | `DELETE — SUPERSEDED` | None | Frozen S8 plan |
| S8-F11 | 8 | Conditional manuals | Current truth depends on final code | Multiple descriptions depend on S1–S7 choices | `RECONCILE FROM SHIPPED TRUTH` | All seven approved decisions | Frozen S8 plan |
| S8-F12 | 8 | R2/manual reconciliation | Happening now | Upload-only mirror leaves deleted source live | `SIMPLIFY` | OD-S7-02 approved | Frozen S7/S8 plan; remote delete separately gated |

### 13.3 Owner-decision ledger

| Decision ID | Slice/finding | Exact question | Evidence | Owner decision | Plan effect |
| --- | --- | --- | --- | --- | --- |
| OD-S1-01 | S1-D1 | Delete the proved-inert FAQ/Logo normalization declarations and compiler-only machinery, or retain them explicitly as inert metadata? | No active `compiled.normalization` consumer; current ID owners proven | **Approved: delete them; add no replacement normalization path.** | Slice 1 includes the exact declaration/compiler deletion. |
| OD-S4-01 | S4-F03/S4-F04 | Preserve current distinct typography rules through generic declared metadata, or standardize on current generic rendering? | Exact role branches and preserved Widget output in Slice 4 | **Approved: preserve current visuals through the smallest complete generic declared role-behavior metadata.** | Slice 4 moves exact behavior into producer-owned Widget software and removes Widget-role branches from the shared renderer. |
| OD-S5-01 | S5-F05/S5-F06 | What scalable Widget Defaults interaction is intended, and who owns common-control wording? | All-artifact/control cost and arbitrary-first-Widget copy | **Approved: one selected Widget Core at a time, with a separate system-owned common section and wording.** | Slice 5 fetches/hydrates one selected editor artifact and removes arbitrary-first-Widget common authority. |
| OD-S5-02 | S2-F08/S5-F07 | What exact authority supplies initial effective defaults for a Widget deployed after an account already exists? | Catalog discovers the Widget but the stored snapshot has no entry | **Approved: deployed Widget baseline plus explicit account overrides.** | Slices 5/6 compose effective defaults explicitly; a later Widget works without backfill or read-time mutation. |
| OD-S6-01 | S2-F05/S2-F06/S2-F09/S6-F01/S6-F03 | Remove obsolete `widgetCode` and duplicate nested `content.widgetType`; if yes, leave existing inert bytes or authorize exact data cleanup? | Account-first keys ignore code; top-level type is sole used identity | **Approved: omit both from future contracts/writes and leave existing inert bytes untouched.** | Slice 6 removes live code/fields with no migration, compatibility reader, or product-data rewrite. |
| OD-S7-01 | S7 Pages scope | Keep Bob/Roma repository-wide Pages builds, or authorize stable dependency-wide include sets and conditional Bob CI build? | Live `path_includes:["*"]`; Roma-only commit rebuilt both apps | **Approved: stable dependency-wide include sets plus conditional Bob CI build.** | Slice 7 updates the existing Git-connected Pages configuration through its documented preflight/read-back path. |
| OD-S7-02 | S7-F03/S7-F07/S8-F12 | Remove raw Widget authoring-source R2 mirror/friendly route, or retain it explicitly with exact delta sync/delete behavior? | No active product consumer; 68 deployed objects and documented authority | **Approved: remove the raw mirror, friendly route, and FAQ preflight dependency.** | Slice 7 removes the mapping/route and exactly reconciles the remote `product/widgets/**` prefix; Git source, generated artifacts, and account serve state remain. |

### 13.4 Slice-plan ledger

| Slice | Audit | Decisions | Execution plan | Independent plan audit | Freeze |
| --- | --- | --- | --- | --- | --- |
| 0 | Complete | None | No action | PASS | Yes |
| 1 | Complete | OD-S1-01 approved | Written | PASS | Yes |
| 2 | Complete; M02 Edge-build stop condition audited | OD-S5-02 and OD-S6-01 approved; effects routed to S5/S6 | WSSS-v2 technical refreeze written; atomic with S3 | PASS | Yes |
| 3 | Complete; M02 Edge-build stop condition audited | None; approved compact contract from S2 | WSSS-v2 technical refreeze written; atomic with S2 | PASS | Yes |
| 4 | Complete | OD-S4-01 approved | Written | PASS | Yes |
| 5 | Complete | OD-S5-01 and OD-S5-02 approved | Written | PASS | Yes |
| 6 | Complete | OD-S5-02 and OD-S6-01 approved | Written | PASS | Yes |
| 7 | Complete | OD-S7-01 and OD-S7-02 approved | Written | PASS | Yes |
| 8 | Complete | All seven decisions approved; runs after S1–S7 | Written | PASS | Yes |

### 13.5 Final implementation manifest

Manifest version: **WSSS-v2**

Immutable pre-implementation code baseline:
`dd8fe00eb77598d821d128b334d79463cfc6c83f` on local `main` and
`github/main`.

Manifest status: **LOCAL IMPLEMENTATION COMPLETE. M01–M09 ARE CLOSED. R1 IS
COMPLETE. R2 IS OWNER-AUTHORIZED; R3 READ-ONLY RECONCILIATION IS REQUIRED.
R4–R6 REMAIN UNAUTHORIZED.**

Owner authorization: on 2026-08-22 the owner replied `sure continue` directly
to the exact WSSS-v2 M02–M09 authorization request.

Release authorization: on 2026-08-22 the owner explicitly requested commit and
push of the complete settled repository diff. After the pre-push read-back
identified all five Git-connected Pages effects and the owner clarified that
Tokyo Pages must continue publishing canonical Widget source, the owner said
`continue`. That authorizes R1 and the exact R2 combined push/automatic rollout
recorded below; it does not authorize R4, R5, or R6.

This manifest binds the complete refrozen slice plans. The primary implements;
subagents remain read-only and independently audit settled diffs. A file,
authority, generated effect, data consequence, or behavior not named here or
in the corresponding frozen plan is outside scope. Any further unexpected
requirement returns that entry to `AUDITING`, creates the next manifest
version, and requires fresh owner approval.

#### WSSS-v2 local execution order

| Order | Manifest entry | Frozen input | Atomic boundary |
| ---: | --- | --- | --- |
| 1 | `M01` declaration cleanup | Slice 1 | Close before producer work. |
| 2 | `M02` compact definitions and one producer | Slices 2–3 | One indivisible checkpoint; no intermediate check/commit/deploy. |
| 3 | `M03` generic selected-Widget typography | Slice 4 | Preserve exact current CSS before continuing. |
| 4 | `M04` one account-facts handoff | Slice 6A | Must settle before Slice 5 consumes it. |
| 5 | `M05` scalable Roma lifecycle/defaults | Slice 5 | Depends on `M02`, `M03`, and `M04`. |
| 6 | `M06` read-compatible identity cleanup | Slice 6B | Runs after final Roma consumers settle. |
| 7 | `M07` truthful commands/CI/deploy code | Slice 7 | Local code and dry-runs only; no remote mutation. |
| 8 | `M08` translation coordinate and manuals | Slice 8 | Runs against the settled M01–M07 implementation. |
| 9 | `M09` integrated local reconciliation | All frozen slices | One settled diff, all checks, fresh independent V1–V8. |

No entry may be skipped, reordered, or partially declared complete. `M02` is
atomic because the compact consumer, tracked generated source, unified
producer, and commands must agree in one diff. `M04 -> M05 -> M06` is ordered
because the scalable Roma surface first needs one exact Tokyo facts handoff,
then final consumers settle, then inert identity fields can be removed once.

#### M01 — Widget declaration and superseded-source cleanup

- **Frozen IDs:** S1-F01, S1-D1; OD-S1-01.
- **Exact outcome:** delete the eight superseded shared JavaScript files, both
  unused shared-module arrays, the two inert `normalization.idRules`
  declarations, and compiler-only normalization machinery. Add no replacement.
- **Preserved behavior:** all 50 required Widget-owned files as software
  authorities; all ten active shared modules; Dieter Repeater/Object Manager
  ID minting; Product Copilot exact-ID admission; every current Core and public
  behavior.
- **Owning authorities/allowed paths:** the eight exact files under
  `tokyo/product/widgets/shared/`; `packages/widget-foundation/src/modules.ts`;
  only the normalization blocks in FAQ/Logo `spec.json`;
  `bob/lib/compiler/modules/normalization.ts`, `bob/lib/compiler.server.ts`,
  `bob/lib/compiler.shared.ts`, `bob/lib/types.ts`; producer-generated ignored
  editor/materializer outputs; and the exact Slice 1 manuals/tests.
- **Prohibited:** other Widget declarations/Core files, active shared sources,
  Dieter/Product Copilot behavior, storage/routes, public package shape, a new
  normalizer/compatibility path, Prague, DevStudio, and product data.
- **Order:** delete exact source/arrays; delete exact declarations/compiler
  path; generate all five once; inspect active assets/Core; reconcile exact
  manuals.
- **Generated effect:** editor artifacts lose only inert normalization;
  active asset order/content and public materializer behavior remain exact.
- **Tests/CI/docs:** all-five generation/check; focused FAQ/Logo checks; Bob
  editor-contract/typecheck; Widget Foundation typecheck; exact asset inventory;
  `git diff --check`; named ShellUtilities/WidgetFiles/FAQ/Logo/Bob manuals.
- **Product data:** none.
- **Later deploy/live evidence:** final Bob/Roma/Tokyo-worker SHAs and health;
  authenticated preview of all five; current Add/Copilot ID behavior. No Save,
  Publish, Republish, or remote raw-object deletion in this entry.

#### M02 — Compact Catalog truth, one producer, and selected artifacts

- **Frozen IDs:** S2-F01, S2-F04, S3-F01, S3-F02, S3-F03; the S2 compact
  contract approved as an input to S3.
- **Exact outcome:** one producer emits the two required per-Widget artifact
  families and one tracked compact Tokyo definition array. Tokyo and Roma
  Catalog consume that exact sorted `{widgetType,displayName,description}`
  array without remap/re-sort. Direct duplicate Core fields and the second
  definition generator disappear. Each Roma materializer is one deploy-built
  Pages static asset, and the Edge function reads only the selected path
  through the existing `ASSETS` binding; no payload is bundled eagerly.
- **Preserved behavior:** source discovery remains generic; all producer
  completeness checks remain at the producer; Catalog order/copy; interim
  created-account all-type setup until M05; New no-write law; First/later Save;
  Publish-only materialization; complete Core in ordered `styles`/`scripts`;
  explicit unknown-Widget failure.
- **Owning authorities/allowed paths:** `.gitignore` for the exact generated
  materializer root; `scripts/widgets/generate-artifacts.*`;
  deletion of `scripts/generate-widget-definition-sources.mjs`; root
  `package.json`; Widget Foundation `widget-software.ts`; runtime-materializer
  fixture/test; generated Roma editor/materializer files and loader index only
  through the producer; generated Tokyo compact source only through the
  producer; Tokyo definition domain/route/test/package command; Roma definition
  client, Catalog route, interim session-finish consumer, selected materializer
  readers and the exact First/later Save/Publish routes/tests named by Slices
  2–3; exact Bob/Roma/Tokyo/WidgetFiles/materializer manuals.
- **Prohibited:** a selected Tokyo definition endpoint; manual registry;
  runtime filesystem/R2 discovery; cross-service/network fetch; application
  cache, new service, or compatibility reader; any Widget declaration/Core
  change; account storage/overlays; Prague, DevStudio, or product data.
- **Order:** remove duplicate Core fields; emit static per-Widget materializer
  assets plus the generated exact-path reader and make consumers async; emit
  compact definitions through the same producer;
  wire exact pass-through consumers; delete second generator/dead Tokyo
  lookup/wrappers; generate once; inspect all derived output. No interim state.
- **Generated effect:** all editor/materializer artifacts lose duplicate direct
  Core fields; materializers move from eager server imports to separate Pages
  static assets; the generated index becomes an exact-path Pages-asset reader;
  Tokyo source becomes compact literals; no public-package shape change.
- **Tests/CI/docs:** Tokyo compact list behavior/auth/method test; Roma Catalog
  cold path/interim setup; all-five and focused generation; Bob compiler;
  Widget Foundation/runtime materializer; Roma Save/Publish/translation/
  Defaults tests, focused Pages-asset reader behavior, and production build;
  zero materializer bytes in Edge chunks plus five separate Pages assets;
  Tokyo Worker size; `git diff --check`; exact owner manuals.
- **Product data:** none.
- **Later deploy/live evidence:** exact Bob/Roma Pages and Tokyo-worker SHAs;
  compact Catalog; authenticated one-artifact preview of every current Widget;
  local complete materialization; no cloud Save/Publish/Republish.

#### M03 — Generic typography behavior and trusted Bob hydration

- **Frozen IDs:** S4-F01–S4-F04; OD-S4-01.
- **Exact outcome:** Bob namespaces trusted compiled IDs without re-proving
  them; dead root item-padding operations disappear; Widget software carries
  one complete generic 11-script role-behavior map; shared rendering has no
  Widget-unique role/name branch.
- **Preserved behavior:** exact current fluid-size formula selection and every
  exact current line-height CSS string for common and unique roles in preview
  and materialization; browser/model/user ingress; selected-artifact session;
  Bob edit/Undo/Save/preview behavior.
- **Owning authorities/allowed paths:** Bob `td-menu-content/{dom,linkedOps}.ts`;
  Widget Foundation `widget-software`, `widget-styles`, and exports; raw
  declaration type; producer; only approved unique-role metadata in Big Bang,
  Cards, Countdown, and FAQ specs; producer-generated artifacts; exact Bob,
  runtime-materializer, Roma typography fixtures; exact Widget/Bob/Roma/
  typography manuals named by Slice 4.
- **Prohibited:** Core software, editable typography values, labels/l10n,
  Dieter stencils, session/Save/storage/public shape, fallback behavior, Widget-
  name/path switches, Prague, DevStudio, and product data.
- **Order:** remove only downstream ID re-proofs; remove only dead root linked
  ops; add complete producer-owned behavior; replace runtime role maps with
  direct exact lookup; generate all five once; reconcile manuals.
- **Generated effect:** both artifact families gain complete generic typography
  behavior; no editable/source/public package field changes.
- **Tests/CI/docs:** one-to-one role/script coverage; exact CSS for all four CJK
  variants and every non-CJK base; Bob editor/typography tests; Widget
  Foundation/runtime materializer; Roma typography; preview/materializer parity;
  all-five producer; `git diff --check`; exact owner manuals.
- **Product data:** none.
- **Later deploy/live evidence:** exact Pages/Worker SHAs; authenticated all-five
  preview CSS against frozen values; local same-state materialization parity.
  No Save/Publish/Republish.

#### M04 — One exact account-facts handoff

- **Frozen IDs:** S6-F02/S5-F04, Slice 6A.
- **Exact outcome:** add
  `GET /__internal/accounts/{accountPublicId}/instances/list-facts`; Tokyo reads
  the existing exact source anchors internally and returns the same sorted facts
  once; Roma uses one request rather than IDs plus N selected requests.
- **Preserved behavior:** IDs-only route for locale/account jobs; selected fact
  route for Save/Copilot; exact source anchor; no omission—one corrupt/failed
  source read fails the complete operation; Roma fast Publish 402 and Tokyo
  atomic final capacity enforcement both remain.
- **Owning authorities/allowed paths:** Roma instance client and Widgets route;
  Tokyo instance source/domain/routes; new exact Tokyo facts behavior test and
  package command; Roma cold-path test; exact Roma/Tokyo manuals.
- **Prohibited:** stored index/summary/counter/cache/registry; filtered partial
  success; storage keys; publication behavior; product data; Prague/DevStudio.
- **Order:** add Tokyo aggregation; behavior-test exact success/failure/order;
  switch Roma client; update Catalog/Inventory consumer; prove the IDs-only and
  selected routes remain used by their current jobs.
- **Generated effect:** none.
- **Tests/CI/docs:** Tokyo facts behavior, Roma cold path, publication capacity,
  Tokyo/Roma typechecks, bundle/request count, `git diff --check`, exact manuals.
- **Product data:** none.
- **Later deploy/live evidence:** exact Roma/Tokyo SHA and health; authenticated
  Inventory/Catalog same facts through one private request; no account write.

#### M05 — Selected Widget Defaults and exact effective defaults

Execution status: **CLOSED**

- **Frozen IDs:** S5-F01, S5-F02, S5-F04–S5-F07, S2-F02/S2-F03/S2-F08;
  S5-F03 explicitly kept; OD-S5-01 and OD-S5-02.
- **Exact outcome:** account defaults store common/font truth and only complete
  per-Widget Core overrides. Effective Core is the exact stored complete
  override when present, otherwise the approved deployed materializer baseline.
  Widget Defaults displays one Bob-owned common section and one selected Widget
  Core using one selected editor artifact. New selects one materializer plus
  exact defaults and writes nothing. Your Widgets does not prefetch artifacts.
- **Preserved behavior:** existing complete overrides; full-document Save,
  Discard, Save receipt, unsaved-navigation boundary; compact Catalog; one
  selected Builder artifact; later Save; Roma's early pre-materialization 402;
  Tokyo's atomic capacity result; exact upsell.
- **Owning authorities/allowed paths:** Widget Defaults domain/control host;
  Widgets domain/editor-artifact helper; exact Roma Widget Defaults l10n/CSS;
  defaults contract/direct/materialization; defaults/session-finish routes;
  Builder New; Widgets route/client; Bob typography l10n/module; only Big Bang's
  common-body label/declaration; Bob type + producer; producer-generated editor
  artifacts; exact Roma/Bob/Tokyo tests and manuals named in Slice 5.
- **Prohibited:** new Dieter component; Core behavior; unique Widget labels;
  defaults service/cache/index or per-Widget storage files; partial override;
  silent backfill/read mutation; existing data rewrite; Bob session/Save;
  public package change; Prague/DevStudio.
- **Order:** make common wording Bob-owned; emit editor Core baseline; change
  new-account defaults to `widgets:{}`; return defaults plus compact selector
  truth; replace all-artifact state with `DieterDropdownActions`, one compiled
  Widget, common host, and selected Core host; store a full override only after
  a real Core edit; retain full Save/Discard; change New; delete prefetch;
  consume M04 facts once; preserve/test both publication-capacity boundaries.
- **Generated effect:** editor artifacts expose exact Core baseline; no source
  or public-package shape change.
- **Tests/CI/docs:** selected host/artifact counts; existing/new/later-Widget
  defaults cases; untouched omission; common copy; edit/Discard/Save/navigation;
  all-five New no-write; early Roma 402 before materialization and Tokyo final
  capacity; one-request inventory; exact Bob/Roma/Tokyo suites, all-five
  generation, Roma build, `git diff --check`, exact manuals.
- **Product data:** none. Existing defaults remain byte-untouched unless a user
  later explicitly Saves; acceptance performs no Save.
- **Later deploy/live evidence:** exact Pages/Tokyo SHAs; authenticated Catalog,
  no-prefetch Inventory, one-selected-artifact Defaults transitions, and all-
  five New no-write; before/after defaults bytes identical; no Publish/
  Republish.

#### M06 — Read-compatible instance identity cleanup

Execution status: **CLOSED**

- **Frozen IDs:** S6-F01, S6-F03, S2-F05/S2-F06/S2-F09, Slice 6B; OD-S6-01.
- **Exact outcome:** top-level `widgetType` remains the sole stored Widget
  software identity. Remove `widgetCode` from contracts, responses, signatures,
  routes, operations, source/serve/overlay/delete/translation/public chains and
  codebook exports. Future writes omit duplicate nested `content.widgetType`.
  Exact physical keys remain byte-identical.
- **Preserved behavior:** existing extra JSON bytes remain untouched and are
  simply unreferenced; First/later Save, Duplicate, Rename, Delete, Publish,
  Unpublish, translation, base/locale serve, source anchoring, capacity,
  coordination, cache eviction, and all exact identity keys.
- **Owning authorities/allowed paths:** exact `ck-contracts` codebook/export/
  overlay-identity files; Roma instance client/source producer, Duplicate and
  Widgets routes; Tokyo instance keys/types/source/serve/delete/operations,
  translations/overlays, internal/public routes; exact facts/identity/serving
  tests and architecture/localization/Roma/Tokyo manuals named by Slice 6.
- **Prohibited:** account keys/public URLs/package bytes/overlay values;
  top-level `widgetType`; data migration/read repair/compatibility reader;
  auth/timestamps/cache/deletion/publication changes; stored facts index;
  Prague/DevStudio.
- **Order:** remove ignored helper parameters while snapshotting exact keys;
  remove live field/response/call chain and First-Save derivation; delete
  codebook and exports; remove nested future-write field including Duplicate's
  spread path; leave existing objects untouched; reconcile manuals.
- **Generated effect:** none beyond earlier settled artifacts.
- **Tests/CI/docs:** exact key equality; facts routes; new source shape and
  required top-level type; all instance commands; content-slot overlays;
  translation outcomes; publication capacity; cache; public base/locale;
  contracts/Tokyo/Roma typechecks; Worker size; `git diff --check`; exact
  manuals.
- **Product data:** none—no remote object rewrite, migration, or cleanup.
- **Later deploy/live evidence:** exact Pages and all shared-contract Worker
  SHAs/health; authenticated same Inventory facts; existing base/locale public
  reads; exact source/default bytes unchanged; no command/data mutation.

#### M07 — Truthful producer, CI, Pages watch, and retained R2 roots

Execution status: **CLOSED**

- **Frozen IDs:** S7-F01–S7-F07; OD-S7-01 and OD-S7-02.
- **Exact outcome:** one explicit producer, one genuinely read-only producer
  check, no hidden validation writer, no nonexistent test, exact dependency
  triggers, behavior tests instead of source-prose guards, stable Bob/Roma Pages
  include sets, no raw Widget R2 mapping/route/preflight, and exact delta sync
  only for retained Dieter/font roots. Prague full-sync behavior stays unchanged.
- **Preserved behavior:** producer completeness; clean-checkout Roma
  pretypecheck/prebuild; Git-connected Pages as sole deployment authority;
  Worker secrets/grants/preflights; R2 root/account/MIME/retry protections;
  retained behavior tests; `tokyo:r2:sync:check`; Prague/DevStudio boundaries.
- **Owning authorities/allowed paths:** root and Roma package commands;
  `scripts/build-roma-cf.mjs`; producer CLI; Roma/Worker workflows; R2 sync;
  Tokyo asset mapping/wrangler; R2 preflight; Cloudflare API operator and exact
  root command; exact source-only/mixed tests/scripts listed in Slice 7; owner
  manuals through M08.
- **Prohibited:** Prague workflow/app/mapping/triggers/remote keys/manuals;
  DevStudio; direct Pages artifact deployment; Worker auth/secrets; account R2;
  broad prefix/glob delete; runtime probes; replacement source-text suite.
- **Order:** make producer/check DAG truthful; remove redundant writers/no-op;
  fix GitHub dependency inputs/conditional Bob build; add the apply-capable,
  dry-run-by-default Pages include operator and execute only its dry-run during
  local implementation; remove raw Widget mapping/route/preflight; add
  retained-root delta behavior; delete only named source-test noise while
  retaining behavior.
- **Generated effect:** no new semantic artifact; changes invocation only.
- **Tests/CI/docs:** non-writing worktree snapshot; exact `3W/4W` counts; focused
  and aggregate producer; root/app builds/typechecks; all surviving behavior;
  R2 dry-run/delta add-modify-delete-rename/failure; every workflow command;
  Pages config dry-run; `git diff --check`; exact manuals in M08.
- **Product data:** none. Local code does not apply Pages config, push, deploy,
  or delete R2 objects.
- **Later deploy/live evidence:** exact Git/Pages/Worker SHA, health, owning
  routes, and build counts. Exact Pages apply and 68-key R2 deletion remain
  separate release gates below.

Local execution record, 2026-08-22:

- one explicit Widget producer remains; `validate:widgets` compiles and
  serializes in memory and compares only the tracked compact Tokyo definition
  source, with a byte-for-byte worktree snapshot proving that check mode writes
  and deletes nothing;
- root lint invokes the producer zero times, root typecheck and build invoke it
  once through Roma's required clean-checkout lifecycle, and Roma's Pages build
  no longer runs a second explicit producer;
- the nonexistent CI test and the approved source/config-text test noise are
  deleted; the exact Tokyo-client failure, public-action, Save bridge, cache,
  publication, and materialization behaviors remain executable and pass;
- Roma and Worker workflow classifiers use rename-safe path sets; shared
  dependency changes select the exact affected Workers, Bob builds only for
  Bob/shared inputs, Prague retains full-sync behavior, and Dieter/font changes
  select exact delta sync;
- the Bob/Roma Pages operator is hard-limited to those two Git-connected
  projects, is dry-run by default, preserves all non-watch project truth, and
  read-checks exact state after apply. The authorized local run performed only
  the read-only dry-run and found the still-deployed `path_includes:["*"]`
  mismatch;
- the raw Widget R2 mapping, friendly route, Wrangler route, and FAQ-object
  preflight dependency are removed locally. Full dry-run now inventories 520
  retained Dieter/font/Prague objects; exact delta add/modify/delete/rename and
  failure propagation pass in isolated local fixtures. The existing 68 remote
  `product/widgets/**` objects were not touched;
- focused producer, behavior, workflow, R2, Pages dry-run, root lint/typecheck/
  build, Roma Pages build, formatting, and diff checks pass. Two independent
  read-only audits pass, including V1–V8;
- no commit, push, deployment, Pages apply, R2 write/delete, translation run,
  account read/write, or other product-data operation occurred.

#### M08 — Exact translation coordinate and current operator truth

Execution status: **CLOSED**

- **Frozen IDs:** S8-F01–S8-F12.
- **Exact outcome:** translation smoke requires one exact instance ID and has no
  fallback; current manuals describe only the settled repository lifecycle and
  truthful operator commands; raw Widget R2, second producer, mutating check,
  codebook, arbitrary Defaults owner, and historical closure prose disappear
  from current operator truth.
- **Preserved behavior:** the authorized Translation Agent operation/result/
  overlay/restoration contract; history remains in Execution Pipeline docs;
  current laws remain; Prague/DevStudio/public Widget copy remain excluded.
- **Owning authorities/allowed paths:** only
  `scripts/e2e/roma-translation-agent-runtime-smoke.mjs`; exact manuals listed
  in Slice 8, including README, CONTEXT, Tenets, Overview, AccountManagement,
  Supernova, Widget authoring/shared/per-Widget manuals, Bob/Roma/Tokyo,
  Cloudflare/Pages/Playwright, and runtime-materializer README.
- **Prohibited:** translation execution without a separate exact data approval;
  Prague/DevStudio code/config/manuals; public Widget copy; compatibility docs;
  permanent audit report/gate; target claims before matching implementation.
- **Order:** reject missing/whitespace instance input before auth/network;
  require exact authenticated-account membership before mutation; remove every
  fallback; reconcile manuals from settled M01–M07 truth; remove only current-
  manual history; run fresh-agent reconstruction.
- **Generated effect:** none. **Test/CI effect:** no new doc gate/harness/check
  mode; `node --check` and direct missing/whitespace pre-network rejection only.
- **Documentation effect:** exact settled lifecycle/commands/authorities; any
  still-gated deployed Pages/R2 difference is named explicitly instead of
  being presented as reconciled.
- **Product data:** none. Valid-coordinate generation is deferred to a separate
  explicitly approved smoke and is not required for local manifest closure.
- **Local checks:** every documented command exists; focused/all guidance is
  exact; validation is non-writing; search finds no retired claim/history; a
  fresh read-only agent reconstructs the settled repository lifecycle.
- **Later shipped-truth evidence:** after the separately authorized push and
  automatic rollout, exact Git/Pages/Worker/R2 read-back matches the manuals
  and their SHA is on `github/main`; any mismatch blocks release completion and
  is named rather than hidden.

Local execution record, 2026-08-22:

- the Translation Agent smoke has no hardcoded, Widget-type, or first-account-
  instance fallback. It requires one exact `E2E_TRANSLATION_INSTANCE_ID`,
  rejects absence or surrounding whitespace before auth-state or network work,
  and requires exact current-account inventory membership before generation;
- `node --check` passes. Direct missing and whitespace-modified executions each
  exit `1` with the exact coordinate error while an unreadable auth path is
  present, proving rejection precedes auth/network work;
- current manuals now reconstruct one Widget folder -> one producer -> selected
  Roma/Bob artifacts plus compact Tokyo Catalog truth -> New -> Bob browser-
  memory edit/preview -> Save -> Publish -> Tokyo atomic storage/serve;
- the operator map names mutating `pnpm generate:widgets`, non-writing focused
  and aggregate checks, exact Git-connected Pages/Worker paths, retained R2
  roots, and the separately authorized Translation smoke coordinate;
- `pnpm validate:widgets` passes without changing settled status or generated
  artifact bytes, every referenced exact root command exists, current-history
  searches and `git diff --check` pass, and two independent manual lanes plus
  the independent M08 V1–V8 audit pass;
- current manuals truthfully retain the still-unapplied Bob/Roma
  `path_includes:["*"]` and legacy remote `product/widgets/**` mismatches behind
  their separate release gates; and
- no valid Translation smoke, account read/write, commit, push, deployment,
  Pages apply, R2 write/delete, or other product-data/remote operation occurred.

#### M09 — Integrated local reconciliation

Execution status: **CLOSED**

After M01–M08 settle, the primary:

1. records the final changed/generated/deleted file inventory by manifest ID;
2. runs each entry's focused behavior checks at its material boundary;
3. runs one final all-five producer check, root lint/typecheck/build, Bob/Roma
   production builds, Widget Foundation/runtime materializer, Tokyo-worker and
   every surviving named behavior suite;
4. proves `pnpm validate:widgets` is non-writing from the settled worktree;
5. remeasures editor/materializer/Worker bytes, selected requests, producer
   invocations, and R2 dry-run inputs against the frozen baseline;
6. proves account/product data was never mutated;
7. runs `git diff --check` and confirms no unexplained worktree movement;
8. assigns a fresh read-only agent the complete settled diff and runs V1–V8;
9. corrects every blocker and repeats the affected checks/audit; and
10. returns the local implementation result to the owner without committing,
    pushing, deploying, applying Pages config, deleting R2 keys, or running the
    translation smoke.

Local execution record, 2026-08-22:

- the settled inventory against `dd8fe00e` contains 127 manifest-owned paths:
  104 modified, 15 deleted, and eight new. The new paths are this execution PRD
  plus seven package-wired behavior tests; no temporary report, probe, copied
  bundle, compatibility fixture, or WSSS execution scaffolding remains;
- production/tooling changed across 71 paths and is net **1,225 lines smaller**
  (`+1,610/-2,835`). Fifteen obsolete files are deleted. Behavior tests/smoke
  are net `+1,106` lines and current manuals are net `+217` lines. Excluding
  this execution PRD, the complete implementation/test/manual diff is net
  **+98 lines**; the remaining gross growth is current operator truth and
  replacement behavior coverage, while production/tooling itself is smaller;
- every current Widget passes its focused non-writing producer check. One
  aggregate `pnpm validate:widgets` run leaves the complete status, generated
  artifact hashes, and temporary-output snapshot byte-identical;
- every surviving Bob, Roma, Tokyo-worker, runtime-materializer, policy,
  San Francisco, and Berlin behavior/authority command in the settled workflow
  graph passes. Root lint, typecheck, and build; Bob and Roma production Pages
  builds; changed-script syntax/format checks; and `git diff --check` pass;
- editor artifacts fall from 5,881,978 to 5,843,137 raw bytes and from 392,307
  to 384,230 gzip-9 bytes. Materializer artifacts fall from 623,329 to 575,076
  raw bytes and from 101,840 to 91,477 gzip-9 bytes;
- the measured Tokyo-worker bundle falls from 424,256 to 227,263 unminified
  bytes and from 250,904 to 135,800 minified bytes. The tracked compact Catalog
  source falls from 1,775 to 817 bytes; its former full-definition contribution
  falls from 115,238 to 314 minified bundle bytes;
- Roma's production output contains exactly five selected materializer static
  assets and no materializer payload in an Edge function. Behavior evidence
  proves one exact selected materializer read, selected New without a definition
  collection read, one Tokyo account-facts request, and one selected editor
  artifact in Widget Defaults;
- the retained-root R2 dry-run falls from 588 to 520 inputs: 165 Dieter, seven
  fonts, and 348 Prague objects. An isolated disposable fixture proves exact
  add/modify/delete/rename delta behavior, failure propagation, and zero Prague
  delta operations; the fixture was removed completely and used a fake failing
  writer, so no remote call occurred;
- local `main`, local `github/main`, and the immutable code baseline remain
  `dd8fe00eb77598d821d128b334d79463cfc6c83f`. No account or product data was
  read or written; and no commit, push, deploy, Pages apply, R2 remote write or
  deletion, valid Translation smoke, Save, Publish, or Republish occurred; and
- the final independent whole-diff audit reconciles every manifest path,
  generated/build output, preservation boundary, and measurement without a
  blocker. V1–V8 all pass.

#### Separate release and managed-service gates

Approval of WSSS-v2 authorizes none of these automatically:

| Gate | Exact action | Required fresh authorization/evidence |
| --- | --- | --- |
| `R1` | Commit the settled M01–M09 diff on `main`. | **Complete.** The owner approved committing the exact final inventory after local PASS; the documentation correction is folded into that one local commit before push. |
| `R2` | Push `main` to `github/main` **and thereby authorize its unavoidable automatic Git-connected Bob, Roma, Tokyo-source, Prague, and DevStudio Pages builds; Berlin, San Francisco, Tokyo-worker, Product Copilot, and Translation Agent Worker deployments; and the full 520-object retained-root R2 sync (165 Dieter icons, seven fonts, 348 Prague objects) selected by the settled workflow**. | **Owner-authorized for this release.** Pre-push SHA/worktree, exact workflow inputs, all five Pages projects, all five Workers, and retained Dieter/font/Prague roots are recorded. This gate never authorizes account data, Pages configuration mutation, the legacy raw-Widget R2 deletion, or a zone-route mutation. |
| `R3` | Read-only reconciliation of GitHub; all five Pages projects; Berlin, San Francisco, Tokyo-worker, Product Copilot, and Translation Agent; the selected retained-root R2 sync; Tokyo's canonical `/product/widgets/**` source projection; the obsolete `/widgets/**` route result; owning live surfaces; and documentation truth after R2. | Exact commit SHA everywhere; successful workflows; canonical/commit-specific reachability; retained Dieter/font/Prague roots read back; docs at the same `github/main` SHA; no product-data mutation. |
| `R4` | Apply Bob/Roma `path_includes` through `cf:pages:sync-bob-roma-build-watch --apply`. | Separate managed-config approval after dry-run; exact two-project target; patch-only read-back; no Prague/DevStudio. |
| `R5` | Delete the frozen exact 68-key `product/widgets/**` R2 inventory. | New Worker code first deployed and verified to return 404 for obsolete `/widgets/**`; separate explicit R2 approval; exact-key deletion only; zero prefix on read-back; Dieter/font/Prague unchanged; `accounts/**` and canonical Tokyo Pages source never targeted. The existing zone binding may remain and R5 does not mutate it. |
| `R6` | Run Translation Agent smoke on one named instance. | Separate product-data approval naming exact account/instance, expected overlays, restoration method, and post-run reconciliation. Not required for this code release. |

The local implementation approval phrase for this manifest is explicit:

> Approve WSSS-v2 for local implementation through M02–M09 only.

Anything less specific leaves implementation unauthorized. The owner later
authorized `R1` and then said to continue with `R2` after the exact automatic
rollout and Tokyo source distinction were explained. `R3` is the required
read-only reconciliation. `R4`–`R6` remain separately gated and unauthorized.

Independent WSSS-v2 technical-refreeze audit: **PASS**. The selected Pages-
asset mechanism preserves the exact authority and product outcome. The approved
local M02–M09 implementation is closed; the current release status is recorded
in the gate table above.

## 14. Performance Law For The Audit

The audit does not use the impossible claim that performance can never be
improved. It proves and removes current waste.

The target scaling model is:

| Operation | Allowed relationship to Widget count |
| --- | --- |
| Open/edit/preview one Widget | Cost of selected Widget plus shared editor/runtime code; not total catalog size |
| First/later Save one Widget | Cost of selected instance and selected Widget source contract; not total catalog size |
| Publish one Widget | Cost of selected saved instance, selected materializer artifact, and shared materializer code |
| Public serve one Widget | Cost of stored selected package/overlay; independent of source catalog size |
| Catalog list | Linear in compact catalog summaries because the product asks for the catalog |
| Widget Defaults | Cost of system-owned common controls plus one selected Widget's Core/editor artifact; not total catalog size |
| All-Widget source production | Linear once in the Widget set when the operation intentionally builds all Widgets |
| Validation | Read-only proof of current generated truth; it must not regenerate first and then claim the result was already current |
| CI/deploy | Each required producer/check/deploy operation once per owning workflow unless evidence proves another invocation is necessary |

No permanent cache, registry, loader, incremental framework, or performance
test is authorized merely because a measurement is large. The slice plan must
first prove the current bottleneck and the smallest correction through existing
authorities.

## 15. Verification Law

The final per-slice checks are not known until the audit identifies the exact
blast radius. Every frozen plan must nevertheless include:

- focused checks for the changed producer/consumer;
- all five current Widgets after a shared change;
- deterministic generated-artifact verification after a producer change;
- Bob/Roma/widget-foundation/Tokyo-worker type and behavior checks only where
  touched;
- raw materialized HTML/CSS/JavaScript inspection when package production
  changes;
- `git diff --check`;
- current-manual reconciliation; and
- independent V1–V8 review.

Do not add source-text compliance tests, temporary CI gates, runtime probes, or
permanent audit reports to enforce prose architecture. Durable tests must prove
real product behavior at the owning boundary.

## 16. Release And Product-Data Gates

Audit and planning are read-only.

Code implementation, commit, push with its automatic deployment consequences,
managed-service mutation, and product-data mutation are separate stages with
separate authority. Approval of the final implementation manifest authorizes
only the specified local code/document/generated-artifact changes. It does not
authorize commit, push, automatic deployment, managed-service mutation, or
product-data mutation.

When each later stage is explicitly authorized:

1. code changes occur only on the documented branch/deploy model;
2. generated artifacts change only through their producer;
3. the authorized push to `main` explicitly includes the unavoidable
   Git-connected Bob, Roma, Tokyo-source, Prague, and DevStudio Pages builds
   and the applicable GitHub Worker workflows;
4. that same push authorization names any retained-root R2 sync the settled
   Worker workflow can select; raw-Widget R2 deletion remains a separate exact
   managed-service gate;
5. exact local, remote, CI, Pages, Worker, and R2 SHAs are reconciled;
6. runtime verification uses the owning cloud-dev surface; and
7. any disposable account-instance operation has an explicitly authorized
   coordinate and exact restoration plan.

Commit authorization does not imply push authorization. Because this repository
deploys from `main`, there is no fictitious stop between a push and the
Git-connected Pages/Worker work that it automatically triggers: the `R2` push
authorization must explicitly authorize those named automatic effects or the
push does not occur. That combined authorization does not imply Pages
configuration mutation, legacy raw-Widget R2 deletion, Translation Agent
execution, or another product-data operation. Every reconciliation reports the
last stage actually authorized and performed.

Deploying Widget software does not mutate already-stored public packages.
Republish is a product-data command and never an automatic deployment side
effect.

## 17. V1–V8 Simplification Audit

Every frozen plan and every settled implementation must answer:

| ID | Simplification-specific audit |
| --- | --- |
| V1 | Did deletion cause missing Widget truth to be replaced by a generic or selected default? |
| V2 | Did the simpler path normalize or rewrite source, saved state, identity, or generated output? |
| V3 | Did deletion omit required Widget declarations, shared capabilities, generated members, events, or deploy inputs? |
| V4 | Did removing a guard also remove real ingress, authentication, authorization, producer completeness, or storage safety? |
| V5 | Did the new path treat corrupt or legacy stored state as absent/new and overwrite it? |
| V6 | Does the shared result truly work for all five Widgets, or does it silently complete only a subset? |
| V7 | Was removed machinery recreated under another wrapper, registry, loader, adapter, or name? |
| V8 | Does normal product work now depend on a check, probe, generated report, audit file, or test ritual? |

## 18. Completion Criteria

The PRD becomes implementation-ready only when:

- Slices 0–8 have completed audits;
- every actionable finding has exact current/reachable evidence;
- every owner decision is recorded;
- every slice has an exact independently audited execution plan or an explicit
  no-action result;
- every slice is frozen;
- the final manifest contains no unresolved placeholder or speculative
  machinery; and
- the owner authorizes code execution.

The eventual implementation is complete only when:

- every final manifest entry is closed;
- all five current Widgets retain exact intended behavior;
- shared services remain Widget-neutral;
- selected-Widget operations no longer perform proved accidental catalog-wide
  work;
- proved duplicate, superseded, no-op, and dead machinery is deleted;
- generation, validation, build, CI, and deployment have one truthful operator
  path each;
- owning manuals match the shipped system;
- focused and final checks pass;
- independent V1–V8 passes;
- commit/push/deploy/live state is explicitly reconciled when authorized;
- product-data state is explicitly unchanged or exactly restored; and
- temporary raw evidence and execution scaffolding are removed.

## 19. Release Handoff At Commit Formation

M01 through M09 are closed. The complete local implementation, measurements,
cleanup inventory, focused and integrated checks, and independent whole-diff
V1–V8 audit pass. `R1` is complete on local `main`. The owner explicitly
authorized `R2` after the full automatic rollout and the distinction between
Tokyo Pages canonical `/product/widgets/**` source and the redundant
Tokyo-worker/R2 `/widgets/**` mirror were explained.

At the time this commit is formed, the next action is the authorized `R2` push
followed by the required read-only `R3` reconciliation across GitHub, all five
Pages projects, all five Workers, the full retained-root sync, and the owning
live surfaces. `R4` Bob/Roma Pages
configuration apply, `R5` exact 68-key legacy R2 deletion, and `R6` Translation
Agent product-data smoke remain separately gated and unauthorized.
