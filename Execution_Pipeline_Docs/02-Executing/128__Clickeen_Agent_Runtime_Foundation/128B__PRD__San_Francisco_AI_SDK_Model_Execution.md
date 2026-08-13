# PRD 128B — San Francisco AI SDK Model Execution

Status: **EXECUTING — IMPLEMENTATION COMPLETE; 47 GATE TESTS PASS**

Depends on: 128A

## 1. Purpose

Replace San Francisco's handwritten agent-facing OpenAI and DeepSeek calls with
one AI SDK-backed governed model-turn implementation.

San Francisco remains the model-execution authority. The AI SDK is the internal
library it uses to perform the already-authorized model turn.

## 2. Current State

Current agent homes call San Francisco `/model/chat` with string messages.
San Francisco:

- verifies the Roma grant;
- resolves exact provider/model policy;
- calls handwritten OpenAI or DeepSeek adapters;
- returns one content string and usage.

That interface cannot carry native tool definitions, tool calls, tool results,
structured finish reasons, or streamed model events.

San Francisco also owns a separate Prague `/l10n/translate` route. That route is
not an agent route and is outside this PRD.

## 3. Target Boundary

```text
agent home
-> Clickeen model-turn request
-> San Francisco grant/policy/budget enforcement
-> explicit provider factory selected from signed policy
-> AI SDK model execution
-> Clickeen model-turn result/events
```

San Francisco must support:

- ordered system/user/assistant/tool messages;
- native tool definitions expressed through exact JSON schemas;
- tool calls and tool-result continuation messages;
- streamed text/tool events for Product Copilot;
- exact structured output for Translation Agent;
- finish reason;
- exact provider/model usage and latency;
- cancellation and explicit errors.

## 4. Dependency And Provider Rules

- Before implementation changes San Francisco, run a read-only provider
  metadata preflight against the exact pinned AI SDK/provider package
  candidates. Prove Cloudflare compatibility and inspect raw text, tool-call,
  tool-only, structured-output, and streamed terminal results for OpenAI and
  DeepSeek. Record where provider-reported model identity, prompt/completion
  usage, finish reason, and complete tool arguments appear. If either current
  provider cannot expose required exact truth, stop before replacing its
  working adapter; do not weaken the contract.
- Pin one supported stable AI SDK major and the exact provider packages required
  for OpenAI and DeepSeek.
- Verify Cloudflare Workers compatibility and bundle output before adoption.
- Use `createOpenAI(...).responses(model)` explicitly and never the provider
  package's default callable mode.
- Normalize the existing `OPENAI_BASE_URL` origin to exactly one `/v1` SDK
  prefix. Reject an override that would produce a missing or duplicate `/v1`.
- Use `createDeepSeek(...).chat(model)` explicitly. Preserve the current
  `DEEPSEEK_BASE_URL` semantics exactly as required by the pinned provider
  package; do not rely on its default factory mode.
- Set SDK retries to zero.
- Preserve current base URL overrides where they remain required.
- Keep credentials only in San Francisco Worker bindings/secrets.
- Do not add provider discovery, a provider registry service, or another
  provider.

## 5. Exact Policy And Capability Enforcement

Before the AI SDK call, San Francisco must continue to:

- resolve the registered canonical agent;
- verify the signed grant and capability;
- resolve the exact selected/default provider and model from signed policy;
- reject a selected model outside the allowed set;
- require the exact provider credential;
- apply exact token and timeout budgets;
- check that the selected model supports the requested mode, including tools,
  streaming, or structured output where applicable.

San Francisco performs exactly one provider model step per `/model/turn`
request. Tool definitions have no SDK `execute` function. Do not configure an
automatic `stopWhen` loop, tool-call repair, JSON repair middleware, simulated
streaming, or any SDK capability degradation. Product Copilot and Bob own the
tool-result continuation.

The AI SDK must not select a different model or provider.

## 6. Clickeen-Owned Wire Protocol

The external/service-binding contract is defined by 128A. San Francisco adapts
between that contract and AI SDK types internally.

Do not expose provider-native or AI SDK-specific stream framing as the stable
Bob/Roma product contract. Convert it into the exact Clickeen events required by
128A.

For a streamed call, `model_step_finished` must contain:

- finish reason;
- exact provider/model identity;
- exact prompt/completion usage when returned;
- latency;
- completion of every tool-call argument payload emitted before it.

