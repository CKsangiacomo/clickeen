import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildOverlayId,
  computeOverlayIdChecksum,
  createUpperBase36Id,
  parseOverlayId,
  PLATFORM_ID_ALPHABET,
} from './overlay-identity.ts';

test('createUpperBase36Id returns fixed-width uppercase base36 IDs', () => {
  let next = 0;
  const id = createUpperBase36Id(10, (length) => {
    const bytes = new Uint8Array(length);
    for (let index = 0; index < length; index += 1) {
      bytes[index] = next;
      next += 1;
    }
    return bytes;
  });

  assert.equal(id.length, 10);
  assert.match(id, /^[0-9A-Z]{10}$/);
  assert.equal(id, PLATFORM_ID_ALPHABET.slice(0, 10));
});

test('buildOverlayId creates fixed-layout IDs with CRC-16/XMODEM checksum', () => {
  const overlayId = buildOverlayId({
    accountPublicId: 'A1B2C3D4',
    widgetCode: 'FAQ',
    instanceId: 'Z9Y8X7W6V5',
    languageCode: 'IT00',
    experiment: 'A01',
    personalization: '000',
    version: '03',
  });

  assert.equal(overlayId.length, 35);
  assert.equal(overlayId.slice(33), computeOverlayIdChecksum(overlayId.slice(0, 33)));
  assert.deepEqual(parseOverlayId(overlayId), {
    ok: true,
    value: {
      accountPublicId: 'A1B2C3D4',
      widgetCode: 'FAQ',
      instanceId: 'Z9Y8X7W6V5',
      languageCode: 'IT00',
      experiment: 'A01',
      personalization: '000',
      version: '03',
      checksum: overlayId.slice(33),
    },
  });
});

test('parseOverlayId rejects invalid alphabet, width, and checksum', () => {
  const overlayId = buildOverlayId({
    accountPublicId: 'A1B2C3D4',
    widgetCode: 'FAQ',
    instanceId: 'Z9Y8X7W6V5',
    languageCode: 'CS00',
    experiment: 'A01',
    personalization: '000',
    version: '99',
  });

  assert.equal(parseOverlayId(overlayId.toLowerCase()).ok, false);
  assert.equal(parseOverlayId(overlayId.slice(1)).ok, false);
  assert.deepEqual(parseOverlayId(`${overlayId.slice(0, 33)}00`), {
    ok: false,
    reason: 'invalid_checksum',
    detail: `overlayId checksum 00 does not match ${overlayId.slice(33)}`,
  });
});
