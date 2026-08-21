# PRD 128F — Hard-Cut Release And Ombra Readiness

Status: **EXECUTING — RELEASE PAUSED; SOURCE RECONCILIATION MUST BE RERUN AFTER SYSTEMIC CORRECTIONS**

Depends on: 128B, 128C, 128D, 128E

## 1. Purpose

Remove obsolete agent/model execution paths, update current operator truth,
release the complete PRD 128 hard cut at one exact SHA, verify both current
agents live, and prove the future Ombra insertion boundary without building
Ombra infrastructure.

## 2. Pre-Release Source Reconciliation

Before commit, prove:

- Product Copilot has no six-kind JSON response protocol;
- Product Copilot has no malformed-response repair retry;
- Bob/Roma has no old Product Copilot response consumer;
- both agent homes use the new Clickeen model-turn contract;
- San Francisco has no agent-facing `/model/chat` route/type/caller;
- `POST /model/turn` is the only agent-facing model route;
- OpenAI and DeepSeek agent calls use AI SDK provider plumbing only;
- no old/new adapter or transport feature flag exists;
- no provider credentials/calls exist in agent homes;
- no AI SDK types leak into stable Bob/Roma product contracts;
- no storage, queue, active-turn/session service, runtime registry, or fallback
  exists;
- the existing per-agent, per-tier `maxTurnsPerThread`, token, and timeout
  values remain in the shared runtime policy and DevStudio; Product Copilot
  applies its tier turn value to model steps in Bob's open Copilot thread and
  Translation Agent remains one governed call per chunk;
- Prague `/l10n/translate` remains accurately isolated as out of scope.

Use exact source and generated-artifact scans. Do not treat absence in one
package as whole-repository proof.

## 3. Current Documentation Update

Update every current document whose runtime truth changes, including as
applicable:

- `documentation/ai/README.md`;
- `documentation/ai/sanfrancisco.md`;
- `documentation/ai/ombra.md`;
- `documentation/ai/agents/product-copilot.md`;
- `documentation/ai/agents/translation-agent.md`;
- `documentation/services/bob.md`;
- `documentation/services/roma.md`;
- `documentation/services/devstudio.md` for its LLM Management policy editor
  change;
- Cloudflare/deploy manuals only if a dependency, binding, or deployment command
  genuinely changes.

Current docs must state:

- Clickeen's AI-native founding tenet: named agents operate structured product
  truth through named authorities rather than sitting beside human-only SaaS
  workflows;
- exactly two current agents;
- agent home versus San Francisco versus AI SDK roles;
- Product Copilot text/tool/observation flow;
- Bob draft and Roma Save authorities;
- Translation Agent structured-output/overlay flow;
- exact provider/model failure behavior;
- current route/binding/dependency truth;
- that Ombra remains a strategy boundary, not a deployed service.

Do not copy execution history into current docs.

## 4. Full Verification Gate

Run the focused checks from 128B–128E, then the repository checks required by
the real blast radius.

Required proof includes:

### San Francisco

- TypeScript/typecheck;
- provider request/response/tool/structured-output tests;
- grant/policy/budget tests;
- Worker bundle/dry run.

### Product Copilot

- typecheck;
- task-centric deterministic contract tests;
- exact product-task checks across real current compiled Widget controls,
  including no-extra-path draft truth and rejection behavior;
- real-model eval through the authorized Product Copilot→San Francisco route;
- absence of direct OpenAI/DeepSeek calls and credentials from
  `agents/product-copilot/evals/real-eval.ts` and its replacement;
- no obsolete response protocol residue.

### Bob/Roma

- typecheck and focused builds;
- Product Copilot streamed event tests;
- tool execution/observation continuation tests;
- preview/dirty/undo/Save tests;
- authorization/usage/cancellation tests.

### Translation Agent

- typecheck;
- translation eval;
- representative real-model regression QA before/after the cutover;
- protected content/path/write failure tests;
- ordered result truth.

