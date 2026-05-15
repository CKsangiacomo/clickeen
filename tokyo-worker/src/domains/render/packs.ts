import { normalizeLocale } from '../../asset-utils';
import type { Env } from '../../types';
import {
  accountInstancePublishedConfigKey,
  accountInstanceRenderMetaLivePointerKey,
  accountInstanceRenderMetaPackKey,
} from './keys';
import { resolveAccountInstanceLocation } from './instance-index';
import { putJson } from './storage';
import type { MetaLivePointer, WriteConfigPackJob, WriteMetaPackJob } from './types';
import { jsonSha256Hex, normalizeFingerprint, normalizeStorageId } from './utils';

export async function writeConfigPack(env: Env, job: WriteConfigPackJob): Promise<void> {
  const instanceId = normalizeStorageId(job.instanceId);
  const accountId = normalizeStorageId(job.accountId);
  const widgetCode = typeof job.widgetCode === 'string' ? job.widgetCode.trim() : '';
  if (!instanceId) throw new Error('[tokyo] write-config-pack missing instanceId');
  if (!accountId) throw new Error('[tokyo] write-config-pack missing accountId');
  if (!widgetCode) throw new Error('[tokyo] write-config-pack missing widgetCode');
  const configFp = normalizeFingerprint(job.configFp);
  if (!configFp) throw new Error('[tokyo] write-config-pack invalid configFp');
  const fingerprint = await jsonSha256Hex(job.configPack);
  if (fingerprint !== configFp) {
    throw new Error(`[tokyo] write-config-pack fingerprint mismatch expected=${configFp} got=${fingerprint}`);
  }
  await putJson(env, accountInstancePublishedConfigKey(accountId, widgetCode, instanceId), job.configPack);
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
  await putJson(env, accountInstanceRenderMetaPackKey(location.accountId, location.widgetCode, location.instanceId, locale, metaFp), job.metaPack);
  await putJson(env, accountInstanceRenderMetaLivePointerKey(location.accountId, location.widgetCode, location.instanceId, locale), {
    v: 1,
    id: instanceId,
    locale,
    metaFp,
    updatedAt: new Date().toISOString(),
  } satisfies MetaLivePointer);
}
