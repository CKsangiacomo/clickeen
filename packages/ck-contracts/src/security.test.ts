import assert from 'node:assert/strict';
import test from 'node:test';
import { sha256Hex, timingSafeEqualBytes, timingSafeEqualString } from './security.ts';

test('timingSafeEqualBytes compares equal bytes', () => {
  assert.equal(timingSafeEqualBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])), true);
});

test('timingSafeEqualBytes rejects unequal bytes', () => {
  assert.equal(timingSafeEqualBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4])), false);
});

test('timingSafeEqualBytes rejects length mismatch', () => {
  assert.equal(timingSafeEqualBytes(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2])), false);
});

test('timingSafeEqualString compares non-ASCII strings as encoded bytes', () => {
  assert.equal(timingSafeEqualString('tokyo-東京', 'tokyo-東京'), true);
  assert.equal(timingSafeEqualString('tokyo-東京', 'tokyo-京都'), false);
});

test('sha256Hex hashes string and byte inputs consistently', async () => {
  const value = 'clickeen-東京';
  const encoded = new TextEncoder().encode(value);
  assert.equal(await sha256Hex(value), await sha256Hex(encoded));
  assert.equal(await sha256Hex(encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength)), await sha256Hex(value));
});
