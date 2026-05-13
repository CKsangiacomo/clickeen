import { NextResponse } from 'next/server';
import {
  CK_REQUEST_ID_HEADER,
  normalizeRequestId,
  serializeCkLogEvent,
  type CkLogEvent,
  type CkLogLevel,
} from '@clickeen/ck-contracts';

export type VeniceRequestContext = {
  service: 'venice';
  stage: string;
  requestId: string;
  method: string;
  path: string;
  visibility: 'public';
  cfRay: string | null;
  startedAt: number;
};

function resolveVeniceStage(request: Request): string {
  const configured = process.env.ENV_STAGE || process.env.NEXT_PUBLIC_ENV_STAGE || process.env.VERCEL_ENV;
  if (configured) return configured;
  const host = new URL(request.url).hostname;
  if (host === 'localhost' || host === '127.0.0.1') return 'local';
  if (host.includes('.dev.')) return 'cloud-dev';
  return 'unknown';
}

export function createVeniceRequestContext(request: Request): VeniceRequestContext {
  const url = new URL(request.url);
  return {
    service: 'venice',
    stage: resolveVeniceStage(request),
    requestId: normalizeRequestId(request.headers.get(CK_REQUEST_ID_HEADER)) ?? crypto.randomUUID(),
    method: request.method,
    path: `${url.pathname}${url.search}`,
    visibility: 'public',
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

export function finalizeVeniceObservedResponse(args: {
  context: VeniceRequestContext;
  response: Response;
  boundary?: string;
  reasonKey?: string | null;
  detail?: string | null;
  instanceId?: string | null;
}): NextResponse {
  const response = new NextResponse(args.response.body, {
    status: args.response.status,
    statusText: args.response.statusText,
    headers: args.response.headers,
  });
  response.headers.set(CK_REQUEST_ID_HEADER, args.context.requestId);
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
    instanceId: args.instanceId ?? null,
  });
  return response;
}

export function withVeniceRequestId(context: VeniceRequestContext, headers?: HeadersInit): Headers {
  const next = new Headers(headers);
  next.set(CK_REQUEST_ID_HEADER, context.requestId);
  return next;
}
