# Appendix 130A — Copilot

Parent: `130__AUDIT__Defensive_Construction_Audit.md`

Date: 2026-08-19

This appendix carries the full machinery ledger and findings for the Copilot
surface (Bob `CopilotPane` + `agents/product-copilot` + `sanfrancisco` model
execution). It exists separately because Copilot is the densest
guard-per-feature surface in the product and hosts the audit's most
trust-critical finding.

## 1. Turn Lifecycle As Built

From `bob/components/CopilotPane.tsx` and `agents/product-copilot/src/worker.ts`:

1. User submits prompt → Bob validates turn request
   (history ≤ 8 messages, context ≤ 120,000 chars;
   `agents/product-copilot/src/index.ts:49-64`).
2. Roma reserves one turn of `copilot.turns.monthly.max` before granting
   (`roma/lib/ai/account-copilot.ts:167-191`); grant TTL 10 min.
3. Stream opens: `agent_turn_started` → `text_delta` events render the
   assistant message live.
4. A `tool_call` event is **buffered, not executed**
   (`CopilotPane.tsx:612-623`).
5. Only when `model_step_finished` arrives with `finishReason: 'tool-calls'`
   and a matching `modelStepId` does the buffered tool execute
   (`CopilotPane.tsx:625-644`).
6. Ops are expanded, validated, inverse ops built, then applied atomically
   through the same `applyOps` path as manual editing
   (`CopilotPane.tsx:336-442`); undo token recorded with a post-apply
   signature.
7. Failure at any step → normalized chat message; draft unchanged.

## 2. What Is Correctly Built

- **Tool buffering until step completion** — prevents half-applied model
  intent. Correct.
- **Atomic batch application with rejection surfaced to the model** — no
  silent partial edits.
- **Stop button** — `isStopped` is immediate local truth; San Francisco treats
  caller-cancel as clean end, not an error
  (`sanfrancisco/src/ai/model-turn.ts:341-342`).
- **Turn-limit copy** — "You've used all your Copilot turns for this month.
  They reset on the 1st." Honest, specific, actionable.
- **Error normalization layer** (`CopilotPane.tsx:80-119`) — HTML error pages,
  timeouts, empty responses, and reason keys all map to plain language.
- **Undo race guard** — signature check blocks undo after later manual edits,
  with a clear message.

## 3. Ledger: Guards And Their User-Visible Cost

| File:Line | Machinery | User experience | Path |
| --- | --- | --- | --- |
| `CopilotPane.tsx:834-900` | Send disabled while `status==='loading'` or `uiDisabledReason` | Disabled button; reason text may be scrolled out of view | ON (every turn) |
| `CopilotPane.tsx:311-314` | `!compiled` disable | "Load an instance to begin." | ON (initial) |
| `CopilotPane.tsx:612-623` | Tool call buffered until step finish | Narration visible before any edit exists | ON (every edit) |
| `CopilotPane.tsx:625-644` | Execution gated on exact `modelStepId` match | If event missing/mismatched: edit silently never happens | ON (every edit) |
| `CopilotPane.tsx:632` | Malformed buffered call | "Copilot requested an edit but the request was malformed." | OFF |
| `CopilotPane.tsx:690-696` | Undo signature check | "The widget changed after Copilot applied that edit. Undo was not applied." — not reported back to the model thread | OFF |
| `CopilotPane.tsx:457-462` | Tier step limit mid-turn | "Copilot reached the step limit for this turn…" | OFF |
| `account-copilot.ts:144` | 10-min grant expiry | Generic "Copilot failed unexpectedly" | OFF |
| `worker.ts:196-203` (product-copilot) | Multiple tool calls in one step rejected | Chat error; nothing applied | OFF |
| `worker.ts:223-231` (product-copilot) | finishReason/toolCallCount consistency | Chat error; nothing applied | OFF |
| `model-turn.ts:207-210` (sanfrancisco) | Budget timeout abort | "Copilot timed out. Please try again with a smaller change." | OFF (slow model) |
| `model-turn.ts:234` (sanfrancisco) | `maxRetries: 0` | Single attempt; transient provider blip = visible failure | ON (policy) |

## 4. The Finding That Needs An Architect Decision

**Copilot narrates before it acts, and the narration can outlive the act.**

Assistant text streams live while the tool call sits buffered. If
`model_step_finished` never arrives (stream truncation, network abort after
text but before the terminal event), the user has read a completed claim —
"Done — I updated your questions" — and **nothing was applied, with no
error**. The buffered call simply never fires
(`CopilotPane.tsx:612-644`). The turn then idles or ends on the HTTP failure
path, which shows a generic failure message only when the request itself
rejects — not when the stream merely stops early.

Why it matters more here than anywhere else: Copilot is the surface where the
user is explicitly asked to trust that the product did what it said. A
narration/assertion split inverts that trust at the exact moment it is being
built.

**Decision options (architect call):**

- **A. Hold narration of edits until applied.** Text describing an edit
  renders only after the tool executes; pre-apply text limited to progress.
  Strongest trust guarantee; changes streaming feel.
- **B. Mark the assertion.** The assistant message carries an explicit
  applied/failed state badge resolved at turn end. Keeps streaming; adds UI
  machinery.
- **C. Terminal-event guarantee.** Any stream that ends without
  `model_step_finished` + `agent_turn_finished` is treated as failed and the
  unexecuted narration is visibly annotated. Cheapest; still lets a claim
  stand temporarily.

## 5. Secondary Findings

1. **Undo rejection is invisible to the model thread**
   (`CopilotPane.tsx:690-699`). The user sees the rejection; subsequent model
   turns still believe the edit stands. The next Copilot instruction can
   therefore build on state the user thinks was reverted. Disposition: report
   the rejection into the thread context (one-line continuation).
2. **Spinner without timeout** on send (`CopilotPane.tsx:834`) — Pattern 4 of
   the parent audit applies.
3. **`maxRetries: 0`** (`sanfrancisco/src/ai/model-turn.ts:234`) is defensible
   for streaming, but a transient provider blip on turn start (before any
   text) is indistinguishable from a hard failure to the user. Disposition:
   genericize — one retry only when zero bytes have streamed.
4. **Disable reasons can scroll out of view** — the send button is disabled
   with the reason rendered elsewhere in the pane (Pattern 3 of the parent
   audit).

## 6. Disposition Summary

| Item | Disposition | Owner of decision |
| --- | --- | --- |
| Narration-before-apply | Architect decision (A/B/C above) | Architect |
| Undo rejection invisible to thread | Simplify — one-line thread continuation | Execution PRD |
| Send spinner timeout | Genericize — shared timeout+retry | Execution PRD |
| Zero-byte turn retry | Genericize — retry only before first byte | Execution PRD |
| Disable reason placement | Simplify — reason adjacent to control | Execution PRD |
