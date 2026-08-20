# PRD 130B Execution Audit — Cursor

Status: **EXECUTION AUDIT COMPLETE — BLOCKERS FOUND — DO NOT CLOSE PRD 130B**

Owner: Clickeen product owner/architect

Date: 2026-08-19

This is a read-only audit of:

- `130B__PRD__Defensive_Construction_Remediation.md`;
- `130B__EXECUTION_PLAN__Defensive_Construction_Remediation.md`; and
- implementation commit `34444e5e646cc530514e0646d27f0795259ce96d`.

It evaluates the execution from both product-management and Staff Engineer
perspectives. It does not authorize code changes, product-data mutation,
deployment, or managed-service operations.

## 1. Audit basis

The audit read:

- `AGENTS.md`;
- the mandatory architecture and strategy entry documents;
- the current Roma, Bob, Dieter, account-management, UI-interaction,
  dialog, surface, component, and Product Copilot manuals;
- the complete PRD 130B execution plan and linked product PRD;
- the 44-file implementation commit;
- the focused confirmation, Save, Roma/Bob bridge, Widgets cold-path,
  Widget Defaults, and Copilot test sources; and
- the current Bob lint result.

The implementation commit exists and matches the SHA recorded in the plan.
Bob lint exits successfully but still reports these three
`react-hooks/exhaustive-deps` warnings in `CopilotPane.tsx`:

- missing `sendContinuation`;
- missing `startTurnRequest`; and
- missing `handleCopilotEvent`.

This audit did not independently re-run the complete local command matrix,
inspect Cloudflare deployment records, use a signed-in product browser, or
mutate cloud-dev account data. The plan's recorded deployment evidence is
therefore treated as execution evidence, not independently reproduced evidence.

## 2. Verdict

### Product-management verdict

**Approve the plan's product direction with conditions. Do not approve release
acceptance or PRD completion yet.**

The six selected corrections are bounded, understandable, and attached to
specific current product costs. The scope lock is strong. The plan is also
honest that owner-visible signed-in QA remains pending.

However, release acceptance is unresolved, the completion language is
internally ambiguous, and the plan contains no measured before/after product
outcome for the latency and comprehension corrections.

### Staff Engineer verdict

**Reject the current completion claim.**

The Roma/Bob/Dieter authority design is sound, but two concrete Product Copilot
turn invariants claimed by the PRD and manuals are absent in the deployed source:

1. the originating draft-signature concurrency gate is not enforced before
   applying a model-produced operation batch; and
2. the continuation opened after a successful apply can carry pre-apply draft
   context.

The focused tests do not exercise the production callback chain that would have
revealed either defect.

### Overall disposition

Keep PRD 130B under `02-Executing`.

Do not mark Slice 10 or the completion checklist complete until:

1. the two Copilot blockers below are corrected;
2. the real Copilot callback chain and Roma/Bob Save bridge have integrated
   behavior proof;
3. the relevant local checks are rerun; and
4. signed-in owner-visible cloud-dev QA is completed, or the architect records
   a narrow explicit waiver for a destructive scenario that cannot be exercised
   safely.

## 3. What the execution gets right

### 3.1 Scope and product discipline

The plan does not convert the 63-row finding ledger into 63 implementation
tasks. It limits execution to E1-E6 and explicitly excludes Prague, Catalog/New,
Home, invitations, PRD 129 lifecycle work, billing, generic retries, watchdogs,
session recovery, and unrelated cleanup.

That is the correct use of an audit: adjudicate evidence, select current product
costs, and avoid turning theoretical failures into machinery.

### 3.2 Named authorities remain intact

The implementation keeps:

- consequential account commands and the Builder header in Roma;
- browser-memory draft, dirty truth, Save execution, and Copilot apply/Undo in
  Bob;
- reusable Button, Popup, Spinner, Icon, Table, token, and motion presentation
  in Dieter;
- source and asset storage in Tokyo-worker; and
- relational account/member truth in Berlin/Michael.

