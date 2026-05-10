import { isUuid } from '@clickeen/ck-contracts';
import { normalizeStorageId } from '../asset-utils';
import { handleGetAccountTranslationsPanel } from '../domains/account-localization-state';
import { handleGetL10nAsset } from '../domains/l10n-read';
import { authorizeRomaAccountScopedRequest, respondMethodNotAllowed, respondValidation, type TokyoRouteArgs } from '../route-helpers';

export async function tryHandleInternalL10nRoutes(
  args: TokyoRouteArgs,
): Promise<Response | null> {
  const { req, env, pathname, respond } = args;

  const internalL10nTranslationsMatch = pathname.match(
    /^\/__internal\/account\/widgets\/([^/]+)\/translations$/,
  );
  if (internalL10nTranslationsMatch) {
    const instanceId = normalizeStorageId(decodeURIComponent(internalL10nTranslationsMatch[1]));
    const accountId = String(req.headers.get('x-account-id') || '').trim();
    if (!instanceId || !isUuid(accountId)) {
      return respondValidation(respond, 'tokyo.errors.l10n.invalid');
    }
    if (req.method !== 'GET') {
      return respondMethodNotAllowed(respond);
    }
    const authErr = await authorizeRomaAccountScopedRequest({
      req,
      env,
      accountId,
      minRole: 'viewer',
    });
    if (authErr) return respond(authErr);
    return respond(await handleGetAccountTranslationsPanel(req, env, instanceId, accountId));
  }

  const l10nVersionedMatch = pathname.match(/^\/l10n\/v\/[^/]+\/(.+)$/);
  if (l10nVersionedMatch) {
    if (req.method !== 'GET') return respondMethodNotAllowed(respond);
    const rest = l10nVersionedMatch[1];
    const key = `l10n/${rest}`;
    return respond(await handleGetL10nAsset(env, key));
  }

  if (pathname.startsWith('/l10n/')) {
    if (req.method !== 'GET') return respondMethodNotAllowed(respond);
    const key = pathname.replace(/^\//, '');
    return respond(await handleGetL10nAsset(env, key));
  }

  return null;
}
