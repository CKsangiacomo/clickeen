import copilotCopy from '../../l10n/copilot/en.json';

export type CopilotMessagePresentationStatus =
  | 'working'
  | 'applied'
  | 'not-applied'
  | 'stopped';

export type CopilotMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  ts: number;
  requestId?: string;
  presentationStatus?: CopilotMessagePresentationStatus;
  hasUndoAction?: boolean;
  undoToken?: string;
};

export type CopilotThread = {
  sessionId: string;
  messages: CopilotMessage[];
};

export const COPILOT_MESSAGE_PRESENTATION_LABELS: Record<
  CopilotMessagePresentationStatus,
  string
> = {
  working: copilotCopy.status.working,
  applied: copilotCopy.status.applied,
  'not-applied': copilotCopy.status.notApplied,
  stopped: copilotCopy.status.stopped,
};

export function appendWorkingCopilotAssistantText(args: {
  messages: CopilotMessage[];
  messageId: string;
  text: string;
  ts: number;
}): CopilotMessage[] {
  const existingMessage = args.messages.some(
    (message) => message.id === args.messageId,
  );
  if (!existingMessage) {
    return [
      ...args.messages,
      {
        id: args.messageId,
        role: 'assistant',
        text: args.text,
        ts: args.ts,
        presentationStatus: 'working',
      },
    ];
  }

  return args.messages.map((message) =>
    message.id === args.messageId
      ? {
          ...message,
          text: message.text + args.text,
          presentationStatus: 'working',
        }
      : message,
  );
}

export function resolveWorkingCopilotAssistantMessages(args: {
  messages: CopilotMessage[];
  messageIds: string[];
  resolution: Exclude<CopilotMessagePresentationStatus, 'working'> | 'complete';
}): CopilotMessage[] {
  if (args.messageIds.length === 0) return args.messages;
  const messageIds = new Set(args.messageIds);

  return args.messages.map((message) => {
    if (
      !messageIds.has(message.id) ||
      message.role !== 'assistant' ||
      message.presentationStatus !== 'working'
    ) {
      return message;
    }
    if (args.resolution === 'complete') {
      const completedMessage = { ...message };
      delete completedMessage.presentationStatus;
      return completedMessage;
    }
    return { ...message, presentationStatus: args.resolution };
  });
}
