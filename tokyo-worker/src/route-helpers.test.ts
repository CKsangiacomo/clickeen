import assert from 'node:assert/strict';
import test from 'node:test';
import { isValidScopedInstance } from './instance-identity.ts';

const ACCOUNT_ID = 'A1B2C3D4';

test('isValidScopedInstance accepts compact instance IDs', () => {
  assert.equal(isValidScopedInstance('A1B2C3D4E5', ACCOUNT_ID), true);
});

test('isValidScopedInstance rejects old ins-prefixed instance IDs', () => {
  assert.equal(isValidScopedInstance('ins_legacy_instance', ACCOUNT_ID), false);
});

test('isValidScopedInstance rejects uuid account IDs', () => {
  assert.equal(isValidScopedInstance('A1B2C3D4E5', '00000000-0000-0000-0000-000000000100'), false);
});
