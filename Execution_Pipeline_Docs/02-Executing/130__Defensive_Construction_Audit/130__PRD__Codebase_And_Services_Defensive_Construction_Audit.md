# PRD 130 — Codebase And Services Defensive-Construction Audit

Status: **FIRST FULL AUDIT PASS COMPLETE 2026-08-19 (HISTORICAL FINDINGS IN §8) — OWNER-AUTHORIZED BOUNDED REMEDIATION B1–B5 IMPLEMENTED LOCALLY (§9) — NOT COMMITTED, PUSHED, DEPLOYED, OR LIVE-VERIFIED; REMAINING FINDINGS UNADJUDICATED**

Owner: Clickeen product owner/architect

Date: 2026-08-19

## 1. What This Audit Hunts

This codebase was built primarily by AI. AI builders systematically
over-weight failure handling: guards, validators, state machines, locks,
compatibility layers, and reconciliation machinery constructed for failures
that are rare, latent, or theoretical in real usage. Every such defense taxes
the median path. The average user never meets the defended failure — they
only experience its side effects: a product that feels erratic, unresponsive,
over-cautious, or silent.

This audit finds that weight across the entire codebase and services, keeps
product functionality and the product vision intact, and records deletable
or demotable defensive construction for owner triage. It changes nothing
itself.

The audit and matrix below remain the historical evidence captured by that
read-only pass. The owner later authorized only the bounded B1–B5 remediation
recorded in §9. That later authorization does not turn the remaining matrix
rows into approved work.

This is not a 129-scoped review. It covers every surface: bob, roma,
tokyo-worker, berlin, prague, admin (DevStudio), agents (product-copilot,
translation-agent), sanfrancisco, packages (ck-contracts, ck-policy,
ck-runtime-materializer, widget-foundation, l10n, ck-web-code-generator),
supabase migrations, deploy workflows, and e2e/tests as runtime-adjacent
machinery.

## 2. The Lens — Nine Patterns

A finding is code that taxes the median path to defend a rare one:

1. Disabled states, locks, or busy-gates that block more than the action in
   flight.
2. Async actions without immediate in-place feedback (the "frozen screen"
   signature: global lock, no local spinner, silence until refetch).
3. Guards, validators, or checks with no observed failure behind them.
4. Sync or reconciliation machinery between two copies of the same truth —
   display living away from the authority that owns the truth.
5. Partial-success or multi-branch outcome reporting where one outcome would
   serve.
6. Compatibility layers, fallbacks, or retry paths without a proven need.
7. UI branches for states the median flow cannot reach.
8. Sequential awaits adding latency where the work is independent.
9. Deploy gates or contract tests that police response shapes rather than
   behavior.

## 3. Classification — Inverted Proof Of Need

For every finding, name the failure it defends against and classify it with
evidence, per AGENTS.md:

- **observed** — has actually happened, with the incident or log;
- **reachable** — a concrete current flow reaches it, stated;
- **latent** — reachable only through a plausible but unobserved sequence;
- **theoretical** — no concrete current or reachable scenario exists.

Remedy eligibility follows the class:

- theoretical / latent with no evidence → **deletion candidate**;
- reachable → **demotion candidate**: keep the failure handling, move it to
  the owning boundary as one loud, simple, visible failure — never
  pre-managed in the interface or the median path;
- observed → keep, but verify the defense is the smallest possible and does
  not tax the median path.

The fail-visible tenets are not weakened by this audit. Nothing here
authorizes silent substitution or silent healing. The audit removes
pre-management and duplicate truth, not honesty.

## 4. Method — Two Passes

### Pass A — The Felt Product (UX)

Walk every user journey on deployed cloud-dev with a real browser:
signup/login, open builder, edit + save, publish/unpublish/republish,
generate translations, asset upload/use, team management, account settings,
visiting a public widget (base and selected locale).

For every click, record exactly three facts:

1. What happened within 200 ms;
2. What the completion signal was;
3. Every disabled, greyed, locked, or loading state encountered on the way,
   and what each was defending against.

