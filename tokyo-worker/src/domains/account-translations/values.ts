import { normalizeLocale } from '../../asset-utils';
import type { Env } from '../../types';
import {
  readConfigDocumentByLocation,
  readContentDocumentByLocation,
} from '../account-instances/source';
import type {
  AccountInstanceContentDocument,
  AccountInstanceConfigDocument,
  AccountInstanceSourceReadFailure,
} from '../account-instances/types';
import { normalizeStorageId } from '../account-instances/utils';
import {
  assertLocaleOverlayValuesMatchSavedTextFields,
  deleteLocaleOverlay,
  listLocaleOverlays,
  readLocaleOverlay,
  writeLocaleOverlay,
} from './overlays';

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

function savedContentOverlayFields(content: AccountInstanceContentDocument): Array<{ path: string }> {
  return Object.keys(content.fields).map((path) => ({ path }));
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
  const current = savedContentOverlayFields(stored.content);
  if (!overlay) {
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'tokyo.translation.notFound' };
  }
  assertLocaleOverlayValuesMatchSavedTextFields({ fields: current, values: overlay.values });
  const values: Record<string, string> = {};
  for (const { path } of current) {
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
  const fields = savedContentOverlayFields(stored.content);
  assertLocaleOverlayValuesMatchSavedTextFields({ fields, values: args.values });
  await writeLocaleOverlay({
    env: args.env,
    accountId: stored.configDoc.accountId,
    widgetCode: stored.configDoc.widgetCode,
    instanceId: stored.configDoc.id,
    locale,
    overlay: {
            values: args.values,
    },
  });
  return { locale, values: args.values };
}

export async function deleteAccountInstanceTranslatedLocaleValues(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  widgetType?: string | null;
  locale: string;
}): Promise<{ locale: string }> {
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
  await deleteLocaleOverlay({
    env: args.env,
    accountId: stored.configDoc.accountId,
    widgetCode: stored.configDoc.widgetCode,
    instanceId: stored.configDoc.id,
    locale,
  });
  return { locale };
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
  const current = savedContentOverlayFields(stored.content);
  const overlays = await listLocaleOverlays({
    env: args.env,
    accountId: stored.configDoc.accountId,
    widgetCode: stored.configDoc.widgetCode,
    instanceId: stored.configDoc.id,
  });
  for (const entry of overlays) {
    assertLocaleOverlayValuesMatchSavedTextFields({
      fields: current,
      values: entry.overlay.values,
    });
  }
  return overlays.map((entry) => ({ locale: entry.locale }));
}
