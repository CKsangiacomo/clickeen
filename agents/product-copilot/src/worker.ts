/**
 * PRD 128C/128D — Product Copilot Worker with /turn streaming endpoint.
 *
 * Receives turn requests (initial/continuation) from Roma, builds the San
 * Francisco /model/turn request, calls San Francisco via service binding,
 * and wraps the model-step SSE stream with Product Copilot agent-level events.
 */

import { CK_REQUEST_ID_HEADER, asTrimmedString, isRecord, normalizeRequestId } from '@clickeen/ck-contracts';
import {
  ProductCopilotInputError,
  buildSanFranciscoTurnRequest,
  validateTurnRequest,
  type CopilotTurnRequest,
} from './index';

const PRODUCT_COPILOT_AGENT_ID = 'product.copilot';

type Env = {
  ENVIRONMENT?: string;
  SANFRANCISCO_AI_ENGINE?: Fetcher;
};

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

class HttpError extends Error {
  readonly status: number;
  readonly payload: unknown;
  constructor(status: number, payload: unknown) {
    super(isRecord(payload) && typeof (payload as Record<string, unknown>).message === 'string'
      ? (payload as Record<string, unknown>).message as string
      : `HTTP ${status}`);
    this.status = status;
    this.payload = payload;
  }
}

function json(value: unknown, init?: { status?: number }): Response {
  return new Response(JSON.stringify(value), {
    status: init?.status ?? 200,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, { error: { code: 'BAD_REQUEST', message: 'Invalid JSON body' } });
  }
}

// ---------------------------------------------------------------------------
// SSE helpers
// ---------------------------------------------------------------------------

function sseEvent(type: string, data: unknown): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Parse San Francisco SSE response and emit Product Copilot agent events.
 *
 * San Francisco emits: text_delta, tool_call, model_step_finished, model_step_error.
 * Product Copilot wraps with: agent_turn_started (before), agent_turn_finished/error (after).
 *
 * model_step_finished with finishReason "stop" → agent_turn_finished.
 * model_step_finished with finishReason "tool-calls" → no agent terminal (Bob sends continuation).
 * model_step_error → agent_turn_error.
 */
