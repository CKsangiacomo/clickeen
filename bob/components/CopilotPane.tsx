import { looksLikeHtmlErrorPage } from '@clickeen/ck-contracts';
import type {
  ProductCopilotControl,
  ProductCopilotTurnEvent,
} from '@clickeen/ck-contracts/ai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { WidgetOp } from '../lib/ops';
import {
  appendWorkingCopilotAssistantText,
  COPILOT_MESSAGE_PRESENTATION_LABELS,
  resolveWorkingCopilotAssistantMessages,
  type CopilotMessage,
  type CopilotMessagePresentationStatus,
} from '../lib/copilot/types';
import {
  emptyCopilotModelHistory,
  appendUserMessage,
  appendAssistantText,
  appendToolCall,
  appendToolResult,
  toWireHistory,
  type CopilotModelHistory,
} from '../lib/copilot/model-history';
import { buildCopilotUndoOps } from '../lib/copilot/undo';
import {
  useWidgetSession,
  useWidgetSessionChrome,
  useWidgetSessionCopilot,
  useWidgetSessionTransport,
} from '../lib/session/useWidgetSession';
import { serializeInstanceDataSignature } from '../lib/session/sessionTypes';
import type { CompiledControl } from '../lib/types';
import { getAt } from '../lib/utils/paths';
import { evaluateShowIfExpression } from './td-menu-content/showIf';
import {
  expandTypographyFamilyOps,
} from '../lib/edit/typography-family-ops';

type WidgetSessionValue = ReturnType<typeof useWidgetSession>;

// ---------------------------------------------------------------------------
// Turn state (two-fact: active turn + active HTTP request)
// ---------------------------------------------------------------------------

type BufferedToolCall = {
  toolCallId: string;
  toolName: string;
  input: unknown;
  modelStepId: string;
};

type ActiveTurnState = {
  userTurnId: string;
  modelStepId: string | null;
  bufferedToolCall: BufferedToolCall | null;
  modelHistory: CopilotModelHistory;
  unresolvedMessageIds: string[];
  undoOps: WidgetOp[]; // accumulated inverse ops (reverse order at undo time)
  postApplySignature: string | null;
  stepCount: number;
  isStopped: boolean;
};

// ---------------------------------------------------------------------------
// Helpers (kept from the old pane where behavior is unchanged)
// ---------------------------------------------------------------------------

function titleCase(input: string): string {
  const s = String(input || '')
    .replace(/[_-]+/g, ' ')
    .trim();
  if (!s) return '';
  return s
    .split(' ')
    .filter(Boolean)
    .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1))
    .join(' ');
}

function normalizeAssistantText(text: string): string {
  const candidate = (text || '').trim();
  if (!candidate) return '';
  if (looksLikeHtmlErrorPage(candidate)) return 'Copilot is temporarily unavailable. Please try again in a moment.';
  if (candidate === 'Unhandled error') return 'Copilot could not complete the request. Please try again with a smaller change.';
  if (candidate.toLowerCase().includes('empty model response')) {
    return 'Copilot did not return an edit. Please try again with a smaller, more specific request.';
  }
  if (candidate.toLowerCase().includes('execution timeout')) return 'Copilot timed out. Please try again with a smaller change.';
  return candidate;
}

const COPILOT_INVALID_EDIT_MESSAGE = "Copilot couldn't produce a valid edit for this widget. Nothing was changed.";
const COPILOT_UNEXPECTED_FAILURE_MESSAGE = 'Copilot failed unexpectedly. Please try again.';

export class CopilotUserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CopilotUserFacingError';
  }
}

export function resolveCopilotCaughtError(caught: unknown): string {
  return caught instanceof CopilotUserFacingError && caught.message.trim()
    ? caught.message
    : COPILOT_UNEXPECTED_FAILURE_MESSAGE;
}

function copilotModelKey(model: { provider: string; model: string }): string {
  return `${model.provider}:${model.model}`;
}

function copilotReasonKeyMessage(reasonKey: string): string | null {
  if (reasonKey === 'coreui.upsell.reason.limitReached') {
    return "You've used all your Copilot turns for this month. They reset on the 1st.";
  }
  if (reasonKey === 'coreui.errors.ai.model.notAllowed') return "Copilot couldn't run this model. Try again, or pick another model.";
  if (reasonKey === 'coreui.errors.copilot.invalidContext') return 'Copilot context is invalid. I can keep talking, but Builder editing is unavailable until the editor context refreshes.';
  if (reasonKey === 'coreui.errors.copilot.invalidEdit') return COPILOT_INVALID_EDIT_MESSAGE;
  if (reasonKey === 'coreui.errors.copilot.invalidRequest') return 'Copilot request context is invalid. Refresh Builder and try again.';
  if (reasonKey === 'coreui.errors.copilot.failed') return 'Copilot failed unexpectedly. Please try again.';
  return null;
}

