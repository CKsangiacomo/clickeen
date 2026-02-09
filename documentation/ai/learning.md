STATUS: REFERENCE — MUST MATCH RUNTIME
This document describes how San Francisco “learns” via outcomes: what is logged, what is indexed, what is considered success/failure, and how we prevent regressions.
Runtime code + deployed Cloudflare bindings are operational truth; any mismatch here is a P0 doc bug and must be updated immediately.

# San Francisco — Learning Loop

## 0) What “learning” means (for Clickeen)

“Learning” is not “more logs”. Learning means **outcomes** that let us answer:
- did an edit succeed (ops applied)?
- did the user keep or undo it?
- did the user convert (signup/upgrade)?
- where is the system failing (timeouts, upstream errors, invalid ops)?

San Francisco provides the execution surface and the learning data plane:
- it logs every interaction (best-effort, non-blocking)
- it indexes a minimal subset for querying
- it accepts outcome attachments from Paris/Bob (sources of truth for conversions + UX decisions)

## 1) The two event streams

### 1.1 Interaction events (San Francisco emits)

Every `/v1/execute` produces an `InteractionEvent` (see `sanfrancisco/src/types.ts`):

- `requestId` (uuid)
- `agentId`
- `occurredAtMs`
- `subject` (anon/user/service)
- `trace` (may include `sessionId`, `instancePublicId`, `envStage`)
- `input` (agent input)
- `result` (agent result)
- `usage` (provider/model/token/latency)

This event is:
1) enqueued into `SF_EVENTS`
2) written raw to `SF_R2`
3) indexed into `SF_D1` (best-effort)

### 1.2 Outcome events (Paris/Bob attach)

San Francisco cannot infer conversions or UX decisions. Those are attached via `/v1/outcome`.

Payload: `OutcomeAttachRequest` (see `sanfrancisco/src/types.ts`)

Events currently supported:
- `ux_keep`, `ux_undo`
- `cta_clicked`
- `signup_started`, `signup_completed`
- `upgrade_clicked`, `upgrade_completed`

Auth:
- The caller must sign the JSON body with `AI_GRANT_HMAC_SECRET` and pass the signature as `x-paris-signature`.
- Paris is the canonical “gateway” that forwards outcomes to San Francisco.

## 2) Storage model (cheap raw + small indexes)

### 2.1 R2: raw interaction payloads

Raw events are stored as JSON in R2:
`logs/{ENVIRONMENT}/{agentId}/{YYYY-MM-DD}/{requestId}.json`

R2 is the long-term “truth” for replay / offline analysis.

### 2.2 D1: queryable indexes

San Francisco maintains two D1 tables (created on demand in code):

#### `copilot_events_v1`
One row per `requestId` with “learning features” extracted from the raw event:
- `day`, `runtimeEnv`, `envStage`
- `sessionId`, `instancePublicId`
- `agentId`, `widgetType`
- `intent`, `outcome`
- `hasUrl`, `controlCount`
- `opsCount`, `uniquePathsTouched`, `scopesTouched`
- `ctaAction`
- `promptVersion`, `policyVersion`, `dictionaryHash`
- `provider`, `model`, `latencyMs`

#### `copilot_outcomes_v1`
One row per `(requestId, event)`:
- `day`, `occurredAtMs`, `sessionId`
- `timeToDecisionMs` (for keep/undo)
- `accountIdHash`, `workspaceIdHash` (optional, for cohort analysis)

## 3) Versioning (so improvements are attributable)

Every interaction should include these “version stamps” in the indexed row:
- `promptVersion` (agent prompt revision)
- `policyVersion` (post-model rules revision)
- `dictionaryHash` (hash of global edit dictionary)
- `envStage` (exposure stage: `local|cloud-dev|uat|limited-ga|ga`)

If any of these are missing, analysis becomes garbage (“we changed something, but don’t know what”).

## 4) Golden set (regression harness)

The golden set is a deterministic regression suite for Copilot behavior:
- it protects routing decisions (`intent`)
- it protects deterministic clarifications (dictionary)
- it protects guards (URL rules, Cloudflare HTML detection)

It is intentionally **not** a benchmark of “LLM creativity” (flaky).

Files:
- `fixtures/copilot/widgets/{widgetType}.json`
  - `{ "currentConfig": {...}, "controls": [...] }`
- `fixtures/copilot/prompts.jsonl`
  - one JSON object per line (comments allowed with `#`)
- Runner: `scripts/eval-copilot.mjs`
  - Script: `pnpm eval:copilot`

Current target size:
- ≥ 50 prompts (enough to catch regressions, small enough to stay fast)

How to run:
- `bash scripts/dev-up.sh`
- `pnpm eval:copilot`

How to expand safely:
- Prefer prompts that hit deterministic routes (explain/clarify/guards) to avoid upstream flakiness.
- Avoid relying on live websites or requiring DeepSeek output determinism.
- If you want to test “real model edits”, put that in a separate upstream smoke suite (not the golden set).

## 5) What to measure (minimum)

From `copilot_events_v1`:
- intent distribution (`explain|clarify|edit`)
- outcome distribution (`no_ops|ops_applied|invalid_ops|...`)
- latency (`p50/p95`)
- ops size (`opsCount`, `uniquePathsTouched`, `scopesTouched`)

From `copilot_outcomes_v1`:
- undo rate (`ux_undo / (ux_keep + ux_undo)`)
- time-to-decision
- CTA click-through (`cta_clicked / sessions`)
- conversion rates (signup/upgrade events)

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
