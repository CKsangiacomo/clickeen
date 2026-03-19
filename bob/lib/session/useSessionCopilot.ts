'use client';

import { useCallback, useState } from 'react';
import type { CopilotThread } from '../copilot/types';

export function useSessionCopilot() {
  const [copilotThreads, setCopilotThreads] = useState<Record<string, CopilotThread>>({});

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

  return {
    copilotThreads,
    setCopilotThread,
    updateCopilotThread,
  };
}
