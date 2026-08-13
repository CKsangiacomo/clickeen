/**
 * PRD 128C/128D — Bob-owned structured model history.
 *
 * This is the structured history sent to Product Copilot on each turn/continuation
 * request. It is SEPARATE from the visible conversation bubbles (CopilotMessage)
 * used for UI rendering. The model history holds ordered entries including
 * assistant tool calls and tool results; the visible chat is text-only.
 *
 * Invariants enforced by these functions:
 * - Each assistant tool call appears exactly once.
 * - Its matching result appears exactly once (appended to the entry holding the call).
 * - Entries maintain strict ordering.
 * - Wire bounds (max 8 entries) are enforced when serializing for the request.
 */

import type { CopilotHistoryEntry } from '@clickeen/ck-contracts/ai';
import { COPILOT_MAX_HISTORY_ENTRIES } from '@clickeen/ck-contracts/ai';

export type CopilotModelHistory = {
  entries: CopilotHistoryEntry[];
};

export function emptyCopilotModelHistory(): CopilotModelHistory {
  return { entries: [] };
}

export function appendUserMessage(history: CopilotModelHistory, text: string): CopilotModelHistory {
  return { entries: [...history.entries, { role: 'user', text }] };
}

export function appendAssistantText(history: CopilotModelHistory, text: string): CopilotModelHistory {
  // If the last entry is an assistant text entry (no tool call), append to it.
  // This keeps consecutive text deltas from creating separate entries.
  const last = history.entries[history.entries.length - 1];
  if (last && last.role === 'assistant' && !('toolCall' in last)) {
    return {
      entries: [...history.entries.slice(0, -1), { role: 'assistant', text: `${last.text}${text}` }],
    };
  }
  return { entries: [...history.entries, { role: 'assistant', text }] };
}

export function appendToolCall(
  history: CopilotModelHistory,
  call: { toolCallId: string; toolName: string; input: unknown },
): CopilotModelHistory {
  return {
    entries: [
      ...history.entries,
      { role: 'assistant', text: '', toolCall: call },
    ],
  };
}

export function appendToolResult(
  history: CopilotModelHistory,
  toolCallId: string,
  result: unknown,
): CopilotModelHistory {
  // Find the entry holding the matching tool call and attach the result to it.
  // The result is attached to the SAME entry (not a new entry) so each
  // call/result pair appears exactly once.
  const entries = [...history.entries];
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (
      entry.role === 'assistant' &&
      'toolCall' in entry &&
      entry.toolCall &&
      entry.toolCall.toolCallId === toolCallId &&
      !('toolResult' in entry)
    ) {
      entries[i] = { ...entry, toolResult: result } as CopilotHistoryEntry;
      return { entries };
    }
  }
  // No matching unanswered tool call found — this is a programming error.
  // Fail visibly rather than silently appending an orphan result.
  throw new Error(`appendToolResult: no unanswered tool call found for toolCallId=${toolCallId}`);
}

/**
 * Serialize for the wire request, enforcing the max-entries bound.
 * Keeps the MOST RECENT entries (the tail), dropping the oldest.
 * Never truncates mid-tool-call: if the cut would separate a tool call from
 * its result, both are kept together or both are dropped.
 */
export function toWireHistory(history: CopilotModelHistory): CopilotHistoryEntry[] {
  if (history.entries.length <= COPILOT_MAX_HISTORY_ENTRIES) {
    return history.entries;
  }

  // Take the tail, but ensure tool call/result pairs stay together.
  const tail = history.entries.slice(-COPILOT_MAX_HISTORY_ENTRIES);

  // If the first entry in the tail has a toolResult but its toolCall was cut off,
  // drop it (the result is orphaned without the call).
  const first = tail[0];
  if (first && first.role === 'assistant' && 'toolResult' in first && !('toolCall' in first)) {
    return tail.slice(1);
  }

  return tail;
}
