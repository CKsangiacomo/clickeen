# PRD 085A - San Francisco Learning And Outcome Loop

STATUS: EXECUTED

Executed: 2026-05-05

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

The live bug is precise:

- Roma sends `{ command: 'ai.outcome.attach', payload }`.
- San Francisco currently requires `{ v: 1, kind: 'sf.command', command, payload }`.
- The missing `v` and `kind` fields make outcome attach fail before learning data is written.

The executed payload includes:

- `requestId`
- `sessionId`
- canonical `event`
- `occurredAtMs`
- optional `timeToDecisionMs`
- optional `accountIdHash`
- optional compact `metadata`
- HMAC signature over the exact direct body

No generic command envelope should survive unless there is a real command bus with multiple shared behaviors.

The current `/v1/outcome` mismatch is a confirmed live bug, not a hypothetical risk. Execution must not proceed until Roma and San Francisco agree on one direct outcome payload shape.

Execution target:

- `/v1/outcome` accepts the direct signed outcome payload.
- Roma sends that direct payload and signs exactly that body.
- Outcome attach no longer depends on `SanfranciscoCommandMessage` or `sf.command`.
- Any unrelated personalization/onboarding command cleanup stays in its owning PRD unless that path is deleted in the same execution slice.

### 4.2 Metering

Every execution writes a small metering fact.

Target fields over time:

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

This execution slice did not add a new D1 migration because the existing GitHub Cloudflare deploy token can deploy Workers but cannot run D1 migration queries. The shipped state keeps the existing D1 execution fact shape and captures detailed paid learning samples in bounded R2 records. A future D1 metrics expansion must be its own migration/deploy slice.

Metering must not include:

- full prompts
- full widget configs
- full account data
- secrets
- auth capsules

### 4.3 Outcome Facts

Meaningful outcomes should be small and durable for the eligible learning cohort.

Default learning cohort:

- paid accounts only
- free accounts get operational metering/budget/abuse counters only by default
- free-account conversion analytics, if needed, belongs in the product analytics path, not detailed San Francisco learning capture

Examples:

- edit applied
- edit rejected
- edit undone
- invalid output
- translation accepted
- translation failed
- clarification needed
- support answer resolved
- publish completed after agent help
- upgrade clicked after budget/upsell prompt

Outcomes are how Clickeen learns what worked.

For the first execution pass, use Builder copilot quality as the learning loop unless the decision log explicitly chooses another loop.

Initial outcome names should be boring and concrete:

- `edit_applied`
- `edit_rejected`
- `edit_undone`
- `clarification_needed`
- `invalid_output`

Replace the legacy names instead of carrying both forever:

- `ux_keep` becomes `edit_applied`
- `ux_undo` becomes `edit_undone`

Do not add broad analytics vocabulary until these are working end to end.

### 4.4 Useful Learning Metadata

Learning facts must explain what happened at edit level.

Do not rely on vague aggregates such as "FAQ kept 88% of edits." That number is only useful if the stored fact also says what the user asked for and what the agent changed.

For Builder copilot, the compact fact should include:

- intent or requested change class
- touched control paths
- touched control/group names when available
- touched scopes emitted by the agent/caller
- op count
- validation result
- invalid-output reason when available
- final outcome event

San Francisco telemetry must not infer widget semantics from path strings. Delete path-prefix guessing such as `inferScopeFromPath`; scope/group metadata belongs in the agent result or caller payload. In the executed slice, existing D1 facts store compact counts/scopes, and sampled R2 learning records keep the richer path/control/group metadata.

### 4.5 Detailed Learning Sampling

Detailed learning is not captured for every account.

Default policy:

- Free accounts: minimal metering only by default.
- Paid accounts: deterministic 20% sample for normal successful AI copilot executions.
- Paid serious failures: always capture detailed learning data, even outside the sample.
- All accounts: retain minimal cost, budget, abuse, and reliability counters needed to run the SaaS.

The sampling decision must be deterministic by stable account/request hash, so reports are reproducible and one account does not randomly flap between cohorts.

### 4.6 Raw Learning Payloads

Raw prompt/response payloads are not the default durable log.

Keep raw payloads only for:

- serious paid invalid model output
- serious paid execution failure
- paid negative outcomes
- paid high-signal outcomes
- bounded paid samples
- explicit debug sessions

Raw samples need:

- retention policy
- redaction/minimization
- bounded R2 footprint
- partitioned/chunked storage before scale

Current code writes one full raw R2 object for every `/v1/execute` event. That is acceptable only as pre-GA/dev behavior. Execution must change normal successful calls to metering-only unless selected by the paid sampling/failure policy.

### 4.7 Golden Examples

Golden examples are small, reviewed, trusted artifacts.

They are used to test:

- prompt changes
- model switches
- structured output validity
- latency/cost tradeoffs
- outcome quality

Golden examples should be promoted from raw samples only after review or a defined eval threshold.

Do not build a golden-example promotion workflow before the outcome contract is fixed and real outcomes exist. Golden examples are a later quality gate, not the first implementation slice.

