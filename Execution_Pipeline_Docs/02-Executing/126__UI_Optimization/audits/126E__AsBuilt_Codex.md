# 126E Interactions - Codex As-Built Audit

Status: CODEX ONLY - Phase 1 Step 1 as-built audit.

Scope: current Clickeen interaction behavior across loading/empty/error/success
states, command flows, pending/disabled states, upgrade/upsell behavior,
inline/transient feedback, reason-key copy handling, agent activity, Copilot
feedback, Builder host flow, Bob save/edit behavior, and modal/notice surfaces.

This file states current reality only. It does not select fixes, converge with
GLM, write doctrine, or execute Step 4+.

Authority boundary:

- Product surface inspected: Roma account shell/domains, Bob Builder shell,
  Bob session save/edit state, Translation Agent activity surface, Copilot
  surface, same-origin Roma account commands, selected Dieter feedback
  components as consumed by Bob/Roma.
- Account/session/storage/route/runtime/deploy authorities: inspected only.
- Product data: not touched.
- Verification surface: local source/docs inspection only.

## Executive Current Reality

Clickeen has many interaction behaviors already, but not one cross-surface
interaction grammar.

Strong current evidence:

- Roma account shell has a real global state boundary: loading, auth redirect,
  recoverable error/retry, no-context/reload, then account-context render.
- Widgets, assets, pages, settings, team, profile, usage, Builder, and Bob each
  implement local interaction state in their own shape.
- Widgets implement the clearest PRD 125 monetization flow: account command
  returns HTTP 402 `UPGRADE_REQUIRED`, then Roma renders an upgrade dialog.
- Bob has a separate upsell modal triggered from Bob-side entitlement events.
- Assets render limit/upsell failures inline rather than as an upgrade dialog.
- Translation generation has streamed Agent Activity rows through Roma host SSE
  and Bob `aria-live` rendering.
- Copilot feedback is conversational: loading button label, assistant error
  messages, confirmed edit application, and last-edit undo.
- Bob save is confirmed, not optimistic: dirty state clears only after save
  returns ok and signature reconciliation passes.
- Bob editing and preview are optimistic in browser memory, while persistence
  remains explicit.

Main current gaps:

- No single shared cross-surface interaction primitive is visible.
- `home`, `ai`, and `billing` have no local screen-level loading/empty/error/
  success model beyond the Roma account shell.
- Widgets/assets/pages hand-roll state booleans/strings rather than sharing the
  account shell grammar.
- Monetization is fragmented across Roma widget modal, Bob upsell modal, and
  assets inline failure copy.
- Feedback is mostly inline, modal, conversational, or button-label mutation;
  there is no demonstrated shared toast/snackbar/notification layer.
- Copy/reason-key mapping is fragmented across several local maps.
- Copilot has no streamed activity feed even though translations do.
- Some failures are deliberately or accidentally collapsed into unavailable
  state with limited visible reason detail.

## Program And Source Authority

Evidence:

- MAMA Step 1 is independent current-system read only:
  `Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126__PRD__UI_Optimization_Program.md:182`.
- 126E scope is cross-cutting behavior: loading/empty/error states, command
  flows, and feedback:
  `Execution_Pipeline_Docs/02-Executing/126__UI_Optimization/126E__PRD__Interactions.md:7`.
- Roma owns the logged-in app shell, policy/tier enforcement, same-origin
  account routes, Builder host flow, and account commands:
  `documentation/services/roma.md:18`.
- Bob owns browser-memory editor state and save intent:
  `documentation/services/bob.md:18` and `documentation/services/bob.md:46`.
- Current interaction docs say the domain is partly to-be-declared, with shipped
  patterns around monetization and `agent-activity`:
  `documentation/engineering/UI/interactions.md:20`.

As-built read: interactions are operationally split by surface. There is no one
authority file that defines all states, command feedback, and success/failure
semantics today.

## Roma Account Shell State

Global shell boundary:

- `roma/components/roma-account-context.tsx:34-47` wires `useRomaMe` and redirects
  auth-required errors to login.
- `roma/components/roma-account-context.tsx:74-76` renders loading:
  `Loading account context...`.
- `roma/components/roma-account-context.tsx:78-80` renders auth redirect:
  `Redirecting to sign in...`.
