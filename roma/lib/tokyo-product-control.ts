import { getOptionalCloudflareRequestContext } from './cloudflare-request-context';

const TOKYO_PRODUCT_CONTROL_ORIGIN = 'https://tokyo-product-control.internal';
const DEFAULT_INTERNAL_SERVICE_NAME = 'roma.edge';

type TokyoProductControlBinding = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

function resolveTokyoProductControlBinding(): TokyoProductControlBinding {
  const requestContext = getOptionalCloudflareRequestContext<{ env?: { TOKYO_PRODUCT_CONTROL?: TokyoProductControlBinding } }>();
  const binding = requestContext?.env?.TOKYO_PRODUCT_CONTROL;
  if (binding && typeof binding.fetch === 'function') {
    return binding;
  }
  throw new Error('[Roma] Missing TOKYO_PRODUCT_CONTROL service binding');
}

export function assertTokyoProductControlBindingAvailable(): void {
  resolveTokyoProductControlBinding();
}

export function buildTokyoProductControlHeaders(args: {
  accountId: string;
  accountCapsule?: string | null;
  contentType?: string | null;
  accept?: string | null;
  internalServiceName?: string | null;
  headers?: HeadersInit;
}): Headers {
  const headers = new Headers(args.headers);
  headers.set('x-account-id', args.accountId);
  headers.set(
    'x-ck-internal-service',
    String(args.internalServiceName || DEFAULT_INTERNAL_SERVICE_NAME).trim() ||
      DEFAULT_INTERNAL_SERVICE_NAME,
  );
  headers.set('accept', args.accept || 'application/json');
  if (args.accountCapsule) {
    headers.set('x-ck-authz-capsule', args.accountCapsule);
  }
  if (args.contentType) {
    headers.set('content-type', args.contentType);
  }
  return headers;
}

export async function fetchTokyoProductControl(args: {
  path: string;
  method: string;
  headers?: HeadersInit;
  body?: BodyInit;
  baseUrl?: string | null;
  accessToken?: string | null;
}): Promise<Response> {
  const path = args.path.startsWith('/') ? args.path : `/${args.path}`;
  const baseUrl = String(args.baseUrl || '').trim().replace(/\/+$/, '');
  const accessToken = String(args.accessToken || '').trim();
  if (baseUrl) {
    if (!accessToken) {
      throw new Error('[Roma] Missing Tokyo product control access token');
    }
    const headers = new Headers(args.headers);
    headers.set('authorization', `Bearer ${accessToken}`);
    return fetch(`${baseUrl}${path}`, {
      method: args.method,
      headers,
      cache: 'no-store',
      ...(args.body !== undefined ? { body: args.body } : {}),
    });
  }

  const binding = resolveTokyoProductControlBinding();
  const headers = new Headers(args.headers);
  if (accessToken) {
    headers.set('authorization', `Bearer ${accessToken}`);
  }
  const target = new URL(
    path,
    TOKYO_PRODUCT_CONTROL_ORIGIN,
  );
  return binding.fetch(target.toString(), {
    method: args.method,
    headers,
    cache: 'no-store',
    ...(args.body !== undefined ? { body: args.body } : {}),
  });
}
