'use client';

export function parseApiErrorReason(payload: unknown, status: number): string {
  if (!payload || typeof payload !== 'object') return `HTTP_${status}`;
  const withError = payload as { error?: unknown };
  if (typeof withError.error === 'string') return withError.error;
  if (withError.error && typeof withError.error === 'object') {
    const reasonKey = (withError.error as { reasonKey?: unknown }).reasonKey;
    if (typeof reasonKey === 'string') return reasonKey;
  }
  return `HTTP_${status}`;
}

type SameOriginJsonFetchInit = RequestInit & { timeoutMs?: number };

type SameOriginJsonRequestError = Error & {
  reason?: string;
  status?: number;
};

const DEFAULT_SAME_ORIGIN_FETCH_TIMEOUT_MS = 15_000;

function asApiRequestError(reason: string, status: number): SameOriginJsonRequestError {
  const error = new Error(reason) as SameOriginJsonRequestError;
  error.reason = reason;
  error.status = status;
  return error;
}

async function fetchSameOriginJsonOnce<T = unknown>(
  url: string,
  init: SameOriginJsonFetchInit | undefined,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  const requestInit: RequestInit = {
    cache: 'no-store',
    ...init,
    headers: init?.headers,
    signal: controller.signal,
  };
  delete (requestInit as { timeoutMs?: number }).timeoutMs;

  try {
    const response = await fetch(url, requestInit);
    const payload = (await response.json().catch(() => null)) as T | { error?: unknown } | null;
    if (!response.ok) {
      const reason = parseApiErrorReason(payload, response.status);
      throw asApiRequestError(reason, response.status);
    }
    return payload as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('coreui.errors.network.timeout');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function fetchSameOriginJson<T = unknown>(
  url: string,
  init?: SameOriginJsonFetchInit,
): Promise<T> {
  const timeoutMs =
    typeof init?.timeoutMs === 'number' && Number.isFinite(init.timeoutMs) && init.timeoutMs > 0
      ? Math.max(250, Math.round(init.timeoutMs))
      : DEFAULT_SAME_ORIGIN_FETCH_TIMEOUT_MS;
  return fetchSameOriginJsonOnce<T>(url, init, timeoutMs);
}
