import { useEffect, useMemo, useRef, useState } from 'react';
import type { WidgetOp } from '../lib/ops';
import type { CopilotMessage } from '../lib/copilot/types';
import { useWidgetSession } from '../lib/session/useWidgetSession';
import {
  labelAiModel,
  labelAiProvider,
  resolveAiAgent,
  resolveAiPolicyCapsule,
  resolveWidgetCopilotAgentId,
  WIDGET_COPILOT_AGENT_IDS,
} from '@clickeen/ck-policy';
import type { AiProvider } from '@clickeen/ck-policy';
import { resolveParisBaseUrl } from '../lib/env/paris';

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
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

function initialCopilotMessage(args: { widgetType: string; config: Record<string, unknown> }): string {
  const type = args.widgetType;
  const label = titleCase(type) || 'widget';
  return `Hello! I see you have a ${label} widget. You can ask me to change the title, colors, layout, add or edit content, adjust fonts, or modify any other settings listed in the editable controls. What would you like to customize?`;
}

type RawAiSelection = { provider: string; model: string };
type AiSelection = { provider: AiProvider; model: string };

function clampAiSelection(
  selection: RawAiSelection | null,
  policy: ReturnType<typeof resolveAiPolicyCapsule>,
): AiSelection {
  const providerCandidate = selection?.provider ? String(selection.provider).trim() : '';
  const modelCandidate = selection?.model ? String(selection.model).trim() : '';
  const allowedProviders = policy.allowedProviders ?? [];
  const provider = allowedProviders.includes(providerCandidate as AiProvider) ? (providerCandidate as AiProvider) : policy.defaultProvider;
  const providerPolicy = policy.models?.[provider];
  const defaultModel = providerPolicy?.defaultModel ?? '';
  const allowedModels = providerPolicy?.allowed ?? [];
  const model = allowedModels.includes(modelCandidate) ? modelCandidate : defaultModel;
  return { provider, model };
}

function aiStorageKey(args: { workspaceId?: string | null; subject: string }): string {
  const ws = typeof args.workspaceId === 'string' && args.workspaceId.trim() ? args.workspaceId.trim() : 'local';
  return `ck:ai.settings.v1:${args.subject}:${ws}`;
}

function readStoredAiSelection(key: string): RawAiSelection | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as any;
    const provider = typeof parsed?.provider === 'string' ? parsed.provider.trim() : '';
    const model = typeof parsed?.model === 'string' ? parsed.model.trim() : '';
    if (!provider) return null;
    return { provider, model };
  } catch {
    return null;
  }
}

function writeStoredAiSelection(key: string, value: AiSelection) {
  try {
    localStorage.setItem(key, JSON.stringify({ provider: value.provider, model: value.model }));
  } catch {
    // best-effort
  }
}

const MINIBOB_SESSION_STORAGE_KEY = 'ck:minibob.session.v1';
const MINIBOB_SESSION_EXP_SKEW_SEC = 30;

type StoredMinibobSession = { sessionToken: string; exp: number };

function readStoredMinibobSession(): StoredMinibobSession | null {
  try {
    const raw = sessionStorage.getItem(MINIBOB_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as any;
    const sessionToken = asTrimmedString(parsed?.sessionToken);
    const exp = typeof parsed?.exp === 'number' && Number.isFinite(parsed.exp) ? parsed.exp : 0;
    if (!sessionToken || !exp) return null;
    return { sessionToken, exp };
  } catch {
    return null;
  }
}

function writeStoredMinibobSession(value: StoredMinibobSession) {
  try {
    sessionStorage.setItem(MINIBOB_SESSION_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // best-effort
  }
}

function isMinibobSessionFresh(session: StoredMinibobSession): boolean {
  const nowSec = Math.floor(Date.now() / 1000);
  return session.exp > nowSec + MINIBOB_SESSION_EXP_SKEW_SEC;
}

async function mintMinibobSessionToken(): Promise<StoredMinibobSession> {
  const parisBaseUrl = resolveParisBaseUrl();
  const url = `${parisBaseUrl.replace(/\/+$/, '')}/api/ai/minibob/session`;
  const res = await fetch(url, { method: 'POST', headers: { accept: 'application/json' } });
  const text = await res.text().catch(() => '');
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
        fallback: `Minibob session request failed (${res.status}).`,
      }),
    );
  }

  const sessionToken = asTrimmedString(parsed?.sessionToken);
  const exp = typeof parsed?.exp === 'number' && Number.isFinite(parsed.exp) ? parsed.exp : 0;
  if (!sessionToken || !exp) {
    throw new Error('Minibob session service returned an invalid response.');
  }
  return { sessionToken, exp };
}

