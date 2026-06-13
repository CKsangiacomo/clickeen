import { CK_REQUEST_ID_HEADER, asTrimmedString, isRecord } from '@clickeen/ck-contracts';
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

async function sendTokyoJson(args: {
  env: Env;
  accountPublicId: string;
  method: 'POST' | 'PUT';
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
    method: args.method,
    headers,
    body: JSON.stringify(args.body),
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new HttpError(response.status >= 500 ? 502 : response.status, {
      code: 'PROVIDER_ERROR',
      provider: 'tokyo',
      message: `tokyo_http_${response.status}`,
    });
  }
  return payload;
}

export async function completeLocaleTranslationInTokyo(args: {
  env: Env;
  accountPublicId: string;
  instanceId: string;
  targetLocale: string;
  job: unknown;
  values: Record<string, string>;
  requestId?: string | null;
}): Promise<{ applied: boolean; reasonKey?: string; detail?: string }> {
  const payload = await sendTokyoJson({
    env: args.env,
    accountPublicId: args.accountPublicId,
    method: 'PUT',
    path: `/__internal/instances/${encodeURIComponent(args.instanceId)}/translations/${encodeURIComponent(args.targetLocale)}/complete`,
    body: {
      job: args.job,
      values: args.values,
    },
    requestId: args.requestId,
  });
  const completion = isRecord(payload) && isRecord(payload.completion) ? payload.completion : null;
  if (!completion || completion.ok !== true) {
    throw new HttpError(502, {
      code: 'PROVIDER_ERROR',
      provider: 'tokyo',
      message: 'tokyo_translation_completion_invalid_payload',
    });
  }
  const applied = completion.applied === true;
  const reasonKey = asTrimmedString(completion.reasonKey);
  const detail = asTrimmedString(completion.detail);
  return {
    applied,
    ...(reasonKey ? { reasonKey } : {}),
    ...(detail ? { detail } : {}),
  };
}

export async function failLocaleTranslationInTokyo(args: {
  env: Env;
  accountPublicId: string;
  instanceId: string;
  targetLocale: string;
  job: unknown;
  reasonKey: string;
  detail: string;
  requestId?: string | null;
}): Promise<{ recorded: boolean; reasonKey?: string; detail?: string }> {
  const payload = await sendTokyoJson({
    env: args.env,
    accountPublicId: args.accountPublicId,
    method: 'PUT',
    path: `/__internal/instances/${encodeURIComponent(args.instanceId)}/translations/${encodeURIComponent(args.targetLocale)}/fail`,
    body: {
      job: args.job,
      reasonKey: args.reasonKey,
      detail: args.detail,
    },
    requestId: args.requestId,
  });
  const failure = isRecord(payload) && isRecord(payload.failure) ? payload.failure : null;
  if (!failure || failure.ok !== true) {
    throw new HttpError(502, {
      code: 'PROVIDER_ERROR',
      provider: 'tokyo',
      message: 'tokyo_translation_failure_invalid_payload',
    });
  }
  const recorded = failure.recorded === true;
  const reasonKey = asTrimmedString(failure.reasonKey);
  const detail = asTrimmedString(failure.detail);
  return {
    recorded,
    ...(reasonKey ? { reasonKey } : {}),
    ...(detail ? { detail } : {}),
  };
}