If required terminal truth is missing, the stream ends in explicit failure, not
a fabricated success event. A `tool-calls` finish reason is a successful model
step that requests product action; it is never Product Copilot
`agent_turn_finished`.

## 7. Usage And Error Mapping

Preserve Clickeen error authority:

- grant errors remain grant errors;
- policy/capability denials remain explicit denials;
- timeout remains budget failure;
- upstream provider status remains provider failure metadata;
- malformed provider output remains provider failure;
- missing exact usage/model truth is not rewritten to zero/requested model;
- stream interruption is explicit.

The Step 0 preflight must prove from raw provider response/metadata that both
OpenAI and DeepSeek expose exact provider-reported model identity and
prompt/completion usage in the forms used by PRD 128. AI SDK's configured-model
fallback is not provider truth. Adapter deletion is blocked until that evidence
exists.

Record the final SDK/provider behavior for tool-call-only responses and exact
token usage during implementation. Do not infer values unavailable from the
provider.

## 8. Streaming Concurrency

The current San Francisco in-flight helper releases when a handler returns its
`Response`. That is correct for buffered JSON but would release a streamed
request before its body finishes.

The AI SDK stream path must hold one existing San Francisco concurrency lease
until terminal `model_step_finished`, `model_step_error`, cancellation, or
stream failure, and release it exactly once. It does not add a queue or a new
concurrency subsystem.

Focused proof requires eight active streams to occupy all current leases, the
ninth to fail with the existing budget error, and a completed/canceled stream
to release one lease for the next request.

## 9. Removal

In the same branch:

- remove handwritten OpenAI/DeepSeek agent adapters after parity is proven;
- remove `/model/chat` and its types after both current agents migrate;
- remove obsolete text-only provider parsing and tests;
- remove dead imports, dependencies, comments, and documentation;
- retain Prague-specific direct code only where it is genuinely owned by the
  out-of-scope Prague route and name that boundary truthfully.

No old/new adapter switch remains.

## 10. Focused Verification

Tests must prove through mocked provider responses and Worker execution:

- OpenAI text completion;
- DeepSeek text completion;
- streamed text ordering;
- complete native tool call and arguments;
- `tool-calls` model-step finish without agent-turn completion;
- rejection of multiple Product Copilot tool calls in one step;
- assistant tool call followed by tool-result continuation;
- structured Translation Agent output;
- exact temperature omission for unsupported models;
- exact reasoning configuration for models that require it;
- exact token parameter and budget;
- `maxRetries: 0` behavior;
- no SDK tool execution, automatic step loop, tool-call repair, or simulated
  streaming;
- timeout propagation;
- provider error mapping;
- missing credential failure;
- missing/malformed usage/model failure;
- exact raw provider-reported model identity for both provider routes;
- recorded Step 0 raw metadata evidence for text, tool-call/tool-only,
  structured-output, and streamed terminal results;
- cancellation;
- stream concurrency lease held to terminal/cancel/error and released once;
- unsupported model capability denial;
- Cloudflare Worker bundle/dry run.

## 11. Acceptance Criteria

- The two current provider paths use AI SDK plumbing only.
- Agent homes contain no provider-specific source or credentials.
- San Francisco accepts the 128A model-turn contract.
- Product Copilot can receive streamed text and native tool calls.
- Translation Agent can receive exact structured output.
- Exact grant, policy, budget, usage, and error semantics are preserved.
- There is no hidden retry, fallback, or provider discovery.
- OpenAI uses the explicit Responses mode and DeepSeek the explicit chat mode.
- San Francisco performs one provider step and no product tool execution.
- Streaming holds the existing concurrency authority until the stream ends.
- `/model/chat` is absent after all callers convert.
- Prague's separate route is neither silently migrated nor falsely claimed
  removed.

## Execution Record

### Step 0 — Provider Metadata Preflight (2026-08-13)

**Packages tested:**

| Package | Version |
| --- | --- |
| `ai` | 7.0.64 |
| `@ai-sdk/openai` | 4.0.41 |
| `@ai-sdk/deepseek` | 3.0.28 |
| `zod` | 4.1.8 |

**Provider modes tested:**

- OpenAI: `createOpenAI(...).responses(model)` — Responses API mode
- DeepSeek: `createDeepSeek(...).chat(model)` — Chat Completions mode

**Models tested:**

- OpenAI: `gpt-5.2` (provider-reported: `gpt-5.2-2025-12-11`)
- DeepSeek: `deepseek-chat` (provider-reported: `deepseek-v4-flash`)

