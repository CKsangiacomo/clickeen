import type { Env } from '../../types';
import {
  PUBLIC_INDEX_FILE,
  PUBLIC_RUNTIME_FILE,
  PUBLIC_STYLES_FILE,
  type PublicPackageFile,
} from './package-file-names';
import { publicPackageContentType } from '../public-package-serve-metadata';
import { accountInstanceLocalePackageFileKey } from './keys';
import { deleteObject } from '../storage';

export { isPublicPackageFile } from './package-file-names';

type R2TextObject = {
  body: ReadableStream | null;
  text(): Promise<string>;
  httpMetadata?: { contentType?: string | null } | null;
  customMetadata?: Record<string, string> | null;
};

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

export type InstanceLocalePackageReadResult =
  | {
      ok: true;
      object: R2TextObject;
    }
  | {
      ok: false;
      reasonKey: string;
      detail: string;
    };

const PUBLIC_PACKAGE_FINGERPRINT_METADATA_KEY = 'publicPackageFingerprint';
const LOCALE_PACKAGE_ACCOUNT_METADATA_KEY = 'localePackageAccountPublicId';
const LOCALE_PACKAGE_INSTANCE_METADATA_KEY = 'localePackageInstanceId';
const LOCALE_PACKAGE_BASE_LOCALE_METADATA_KEY = 'localePackageBaseLocale';
const LOCALE_PACKAGE_LOCALE_METADATA_KEY = 'localePackageLocale';
const LOCALE_PACKAGE_SOURCE_UPDATED_AT_METADATA_KEY = 'localePackageSourceUpdatedAt';
const MATERIALIZER_CONTRACT_VERSION_METADATA_KEY = 'materializerContractVersion';
const EXPECTED_MATERIALIZER_CONTRACT_VERSION = 'ck-runtime-materializer:124B';

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

