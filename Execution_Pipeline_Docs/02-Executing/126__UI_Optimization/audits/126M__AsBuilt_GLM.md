# 126M — As-built audit: Roma UI (GLM, Phase-1 step 1)

> GLM independent pass. **Not converged.** Evidence from session-wide Roma inventories.

## Token adoption — HEALTHY
`roma/app/layout.tsx` loads `/dieter/tokens/tokens.css`. `roma/app/roma.css`: 762 lines, **0 hex**, ~140 `var()` uses.

## Component adoption — ABSENT
`diet-btn-txt` ~160×. 4 strays (diet-btn-ic, diet-textedit, diet-dropdown-edit/actions, diet-choice-tiles). **0**: textfield, toggle, segmented, popover, button.

## Parallel system — ~48 `.roma-*`/`.rd-*` classes
`.roma-input/table/modal/modal-backdrop/card/field/form-grid/grid/toolbar/codeblock/instance-rename/locale-settings/module-surface/cell-actions/builder/layout/nav`, `.rd-canvas/canvas--builder/canvas-module/domain/header`. 762 lines.

## 14 domain screens
home, widgets, pages, assets, builder, team, team-member, billing, usage, settings, profile, ai, widget-defaults, accept-invite.

## 5 monoliths
pages-domain.tsx 1,106 · builder-domain.tsx 976 · widget-defaults-domain.tsx 718 · widgets-domain.tsx 527 · assets-domain.tsx 488.

## Leaked dev/stub copy
`pagePublishingUnavailable` ("Page publishing is unavailable…") `pages-domain.tsx:316,786`; disabled IP-localization `pages-domain.tsx:829`; "Billing provider integration is not connected" `billing-domain.tsx:12`; "Broader usage reporting is not connected in Roma yet" `usage-domain.tsx:56`; "Invitations are Berlin-owned" `team-domain.tsx:225`; raw error keys in user-facing strings.

## Save ≠ translation boundary
Current: Roma source save can run translation/locale-package follow-up in the same save request. Must correct: save = persist source + base package ONLY. UI obligation: toast/banner → Translations panel for stale translations.

## Weak states
home, ai, billing have **no** loading/empty/error handling (confirmed in 126E).

— end GLM as-built, 126M.
