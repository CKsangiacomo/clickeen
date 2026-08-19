/**
 * PRD 128A — Clickeen-owned model-turn contract types.
 *
 * These types define the wire protocol for POST /model/turn.
 * They are Clickeen-owned — no AI SDK types leak into this contract.
 * San Francisco adapts between these types and AI SDK internals.
 */

// ---------------------------------------------------------------------------
// Request message types
// ---------------------------------------------------------------------------

export type ModelTurnMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string }
  | {
      role: 'assistant';
      content: null;
      toolCallId: string;
      toolName: string;
      input: unknown;
    }
  | {
      role: 'tool';
      toolCallId: string;
      toolName: string;
      result: unknown;
    };

// ---------------------------------------------------------------------------
// Tool definition (agent-home-supplied, San Francisco transports)
// ---------------------------------------------------------------------------

export type ModelTurnToolDefinition = {
  name: string;
  description: string;
  /**
   * JSON Schema for the tool's input parameters.
   * San Francisco wraps this as `inputSchema` when passing to the AI SDK.
   */
  inputSchema: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Structured output definition
// ---------------------------------------------------------------------------

export type ModelTurnStructuredOutput = {
  /**
   * JSON Schema describing the expected structured output.
   * San Francisco passes this as the `schema` to `generateObject()`.
   */
  schema: Record<string, unknown>;
  /** Optional schema name for the AI SDK's structured output mode. */
  name?: string;
};

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

export type ModelTurnRequestBase = {
  version: 1;
  agentId: string;
  grant: string;
  messages: ModelTurnMessage[];
  tools?: ModelTurnToolDefinition[];
  toolChoice?: 'auto' | 'required' | 'none';
  temperature?: number;
  trace?: {
    sessionId?: string;
    instanceId?: string;
    requestId?: string;
  };
};

export type ModelTurnStreamRequest = ModelTurnRequestBase & {
  mode: 'stream';
};

export type ModelTurnStructuredRequest = ModelTurnRequestBase & {
  mode: 'structured';
  output: ModelTurnStructuredOutput;
};

export type ModelTurnRequest = ModelTurnStreamRequest | ModelTurnStructuredRequest;

// ---------------------------------------------------------------------------
// Model-step event types (the 128A contract)
// ---------------------------------------------------------------------------

export type ModelStepEvent =
  | { version: 1; modelStepId: string; type: 'text_delta'; data: { text: string } }
  | {
      version: 1;
      modelStepId: string;
      type: 'tool_call';
      data: { toolCallId: string; toolName: string; input: unknown };
    }
  | {
      version: 1;
      modelStepId: string;
      type: 'model_step_finished';
      data: ModelStepFinishData;
    }
  | {
      version: 1;
      modelStepId: string;
      type: 'structured_result';
      data: { output: unknown } & ModelStepFinishData;
    }
  | {
      version: 1;
      modelStepId: string;
      type: 'model_step_error';
      data: ModelStepErrorData;
    };

export type ModelStepFinishData = {
  finishReason: string;
  requestedProvider: string;
  requestedModel: string;
  reportedModel: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
};

export type ModelStepErrorData = {
  code: string;
  reasonKey: string;
  message: string;
  provider?: string;
  upstreamStatus?: number;
  issues?: Array<{ path: string; message: string }>;
  requestId?: string;
};

// ---------------------------------------------------------------------------
// Structured mode JSON response (non-streaming)
// ---------------------------------------------------------------------------

export type ModelTurnStructuredResponse =
  | {
      ok: true;
      version: 1;
      modelStepId: string;
      output: unknown;
      finish: ModelStepFinishData;
    }
  | {
      ok: false;
      version: 1;
      modelStepId: string;
      error: ModelStepErrorData;
    };
