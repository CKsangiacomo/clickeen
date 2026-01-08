'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { CompiledWidget } from '../types';
import type { ApplyWidgetOpsResult, WidgetOp, WidgetOpError } from '../ops';
import { applyWidgetOps } from '../ops';
import type { CopilotThread } from '../copilot/types';
import type { Policy } from '@clickeen/ck-policy';
import { can, resolvePolicy as resolveCkPolicy } from '@clickeen/ck-policy';
import { persistConfigAssetsToTokyo } from '../assets/persistConfigAssetsToTokyo';

type UpdateMeta = {
  source: 'field' | 'load' | 'external' | 'ops' | 'unknown';
  path: string;
  ts: number;
};

type SessionError =
  | { source: 'load'; message: string }
  | { source: 'ops'; errors: WidgetOpError[] }
  | { source: 'publish'; message: string; paths?: string[] };

type PreviewSettings = {
  device: 'desktop' | 'mobile';
  theme: 'light' | 'dark';
  host: 'canvas' | 'column' | 'banner' | 'floating';
};

type SubjectMode = 'devstudio' | 'minibob';

type SessionState = {
  compiled: CompiledWidget | null;
  instanceData: Record<string, unknown>;
  isDirty: boolean;
  policy: Policy;
  upsell: { reasonKey: string; detail?: string; cta: 'signup' | 'upgrade' } | null;
  isPublishing: boolean;
  preview: PreviewSettings;
  selectedPath: string | null;
  lastUpdate: UpdateMeta | null;
  undoSnapshot: Record<string, unknown> | null;
  error: SessionError | null;
  copilotThreads: Record<string, CopilotThread>;
  meta: {
    publicId?: string;
    workspaceId?: string;
    widgetname?: string;
    label?: string;
  } | null;
};

type WidgetBootstrapMessage = {
  type: 'devstudio:load-instance';
  widgetname: string;
  compiled: CompiledWidget;
  instanceData?: Record<string, unknown> | null;
  policy?: Policy;
  publicId?: string;
  workspaceId?: string;
  label?: string;
  subjectMode?: SubjectMode;
};

type DevstudioExportInstanceDataMessage = {
  type: 'devstudio:export-instance-data';
  requestId: string;
  persistAssets?: boolean;
};

type BobExportInstanceDataResponseMessage = {
  type: 'bob:export-instance-data';
  requestId: string;
  ok: boolean;
  error?: string;
  instanceData?: Record<string, unknown>;
  meta?: SessionState['meta'];
  isDirty?: boolean;
};

type BobPublishedMessage = {
  type: 'bob:published';
  publicId: string;
  workspaceId: string;
  widgetType: string;
  status: 'published';
  config: Record<string, unknown>;
};

