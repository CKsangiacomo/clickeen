# Interactions In Clickeen

Authority: 126E Interactions.
Related docs: [`color.md`](color.md), [`components.md`](components.md),
[`dialogs-and-modals.md`](dialogs-and-modals.md), [`motion.md`](motion.md),
[`accessibility.md`](accessibility.md).

This doc owns cross-surface interaction behavior: state meaning, command
feedback, save behavior, monetization feedback, Agent Activity, reason-key copy,
and bulk progress semantics. It does not define a framework, global state store,
generic state machine, toast/snackbar system, dialog framework, or validation
ritual.

## State Vocabulary

Clickeen uses this interaction vocabulary:

```text
loading
refreshing
empty
filtered-empty
unavailable
unauthorized
error
success
pending
partial-success
recovery
```

Every async surface classifies which states apply to its actual product work. A
surface does not render every state by default, and agents must not add fake
states to static pages. They must also not collapse different product meanings:
`empty`, `unavailable`, `unauthorized`, and `error` are separate states when the
user can act or the reason matters.

Roma account shell is the account-boundary reference: loading, auth redirect,
recoverable error with retry, no-context reload, then account render. Roma
domains may be simpler only when their product work is actually simpler.

126E says what state happened. 126B says how visual state colors render.

## Command Lifecycle

Product commands follow this behavioral vocabulary:

```text
intent -> pending -> result -> success | partial-success | failure -> recovery/undo where applicable
```

Feedback comes from the product route or session result, not from hopeful UI
assumptions. A command must not claim full success when work failed, was skipped,
or only partially completed. Partial success is visible when the user has
remaining work, failed items, or changed product state that needs attention.

This is vocabulary for the owning surface. It is not a shared command framework,
global store, or generic state machine.

## Save

Bob editing and preview are browser-memory optimistic: control edits update the
local Builder session and preview immediately.

Bob save is confirmed persistence: account truth changes only after the
`update-instance` command succeeds and Bob reconciles the saved signature. Save
is an explicit action:

- clean state: no save action;
- dirty state: `Save`;
- persistence in flight: `Saving...`;
- confirmed clean state: no save action.

Save is source/base persistence only. It does not generate translations,
regenerate translations, materialize locale packages, publish, unpublish,
rename, duplicate, or delete.

## Feedback Durability

Durable failures, partial success, validation failures, entitlement failures,
and save/publish failures stay visible near the work until the user can
understand or recover.

Transient feedback is allowed for low-risk local actions such as copy-to-
clipboard where no follow-up is required. Toast/snackbar is not Clickeen
doctrine. Public widget-owned local copy status, such as social-share copy
feedback, belongs to that widget runtime and is not the shared Clickeen
interaction system.

Dialogs and modals are used for blocking, entitlement, account notice,
destructive, or high-importance decisions. `dialogs-and-modals.md` owns overlay
mechanics; 126E owns when the product behavior needs a blocking or notice
surface.

## Monetization

Product policy and routes enforce entitlement. UI prechecks can guide the user,
but they are not the control.

Entitlement failures must be visible, actionable, and consistent with the
command surface. User-triggered monetization gates that can route to upgrade use
clear upgrade copy and an upgrade action. Roma widget 402 responses, Bob upsell
modal events, and asset limit/upsell inline copy share one product meaning:
the account tried an action the current tier does not allow.

Inline monetization copy is allowed only when the product situation is genuinely
inline and the user has a clear next action.

## Agent Activity

Agent Activity is for real agent operations with meaningful phases or visible
operational narration. It is not generic loading, polling, job status, or
spinner theater.

Translation generation currently uses Agent Activity. The activity rows narrate
the operation while it runs; they are not the durable command result. After the
operation ends, Bob shows durable feedback for command failure, no accepted
work, partial locale-package failure/skips, or success.

Copilot currently uses conversational feedback, confirmed apply, and undo for
single-step chat/edit operations. Do not convert current Copilot into fake
streamed activity. Future longer or multi-phase Copilot operations may use
Agent Activity only when the phases are real product work.

## Bulk Progress

Bulk asset upload uses a Google Drive-style pattern:

- per-item rows;
- per-item status;
- aggregate progress;
- visible failures;
- partial-success truth;
- recovery where the owning surface supports recovery.

Some files can succeed while others fail. The UI must not collapse that into one
generic success or failure. The same pattern can be used later for uploaded
custom fonts or other account-owned bulk asset operations.

## Reason-Key Copy

Known reason keys resolve to product copy before reaching users. Raw
implementation keys must not leak to user-facing copy. Shared implementation is
preferred where surfaces already share ownership, but this doc does not mandate
one mega-map.

Fallback posture:

- known mapped reason: product copy;
- hidden implementation prefix: surface-owned fallback;
- unknown safe text: explicit display only when the owning surface allows it.

## Ownership Boundaries

- 126E owns interaction semantics.
- 126B owns state color mechanics.
- 126I owns component primitives and loading visuals.
- 126K owns dialog/modal mechanics.
- 126F owns motion timing and animation.
- 126A owns semantic truth and bounded accessibility lanes.

Agents must use these boundaries instead of moving behavior into a new cross-
surface subsystem.
