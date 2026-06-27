import { strict as assert } from 'node:assert';
import { ENTITLEMENT_KEYS, PLAN_LIMIT_KEYS, getEntitlementsMatrix } from '../src/index';

const tiers = ['free', 'tier1', 'tier2', 'tier3', 'tier4'] as const;

const registryKeys = new Set<string>(ENTITLEMENT_KEYS);
const matrix = getEntitlementsMatrix();
const matrixKeys = new Set(Object.keys(matrix.entitlements));
const retiredWidgetTypeLimitKey = ['widgets', 'types', 'max'].join('.');

assert.deepEqual(
  [...matrixKeys].sort(),
  [...registryKeys].sort(),
  'registry keys and matrix keys must match exactly',
);

assert.ok(registryKeys.has('widgets.instances.max'), 'widgets.instances.max must exist');
assert.ok(!registryKeys.has(retiredWidgetTypeLimitKey), 'retired widget type limit key must not exist');
assert.ok(PLAN_LIMIT_KEYS.includes('widgets.instances.max'), 'widgets.instances.max must be a plan limit');
assert.ok(
  !PLAN_LIMIT_KEYS.includes(retiredWidgetTypeLimitKey),
  'retired widget type limit key must not be a plan limit',
);

const widgetInstances = matrix.entitlements['widgets.instances.max'];
const publishedInstances = matrix.entitlements['instances.published.max'];

assert.equal(widgetInstances?.kind, 'limit', 'widgets.instances.max must be a limit');
assert.equal(publishedInstances?.kind, 'limit', 'instances.published.max must be a limit');

for (const tier of tiers) {
  const widgetValue = widgetInstances.values[tier];
  const publishedValue = publishedInstances.values[tier];

  assert.equal(typeof widgetValue, 'number', `widgets.instances.max.${tier} must be finite`);
  assert.ok(Number.isFinite(widgetValue), `widgets.instances.max.${tier} must be finite`);

  assert.equal(typeof publishedValue, 'number', `instances.published.max.${tier} must be finite`);
  assert.ok(Number.isFinite(publishedValue), `instances.published.max.${tier} must be finite`);

  assert.ok(
    widgetValue >= publishedValue,
    `widgets.instances.max.${tier} must be >= instances.published.max.${tier}`,
  );
}
