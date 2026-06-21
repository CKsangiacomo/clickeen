import { asTrimmedString, looksLikeHtmlErrorPage } from '@clickeen/ck-contracts';
import type {
  ProductCopilotControl,
  ProductCopilotRequestEnvelope,
  ProductCopilotResponse,
} from '@clickeen/ck-contracts/ai';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { WidgetOp } from '../lib/ops';
import type { CopilotMessage } from '../lib/copilot/types';
import { buildCopilotUndoOps } from '../lib/copilot/undo';
import { useWidgetSession, useWidgetSessionChrome, useWidgetSessionCopilot } from '../lib/session/useWidgetSession';
import { serializeInstanceDataSignature } from '../lib/session/sessionTypes';
import type { CompiledControl } from '../lib/types';
import { getAt } from '../lib/utils/paths';
import { evaluateShowIfExpression } from './td-menu-content/showIf';

type WidgetSessionValue = ReturnType<typeof useWidgetSession>;

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

function safeJsonParse(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function normalizeAssistantText(text: string): string {
  const candidate = (text || '').trim();
  if (!candidate) return '';
  if (looksLikeHtmlErrorPage(candidate)) return 'Copilot is temporarily unavailable (received an HTML error page). Please try again in a moment.';
  if (candidate === 'Unhandled error') return 'Copilot hit a backend timeout. Please try again (or ask for a smaller, single change).';
  if (candidate.toLowerCase().includes('empty model response')) {
    return 'Copilot got an empty response. Please try again with a smaller, more specific request.';
  }
  if (candidate.toLowerCase().includes('execution timeout')) return 'Copilot timed out. Please try again (or ask for a smaller, single change).';
  return candidate;
}

const COPILOT_INVALID_EDIT_MESSAGE = "Copilot couldn't produce a valid edit for this widget. Nothing was changed.";

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

function normalizeErrorMessage(args: { resStatus?: number; parsed?: any; bodyText?: string; fallback?: string }): string {
  const bodyText = args.bodyText || '';
  const parsed = args.parsed || null;
  const reasonKey =
    typeof parsed?.reasonKey === 'string'
      ? parsed.reasonKey
      : typeof parsed?.error?.reasonKey === 'string'
        ? parsed.error.reasonKey
        : '';
  const issueSummary = formatIssueSummary(parsed?.issues ?? parsed?.error?.issues);
  const detail =
    typeof parsed?.detail === 'string'
      ? parsed.detail
      : typeof parsed?.error?.detail === 'string'
        ? parsed.error.detail
        : '';
  const reasonKeyMessage = reasonKey ? copilotReasonKeyMessage(reasonKey) : null;
  if (reasonKey === 'coreui.errors.copilot.invalidContext' && reasonKeyMessage) {
    return `${reasonKeyMessage}${issueSummary}`;
  }
  if (reasonKeyMessage) return reasonKeyMessage;
  if (detail.trim()) return normalizeAssistantText(`${detail.trim()}${issueSummary}`);

  const parsedMessage =
    typeof parsed?.message === 'string'
      ? parsed.message
      : typeof parsed?.error?.message === 'string'
        ? parsed.error.message
        : typeof parsed?.error === 'string'
          ? parsed.error
          : '';

  const candidate = (`${parsedMessage || (parsed === null ? bodyText : '') || args.fallback || ''}${issueSummary}`).trim();
  if (!candidate) return 'Copilot failed unexpectedly. Please try again.';
  return normalizeAssistantText(candidate);
}

function newId(): string {
  return crypto.randomUUID();
}

function buildCopilotConversationHistory(thread: { messages: CopilotMessage[] } | null | undefined): ProductCopilotRequestEnvelope['conversationHistory'] {
  const messages = thread?.messages ?? [];
  return messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      role: message.role,
      text: message.text.trim().slice(0, 2000),
    }))
    .filter((message) => message.text)
    .slice(-8);
}

function buildProductCopilotControls(args: {
  controls: CompiledControl[];
  currentConfig: unknown;
}): ProductCopilotControl[] {
  const currentConfig = args.currentConfig && typeof args.currentConfig === 'object' && !Array.isArray(args.currentConfig)
    ? (args.currentConfig as Record<string, unknown>)
    : {};
  return args.controls
    .filter((control) => !control.showIf || evaluateShowIfExpression(control.showIf, currentConfig))
    .map((control) => ({
      path: control.path,
      panelId: control.panelId,
      groupId: control.groupId,
      groupLabel: control.groupLabel,
      type: control.type,
      kind: control.kind ?? '',
      label: control.label,
      options: control.options,
      enumValues: control.enumValues,
      min: control.min,
      max: control.max,
      itemIdPath: control.itemIdPath,
      currentValue: getAt(currentConfig, control.path),
    }));
}

