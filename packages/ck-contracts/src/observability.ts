export const CK_REQUEST_ID_HEADER = 'x-request-id';

export type CkObservedService =
  | 'roma'
  | 'berlin'
  | 'tokyo-worker'
  | 'sanfrancisco'
  | 'prague';

export type CkLogLevel = 'info' | 'warn' | 'error';

export type CkLogPrimitive = string | number | boolean | null;

export type CkLogMetadata = Record<string, CkLogPrimitive>;

export type CkLogEvent = {
  event: string;
  service: CkObservedService;
  stage: string;
  requestId: string;
  boundary?: string;
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
  visibility?: 'public' | 'internal';
  cfRay?: string | null;
  reasonKey?: string | null;
  detail?: string | null;
  accountId?: string | null;
  instanceId?: string | null;
  agentId?: string | null;
  meta?: CkLogMetadata;
};

export function normalizeRequestId(raw: unknown): string | null {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return null;
  return value.slice(0, 128);
}

function cleanMetadata(raw: CkLogMetadata | undefined): CkLogMetadata | undefined {
  if (!raw) return undefined;
  const out: CkLogMetadata = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === undefined) continue;
    out[key] = value;
  }
  return Object.keys(out).length ? out : undefined;
}

export function serializeCkLogEvent(event: CkLogEvent): string {
  const payload: CkLogEvent = {
    ...event,
    meta: cleanMetadata(event.meta),
  };
  return JSON.stringify(payload);
}
