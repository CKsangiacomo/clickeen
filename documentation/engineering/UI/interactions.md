# Interactions in Clickeen

**Living, canonical reference — cross-cutting behavior patterns.**
Seeded 2026-06-27; improved in place as UI program 126 executes. This doc owns
the behavior patterns that span surfaces and no single component owns: states,
command flows, Agent Activity, upsell feedback, save behavior, and bulk
progress.

- Authority: [`126__PRD__UI_Optimization_Program.md` §12](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126__PRD__UI_Optimization_Program.md).
- Siblings: [`motion.md`](motion.md) (timing primitives), [`dialogs-and-modals.md`](dialogs-and-modals.md) (overlay mechanism), [`components.md`](components.md) (per-component API).

## What this doc owns (the patterns, not the primitives)

- **States** — loading / empty / error / success across screens. The declared
  pattern + which primitive renders each.
- **Command flows** — click-intent → result, incl. the monetization pattern
  (click → HTTP 402 `UPGRADE_REQUIRED` → upgrade popup, per PRD 125).
- **Feedback** — inline validation, durable operation result feedback, transient
  narration (`agent-activity`), optimistic vs confirmed UI, and monetization
  feedback. Toast/snackbar is not Clickeen doctrine.

## Honest current state (this is largely a to-be-declared layer)

- **States are uneven today.** Roma, Bob, and DevStudio have real loading,
  empty, error, success, blocked, and partial-success states, but the vocabulary
  and feedback durability are not yet consistent across every surface. 126E owns
  the convergence.
- **State color is separate.** 126E owns what state happened; 126B owns how
  hover, pressed, selected, disabled, muted, success, warning, error, and info
  states are colored.
- **One shipped pattern: the monetization flow.** Click-intent → `UPGRADE_REQUIRED`
  402 → popup (never a disabled button) — the PRD 125 contract. This is the
  reference for command-flow truth and the model for others.
- **`agent-activity`** is the one shipped feedback primitive (transient narration).

## Why a dedicated owner

Without this doc, every surface improvises states/flows/feedback and drifts —
which is exactly what the audit found. Declared truth is what stops an
agent-operated system from shipping the corpus median: skip the states, hardcode
a disabled button, or hide an upgrade behind local copy. Each track's execution
deepens the relevant section here; this is the canonical home, not a per-track
note.
