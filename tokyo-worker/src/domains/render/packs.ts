import { normalizeLocale } from '../../asset-utils';
import type { Env } from '../../types';
import { accountInstanceL10nLivePointerKey, accountInstanceL10nTextPackKey, accountInstanceRenderConfigPackKey, accountInstanceRenderMetaLivePointerKey, accountInstanceRenderMetaPackKey } from './keys';
import { putJson } from './storage';
import type { L10nLivePointer, MetaLivePointer, WriteConfigPackJob, WriteMetaPackJob, WriteTextPackJob } from './types';
import { encodeStableJson, jsonSha256Hex, normalizeFingerprint, normalizePublicId } from './utils';

async function writeTextPointer(args: {
  env: Env;
  accountId: string;
  publicId: string;
  locale: string;
  textFp: string;
  baseFingerprint: string;
}): Promise<void> {
  await putJson(args.env, accountInstanceL10nLivePointerKey(args.accountId, args.publicId, args.locale), {
    v: 1,
    publicId: args.publicId,
    locale: args.locale,
    textFp: args.textFp,
    baseFingerprint: args.baseFingerprint,
    updatedAt: new Date().toISOString(),
  } satisfies L10nLivePointer);
}

async function writeMetaPointer(args: {
  env: Env;
  accountId: string;
  publicId: string;
  locale: string;
  metaFp: string;
}): Promise<void> {
  await putJson(args.env, accountInstanceRenderMetaLivePointerKey(args.accountId, args.publicId, args.locale), {
    v: 1,
    publicId: args.publicId,
    locale: args.locale,
    metaFp: args.metaFp,
    updatedAt: new Date().toISOString(),
  } satisfies MetaLivePointer);
}

export async function writeConfigPack(env: Env, job: WriteConfigPackJob): Promise<void> {
  const publicId = normalizePublicId(job.publicId);
  if (!publicId) throw new Error('[tokyo] write-config-pack missing publicId');
  const accountId = normalizePublicId(job.accountId);
  if (!accountId) throw new Error('[tokyo] write-config-pack missing accountId');
  const configFp = normalizeFingerprint(job.configFp);
  if (!configFp) throw new Error('[tokyo] write-config-pack invalid configFp');
  const widgetType = typeof job.widgetType === 'string' ? job.widgetType.trim() : '';
  if (!widgetType) throw new Error('[tokyo] write-config-pack missing widgetType');

  const fingerprint = await jsonSha256Hex(job.configPack);
  if (fingerprint !== configFp) {
    throw new Error(
      `[tokyo] write-config-pack fingerprint mismatch expected=${configFp} got=${fingerprint}`,
    );
  }

  const bytes = encodeStableJson(job.configPack);
  await env.TOKYO_R2.put(accountInstanceRenderConfigPackKey(accountId, publicId, configFp), bytes, {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
}

export async function writeTextPack(env: Env, job: WriteTextPackJob): Promise<void> {
  const publicId = normalizePublicId(job.publicId);
  if (!publicId) throw new Error('[tokyo] write-text-pack missing publicId');
  const accountId = normalizePublicId(job.accountId);
  if (!accountId) throw new Error('[tokyo] write-text-pack missing accountId');
  const locale = normalizeLocale(job.locale);
  if (!locale) throw new Error('[tokyo] write-text-pack invalid locale');
  const baseFingerprint = normalizeFingerprint(job.baseFingerprint);
  if (!baseFingerprint) throw new Error('[tokyo] write-text-pack invalid baseFingerprint');
  if (!job.textPack || typeof job.textPack !== 'object' || Array.isArray(job.textPack)) {
    throw new Error('[tokyo] write-text-pack textPack must be an object');
  }

  const textFp = await jsonSha256Hex(job.textPack);
  const packBytes = encodeStableJson(job.textPack);
  const packKey = accountInstanceL10nTextPackKey(accountId, publicId, locale, textFp);
  await env.TOKYO_R2.put(packKey, packBytes, {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });

  await writeTextPointer({
    env,
    accountId,
    publicId,
    locale,
    textFp,
    baseFingerprint,
  });
}

export async function writeMetaPack(env: Env, job: WriteMetaPackJob): Promise<void> {
  const publicId = normalizePublicId(job.publicId);
  if (!publicId) throw new Error('[tokyo] write-meta-pack missing publicId');
  const accountId = normalizePublicId(job.accountId);
  if (!accountId) throw new Error('[tokyo] write-meta-pack missing accountId');
  const locale = normalizeLocale(job.locale);
  if (!locale) throw new Error('[tokyo] write-meta-pack invalid locale');
  if (!job.metaPack || typeof job.metaPack !== 'object' || Array.isArray(job.metaPack)) {
    throw new Error('[tokyo] write-meta-pack metaPack must be an object');
  }

  const metaFp = await jsonSha256Hex(job.metaPack);
  const packBytes = encodeStableJson(job.metaPack);
  const packKey = accountInstanceRenderMetaPackKey(accountId, publicId, locale, metaFp);
  await env.TOKYO_R2.put(packKey, packBytes, {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });

  await writeMetaPointer({
    env,
    accountId,
    publicId,
    locale,
    metaFp,
  });
}
