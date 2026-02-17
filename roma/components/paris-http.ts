'use client';

const ROMA_AUTHZ_CAPSULE_HEADER = 'x-ck-authz-capsule';
const ROMA_ACCOUNT_CAPSULE_HEADER = 'x-ck-account-capsule';
const ROMA_AUTHZ_CAPSULE_STORE_KEY = '__CK_ROMA_AUTHZ_CAPSULE_V1__';
const ROMA_AUTHZ_CAPSULE_SESSION_KEY = '__CK_ROMA_AUTHZ_CAPSULE_SESSION_V1__';
const ROMA_ACCOUNT_CAPSULE_STORE_KEY = '__CK_ROMA_ACCOUNT_CAPSULE_V1__';
const ROMA_ACCOUNT_CAPSULE_SESSION_KEY = '__CK_ROMA_ACCOUNT_CAPSULE_SESSION_V1__';
const ROMA_AUTHZ_BOOTSTRAP_INFLIGHT_KEY = '__CK_ROMA_AUTHZ_BOOTSTRAP_INFLIGHT_V1__';
const ROMA_AUTHZ_BOOTSTRAP_PATH = '/api/bootstrap';

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
type ParisBootstrapPayload = {
  authz?: {
    workspaceCapsule?: string | null;
    accountCapsule?: string | null;
  } | null;
};

type ParisRequestError = Error & {
  reason?: string;
  status?: number;
};

const DEFAULT_PARIS_FETCH_TIMEOUT_MS = 15_000;

function normalizeCapsule(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function readStoredRomaAuthzCapsule(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return normalizeCapsule(window.sessionStorage.getItem(ROMA_AUTHZ_CAPSULE_SESSION_KEY));
  } catch {
    return null;
  }
}

function writeStoredRomaAuthzCapsule(capsule: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (capsule) {
      window.sessionStorage.setItem(ROMA_AUTHZ_CAPSULE_SESSION_KEY, capsule);
      return;
    }
    window.sessionStorage.removeItem(ROMA_AUTHZ_CAPSULE_SESSION_KEY);
  } catch {
    // Ignore session storage failures.
  }
}

function readStoredRomaAccountCapsule(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return normalizeCapsule(window.sessionStorage.getItem(ROMA_ACCOUNT_CAPSULE_SESSION_KEY));
  } catch {
    return null;
  }
}

function writeStoredRomaAccountCapsule(capsule: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (capsule) {
      window.sessionStorage.setItem(ROMA_ACCOUNT_CAPSULE_SESSION_KEY, capsule);
      return;
    }
    window.sessionStorage.removeItem(ROMA_ACCOUNT_CAPSULE_SESSION_KEY);
  } catch {
    // Ignore session storage failures.
  }
}

function readRomaAuthzCapsule(): string | null {
  const scope = globalThis as Record<string, unknown>;
  const inMemory = normalizeCapsule(scope[ROMA_AUTHZ_CAPSULE_STORE_KEY]);
  if (inMemory) return inMemory;

  const persisted = readStoredRomaAuthzCapsule();
  if (!persisted) return null;
  scope[ROMA_AUTHZ_CAPSULE_STORE_KEY] = persisted;
  return persisted;
}

export function setRomaAuthzCapsule(capsule: string | null): void {
  const scope = globalThis as Record<string, unknown>;
  const normalized = normalizeCapsule(capsule);
  if (normalized) {
    scope[ROMA_AUTHZ_CAPSULE_STORE_KEY] = normalized;
    writeStoredRomaAuthzCapsule(normalized);
    return;
  }
  delete scope[ROMA_AUTHZ_CAPSULE_STORE_KEY];
  writeStoredRomaAuthzCapsule(null);
}

function readRomaAccountCapsule(): string | null {
  const scope = globalThis as Record<string, unknown>;
  const inMemory = normalizeCapsule(scope[ROMA_ACCOUNT_CAPSULE_STORE_KEY]);
  if (inMemory) return inMemory;

  const persisted = readStoredRomaAccountCapsule();
  if (!persisted) return null;
  scope[ROMA_ACCOUNT_CAPSULE_STORE_KEY] = persisted;
  return persisted;
}

export function setRomaAccountCapsule(capsule: string | null): void {
  const scope = globalThis as Record<string, unknown>;
  const normalized = normalizeCapsule(capsule);
  if (normalized) {
    scope[ROMA_ACCOUNT_CAPSULE_STORE_KEY] = normalized;
    writeStoredRomaAccountCapsule(normalized);
    return;
  }
  delete scope[ROMA_ACCOUNT_CAPSULE_STORE_KEY];
  writeStoredRomaAccountCapsule(null);
}

