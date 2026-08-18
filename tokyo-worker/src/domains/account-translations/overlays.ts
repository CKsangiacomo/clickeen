import type { Env } from '../../types';
import {
  accountInstanceLocaleOverlayKey,
  accountInstanceLocaleOverlaysPrefix,
} from '../account-instances/keys';
import { deleteObject, loadJson, putJson } from '../storage';
import type { LocaleOverlayDocument } from '../account-instances/types';

export async function readLocaleOverlay(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
  locale: string;
}): Promise<LocaleOverlayDocument | null> {
  const key = accountInstanceLocaleOverlayKey(
    args.accountId,
    args.widgetCode,
    args.instanceId,
    args.locale,
  );
  return loadJson<LocaleOverlayDocument>(args.env, key);
}

export async function writeLocaleOverlay(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
  locale: string;
  overlay: LocaleOverlayDocument;
}): Promise<LocaleOverlayDocument> {
  await putJson(
    args.env,
    accountInstanceLocaleOverlayKey(
      args.accountId,
      args.widgetCode,
      args.instanceId,
      args.locale,
    ),
    args.overlay,
  );
  return args.overlay;
}

export async function deleteLocaleOverlay(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
  locale: string;
}): Promise<{ locale: string }> {
  await deleteObject(
    args.env,
    accountInstanceLocaleOverlayKey(
      args.accountId,
      args.widgetCode,
      args.instanceId,
      args.locale,
    ),
  );
  return { locale: args.locale };
}

export async function listLocaleOverlayCoordinates(args: {
  env: Env;
  accountId: string;
  widgetCode: string;
  instanceId: string;
}): Promise<string[]> {
  const prefix = accountInstanceLocaleOverlaysPrefix(
    args.accountId,
    args.widgetCode,
    args.instanceId,
  );
  const locales: string[] = [];
  let cursor: string | undefined;
  do {
    const listed = await args.env.TOKYO_R2.list({ prefix, cursor } as R2ListOptions);
    for (const object of listed.objects) {
      const relative = object.key.slice(prefix.length);
      locales.push(relative.slice(0, -'.json'.length));
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return locales.sort((left, right) => left.localeCompare(right));
}
