export type BobSaveControlPhase = 'hidden' | 'save' | 'saving' | 'saved';

export type BobSaveControlStateMessage = {
  type: 'bob:save-control-state';
  phase: BobSaveControlPhase;
};

export type HostSaveRequestMessage = {
  type: 'host:save-request';
};

function isBobSaveControlPhase(value: unknown): value is BobSaveControlPhase {
  return value === 'hidden' || value === 'save' || value === 'saving' || value === 'saved';
}

export function readBobSaveControlPhase(args: {
  data: unknown;
  eventOrigin: string;
  bobOrigin: string;
  eventSource: MessageEventSource | null;
  iframeWindow: Window | null;
}): BobSaveControlPhase | null {
  if (args.eventOrigin !== args.bobOrigin || !args.iframeWindow || args.eventSource !== args.iframeWindow) {
    return null;
  }
  if (!args.data || typeof args.data !== 'object') return null;
  const data = args.data as { type?: unknown; phase?: unknown };
  if (data.type !== 'bob:save-control-state' || !isBobSaveControlPhase(data.phase)) return null;
  return data.phase;
}

export function createHostSaveRequestMessage(): HostSaveRequestMessage {
  return { type: 'host:save-request' };
}
