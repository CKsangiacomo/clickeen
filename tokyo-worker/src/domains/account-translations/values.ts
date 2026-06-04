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
  assertLocaleOverlayValuesMatchContent,
  listLocaleOverlays,
  localeOverlayHasCompleteValues,
  readLocaleOverlay,
  writeLocaleOverlay,
} from './overlays';

export type TranslatedLocaleSummary = {
  locale: string;
};

export type TranslatedLocaleValues = {
  locale: string;
  values: Record<string, string>;
};

function nowIso(): string {
  return new Date().toISOString();
}

function normalizeTranslatedValueMap(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const values: Record<string, string> = {};
  for (const [path, text] of Object.entries(value)) {
    if (!path || typeof text !== 'string') return null;
    values[path] = text;
  }
  return values;
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
    !localeOverlayHasCompleteValues({ content, overlay })
  ) {
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'tokyo.translation.notFound' };
  }
  const values: Record<string, string> = {};
  for (const path of Object.keys(content.fields)) {
    values[path] = overlay.values[path]!;
  }
  return { ok: true, value: { locale, values } };
}

export async function readAccountInstanceCurrentTranslatedLocaleValues(args: {
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
  const values: Record<string, string> = {};
  for (const path of Object.keys(content.fields)) {
    const translated = overlay?.values[path];
    if (typeof translated === 'string') values[path] = translated;
  }
  return { ok: true, value: { locale, values } };
}

export async function writeAccountInstanceTranslatedLocaleValues(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  widgetType?: string | null;
  locale: string;
  values: unknown;
}): Promise<{ locale: string; values: Record<string, string> }> {
  const instanceId = normalizeStorageId(args.instanceId);
  const accountId = normalizeStorageId(args.accountId);
  const locale = normalizeLocale(args.locale);
  const values = normalizeTranslatedValueMap(args.values);
  if (!instanceId || !accountId || !locale || !values) {
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
  assertLocaleOverlayValuesMatchContent({ content, values });
  const metadata = await buildCurrentLocaleOverlayMetadata({ configDoc, content });
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
      values,
      updatedAt: nowIso(),
    },
  });
  return { locale, values };
}

export async function completeAccountInstanceTranslatedLocaleValues(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  widgetType?: string | null;
  locale: string;
  targetLocales: string[];
  paths: string[];
  values: unknown;
  baseContentMarker?: string;
  widgetContractHash?: string;
}): Promise<{ locale: string; values: Record<string, string> }> {
  const instanceId = normalizeStorageId(args.instanceId);
  const accountId = normalizeStorageId(args.accountId);
  const locale = normalizeLocale(args.locale);
  const values = normalizeTranslatedValueMap(args.values);
  if (!instanceId || !accountId || !locale || !values) {
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
  assertLocaleOverlayValuesMatchContent({ content, values });
  const currentMetadata = await buildCurrentLocaleOverlayMetadata({ configDoc, content });
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
      values,
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
      for (const [path, field] of Object.entries(currentContent.fields)) {
        const allTargetsOk =
          targetLocales.length === 0 ||
          targetLocales.every((targetLocale) => (
            targetOverlayByLocale.get(targetLocale)?.status === 'inSync' &&
            targetOverlayByLocale.get(targetLocale)?.baseContentMarker === currentMetadata.baseContentMarker &&
            targetOverlayByLocale.get(targetLocale)?.widgetContractHash === currentMetadata.widgetContractHash &&
            typeof targetOverlayByLocale.get(targetLocale)?.values[path] === 'string'
          ));
        next.fields[path] = {
          ...field,
          status: changedPaths.has(path) && allTargetsOk ? 'ok' : field.status,
        };
      }
      return next;
    },
  });
  return { locale, values };
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
      localeOverlayHasCompleteValues({ content, overlay })
    ))
    .map((overlay) => ({ locale: overlay.locale }));
}

export async function listTranslatedLocales(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<TranslatedLocaleSummary[]> {
  return listAccountInstanceTranslatedLocaleValues({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
  });
}

export async function readTranslatedLocaleValues(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  locale: string;
}): Promise<TranslatedLocaleValues | null> {
  const translation = await readAccountInstanceTranslatedLocaleValues({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    locale: args.locale,
  });
  if (!translation.ok) return null;
  return translation.value;
}

export async function writeTranslatedLocaleValues(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  locale: string;
  values: Record<string, string>;
}): Promise<TranslatedLocaleValues> {
  return writeAccountInstanceTranslatedLocaleValues({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    locale: args.locale,
    values: args.values,
  });
}
