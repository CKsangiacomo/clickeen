import type { AccountFontLibrary } from '@clickeen/widget-foundation';
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

function decodeWidgetDefaultsPayload(payload: unknown): {
  accountId: string;
  widgetDefaults: AccountWidgetDefaultsDocument;
} {
  return payload as {
    accountId: string;
    widgetDefaults: AccountWidgetDefaultsDocument;
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
