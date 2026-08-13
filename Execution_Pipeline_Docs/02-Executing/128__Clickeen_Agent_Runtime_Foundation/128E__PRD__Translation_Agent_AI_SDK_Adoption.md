# PRD 128E — Translation Agent AI SDK Adoption

Status: **EXECUTING — IMPLEMENTATION COMPLETE; 14 EVAL CASES + WORKER OUTCOME TEST PASS**

Depends on: 128A, 128B

## 1. Purpose

Move the working Translation Agent onto the shared San Francisco AI SDK-backed
model-turn boundary without changing its product job or making it imitate
Product Copilot.

Translation Agent is the second real-agent proof: one shared governed execution
engine must support both an interactive browser agent and a focused server-side
artifact agent.

## 2. Product Job To Preserve

Translation Agent continues to:

- receive the exact saved account instance and active target locales from the
  Roma translation operation;
- read only declared translatable fields;
- preserve protected rich-text structure;
- request exact translated values for each target locale;
- require exact field-path coverage with no unexpected paths;
- write exact locale overlay values through Tokyo-worker;
- report an ordered result for every requested locale;
- never return full success unless every requested locale write succeeded.

This PRD does not alter Widget content locale, account locale policy, overlay
storage coordinates, or public runtime serving.

## 3. Agent Home Ownership

Translation Agent retains:

- translation instructions;
- chunking/batching currently required by its operation;
- protected-content representation;
- target-locale context;
- structured translated-value schema;
- per-locale loop and result aggregation;
- Tokyo write operation;
- translation evals.

San Francisco owns only governed model turns. The AI SDK supplies structured
output/provider mechanics. Neither owns overlay semantics or writes.

## 4. Model-Turn Adoption

Replace Translation Agent's text-only `/model/chat` request and response parsing
with the 128A structured-output model-turn contract.

The request must carry:

- exact Translation Agent id and grant;
- exact instructions and locale/source input prepared by Translation Agent;
- exact structured-output schema for translated paths/values;
- trace coordinates already required for diagnosis and usage;
- token/timeout/temperature settings allowed by signed policy.

The result must provide exact structured translated values or explicit failure.
There is no generic JSON-text extraction/repair compatibility path.

Translation Agent does not use Product Copilot's browser transcript or tool
round. Each existing translation chunk is one governed model call under the
same exact Translation Agent operation/grant, its existing per-tier
`maxTurnsPerThread: 1`, per-call token budget, and per-call timeout. The shared
policy field remains per-agent truth rather than pretending the whole
multi-chunk translation operation is one interactive thread.

San Francisco performs no JSON-extraction repair, tool-call repair, provider
fallback, simulated streaming, or automatic SDK step loop for Translation
Agent. A structured-output generation failure fails the exact locale/chunk
operation visibly.

## 5. Per-Locale Failure Truth

Existing ordered partial-result semantics remain:

- one locale may fail while later locales continue when the Translation Agent's
  current operation allows it;
- already written locale overlays remain accurately reported;
- every requested locale appears exactly once in the ordered result;
- malformed/missing/unexpected translated fields fail that locale;
- Tokyo write rejection fails that locale;
- top-level success requires every requested locale to succeed.

The AI SDK must not convert missing structured truth into an empty translation
or an English fallback.

## 6. Removal

Remove only obsolete Translation Agent model-call plumbing:

- `/model/chat` request construction;
- text-content JSON extraction superseded by exact structured output;
- compatibility parsing or retry behavior made obsolete by the hard cut;
- dead tests/comments/docs.

Preserve the current agent's domain checks and exact overlay write authority.
Do not remove a current protection merely because the SDK can validate output
shape; path equality, protected rich text, locale identity, and Tokyo write
truth belong to Translation Agent/product contracts.

## 7. Translation Regression Gate

Translation Agent already performs its product job. PRD 128 changes only its
governed model-execution seam. Preserve current behavior with the existing
translation evals, representative current Widget content, and live overlay
verification covering:

- concise simple text and CTA copy;
- brand names, URLs, and placeholders;
- natural longer copy;
- protected rich text with exact structural preservation.

After the cutover, representative output must remain sound while all exact
structural/path/write guarantees pass. Human review may inspect the resulting
language during QA; exact paths, protected markup, locale identity, and overlay
bytes remain deterministic gates.

This is regression proof for the existing job, not a new product-owner rubric
or authorization to change Translation Agent instructions, locale scope, or
product behavior.

## 8. Verification

The owning eval and focused tests must prove:

- exact simple-text translation;
- exact protected rich-text preservation;
- exact expected path set;
- missing path failure;
- unexpected path failure;
- malformed structured-output failure;
- provider error for one locale with ordered later-locale processing;
- Tokyo rejection truth;
- exact overlay byte/value result through Tokyo-worker;
- full-success truth only when every locale succeeds;
- actual usage/model truth returned from San Francisco;
- both current provider routes when each is explicitly enabled for Translation
  Agent and claims the required structured-output capability.

Live verification uses an explicitly named existing test instance/locale
operation through Roma and reconciles the exact overlay afterward.

## 9. Acceptance Criteria

- Translation Agent uses the 128A/128B governed model-turn contract.
- Its product behavior and storage coordinate remain unchanged.
- Structured output replaces text JSON extraction without a compatibility path.
- Exact path/protected-content/Tokyo-write checks remain agent-owned.
- Ordered per-locale result truth remains intact.
- No Product Copilot transcript, browser tool, or streaming UI contract appears
  in Translation Agent.
- No provider-specific source or credential appears in Translation Agent.
- Existing Translation Agent eval quality does not regress.
- Representative real-model output remains sound in live QA in addition to
  deterministic schema/path/write correctness.

## Execution Record

### 128E Implementation (2026-08-13)

**Files modified:**
- `agents/translation-agent/src/worker.ts` — callSanFranciscoTurn (structured mode, /model/turn)
- `agents/translation-agent/src/index.ts` — validateStructuredTranslationResult (domain checks, no JSON.parse); prompts updated (no JSON format instruction)
- `agents/translation-agent/evals/run-translation-agent-eval.ts` — 14 cases updated for structured input
- `agents/translation-agent/tests/run-worker-outcomes.ts` — mock updated for /model/turn response shape

**Verification:**
- 14 eval cases pass
- Worker outcome test passes (per-locale isolation, ordered results, no-write-on-failure)
- Typecheck clean
- Product behavior unchanged: chunking, richtext segmentation, overlay writes, per-locale truth
