import {
  buildTokyoProductControlHeaders,
  fetchTokyoProductControl,
} from './tokyo-product-control';

function resolveTokyoSyncErrorDetail(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const error = (payload as { error?: { detail?: unknown; reasonKey?: unknown } }).error;
    if (typeof error?.detail === 'string' && error.detail.trim()) return error.detail.trim();
    if (typeof error?.reasonKey === 'string' && error.reasonKey.trim()) return error.reasonKey.trim();
  }
  return fallback;
}

export async function runAccountInstanceSync(args: {
  accessToken: string;
  accountId: string;
  publicId: string;
  accountCapsule?: string | null;
  live?: boolean;
  previousBaseFingerprint?: string | null;
}): Promise<void> {
  const response = await fetchTokyoProductControl({
    path: `/__internal/renders/instances/${encodeURIComponent(args.publicId)}/sync`,
    method: 'POST',
    headers: buildTokyoProductControlHeaders({
      accountId: args.accountId,
      accountCapsule: args.accountCapsule,
      contentType: 'application/json',
    }),
    accessToken: args.accessToken,
    body: JSON.stringify({
      live: args.live === true,
      ...(args.previousBaseFingerprint
        ? { previousBaseFingerprint: args.previousBaseFingerprint }
        : {}),
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: { detail?: unknown; reasonKey?: unknown } }
    | null;
  if (!response.ok) {
    throw new Error(resolveTokyoSyncErrorDetail(payload, `tokyo_instance_sync_http_${response.status}`));
  }
}
