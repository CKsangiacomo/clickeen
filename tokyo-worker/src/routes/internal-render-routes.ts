import type { TokyoRouteArgs } from '../route-helpers';
import { tryHandleInternalInstanceRoutes } from './internal-instance-routes';
import { tryHandleInternalPublishRoutes } from './internal-publish-routes';
import type { InternalRouteHandler } from './internal-render-route-utils';
import { tryHandleInternalTranslationRoutes } from './internal-translation-routes';
import { tryHandleInternalWidgetDefinitionRoutes } from './internal-widget-definition-routes';

const internalRouteGroups: readonly InternalRouteHandler[] = [
  tryHandleInternalPublishRoutes,
  tryHandleInternalInstanceRoutes,
  tryHandleInternalTranslationRoutes,
  tryHandleInternalWidgetDefinitionRoutes,
];

export async function tryHandleInternalRenderRoutes(
  args: TokyoRouteArgs,
): Promise<Response | null> {
  for (const handleRouteGroup of internalRouteGroups) {
    const response = await handleRouteGroup(args);
    if (response) return response;
  }
  return null;
}
