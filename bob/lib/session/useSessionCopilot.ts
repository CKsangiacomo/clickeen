'use client';

import { useCallback, useState } from 'react';
import type { CopilotThread } from '../copilot/types';
import type { WidgetOp } from '../ops';

export type CopilotUndoRecord = {
  ops: WidgetOp[];
  token: string;
  postApplySignature: string;
};

export function useSessionCopilot() {
  const [copilotThreads, setCopilotThreads] = useState<Record<string, CopilotThread>>({});
  const [activeTurnKey, setActiveTurnKey] = useState<string | null>(null);
  const [copilotUndoByThread, setCopilotUndoByThread] = useState<Record<string, CopilotUndoRecord>>({});

  const setCopilotThread = useCallback((key: string, next: CopilotThread) => {
    const trimmed = key.trim();
    if (!trimmed) return;
    setCopilotThreads((prev) => ({ ...prev, [trimmed]: next }));
  }, []);

  const updateCopilotThread = useCallback(
    (key: string, updater: (current: CopilotThread | null) => CopilotThread) => {
      const trimmed = key.trim();
      if (!trimmed) return;
      setCopilotThreads((prev) => {
        const current = prev[trimmed] ?? null;
        const next = updater(current);
        return { ...prev, [trimmed]: next };
      });
    },
    [],
  );

  const setCopilotTurnActive = useCallback((key: string, active: boolean) => {
    setActiveTurnKey((current) => {
      if (active) return key;
      return current === key ? null : current;
    });
  }, []);

  const setCopilotUndo = useCallback((key: string, undo: CopilotUndoRecord | null) => {
    setCopilotUndoByThread((current) => {
      if (undo) return { ...current, [key]: undo };
      if (!(key in current)) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  return {
    copilotThreads,
    setCopilotThread,
    updateCopilotThread,
    activeTurnKey,
    setCopilotTurnActive,
    copilotUndoByThread,
    setCopilotUndo,
  };
}
