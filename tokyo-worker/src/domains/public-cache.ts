import type { Env } from '../types';

export class PublicCachePurgeError extends Error {
  reasonKey: 'tokyo.errors.publicCache.purgeConfigMissing' | 'tokyo.errors.publicCache.purgeFailed';
  status: 502 | 503;

  constructor(args: {
    reasonKey: PublicCachePurgeError['reasonKey'];
    status: PublicCachePurgeError['status'];
    detail?: string;
  }) {
    super(args.detail ?? args.reasonKey);
    this.name = 'PublicCachePurgeError';
    this.reasonKey = args.reasonKey;
    this.status = args.status;
  }
}

export async function purgePublicServingFiles(args: {
  env: Env;
  files: string[];
}): Promise<void> {
  const zoneId = String(args.env.CLOUDFLARE_ZONE_ID || '').trim();
  const token = String(args.env.CLOUDFLARE_CACHE_PURGE_TOKEN || '').trim();
  if (!zoneId || !token) {
    throw new PublicCachePurgeError({
      status: 503,
      reasonKey: 'tokyo.errors.publicCache.purgeConfigMissing',
    });
  }
  for (let offset = 0; offset < args.files.length; offset += 30) {
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/purge_cache`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ files: args.files.slice(offset, offset + 30) }),
    });
    const payload = await response.json().catch(() => null) as { success?: unknown } | null;
    if (!response.ok || payload?.success !== true) {
      throw new PublicCachePurgeError({
        status: 502,
        reasonKey: 'tokyo.errors.publicCache.purgeFailed',
        detail: `cloudflare_purge_status_${response.status}`,
      });
    }
  }
}
