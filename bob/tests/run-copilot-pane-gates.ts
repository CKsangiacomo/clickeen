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
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  appendWorkingCopilotAssistantText,
  COPILOT_MESSAGE_PRESENTATION_LABELS,
  resolveWorkingCopilotAssistantMessages,
  type CopilotMessage,
} from '../lib/copilot/types';

function assertPass(label: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✅ ${label}`);
  } catch (err) {
    console.error(`  ❌ ${label}`);
    throw err;
  }
}

const SOURCE = readFileSync(
  fileURLToPath(new URL('../components/CopilotPane.tsx', import.meta.url)),
  'utf8',
);

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
    const executeBlock = SOURCE.match(/const executeBufferedToolCall[\s\S]{0,7000}/)?.[0] ?? '';
    assert.ok(executeBlock.includes('session.applyOps'), 'execute calls applyOps');
    // Verify no other copilot-path applyOps outside execute and undo
    const applyOpsCalls = SOURCE.match(/session\.applyOps\(/g)?.length ?? 0;
    // Expected: 1 in executeBufferedToolCall, 1 in undo handler, possibly 1 in handleSend undo path
    assert.ok(applyOpsCalls >= 2 && applyOpsCalls <= 4, `applyOps call count reasonable: ${applyOpsCalls}`);
  });

  assertPass('executeBufferedToolCall verifies toolName === apply_widget_ops', () => {
    const executeBlock = SOURCE.match(/const executeBufferedToolCall[\s\S]{0,7000}/)?.[0] ?? '';
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
    const executeBlock = SOURCE.match(/const executeBufferedToolCall[\s\S]{0,7000}/)?.[0] ?? '';
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
      SOURCE.includes('chrome.copilot.maxTurnsPerThread'),
      'reads the step limit from the routed signed runtime policy',
    );
  });

  assertPass('missing signed policy is visible and never becomes an invented limit', () => {
    const policyBlock = SOURCE.match(/const tierStepLimit[\s\S]{0,180}/)?.[0] ?? '';
    assert.ok(policyBlock.includes(': null'), 'missing policy remains unavailable');
    assert.ok(!policyBlock.includes('?? 30'), 'does not invent a default limit');
    const continuationBlock = SOURCE.match(/const sendContinuation[\s\S]{0,900}/)?.[0] ?? '';
    assert.ok(continuationBlock.includes('tierStepLimit === null'), 'continuation fails visibly without policy');
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
    const executeBlock = SOURCE.match(/const executeBufferedToolCall[\s\S]{0,7000}/)?.[0] ?? '';
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
// 9. Exact draft projection, show-if, and Save-first readiness
// ---------------------------------------------------------------------------

function testDraftProjectionAndReadiness() {
  console.log('\n--- Exact draft projection and readiness ---');

  assertPass('controls consume Bob exact draft and preserve compiled kinds', () => {
    const controlsBlock = SOURCE.match(/function buildProductCopilotControls[\s\S]{0,1200}/)?.[0] ?? '';
    assert.ok(controlsBlock.includes('evaluateShowIfExpression(control.showIf, args.currentConfig)'), 'show-if uses exact draft');
    assert.ok(controlsBlock.includes('kind: control.kind!'), 'compiled kind is consumed exactly');
    assert.ok(!controlsBlock.includes("kind: control.kind ?? ''"), 'no empty-kind substitution');
    assert.ok(SOURCE.includes('currentConfig: session.instanceData'), 'session draft is projected directly');
  });

  assertPass('zero currently visible controls truthfully advertises no draft edit action', () => {
    const availability = "availableActions: controlsForAi.length > 0 ? ['draft_edit'] : []";
    assert.equal(SOURCE.split(availability).length - 1, 2, 'initial and continuation contexts use the same projection');
  });

  assertPass('Copilot waits for compiled, policy, and saved-instance coordinates', () => {
    const readinessBlock = SOURCE.match(/const uiDisabledReason[\s\S]{0,400}/)?.[0] ?? '';
    assert.ok(readinessBlock.includes('!compiled || !chrome.policy || !chrome.copilot'), 'temporal boot authorities gate use');
    assert.ok(readinessBlock.includes('!instanceId'), 'new unsaved widget is gated');
    assert.ok(readinessBlock.includes('Save this widget before using Copilot.'), 'Save-first boundary is visible');
  });
}

// ---------------------------------------------------------------------------
// 10. External model edit admission
// ---------------------------------------------------------------------------

function testExternalEditAdmission() {
  console.log('\n--- External model edit admission ---');

  assertPass('only apply_widget_ops enters Bob edit execution', () => {
    const executeBlock = SOURCE.match(/const executeBufferedToolCall[\s\S]{0,5200}/)?.[0] ?? '';
    assert.ok(executeBlock.includes("toolName !== 'apply_widget_ops'"), 'tool name is admitted explicitly');
    assert.ok(executeBlock.includes('!Array.isArray(ops) || ops.length === 0'), 'empty or non-array ops are refused');
  });

  assertPass('external ops pass through typography, undo, and Bob apply boundary', () => {
    const executeBlock = SOURCE.match(/const executeBufferedToolCall[\s\S]{0,5200}/)?.[0] ?? '';
    const expandIndex = executeBlock.indexOf('expandTypographyFamilyOps');
    const undoIndex = executeBlock.indexOf('buildCopilotUndoOps');
    const applyIndex = executeBlock.indexOf('session.applyOps');
    assert.ok(expandIndex >= 0 && undoIndex > expandIndex && applyIndex > undoIndex, 'ops follow the owned admission sequence');
    assert.ok(executeBlock.includes('if (!applied.ok)'), 'rejected ops are returned without partial application');
  });
}

// ---------------------------------------------------------------------------
// 11. Cancellation race-safety
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
// 12. Streaming text display
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
    assert.ok(textDeltaBlock.includes('streamingMessageIdRef.current ?? newId()'), 'creates new message id');
    assert.ok(textDeltaBlock.includes('appendWorkingCopilotAssistantText'), 'creates the working assistant message');
  });
}

// ---------------------------------------------------------------------------
// 13. Visible message result lifecycle (behavior, not source inspection)
// ---------------------------------------------------------------------------

type VisibleTransportEvent =
  | { type: 'text_delta'; text: string }
  | { type: 'tool_call' }
  | { type: 'apply_succeeded' }
  | { type: 'apply_rejected'; message: string }
  | { type: 'agent_turn_finished' }
  | { type: 'agent_turn_error'; message: string }
  | { type: 'stop'; message: string };

function createVisibleTranscriptTransport() {
  let messages: CopilotMessage[] = [];
  let unresolvedMessageIds: string[] = [];
  let streamingMessageId: string | null = null;
  let nextMessageId = 1;

  const beginRequest = () => {
    const messageId = `message-${nextMessageId++}`;
    streamingMessageId = messageId;
    unresolvedMessageIds.push(messageId);
    messages = appendWorkingCopilotAssistantText({
      messages,
      messageId,
      text: '',
      ts: nextMessageId,
    });
  };

  const resolve = (
    resolution: 'complete' | 'applied' | 'not-applied' | 'stopped',
  ): boolean => {
    const hadUnresolvedMessage = unresolvedMessageIds.length > 0;
    messages = resolveWorkingCopilotAssistantMessages({
      messages,
      messageIds: unresolvedMessageIds,
      resolution,
    });
    unresolvedMessageIds = [];
    streamingMessageId = null;
    return hadUnresolvedMessage;
  };

  const appendResultMessage = (
    status: 'not-applied' | 'stopped',
    text: string,
  ) => {
    const resolvedExistingMessage = resolve(status);
    messages = [
      ...messages,
      {
        id: `message-${nextMessageId++}`,
        role: 'assistant',
        text,
        ts: nextMessageId,
        ...(resolvedExistingMessage ? {} : { presentationStatus: status }),
      },
    ];
  };

  beginRequest();

  return {
    emit(event: VisibleTransportEvent) {
      switch (event.type) {
        case 'text_delta': {
          const messageId = streamingMessageId ?? `message-${nextMessageId++}`;
          streamingMessageId = messageId;
          if (!unresolvedMessageIds.includes(messageId)) {
            unresolvedMessageIds.push(messageId);
          }
          messages = appendWorkingCopilotAssistantText({
            messages,
            messageId,
            text: event.text,
            ts: nextMessageId,
          });
          break;
        }
        case 'tool_call':
          streamingMessageId = null;
          break;
        case 'apply_succeeded':
          resolve('applied');
          beginRequest();
          break;
        case 'apply_rejected':
          appendResultMessage('not-applied', event.message);
          beginRequest();
          break;
        case 'agent_turn_finished':
          resolve('complete');
          break;
        case 'agent_turn_error':
          appendResultMessage('not-applied', event.message);
          break;
        case 'stop':
          appendResultMessage('stopped', event.message);
          break;
      }
    },
    messages() {
      return messages;
    },
  };
}

function testVisibleMessageResultLifecycle() {
  console.log('\n--- Visible message result lifecycle ---');

  assertPass('text streams while the same assistant message remains Working', () => {
    const transport = createVisibleTranscriptTransport();
    assert.equal(transport.messages()[0]?.presentationStatus, 'working');
    assert.equal(transport.messages()[0]?.text, '');
    transport.emit({ type: 'text_delta', text: 'Done — ' });
    transport.emit({ type: 'text_delta', text: 'updating the widget.' });
    assert.equal(transport.messages().length, 1);
    assert.equal(transport.messages()[0]?.text, 'Done — updating the widget.');
    assert.equal(transport.messages()[0]?.presentationStatus, 'working');
    assert.equal(COPILOT_MESSAGE_PRESENTATION_LABELS.working, 'Working');
  });

  assertPass('text-only terminal success completes without inventing Applied', () => {
    const transport = createVisibleTranscriptTransport();
    transport.emit({ type: 'text_delta', text: 'Here is the answer.' });
    transport.emit({ type: 'agent_turn_finished' });
    assert.equal(transport.messages()[0]?.presentationStatus, undefined);
  });

  assertPass('tool narration remains Working until apply succeeds', () => {
    const transport = createVisibleTranscriptTransport();
    transport.emit({ type: 'text_delta', text: 'Done — I updated it.' });
    transport.emit({ type: 'tool_call' });
    assert.equal(transport.messages()[0]?.presentationStatus, 'working');
    transport.emit({ type: 'apply_succeeded' });
    assert.equal(transport.messages()[0]?.presentationStatus, 'applied');
    assert.equal(transport.messages()[1]?.presentationStatus, 'working');
    transport.emit({ type: 'agent_turn_finished' });
    assert.equal(
      transport.messages()[1]?.presentationStatus,
      undefined,
      'a later text-only terminal step must not duplicate Applied',
    );
    assert.equal(COPILOT_MESSAGE_PRESENTATION_LABELS.applied, 'Applied');
  });

  assertPass('apply rejection marks narration Not applied and keeps a visible error', () => {
    const transport = createVisibleTranscriptTransport();
    transport.emit({ type: 'text_delta', text: 'I changed the heading.' });
    transport.emit({ type: 'tool_call' });
    transport.emit({
      type: 'apply_rejected',
      message: "Copilot couldn't produce a valid edit for this widget. Nothing was changed.",
    });
    assert.equal(transport.messages()[0]?.presentationStatus, 'not-applied');
    assert.equal(COPILOT_MESSAGE_PRESENTATION_LABELS['not-applied'], 'Not applied');
    assert.match(transport.messages()[1]?.text ?? '', /Nothing was changed/);
  });

  assertPass('stream failure cannot leave earlier narration looking complete', () => {
    const transport = createVisibleTranscriptTransport();
    transport.emit({ type: 'text_delta', text: 'Done — the edit is ready.' });
    transport.emit({ type: 'agent_turn_error', message: 'Copilot failed unexpectedly.' });
    assert.equal(transport.messages()[0]?.presentationStatus, 'not-applied');
    assert.equal(transport.messages()[1]?.text, 'Copilot failed unexpectedly.');
  });

  assertPass('Stop marks only unresolved work Stopped and preserves Applied truth', () => {
    const transport = createVisibleTranscriptTransport();
    transport.emit({ type: 'text_delta', text: 'Applying the requested edit.' });
    transport.emit({ type: 'tool_call' });
    transport.emit({ type: 'apply_succeeded' });
    transport.emit({ type: 'text_delta', text: 'Finishing the explanation.' });
    transport.emit({
      type: 'stop',
      message: 'Stopped. Already-applied changes remain and can be undone.',
    });
    assert.equal(transport.messages()[0]?.presentationStatus, 'applied');
    assert.equal(transport.messages()[1]?.presentationStatus, 'stopped');
    assert.equal(COPILOT_MESSAGE_PRESENTATION_LABELS.stopped, 'Stopped');
    assert.match(transport.messages()[2]?.text ?? '', /Already-applied changes remain/);
  });
}

function testVisibleMessageLifecycleIntegration() {
  console.log('\n--- Visible message lifecycle integration ---');

  assertPass('CopilotPane routes text, apply, terminal, error, and Stop through presentation truth', () => {
    const textDeltaBlock = SOURCE.match(/case 'text_delta':[\s\S]{0,1500}/)?.[0] ?? '';
    const executeBlock = SOURCE.match(/const executeBufferedToolCall[\s\S]{0,8500}/)?.[0] ?? '';
    const finishedBlock = SOURCE.match(/case 'agent_turn_finished':[\s\S]{0,500}/)?.[0] ?? '';
    const errorBlock = SOURCE.match(/case 'agent_turn_error':[\s\S]{0,500}/)?.[0] ?? '';
    const stopBlock = SOURCE.match(/const handleStop[\s\S]{0,1200}/)?.[0] ?? '';
    const requestBlock = SOURCE.match(/const startTurnRequest[\s\S]{0,1400}/)?.[0] ?? '';
    assert.ok(requestBlock.includes("presentationStatus: 'working'"));
    assert.ok(textDeltaBlock.includes('appendWorkingCopilotAssistantText'));
    assert.ok(executeBlock.includes("resolveTurnVisibleMessages(turn, 'applied')"));
    assert.ok(finishedBlock.includes("resolveTurnVisibleMessages(turn, 'complete')"));
    assert.ok(errorBlock.includes("presentationStatus: 'not-applied'"));
    assert.ok(stopBlock.includes("presentationStatus: 'stopped'"));
  });

  assertPass('request completion is scoped to the exact request and non-OK is Not applied', () => {
    const requestBlock = SOURCE.match(/handle\.completed\.then[\s\S]{0,1800}/)?.[0] ?? '';
    assert.ok(requestBlock.includes('activeHandleRef.current?.requestId === handle.requestId'));
    assert.ok(requestBlock.includes('!result.ok'));
    assert.ok(requestBlock.includes("presentationStatus: 'not-applied'"));
  });

  assertPass('the four exact passive status words are rendered from CopilotMessage only', () => {
    assert.ok(SOURCE.includes('COPILOT_MESSAGE_PRESENTATION_LABELS[m.presentationStatus]'));
    assert.deepEqual(COPILOT_MESSAGE_PRESENTATION_LABELS, {
      working: 'Working',
      applied: 'Applied',
      'not-applied': 'Not applied',
      stopped: 'Stopped',
    });
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
  testDraftProjectionAndReadiness();
  testExternalEditAdmission();
  testCancellationRaceSafety();
  testStreamingText();
  testVisibleMessageResultLifecycle();
  testVisibleMessageLifecycleIntegration();
  console.log('\n=== All Bob CopilotPane gate tests passed ===');
}

run();
