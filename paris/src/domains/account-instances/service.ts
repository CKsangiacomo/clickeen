import type { Env } from '../../shared/types';
import { errorDetail } from '../../shared/errors';
import { asTrimmedString } from '../../shared/validation';
import { requireTokyoBase } from '../../shared/tokyo';

type TokyoSavedConfigResult =
  | {
      ok: true;
      config: Record<string, unknown>;
      widgetType: string;
      configFp: string;
      updatedAt: string;
    }
  | {
      ok: false;
      status: number;
      error: string;
    };

export type TokyoSavedConfigState = {
  config: Record<string, unknown>;
  widgetType: string;
  configFp: string;
  updatedAt: string;
};

function resolveTokyoInternalHeaders(env: Env): Headers {
  const headers = new Headers({ accept: 'application/json' });
  const token = asTrimmedString(env.TOKYO_DEV_JWT);
  if (!token) {
    throw new Error('TOKYO_DEV_JWT missing');
  }
  headers.set('authorization', `Bearer ${token}`);
  headers.set('x-ck-internal-service', 'paris.local');
  return headers;
}

async function requestTokyoSavedConfig(args: {
  env: Env;
  accountId: string;
  publicId: string;
}): Promise<TokyoSavedConfigResult> {
  const base = requireTokyoBase(args.env);
  const headers = resolveTokyoInternalHeaders(args.env);
  headers.set('x-account-id', args.accountId);

  try {
    const response = await fetch(
      `${base}/renders/instances/${encodeURIComponent(args.publicId)}/saved.json?accountId=${encodeURIComponent(args.accountId)}`,
      {
        method: 'GET',
        headers,
      },
    );
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (response.status === 404) {
      return { ok: false, status: 404, error: 'not_found' };
    }
    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error:
          typeof payload?.error === 'object' &&
          payload.error &&
          typeof (payload.error as { reasonKey?: unknown }).reasonKey === 'string'
            ? String((payload.error as { reasonKey?: unknown }).reasonKey)
            : `tokyo_saved_config_http_${response.status}`,
      };
    }

    const config =
      payload?.config && typeof payload.config === 'object' && !Array.isArray(payload.config)
        ? (payload.config as Record<string, unknown>)
        : null;
    const widgetType = typeof payload?.widgetType === 'string' ? payload.widgetType.trim() : '';
    const configFp = typeof payload?.configFp === 'string' ? payload.configFp.trim() : '';
    const updatedAt = typeof payload?.updatedAt === 'string' ? payload.updatedAt.trim() : '';
    if (!config || !widgetType || !configFp || !updatedAt) {
      return { ok: false, status: 502, error: 'tokyo_saved_config_invalid_payload' };
    }
    return { ok: true, config, widgetType, configFp, updatedAt };
  } catch (error) {
    return {
      ok: false,
      status: 502,
      error: errorDetail(error),
    };
  }
}

export async function loadSavedConfigStateFromTokyo(args: {
  env: Env;
  accountId: string;
  publicId: string;
}): Promise<TokyoSavedConfigState | null> {
  const result = await requestTokyoSavedConfig(args);
  if (result.ok) {
    return {
      config: result.config,
      widgetType: result.widgetType,
      configFp: result.configFp,
      updatedAt: result.updatedAt,
    };
  }
  if (result.status === 404) return null;
  throw new Error(result.error);
}
