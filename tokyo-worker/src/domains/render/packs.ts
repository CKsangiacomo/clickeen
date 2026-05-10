import { normalizeLocale } from '../../asset-utils';
import type { Env } from '../../types';
import {
  accountInstanceL10nOverlayKey,
  accountInstancePublishedConfigKey,
  accountInstanceRenderMetaLivePointerKey,
  accountInstanceRenderMetaPackKey,
} from './keys';
import { resolveAccountInstanceLocation } from './instance-index';
import { putJson } from './storage';
import type { MetaLivePointer, WriteConfigPackJob, WriteMetaPackJob, WriteTextPackJob } from './types';
import { jsonSha256Hex, normalizeFingerprint, normalizeStorageId } from './utils';

export async function writeConfigPack(env: Env, job: WriteConfigPackJob): Promise<void> {
  const instanceId = normalizeStorageId(job.instanceId);
  const accountId = normalizeStorageId(job.accountId);
  const widgetType = typeof job.widgetType === 'string' ? job.widgetType.trim() : '';
  if (!instanceId) throw new Error('[tokyo] write-config-pack missing instanceId');
  if (!accountId) throw new Error('[tokyo] write-config-pack missing accountId');
  if (!widgetType) throw new Error('[tokyo] write-config-pack missing widgetType');
  const configFp = normalizeFingerprint(job.configFp);
  if (!configFp) throw new Error('[tokyo] write-config-pack invalid configFp');
  const fingerprint = await jsonSha256Hex(job.configPack);
  if (fingerprint !== configFp) {
    throw new Error(`[tokyo] write-config-pack fingerprint mismatch expected=${configFp} got=${fingerprint}`);
  }
  await putJson(env, accountInstancePublishedConfigKey(accountId, widgetType, instanceId), job.configPack);
}

export async function writeTextPack(env: Env, job: WriteTextPackJob): Promise<void> {
  const instanceId = normalizeStorageId(job.instanceId);
  const accountId = normalizeStorageId(job.accountId);
  const locale = normalizeLocale(job.locale);
  const baseFingerprint = normalizeFingerprint(job.baseFingerprint);
  if (!instanceId) throw new Error('[tokyo] write-text-pack missing instanceId');
  if (!accountId) throw new Error('[tokyo] write-text-pack missing accountId');
  if (!locale) throw new Error('[tokyo] write-text-pack invalid locale');
  if (!baseFingerprint) throw new Error('[tokyo] write-text-pack invalid baseFingerprint');
  if (!job.textPack || typeof job.textPack !== 'object' || Array.isArray(job.textPack)) {
    throw new Error('[tokyo] write-text-pack textPack must be an object');
  }
  const location = await resolveAccountInstanceLocation({ env, accountId, instanceId });
  if (!location) throw new Error('[tokyo] write-text-pack missing instance location');
  const existing = await env.TOKYO_R2.get(
    accountInstanceL10nOverlayKey(location.accountId, location.widgetType, location.instanceId, locale),
  );
  const current = (await existing?.json().catch(() => null)) as Record<string, unknown> | null;
  await putJson(env, accountInstanceL10nOverlayKey(location.accountId, location.widgetType, location.instanceId, locale), {
    v: 1,
    type: 'l10n',
    locale,
    baseFingerprint,
    status: 'ready',
    ops: Array.isArray(current?.ops) ? current.ops : [],
    textPack: job.textPack,
    updatedAt: new Date().toISOString(),
  });
}

export async function writeMetaPack(env: Env, job: WriteMetaPackJob): Promise<void> {
  const instanceId = normalizeStorageId(job.instanceId);
  const accountId = normalizeStorageId(job.accountId);
  const locale = normalizeLocale(job.locale);
  if (!instanceId) throw new Error('[tokyo] write-meta-pack missing instanceId');
  if (!accountId) throw new Error('[tokyo] write-meta-pack missing accountId');
  if (!locale) throw new Error('[tokyo] write-meta-pack invalid locale');
  if (!job.metaPack || typeof job.metaPack !== 'object' || Array.isArray(job.metaPack)) {
    throw new Error('[tokyo] write-meta-pack metaPack must be an object');
  }
  const location = await resolveAccountInstanceLocation({ env, accountId, instanceId });
  if (!location) throw new Error('[tokyo] write-meta-pack missing instance location');
  const metaFp = await jsonSha256Hex(job.metaPack);
  await putJson(env, accountInstanceRenderMetaPackKey(location.accountId, location.widgetType, location.instanceId, locale, metaFp), job.metaPack);
  await putJson(env, accountInstanceRenderMetaLivePointerKey(location.accountId, location.widgetType, location.instanceId, locale), {
    v: 1,
    id: instanceId,
    locale,
    metaFp,
    updatedAt: new Date().toISOString(),
  } satisfies MetaLivePointer);
}
