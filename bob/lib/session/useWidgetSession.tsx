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
import { mergeDefaults } from '../utils/merge';
import { setAt } from '../utils/paths';

type UpdateMeta = {
  source: 'field' | 'load' | 'external' | 'unknown';
  path: string;
  ts: number;
};

type PreviewSettings = {
  device: 'desktop' | 'mobile';
  theme: 'light' | 'dark';
};

type SessionState = {
  compiled: CompiledWidget | null;
  instanceData: Record<string, unknown>;
  isDirty: boolean;
  preview: PreviewSettings;
  lastUpdate: UpdateMeta | null;
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
  instanceData?: Record<string, unknown>;
  publicId?: string;
  label?: string;
};

const DEFAULT_PREVIEW: PreviewSettings = {
  device: 'desktop',
  theme: 'light',
};

function useWidgetSessionInternal() {
  const [state, setState] = useState<SessionState>(() => ({
    compiled: null,
    instanceData: {},
    isDirty: false,
    preview: DEFAULT_PREVIEW,
    lastUpdate: null,
    meta: null,
  }));

  const setInstanceData = useCallback(
    (updater: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)) => {
      setState((prev) => {
        const nextData =
          typeof updater === 'function'
            ? (updater as (prev: Record<string, unknown>) => Record<string, unknown>)(prev.instanceData)
            : updater;
        return {
          ...prev,
          instanceData: nextData,
          isDirty: true,
          lastUpdate: prev.lastUpdate,
        };
      });
    },
    []
  );

  const setValue = useCallback(
    (path: string, value: unknown, meta?: Partial<UpdateMeta>) => {
      setState((prev) => {
        const nextData = setAt(prev.instanceData, path, value) as Record<string, unknown>;
        const nextMeta: UpdateMeta = {
          source: meta?.source ?? 'unknown',
          path: meta?.path ?? path,
          ts: meta?.ts ?? Date.now(),
        };
        return { ...prev, instanceData: nextData, isDirty: true, lastUpdate: nextMeta };
      });
    },
    []
  );

  const loadInstance = useCallback((message: WidgetBootstrapMessage) => {
    try {
      const compiled = message.compiled;
      if (!compiled) {
        throw new Error('[useWidgetSession] Missing compiled widget payload');
      }
      const incoming = (message.instanceData ?? {}) as Record<string, unknown>;

      // Normalize legacy fields into stage/pod so fills always work.
      const normalized: Record<string, unknown> = { ...incoming };
      const pod = (normalized.pod as Record<string, unknown>) || {};
      const stage = (normalized.stage as Record<string, unknown>) || {};

      if (!pod.background && typeof incoming.backgroundColor === 'string') {
        pod.background = incoming.backgroundColor;
      }
      if (!stage.background && typeof incoming.stageBackground === 'string') {
        stage.background = incoming.stageBackground;
      }

      if (!normalized.pod) normalized.pod = pod;
      if (!normalized.stage) normalized.stage = stage;

      const mergedInstance = mergeDefaults(
        (compiled.defaults ?? {}) as Record<string, unknown>,
        normalized
      );

      setState((prev) => ({
        compiled,
        instanceData: mergedInstance,
        isDirty: false,
        preview: prev.preview,
        lastUpdate: {
          source: 'load',
          path: '',
          ts: Date.now(),
        },
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
      setState((prev) => ({
        ...prev,
        compiled: null,
        instanceData: {},
        isDirty: false,
        meta: null,
      }));
    }
  }, []);

  const setPreview = useCallback((updates: Partial<PreviewSettings>) => {
    setState((prev) => ({
      ...prev,
      preview: { ...prev.preview, ...updates },
    }));
  }, []);

  const renameInstance = useCallback(
    async (nextLabel: string) => {
      const trimmed = nextLabel.trim();
      if (!trimmed) {
        throw new Error('Instance name cannot be empty');
      }

      const publicId = state.meta?.publicId;
      if (!publicId) {
        throw new Error('No active instance to rename');
      }

      const res = await fetch(`/api/paris/instance/${encodeURIComponent(publicId)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ displayName: trimmed }),
      });

      if (!res.ok) {
        let details = '';
        try {
          const data = await res.json();
          details = typeof data === 'string' ? data : JSON.stringify(data);
        } catch {
          details = await res.text();
        }
        const message = details || `Failed to rename instance (status ${res.status})`;
        throw new Error(message);
      }

      setState((prev) => ({
        ...prev,
        compiled: prev.compiled ? { ...prev.compiled, displayName: trimmed } : prev.compiled,
        meta: prev.meta ? { ...prev.meta, label: trimmed } : prev.meta,
      }));

      return trimmed;
    },
    [state.meta?.publicId]
  );

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
      preview: state.preview,
      lastUpdate: state.lastUpdate,
      meta: state.meta,
      setInstanceData,
      setValue,
      setPreview,
      renameInstance,
      loadInstance,
    }),
    [state, setInstanceData, setValue, loadInstance, setPreview, renameInstance]
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
