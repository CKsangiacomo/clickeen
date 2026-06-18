import type { Env } from '../../types';
import { PageOperationError } from './types';

export async function purgeAccountPagePublicCache(args: {
  env: Env;
  accountId: string;
  pageId: string;
}): Promise<void> {
  const zoneId = String(args.env.CLOUDFLARE_ZONE_ID || '').trim();
  const token = String(args.env.CLOUDFLARE_API_TOKEN || '').trim();
  const publicServingBase = String(args.env.PUBLIC_SERVING_BASE_URL || '')
    .trim()
    .replace(/\/+$/, '');
  if (!zoneId || !token || !publicServingBase) {
    throw new PageOperationError({
      kind: 'UPSTREAM_UNAVAILABLE',
      reasonKey: 'tokyo.errors.publicCache.purgeConfigMissing',
      status: 503,
    });
  }
  const base = `${publicServingBase}/${args.accountId}/pages/${args.pageId}`;
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/purge_cache`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        files: [base, `${base}/`, `${base}/index.html`, `${base}/styles.css`, `${base}/runtime.js`],
      }),
    },
  );
  const payload = (await response.json().catch(() => null)) as { success?: unknown } | null;
  if (!response.ok || payload?.success !== true) {
    throw new PageOperationError({
      kind: 'UPSTREAM_UNAVAILABLE',
      reasonKey: 'tokyo.errors.publicCache.purgeFailed',
      status: 502,
      detail: `cloudflare_purge_status_${response.status}`,
    });
  }
}
