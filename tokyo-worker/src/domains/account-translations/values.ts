import { normalizeLocale } from '../../asset-utils';
import type { Env } from '../../types';
import {
  buildCurrentLocaleOverlayMetadata,
  readConfigDocumentByLocation,
  readContentDocumentByLocation,
} from '../account-instances/source';
import type {
  AccountInstanceConfigDocument,
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

async function resolveStoredTranslationSource(args: {
  env: Env;
  accountId: string;
  instanceId: string;
  widgetType?: string | null;
}): Promise<{
  configDoc: AccountInstanceConfigDocument;
  content: NonNullable<Awaited<ReturnType<typeof readContentDocumentByLocation>>>;
} | null> {
  const accountId = normalizeStorageId(args.accountId);
  const instanceId = normalizeStorageId(args.instanceId);
  if (!accountId || !instanceId) return null;
  const configDoc = await readConfigDocumentByLocation({
    env: args.env,
    accountId,
    widgetCode: '',
    instanceId,
  });
  const requestedWidgetType = typeof args.widgetType === 'string' ? args.widgetType.trim() : '';
  if (!configDoc || (requestedWidgetType && configDoc.widgetType !== requestedWidgetType)) return null;
  const content = await readContentDocumentByLocation({
    env: args.env,
    accountId,
    widgetCode: configDoc.widgetCode,
    instanceId,
    configDoc,
  });
  if (!content) throw new Error('coreui.errors.instance.content.invalid');
  return { configDoc, content };
}

export async function readAccountInstanceTranslatedLocaleValues(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  widgetType?: string | null;
  locale: string;
}): Promise<
  | { ok: true; value: { locale: string; values: Record<string, string> } }
  | AccountInstanceSourceReadFailure
> {
  const locale = normalizeLocale(args.locale);
  if (!locale) {
    return { ok: false, kind: 'VALIDATION', reasonKey: 'tokyo.translation.locale.invalid' };
  }
  const stored = await resolveStoredTranslationSource({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
    widgetType: args.widgetType,
  });
  if (!stored)
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' };
  const overlay = await readLocaleOverlay({
    env: args.env,
    accountId: stored.configDoc.accountId,
    widgetCode: stored.configDoc.widgetCode,
    instanceId: stored.configDoc.id,
    locale,
  });
  const current = await buildCurrentLocaleOverlayMetadata({
    configDoc: stored.configDoc,
    content: stored.content,
  });
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
  const stored = await resolveStoredTranslationSource({
    env: args.env,
    accountId,
    instanceId,
    widgetType: args.widgetType,
  });
  if (!stored) throw new Error('coreui.errors.instance.notFound');
  const metadata = await buildCurrentLocaleOverlayMetadata({
    configDoc: stored.configDoc,
    content: stored.content,
  });
  assertLocaleOverlayValuesMatchSavedTextFields({ fields: metadata.fields, values: args.values });
  await writeLocaleOverlay({
    env: args.env,
    accountId: stored.configDoc.accountId,
    widgetCode: stored.configDoc.widgetCode,
    instanceId: stored.configDoc.id,
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

export async function listAccountInstanceTranslatedLocaleValues(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  widgetType?: string | null;
}): Promise<Array<{ locale: string }>> {
  const instanceId = normalizeStorageId(args.instanceId);
  const accountId = normalizeStorageId(args.accountId);
  if (!instanceId || !accountId) throw new Error('coreui.errors.instance.invalidPayload');
  const stored = await resolveStoredTranslationSource({
    env: args.env,
    accountId,
    instanceId,
    widgetType: args.widgetType,
  });
  if (!stored) throw new Error('coreui.errors.instance.notFound');
  const current = await buildCurrentLocaleOverlayMetadata({
    configDoc: stored.configDoc,
    content: stored.content,
  });
  return (
    await listLocaleOverlays({
      env: args.env,
      accountId: stored.configDoc.accountId,
      widgetCode: stored.configDoc.widgetCode,
      instanceId: stored.configDoc.id,
    })
  )
    .filter(
      (overlay) =>
        overlay.status === 'inSync' &&
        overlay.baseContentMarker === current.baseContentMarker &&
        overlay.widgetContractHash === current.widgetContractHash &&
        localeOverlayHasCompleteSavedTextValues({ fields: current.fields, overlay }),
    )
    .map((overlay) => ({ locale: overlay.locale }));
}
