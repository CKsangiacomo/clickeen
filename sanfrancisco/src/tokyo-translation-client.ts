import { CK_REQUEST_ID_HEADER, asTrimmedString, isRecord } from '@clickeen/ck-contracts';
import { resolveLanguageOverlayCode } from '@clickeen/ck-contracts/overlay-codebooks';
import { HttpError } from './http';
import type { Env } from './types';

const TOKYO_PRODUCT_CONTROL_ORIGIN = 'https://tokyo-product-control.internal';
const SANFRANCISCO_TRANSLATION_SERVICE = 'sanfrancisco.translation';

type TokyoProductControlBinding = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

function resolveTokyoProductControlBinding(env: Env): TokyoProductControlBinding {
  const binding = env.TOKYO_PRODUCT_CONTROL;
  if (binding && typeof binding.fetch === 'function') return binding;
  throw new HttpError(502, {
    code: 'PROVIDER_ERROR',
    provider: 'tokyo',
    message: 'Missing TOKYO_PRODUCT_CONTROL service binding',
  });
}

function resolveTokyoErrorDetail(payload: unknown, fallback: string): string {
  if (isRecord(payload) && isRecord(payload.error)) {
    return (
      asTrimmedString(payload.error.detail) ??
      asTrimmedString(payload.error.reasonKey) ??
      fallback
    );
  }
  return fallback;
}

async function postTokyoJson(args: {
  env: Env;
  accountPublicId: string;
  path: string;
  body: unknown;
  requestId?: string | null;
}): Promise<unknown> {
  const binding = resolveTokyoProductControlBinding(args.env);
  const headers = new Headers({
    accept: 'application/json',
    'content-type': 'application/json',
    'x-account-id': args.accountPublicId,
    'x-ck-internal-service': SANFRANCISCO_TRANSLATION_SERVICE,
  });
  if (args.requestId) headers.set(CK_REQUEST_ID_HEADER, args.requestId);
  const response = await binding.fetch(new URL(args.path, TOKYO_PRODUCT_CONTROL_ORIGIN).toString(), {
    method: 'POST',
    headers,
    body: JSON.stringify(args.body),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new HttpError(response.status >= 500 ? 502 : response.status, {
      code: 'PROVIDER_ERROR',
      provider: 'tokyo',
      message: resolveTokyoErrorDetail(payload, `tokyo_http_${response.status}`),
    });
  }
  return payload;
}

export async function writeInstanceLanguageOverlayToTokyo(args: {
  env: Env;
  accountPublicId: string;
  instanceId: string;
  widgetType: string;
  sourceVersion: number;
  targetLocale: string;
  values: Record<string, string>;
  requestId?: string | null;
}): Promise<{ overlayId: string }> {
  const languageCode = resolveLanguageOverlayCode(args.targetLocale);
  if (!languageCode) {
    throw new HttpError(400, {
      code: 'BAD_REQUEST',
      message: `No overlay language code for locale ${args.targetLocale}`,
    });
  }

  const payload = await postTokyoJson({
    env: args.env,
    accountPublicId: args.accountPublicId,
    path: '/__internal/overlays/languages/write.json',
    body: {
      instanceId: args.instanceId,
      widgetType: args.widgetType,
      sourceVersion: args.sourceVersion,
      languageCode,
      values: args.values,
    },
    requestId: args.requestId,
  });
  const overlayId = isRecord(payload) ? asTrimmedString(payload.overlayId) : null;
  if (!overlayId) {
    throw new HttpError(502, {
      code: 'PROVIDER_ERROR',
      provider: 'tokyo',
      message: 'tokyo_overlay_language_write_invalid_payload',
    });
  }
  return { overlayId };
}
