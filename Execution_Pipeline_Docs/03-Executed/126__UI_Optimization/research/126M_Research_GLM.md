# 126M — Source research: Dashboard / account UI patterns (GLM, Phase-1 step 3)

> GLM independent pass. M3 + Apple HIG + OpenAI UI. **Not converged.**

## Material 3
- Lists from list-item + card roles. DataTables = composition. Navigation: drawer/bar/rail. Empty/error = composition (no standard component).

## Apple HIG
- **Settings app** = gold standard (grouped lists, section headers, inline controls). `UIContentUnavailableConfiguration` (iOS 17+) for empty/error. `UITableView` for data. `UINavigationController` push/pop.

## OpenAI UI
- Minimal. apps-sdk-ui ships Dialog/Select/Tab/Button/Text Field — basic forms, not a dashboard kit. Apps bring their own dashboard.

## Cross-source synthesis
- The shared primitives Roma needs (DataTable, PageHeader, EmptyState, FormField, Modal, Toast) map to existing patterns: M3 = list/card composition; Apple = UIListCellConfiguration + UIContentUnavailableConfig; OpenAI = Radix Table/Dialog.
- **No source justifies a parallel `.roma-*` system.** All three enforce single-system adoption.

— end GLM research, 126M.