function buildOutcomeMetadata(ops: WidgetOp[] | null, controls: Array<{ path: string; label?: string; groupId?: string; groupLabel?: string }>) {
  if (!ops || ops.length === 0) {
    return {
      opsCount: 0,
      uniquePathsTouched: 0,
      validationResult: 'not_applicable' as const,
    };
  }
  const controlsByPath = new Map(controls.map((control) => [control.path, control]));
  const paths = Array.from(new Set(ops.map((op) => op.path).filter(Boolean)));
  return {
    opsCount: ops.length,
    uniquePathsTouched: paths.length,
    touchedPaths: paths,
    touchedControls: paths
      .map((path) => {
        const control = controlsByPath.get(path);
        return {
          path,
          ...(control?.label ? { label: control.label } : {}),
          ...(control?.groupId ? { groupId: control.groupId } : {}),
          ...(control?.groupLabel ? { groupLabel: control.groupLabel } : {}),
        };
      })
      .filter((entry) => Boolean(entry.path)),
    validationResult: 'valid' as const,
  };
}

function summarizeAppliedOps(ops: WidgetOp[], controls: Array<{ path: string; label?: string }>): string {
  const byPath = new Map(controls.map((control) => [control.path, control]));
  const labels = Array.from(new Set(ops.map((op) => byPath.get(op.path)?.label).filter(Boolean))).slice(0, 3);
  if (!labels.length) return 'Changed this widget.';
  return `Changed ${labels.join(', ')}.`;
}

function initialCopilotMessage(widgetType: string): string {
  const label = titleCase(widgetType) || 'widget';
  return `You’re editing a ${label} widget in your account. Ask me for a concrete content, layout, styling, or settings change and I’ll apply it here. You can undo the last Copilot change before saving.`;
}

type CopilotSurfaceContract = {
  initialMessage: (widgetType: string) => string;
};