export function createAgentEventStream(args: {
  sanFranciscoResponse: Response;
  userTurnId: string;
  requestId: string;
  isInitial: boolean;
}): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  // ONE streaming TextDecoder — maintains multibyte state across chunks.
  const decoder = new TextDecoder();
  const reader = args.sanFranciscoResponse.body?.getReader();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      // PRD 128C/128D: agent_turn_started is emitted ONCE per user turn,
      // on the initial request only — never on continuations.
      if (args.isInitial) {
        controller.enqueue(encoder.encode(
          sseEvent('agent_turn_started', { version: 1, userTurnId: args.userTurnId, type: 'agent_turn_started', data: {} }),
        ));
      }

      if (!reader) {
        controller.enqueue(encoder.encode(
          sseEvent('agent_turn_error', {
            version: 1, userTurnId: args.userTurnId, type: 'agent_turn_error',
            data: { code: 'PROVIDER_ERROR', reasonKey: 'PROVIDER_ERROR', message: 'No response body from San Francisco', requestId: args.requestId },
          }),
        ));
        controller.close();
        return;
      }

      let buffer = '';
      let terminalEmitted = false;
      // PRD 128C §7: tool-calls finish is a VALID step boundary awaiting Bob —
      // not a terminal, not an error. The stream closes cleanly and Bob
      // executes the tool and sends a continuation.
      let stepEndedAwaitingContinuation = false;
      // PRD 128C: at most one tool call per model step. A second is a
      // visible failure — Bob must never apply the first while the step
      // could still produce another.
      let toolCallCount = 0;

      const emitAgentError = (message: string) => {
        if (terminalEmitted) return;
        terminalEmitted = true;
        controller.enqueue(encoder.encode(
          sseEvent('agent_turn_error', {
            version: 1, userTurnId: args.userTurnId, type: 'agent_turn_error',
            data: { code: 'PROVIDER_ERROR', reasonKey: 'PROVIDER_ERROR', message, requestId: args.requestId },
          }),
        ));
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          // Streaming decode (maintains multibyte state) + CRLF normalization.
          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n').replace(/\r/g, '\n');

          // Parse complete SSE events (separated by \n\n after normalization).
          let eventEnd: number;
          while ((eventEnd = buffer.indexOf('\n\n')) !== -1) {
            const rawEvent = buffer.slice(0, eventEnd);
            buffer = buffer.slice(eventEnd + 2);

            // Parse the SSE event.
            let eventType: string | null = null;
            let eventData: Record<string, unknown> | null = null;

            for (const line of rawEvent.split('\n')) {
              if (line.startsWith('event: ')) {
                eventType = line.slice(7).trim();
              } else if (line.startsWith('data: ')) {
                // PRD 128C: malformed JSON fails visibly — never silently dropped.
                try {
                  eventData = JSON.parse(line.slice(6));
                } catch {
                  emitAgentError(`Malformed SSE data line: ${line.substring(0, 100)}`);
                  return;
                }
              }
            }

            if (!eventType || !eventData) {
              // PRD 128C: unknown or incomplete events fail visibly.
              emitAgentError(`Incomplete SSE event (type=${eventType ?? 'missing'}).`);
              return;
            }

            const sfType = eventType;
            const sfData = eventData;
            const sfModelStepId = typeof sfData.modelStepId === 'string' ? sfData.modelStepId : undefined;

            // PRD 128C: SSE event name must agree with payload.type.
            if (typeof sfData.type === 'string' && sfData.type !== sfType) {
              emitAgentError(`SSE event name (${sfType}) does not match payload type (${sfData.type}).`);
              return;
            }

            if (sfType === 'text_delta') {
              // PRD 128D: modelStepId is required on text_delta.
              if (!sfModelStepId) {
                emitAgentError('San Francisco text_delta missing modelStepId.');
                return;
              }
              controller.enqueue(encoder.encode(sseEvent('text_delta', {
                version: 1, userTurnId: args.userTurnId, modelStepId: sfModelStepId, type: 'text_delta',
                data: sfData.data ?? {},
              })));
            } else if (sfType === 'tool_call') {
              // PRD 128D: modelStepId is required on tool_call.
              if (!sfModelStepId) {
                emitAgentError('San Francisco tool_call missing modelStepId.');
                return;
              }
              toolCallCount++;
              if (toolCallCount > 1) {
                // PRD 128C: multiple tool calls in one step are a visible failure.
                // Bob sees the first tool_call followed by agent_turn_error
                // and knows not to execute.
                emitAgentError('Model emitted multiple tool calls in a single step.');
                return;
              }
              controller.enqueue(encoder.encode(sseEvent('tool_call', {
                version: 1, userTurnId: args.userTurnId, modelStepId: sfModelStepId, type: 'tool_call',
                data: sfData.data ?? {},
              })));
            } else if (sfType === 'model_step_finished') {
              const finishData = (sfData.data ?? {}) as Record<string, unknown>;
              // PRD 128D: modelStepId is required on model_step_finished.
              if (!sfModelStepId) {
                emitAgentError('San Francisco model_step_finished missing modelStepId.');
                return;
              }
              // Forward the model-step finish with modelStepId preserved.
              controller.enqueue(encoder.encode(sseEvent('model_step_finished', {
                version: 1, userTurnId: args.userTurnId, modelStepId: sfModelStepId, type: 'model_step_finished',
                data: finishData,
              })));

              // Tool-call count consistency: tool-calls finish requires exactly
              // one tool call; stop requires zero.
              const finishReason = finishData.finishReason;
              if (finishReason === 'tool-calls' && toolCallCount !== 1) {
                emitAgentError(`Finish reason "tool-calls" but toolCallCount=${toolCallCount}.`);
                return;
              }
              if (finishReason === 'stop' && toolCallCount !== 0) {
                emitAgentError(`Finish reason "stop" but toolCallCount=${toolCallCount}.`);
                return;
              }

              if (finishReason === 'stop') {
                // Genuine completion — model finished without requesting another tool.
                terminalEmitted = true;
                controller.enqueue(encoder.encode(sseEvent('agent_turn_finished', {
                  version: 1, userTurnId: args.userTurnId, type: 'agent_turn_finished',
                  data: {},
                })));
              } else if (finishReason === 'tool-calls') {
                // Valid step boundary — Bob will execute the tool and send
                // a continuation. The stream closes cleanly here.
                // NO terminal agent event, NO error.
                stepEndedAwaitingContinuation = true;
              } else if (finishReason === 'length') {
                // Visibly incomplete — ceiling, NOT success.
                terminalEmitted = true;
                controller.enqueue(encoder.encode(sseEvent('agent_turn_error', {
                  version: 1, userTurnId: args.userTurnId, type: 'agent_turn_error',
                  data: {
                    code: 'BUDGET_EXCEEDED',
                    reasonKey: 'BUDGET_EXCEEDED',
                    message: 'Turn ended at the step or token ceiling without completing.',
                    requestId: args.requestId,
                  },
                })));
              } else if (finishReason === 'content-filter') {
                // Visibly incomplete — interruption, NOT success.
                terminalEmitted = true;
                controller.enqueue(encoder.encode(sseEvent('agent_turn_error', {
                  version: 1, userTurnId: args.userTurnId, type: 'agent_turn_error',
                  data: {
                    code: 'PROVIDER_ERROR',
                    reasonKey: 'PROVIDER_ERROR',
                    message: 'Turn ended by content filter without completing.',
                    requestId: args.requestId,
                  },
                })));
              }

              // Reset tool call count for the next model step (in case SF
              // sends multiple steps in one stream — normally one per request).
              toolCallCount = 0;
            } else if (sfType === 'model_step_error') {
              const errorData = (sfData.data ?? {}) as Record<string, unknown>;
              terminalEmitted = true;
              controller.enqueue(encoder.encode(sseEvent('agent_turn_error', {
                version: 1, userTurnId: args.userTurnId, type: 'agent_turn_error',
                data: errorData,
              })));
            } else {
              // PRD 128C: unknown event names fail visibly.
              emitAgentError(`Unknown San Francisco event type: ${sfType}.`);
              return;
            }
          }
        }

        // If stream ended without a terminal or a valid step boundary, fail visibly.
        if (!terminalEmitted && !stepEndedAwaitingContinuation) {
          emitAgentError('Model stream ended without a terminal event or tool-step boundary.');
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Cancellation — emit agent_turn_stopped if nothing terminal yet.
          if (!terminalEmitted) {
            terminalEmitted = true;
            controller.enqueue(encoder.encode(sseEvent('agent_turn_stopped', {
              version: 1, userTurnId: args.userTurnId, type: 'agent_turn_stopped',
              data: {},
            })));
          }
        } else {
          emitAgentError(err instanceof Error ? err.message : 'Stream processing failed.');
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      // PRD 128C: downstream cancellation cancels the San Francisco reader.
      reader?.cancel().catch(() => {});
    },
  });
}