- `roma/components/roma-account-context.tsx:82-95` renders recoverable error copy
  and a Retry button.
- `roma/components/roma-account-context.tsx:97-108` renders no-context copy and a
  Reload button.
- `roma/components/roma-account-context.tsx:110` renders children only after the
  account context resolves.

`useRomaMe` state shape:

- `roma/components/use-roma-me.ts:386-440` returns `loading`, `data`, `error`,
  and `reload`.
- `roma/components/use-roma-me.ts:402-407` sets loading unless the load is silent.
- `roma/components/use-roma-me.ts:369-378` preserves current cached data during
  a silent forced refresh if the fresh result errors and the cached authz is
  still valid.
- `roma/components/use-roma-me.ts:420-430` performs silent refresh with
  `preserveCurrentOnError: true`.

As-built read:

- The account shell is the strongest reusable state grammar currently visible.
- The cache-preserving silent refresh is a specific recovery behavior, not a
  general interaction primitive used everywhere.

## Roma Domain Shell Boundary

Domain shell:

- `roma/app/(authed)/domain-page-shell.tsx:18` wraps domain pages in Suspense
  fallback.
- `roma/components/roma-domain-error-boundary.tsx:52` renders render-error
  boundary UI.

As-built read:

- The domain shell covers Suspense and render failures.
- It does not define each domain's async loading/empty/error/success contract.

## Static Roma Domains

No local state model:

- `roma/components/home-domain.tsx:6-40` renders static account-context content
  without local data state.
- `roma/components/ai-domain.tsx:5-39` renders account entitlement content
  without local data loading/empty/error/success state.
- `roma/components/billing-domain.tsx:5-33` renders static billing cards.

As-built read:

- These domains inherit Roma account-shell states.
- They have no local screen-level async state grammar.

## Widgets Domain Interactions

Local state:

- `roma/components/widgets-domain.tsx:73-83` defines `activeActionKey`,
  `mutationError`, `upgradePrompt`, instance/catalog state, domain loading,
  refreshing, data error, renaming state, rename draft, and rename error.
- `roma/components/widgets-domain.tsx:92-120` refreshes widgets from cache or
  account API and sets loading/refreshing/error state.

Loading/error/empty:

- `roma/components/widgets-domain.tsx:383-397` renders data/mutation/rename
  errors and initial loading copy.
- `roma/components/widgets-domain.tsx:400-404` renders empty catalog copy:
  `No widget types available.`
- `roma/components/widgets-domain.tsx:579-585` renders per-group empty instance
  copy: `No instances yet.`

Pending and success behavior:

- `roma/components/widgets-domain.tsx:184-220` create sets `activeActionKey`,
  clears errors, waits for the POST, refreshes widgets, then routes to Builder.
- `roma/components/widgets-domain.tsx:225-262` duplicate confirms via response
  and forced refresh.
- `roma/components/widgets-domain.tsx:266-283` delete confirms via response and
  forced refresh.
- `roma/components/widgets-domain.tsx:287-319` publish/unpublish confirms via
  response and forced refresh.
- `roma/components/widgets-domain.tsx:421-425` renders `Creating...`.
- `roma/components/widgets-domain.tsx:526-538` renders `Unpublishing...` and
  `Publishing...`.
- `roma/components/widgets-domain.tsx:559-569` renders `Duplicating...` and
  `Deleting...`.

Upgrade prompt:

- `roma/components/widgets-domain.tsx:32-54` normalizes `UPGRADE_REQUIRED`
  payloads into user-facing upgrade prompt copy.
- `roma/components/widgets-domain.tsx:198-204` handles 402 on create.
- `roma/components/widgets-domain.tsx:237-243` handles 402 on duplicate.
- `roma/components/widgets-domain.tsx:302-308` handles 402 on publish.
- `roma/components/widgets-domain.tsx:591-621` renders a `roma-modal` upgrade
  dialog with Close and `/billing` Upgrade actions.

As-built read:

- Widgets has the most complete Roma command-flow feedback.
- The domain uses a global single-flight `activeActionKey` for mutations.
- Success is mostly list refresh/routing, not durable success copy.
- Widget monetization is post-command 402-to-dialog, not disabled precheck.

## Monetization Route Shape

HTTP 402 emitters:

- `roma/app/api/account/instances/route.ts:55-68` builds `UPGRADE_REQUIRED` for
  create-instance limits.
- `roma/app/api/account/instances/route.ts:158-168` emits that create 402.
- `roma/app/api/account/instances/[instanceId]/duplicate/route.ts:45-58`
  builds duplicate `UPGRADE_REQUIRED`.
- `roma/app/api/account/instances/[instanceId]/duplicate/route.ts:114-124`
  emits duplicate 402.
- `roma/app/api/account/instances/[instanceId]/publish/route.ts:33-46` builds
  publish `UPGRADE_REQUIRED`.
- `roma/app/api/account/instances/[instanceId]/publish/route.ts:100-111` emits
  publish 402.

As-built read:

- The response body shape is consistent for widgets.
- The gates/actions differ: create/duplicate and publish are not the same policy
  decision.
- This is not the only monetization presentation in the product.

## Assets Domain Interactions

Local state:

- `roma/components/assets-domain.tsx:131-141` defines assets, storage usage,
  error, loading, deleting asset, delete error, single upload busy/error, bulk
  upload open/busy, and bulk item state.
- `roma/components/assets-domain.tsx:143-180` refreshes assets and stores load
  result/error state.

Feedback:

- `roma/components/assets-domain.tsx:323-330` renders load error with Retry.
- `roma/components/assets-domain.tsx:346` renders `Uploading...` for single
  upload.
- `roma/components/assets-domain.tsx:356` renders `Uploading...` for bulk
  upload.
- `roma/components/assets-domain.tsx:366` renders `Refreshing...`.
- `roma/components/assets-domain.tsx:373-374` renders inline upload/delete
  errors.
- `roma/components/assets-domain.tsx:409-420` renders loading, unavailable, and
  empty table rows.
- `roma/components/assets-domain.tsx:426-470` opens the bulk-upload modal.
- `roma/components/assets-domain.tsx:453-456` renders per-file status plus
  error text.

Upsell/limit copy:

- `roma/components/assets-domain.tsx:43-60` maps asset upsell/error reason keys
  into inline copy.
- `roma/components/assets-domain.tsx:216-233` handles single upload failure.
- `roma/components/assets-domain.tsx:252-299` handles bulk upload queued,
  uploading, success, failed states.

As-built read:

- Assets has real local loading/error/empty/busy/success-per-row states.
- Asset upsell/limit failures are inline text, not the Roma widget upgrade modal.
- Bulk upload is partial-success capable at the row level.

## Pages Domain Interactions

Observed state and feedback:

- `roma/components/pages-domain.tsx:129-144` defines many local state fields for
  pages, sources, loading, refreshing, data errors, mutation errors, copy status,
  selected source, draft/source edits, and active action.
- `roma/components/pages-domain.tsx:315` participates in loading/error state.
- `roma/components/pages-domain.tsx:335` saves page source through a command path.
- `roma/components/pages-domain.tsx:426` mutates page source draft state before
  persistence.
- `roma/components/pages-domain.tsx:518-522` sets `Copied:` / `Copy failed:`
  and clears it after 1800ms.
- `roma/components/pages-domain.tsx:616` renders page state sections.
- `roma/components/pages-domain.tsx:731` renders page action state.
- `roma/components/pages-domain.tsx:778` renders copy status.
- `roma/components/pages-domain.tsx:786` renders disabled publish/unpublish
  explanation.

As-built read:

- Pages has broad local state and transient copy feedback.
- Page source editing is optimistic in memory, with persistence confirmed by
  save.
- Publishing is currently visibly unavailable as disabled action plus inline
  explanation.

## Settings, Team, Profile, Usage

Settings/languages:

- `roma/components/account-locale-settings-card.tsx:110` begins local
  load state.
- `roma/components/account-locale-settings-card.tsx:185` renders load error.
- `roma/components/account-locale-settings-card.tsx:239` renders save success.
- `roma/components/account-locale-settings-card.tsx:327` distinguishes saved
  settings with partial overlay/package follow-up failure in success copy.

Team/profile/usage:

- `roma/components/team-domain.tsx:184` participates in team loading state.
- `roma/components/team-domain.tsx:226` renders team error/empty feedback.
- `roma/components/profile-domain.tsx:275` renders profile feedback state.
- `roma/components/usage-domain.tsx:40` degrades failed storage usage into an
  unavailable display value.