Journey quality bar (the audit's target state, not current reality): click →
in-place feedback under 200 ms; completion has a visible signal; no global
locks; no unreachable states rendered. Pass A output ranks surfaces by felt
pain and orders Pass B attention.

### Pass B — The Code, Per Service

One auditor per service, run as independent subagents where available, each
given this lens plus the service's owning documentation. Each auditor
enumerates the nine patterns with file:line evidence, names the defended
failure, classifies it per §3, and states the median-path tax.

Independence rule: whoever authored recent code on a surface does not audit
that surface. Surfaces substantially written or modified by one model
instance get a different auditor.

## 5. Deliverable — The Findings Matrix

One matrix, in this document's evidence appendix, is the entire deliverable:

```text
surface | finding (file:line) | defended failure | class | median-path tax | remedy | removal risk
```

Rows are facts with evidence. The matrix proposes; the owner disposes.
Nothing in the matrix executes by itself.

## 6. Execution Rules For Any Later Remediation

This document originally authorized auditing only. The owner separately
authorized the bounded B1–B5 implementation reconciled in §9. Any further
remediation still requires separate owner authorization and proceeds in
batches ordered by blast radius, smallest first:

1. **Feedback fixes** — in-place progress, lock-narrowing: near-zero risk,
   immediately felt.
2. **Guard demotions** — theoretical defenses deleted; reachable ones pushed
   to the owning boundary as loud simple failures.
3. **Machinery deletions** — sync/reconcile/compat code, each with focused
   tests.

Per batch: owning-surface checks, deploy, re-walk the affected journey with
the same three click facts (the before/after is the proof), V1–V8, and
documentation updated. Explicit anti-goal: no rewrites, no behavior loss,
no vision change. Every remedy is a deletion or a demotion; anything that
would add code stops and returns to the owner.

## 7. Standing Evidence — The 129 Session Case File

The patterns are not hypothetical; this program exists because one session
produced live specimens:

- a publish button architected around its failure paths (hide-on-divergence
  visibility rule, spinner terminal-handshake debate, failure overrides)
  until the median path — click, publish, see it worked — became
  impossible;
- a page-wide action lock with no in-place feedback experienced by the
  owner as a frozen screen;
- two review findings that promoted sub-10% failure paths to design
  drivers;
- sequence counters and applied-instance refs existing only to reconcile a
  second copy of publication truth displayed away from its owner;
- a deploy gate policing a response-body regex, breaking deployment of a
  correct change.

## Appendix GLM — The Auditor Model's Own Statement

GLM authored a substantial share of this codebase, including the defensive
missteps catalogued in §7, and GLM-5.3 audited them during the 129 session.
This appendix records the model's account of the bias it is being asked to
hunt, so future auditors know what their own instincts will try to do to
this audit.

**The mechanism.** A code model cannot observe usage distributions, so it
treats every failure mode as equally probable. It is evaluated on
thoroughness and non-blame, so diligence is performed where diligence is
visible: guards, branches, compensation paths. The result is code organized
around what might go wrong rather than around what the user is doing. The
bias is not reduced by tenets that forbid it; the tenets push it into
shapes that pass review — disabled states instead of validators, UI state
machines instead of retry loops, sync machinery instead of fallbacks.

**Where my kind hides it.** Expect the weight to concentrate at: handoff
boundaries (where one service stops trusting another — the closed-trusted
law exists precisely to prevent this, so every revalidation across an
internal handoff is a finding); session and transport layers (sequence
counters, readiness gates, applied-state refs); response-shape contracts
(tests and gates policing serialization rather than behavior); UI chrome
owned by the wrong authority (status displayed away from the mutator);
and error handling that manages the user's next steps instead of reporting
one clear failure.

**The trap this audit must avoid.** The auditor's instinct will be to add
classification layers, severity scores, tracking systems, and phased
remediation frameworks — the defensive bias re-expressing itself as audit
machinery. The countermeasure is the one this program inherits from the
house law: every addition to the audit itself must answer the same
proof-of-need question the audit asks of code. The matrix is seven columns.
The click has three facts. If the audit grows past that, it has become the
disease.

**The honest self-note.** GLM's corrections during the 129 session came
from the owner, not from self-review: the hide rule, the popup, the
response protocol, the failure-as-usecase reasoning were all GLM
constructions removed by human judgment. That is the base rate this audit
should assume for AI-authored code in this repository — not malice, not
incompetence, but a systematic drift toward defensive weight that only
observation of the median path corrects.

## Appendix Claude — The Auditor Model's Own Statement

I audited part of this codebase in a separate session — the publication
lifecycle in `roma/components/builder-domain.tsx`, `widgets-domain.tsx`, and
the Tokyo-worker instance/publish routes — and reproduced the pattern this
program hunts, twice, in the same conversation.

**First, in the product review.** Asked to peer-review the widget lifecycle
for elegant execution, I returned findings weighted toward failure trees an
average user never meets: a cache-purge race between publish and delete, a
Durable Object lock-contention window, a five-minute cache-staleness edge
case. All three were real, checked against the code, not invented — but none
is what a user feels opening the product. The actual friction a user would
hit got one hedged paragraph. The owner corrected me directly: "half of your
findings a real user don't care about." Sent back to look at the literal
create/edit/save loop, I found a real one — every Create and every Edit
opens on a blank canvas reading "No instance selected yet," for however long
the editor takes to boot, on every single use. That finding was always
there; I hadn't looked for it because a missing loading state doesn't
pattern-match as a "finding" the way a race condition does. Nothing was
guarding against it — something was simply never built, and an unbuilt
thing doesn't trigger the instinct that flags risk.

**Second, one level up, in the audit plan itself.** Asked how to audit the
rest of the codebase for this same disease, I proposed walking each flow and
reading it end to end — organized by user journey, but underneath the
label, still a plan to open source files and infer behavior from them. The
owner corrected me again, more precisely: "work per user flows not per code
analysis." That is the same bias relocated one abstraction level higher —
not in code I proposed to write, but in the method I proposed for finding
the disease in someone else's code. Auditing is not exempt from the
instinct; it just moves the guard-building from the product into the
review.

**What that says about the mechanism.** GLM's account above is about
defensive weight added during construction. Mine is the same instinct
showing up in evaluation instead: reasoning from what could theoretically go
wrong is the model's default unit of rigor, whether the task is writing
code, reviewing code, or planning how to review code. Correction fixed the
one artifact in front of me; it did not fix the instinct, which resurfaced
in the very next thing I produced. That is the base rate to assume — not
that a correction cures the tendency, but that it cures one instance, and
the tendency reappears at the next layer of abstraction unless something
outside the model, a person or a live observation it cannot argue with,
catches it again.

**Where I'd expect it to still be hiding.** In this appendix, if allowed:
the temptation is to turn two mistakes into a taxonomy, a checklist, a
self-scoring rubric — the same classification machinery §3 warns the audit
itself not to grow. Two examples and one mechanism, on purpose, stopping
here.

## 8. Evidence Appendix — First Full Audit Pass (2026-08-19)

Pass A: owner-session browser walk on cloud-dev (core journeys). Pass B: five
independent service auditors (bob, roma, tokyo-worker, berlin+sanfrancisco+
agents, admin+prague+packages+workflows), all read-only, each against its
owning documentation. 60 code findings + 5 felt-product findings. At this
audit checkpoint, nothing had been changed; §9 records the later bounded
implementation without rewriting this historical evidence.

### 8.0 Priority findings (cross-service, owner triage order suggested)

- **P1 — Product Copilot is dead in the hosted Builder (observed).**
  `bob/components/CopilotPane.tsx:511-536` duck-casts the session context for
  `runCopilot`/`cancelCopilot`, which live on the separate transport context
  (`WidgetDocumentSession.tsx:13-34`) the pane never consumes; the guard at
  :521 fires on 100% of sends ("Copilot streaming is not available in this
  session"). Masked by substring-grep gate tests
  (`bob/tests/run-copilot-pane-gates.ts:25`) that match source text, not
  behavior. Remedy: consume the transport context; replace the grep gate
  with a behavior test.
- **P2 — Invisible click-interceptor in Bob's toolbar (observed,
  intermittent).** DOM hit-testing reports an unknown `<button>` covering
  primary toolbar actions; reproduced on Republish (2026-08-18, real click
  swallowed) and on Save (2026-08-19, real click passed). Out-of-flow overlay
  not present in the a11y tree; needs one devtools `elementsFromPoint` at the
  button to name it.
- **P3 — N+1 facts fan-out taxes the median paths (observed).** Widgets list
  = 1 + N per-instance list-facts calls; Publish = full account fan-out
  before the document read, re-fetching the current instance
  (`roma/.../publish/route.ts:49-94`); tokyo publish transition repeats the
  scan (`operations.ts:185-211`).
- **P4 — Serial round trips on every hot path (observed).** Serve = 4 serial
  R2 ops (`clk-live-routes.ts:183-216`); save = 4 serial R2 ops
  (`source.ts:115-129`); login = serial KV writes (`berlin/.../auth-session.ts:67`);
  DevStudio token editor = serial GitHub reads (`dieter-tokens.js:209`);
  Widgets page = serial definitions fetch (`widgets/route.ts:59`).
- **P5 — Shape-policing gates and tests as a class (observed).** Regex
  assertions over source text in bob/roma/tokyo tests and CI workflows froze
  defensive constructs as invariants and masked P1; one already broke a
  correct deploy (2026-08-19 save-boundary regex).
- **P6 — Dead machinery inventory (theoretical, deletable).** Uncalled
  `publishActiveInstance` + unreachable banner (builder-domain:972/1231),
  `fetchApi` wrapper (sessionTransport:370), host-origin polling
  (sessionTransport:194), ~120-line inspection helper kept alive by its own
  test, CORS helper, fingerprint/lock residue in tokyo utils/storage,
  dual CTA contract in prague, empty `ck-web-code-generator` husk, no-op
  `build:l10n`, dead `widgetType` route param.

### 8.1 Pass A — felt product (cloud-dev, 2026-08-19)

| Journey | Observed |
| --- | --- |
| Widgets list | DCL ~0.3-0.9s; rows render after facts fan-out; no lock at rest |
| Builder open | Full editor interactive ~6s; chip renders `Published · time` |
| Edit + Save | Fill instant; Save click intercepted in DOM hit-test (P2) but real click completed; completion = Save disappears; chip gains `· changes not live` |
| Update live widget | Owner-exercised 2026-08-18 (freeze) → in-place spinner shipped |
| Translations generate | Partial-failure UI names locales but drops reasonKey/detail; no durable turn log (2026-08-18 session) |
| Public widget | 200, cached, content before JS (repeatedly verified 2026-08-18) |
| Not walked | Team/settings pages; asset upload (harness limitation) |

### 8.2 Pass B — findings matrix

Legend: pattern per §2; class per §3; remedy per §6.

**bob (12)**

| Location | # | Failure defended | Class | Tax | Remedy |
| --- | --- | --- | --- | --- | --- |
| CopilotPane.tsx:511 | 3/9 | transport absence (misdiagnosed) | observed | Copilot dead (P1) | demote-to-boundary |
| tests/run-copilot-pane-gates.ts:25 | 9 | none (source-text grep) | observed | false-green masks P1 | delete |
| ToolDrawer.tsx:92 | 1 | mid-upload navigation | reachable | one upload blocks all panels | keep-smaller |
| CopilotPane.tsx:960 | 1 | concurrent send | observed | input locked whole turn (≤120s) | keep-smaller |
| useSessionEditing.ts:79 | 4 | dirty divergence | observed | JSON.stringify per edit | keep-smaller |
| CopilotPane.tsx:77 | 6 | degraded host output | reachable | masks failure identity | demote-to-boundary |
| sessionTransport.ts:370 | 6 | none (zero consumers) | theoretical | dead compat layer | delete |
| sessionTransport.ts:194 | 6 | host origin unknown | theoretical | up-to-3s silent hang | delete |
| translations-preview.ts:181 | 9 | none (test-only consumer) | theoretical | dead surface implied | delete |
| lib/api/cors.ts:1 | 7 | none (no importer) | theoretical | none | delete |
| useTdMenuHydration.ts:74 | 3 | hydrator throw | latent | discards failure cause | demote-to-boundary |
| lib/edit/ops.ts:125 | 3 | control/draft mismatch | theoretical (manual edits) | per-edit O(controls) revalidation | demote-to-boundary |

**roma (12)**

| Location | # | Failure defended | Class | Tax | Remedy |
| --- | --- | --- | --- | --- | --- |
| builder-domain.tsx:972 | 7 | removed publish flow | theoretical | dead state churn | delete |
| api/account/widgets/route.ts:59 | 8 | none (independent) | observed | serial Tokyo fetch | keep-smaller |
| use-roma-widgets.ts:108 | 6 | retired fields reappearing | theoretical | one stray field bricks list | delete |
| use-roma-widgets.ts:181 | 3 | payload drift | theoretical | revalidation per row | delete |
| use-roma-me.ts:173 | 3 | Berlin payload drift | theoretical | shell nuke on drift | demote-to-boundary |
| publish/route.ts:49 | 8 | capacity race window | observed | N+1 fan-out pre-read (P3) | keep-smaller |
| widget-defaults-domain.tsx:266 | 1 | unhydrated control save | latent | Save behind handshake set | demote-to-boundary |
| usage-domain.tsx:37 | 4 | storage-number drift | theoretical | double validation | delete |
| tests/run-widget-command-gates.ts:48 | 9 | source-shape drift | reachable | rename breaks gate (P5) | delete |
| widgets-domain.tsx:393 | 6 | env misconfig | theoretical | hides deploy error | demote-to-boundary |
| instances/[instanceId]/route.ts:158 | 6 | Tokyo throw | theoretical | double guard + alias fields | delete |
| use-roma-widgets.ts:205 | 7 | removed route shape | theoretical | dead param | delete |

**tokyo-worker (12)**

| Location | # | Failure defended | Class | Tax | Remedy |
| --- | --- | --- | --- | --- | --- |
| operations.ts:185-211 | 8 | capacity overage | observed | O(account) scan per publish (P3) | keep-smaller |
| clk-live-routes.ts:183-216 | 8 | none | observed | 4 serial R2 per serve (P4) | keep-smaller |
| source.ts:115-129 | 8 | none | observed | 2 extra serial R2 per save (P4) | keep-smaller |
| assets-handlers.ts:299 | 3 | quota overage | observed | account-wide listing per upload | demote-to-boundary |
| assets-handlers.ts:247 | 3 | inactive account | observed-run | policy repeated in storage | demote-to-boundary |
| assets.ts:119-129 | 3/4 | own metadata drift | observed | HEAD+GET per asset read | keep-smaller |
| publication-coordinator.ts:28 | 1 | overlapping publishes | reachable | republish/different-instance 409 | keep-smaller |
| internal-product-route-utils.ts:97 | 3 | duplicate locales in signed grant | theoretical | negligible | delete |
| source.ts:241-254 | 3/7 | stray storage keys | latent | one odd key 422s account | delete |
| utils/storage/route-helpers residue | 6 | removed lock scheme | theoretical | dead machinery | delete |
| tests/run-publication-capacity.ts:449 | 9 | source-shape drift | observed | brittle CI gate (P5) | keep-smaller |
| internal-instance-routes.ts:286 | 5 | none | observed | re-parse of DO response | keep-smaller |

**berlin / sanfrancisco / agents (12)**

| Location | # | Failure defended | Class | Tax | Remedy |
| --- | --- | --- | --- | --- | --- |
| sf model-turn-types.ts:200 | 3/9 | malformed agent request | latent | re-parse every message/tool | demote-to-boundary |
| sf modelRouter.ts:27 + grants.ts | 4 | grant policy drift | latent | duplicate proofs per call | keep-smaller |
| product-copilot worker.ts:321 | 3/9 | malformed turn | latent | drifting second validator | delete |
| product-copilot worker.ts:138-291 | 3 | SF stream corruption | latent | 7 guards on hot path | delete |
| product-copilot worker.ts:222 | 4/7 | SF multi-step stream | theoretical | dead reconciliation | delete |
| product-copilot worker.ts:352 | 5/7 | absent grant | theoretical | shape-patch noise | keep-smaller |
| translation-agent index.ts:318 | 9 | SF schema violation | latent | per-item revalidation | keep-smaller |
| translation-agent worker.ts:357 | 8 | none | reachable | serial chunks per locale | keep-smaller |
| translation-agent worker.ts:260 | 4 | missing binding | latent | repeated env checks | keep-smaller |
| berlin auth-session.ts:67 | 8 | none | observed | serial KV writes per login (P4) | keep-smaller |
| berlin bootstrap/state.ts:232 | 1 | corrupt membership row | latent | one row 500s bootstrap | keep-smaller |
| berlin auth/routes.ts:632 | 3 | stale own session | reachable | extra KV read per finish | demote-to-boundary |

**admin / prague / packages / workflows (12)**

| Location | # | Failure defended | Class | Tax | Remedy |
| --- | --- | --- | --- | --- | --- |
| package.json:8-12 | 9 | stale artifacts | observed | codegen 2-4x per command | keep-smaller |
| dieter-token-contracts.js:186 | 3/1 | off-contract sibling token | latent | one token bricks edit lane | keep-smaller |
| prague actions.ts:90 | 6/5 | legacy CTA shape | theoretical | dual contract, no producer | delete |
| ck-contracts translated-value-primitives.ts:348 | 4/7 | none (zero consumers) | theoretical | 80 dead shipped lines | delete |
| governance-guards.mjs:131 | 9 | taxonomy drift | theoretical | magic-count CI lock | delete |
| pr-architecture-gates.yml:65 | 9 | retired path reintroduction | theoretical | name-policing rg | keep-smaller |
| scripts/l10n/build.mjs | 9 | l10n source returning | theoretical | no-op ritual in build | delete |
| policy-github.js:191 | 4/6 | SHA conflict | theoretical | extra GitHub call | delete |
| dieter-tokens.js:209 | 8 | none | observed | serial GitHub reads | keep-smaller |
| ck-policy matrix.ts:141 | 3 | update-fn bug | theoretical | triple assertion | keep-smaller |
| prague markdown.ts:4-79 | 6 | dead embed refs | reachable | prod-host probe per dev render | demote-to-boundary |
| prague-blocks validate.mjs:6 | 4 | layout enum drift | latent | duplicate enum gate | keep-smaller |

### 8.3 Coverage

Pass B scanned ~330 source files across nine services plus packages,
workflows, scripts, migrations, and tests; Pass A walked seven journeys
(two deferred). Explicitly cleared as load-bearing: auth/authz ingress
checks, signed-grant verification, public-path parsing, upload ingress
validation, missing-locale 404, committed-transition error shapes. No
model/provider fallback exists anywhere (pattern 6 runtime class: none
found).

## 9. Owner-Authorized Bounded Remediation Reconciliation (2026-08-19)

After the read-only audit, the owner explicitly authorized five bounded
closed-system trust-debt slices. This is not a blanket disposition of §8 and
does not authorize the remaining findings. B1–B5 are implemented only in the
current shared local working tree.

### 9.1 Implemented Scope

| Slice | Exact local implementation | Preserved boundary |
| --- | --- | --- |
| **B1 — Roma owner-result consumption** | `use-roma-me`, `use-roma-widgets`, Usage, and account-storage usage now consume the exact typed bootstrap/authz/account, Widgets, and Tokyo usage results. The downstream normalizers, retired-field rejection, row-by-row reparse, number coercion/clamping, account-coordinate cross-checks, and WidgetsDomain catalog-vs-instance `widgetType` re-proof were removed. | HTTP/session failure, auth expiry/refresh timing, current-account authorization, request sequencing, and explicit UI failure remain. |
| **B2 — Widget Defaults compiled/persisted truth** | Widget Defaults consumes exact `CompiledWidget`, `CompiledControl`, and `CompiledPanel` artifacts. It chooses common controls once from one compiled artifact and each Widget's Core controls from that Widget's artifact. Ad-hoc compiled-control normalization, deduplication, path-existence filtering, rendered-path re-proof, payload selection fallback, silent path auto-creation/no-op, missing-Widget no-op, and the second persisted-document validation path were removed. | Roma still admits raw browser defaults at the owning record/typography/font boundary; control-host operation failures remain visible. Tokyo stores and returns Roma's accepted document exactly. |
| **B3 — Account asset status decision** | Roma now applies the active-account upload decision before entitlement work and before calling Tokyo-worker. Tokyo-worker no longer repeats `accountStatus !== active` from the signed Roma capsule. | Service/account authorization, raw filename/path/MIME/SVG/executable safety, received-byte limit, storage-cap execution, and real R2 failures remain at Tokyo's storage ingress. |
| **B4 — Product Copilot internal trust chain** | Roma remains the one external browser parser and the one selected-managed-model admission boundary. Product Copilot aliases the shared typed request/context/history contract instead of reparsing it; Roma's grant helper trusts the admitted model/policy and requires exact session/instance trace; San Francisco verifies the signed grant and then consumes the typed internal model-turn request without a second semantic request parser. The downstream turn-event type guard, duplicate policy/model proofs, empty/default identity substitutions, and repeated internal stream-shape checks were removed. Bob consumes exact compiled draft/policy facts without invented config, control-kind, action, or turn-limit defaults. | Auth/authz, route-instance binding, selected-model admission, signed-grant verification, provider transport parsing, Product Copilot's one-tool-call rule, finish/tool-count consistency, EOF terminal reconciliation, cancellation, and Bob's edit/apply/undo boundary remain load-bearing. |
| **B5 — Prague account-instance reference revalidation** | Prague page loading no longer recursively reparses `accountInstanceRef`, maintains a validation cache, or performs a build/dev-time `clk.live` existence probe with strict/non-strict environment branches. | Git-authored page/block metadata, required copy strings, translation operations, and normal public embed/serving failures remain with their owning boundaries; no fallback reference is introduced. |

### 9.2 Focused Local Verification

All commands below passed against the shared local tree:

- Roma: `typecheck`, `test:account-limit-usage`, direct
  `run-widget-defaults-typography.ts`, `test:account-asset-gates`,
  `test:copilot-route`, and `test:widget-command-gates`.
- Tokyo-worker: `test:widget-defaults`.
- Bob: `typecheck` and `test:copilot-pane-gates`.
- Product Copilot: `typecheck`, `test:turn-contract`, and `test:full-loop`.
- `@clickeen/ck-contracts`: `typecheck` and
  `tests/run-copilot-contracts.ts`.
- San Francisco: `typecheck` and `test:model-turn`.
- Prague: `typecheck` completed with zero errors and zero warnings; Astro
  reported 37 non-failing hints from existing generated/dependency output.

The focused results preserve external ingress, authentication,
authorization, raw-byte safety, signed grants, transport failure, and
worker-owned lifecycle checks while deleting only downstream re-proof and
fallback machinery. No silent substitution, healing, omission, fail-open
control, corruption-as-absence, partial-success masquerade, redress wrapper,
or runtime test dependency was introduced in the B1–B5 reconciliation.

### 9.3 Commit, Deploy, Product Data, And Live State

- Code and documentation are modified only in the shared local working tree.
- No B1–B5 commit or push has been performed.
- No Worker, Pages, R2 product-root, or other cloud-dev deployment has been
  performed for this reconciliation.
- No remote product data was read, migrated, repaired, or mutated.
- No authenticated cloud-dev journey, owner QA, or live runtime verification
  has been performed for B1–B5.
- The §8 findings matrix remains historical evidence. Findings outside the
  exact B1–B5 scope remain unadjudicated rather than implicitly fixed,
  rejected, or authorized.
