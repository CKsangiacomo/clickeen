import { strict as assert } from 'node:assert';
import {
  ENTITLEMENT_KEYS,
  PLAN_LIMIT_KEYS,
  assertEntitlementsMatrix,
  getEntitlementsMatrix,
  readPolicyLimit,
  resolvePolicy,
} from '../src/index';

const tiers = ['free', 'tier1', 'tier2', 'tier3', 'tier4', 'tier99'] as const;

const registryKeys = new Set<string>(ENTITLEMENT_KEYS);
const matrix = getEntitlementsMatrix();
const matrixKeys = new Set(Object.keys(matrix.entitlements));
const retiredWidgetTypeLimitKey = ['widgets', 'types', 'max'].join('.');

assert.deepEqual(
  [...matrixKeys].sort(),
  [...registryKeys].sort(),
  'registry keys and matrix keys must match exactly',
);

assert.equal(
  readPolicyLimit(resolvePolicy({ profile: 'tier2', role: 'owner' }), 'pages.max'),
  3,
  'Tier 2 Page creation must use the shared finite limit',
);
assert.equal(
  readPolicyLimit(resolvePolicy({ profile: 'tier99', role: 'owner' }), 'pages.max'),
  null,
  'Tier99 Page creation must use the shared unlimited value',
);

const rawMatrix = structuredClone(matrix) as {
  tiers: string[];
  entitlements: Record<string, unknown>;
};
const missingKeyMatrix = structuredClone(rawMatrix);
delete missingKeyMatrix.entitlements[ENTITLEMENT_KEYS[0]];
assert.throws(
  () => assertEntitlementsMatrix(missingKeyMatrix),
  /missing entitlement keys/,
  'matrix validation must reject missing registry keys',
);

const unknownKeyMatrix = structuredClone(rawMatrix);
unknownKeyMatrix.entitlements['invented.entitlement'] = {
  kind: 'flag',
  values: Object.fromEntries(tiers.map((tier) => [tier, false])),
};
assert.throws(
  () => assertEntitlementsMatrix(unknownKeyMatrix),
  /unknown entitlement keys/,
  'matrix validation must reject keys outside the registry',
);

assert.ok(registryKeys.has('widgets.instances.max'), 'widgets.instances.max must exist');
assert.ok(registryKeys.has('pages.max'), 'pages.max must exist');
assert.ok(!registryKeys.has(retiredWidgetTypeLimitKey), 'retired widget type limit key must not exist');
assert.ok(PLAN_LIMIT_KEYS.includes('widgets.instances.max'), 'widgets.instances.max must be a plan limit');
assert.ok(PLAN_LIMIT_KEYS.includes('pages.max'), 'pages.max must be a plan limit');
assert.ok(
  !PLAN_LIMIT_KEYS.includes(retiredWidgetTypeLimitKey),
  'retired widget type limit key must not be a plan limit',
);

const widgetInstances = matrix.entitlements['widgets.instances.max'];
const publishedInstances = matrix.entitlements['instances.published.max'];
const pages = matrix.entitlements['pages.max'];

assert.equal(widgetInstances?.kind, 'limit', 'widgets.instances.max must be a limit');
assert.equal(publishedInstances?.kind, 'limit', 'instances.published.max must be a limit');
assert.equal(pages?.kind, 'limit', 'pages.max must be a limit');

assert.deepEqual(
  tiers.map((tier) => pages.values[tier]),
  [0, 0, 3, 10, null, null],
  'pages.max must follow the approved tier contract',
);

for (const entitlement of Object.values(matrix.entitlements)) {
  assert.deepEqual(
    entitlement.values.tier99,
    entitlement.values.tier4,
    'Tier99 must match Tier 4 for every existing entitlement',
  );
}

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
