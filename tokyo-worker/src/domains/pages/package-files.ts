import type { Env } from '../../types';
import { accountPagePublishFileKey } from './keys';

type R2TextObject = {
  text(): Promise<string>;
};

type PagePublicFile = 'index.html' | 'styles.css' | 'runtime.js';

type PagePublicFilePayload = {
  name: PagePublicFile;
  body: string;
  contentType: string;
};

export type SubmittedPagePublicPackage = {
  v: 1;
  indexHtml: string;
  stylesCss: string;
  runtimeJs: string;
};

export type PagePublicPackageWriteResult =
  | { ok: true }
  | { ok: false; reasonKey: string; detail: string };

export type PagePublicPackageReadinessResult =
  | { ok: true }
  | { ok: false; reasonKey: string; detail: string };

function textContentType(name: PagePublicFile): string {
  if (name === 'styles.css') return 'text/css; charset=utf-8';
  if (name === 'runtime.js') return 'text/javascript; charset=utf-8';
  return 'text/html; charset=utf-8';
}

function normalizeSubmittedPackage(value: unknown): SubmittedPagePublicPackage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (raw.v !== 1) return null;
  if (typeof raw.indexHtml !== 'string' || typeof raw.stylesCss !== 'string' || typeof raw.runtimeJs !== 'string') {
    return null;
  }
  if (!raw.indexHtml.trim() || !raw.stylesCss.trim() || !raw.runtimeJs.trim()) return null;
  return {
    v: 1,
    indexHtml: raw.indexHtml,
    stylesCss: raw.stylesCss,
    runtimeJs: raw.runtimeJs,
  };
}

function filesFromSubmittedPackage(pkg: SubmittedPagePublicPackage): PagePublicFilePayload[] {
  return [
    { name: 'index.html', body: pkg.indexHtml, contentType: textContentType('index.html') },
    { name: 'styles.css', body: pkg.stylesCss, contentType: textContentType('styles.css') },
    { name: 'runtime.js', body: pkg.runtimeJs, contentType: textContentType('runtime.js') },
  ];
}

function assertNonEmptyPackageFile(file: PagePublicFilePayload): void {
  if (!file.body.trim()) throw new Error(`page.package.empty:${file.name}`);
}

async function readRequiredText(args: {
  env: Env;
  key: string;
  reasonKey: string;
}): Promise<string> {
  const object = await args.env.TOKYO_R2.get(args.key) as R2TextObject | null;
  if (!object) throw new Error(`${args.reasonKey}:${args.key}`);
  return object.text();
}

export function readSubmittedPagePublicPackage(value: unknown): SubmittedPagePublicPackage | null {
  return normalizeSubmittedPackage(value);
}

export async function writeAccountPagePublicPackage(args: {
  env: Env;
  accountId: string;
  pageId: string;
  pagePackage: SubmittedPagePublicPackage;
}): Promise<PagePublicPackageWriteResult> {
  try {
    const files = filesFromSubmittedPackage(args.pagePackage);
    files.forEach(assertNonEmptyPackageFile);
    for (const file of files) {
      await args.env.TOKYO_R2.put(accountPagePublishFileKey(args.accountId, args.pageId, file.name), file.body, {
        httpMetadata: { contentType: file.contentType },
      });
    }
    return { ok: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reasonKey: detail.startsWith('page.') ? detail : 'page.package.writeFailed',
      detail,
    };
  }
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
    filesFromSubmittedPackage({ v: 1, indexHtml, stylesCss, runtimeJs }).forEach(assertNonEmptyPackageFile);
    return { ok: true };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reasonKey: detail.startsWith('page.') ? detail : 'page.package.notReady',
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
  if (!zoneId || !token) return;
  const publicServingBase =
    String(args.env.PUBLIC_SERVING_BASE_URL || '').trim().replace(/\/+$/, '') || 'https://clk.live';
  const base = `${publicServingBase}/${args.accountId}/pages/${args.pageId}`;
  await fetch(`https://api.cloudflare.com/client/v4/zones/${encodeURIComponent(zoneId)}/purge_cache`, {
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
        `${base}/embed.js`,
      ],
    }),
  }).catch(() => undefined);
}
