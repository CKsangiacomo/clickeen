# 126E — As-built audit: Interactions (GLM, Phase-1 step 1)

> GLM independent pass. Codex writes its own; **not converged**. Evidence from `grep` across `roma/components/*-domain.tsx`, `bob/components/*.tsx`, `roma/app/api/**`.

---

## 1. Loading states — improvised per domain, no shared primitive

| Domain | Loading? | Pattern | file:line |
|---|---|---|---|
| assets | ✅ | `useState(true)`, "Loading assets..." text, `disabled={loading}` buttons | `assets-domain.tsx:134,326,364,412` |
| team | ✅ | `useState(true)`, "Loading team members..." text | `team-domain.tsx:45,184` |
| team-member | ✅ | `useState(true)`, "Loading team member..." | `team-member-domain.tsx:87,203` |
| widget-defaults | ✅ | `useState(true)`, `if (loading)` render gate | `widget-defaults-domain.tsx:45,566` |
| accept-invite | ✅ | `useState(false)`, "Accepting..." button text | `accept-invite-domain.tsx:40,117` |
| home | ❓ | not found in grep — likely NO loading state | — |
| ai | ❓ | not found | — |
| billing | ❓ | not found | — |

**No skeleton/spinner component.** Loading = text ("Loading...") or disabled button. No `Skeleton`/`Spinner`/`ProgressIndicator` component exists in Dieter or Roma.

## 2. Empty/error states — error boundaries exist, empty states improvised

- **Error boundaries:** `roma-domain-error-boundary.tsx` exists. Used by 10 domains (assets, pages, widgets, builder, settings, team, widget-defaults, account-locale-settings, account-notice-modal). This is BETTER than the old audit claimed.
- **Empty state:** assets shows "Assets are unavailable right now." (`assets-domain.tsx:412`) — ad-hoc text, not a shared EmptyState component.
- **No shared EmptyState primitive.** Each domain that shows an empty state writes its own text/markup.

## 3. Feedback — inline alerts, no Toast/Snackbar system

- **ToolDrawer.tsx:** inline `role="alert"` divs with hardcoded color styles (`ToolDrawer.tsx:181-306`). Uses `color-mix(in oklab, var(--color-system-red), …)` for alert border/bg/text. Per-component, not tokenized.
- **Workspace.tsx:** `workspace-status-overlay--error` with `role="alert"` (`:401`). Error overlay during builder errors.
- **SettingsPanel:** "Builder controls failed to load." with `role="alert"` (`:76`).
- **No Toast/Snackbar/Notification component** anywhere in dieter/roma/bob. Feedback is either inline alert divs or modal.
- **No ephemeral/transient feedback layer** — no auto-dismissing toasts. The `agent-activity` component (`role="status" aria-live="polite"`) is the closest thing to ephemeral feedback, but it's only used in bob/TranslationsPanel.

## 4. Upgrade/402 flow — shipped, multiple instances

`upgradeRequired()` helper in Roma API routes returns `{ status: 402, body: { ok: false, kind: 'UPGRADE_REQUIRED', upgrade: args } }`. Found in **3+ route files** (create, duplicate, publish). Client-side: bob/UpsellPopup.tsx (`role="dialog" aria-modal="true"`) handles the 402 → popup flow. This is the PRD 125 monetization pattern — confirmed shipped.

## 5. Copilot undo — shipped

bob/CopilotPane.tsx has a full undo flow:
- `undoRef` stores post-apply signature + ops (`:239-247`).
- `undoAvailable` state (`:247`).
- On "undo" command: restores pre-edit signature via `session.applyOps(undo.ops)` (`:370-384`).
- `buildCopilotUndoOps` from `../lib/copilot/undo` (`:10`).
- Event tracking: `'edit_applied' | 'edit_undone'` (`:288`).

## 6. agent-activity — bob only, not roma

`diet-agent-activity` component used in `bob/components/TranslationsPanel.tsx:85-101` — `role="status" aria-live="polite"`, renders translation agent events. **Zero usage in roma** (grep returned no roma files).

## 7. Bulk upload status machine — domain-local

`assets-domain.tsx:23`: `type BulkItemStatus = 'queued' | 'uploading' | 'success' | 'failed'`. A real 4-state machine for bulk asset uploads. Domain-local; not shared as a Dieter state primitive.

## 8. Honest gaps

- **home/ai/billing** likely have NO loading/empty/error states (grep returned nothing — consistent with the old audit finding). Needs per-domain verification.
- **No shared interaction-state primitives** (Loading, EmptyState, Error, Toast, Skeleton) in Dieter or Roma. Every domain improvises.
- **Feedback colors hardcoded** in ToolDrawer (`color-mix` on `--color-system-red`) — not tokenized.
- **No progress indicator** (determinate/indeterminate) component.

— end GLM as-built, 126E.
