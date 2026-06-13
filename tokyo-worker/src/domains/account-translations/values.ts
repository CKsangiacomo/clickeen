import { normalizeLocale } from '../../asset-utils';
import type { Env } from '../../types';
import {
  resolveAccountInstanceLocation,
} from '../account-instances/registry';
import {
  buildCurrentLocaleOverlayMetadata,
  readConfigDocumentByLocation,
  readContentDocumentByLocation,
  updateContentDocumentByLocation,
} from '../account-instances/source';
import type {
  AccountInstanceContentDocument,
  AccountInstanceSourceReadFailure,
} from '../account-instances/types';
import { normalizeStorageId } from '../account-instances/utils';
import {
  assertLocaleOverlayValuesMatchSavedTextFields,
  listLocaleOverlays,
  localeOverlayHasCompleteSavedTextValues,
  readLocaleOverlay,
  writeLocaleOverlay,
} from './overlays';

function nowIso(): string {
  return new Date().toISOString();
}

export async function readAccountInstanceTranslatedLocaleValues(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  widgetType?: string | null;
  locale: string;
}): Promise<{ ok: true; value: { locale: string; values: Record<string, string> } } | AccountInstanceSourceReadFailure> {
  const locale = normalizeLocale(args.locale);
  if (!locale) {
    return { ok: false, kind: 'VALIDATION', reasonKey: 'tokyo.translation.locale.invalid' };
  }
  const location = await resolveAccountInstanceLocation({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    widgetType: args.widgetType,
  });
  if (!location) return { ok: false, kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' };
  const configDoc = await readConfigDocumentByLocation({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
  });
  const content = configDoc
    ? await readContentDocumentByLocation({
        env: args.env,
        accountId: location.accountId,
        widgetCode: location.widgetCode,
        instanceId: location.instanceId,
        configDoc,
      })
    : null;
  if (!configDoc || !content) return { ok: false, kind: 'VALIDATION', reasonKey: 'coreui.errors.instance.content.invalid' };
  const overlay = await readLocaleOverlay({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
    locale,
  });
  const current = await buildCurrentLocaleOverlayMetadata({ configDoc, content });
  if (
    !overlay ||
    overlay.status !== 'inSync' ||
    overlay.baseContentMarker !== current.baseContentMarker ||
    overlay.widgetContractHash !== current.widgetContractHash ||
    !localeOverlayHasCompleteSavedTextValues({ fields: current.fields, overlay })
  ) {
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'tokyo.translation.notFound' };
  }
  const values: Record<string, string> = {};
  for (const { path } of current.fields) {
    values[path] = overlay.values[path]!;
  }
  return { ok: true, value: { locale, values } };
}

export async function writeAccountInstanceTranslatedLocaleValues(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  widgetType?: string | null;
  locale: string;
  values: Record<string, string>;
}): Promise<{ locale: string; values: Record<string, string> }> {
  const instanceId = normalizeStorageId(args.instanceId);
  const accountId = normalizeStorageId(args.accountId);
  const locale = normalizeLocale(args.locale);
  if (!instanceId || !accountId || !locale) {
    throw new Error('tokyo.translation.values_invalid');
  }
  const location = await resolveAccountInstanceLocation({
    env: args.env,
    accountId,
    instanceId,
    widgetType: args.widgetType,
  });
  if (!location) throw new Error('coreui.errors.instance.notFound');
  const configDoc = await readConfigDocumentByLocation({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
  });
  const content = configDoc
    ? await readContentDocumentByLocation({
        env: args.env,
        accountId: location.accountId,
        widgetCode: location.widgetCode,
        instanceId: location.instanceId,
        configDoc,
      })
    : null;
  if (!configDoc || !content) throw new Error('coreui.errors.instance.content.invalid');
  const metadata = await buildCurrentLocaleOverlayMetadata({ configDoc, content });
  assertLocaleOverlayValuesMatchSavedTextFields({ fields: metadata.fields, values: args.values });
  await writeLocaleOverlay({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
    overlay: {
      v: 1,
      locale,
      baseContentMarker: metadata.baseContentMarker,
      widgetContractHash: metadata.widgetContractHash,
      status: 'inSync',
      values: args.values,
      updatedAt: nowIso(),
    },
  });
  return { locale, values: args.values };
}

