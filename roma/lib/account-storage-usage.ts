import {
  buildTokyoAssetControlHeaders,
  fetchTokyoAssetControl,
} from './tokyo-asset-control';

type TokyoAccountAssetUsagePayload = {
  storageBytesUsed?: unknown;
  error?: { reasonKey?: unknown; detail?: unknown };
};

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function resolveTokyoAssetUsageError(payload: TokyoAccountAssetUsagePayload | null, status: number): string {
  const reasonKey = asTrimmedString(payload?.error?.reasonKey);
  if (reasonKey) return reasonKey;
  const detail = asTrimmedString(payload?.error?.detail);
  if (detail) return detail;
  return `HTTP_${status}`;
}

export async function readAccountStorageBytesUsed(args: {
  accountId: string;
  accountCapsule: string;
}): Promise<number> {
  const response = await fetchTokyoAssetControl({
    path: `/__internal/assets/account/${encodeURIComponent(args.accountId)}/usage`,
    method: 'GET',
    headers: buildTokyoAssetControlHeaders({
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
    }),
  });
  const payload = (await response.json().catch(() => null)) as TokyoAccountAssetUsagePayload | null;
  if (!response.ok) {
    throw new Error(resolveTokyoAssetUsageError(payload, response.status));
  }
  const storageBytesUsed = Number(payload?.storageBytesUsed);
  return Number.isFinite(storageBytesUsed) && storageBytesUsed >= 0 ? Math.trunc(storageBytesUsed) : 0;
}
