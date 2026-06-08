import type { TokyoRouteArgs } from '../route-helpers';
import { tryHandleInternalInstanceRoutes } from './internal-instance-routes';
import { tryHandleInternalPageRoutes } from './internal-page-routes';
import type { InternalRouteHandler } from './internal-product-route-utils';
import { tryHandleInternalTranslationRoutes } from './internal-translation-routes';
import { tryHandleInternalWidgetDefaultRoutes } from './internal-widget-default-routes';
import { tryHandleInternalWidgetDefinitionRoutes } from './internal-widget-definition-routes';

const internalRouteGroups: readonly InternalRouteHandler[] = [
  tryHandleInternalPageRoutes,
  tryHandleInternalWidgetDefaultRoutes,
  tryHandleInternalInstanceRoutes,
  tryHandleInternalTranslationRoutes,
  tryHandleInternalWidgetDefinitionRoutes,
];

export async function tryHandleInternalProductRoutes(
  args: TokyoRouteArgs,
): Promise<Response | null> {
  for (const handleRouteGroup of internalRouteGroups) {
    const response = await handleRouteGroup(args);
    if (response) return response;
  }
  return null;
}
