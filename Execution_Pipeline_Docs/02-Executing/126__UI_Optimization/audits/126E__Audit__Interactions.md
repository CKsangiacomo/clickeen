# 126E - Pre-Execution Audit: Interactions

Status: CODEX PRE-EXECUTION AUDIT - three-lane review green.
PRD: `../126E__PRD__Interactions.md`.

This audit binds 126E implementation to concrete files and product
authorities. It does not authorize a generic interaction framework, global
state store, toast/snackbar system, dialog framework, validation ritual, or
cross-surface feedback subsystem.

## Authority

- Product surface: interaction behavior across Roma account surfaces and Bob
  Builder surfaces.
- Account/session authority: Roma current account and Bob open editor session.
- Route/API authority: Roma same-origin account routes and Bob account-command
  transport.
- Runtime authority: Bob browser-memory editor session and public widget
  package/save routes where save changes are involved.
- Product data: not touched by 126E pre-execution. Later execution must not
  rewrite persisted account or widget state as part of interaction cleanup.
- Documentation authority: `documentation/engineering/UI/interactions.md` plus
  Bob/Roma service docs and sibling UI docs listed below.
- Verification: local source/docs inspection and focused checks for changed
  Bob/Roma files during later implementation.

## Verification Snapshot

Read-only inspection commands used during this pass:

```bash
rg -n "toast|snackbar|keyboard|focus|126D|translation|save|generate translations|stale|banner|to-be|declared|interactions" documentation/services/bob.md documentation/services/roma.md documentation/engineering/UI/interactions.md documentation/engineering/UI/components.md documentation/engineering/UI/dialogs-and-modals.md documentation/engineering/UI/motion.md
rg -n "useState|Loading|Refreshing|Unavailable|No .*available|role=\"alert\"|UPGRADE_REQUIRED|Saving|Copy failed|Copied|coreui\\.errors|reasonKey|aria-live|Agent Activity|BulkItemStatus|toast|snackbar" roma/components bob/components bob/lib/session roma/app/api -g '!**/node_modules/**' -g '!**/.next/**' -g '!**/.cloudflare/**'
rg -n "toast|snackbar|Toast|Snackbar|agent-activity|diet-agent-activity|ck-upsellModal|roma-modal|UPGRADE_REQUIRED|partial|role=\"status\"|aria-live" dieter roma bob documentation -g '!**/node_modules/**' -g '!**/.next/**' -g '!**/.cloudflare/**'
```

Observed:

- `documentation/engineering/UI/interactions.md` still says feedback includes
  toasts, says 126E owns focus/keyboard flows, frames interactions as mostly
  to-be-declared, and points state acceptance to 126D.
- `documentation/services/bob.md` still says PRD 126D owns a Builder
  toast/banner for stale translations. 126D is typography; save still must not
  generate translations.
- `bob/components/TopDrawer.tsx` keeps the save button visible but disabled
  when clean. The target law is save action appears only when dirty, shows
  `Saving...` while in flight, and disappears once clean/reconciled.
- `bob/lib/session/useSessionSaving.ts` already preserves confirmed save
  semantics: dirty/saving clears after route success and signature
  reconciliation.
- `bob/components/UpsellPopup.tsx` renders raw `reasonKey` in the modal body.
- `roma/components/widgets-domain.tsx` handles widget 402 monetization through
  a Roma upgrade modal with upgrade action.
- `roma/components/assets-domain.tsx` already has per-file bulk status and
  partial-success capability, but the target pattern still needs aggregate
  progress and clearer recovery/dismissal rules where supported.
- `roma/components/roma-account-notice-modal.tsx` can render raw dismiss
  failure text after `Notice action failed:`.
- `roma/components/usage-domain.tsx` collapses failed storage usage into
  `Unavailable`.
- `bob/components/TranslationsPanel.tsx` uses real `diet-agent-activity` with
  `role="status"` and `aria-live="polite"`, but it clears activity after
  generation and currently does not keep durable failure/result feedback for
  command failure, accepted-false, skipped, or package-partial outcomes.
- `bob/components/CopilotPane.tsx` uses conversational feedback, confirmed
  apply, and undo. It does not use Agent Activity today.