// ---------------------------------------------------------------------------
// Turn handler
// ---------------------------------------------------------------------------

async function handleTurn(request: Request, env: Env): Promise<Response> {
  const body = await readJson(request);

  let turnRequest: CopilotTurnRequest;
  try {
    turnRequest = validateTurnRequest(body);
  } catch (err) {
    if (err instanceof ProductCopilotInputError) {
      throw new HttpError(400, {
        error: {
          code: 'BAD_REQUEST',
          reasonKey: 'coreui.errors.copilot.invalidRequest',
          message: 'Invalid Product Copilot turn request',
          issues: err.issues,
        },
      });
    }
    throw err;
  }

  if (!env.SANFRANCISCO_AI_ENGINE) {
    throw new HttpError(500, {
      error: {
        code: 'PROVIDER_ERROR',
        provider: 'product-copilot',
        message: 'Missing SANFRANCISCO_AI_ENGINE service binding.',
      },
    });
  }

  // Build the San Francisco /model/turn request
  const sfRequest = buildSanFranciscoTurnRequest({
    grant: '', // Grant is forwarded by Roma through the request body; the Worker
               // receives it from Roma's call. For now, the Worker passes the
               // grant from the original request if present in the body.
    turnRequest,
    temperature: 0.2,
  });

  // The grant comes from the incoming request, carried by Roma
  const grant = (body as Record<string, unknown>).grant;
  if (typeof grant === 'string') {
    (sfRequest as Record<string, unknown>).grant = grant;
  }

  const requestId = normalizeRequestId(request.headers.get(CK_REQUEST_ID_HEADER)) ?? crypto.randomUUID();

  // Call San Francisco /model/turn via service binding
  const sfResponse = await env.SANFRANCISCO_AI_ENGINE.fetch(
    'https://sanfrancisco.internal/model/turn',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        [CK_REQUEST_ID_HEADER]: requestId,
      },
      body: JSON.stringify(sfRequest),
      signal: request.signal,
    },
  );

  if (!sfResponse.ok) {
    const errorText = await sfResponse.text().catch(() => '');
    throw new HttpError(sfResponse.status, {
      error: {
        code: 'PROVIDER_ERROR',
        provider: 'sanfrancisco',
        message: errorText || `San Francisco /model/turn failed (${sfResponse.status})`,
      },
    });
  }

  // Create the agent event stream
  const agentStream = createAgentEventStream({
    sanFranciscoResponse: sfResponse,
    userTurnId: turnRequest.userTurnId,
    requestId,
    isInitial: turnRequest.kind === 'initial',
  });

  return new Response(agentStream, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-store',
    },
  });
}

// ---------------------------------------------------------------------------
// Worker entry
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    try {
      if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === '/healthz') {
        return json({
          ok: true,
          service: 'product-copilot',
          env: env.ENVIRONMENT ?? 'unknown',
          ts: Date.now(),
        });
      }

      if (request.method === 'POST' && url.pathname === '/turn') {
        return await handleTurn(request, env);
      }

      // Deprecated /execute — returns 410
      if (request.method === 'POST' && url.pathname === '/execute') {
        return json({
          error: {
            code: 'BAD_REQUEST',
            message: 'Product Copilot /execute is deprecated. Use /turn for the native tool agent.',
          },
        }, { status: 410 });
      }

      throw new HttpError(404, { error: { code: 'BAD_REQUEST', message: 'Not found' } });
    } catch (err: unknown) {
      if (err instanceof HttpError) {
        return json(err.payload, { status: err.status });
      }
      console.error('[product-copilot] Unhandled error', err);
      return json({
        error: {
          code: 'PROVIDER_ERROR',
          provider: 'product-copilot',
          message: 'Product Copilot failed unexpectedly.',
        },
      }, { status: 500 });
    }
  },
};