As-built read:

- These domains have local inline state, but not one common state grammar.
- Usage storage failures are visually collapsed into unavailable data.

## Builder Host Flow

Builder command and copy feedback:

- `roma/components/builder-domain.tsx:115-147` maps Builder open reason keys to
  local copy.
- `roma/components/builder-domain.tsx:248-318` reads JSON or streamed account
  command results and forwards activity events.
- `roma/components/builder-domain.tsx:457-462` sets copy feedback and clears it
  after 1800ms.
- `roma/components/builder-domain.tsx:473-482` forwards agent activity to Bob.
- `roma/components/builder-domain.tsx:526-528` sets `accept:
  text/event-stream` only for `generate-translations`.
- `roma/components/builder-domain.tsx:594` participates in builder open request
  state.
- `roma/components/builder-domain.tsx:664` renders builder open error state.
- `roma/components/builder-domain.tsx:831-873` protects against navigation with
  unsaved changes.
- `roma/components/builder-domain.tsx:954` participates in iframe/builder UI.

As-built read:

- Builder host flow has stale/error/timeout and unsaved-change guardrails.
- There is no broad cross-product command state primitive; Builder handles its
  own messages and copy feedback.
- Agent activity streaming currently exists for translation generation only.

## Bob Save And Editing

Save:

- `bob/lib/session/useSessionSaving.ts:22-44` returns early for missing context,
  missing widget type, or clean state.
- `bob/lib/session/useSessionSaving.ts:45-51` sets `isSaving: true` and clears
  errors.
- `bob/lib/session/useSessionSaving.ts:64-99` sends `update-instance` and stores
  validation or save error state if the command fails.
- `bob/lib/session/useSessionSaving.ts:102-116` reconciles signatures and clears
  dirty/saving state only after `ok`.
- `bob/components/TopDrawer.tsx:42` renders `Saving...` in the save action.

Editing and preview:

- `bob/components/td-menu-content/useTdMenuBindings.ts:66` applies ops from UI
  controls to browser-memory editor state.
- `bob/components/Workspace.tsx:277` posts state into iframe preview.
- `documentation/services/bob.md:46` documents Bob as browser-memory editing
  with persistence through save.

As-built read:

- Bob save is confirmed, not optimistic.
- Bob editing/preview is optimistic in memory because controls immediately
  mutate the local session and preview before persisted save.

## Bob Workspace Feedback

Workspace overlays:

- `bob/components/Workspace.tsx:184-188` sets transient/status overlay state.
- `bob/components/Workspace.tsx:395-408` renders preview loading/error/status
  overlays.

As-built read:

- Bob has timed/status overlays in Workspace.
- This is not a global toast/snackbar system.

## Translation Agent Feedback

Bob panel:

- `bob/components/TranslationsPanel.tsx:85-107` renders Agent Activity with
  `role="status"` and `aria-live="polite"`.
- `bob/components/TranslationsPanel.tsx:125-127` tracks starting/generating
  state and activity events.
- `bob/components/TranslationsPanel.tsx:137-176` disables generation when the
  session is dirty/saving, no active locales exist, no fields exist, or the
  instance id is missing.
- `bob/components/TranslationsPanel.tsx:179-200` runs generation, appends up to
  12 activity events, refreshes translations on success, and clears activity on
  finish/error.
- `bob/components/TranslationsPanel.tsx:240-242` renders Agent Activity only
  while generating.

Agent and transport:

- `agents/translation-agent/src/worker.ts:480` emits per-locale writing events.
- `agents/translation-agent/src/worker.ts:537` emits translation writing status.
- `roma/components/builder-domain.tsx:473-482` forwards activity events to Bob.

As-built read:

- Translation generation has the clearest agent-progress affordance.
- Generation failures in `TranslationsPanel` are caught and clear activity, but
  the panel itself does not render a durable inline error message in the
  inspected code.

## Copilot Feedback

Error normalization:

- `bob/components/CopilotPane.tsx:58-68` maps Copilot reason keys into friendly
  messages.
- `bob/components/CopilotPane.tsx:84-121` normalizes detail, issue summaries,
  HTML error pages, timeout text, empty model responses, and fallback messages.

Pending:

- `bob/components/CopilotPane.tsx:235-246` tracks `status: "idle" | "loading"`
  and undo metadata.
- `bob/components/CopilotPane.tsx:713-724` disables send while loading and shows
  `...` as the loading label.

Confirmed edit and undo:

- `bob/components/CopilotPane.tsx:510-556` applies draft edit ops only after
  response parsing, request signature validation, inverse-op construction, and
  local apply success.
- `bob/components/CopilotPane.tsx:562-566` catches errors and pushes assistant
  error messages into the conversation.
- `bob/components/CopilotPane.tsx:608-648` renders and executes Undo for the
  last applied Copilot edit, with post-apply signature validation.

As-built read:

- Copilot does not use the Translation Agent activity surface.
- Copilot loading feedback is minimal.
- Copilot errors are conversational assistant messages.
- Copilot edits are confirmed-before-apply, then undoable.

## Bob Upsell Modal

Bob-side upsell path:

- `bob/components/BuilderApp.tsx:13-23` renders `UpsellPopup` when session chrome
  has an upsell.
- `bob/lib/session/WidgetSessionChrome.tsx:42-49` provides `requestUpsell` and
  stores reason key/detail.
- `bob/components/td-menu-content/useTdMenuBindings.ts:85-91` listens for
  `bob-upsell` events.
- `bob/components/UpsellPopup.tsx:16-30` focuses the close button and handles
  Escape.
- `bob/components/UpsellPopup.tsx:37-80` renders the `ck-upsellModal`.

As-built read:

- Bob upsell is separate from Roma widget 402 modal.
- Bob has better keyboard/focus handling than the Roma widget upgrade modal in
  the inspected code.
- Bob server-side upsell-like Copilot failures can also render as chat messages,
  not only as modal upsell.

## Reason-Key And Copy Handling

Shared and local copy paths:

- `roma/components/same-origin-json.ts:3` parses same-origin JSON error shapes.
- `roma/lib/account-shell-copy.ts:1-29` maps account-shell reason keys and hides
  unknown `HTTP_`, `coreui.`, and `roma.` keys behind fallback copy.
- `roma/components/builder-domain.tsx:115-147` maps Builder open reason keys.
- `bob/components/ToolDrawer.tsx:13-49` maps Bob tool/session errors.
- `roma/components/assets-domain.tsx:43-69` maps asset upload/delete reason
  keys.
- `bob/components/CopilotPane.tsx:58-121` maps/normalizes Copilot failures.
- `roma/components/roma-account-notice-modal.tsx:73-98` can surface a raw
  dismiss failure under `Notice action failed:`.

As-built read:

- Reason-key handling is fragmented by surface.
- Several local maps solve the same user-facing copy problem independently.
- The fallback posture often hides raw implementation keys, but not everywhere.

## Modal And Notice Surfaces

Current modal/notice examples:

- `roma/components/widgets-domain.tsx:591-621` renders widget upgrade modal.
- `roma/components/assets-domain.tsx:426-470` renders bulk upload modal.
- `roma/components/roma-account-notice-modal.tsx:85` renders account notice
  modal.
- `bob/components/UpsellPopup.tsx:37-80` renders Bob upsell modal.

As-built read:

- Modal behavior is not one shared primitive across Roma and Bob.
- Some modal surfaces are pure interaction feedback; others are operational
  status or account notice.

## Known Gaps Only

This section records current gaps without choosing fixes:

- No shared cross-surface interaction state grammar is visible.
- Static Roma domains rely only on account-shell state.
- Data domains reimplement loading/refreshing/error/empty locally.
- Monetization has at least three user-facing behaviors: Roma widget upgrade
  modal, Bob upsell modal, and assets inline copy.
- Translation generation has activity streaming; Copilot does not.
- Feedback is mostly inline, modal, conversational, or button-label mutation;
  no shared toast/snackbar/notification layer is proven.
- Copy maps are fragmented across surfaces.
- Some failure states are collapsed into unavailable data without visible
  reason detail.

## Gaps And Unknowns

- This audit is repo-source only.
- Runtime behavior was not observed in browser.
- Deployed Cloudflare/R2 surfaces were not inspected.
- Account-owned product data was not read or mutated.
- No build, lint, typecheck, Playwright, or runtime verification was run.
- No code behavior was changed.
