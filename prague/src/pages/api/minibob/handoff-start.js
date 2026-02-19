import { isCuratedOrMainWidgetPublicId } from '@clickeen/ck-contracts';

export const prerender = false;
const WIDGET_TYPE_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const MAX_DRAFT_CONFIG_BYTES = 7000;
const PARIS_TIMEOUT_MS = 4000;

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function asTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isRecord(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function isJsonValue(value) {
  if (value === null) return true;
  if (typeof value === 'string') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  if (Array.isArray(value)) return value.every((entry) => isJsonValue(entry));
  if (isRecord(value)) {
    for (const key of Object.keys(value)) {
      if (!isJsonValue(value[key])) return false;
    }
    return true;
  }
  return false;
}

function readRuntimeEnvValue(runtimeEnv, key) {
  if (!runtimeEnv || typeof runtimeEnv !== 'object') return '';
  const value = runtimeEnv[key];
  if (typeof value === 'string') return asTrimmedString(value);
  if (value == null) return '';
  return asTrimmedString(String(value));
}

function resolveParisBaseUrl(runtimeEnv) {
  const raw =
    readRuntimeEnvValue(runtimeEnv, 'PUBLIC_PARIS_URL') ||
    readRuntimeEnvValue(runtimeEnv, 'PARIS_BASE_URL') ||
    asTrimmedString(process.env.PUBLIC_PARIS_URL) ||
    asTrimmedString(process.env.PARIS_BASE_URL);
  return raw.replace(/\/+$/, '');
}

async function fetchWithTimeout(url, init, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function upstreamErrorMessage(payload) {
  if (!payload || typeof payload !== 'object') return '';
  if (typeof payload.message === 'string' && payload.message.trim()) return payload.message.trim();
  if (typeof payload.error === 'string' && payload.error.trim()) return payload.error.trim();
  if (
    payload.error &&
    typeof payload.error === 'object' &&
    typeof payload.error.reasonKey === 'string' &&
    payload.error.reasonKey.trim()
  ) {
    return payload.error.reasonKey.trim();
  }
  return '';
}

export async function POST({ request, locals }) {
  const runtimeEnv = locals?.runtime?.env;
  const parisBase = resolveParisBaseUrl(runtimeEnv);
  if (!parisBase) {
    return json(
      {
        error: 'HANDOFF_START_UNAVAILABLE',
        message: 'PUBLIC_PARIS_URL (or PARIS_BASE_URL) is required for MiniBob handoff start.',
      },
      503,
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'INVALID_PAYLOAD', message: 'Expected JSON payload.' }, 422);
  }
  if (!isRecord(body)) {
    return json({ error: 'INVALID_PAYLOAD', message: 'Expected JSON object payload.' }, 422);
  }

  const publicId = asTrimmedString(body.publicId);
  if (!publicId || !isCuratedOrMainWidgetPublicId(publicId)) {
    return json(
      {
        error: 'INVALID_PUBLIC_ID',
        message: 'publicId is required and must be a curated/base MiniBob source (wgt_main_* or wgt_curated_*).',
      },
      422,
    );
  }

  let widgetType;
  if (body.widgetType !== undefined) {
    widgetType = asTrimmedString(body.widgetType);
    if (!widgetType || !WIDGET_TYPE_PATTERN.test(widgetType)) {
      return json({ error: 'INVALID_WIDGET_TYPE', message: 'widgetType, when present, must be lowercase slug format.' }, 422);
    }
  }

  let draftConfig;
  if (body.draftConfig !== undefined) {
    if (!isRecord(body.draftConfig)) {
      return json({ error: 'INVALID_DRAFT_CONFIG', message: 'draftConfig must be an object when provided.' }, 422);
    }
    if (!isJsonValue(body.draftConfig)) {
      return json({ error: 'INVALID_DRAFT_CONFIG', message: 'draftConfig contains unsupported non-JSON values.' }, 422);
    }
    const serialized = JSON.stringify(body.draftConfig);
    if (serialized.length > MAX_DRAFT_CONFIG_BYTES) {
      return json(
        {
          error: 'DRAFT_TOO_LARGE',
          message: `draftConfig exceeds ${MAX_DRAFT_CONFIG_BYTES} bytes and cannot be sent as continuation context.`,
        },
        422,
      );
    }
    draftConfig = JSON.parse(serialized);
  }

  let upstream;
  try {
    upstream = await fetchWithTimeout(
      `${parisBase}/api/minibob/handoff/start`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sourcePublicId: publicId,
          ...(widgetType ? { widgetType } : {}),
          ...(draftConfig ? { draftConfig } : {}),
        }),
      },
      PARIS_TIMEOUT_MS,
    );
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return json(
      {
        error: 'HANDOFF_START_FAILED',
        message: `Paris handoff start unavailable (${detail || 'unknown_error'}).`,
      },
      503,
    );
  }

  const upstreamPayload = await upstream.json().catch(() => null);
  if (!upstream.ok) {
    const message = upstreamErrorMessage(upstreamPayload) || `Paris handoff start failed (${upstream.status})`;
    return json({ error: 'HANDOFF_START_REJECTED', message }, upstream.status);
  }

  const handoffId = asTrimmedString(upstreamPayload?.handoffId);
  if (!handoffId) {
    return json({ error: 'HANDOFF_START_FAILED', message: 'Paris handoff start returned no handoffId.' }, 502);
  }

  return json(
    {
      handoffId,
      sourcePublicId: asTrimmedString(upstreamPayload?.sourcePublicId) || publicId,
      expiresAt: asTrimmedString(upstreamPayload?.expiresAt) || null,
    },
    201,
  );
}
