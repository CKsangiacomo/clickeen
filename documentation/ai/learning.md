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
| Model interaction | `POST /model/chat` | San Francisco queue consumer |
| Outcome attachment | `POST /outcome` | San Francisco request handler |
| Product Copilot contract eval | `agents/product-copilot/evals/` | local/CI command output |
| Product Copilot real eval | `agents/product-copilot/evals/real-eval.ts` | local transcripts |
| Translation Agent eval | `agents/translation-agent/evals/` | local command output |

## Interaction Event Contract

Type: `InteractionEvent` in `sanfrancisco/src/types.ts`.

San Francisco creates an interaction event only after `/model/chat` request
shape, grant verification, agent resolution, and capability checks succeed.
Provider execution failures after that point still emit an interaction event
with an `execution_failure` outcome.

Fields:

- `requestId`
- `agentId`
- `occurredAtMs`
- `subject`
- `trace`
- `ai.policyProfile`
- `ai.policyId`
- `ai.learningCapture`
- `ai.taskClass`
- `input`
- `result`
- `usage`

Emission path:

```text
/model/chat
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
POST /outcome
```

Signature:

```text
x-clickeen-signature = hmacSha256("outcome.[body text]", AI_GRANT_HMAC_SECRET)
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
| `SF_D1.copilot_events` | queue consumer attempts to index every valid interaction event |
| `SF_R2 learning/[environment]/[agent id]/[yyyy-mm-dd]/[request id].json` | only paid eligible Product Copilot samples selected by `learningCapture.rawSamplePercent` |
| `SF_D1.copilot_outcomes` | outcome endpoint writes every valid signed outcome |

Raw R2 sampling is controlled by `resolveLearningCaptureDecision` in
`sanfrancisco/src/telemetry.ts`.

Current raw-sample eligibility:

- `agentId === "product.copilot"`;
- subject kind is `user`;
- `ai.learningCapture.rawSamplePercent > 0`;
- deterministic hash of subject/agent/request falls inside the sample percent.

Translation Agent interactions are indexed when emitted but are not currently raw
sample eligible.

## Storage Authorities

### D1

Schema authority: `sanfrancisco/migrations/`.

Cloud-dev database:

```text
sanfrancisco_d1_dev
9ee059a3-538f-4b71-b2ea-f04b33e4897a
```

Tables:

- `copilot_events`
- `copilot_outcomes`

D1 migrations are not applied by the San Francisco Worker deploy command. Schema
changes require the approved Cloudflare D1 operation path before runtime code or
operators rely on new columns.

### R2

Cloud-dev bucket:

```text
sanfrancisco-logs-dev
```

Sample key format:

```text
learning/[environment]/[agent id]/[yyyy-mm-dd]/[request id].json
```

Sample shape is produced by `buildLearningSample` in
`sanfrancisco/src/telemetry.ts`.

Current raw sample fields:

- `captureReason`
- `requestId`
- `agentId`
- `occurredAtMs`
- `subjectHash`
- `trace`
- `ai`
- sanitized `input`
- `result`
- `usage`

### Queue

Queue binding:

```text
SF_EVENTS
```

Cloud-dev queue:

```text
sanfrancisco-events-dev
```

The queue consumer is `SanFranciscoWorker.queue` in `sanfrancisco/src/index.ts`.
The San Francisco package deploy command ensures this queue exists before
`wrangler deploy`.

## D1 Event Index

`copilot_events` stores queryable features extracted from interaction events:

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
- `promptId`
- `policyId`
- `aiProfile`
- `dictionaryHash`
- `taskClass`
- `provider`
- `model`
- `latencyMs`

The D1 schema includes `aiProfile`. Current runtime does not populate that
column when indexing events.

D1 insert failures are logged and do not fail the model response.

## D1 Outcome Index

`copilot_outcomes` stores signed outcome attachments:

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

## Run Signals

Indexed events may include:

- `promptId`
- `policyId`
- `dictionaryHash`
- `envStage`

Promotion decisions must not treat a run with missing required prompt/policy context as
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
`documentation/engineering/CloudflareOperations.md`.

Common questions:

| Question | Table |
| --- | --- |
| Model latency by agent/model | `copilot_events` |
| Invalid output or no-op rate | `copilot_events` |
| Undo rate | `copilot_outcomes` |
| Time to user decision | `copilot_outcomes` |
| Raw sampled payload for a request | `SF_R2 learning/[environment]/[agent id]/[yyyy-mm-dd]/[request id].json` |

Operator lookup sequence:

1. Capture `x-request-id` from the product or Worker response.
2. Check `copilot_events` by `requestId` for model-call metadata.
3. Check `copilot_outcomes` by `requestId` for attached user decisions.
4. If raw capture was eligible and sampled, inspect
   `SF_R2 learning/[environment]/[agent id]/[yyyy-mm-dd]/[request id].json`.
5. Treat missing raw R2 sample as normal unless the event policy had positive
   `learningCapture.rawSamplePercent` and the deterministic sample selected it.

## Failure Semantics

| Failure | Current behavior |
| --- | --- |
| `SF_EVENTS` absent | model response can still succeed; no event is queued |
| `SF_EVENTS.send` fails | send failure is logged from `ctx.waitUntil`; model response can still succeed |
| queue message malformed | message is acknowledged and skipped |
| D1 event index insert fails | logged; model response is not changed |
| R2 sample write fails | logged; queue processing continues |
| outcome signature missing | `/outcome` returns `401 CAPABILITY_DENIED` |
| outcome signature invalid | `/outcome` returns `403 CAPABILITY_DENIED` |
| outcome payload invalid | `/outcome` returns `400 BAD_REQUEST` |
| outcome D1 insert fails | `/outcome` returns `500 PROVIDER_ERROR` |

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
4. Confirm no new core violation was introduced.
5. Keep rollback as a normal code revert/deploy path.
