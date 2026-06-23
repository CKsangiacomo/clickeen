# San Francisco Learning

STATUS: CURRENT SYSTEM OPERATOR SPEC

This document describes the current San Francisco event, outcome, storage, and
eval gates. It is not a planning document and does not describe autonomous
learning.

Code authorities:

- `sanfrancisco/src/index.ts`
- `sanfrancisco/src/telemetry.ts`
- `sanfrancisco/src/types.ts`
- `sanfrancisco/migrations/`
- `agents/product-copilot/evals/`
- `agents/translation-agent/evals/`

## Learning Definition

Current learning means:

```text
model-call event -> outcome attach -> eval/regression gate -> reviewed release
```

San Francisco records model-call events and signed outcome attachments. Agent
behavior changes only through code, prompts, policy files, evals, review, and
deploy. There is no autonomous production mutation loop.

## Event Sources

| Source | Runtime path | Stored by |
| --- | --- | --- |
| Model interaction | `POST /v1/model/chat` | San Francisco queue consumer |
| Outcome attachment | `POST /v1/outcome` | San Francisco request handler |
| Product Copilot contract eval | `agents/product-copilot/evals/` | local/CI command output |
| Product Copilot real eval | `agents/product-copilot/evals/real-eval.ts` | local transcripts |
| Translation Agent eval | `agents/translation-agent/evals/` | local command output |

## Interaction Event Contract

Type: `InteractionEvent` in `sanfrancisco/src/types.ts`.

San Francisco creates one interaction event for each `/v1/model/chat` call.

Fields:

- `v`
- `requestId`
- `agentId`
- `occurredAtMs`
- `subject`
- `trace`
- `ai.policyProfile`
- `ai.policyVersion`
- `ai.learningCapture`
- `ai.taskClass`
- `input`
- `result`
- `usage`

Emission path:

```text
/v1/model/chat
-> build InteractionEvent
-> if SF_EVENTS exists, enqueue with ctx.waitUntil
-> queue consumer indexes D1
-> queue consumer may write sampled raw R2 payload
```

If `SF_EVENTS` is absent, the model call still returns and no interaction event
is emitted.

## Outcome Attach Contract

Type: `OutcomeAttachRequest` in `sanfrancisco/src/types.ts`.

Endpoint:

```text
POST /v1/outcome
```

Signature:

```text
x-clickeen-signature = hmacSha256("outcome.v1.<bodyText>", AI_GRANT_HMAC_SECRET)
```

Required fields:

- `requestId`
- `sessionId`
- `event`
- `occurredAtMs`

Accepted `event` values:

- `edit_applied`
- `edit_rejected`
- `edit_undone`
- `clarification_needed`
- `invalid_output`

Optional fields:

- `outcomeId`
- `surfaceId`
- `artifactId`
- `timeToDecisionMs`
- `accountIdHash`
- `metadata`

No current attribution contract proves causality from outcome linkage.

## Capture And Sampling Rules

Interaction indexing and raw sample capture are different.

| Storage | Rule |
| --- | --- |
| `SF_D1.copilot_events_v1` | queue consumer attempts to index every valid interaction event |
| `SF_R2.learning/...` | only paid eligible Product Copilot samples selected by `learningCapture.rawSamplePercent` |
| `SF_D1.copilot_outcomes_v1` | outcome endpoint writes every valid signed outcome |

Raw R2 sampling is controlled by `resolveLearningCaptureDecision` in
`sanfrancisco/src/telemetry.ts`.

Current raw-sample eligibility:

- `agentId === "cs.widget.copilot.v1"`;
- subject kind is `user`;
- `ai.learningCapture.rawSamplePercent > 0`;
- deterministic hash of subject/agent/request falls inside the sample percent.

Translation Agent interactions are indexed when emitted but are not currently raw
sample eligible.

## Storage Authorities

### D1

Schema authority: `sanfrancisco/migrations/`.

Tables:

