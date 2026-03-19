'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Policy } from '@clickeen/ck-policy';
import { DEFAULT_PREVIEW, type SessionMeta, type SessionUpsell } from './sessionTypes';

export type WidgetSessionChromeValue = {
  policy: Policy | null;
  upsell: SessionUpsell;
  preview: typeof DEFAULT_PREVIEW;
  meta: SessionMeta;
  dismissUpsell: () => void;
  requestUpsell: (reasonKey: string, detail?: string) => void;
  setPreview: (updates: Partial<typeof DEFAULT_PREVIEW>) => void;
};

type WidgetSessionChromeControllerValue = {
  meta: SessionMeta;
  setMeta: React.Dispatch<React.SetStateAction<SessionMeta>>;
  setPolicy: React.Dispatch<React.SetStateAction<Policy | null>>;
  setUpsell: React.Dispatch<React.SetStateAction<SessionUpsell>>;
};

const WidgetSessionChromeContext = createContext<WidgetSessionChromeValue | null>(null);
const WidgetSessionChromeControllerContext = createContext<WidgetSessionChromeControllerValue | null>(null);

export function WidgetSessionChromeProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<SessionMeta>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [upsell, setUpsell] = useState<SessionUpsell>(null);
  const [preview, setPreviewState] = useState(() => structuredClone(DEFAULT_PREVIEW));

  const dismissUpsell = useCallback(() => {
    setUpsell(null);
  }, []);

  const requestUpsell = useCallback((reasonKey: string, detail?: string) => {
    if (!reasonKey) return;
    setUpsell({
      reasonKey,
      detail,
      cta: 'upgrade',
    });
  }, []);

  const setPreview = useCallback((updates: Partial<typeof DEFAULT_PREVIEW>) => {
    setPreviewState((prev) => ({ ...prev, ...updates }));
  }, []);

  const value = useMemo<WidgetSessionChromeValue>(
    () => ({
      policy,
      upsell,
      preview,
      meta,
      dismissUpsell,
      requestUpsell,
      setPreview,
    }),
    [dismissUpsell, meta, policy, preview, requestUpsell, setPreview, upsell],
  );

  const controllerValue = useMemo<WidgetSessionChromeControllerValue>(
    () => ({
      meta,
      setMeta,
      setPolicy,
      setUpsell,
    }),
    [meta],
  );

  return (
    <WidgetSessionChromeControllerContext.Provider value={controllerValue}>
      <WidgetSessionChromeContext.Provider value={value}>{children}</WidgetSessionChromeContext.Provider>
    </WidgetSessionChromeControllerContext.Provider>
  );
}

export function useWidgetSessionChrome() {
  const context = useContext(WidgetSessionChromeContext);
  if (!context) {
    throw new Error('useWidgetSessionChrome must be used within WidgetSessionProvider');
  }
  return context;
}

export function useWidgetSessionChromeController() {
  const context = useContext(WidgetSessionChromeControllerContext);
  if (!context) {
    throw new Error('useWidgetSessionChromeController must be used within WidgetSessionProvider');
  }
  return context;
}
