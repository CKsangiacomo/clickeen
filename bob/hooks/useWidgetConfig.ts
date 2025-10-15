import { useEffect, useMemo, useRef, useState } from 'react';
import { parisGetInstance, parisUpdateInstance, type ParisInstance } from '@bob/lib/paris';

type HookState<T> = {
  config: T;
  setConfig: (updater: (prev: T) => T) => void;
  saveConfig: () => Promise<void>;
  widgetName: string;
  setWidgetName: (name: string) => void;
  widgetType?: string;
  isDirty: boolean;
  isSaving: boolean;
  isLoading: boolean;
  saveError: string | null;
};

export function useWidgetConfig<T extends Record<string, any> = Record<string, any>>(publicId: string | undefined): HookState<T> {
  const [config, setConfigState] = useState<T>({} as T);
  const [savedSnapshot, setSavedSnapshot] = useState<T>({} as T);
  const [widgetName, setWidgetName] = useState<string>('Untitled widget');
  const [widgetType, setWidgetType] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const loadedRef = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<AbortController | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!publicId) return;
      setIsLoading(true);
      try {
        const { res, body } = await parisGetInstance(publicId);
        if (!alive) return;
        if (!res.ok) {
          setIsLoading(false);
          return;
        }
        const inst = body as ParisInstance;
        setWidgetType(inst.widgetType ?? undefined);
        const cfg = (inst.config ?? {}) as T;
        setConfigState(cfg);
        setSavedSnapshot(cfg);
        const derived = String((cfg as any)?.title ?? '').trim();
        setWidgetName(derived.length > 0 ? derived : 'Untitled widget');
        loadedRef.current = true;
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [publicId]);

  const setConfig = (updater: (prev: T) => T) => {
    setConfigState((prev) => updater(prev));
  };

  // Write-through: debounce PUT to Paris on config changes once initial load completed
  useEffect(() => {
    if (!publicId) return;
    if (!loadedRef.current) return; // don't auto-save initial load
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(async () => {
      if (!publicId) return;
      // Abort previous in-flight request if any
      try { inflight.current?.abort(); } catch {}
      const controller = new AbortController();
      inflight.current = controller;
      setIsSaving(true);
      try {
        const { res, body } = await parisUpdateInstance(publicId, { config });
        if (res.ok) {
          const inst = body as ParisInstance;
          const cfg = (inst.config ?? {}) as T;
          setSavedSnapshot(cfg);
          setSaveError(null);
        } else {
          // Capture minimal error context
          const err = (body as any)?.error || `HTTP_${res.status}`;
          setSaveError(String(err));
        }
      } catch (e) {
        setSaveError((e as Error)?.message || 'SYNC_FAILED');
      } finally {
        if (inflight.current === controller) inflight.current = null;
        setIsSaving(false);
      }
    }, 400);
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicId, JSON.stringify(config)]);

  const isDirty = useMemo(() => JSON.stringify(config) !== JSON.stringify(savedSnapshot), [config, savedSnapshot]);

  const saveConfig = async () => {
    if (!publicId) return;
    setIsSaving(true);
    try {
      const { res, body } = await parisUpdateInstance(publicId, { config });
      if (res.ok) {
        const inst = body as ParisInstance;
        const cfg = (inst.config ?? {}) as T;
        setSavedSnapshot(cfg);
        setSaveError(null);
      } else {
        const err = (body as any)?.error || `HTTP_${res.status}`;
        setSaveError(String(err));
      }
    } finally {
      setIsSaving(false);
    }
  };

  return {
    config,
    setConfig,
    saveConfig,
    widgetName,
    setWidgetName: (name: string) => {
      setWidgetName(name);
      // mirror into config.title for simple rename flows
      setConfigState((prev) => ({ ...(prev as any), title: name } as T));
    },
    widgetType,
    isDirty,
    isSaving,
    isLoading,
    saveError,
  };
}
