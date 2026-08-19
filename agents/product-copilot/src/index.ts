/**
 * PRD 128C — Product Copilot native-tool agent brain.
 *
 * Replaces the old six-kind JSON protocol with a streaming text + native tool
 * agent. The brain builds the San Francisco /model/turn request. The Worker
 * calls San Francisco and wraps the response with agent-level events.
 *
 * The brain is pure — it builds requests and instructions. It does NOT call
 * the model or handle streaming I/O.
 */

import type {
  CopilotDraftContext,
  CopilotHistoryEntry as ContractCopilotHistoryEntry,
  CopilotTurnRequest as ContractCopilotTurnRequest,
  ProductCopilotControl,
} from '@clickeen/ck-contracts/ai';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CopilotHistoryEntry = ContractCopilotHistoryEntry;
export type DraftContext = CopilotDraftContext;
export type CopilotTurnRequest = ContractCopilotTurnRequest;

export class ProductCopilotInputError extends Error {
  readonly issues: Array<{ path: string; message: string }>;
  constructor(issues: Array<{ path: string; message: string }>) {
    super('Invalid Product Copilot input');
    this.name = 'ProductCopilotInputError';
    this.issues = issues;
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const MAX_CONVERSATION_HISTORY_MESSAGES = 8;
export const MAX_CONVERSATION_HISTORY_CHARS = 2000;
export const MAX_CONTEXT_CHARS = 120_000;
export const PROMPT_ID = 'product-copilot.tool-agent@2026-08-13';

// ---------------------------------------------------------------------------
// apply_widget_ops tool definition (JSON Schema for the model)
// ---------------------------------------------------------------------------

export const APPLY_WIDGET_OPS_TOOL = {
  name: 'apply_widget_ops',
  description:
    'Apply one or more ordered widget operations to edit the current widget draft. ' +
    'Each operation targets a control path from the provided editable controls. ' +
    'Use a batch when multiple fields change together. Bob validates and applies the batch atomically.',
  inputSchema: {
    type: 'object',
    properties: {
      ops: {
        type: 'array',
        description: 'Ordered list of widget operations to apply atomically.',
        items: {
          type: 'object',
          properties: {
            op: {
              type: 'string',
              enum: ['set', 'insert', 'remove', 'move'],
              description: 'The operation type.',
            },
            path: {
              type: 'string',
              description: 'The control path to edit (from the provided editable controls list).',
            },
            value: {
              description: 'The new value (required for set and insert).',
            },
            index: {
              type: 'number',
              description: 'Array index (for insert, remove by index, or move target).',
            },
            itemId: {
              type: 'string',
              description: 'Item identifier for remove by ID (when the control has itemIdPath).',
            },
            from: {
              type: 'number',
              description: 'Source index for move operation.',
            },
            to: {
              type: 'number',
              description: 'Target index for move operation.',
            },
          },
          required: ['op', 'path'],
        },
      },
    },
    required: ['ops'],
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function serializePromptValue(value: unknown): string {
  if (value === undefined) return '[unset]';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function controlLine(control: ProductCopilotControl): string {
  const parts: string[] = [`- ${control.path}`];
  const label = asString(control.label);
  if (label) parts.push(`label=${label}`);
  const group = asString(control.groupLabel);
  if (group) parts.push(`group=${group}`);
  parts.push(`kind=${control.kind}`);
  if (control.kind === 'enum') {
    const enumValues = control.enumValues ?? control.options?.map((o) => String(o.value)) ?? [];
    if (enumValues.length) parts.push(`enum=${enumValues.join('|')}`);
  }
  if (typeof control.min === 'number' || typeof control.max === 'number') {
    parts.push(`range=${control.min ?? '?'}..${control.max ?? '?'}`);
  }
  parts.push(`current=${serializePromptValue(control.currentValue)}`);
  return parts.join(' | ');
}

// ---------------------------------------------------------------------------
// Instruction and context building
// ---------------------------------------------------------------------------

export function buildInstructions(activeLocale: string, unavailableCapabilities: string[]): string {
  const unavailable = unavailableCapabilities.length > 0
    ? `\nYou cannot: ${unavailableCapabilities.join(', ')}.`
    : '';

  return [
    'You are Product Copilot for Clickeen Builder.',
    'You are a real conversational product agent, not just an edit matcher.',
    `All user-visible strings must be in locale: ${activeLocale}.`,
    '',
    'You can converse naturally about widgets and help the user edit them.',
    'When the user asks for a change that can be represented using the available editable controls,',
    'use the apply_widget_ops tool to make the edit.',
    '',
    'For vague aesthetic requests like "make it pop" or "make it better", ask a focused clarification',
    'or suggest a concrete approach before editing.',
    '',
    'Never invent control paths.',
    'Never claim a change succeeded before observing the tool result.',
    'After applying a tool, wait for the observation before describing the outcome.',
    '',
    'Translations are generated from the Translations workflow after save;',
    'do not localize base content here.',
    unavailable,
  ].join('\n');
}

export function buildContextPrompt(
  ctx: DraftContext,
  userMessage?: string,
): string {
  const lines: string[] = [
    `Widget: ${ctx.widgetType} (${ctx.displayName})`,
    `Locale: ${ctx.activeLocale}`,
    `Draft signature: ${ctx.draftSignature}`,
    ...(ctx.selectedControlPath ? [`Selected control: ${ctx.selectedControlPath}`] : []),
    `Available actions: ${ctx.availableActions.join(', ') || '[none]'}`,
  ];

  if (ctx.controls.length > 0 && ctx.availableActions.includes('draft_edit')) {
    lines.push('', 'Editable controls:');
    for (const control of ctx.controls) {
      lines.push(controlLine(control));
    }
  } else {
    lines.push('', 'Draft editing is not available for this turn.');
  }

  if (userMessage) {
    lines.push('', `User message: ${userMessage}`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// San Francisco /model/turn request builder
// ---------------------------------------------------------------------------

type SanFranciscoTurnMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string }
  | { role: 'assistant'; content: null; toolCallId: string; toolName: string; input: unknown }
  | { role: 'tool'; toolCallId: string; toolName: string; result: unknown };

export function buildSanFranciscoTurnRequest(args: {
  grant: string;
  turnRequest: CopilotTurnRequest;
  temperature: number;
}): {
  version: 1;
  agentId: string;
  grant: string;
  mode: 'stream';
  messages: SanFranciscoTurnMessage[];
  tools: readonly [typeof APPLY_WIDGET_OPS_TOOL];
  temperature: number;
} {
  const { turnRequest } = args;
  const ctx = turnRequest.currentDraftContext;

  const instructions = buildInstructions(ctx.activeLocale, ctx.unavailableCapabilities);
  const contextPrompt = buildContextPrompt(
    ctx,
    turnRequest.kind === 'initial' ? turnRequest.userMessage : undefined,
  );

  if (contextPrompt.length > MAX_CONTEXT_CHARS) {
    throw new ProductCopilotInputError([
      { path: 'currentDraftContext', message: 'Context capsule is too large for this turn.' },
    ]);
  }

  const messages: SanFranciscoTurnMessage[] = [
    { role: 'system', content: instructions },
  ];

  for (const entry of turnRequest.conversationHistory) {
    if ('toolCall' in entry) {
      messages.push({
        role: 'assistant',
        content: null,
        toolCallId: entry.toolCall.toolCallId,
        toolName: entry.toolCall.toolName,
        input: entry.toolCall.input,
      });
    } else {
      messages.push({ role: entry.role, content: entry.text });
    }

    if ('toolResult' in entry) {
      messages.push({
        role: 'tool',
        toolCallId: entry.toolCall.toolCallId,
        toolName: entry.toolCall.toolName,
        result: entry.toolResult,
      });
    }
  }

  if (turnRequest.kind === 'initial') {
    messages.push({ role: 'user', content: contextPrompt });
  }

  if (turnRequest.kind === 'continuation') {
    // De-duplicate against the conversation history: Bob's success path
    // (CopilotPane.tsx) records the tool call + result in the SAME history
    // entry AND passes the result as the top-level toolResult field. The
    // provider must receive exactly one tool-result message per tool_call_id,
    // so if the history loop already emitted a result for this call, do not
    // emit it again from the top-level field.
    const topToolCallId = turnRequest.toolCallId;
    const alreadyInHistory = messages.some(
      (m) => m.role === 'tool' && m.toolCallId === topToolCallId,
    );
    if (!alreadyInHistory) {
      messages.push({
        role: 'tool',
        toolCallId: topToolCallId,
        toolName: 'apply_widget_ops',
        result: turnRequest.toolResult,
      });
    }
  }

  return {
    version: 1,
    agentId: 'product.copilot',
    grant: args.grant,
    mode: 'stream',
    messages,
    tools: [APPLY_WIDGET_OPS_TOOL],
    temperature: args.temperature,
  };
}
