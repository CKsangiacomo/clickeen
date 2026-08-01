import assert from 'node:assert/strict';
import { resolveBerlinJwksUrl } from '../src/auth';
import type { Env } from '../src/types';

function authEnv(values: Pick<Env, 'BERLIN_BASE_URL' | 'BERLIN_JWKS_URL'>): Env {
  return values as Env;
}

assert.equal(
  resolveBerlinJwksUrl(
    authEnv({
      BERLIN_BASE_URL: 'https://berlin.example.com/',
      BERLIN_JWKS_URL: 'https://keys.example.com/berlin.json',
    }),
  ),
  'https://keys.example.com/berlin.json',
  'an explicit BERLIN_JWKS_URL must remain authoritative',
);

assert.equal(
  resolveBerlinJwksUrl(authEnv({ BERLIN_BASE_URL: 'https://berlin.example.com/' })),
  'https://berlin.example.com/.well-known/jwks.json',
  'the JWKS URL must derive only from the configured Berlin base URL',
);

assert.throws(
  () => resolveBerlinJwksUrl(authEnv({})),
  /Missing BERLIN_BASE_URL or BERLIN_JWKS_URL/,
  'missing Berlin auth authority must fail instead of selecting cloud-dev',
);

console.log('Tokyo auth config verification passed.');
