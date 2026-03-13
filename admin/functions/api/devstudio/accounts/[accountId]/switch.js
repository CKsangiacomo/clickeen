import {
  buildAccountsListResponse,
  proxyBerlinJson,
  resolvePlatformContext,
} from '../../../../_lib/devstudio-api.js';

export async function onRequest(context) {
  const platformContext = await resolvePlatformContext(context.request, context.env);
  if (!platformContext.ok) {
    return buildAccountsListResponse(platformContext);
  }

  if (context.request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: {
        allow: 'POST',
      },
    });
  }

  const accountId = encodeURIComponent(String(context.params.accountId || ''));
  return proxyBerlinJson(
    context.request,
    context.env,
    platformContext,
    `/v1/accounts/${accountId}/switch`,
    {
      method: 'POST',
      body: '{}',
    },
  );
}
