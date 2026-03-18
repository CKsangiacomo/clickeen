const CLOUDFLARE_REQUEST_CONTEXT_SYMBOL = Symbol.for('__cloudflare-request-context__');

// This is intentionally narrow.
// Roma retains ambient Cloudflare request context only for edge-only binding access and
// request-scoped stage/env reads where Next route plumbing would otherwise widen many call signatures.
// Hot product-path reads such as account budget usage and rate-limit KV injection should prefer
// explicit request-boundary injection instead of reaching through this global accessor.

type CloudflareRequestContext = {
  env?: unknown;
};

function readCloudflareRequestContext<T extends CloudflareRequestContext>(): T | null {
  const value = (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
  if (!value || typeof value !== 'object') return null;
  return value as T;
}

function isNodeRuntime(): boolean {
  return typeof process !== 'undefined' && process.release?.name === 'node';
}

export function getOptionalCloudflareRequestContext<
  T extends CloudflareRequestContext = CloudflareRequestContext,
>(): T | null {
  return readCloudflareRequestContext<T>();
}

export function getCloudflareRequestContext<
  T extends CloudflareRequestContext = CloudflareRequestContext,
>(): T {
  const requestContext = readCloudflareRequestContext<T>();
  if (requestContext) return requestContext;

  if (isNodeRuntime()) {
    throw new Error(
      '[Roma] Cloudflare request context is unavailable in the Node.js runtime. This code must run inside a Cloudflare edge request.',
    );
  }

  throw new Error('[Roma] Cloudflare request context is unavailable.');
}
