'use client';

import type { ReactNode } from 'react';
import { WidgetDocumentSessionProvider } from './WidgetDocumentSession';
import { WidgetSessionChromeProvider } from './WidgetSessionChrome';
import { WidgetSessionCopilotProvider } from './WidgetSessionCopilot';

export function WidgetSessionProvider({ children }: { children: ReactNode }) {
  return (
    <WidgetSessionChromeProvider>
      <WidgetSessionCopilotProvider>
        <WidgetDocumentSessionProvider>{children}</WidgetDocumentSessionProvider>
      </WidgetSessionCopilotProvider>
    </WidgetSessionChromeProvider>
  );
}
