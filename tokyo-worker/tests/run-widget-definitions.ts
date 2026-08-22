import assert from 'node:assert/strict';
import { listWidgetDefinitions } from '../src/domains/widget-definitions';
import { tryHandleInternalWidgetDefinitionRoutes } from '../src/routes/internal-widget-definition-routes';
import type { TokyoRouteArgs } from '../src/route-helpers';
import type { Env } from '../src/types';

const expected = [
  { widgetType: 'big-bang', displayName: 'Big Bang', description: '' },
  { widgetType: 'cards', displayName: 'Cards', description: '' },
  { widgetType: 'countdown', displayName: 'Countdown', description: '' },
  { widgetType: 'faq', displayName: 'FAQ', description: '' },
  { widgetType: 'logoshowcase', displayName: 'Logo Showcase', description: '' },
];

assert.deepEqual(listWidgetDefinitions(), expected);
for (const definition of listWidgetDefinitions()) {
  assert.deepEqual(Object.keys(definition), ['widgetType', 'displayName', 'description']);
}

function routeArgs(request: Request): TokyoRouteArgs {
  const url = new URL(request.url);
  return {
    req: request,
    env: {} as Env,
    cache: undefined,
    waitUntil: () => undefined,
    pathname: url.pathname,
    url,
    respond: (response) => response,
  };
}

const methodResponse = await tryHandleInternalWidgetDefinitionRoutes(
  routeArgs(
    new Request('https://tokyo.internal/__internal/widgets/definitions', {
      method: 'POST',
      headers: { 'x-account-id': 'ACCOUNT1' },
    }),
  ),
);
assert.equal(methodResponse?.status, 405);

const authResponse = await tryHandleInternalWidgetDefinitionRoutes(
  routeArgs(
    new Request('https://tokyo.internal/__internal/widgets/definitions', {
      headers: { 'x-account-id': 'ACCOUNT1' },
    }),
  ),
);
assert.equal(authResponse?.status, 403);

console.log('PASS Tokyo exposes exact compact Widget definitions behind the existing boundary');
