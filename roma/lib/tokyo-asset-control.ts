import { getOptionalRequestContext } from '@cloudflare/next-on-pages';

const TOKYO_ASSET_CONTROL_ORIGIN = 'https://tokyo-asset-control.internal';

type TokyoAssetControlBinding = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

function resolveTokyoAssetControlBinding(): TokyoAssetControlBinding {
  const requestContext = getOptionalRequestContext();
  const binding = requestContext?.env?.TOKYO_ASSET_CONTROL;
  if (binding && typeof binding.fetch === 'function') {
    return binding;
  }
  throw new Error('[Roma] Missing TOKYO_ASSET_CONTROL service binding');
}

export function assertTokyoAssetControlBindingAvailable(): void {
  resolveTokyoAssetControlBinding();
}

export function buildTokyoAssetControlHeaders(args: {
  accountId: string;
  accountCapsule?: string | null;
  contentType?: string | null;
  accept?: string | null;
  headers?: HeadersInit;
}): Headers {
  const headers = new Headers(args.headers);
  headers.set('x-account-id', args.accountId);
  headers.set('x-ck-internal-service', 'roma.edge');
  headers.set('accept', args.accept || 'application/json');
  if (args.accountCapsule) {
    headers.set('x-ck-authz-capsule', args.accountCapsule);
  }
  if (args.contentType) {
    headers.set('content-type', args.contentType);
  }
  return headers;
}

export async function fetchTokyoAssetControl(args: {
  path: string;
  method: string;
  headers?: HeadersInit;
  body?: BodyInit;
}): Promise<Response> {
  const binding = resolveTokyoAssetControlBinding();
  const target = new URL(
    args.path.startsWith('/') ? args.path : `/${args.path}`,
    TOKYO_ASSET_CONTROL_ORIGIN,
  );
  return binding.fetch(target.toString(), {
    method: args.method,
    headers: args.headers,
    cache: 'no-store',
    ...(args.body !== undefined ? { body: args.body } : {}),
  });
}
