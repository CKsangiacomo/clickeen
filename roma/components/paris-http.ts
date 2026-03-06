'use client';

export function parseParisReason(payload: unknown, status: number): string {
  if (!payload || typeof payload !== 'object') return `HTTP_${status}`;
  const withError = payload as { error?: unknown };
  if (typeof withError.error === 'string') return withError.error;
  if (withError.error && typeof withError.error === 'object') {
    const reasonKey = (withError.error as { reasonKey?: unknown }).reasonKey;
    if (typeof reasonKey === 'string') return reasonKey;
  }
  return `HTTP_${status}`;
}

type ParisFetchInit = RequestInit & { timeoutMs?: number };

type ParisRequestError = Error & {
  reason?: string;
  status?: number;
};

const DEFAULT_PARIS_FETCH_TIMEOUT_MS = 15_000;

function asParisRequestError(reason: string, status: number): ParisRequestError {
  const error = new Error(reason) as ParisRequestError;
  error.reason = reason;
  error.status = status;
  return error;
}

async function fetchParisJsonOnce<T = unknown>(url: string, init: ParisFetchInit | undefined, timeoutMs: number): Promise<T> {
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
      const reason = parseParisReason(payload, response.status);
      throw asParisRequestError(reason, response.status);
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

export async function fetchParisJson<T = unknown>(url: string, init?: ParisFetchInit): Promise<T> {
  const timeoutMs =
    typeof init?.timeoutMs === 'number' && Number.isFinite(init.timeoutMs) && init.timeoutMs > 0
      ? Math.max(250, Math.round(init.timeoutMs))
      : DEFAULT_PARIS_FETCH_TIMEOUT_MS;
  return fetchParisJsonOnce<T>(url, init, timeoutMs);
}
