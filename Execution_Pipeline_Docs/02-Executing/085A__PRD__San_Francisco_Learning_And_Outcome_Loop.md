# PRD 085A - San Francisco Learning And Outcome Loop

STATUS: PRE-EXECUTION DISCUSSION

Parent: `085__PRD__San_Francisco_Agentic_Platform_Product_Strategy.md`

This PRD defines the learning and outcome loop for San Francisco.

It is not about autonomous self-training. It is about making AI execution measurable, cheap, auditable, and improvable.

---

## 1. Product Goal

Clickeen needs agents that get better over time without silently changing production behavior.

Learning means:

- recording what the agent did
- recording what the user or system did afterward
- evaluating whether the agent output helped
- promoting better prompts/models through controlled review, evals, canaries, and rollback

Learning does not mean:

- raw outcomes mutate prompts automatically
- every full prompt/response is stored forever
- production behavior changes without a reviewed release
- San Francisco becomes product truth

---

## 2. Surviving Product Owner

San Francisco owns:

- AI execution metering
- AI interaction log ingestion
- AI outcome ingestion
- queryable learning indexes
- bounded raw learning samples
- curated eval artifacts when explicitly promoted

San Francisco does not own:

- account billing truth
- account entitlement truth
- widget instance truth
- localization storage truth
- prompt/model promotion without release control

---

## 3. Runtime Boundary

Every AI execution must produce one `requestId`.

That `requestId` joins:

- execution metering fact
- outcome fact
- optional raw learning sample
- optional curated golden example

The product path should be:

1. Caller receives or mints a signed grant.
2. Caller invokes San Francisco.
3. San Francisco verifies the grant and runs the agent.
4. San Francisco writes a tiny metering fact.
5. Caller records meaningful user/system outcomes later.
6. Offline eval/report jobs analyze outcomes and samples.
7. Human-approved or eval-gated prompt/model changes ship through release.

---

## 4. Approach

### 4.1 Outcome Contract

Replace the current outcome mismatch with one simple signed outcome payload.

The payload must include:

- `requestId`
- `agentId`
- `subject`
- `outcomeType`
- `occurredAt`
- optional compact metadata
- signature/auth proof

No generic command envelope should survive unless there is a real command bus with multiple shared behaviors.

### 4.2 Metering

Every execution writes a small metering fact.

Required fields:

- `requestId`
- `agentId`
- account or subject hash
- runtime policy version
- provider
- model
- input tokens
- output tokens
- estimated cost
- latency
- status
- error code
- timestamp

Metering must not include:

- full prompts
- full widget configs
- full account data
- secrets
- auth capsules

### 4.3 Outcome Facts

Meaningful outcomes should be small and durable.

Examples:

- edit applied
- edit rejected
- edit undone
- translation accepted
- translation failed
- clarification needed
- support answer resolved
- publish completed after agent help
- upgrade clicked after budget/upsell prompt

Outcomes are how Clickeen learns what worked.

### 4.4 Raw Learning Payloads

Raw prompt/response payloads are not the default durable log.

Keep raw payloads only for:

- invalid model output
- execution failure
- negative outcomes
- high-signal outcomes
- bounded samples
- explicit debug sessions

Raw samples need:

- retention policy
- redaction/minimization
- bounded R2 footprint
- partitioned/chunked storage before scale

### 4.5 Golden Examples

Golden examples are small, reviewed, trusted artifacts.

They are used to test:

- prompt changes
- model switches
- structured output validity
- latency/cost tradeoffs
- outcome quality

Golden examples should be promoted from raw samples only after review or a defined eval threshold.

---

## 5. Deletion Targets

- Broken outcome envelope assumptions.
- Generic command-bus wrapper if it only supports unrelated one-off commands.
- One-R2-object-per-execution as the long-term raw-log strategy.
- Any path where outcome ingestion cannot identify subject, agent, request, and auth.
- Any learning path that silently mutates prompts, model choice, or runtime policy.

---

## 6. Blast Radius

Likely code areas:

- `sanfrancisco/src/index.ts`
- `sanfrancisco/src/telemetry.ts`
- `sanfrancisco/src/personalization-jobs.ts`
- `packages/ck-contracts/src/ai.ts`
- Roma copilot outcome caller code
- D1 telemetry migrations if schema changes
- R2 log writer logic

Likely docs:

- `documentation/ai/*`
- San Francisco service docs
- parent PRD 085

No widget storage, asset storage, locale overlay storage, or account entitlement storage should move into San Francisco.

---

## 7. Why This Is World-Class SaaS

At scale, raw AI logs can become expensive, noisy, and risky.

The best-practice shape is:

- tiny metering for every execution
- small outcomes for product learning
- bounded raw payloads for debug/eval
- curated examples for release gates

This supports billing, abuse detection, reliability, and model improvement without making R2 a giant unbounded dump.

---

## 8. Why This Is Right For Clickeen

Clickeen is AI-native, but the product contract is strict: invalid state fails at the boundary and product truth does not silently heal.

This PRD gives Clickeen learning without letting AI self-mutate production.

It also supports the strategy that San Francisco is Clickeen's workforce system while keeping account/widget/localization truth with the owning services.

---

## 9. Execution Readiness Checklist

Before execution:

- Decide first learning loop.
- Decide outcome event names for that loop.
- Decide raw payload retention window.
- Decide D1 index shape.
- Decide whether command envelope is deleted.

Execution is green only when:

- outcome attach has one tested contract
- execution and outcome share `requestId`
- raw payload writes are bounded or explicitly pre-GA only
- no learning path mutates prompt/model/policy automatically
- typecheck passes
- residue checks pass for deleted command/envelope names

---

## 10. Verification

Required:

- `./node_modules/.bin/tsc -p sanfrancisco/tsconfig.json --noEmit`
- relevant `packages/ck-contracts` checks
- outcome attach contract tests
- interaction event ingestion tests
- `rg` checks for deleted envelope names if removed
- git-based Cloudflare deploy after implementation
- smoke test: one Builder copilot execution plus one outcome attach