**Tests run (both providers):**

| Test | Method | Result |
| --- | --- | --- |
| Non-streamed text | `generateText` | ✅ Pass |
| Streamed text | `streamText` | ✅ Pass |
| Non-streamed tool call | `generateText` + tool | ✅ Pass |
| Streamed tool call | `streamText` + tool | ✅ Pass |
| Structured output | `generateObject` | ✅ Pass |

### Metadata findings (all PASS)

Every metadata field the 128A contract requires is exposed by both providers
through the AI SDK:

**Model identity (`reportedModel`):**

| Provider | Requested | Provider-reported | SDK location |
| --- | --- | --- | --- |
| OpenAI | `gpt-5.2` | `gpt-5.2-2025-12-11` | `result.response.modelId` |
| DeepSeek | `deepseek-chat` | `deepseek-v4-flash` | `result.response.modelId` |

Available at both top-level and per-step (`steps[0].response.modelId`).

**Token usage:**

| Provider | Input tokens | Output tokens | SDK location |
| --- | --- | --- | --- |
| OpenAI | 90 (tool call) | 32 | `result.usage.inputTokens` / `.outputTokens` |
| DeepSeek | 396 (tool call) | 59 | `result.usage.inputTokens` / `.outputTokens` |

Both expose detailed breakdowns. Raw provider usage at `result.usage.raw`.

**Finish reason:** `stop` / `tool-calls` — both providers correctly distinguish.

**Tool call ID:** Stable provider identifier on every tool call.

**Tool call arguments (with inputSchema fix):**

| Provider | Tool input |
| --- | --- |
| OpenAI | `{"ops":[{"op":"set","path":"title","value":"Hello World"}]}` |
| DeepSeek | `{"ops":[{"op":"set","path":"/title","value":"Hello World"}]}` |

**Structured output:** Both providers return correct objects matching the Zod
schema.

### AI SDK tool definition requirement

**Critical for 128B implementation:** the AI SDK renamed `parameters` to
`inputSchema` in AI SDK 5 (July 2025). This has been the standard field name
for two major versions. Using the old `parameters` field name produces an
incorrect tool schema.

During this preflight (directly observed by capturing the request body), using
`parameters` sent an empty JSON Schema (`{"properties":{}}`) to the provider,
causing the model to return empty tool arguments. Other SDK/provider
combinations may produce an explicit API error instead — the exact failure
signature can vary. The fix is the same regardless: use `inputSchema`.

**Fix:** use `inputSchema` in every tool definition:

```typescript
// CORRECT — matches Vercel's canonical AI SDK docs
const myTool = tool({
  description: 'Apply widget operations',
  inputSchema: z.object({ ops: z.array(...) }),
});
```

This applies to all tool definitions in PRD 128. San Francisco, Product
Copilot, and any future tool definitions must use `inputSchema`, not
`parameters`.

### Step 0 conclusion

**PASS.** Both OpenAI and DeepSeek expose all metadata required by the 128A
contract through the AI SDK: exact provider-reported model identity,
prompt/completion token usage, finish reason, complete tool call arguments,
and tool call identifiers. All tested modes (text, streamed text, tool call,
streamed tool call, structured output) work correctly for both providers.

Adapter deletion is not blocked by any provider or SDK limitation. The
`inputSchema` field name requirement is recorded for implementation.

### 128B Implementation (2026-08-13)

**Files created:**
- `sanfrancisco/src/ai/model-turn-types.ts` — 128A contract types
- `sanfrancisco/src/ai/model-turn.ts` — POST /model/turn handler (stream + structured)
- `sanfrancisco/tests/run-model-turn.ts` — 30 tests
- `sanfrancisco/tests/run-concurrency.ts` — 4 tests (lease release on cancel)
- `sanfrancisco/tests/run-stream-truth.ts` — 13 tests (no fallbacks, timeout ≠ cancel)

**Files modified:**
- `sanfrancisco/src/concurrency.ts` — withStreamInflightLimit with cancel() release
- `sanfrancisco/src/index.ts` — POST /model/turn route
- `sanfrancisco/package.json` — ai@7.0.64, @ai-sdk/openai@4.0.41, @ai-sdk/deepseek@3.0.28

**Verification:**
- 5 workspaces typecheck clean
- 47 San Francisco gate tests pass
- wrangler dry-run succeeds
- No metadata fallbacks (V1 clean)
- Timeout ≠ caller cancellation
- Concurrency lease releases on all exit paths
