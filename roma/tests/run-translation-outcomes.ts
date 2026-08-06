import assert from 'node:assert/strict';
import type { RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';
import { generateAccountTranslations } from '../lib/account-instance-translations';

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
        async fetch(input: RequestInfo | URL) {
          if (new URL(String(input)).pathname.includes('/__internal/pages/')) {
            return Response.json({
              source: {
                pageId: '7UZXTP3TOI',
                displayName: 'Summer page',
                isTemplate: false,
                baseLocale: 'es',
                values: { title: 'Summer', description: 'Summer page' },
                robots: 'index-follow',
                placements: [],
              },
            });
          }
          return Response.json({
            widgetType: 'faq',
            source: {
              content: {
                fields: {
                  'header.title': { value: 'Frequently asked questions' },
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
    generateAccountTranslations({
      accountId: 'CLICKEEN',
      target: { kind: 'instance', id: 'UZ3JEJSHII' },
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
    assert.deepEqual(sentAgentRequest.target, { kind: 'instance', id: 'UZ3JEJSHII' });

    agentTranslation = {
      ...validAgentTranslation(),
      baseLocale: 'es',
    };
    const pageResult = await generateAccountTranslations({
      accountId: 'CLICKEEN',
      target: { kind: 'page', id: '7UZXTP3TOI' },
      baseLocale: 'en',
      activeLocales: [...requestedLocales, 'es'],
      authz,
      accountCapsule: 'test-capsule',
      requestId: 'page-translation-outcome-test',
    });
    assert.equal(pageResult.ok, true, JSON.stringify(pageResult));
    if (!pageResult.ok) return;
    assert.equal(pageResult.value.translation.baseLocale, 'es');
    const pageAgentRequest = agentRequest as unknown as Record<string, unknown>;
    assert.deepEqual(pageAgentRequest.target, { kind: 'page', id: '7UZXTP3TOI' });
    assert.equal(pageAgentRequest.baseLocale, 'es');
    assert.deepEqual(pageAgentRequest.requestedLocales, requestedLocales);
    assert.deepEqual((pageAgentRequest.items as Array<{ path: string }>).map((item) => item.path), ['title', 'description']);

    agentTranslation = validAgentTranslation();
    const valid = validAgentTranslation();
    const validResults = valid.results as Array<Record<string, unknown>>;
    const invalidTranslations: Array<{ name: string; value: Record<string, unknown> }> = [
      {
        name: 'missing result',
        value: { ...valid, results: validResults.slice(0, 2) },
      },
      {
        name: 'duplicate result',
        value: { ...valid, results: [validResults[0], validResults[0], validResults[2]] },
      },
      {
        name: 'out-of-order result',
        value: { ...valid, results: [validResults[1], validResults[0], validResults[2]] },
      },
      {
        name: 'mismatched requested locales',
        value: { ...valid, requestedLocales: ['fr', 'it', 'de'] },
      },
      {
        name: 'inconsistent success flag',
        value: { ...valid, ok: true },
      },
      {
        name: 'malformed translated count',
        value: {
          ...valid,
          results: [{ locale: 'fr', ok: true, count: -1 }, validResults[1], validResults[2]],
        },
      },
    ];
    for (const invalid of invalidTranslations) {
      agentTranslation = invalid.value;
      const invalidResult = await generate();
      assert.equal(invalidResult.ok, false, invalid.name);
      if (!invalidResult.ok) {
        assert.equal(invalidResult.status, 422, invalid.name);
        assert.equal(invalidResult.error.detail, 'translation_agent_invalid_payload', invalid.name);
      }
    }
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