function requiredCustomMetadata(
  object: { customMetadata?: Record<string, string> | null },
  key: string,
): string | null {
  const value = object.customMetadata?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function localePackageObjectMatchesExpectedEvidence(args: {
  object: R2TextObject;
  accountId: string;
  instanceId: string;
  baseLocale: string;
  locale: string;
  sourceUpdatedAt: string;
  expectedFingerprint: string;
}): boolean {
  const checks: Array<[string, string]> = [
    [PUBLIC_PACKAGE_FINGERPRINT_METADATA_KEY, args.expectedFingerprint],
    [LOCALE_PACKAGE_ACCOUNT_METADATA_KEY, args.accountId],
    [LOCALE_PACKAGE_INSTANCE_METADATA_KEY, args.instanceId],
    [LOCALE_PACKAGE_BASE_LOCALE_METADATA_KEY, args.baseLocale],
    [LOCALE_PACKAGE_LOCALE_METADATA_KEY, args.locale],
    [LOCALE_PACKAGE_SOURCE_UPDATED_AT_METADATA_KEY, args.sourceUpdatedAt],
    [MATERIALIZER_CONTRACT_VERSION_METADATA_KEY, EXPECTED_MATERIALIZER_CONTRACT_VERSION],
  ];
  return checks.every(([key, expected]) => requiredCustomMetadata(args.object, key) === expected);
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
  keyForFile?: (fileName: PublicPackageFile) => string;
  customMetadata?: Record<string, string>;
}): Promise<void> {
  const root = instanceRoot(args.accountId, args.instanceId);
  for (const file of filesFromSubmittedPackage(args.publicPackage)) {
    await args.env.TOKYO_R2.put(args.keyForFile ? args.keyForFile(file.name) : `${root}/${file.name}`, file.body, {
      httpMetadata: { contentType: file.contentType },
      customMetadata: {
        [PUBLIC_PACKAGE_FINGERPRINT_METADATA_KEY]: args.fingerprint,
        ...(args.customMetadata ?? {}),
      },
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

export async function writeInstanceLocalePackage(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  baseLocale: string;
  locale: string;
  sourceUpdatedAt: string;
  materializerContractVersion: string;
  publicPackage: SubmittedInstancePublicPackage;
}): Promise<WriteInstancePublicPackageResult> {
  if (args.locale === args.baseLocale) {
    return {
      ok: false,
      reasonKey: 'artifact.package.locale_base_requested',
      detail: 'locale package locale must differ from baseLocale',
    };
  }
  const fingerprint = await buildInstancePublicPackageFingerprint(args.publicPackage);
  try {
    await putInstancePublicPackageFiles({
      env: args.env,
      accountId: args.accountId,
      instanceId: args.instanceId,
      publicPackage: args.publicPackage,
      fingerprint,
      keyForFile: (fileName) => accountInstanceLocalePackageFileKey(
        args.accountId,
        '',
        args.instanceId,
        args.locale,
        fileName,
      ),
      customMetadata: {
        [LOCALE_PACKAGE_ACCOUNT_METADATA_KEY]: args.accountId,
        [LOCALE_PACKAGE_INSTANCE_METADATA_KEY]: args.instanceId,
        [LOCALE_PACKAGE_BASE_LOCALE_METADATA_KEY]: args.baseLocale,
        [LOCALE_PACKAGE_LOCALE_METADATA_KEY]: args.locale,
        [LOCALE_PACKAGE_SOURCE_UPDATED_AT_METADATA_KEY]: args.sourceUpdatedAt,
        [MATERIALIZER_CONTRACT_VERSION_METADATA_KEY]: args.materializerContractVersion,
      },
    });
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

export async function deleteInstanceLocalePackage(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  locale: string;
}): Promise<{ locale: string }> {
  for (const fileName of [PUBLIC_INDEX_FILE, PUBLIC_STYLES_FILE, PUBLIC_RUNTIME_FILE] as const) {
    await deleteObject(
      args.env,
      accountInstanceLocalePackageFileKey(args.accountId, '', args.instanceId, args.locale, fileName),
    );
  }
  return { locale: args.locale };
}

export async function readInstanceLocalePackageObject(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  baseLocale: string;
  locale: string;
  sourceUpdatedAt: string;
  file: PublicPackageFile;
}): Promise<InstanceLocalePackageReadResult> {
  if (args.locale === args.baseLocale) {
    return {
      ok: false,
      reasonKey: 'artifact.package.locale_base_requested',
      detail: 'locale package locale must differ from baseLocale',
    };
  }

  const files = [
    [PUBLIC_INDEX_FILE, 'artifact.package.index_missing'],
    [PUBLIC_STYLES_FILE, 'artifact.package.styles_missing'],
    [PUBLIC_RUNTIME_FILE, 'artifact.package.runtime_missing'],
  ] as const;
  const objects = await Promise.all(
    files.map(async ([fileName, reasonKey]) => {
      const key = accountInstanceLocalePackageFileKey(args.accountId, '', args.instanceId, args.locale, fileName);
      const object = await args.env.TOKYO_R2.get(key) as R2TextObject | null;
      return { fileName, reasonKey, key, object };
    }),
  );
  for (const entry of objects) {
    if (!entry.object) {
      return { ok: false, reasonKey: entry.reasonKey, detail: entry.key };
    }
    if (!publicPackageContentType(entry.object)) {
      return { ok: false, reasonKey: 'artifact.package.metadata_invalid', detail: entry.key };
    }
  }

  const completeObjects: Array<{
    fileName: PublicPackageFile;
    reasonKey: string;
    key: string;
    object: R2TextObject;
  }> = [];
  for (const entry of objects) {
    if (!entry.object) {
      return { ok: false, reasonKey: entry.reasonKey, detail: entry.key };
    }
    completeObjects.push({
      fileName: entry.fileName,
      reasonKey: entry.reasonKey,
      key: entry.key,
      object: entry.object,
    });
  }

  const fingerprint = objectPublicPackageFingerprint(completeObjects[0].object);
  if (!fingerprint) {
    return { ok: false, reasonKey: 'artifact.package.fingerprint_missing', detail: completeObjects[0].key };
  }
  for (const entry of completeObjects) {
    if (
      !localePackageObjectMatchesExpectedEvidence({
        object: entry.object,
        accountId: args.accountId,
        instanceId: args.instanceId,
        baseLocale: args.baseLocale,
        locale: args.locale,
        sourceUpdatedAt: args.sourceUpdatedAt,
        expectedFingerprint: fingerprint,
      })
    ) {
      return { ok: false, reasonKey: 'artifact.package.locale_metadata_mismatch', detail: entry.key };
    }
  }

  const requested = completeObjects.find((entry) => entry.fileName === args.file);
  if (!requested) {
    return {
      ok: false,
      reasonKey: 'artifact.package.file_missing',
      detail: accountInstanceLocalePackageFileKey(args.accountId, '', args.instanceId, args.locale, args.file),
    };
  }
  return { ok: true, object: requested.object };
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
