/**
 * PRD 128 Phase 1 gate tests — shared contracts.
 *
 * Tests the ProductCopilotTurnEvent type guard and the CopilotTurnRequest
 * parser against their Phase 1 gates.
 *
 * Run: cd packages/ck-contracts && npx tsx tests/run-copilot-contracts.ts
 */

import assert from 'node:assert/strict';
import {
  isProductCopilotTurnEvent,
  parseCopilotTurnRequest,
  COPILOT_MAX_HISTORY_ENTRIES,
} from '../src/ai';

function assertPass(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${label}`);
  } catch (err) {
    console.error(`  ❌ ${label}`);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Phase 1.1 — ProductCopilotTurnEvent type guard
// ---------------------------------------------------------------------------

function testTypeGuard() {
  console.log('\n--- Type Guard: all 7 event types pass ---');

  assertPass('agent_turn_started passes', () => {
    assert.ok(isProductCopilotTurnEvent({
      version: 1, userTurnId: 'turn-1', type: 'agent_turn_started', data: {},
    }));
  });

  assertPass('text_delta with modelStepId passes', () => {
    assert.ok(isProductCopilotTurnEvent({
      version: 1, userTurnId: 'turn-1', modelStepId: 'step-1', type: 'text_delta', data: { text: 'hello' },
    }));
  });

  assertPass('tool_call with modelStepId passes', () => {
    assert.ok(isProductCopilotTurnEvent({
      version: 1, userTurnId: 'turn-1', modelStepId: 'step-1', type: 'tool_call',
      data: { toolCallId: 'call-1', toolName: 'apply_widget_ops', input: {} },
    }));
  });

  assertPass('model_step_finished with modelStepId passes', () => {
    assert.ok(isProductCopilotTurnEvent({
      version: 1, userTurnId: 'turn-1', modelStepId: 'step-1', type: 'model_step_finished',
      data: {
        finishReason: 'stop', requestedProvider: 'openai', requestedModel: 'gpt-5.2',
        reportedModel: 'gpt-5.2-2025-12-11', promptTokens: 10, completionTokens: 5, latencyMs: 100,
      },
    }));
  });

  assertPass('agent_turn_finished passes', () => {
    assert.ok(isProductCopilotTurnEvent({
      version: 1, userTurnId: 'turn-1', type: 'agent_turn_finished', data: {},
    }));
  });

  assertPass('agent_turn_error passes', () => {
    assert.ok(isProductCopilotTurnEvent({
      version: 1, userTurnId: 'turn-1', type: 'agent_turn_error',
      data: { code: 'PROVIDER_ERROR', reasonKey: 'PROVIDER_ERROR', message: 'fail' },
    }));
  });

  assertPass('agent_turn_stopped passes', () => {
    assert.ok(isProductCopilotTurnEvent({
      version: 1, userTurnId: 'turn-1', type: 'agent_turn_stopped', data: {},
    }));
  });

  console.log('\n--- Type Guard: rejection cases ---');

  assertPass('rejects missing modelStepId on text_delta', () => {
    assert.ok(!isProductCopilotTurnEvent({
      version: 1, userTurnId: 'turn-1', type: 'text_delta', data: { text: 'hello' },
    }));
  });

  assertPass('rejects missing modelStepId on tool_call', () => {
    assert.ok(!isProductCopilotTurnEvent({
      version: 1, userTurnId: 'turn-1', type: 'tool_call',
      data: { toolCallId: 'call-1', toolName: 'apply_widget_ops', input: {} },
    }));
  });

  assertPass('rejects missing modelStepId on model_step_finished', () => {
    assert.ok(!isProductCopilotTurnEvent({
      version: 1, userTurnId: 'turn-1', type: 'model_step_finished',
      data: {
        finishReason: 'stop', requestedProvider: 'openai', requestedModel: 'gpt-5.2',
        reportedModel: 'gpt-5.2', promptTokens: 10, completionTokens: 5, latencyMs: 100,
      },
    }));
  });

  assertPass('rejects unknown event type', () => {
    assert.ok(!isProductCopilotTurnEvent({
      version: 1, userTurnId: 'turn-1', modelStepId: 'step-1', type: 'bogus_event', data: {},
    }));
  });

  assertPass('rejects wrong version', () => {
    assert.ok(!isProductCopilotTurnEvent({
      version: 2, userTurnId: 'turn-1', modelStepId: 'step-1', type: 'text_delta', data: { text: 'hi' },
    }));
  });

  assertPass('rejects missing userTurnId', () => {
    assert.ok(!isProductCopilotTurnEvent({
      version: 1, modelStepId: 'step-1', type: 'text_delta', data: { text: 'hi' },
    }));
  });

  assertPass('rejects non-object', () => {
    assert.ok(!isProductCopilotTurnEvent('string'));
    assert.ok(!isProductCopilotTurnEvent(null));
    assert.ok(!isProductCopilotTurnEvent(42));
  });

  assertPass('rejects empty modelStepId string', () => {
    assert.ok(!isProductCopilotTurnEvent({
      version: 1, userTurnId: 'turn-1', modelStepId: '', type: 'text_delta', data: { text: 'hi' },
    }));
  });

  assertPass('rejects text_delta without text in data', () => {
    assert.ok(!isProductCopilotTurnEvent({
      version: 1, userTurnId: 'turn-1', modelStepId: 'step-1', type: 'text_delta', data: {},
    }));
  });

  assertPass('rejects tool_call without toolCallId in data', () => {
    assert.ok(!isProductCopilotTurnEvent({
      version: 1, userTurnId: 'turn-1', modelStepId: 'step-1', type: 'tool_call',
      data: { toolName: 'apply_widget_ops', input: {} },
    }));
  });

  assertPass('rejects model_step_finished with empty reportedModel', () => {
    assert.ok(!isProductCopilotTurnEvent({
      version: 1, userTurnId: 'turn-1', modelStepId: 'step-1', type: 'model_step_finished',
      data: {
        finishReason: 'stop', requestedProvider: 'openai', requestedModel: 'gpt-5.2',
        reportedModel: '', promptTokens: 10, completionTokens: 5, latencyMs: 100,
      },
    }));
  });
}

// ---------------------------------------------------------------------------
// Phase 1.2 — CopilotTurnRequest parser
// ---------------------------------------------------------------------------

function validInitialRequest() {
  return {
    version: 1,
    kind: 'initial',
    sessionId: 'session-1',
    userTurnId: 'turn-1',
    userMessage: 'Change the title to Hello',
    conversationHistory: [
      { role: 'user', text: 'previous question' },
      { role: 'assistant', text: 'previous answer' },
    ],
    currentDraftContext: {
      instanceId: 'inst-1',
      widgetType: 'bigbang',
      displayName: 'Big Bang',
      activeLocale: 'en',
      draftSignature: 'sig-1',
      controls: [],
      availableActions: ['draft_edit'],
      unavailableCapabilities: ['publish'],
    },
  };
}

function validContinuationRequest() {
  return {
    version: 1,
    kind: 'continuation',
    sessionId: 'session-1',
    userTurnId: 'turn-1',
    priorModelStepId: 'step-1',
    toolCallId: 'call-1',
    toolName: 'apply_widget_ops',
    toolResult: { ok: true, changedPaths: ['title'] },
    conversationHistory: [],
    currentDraftContext: {
      instanceId: 'inst-1',
      widgetType: 'bigbang',
      displayName: 'Big Bang',
      activeLocale: 'en',
      draftSignature: 'sig-2',
      controls: [],
      availableActions: ['draft_edit'],
      unavailableCapabilities: [],
    },
  };
}

function testParser() {
  console.log('\n--- Parser: accepts valid requests ---');

  assertPass('valid initial request passes', () => {
    const result = parseCopilotTurnRequest(validInitialRequest());
    assert.ok(result.ok);
    if (result.ok) {
      assert.equal(result.request.kind, 'initial');
      assert.equal(result.request.userMessage, 'Change the title to Hello');
    }
  });

  assertPass('valid continuation request passes', () => {
    const result = parseCopilotTurnRequest(validContinuationRequest());
    assert.ok(result.ok);
    if (result.ok) {
      assert.equal(result.request.kind, 'continuation');
      if (result.request.kind === 'continuation') {
        assert.equal(result.request.priorModelStepId, 'step-1');
        assert.equal(result.request.toolCallId, 'call-1');
        assert.equal(result.request.toolName, 'apply_widget_ops');
      }
    }
  });

  assertPass('valid initial with routeInstanceId passes when instance matches', () => {
    const result = parseCopilotTurnRequest(validInitialRequest(), { routeInstanceId: 'inst-1' });
    assert.ok(result.ok);
  });

  console.log('\n--- Parser: rejection cases ---');

  assertPass('rejects wrong version', () => {
    const req = { ...validInitialRequest(), version: 2 };
    const result = parseCopilotTurnRequest(req);
    assert.ok(!result.ok);
  });

  assertPass('rejects invalid kind', () => {
    const req = { ...validInitialRequest(), kind: 'garbage' };
    const result = parseCopilotTurnRequest(req);
    assert.ok(!result.ok);
  });

  assertPass('rejects missing sessionId', () => {
    const { sessionId, ...req } = validInitialRequest();
    const result = parseCopilotTurnRequest(req);
    assert.ok(!result.ok);
  });

  assertPass('rejects missing userTurnId', () => {
    const { userTurnId, ...req } = validInitialRequest();
    const result = parseCopilotTurnRequest(req);
    assert.ok(!result.ok);
  });

  assertPass('rejects initial without userMessage', () => {
    const { userMessage, ...req } = validInitialRequest();
    const result = parseCopilotTurnRequest(req);
    assert.ok(!result.ok);
  });

  assertPass('rejects continuation without priorModelStepId', () => {
    const { priorModelStepId, ...req } = validContinuationRequest();
    const result = parseCopilotTurnRequest(req);
    assert.ok(!result.ok);
  });

  assertPass('rejects continuation without toolCallId', () => {
    const { toolCallId, ...req } = validContinuationRequest();
    const result = parseCopilotTurnRequest(req);
    assert.ok(!result.ok);
  });

  assertPass('rejects continuation without toolResult', () => {
    const { toolResult, ...req } = validContinuationRequest();
    const result = parseCopilotTurnRequest(req);
    assert.ok(!result.ok);
  });

  assertPass('rejects continuation with wrong toolName', () => {
    const req = { ...validContinuationRequest(), toolName: 'bogus_tool' };
    const result = parseCopilotTurnRequest(req);
    assert.ok(!result.ok);
  });

  assertPass('rejects oversized conversation history', () => {
    const entries = Array.from({ length: COPILOT_MAX_HISTORY_ENTRIES + 1 }, (_, i) => ({
      role: 'user',
      text: `message ${i}`,
    }));
    const req = { ...validInitialRequest(), conversationHistory: entries };
    const result = parseCopilotTurnRequest(req);
    assert.ok(!result.ok);
  });

  assertPass('rejects malformed history entry (bad role)', () => {
    const req = {
      ...validInitialRequest(),
      conversationHistory: [{ role: 'system', text: 'not allowed' }],
    };
    const result = parseCopilotTurnRequest(req);
    assert.ok(!result.ok);
  });

  assertPass('rejects missing draft context', () => {
    const { currentDraftContext, ...req } = validInitialRequest();
    const result = parseCopilotTurnRequest(req);
    assert.ok(!result.ok);
  });

  assertPass('rejects context instance mismatch with route', () => {
    const result = parseCopilotTurnRequest(validInitialRequest(), { routeInstanceId: 'different-instance' });
    assert.ok(!result.ok);
  });

  assertPass('rejects non-object request', () => {
    const result = parseCopilotTurnRequest('string');
    assert.ok(!result.ok);
    const result2 = parseCopilotTurnRequest(null);
    assert.ok(!result2.ok);
  });

  assertPass('rejects malformed selectedModel', () => {
    const req = { ...validInitialRequest(), selectedModel: { provider: '' } };
    const result = parseCopilotTurnRequest(req);
    assert.ok(!result.ok);
  });

  assertPass('accepts valid selectedModel', () => {
    const req = { ...validInitialRequest(), selectedModel: { provider: 'openai', model: 'gpt-5.2' } };
    const result = parseCopilotTurnRequest(req);
    assert.ok(result.ok);
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  console.log('=== PRD 128 Phase 1 Gate Tests — Shared Contracts ===');
  testTypeGuard();
  testParser();
  console.log('\n=== All Phase 1 gate tests passed ===');
}

run().then(
  () => { console.log('\nDone.'); },
  (err) => {
    console.error('\nTEST FAILURE:', err);
    process.exitCode = 1;
  },
);
