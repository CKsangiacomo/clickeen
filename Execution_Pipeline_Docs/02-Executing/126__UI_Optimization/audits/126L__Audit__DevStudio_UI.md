# 126L - Current-Source Pre-Execution Audit: DevStudio UI

Status: PRE-EXECUTION STEPS 6-8 COMPLETE - DevStudio shell, route generation,
token editor, policy pages, CSS, auth, and build boundary audited; exact PRD
reviewed GREEN at `22a92ec9`; no Step-9 execution credit.

## Audit Result

DevStudio's source-governance architecture is sound. The gaps are a half-built
responsive shell and repeated field/table styling. The correct fix is local
shell completion plus the small 126I contracts, not a new app framework.

## Proven Current Truth

- Runtime shell: `admin/src/main.ts`.
- Shell CSS: fixed `220px` sidebar and flexible work area.
- Generated routes: 3 foundation / 22 component / 2 Policy.
- Broken compact behavior: sidebar moves off-screen below `960px`; no opener or
  state exists.
- Token editor: one imperative source-commit dialog, with D1 lifecycle owned by
  126K and content/dirty meaning retained by DevStudio.
- Policy tables: duplicate base styles in Entitlements and LLM Management.
- Import drift: Dieter token CSS and Google font load more than once.
- Dead CSS: collapsed-sidebar selectors/variables, `#root`, local field base,
  invalid `--shadow-lg` fallback, and duplicated table base.

## Boundary

No route, generated inventory, Pages Function, auth, token/policy authority,
account data, or other app changes. 126L consumes completed I/J/K contracts and
does not reimplement them.

## Evidence Needed At Step 9

- DevStudio typecheck/build;
- real host-scoped DevStudio auth;
- route, dialog, and UI browser suites at six viewports;
- orientation/focus/table-overflow proof;
- exact-SHA DevStudio Pages evidence;
- reconciled service/UI docs.
