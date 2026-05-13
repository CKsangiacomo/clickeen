import {
  CK_REQUEST_ID_HEADER,
  asTrimmedString,
  isRecord,
  normalizeRequestId,
  serializeCkLogEvent,
  type CkLogEvent,
  type CkLogLevel,
} from '@clickeen/ck-contracts';
import type { AIError, Env } from './types';

export { asTrimmedString, isRecord };

export class HttpError extends Error {
  readonly status: number;
  readonly error: AIError;

  constructor(status: number, error: AIError) {
    super(error.message);
    this.status = status;
    this.error = error;
  }
}

export function json(value: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(value), { ...init, headers });
}

export function noStore(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set('cache-control', 'no-store');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

export async function readJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, { code: 'BAD_REQUEST', message: 'Invalid JSON body' });
  }
}

export function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export type SanFranciscoRequestContext = {
  service: 'sanfrancisco';
  stage: string;
  requestId: string;
  method: string;
  path: string;
  visibility: 'internal';
  cfRay: string | null;
  startedAt: number;
};

export function createSanFranciscoRequestContext(request: Request, env: Env): SanFranciscoRequestContext {
  const url = new URL(request.url);
  return {
    service: 'sanfrancisco',
    stage: env.ENVIRONMENT ?? 'unknown',
    requestId: normalizeRequestId(request.headers.get(CK_REQUEST_ID_HEADER)) ?? crypto.randomUUID(),
    method: request.method,
    path: `${url.pathname}${url.search}`,
    visibility: 'internal',
    cfRay: request.headers.get('cf-ray'),
    startedAt: Date.now(),
  };
}

function log(level: CkLogLevel, event: CkLogEvent): void {
  const line = serializeCkLogEvent(event);
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.info(line);
}

export function finalizeSanFranciscoObservedResponse(args: {
  context: SanFranciscoRequestContext;
  response: Response;
  boundary?: string;
  reasonKey?: string | null;
  detail?: string | null;
  agentId?: string | null;
}): Response {
  const headers = new Headers(args.response.headers);
  headers.set(CK_REQUEST_ID_HEADER, args.context.requestId);
  const response = new Response(args.response.body, {
    status: args.response.status,
    statusText: args.response.statusText,
    headers,
  });
  const status = response.status;
  const level: CkLogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
  log(level, {
    event: 'http.request',
    service: args.context.service,
    stage: args.context.stage,
    requestId: args.context.requestId,
    boundary: args.boundary ?? 'http.request',
    method: args.context.method,
    path: args.context.path,
    status,
    durationMs: Date.now() - args.context.startedAt,
    visibility: args.context.visibility,
    cfRay: args.context.cfRay,
    reasonKey: args.reasonKey ?? null,
    detail: args.detail ?? null,
    agentId: args.agentId ?? null,
  });
  return response;
}
