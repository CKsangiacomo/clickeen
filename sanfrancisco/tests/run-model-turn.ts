/**
 * PRD 128B — Model-turn focused tests.
 *
 * Tests the pure functions (type guards, message conversion, tool conversion,
 * error mapping) without API calls. Real API integration was proven by Step 0.
 *
 * Run: pnpm test:model-turn
 */

import assert from 'node:assert/strict';
import { HttpError } from '../src/http';
import {
  isModelTurnRequest,
  isModelTurnStreamRequest,
  isModelTurnStructuredRequest,
} from '../src/ai/model-turn-types';
import {
  convertMessages,
  convertTools,
  mapToErrorData,
} from '../src/ai/model-turn';

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

function assertFail(label: string, fn: () => void) {
  try {
    fn();
    console.error(`  ❌ ${label} — expected throw but did not`);
    throw new Error(`Expected throw: ${label}`);
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Expected throw')) throw err;
    console.log(`  ✅ ${label} (correctly rejected)`);
  }
}

// ---------------------------------------------------------------------------
// Type guard tests
// ---------------------------------------------------------------------------

function testTypeGuards(): void {
  console.log('\n--- Type Guards ---');

  const validBase = {
    version: 1,
    agentId: 'product.copilot',
    grant: 'signed-grant-string',
    messages: [{ role: 'user', content: 'Hello' }],
  };

  // Valid stream request
  assertPass('valid stream request', () => {
    assert.ok(isModelTurnStreamRequest({ ...validBase, mode: 'stream' }));
  });

  // Valid structured request
  assertPass('valid structured request', () => {
    assert.ok(
      isModelTurnStructuredRequest({
        ...validBase,
        mode: 'structured',
        output: { schema: { type: 'object', properties: {} } },
      }),
    );
  });

  // isModelTurnRequest accepts both
  assertPass('isModelTurnRequest accepts stream', () => {
    assert.ok(isModelTurnRequest({ ...validBase, mode: 'stream' }));
  });

  assertPass('isModelTurnRequest accepts structured', () => {
    assert.ok(
      isModelTurnRequest({
        ...validBase,
        mode: 'structured',
        output: { schema: { type: 'object', properties: {} } },
      }),
    );
  });

  // Invalid: wrong version
  assertPass('reject version !== 1', () => {
    assert.ok(!isModelTurnRequest({ ...validBase, mode: 'stream', version: 2 }));
  });

  // Invalid: missing agentId
  assertPass('reject missing agentId', () => {
    const { agentId, ...rest } = validBase;
    assert.ok(!isModelTurnRequest({ ...rest, mode: 'stream' }));
  });

  // Invalid: missing grant
  assertPass('reject missing grant', () => {
    const { grant, ...rest } = validBase;
    assert.ok(!isModelTurnRequest({ ...rest, mode: 'stream' }));
  });

  // Invalid: empty messages
  assertPass('reject empty messages', () => {
    assert.ok(!isModelTurnRequest({ ...validBase, mode: 'stream', messages: [] }));
  });

  // Invalid: invalid mode
  assertPass('reject invalid mode', () => {
    assert.ok(!isModelTurnRequest({ ...validBase, mode: 'bogus' }));
  });

  // Invalid: structured without output
  assertPass('reject structured without output', () => {
    assert.ok(!isModelTurnStructuredRequest({ ...validBase, mode: 'structured' }));
  });

  // Valid with system message
  assertPass('accept system message in messages', () => {
    assert.ok(
      isModelTurnRequest({
        ...validBase,
        mode: 'stream',
        messages: [
          { role: 'system', content: 'You are a widget editor.' },
          { role: 'user', content: 'Edit the title.' },
        ],
      }),
    );
  });

  // Valid with tool messages
  assertPass('accept tool-call and tool-result messages', () => {
    assert.ok(
      isModelTurnRequest({
        ...validBase,
        mode: 'stream',
        messages: [
          { role: 'user', content: 'Set title to Hello' },
          { role: 'assistant', content: null, toolCallId: 'call_1', toolName: 'apply_widget_ops', input: { ops: [] } },
          { role: 'tool', toolCallId: 'call_1', toolName: 'apply_widget_ops', result: { ok: true, changedPaths: ['title'] } },
        ],
      }),
    );
  });

  // Valid with tools
  assertPass('accept tool definitions', () => {
    assert.ok(
      isModelTurnRequest({
        ...validBase,
        mode: 'stream',
        tools: [{
          name: 'apply_widget_ops',
          description: 'Apply widget operations',
          inputSchema: { type: 'object', properties: { ops: { type: 'array' } } },
        }],
      }),
    );
  });
}

// ---------------------------------------------------------------------------
// Message conversion tests
// ---------------------------------------------------------------------------

