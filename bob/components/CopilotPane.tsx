import { useEffect, useMemo, useRef, useState } from 'react';
import type { WidgetOp } from '../lib/ops';
import type { CopilotMessage } from '../lib/copilot/types';
import { useWidgetSession } from '../lib/session/useWidgetSession';

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

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

function newId(): string {
  return crypto.randomUUID();
}

function countFaqQuestions(config: Record<string, unknown>): number | null {
  const sections = config.sections;
  if (!Array.isArray(sections)) return null;
  let total = 0;
  for (const section of sections) {
    if (!isRecord(section)) continue;
    const faqs = section.faqs;
    if (!Array.isArray(faqs)) continue;
    total += faqs.length;
  }
  return total;
}

function initialCopilotMessage(args: { widgetType: string; config: Record<string, unknown> }): string {
  const type = args.widgetType;
  if (type === 'faq') {
    const count = countFaqQuestions(args.config);
    const countText =
      typeof count === 'number'
        ? `${count} ${count === 1 ? 'question' : 'questions'}`
        : 'a few questions';
    return `Hello! I see you have an FAQ widget with ${countText}. You can ask me to change the title, colors, layout, add or edit questions, adjust fonts, or modify any other settings listed in the editable controls. What would you like to customize?`;
  }

  const label = titleCase(type) || 'widget';
  return `Hello! I see you have a ${label} widget. You can ask me to change the title, colors, layout, add or edit content, adjust fonts, or modify any other settings listed in the editable controls. What would you like to customize?`;
}

export function CopilotPane() {
  const session = useWidgetSession();
  const compiled = session.compiled;
  const canApplyOps = Boolean(compiled && compiled.controls.length > 0);

  const widgetType = compiled?.widgetname ?? null;
  const instancePublicId = session.meta?.publicId ?? null;

  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading'>('idle');
  const [error, setError] = useState<string | null>(null);

  const pendingDecisionRef = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const convoKeyRef = useRef<string | null>(null);

  const threadKey = useMemo(() => {
    if (!widgetType) return null;
    return `${widgetType}:${instancePublicId ?? 'local'}`;
  }, [widgetType, instancePublicId]);

  const thread = threadKey ? session.copilotThreads?.[threadKey] ?? null : null;
  const messages = thread?.messages ?? [];
  const copilotSessionId = thread?.sessionId ?? '';

  useEffect(() => {
    if (!threadKey || !compiled || !canApplyOps || !widgetType) return;
    if (thread && thread.messages.length > 0) return;

    session.setCopilotThread(threadKey, {
      sessionId: crypto.randomUUID(),
      messages: [{ id: newId(), role: 'assistant', text: initialCopilotMessage({ widgetType, config: session.instanceData }), ts: Date.now() }],
    });
  }, [threadKey, compiled, canApplyOps, widgetType, thread, session]);

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
    session.updateCopilotThread(threadKey, (current) => {
      const base = current ?? { sessionId: crypto.randomUUID(), messages: [] };
      return { ...base, messages: [...base.messages, { ...msg, id: newId(), ts: Date.now() }] };
    });
  };

  const clearPendingDecision = () => {
    pendingDecisionRef.current = false;
    if (!threadKey) return;
    session.updateCopilotThread(threadKey, (current) => {
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

    // If there's a pending decision, treat the next user message as "keep" by default.
    if (pendingDecisionRef.current) {
      session.commitLastOps();
      clearPendingDecision();
    }

    setError(null);
    setStatus('loading');
    setDraft('');
    pushMessage({ role: 'user', text: prompt });

    try {
      if (!copilotSessionId) {
        throw new Error('Copilot session not ready.');
      }

      const res = await fetch('/api/ai/sdr-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          widgetType,
          currentConfig: session.instanceData,
          controls: controlsForAi,
          sessionId: copilotSessionId,
          instancePublicId,
        }),
      });

      const text = await res.text();
      const parsed = safeJsonParse(text) as any;
      if (!res.ok) {
        const message =
          typeof parsed?.message === 'string'
            ? parsed.message
            : typeof parsed?.error?.message === 'string'
              ? parsed.error.message
              : typeof parsed?.error === 'string'
                ? parsed.error
                : text || `AI request failed (${res.status})`;
        throw new Error(message);
      }

      const message = asTrimmedString(parsed?.message) || 'Done.';
      const cta = parsed?.cta && typeof parsed.cta === 'object' ? parsed.cta : undefined;
      const ops = Array.isArray(parsed?.ops) ? (parsed.ops as WidgetOp[]) : null;

      if (ops && ops.length > 0) {
        const applied = session.applyOps(ops);
        if (!applied.ok) {
          const details = applied.errors.map((e) => `${e.path ? `${e.path}: ` : ''}${e.message}`).join('\n');
          pushMessage({
            role: 'assistant',
            text: `I couldn’t apply that change because it’s not valid for this widget:\n${details}`,
          });
          setStatus('idle');
          return;
        }

        pendingDecisionRef.current = true;
        pushMessage({
          role: 'assistant',
          text: `${message}\n\nWant to keep this change?`,
          cta,
          hasPendingDecision: true,
        });
        setStatus('idle');
        return;
      }

      pushMessage({ role: 'assistant', text: message, cta });
      setStatus('idle');
    } catch (err) {
      setStatus('idle');
      setError(err instanceof Error ? err.message : String(err));
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
            {messages.map((m) => (
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

            {m.cta?.text ? (
              <div style={{ marginTop: 'var(--space-1)' }}>
                <a
                  className="diet-btn-txt"
                  data-size="md"
                  data-variant="primary"
                  href={m.cta.url || '#'}
                  target={m.cta.url ? '_blank' : undefined}
                  rel={m.cta.url ? 'noreferrer' : undefined}
                >
                  <span className="diet-btn-txt__label">{m.cta.text}</span>
                </a>
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
                    session.commitLastOps();
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
                    session.undoLastOps();
                    clearPendingDecision();
                    pushMessage({ role: 'assistant', text: 'Ok — reverted. What should we try instead?' });
                  }}
                  disabled={!session.canUndo}
                >
                  <span className="diet-btn-txt__label">Undo</span>
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div
        style={{
          padding: 'var(--space-3)',
          paddingTop: 'var(--space-2)',
          borderTop: '1px solid var(--color-system-gray-5)',
          background: 'var(--color-system-white)',
        }}
      >
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

        {error ? (
          <pre className="caption" style={{ whiteSpace: 'pre-wrap', marginTop: 'var(--space-2)' }}>
            {error}
          </pre>
        ) : null}
      </div>
    </section>
  );
}