type SharedCopilotPaneProps = {
  session: WidgetSessionValue;
  surfaceContract: CopilotSurfaceContract;
};

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
  const compiled = session.compiled;

  const widgetType = compiled?.widgetname ?? null;
  const instanceId = chrome.meta?.instanceId ?? null;

  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading'>('idle');
  const [selectedModelKey, setSelectedModelKey] = useState('');

  const undoRef = useRef<{
    ops: WidgetOp[];
    requestId: string;
    appliedAtMs: number;
    metadata: ReturnType<typeof buildOutcomeMetadata>;
    token: string;
    postApplySignature: string;
  } | null>(null);
  const [undoAvailable, setUndoAvailable] = useState(false);
  const [activeUndoToken, setActiveUndoToken] = useState('');
  const listRef = useRef<HTMLDivElement | null>(null);
  const convoKeyRef = useRef<string | null>(null);
  const instanceDataRef = useRef(session.instanceData);

  const threadKey = useMemo(() => {
    if (!widgetType) return null;
    return `${widgetType}:${instanceId ?? 'local'}`;
  }, [widgetType, instanceId]);

  const thread = threadKey ? copilot.copilotThreads?.[threadKey] ?? null : null;
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

  const reportOutcome = async (args: {
    event: 'edit_applied' | 'edit_undone';
    requestId: string;
    sessionId: string;
    timeToDecisionMs?: number;
    metadata?: ReturnType<typeof buildOutcomeMetadata>;
  }) => {
    if (!args.requestId || !args.sessionId) return;
    try {
      await session.apiFetch('/api/ai/outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: args.requestId,
          sessionId: args.sessionId,
          event: args.event,
          occurredAtMs: Date.now(),
          ...(typeof args.timeToDecisionMs === 'number' ? { timeToDecisionMs: args.timeToDecisionMs } : {}),
          ...(args.metadata ? { metadata: args.metadata } : {}),
        }),
      });
    } catch {
      // best-effort
    }
  };

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
    if (!compiled) return 'Load an instance to begin.';
    return null;
  }, [compiled]);

  const controlsForAi = useMemo(() => {
    if (!compiled) return [];
    return buildProductCopilotControls({
      controls: compiled.controls,
      currentConfig: session.instanceData,
    });
  }, [compiled, session.instanceData]);

  const pushMessage = (msg: Omit<CopilotMessage, 'id' | 'ts'>) => {
    if (!threadKey) return;
    copilot.updateCopilotThread(threadKey, (current) => {
      const base = current ?? { sessionId: crypto.randomUUID(), messages: [] };
      return { ...base, messages: [...base.messages, { ...msg, id: newId(), ts: Date.now() }] };
    });
  };

  const handleSend = async (promptOverride?: string) => {
    if (uiDisabledReason) return;
    const activeCompiled = compiled;
    if (!activeCompiled) return;
    const prompt = (promptOverride ?? draft).trim();
    if (!prompt) return;

    const normalized = prompt.toLowerCase();
    if (normalized === 'undo' && undoRef.current) {
      setDraft('');
      pushMessage({ role: 'user', text: prompt });
      const undo = undoRef.current;
      if (serializeInstanceDataSignature(instanceDataRef.current) !== undo.postApplySignature) {
        pushMessage({ role: 'assistant', text: 'The widget changed after Copilot applied that edit. Undo was not applied.' });
        undoRef.current = null;
        setUndoAvailable(false);
        setActiveUndoToken('');
        return;
      }
      const applied = session.applyOps(undo.ops);
      if (!applied.ok) {
        pushMessage({ role: 'assistant', text: COPILOT_INVALID_EDIT_MESSAGE });
        undoRef.current = null;
        setUndoAvailable(false);
        setActiveUndoToken('');
        return;
      }
      void reportOutcome({
        event: 'edit_undone',
        requestId: undo.requestId,
        sessionId: copilotSessionId,
        timeToDecisionMs: Math.max(0, Date.now() - undo.appliedAtMs),
        metadata: undo.metadata,
      });
      undoRef.current = null;
      setUndoAvailable(false);
      setActiveUndoToken('');
      pushMessage({ role: 'assistant', text: 'Undone.' });
      return;
    }
    if (undoRef.current) {
      undoRef.current = null;
      setUndoAvailable(false);
      setActiveUndoToken('');
    }

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

    setStatus('loading');
    setDraft('');
    pushMessage({ role: 'user', text: prompt });
    const requestSignature = serializeInstanceDataSignature(instanceDataRef.current);
    const requestBaseData = instanceDataRef.current;
    const activeLocale = chrome.meta?.baseLocale;
    const instanceId = chrome.meta?.instanceId;
    if (!activeLocale || !instanceId) {
      pushMessage({
        role: 'assistant',
        text: 'Editor context is not ready yet. Wait for Builder boot to complete and try again.',
      });
      setStatus('idle');
      return;
    }
    const traceRequestId = crypto.randomUUID();
    const envelope: ProductCopilotRequestEnvelope = {
      instanceId,
      sessionId,
      userMessage: prompt,
      context: {
        version: 'product-copilot.context.v1',
        instanceId,
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
        traceRequestId,
      },
      conversationHistory: buildCopilotConversationHistory(thread),
    };

    try {
      const res = await session.apiFetch('/api/ai/widget-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...envelope,
          ...(allowModelPicker && selectedModel ? { selectedModel } : {}),
        }),
      });

      const text = await res.text();
      if (looksLikeHtmlErrorPage(text)) {
        throw new Error(normalizeAssistantText(text));
      }
      const parsed = safeJsonParse(text) as any;
      if (!res.ok) {
        throw new Error(
          normalizeErrorMessage({
            resStatus: res.status,
            parsed,
            bodyText: text,
            fallback: `Copilot request failed (${res.status}).`,
          }),
        );
      }

      const response = parsed as ProductCopilotResponse | null;
      const message = normalizeAssistantText(asTrimmedString(response?.message) || '');
      const ops = Array.isArray(response?.draftEdit?.ops) ? (response.draftEdit.ops as WidgetOp[]) : null;
      const requestId = asTrimmedString(parsed?.meta?.requestId) || asTrimmedString(parsed?.requestId);
      if (!response || !asTrimmedString(response.kind) || (!message && (!ops || ops.length === 0))) {
        throw new Error(COPILOT_INVALID_EDIT_MESSAGE);
      }

      if (response.kind === 'draft_edit' && ops && ops.length > 0) {
        if (serializeInstanceDataSignature(instanceDataRef.current) !== requestSignature) {
          pushMessage({ role: 'assistant', text: 'The widget changed while Copilot was working. Nothing was applied - try again.' });
          setStatus('idle');
          return;
        }
        const inverseOps = buildCopilotUndoOps({ before: requestBaseData, ops, controls: activeCompiled.controls });
        if (!inverseOps) {
          pushMessage({ role: 'assistant', text: COPILOT_INVALID_EDIT_MESSAGE });
          setStatus('idle');
          return;
        }
        const applied = session.applyOps(ops);
        if (!applied.ok) {
          pushMessage({ role: 'assistant', text: COPILOT_INVALID_EDIT_MESSAGE });
          setStatus('idle');
          return;
        }
        const postApplySignature = serializeInstanceDataSignature(applied.data);
        const metadata = buildOutcomeMetadata(ops, controlsForAi);
        const appliedAtMs = Date.now();
        const undoToken = crypto.randomUUID();
        undoRef.current = {
          ops: inverseOps,
          requestId: requestId || '',
          appliedAtMs,
          metadata,
          token: undoToken,
          postApplySignature,
        };
        setUndoAvailable(true);
        setActiveUndoToken(undoToken);
        void reportOutcome({
          event: 'edit_applied',
          requestId: requestId || '',
          sessionId,
          metadata,
        });
        const appliedText = summarizeAppliedOps(ops, controlsForAi);
        pushMessage({
          role: 'assistant',
          text: `${appliedText} ${message}`.trim(),
          hasUndoAction: true,
          undoToken,
          ...(requestId ? { requestId } : {}),
        });
        setStatus('idle');
        return;
      }

      pushMessage({ role: 'assistant', text: message, ...(requestId ? { requestId } : {}) });
      setStatus('idle');
    } catch (err) {
      setStatus('idle');
      const msg = err instanceof Error ? err.message : String(err);
      pushMessage({ role: 'assistant', text: msg || 'Copilot failed unexpectedly. Please try again.' });
    }
  };

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

            {m.hasUndoAction && undoAvailable && m.undoToken === activeUndoToken ? (
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                <button
                  className="diet-btn-txt"
                  data-size="md"
                  data-variant="neutral"
                  type="button"
                  onClick={() => {
                    const undo = undoRef.current;
                    if (!undo) return;
                    if (serializeInstanceDataSignature(instanceDataRef.current) !== undo.postApplySignature) {
                      pushMessage({ role: 'assistant', text: 'The widget changed after Copilot applied that edit. Undo was not applied.' });
                      undoRef.current = null;
                      setUndoAvailable(false);
                      setActiveUndoToken('');
                      return;
                    }
                    const applied = session.applyOps(undo.ops);
                    if (!applied.ok) {
                      pushMessage({ role: 'assistant', text: COPILOT_INVALID_EDIT_MESSAGE });
                      undoRef.current = null;
                      setUndoAvailable(false);
                      setActiveUndoToken('');
                      return;
                    }
                    void reportOutcome({
                      event: 'edit_undone',
                      requestId: undo.requestId,
                      sessionId: copilotSessionId,
                      timeToDecisionMs: Math.max(0, Date.now() - undo.appliedAtMs),
                      metadata: undo.metadata,
                    });
                    undoRef.current = null;
                    setUndoAvailable(false);
                    setActiveUndoToken('');
                    pushMessage({ role: 'assistant', text: 'Undone.' });
                  }}
                >
                  <span className="diet-btn-txt__label">Undo</span>
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
              disabled={status === 'loading' || Boolean(uiDisabledReason)}
              aria-label="Copilot model"
              style={{
                width: '100%',
                minHeight: 'var(--control-size-md)',
                borderRadius: 'var(--control-radius-md)',
                border: '1px solid var(--color-system-gray-5)',
                background: 'var(--color-system-white)',
                padding: 'var(--space-2)',
              }}
            >
              {modelOptions.map((option) => {
                const key = copilotModelKey(option);
                return (
                  <option key={key} value={key}>
                    {option.label}
                  </option>
                );
              })}
            </select>
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <input
            className="body-s"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="What would you like to change?"
            style={{
              flex: 1,
              padding: 'var(--space-2)',
              borderRadius: 'var(--control-radius-md)',
              border: '1px solid var(--color-system-gray-5)',
              background: 'var(--color-system-white)',
            }}
            disabled={status === 'loading' || Boolean(uiDisabledReason)}
            aria-label="Copilot prompt"
          />
          <button
            className="diet-btn-txt"
            data-size="md"
            data-variant="primary"
            type="button"
            onClick={() => {
              void handleSend();
            }}
            disabled={status === 'loading' || Boolean(uiDisabledReason) || !draft.trim()}
          >
            <span className="diet-btn-txt__label">{status === 'loading' ? '...' : 'Send'}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
