import { strict as assert } from 'node:assert';
import {
  ENTITLEMENT_KEYS,
  PLAN_LIMIT_KEYS,
  assertEntitlementsMatrix,
  getEntitlementsMatrix,
} from '../src/index';

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

assert.ok(!registryKeys.has(retiredWidgetTypeLimitKey), 'retired widget type limit key must not exist');
assert.ok(
  !PLAN_LIMIT_KEYS.includes(retiredWidgetTypeLimitKey),
  'retired widget type limit key must not be a plan limit',
);

const publishedInstances = matrix.entitlements['instances.published.max'];

assert.equal(publishedInstances?.kind, 'limit', 'instances.published.max must be a limit');

for (const tier of tiers) {
  const publishedValue = publishedInstances.values[tier];

  assert.equal(typeof publishedValue, 'number', `instances.published.max.${tier} must be finite`);
  assert.ok(Number.isFinite(publishedValue), `instances.published.max.${tier} must be finite`);
}
