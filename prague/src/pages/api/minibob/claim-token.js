export const prerender = false;

const PUBLIC_ID_PATTERN =
  /^(?:wgt_main_[a-z0-9][a-z0-9_-]*|wgt_curated_[a-z0-9][a-z0-9_-]*|wgt_[a-z0-9][a-z0-9_-]*_u_[a-z0-9][a-z0-9_-]*)$/;
const WIDGET_TYPE_PATTERN = /^[a-z0-9][a-z0-9_-]*$/;
const CLAIM_TTL_SEC = 60 * 60 * 24;
const MAX_DRAFT_CONFIG_BYTES = 7000;

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

function base64UrlEncodeBytes(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlEncodeUtf8(value) {
  const bytes = new TextEncoder().encode(value);
  return base64UrlEncodeBytes(bytes);
}

async function hmacSha256Base64Url(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return base64UrlEncodeBytes(new Uint8Array(signature));
}

function resolveClaimSecret() {
  const direct = asTrimmedString(process.env.MINIBOB_CLAIM_HMAC_SECRET);
  if (direct) return direct;
  const fallback = asTrimmedString(process.env.AI_GRANT_HMAC_SECRET);
  if (fallback) return fallback;
  return '';
}

export async function POST({ request }) {
  const secret = resolveClaimSecret();
  if (!secret) {
    return json(
      {
        error: 'CLAIM_SECRET_MISSING',
        message: 'MINIBOB_CLAIM_HMAC_SECRET (or AI_GRANT_HMAC_SECRET) is required for claim token minting.',
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
  if (!publicId || !PUBLIC_ID_PATTERN.test(publicId)) {
    return json({ error: 'INVALID_PUBLIC_ID', message: 'publicId is required and must match Clickeen instance format.' }, 422);
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
          message: `draftConfig exceeds ${MAX_DRAFT_CONFIG_BYTES} bytes and cannot be sent as claim token context.`,
        },
        422,
      );
    }
    draftConfig = JSON.parse(serialized);
  }

  const nonce = crypto.randomUUID().replace(/-/g, '');
  const iat = Math.floor(Date.now() / 1000);
  const payload = {
    nonce,
    publicId,
    iat,
    exp: iat + CLAIM_TTL_SEC,
    ...(widgetType ? { widgetType } : {}),
    ...(draftConfig ? { draftConfig } : {}),
  };

  const payloadB64 = base64UrlEncodeUtf8(JSON.stringify(payload));
  const signature = await hmacSha256Base64Url(secret, `mbc.v1.${payloadB64}`);

  return json({
    claimToken: `mbc.v1.${payloadB64}.${signature}`,
    publicId,
    exp: payload.exp,
  });
}