### Repository

- lint/typecheck/build as required by affected workspaces;
- `git diff --check`;
- clean intended diff and no user-owned unrelated changes included.
- read-only proof that DevStudio LLM Management already exposes both agents'
  existing per-tier turn/token/timeout policy accurately; run its type/build/
  browser checks only if the final implementation changes DevStudio.

## 5. Commit And Deployment

PRD 128 deploys to **cloud-dev only** unless the product owner separately
authorizes another environment.

Because PRD 128 is a pre-GA hard cut:

1. Finish all slices in one compatible branch.
2. Run independent V1–V8 review before commit.
3. Commit only intended PRD 128 code/docs/tests.
4. Push `main` through the normal repository path.
5. Record the exact release SHA and freeze additional `main` pushes until every
   affected deployment is terminal. The Worker workflow uses
   `cancel-in-progress`; a later push invalidates the release run.
6. Derive the exact deployment matrix from final changed paths and the existing
   workflow detection rules. Require successful exact-SHA deployment for:
   - San Francisco Worker;
   - Product Copilot Worker;
   - Translation Agent Worker;
   - Roma Pages;
   - Bob Pages.
   - DevStudio Pages only if the final changed-path set touches DevStudio.
   - Berlin and Tokyo-worker as well if shared contracts/policy changes trigger
     those existing workflow steps.
7. Do not declare runtime completion while any affected surface is on a
   different SHA or non-terminal deployment.
8. Treat the sequential Worker and independent Pages interval as a roll-forward
   release window: agent features are deploying/unavailable and neither agent
   is tested or called until the whole matrix is on the release SHA.

Exact revision evidence is:

- Workers: a successful deployment step in the existing GitHub workflow whose
  `head_sha` equals the release SHA;
- Pages: latest successful production deployment metadata whose `commit_hash`
  equals the release SHA;
- runtime URLs: behavior proof only after revision proof.

Record the workflow/deployment ids and SHA. Health alone is not revision proof.

The cloud-dev names are `sanfrancisco-dev`, `product-copilot-dev`,
`translation-agent-dev`, `roma-dev`, and `bob-dev`; include the DevStudio Pages
project `devstudio`, `berlin-dev`, or `tokyo-assets-dev` only when the final
changed-path set triggers those existing workflow steps.

If one surface fails during the mixed window, stop agent verification and roll
forward every missing/failed surface. If the fully deployed release fails, fix
forward at one new SHA or revert the complete PRD 128 source change in one
commit and redeploy every affected surface. Never restore only `/model/chat`,
one old caller, or one handwritten provider adapter. PRD 128 creates no
active-turn schema or data rollback. Any named live Translation overlay write
is reconciled independently through its owning product route.

Use existing workflows and documented Cloudflare operations. PRD 128 does not
authorize new deployment helpers or topology.

## 6. Live Product Verification

### San Francisco

- health returns success;
- exact OpenAI governed turn works where enabled;
- exact DeepSeek governed turn works where enabled;
- unavailable exact route fails without fallback;
- usage/model/finish truth is present.

### Product Copilot

In one named existing Builder instance:

- open Bob through Roma;
- send a grounded question and observe streamed text;
- request a reversible draft edit;
- prove Bob applies the exact tool result in browser memory;
- prove preview and dirty state change;
- require Product Copilot to observe the result and finish;
- exercise Undo;
- prove no persistence before Save;
- exercise one reversible real Builder edit and inspect the result with the
  product owner;
- explicitly Save only if the release test authorizes that mutation;
- if saved, reconcile exact stored instance/public effects through current
  owning routes.

### Translation Agent

Through one named Roma instance/locale operation:

- run translation using the new execution path;
- verify ordered result truth;
- verify exact Tokyo overlay coordinate and values;
- reconcile any test mutation through Roma/Tokyo owner surfaces.

