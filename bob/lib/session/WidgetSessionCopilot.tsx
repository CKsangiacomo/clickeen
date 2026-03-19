'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useSessionCopilot } from './useSessionCopilot';

export type WidgetSessionCopilotValue = {
  copilotThreads: ReturnType<typeof useSessionCopilot>['copilotThreads'];
  setCopilotThread: ReturnType<typeof useSessionCopilot>['setCopilotThread'];
  updateCopilotThread: ReturnType<typeof useSessionCopilot>['updateCopilotThread'];
};

const WidgetSessionCopilotContext = createContext<WidgetSessionCopilotValue | null>(null);

export function WidgetSessionCopilotProvider({ children }: { children: ReactNode }) {
  const copilot = useSessionCopilot();

  const value = useMemo<WidgetSessionCopilotValue>(
    () => ({
      copilotThreads: copilot.copilotThreads,
      setCopilotThread: copilot.setCopilotThread,
      updateCopilotThread: copilot.updateCopilotThread,
    }),
    [copilot.copilotThreads, copilot.setCopilotThread, copilot.updateCopilotThread],
  );

  return <WidgetSessionCopilotContext.Provider value={value}>{children}</WidgetSessionCopilotContext.Provider>;
}

export function useWidgetSessionCopilot() {
  const context = useContext(WidgetSessionCopilotContext);
  if (!context) {
    throw new Error('useWidgetSessionCopilot must be used within WidgetSessionProvider');
  }
  return context;
}
