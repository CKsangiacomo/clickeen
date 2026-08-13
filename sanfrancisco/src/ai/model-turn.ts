/**
 * PRD 128B — Model-turn implementation using AI SDK.
 *
 * San Francisco is the model-execution authority. The AI SDK is internal
 * plumbing. This module adapts between the Clickeen-owned 128A contract
 * (model-turn-types.ts) and AI SDK provider calls.
 */

import { createOpenAI } from '@ai-sdk/openai';
import { createDeepSeek } from '@ai-sdk/deepseek';
import { streamText, generateObject, jsonSchema, type LanguageModel } from 'ai';

import { resolveAiAgent, resolveAiModelCapability } from '@clickeen/ck-contracts/ai';
import { assertCap, resolveGrantBudgets, verifyGrant } from '../grants';
import { HttpError, json, noStore, readJson, type SanFranciscoRequestContext } from '../http';
import { resolveModelSelection, type ModelSelection } from './modelRouter';
import { withInflightLimit } from '../concurrency';
import { withStreamInflightLimit } from '../concurrency';
import type { AIGrant, Env } from '../types';
import type {
  ModelStepErrorData,
  ModelStepEvent,
  ModelStepFinishData,
  ModelTurnRequest,
  ModelTurnStreamRequest,
  ModelTurnStructuredRequest,
  ModelTurnStructuredResponse,
  ModelTurnMessage,
  ModelTurnToolDefinition,
} from './model-turn-types';
import { isModelTurnRequest } from './model-turn-types';

// ---------------------------------------------------------------------------
// Provider factory
// ---------------------------------------------------------------------------

function createAiSdkModel(env: Env, selection: ModelSelection): LanguageModel {
  if (selection.provider === 'openai') {
    if (!env.OPENAI_API_KEY) {
      throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'openai', message: 'AI provider is unavailable.' });
    }
    const openai = createOpenAI({
      apiKey: env.OPENAI_API_KEY,
      ...(env.OPENAI_BASE_URL ? { baseURL: normalizeOpenAiBaseUrl(env.OPENAI_BASE_URL) } : {}),
    });
    return openai.responses(selection.model);
  }
  if (selection.provider === 'deepseek') {
    if (!env.DEEPSEEK_API_KEY) {
      throw new HttpError(500, { code: 'PROVIDER_ERROR', provider: 'deepseek', message: 'AI provider is unavailable.' });
    }
    const deepseek = createDeepSeek({
      apiKey: env.DEEPSEEK_API_KEY,
      ...(env.DEEPSEEK_BASE_URL ? { baseURL: env.DEEPSEEK_BASE_URL } : {}),
    });
    return deepseek.chat(selection.model);
  }
  throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: `Unsupported provider: ${selection.provider}` });
}

/**
 * Normalize OpenAI base URL to strip any trailing /v1 suffix.
 * The AI SDK's createOpenAI adds its own /v1 prefix for the Responses API.
 */
function normalizeOpenAiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/+$/, '');
  return trimmed.endsWith('/v1') ? trimmed.slice(0, -3) : trimmed;
}

// ---------------------------------------------------------------------------
// Message conversion (Clickeen contract → AI SDK)
// ---------------------------------------------------------------------------

type AiSdkMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string }
  | { role: 'assistant'; content: Array<{ type: 'tool-call'; toolCallId: string; toolName: string; input: unknown }> }
  | { role: 'tool'; content: Array<{ type: 'tool-result'; toolCallId: string; toolName: string; output: unknown }> };

export function convertMessages(messages: ModelTurnMessage[]): { instructions?: string; messages: AiSdkMessage[] } {
  let instructions: string | undefined;
  const converted: AiSdkMessage[] = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      instructions = instructions ? `${instructions}\n${msg.content}` : msg.content;
    } else if (msg.role === 'user') {
      converted.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      if (typeof msg.content === 'string') {
        converted.push({ role: 'assistant', content: msg.content });
      } else {
        converted.push({
          role: 'assistant',
          content: [{ type: 'tool-call', toolCallId: msg.toolCallId, toolName: msg.toolName, input: msg.input }],
        });
      }
    } else if (msg.role === 'tool') {
      converted.push({
        role: 'tool',
        content: [{ type: 'tool-result', toolCallId: msg.toolCallId, toolName: msg.toolName, output: msg.result }],
      });
    }
  }

  return { ...(instructions ? { instructions } : {}), messages: converted };
}

// ---------------------------------------------------------------------------
// Tool conversion (Clickeen contract → AI SDK)
// ---------------------------------------------------------------------------