The borrowed Save control adds two typed messages inside the existing iframe
protocol rather than adding a Save route, persistence service, result handshake,
global store, or event bus.

### 3.3 The plan distinguishes evidence classes

The plan correctly separates:

- local test/build evidence;
- commit and remote revision;
- Roma and Bob Pages deployment;
- safe signed-out HTTP reachability;
- product-data mutation; and
- signed-in owner-visible QA.

Its final reconciliation does not pretend that HTTP `200` proves the six
signed-in product behaviors.

### 3.4 Several focused tests are genuine behavior tests

The shared confirmation component is mounted in a real browser harness and
proves:

- closed means unmounted;
- open invokes no decision;
- Cancel invokes no command;
- backdrop invokes no command; and
- repeated Confirm events invoke the supplied command once.

The Widgets route test executes the production route with owner stubs and proves
that both independent reads start before either resolves while preserving
instance-first error priority.

The Widget Defaults test executes the production projection in a browser and
proves exact compiler order, filtering, text-only label assignment, and empty
panel omission.

## 4. Blocking technical findings

### B1 — The claimed Copilot draft-signature concurrency gate is absent

**Severity: blocker**

**Classification: concretely reachable; retained pre-existing defect, not proved
to have been introduced by PRD 130B.**

The plan and PRD explicitly say the existing draft-signature check remains:

- execution plan lines 624-630;
- product PRD lines 413-416; and
- `documentation/ai/agents/product-copilot.md` lines 295-311.

Current source does not implement that gate.

`ActiveTurnState` in `bob/components/CopilotPane.tsx:52-62` stores no originating
request signature. The initial request computes a local `requestSignature` at
`:930-945`, but that coordinate is placed only in the outgoing request body and
is not retained with the active turn.

When the model later proposes an edit, `executeBufferedToolCall` reads the latest
`instanceDataRef.current`, builds inverse operations from that latest draft, and
calls `session.applyOps(expandedOps)` at `:431-487`. It never compares the
current draft signature with the signature from the request that produced those
operations.

The reachable flow is:

```text
Copilot request opens from draft S0
-> user makes a manual edit while the model streams
-> current browser draft becomes S1
-> model tool request produced from S0 reaches Bob
-> Bob applies that request to S1 without comparing S0 and S1
```

This is not theoretical. Manual editing remains available while a Copilot turn
is active, and model execution is asynchronous.

`session.applyOps` correctly validates and applies operations against the
current compiled control contract. That is not the missing concurrency check.
The missing check answers a different question: whether the model request still
belongs to the draft from which it reasoned.

Why this blocks closure:

- the execution plan claims preservation of a guard that does not exist;
- the current Product Copilot manual presents that guard as implemented truth;
- a stale model operation can be accepted against a newer human-edited draft;
  and
- the focused tests never assert rejection when the current signature differs
  from the originating request signature.

Required correction:

- retain the exact originating draft signature in the active request/turn
  coordinate;
- compare it with the exact current draft immediately before model operations
  are accepted;
- fail visibly as `Not applied` when they differ; and
- test the real `CopilotPane` flow with a human edit between request start and
  tool application.

Do not add a new service, outcome API, retry, validator layer, or persistence
record. This belongs to Bob's existing external model-edit acceptance boundary.

### B2 — Successful Copilot continuation can carry pre-apply draft context

**Severity: blocker**

**Classification: concretely reachable on a successful tool application.**

`session.applyOps(expandedOps)` returns the exact applied draft synchronously at
`bob/components/CopilotPane.tsx:470-487`.

After that result, the component immediately calls `sendContinuation` at
`:511-526`.

The continuation does not build its context from `applied.data`. It computes
the signature from `instanceDataRef.current` and uses the render-captured
`controlsForAi` at `:591-610`.

`instanceDataRef.current` is synchronized from React session state only in an
effect at `:282-284`. React does not complete that render/effect before the
same callback immediately starts the continuation. `controlsForAi` is likewise
a memoized projection from the pre-apply render.

The resulting reachable sequence is:

```text
Bob applies the tool batch successfully
-> toolResult says ok and carries the post-apply signature
-> Bob immediately starts the continuation
-> currentDraftContext can still contain the pre-apply signature and values
```

That continuation can therefore tell Product Copilot both:

- the edit succeeded; and
- the current draft still has the old context.

This contradicts the exact-current-draft contract in:

- `documentation/ai/agents/product-copilot.md:203-269`;
- `documentation/ai/agents/product-copilot.md:295-327`; and
- `documentation/services/bob.md:788-847`.

The three existing exhaustive-dependency warnings surround this same callback
cycle:

```text
executeBufferedToolCall
-> sendContinuation
-> startTurnRequest
-> handleCopilotEvent
-> executeBufferedToolCall
```

The warnings are not proof of this defect by themselves. They are evidence that
the changed lifecycle relies on deliberately omitted callback dependencies, and
the current test strategy does not exercise callback freshness.

Required correction:

- construct the continuation's `currentDraftContext` from the exact
  post-application draft returned by `applyOps`, including its controls and
  signature;
- do not wait for or infer truth from a later React effect;
- preserve the existing continuation, history, grant, SSE, and one-tool
  contracts; and
- exercise a real successful apply followed by continuation and assert that the
  continuation contains the post-apply values and signature.

## 5. Verification gaps

### V1 — Save and Roma/Bob header tests do not exercise the integrated bridge

**Severity: high verification gap**

`bob/tests/run-save-control.ts` proves:

- the pure phase reducer;
- pure host-message admission; and
- source-text wiring assertions.

`roma/tests/run-builder-save-control.ts` proves:

- the pure Roma protocol parser; and
- source-text assertions against `builder-domain.tsx`.

Those checks are useful but do not execute:

- Bob phase emission through `postMessage`;
- Roma receipt from the active iframe;
- user click in Roma followed by Bob's real `save()`;
- the existing Save command/result round trip;
- first-Save in-place identity adoption;
- iframe load or target-change reset ordering;
- edit-during-Save across the real React session; or
- the one-second receipt across both applications.

The plan's Slice 3 behavior matrix is therefore stronger than its executable
local evidence. Signed-in owner QA remains the only recorded integrated evidence
gate, and it is pending.

### V2 — Copilot status tests duplicate orchestration instead of driving it

**Severity: high verification gap**

The visible-status test in
`bob/tests/run-copilot-pane-gates.ts:357-463` defines a separate
`createVisibleTranscriptTransport`.

That test-only state machine imports production message helpers, but it
reimplements:

- request start;
- unresolved-message tracking;
- streaming;
- apply result;
- terminal result;
- error; and
- Stop.

It does not render `CopilotPane`, drive the real transport callbacks, execute
the production `ActiveTurnState`, apply operations through the real session, or
open the production continuation.

It can therefore pass while the production callback chain violates the
draft-signature and post-apply context invariants in B1 and B2.

### V3 — Five command consumers are mostly verified by source matching

**Severity: medium verification gap**

The shared confirmation mechanics have real browser behavior proof. The five
actual consumer integrations are then verified primarily through regular
expressions over component source.

This proves that expected strings and handler names exist. It does not prove,
for each real consumer, that:

- the first product click opens the dialog instead of calling the command;
- Cancel/backdrop preserve the consumer's selected subject and pending state;
- Confirm invokes the exact handler once;
- the row/menu/toggle state closes correctly; and
- command failure remains visible after the dialog closes.

Owner-visible QA is therefore still required for the real consumers, and at
least one mounted consumer behavior test would materially improve local proof.

## 6. Product-management findings

### P1 — Release acceptance is pending, not complete

**Severity: release blocker unless explicitly waived by the architect**

Execution plan Steps 10.1-10.5 leave every signed-in product check unchecked.
The final reconciliation at lines 889-906 correctly says no product browser
session was available.

The plan's status and final paragraph honestly say:

```text
deployed successfully; signed-in owner-visible QA pending
```

That is the correct current release statement. It is not equivalent to
verified completion.