- No shared toast/snackbar component or system is proven in current source.
- `tokyo/product/widgets/shared/socialShare.js` has widget-owned local
  `ck-socialShare__toast` / `showToast` copy status. That is public widget
  runtime behavior, not the shared Clickeen toast/snackbar system.

## Current As-Built Read

Clickeen already has useful interaction behavior where the product work
happens:

- Roma account shell is a real account-boundary state grammar.
- Roma widgets/assets/pages/team/profile/usage/widget-defaults each implement
  local state.
- Bob save is confirmed persistence; Bob editing/preview is browser-memory
  optimism.
- Translation generation has Agent Activity.
- Copilot has conversational feedback plus confirmed apply/undo.
- Monetization is route/policy enforced, but user-facing presentation is
  fragmented across Roma widget modal, Bob upsell modal, and asset inline copy.

The 126E execution target is not to add a framework. The target is to make
current surfaces and docs use one deterministic interaction vocabulary and
command-truth posture.

## File-Level Blast Radius

| File or area | Required action | Why compliant |
| --- | --- | --- |
| `documentation/engineering/UI/README.md` | Fix stale UI doc track mapping; interactions belong to 126E. | Agents use the index to navigate authority. Wrong track mapping sends work to the wrong PRD. |
| `documentation/engineering/UI/interactions.md` | Rewrite to current 126E law: state vocabulary, command lifecycle, confirmed save, feedback durability, monetization meaning, Agent Activity, bulk upload, reason-key copy, and 126B state bridge. Remove toast doctrine, keyboard/focus ownership, 126D state ownership, and stale to-be-declared framing. | Docs are part of done; agents need one current interaction truth. |
| `documentation/services/bob.md` | Remove stale "PRD 126D owns Builder toast/banner" language. State that save is source/base persistence only; stale translation attention belongs to the Translations panel/UI refactor lane, not save. | Prevents save/translation recombination and wrong PRD authority. |
| `documentation/services/roma.md` | Keep save/localization separation and route-policy enforcement language aligned with 126E. Add interaction cross-reference only where current behavior is documented. | Roma owns account routes and policy truth. |
| `documentation/engineering/UI/components.md` | Reference interaction semantics only at the component-consumption boundary. Do not turn 126E into component API law. | 126I owns component primitives. |
| `documentation/engineering/UI/dialogs-and-modals.md` | Keep dialog mechanics in 126K/dialog lane. Cross-reference 126E for when blocking/entitlement/destructive feedback uses dialog semantics. | 126E decides behavior; 126K owns overlay mechanics. |
| `documentation/engineering/UI/motion.md` | Keep motion timing/animation owned by 126F and cross-reference interactions for progress/Agent Activity semantics only. | Prevents motion/interaction ownership drift. |
| `roma/components/roma-account-context.tsx`, `roma/components/use-roma-me.ts`, `roma/components/roma-domain-error-boundary.tsx`, `roma/app/(authed)/domain-page-shell.tsx` | Preserve account-shell grammar: loading, auth redirect, recoverable error/retry, no-context/reload, render. | Uses the existing strongest Clickeen pattern; no global state framework. |
| `roma/components/home-domain.tsx`, `roma/components/ai-domain.tsx`, `roma/components/billing-domain.tsx` | Classify whether local screen states apply. If no local async work exists, document/use account-shell-only state instead of forcing fake states. | Domains do not render every state; they render states that match product work. |
| `roma/components/widgets-domain.tsx` | Preserve command-result feedback and 402 upgrade modal; classify loading/refreshing/empty/error/success/upgrade states; align copy posture. | Keeps route/policy enforcement and visible command truth. |
| `roma/components/assets-domain.tsx` | Preserve existing per-item bulk status; add/align aggregate progress, visible failures, partial-success honesty, and recovery/dismissal where supported. Classify loading/unavailable/empty/error separately. | Bulk upload must not collapse multiple file outcomes into one fake result. |
| `roma/components/pages-domain.tsx` | Preserve transient copy feedback for low-risk copy actions and confirmed save for page source/settings. Classify disabled/unavailable publishing separately from pending/error. | Keeps low-risk transient feedback scoped and command truth durable. |
| `roma/components/settings-domain.tsx`, `roma/components/account-locale-settings-card.tsx` | Preserve partial follow-up visibility when locale/overlay save has downstream follow-up failures. | Partial success must remain visible. |
| `roma/components/team-domain.tsx`, `roma/components/team-member-domain.tsx`, `roma/components/profile-domain.tsx`, `roma/components/usage-domain.tsx`, `roma/components/widget-defaults-domain.tsx`, `roma/components/accept-invite-domain.tsx` | Classify applicable states and fix silent omission where failure is collapsed into generic unavailable/no-copy. | Stops state drift without inventing a shared store. |
| `roma/app/api/account/instances/route.ts`, `roma/app/api/account/instances/[instanceId]/duplicate/route.ts`, `roma/app/api/account/instances/[instanceId]/publish/route.ts`, `roma/app/api/account/assets/upload/route.ts`, `roma/app/api/account/assets/route.ts`, `roma/app/api/account/usage/route.ts` | Preserve route/policy enforcement and exact error/402 semantics. UI may improve copy, but control stays with product routes. | Prevents fail-open UI prechecks replacing enforcement. |
| `bob/components/TopDrawer.tsx` | Change save action target to dirty-visible only, `Saving...` while in flight, hidden when clean/reconciled. | Save button presence reflects product truth. |
| `bob/lib/session/useSessionSaving.ts` | Preserve confirmed persistence and signature reconciliation. Improve copy mapping if needed without clearing dirty state optimistically. | Bob persistence boundary remains correct. |
| `bob/lib/session/sessionTypes.ts`, `bob/lib/session/WidgetDocumentSession.tsx`, `bob/lib/session/WidgetSessionChrome.tsx`, `bob/lib/session/sessionTransport.ts` | Preserve browser-memory edit/preview and account-command result authority. Align error/reason-key posture where user-facing. | Bob stays schema/session operated, not framework-driven. |
| `bob/components/ToolDrawer.tsx`, `bob/components/useTranslationPreviewState.ts`, `bob/lib/session/useSessionBoot.ts`, `roma/lib/route-helpers.ts`, `roma/lib/tokyo-client.ts`, `roma/lib/account-authz-capsule.ts`, `roma/lib/account-shell-copy.ts` | Align reason-key copy posture. Raw implementation keys must not leak; do not create a single mega-map unless implementation ownership is already shared. | Product copy is deterministic without inventing a copy subsystem. |
| `bob/components/TranslationsPanel.tsx`, `dieter/components/agent-activity/**`, `tokyo/product/dieter/components/agent-activity/**`, `bob/lib/session/sessionTransport.ts`, `roma/components/builder-domain.tsx`, `roma/app/api/account/instances/[instanceId]/translations/generate/route.ts`, `agents/translation-agent/src/worker.ts`, `documentation/ai/agents/translation-agent.md`, `documentation/capabilities/localization.md` | Preserve Translation Agent Activity as real operational narration with `aria-live`. Add durable generation result feedback for command failure, `translation.accepted: false`, `localePackages.failed`, skipped locales, and partial package coordinates. Bob must inspect the payload, not just HTTP `ok`. | Agent Activity must reflect real agent work and must not masquerade as durable success. Translation generation stays separate from save. |
| `bob/components/CopilotPane.tsx`, `bob/lib/session/useSessionCopilot.ts`, `bob/lib/session/WidgetSessionCopilot.tsx`, `roma/app/api/account/instances/[instanceId]/copilot/route.ts`, `roma/app/api/account/instances/[instanceId]/copilot/outcome/route.ts`, `documentation/ai/README.md` | Preserve conversational feedback, confirmed-before-apply, signature validation, and undo. Do not convert current Copilot to fake activity. | Current Copilot interaction is product law, not a gap. |
| `bob/components/UpsellPopup.tsx`, `roma/components/widgets-domain.tsx`, `roma/components/assets-domain.tsx`, `documentation/capabilities/multitenancy.md` | Converge monetization product meaning across Bob modal, Roma widget modal, and asset inline upsell. Do not show raw reason keys to users. | Entitlement feedback remains actionable and route-enforced. |
| `roma/components/roma-account-notice-modal.tsx`, `documentation/engineering/UI/dialogs-and-modals.md` | Align notice dismissal errors with reason-key copy posture; keep account notice as an explicit modal/notice surface. | Blocking account notices stay explicit without raw implementation leaks. |
| `tokyo/product/widgets/shared/socialShare.js` | Leave widget-owned local social-share copy status alone unless a widget PRD changes it. Do not delete it under 126E's no-toast-doctrine rule. | Public widget runtime behavior is not the shared Clickeen operational toast/snackbar system. |
| `documentation/engineering/UI/color.md` | Cross-reference only: 126E defines state meaning, 126B defines visual color mechanics. | Avoids duplicate color formulas in 126E. |