export function CopilotPane() {
  const session = useWidgetSession();
  const compiled = session.compiled;
  const canApplyOps = Boolean(compiled && compiled.controls.length > 0);

  const widgetType = compiled?.widgetname ?? null;
  const instancePublicId = session.meta?.publicId ?? null;
  const workspaceId = session.meta?.workspaceId ?? null;
  const policyProfile = session.policy?.profile ?? 'minibob';
  const subject = policyProfile === 'devstudio' || policyProfile === 'minibob' ? policyProfile : 'workspace';
  const aiSubject = subject === 'workspace' && !workspaceId ? 'minibob' : subject;
  const isMinibob = aiSubject === 'minibob';
  const widgetCopilotAgentId = useMemo(() => resolveWidgetCopilotAgentId({ policyProfile }), [policyProfile]);

  const aiPolicy = useMemo(() => {
    const resolved = resolveAiAgent(widgetCopilotAgentId);
    if (!resolved) return null;
    return resolveAiPolicyCapsule({ entry: resolved.entry, policyProfile });
  }, [policyProfile, widgetCopilotAgentId]);

  const [aiSelection, setAiSelection] = useState<AiSelection | null>(null);
  useEffect(() => {
    if (!aiPolicy) return;
    const key = aiStorageKey({ workspaceId, subject: aiSubject });
    const stored = readStoredAiSelection(key);
    const next = clampAiSelection(stored, aiPolicy);
    setAiSelection(next);
  }, [aiPolicy, workspaceId, aiSubject]);

  const showAiSettings = useMemo(() => {
    if (widgetCopilotAgentId !== WIDGET_COPILOT_AGENT_IDS.cs) return false;
    if (!aiPolicy || isMinibob || !aiSelection) return false;
    if (aiPolicy.allowProviderChoice) return true;
    const allowedModels = aiPolicy.models?.[aiSelection.provider]?.allowed ?? [];
    return Boolean(aiPolicy.allowModelChoice && allowedModels.length > 1);
  }, [aiPolicy, isMinibob, aiSelection, widgetCopilotAgentId]);

  const [draft, setDraft] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading'>('idle');

  const pendingDecisionRef = useRef(false);
  const pendingOpsRef = useRef<WidgetOp[] | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const convoKeyRef = useRef<string | null>(null);

  const threadKey = useMemo(() => {
    if (!widgetType) return null;
    return `${widgetType}:${instancePublicId ?? 'local'}`;
  }, [widgetType, instancePublicId]);

  const thread = threadKey ? session.copilotThreads?.[threadKey] ?? null : null;
  const messages = useMemo(() => thread?.messages ?? [], [thread?.messages]);
  const copilotSessionId = thread?.sessionId ?? '';

  const getPendingDecisionMessage = (): CopilotMessage | null => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === 'assistant' && msg.hasPendingDecision) return msg;
    }
    return null;
  };

  const reportOutcome = async (args: {
    event: 'ux_keep' | 'ux_undo' | 'cta_clicked';
    requestId: string;
    sessionId: string;
    timeToDecisionMs?: number;
  }) => {
    if (!args.requestId || !args.sessionId) return;
    try {
      await fetch('/api/ai/outcome', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requestId: args.requestId,
          sessionId: args.sessionId,
          event: args.event,
          occurredAtMs: Date.now(),
          ...(typeof args.timeToDecisionMs === 'number' ? { timeToDecisionMs: args.timeToDecisionMs } : {}),
        }),
      });
    } catch {
      // best-effort
    }
  };

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
    pendingOpsRef.current = null;
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
        if (isMinibob) {
          pushMessage({
            role: 'assistant',
            text: 'Create a free account to keep this change.',
          });
          return;
        }
        const pendingOps = pendingOpsRef.current ?? session.previewOps ?? null;
        if (pendingOps && pendingOps.length > 0) {
          const applied = session.applyOps(pendingOps);
          if (!applied.ok) {
            const details = applied.errors.map((e) => `${e.path ? `${e.path}: ` : ''}${e.message}`).join('\n');
            pushMessage({
              role: 'assistant',
              text: `I couldn’t keep that change because it’s no longer valid:\n${details}`,
            });
            session.clearPreviewOps();
            clearPendingDecision();
            return;
          }
        }
        session.clearPreviewOps();
        void reportOutcome({ event: 'ux_keep', requestId: pendingRequestId, sessionId: copilotSessionId, timeToDecisionMs });
        clearPendingDecision();
        pushMessage({ role: 'assistant', text: 'Great — keeping it. What would you like to change next?' });
        return;
      }
      if (normalized === 'undo') {
        setDraft('');
        pushMessage({ role: 'user', text: prompt });
        session.clearPreviewOps();
        void reportOutcome({ event: 'ux_undo', requestId: pendingRequestId, sessionId: copilotSessionId, timeToDecisionMs });
        clearPendingDecision();
        pushMessage({ role: 'assistant', text: 'Ok — reverted. What should we try instead?' });
        return;
      }
      const nudge = isMinibob
        ? 'Create a free account to keep this change, or type “undo” to revert.'
        : 'Keep or Undo? (Use the buttons above, or type “keep” / “undo”.)';
      const last = messages[messages.length - 1];
      if (!(last?.role === 'assistant' && last.text === nudge)) {
        pushMessage({ role: 'assistant', text: nudge });
      }
      return;
    }

    let sessionId = copilotSessionId;
    if (!sessionId && threadKey && compiled && canApplyOps && widgetType) {
      sessionId = crypto.randomUUID();
      session.setCopilotThread(threadKey, {
        sessionId,
        messages: [
          {
            id: newId(),
            role: 'assistant',
            text: initialCopilotMessage({ widgetType, config: session.instanceData }),
            ts: Date.now(),
          },
        ],
      });
    }
    if (!sessionId) {
      pushMessage({ role: 'assistant', text: 'Copilot session not ready. Please try again in a moment.' });
      return;
    }

    setStatus('loading');
    setDraft('');
    pushMessage({ role: 'user', text: prompt });

    try {
      let minibobSessionToken = '';
      if (isMinibob) {
        const stored = readStoredMinibobSession();
        if (stored && isMinibobSessionFresh(stored)) {
          minibobSessionToken = stored.sessionToken;
        } else {
          const minted = await mintMinibobSessionToken();
          writeStoredMinibobSession(minted);
          minibobSessionToken = minted.sessionToken;
        }
      }

      const selection =
        aiPolicy && !isMinibob && widgetCopilotAgentId === WIDGET_COPILOT_AGENT_IDS.cs
          ? clampAiSelection(aiSelection, aiPolicy)
          : null;
      const res = await fetch('/api/ai/widget-copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: widgetCopilotAgentId,
          prompt,
          widgetType,
          currentConfig: session.instanceData,
          controls: controlsForAi,
          sessionId,
          ...(isMinibob ? { sessionToken: minibobSessionToken } : {}),
          instancePublicId,
          workspaceId,
          subject: aiSubject,
          ...(selection?.provider ? { provider: selection.provider } : {}),
          ...(selection?.model ? { model: selection.model } : {}),
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
        const applied = session.setPreviewOps(ops);
        if (!applied.ok) {
          const details = applied.errors.map((e) => `${e.path ? `${e.path}: ` : ''}${e.message}`).join('\n');
          pushMessage({
            role: 'assistant',
            text: `I couldn’t apply that change because it’s not valid for this widget:\n${details}`,
          });
          setStatus('idle');
          return;
        }

        pendingOpsRef.current = ops;
        pendingDecisionRef.current = true;
        const pendingText = isMinibob
          ? `${message}\n\nCreate a free account to keep this change.`
          : `${message}\n\nWant to keep this change?`;
        const pendingCta = isMinibob && (!cta || cta.action !== 'signup')
          ? { text: 'Create a free account to keep this change', action: 'signup' as const }
          : cta;
        pushMessage({
          role: 'assistant',
          text: pendingText,
          cta: pendingCta,
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
      {showAiSettings && aiPolicy && aiSelection ? (
        <div
          style={{
            padding: 'var(--space-3)',
            paddingBottom: 'var(--space-2)',
            borderBottom: '1px solid var(--color-system-gray-5)',
            background: 'var(--color-system-white)',
          }}
        >
          <div className="label-s label-muted" style={{ marginBottom: 'var(--space-2)' }}>
            Copilot AI
          </div>
          <div style={{ display: 'grid', gap: 'var(--space-2)', gridTemplateColumns: '1fr 1fr' }}>
            {aiPolicy.allowProviderChoice ? (
              <div className="diet-textfield" data-size="md">
                <label className="diet-textfield__control">
                  <span className="diet-textfield__display-label label-s">Provider</span>
                  <select
                    className="diet-textfield__field body-s"
                    value={aiSelection.provider}
                    onChange={(event) => {
                      const nextProvider = event.target.value;
                      const clamped = clampAiSelection({ provider: nextProvider, model: '' }, aiPolicy);
                      setAiSelection(clamped);
                      writeStoredAiSelection(aiStorageKey({ workspaceId, subject: aiSubject }), clamped);
                    }}
                  >
                    {aiPolicy.allowedProviders.map((provider) => (
                      <option key={provider} value={provider}>
                        {labelAiProvider(provider)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <div className="diet-textfield" data-size="md">
                <label className="diet-textfield__control">
                  <span className="diet-textfield__display-label label-s">Provider</span>
                  <input className="diet-textfield__field body-s" value={labelAiProvider(aiSelection.provider)} readOnly />
                </label>
              </div>
            )}

            {aiPolicy.allowModelChoice && (aiPolicy.models?.[aiSelection.provider]?.allowed?.length ?? 0) > 1 ? (
              <div className="diet-textfield" data-size="md">
                <label className="diet-textfield__control">
                  <span className="diet-textfield__display-label label-s">Model</span>
                  <select
                    className="diet-textfield__field body-s"
                    value={aiSelection.model}
                    onChange={(event) => {
                      const next: AiSelection = { provider: aiSelection.provider, model: event.target.value };
                      const clamped = clampAiSelection(next, aiPolicy);
                      setAiSelection(clamped);
                      writeStoredAiSelection(aiStorageKey({ workspaceId, subject: aiSubject }), clamped);
                    }}
                  >
                    {(aiPolicy.models?.[aiSelection.provider]?.allowed ?? []).map((model) => (
                      <option key={model} value={model}>
                        {labelAiModel(model)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : (
              <div className="diet-textfield" data-size="md">
                <label className="diet-textfield__control">
                  <span className="diet-textfield__display-label label-s">Model</span>
                  <input className="diet-textfield__field body-s" value={labelAiModel(aiSelection.model)} readOnly />
                </label>
              </div>
            )}
          </div>
        </div>
      ) : null}

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
                    {cta.action === 'signup' || cta.action === 'upgrade' ? (
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
                          session.requestUpsell(cta.text);
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
                {!isMinibob ? (
                  <button
                    className="diet-btn-txt"
                    data-size="md"
                    data-variant="primary"
                    type="button"
                  onClick={() => {
                      const pendingOps = pendingOpsRef.current ?? session.previewOps ?? null;
                      if (pendingOps && pendingOps.length > 0) {
                        const applied = session.applyOps(pendingOps);
                        if (!applied.ok) {
                          const details = applied.errors.map((e) => `${e.path ? `${e.path}: ` : ''}${e.message}`).join('\n');
                          pushMessage({
                            role: 'assistant',
                            text: `I couldn’t keep that change because it’s no longer valid:\n${details}`,
                          });
                          session.clearPreviewOps();
                          clearPendingDecision();
                          return;
                        }
                      }
                      session.clearPreviewOps();
                      void reportOutcome({
                        event: 'ux_keep',
                        requestId: m.requestId || '',
                        sessionId: copilotSessionId,
                        timeToDecisionMs: Math.max(0, Date.now() - m.ts),
                      });
                      clearPendingDecision();
                      pushMessage({ role: 'assistant', text: 'Great — keeping it. What would you like to change next?' });
                    }}
                  >
                    <span className="diet-btn-txt__label">Keep</span>
                  </button>
                ) : (
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
                      session.requestUpsell('Create a free account to keep this change');
                    }}
                  >
                    <span className="diet-btn-txt__label">Create a free account to keep this change</span>
                  </button>
                )}
                <button
                  className="diet-btn-txt"
                  data-size="md"
                  data-variant="neutral"
                  type="button"
                  onClick={() => {
                    session.clearPreviewOps();
                    void reportOutcome({
                      event: 'ux_undo',
                      requestId: m.requestId || '',
                      sessionId: copilotSessionId,
                      timeToDecisionMs: Math.max(0, Date.now() - m.ts),
                    });
                    clearPendingDecision();
                    pushMessage({ role: 'assistant', text: 'Ok — reverted. What should we try instead?' });
                  }}
                  disabled={!pendingOpsRef.current && !session.previewOps}
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
