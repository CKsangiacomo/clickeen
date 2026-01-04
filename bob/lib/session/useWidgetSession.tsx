'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import type { CompiledWidget } from '../types';
import type { ApplyWidgetOpsResult, WidgetOp, WidgetOpError } from '../ops';
import { applyWidgetOps } from '../ops';
import type { CopilotThread } from '../copilot/types';

type UpdateMeta = {
  source: 'field' | 'load' | 'external' | 'ops' | 'unknown';
  path: string;
  ts: number;
};

type SessionError =
  | { source: 'load'; message: string }
  | { source: 'ops'; errors: WidgetOpError[] };

type PreviewSettings = {
  device: 'desktop' | 'mobile';
  theme: 'light' | 'dark';
  host: 'canvas' | 'column' | 'banner' | 'floating';
};

type SubjectMode = 'devstudio' | 'minibob';

type SessionPolicy = {
  subjectMode: SubjectMode;
  flags: {
    seoGeo: boolean;
  };
};

type SessionState = {
  compiled: CompiledWidget | null;
  instanceData: Record<string, unknown>;
  isDirty: boolean;
  subjectMode: SubjectMode;
  policy: SessionPolicy;
  isMinibob: boolean; // derived from subjectMode (kept for backward compatibility)
  preview: PreviewSettings;
  selectedPath: string | null;
  lastUpdate: UpdateMeta | null;
  undoSnapshot: Record<string, unknown> | null;
  error: SessionError | null;
  copilotThreads: Record<string, CopilotThread>;
  meta: {
    publicId?: string;
    widgetname?: string;
    label?: string;
  } | null;
};

type WidgetBootstrapMessage = {
  type: 'devstudio:load-instance';
  widgetname: string;
  compiled: CompiledWidget;
  instanceData?: Record<string, unknown> | null;
  publicId?: string;
  label?: string;
  subjectMode?: SubjectMode;
};

const DEFAULT_PREVIEW: PreviewSettings = {
  device: 'desktop',
  theme: 'light',
  host: 'canvas',
};

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

function resolvePolicy(subjectMode: SubjectMode): SessionPolicy {
  return {
    subjectMode,
    flags: {
      // In Minibob, SEO/GEO is always disabled.
      seoGeo: subjectMode !== 'minibob',
    },
  };
}

function useWidgetSessionInternal() {
  const initialSubjectMode = resolveSubjectModeFromUrl();
  const initialPolicy = resolvePolicy(initialSubjectMode);
  const isMinibob = initialSubjectMode === 'minibob';

  const [state, setState] = useState<SessionState>(() => ({
    compiled: null,
    instanceData: {},
    isDirty: false,
    subjectMode: initialSubjectMode,
    policy: initialPolicy,
    isMinibob,
    preview: DEFAULT_PREVIEW,
    selectedPath: null,
    lastUpdate: null,
    undoSnapshot: null,
    error: null,
    copilotThreads: {},
    meta: null,
  }));

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

      // Policy enforcement (subject-mode based).
      if (state.policy.flags.seoGeo !== true) {
        const blockedIndex = ops.findIndex((op) => {
          if (!op || typeof op !== 'object') return false;
          if ((op as any).op !== 'set') return false;
          if ((op as any).path !== 'seoGeo.enabled') return false;
          return (op as any).value === true;
        });
        if (blockedIndex >= 0) {
          const result: ApplyWidgetOpsResult = {
            ok: false,
            errors: [{ opIndex: blockedIndex, path: 'seoGeo.enabled', message: 'SEO/GEO optimization cannot be enabled for this subject' }],
          };
          setState((prev) => ({ ...prev, error: { source: 'ops', errors: result.errors } }));
          return result;
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
        lastUpdate: {
          source: 'ops',
          path: ops[0]?.path || '',
          ts: Date.now(),
        },
      }));

      return applied;
    },
    [state.compiled, state.instanceData, state.policy.flags.seoGeo]
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

  const loadInstance = useCallback((message: WidgetBootstrapMessage) => {
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

      const incoming = message.instanceData as Record<string, unknown> | null | undefined;
      if (incoming != null && (!incoming || typeof incoming !== 'object' || Array.isArray(incoming))) {
        throw new Error('[useWidgetSession] instanceData must be an object');
      }
      const resolved =
        incoming == null
          ? structuredClone(defaults)
          : structuredClone(incoming);

      const nextSubjectMode: SubjectMode = message.subjectMode || state.subjectMode;
      const nextPolicy = resolvePolicy(nextSubjectMode);
      if (nextPolicy.flags.seoGeo !== true) {
        const asAny = resolved as any;
        if (!asAny.seoGeo || typeof asAny.seoGeo !== 'object') asAny.seoGeo = {};
        asAny.seoGeo.enabled = false;
      }

      setState((prev) => ({
        ...prev,
        compiled,
        instanceData: resolved,
        isDirty: false,
        subjectMode: nextSubjectMode,
        policy: nextPolicy,
        isMinibob: nextSubjectMode === 'minibob',
        selectedPath: null,
        error: null,
        lastUpdate: {
          source: 'load',
          path: '',
          ts: Date.now(),
        },
        undoSnapshot: null,
        meta: {
          publicId: message.publicId,
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
        meta: null,
      }));
    }
  }, [state.subjectMode]);

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
      const data = event.data as WidgetBootstrapMessage | undefined;
      if (!data || data.type !== 'devstudio:load-instance') return;
      if (process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.log('[useWidgetSession] load-instance payload', data);
      }
      loadInstance(data);
    }

    window.addEventListener('message', handleMessage);
    if (window.parent) {
      window.parent.postMessage({ type: 'bob:session-ready' }, '*');
    }
    return () => window.removeEventListener('message', handleMessage);
  }, [loadInstance]);

  const value = useMemo(
    () => ({
      compiled: state.compiled,
      instanceData: state.instanceData,
      isDirty: state.isDirty,
      isMinibob: state.isMinibob,
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
