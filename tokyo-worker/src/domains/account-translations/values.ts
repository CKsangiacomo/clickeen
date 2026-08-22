import type { Env } from '../../types';
import { readConfigDocumentByLocation } from '../account-instances/source';
import type {
  AccountInstanceConfigDocument,
  AccountInstanceSourceReadFailure,
} from '../account-instances/types';
import {
  deleteLocaleOverlay,
  listLocaleOverlayCoordinates,
  readLocaleOverlay,
  writeLocaleOverlay,
} from './overlays';

async function resolveStoredTranslationSource(args: {
  env: Env;
  accountId: string;
  instanceId: string;
}): Promise<AccountInstanceConfigDocument | null> {
  return readConfigDocumentByLocation({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
  });
}

export async function readAccountInstanceTranslatedLocaleValues(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  locale: string;
}): Promise<
  | { ok: true; value: { locale: string; values: Record<string, string> } }
  | AccountInstanceSourceReadFailure
> {
  const stored = await resolveStoredTranslationSource({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
  });
  if (!stored)
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' };
  const overlay = await readLocaleOverlay({
    env: args.env,
    accountId: stored.accountId,
    instanceId: stored.id,
    locale: args.locale,
  });
  if (!overlay) {
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'tokyo.translation.notFound' };
  }
  return { ok: true, value: { locale: args.locale, values: overlay.values } };
}

export async function writeAccountInstanceTranslatedLocaleValues(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  locale: string;
  values: Record<string, string>;
}): Promise<{ locale: string; values: Record<string, string> }> {
  const stored = await resolveStoredTranslationSource({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
  });
  if (!stored) throw new Error('coreui.errors.instance.notFound');
  if (args.locale === stored.baseLocale) {
    throw new Error('tokyo.translation.locale.base_forbidden');
  }
  await writeLocaleOverlay({
    env: args.env,
    accountId: stored.accountId,
    instanceId: stored.id,
    locale: args.locale,
    overlay: {
      values: args.values,
    },
  });
  return { locale: args.locale, values: args.values };
}

export async function deleteAccountInstanceTranslatedLocaleValues(args: {
  env: Env;
  instanceId: string;
  accountId: string;
  locale: string;
}): Promise<{ locale: string }> {
  const stored = await resolveStoredTranslationSource({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
  });
  if (!stored) throw new Error('coreui.errors.instance.notFound');
  await deleteLocaleOverlay({
    env: args.env,
    accountId: stored.accountId,
    instanceId: stored.id,
    locale: args.locale,
  });
  return { locale: args.locale };
}

export async function listAccountInstanceTranslatedLocaleValues(args: {
  env: Env;
  instanceId: string;
  accountId: string;
}): Promise<
  | {
      ok: true;
      value: {
        baseLocale: string;
        translations: Array<{ locale: string }>;
      };
    }
  | AccountInstanceSourceReadFailure
> {
  const stored = await resolveStoredTranslationSource({
    env: args.env,
    accountId: args.accountId,
    instanceId: args.instanceId,
  });
  if (!stored) {
    return { ok: false, kind: 'NOT_FOUND', reasonKey: 'coreui.errors.instance.notFound' };
  }
  const locales = await listLocaleOverlayCoordinates({
    env: args.env,
    accountId: stored.accountId,
    instanceId: stored.id,
  });
  return {
    ok: true,
    value: {
      baseLocale: stored.baseLocale,
      translations: locales.map((locale) => ({ locale })),
    },
  };
}
