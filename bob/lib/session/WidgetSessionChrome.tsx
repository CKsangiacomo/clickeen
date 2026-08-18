'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Policy } from '@clickeen/ck-policy';
import { DEFAULT_PREVIEW, type CopilotRuntimeUi, type SessionMeta } from './sessionTypes';

export type WidgetSessionChromeValue = {
  policy: Policy | null;
  copilot: CopilotRuntimeUi;
  preview: typeof DEFAULT_PREVIEW;
  meta: SessionMeta;
  setPreview: (updates: Partial<typeof DEFAULT_PREVIEW>) => void;
};

type WidgetSessionChromeControllerValue = {
  meta: SessionMeta;
  policy: Policy | null;
  setMeta: React.Dispatch<React.SetStateAction<SessionMeta>>;
  setPolicy: React.Dispatch<React.SetStateAction<Policy | null>>;
  setCopilot: React.Dispatch<React.SetStateAction<CopilotRuntimeUi>>;
};

const WidgetSessionChromeContext = createContext<WidgetSessionChromeValue | null>(null);
const WidgetSessionChromeControllerContext = createContext<WidgetSessionChromeControllerValue | null>(null);

export function WidgetSessionChromeProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<SessionMeta>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [copilot, setCopilot] = useState<CopilotRuntimeUi>(null);
  const [preview, setPreviewState] = useState(() => structuredClone(DEFAULT_PREVIEW));

  const setPreview = useCallback((updates: Partial<typeof DEFAULT_PREVIEW>) => {
    setPreviewState((prev) => ({ ...prev, ...updates }));
  }, []);

  const value = useMemo<WidgetSessionChromeValue>(
    () => ({
      policy,
      copilot,
      preview,
      meta,
      setPreview,
    }),
    [copilot, meta, policy, preview, setPreview],
  );

  const controllerValue = useMemo<WidgetSessionChromeControllerValue>(
    () => ({
      meta,
      policy,
      setMeta,
      setPolicy,
      setCopilot,
    }),
    [meta, policy],
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
