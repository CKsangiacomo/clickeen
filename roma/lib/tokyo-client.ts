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
    current?: number;
    limit?: number;
  };
  committed?: unknown;
};

export type TokyoCallResult<T> =
  | { ok: true; value: T; status: number }
  | TokyoCallFailure;

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
  const headers = buildTokyoProductControlHeaders({
    accountId: context.accountId,
    accountCapsule: context.accountCapsule,
    internalServiceName: context.internalServiceName,
    requestId: context.requestId,
    ...(args.body !== undefined ? { contentType: 'application/json' } : {}),
  });
  const body = args.body !== undefined ? JSON.stringify(args.body) : undefined;
  let response: Response;
  try {
    response = await fetchTokyoProductControl({
      path: args.path,
      method: args.method,
      headers,
      ...(body !== undefined ? { body } : {}),
    });
  } catch (error) {
    console.error('[Roma] Tokyo product-control request failed', {
      path: args.path,
      method: args.method,
      requestId: context.requestId ?? null,
      detail: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      status: 502,
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: args.errorKey,
        detail: args.errorDetail,
      },
    };
  }
  const payload = await response.json();
  if (!response.ok) {
    const failure = payload as {
      error: TokyoCallFailure['error'];
      committed?: unknown;
    };
    return {
      ok: false,
      status: response.status,
      error: failure.error,
      ...(failure.committed === undefined ? {} : { committed: failure.committed }),
    };
  }
  return { ok: true, value: args.decode(payload), status: response.status };
}
