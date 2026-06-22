STATUS: REFERENCE — MUST MATCH RUNTIME
This document describes how San Francisco “learns” via outcomes: what is logged, what is indexed, what is considered success/failure, and how we prevent regressions.
Runtime code + deployed Cloudflare bindings are operational truth; any mismatch here is a P0 doc bug and must be updated immediately.

# San Francisco — Learning Loop

## 0) What “learning” means (for Clickeen)

“Learning” is not “more logs”. Learning means **outcomes and evals** that let us answer:
- did an edit succeed (ops applied)?
- did the user keep or undo it?
- did the user convert (signup/upgrade)?
- where is the system failing (timeouts, upstream errors, invalid ops)?

San Francisco provides the execution surface and the learning data plane:
- it logs every interaction (best-effort, non-blocking)
- it indexes a minimal subset for querying
- it accepts outcome attachments from Roma/Bob (sources of truth for conversions + UX decisions)

Day-one capture is not autonomous learning. The behavior-change path is:

```text
trace/outcome -> eval/review -> release -> rollback
```

The first Product Copilot eval harness is a deterministic fixture runner in
`agents/product-copilot/evals/`. It is an acceptance/regression gate for the Product
Copilot brain contract; it is not autonomous learning.

## 1) The two event streams

### 1.1 Interaction events (San Francisco emits)

Every San Francisco `/v1/model/chat` call produces an `InteractionEvent` (see `sanfrancisco/src/types.ts`):

- `requestId` (uuid)
- `agentId`
- `occurredAtMs`
- `subject` (anon/user/service)
- `trace` (may include `sessionId`, `instanceId`, `surfaceId`, `envStage`)
- `input` (model-call input envelope)
- `result` (model-call result envelope)
- `usage` (provider/model/token/latency)

This event is:
1) enqueued into `SF_EVENTS`
2) written raw to `SF_R2`
3) indexed into `SF_D1` (best-effort)

### 1.2 Outcome events (Roma/Bob attach)

San Francisco cannot infer Builder UX decisions. Those are attached via `/v1/outcome`.

Payload: `OutcomeAttachRequest` (see `sanfrancisco/src/types.ts`)

Events currently supported:
- `edit_applied`
- `edit_rejected`
- `edit_undone`
- `clarification_needed`
- `invalid_output`

Outcome payloads may include `outcomeId`, `surfaceId`, and `artifactId` linkage
fields. Linkage is not causality. Later save, publish, undo, conversion, or
absence does not prove the agent caused the outcome until a future governed
attribution system proves that link.

Auth:
- The caller must sign the JSON body with `AI_GRANT_HMAC_SECRET` and pass the signature as `x-clickeen-signature`.
- Roma is the live product backend surface that forwards account-mode outcomes to San Francisco.

## 2) Storage model (cheap raw + small indexes)

### 2.1 R2: bounded raw learning samples

Selected paid samples are stored as JSON in R2:
`learning/{ENVIRONMENT}/{agentId}/{YYYY-MM-DD}/{requestId}.json`

R2 is the bounded debug/eval store. The durable fact layer remains D1 metering and outcome rows.

### 2.2 D1: queryable indexes

San Francisco maintains two D1 tables. Their schema is owned by San Francisco D1 migrations, not runtime Worker boot code:

#### `copilot_events_v1`
One row per `requestId` with “learning features” extracted from the raw event:
- `day`, `runtimeEnv`, `envStage`
- `surfaceId`, `sessionId`, `instanceId` (stored in the current D1 `instancePublicId` column)
- `agentId`, `widgetType`
- `intent`, `outcome`
- `hasUrl`, `controlCount`
- `opsCount`, `uniquePathsTouched`, `scopesTouched`
- `promptVersion`, `policyVersion`, `dictionaryHash`
- `provider`, `model`, `latencyMs`

#### `copilot_outcomes_v1`
One row per `(requestId, event)`:
- `day`, `occurredAtMs`, `sessionId`
- `outcomeId`, `surfaceId`, `artifactId`
- `timeToDecisionMs` (for keep/undo)
- `accountIdHash` (optional, for cohort analysis)

Missing outcomes remain missing. Corrupt traces or outcomes are invalid, not
absence.

## 3) Versioning (so improvements are attributable)

Every interaction should include these “version stamps” in the indexed row:
- `promptVersion` (agent prompt revision)
- `policyVersion` (post-model rules revision)
- `dictionaryHash` (hash of global edit dictionary)
- `envStage` (exposure stage: `local|cloud-dev|uat|limited-ga|ga`)

If any of these are missing, analysis becomes garbage (“we changed something, but don’t know what”).

## 4) Product Copilot evals (current repo reality)

Product Copilot ships two executable gates in `agents/product-copilot/evals/`:

- **Contract test** — `pnpm --filter @clickeen/product-copilot test:copilot-contract`. A deterministic fixture runner (no live model call) that pins the Product Copilot brain contract: conversational answer, clarification, draft edit, exact draft ops, one bounded structural retry, and draft-edit wording that must not claim applied/saved/published product success before Bob validates and applies the draft edit.
- **Real eval** — `pnpm --filter @clickeen/product-copilot eval:copilot`. Calls the live model through `real-eval.ts`, scores each case with an LLM-as-judge rubric, runs pass@1 and pass^k (majority over K samples), writes transcripts under `evals/transcripts/`, and exits non-zero on any failure (regression gate).

Do not add passive fixture files or fixture-only docs without an executable
harness behind them.

## 4.1) Translation Agent eval harness (current repo reality)

The active repo-owned Translation Agent eval harness lives in
`agents/translation-agent/evals/` and runs through:

```bash
pnpm --filter @clickeen/translation-agent eval:translation-agent
```

It is an executable acceptance/regression gate for exact path preservation,
malformed structured output rejection, placeholder parity, richtext tag parity,
and anchor integrity. It is not autonomous learning and it does not call an LLM.

## 5) What to measure (minimum)

From `copilot_events_v1`:
- intent distribution (`explain|clarify|edit`)
- outcome distribution (`no_ops|draft_edit_returned|invalid_ops|...`)
- latency (`p50/p95`)
- ops size (`opsCount`, `uniquePathsTouched`, `scopesTouched`)

From `copilot_outcomes_v1`:
- undo rate (`edit_undone / edit_applied`)
- time-to-decision

## 6) Operational runbooks (what to do when metrics go bad)

### Invalid ops spikes
Likely causes:
- prompt drift (model started returning non-conforming ops)
- missing/incorrect control constraints in input fixtures
- policy layer regression

First actions:
- inspect raw R2 payload for a few failing `requestId`s
- confirm which `promptVersion/policyVersion/dictionaryHash` is responsible

### Undo rate spikes
Likely causes:
- too-big edits (scope/groups too broad)
- ambiguous vocabulary not clarified

First actions:
- expand dictionary clarifications for the top ambiguous phrases
- tighten policy layer (caps + scope confirmation)

### Upstream provider errors/timeouts
Likely causes:
- model output invalid JSON
- timeouts due to slow upstream or too-large prompts

First actions:
- confirm timeouts are enforced by grant budgets
- ensure “repair retry” doesn’t amplify timeouts
- keep fail-soft parsing so UI does not devolve into 502 spam