## Required Documentation Repairs

- `documentation/engineering/UI/interactions.md` must remove toasts as doctrine.
- `documentation/engineering/UI/interactions.md` must remove focus/keyboard
  ownership from 126E.
- `documentation/engineering/UI/interactions.md` must remove the 126D state
  ownership claim and state that interaction states are 126E.
- `documentation/engineering/UI/interactions.md` must stop saying the layer is
  mostly to-be-declared and instead document current 126E law.
- `documentation/engineering/UI/README.md` must map interactions to 126E.
- `documentation/services/bob.md` must remove stale PRD 126D translation
  banner/toast language and preserve save/translation separation.
- Docs must not describe removed behavior as current doctrine.

## V1-V8 Audit

| ID | 126E risk | Required control |
| --- | --- | --- |
| V1 | UI substitutes generic success/unavailable/fake progress for actual command result. | Feedback comes from route/session result or real agent activity. |
| V2 | UI rewrites failed/invalid state into clean/default state without surfacing failure. | Durable failures and validation failures stay visible until understood or recovered. |
| V3 | Relevant loading/error/empty/partial-success/upgrade state is dropped. | Each async surface classifies applicable states and fixes silent omissions. |
| V4 | Disabled/precheck UI replaces route/policy enforcement. | Enforcement remains in product policy/routes; UI is not the control. |
| V5 | Corrupt persisted state is treated as empty/new/unavailable and overwritten. | Interaction cleanup does not rewrite persisted product state. |
| V6 | Save/upload/translation/command claims full success after partial work. | Partial success is visible when remaining work, failed items, or changed state matters. |
| V7 | Fragmented feedback is renamed as doctrine instead of converged. | Existing widget/Bob/assets monetization surfaces converge by product meaning, not by labels. |
| V8 | Normal interactions depend on tests/probes/validation rituals. | Source/docs/runtime behavior carry truth; checks only verify execution. |