Before the Translation mutation, record the exact account, instance, locale,
prior overlay state, expected write, and restore/reconciliation action. The
Product Copilot live task remains browser-memory only and uses Undo unless Save
is separately authorized.

Do not use destructive or broad production data for smoke evidence.

## 7. Ombra Readiness Proof

PRD 128 proves only the insertion boundary:

```text
agent home
-> Clickeen model-turn contract
-> San Francisco exact model policy
-> provider factory/adapter
-> model endpoint
```

Proof requires:

- Product Copilot and Translation Agent contain no provider code;
- Bob/Roma product contracts contain no OpenAI/DeepSeek response shapes;
- provider factories are isolated inside San Francisco;
- model capabilities can express the requirements actually used by each agent;
- provider/model unavailability fails explicitly;
- a future adapter/binding/policy/eval addition would not change agent tools,
  Translation Agent overlay semantics, Bob draft execution, or Roma Save.

Do not add a fake Ombra provider, placeholder endpoint, mock production route,
GPU service, provider registry, or deployment target.

## 8. V1–V8 Audit

An independent reviewer must answer:

- V1: no unavailable model/tool/context is substituted;
- V2: no malformed model/tool/product state is silently repaired;
- V3: no required stream event, tool result, usage, agent caller, or generated
  artifact is omitted;
- V4: grants, policy, and capability enforcement fail closed;
- V5: corrupt transcript/tool/structured output is not treated as empty/new;
- V6: partial multi-step or partial locale work is not called full success;
- V7: old JSON/provider flows do not survive under new names;
- V8: normal agent execution does not depend on tests/probes/helpers.

Every failure is corrected before release or recorded as a genuine blocker.

## 9. Program Completion Criteria

- All parent and sub-PRD acceptance criteria pass.
- Old execution paths are absent.
- Current docs match the deployed architecture.
- Exact-SHA deployment is terminal success across all affected surfaces.
- Worker workflow and Pages metadata prove the exact revision before runtime
  smoke evidence begins.
- Both agents pass live owning-product verification.
- The deployed boundary preserves the AI-native product law: agent homes own
  operational reasoning and typed tools, while named product authorities own
  exact execution and observations.
- Product-data effects from live verification are reconciled.
- V1–V8 pass independently.
- Ombra readiness is proven only at the execution seam.
- Execution evidence is appended at the bottom of the relevant PRDs.

## Execution Record

### Release Gate Reopened (2026-08-20)

The product owner paused deployment after identifying systemic AI-authored
loading/empty fallbacks and incorrect Save/Republish receipts in the shared
Builder surfaces. The first correction pass changes Dieter, Bob, Roma, Widget
contracts, tests, and current manuals. Therefore the 2026-08-13 source
reconciliation remains historical evidence for its SHA, not proof for the new
working tree. PRD 128F must not commit, deploy, or claim live completion until
this pass and any similar owner-directed corrections are complete, the complete
verification gate is rerun at one exact SHA, and the owner separately authorizes
release.

### 128F Source Reconciliation (2026-08-13)

**Files deleted:**
- sanfrancisco/src/providers/openai.ts
- sanfrancisco/src/providers/deepseek.ts
- sanfrancisco/src/ai/chat.ts

**Files modified:**
- sanfrancisco/src/index.ts — /model/chat route removed; /model/turn is the only agent-facing model route
- sanfrancisco/src/types.ts — ModelChatRequest/ModelChatResponse removed

**Verification:**
- 6 workspaces typecheck clean
- 165+ gate tests pass across 11 test suites
- wrangler dry-run succeeds
- All §2 pre-release checks pass (no six-kind, no retry, no old consumers, no credentials in agent homes, no AI SDK types in Bob/Roma)
- 28 Bob CopilotPane gate tests pass (tool-after-step, continuation, undo, Send/Stop, two-fact state, tier limit, typography, Save, race-safety, streaming text)
- Deploy pending: requires main push + GitHub Actions + live verification
