import {
  buildAccountsListResponse,
  proxyBerlinJson,
  resolvePlatformContext,
} from '../../../_lib/devstudio-api.js';

export async function onRequest(context) {
  const platformContext = await resolvePlatformContext(context.request, context.env);
  if (!platformContext.ok) {
    return buildAccountsListResponse(platformContext);
  }

  if (context.request.method === 'GET') {
    return buildAccountsListResponse(platformContext);
  }

  if (context.request.method === 'POST') {
    const body = await context.request.text();
    return proxyBerlinJson(context.request, context.env, platformContext, '/v1/accounts', {
      method: 'POST',
      body,
    });
  }

  return new Response('Method Not Allowed', {
    status: 405,
    headers: {
      allow: 'GET, POST',
    },
  });
}

