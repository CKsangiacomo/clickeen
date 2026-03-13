import { buildContextResponse, resolvePlatformContext } from '../../_lib/devstudio-api.js';

export async function onRequest(context) {
  const platformContext = await resolvePlatformContext(context.request, context.env);
  return buildContextResponse(platformContext);
}

