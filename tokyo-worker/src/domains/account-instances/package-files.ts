import type { Env } from '../../types';
import {
  PUBLIC_INDEX_FILE,
  PUBLIC_RUNTIME_FILE,
  PUBLIC_STYLES_FILE,
} from './package-file-names';
import { publicPackageContentType } from '../public-package-serve-metadata';

export { isPublicPackageFile } from './package-file-names';

type R2TextObject = {
  text(): Promise<string>;
  httpMetadata?: { contentType?: string | null } | null;
  customMetadata?: Record<string, string> | null;
};

type PublicPackageFile = typeof PUBLIC_INDEX_FILE | typeof PUBLIC_STYLES_FILE | typeof PUBLIC_RUNTIME_FILE;

type PublicPackageFilePayload = {
  name: PublicPackageFile;
  body: string;
  contentType: string;
};

export type SubmittedInstancePublicPackage = {
    indexHtml: string;
  stylesCss: string;
  runtimeJs: string;
};

export type WriteInstancePublicPackageResult =
  | {
      ok: true;
      fingerprint: string;
    }
  | {
      ok: false;
      reasonKey: string;
      detail: string;
    };

export type InstancePublicPackageReadinessResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      reasonKey: string;
      detail: string;
    };

const PUBLIC_PACKAGE_FINGERPRINT_METADATA_KEY = 'publicPackageFingerprint';

function instanceRoot(accountId: string, instanceId: string): string {
  return `accounts/${accountId}/instances/${instanceId}`;
}

function textContentType(name: string): string {
  if (name.endsWith('.css')) return 'text/css; charset=utf-8';
  if (name.endsWith('.js')) return 'text/javascript; charset=utf-8';
  return 'text/html; charset=utf-8';
}

function filesFromSubmittedPackage(pkg: SubmittedInstancePublicPackage): PublicPackageFilePayload[] {
  return [
    { name: PUBLIC_INDEX_FILE, body: pkg.indexHtml, contentType: textContentType(PUBLIC_INDEX_FILE) },
    { name: PUBLIC_STYLES_FILE, body: pkg.stylesCss, contentType: textContentType(PUBLIC_STYLES_FILE) },
    { name: PUBLIC_RUNTIME_FILE, body: pkg.runtimeJs, contentType: textContentType(PUBLIC_RUNTIME_FILE) },
  ];
}

function normalizeSubmittedPackage(value: unknown): SubmittedInstancePublicPackage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.indexHtml !== 'string' || typeof raw.stylesCss !== 'string' || typeof raw.runtimeJs !== 'string') return null;
  return {
    indexHtml: raw.indexHtml,
    stylesCss: raw.stylesCss,
    runtimeJs: raw.runtimeJs,
  };
}

export function readSubmittedInstancePublicPackage(value: unknown): SubmittedInstancePublicPackage | null {
  return normalizeSubmittedPackage(value);
}

