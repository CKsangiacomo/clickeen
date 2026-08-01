import assert from 'node:assert/strict';
import { mintRomaAiGrant } from '@clickeen/ck-policy';
import { verifyGrant } from '../src/grants';

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
  const payload = {
    iss: 'roma' as const,
    sub: { kind: 'user' as const, userId: 'user-1', accountId: 'account-1' },
    exp: Math.floor(Date.now() / 1000) + 60,
    caps: ['agent:test'],
    budgets: { maxTokens: 100, timeoutMs: 1_000 },
    mode: 'editor' as const,
  };
  const token = await mintRomaAiGrant(payload, privateKeyPem);
  assert.equal((await verifyGrant(token, publicKeyPem)).iss, 'roma');

  await assert.rejects(
    () => verifyGrant(`${token.slice(0, -1)}${token.endsWith('a') ? 'b' : 'a'}`, publicKeyPem),
    /Grant signature mismatch/,
  );
  const wrongIssuer = await mintRomaAiGrant({ ...payload, iss: 'sanfrancisco' }, privateKeyPem);
  await assert.rejects(() => verifyGrant(wrongIssuer, publicKeyPem), /Grant missing required fields/);
}

run().then(
  () => console.log('[sanfrancisco] Roma grant contracts passed.'),
  (error) => {
    console.error(error);
    process.exitCode = 1;
  },
);
