import { useEffect, useMemo, useRef, useState } from 'react';
import type { WidgetOp } from '../lib/ops';
import type { CopilotMessage } from '../lib/copilot/types';
import { useWidgetSession, useWidgetSessionChrome, useWidgetSessionCopilot } from '../lib/session/useWidgetSession';

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

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

function looksLikeHtml(text: string): boolean {
  const s = (text || '').trim().slice(0, 2000).toLowerCase();
  if (!s) return false;
  return (
    s.startsWith('<!doctype html') ||
    s.startsWith('<html') ||
    s.includes('<html') ||
    s.includes('id="cf-wrapper"') ||
    s.includes("id='cf-wrapper'") ||
    s.includes('cloudflare.com/5xx-error-landing')
  );
}

function normalizeAssistantText(text: string): string {
  const candidate = (text || '').trim();
  if (!candidate) return 'Done.';
  if (looksLikeHtml(candidate)) return 'Copilot is temporarily unavailable (received an HTML error page). Please try again in a moment.';
  if (candidate === 'Unhandled error') return 'Copilot hit a backend timeout. Please try again (or ask for a smaller, single change).';
  if (candidate.toLowerCase().includes('empty model response')) {
    return 'Copilot got an empty response. Please try again with a smaller, more specific request.';
  }
  if (candidate.toLowerCase().includes('execution timeout')) return 'Copilot timed out. Please try again (or ask for a smaller, single change).';
  return candidate;
}

function normalizeErrorMessage(args: { resStatus?: number; parsed?: any; bodyText?: string; fallback?: string }): string {
  const bodyText = args.bodyText || '';
  const parsed = args.parsed || null;

  const parsedMessage =
    typeof parsed?.message === 'string'
      ? parsed.message
      : typeof parsed?.error?.message === 'string'
        ? parsed.error.message
        : typeof parsed?.error === 'string'
          ? parsed.error
          : '';

  const candidate = (parsedMessage || bodyText || args.fallback || '').trim();
  if (!candidate) return 'Copilot failed unexpectedly. Please try again.';
  return normalizeAssistantText(candidate);
}

function newId(): string {
  return crypto.randomUUID();
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

function initialCopilotMessage(widgetType: string): string {
  const label = titleCase(widgetType) || 'widget';
  return `You’re editing a ${label} widget in your account. Ask me for a concrete content, layout, styling, or settings change and I’ll stage it for review.`;
}

type CopilotSurfaceContract = {
  initialMessage: (widgetType: string) => string;
  pendingMessageText: (message: string) => string;
  pendingNudge: string;
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
      pendingMessageText: (message) => `${message}\n\nWant to keep this change?`,
      pendingNudge: 'Keep or Undo? (Use the buttons above, or type “keep” / “undo”.)',
    };
  }, []);

  return <SharedCopilotPane session={session} surfaceContract={surfaceContract} />;
}

