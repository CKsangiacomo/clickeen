# Interactions In Clickeen

Canonical doctrine: this document.
Execution PRD: [`126E__PRD__Interactions.md`](../../../Execution_Pipeline_Docs/03-Executed/126__UI_Optimization/126E__PRD__Interactions.md).
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

Roma account shell is the account-boundary reference. Its navigation and page
frame remain visible while the Berlin-owned account context resolves; only
the page content shows a skeleton. Roma trusts that accepted account result.
Reconciliation keeps current content
mounted while the owning command shows pending feedback. Terminal auth or
an unavailable account result fails closed, and a recoverable account error stays in the page
content with Retry. Roma domains may be simpler only when their product work is
actually simpler.

This document says what state happened. [`color.md`](color.md) says how visual
state colors render.

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
`save-instance` command succeeds and Bob reconciles the saved signature. On
New, that HTTP 201 result also carries the first saved instance ID and the exact
current account `baseLocale` persisted for that source. Bob adopts both into
its current `meta`/`translationSetup` through the same result; there is no
reopen or new message. This keeps the completed Save coherent but does not
serialize First Save against a simultaneous account-locale PATCH across
authorities. Bob includes `widgetType` only on First Save. Existing Save is
addressed by the saved account/instance coordinate and carries `config` only;
Roma obtains Widget identity from Tokyo's saved list fact instead of comparing
a caller field. Save is an explicit action:

- clean state: no save action;
- dirty state: `Save`;
- persistence in flight: `Saving...`;
- confirmed clean state: no save action.

Save is source/base persistence only. It does not generate translations,
regenerate translations, mutate locale overlays, publish, unpublish,
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
mechanics; this document owns when product behavior needs a blocking or notice
surface.

## Monetization

Entitlements are system capabilities governed by account tier. They are not
Widget-specific policy. A Widget declares only which generic entitlement a
unique state/action coordinate consumes and which exact localized contextual
body message describes that denial. Tier values, the current plan, selection of
the next eligible plan, and the Upgrade action remain system truth.

The entitlement decision happens once at the user-intent boundary that owns the
action:

- Bob's shared editing boundary consumes Roma's exact policy snapshot before a
  governed manual or Copilot edit changes the browser-memory draft.
- Roma gates first Save, Duplicate, Publish, account locale changes, uploads,
  and other Roma-native commands when that command is attempted.
- A direct Roma Widget-editing host such as Widget Defaults uses the same
  compiled capability binding before mutating its local draft.

An allowed action proceeds. A denied action does not mutate the draft or claim
success; its owning boundary emits one exact denial. Save, materialization,
Tokyo storage, and public serving trust accepted Clickeen truth and do not
repeat the same Widget-bound limit check.

Every legitimate denial opens one Roma-hosted account upsell Popup. Its content
is assembled without collapsing ownership:

```text
system policy      -> current plan + target eligible plan + capability
Widget artifact    -> exact localized contextual body template/message id
Roma/system UI     -> Popup title/composition + Upgrade/dismiss labels and behavior
Dieter             -> Popup presentation and lifecycle only
```

For example, a Widget template may produce “Your current plan is Free. Upgrade
to Starter to add more questions.” The Widget owns only the contextual sentence
template, including “add more questions.” Roma interpolates exact system-owned
`{currentPlan}` and `{targetPlan}` values. The Widget never owns tier values,
plan selection, CTA labels, CTA destinations, or popup behavior. A denial for a
purely account-level action with no Widget meaning uses system-owned contextual
copy instead.

Bob sends the denied system capability and compiled Widget message identity to
Roma; it does not render a local plan-limit dialog or send raw implementation
detail. Roma uses the trusted compiled Widget message association it already
owns and opens the same Popup used for Roma-native denials. Missing Widget copy
does not become generic fallback copy: it is an artifact-production failure.
There is no global upsell store, Widget-name copy switch in Roma, or duplicated
Bob/Roma modal sequence.

During pre-GA, Upgrade remains a system-owned scaffold. It does not navigate to
inactive Billing, mutate a plan, call a provider, claim success, or invent a
sales/contact destination. Ordinary Billing navigation may still inspect the
current plan. Opening or dismissing the Popup preserves unsaved Builder work
and does not invoke a discard guard because the denied edit was never applied.
Future billing owns commercial execution.

Inline monetization copy remains appropriate only when the product situation is
genuinely inline and the user has a clear next action. It does not replace the
ownership or one-decision rules above.

Current cloud-dev implementation: all five current Widget artifacts carry their
exact bound English message maps. Bob's common pre-mutation Widget-limit gate
leaves a denied draft unchanged and sends the exact denial identity to Roma.
Bob's local upsell Popup is removed; Roma hosts the one shared Popup and
combines exact Widget context with system plan/action truth. Save persists
editable source only and does not re-evaluate the Widget limit. Cloud-dev
deploy proof passes; owner QA remains pending.

## Agent Activity

Agent Activity is for real agent operations with meaningful phases or visible
operational narration. It is not generic loading, polling, job status, or
spinner theater.

Translation generation currently uses Agent Activity. The activity rows narrate
the operation while it runs; they are not the durable command result. After the
operation ends, Bob shows durable feedback for command failure, no accepted
work, partial per-locale translation failures, or success.

The static Agent Activity title inside the ToolDrawer comes from the open
widget's compiled ToolDrawer labels. The Translation Agent owns only the live
narration rows. Dieter owns the purple active surface and animated system-color
border made only from system purple and indigo; that motion communicates that
the direct agent operation is active and does not claim percentage progress.

Translation-sync attention stays in Bob's Translations panel beside Tokyo's
authoritative summary and Generate action. Roma must not derive or display a
second translation-sync state.

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

- This document owns interaction semantics.
- [`color.md`](color.md) owns state color mechanics.
- [`components.md`](components.md) owns component primitives and loading visuals.
- [`dialogs-and-modals.md`](dialogs-and-modals.md) owns dialog/modal mechanics.
- [`motion.md`](motion.md) owns motion timing and animation.
- [`accessibility.md`](accessibility.md) owns semantic truth and bounded
  accessibility lanes.

Agents must use these boundaries instead of moving behavior into a new cross-
surface subsystem.
