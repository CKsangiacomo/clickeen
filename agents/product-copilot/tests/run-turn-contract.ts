/**
 * PRD 128 Phase 2 gate tests — PC Worker stream contract.
 *
 * Tests createAgentEventStream against mocked San Francisco SSE responses.
 * Covers: modelStepId preservation, tool-calls boundary, start-only-on-initial,
 * multiple tool calls rejected, hardened parser (malformed events fail visibly),
 * event-name/payload agreement.
 *
 * Run: cd agents/product-copilot && npx tsx tests/run-turn-contract.ts
 */

import assert from 'node:assert/strict';
import { createAgentEventStream } from '../src/worker';

function assertPass(label: string, fn: () => Promise<void>) {
  return fn().then(
    () => { console.log(`  ✅ ${label}`); },
    (err) => {
      console.error(`  ❌ ${label}`);
      throw err;
    },
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sseFrame(type: string, data: unknown): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

function sfResponse(events: string[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      for (const event of events) {
        controller.enqueue(encoder.encode(event));
      }
      controller.close();
    },
  });
  return new Response(body, { headers: { 'content-type': 'text/event-stream' } });
}

async function readAgentEvents(stream: ReadableStream<Uint8Array>): Promise<Array<{ type: string; payload: Record<string, unknown> }>> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const events: Array<{ type: string; payload: Record<string, unknown> }> = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const raw = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let type = '';
      let payload: Record<string, unknown> | null = null;
      for (const line of raw.split('\n')) {
        if (line.startsWith('event: ')) type = line.slice(7).trim();
        if (line.startsWith('data: ')) {
          try { payload = JSON.parse(line.slice(6)); } catch { /* skip */ }
        }
      }
      if (type && payload) events.push({ type, payload });
    }
  }
  return events;
}

const ARGS = { userTurnId: 'turn-1', requestId: 'req-1', isInitial: true };
const ARGS_CONT = { userTurnId: 'turn-1', requestId: 'req-1', isInitial: false };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function testTextOnlyTurn() {
  await assertPass('text-only turn: started + text_delta + finished(stop) + agent_turn_finished', async () => {
    const sf = sfResponse([
      sseFrame('text_delta', { version: 1, modelStepId: 'step-1', type: 'text_delta', data: { text: 'Hello' } }),
      sseFrame('model_step_finished', {
        version: 1, modelStepId: 'step-1', type: 'model_step_finished',
        data: { finishReason: 'stop', requestedProvider: 'openai', requestedModel: 'gpt-5.2', reportedModel: 'gpt-5.2-2025-12-11', promptTokens: 10, completionTokens: 5, latencyMs: 100 },
      }),
    ]);
    const events = await readAgentEvents(createAgentEventStream({ ...ARGS, sanFranciscoResponse: sf }));

    assert.equal(events[0].type, 'agent_turn_started');
    assert.equal(events[1].type, 'text_delta');
    assert.equal(events[1].payload.modelStepId, 'step-1');
    assert.equal((events[1].payload.data as Record<string, unknown>)?.text, 'Hello');
    assert.equal(events[2].type, 'model_step_finished');
    assert.equal(events[2].payload.modelStepId, 'step-1');
    assert.equal(events[3].type, 'agent_turn_finished');
    assert.equal(events.length, 4);
  });
}

async function testToolCallBoundary() {
  await assertPass('tool-calls finish: NO terminal agent event, NO error', async () => {
    const sf = sfResponse([
      sseFrame('text_delta', { version: 1, modelStepId: 'step-1', type: 'text_delta', data: { text: 'Let me edit...' } }),
      sseFrame('tool_call', { version: 1, modelStepId: 'step-1', type: 'tool_call', data: { toolCallId: 'call-1', toolName: 'apply_widget_ops', input: { ops: [] } } }),
      sseFrame('model_step_finished', {
        version: 1, modelStepId: 'step-1', type: 'model_step_finished',
        data: { finishReason: 'tool-calls', requestedProvider: 'openai', requestedModel: 'gpt-5.2', reportedModel: 'gpt-5.2', promptTokens: 20, completionTokens: 10, latencyMs: 200 },
      }),
    ]);
    const events = await readAgentEvents(createAgentEventStream({ ...ARGS, sanFranciscoResponse: sf }));

    // Should have: started, text_delta, tool_call, model_step_finished — NO agent terminal
    const types = events.map(e => e.type);
    assert.ok(types.includes('agent_turn_started'));
    assert.ok(types.includes('text_delta'));
    assert.ok(types.includes('tool_call'));
    assert.ok(types.includes('model_step_finished'));
    assert.ok(!types.includes('agent_turn_finished'), 'must NOT emit agent_turn_finished');
    assert.ok(!types.includes('agent_turn_error'), 'must NOT emit agent_turn_error');
    assert.equal(events.length, 4);
  });
}