### P2 — The completion rules are ambiguous

The execution plan says:

- every slice must pass its exit gate;
- Slice 10 passes only when deployed behavior matches E1-E6 and owner QA is
  recorded honestly; and
- the completion checklist requires Slices 0-10 complete in order.

The linked PRD also says completion may occur when owner QA is completed **or**
every unperformed check is explicitly pending.

Those rules permit two readings:

1. owner QA is a required release gate; or
2. recording that all owner QA is pending is itself enough to complete the PRD.

The plan currently follows the first interpretation by keeping Slice 10
incomplete. The PRD completion language should be reconciled so future agents
cannot close the work under the second interpretation.

### P3 — Acceptance is precise but not outcome-measured

The plan defines exact implementation behavior, but it does not record:

- before/after cold Widgets route duration;
- a target reduction for layout shift;
- Save-completion comprehension;
- accidental-command or cancellation evidence; or
- whether `Working`/`Applied`/`Not applied` makes contradictory streamed wording
  understandable to a user.

This is not a reason to add analytics infrastructure. One bounded owner-QA
record with observed before/after timing and explicit comprehension checks is
enough for this pass.

### P4 — Confirmation friction is mostly proportional, with one trade-off to confirm

Confirmations are clearly justified for:

- Widget Delete;
- Asset Delete;
- Remove member; and
- Transfer ownership.

Unpublish is reversible and leaves source intact. The confirmation is still a
reasonable product decision because it immediately removes public availability,
but it adds a click to an ordinary publication command. Owner QA should confirm
that the wording and interaction feel proportional rather than like the same
severity as irreversible deletion.

No additional confirmation ladder or generic destructive-command framework is
recommended.

## 7. Required close gate

### Code

- [ ] Restore the exact originating-draft signature check before Copilot applies
      model-produced operations.
- [ ] Build the successful continuation context from exact post-apply draft
      truth.
- [ ] Resolve the callback lifecycle so the production path no longer depends on
      stale captured functions or values.

### Tests

- [ ] Add production-path proof for manual edit during a Copilot request.
- [ ] Add production-path proof that a successful continuation carries the
      post-apply signature and values.
- [ ] Add integrated behavior proof for the Roma/Bob Save presentation bridge,
      or explicitly retain those cases as signed-in owner-QA-only and stop
      describing source assertions as complete executable proof.
- [ ] Exercise at least one real command consumer through open, Cancel,
      backdrop, Confirm, pending, and failure.
- [ ] Re-run every focused command in Slice 8 plus Roma/Bob production builds
      and `git diff --check`.

### Documentation

- [ ] Keep the Product Copilot concurrency gate documented as current truth only
      after runtime code actually enforces it.
- [ ] Reconcile the PRD completion rule with the Slice 10 exit gate.
- [ ] Record the exact correction commit, deploy revisions, and new audit result.

### Cloud-dev and owner QA

- [ ] Verify the safe confirmation flows through real controls.
- [ ] Verify one Roma header, Save phases, edit-during-Save, first Save, iframe
      reset, and compact controls.
- [ ] Verify cold Widgets and Widget Defaults presentation.
- [ ] Verify Product Copilot text-only, successful edit, manual-edit concurrency,
      continuation, Stop, and a safe visible failure.
- [ ] Record every mutation and restoration separately.
- [ ] Use disposable identities for Remove member and Transfer ownership, or
      record a narrow architect waiver rather than risking a real owner account.

## 8. Final position

PRD 130B is a strong remediation design with disciplined scope and correct
service boundaries. Most implementation choices are small and appropriate to
the proven product costs.

The execution cannot be accepted as complete because its Product Copilot lane
assumes two invariants the current code does not provide, and its focused tests
do not execute the callback chain where those invariants matter.

The correct status is:

**deployed implementation with two blocking Copilot execution gaps and pending
signed-in owner-visible QA.**

Fix those gaps through Bob's existing edit-acceptance and continuation
boundaries. Do not add a service, retry, outcome API, validator layer, or
compatibility path.