function testConvertMessages(): void {
  console.log('\n--- Message Conversion ---');

  assertPass('extract system message as instructions', () => {
    const result = convertMessages([
      { role: 'system', content: 'You are a widget editor.' },
      { role: 'user', content: 'Edit the title.' },
    ]);
    assert.equal(result.instructions, 'You are a widget editor.');
    assert.equal(result.messages.length, 1);
    assert.equal(result.messages[0].role, 'user');
  });

  assertPass('join multiple system messages', () => {
    const result = convertMessages([
      { role: 'system', content: 'Line 1.' },
      { role: 'system', content: 'Line 2.' },
      { role: 'user', content: 'Go.' },
    ]);
    assert.equal(result.instructions, 'Line 1.\nLine 2.');
  });

  assertPass('no system messages → no instructions', () => {
    const result = convertMessages([{ role: 'user', content: 'Hello' }]);
    assert.ok(!result.instructions);
  });

  assertPass('convert assistant tool-call message', () => {
    const result = convertMessages([
      { role: 'user', content: 'Edit title' },
      { role: 'assistant', content: null, toolCallId: 'call_1', toolName: 'apply_widget_ops', input: { ops: [{ op: 'set', path: 'title', value: 'Hello' }] } },
    ]);
    assert.equal(result.messages.length, 2);
    assert.equal(result.messages[1].role, 'assistant');
    assert.ok(Array.isArray(result.messages[1].content));
  });

  assertPass('convert tool-result message', () => {
    const result = convertMessages([
      { role: 'user', content: 'Edit title' },
      { role: 'assistant', content: null, toolCallId: 'call_1', toolName: 'apply_widget_ops', input: {} },
      { role: 'tool', toolCallId: 'call_1', toolName: 'apply_widget_ops', result: { ok: true, changedPaths: ['title'] } },
    ]);
    assert.equal(result.messages.length, 3);
    assert.equal(result.messages[2].role, 'tool');
    assert.ok(Array.isArray(result.messages[2].content));
  });

  assertPass('assistant text message passes through', () => {
    const result = convertMessages([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there.' },
    ]);
    assert.equal(result.messages[1].role, 'assistant');
    assert.equal(typeof result.messages[1].content, 'string');
  });
}

// ---------------------------------------------------------------------------
// Tool conversion tests
// ---------------------------------------------------------------------------

function testConvertTools(): void {
  console.log('\n--- Tool Conversion ---');

  assertPass('undefined tools → undefined', () => {
    assert.equal(convertTools(undefined), undefined);
  });

  assertPass('empty tools array → undefined', () => {
    assert.equal(convertTools([]), undefined);
  });

  assertPass('one tool → correct format', () => {
    const result = convertTools([{
      name: 'apply_widget_ops',
      description: 'Apply widget operations',
      inputSchema: { type: 'object', properties: { ops: { type: 'array' } }, required: ['ops'] },
    }]);
    assert.ok(result);
    assert.ok(result!['apply_widget_ops']);
    assert.equal(result!['apply_widget_ops'].description, 'Apply widget operations');
    assert.ok(result!['apply_widget_ops'].inputSchema);
  });

  assertPass('multiple tools → all present', () => {
    const result = convertTools([
      { name: 'tool_a', description: 'A', inputSchema: { type: 'object' } },
      { name: 'tool_b', description: 'B', inputSchema: { type: 'object' } },
    ]);
    assert.ok(result!['tool_a']);
    assert.ok(result!['tool_b']);
  });
}

// ---------------------------------------------------------------------------
// Error mapping tests
// ---------------------------------------------------------------------------

function testMapToErrorData(): void {
  console.log('\n--- Error Mapping ---');

  assertPass('HttpError → correct code and message', () => {
    const err = new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'openai', message: 'Upstream error' });
    const result = mapToErrorData(err, 'req_123');
    assert.equal(result.code, 'PROVIDER_ERROR');
    assert.equal(result.provider, 'openai');
    assert.equal(result.message, 'Upstream error');
    assert.equal(result.requestId, 'req_123');
  });

  assertPass('HttpError with upstreamStatus', () => {
    const err = new HttpError(502, { code: 'PROVIDER_ERROR', provider: 'deepseek', message: 'Error', upstreamStatus: 500 });
    const result = mapToErrorData(err);
    assert.equal(result.upstreamStatus, 500);
  });

  assertPass('grant HttpError → correct code', () => {
    const err = new HttpError(401, { code: 'GRANT_INVALID', message: 'Bad grant' });
    const result = mapToErrorData(err);
    assert.equal(result.code, 'GRANT_INVALID');
  });

  assertPass('AbortError → BUDGET_EXCEEDED', () => {
    const err = new Error('Aborted');
    err.name = 'AbortError';
    const result = mapToErrorData(err);
    assert.equal(result.code, 'BUDGET_EXCEEDED');
    assert.equal(result.message, 'Execution timeout exceeded');
  });

  assertPass('AI SDK error → PROVIDER_ERROR', () => {
    const err = new Error('API call failed');
    err.name = 'AI_APICallError';
    const result = mapToErrorData(err);
    assert.equal(result.code, 'PROVIDER_ERROR');
  });

  assertPass('generic Error → PROVIDER_ERROR', () => {
    const err = new Error('Something went wrong');
    const result = mapToErrorData(err);
    assert.equal(result.code, 'PROVIDER_ERROR');
  });

  assertPass('non-Error → PROVIDER_ERROR', () => {
    const result = mapToErrorData('just a string');
    assert.equal(result.code, 'PROVIDER_ERROR');
    assert.equal(result.message, 'Unhandled model execution error');
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  console.log('=== PRD 128B Model-Turn Tests ===');
  testTypeGuards();
  testConvertMessages();
  testConvertTools();
  testMapToErrorData();
  console.log('\n=== All model-turn tests passed ===');
}

run().then(
  () => { console.log('\nDone.'); },
  (err) => {
    console.error('\nTEST FAILURE:', err);
    process.exitCode = 1;
  },
);