export async function completeAccountInstanceTranslatedLocaleValues(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  widgetType?: string | null;
  locale: string;
  targetLocales: string[];
  paths: string[];
  values: Record<string, string>;
  baseContentMarker?: string;
  widgetContractHash?: string;
}): Promise<{ locale: string; values: Record<string, string> }> {
  const instanceId = normalizeStorageId(args.instanceId);
  const accountId = normalizeStorageId(args.accountId);
  const locale = normalizeLocale(args.locale);
  if (!instanceId || !accountId || !locale) {
    throw new Error('tokyo.translation.values_invalid');
  }
  const location = await resolveAccountInstanceLocation({
    env: args.env,
    accountId,
    instanceId,
    widgetType: args.widgetType,
  });
  if (!location) throw new Error('coreui.errors.instance.notFound');
  const targetLocales = Array.from(new Set(args.targetLocales.map((entry) => normalizeLocale(entry)).filter((entry): entry is string => Boolean(entry))));
  const changedPaths = new Set(args.paths);
  const configDoc = await readConfigDocumentByLocation({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
  });
  const content = configDoc
    ? await readContentDocumentByLocation({
        env: args.env,
        accountId: location.accountId,
        widgetCode: location.widgetCode,
        instanceId: location.instanceId,
        configDoc,
      })
    : null;
  if (!configDoc || !content) throw new Error('coreui.errors.instance.content.invalid');
  const currentMetadata = await buildCurrentLocaleOverlayMetadata({ configDoc, content });
  assertLocaleOverlayValuesMatchSavedTextFields({ fields: currentMetadata.fields, values: args.values });
  const updatedAt = nowIso();
  await writeLocaleOverlay({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
    overlay: {
      v: 1,
      locale,
      baseContentMarker: args.baseContentMarker ?? currentMetadata.baseContentMarker,
      widgetContractHash: args.widgetContractHash ?? currentMetadata.widgetContractHash,
      status: 'inSync',
      values: args.values,
      updatedAt,
    },
  });
  const targetOverlayByLocale = new Map((await listLocaleOverlays({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
  })).map((overlay) => [overlay.locale, overlay]));
  await updateContentDocumentByLocation({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
    update(currentContent) {
      const next: AccountInstanceContentDocument = {
        ...currentContent,
        fields: { ...currentContent.fields },
        updatedAt,
      };
      for (const field of currentMetadata.fields) {
        const currentField = currentContent.fields[field.path];
        const allTargetsOk =
          targetLocales.length === 0 ||
          targetLocales.every((targetLocale) => (
            targetOverlayByLocale.get(targetLocale)?.status === 'inSync' &&
            targetOverlayByLocale.get(targetLocale)?.baseContentMarker === currentMetadata.baseContentMarker &&
            targetOverlayByLocale.get(targetLocale)?.widgetContractHash === currentMetadata.widgetContractHash &&
            typeof targetOverlayByLocale.get(targetLocale)?.values[field.path] === 'string'
          ));
        next.fields[field.path] = {
          ...currentField,
          status: changedPaths.has(field.path) && allTargetsOk ? 'ok' : currentField.status,
        };
      }
      return next;
    },
  });
  return { locale, values: args.values };
}

export async function listAccountInstanceTranslatedLocaleValues(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  widgetType?: string | null;
}): Promise<Array<{ locale: string }>> {
  const instanceId = normalizeStorageId(args.instanceId);
  const accountId = normalizeStorageId(args.accountId);
  if (!instanceId || !accountId) return [];
  const location = await resolveAccountInstanceLocation({
    env: args.env,
    accountId,
    instanceId,
    widgetType: args.widgetType,
  });
  if (!location) return [];
  const configDoc = await readConfigDocumentByLocation({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
  });
  const content = configDoc
    ? await readContentDocumentByLocation({
        env: args.env,
        accountId: location.accountId,
        widgetCode: location.widgetCode,
        instanceId: location.instanceId,
        configDoc,
      })
    : null;
  if (!configDoc || !content) return [];
  const current = await buildCurrentLocaleOverlayMetadata({ configDoc, content });
  return (await listLocaleOverlays({
    env: args.env,
    accountId: location.accountId,
    widgetCode: location.widgetCode,
    instanceId: location.instanceId,
  }))
    .filter((overlay) => (
      overlay.status === 'inSync' &&
      overlay.baseContentMarker === current.baseContentMarker &&
      overlay.widgetContractHash === current.widgetContractHash &&
      localeOverlayHasCompleteSavedTextValues({ fields: current.fields, overlay })
    ))
    .map((overlay) => ({ locale: overlay.locale }));
}