function formatIssueSummary(issues: unknown): string {
  if (!Array.isArray(issues)) return '';
  const lines = issues
    .filter((issue): issue is { path: string; message: string } => {
      return Boolean(issue) &&
        typeof issue === 'object' &&
        typeof (issue as any).path === 'string' &&
        typeof (issue as any).message === 'string';
    })
    .slice(0, 3)
    .map((issue) => `${issue.path}: ${issue.message}`);
  return lines.length ? ` (${lines.join('; ')})` : '';
}

export function normalizeErrorMessage(args: { resStatus?: number; parsed?: any; bodyText?: string; fallback?: string }): string {
  const parsed = args.parsed || null;
  const reasonKey =
    typeof parsed?.reasonKey === 'string'
      ? parsed.reasonKey
      : typeof parsed?.error?.reasonKey === 'string'
        ? parsed.error.reasonKey
        : '';
  const issueSummary = formatIssueSummary(parsed?.issues ?? parsed?.error?.issues);
  const reasonKeyMessage = reasonKey ? copilotReasonKeyMessage(reasonKey) : null;
  if (reasonKeyMessage) return `${reasonKeyMessage}${issueSummary}`;
  return `${args.fallback || COPILOT_UNEXPECTED_FAILURE_MESSAGE}${issueSummary}`;
}

function newId(): string {
  return crypto.randomUUID();
}

function buildProductCopilotControls(args: {
  controls: CompiledControl[];
  currentConfig: Record<string, unknown>;
}): ProductCopilotControl[] {
  return args.controls
    .filter((control) => !control.showIf || evaluateShowIfExpression(control.showIf, args.currentConfig))
    .map((control) => ({
      path: control.path,
      panelId: control.panelId,
      groupId: control.groupId,
      groupLabel: control.groupLabel,
      type: control.type,
      kind: control.kind!,
      label: control.label,
      options: control.options,
      enumValues: control.enumValues,
      min: control.min,
      max: control.max,
      itemIdPath: control.itemIdPath,
      currentValue: getAt(args.currentConfig, control.path),
    }));
}

function summarizeAppliedOps(ops: WidgetOp[], controls: Array<{ path: string; label?: string }>): string {
  const byPath = new Map(controls.map((control) => [control.path, control]));
  const labels = Array.from(new Set(ops.map((op) => byPath.get(op.path)?.label).filter(Boolean))).slice(0, 3);
  if (!labels.length) return 'Changed this widget.';
  return `Changed ${labels.join(', ')}.`;
}

function initialCopilotMessage(widgetType: string): string {
  const label = titleCase(widgetType) || 'widget';
  return `You're editing a ${label} widget in your account. Ask me for a concrete content, layout, styling, or settings change and I'll apply it here. You can undo the last Copilot change before saving.`;
}

type CopilotSurfaceContract = {
  initialMessage: (widgetType: string) => string;
};

