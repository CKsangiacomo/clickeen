/**
 * PRD 128 Phase 7 — Full-loop integration regression tests.
 *
 * Verifies the complete request-shape chain:
 *   CopilotTurnRequest → buildSanFranciscoTurnRequest → SF /model/turn shape
 *
 * This does NOT call real APIs. It exercises the exported pure functions and
 * asserts the wire shape that San Francisco (and the Roma SSE parser
 * downstream) expect: instructions present, messages well-formed, the
 * apply_widget_ops tool declared exactly once, and — critically — tool
 * results never duplicated across the history loop and the top-level
 * continuation field.
 *
 * Test 5 also reaches across to Bob's structured model history to prove the
 * wire-bounds trimming feeds cleanly into the SF request builder.
 *
 * Run: cd agents/product-copilot && npx tsx tests/run-full-loop.ts
 */

import assert from 'node:assert/strict';
import {
  buildSanFranciscoTurnRequest,
  APPLY_WIDGET_OPS_TOOL,
  MAX_CONVERSATION_HISTORY_MESSAGES,
  type CopilotTurnRequest,
  type DraftContext,
} from '../src/index';
// Bob owns the structured model history that becomes conversationHistory.
// The full loop is Bob → Product Copilot, so we exercise Bob's toWireHistory
// here to prove the trimmed history round-trips through the SF builder.
import {
  emptyCopilotModelHistory,
  appendToolCall,
  appendToolResult,
  appendUserMessage,
  toWireHistory,
} from '../../../bob/lib/copilot/model-history';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertPass(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${label}`);
  } catch (err) {
    console.error(`  ❌ ${label}`);
    throw err;
  }
}

function makeDraftContext(overrides: Partial<DraftContext> = {}): DraftContext {
  return {
    instanceId: 'instance-1',
    widgetType: 'bigbang',
    displayName: 'Big Bang',
    activeLocale: 'en',
    draftSignature: 'sig-1',
    controls: [],
    availableActions: ['draft_edit'],
    unavailableCapabilities: [],
    ...overrides,
  };
}

function buildSf(args: {
  grant?: string;
  temperature?: number;
  turnRequest: CopilotTurnRequest;
}) {
  return buildSanFranciscoTurnRequest({
    grant: args.grant ?? 'signed-grant-string',
    temperature: args.temperature ?? 0.2,
    turnRequest: args.turnRequest,
  });
}

/** Count SF messages of a given role, optionally matching a toolCallId. */
function countMessages(
  messages: ReturnType<typeof buildSf>['messages'],
  role: 'system' | 'user' | 'assistant' | 'tool',
  toolCallId?: string,
): number {
  return messages.filter((m) => {
    if (m.role !== role) return false;
    if (toolCallId !== undefined && m.role === 'tool') return m.toolCallId === toolCallId;
    return true;
  }).length;
}

// ---------------------------------------------------------------------------
// 1. Full-loop: text-only initial turn (no tool)
// ---------------------------------------------------------------------------

function testTextOnlyInitialTurn(): void {
  console.log('\n--- 1. Full-loop: text-only initial turn ---');

  assertPass('instructions present, user message present, tool declared, shape round-trips', () => {
    const turnRequest: CopilotTurnRequest = {
      version: 1,
      kind: 'initial',
      sessionId: 'session-1',
      userTurnId: 'turn-1',
      userMessage: 'Change the title to Hello',
      conversationHistory: [],
      currentDraftContext: makeDraftContext(),
    };

    const sf = buildSf({ turnRequest });

    // Top-level wire shape San Francisco / Roma expect.
    assert.equal(sf.version, 1);
    assert.equal(sf.agentId, 'product.copilot');
    assert.equal(sf.mode, 'stream');
    assert.equal(sf.grant, 'signed-grant-string');
    assert.equal(sf.temperature, 0.2);

    // Instructions: exactly one system message, non-empty.
    const systemMessages = sf.messages.filter((m) => m.role === 'system');
    assert.equal(systemMessages.length, 1, 'exactly one system/instructions message');
    assert.ok(
      (systemMessages[0] as { content: string }).content.length > 0,
      'instructions content is non-empty',
    );

    // The user message is carried through.
    const userMessages = sf.messages.filter((m) => m.role === 'user');
    assert.equal(userMessages.length, 1);
    assert.ok(
      (userMessages[0] as { content: string }).content.includes('Change the title to Hello'),
      'user message text is preserved in the context prompt',
    );

    // The apply_widget_ops tool is declared exactly once.
    assert.equal(sf.tools.length, 1);
    assert.equal(sf.tools[0].name, APPLY_WIDGET_OPS_TOOL.name);

    // No stray tool / tool-call messages on a text-only turn.
    assert.equal(countMessages(sf.messages, 'tool'), 0);
    assert.equal(
      sf.messages.filter((m) => m.role === 'assistant').length,
      0,
      'no assistant message on a text-only initial turn',
    );
  });
}

// ---------------------------------------------------------------------------
// 2. Full-loop: tool-call continuation (tool result carried once)
// ---------------------------------------------------------------------------

function testToolCallContinuationTurn(): void {
  console.log('\n--- 2. Full-loop: tool-call continuation turn ---');

  assertPass('tool result appears exactly once; history tool call appears once', () => {
    // Continuation where the prior tool call lives in history (unanswered —
    // its result is supplied only via the top-level toolResult field, which is
    // the shape the failure path in Bob produces).
    let history = emptyCopilotModelHistory();
    history = appendUserMessage(history, 'Set the title to Hello');
    history = appendToolCall(history, {
      toolCallId: 'call-1',
      toolName: 'apply_widget_ops',
      input: { ops: [{ op: 'set', path: 'title', value: 'Hello' }] },
    });
    const turnRequest: CopilotTurnRequest = {
      version: 1,
      kind: 'continuation',
      sessionId: 'session-1',
      userTurnId: 'turn-1',
      priorModelStepId: 'step-1',
      toolCallId: 'call-1',
      toolName: 'apply_widget_ops',
      toolResult: { ok: true, changedPaths: ['title'] },
      conversationHistory: toWireHistory(history),
      currentDraftContext: makeDraftContext(),
    };

    const sf = buildSf({ turnRequest });

    // The tool RESULT must appear exactly once for call-1.
    assert.equal(
      countMessages(sf.messages, 'tool', 'call-1'),
      1,
      'tool result for call-1 appears exactly once (not duplicated)',
    );

    // The conversation-history tool CALL must appear exactly once.
    const assistantToolCalls = sf.messages.filter(
      (m) => m.role === 'assistant' && m.content === null && m.toolCallId === 'call-1',
    );
    assert.equal(assistantToolCalls.length, 1, 'history tool call appears exactly once');
  });
}

// ---------------------------------------------------------------------------
// 3. Continuation coordinates: user text + assistant tool-call + tool result
// ---------------------------------------------------------------------------

function testContinuationCoordinates(): void {
  console.log('\n--- 3. Continuation coordinates ---');

  assertPass('user text, assistant tool-call, tool-result each exactly once', () => {
    let history = emptyCopilotModelHistory();
    history = appendUserMessage(history, 'Make the title uppercase');
    history = appendToolCall(history, {
      toolCallId: 'call-1',
      toolName: 'apply_widget_ops',
      input: { ops: [{ op: 'set', path: 'title', value: 'HELLO' }] },
    });
    const turnRequest: CopilotTurnRequest = {
      version: 1,
      kind: 'continuation',
      sessionId: 'session-1',
      userTurnId: 'turn-1',
      priorModelStepId: 'step-1',
      toolCallId: 'call-1',
      toolName: 'apply_widget_ops',
      toolResult: { ok: true, changedPaths: ['title'] },
      conversationHistory: toWireHistory(history),
      currentDraftContext: makeDraftContext(),
    };

    const sf = buildSf({ turnRequest });

    // User text from history: exactly once.
    assert.equal(countMessages(sf.messages, 'user'), 1);
    // Assistant tool-call: exactly once.
    assert.equal(
      sf.messages.filter((m) => m.role === 'assistant' && m.content === null && m.toolCallId === 'call-1').length,
      1,
    );
    // Tool result: exactly once.
    assert.equal(countMessages(sf.messages, 'tool', 'call-1'), 1);

    // And the tool result must follow the tool call (provider ordering rule).
    const callIdx = sf.messages.findIndex(
      (m) => m.role === 'assistant' && m.content === null && m.toolCallId === 'call-1',
    );
    const resultIdx = sf.messages.findIndex((m) => m.role === 'tool' && m.toolCallId === 'call-1');
    assert.ok(callIdx !== -1 && resultIdx !== -1, 'both call and result present');
    assert.ok(resultIdx > callIdx, 'tool result comes after the tool call');
  });
}

// ---------------------------------------------------------------------------
// 4. Round-trip: history already carries the result — no duplication
// ---------------------------------------------------------------------------

function testNoDuplicationWhenHistoryCarriesResult(): void {
  console.log('\n--- 4. Round-trip: no duplication when history carries the result ---');

  assertPass('history tool result is not duplicated by the top-level toolResult field', () => {
    // This is the exact shape Bob's SUCCESS path produces (CopilotPane.tsx):
    // appendToolCall + appendToolResult attach the result to the SAME history
    // entry, AND sendContinuation passes the same result as the top-level
    // toolResult. The SF request must still contain the result exactly once.
    const sharedResult = { ok: true, changedPaths: ['title'] };
    let history = emptyCopilotModelHistory();
    history = appendUserMessage(history, 'edit the title');
    history = appendToolCall(history, {
      toolCallId: 'call-1',
      toolName: 'apply_widget_ops',
      input: { ops: [{ op: 'set', path: 'title', value: 'Hello' }] },
    });
    history = appendToolResult(history, 'call-1', sharedResult);
    const turnRequest: CopilotTurnRequest = {
      version: 1,
      kind: 'continuation',
      sessionId: 'session-1',
      userTurnId: 'turn-1',
      priorModelStepId: 'step-1',
      toolCallId: 'call-1',
      toolName: 'apply_widget_ops',
      toolResult: sharedResult,
      conversationHistory: toWireHistory(history),
      currentDraftContext: makeDraftContext(),
    };

    const sf = buildSf({ turnRequest });

    // The result must appear exactly once for call-1, sourced from the history
    // entry and NOT duplicated by the top-level continuation field.
    const toolResultsForCall1 = sf.messages.filter(
      (m) => m.role === 'tool' && m.toolCallId === 'call-1',
    );
    assert.equal(
      toolResultsForCall1.length,
      1,
      'tool result for call-1 must appear exactly once (history + top-level must not duplicate)',
    );
    assert.deepEqual(
      (toolResultsForCall1[0] as { result: unknown }).result,
      sharedResult,
      'the surviving result is the shared result value',
    );

    // The assistant tool call itself is also not duplicated.
    assert.equal(
      sf.messages.filter((m) => m.role === 'assistant' && m.content === null && m.toolCallId === 'call-1').length,
      1,
      'assistant tool call appears exactly once',
    );
  });
}

// ---------------------------------------------------------------------------
// 5. Wire bounds in the loop: toWireHistory trims to 8 and feeds the SF builder
// ---------------------------------------------------------------------------

function testWireBoundsInTheLoop(): void {
  console.log('\n--- 5. Wire bounds in the loop ---');

  assertPass('toWireHistory trims 12 entries to 8 keeping the tail', () => {
    let h = emptyCopilotModelHistory();
    for (let i = 0; i < 12; i++) {
      h = appendUserMessage(h, `msg ${i}`);
    }
    const wire = toWireHistory(h);
    assert.equal(wire.length, MAX_CONVERSATION_HISTORY_MESSAGES);
    assert.ok('text' in wire[0]);
    assert.ok('text' in wire[7]);
    assert.equal(wire[0].text, 'msg 4', 'oldest tail entry is msg 4');
    assert.equal(wire[7].text, 'msg 11', 'newest entry is msg 11');
  });

  assertPass('trimmed wire history round-trips through the SF request builder', () => {
    let h = emptyCopilotModelHistory();
    for (let i = 0; i < 12; i++) {
      h = appendUserMessage(h, `msg ${i}`);
    }
    const wire = toWireHistory(h);

    const turnRequest: CopilotTurnRequest = {
      version: 1,
      kind: 'initial',
      sessionId: 'session-1',
      userTurnId: 'turn-1',
      userMessage: 'next instruction',
      conversationHistory: wire,
      currentDraftContext: makeDraftContext(),
    };

    const sf = buildSf({ turnRequest });

    // 1 system + 8 trimmed history users + 1 user (context prompt) = 10 total.
    assert.equal(sf.messages.length, 1 + MAX_CONVERSATION_HISTORY_MESSAGES + 1);
    // The most recent trimmed entry survives immediately before the new prompt.
    const userMessages = sf.messages.filter((m) => m.role === 'user');
    assert.equal(userMessages.length, MAX_CONVERSATION_HISTORY_MESSAGES + 1);
    assert.equal(
      (userMessages[userMessages.length - 2] as { content: string }).content,
      'msg 11',
      'tail entry preserved just before the new turn prompt',
    );
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  console.log('=== PRD 128 Phase 7 — Full-Loop Integration Regression Tests ===');
  testTextOnlyInitialTurn();
  testToolCallContinuationTurn();
  testContinuationCoordinates();
  testNoDuplicationWhenHistoryCarriesResult();
  testWireBoundsInTheLoop();
  console.log('\n=== All Phase 7 full-loop integration tests passed ===');
}

run().then(
  () => { console.log('\nDone.'); },
  (err) => {
    console.error('\nTEST FAILURE:', err);
    process.exitCode = 1;
  },
);