## Verification Gates For Execution

1. Search living docs for stale `toast`, `snackbar`, `126D`, keyboard/focus,
   and to-be-declared interaction claims.
2. Verify Bob save action visibility in `TopDrawer.tsx` and confirmed save
   semantics in `useSessionSaving.ts`.
3. Verify Bob edit/preview remains browser-memory optimistic while persistence
   remains explicit save.
4. Verify Translation Agent Activity remains real `aria-live` activity.
5. Verify Translation generation durable result feedback for command failure,
   `translation.accepted: false`, `localePackages.failed`, skipped locales, and
   partial package coordinates after activity ends.
6. Verify Copilot confirmed apply plus undo remains intact.
7. Verify monetization still comes from route/policy enforcement and 402/product
   command results where applicable.
8. Verify raw implementation reason keys do not leak in changed user-facing
   surfaces.
9. Verify bulk upload keeps per-item and partial-success truth where changed.
10. Verify no new toast/snackbar framework, global interaction store, or generic
   state machine was added.
11. Verify `tokyo/product/widgets/shared/socialShare.js` local share-copy status
    was not deleted as shared toast doctrine cleanup.
12. Run focused lint/type checks for changed Bob/Roma files if code changes in
    execution.

## Readiness Verdict

126E is pre-execution ready. Staff Engineer, Senior PM, and Principal TPM
review lanes confirmed green on the current PRD/audit revision. This is not
implementation-green; execution still must satisfy the source, documentation,
verification, and V1-V8 gates named above.