---

## 5. Deletion Targets

- Broken outcome envelope assumptions.
- Generic command-bus wrapper if it only supports unrelated one-off commands.
- One-R2-object-per-execution as the long-term raw-log strategy.
- Full raw R2 writes for normal successful calls outside the paid sampling policy.
- `inferScopeFromPath` or any telemetry logic that guesses widget meaning from path prefixes.
- Legacy `ux_keep`/`ux_undo` names once canonical `edit_applied`/`edit_undone` events are wired.
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
- Bob copilot outcome event emitter code
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
- paid-only sampled raw payloads for debug/eval
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

- First learning loop: Builder copilot quality.
- Outcome event names: `edit_applied`, `edit_rejected`, `edit_undone`, `clarification_needed`, `invalid_output`, plus existing `cta_clicked`.
- Raw payload policy for this slice: paid-only 20% deterministic samples for normal successes, no full raw object for every execution.
- D1 index shape for this slice: existing small D1 execution/outcome facts only; no schema migration.
- Unrelated personalization/onboarding command path: left for its owning PRD. Outcome attach no longer uses the command envelope.

Execution is green only when:

- outcome attach has one tested contract
- execution and outcome share `requestId`
- canonical outcome names are wired end to end
- detailed learning is paid-only sampled at 20% for normal successes
- paid samples are captured by deterministic sampling only
- raw payload writes are bounded
- telemetry no longer infers widget scopes from path prefixes
- no learning path mutates prompt/model/policy automatically
- typecheck passes
- residue checks pass for deleted outcome command/envelope and legacy outcome names

---

## 10. Verification

Required:

- `./node_modules/.bin/tsc -p sanfrancisco/tsconfig.json --noEmit`
- relevant `packages/ck-contracts` checks
- outcome attach contract tests
- interaction event ingestion tests
- `rg` checks for deleted outcome envelope names and legacy outcome event names if removed
- `rg` check that telemetry no longer uses path-prefix scope inference
- git-based Cloudflare deploy after implementation
- smoke test: one Builder copilot execution plus one outcome attach

Executed verification note:

- The repository currently has no San Francisco unit-test harness. The executed slice uses `scripts/verify/prd85a-learning-contract.mjs` as the contract/residue check, plus San Francisco/Roma/Bob TypeScript checks and git-based Cloudflare deployment verification.
- Manual authenticated Builder copilot outcome smoke remains a product QA step, not an automated CI check.

---

## 11. Execution Closure - 2026-05-05

Executed the first Builder copilot learning loop.

What changed:

- `/v1/outcome` now accepts the direct signed outcome payload. It no longer requires the `sf.command` envelope.
- Roma signs and forwards the direct outcome body.
- Outcome attach is no longer part of `SanfranciscoCommandMessage`; the remaining command envelope is limited to the unrelated personalization/onboarding path until its own PRD deletes or formalizes it.
- Bob now emits canonical outcome events: `edit_applied`, `edit_undone`, and `cta_clicked`.
- San Francisco accepts the canonical first-loop events: `edit_applied`, `edit_rejected`, `edit_undone`, `clarification_needed`, `invalid_output`, and `cta_clicked`.
- Free accounts are excluded from detailed San Francisco learning capture by Roma.
- Paid Builder copilot executions use deterministic 20% detailed-learning sampling for normal successful calls.
- Serious paid failures/invalid outputs are captured outside the 20% sample.
- The queue writes tiny D1 facts for every execution and bounded sanitized R2 samples only under `learning/...`.
- Full raw R2 write-for-every-execution under `logs/...` was removed from the queue consumer.
- Telemetry no longer infers widget scope from path prefixes. Builder copilot emits touched path/control/scope/group metadata; existing D1 facts keep compact counts/scopes and sampled R2 learning records keep richer edit metadata.
- D1 schema stays on the existing tiny fact tables for this slice. Detailed edit-level learning lives only in bounded paid R2 samples.
- San Francisco deploy does not depend on D1 migration permissions for this slice.

Verification performed:

- `node scripts/verify/prd85a-learning-contract.mjs`
- `./node_modules/.bin/tsc -p sanfrancisco/tsconfig.json --noEmit`
- `./node_modules/.bin/tsc -p roma/tsconfig.json --noEmit`
- `./node_modules/.bin/tsc -p bob/tsconfig.json --noEmit`
- `cd sanfrancisco && ./node_modules/.bin/wrangler deploy --dry-run --outdir /tmp/clickeen-sanfrancisco-prd85a-dryrun`
- `git diff --check` for touched files

Remote D1/deploy note:

- A first attempt to make `pnpm -C sanfrancisco run deploy` apply D1 migrations failed in GitHub because the existing deploy token can deploy Workers but is not authorized for D1 migration queries.
- The execution was corrected to avoid a schema migration for this PRD. The deploy path is back to Worker deploy only, and PRD 85A's detailed learning facts are captured through bounded paid R2 samples.
