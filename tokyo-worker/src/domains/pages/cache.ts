import type { Env } from '../../types';
import { PublicCachePurgeError, purgePublicServingFiles } from '../public-cache';
import { PageOperationError } from './types';

export function buildPagePublicCacheFiles(args: {
  publicServingBase: string;
  accountId: string;
  pageId: string;
  locales: string[];
}): string[] {
  const root = `${args.publicServingBase.replace(/\/+$/, '')}/${args.accountId}/pages/${args.pageId}`;
  return [
    ...new Set(args.locales.map((locale) => `${root}/${encodeURIComponent(locale)}`)),
    `${root}/styles.css`,
    `${root}/runtime.js`,
  ];
}

export async function purgePagePublicCache(args: {
  env: Env;
  accountId: string;
  pageId: string;
  locales: string[];
}): Promise<void> {
  const publicServingBase = String(args.env.PUBLIC_SERVING_BASE_URL || '').trim();
  if (!publicServingBase) {
    throw new PageOperationError({
      kind: 'UPSTREAM_UNAVAILABLE',
      status: 503,
      reasonKey: 'tokyo.errors.publicCache.purgeConfigMissing',
    });
  }
  try {
    await purgePublicServingFiles({
      env: args.env,
      files: buildPagePublicCacheFiles({ ...args, publicServingBase }),
    });
  } catch (error) {
    if (error instanceof PublicCachePurgeError) {
      throw new PageOperationError({
        kind: 'UPSTREAM_UNAVAILABLE',
        status: error.status,
        reasonKey: error.reasonKey,
        detail: error.message,
      });
    }
    throw error;
  }
}
