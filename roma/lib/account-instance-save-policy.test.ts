import assert from 'node:assert/strict';
import test from 'node:test';
import { validateAccountInstanceSavePolicy } from './account-instance-save-policy';

test('account instance save policy rejects paid social share output for non-entitled accounts', () => {
  const result = validateAccountInstanceSavePolicy({
    config: {
      behavior: {
        socialShare: {
          enabled: true,
        },
      },
    },
    authz: {
      profile: 'free',
      role: 'owner',
      entitlements: null,
    },
  });

  assert.deepEqual(result, {
    ok: false,
    status: 422,
    error: {
      kind: 'VALIDATION',
      reasonKey: 'coreui.upsell.reason.flagBlocked',
      detail: 'widget.socialShare.enabled',
      paths: ['behavior.socialShare.enabled'],
    },
  });
});

test('account instance save policy allows social share output for entitled accounts', () => {
  assert.deepEqual(
    validateAccountInstanceSavePolicy({
      config: {
        behavior: {
          socialShare: {
            enabled: true,
          },
        },
      },
      authz: {
        profile: 'tier4',
        role: 'owner',
        entitlements: null,
      },
    }),
    { ok: true },
  );
});

test('account instance save policy ignores disabled social share config', () => {
  assert.deepEqual(
    validateAccountInstanceSavePolicy({
      config: {
        behavior: {
          socialShare: {
            enabled: false,
          },
        },
      },
      authz: {
        profile: 'free',
        role: 'owner',
        entitlements: null,
      },
    }),
    { ok: true },
  );
});