export function convertTools(tools?: ModelTurnToolDefinition[]): Record<string, { description: string; inputSchema: ReturnType<typeof jsonSchema> }> | undefined {
  if (!tools || tools.length === 0) return undefined;
  const result: Record<string, { description: string; inputSchema: ReturnType<typeof jsonSchema> }> = {};
  for (const tool of tools) {
    result[tool.name] = {
      description: tool.description,
      inputSchema: jsonSchema(tool.inputSchema),
    };
  }
  return result;
}

// ---------------------------------------------------------------------------
// Error mapping
// ---------------------------------------------------------------------------

export function mapToErrorData(err: unknown, requestId?: string): ModelStepErrorData {
  if (err instanceof HttpError) {
    return {
      code: err.error.code,
      reasonKey: err.error.code,
      message: err.error.message,
      ...(err.error.code === 'PROVIDER_ERROR' && 'provider' in err.error ? { provider: (err.error as { provider: string }).provider } : {}),
      ...('upstreamStatus' in err.error ? { upstreamStatus: (err.error as { upstreamStatus: number }).upstreamStatus } : {}),
      requestId,
    };
  }

  const errorName = err instanceof Error ? err.name : '';
  if (errorName === 'AbortError') {
    return {
      code: 'BUDGET_EXCEEDED',
      reasonKey: 'BUDGET_EXCEEDED',
      message: 'Execution timeout exceeded',
      requestId,
    };
  }

  // AI SDK errors have a name property like 'AI_APICallError', 'AI_InvalidPromptError', etc.
  if (err instanceof Error) {
    // Request-format issues from the AI SDK are client errors
    if (err.name === 'AI_InvalidPromptError') {
      return {
        code: 'BAD_REQUEST',
        reasonKey: 'BAD_REQUEST',
        message: err.message.substring(0, 500),
        requestId,
      };
    }
    // All other errors from the model execution path are provider/execution errors
    return {
      code: 'PROVIDER_ERROR',
      reasonKey: 'PROVIDER_ERROR',
      message: err.message.substring(0, 500),
      requestId,
    };
  }

  return {
    code: 'PROVIDER_ERROR',
    reasonKey: 'PROVIDER_ERROR',
    message: 'Unhandled model execution error',
    requestId,
  };
}

// ---------------------------------------------------------------------------
// SSE helper
// ---------------------------------------------------------------------------

