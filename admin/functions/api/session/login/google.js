import { resolveBerlinBaseUrl, resolveDevstudioOrigin } from '../../../_shared/env.js';
import { json, methodNotAllowed, redirect, resolveSafeNextPath } from '../../../_shared/http.js';

export async function onRequest(context) {
  if (context.request.method.toUpperCase() !== 'GET') return methodNotAllowed();

  const { request, env } = context;
  const url = new URL(request.url);
  const nextPath = resolveSafeNextPath(url.searchParams.get('next'));
  if (!nextPath) return json({ error: { kind: 'VALIDATION', reasonKey: 'coreui.errors.auth.continuationInvalid' } }, 422);

  const berlinBase = resolveBerlinBaseUrl(env);
  const devstudioOrigin = resolveDevstudioOrigin(env);

  const loginUrl = new URL('/auth/login/google/start', berlinBase);
  loginUrl.searchParams.set('next', nextPath);
  loginUrl.searchParams.set('finishRedirectUrl', `${devstudioOrigin}/api/session/finish`);
  return redirect(loginUrl.toString(), 302);
}
