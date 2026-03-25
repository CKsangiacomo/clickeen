import {
  buildTokyoProductControlHeaders,
  fetchTokyoProductControl,
} from './tokyo-product-control';

export type AccountInstanceSyncIntent = {
  baseLocale: string;
  desiredLocales: string[];
  countryToLocale: Record<string, string>;
};

export class TokyoAccountInstanceSyncError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'TokyoAccountInstanceSyncError';
    this.status = status;
  }
}

function resolveTokyoSyncErrorDetail(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const error = (payload as { error?: { detail?: unknown; reasonKey?: unknown } }).error;
    if (typeof error?.detail === 'string' && error.detail.trim()) return error.detail.trim();
    if (typeof error?.reasonKey === 'string' && error.reasonKey.trim()) return error.reasonKey.trim();
  }
  return fallback;
}

async function postAccountInstanceSync(args: {
  path: string;
  accessToken: string;
  accountId: string;
  publicId: string;
  accountCapsule?: string | null;
  live?: boolean;
  baseFingerprint?: string | null;
  previousBaseFingerprint?: string | null;
  l10nIntent: AccountInstanceSyncIntent;
}): Promise<void> {
  const response = await fetchTokyoProductControl({
    path: args.path,
    method: 'POST',
    headers: buildTokyoProductControlHeaders({
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      contentType: 'application/json',
    }),
    accessToken: args.accessToken,
    body: JSON.stringify({
      live: args.live === true,
      ...(args.baseFingerprint
        ? { baseFingerprint: args.baseFingerprint }
        : {}),
      ...(args.previousBaseFingerprint
        ? { previousBaseFingerprint: args.previousBaseFingerprint }
        : {}),
      l10nIntent: args.l10nIntent,
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: { detail?: unknown; reasonKey?: unknown } }
    | null;
  if (!response.ok) {
    throw new TokyoAccountInstanceSyncError(
      response.status,
      resolveTokyoSyncErrorDetail(payload, `tokyo_instance_sync_http_${response.status}`),
    );
  }
}

export async function enqueueAccountInstanceSync(args: {
  accessToken: string;
  accountId: string;
  publicId: string;
  accountCapsule?: string | null;
  live?: boolean;
  baseFingerprint?: string | null;
  previousBaseFingerprint?: string | null;
  l10nIntent: AccountInstanceSyncIntent;
}): Promise<void> {
  await postAccountInstanceSync({
    ...args,
    path: `/__internal/renders/instances/${encodeURIComponent(args.publicId)}/sync/queue`,
  });
}

export async function syncAccountInstanceLiveSurface(args: {
  accessToken: string;
  accountId: string;
  publicId: string;
  accountCapsule?: string | null;
  previousBaseFingerprint?: string | null;
  l10nIntent: AccountInstanceSyncIntent;
}): Promise<void> {
  await postAccountInstanceSync({
    ...args,
    live: true,
    path: `/__internal/renders/instances/${encodeURIComponent(args.publicId)}/sync`,
  });
}
