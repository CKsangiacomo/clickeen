# Interactions in Clickeen

**Living, canonical reference — cross-cutting behavior patterns.**
Seeded 2026-06-27; improved in place as UI program 126 executes. This doc owns the behavior patterns that span every surface and no single component owns (states, command flows, feedback).

- Authority: [`126__PRD__UI_Optimization_Program.md` §12](../../../Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126__PRD__UI_Optimization_Program.md).
- Siblings: [`motion.md`](motion.md) (timing primitives), [`dialogs-and-modals.md`](dialogs-and-modals.md) (overlay mechanism), [`components.md`](components.md) (per-component API).

## What this doc owns (the patterns, not the primitives)

- **States** — loading / empty / error / success across screens. The declared
  pattern + which primitive renders each.
- **Command flows** — click-intent → result, incl. the monetization pattern
  (click → HTTP 402 `UPGRADE_REQUIRED` → upgrade popup, per PRD 125).
- **Feedback** — toasts, inline validation, transient narration
  (`agent-activity`), optimistic vs confirmed UI.
- **Focus & keyboard flows that span components** (arrow-key nav, escape, return
  focus) — the cross-cutting rules; per-component keys live in [`components.md`](components.md).

## Honest current state (this is largely a to-be-declared layer)

- **States are missing today.** The audit found `home` / `ai` / `billing` have
  **no loading/empty/error handling**, and 126D Step 5 makes "every domain has
  the three states" an acceptance criterion. So this doc currently records the
  *target* and the *gap*, not a shipped system.
- **One shipped pattern: the monetization flow.** Click-intent → `UPGRADE_REQUIRED`
  402 → popup (never a disabled button) — the PRD 125 contract. This is the
  reference for "command flows done right" and the model for others.
- **`agent-activity`** is the one shipped feedback primitive (transient narration).

## Why a dedicated owner

Without this doc, every surface improvises states/flows/feedback and drifts —
which is exactly what the audit found. Declared truth is what stops an
agent-operated system from shipping the corpus median (skip the states, hardcode
a disabled button, toast-only an upgrade). Each track's execution deepens the
relevant section here; this is the canonical home, not a per-track note.
