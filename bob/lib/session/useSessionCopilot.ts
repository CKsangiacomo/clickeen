'use client';

import { useCallback, type Dispatch, type SetStateAction } from 'react';
import type { CopilotThread } from '../copilot/types';
import type { SessionState } from './sessionTypes';

export function useSessionCopilot(args: {
  setState: Dispatch<SetStateAction<SessionState>>;
}) {
  const setCopilotThread = useCallback((key: string, next: CopilotThread) => {
    const trimmed = key.trim();
    if (!trimmed) return;
    args.setState((prev) => ({
      ...prev,
      copilotThreads: { ...prev.copilotThreads, [trimmed]: next },
    }));
  }, [args.setState]);

  const updateCopilotThread = useCallback(
    (key: string, updater: (current: CopilotThread | null) => CopilotThread) => {
      const trimmed = key.trim();
      if (!trimmed) return;
      args.setState((prev) => {
        const current = prev.copilotThreads[trimmed] ?? null;
        const next = updater(current);
        return { ...prev, copilotThreads: { ...prev.copilotThreads, [trimmed]: next } };
      });
    },
    [args.setState],
  );

  return {
    setCopilotThread,
    updateCopilotThread,
  };
}
