import { asTrimmedString } from '@clickeen/ck-contracts';
import {
  buildTokyoAssetControlHeaders,
  fetchTokyoAssetControl,
} from './tokyo-asset-control';

type TokyoAccountAssetUsagePayload = {
  storageBytesUsed?: unknown;
  error?: { kind?: unknown; reasonKey?: unknown; detail?: unknown };
};

export class TokyoAssetUsageError extends Error {
  readonly status: number;
  readonly kind: string;
  readonly reasonKey: string;
  readonly detail?: string;

  constructor(args: { status: number; kind: string; reasonKey: string; detail?: string }) {
    super(args.reasonKey);
    this.name = 'TokyoAssetUsageError';
    this.status = args.status;
    this.kind = args.kind;
    this.reasonKey = args.reasonKey;
    this.detail = args.detail;
  }
}

export function isTokyoAssetUsageError(error: unknown): error is TokyoAssetUsageError {
  return error instanceof TokyoAssetUsageError;
}

function resolveTokyoAssetUsageError(payload: TokyoAccountAssetUsagePayload | null, status: number): TokyoAssetUsageError {
  const kind = asTrimmedString(payload?.error?.kind) || 'UPSTREAM_UNAVAILABLE';
  const reasonKey = asTrimmedString(payload?.error?.reasonKey);
  const detail = asTrimmedString(payload?.error?.detail);
  return new TokyoAssetUsageError({
    status,
    kind,
    reasonKey: reasonKey || `HTTP_${status}`,
    ...(detail ? { detail } : {}),
  });
}

export async function readAccountStorageBytesUsed(args: {
  accountId: string;
  accountCapsule: string;
  requestId?: string | null;
}): Promise<number> {
  const response = await fetchTokyoAssetControl({
    path: `/__internal/assets/account/${encodeURIComponent(args.accountId)}/usage`,
    method: 'GET',
    headers: buildTokyoAssetControlHeaders({
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      requestId: args.requestId,
    }),
  });
  const payload = (await response.json().catch(() => null)) as TokyoAccountAssetUsagePayload | null;
  if (!response.ok) {
    throw resolveTokyoAssetUsageError(payload, response.status);
  }
  const storageBytesUsed = Number(payload?.storageBytesUsed);
  if (!Number.isFinite(storageBytesUsed) || storageBytesUsed < 0) {
    throw new Error('coreui.errors.assets.usage.invalidPayload');
  }
  return Math.trunc(storageBytesUsed);
}
