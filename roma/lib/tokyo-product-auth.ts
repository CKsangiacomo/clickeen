import { resolveInternalServiceJwt } from './env/internal-service';

export const TOKYO_INTERNAL_SERVICE_ROMA_EDGE = 'roma.edge';

export function buildTokyoScopedHeaders(args: {
  accountId: string;
  accessToken?: string | null;
  internalServiceName?: string | null;
  accountCapsule?: string | null;
  contentType?: string | null;
  accept?: string | null;
  headers?: HeadersInit;
}): Headers {
  const headers = new Headers(args.headers);
  const accessToken = String(args.accessToken || '').trim();
  const internalServiceName = String(args.internalServiceName || '').trim().toLowerCase();
  // Roma product routes should use internal service auth by default. Only honor
  // an explicit override when both token and service name are present.
  if (accessToken && internalServiceName) {
    headers.set('authorization', `Bearer ${accessToken}`);
    headers.set('x-ck-internal-service', internalServiceName);
  } else {
    headers.set(
      'authorization',
      `Bearer ${resolveInternalServiceJwt('internal auth token required for Roma -> Tokyo product routes')}`,
    );
    headers.set('x-ck-internal-service', TOKYO_INTERNAL_SERVICE_ROMA_EDGE);
  }
  headers.set('x-account-id', args.accountId);
  headers.set('accept', args.accept || 'application/json');
  if (args.accountCapsule) {
    headers.set('x-ck-authz-capsule', args.accountCapsule);
  }
  if (args.contentType) {
    headers.set('content-type', args.contentType);
  }
  return headers;
}

export function buildTokyoProductHeaders(args: {
  accountId: string;
  accountCapsule?: string | null;
  contentType?: string | null;
  accept?: string | null;
  headers?: HeadersInit;
}): Headers {
  return buildTokyoScopedHeaders(args);
}
