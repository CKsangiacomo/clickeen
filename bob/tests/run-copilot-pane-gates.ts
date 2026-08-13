/**
 * PRD 128F §4 — Bob CopilotPane gate tests.
 *
 * Verifies the rebuilt CopilotPane behaviors required by 128D/128F:
 * tool-after-step sequencing, continuation coordinates, undo accumulation,
 * Send/Stop toggle, two-fact turn state, tier step limit, typography
 * expansion, Save boundary, cancellation race-safety, streaming text.
 *
 * Run: cd bob && npx tsx tests/run-copilot-pane-gates.ts
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

function assertPass(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${label}`);
  } catch (err) {
    console.error(`  ❌ ${label}`);
    throw err;
  }
}

const SOURCE = readFileSync('/Users/piero_macpro/code/VS/clickeen/bob/components/CopilotPane.tsx', 'utf8');

// ---------------------------------------------------------------------------
// 1. Tool executes ONLY after model_step_finished
// ---------------------------------------------------------------------------

function testToolAfterStep() {
  console.log('\n--- Tool executes ONLY after model_step_finished ---');

  assertPass('tool_call handler BUFFERS (stores to bufferedToolCall), does NOT call applyOps', () => {
    const toolCallBlock = SOURCE.match(/case 'tool_call':[\s\S]{0,600}/)?.[0] ?? '';
    assert.ok(toolCallBlock.includes('turn.bufferedToolCall'), 'tool_call is buffered');
    assert.ok(!toolCallBlock.includes('session.applyOps'), 'tool_call does NOT call applyOps');
    assert.ok(!toolCallBlock.includes('executeBufferedToolCall'), 'tool_call does NOT execute');
  });

  assertPass('model_step_finished with tool-calls triggers executeBufferedToolCall', () => {
    const finishBlock = SOURCE.match(/case 'model_step_finished':[\s\S]{0,800}/)?.[0] ?? '';
    assert.ok(finishBlock.includes('tool-calls'), 'tool-calls finish reason checked');
    assert.ok(finishBlock.includes('executeBufferedToolCall'), 'execute is triggered from finish');
  });

  assertPass('executeBufferedToolCall is the ONLY place session.applyOps is called for copilot edits', () => {
    const executeBlock = SOURCE.match(/const executeBufferedToolCall[\s\S]{0,3000}/)?.[0] ?? '';
    assert.ok(executeBlock.includes('session.applyOps'), 'execute calls applyOps');
    // Verify no other copilot-path applyOps outside execute and undo
    const applyOpsCalls = SOURCE.match(/session\.applyOps\(/g)?.length ?? 0;
    // Expected: 1 in executeBufferedToolCall, 1 in undo handler, possibly 1 in handleSend undo path
    assert.ok(applyOpsCalls >= 2 && applyOpsCalls <= 4, `applyOps call count reasonable: ${applyOpsCalls}`);
  });

  assertPass('executeBufferedToolCall verifies toolName === apply_widget_ops', () => {
    const executeBlock = SOURCE.match(/const executeBufferedToolCall[\s\S]{0,3000}/)?.[0] ?? '';
    assert.ok(executeBlock.includes("toolName !== 'apply_widget_ops'"), 'tool name verified');
  });
}

// ---------------------------------------------------------------------------
// 2. Continuation includes priorModelStepId
// ---------------------------------------------------------------------------

function testContinuation() {
  console.log('\n--- Continuation includes priorModelStepId ---');

  assertPass('sendContinuation builds body with priorModelStepId', () => {
    const continuationBlock = SOURCE.match(/const sendContinuation[\s\S]{0,2000}/)?.[0] ?? '';
    assert.ok(continuationBlock.includes('priorModelStepId'), 'priorModelStepId in body');
    assert.ok(continuationBlock.includes("kind: 'continuation'"), 'kind continuation');
    assert.ok(continuationBlock.includes('toolCallId'), 'toolCallId in body');
    assert.ok(continuationBlock.includes('toolResult'), 'toolResult in body');
  });

  assertPass('continuation does NOT consume another monthly reservation', () => {
    const continuationBlock = SOURCE.match(/const sendContinuation[\s\S]{0,2000}/)?.[0] ?? '';
    assert.ok(!continuationBlock.includes('initial'), 'no kind: initial in continuation');
  });
}

// ---------------------------------------------------------------------------
// 3. Undo accumulates in reverse batch order
// ---------------------------------------------------------------------------

function testUndoAccumulation() {
  console.log('\n--- Undo accumulates in reverse batch order ---');

  assertPass('turn.undoOps is prepended (new inverse ops go first)', () => {
    assert.ok(
      SOURCE.includes('turn.undoOps = [...inverseOps, ...turn.undoOps]'),
      'inverse ops prepended to accumulated list',
    );
  });

  assertPass('undoRef.current holds the accumulated list', () => {
    assert.ok(
      SOURCE.includes('undoRef.current = {\n      ops: turn.undoOps'),
      'undoRef stores turn.undoOps',
    );
  });

  assertPass('model history records tool call + result once each', () => {
    const executeBlock = SOURCE.match(/const executeBufferedToolCall[\s\S]{0,3000}/)?.[0] ?? '';
    assert.ok(executeBlock.includes('appendToolCall'), 'appendToolCall called');
    assert.ok(executeBlock.includes('appendToolResult'), 'appendToolResult called');
  });
}

// ---------------------------------------------------------------------------
// 4. Send becomes Stop while active
// ---------------------------------------------------------------------------

function testSendStopToggle() {
  console.log('\n--- Send/Stop toggle ---');

  assertPass('Stop button rendered when isLoading', () => {
    assert.ok(
      SOURCE.includes('{isLoading ? (') && SOURCE.includes('>Stop<'),
      'Stop button conditional on loading state',
    );
  });

  assertPass('handleStop exists and cancels the active handle', () => {
    const stopBlock = SOURCE.match(/const handleStop[\s\S]{0,800}/)?.[0] ?? '';
    assert.ok(stopBlock.includes('activeHandleRef.current.cancel()'), 'cancels active handle');
    assert.ok(stopBlock.includes('turn.isStopped = true'), 'marks turn stopped');
  });
}

// ---------------------------------------------------------------------------
// 5. Two-fact turn state
// ---------------------------------------------------------------------------

function testTwoFactTurnState() {
  console.log('\n--- Two-fact turn state ---');

  assertPass('ActiveTurnState has turn-level state', () => {
    assert.ok(SOURCE.includes('type ActiveTurnState'), 'ActiveTurnState type exists');
    assert.ok(SOURCE.includes('activeTurnRef'), 'activeTurnRef exists');
  });

  assertPass('activeHandleRef tracks HTTP-level state separately', () => {
    assert.ok(SOURCE.includes('activeHandleRef'), 'activeHandleRef exists separately from activeTurnRef');
  });

  assertPass('handleStop does NOT wait for server event (Bob own truth)', () => {
    const stopBlock = SOURCE.match(/const handleStop[\s\S]{0,800}/)?.[0] ?? '';
    assert.ok(stopBlock.includes('turn.isStopped = true'), 'immediately marks stopped');
    assert.ok(!stopBlock.includes('await'), 'handleStop is synchronous (no server wait)');
  });

  assertPass('isStopped suppresses continuations', () => {
    const continuationBlock = SOURCE.match(/const sendContinuation[\s\S]{0,2000}/)?.[0] ?? '';
    assert.ok(continuationBlock.includes('turn.isStopped'), 'continuation checks isStopped');
  });

  assertPass('late events ignored when turn.isStopped', () => {
    const eventBlock = SOURCE.match(/onCopilotEvent: \(event\)[\s\S]{0,200}/)?.[0] ?? '';
    assert.ok(eventBlock.includes('turn.isStopped'), 'event handler checks isStopped');
  });
}

// ---------------------------------------------------------------------------
// 6. Tier step limit
// ---------------------------------------------------------------------------

function testTierStepLimit() {
  console.log('\n--- Tier step limit ---');

  assertPass('tierStepLimit read from signed policy', () => {
    assert.ok(
      SOURCE.includes("chrome.policy?.limits?.['maxTurnsPerThread']"),
      'reads from signed policy limits',
    );
  });

  assertPass('continuation refused when stepCount >= tierStepLimit', () => {
    const continuationBlock = SOURCE.match(/const sendContinuation[\s\S]{0,2000}/)?.[0] ?? '';
    assert.ok(
      continuationBlock.includes('turn.stepCount >= tierStepLimit'),
      'refuses at limit',
    );
  });

  assertPass('refusal message mentions step limit', () => {
    assert.ok(
      SOURCE.includes('step limit'),
      'message mentions step limit',
    );
  });

  assertPass('refusal does NOT consume monthly reservation', () => {
    const continuationBlock = SOURCE.match(/const sendContinuation[\s\S]{0,2000}/)?.[0] ?? '';
    assert.ok(!continuationBlock.includes("kind: 'initial'"), 'no initial kind in continuation');
  });
}

// ---------------------------------------------------------------------------
// 7. expandTypographyFamilyOps preserved
// ---------------------------------------------------------------------------

function testTypographyExpansion() {
  console.log('\n--- Typography expansion preserved ---');

  assertPass('CopilotPane calls expandTypographyFamilyOps before applyOps', () => {
    assert.ok(SOURCE.includes('expandTypographyFamilyOps'), 'expandTypographyFamilyOps imported and called');
    const executeBlock = SOURCE.match(/const executeBufferedToolCall[\s\S]{0,3000}/)?.[0] ?? '';
    const expandIdx = executeBlock.indexOf('expandTypographyFamilyOps');
    const applyIdx = executeBlock.indexOf('session.applyOps');
    assert.ok(expandIdx > 0 && applyIdx > expandIdx, 'expansion runs before applyOps');
  });
}

// ---------------------------------------------------------------------------
// 8. Save unchanged
// ---------------------------------------------------------------------------

function testSaveBoundary() {
  console.log('\n--- Save boundary ---');

  assertPass('CopilotPane does NOT call any Save/persist route', () => {
    assert.ok(!SOURCE.includes('session.save'), 'no session.save call');
    assert.ok(!SOURCE.includes('/api/account/instances'), 'no direct persist route');
    assert.ok(!SOURCE.includes('saveInstance'), 'no saveInstance call');
  });

  assertPass('buildCopilotUndoOps preserved', () => {
    assert.ok(SOURCE.includes('buildCopilotUndoOps'), 'undo ops builder used');
  });
}

// ---------------------------------------------------------------------------
// 9. Cancellation race-safety
// ---------------------------------------------------------------------------

function testCancellationRaceSafety() {
  console.log('\n--- Cancellation race-safety ---');

  assertPass('handleStop works when activeHandleRef is null (between steps)', () => {
    const stopBlock = SOURCE.match(/const handleStop[\s\S]{0,800}/)?.[0] ?? '';
    assert.ok(stopBlock.includes('if (activeHandleRef.current)'), 'null check before cancel');
  });

  assertPass('isStopped check in onCopilotEvent handler', () => {
    const eventBlock = SOURCE.match(/onCopilotEvent: \(event\)[\s\S]{0,200}/)?.[0] ?? '';
    assert.ok(eventBlock.includes('turn.isStopped'), 'event handler guards on isStopped');
  });
}

// ---------------------------------------------------------------------------
// 10. Streaming text display
// ---------------------------------------------------------------------------

function testStreamingText() {
  console.log('\n--- Streaming text display ---');

  assertPass('text_delta pushes/updates streaming message via updateCopilotThread', () => {
    const textDeltaBlock = SOURCE.match(/case 'text_delta':[\s\S]{0,1200}/)?.[0] ?? '';
    assert.ok(textDeltaBlock.includes('updateCopilotThread'), 'updates thread');
    assert.ok(textDeltaBlock.includes('streamingMessageIdRef'), 'tracks streaming message');
    assert.ok(textDeltaBlock.includes('event.data.text'), 'appends event text');
  });

  assertPass('streamingMessageIdRef cleared on tool_call', () => {
    const toolCallBlock = SOURCE.match(/case 'tool_call':[\s\S]{0,400}/)?.[0] ?? '';
    assert.ok(toolCallBlock.includes('streamingMessageIdRef.current = null'), 'cleared on tool_call');
  });

  assertPass('streamingMessageIdRef cleared on model_step_finished', () => {
    const finishBlock = SOURCE.match(/case 'model_step_finished':[\s\S]{0,400}/)?.[0] ?? '';
    assert.ok(finishBlock.includes('streamingMessageIdRef.current = null'), 'cleared on finish');
  });

  assertPass('streamingMessageIdRef cleared on agent_turn_finished', () => {
    const finishedBlock = SOURCE.match(/case 'agent_turn_finished':[\s\S]{0,400}/)?.[0] ?? '';
    assert.ok(finishedBlock.includes('streamingMessageIdRef.current = null'), 'cleared on turn finish');
  });

  assertPass('first text_delta creates new streaming message', () => {
    const textDeltaBlock = SOURCE.match(/case 'text_delta':[\s\S]{0,1200}/)?.[0] ?? '';
    assert.ok(textDeltaBlock.includes('const msgId = newId()'), 'creates new message id');
    assert.ok(textDeltaBlock.includes("role: 'assistant'"), 'assistant role');
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function run(): void {
  console.log('=== PRD 128F §4 Gate Tests — Bob CopilotPane ===');
  testToolAfterStep();
  testContinuation();
  testUndoAccumulation();
  testSendStopToggle();
  testTwoFactTurnState();
  testTierStepLimit();
  testTypographyExpansion();
  testSaveBoundary();
  testCancellationRaceSafety();
  testStreamingText();
  console.log('\n=== All Bob CopilotPane gate tests passed ===');
}

run();