async function testContinuationNoStart() {
  await assertPass('continuation: no agent_turn_started', async () => {
    const sf = sfResponse([
      sseFrame('text_delta', { version: 1, modelStepId: 'step-2', type: 'text_delta', data: { text: 'Done!' } }),
      sseFrame('model_step_finished', {
        version: 1, modelStepId: 'step-2', type: 'model_step_finished',
        data: { finishReason: 'stop', requestedProvider: 'openai', requestedModel: 'gpt-5.2', reportedModel: 'gpt-5.2', promptTokens: 5, completionTokens: 2, latencyMs: 50 },
      }),
    ]);
    const events = await readAgentEvents(createAgentEventStream({ ...ARGS_CONT, sanFranciscoResponse: sf }));

    const types = events.map(e => e.type);
    assert.ok(!types.includes('agent_turn_started'), 'continuation must NOT emit agent_turn_started');
    assert.ok(types.includes('agent_turn_finished'));
  });
}

async function testModelStepIdPreserved() {
  await assertPass('modelStepId preserved in forwarded events', async () => {
    const sf = sfResponse([
      sseFrame('text_delta', { version: 1, modelStepId: 'step-abc', type: 'text_delta', data: { text: 'x' } }),
      sseFrame('tool_call', { version: 1, modelStepId: 'step-abc', type: 'tool_call', data: { toolCallId: 'c1', toolName: 'apply_widget_ops', input: {} } }),
      sseFrame('model_step_finished', {
        version: 1, modelStepId: 'step-abc', type: 'model_step_finished',
        data: { finishReason: 'tool-calls', requestedProvider: 'openai', requestedModel: 'gpt-5.2', reportedModel: 'gpt-5.2', promptTokens: 1, completionTokens: 1, latencyMs: 1 },
      }),
    ]);
    const events = await readAgentEvents(createAgentEventStream({ ...ARGS, sanFranciscoResponse: sf }));

    for (const event of events) {
      if (event.type === 'text_delta' || event.type === 'tool_call' || event.type === 'model_step_finished') {
        assert.equal(event.payload.modelStepId, 'step-abc', `${event.type} must carry modelStepId`);
      }
    }
  });
}

async function testMultipleToolCallsRejected() {
  await assertPass('two tool calls in one step → agent_turn_error', async () => {
    const sf = sfResponse([
      sseFrame('tool_call', { version: 1, modelStepId: 'step-1', type: 'tool_call', data: { toolCallId: 'c1', toolName: 'apply_widget_ops', input: {} } }),
      sseFrame('tool_call', { version: 1, modelStepId: 'step-1', type: 'tool_call', data: { toolCallId: 'c2', toolName: 'apply_widget_ops', input: {} } }),
    ]);
    const events = await readAgentEvents(createAgentEventStream({ ...ARGS, sanFranciscoResponse: sf }));

    const types = events.map(e => e.type);
    assert.ok(types.includes('agent_turn_error'), 'must emit agent_turn_error on multiple tool calls');
    const errorEvent = events.find(e => e.type === 'agent_turn_error');
    assert.ok(String((errorEvent?.payload.data as Record<string, unknown>)?.message || '').includes('multiple tool calls'), 'error message must mention multiple tool calls');
  });
}

async function testLengthAsIncomplete() {
  await assertPass('finishReason length → agent_turn_error with BUDGET_EXCEEDED', async () => {
    const sf = sfResponse([
      sseFrame('model_step_finished', {
        version: 1, modelStepId: 'step-1', type: 'model_step_finished',
        data: { finishReason: 'length', requestedProvider: 'openai', requestedModel: 'gpt-5.2', reportedModel: 'gpt-5.2', promptTokens: 1, completionTokens: 1, latencyMs: 1 },
      }),
    ]);
    const events = await readAgentEvents(createAgentEventStream({ ...ARGS, sanFranciscoResponse: sf }));

    const errorEvent = events.find(e => e.type === 'agent_turn_error');
    assert.ok(errorEvent, 'must emit agent_turn_error for length');
    assert.equal((errorEvent?.payload.data as Record<string, unknown>)?.code, 'BUDGET_EXCEEDED');
    assert.ok(!events.some(e => e.type === 'agent_turn_finished'), 'must NOT emit agent_turn_finished for length');
  });
}

async function testContentFilterAsIncomplete() {
  await assertPass('finishReason content-filter → agent_turn_error with PROVIDER_ERROR', async () => {
    const sf = sfResponse([
      sseFrame('model_step_finished', {
        version: 1, modelStepId: 'step-1', type: 'model_step_finished',
        data: { finishReason: 'content-filter', requestedProvider: 'openai', requestedModel: 'gpt-5.2', reportedModel: 'gpt-5.2', promptTokens: 1, completionTokens: 1, latencyMs: 1 },
      }),
    ]);
    const events = await readAgentEvents(createAgentEventStream({ ...ARGS, sanFranciscoResponse: sf }));

    const errorEvent = events.find(e => e.type === 'agent_turn_error');
    assert.ok(errorEvent, 'must emit agent_turn_error for content-filter');
    assert.equal((errorEvent?.payload.data as Record<string, unknown>)?.code, 'PROVIDER_ERROR');
  });
}

