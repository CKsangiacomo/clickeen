import type { AccountLocalizationSnapshot, LocalizationOp } from '@clickeen/ck-contracts';
import {
  buildTokyoProductControlHeaders,
  fetchTokyoProductControl,
} from './tokyo-product-control';

type AccountLocalizationSnapshotEnvelope = {
  snapshot: AccountLocalizationSnapshot;
  widgetType: string;
  baseFingerprint: string;
  saved: {
    config: Record<string, unknown>;
    updatedAt: string;
    published: boolean;
    seoGeoLive: boolean;
  };
};

type AccountL10nStatusPayload = {
  publicId: string;
  widgetType: string;
  baseFingerprint: string;
  baseUpdatedAt: string;
  locales: Array<{
    locale: string;
    status: 'dirty' | 'succeeded' | 'superseded';
    attempts: number;
    nextAttemptAt: null;
    lastAttemptAt: string | null;
    lastError: null;
  }>;
};

type UserLayerMutationPayload = {
  publicId: string;
  layer: 'user';
  layerKey: string;
  deleted?: boolean;
  source?: 'user';
  baseFingerprint: string;
  baseUpdatedAt: string;
};

function resolveTokyoControlErrorDetail(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const error = (payload as { error?: { detail?: unknown; reasonKey?: unknown } }).error;
    if (typeof error?.detail === 'string' && error.detail.trim()) return error.detail.trim();
    if (typeof error?.reasonKey === 'string' && error.reasonKey.trim()) return error.reasonKey.trim();
  }
  return fallback;
}

async function parseTokyoControlJson<T>(response: Response, fallback: string): Promise<T> {
  const payload = (await response.json().catch(() => null)) as T | { error?: unknown } | null;
  if (!response.ok) {
    throw new Error(resolveTokyoControlErrorDetail(payload, fallback));
  }
  if (!payload) {
    throw new Error(`${fallback}_empty`);
  }
  return payload as T;
}

export async function loadAccountLocalizationSnapshot(args: {
  accessToken: string;
  accountId: string;
  publicId: string;
  accountCapsule?: string | null;
}): Promise<AccountLocalizationSnapshotEnvelope> {
  const response = await fetchTokyoProductControl({
    path: `/__internal/l10n/instances/${encodeURIComponent(args.publicId)}/snapshot`,
    method: 'GET',
    headers: buildTokyoProductControlHeaders({
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
    }),
    accessToken: args.accessToken,
  });
  return parseTokyoControlJson<AccountLocalizationSnapshotEnvelope>(
    response,
    `tokyo_l10n_snapshot_http_${response.status}`,
  );
}

export async function loadAccountL10nStatus(args: {
  accessToken: string;
  accountId: string;
  publicId: string;
  accountCapsule?: string | null;
}): Promise<AccountL10nStatusPayload> {
  const response = await fetchTokyoProductControl({
    path: `/__internal/l10n/instances/${encodeURIComponent(args.publicId)}/status`,
    method: 'GET',
    headers: buildTokyoProductControlHeaders({
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
    }),
    accessToken: args.accessToken,
  });
  return parseTokyoControlJson<AccountL10nStatusPayload>(
    response,
    `tokyo_l10n_status_http_${response.status}`,
  );
}

export async function upsertAccountUserLayer(args: {
  accessToken: string;
  accountId: string;
  publicId: string;
  locale: string;
  ops: LocalizationOp[];
  accountCapsule?: string | null;
}): Promise<UserLayerMutationPayload> {
  const response = await fetchTokyoProductControl({
    path: `/__internal/l10n/instances/${encodeURIComponent(args.publicId)}/user/${encodeURIComponent(
      args.locale,
    )}`,
    method: 'POST',
    headers: buildTokyoProductControlHeaders({
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      contentType: 'application/json',
    }),
    accessToken: args.accessToken,
    body: JSON.stringify({ ops: args.ops }),
  });
  return parseTokyoControlJson<UserLayerMutationPayload>(
    response,
    `tokyo_l10n_user_write_http_${response.status}`,
  );
}

export async function deleteAccountUserLayer(args: {
  accessToken: string;
  accountId: string;
  publicId: string;
  locale: string;
  accountCapsule?: string | null;
}): Promise<UserLayerMutationPayload> {
  const response = await fetchTokyoProductControl({
    path: `/__internal/l10n/instances/${encodeURIComponent(args.publicId)}/user/${encodeURIComponent(
      args.locale,
    )}`,
    method: 'DELETE',
    headers: buildTokyoProductControlHeaders({
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
    }),
    accessToken: args.accessToken,
  });
  return parseTokyoControlJson<UserLayerMutationPayload>(
    response,
    `tokyo_l10n_user_delete_http_${response.status}`,
  );
}
