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
import { compileWidget } from '../compiler';

type PreviewSettings = {
  device: 'desktop' | 'mobile';
  theme: 'light' | 'dark';
};

type SessionState = {
  compiled: CompiledWidget | null;
  instanceData: Record<string, unknown>;
  isDirty: boolean;
  preview: PreviewSettings;
  widgetJSON: Record<string, unknown> | null;
  meta: {
    publicId?: string;
    widgetname?: string;
    label?: string;
  } | null;
};

type DevStudioMessage = {
  type: 'devstudio:load-instance';
  widgetname: string;
  widgetJSON: any;
  instanceData?: Record<string, unknown>;
  publicId?: string;
  label?: string;
};

const DEFAULT_PREVIEW: PreviewSettings = {
  device: 'desktop',
  theme: 'light',
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeDefaults(
  base: Record<string, unknown>,
  overrides: Record<string, unknown>
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...base };
  Object.keys(overrides).forEach((key) => {
    const overrideValue = overrides[key];
    const baseValue = result[key];

    if (Array.isArray(overrideValue)) {
      result[key] = overrideValue;
      return;
    }

    if (isPlainObject(baseValue) && isPlainObject(overrideValue)) {
      result[key] = mergeDefaults(baseValue as Record<string, unknown>, overrideValue);
      return;
    }

    result[key] = overrideValue;
  });
  return result;
}

function setPathValue(source: Record<string, unknown>, path: string, value: unknown) {
  const segments = path.split('.');
  const next: Record<string, unknown> = { ...source };
  let cursor: Record<string, unknown> = next;

  segments.forEach((segment, index) => {
    if (index === segments.length - 1) {
      cursor[segment] = value;
      return;
    }

    const current = cursor[segment];
    if (typeof current === 'object' && current !== null && !Array.isArray(current)) {
      cursor[segment] = { ...current };
    } else {
      cursor[segment] = {};
    }

    cursor = cursor[segment] as Record<string, unknown>;
  });

  return next;
}

function useWidgetSessionInternal() {
  const [state, setState] = useState<SessionState>(() => ({
    compiled: null,
    instanceData: {},
    isDirty: false,
    preview: DEFAULT_PREVIEW,
    widgetJSON: null,
    meta: null,
  }));

  const setInstanceData = useCallback((updater: Record<string, unknown> | ((prev: Record<string, unknown>) => Record<string, unknown>)) => {
    setState((prev) => {
      const nextData =
        typeof updater === 'function'
          ? (updater as (prev: Record<string, unknown>) => Record<string, unknown>)(prev.instanceData)
          : updater;
      return { ...prev, instanceData: nextData, isDirty: true };
    });
  }, []);

  const setValue = useCallback((path: string, value: unknown) => {
    setState((prev) => {
      const nextData = setPathValue(prev.instanceData, path, value);
      return { ...prev, instanceData: nextData, isDirty: true };
    });
  }, []);

  const loadInstance = useCallback((message: DevStudioMessage) => {
    try {
      const compiled = compileWidget(message.widgetJSON);
      const mergedInstance = mergeDefaults(
        (compiled.defaults ?? {}) as Record<string, unknown>,
        (message.instanceData ?? {}) as Record<string, unknown>
      );

      setState((prev) => ({
        compiled,
        instanceData: mergedInstance,
        isDirty: false,
        preview: prev.preview,
        widgetJSON: message.widgetJSON as Record<string, unknown>,
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
        widgetJSON: null,
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
      const data = event.data as DevStudioMessage | undefined;
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
      widgetJSON: state.widgetJSON,
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
