# PRD 130B execution audit — Claude

Status: **POST-EXECUTION AUDIT COMPLETE — READ-ONLY — AWAITING ARCHITECT DISPOSITION**

Owner: Clickeen product owner/architect

Date: 2026-08-19

This is a post-execution audit of the shipped PRD 130B remediation. The other
reports in this folder are pre-implementation product walks of the concern
recorded in `130__AUDIT__Defensive_Construction_Audit.md`. This one is
different: it reviews what actually landed.

Audited revision: `34444e5e646cc530514e0646d27f0795259ce96d` (44 files,
+3334/−462), read at repository HEAD `c4ad9a1c`.

This is evidence, not permission to change code, mutate account data, deploy, or
operate a managed service. Nothing in the repository was modified to produce it.

## 1. Method and its limits

What this audit did:

- read the complete shipped diff;
- traced each of E1–E6 to its runtime code at HEAD;
- read the Save phase reducer and both iframe admission paths in full;
- opened every test file added or changed by the pass and classified its proof;
- compared the new confirmation dialog against every other dialog consumer in
  the repository;
- scanned the diff for the machinery the plan forbade;
- spot-checked the Slice 7 documentation reconciliation claims.

What this audit did **not** do, and therefore cannot report on:

- it did not run any test, build, or lint;
- it did not run the product locally or against cloud-dev;
- it did not sign in, exercise any product command, or observe any rendered
  surface.

Every finding below is static evidence from source. No claim here is
deployed-product proof, and this audit does not substitute for the owner QA
that PRD 130B correctly records as pending.

One environment note affecting readers of this file: the working tree advanced
during the audit session. Session-start HEAD was `067c895d`, which predates
`34444e5e`. Observations made against the earlier tree were discarded and
re-taken at `c4ad9a1c`.

## 2. Executable set — implementation verified

All six decisions are present in runtime code, not only in the plan's
checkboxes.

| ID | Verified at |
| --- | --- |
| E1 | `roma/components/roma-command-confirmation-dialog.tsx` plus wiring in `widgets-domain.tsx`, `assets-domain.tsx`, `widget-publication-controls.tsx`, `team-member-domain.tsx`, `settings-domain.tsx` |
| E2 | `resolveSaveControlPhase` in `bob/lib/session/sessionTypes.ts`; dispatches in `useSessionSaving.ts`, `useSessionEditing.ts`; receipt timer in `WidgetDocumentSession.tsx` |
| E3 | `Promise.all` at `roma/app/api/account/widgets/route.ts:38` with instance-first error priority preserved |
| E4 | `label.textContent = panel.label` at `roma/components/widget-defaults-builder-controls.tsx:139` |
| E5 | `CopilotMessagePresentationStatus` in `bob/lib/copilot/types.ts`; resolution in `CopilotPane.tsx` |
| E6 | `roma/lib/builder-host-protocol.ts`; Save slot and five reset sites in `builder-domain.tsx` |

Supporting verifications:

- `bob/components/TopDrawer.tsx` is deleted; no import, render, or `topdrawer`
  CSS selector remains in `bob/`.
- Both reachable compact controls were rehomed before that deletion: Roma's
  navigation trigger into the Builder header with `navigationButtonRef` focus
  return, and Bob's ToolDrawer opener into `editor-content`.
- `bob:host-action` / `open-navigation` is gone from both sides.
- Slice 7 holds: `TopDrawer` no longer appears anywhere in `documentation/`, and
  `documentation/engineering/UI/interactions.md` carries the one-second receipt.
- A scan of the diff for `setInterval`, retry, storage, map-based registries, and
  similar machinery returned nothing. No forbidden construction entered the pass.

## 3. Work that is well built

**The Save phase reducer.** `resolveSaveControlPhase` is a pure, exhaustively
switched function with no side effects, and it is correct against every clause
of E2. Both defects the independent V1–V8 audit caught are visibly closed in it:
`draft-changed` holds `saving` while a command is in flight, and `save-failed`
derives from current dirty truth rather than exposing a dead control.