type HydratedCapsules = {
  workspace: string | null;
  account: string | null;
};

function readBootstrapInFlight(): Promise<HydratedCapsules> | null {
  const scope = globalThis as Record<string, unknown>;
  const value = scope[ROMA_AUTHZ_BOOTSTRAP_INFLIGHT_KEY];
  if (value && typeof (value as { then?: unknown }).then === 'function') {
    return value as Promise<HydratedCapsules>;
  }
  return null;
}

function writeBootstrapInFlight(request: Promise<HydratedCapsules> | null): void {
  const scope = globalThis as Record<string, unknown>;
  if (request) {
    scope[ROMA_AUTHZ_BOOTSTRAP_INFLIGHT_KEY] = request;
    return;
  }
  delete scope[ROMA_AUTHZ_BOOTSTRAP_INFLIGHT_KEY];
}

async function hydrateRomaAuthzCapsule(force = false): Promise<HydratedCapsules> {
  const existingWorkspace = readRomaAuthzCapsule();
  const existingAccount = readRomaAccountCapsule();
  if (!force && (existingWorkspace || existingAccount)) {
    return { workspace: existingWorkspace, account: existingAccount };
  }

  const inFlight = readBootstrapInFlight();
  if (inFlight) return inFlight;

  const request = (async () => {
    try {
      const response = await fetch(ROMA_AUTHZ_BOOTSTRAP_PATH, { cache: 'no-store' });
      const payload = (await response.json().catch(() => null)) as
        | ParisBootstrapPayload
        | { error?: unknown }
        | null;
      if (!response.ok) {
        setRomaAuthzCapsule(null);
        setRomaAccountCapsule(null);
        return { workspace: null, account: null };
      }
      const capsule = normalizeCapsule((payload as ParisBootstrapPayload)?.authz?.workspaceCapsule);
      const accountCapsule = normalizeCapsule((payload as ParisBootstrapPayload)?.authz?.accountCapsule);
      setRomaAuthzCapsule(capsule);
      setRomaAccountCapsule(accountCapsule);
      return { workspace: capsule, account: accountCapsule };
    } catch {
      return {
        workspace: readRomaAuthzCapsule(),
        account: readRomaAccountCapsule(),
      };
    } finally {
      writeBootstrapInFlight(null);
    }
  })();

  writeBootstrapInFlight(request);
  return request;
}

function isParisRequestUrl(url: string): boolean {
  const normalized = String(url || '').trim().toLowerCase();
  return normalized === '/api/paris' || normalized.startsWith('/api/paris/');
}

function asParisRequestError(reason: string, status: number): ParisRequestError {
  const error = new Error(reason) as ParisRequestError;
  error.reason = reason;
  error.status = status;
  return error;
}

function shouldRetryWithFreshCapsule(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const reason = String(error.message || '').trim();
  return (
    reason === 'coreui.errors.auth.forbidden' ||
    reason === 'coreui.errors.auth.required' ||
    reason === 'HTTP_403' ||
    reason === 'HTTP_401'
  );
}

async function fetchParisJsonOnce<T = unknown>(
  url: string,
  init: ParisFetchInit | undefined,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers(init?.headers);
  const workspaceCapsule = readRomaAuthzCapsule();
  const accountCapsule = readRomaAccountCapsule();
  if (isParisRequestUrl(url)) {
    if (workspaceCapsule) headers.set(ROMA_AUTHZ_CAPSULE_HEADER, workspaceCapsule);
    if (accountCapsule) headers.set(ROMA_ACCOUNT_CAPSULE_HEADER, accountCapsule);
  }

  const requestInit: RequestInit = {
    cache: 'no-store',
    ...init,
    headers,
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

  const parisRequest = isParisRequestUrl(url);
  if (parisRequest && !readRomaAuthzCapsule() && !readRomaAccountCapsule()) {
    await hydrateRomaAuthzCapsule(false);
  }

  try {
    return await fetchParisJsonOnce<T>(url, init, timeoutMs);
  } catch (error) {
    if (!parisRequest || !shouldRetryWithFreshCapsule(error)) {
      throw error;
    }
    await hydrateRomaAuthzCapsule(true);
    try {
      return await fetchParisJsonOnce<T>(url, init, timeoutMs);
    } catch (retryError) {
      throw retryError;
    }
  }
}
