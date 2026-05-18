import { asTrimmedString, isRecord } from '@clickeen/ck-contracts';
import { resolveLanguageOverlayCode } from '@clickeen/ck-contracts/overlay-codebooks';
import { parseOverlayId } from '@clickeen/ck-contracts/overlay-identity';
import {
  loadTokyoAccountInstanceDocument,
  writeLanguageOverlayToTokyo,
} from './account-instance-direct';
import { callTokyo } from './tokyo-client';

type RouteFailure = {
  ok: false;
  status: number;
  error: {
    kind: 'VALIDATION' | 'AUTH' | 'DENY' | 'NOT_FOUND' | 'UPSTREAM_UNAVAILABLE';
    reasonKey: string;
    detail?: string;
  };
};

export type AccountLocaleOverlayInventoryPayload = {
  v: 1;
  baseLocale: string;
  overlays: Array<{
    locale: string;
    overlayId: string;
  }>;
};

export type AccountLocaleOverlayObjectPayload = {
  v: 1;
  overlayId: string;
  values: Record<string, string>;
};

function invalidPayload(detail: string): RouteFailure {
  return {
    ok: false,
    status: 422,
    error: {
      kind: 'VALIDATION',
      reasonKey: 'coreui.errors.payload.invalid',
      detail,
    },
  };
}

function normalizeOverlayValues(raw: unknown): Record<string, string> | null {
  if (!isRecord(raw)) return null;
  const values: Record<string, string> = {};
  for (const [path, value] of Object.entries(raw)) {
    if (!path || typeof value !== 'string') return null;
    values[path] = value;
  }
  return values;
}

function normalizeInventory(payload: unknown): AccountLocaleOverlayInventoryPayload | null {
  if (!isRecord(payload) || payload.v !== 1) return null;
  const baseLocale = asTrimmedString(payload.baseLocale);
  if (!baseLocale || !Array.isArray(payload.overlays)) return null;
  const overlays = payload.overlays.map((entry) => {
    if (!isRecord(entry)) return null;
    const locale = asTrimmedString(entry.locale);
    const overlayId = asTrimmedString(entry.overlayId);
    return locale && overlayId ? { locale, overlayId } : null;
  });
  if (overlays.some((entry) => !entry)) return null;
  return {
    v: 1,
    baseLocale,
    overlays: overlays as AccountLocaleOverlayInventoryPayload['overlays'],
  };
}

function normalizeOverlayObject(payload: unknown): AccountLocaleOverlayObjectPayload | null {
  if (!isRecord(payload) || payload.v !== 1) return null;
  const overlayId = asTrimmedString(payload.overlayId);
  const values = normalizeOverlayValues(payload.values);
  if (!overlayId || !values) return null;
  return { v: 1, overlayId, values };
}

export async function loadAccountInstanceLocaleOverlayInventory(args: {
  accountId: string;
  instanceId: string;
  baseLocale: string;
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: AccountLocaleOverlayInventoryPayload } | RouteFailure> {
  const baseLocale = asTrimmedString(args.baseLocale);
  if (!baseLocale) return invalidPayload('baseLocale_missing');

  const result = await callTokyo<unknown>(
    {
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    },
    {
      path: '/__internal/overlays/languages/list.json',
      method: 'POST',
      body: {
        instanceId: args.instanceId,
        baseLocale,
      },
      decode: (payload) => payload,
      errorKey: 'tokyo.errors.l10n.invalid',
      errorDetail: 'tokyo_overlay_language_list_http_error',
    },
  );
  if (!result.ok) return result;
  const value = normalizeInventory(result.value);
  if (!value) return invalidPayload('tokyo_overlay_inventory_invalid_payload');
  return { ok: true, value };
}

export async function readAccountInstanceLocaleOverlayObject(args: {
  accountId: string;
  instanceId: string;
  overlayId: string;
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: AccountLocaleOverlayObjectPayload } | RouteFailure> {
  const overlayId = asTrimmedString(args.overlayId);
  const parsed = parseOverlayId(overlayId);
  if (!overlayId || !parsed.ok) return invalidPayload('overlayId_invalid');
  if (parsed.value.accountPublicId !== args.accountId || parsed.value.instanceId !== args.instanceId) {
    return {
      ok: false,
      status: 403,
      error: {
        kind: 'DENY',
        reasonKey: 'coreui.errors.auth.forbidden',
        detail: 'overlay_coordinate_mismatch',
      },
    };
  }

  const result = await callTokyo<unknown>(
    {
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    },
    {
      path: `/__internal/overlays/${encodeURIComponent(overlayId)}.json`,
      method: 'GET',
      decode: (payload) => payload,
      errorKey: 'tokyo.errors.l10n.invalid',
      errorDetail: 'tokyo_overlay_object_http_error',
    },
  );
  if (!result.ok) return result;
  const value = normalizeOverlayObject(result.value);
  if (!value) return invalidPayload('tokyo_overlay_object_invalid_payload');
  return { ok: true, value };
}

export async function writeAccountInstanceLocaleOverlayValues(args: {
  accountId: string;
  instanceId: string;
  locale: string;
  values: Record<string, string>;
  accountCapsule?: string | null;
  requestId?: string | null;
}): Promise<{ ok: true; value: { overlayId: string } } | RouteFailure> {
  const locale = asTrimmedString(args.locale);
  const values = normalizeOverlayValues(args.values);
  if (!locale) return invalidPayload('locale_missing');
  if (!values) return invalidPayload('values_invalid');
  const languageCode = resolveLanguageOverlayCode(locale);
  if (!languageCode) return invalidPayload(`language_unsupported:${locale}`);

  const current = await loadTokyoAccountInstanceDocument({
    accountId: args.accountId,
    instanceId: args.instanceId,
    accountCapsule: args.accountCapsule,
    requestId: args.requestId,
  });
  if (!current.ok) return current;

  const stored = await writeLanguageOverlayToTokyo({
    accountId: args.accountId,
    instanceId: args.instanceId,
    widgetType: current.value.row.widgetType,
    languageCode,
    values,
    accountCapsule: args.accountCapsule,
    requestId: args.requestId,
  });
  if (!stored.ok) return stored;
  return { ok: true, value: stored.value };
}