function SharedCopilotPane({ session, surfaceContract }: SharedCopilotPaneProps) {
  const chrome = useWidgetSessionChrome();
  const copilot = useWidgetSessionCopilot();
  const compiled = session.compiled;
  const canApplyOps = Boolean(compiled && compiled.controls.length > 0);

  const widgetType = compiled?.widgetname ?? null;
  const instanceId = chrome.meta?.instanceId ?? null;

  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading'>('idle');
  const [selectedModelKey, setSelectedModelKey] = useState('');

  const pendingDecisionRef = useRef(false);
  const pendingOpsRef = useRef<WidgetOp[] | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const convoKeyRef = useRef<string | null>(null);

  const threadKey = useMemo(() => {
    if (!widgetType) return null;
    return `${widgetType}:${instanceId ?? 'local'}`;
  }, [widgetType, instanceId]);

  const thread = threadKey ? copilot.copilotThreads?.[threadKey] ?? null : null;
  const messages = useMemo(() => thread?.messages ?? [], [thread?.messages]);
  const copilotSessionId = thread?.sessionId ?? '';
  const modelOptions = useMemo(() => chrome.copilot?.modelOptions ?? [], [chrome.copilot?.modelOptions]);
  const defaultModel = chrome.copilot?.selectedModel ?? chrome.copilot?.defaultModel ?? null;
  const selectedModel = useMemo(() => {
    const key = selectedModelKey || (defaultModel ? `${defaultModel.provider}:${defaultModel.model}` : '');
    return modelOptions.find((option) => `${option.provider}:${option.model}` === key) ?? defaultModel;
  }, [defaultModel, modelOptions, selectedModelKey]);

  useEffect(() => {
    if (!defaultModel) {
      setSelectedModelKey('');
      return;
    }
    const defaultKey = `${defaultModel.provider}:${defaultModel.model}`;
    setSelectedModelKey((current) => {
      if (current && modelOptions.some((option) => `${option.provider}:${option.model}` === current)) return current;
      return defaultKey;
    });
  }, [defaultModel, modelOptions]);

  const getPendingDecisionMessage = (): CopilotMessage | null => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'assistant' && msg.hasPendingDecision) return msg;
    }
    return null;
  };

  const reportOutcome = async (args: {
    event: 'edit_applied' | 'edit_undone' | 'cta_clicked';
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
    if (!threadKey || !compiled || !canApplyOps || !widgetType) return;
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
  }, [threadKey, compiled, canApplyOps, widgetType, thread, copilot, surfaceContract]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  useEffect(() => {
    if (!threadKey) return;
    convoKeyRef.current = threadKey;
    pendingDecisionRef.current = messages.some((m) => Boolean(m.hasPendingDecision));
  }, [threadKey, messages]);

  const uiDisabledReason = useMemo(() => {
    if (!compiled) return 'Load an instance to begin.';
    if (!canApplyOps) return `Ops are not enabled for "${compiled.widgetname}" yet.`;
    return null;
  }, [compiled, canApplyOps]);

  const controlsForAi = useMemo(() => {
    if (!compiled) return [];
    return compiled.controls.map((c) => ({
      path: c.path,
      panelId: c.panelId,
      groupId: c.groupId,
      groupLabel: c.groupLabel,
      type: c.type,
      kind: c.kind,
      label: c.label,
      options: c.options,
      enumValues: c.enumValues,
      min: c.min,
      max: c.max,
      itemIdPath: c.itemIdPath,
    }));
  }, [compiled]);

  const pushMessage = (msg: Omit<CopilotMessage, 'id' | 'ts'>) => {
    if (!threadKey) return;
    copilot.updateCopilotThread(threadKey, (current) => {
      const base = current ?? { sessionId: crypto.randomUUID(), messages: [] };
      return { ...base, messages: [...base.messages, { ...msg, id: newId(), ts: Date.now() }] };
    });
  };

  const clearPendingDecision = () => {
    pendingDecisionRef.current = false;
    pendingOpsRef.current = null;
    if (!threadKey) return;
    copilot.updateCopilotThread(threadKey, (current) => {
      const base = current ?? { sessionId: crypto.randomUUID(), messages: [] };
      return {
        ...base,
        messages: base.messages.map((m) => (m.hasPendingDecision ? { ...m, hasPendingDecision: false } : m)),
      };
    });
  };

  const handleSend = async () => {
    if (uiDisabledReason) return;
    const prompt = draft.trim();
    if (!prompt) return;

    // If there's a pending decision, block new requests until the user explicitly keeps or undoes.
    if (pendingDecisionRef.current) {
      const pending = getPendingDecisionMessage();
      const pendingRequestId = pending?.requestId || '';
      const pendingTs = pending?.ts;
      const timeToDecisionMs = typeof pendingTs === 'number' ? Math.max(0, Date.now() - pendingTs) : undefined;

      const normalized = prompt.toLowerCase();
      if (normalized === 'keep') {
        setDraft('');
        pushMessage({ role: 'user', text: prompt });
        const pendingOps = pendingOpsRef.current;
        if (pendingOps && pendingOps.length > 0) {
          const applied = session.applyOps(pendingOps);
          if (!applied.ok) {
            const details = applied.errors.map((e) => `${e.path ? `${e.path}: ` : ''}${e.message}`).join('\n');
            pushMessage({
              role: 'assistant',
              text: `I couldn’t keep that change because it’s no longer valid:\n${details}`,
            });
            clearPendingDecision();
            return;
          }
        }
        void reportOutcome({
          event: 'edit_applied',
          requestId: pendingRequestId,
          sessionId: copilotSessionId,
          timeToDecisionMs,
          metadata: buildOutcomeMetadata(pendingOps, controlsForAi),
        });
        clearPendingDecision();
        pushMessage({ role: 'assistant', text: 'Great — keeping it. What would you like to change next?' });
        return;
      }
      if (normalized === 'undo') {
        setDraft('');
        pushMessage({ role: 'user', text: prompt });
        void reportOutcome({
          event: 'edit_undone',
          requestId: pendingRequestId,
          sessionId: copilotSessionId,
          timeToDecisionMs,
          metadata: buildOutcomeMetadata(pendingOpsRef.current, controlsForAi),
        });
        clearPendingDecision();
        pushMessage({ role: 'assistant', text: 'Ok — reverted. What should we try instead?' });
        return;
      }
      const nudge = surfaceContract.pendingNudge;
      const last = messages[messages.length - 1];
      if (!(last?.role === 'assistant' && last.text === nudge)) {
        pushMessage({ role: 'assistant', text: nudge });
      }
      return;
    }

    let sessionId = copilotSessionId;
    if (!sessionId && threadKey && compiled && canApplyOps && widgetType) {
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

    try {
      const res = await session.apiFetch('/api/ai/widget-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          currentConfig: session.instanceData,
          controls: controlsForAi,
          sessionId,
          ...(selectedModel ? { selectedModel } : {}),
        }),
      });

      const text = await res.text();
      if (looksLikeHtml(text)) {
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

      const message = normalizeAssistantText(asTrimmedString(parsed?.message) || 'Done.');
      const cta = parsed?.cta && typeof parsed.cta === 'object' ? parsed.cta : undefined;
      const ops = Array.isArray(parsed?.ops) ? (parsed.ops as WidgetOp[]) : null;
      const requestId = asTrimmedString(parsed?.meta?.requestId) || asTrimmedString(parsed?.requestId);

      if (ops && ops.length > 0) {
        pendingOpsRef.current = ops;
        pendingDecisionRef.current = true;
        const pendingText = surfaceContract.pendingMessageText(message);
        pushMessage({
          role: 'assistant',
          text: pendingText,
          cta,
          hasPendingDecision: true,
          ...(requestId ? { requestId } : {}),
        });
        setStatus('idle');
        return;
      }

      pushMessage({ role: 'assistant', text: message, cta, ...(requestId ? { requestId } : {}) });
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
          const cta = m.cta;
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

                {cta?.text ? (
                  <div style={{ marginTop: 'var(--space-1)' }}>
                    {cta.action === 'upgrade' ? (
                      <button
                        className="diet-btn-txt"
                        data-size="md"
                        data-variant="primary"
                        type="button"
                        onClick={() => {
                          void reportOutcome({
                            event: 'cta_clicked',
                            requestId: m.requestId || '',
                            sessionId: copilotSessionId,
                          });
                          chrome.requestUpsell(cta.text);
                        }}
                      >
                        <span className="diet-btn-txt__label">{cta.text}</span>
                      </button>
                    ) : (
                      <a
                        className="diet-btn-txt"
                        data-size="md"
                        data-variant="primary"
                        href={cta.url || '#'}
                        target={cta.url ? '_blank' : undefined}
                        rel={cta.url ? 'noreferrer' : undefined}
                        onClick={() => {
                          void reportOutcome({
                            event: 'cta_clicked',
                            requestId: m.requestId || '',
                            sessionId: copilotSessionId,
                          });
                        }}
                      >
                        <span className="diet-btn-txt__label">{cta.text}</span>
                      </a>
                    )}
                  </div>
                ) : null}

            {m.hasPendingDecision ? (
              <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
                <button
                  className="diet-btn-txt"
                  data-size="md"
                  data-variant="primary"
                  type="button"
                  onClick={() => {
                    const pendingOps = pendingOpsRef.current;
                    if (pendingOps && pendingOps.length > 0) {
                      const applied = session.applyOps(pendingOps);
                      if (!applied.ok) {
                        const details = applied.errors.map((e) => `${e.path ? `${e.path}: ` : ''}${e.message}`).join('\n');
                        pushMessage({
                          role: 'assistant',
                          text: `I couldn’t keep that change because it’s no longer valid:\n${details}`,
                        });
                        clearPendingDecision();
                        return;
                      }
                    }
                    void reportOutcome({
                      event: 'edit_applied',
                      requestId: m.requestId || '',
                      sessionId: copilotSessionId,
                      timeToDecisionMs: Math.max(0, Date.now() - m.ts),
                      metadata: buildOutcomeMetadata(pendingOps, controlsForAi),
                    });
                    clearPendingDecision();
                    pushMessage({ role: 'assistant', text: 'Great — keeping it. What would you like to change next?' });
                  }}
                >
                  <span className="diet-btn-txt__label">Keep</span>
                </button>
                <button
                  className="diet-btn-txt"
                  data-size="md"
                  data-variant="neutral"
                  type="button"
                  onClick={() => {
                    void reportOutcome({
                      event: 'edit_undone',
                      requestId: m.requestId || '',
                      sessionId: copilotSessionId,
                      timeToDecisionMs: Math.max(0, Date.now() - m.ts),
                      metadata: buildOutcomeMetadata(pendingOpsRef.current, controlsForAi),
                    });
                    clearPendingDecision();
                    pushMessage({ role: 'assistant', text: 'Ok — reverted. What should we try instead?' });
                  }}
                  disabled={!pendingOpsRef.current}
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
        {chrome.copilot?.allowModelPicker && modelOptions.length > 1 ? (
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
                const key = `${option.provider}:${option.model}`;
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
            onClick={handleSend}
            disabled={status === 'loading' || Boolean(uiDisabledReason) || !draft.trim()}
          >
            <span className="diet-btn-txt__label">{status === 'loading' ? '...' : 'Send'}</span>
          </button>
        </div>
      </div>
    </section>
  );
}
