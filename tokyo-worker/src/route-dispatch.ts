import { tryHandleAssetRoutes } from './routes/asset-routes';
import { tryHandleClkLiveStaticRoutes } from './routes/clk-live-routes';
import { tryHandleInternalRenderRoutes } from './routes/internal-render-routes';
import { json } from './http';
import type { TokyoRouteArgs } from './route-helpers';

function isPublicServingHost(hostname: string): boolean {
  return hostname === 'clk.live' || hostname === 'dev.clk.live';
}

export async function dispatchTokyoRoute(args: TokyoRouteArgs): Promise<Response> {
  if (isPublicServingHost(args.url.hostname)) {
    const response = await tryHandleClkLiveStaticRoutes(args);
    return response ?? args.respond(new Response('Not found', { status: 404 }));
  }

  if (args.pathname === '/healthz') {
    return args.respond(json({ up: true }, { status: 200 }));
  }

  const routeGroups = [
    tryHandleInternalRenderRoutes,
    tryHandleAssetRoutes,
    tryHandleClkLiveStaticRoutes,
  ];

  for (const routeGroup of routeGroups) {
    const response = await routeGroup(args);
    if (response) return response;
  }

  return args.respond(new Response('Not found', { status: 404 }));
}
