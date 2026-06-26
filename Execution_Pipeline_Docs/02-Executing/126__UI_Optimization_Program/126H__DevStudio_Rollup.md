# 126H — DevStudio Rollup

**Parent:** 126 MAMA. **Depends on:** 126A–126G (Dieter audited + fixed).

## Scope
DevStudio's showcase shows the audited Dieter truthfully. The generation plumbing already works (verified): foundation pages generated from source, component generator guards real, deploy chain (`build:dieter` → R2) real. So this is small — mostly close gaps + verify.

## Check / fix
1. **Every audited component renders a page.** The generator throws on a component with no page — confirm all components have pages; `command-activity` currently has no stencil (resolved in 126G).
2. **Close the drift gate (masquerade backstop).** Today nothing in CI re-generates + diffs the committed "generated" pages, so a hand-edit can slip through. Wire the generators into CI with a drift check.
3. **Verify the loop end-to-end** — a token edit → commit → `build:dieter` → R2 → product chrome reflects it.

## Done when
DevStudio shows every Dieter component + all tokens, generated from source, with a CI gate that fails on drift.

## Not in scope
New DevStudio domains (models, agents, content) — a separate series.
