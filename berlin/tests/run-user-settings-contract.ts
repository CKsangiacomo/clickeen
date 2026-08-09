import assert from 'node:assert/strict';
import { parseUserSettingsPatchPayload } from '../src/identity/user-settings';
import { normalizeUserSettingsPayload } from '../src/identity/user-row-normalization';

const enabled = parseUserSettingsPatchPayload({ usePrimaryLanguageForUi: true });
assert.equal(enabled.ok, true);
if (enabled.ok) {
  assert.deepEqual(enabled.patch, { use_primary_language_for_ui: true });
}

const disabled = parseUserSettingsPatchPayload({ usePrimaryLanguageForUi: false });
assert.equal(disabled.ok, true);
if (disabled.ok) {
  assert.deepEqual(disabled.patch, { use_primary_language_for_ui: false });
}

assert.equal(parseUserSettingsPatchPayload({ usePrimaryLanguageForUi: 'true' }).ok, false);
assert.equal(parseUserSettingsPatchPayload({}).ok, false);

assert.deepEqual(
  normalizeUserSettingsPayload('user-1', {
    primary_email: 'owner@example.com',
    primary_language: 'it',
    use_primary_language_for_ui: false,
  }),
  {
    userId: 'user-1',
    primaryEmail: 'owner@example.com',
    givenName: null,
    familyName: null,
    primaryLanguage: 'it',
    usePrimaryLanguageForUi: false,
    country: null,
    timezone: null,
  },
);
assert.equal(
  normalizeUserSettingsPayload('user-1', {
    primary_email: 'owner@example.com',
    primary_language: 'it',
  }),
  null,
);

console.log('PASS user UI primary-language preference contract');
