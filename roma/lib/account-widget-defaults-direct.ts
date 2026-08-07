import { isRecord } from '@clickeen/ck-contracts';
import { normalizeAccountFontLibrary, type AccountFontLibrary } from '@clickeen/widget-foundation';
import { callTokyo, type TokyoCallContext } from './tokyo-client';

export type AccountWidgetDefaultsDocument = {
  accountId: string;
  fontLibrary: AccountFontLibrary;
  common: Record<string, unknown>;
  widgets: Record<
    string,
    {
      core: Record<string, unknown>;
    }
  >;
  seededAt: string;
  updatedAt: string;
};

export function normalizeAccountWidgetDefaultsDocument(
  raw: unknown,
): AccountWidgetDefaultsDocument | null {
  if (!isRecord(raw)) return null;
  if (Object.prototype.hasOwnProperty.call(raw, 'shell')) return null;
  if (typeof raw.accountId !== 'string' || !isRecord(raw.common) || !isRecord(raw.widgets))
    return null;
  const fontLibrary = normalizeAccountFontLibrary(raw.fontLibrary);
  if (!fontLibrary) return null;
  const widgets: AccountWidgetDefaultsDocument['widgets'] = {};
  for (const [widgetType, widgetDefaults] of Object.entries(raw.widgets)) {
    if (!isRecord(widgetDefaults) || !isRecord(widgetDefaults.core)) return null;
    widgets[widgetType] = {
      core: widgetDefaults.core,
    };
  }
  return {
    accountId: raw.accountId,
    fontLibrary,
    common: raw.common,
    widgets,
    seededAt: typeof raw.seededAt === 'string' ? raw.seededAt : '',
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
  };
}

function decodeWidgetDefaultsPayload(payload: unknown): {
  accountId: string;
  widgetDefaults: AccountWidgetDefaultsDocument;
} {
  if (!isRecord(payload) || typeof payload.accountId !== 'string') {
    throw new Error('invalid Tokyo account widget defaults payload');
  }
  const widgetDefaults = normalizeAccountWidgetDefaultsDocument(payload.widgetDefaults);
  if (!widgetDefaults) throw new Error('invalid Tokyo account widget defaults document');
  return {
    accountId: payload.accountId,
    widgetDefaults,
  };
}

function tokyoCallContext(args: {
  accountId: string;
  accountCapsule?: string | null;
  requestId?: string | null;
  internalServiceName?: string | null;
}): TokyoCallContext {
  return {
    accountId: args.accountId,
    accountCapsule: args.accountCapsule,
    requestId: args.requestId,
    internalServiceName: args.internalServiceName,
  };
}

export async function loadAccountWidgetDefaultsInTokyo(args: {
  accountId: string;
  accountCapsule?: string | null;
  requestId?: string | null;
  internalServiceName?: string | null;
}) {
  return callTokyo(tokyoCallContext(args), {
    path: `/__internal/accounts/${encodeURIComponent(args.accountId)}/widget-defaults`,
    method: 'GET',
    decode: decodeWidgetDefaultsPayload,
    errorKey: 'roma.errors.widgetDefaults.loadFailed',
    errorDetail: 'Tokyo account widget defaults load failed',
  });
}

export async function createInitialAccountWidgetDefaultsInTokyo(args: {
  accountId: string;
  accountCapsule?: string | null;
  requestId?: string | null;
  internalServiceName?: string | null;
  widgetDefaults: AccountWidgetDefaultsDocument;
}) {
  return callTokyo(tokyoCallContext(args), {
    path: `/__internal/accounts/${encodeURIComponent(args.accountId)}/widget-defaults`,
    method: 'POST',
    body: {
      widgetDefaults: args.widgetDefaults,
    },
    decode: decodeWidgetDefaultsPayload,
    errorKey: 'roma.errors.widgetDefaults.createFailed',
    errorDetail: 'Tokyo account widget defaults create failed',
  });
}

export async function saveAccountWidgetDefaultsInTokyo(args: {
  accountId: string;
  accountCapsule?: string | null;
  requestId?: string | null;
  internalServiceName?: string | null;
  widgetDefaults: AccountWidgetDefaultsDocument;
}) {
  return callTokyo(tokyoCallContext(args), {
    path: `/__internal/accounts/${encodeURIComponent(args.accountId)}/widget-defaults`,
    method: 'PUT',
    body: {
      widgetDefaults: args.widgetDefaults,
    },
    decode: decodeWidgetDefaultsPayload,
    errorKey: 'roma.errors.widgetDefaults.saveFailed',
    errorDetail: 'Tokyo account widget defaults save failed',
  });
}
