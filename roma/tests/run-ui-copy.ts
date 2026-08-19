import assert from 'node:assert/strict';
import {
  formatAccountRoleLabel,
  formatAccountTierLabel,
  isAccountRoleValue,
} from '../lib/format';
import { resolveAccountLocalesSuccessCopy } from '../components/account-locale-settings-card';
import { resolveAccountShellErrorCopy } from '../lib/account-shell-copy';

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
assert.equal(resolveAccountLocalesSuccessCopy({}), 'Saved languages.');
assert.equal(
  resolveAccountLocalesSuccessCopy({
    localeCleanup: {
      ok: false,
      error: { reasonKey: 'coreui.errors.db.writeFailed' },
    },
  }),
  'Saved languages. Removed language content could not be fully deleted.',
);
assert.equal(
  resolveAccountShellErrorCopy('roma.errors.proxy.tokyo_unavailable', 'fallback'),
  'Widget delivery is unavailable right now. Please try again.',
);
assert.equal(
  resolveAccountShellErrorCopy('coreui.errors.instance.commandInProgress', 'fallback'),
  'Another widget update is finishing. Please try again in a moment.',
);
assert.equal(
  resolveAccountShellErrorCopy('coreui.errors.instance.sourceChanged', 'fallback'),
  'Saved changes changed while this widget was being prepared. Publish again.',
);
console.log('PASS account plan, role, locale cleanup, and Publish contention display labels');
