import { resolveInternalServiceJwt } from './env/internal-service';

export const TOKYO_INTERNAL_SERVICE_ROMA_EDGE = 'roma.edge';

export function buildTokyoProductHeaders(args: {
  accountId: string;
  accountCapsule?: string | null;
  contentType?: string | null;
  accept?: string | null;
  headers?: HeadersInit;
}): Headers {
  const headers = new Headers(args.headers);
  headers.set('authorization', `Bearer ${resolveInternalServiceJwt('internal auth token required for Roma -> Tokyo product routes')}`);
  headers.set('x-ck-internal-service', TOKYO_INTERNAL_SERVICE_ROMA_EDGE);
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
