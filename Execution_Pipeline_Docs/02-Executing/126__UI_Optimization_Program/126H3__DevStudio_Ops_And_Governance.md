# 126H3 — DevStudio: Ops & Governance

**Parent:** 126 MAMA. **Runs:** now. **Depends on:** nothing (independent).

## Problem
The governance cockpit bypasses governance: commits have no actor attribution, go straight to `main` skipping all gates, validation is shallow, caches go stale across operators, deploys are fire-and-forget, and the build silently mutates committed source.

## Work
1. **Attribution** — stamp the operator `accountId`/email on every commit; append an audit log.
2. **Gated lane** — stop direct-to-`main`; DevStudio writes open a PR (or push-to-branch + auto-merge) so governance/lint/typecheck run BEFORE `main`.
3. **Real validation** — full CSS-color grammar for token edits (not regex-only); role/contrast sanity.
4. **Conflict UX** — revalidate the token cache on editor open; surface a 409 as "someone else changed this — reload & retry."
5. **Cost preview** — for billing-bearing AI-runtime tier changes, show the cost/limit delta before commit.
6. **Deploy robustness** — R2 sync: content-addressed manifest + atomic swap + orphan cleanup + rollback on partial failure.
7. **Build safety** — stop `build-dieter` silently overwriting committed source SVGs (`svg_new/` → `svg/`); stage overrides into build output only; fail loud on incomplete copy.
8. **Dedupe** — collapse the two near-duplicate read-modify-write implementations (`dieter-tokens.js`, `policy-github.js`) into one shared github-contents helper.

## Done when
Every governance commit is attributed and gated before `main`; validation is real; conflicts surface cleanly; deploys are transactional and reversible; no silent source mutation.

## Not in scope
Visual (126H1), CSS (126H2). Dieter token VALUES (126A).