async function testMalformedJsonFailsVisibly() {
  await assertPass('malformed SSE data JSON → agent_turn_error', async () => {
    const sf = sfResponse([
      'event: text_delta\ndata: {invalid json}\n\n',
    ]);
    const events = await readAgentEvents(createAgentEventStream({ ...ARGS, sanFranciscoResponse: sf }));

    const errorEvent = events.find(e => e.type === 'agent_turn_error');
    assert.ok(errorEvent, 'must emit agent_turn_error for malformed JSON');
    assert.ok(String((errorEvent?.payload.data as Record<string, unknown>)?.message || '').includes('Malformed'), 'error must mention malformed');
  });
}

async function testUnknownEventTypeFailsVisibly() {
  await assertPass('unknown event type → agent_turn_error', async () => {
    const sf = sfResponse([
      sseFrame('bogus_event', { version: 1, modelStepId: 'step-1', type: 'bogus_event', data: {} }),
    ]);
    const events = await readAgentEvents(createAgentEventStream({ ...ARGS, sanFranciscoResponse: sf }));

    const errorEvent = events.find(e => e.type === 'agent_turn_error');
    assert.ok(errorEvent, 'must emit agent_turn_error for unknown event type');
    assert.ok(String((errorEvent?.payload.data as Record<string, unknown>)?.message || '').includes('Unknown'), 'error must mention unknown');
  });
}

async function testNamePayloadMismatchFails() {
  await assertPass('SSE event name / payload type mismatch → agent_turn_error', async () => {
    const sf = sfResponse([
      sseFrame('text_delta', { version: 1, modelStepId: 'step-1', type: 'tool_call', data: { text: 'mismatch' } }),
    ]);
    const events = await readAgentEvents(createAgentEventStream({ ...ARGS, sanFranciscoResponse: sf }));

    const errorEvent = events.find(e => e.type === 'agent_turn_error');
    assert.ok(errorEvent, 'must emit agent_turn_error for name/payload mismatch');
    assert.ok(String((errorEvent?.payload.data as Record<string, unknown>)?.message || '').includes('does not match'), 'error must mention mismatch');
  });
}

async function testMissingModelStepIdFails() {
  await assertPass('SF event missing modelStepId → agent_turn_error', async () => {
    const sf = sfResponse([
      sseFrame('text_delta', { version: 1, type: 'text_delta', data: { text: 'no step id' } }),
    ]);
    const events = await readAgentEvents(createAgentEventStream({ ...ARGS, sanFranciscoResponse: sf }));

    const errorEvent = events.find(e => e.type === 'agent_turn_error');
    assert.ok(errorEvent, 'must emit agent_turn_error for missing modelStepId');
    assert.ok(String((errorEvent?.payload.data as Record<string, unknown>)?.message || '').includes('modelStepId'), 'error must mention modelStepId');
  });
}

async function testToolCountFinishConsistency() {
  await assertPass('finishReason stop but toolCallCount > 0 → agent_turn_error', async () => {
    const sf = sfResponse([
      sseFrame('tool_call', { version: 1, modelStepId: 'step-1', type: 'tool_call', data: { toolCallId: 'c1', toolName: 'apply_widget_ops', input: {} } }),
      sseFrame('model_step_finished', {
        version: 1, modelStepId: 'step-1', type: 'model_step_finished',
        data: { finishReason: 'stop', requestedProvider: 'openai', requestedModel: 'gpt-5.2', reportedModel: 'gpt-5.2', promptTokens: 1, completionTokens: 1, latencyMs: 1 },
      }),
    ]);
    const events = await readAgentEvents(createAgentEventStream({ ...ARGS, sanFranciscoResponse: sf }));

    const errorEvent = events.find(e => e.type === 'agent_turn_error');
    assert.ok(errorEvent, 'must emit agent_turn_error for inconsistent tool count');
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  console.log('=== PRD 128 Phase 2 Gate Tests — PC Worker Stream Contract ===');
  await testTextOnlyTurn();
  await testToolCallBoundary();
  await testContinuationNoStart();
  await testModelStepIdPreserved();
  await testMultipleToolCallsRejected();
  await testLengthAsIncomplete();
  await testContentFilterAsIncomplete();
  await testMalformedJsonFailsVisibly();
  await testUnknownEventTypeFailsVisibly();
  await testNamePayloadMismatchFails();
  await testMissingModelStepIdFails();
  await testToolCountFinishConsistency();
  console.log('\n=== All Phase 2 PC Worker gate tests passed ===');
}

run().then(
  () => { console.log('\nDone.'); },
  (err) => {
    console.error('\nTEST FAILURE:', err);
    process.exitCode = 1;
  },
);