`receipt-elapsed` returns `current` unless the phase is still `saved`, which
makes a stale timer a structural no-op. That is the correct shape for this
system: a pure-state guard, not a runtime probe or reconciliation pass.

**The receipt timer.** Keyed on the phase with effect cleanup, so a new edit,
new Save, editor open, or unmount cancels it through React's own lifecycle
rather than manual bookkeeping.

**Both admission paths fail closed.** `acceptsHostSaveRequest` combines origin,
event source, parent-window identity, phase, dirty, and saving into one type
guard. `readBobSaveControlPhase` validates origin, source, iframe window,
message type, and the phase enum before returning, and returns `null` otherwise.
Both have real negative tests for wrong origin, wrong source, unknown phase, and
wrong message type.

**Three of the new test files are genuinely strong.**
`run-widgets-route-cold-path.mjs` esbuilds and invokes the real route module.
`run-widget-defaults-panels.mjs` executes `buildPanelHtml` in real Chromium
through Playwright. `run-command-confirmations.ts` renders the shared dialog into
a real DOM and dispatches real `MouseEvent`s to count command invocations.

## 4. Findings

### F1 — Escape is inert on all five destructive confirmations

Severity: **low** (fails safe — no command runs). Reachability: **current**.

`dieter/components/shared/dialog-lifecycle.ts:48` calls `event.preventDefault()`
on the native `cancel` event, which stops the dialog closing, then emits
`requestDismiss('escape')`.

`roma/components/roma-command-confirmation-dialog.tsx:59` handles only
`'backdrop'`. The `'escape'` reason falls through.

Net behavior: pressing Escape on Delete widget, Delete asset, Unpublish, Remove
member, or Transfer ownership does nothing at all. The modal does not close and
no cancel handler runs.

This is the only consumer in the repository that drops `'escape'`:

| Consumer | escape | backdrop |
| --- | --- | --- |
| `roma-unsaved-changes-dialog` | handled | — |
| `assets-domain` bulk upload | handled | — |
| `widget-copy-code-dialog` | handled | handled |
| `roma-upsell-dialog` | handled | handled |
| `roma-account-notice-modal` | — | — (explicit no-op; blocking notice) |
| Dieter `bulk-edit`, `object-manager` | handled | — |
| `roma-command-confirmation-dialog` | **dropped** | handled |

It is the exact mirror of `roma-unsaved-changes-dialog.tsx:33`.