function hexFromBytes(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function buildInstancePublicPackageFingerprint(pkg: SubmittedInstancePublicPackage): Promise<string> {
  const encoder = new TextEncoder();
  const payload = [
    `${PUBLIC_INDEX_FILE}:${pkg.indexHtml.length}`,
    pkg.indexHtml,
    `${PUBLIC_STYLES_FILE}:${pkg.stylesCss.length}`,
    pkg.stylesCss,
    `${PUBLIC_RUNTIME_FILE}:${pkg.runtimeJs.length}`,
    pkg.runtimeJs,
  ].join('\n');
  return `sha256:${hexFromBytes(await crypto.subtle.digest('SHA-256', encoder.encode(payload)))}`;
}

function objectPublicPackageFingerprint(object: { customMetadata?: Record<string, string> | null }): string | null {
  const value = object.customMetadata?.[PUBLIC_PACKAGE_FINGERPRINT_METADATA_KEY];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export function publicPackageObjectMatchesExpectedFingerprint(
  object: { customMetadata?: Record<string, string> | null },
  expectedFingerprint?: string | null,
): boolean {
  const actualFingerprint = objectPublicPackageFingerprint(object);
  if (expectedFingerprint) return actualFingerprint === expectedFingerprint;
  return !actualFingerprint;
}

export async function readInstancePublicPackage(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  expectedFingerprint?: string | null;
}): Promise<SubmittedInstancePublicPackage | null> {
  const root = instanceRoot(args.accountId, args.instanceId);
  const [indexObject, stylesObject, runtimeObject] = await Promise.all([
    args.env.TOKYO_R2.get(`${root}/${PUBLIC_INDEX_FILE}`) as Promise<R2TextObject | null>,
    args.env.TOKYO_R2.get(`${root}/${PUBLIC_STYLES_FILE}`) as Promise<R2TextObject | null>,
    args.env.TOKYO_R2.get(`${root}/${PUBLIC_RUNTIME_FILE}`) as Promise<R2TextObject | null>,
  ]);
  if (!indexObject || !stylesObject || !runtimeObject) return null;
  for (const object of [indexObject, stylesObject, runtimeObject]) {
    if (!publicPackageContentType(object)) throw new Error('artifact.package.metadata_invalid');
    if (!publicPackageObjectMatchesExpectedFingerprint(object, args.expectedFingerprint)) {
      throw new Error('artifact.package.fingerprint_mismatch');
    }
  }
  return {
        indexHtml: await indexObject.text(),
    stylesCss: await stylesObject.text(),
    runtimeJs: await runtimeObject.text(),
  };
}

async function putInstancePublicPackageFiles(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  publicPackage: SubmittedInstancePublicPackage;
  fingerprint: string;
}): Promise<void> {
  const root = instanceRoot(args.accountId, args.instanceId);
  for (const file of filesFromSubmittedPackage(args.publicPackage)) {
    await args.env.TOKYO_R2.put(`${root}/${file.name}`, file.body, {
      httpMetadata: { contentType: file.contentType },
      customMetadata: { [PUBLIC_PACKAGE_FINGERPRINT_METADATA_KEY]: args.fingerprint },
    });
  }
}

export async function writeInstancePublicPackage(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  publicPackage: SubmittedInstancePublicPackage;
}): Promise<WriteInstancePublicPackageResult> {
  const fingerprint = await buildInstancePublicPackageFingerprint(args.publicPackage);
  try {
    await putInstancePublicPackageFiles({ ...args, fingerprint });
    return { ok: true, fingerprint };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reasonKey: detail.startsWith('artifact.') ? detail : 'artifact.package_write_failed',
      detail,
    };
  }
}

async function requireStoredPackageFile(args: {
  env: Env;
  key: string;
  reasonKey: string;
  expectedFingerprint?: string | null;
}): Promise<InstancePublicPackageReadinessResult> {
  const object = await args.env.TOKYO_R2.get(args.key) as R2TextObject | null;
  if (!object) return { ok: false, reasonKey: args.reasonKey, detail: args.key };
  if (!publicPackageContentType(object)) {
    return { ok: false, reasonKey: 'artifact.package.metadata_invalid', detail: args.key };
  }
  const actualFingerprint = objectPublicPackageFingerprint(object);
  if (args.expectedFingerprint) {
    if (actualFingerprint !== args.expectedFingerprint) {
      return { ok: false, reasonKey: 'artifact.package.fingerprint_mismatch', detail: args.key };
    }
  } else if (actualFingerprint) {
    return { ok: false, reasonKey: 'artifact.package.fingerprint_unexpected', detail: args.key };
  }
  return { ok: true };
}

export async function verifyInstancePublicPackageReady(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  expectedFingerprint?: string | null;
}): Promise<InstancePublicPackageReadinessResult> {
  const root = instanceRoot(args.accountId, args.instanceId);
  for (const file of [
    [PUBLIC_INDEX_FILE, 'artifact.package.index_missing'],
    [PUBLIC_STYLES_FILE, 'artifact.package.styles_missing'],
    [PUBLIC_RUNTIME_FILE, 'artifact.package.runtime_missing'],
  ] as const) {
    const result = await requireStoredPackageFile({
      env: args.env,
      key: `${root}/${file[0]}`,
      reasonKey: file[1],
      expectedFingerprint: args.expectedFingerprint,
    });
    if (!result.ok) return result;
  }
  return { ok: true };
}