type SharedCopilotPaneProps = {
  session: WidgetSessionValue;
  surfaceContract: CopilotSurfaceContract;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AccountCopilotPane() {
  const session = useWidgetSession();

  const surfaceContract = useMemo<CopilotSurfaceContract>(() => {
    return {
      initialMessage: (widgetType) => initialCopilotMessage(widgetType),
    };
  }, []);

  return <SharedCopilotPane session={session} surfaceContract={surfaceContract} />;
}

function SharedCopilotPane({ session, surfaceContract }: SharedCopilotPaneProps) {
  const chrome = useWidgetSessionChrome();
  const copilot = useWidgetSessionCopilot();
  const setCopilotTurnActive = copilot.setCopilotTurnActive;
  const setCopilotUndo = copilot.setCopilotUndo;
  const updateCopilotThread = copilot.updateCopilotThread;
  const transport = useWidgetSessionTransport();
  const compiled = session.compiled;

  const widgetType = compiled?.widgetname ?? null;
  const instanceId = chrome.meta?.instanceId ?? null;

  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading'>('idle');
  const [selectedModelKey, setSelectedModelKey] = useState('');

  // Two-fact state: the active user turn and the active HTTP request.
  // The turn survives between HTTP requests (tool execution → continuation).
  // The HTTP request is the current streaming request within that turn.
  const activeTurnRef = useRef<ActiveTurnState | null>(null);
  const activeHandleRef = useRef<{ requestId: string; cancel: () => void } | null>(null);
  const streamingMessageIdRef = useRef<string | null>(null);

  const listRef = useRef<HTMLDivElement | null>(null);
  const convoKeyRef = useRef<string | null>(null);
  const instanceDataRef = useRef(session.instanceData);

  // Tier step limit from the existing signed policy (no new store).
  const tierStepLimit = chrome.copilot
    ? chrome.copilot.maxTurnsPerThread
    : null;

  const threadKey = useMemo(() => {
    if (!widgetType) return null;
    return `${widgetType}:${instanceId ?? 'local'}`;
  }, [widgetType, instanceId]);

  const thread = threadKey ? copilot.copilotThreads?.[threadKey] ?? null : null;
  const undoRecord = threadKey ? copilot.copilotUndoByThread[threadKey] ?? null : null;
  const messages = useMemo(() => thread?.messages ?? [], [thread?.messages]);
  const copilotSessionId = thread?.sessionId ?? '';
  const allowModelPicker = chrome.copilot?.allowModelPicker === true;
  const modelOptions = useMemo(() => chrome.copilot?.modelOptions ?? [], [chrome.copilot?.modelOptions]);
  const defaultModel = chrome.copilot?.selectedModel ?? chrome.copilot?.defaultModel ?? null;
  const selectedModel = useMemo(() => {
    if (!allowModelPicker) return null;
    const key = selectedModelKey || (defaultModel ? copilotModelKey(defaultModel) : '');
    if (!key) return null;
    return modelOptions.find((option) => copilotModelKey(option) === key) ?? null;
  }, [allowModelPicker, defaultModel, modelOptions, selectedModelKey]);

  useEffect(() => {
    if (!allowModelPicker || !defaultModel) {
      setSelectedModelKey('');
      return;
    }
    const defaultKey = copilotModelKey(defaultModel);
    setSelectedModelKey((current) => {
      if (current && modelOptions.some((option) => copilotModelKey(option) === current)) return current;
      return modelOptions.some((option) => copilotModelKey(option) === defaultKey) ? defaultKey : '';
    });
  }, [allowModelPicker, defaultModel, modelOptions]);

  useEffect(() => {
    instanceDataRef.current = session.instanceData;
  }, [session.instanceData]);

  useEffect(() => {
    if (!threadKey || !compiled || !widgetType) return;
    if (thread && thread.messages.length > 0) return;

    copilot.setCopilotThread(threadKey, {
      sessionId: crypto.randomUUID(),
      messages: [
        {
          id: newId(),
          role: 'assistant',
          text: surfaceContract.initialMessage(widgetType),
          ts: Date.now(),
        },
      ],
    });
  }, [threadKey, compiled, widgetType, thread, copilot, surfaceContract]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    if (!threadKey) return;
    convoKeyRef.current = threadKey;
  }, [threadKey, messages]);

  const uiDisabledReason = useMemo(() => {
    if (!compiled || !chrome.policy || !chrome.copilot) return 'Load an instance to begin.';
    if (!instanceId) return 'Save this widget before using Copilot.';
    return null;
  }, [chrome.copilot, chrome.policy, compiled, instanceId]);

  const controlsForAi = useMemo(() => {
    if (!compiled) return [];
    return buildProductCopilotControls({
      controls: compiled.controls,
      currentConfig: session.instanceData,
    });
  }, [compiled, session.instanceData]);

  const pushMessage = useCallback((msg: Omit<CopilotMessage, 'id' | 'ts'>): string | null => {
    if (!threadKey) return null;
    const messageId = newId();
    copilot.updateCopilotThread(threadKey, (current) => {
      const base = current ?? { sessionId: crypto.randomUUID(), messages: [] };
      return { ...base, messages: [...base.messages, { ...msg, id: messageId, ts: Date.now() }] };
    });
    return messageId;
  }, [threadKey, copilot]);

  const resolveTurnVisibleMessages = useCallback((
    turn: ActiveTurnState,
    resolution: Exclude<CopilotMessagePresentationStatus, 'working'> | 'complete',
  ): boolean => {
    const messageIds = turn.unresolvedMessageIds;
    turn.unresolvedMessageIds = [];
    if (!threadKey || messageIds.length === 0) return false;

    copilot.updateCopilotThread(threadKey, (current) => {
      if (!current) return { sessionId: copilotSessionId, messages: [] };
      return {
        ...current,
        messages: resolveWorkingCopilotAssistantMessages({
          messages: current.messages,
          messageIds,
          resolution,
        }),
      };
    });
    return true;
  }, [copilot, copilotSessionId, threadKey]);

  const pushTurnResultMessage = useCallback((args: {
    turn: ActiveTurnState;
    presentationStatus: Exclude<CopilotMessagePresentationStatus, 'working'>;
    text: string;
  }): void => {
    const resolvedExistingMessage = resolveTurnVisibleMessages(
      args.turn,
      args.presentationStatus,
    );
    pushMessage({
      role: 'assistant',
      text: args.text,
      ...(resolvedExistingMessage
        ? {}
        : { presentationStatus: args.presentationStatus }),
    });
  }, [pushMessage, resolveTurnVisibleMessages]);

  const finishTurn = useCallback((turn: ActiveTurnState): void => {
    if (activeTurnRef.current !== turn) return;
    streamingMessageIdRef.current = null;
    activeHandleRef.current = null;
    activeTurnRef.current = null;
    setStatus('idle');
    if (threadKey) setCopilotTurnActive(threadKey, false);
  }, [setCopilotTurnActive, threadKey]);

  useEffect(() => {
    return () => {
      const turn = activeTurnRef.current;
      if (!turn) return;
      turn.isStopped = true;
      activeHandleRef.current?.cancel();
      activeHandleRef.current = null;
      activeTurnRef.current = null;
      streamingMessageIdRef.current = null;
      const unresolvedMessageIds = turn.unresolvedMessageIds;
      turn.unresolvedMessageIds = [];
      if (threadKey && unresolvedMessageIds.length > 0) {
        updateCopilotThread(threadKey, (current) => ({
          ...current!,
          messages: resolveWorkingCopilotAssistantMessages({
            messages: current!.messages,
            messageIds: unresolvedMessageIds,
            resolution: 'stopped',
          }),
        }));
      }
      if (threadKey) setCopilotTurnActive(threadKey, false);
    };
  }, [setCopilotTurnActive, threadKey, updateCopilotThread]);

  // -------------------------------------------------------------------------
  // Tool execution: ONLY after model_step_finished (ground rule #6)
  // -------------------------------------------------------------------------

  const executeBufferedToolCall = useCallback(async (): Promise<void> => {
    const turn = activeTurnRef.current;
    if (!turn || !turn.bufferedToolCall || turn.isStopped) return;

    const { toolCallId, toolName, input, modelStepId } = turn.bufferedToolCall;
    turn.bufferedToolCall = null;

    const recordToolExchange = (toolResult: unknown): unknown => {
      turn.modelHistory = appendToolCall(turn.modelHistory, { toolCallId, toolName, input });
      turn.modelHistory = appendToolResult(turn.modelHistory, toolCallId, toolResult);
      return toolResult;
    };

    const activeCompiled = compiled;
    if (!activeCompiled) {
      recordToolExchange({
        ok: false,
        errors: [{ opIndex: 0, message: 'Editor context is unavailable.' }],
      });
      pushTurnResultMessage({
        turn,
        presentationStatus: 'not-applied',
        text: 'Editor context is unavailable. The edit was not applied.',
      });
      finishTurn(turn);
      return;
    }

    // Verify tool name
    if (toolName !== 'apply_widget_ops') {
      const toolResult = recordToolExchange({
        ok: false,
        errors: [{ opIndex: 0, message: `Unknown tool: ${toolName}` }],
      });
      pushTurnResultMessage({
        turn,
        presentationStatus: 'not-applied',
        text: COPILOT_INVALID_EDIT_MESSAGE,
      });
      await sendContinuation(turn, toolCallId, modelStepId, toolResult, instanceDataRef.current);
      return;
    }

    // Extract and validate the ops batch
    const ops = (input as { ops?: unknown[] })?.ops;
    if (!Array.isArray(ops) || ops.length === 0) {
      const toolResult = recordToolExchange({
        ok: false,
        errors: [{ opIndex: 0, message: 'Tool call must include a non-empty ops array.' }],
      });
      pushTurnResultMessage({
        turn,
        presentationStatus: 'not-applied',
        text: COPILOT_INVALID_EDIT_MESSAGE,
      });
      await sendContinuation(turn, toolCallId, modelStepId, toolResult, instanceDataRef.current);
      return;
    }

    // Expand typography family ops (preserve existing behavior)
    const preBatchData = instanceDataRef.current;
    const expandedOps = expandTypographyFamilyOps({
      instanceData: preBatchData,
      fontLibrary: session.fontLibrary,
      ops: ops as WidgetOp[],
    });
    if (!expandedOps) {
      const toolResult = recordToolExchange({
        ok: false,
        errors: [{ opIndex: 0, message: 'The edit could not be represented in this widget.' }],
      });
      pushTurnResultMessage({
        turn,
        presentationStatus: 'not-applied',
        text: COPILOT_INVALID_EDIT_MESSAGE,
      });
      await sendContinuation(turn, toolCallId, modelStepId, toolResult, instanceDataRef.current);
      return;
    }

    // Build inverse ops for undo (from the exact pre-batch draft)
    const inverseOps = buildCopilotUndoOps({
      before: preBatchData,
      ops: expandedOps,
      controls: activeCompiled.controls,
    });
    if (!inverseOps) {
      const toolResult = recordToolExchange({
        ok: false,
        errors: [{ opIndex: 0, message: 'The edit could not be undone safely. Nothing was applied.' }],
      });
      pushTurnResultMessage({
        turn,
        presentationStatus: 'not-applied',
        text: COPILOT_INVALID_EDIT_MESSAGE,
      });
      await sendContinuation(turn, toolCallId, modelStepId, toolResult, instanceDataRef.current);
      return;
    }

    // Apply through the existing Bob engine
    const applied = session.applyOps(expandedOps);
    if (!applied.ok) {
      const toolResult = recordToolExchange({
        ok: false,
        errors: applied.errors.map((err) => ({
          opIndex: typeof err.opIndex === 'number' ? err.opIndex : 0,
          ...(err.path ? { path: err.path } : {}),
          message: err.message,
        })),
      });
      pushTurnResultMessage({
        turn,
        presentationStatus: 'not-applied',
        text: COPILOT_INVALID_EDIT_MESSAGE,
      });
      await sendContinuation(turn, toolCallId, modelStepId, toolResult, instanceDataRef.current);
      return;
    }

    // Accumulate undo: prepend this batch's inverse (so undo runs in reverse order)
    turn.undoOps = [...inverseOps, ...turn.undoOps];
    turn.postApplySignature = serializeInstanceDataSignature(applied.data);

    // Record tool call + result in the model history (once each)
    const toolResult = recordToolExchange({
      ok: true,
      changedPaths: applied.changedPaths,
      postApplySignature: turn.postApplySignature,
    });

    // Update the undo UI
    const undoToken = crypto.randomUUID();
    if (threadKey) {
      setCopilotUndo(threadKey, {
        ops: turn.undoOps,
        token: undoToken,
        postApplySignature: turn.postApplySignature,
      });
    }

    const appliedText = summarizeAppliedOps(expandedOps, controlsForAi);
    const resolvedExistingMessage = resolveTurnVisibleMessages(turn, 'applied');
    pushMessage({
      role: 'assistant',
      text: appliedText,
      hasUndoAction: true,
      undoToken,
      ...(resolvedExistingMessage ? {} : { presentationStatus: 'applied' }),
    });

    // Send continuation with the successful result
    await sendContinuation(turn, toolCallId, modelStepId, toolResult, applied.data);
  }, [
    compiled,
    controlsForAi,
    finishTurn,
    pushMessage,
    pushTurnResultMessage,
    resolveTurnVisibleMessages,
    session,
    setCopilotUndo,
    threadKey,
  ]);

  // -------------------------------------------------------------------------
  // Continuation: send the next model turn with the tool result
  // -------------------------------------------------------------------------

  const sendContinuation = useCallback(async (
    turn: ActiveTurnState,
    toolCallId: string,
    priorModelStepId: string,
    toolResult: unknown,
    currentDraftData: Record<string, unknown>,
  ): Promise<void> => {
    if (turn.isStopped) return;

    if (tierStepLimit === null) {
      pushTurnResultMessage({
        turn,
        presentationStatus: 'not-applied',
        text: 'Editor policy is unavailable. The turn was not continued.',
      });
      finishTurn(turn);
      return;
    }

    // Tier step limit: refuse the next continuation past the signed limit
    if (turn.stepCount >= tierStepLimit) {
      pushTurnResultMessage({
        turn,
        presentationStatus: 'not-applied',
        text: 'Copilot reached the step limit for this turn without completing. Try a smaller change.',
      });
      finishTurn(turn);
      return;
    }

    const activeLocale = chrome.meta?.baseLocale;
    const currentInstanceId = chrome.meta?.instanceId;
    const activeCompiled = compiled;
    if (!activeLocale || !currentInstanceId || !activeCompiled) {
      pushTurnResultMessage({
        turn,
        presentationStatus: 'not-applied',
        text: 'Editor context is unavailable. The turn was not continued.',
      });
      finishTurn(turn);
      return;
    }

    const currentControlsForAi = buildProductCopilotControls({
      controls: activeCompiled.controls,
      currentConfig: currentDraftData,
    });
    const requestSignature = serializeInstanceDataSignature(currentDraftData);
    const body = {
      version: 1 as const,
      kind: 'continuation' as const,
      sessionId: copilotSessionId,
      userTurnId: turn.userTurnId,
      priorModelStepId,
      toolCallId,
      toolName: 'apply_widget_ops' as const,
      toolResult,
      conversationHistory: toWireHistory(turn.modelHistory),
      currentDraftContext: {
        instanceId: currentInstanceId,
        widgetType: activeCompiled.widgetname,
        displayName: activeCompiled.displayName,
        activeLocale,
        draftSignature: requestSignature,
        controls: currentControlsForAi,
        availableActions: currentControlsForAi.length > 0 ? ['draft_edit'] : [],
        unavailableCapabilities: [
          'saved-product-mutation',
          'publish',
          'translation-generation',
          'analytics-lookup',
          'child-agent-call',
        ],
      },
    };

    turn.stepCount++;
    startTurnRequest(turn, body);
  }, [
    chrome,
    compiled,
    copilotSessionId,
    finishTurn,
    pushTurnResultMessage,
    tierStepLimit,
  ]);

  // -------------------------------------------------------------------------
  // Turn request: start a streaming request and wire the event handler
  // -------------------------------------------------------------------------

  const startTurnRequest = useCallback((turn: ActiveTurnState, body: unknown): void => {
    const currentInstanceId = chrome.meta?.instanceId;
    if (!currentInstanceId) {
      pushTurnResultMessage({
        turn,
        presentationStatus: 'not-applied',
        text: 'Editor context is not ready. Try again in a moment.',
      });
      finishTurn(turn);
      return;
    }

    const workingMessageId = pushMessage({
      role: 'assistant',
      text: '',
      presentationStatus: 'working',
    });
    if (workingMessageId) {
      turn.unresolvedMessageIds.push(workingMessageId);
      streamingMessageIdRef.current = workingMessageId;
    }

    const handle = transport.runCopilot({
      instanceId: currentInstanceId,
      body,
      onCopilotEvent: (event) => {
        if (turn.isStopped) return; // ignore late events for stopped turn
        handleCopilotEvent(turn, event);
      },
    });

    activeHandleRef.current = {
      requestId: handle.requestId,
      cancel: () => transport.cancelCopilot(handle.requestId),
    };

    handle.completed.then(
      (result) => {
        const isCurrentRequest = activeHandleRef.current?.requestId === handle.requestId;
        if (isCurrentRequest) activeHandleRef.current = null;
        if (!result.ok && isCurrentRequest && activeTurnRef.current === turn && !turn.isStopped) {
          pushTurnResultMessage({
            turn,
            presentationStatus: 'not-applied',
            text: COPILOT_UNEXPECTED_FAILURE_MESSAGE,
          });
          finishTurn(turn);
        }
      },
      () => {
        // Request failed or timed out
        const isCurrentRequest = activeHandleRef.current?.requestId === handle.requestId;
        if (isCurrentRequest) activeHandleRef.current = null;
        if (isCurrentRequest && activeTurnRef.current === turn && !turn.isStopped) {
          pushTurnResultMessage({
            turn,
            presentationStatus: 'not-applied',
            text: COPILOT_UNEXPECTED_FAILURE_MESSAGE,
          });
          finishTurn(turn);
        }
      },
    );
  }, [chrome, finishTurn, pushMessage, pushTurnResultMessage, transport]);

  // -------------------------------------------------------------------------
  // Event handler: dispatch each ProductCopilotTurnEvent
  // -------------------------------------------------------------------------

  const handleCopilotEvent = useCallback((turn: ActiveTurnState, event: ProductCopilotTurnEvent): void => {
    switch (event.type) {
      case 'agent_turn_started':
        // Already handled at submission — nothing to do on the event
        break;

      case 'text_delta': {
        // Append streaming text to the model history
        turn.modelHistory = appendAssistantText(turn.modelHistory, event.data.text);
        // Stream the exact text while the visible message remains unresolved.
        const messageId = streamingMessageIdRef.current ?? newId();
        streamingMessageIdRef.current = messageId;
        if (!turn.unresolvedMessageIds.includes(messageId)) {
          turn.unresolvedMessageIds.push(messageId);
        }
        if (threadKey) {
          copilot.updateCopilotThread(threadKey, (current) => {
            const base = current ?? { sessionId: copilotSessionId, messages: [] };
            return {
              ...base,
              messages: appendWorkingCopilotAssistantText({
                messages: base.messages,
                messageId,
                text: event.data.text,
                ts: Date.now(),
              }),
            };
          });
        }
        break;
      }

      case 'tool_call':
        // Finalize the streaming text message (the tool execution summary follows)
        streamingMessageIdRef.current = null;
        // BUFFER the tool call — do NOT execute yet (ground rule #6).
        // Execution happens only after model_step_finished confirms the step.
        turn.bufferedToolCall = {
          toolCallId: event.data.toolCallId,
          toolName: event.data.toolName,
          input: event.data.input,
          modelStepId: event.modelStepId,
        };
        break;

      case 'model_step_finished':
        turn.modelStepId = event.modelStepId;
        // Finalize the streaming message (this step's text is complete)
        streamingMessageIdRef.current = null;
        if (event.data.finishReason === 'tool-calls') {
          // The step is confirmed complete with tool-calls finish.
          // Verify the buffered tool call carries the same modelStepId.
          if (turn.bufferedToolCall && turn.bufferedToolCall.modelStepId === event.modelStepId) {
            // Execute now — this is the ONLY place tools execute.
            void executeBufferedToolCall();
          } else {
            // tool-calls finish but no matching buffered call — visible failure
            pushTurnResultMessage({
              turn,
              presentationStatus: 'not-applied',
              text: 'Copilot requested an edit but the request was malformed. Nothing was applied.',
            });
            finishTurn(turn);
          }
        }
        // 'stop' → the terminal agent_turn_finished event follows
        // 'length' / 'content-filter' → the agent_turn_error event follows
        break;

      case 'agent_turn_finished':
        // Turn complete — finalize the streaming message and clean up
        resolveTurnVisibleMessages(turn, 'complete');
        finishTurn(turn);
        break;

      case 'agent_turn_error': {
        const message = normalizeAssistantText(event.data.message);
        pushTurnResultMessage({
          turn,
          presentationStatus: 'not-applied',
          text: message || COPILOT_UNEXPECTED_FAILURE_MESSAGE,
        });
        finishTurn(turn);
        break;
      }

      case 'agent_turn_stopped':
        // A server-originated stop remains visible if Bob did not already stop locally.
        pushTurnResultMessage({
          turn,
          presentationStatus: 'stopped',
          text: 'Stopped. Already-applied changes remain and can be undone.',
        });
        finishTurn(turn);
        break;
    }
  }, [
    copilot,
    copilotSessionId,
    executeBufferedToolCall,
    finishTurn,
    pushTurnResultMessage,
    resolveTurnVisibleMessages,
    threadKey,
  ]);

  // -------------------------------------------------------------------------
  // Send (initial) and Stop
  // -------------------------------------------------------------------------

  const applyCopilotUndo = useCallback(() => {
    if (status === 'loading' || !threadKey || !undoRecord) return;
    if (serializeInstanceDataSignature(instanceDataRef.current) !== undoRecord.postApplySignature) {
      pushMessage({ role: 'assistant', text: 'The widget changed after Copilot applied that edit. Undo was not applied.' });
      setCopilotUndo(threadKey, null);
      return;
    }
    const applied = session.applyOps(undoRecord.ops);
    if (!applied.ok) {
      pushMessage({ role: 'assistant', text: COPILOT_INVALID_EDIT_MESSAGE });
      setCopilotUndo(threadKey, null);
      return;
    }
    setCopilotUndo(threadKey, null);
    pushMessage({ role: 'assistant', text: 'Undone.' });
  }, [pushMessage, session, setCopilotUndo, status, threadKey, undoRecord]);

  const handleSend = async (promptOverride?: string) => {
    if (uiDisabledReason) return;
    if (status === 'loading') return;
    const activeCompiled = compiled;
    if (!activeCompiled) return;
    const prompt = (promptOverride ?? draft).trim();
    if (!prompt) return;

    // Undo remains Bob session interaction state and never enters model history.
    const normalized = prompt.toLowerCase();
    if (normalized === 'undo' && undoRecord) {
      setDraft('');
      pushMessage({ role: 'user', text: prompt });
      applyCopilotUndo();
      return;
    }
    if (threadKey && undoRecord) setCopilotUndo(threadKey, null);

    let sessionId = copilotSessionId;
    if (!sessionId && threadKey && compiled && widgetType) {
      sessionId = crypto.randomUUID();
      copilot.setCopilotThread(threadKey, {
        sessionId,
        messages: [
          {
            id: newId(),
            role: 'assistant',
            text: surfaceContract.initialMessage(widgetType),
            ts: Date.now(),
          },
        ],
      });
    }
    if (!sessionId) {
      pushMessage({ role: 'assistant', text: 'Copilot session not ready. Please try again in a moment.' });
      return;
    }
    if (!chrome.policy) {
      pushMessage({
        role: 'assistant',
        text: 'Editor context is not ready yet. Wait for Builder boot to complete and try again.',
      });
      return;
    }

    const activeLocale = chrome.meta?.baseLocale;
    const currentInstanceId = chrome.meta?.instanceId;
    if (!activeLocale || !currentInstanceId) {
      pushMessage({
        role: 'assistant',
        text: 'Editor context is not ready yet. Wait for Builder boot to complete and try again.',
      });
      return;
    }

    // Create the active turn state (two-fact: turn starts, no HTTP yet)
    const userTurnId = crypto.randomUUID();
    const turn: ActiveTurnState = {
      userTurnId,
      modelStepId: null,
      bufferedToolCall: null,
      modelHistory: appendUserMessage(emptyCopilotModelHistory(), prompt),
      unresolvedMessageIds: [],
      undoOps: [],
      postApplySignature: null,
      stepCount: 1, // the initial request is step 1
      isStopped: false,
    };
    activeTurnRef.current = turn;
    streamingMessageIdRef.current = null;

    if (threadKey) setCopilotTurnActive(threadKey, true);
    setStatus('loading');
    setDraft('');
    pushMessage({ role: 'user', text: prompt });

    const requestSignature = serializeInstanceDataSignature(instanceDataRef.current);
    const body = {
      version: 1 as const,
      kind: 'initial' as const,
      sessionId,
      userTurnId,
      userMessage: prompt,
      ...(allowModelPicker && selectedModel ? { selectedModel } : {}),
      conversationHistory: toWireHistory(turn.modelHistory),
      currentDraftContext: {
        instanceId: currentInstanceId,
        widgetType: activeCompiled.widgetname,
        displayName: activeCompiled.displayName,
        activeLocale,
        draftSignature: requestSignature,
        controls: controlsForAi,
        availableActions: controlsForAi.length > 0 ? ['draft_edit'] : [],
        unavailableCapabilities: [
          'saved-product-mutation',
          'publish',
          'translation-generation',
          'analytics-lookup',
          'child-agent-call',
        ],
      },
    };

    startTurnRequest(turn, body);
  };

  // -------------------------------------------------------------------------
  // Stop (ground rules: Bob's own action IS the UI truth)
  // -------------------------------------------------------------------------

  const handleStop = useCallback(() => {
    const turn = activeTurnRef.current;
    if (!turn) return;

    // Bob immediately marks the turn stopped — Bob's own action IS the UI truth.
    // Do NOT wait for agent_turn_stopped through the stream we're about to abort.
    turn.isStopped = true;

    // If an HTTP handle is active, cancel it
    if (activeHandleRef.current) {
      activeHandleRef.current.cancel();
      activeHandleRef.current = null;
    }

    // Send no later continuation (the isStopped flag prevents it)
    // Bob ignores late events (the isStopped check in onCopilotEvent prevents them)
    // Already-applied edits remain visible (session state unchanged)
    // The session-owned Undo record remains available.

    pushTurnResultMessage({
      turn,
      presentationStatus: 'stopped',
      text: 'Stopped. Already-applied changes remain and can be undone.',
    });
    finishTurn(turn);
  }, [finishTurn, pushTurnResultMessage]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const isLoading = status === 'loading';

  return (
    <section
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
      aria-label="Copilot"
    >
      <div
        ref={listRef}
        style={{
          padding: 'var(--space-3)',
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-2)',
        }}
        aria-label="Copilot conversation"
      >
        {messages.map((m) => {
          return (
            <div key={m.id} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%' }}>
              <div
                className="body-m"
                style={{
                  whiteSpace: 'pre-wrap',
                  padding: m.role === 'user' ? 'var(--space-2)' : 0,
                  borderRadius: m.role === 'user' ? 'var(--control-radius-md)' : 0,
                  border: 'none',
                  background: m.role === 'user' ? 'var(--color-system-gray-5)' : 'transparent',
                }}
              >
                {m.text}
              </div>

              {m.role === 'assistant' && m.presentationStatus ? (
                <div
                  className="body-s"
                  role="status"
                  style={{
                    color: 'var(--color-system-gray)',
                    marginTop: 'var(--space-1)',
                  }}
                >
                  {COPILOT_MESSAGE_PRESENTATION_LABELS[m.presentationStatus]}
                </div>
              ) : null}

            {m.hasUndoAction && undoRecord && m.undoToken === undoRecord.token ? (
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                <button
                  className="diet-button"
                  data-size="medium"
                  data-type="quaternary"
                  type="button"
                  disabled={isLoading}
                  onClick={applyCopilotUndo}
                >
                  <span className="diet-button__label">Undo</span>
                </button>
              </div>
            ) : null}
          </div>
          );
        })}
      </div>

      <div
        style={{
          padding: 'var(--space-3)',
          paddingTop: 'var(--space-2)',
          borderTop: '1px solid var(--color-system-gray-5)',
          background: 'var(--color-system-white)',
        }}
      >
        {allowModelPicker && modelOptions.length > 1 ? (
          <div style={{ marginBottom: 'var(--space-2)' }}>
            <select
              className="body-s"
              value={selectedModelKey}
              onChange={(event) => setSelectedModelKey(event.target.value)}
              disabled={isLoading || Boolean(uiDisabledReason)}
              aria-label="Copilot model"
              style={{
                width: '100%',
              }}
            >
              {modelOptions.map((option) => {
                const key = copilotModelKey(option);
                return (
                  <option key={key} value={key}>
                    {option.model}
                  </option>
                );
              })}
            </select>
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <input
            className="body-m"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (!isLoading && !uiDisabledReason) {
                  void handleSend();
                }
              }
            }}
            disabled={isLoading || Boolean(uiDisabledReason)}
            placeholder={uiDisabledReason ?? 'Ask Copilot to edit this widget…'}
            aria-label="Copilot message"
            style={{
              flex: 1,
              minWidth: 0,
            }}
          />

          {isLoading ? (
            <button
              className="diet-button"
              data-size="medium"
              data-type="secondary"
              type="button"
              onClick={handleStop}
              aria-label="Stop Copilot"
            >
              <span className="diet-button__label">Stop</span>
            </button>
          ) : (
            <button
              className="diet-button"
              data-size="medium"
              data-type="primary"
              type="button"
              disabled={Boolean(uiDisabledReason) || !draft.trim()}
              onClick={() => { void handleSend(); }}
              aria-label="Send to Copilot"
            >
              <span className="diet-button__label">Send</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
