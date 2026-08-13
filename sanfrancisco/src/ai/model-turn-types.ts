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

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isModelTurnMessage(value: unknown): value is ModelTurnMessage {
  if (!isRecord(value)) return false;
  const role = value.role;
  if (role === 'system' || role === 'user') {
    return typeof value.content === 'string';
  }
  if (role === 'assistant') {
    if (typeof value.content === 'string') return true;
    if (value.content === null) {
      return isString(value.toolCallId) && isString(value.toolName);
    }
    return false;
  }
  if (role === 'tool') {
    return isString(value.toolCallId) && isString(value.toolName) && 'result' in value;
  }
  return false;
}

function isModelTurnToolDefinition(value: unknown): value is ModelTurnToolDefinition {
  if (!isRecord(value)) return false;
  return isString(value.name) && isString(value.description) && isRecord(value.inputSchema);
}

function isModelTurnStructuredOutput(value: unknown): value is ModelTurnStructuredOutput {
  if (!isRecord(value)) return false;
  return isRecord(value.schema);
}

function isModelTurnRequestBase(value: unknown): value is ModelTurnRequestBase & { mode: unknown; output: unknown } {
  if (!isRecord(value)) return false;
  if (value.version !== 1) return false;
  if (!isString(value.agentId)) return false;
  if (!isString(value.grant)) return false;
  if (!Array.isArray(value.messages) || value.messages.length === 0) return false;
  if (!value.messages.every(isModelTurnMessage)) return false;
  if (value.messages.length > 50) return false;
  if (value.tools !== undefined) {
    if (!Array.isArray(value.tools) || !value.tools.every(isModelTurnToolDefinition)) return false;
  }
  if (value.toolChoice !== undefined) {
    if (!['auto', 'required', 'none'].includes(value.toolChoice as string)) return false;
  }
  if (value.temperature !== undefined) {
    if (typeof value.temperature !== 'number' || !Number.isFinite(value.temperature)) return false;
  }
  return true;
}

export function isModelTurnStreamRequest(value: unknown): value is ModelTurnStreamRequest {
  return isModelTurnRequestBase(value) && value.mode === 'stream';
}

export function isModelTurnStructuredRequest(value: unknown): value is ModelTurnStructuredRequest {
  if (!isModelTurnRequestBase(value)) return false;
  if (value.mode !== 'structured') return false;
  return isModelTurnStructuredOutput(value.output);
}

export function isModelTurnRequest(value: unknown): value is ModelTurnRequest {
  return isModelTurnStreamRequest(value) || isModelTurnStructuredRequest(value);
}
