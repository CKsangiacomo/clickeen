import { tryHandleAssetRoutes } from './routes/asset-routes';
import { tryHandleAccountAssetRepairRoutes } from './routes/account-asset-repair-routes';
import { tryHandleInternalL10nRoutes } from './routes/l10n-routes';
import { tryHandleInternalRenderRoutes } from './routes/internal-render-routes';
import { tryHandlePublicRenderRoutes } from './routes/render-routes';
import { json } from './http';
import type { TokyoRouteArgs } from './route-helpers';

export async function dispatchTokyoRoute(args: TokyoRouteArgs): Promise<Response> {
  if (args.pathname === '/healthz') {
    return args.respond(json({ up: true }, { status: 200 }));
  }

  const routeGroups = [
    tryHandleAccountAssetRepairRoutes,
    tryHandleInternalRenderRoutes,
    tryHandleInternalL10nRoutes,
    tryHandleAssetRoutes,
    tryHandlePublicRenderRoutes,
  ];

  for (const routeGroup of routeGroups) {
    const response = await routeGroup(args);
    if (response) return response;
  }

  return args.respond(new Response('Not found', { status: 404 }));
}
