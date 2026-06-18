import { asTrimmedString, isRecord } from '@clickeen/ck-contracts';
import {
  buildTokyoProductControlHeaders,
  fetchTokyoProductControl,
} from './tokyo-product-control';

export type TokyoCallContext = {
  accountId: string;
  accountCapsule?: string | null;
  internalServiceName?: string | null;
  requestId?: string | null;
};

export type TokyoCallFailure = {
  ok: false;
  status: number;
  error: {
    kind: 'VALIDATION' | 'AUTH' | 'DENY' | 'NOT_FOUND' | 'UPSTREAM_UNAVAILABLE';
    reasonKey: string;
    detail?: string;
    pageIds?: string[];
  };
};

export type TokyoCallResult<T> =
  | { ok: true; value: T; status: number }
  | TokyoCallFailure;

function resolveTokyoErrorDetail(payload: unknown, fallback: string): string {
  if (isRecord(payload) && isRecord(payload.error)) {
    return (
      asTrimmedString(payload.error.detail) ??
      asTrimmedString(payload.error.reasonKey) ??
      fallback
    );
  }
  return fallback;
}

function buildTokyoFailure(args: {
  response: Response;
  payload: unknown;
  fallbackDetail: string;
  fallbackReasonKey: string;
}): TokyoCallFailure {
  const upstreamError = isRecord(args.payload) && isRecord(args.payload.error) ? args.payload.error : null;
  const detail = resolveTokyoErrorDetail(args.payload, args.fallbackDetail);
  const upstreamReasonKey = upstreamError ? asTrimmedString(upstreamError.reasonKey) : null;
  const pageIds = Array.isArray(upstreamError?.pageIds)
    ? upstreamError.pageIds.filter((pageId): pageId is string => typeof pageId === 'string' && pageId.length > 0)
    : undefined;
  const mapped =
    args.response.status === 401
      ? { kind: 'AUTH' as const, status: 401 }
      : args.response.status === 403
        ? { kind: 'DENY' as const, status: 403 }
        : args.response.status === 404
          ? { kind: 'NOT_FOUND' as const, status: 404 }
          : args.response.status === 422
            ? { kind: 'VALIDATION' as const, status: 422 }
            : { kind: 'UPSTREAM_UNAVAILABLE' as const, status: 502 };

  return {
    ok: false,
    status: mapped.status,
    error: {
      kind: mapped.kind,
      reasonKey:
        mapped.kind === 'UPSTREAM_UNAVAILABLE'
          ? (upstreamReasonKey ?? args.fallbackReasonKey)
          : (upstreamReasonKey ?? detail),
      detail,
      ...(pageIds?.length ? { pageIds } : {}),
    },
  };
}

export async function callTokyo<T>(
  context: TokyoCallContext,
  args: {
    path: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE';
    body?: unknown;
    decode: (payload: unknown) => T;
    errorKey: string;
    errorDetail: string;
  },
): Promise<TokyoCallResult<T>> {
  const response = await fetchTokyoProductControl({
    path: args.path,
    method: args.method,
    headers: buildTokyoProductControlHeaders({
      accountId: context.accountId,
      accountCapsule: context.accountCapsule,
      internalServiceName: context.internalServiceName,
      requestId: context.requestId,
      ...(args.body !== undefined ? { contentType: 'application/json' } : {}),
    }),
    ...(args.body !== undefined ? { body: JSON.stringify(args.body) } : {}),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    return buildTokyoFailure({
      response,
      payload,
      fallbackDetail: args.errorDetail,
      fallbackReasonKey: args.errorKey,
    });
  }
  return { ok: true, value: args.decode(payload), status: response.status };
}
