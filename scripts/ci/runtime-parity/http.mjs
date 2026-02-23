import { parseJsonSafe, readString, sleep } from './utils.mjs';

const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504, 520, 522, 523, 524]);
const DEFAULT_TIMEOUT_MS = 12_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 300;

function parsePositiveInt(raw, fallback) {
  const parsed = Number.parseInt(String(raw ?? '').trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return parsed;
}

function resolveRequestPolicy(init = {}) {
  return {
    timeoutMs: parsePositiveInt(init.timeoutMs ?? process.env.RUNTIME_PARITY_FETCH_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    retries: parsePositiveInt(init.retries ?? process.env.RUNTIME_PARITY_FETCH_RETRIES, DEFAULT_RETRIES),
    retryDelayMs: parsePositiveInt(
      init.retryDelayMs ?? process.env.RUNTIME_PARITY_FETCH_RETRY_DELAY_MS,
      DEFAULT_RETRY_DELAY_MS,
    ),
  };
}

async function fetchOnce(url, init, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      method: init.method || 'GET',
      headers: toHeaders(init.headers),
      body: init.body,
      cache: 'no-store',
      redirect: 'manual',
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function toHeaders(initHeaders) {
  const headers = new Headers(initHeaders || {});
  headers.set('cache-control', 'no-store');
  return headers;
}

export function authHeaders(accessToken, extraHeaders) {
  const headers = toHeaders(extraHeaders);
  if (accessToken) headers.set('authorization', `Bearer ${accessToken}`);
  return headers;
}

export async function fetchEnvelope(url, init = {}) {
  const policy = resolveRequestPolicy(init);
  let lastError = null;

  for (let attempt = 0; attempt <= policy.retries; attempt += 1) {
    try {
      const response = await fetchOnce(url, init, policy.timeoutMs);
      const text = await response.text().catch(() => '');
      const json = parseJsonSafe(text);
      const envelope = {
        url,
        response,
        status: response.status,
        ok: response.ok,
        text,
        json,
        attempt,
      };

      const shouldRetryStatus = RETRYABLE_STATUS_CODES.has(response.status) && attempt < policy.retries;
      if (shouldRetryStatus) {
        await sleep(policy.retryDelayMs * (attempt + 1));
        continue;
      }

      return envelope;
    } catch (error) {
      lastError = error;
      if (attempt >= policy.retries) break;
      await sleep(policy.retryDelayMs * (attempt + 1));
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError || 'unknown fetch error');
  throw new Error(`[runtime-parity] fetch failed url=${url} detail=${detail}`);
}

export function extractDefaults(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { accountId: '', workspaceId: '' };
  }
  const defaults =
    payload.defaults && typeof payload.defaults === 'object' && !Array.isArray(payload.defaults)
      ? payload.defaults
      : null;
  return {
    accountId: readString(defaults?.accountId),
    workspaceId: readString(defaults?.workspaceId),
  };
}
