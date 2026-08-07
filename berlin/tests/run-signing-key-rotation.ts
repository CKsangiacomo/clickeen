import assert from 'node:assert/strict';
import { resolveSigningContext, signAccessToken, verifyAccessToken } from '../src/crypto/jwt';
import {
  DEFAULT_AUDIENCE,
  DEFAULT_ISSUER,
  SIGNING_CONTEXT_KEY,
  type Env,
  type SigningContext,
} from '../src/types';

const encoder = new TextEncoder();

function clearSigningContext(): void {
  delete (globalThis as unknown as Record<string, unknown>)[SIGNING_CONTEXT_KEY];
}

function toPem(label: 'PRIVATE KEY' | 'PUBLIC KEY', bytes: ArrayBuffer): string {
  const base64 = Buffer.from(bytes).toString('base64');
  const lines = base64.match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----`;
}

async function generateSigningPair(): Promise<{ privatePem: string; publicPem: string }> {
  const pair = (await crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const [privateBytes, publicBytes] = await Promise.all([
    crypto.subtle.exportKey('pkcs8', pair.privateKey),
    crypto.subtle.exportKey('spki', pair.publicKey),
  ]);
  return {
    privatePem: toPem('PRIVATE KEY', privateBytes),
    publicPem: toPem('PUBLIC KEY', publicBytes),
  };
}

async function verifyWithPublishedKeys(token: string, context: SigningContext): Promise<boolean> {
  const [headerB64, payloadB64, signatureB64] = token.split('.');
  assert.ok(headerB64 && payloadB64 && signatureB64);
  const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8')) as {
    kid?: string;
  };
  const publishedKeys = [context.current, ...(context.previous ? [context.previous] : [])];
  const byKid = new Map(publishedKeys.map((key) => [key.kid, key]));
  assert.equal(byKid.size, publishedKeys.length, 'JWKS must not publish duplicate kid values');
  const published = header.kid ? byKid.get(header.kid) : undefined;
  assert.ok(published, `missing published key ${header.kid ?? '<none>'}`);
  const signature = Uint8Array.from(Buffer.from(signatureB64, 'base64url'));
  return crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    published.publicKey,
    signature,
    encoder.encode(`${headerB64}.${payloadB64}`),
  );
}

async function testOverlappingRotationVerifiesOldAndNewTokens(): Promise<void> {
  const [oldPair, newPair] = await Promise.all([generateSigningPair(), generateSigningPair()]);
  const oldEnv = {
    BERLIN_ACCESS_PRIVATE_KEY_PEM: oldPair.privatePem,
    BERLIN_ACCESS_PUBLIC_KEY_PEM: oldPair.publicPem,
  } satisfies Env;
  clearSigningContext();
  const oldContext = await resolveSigningContext(oldEnv);
  const now = Math.floor(Date.now() / 1000);
  const claims = {
    sub: 'rotation-test-user',
    iss: DEFAULT_ISSUER,
    aud: DEFAULT_AUDIENCE,
    iat: now,
    exp: now + 300,
  };
  const oldToken = await signAccessToken(claims, oldEnv);

  const rotationEnv = {
    BERLIN_ACCESS_PRIVATE_KEY_PEM: newPair.privatePem,
    BERLIN_ACCESS_PUBLIC_KEY_PEM: newPair.publicPem,
    BERLIN_ACCESS_PREVIOUS_PUBLIC_KEY_PEM: oldPair.publicPem,
    BERLIN_ACCESS_PREVIOUS_KID: oldContext.current.kid,
  } satisfies Env;
  clearSigningContext();
  const rotationContext = await resolveSigningContext(rotationEnv);
  assert.notEqual(rotationContext.current.kid, oldContext.current.kid);
  assert.equal(rotationContext.previous?.kid, oldContext.current.kid);

  const newToken = await signAccessToken(claims, rotationEnv);
  assert.equal((await verifyAccessToken(oldToken, rotationEnv)).ok, true);
  assert.equal((await verifyAccessToken(newToken, rotationEnv)).ok, true);
  assert.equal(await verifyWithPublishedKeys(oldToken, rotationContext), true);
  assert.equal(await verifyWithPublishedKeys(newToken, rotationContext), true);

  clearSigningContext();
  await assert.rejects(
    resolveSigningContext({
      ...rotationEnv,
      BERLIN_ACCESS_PREVIOUS_KID: rotationContext.current.kid,
    }),
    /must use distinct kid values/,
  );

  clearSigningContext();
  await assert.rejects(
    resolveSigningContext({
      ...rotationEnv,
      BERLIN_ACCESS_PREVIOUS_PUBLIC_KEY_PEM:
        '-----BEGIN PUBLIC KEY-----\nbm90LWEtdmFsaWQta2V5\n-----END PUBLIC KEY-----',
    }),
  );
}

try {
  await testOverlappingRotationVerifiesOldAndNewTokens();
  console.log('PASS overlapping signing-key rotation verifies old and new tokens');
} finally {
  clearSigningContext();
}
