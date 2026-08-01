import assert from 'node:assert/strict';
import {
  mintRomaAiGrant,
  readRomaAiGrantEnvelope,
  verifyRomaAiGrantSignature,
} from '../src/ai-grant-signature';

function pem(label: 'PRIVATE KEY' | 'PUBLIC KEY', bytes: ArrayBuffer): string {
  const encoded = Buffer.from(bytes).toString('base64').match(/.{1,64}/g)?.join('\n') || '';
  return `-----BEGIN ${label}-----\n${encoded}\n-----END ${label}-----`;
}

async function run(): Promise<void> {
  const keys = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const privateKeyPem = pem('PRIVATE KEY', await crypto.subtle.exportKey('pkcs8', keys.privateKey));
  const publicKeyPem = pem('PUBLIC KEY', await crypto.subtle.exportKey('spki', keys.publicKey));
  const token = await mintRomaAiGrant({ iss: 'roma', exp: 2_000_000_000, caps: ['agent:test'] }, privateKeyPem);
  const envelope = readRomaAiGrantEnvelope(token);
  assert.ok(envelope);
  assert.equal(await verifyRomaAiGrantSignature(envelope, publicKeyPem), true);

  const tampered = {
    ...envelope,
    payloadB64: `${envelope.payloadB64[0] === 'a' ? 'b' : 'a'}${envelope.payloadB64.slice(1)}`,
  };
  assert.equal(await verifyRomaAiGrantSignature(tampered, publicKeyPem), false);
  assert.equal(readRomaAiGrantEnvelope('ckgrant.invalid.invalid'), null);
  await assert.rejects(() => mintRomaAiGrant({ iss: 'roma' }, publicKeyPem), /private key PEM/);
}

run().then(
  () => console.log('[ck-policy] Roma AI grant signature contracts passed.'),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