On scope: PRD 130B deliberately excluded keyboard work, and that exclusion was
the architect's call. This finding is not that the exclusion was wrong. It is
that the implementation went past "do not add" into actively filtering out a
reason the reused primitive emits — which the execution plan's own Step 1.2
warned against ("do not remove any mechanics already supplied invisibly by the
reused primitive"). Plain abstention, `requestDismiss: () => handleCancel()`,
would have been less code and would have worked.

Note for the audit process: the V3 gate asks whether any command, failure,
panel, event, or control was silently dropped. An emitted dismissal event was
dropped, and V1–V8 passed. The independent audit verified the six E-items in
depth and did not check the new component against sibling conventions.

### F2 — The Roma Save slot is proven only by source-text assertions

Severity: **medium** — verification debt, not a known defect.

`roma/tests/run-builder-save-control.ts` has two halves. Lines 8–27 are a real
behavior test of `readBobSaveControlPhase`. Lines 29–49 read
`builder-domain.tsx` as a string and run nineteen regex assertions against it.

Everything about the Roma rendering side of E2/E6 sits in that second half:
whether the Save button renders for `save`, whether the spinner renders for
`saving`, whether green `Saved` renders for `saved`, whether the click posts
`host:save-request`, and whether the reset fires.

The reset assertion is the clearest example of what this cannot prove:

```ts
assert.match(source, /setBobSaveControlPhase\('hidden'\)/);
```

The plan requires five reset sites — iframe load, target change, open failure,
Bob-not-ready, unmount. This assertion passes if the string appears once. All
five are in fact present (`builder-domain.tsx` lines 988, 1061, 1075, 1202,
1216), so there is no current defect. But the test cannot detect a regression
that removes four of them.

Lines 36–40 go further and regex-match multi-line control-flow ordering in
source text, which is brittle against any reformat and proves nothing about
runtime.

The file reports `PASS Roma borrowed Save slot and exact Bob-frame admission`.
The admission half is genuinely proven; the Save slot half is not.

The same pattern applies to E1's five command wirings, which are proven by regex
over five source files (`run-command-confirmations.ts:127–176`). The shared
dialog's mechanics are well tested; its five wirings are not.

This matters because of what it coincides with. These are the two surfaces that
also received no owner QA. Whether the green Saved receipt renders, and whether
the five confirmations invoke the right handlers, has been verified by neither a
behavior test nor a human.

The capability to close this gap already exists inside the same commit:
`run-widget-defaults-panels.mjs` runs a component in real Chromium. That harness
is the template.

### F3 — Phase emission can be dropped before the host origin is known

Severity: **low**. Reachability: **latent** — no current reachable flow proven.

`bob/lib/session/WidgetDocumentSession.tsx`:

```ts
const targetOrigin = transport.hostOriginRef.current;
if (!targetOrigin) return;
...
try { window.parent?.postMessage(message, targetOrigin); } catch {}
```

`hostOriginRef` is a ref and does not trigger re-render, so a phase transition
occurring before the origin is set is never emitted and never retried. In the
current open sequence the origin is established during the handshake, and no
reachable failure could be constructed from source. Classified latent under the
PRD's own evidence bar.

The bare `catch {}` is worth separate consideration: a failed emission is
swallowed with no visible trace, which is the shape Tenet V3 warns about.

### F4 — Builder header bottom margin now inherits from Dieter

Severity: **minor**. Cannot be adjudicated without owner QA.

The former override included `margin-block-end: 0`. The current override at
`roma/app/roma.css` is `max-inline-size: none; margin-inline: 0; padding:
var(--space-2)`, so `.page__header`'s `margin-block-end: var(--space-4)` now
applies — placing 16px between the header and the Bob iframe on a page whose
`.page__content` uses `gap: 0`. This may be intentional. It is recorded here
because it is exactly the class of change only a rendered surface can settle.

## 5. Reconciliation

| Item | Result |
| --- | --- |
| E1–E6 present in runtime code | Verified |
| TopDrawer deleted with both compact controls rehomed first | Verified |
| Forbidden machinery in the diff | None found |
| Slice 7 documentation reconciliation | Verified for the claims checked |
| Concrete defects found | F1 only |
| Verification debt found | F2 (Roma Save slot; five confirmation wirings) |
| Latent items recorded | F3, F4 |
| Code changed by this audit | None |
| Product data touched by this audit | None |

The architecture held. No authority boundary was crossed, Bob remains the sole
Save authority with Roma rendering a control it cannot construct, and the
hardest sequencing decision in the pass — deleting Bob's header only after both
reachable compact actions had new owners — was made correctly.

The gap in this execution is not in what was built. It is in what was proven.

## 6. Recommendations

These are recommendations for the architect. This audit does not decide scope,
defer work, or close any finding.

1. **F1** — decide deliberately rather than by inheritance: either handle both
   dismissal reasons, or record that these five dialogs intentionally swallow
   Escape. One line either way.
2. **F2** — convert the two regex blocks to behavior tests using the harness
   already present in this commit. Highest value on the Roma Save slot, since it
   is the surface with neither test nor QA coverage.
3. **Signed-in cloud-dev QA** — worth treating as its own piece of work rather
   than as a step inside the next feature pass. `e2e/.auth/roma-dev.json`,
   `scripts/e2e/roma-dev-auth.mjs`, and the credentials that script reads are
   all present, and this commit demonstrates Playwright and Chromium are
   available to the test harness. The blocker recorded in PRD 130B is
   specifically a signed-in session, which is narrower than "no browser was
   available" implies. Until it is closed, UI passes will keep terminating in
   the same deployed-and-unverified state.
