/**
 * PRD 128 Phase 1.3 gate tests — Bob structured model history.
 *
 * Gate: History functions produce correctly ordered entries.
 * Gate: Each tool call appears exactly once with its result.
 * Gate: UI chat is a separate array — no mixing.
 *
 * Run: cd bob && npx tsx tests/run-copilot-model-history.ts
 */

import assert from 'node:assert/strict';
import {
  emptyCopilotModelHistory,
  appendUserMessage,
  appendAssistantText,
  appendToolCall,
  appendToolResult,
  toWireHistory,
} from '../lib/copilot/model-history';

function assertPass(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${label}`);
  } catch (err) {
    console.error(`  ❌ ${label}`);
    throw err;
  }
}

function testOrdering() {
  console.log('\n--- Ordering ---');

  assertPass('entries maintain strict order', () => {
    let h = emptyCopilotModelHistory();
    h = appendUserMessage(h, 'question 1');
    h = appendAssistantText(h, 'answer 1');
    h = appendUserMessage(h, 'question 2');
    h = appendAssistantText(h, 'answer 2');

    assert.equal(h.entries.length, 4);
    assert.equal(h.entries[0].role, 'user');
    assert.equal(h.entries[0].text, 'question 1');
    assert.equal(h.entries[1].role, 'assistant');
    assert.equal(h.entries[1].text, 'answer 1');
    assert.equal(h.entries[2].role, 'user');
    assert.equal(h.entries[3].role, 'assistant');
  });

  assertPass('consecutive assistant text merges into one entry', () => {
    let h = emptyCopilotModelHistory();
    h = appendAssistantText(h, 'Hello ');
    h = appendAssistantText(h, 'World');
    // Should be one entry with combined text (consecutive deltas merge)
    assert.equal(h.entries.length, 1);
    assert.equal(h.entries[0].text, 'Hello World');
  });

  assertPass('user then assistant text creates two entries', () => {
    let h = emptyCopilotModelHistory();
    h = appendUserMessage(h, 'q');
    h = appendAssistantText(h, 'a1');
    h = appendAssistantText(h, 'a2');
    // assistant texts merge after a user message
    assert.equal(h.entries.length, 2);
    assert.equal(h.entries[1].text, 'a1a2');
  });
}

function testToolCallOnce() {
  console.log('\n--- Tool call appears exactly once ---');

  assertPass('tool call appended as one entry', () => {
    let h = emptyCopilotModelHistory();
    h = appendUserMessage(h, 'edit the title');
    h = appendToolCall(h, { toolCallId: 'call-1', toolName: 'apply_widget_ops', input: { ops: [] } });

    assert.equal(h.entries.length, 2);
    const last = h.entries[1];
    assert.equal(last.role, 'assistant');
    assert.ok('toolCall' in last);
    if ('toolCall' in last && last.toolCall) {
      assert.equal(last.toolCall.toolCallId, 'call-1');
      assert.equal(last.toolCall.toolName, 'apply_widget_ops');
    }
  });

  assertPass('tool result attached to the SAME entry (not a new one)', () => {
    let h = emptyCopilotModelHistory();
    h = appendToolCall(h, { toolCallId: 'call-1', toolName: 'apply_widget_ops', input: {} });
    h = appendToolResult(h, 'call-1', { ok: true, changedPaths: ['title'] });

    // Still one entry — result attached to the call entry
    assert.equal(h.entries.length, 1);
    const entry = h.entries[0];
    assert.ok('toolCall' in entry);
    assert.ok('toolResult' in entry);
    if ('toolResult' in entry) {
      const result = entry.toolResult as { ok: boolean; changedPaths: string[] };
      assert.ok(result.ok);
      assert.deepEqual(result.changedPaths, ['title']);
    }
  });

  assertPass('appendToolResult with unknown toolCallId throws visibly', () => {
    let h = emptyCopilotModelHistory();
    h = appendToolCall(h, { toolCallId: 'call-1', toolName: 'apply_widget_ops', input: {} });
    // Try to attach a result to a non-existent call
    assert.throws(() => {
      appendToolResult(h, 'call-NOT-EXIST', { ok: true });
    }, /no unanswered tool call/);
  });

  assertPass('full tool round: call + result in one entry, then more text', () => {
    let h = emptyCopilotModelHistory();
    h = appendUserMessage(h, 'edit');
    h = appendToolCall(h, { toolCallId: 'c1', toolName: 'apply_widget_ops', input: {} });
    h = appendToolResult(h, 'c1', { ok: true });
    h = appendAssistantText(h, 'Done!');

    assert.equal(h.entries.length, 3); // user, tool-call+result, assistant text
    assert.equal(h.entries[0].role, 'user');
    assert.ok('toolCall' in h.entries[1] && 'toolResult' in h.entries[1]);
    assert.equal(h.entries[2].role, 'assistant');
    assert.equal(h.entries[2].text, 'Done!');
  });
}

function testWireBounds() {
  console.log('\n--- Wire bounds ---');

  assertPass('toWireHistory returns all entries when under max', () => {
    let h = emptyCopilotModelHistory();
    for (let i = 0; i < 5; i++) {
      h = appendUserMessage(h, `msg ${i}`);
    }
    const wire = toWireHistory(h);
    assert.equal(wire.length, 5);
  });

  assertPass('toWireHistory trims to max 8 keeping the tail', () => {
    let h = emptyCopilotModelHistory();
    for (let i = 0; i < 12; i++) {
      h = appendUserMessage(h, `msg ${i}`);
    }
    const wire = toWireHistory(h);
    assert.equal(wire.length, 8);
    // Tail kept — the most recent messages
    assert.equal(wire[0].text, 'msg 4');
    assert.equal(wire[7].text, 'msg 11');
  });

  assertPass('toWireHistory does not orphan a tool result from its call', () => {
    let h = emptyCopilotModelHistory();
    // Fill with 7 user messages
    for (let i = 0; i < 7; i++) {
      h = appendUserMessage(h, `msg ${i}`);
    }
    // Add a tool call + result (entries 8 and would-be 9 if separate, but they're one entry)
    h = appendToolCall(h, { toolCallId: 'c1', toolName: 'apply_widget_ops', input: {} });
    h = appendToolResult(h, 'c1', { ok: true });
    // Total: 8 entries (7 user + 1 tool-call-with-result)
    assert.equal(h.entries.length, 8);

    const wire = toWireHistory(h);
    assert.equal(wire.length, 8);
    // The last entry should be the tool call+result (kept together)
    const last = wire[7];
    assert.ok('toolCall' in last && 'toolResult' in last, 'tool call+result not orphaned');
  });
}

function testSeparationFromUiChat() {
  console.log('\n--- Separation from UI chat ---');

  assertPass('model history has no UI rendering fields (no id, no ts)', () => {
    let h = emptyCopilotModelHistory();
    h = appendUserMessage(h, 'hello');
    const entry = h.entries[0] as Record<string, unknown>;
    assert.ok(!('id' in entry), 'no UI id field');
    assert.ok(!('ts' in entry), 'no UI timestamp field');
    assert.ok(!('hasUndoAction' in entry), 'no UI undo flag');
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function run(): void {
  console.log('=== PRD 128 Phase 1.3 Gate Tests — Model History ===');
  testOrdering();
  testToolCallOnce();
  testWireBounds();
  testSeparationFromUiChat();
  console.log('\n=== All Phase 1.3 gate tests passed ===');
}

run();
