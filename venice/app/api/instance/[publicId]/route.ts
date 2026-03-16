import { computeBaseFingerprint } from '@clickeen/l10n';
import { NextResponse } from 'next/server';
import { tokyoFetch } from '@venice/lib/tokyo';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const BASE_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
} as const;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: BASE_HEADERS });
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function ckError(kind: string, reasonKey: string, status: number, detail?: string) {
  return json(
    {
      error: {
        kind,
        reasonKey,
        ...(detail ? { detail } : {}),
      },
    },
    status,
  );
}

function readConfigPack(payload: unknown): Record<string, unknown> | null {
  const record = asRecord(payload);
  if (!record) return null;
  const config = asRecord(record.config);
  if (config) {
    return config;
  }
  const state = asRecord(record.state);
  if (state) {
    return state;
  }
  return record;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: BASE_HEADERS });
}

export async function GET(_req: Request, ctx: { params: Promise<{ publicId: string }> }) {
  const { publicId: rawPublicId } = await ctx.params;
  const publicId = String(rawPublicId || '').trim();
  if (!publicId) {
    return ckError('VALIDATION', 'coreui.errors.instance.notFound', 404);
  }

  const pointerRes = await tokyoFetch(`/renders/instances/${encodeURIComponent(publicId)}/live/r.json`, {
    method: 'GET',
    cache: 'no-store',
  });
  if (pointerRes.status === 404) {
    return ckError('NOT_FOUND', 'coreui.errors.instance.notFound', 404);
  }
  if (!pointerRes.ok) {
    return ckError('INTERNAL', 'coreui.errors.internal.serverError', 502, `tokyo_live_pointer_${pointerRes.status}`);
  }

  const pointer = (await pointerRes.json().catch(() => null)) as Record<string, unknown> | null;
  const widgetType = typeof pointer?.widgetType === 'string' ? pointer.widgetType.trim() : '';
  const configFp = typeof pointer?.configFp === 'string' ? pointer.configFp.trim() : '';
  const localePolicy =
    pointer?.localePolicy && typeof pointer.localePolicy === 'object' && !Array.isArray(pointer.localePolicy)
      ? (pointer.localePolicy as Record<string, unknown>)
      : null;
  if (!widgetType || !configFp) {
    return ckError('INTERNAL', 'coreui.errors.internal.serverError', 500, 'live_pointer_invalid');
  }

  const configRes = await tokyoFetch(
    `/renders/instances/${encodeURIComponent(publicId)}/config/${encodeURIComponent(configFp)}/config.json`,
    {
      method: 'GET',
      cache: 'force-cache',
    },
  );
  if (configRes.status === 404) {
    return ckError('INTERNAL', 'coreui.errors.db.readFailed', 500, 'live_config_missing');
  }
  if (!configRes.ok) {
    return ckError('INTERNAL', 'coreui.errors.internal.serverError', 502, `tokyo_config_pack_${configRes.status}`);
  }

  const configPayload = await configRes.json().catch(() => null);
  const config = readConfigPack(configPayload);
  if (!config) {
    return ckError('INTERNAL', 'coreui.errors.payload.invalid', 500, 'live_config_invalid');
  }

  const baseFingerprint = await computeBaseFingerprint(config);
  return json({
    publicId,
    displayName: publicId,
    status: 'published',
    widgetType,
    config,
    baseFingerprint,
    ...(localePolicy ? { localePolicy } : {}),
  });
}
