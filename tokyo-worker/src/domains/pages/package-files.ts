import type { Env } from '../../types';
import { accountPagePublishFileKey } from './keys';
import { PageOperationError } from './types';

type R2TextObject = {
  text(): Promise<string>;
};

type PagePublicFile = 'index.html' | 'styles.css' | 'runtime.js';

export type PagePublicPackageReadinessResult =
  | { ok: true }
  | { ok: false; reasonKey: string; detail: string };

class PagePackageOperationError extends Error {
  reasonKey: string;

  constructor(reasonKey: string, detail: string) {
    super(detail);
    this.name = 'PagePackageOperationError';
    this.reasonKey = reasonKey;
  }
}

async function readRequiredText(args: {
  env: Env;
  key: string;
  reasonKey: string;
}): Promise<string> {
  const object = await args.env.TOKYO_R2.get(args.key) as R2TextObject | null;
  if (!object) throw new PagePackageOperationError(args.reasonKey, args.key);
  return object.text();
}

export async function verifyAccountPagePublicPackageReady(args: {
  env: Env;
  accountId: string;
  pageId: string;
}): Promise<PagePublicPackageReadinessResult> {
  try {
    const [indexHtml, stylesCss, runtimeJs] = await Promise.all([
      readRequiredText({
        env: args.env,
        key: accountPagePublishFileKey(args.accountId, args.pageId, 'index.html'),
        reasonKey: 'page.package.indexMissing',
      }),
      readRequiredText({
        env: args.env,
        key: accountPagePublishFileKey(args.accountId, args.pageId, 'styles.css'),
        reasonKey: 'page.package.stylesMissing',
      }),
      readRequiredText({
        env: args.env,
        key: accountPagePublishFileKey(args.accountId, args.pageId, 'runtime.js'),
        reasonKey: 'page.package.runtimeMissing',
      }),
    ]);
    return { ok: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reasonKey: error instanceof PagePackageOperationError ? error.reasonKey : 'page.package.notReady',
      detail,
    };
  }
}

export async function purgeAccountPagePublicCache(args: {
  env: Env;
  accountId: string;
  pageId: string;
}): Promise<void> {
  const zoneId = String(args.env.CLOUDFLARE_ZONE_ID || '').trim();
  const token = String(args.env.CLOUDFLARE_API_TOKEN || '').trim();
  const publicServingBase = String(args.env.PUBLIC_SERVING_BASE_URL || '').trim().replace(/\/+$/, '');
  if (!zoneId || !token || !publicServingBase) {
    throw new PageOperationError({
      kind: 'UPSTREAM_UNAVAILABLE',
      reasonKey: 'tokyo.errors.publicCache.purgeConfigMissing',
      status: 503,
    });
  }
  const base = `${publicServingBase}/${args.accountId}/pages/${args.pageId}`;
  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/purge_cache`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      files: [
        base,
        `${base}/`,
        `${base}/index.html`,
        `${base}/styles.css`,
        `${base}/runtime.js`,
      ],
    }),
  });
  const payload = await response.json().catch(() => null) as { success?: unknown } | null;
  if (!response.ok || payload?.success !== true) {
    throw new PageOperationError({
      kind: 'UPSTREAM_UNAVAILABLE',
      reasonKey: 'tokyo.errors.publicCache.purgeFailed',
      status: 502,
      detail: `cloudflare_purge_status_${response.status}`,
    });
  }
}
