'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useSessionCopilot } from './useSessionCopilot';

export type WidgetSessionCopilotValue = {
  copilotThreads: ReturnType<typeof useSessionCopilot>['copilotThreads'];
  setCopilotThread: ReturnType<typeof useSessionCopilot>['setCopilotThread'];
  updateCopilotThread: ReturnType<typeof useSessionCopilot>['updateCopilotThread'];
  activeTurnKey: ReturnType<typeof useSessionCopilot>['activeTurnKey'];
  setCopilotTurnActive: ReturnType<typeof useSessionCopilot>['setCopilotTurnActive'];
  copilotUndoByThread: ReturnType<typeof useSessionCopilot>['copilotUndoByThread'];
  setCopilotUndo: ReturnType<typeof useSessionCopilot>['setCopilotUndo'];
};

const WidgetSessionCopilotContext = createContext<WidgetSessionCopilotValue | null>(null);

export function WidgetSessionCopilotProvider({ children }: { children: ReactNode }) {
  const copilot = useSessionCopilot();

  const value = useMemo<WidgetSessionCopilotValue>(
    () => ({
      copilotThreads: copilot.copilotThreads,
      setCopilotThread: copilot.setCopilotThread,
      updateCopilotThread: copilot.updateCopilotThread,
      activeTurnKey: copilot.activeTurnKey,
      setCopilotTurnActive: copilot.setCopilotTurnActive,
      copilotUndoByThread: copilot.copilotUndoByThread,
      setCopilotUndo: copilot.setCopilotUndo,
    }),
    [
      copilot.activeTurnKey,
      copilot.copilotThreads,
      copilot.copilotUndoByThread,
      copilot.setCopilotThread,
      copilot.setCopilotTurnActive,
      copilot.setCopilotUndo,
      copilot.updateCopilotThread,
    ],
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