const DEFAULT_PREVIEW: PreviewSettings = {
  device: 'desktop',
  theme: 'light',
  host: 'canvas',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function assertPolicy(value: unknown): Policy {
  if (!isRecord(value)) throw new Error('[useWidgetSession] policy must be an object');
  if (value.v !== 1) throw new Error('[useWidgetSession] policy.v must be 1');
  if (typeof value.profile !== 'string' || !value.profile) throw new Error('[useWidgetSession] policy.profile must be a string');
  if (typeof value.role !== 'string' || !value.role) throw new Error('[useWidgetSession] policy.role must be a string');
  if (!isRecord(value.flags)) throw new Error('[useWidgetSession] policy.flags must be an object');
  if (!isRecord(value.caps)) throw new Error('[useWidgetSession] policy.caps must be an object');
  if (!isRecord(value.budgets)) throw new Error('[useWidgetSession] policy.budgets must be an object');
  return value as Policy;
}

function resolveSubjectModeFromUrl(): SubjectMode {
  if (typeof window === 'undefined') return 'devstudio';
  const params = new URLSearchParams(window.location.search);
  const subject = (params.get('subject') || '').trim().toLowerCase();
  if (subject === 'minibob') return 'minibob';
  if (subject === 'devstudio') return 'devstudio';
  // Backward compat: existing Minibob param.
  if (params.get('minibob') === 'true') return 'minibob';
  return 'devstudio';
}

function resolveDevPolicy(profile: SubjectMode): Policy {
  return resolveCkPolicy({ profile, role: 'editor' });
}

function useWidgetSessionInternal() {
  const initialSubjectMode = resolveSubjectModeFromUrl();
  const initialPolicy = resolveDevPolicy(initialSubjectMode);

  const [state, setState] = useState<SessionState>(() => ({
    compiled: null,
    instanceData: {},
    isDirty: false,
    policy: initialPolicy,
    upsell: null,
    isPublishing: false,
    preview: DEFAULT_PREVIEW,
    selectedPath: null,
    lastUpdate: null,
    undoSnapshot: null,
    error: null,
    copilotThreads: {},
    meta: null,
  }));

  const stateRef = useRef(state);
  stateRef.current = state;

  const applyOps = useCallback(
    (ops: WidgetOp[]): ApplyWidgetOpsResult => {
      const compiled = state.compiled;
      if (!compiled || compiled.controls.length === 0) {
        const result: ApplyWidgetOpsResult = {
          ok: false,
          errors: [{ opIndex: 0, message: 'This widget did not compile with controls[]' }],
        };
        setState((prev) => ({ ...prev, error: { source: 'ops', errors: result.errors } }));
        return result;
      }

      // Policy enforcement (gate on interaction; fail-closed).
      const denyOps = (
        opIndex: number,
        path: string | undefined,
        decision: { reasonKey: string; detail?: string }
      ) => {
        const result: ApplyWidgetOpsResult = {
          ok: false,
          errors: [{ opIndex, path, message: decision.reasonKey }],
        };
        setState((prev) => ({
          ...prev,
          error: null,
          upsell: {
            reasonKey: decision.reasonKey,
            detail: decision.detail,
            cta: prev.policy.profile === 'minibob' ? 'signup' : 'upgrade',
          },
        }));
        return result;
      };

      const denyCap = (opIndex: number, path: string | undefined, capKey: string, max: number) =>
        denyOps(opIndex, path, {
          reasonKey: 'coreui.upsell.reason.capReached',
          detail: `${capKey} reached (max=${max}).`,
        });

      for (let idx = 0; idx < ops.length; idx += 1) {
        const op = ops[idx] as any;
        if (!op || typeof op !== 'object') continue;

        if (op.op === 'set' && op.path === 'seoGeo.enabled' && op.value === true) {
          const decision = can(state.policy, 'embed.seoGeo.toggle');
          if (!decision.allow) return denyOps(idx, 'seoGeo.enabled', decision);
        }

        if (op.op === 'insert' && op.path === 'sections') {
          const currentSections = Array.isArray((state.instanceData as any).sections)
            ? ((state.instanceData as any).sections as unknown[]).length
            : 0;
          const decision = can(state.policy, 'widget.faq.section.add', { currentSections });
          if (!decision.allow) return denyOps(idx, op.path, decision);
        }

        if (op.op === 'insert' && typeof op.path === 'string' && /^sections\\.(\\d+)\\.faqs$/.test(op.path)) {
          const match = op.path.match(/^sections\\.(\\d+)\\.faqs$/);
          const sectionIndex = match ? Number(match[1]) : -1;
          const sections = Array.isArray((state.instanceData as any).sections)
            ? ((state.instanceData as any).sections as any[])
            : [];
          const currentQaInSection =
            sectionIndex >= 0 && sectionIndex < sections.length && Array.isArray(sections[sectionIndex]?.faqs)
              ? sections[sectionIndex].faqs.length
              : 0;
          const currentQaTotal = sections.reduce(
            (sum, section) => sum + (Array.isArray(section?.faqs) ? section.faqs.length : 0),
            0
          );
          const decision = can(state.policy, 'widget.faq.qa.add', { currentQaInSection, currentQaTotal });
          if (!decision.allow) return denyOps(idx, op.path, decision);
        }

        // Dieter array controls (object-manager/repeater) mutate arrays via `set` of the full array value
        // (not `insert`), so we must enforce caps on the resulting array length (fail-closed).
        if (op.op === 'set' && op.path === 'sections' && Array.isArray(op.value)) {
          const max = state.policy.caps['widget.faq.sections.max'];
          if (typeof max === 'number' && Number.isFinite(max) && op.value.length > max) {
            return denyCap(idx, op.path, 'widget.faq.sections.max', max);
          }
        }

        if (op.op === 'set' && typeof op.path === 'string' && Array.isArray(op.value)) {
          const matchDot = op.path.match(/^sections\.(\d+)\.faqs$/);
          const matchBracket = op.path.match(/^sections\[(\d+)\]\.faqs$/);
          const sectionIndex = matchDot ? Number(matchDot[1]) : matchBracket ? Number(matchBracket[1]) : -1;
          if (sectionIndex >= 0) {
            const sections = Array.isArray((state.instanceData as any).sections)
              ? ((state.instanceData as any).sections as any[])
              : [];
            const currentQaTotal = sections.reduce(
              (sum, section) => sum + (Array.isArray(section?.faqs) ? section.faqs.length : 0),
              0
            );
            const currentQaInSection =
              sectionIndex >= 0 && sectionIndex < sections.length && Array.isArray(sections[sectionIndex]?.faqs)
                ? sections[sectionIndex].faqs.length
                : 0;

            const nextQaInSection = (op.value as unknown[]).length;
            const nextQaTotal = currentQaTotal - currentQaInSection + nextQaInSection;

            const maxTotal = state.policy.caps['widget.faq.qa.max'];
            if (typeof maxTotal === 'number' && Number.isFinite(maxTotal) && nextQaTotal > maxTotal) {
              return denyCap(idx, op.path, 'widget.faq.qa.max', maxTotal);
            }

            const maxPerSection = state.policy.caps['widget.faq.qaPerSection.max'];
            if (typeof maxPerSection === 'number' && Number.isFinite(maxPerSection) && nextQaInSection > maxPerSection) {
              return denyCap(idx, op.path, 'widget.faq.qaPerSection.max', maxPerSection);
            }
          }
        }
      }

      const applied = applyWidgetOps({
        data: state.instanceData,
        ops,
        controls: compiled.controls,
      });

      if (!applied.ok) {
        setState((prev) => ({ ...prev, error: { source: 'ops', errors: applied.errors } }));
        return applied;
      }

      setState((prev) => ({
        ...prev,
        undoSnapshot: prev.instanceData,
        instanceData: applied.data,
        isDirty: true,
        error: null,
        upsell: null,
        lastUpdate: {
          source: 'ops',
          path: ops[0]?.path || '',
          ts: Date.now(),
        },
      }));

      return applied;
    },
    [state.compiled, state.instanceData, state.policy]
  );

  const undoLastOps = useCallback(() => {
    setState((prev) => {
      if (!prev.undoSnapshot) return prev;
      return {
        ...prev,
        instanceData: prev.undoSnapshot,
        undoSnapshot: null,
        isDirty: true,
        lastUpdate: {
          source: 'ops',
          path: '',
          ts: Date.now(),
        },
      };
    });
  }, []);

  const commitLastOps = useCallback(() => {
    setState((prev) => {
      if (!prev.undoSnapshot) return prev;
      return { ...prev, undoSnapshot: null };
    });
  }, []);

  const loadInstance = useCallback(async (message: WidgetBootstrapMessage) => {
    try {
      const compiled = message.compiled;
      if (!compiled) {
        throw new Error('[useWidgetSession] Missing compiled widget payload');
      }
      if (compiled.controls.length === 0) {
        throw new Error('[useWidgetSession] Widget compiled without controls[]');
      }

      if (!compiled.defaults || typeof compiled.defaults !== 'object' || Array.isArray(compiled.defaults)) {
        throw new Error('[useWidgetSession] compiled.defaults must be an object');
      }
      const defaults = compiled.defaults as Record<string, unknown>;

      let resolved: Record<string, unknown> = {};
      let nextWorkspaceId = message.workspaceId;

      const nextSubjectMode: SubjectMode = message.subjectMode ?? resolveSubjectModeFromUrl();
      let nextPolicy: Policy = resolveDevPolicy(nextSubjectMode);

      const incoming = message.instanceData as Record<string, unknown> | null | undefined;
      if (incoming != null && (!incoming || typeof incoming !== 'object' || Array.isArray(incoming))) {
        throw new Error('[useWidgetSession] instanceData must be an object');
      }

      if (message.policy && typeof message.policy === 'object') {
        nextPolicy = assertPolicy(message.policy);
      }

      if (incoming == null && message.publicId && message.workspaceId && !message.policy) {
        const url = `/api/paris/instance/${encodeURIComponent(message.publicId)}?workspaceId=${encodeURIComponent(
          message.workspaceId
        )}&subject=${encodeURIComponent(nextSubjectMode)}`;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`[useWidgetSession] Failed to load instance from Paris (HTTP ${res.status})`);
        const json = (await res.json().catch(() => null)) as any;
        if (!json || typeof json !== 'object') {
          throw new Error('[useWidgetSession] Paris returned invalid JSON');
        }
        if (json.error) {
          const reasonKey = json.error?.reasonKey ? String(json.error.reasonKey) : 'coreui.errors.unknown';
          throw new Error(reasonKey);
        }
        resolved = json?.config && typeof json.config === 'object' && !Array.isArray(json.config)
          ? structuredClone(json.config)
          : structuredClone(defaults);
        if (json.policy && typeof json.policy === 'object') nextPolicy = assertPolicy(json.policy);
        else nextPolicy = resolveDevPolicy(nextSubjectMode);
        nextWorkspaceId = message.workspaceId;
      } else {
        resolved = incoming == null ? structuredClone(defaults) : structuredClone(incoming);
        if (!message.policy) nextPolicy = resolveDevPolicy(nextSubjectMode);
      }

      if (nextPolicy.flags['embed.seoGeo.enabled'] !== true) {
        const asAny = resolved as any;
        if (!asAny.seoGeo || typeof asAny.seoGeo !== 'object') asAny.seoGeo = {};
        asAny.seoGeo.enabled = false;
      }

      setState((prev) => ({
        ...prev,
        compiled,
        instanceData: resolved,
        isDirty: false,
        policy: nextPolicy,
        selectedPath: null,
        error: null,
        upsell: null,
        lastUpdate: {
          source: 'load',
          path: '',
          ts: Date.now(),
        },
        undoSnapshot: null,
        meta: {
          publicId: message.publicId,
          workspaceId: nextWorkspaceId,
          widgetname: compiled.widgetname,
          label: message.label ?? compiled.displayName,
        },
      }));
    } catch (err) {
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.error('[useWidgetSession] Failed to load instance', err, message);
      }
      const messageText = err instanceof Error ? err.message : String(err);
      setState((prev) => ({
        ...prev,
        compiled: null,
        instanceData: {},
        isDirty: false,
        error: { source: 'load', message: messageText },
        upsell: null,
        meta: null,
      }));
    }
  }, []);

  const dismissUpsell = useCallback(() => {
    setState((prev) => ({ ...prev, upsell: null }));
  }, []);

  const publish = useCallback(async () => {
    const publicId = state.meta?.publicId;
    const workspaceId = state.meta?.workspaceId;
    const widgetType = state.meta?.widgetname;
    if (!publicId || !workspaceId) {
      setState((prev) => ({
        ...prev,
        error: { source: 'publish', message: 'coreui.errors.publish.missingInstanceContext' },
      }));
      return;
    }
    if (!widgetType) {
      setState((prev) => ({
        ...prev,
        error: { source: 'publish', message: 'coreui.errors.widgetType.invalid' },
      }));
      return;
    }

    const gate = can(state.policy, 'instance.publish');
    if (!gate.allow) {
      setState((prev) => ({
        ...prev,
        error: null,
        upsell: {
          reasonKey: gate.reasonKey,
          detail: gate.detail,
          cta: prev.policy.profile === 'minibob' ? 'signup' : 'upgrade',
        },
      }));
      return;
    }

    const subject = state.policy.profile === 'devstudio' || state.policy.profile === 'minibob' ? state.policy.profile : 'workspace';

    setState((prev) => ({ ...prev, isPublishing: true, error: null }));
    try {
      const persisted = await persistConfigAssetsToTokyo(state.instanceData, { workspaceId });
      const res = await fetch(
        `/api/paris/instance/${encodeURIComponent(publicId)}?workspaceId=${encodeURIComponent(
          workspaceId
        )}&subject=${encodeURIComponent(subject)}`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ config: persisted, status: 'published' }),
        }
      );

      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        const err = json?.error;
        if (err?.kind === 'DENY' && err?.upsell === 'UP') {
          setState((prev) => ({
            ...prev,
            isPublishing: false,
            error: null,
            upsell: {
              reasonKey: err.reasonKey || 'coreui.errors.unknown',
              detail: err.detail,
              cta: prev.policy.profile === 'minibob' ? 'signup' : 'upgrade',
            },
          }));
          return;
        }
        if (err?.kind === 'VALIDATION') {
          setState((prev) => ({
            ...prev,
            isPublishing: false,
            error: { source: 'publish', message: err.reasonKey || 'coreui.errors.publish.failed', paths: err.paths },
          }));
          return;
        }
        setState((prev) => ({
          ...prev,
          isPublishing: false,
          error: { source: 'publish', message: err?.reasonKey || 'coreui.errors.publish.failed' },
        }));
        return;
      }

      setState((prev) => ({
        ...prev,
        isPublishing: false,
        isDirty: false,
        error: null,
        upsell: null,
        instanceData: json?.config && typeof json.config === 'object' && !Array.isArray(json.config) ? json.config : prev.instanceData,
        policy: json?.policy && typeof json.policy === 'object' ? assertPolicy(json.policy) : prev.policy,
      }));

      try {
        const message: BobPublishedMessage = {
          type: 'bob:published',
          publicId,
          workspaceId,
          widgetType,
          status: 'published',
          config: persisted,
        };
        window.parent?.postMessage(message, '*');
      } catch {}
    } catch (err) {
      const messageText = err instanceof Error ? err.message : String(err);
      setState((prev) => ({ ...prev, isPublishing: false, error: { source: 'publish', message: messageText } }));
    }
  }, [state.instanceData, state.meta?.publicId, state.meta?.workspaceId, state.meta?.widgetname, state.policy]);

  const loadFromUrlParams = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const workspaceId = (params.get('workspaceId') || '').trim();
    const publicId = (params.get('publicId') || '').trim();
    if (!workspaceId || !publicId) return;

    const subject = resolveSubjectModeFromUrl();
    const instanceUrl = `/api/paris/instance/${encodeURIComponent(publicId)}?workspaceId=${encodeURIComponent(
      workspaceId
    )}&subject=${encodeURIComponent(subject)}`;
    const instanceRes = await fetch(instanceUrl, { cache: 'no-store' });
    if (!instanceRes.ok) {
      throw new Error(`[useWidgetSession] Failed to load instance (HTTP ${instanceRes.status})`);
    }
    const instanceJson = (await instanceRes.json().catch(() => null)) as any;
    if (!instanceJson || typeof instanceJson !== 'object') {
      throw new Error('[useWidgetSession] Paris returned invalid JSON');
    }
    if (instanceJson.error) {
      const reasonKey = instanceJson.error?.reasonKey ? String(instanceJson.error.reasonKey) : 'coreui.errors.unknown';
      throw new Error(reasonKey);
    }
    const widgetType = typeof instanceJson.widgetType === 'string' ? instanceJson.widgetType : '';
    if (!widgetType) {
      throw new Error('[useWidgetSession] Missing widgetType in instance payload');
    }

    const compiledRes = await fetch(`/api/widgets/${encodeURIComponent(widgetType)}/compiled`, { cache: 'no-store' });
    if (!compiledRes.ok) {
      throw new Error(`[useWidgetSession] Failed to compile widget ${widgetType} (HTTP ${compiledRes.status})`);
    }
    const compiled = (await compiledRes.json().catch(() => null)) as CompiledWidget | null;
    if (!compiled) throw new Error('[useWidgetSession] Invalid compiled widget payload');
    await loadInstance({
      type: 'devstudio:load-instance',
      widgetname: widgetType,
      compiled,
      instanceData: instanceJson.config,
      policy: instanceJson.policy,
      publicId: instanceJson.publicId ?? publicId,
      workspaceId,
      label: instanceJson.publicId ?? publicId,
      subjectMode: subject,
    });
  }, [loadInstance]);

  const setCopilotThread = useCallback((key: string, next: CopilotThread) => {
    const trimmed = key.trim();
    if (!trimmed) return;
    setState((prev) => ({
      ...prev,
      copilotThreads: { ...prev.copilotThreads, [trimmed]: next },
    }));
  }, []);

  const updateCopilotThread = useCallback(
    (key: string, updater: (current: CopilotThread | null) => CopilotThread) => {
      const trimmed = key.trim();
      if (!trimmed) return;
      setState((prev) => {
        const current = prev.copilotThreads[trimmed] ?? null;
        const next = updater(current);
        return { ...prev, copilotThreads: { ...prev.copilotThreads, [trimmed]: next } };
      });
    },
    []
  );

  const setPreview = useCallback((updates: Partial<PreviewSettings>) => {
    setState((prev) => ({
      ...prev,
      preview: { ...prev.preview, ...updates },
    }));
  }, []);

  const setSelectedPath = useCallback((path: string | null) => {
    setState((prev) => ({
      ...prev,
      selectedPath: typeof path === 'string' && path.trim() ? path.trim() : null,
    }));
  }, []);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data as (WidgetBootstrapMessage | DevstudioExportInstanceDataMessage) | undefined;
      if (!data || typeof data !== 'object') return;

      if (data.type === 'devstudio:load-instance') {
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.log('[useWidgetSession] load-instance payload', data);
        }
        loadInstance(data);
        return;
      }

      if (data.type === 'devstudio:export-instance-data') {
        const requestId = typeof data.requestId === 'string' ? data.requestId : '';
        if (!requestId) return;
        const snapshot = stateRef.current;
        const persistAssets = (data as DevstudioExportInstanceDataMessage).persistAssets === true;

        (async () => {
          try {
            const instanceData = persistAssets
              ? (() => {
                  const workspaceId = snapshot.meta?.workspaceId;
                  if (!workspaceId) {
                    throw new Error('[Bob] Missing workspaceId for asset persistence');
                  }
                  return persistConfigAssetsToTokyo(snapshot.instanceData, { workspaceId });
                })()
              : snapshot.instanceData;

            const reply: BobExportInstanceDataResponseMessage = {
              type: 'bob:export-instance-data',
              requestId,
              ok: true,
              instanceData: await Promise.resolve(instanceData),
              meta: snapshot.meta,
              isDirty: snapshot.isDirty,
            };

            const targetOrigin = event.origin && event.origin !== 'null' ? event.origin : '*';
            window.parent?.postMessage(reply, targetOrigin);
          } catch (err) {
            const messageText = err instanceof Error ? err.message : String(err);
            const reply: BobExportInstanceDataResponseMessage = {
              type: 'bob:export-instance-data',
              requestId,
              ok: false,
              error: messageText,
            };
            const targetOrigin = event.origin && event.origin !== 'null' ? event.origin : '*';
            window.parent?.postMessage(reply, targetOrigin);
          }
        })();
      }
    }

    window.addEventListener('message', handleMessage);
    if (window.parent) {
      window.parent.postMessage({ type: 'bob:session-ready' }, '*');
    }
    loadFromUrlParams().catch((err) => {
      const messageText = err instanceof Error ? err.message : String(err);
      setState((prev) => ({
        ...prev,
        compiled: null,
        instanceData: {},
        isDirty: false,
        error: { source: 'load', message: messageText },
        upsell: null,
        meta: null,
      }));
    });
    return () => window.removeEventListener('message', handleMessage);
  }, [loadFromUrlParams, loadInstance]);

  const value = useMemo(
    () => ({
      compiled: state.compiled,
      instanceData: state.instanceData,
      isDirty: state.isDirty,
      isMinibob: state.policy.profile === 'minibob',
      upsell: state.upsell,
      isPublishing: state.isPublishing,
      preview: state.preview,
      selectedPath: state.selectedPath,
      lastUpdate: state.lastUpdate,
      error: state.error,
      meta: state.meta,
      canUndo: Boolean(state.undoSnapshot),
      copilotThreads: state.copilotThreads,
      applyOps,
      undoLastOps,
      commitLastOps,
      publish,
      dismissUpsell,
      setSelectedPath,
      setPreview,
      loadInstance,
      setCopilotThread,
      updateCopilotThread,
    }),
    [
      state,
      applyOps,
      undoLastOps,
      commitLastOps,
      publish,
      dismissUpsell,
      loadInstance,
      setPreview,
      setSelectedPath,
      setCopilotThread,
      updateCopilotThread,
    ]
  );

  return value;
}

const WidgetSessionContext = createContext<ReturnType<typeof useWidgetSessionInternal> | null>(null);

export function WidgetSessionProvider({ children }: { children: ReactNode }) {
  const value = useWidgetSessionInternal();
  return <WidgetSessionContext.Provider value={value}>{children}</WidgetSessionContext.Provider>;
}

export function useWidgetSession() {
  const context = useContext(WidgetSessionContext);
  if (!context) {
    throw new Error('useWidgetSession must be used within WidgetSessionProvider');
  }
  return context;
}
