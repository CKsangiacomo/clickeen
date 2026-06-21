export type CopilotMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  ts: number;
  requestId?: string;
  hasUndoAction?: boolean;
  undoToken?: string;
};

export type CopilotThread = {
  sessionId: string;
  messages: CopilotMessage[];
};
