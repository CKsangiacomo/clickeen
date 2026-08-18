import assert from 'node:assert/strict';
import type { RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';
import { generateAccountInstanceTranslations } from '../lib/account-instance-translations';

const CLOUDFLARE_REQUEST_CONTEXT_SYMBOL = Symbol.for('__cloudflare-request-context__');
const requestedLocales = ['fr', 'de', 'it'];

async function run(): Promise<void> {
  const keys = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const privateKeyBytes = await crypto.subtle.exportKey('pkcs8', keys.privateKey);
  const privateKeyBody = Buffer.from(privateKeyBytes).toString('base64').match(/.{1,64}/g)?.join('\n') || '';
  const privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${privateKeyBody}\n-----END PRIVATE KEY-----`;
  const globalRecord = globalThis as Record<PropertyKey, unknown>;
  const previous = globalRecord[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
  let agentRequest: Record<string, unknown> | null = null;
  const validAgentTranslation = () => ({
    ok: false,
    baseLocale: 'en',
    requestedLocales,
    results: [
      { locale: 'fr', ok: true, count: 1 },
      {
        locale: 'de',
        ok: false,
        reasonKey: 'coreui.errors.translation.providerFailed',
        detail: 'German provider failure',
      },
      { locale: 'it', ok: true, count: 1 },
    ],
  });
  let agentTranslation: Record<string, unknown> = validAgentTranslation();
  globalRecord[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = {
    env: {
      ROMA_AI_GRANT_PRIVATE_KEY_PEM: privateKeyPem,
      TOKYO_PRODUCT_CONTROL: {
        async fetch() {
          return Response.json({
            widgetType: 'faq',
            source: {
              content: {
                fields: {
                  'header.title': {
                    value: 'Frequently asked questions',
                    identityKey: 'faq|header-title|header.title',
                    fieldPattern: 'header.title',
                  },
                },
              },
            },
          });
        },
      },
      TRANSLATION_AGENT: {
        async fetch(_input: RequestInfo | URL, init?: RequestInit) {
          agentRequest = JSON.parse(String(init?.body)) as Record<string, unknown>;
          return Response.json({
            requestId: 'translation-outcome-test',
            agentId: 'widget.instance.translator',
            translation: agentTranslation,
          });
        },
      },
    },
  };

  const now = Math.floor(Date.now() / 1000);
  const authz: RomaAccountAuthzCapsulePayload = {
    typ: 'roma.account',
    iss: 'berlin',
    aud: 'roma',
    sub: 'user-1',
    userId: 'user-1',
    accountId: 'account-row-1',
    accountPublicId: 'CLICKEEN',
    accountStatus: 'active',
    accountWebsiteUrl: null,
    entitlements: null,
    profile: 'tier4',
    role: 'owner',
    authzVersion: 'test',
    iat: now,
    exp: now + 60,
  };

  const generate = () =>
    generateAccountInstanceTranslations({
      accountId: 'CLICKEEN',
      instanceId: 'UZ3JEJSHII',
      baseLocale: 'en',
      activeLocales: requestedLocales,
      authz,
      accountCapsule: 'test-capsule',
      requestId: 'translation-outcome-test',
    });

  try {
    const result = await generate();
    assert.equal(result.ok, true, JSON.stringify(result));
    if (!result.ok) return;
    assert.equal(result.status, 200);
    assert.equal(result.value.ok, false);
    assert.deepEqual(result.value.translation.requestedLocales, requestedLocales);
    assert.deepEqual(result.value.translation.translatedLocales, ['fr', 'it']);
    assert.deepEqual(result.value.translation.failedLocales, [
      {
        locale: 'de',
        reasonKey: 'coreui.errors.translation.providerFailed',
        detail: 'German provider failure',
      },
    ]);
    const sentAgentRequest = agentRequest as unknown as Record<string, unknown> | null;
    assert.ok(sentAgentRequest);
    assert.deepEqual(sentAgentRequest.requestedLocales, requestedLocales);
    assert.equal(Object.prototype.hasOwnProperty.call(sentAgentRequest, 'activeLocales'), false);
    assert.equal(
      (sentAgentRequest.items as Array<{ path: string }>)[0]?.path,
      'faq|header-title|header.title',
    );

  } finally {
    if (typeof previous === 'undefined') {
      delete globalRecord[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
    } else {
      globalRecord[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = previous;
    }
  }

  console.log('roma translation outcomes: ok');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
