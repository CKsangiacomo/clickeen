import assert from 'node:assert/strict';
import {
  formatAccountRoleLabel,
  formatAccountTierLabel,
  isAccountRoleValue,
} from '../lib/format';

const tierLabels = [
  ['free', 'Free'],
  ['tier1', 'Tier 1'],
  ['tier2', 'Tier 2'],
  ['tier3', 'Tier 3'],
  ['tier4', 'Tier 4'],
] as const;

const roleLabels = [
  ['viewer', 'Viewer'],
  ['editor', 'Editor'],
  ['admin', 'Admin'],
  ['owner', 'Owner'],
] as const;

for (const [value, label] of tierLabels) {
  assert.equal(formatAccountTierLabel(value), label);
}

for (const [value, label] of roleLabels) {
  assert.equal(formatAccountRoleLabel(value), label);
  assert.equal(isAccountRoleValue(value), true);
}

assert.equal(formatAccountTierLabel('enterprise'), 'Invalid plan');
assert.equal(formatAccountTierLabel(null), 'Invalid plan');
assert.equal(formatAccountRoleLabel('superadmin'), 'Invalid role');
assert.equal(formatAccountRoleLabel(undefined), 'Invalid role');
assert.equal(isAccountRoleValue('superadmin'), false);
assert.equal(isAccountRoleValue(null), false);

console.log('PASS account plan and role display labels');
