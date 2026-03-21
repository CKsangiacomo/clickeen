export type CopilotCta = { text: string; action: 'upgrade' | 'learn-more'; url?: string };

export type CopilotMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  ts: number;
  requestId?: string;
  cta?: CopilotCta;
  hasPendingDecision?: boolean;
};

export type CopilotThread = {
  sessionId: string;
  messages: CopilotMessage[];
};