function serializeSseEvent(event: ModelStepEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

// ---------------------------------------------------------------------------
// Stream mode handler
// ---------------------------------------------------------------------------

export function handleStreamMode(args: {
  model: LanguageModel;
  request: ModelTurnStreamRequest;
  selection: ModelSelection;
  budget: { maxTokens: number; timeoutMs: number };
  modelStepId: string;
  requestId: string;
  temperature: number;
  abortSignal?: AbortSignal;
}): Response {
  // PRD 128B: timeout and caller cancellation are distinct abort causes.
  // A signed per-call timeout is a budget failure (BUDGET_EXCEEDED).
  // Caller cancellation (user Stop) is a clean end — NOT a timeout error.
  // Object holder avoids TypeScript control-flow narrowing across callbacks.
  const abortState: { cause: 'timeout' | 'caller_cancel' | 'none' } = { cause: 'none' };
  const abortController = new AbortController();
  const timeout = setTimeout(() => {
    if (abortState.cause === 'none') abortState.cause = 'timeout';
    abortController.abort();
  }, args.budget.timeoutMs);
  if (args.abortSignal) {
    args.abortSignal.addEventListener('abort', () => {
      if (abortState.cause === 'none') abortState.cause = 'caller_cancel';
      abortController.abort();
    }, { once: true });
  }
  const startedAt = Date.now();

  const { instructions, messages } = convertMessages(args.request.messages);
  const tools = convertTools(args.request.tools);

  const capability = resolveAiModelCapability(args.selection.provider, args.selection.model);

  const result = streamText({
    model: args.model,
    ...(instructions ? { instructions } : {}),
    messages: messages as never[],
    ...(tools ? { tools } : {}),
    ...(args.request.toolChoice ? { toolChoice: args.request.toolChoice } : {}),
    ...(capability?.supportsTemperature ? { temperature: args.temperature } : {}),
    ...(capability?.reasoningEffort ? { providerOptions: { openai: { reasoningEffort: capability.reasoningEffort } } } : {}),
    maxOutputTokens: args.budget.maxTokens,
    abortSignal: abortController.signal,
    maxRetries: 0,
  });

  const stream = new ReadableStream<Uint8Array>({
    async start(streamController) {
      const encoder = new TextEncoder();
      let terminalEmitted = false;

      const emit = (event: ModelStepEvent) => {
        streamController.enqueue(encoder.encode(serializeSseEvent(event)));
      };

      try {
        for await (const part of result.fullStream) {
          switch (part.type) {
            case 'text-delta':
              emit({ version: 1, modelStepId: args.modelStepId, type: 'text_delta', data: { text: part.text } });
              break;
            case 'tool-call':
              emit({
                version: 1,
                modelStepId: args.modelStepId,
                type: 'tool_call',
                data: { toolCallId: part.toolCallId, toolName: part.toolName, input: part.input },
              });
              break;
            case 'error':
              if (!terminalEmitted) {
                terminalEmitted = true;
                emit({
                  version: 1,
                  modelStepId: args.modelStepId,
                  type: 'model_step_error',
                  data: mapToErrorData(part.error, args.requestId),
                });
              }
              break;
            default:
              break;
          }
        }

        if (!terminalEmitted) {
          const [finishReason, usage, response] = await Promise.all([
            result.finishReason,
            result.usage,
            result.response,
          ]);

          // PRD 128B §7: missing provider truth fails visibly — no fallbacks.
          const reportedModel = response.modelId;
          if (typeof reportedModel !== 'string' || !reportedModel.trim()) {
            terminalEmitted = true;
            emit({
              version: 1,
              modelStepId: args.modelStepId,
              type: 'model_step_error',
              data: {
                code: 'PROVIDER_ERROR',
                reasonKey: 'PROVIDER_ERROR',
                message: 'Provider did not report model identity.',
                requestId: args.requestId,
              },
            });
            return;
          }

          const promptTokens = usage.inputTokens;
          const completionTokens = usage.outputTokens;
          if (
            typeof promptTokens !== 'number' || !Number.isInteger(promptTokens) || promptTokens < 0 ||
            typeof completionTokens !== 'number' || !Number.isInteger(completionTokens) || completionTokens < 0
          ) {
            terminalEmitted = true;
            emit({
              version: 1,
              modelStepId: args.modelStepId,
              type: 'model_step_error',
              data: {
                code: 'PROVIDER_ERROR',
                reasonKey: 'PROVIDER_ERROR',
                message: 'Provider did not report token usage.',
                requestId: args.requestId,
              },
            });
            return;
          }

          const finishData: ModelStepFinishData = {
            finishReason: typeof finishReason === 'string' && finishReason ? finishReason : 'unknown',
            requestedProvider: args.selection.provider,
            requestedModel: args.selection.model,
            reportedModel,
            promptTokens,
            completionTokens,
            latencyMs: Date.now() - startedAt,
          };

          emit({
            version: 1,
            modelStepId: args.modelStepId,
            type: 'model_step_finished',
            data: finishData,
          });
        }
      } catch (err) {
        if (!terminalEmitted) {
          if (err instanceof Error && err.name === 'AbortError' && abortState.cause === 'caller_cancel') {
            // Caller cancellation (user Stop) — clean end, NOT a timeout error.
            // Product Copilot handles the stopped state upstream.
            terminalEmitted = true;
          } else {
            emit({
              version: 1,
              modelStepId: args.modelStepId,
              type: 'model_step_error',
              data: mapToErrorData(err, args.requestId),
            });
          }
        }
      } finally {
        clearTimeout(timeout);
        streamController.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
    },
  });
}

// ---------------------------------------------------------------------------
// Structured mode handler
// ---------------------------------------------------------------------------

async function handleStructuredMode(args: {
  model: LanguageModel;
  request: ModelTurnStructuredRequest;
  selection: ModelSelection;
  budget: { maxTokens: number; timeoutMs: number };
  modelStepId: string;
  requestId: string;
  temperature: number;
  abortSignal?: AbortSignal;
}): Promise<Response> {
  // PRD 128B: timeout and caller cancellation are distinct abort causes.
  // Object holder avoids TypeScript control-flow narrowing across callbacks.
  const abortState: { cause: 'timeout' | 'caller_cancel' | 'none' } = { cause: 'none' };
  const abortController = new AbortController();
  const timeout = setTimeout(() => {
    if (abortState.cause === 'none') abortState.cause = 'timeout';
    abortController.abort();
  }, args.budget.timeoutMs);
  if (args.abortSignal) {
    args.abortSignal.addEventListener('abort', () => {
      if (abortState.cause === 'none') abortState.cause = 'caller_cancel';
      abortController.abort();
    }, { once: true });
  }
  const startedAt = Date.now();

  const { instructions, messages } = convertMessages(args.request.messages);

  try {
    const result = await generateObject({
      model: args.model,
      ...(instructions ? { instructions } : {}),
      messages: messages as never[],
      schema: jsonSchema(args.request.output.schema),
      ...(args.request.output.name ? { schemaName: args.request.output.name } : {}),
      maxOutputTokens: args.budget.maxTokens,
      abortSignal: abortController.signal,
      maxRetries: 0,
    });

    // PRD 128B §7: missing provider truth fails visibly — no fallbacks.
    const reportedModel = result.response?.modelId;
    if (typeof reportedModel !== 'string' || !reportedModel.trim()) {
      const errorBody: ModelTurnStructuredResponse = {
        ok: false,
        version: 1,
        modelStepId: args.modelStepId,
        error: {
          code: 'PROVIDER_ERROR',
          reasonKey: 'PROVIDER_ERROR',
          message: 'Provider did not report model identity.',
          requestId: args.requestId,
        },
      };
      return noStore(json(errorBody));
    }

    const promptTokens = result.usage?.inputTokens;
    const completionTokens = result.usage?.outputTokens;
    if (
      typeof promptTokens !== 'number' || !Number.isInteger(promptTokens) || promptTokens < 0 ||
      typeof completionTokens !== 'number' || !Number.isInteger(completionTokens) || completionTokens < 0
    ) {
      const errorBody: ModelTurnStructuredResponse = {
        ok: false,
        version: 1,
        modelStepId: args.modelStepId,
        error: {
          code: 'PROVIDER_ERROR',
          reasonKey: 'PROVIDER_ERROR',
          message: 'Provider did not report token usage.',
          requestId: args.requestId,
        },
      };
      return noStore(json(errorBody));
    }

    const finishData: ModelStepFinishData = {
      finishReason: typeof result.finishReason === 'string' && result.finishReason ? result.finishReason : 'stop',
      requestedProvider: args.selection.provider,
      requestedModel: args.selection.model,
      reportedModel,
      promptTokens,
      completionTokens,
      latencyMs: Date.now() - startedAt,
    };

    const responseBody: ModelTurnStructuredResponse = {
      ok: true,
      version: 1,
      modelStepId: args.modelStepId,
      output: result.object,
      finish: finishData,
    };

    return noStore(json(responseBody));
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError' && abortState.cause === 'caller_cancel') {
      // Caller cancellation — clean end, NOT a timeout error.
      const responseBody: ModelTurnStructuredResponse = {
        ok: false,
        version: 1,
        modelStepId: args.modelStepId,
        error: {
          code: 'CALLER_CANCELLED',
          reasonKey: 'CALLER_CANCELLED',
          message: 'Request cancelled by caller.',
          requestId: args.requestId,
        },
      };
      return noStore(json(responseBody));
    }
    const responseBody: ModelTurnStructuredResponse = {
      ok: false,
      version: 1,
      modelStepId: args.modelStepId,
      error: mapToErrorData(err, args.requestId),
    };
    return noStore(json(responseBody));
  } finally {
    clearTimeout(timeout);
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function handleModelTurn(
  request: Request,
  env: Env,
  requestContext: SanFranciscoRequestContext,
): Promise<Response> {
  const body = await readJson(request);
  if (!isModelTurnRequest(body)) {
    throw new HttpError(400, {
      code: 'BAD_REQUEST',
      message: 'Invalid model-turn request',
      issues: [{ path: '', message: 'Expected { version: 1, agentId, grant, messages, mode }' }],
    });
  }

  const modelTurnRequest = body as ModelTurnRequest;

  const grant: AIGrant = await verifyGrant(
    modelTurnRequest.grant,
    env.ROMA_AI_GRANT_PUBLIC_KEY_PEM,
  );

  const resolvedAgent = resolveAiAgent(modelTurnRequest.agentId);
  if (!resolvedAgent) {
    throw new HttpError(403, { code: 'CAPABILITY_DENIED', message: `Unknown agentId: ${modelTurnRequest.agentId}` });
  }
  const canonicalId = resolvedAgent.canonicalId;
  if (grant.ai?.agentId !== canonicalId) {
    throw new HttpError(403, {
      code: 'CAPABILITY_DENIED',
      message: `Grant AI policy does not match request agentId: ${canonicalId}`,
    });
  }
  assertCap(grant, `agent:${canonicalId}`);

  const selection = resolveModelSelection({ env, grant, agentId: canonicalId });
  const budget = resolveGrantBudgets(grant);
  const model = createAiSdkModel(env, selection);
  const modelStepId = crypto.randomUUID();
  const requestId = requestContext.requestId;
  const temperature = typeof modelTurnRequest.temperature === 'number' ? modelTurnRequest.temperature : 0.2;

  if (modelTurnRequest.mode === 'stream') {
    return withStreamInflightLimit(() =>
      Promise.resolve(
        handleStreamMode({
          model,
          request: modelTurnRequest,
          selection,
          budget,
          modelStepId,
          requestId,
          temperature,
          abortSignal: request.signal,
        }),
      ),
    );
  }

  return withInflightLimit(() =>
    handleStructuredMode({
      model,
      request: modelTurnRequest,
      selection,
      budget,
      modelStepId,
      requestId,
      temperature,
      abortSignal: request.signal,
    }),
  );
}
