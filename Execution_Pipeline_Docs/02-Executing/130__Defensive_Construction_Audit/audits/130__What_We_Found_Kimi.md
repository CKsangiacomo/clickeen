# 130 — What We Found (Kimi Re-Audit Pass)

Status: **RE-AUDIT COMPLETE — POST-REMEDIATION BASELINE main@ecb15e75 — FINDINGS AWAITING ARCHITECT DISPOSITION**

Owner: Clickeen product owner/architect

Date: 2026-08-19

This is the independent second audit pass, run after the owner-authorized
B1–B5 remediation and P1 Copilot fix landed on `main`. It re-verifies the
first pass's findings against the new code, reviews the remediation itself
with the same lens, and records what remains. Read-only; nothing here is
executed.

Relationship to the other documents in this folder: the team's
`130__PRD__Codebase_And_Services_Defensive_Construction_Audit.md` is the
system-of-record audit; this file is the second-opinion ledger. Where they
agree, the finding is strong. Where only one pass saw it, it is marked
accordingly.

## 1. Verified Fixed (evidence against post-remediation code)

| First-pass finding | Fix verified at |
| --- | --- |
| Publish unreachable from the editor; dead `publishActiveInstance` fossil | `roma/components/widget-publication-controls.tsx` — one shared Roma component used in the Widgets list (`widgets-domain.tsx:629`) and in the new Roma-owned builder header (`builder-domain.tsx:1306`). The fossil and its unreachable banner are deleted. |
| Publish-with-dirty-draft invisible | The control blocks publish while dirty and says so: `title="Save first"` plus a visible `Save first` hint (`widget-publication-controls.tsx:138, 162-173`). `bobIsDirty` promoted from ref to state to drive it. |
| Failure taxonomy richer than the success path (402/409/committed taxonomy) | Deleted at the root: cache purge is now fire-and-forget `waitUntil` with "cache eviction is a delivery optimization, never product result truth" (`tokyo-worker/.../operations.ts:56-77`). The `committed` field, 502/503 purge taxonomy, and reconciliation banner no longer exist anywhere in the tree. |
| 24h stale-embed window | Closed as a side effect of the same decision: `stale-while-revalidate=86400` replaced by `must-revalidate` (`clk-live-routes.ts:79`). Worst-case staleness is now bounded at `s-maxage=300` (5 min). |
| Orphan instances from abandoned Creates | Create no longer writes: catalog "Create instance" is pure navigation to `/builder/new/{widgetType}`; the first Save creates the instance through one unified `save-instance` command (`widgets-domain.tsx` create handler; `builder-domain.tsx:825-850`; `useSessionSaving.ts`). Bob TopDrawer is Save-only. |
| Copilot dead in hosted Builder (team's P1) | `CopilotPane` now consumes the typed `useWidgetSessionTransport()` instead of duck-casting the session context; fail-closed when policy/copilot config is absent ("Editor policy is unavailable. The turn was not continued."); the source-text grep gate was replaced with behavior-based e2e (`scripts/e2e/roma-copilot-runtime-smoke.mjs`); verified live with a real turn ending in `agent_turn_finished`. |
| Downstream re-proof class (B1–B5) | Roma consumes exact bootstrap/widgets results; Widget Defaults consumes compiled artifacts directly; Tokyo no longer repeats Roma's account-status decision on uploads; the Copilot internal chain aliases typed contracts instead of reparsing; Prague dropped its build-time existence probe. |

## 2. Remains Open (re-verified against post-remediation code)

Ordered by order of magnitude, worst first.

### R1 — Confirmation inversion (both passes)

Still no confirmation on any destructive action: widget delete
(`widgets-domain.tsx` actions popover — instant DELETE), asset delete
(`assets-domain.tsx:291-311`), member removal
(`team-member-domain.tsx:160-182`), invite revoke
(`team-domain.tsx:146-170`), ownership transfer
(`settings-domain.tsx:95-118`, fires and logs the user out). The only
confirmation dialog in the product still protects an unsaved draft
(`builder-domain.tsx:1325-1328`). Note the remediation made this *sharper*:
one click on Delete now also kills a live widget whose embeds 404 within ~5
minutes (must-revalidate).

**Disposition: unchanged — confirmation ladder proportional to blast radius.**

### R2 — Copilot narration-before-apply (first pass, Pattern 6) — downgraded, not closed

The remediation's EOF terminal reconciliation
(`agents/product-copilot/src/worker.ts:130-138`) plus Bob's request-failure
message (`CopilotPane.tsx:549-557`) mean the fully silent case is covered: a
stream that dies before `model_step_finished` now produces an error message.
The residual is **contradictory messages**: the user reads the streamed claim
("Done — I updated your questions") and *then* receives "Copilot failed
unexpectedly." Narration still streams before the edit exists
(`CopilotPane.tsx:571-575` renders text deltas live; tool execution remains
gated on `model_step_finished` at :604-605).

**Disposition: still the architect decision from Appendix 130A (hold
narration / mark the assertion / terminal-event guarantee), but the stakes
dropped from "silent wrong" to "confusing."**

### R3 — Save still vanishes silently (first pass, Pattern 2)

Bob's Save button disappears on success with no "Saved" receipt
(`bob/components/TopDrawer.tsx:71-86` — unchanged by the remediation). The
new unified save-instance flow made Save *more* important (it is now also
Create) without giving it a completion signal. Publication got a receipt
(`widget-publication-controls.tsx:121-132`); Save did not.

**Disposition: one visible "Saved" state.**

### R4 — The paywall still dead-ends (first pass, J6)

The 402 upsell Popup still renders the scaffolding Upgrade CTA
(`roma-upsell-dialog.tsx:37-48`; body copy "Upgrade to {plan} to publish more
widgets").

**Disposition: CLOSED BY ARCHITECT 2026-08-19 — intentionally empty until
billing lands.**

### R5 — Silent keystroke reverts and vanishing controls (first pass, J2/Pattern 3)

Untouched by the remediation: `useTdMenuBindings.ts:121-147` still reverts
input mid-typing with no explanation when a bound rejects; `showIf` still
appears/disappears controls on invisible conditions.

**Disposition: disabled-with-reason, never vanish; explain reverts inline.**

### R6 — Spinners without timeouts (first pass, Pattern 4)

Unchanged: Save, "Loading preview…", Copilot send. A hung request is still an
infinite spinner.

**Disposition: genericize one timeout-with-retry.**

### R7 — Empty Home and stub nav (first pass, J1)

`/home` still renders a bare shell (`app/(authed)/home/page.tsx`); Billing,
broader Usage, and AI remain stub destinations.

**Disposition: CLOSED BY ARCHITECT 2026-08-19 — Home is intentionally empty
for now.** One related item remains distinct from the empty page itself:
Prague's "Create a free widget" CTA drops already-signed-in users onto empty
Home and discards the `signup_prague` intent (Cursor pass). Recorded under
R11 below.

### R8 — Embed failure face (first pass, J9)

Still the literal text `Not found` inside a customer's iframe
(`clk-live-routes.ts:20-21`). The stale-window concern is closed (R-fixed
above).

**Disposition: CLOSED BY ARCHITECT 2026-08-19 — accepted as-is; no machinery
for now.**

### R9 — List-wide action mutex (first pass, Pattern 5) — partially mitigated

`activeActionKey` still disables every row's actions during any mutation
(`widgets-domain.tsx:566, 605, 615`), but the in-flight row now shows a
spinner (d1ab4e05) and the publication control has its own per-instance busy
state, so the frozen-screen read is reduced, not eliminated.

**Disposition: simplify to per-row busy state.**

### R10 — Invisible click-interceptor in Bob's toolbar (team pass, P2) — suspect named

Not in the B1–B5 scope; no fix observed in the tree. The Cursor live-walk
pass named the probable cause: closed Dieter dialogs (`RomaUpsellDialog`,
`WidgetCopyCodeDialog`, `RomaUnsavedChangesDialog`) remain pre-mounted in the
DOM and intercept hit-testing over toolbar controls, which also explains the
intermittency. Owning files: `roma/components/builder-domain.tsx`,
`widget-publication-controls.tsx`, Dieter `diet-popup` mount behavior.

**Disposition: mount dialogs only when open.**

### R11 — Prague create drops signed-in intent (Cursor pass)

`prague.dev.clickeen.com/.../create` 302s to Roma `/home` with a
`signup_prague` intent query; Roma parses that intent only on the login path,
so an already-signed-in user lands on empty Home and the create intent is
discarded (`prague/src/pages/[market]/[locale]/create/index.astro`;
`roma/app/api/session/login/google/route.ts`, `finish/route.ts`). Distinct
from R7: the empty page is intentional; the dropped handoff is not obviously
so.

**Disposition: awaiting architect call — route signed-in create to the
Builder/catalog, or accept for now.**

### R12 — Additional live-walk findings (Claude/Cursor passes, corroborated here)

- Full-canvas "Loading page" gate hides the shell/nav on every Roma route
  while `/api/bootstrap` resolves (`roma/components/roma-account-context.tsx`)
  — **demote: keep the shell, gate only the content.**
- Builder controls become usable seconds before the preview paints
  (Claude pass) — **demote/reorder the open sequence.**
- Two adjacent Widget Defaults sections both labeled "LOCALE SWITCHER"
  (Claude pass, visually confirmed) — **fix the labels.**
- Redundant "Refresh list"/"Refresh" controls beside already-live lists
  (Assets, Settings languages) — **delete/demote as median controls.**
- Catalog button copy "Create instance" implies persistence; New writes
  nothing — **demote copy.**
- Prague directory cards eat clicks (`pointer-events: none` on the live
  embed) — **demote so the card/CTA is the target.**

## 3. The Remediation Itself, Reviewed

The B1–B5 + lifecycle pass is the audit's thesis executed correctly, and two
of its choices deserve naming as *models*:

1. **The cache-purge deletion is how you remove a failure taxonomy safely.**
   They did not just delete the 502/503/`committed` machinery — they first
   shrank the staleness window (`must-revalidate`, 300s bound) so the deleted
   taxonomy's job became cheap enough to not need doing. That is priced
   engineering: the rare failure (purge failure) now costs at most five
   minutes of staleness and zero user-facing machinery, instead of three error
   shapes, a retry state, and banner copy no user could parse.
2. **Create-via-Save deletes a state, not a button.** Unifying Create into
   the first Save removed the abandoned-instance class, the
   never-published-instance edge cases, and a whole handoff — by removing a
   lifecycle state rather than guarding it. This is the same move as the
   Roma-header publish fix: the correct answer to tangled state convergence
   is fewer states to converge.

Watch-items on the new code (not findings, no action recommended):

- Publication success still triggers a full forced account refetch after the
  optimistic update (`widget-publication-controls.tsx:88-106`). Fine at
  current scale; it is the same fan-out the team's P3 flagged.
- The publish control remains a toggle *switch*. With receipts, dirty
  handling, and busy state now around it, the weight mismatch is largely
  absorbed — but Unpublish still takes a live widget offline in one click,
  which belongs to the R1 confirmation ladder.
- New-instance flow: a never-saved draft is protected by the unsaved-changes
  dialog on in-app navigation; browser close/refresh on a `/builder/new/`
  draft relies on the native `beforeunload` boundary. Worth one manual
  confirmation during owner QA, not new machinery.

## 4. Net Position

First pass: the product protected drafts better than production and explained
failure better than success. After the remediation: the moment of value is
reachable from where the work happens, the flagship AI feature is alive and
verified, the worst state-convergence machinery is gone, and the failure
taxonomy no longer outweighs the success path.

What remains after architect triage (2026-08-19 closed R4, R7, R8) is one
coherent program: **make the visible honest** — receipts for success (R3),
confirmation for destruction (R1), reasons on disabled controls (R5), an end
to narration that outruns the act (R2), dialogs that mount only when open
(R10), and a shell that doesn't vanish behind a loading gate (R12). None of
it requires new architecture; all of it is surface work in Roma/Bob owning
components.

## 5. Housekeeping

This folder now carries two audit programs with non-overlapping file sets:
the team's (`130__PRD__…`, `130A__PROCESS__…`) and the first pass's
(`130__AUDIT__…`, `130A__APPENDIX__Copilot.md`, untracked in the originating
worktree at time of writing). Recommend folding R1–R10 into the team's PRD as
the adjudicated remainder and retiring the parallel documents, so 130 has one
system of record.