- `copilot_events_v1`
- `copilot_outcomes_v1`

### R2

Sample key format:

```text
learning/{ENVIRONMENT}/{agentId}/{YYYY-MM-DD}/{requestId}.json
```

Sample shape is produced by `buildLearningSample` in
`sanfrancisco/src/telemetry.ts`.

### Queue

Queue binding:

```text
SF_EVENTS
```

The queue consumer is `SanFranciscoWorker.queue` in `sanfrancisco/src/index.ts`.

## D1 Event Index

`copilot_events_v1` stores queryable features extracted from interaction events:

- `requestId`
- `day`
- `occurredAtMs`
- `runtimeEnv`
- `envStage`
- `surfaceId`
- `sessionId`
- `instancePublicId`
- `agentId`
- `widgetType`
- `intent`
- `outcome`
- `hasUrl`
- `controlCount`
- `opsCount`
- `uniquePathsTouched`
- `scopesTouched`
- `ctaAction`
- `promptVersion`
- `policyVersion`
- `dictionaryHash`
- `taskClass`
- `provider`
- `model`
- `latencyMs`

D1 insert failures are logged and do not fail the model response.

## D1 Outcome Index

`copilot_outcomes_v1` stores signed outcome attachments:

- `requestId`
- `event`
- `day`
- `occurredAtMs`
- `sessionId`
- `timeToDecisionMs`
- `accountIdHash`
- `outcomeId`
- `surfaceId`
- `artifactId`

Outcome insert failure returns `500 PROVIDER_ERROR`.

## Version Stamps

Indexed events may include:

- `promptVersion`
- `policyVersion`
- `dictionaryHash`
- `envStage`

Promotion decisions must not treat a run with missing required version context as
strong release evidence.

## Eval Gates

Product Copilot:

```bash
pnpm --filter @clickeen/product-copilot test:copilot-contract
pnpm --filter @clickeen/product-copilot eval:copilot
```

Translation Agent:

```bash
pnpm --filter @clickeen/translation-agent eval:translation-agent
```

Runtime smoke that exercises Translation Agent through Roma/Bob/Tokyo:

```bash
pnpm e2e:auth:roma-dev
pnpm e2e:smoke:translation-agent-runtime
```

## Operational Queries

D1 table reads must use the Cloudflare operation path from
`documentation/architecture/CloudflareOperations.md`.

Common questions:

| Question | Table |
| --- | --- |
| Model latency by agent/model | `copilot_events_v1` |
| Invalid output or no-op rate | `copilot_events_v1` |
| Undo rate | `copilot_outcomes_v1` |
| Time to user decision | `copilot_outcomes_v1` |
| Raw sampled payload for a request | `SF_R2 learning/...` |

## Failure Semantics

| Failure | Current behavior |
| --- | --- |
| `SF_EVENTS` absent | model response can still succeed; no event is queued |
| queue message malformed | message is acknowledged and skipped |
| D1 event index insert fails | logged; model response is not changed |
| R2 sample write fails | logged; queue processing continues |
| outcome signature invalid | `/v1/outcome` returns an error |
| outcome payload invalid | `/v1/outcome` returns `400 BAD_REQUEST` |
| outcome D1 insert fails | `/v1/outcome` returns `500 PROVIDER_ERROR` |

## Privacy And Redaction

Raw R2 samples may contain model inputs and outputs. Current raw capture is
limited by paid Product Copilot sampling policy. Do not broaden raw capture
without updating the grant policy, eval/review process, and this document.

Integration-sourced content must preserve source truth. Human-generated content
may be analyzed or proposed for improvement according to source authority.

## Release And Rollback Gate

Before promoting an AI behavior change:

1. Run the eval gate for the affected agent.
2. Run San Francisco typecheck if grant/model/telemetry code changed.
3. Verify deploy workflow status after push.
4. Confirm no new V1-V8 violation was introduced.
5. Keep rollback as a normal code revert/deploy path.
