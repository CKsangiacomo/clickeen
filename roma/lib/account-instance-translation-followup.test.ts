import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_OVERLAY_EXPERIMENT,
  DEFAULT_OVERLAY_PERSONALIZATION,
  buildOverlayId,
} from '@clickeen/ck-contracts/overlay-identity';
import type { RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';
import widgetsManifest from '../../tokyo/product/widgets/manifest.json';
import { runInstanceTranslationFollowupAfterSave } from './account-instance-translation-followup';

const CLOUDFLARE_REQUEST_CONTEXT_SYMBOL = Symbol.for('__cloudflare-request-context__');
const ACCOUNT_PUBLIC_ID = 'A1B2C3D4';
const INSTANCE_ID = 'I1B2C3D4E5';
const PREVIOUS_OVERLAY_ID = buildOverlayId({
  accountPublicId: ACCOUNT_PUBLIC_ID,
  widgetCode: 'FAQ',
  instanceId: INSTANCE_ID,
  languageCode: 'IT00',
  experiment: DEFAULT_OVERLAY_EXPERIMENT,
  personalization: DEFAULT_OVERLAY_PERSONALIZATION,
  version: '00',
});
const NEXT_OVERLAY_ID = buildOverlayId({
  accountPublicId: ACCOUNT_PUBLIC_ID,
  widgetCode: 'FAQ',
  instanceId: INSTANCE_ID,
  languageCode: 'IT00',
  experiment: DEFAULT_OVERLAY_EXPERIMENT,
  personalization: DEFAULT_OVERLAY_PERSONALIZATION,
  version: '01',
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function authz(): RomaAccountAuthzCapsulePayload {
  return {
    v: 1,
    typ: 'roma.account',
    iss: 'berlin',
    aud: 'roma',
    sub: 'usr_test',
    userId: 'usr_test',
    accountId: 'acct_test',
    accountPublicId: ACCOUNT_PUBLIC_ID,
    accountStatus: 'active',
    accountIsPlatform: false,
    accountName: 'Test Account',
    accountSlug: 'test-account',
    accountWebsiteUrl: null,
    profile: 'free',
    role: 'owner',
    authzVersion: 'test',
    iat: 0,
    exp: 9_999_999_999,
  };
}

test('Roma save follow-up translates one changed FAQ answer and writes complete current language values', async () => {
  const previousConfig = {
    header: { title: 'FAQs', subtitleHtml: 'Quick answers' },
    cta: { label: 'Book now' },
    sections: [
      {
        id: 'rooms',
        title: 'Rooms',
        faqs: [
          {
            id: 'room-types',
            question: 'What rooms do you offer?',
            answer: 'We offer suites.',
          },
        ],
      },
    ],
  };
  const currentConfig = {
    ...previousConfig,
    sections: [
      {
        id: 'rooms',
        title: 'Rooms',
        faqs: [
          {
            id: 'room-types',
            question: 'What rooms do you offer?',
            answer: 'We offer suites and standard rooms.',
          },
        ],
      },
    ],
  };
  const previousOverlayValues = {
    'header.title': 'Domande frequenti',
    'header.subtitleHtml': 'Risposte rapide',
    'cta.label': 'Prenota ora',
    'sections.0.title': 'Camere',
    'sections.0.faqs.0.question': 'Che stanze offrite?',
    'sections.0.faqs.0.answer': 'Offriamo suite.',
  };
  const sanfranciscoBodies: Array<Record<string, any>> = [];
  const tokyoWrites: Array<Record<string, any>> = [];
  const originalFetch = globalThis.fetch;
  const originalBerlin = process.env.BERLIN_BASE_URL;
  const originalSanfrancisco = process.env.SANFRANCISCO_BASE_URL;
  const originalGrantSecret = process.env.AI_GRANT_HMAC_SECRET;
  const originalContext = (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];

  process.env.BERLIN_BASE_URL = 'https://berlin.test';
  process.env.SANFRANCISCO_BASE_URL = 'https://sanfrancisco.test';
  process.env.AI_GRANT_HMAC_SECRET = 'test-secret';

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.origin === 'https://berlin.test') {
      return jsonResponse({
        account: {
          l10nLocales: ['en', 'it'],
          l10nPolicy: {
            v: 1,
            baseLocale: 'en',
            ip: { countryToLocale: { IT: 'it' } },
          },
        },
      });
    }
    if (url.origin === 'https://sanfrancisco.test') {
      const body = JSON.parse(String(init?.body ?? '{}'));
      sanfranciscoBodies.push(body);
      return jsonResponse({
        v: 1,
        values: {
          'sections.0.faqs.0.answer': 'Offriamo suite e camere standard.',
        },
      });
    }
    return jsonResponse({ error: { reasonKey: 'unexpected_fetch', detail: url.toString() } }, 500);
  };

  (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = {
    env: {
      TOKYO_PRODUCT_CONTROL: {
        async fetch(input: RequestInfo | URL, init?: RequestInit) {
          const url = new URL(String(input));
          const body = init?.body ? JSON.parse(String(init.body)) : null;
          if (url.pathname === '/__internal/renders/widgets/catalog.json') {
            return jsonResponse(widgetsManifest);
          }
          if (url.pathname === '/__internal/overlays/languages/list.json') {
            return jsonResponse({
              v: 1,
              baseLocale: body?.baseLocale ?? 'en',
              overlays: [{ locale: 'it', overlayId: PREVIOUS_OVERLAY_ID }],
            });
          }
          if (url.pathname === `/__internal/overlays/${PREVIOUS_OVERLAY_ID}.json`) {
            return jsonResponse({
              v: 1,
              overlayId: PREVIOUS_OVERLAY_ID,
              values: previousOverlayValues,
            });
          }
          if (url.pathname === '/__internal/overlays/languages/write.json') {
            tokyoWrites.push(body);
            return jsonResponse({ overlayId: NEXT_OVERLAY_ID });
          }
          return jsonResponse({ error: { reasonKey: 'unexpected_tokyo_path', detail: url.pathname } }, 500);
        },
      },
    },
  };

  try {
    const result = await runInstanceTranslationFollowupAfterSave({
      authz: authz(),
      accessToken: 'access-token',
      accountCapsule: 'capsule',
      accountPublicId: ACCOUNT_PUBLIC_ID,
      instanceId: INSTANCE_ID,
      widgetType: 'faq',
      config: currentConfig,
      previousConfig,
      requestId: 'req_103d',
    });

    assert.deepEqual(result, {
      ok: true,
      baseLocale: 'en',
      results: [{ locale: 'it', ok: true, overlayId: NEXT_OVERLAY_ID }],
    });
    assert.equal(sanfranciscoBodies.length, 1);
    assert.deepEqual(sanfranciscoBodies[0]?.currentSavedTextGraph, [
      {
        path: 'sections.0.faqs.0.answer',
        type: 'richtext',
        label: 'FAQ answer',
        role: 'faq-answer',
        value: 'We offer suites and standard rooms.',
      },
    ]);
    assert.equal(tokyoWrites.length, 1);
    assert.deepEqual(tokyoWrites[0]?.values, {
      ...previousOverlayValues,
      'sections.0.faqs.0.answer': 'Offriamo suite e camere standard.',
    });
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBerlin === undefined) delete process.env.BERLIN_BASE_URL;
    else process.env.BERLIN_BASE_URL = originalBerlin;
    if (originalSanfrancisco === undefined) delete process.env.SANFRANCISCO_BASE_URL;
    else process.env.SANFRANCISCO_BASE_URL = originalSanfrancisco;
    if (originalGrantSecret === undefined) delete process.env.AI_GRANT_HMAC_SECRET;
    else process.env.AI_GRANT_HMAC_SECRET = originalGrantSecret;
    if (originalContext === undefined) delete (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
    else (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = originalContext;
  }
});

test('Roma FAQ save follow-up fails instead of falling back when previous config is missing', async () => {
  const originalFetch = globalThis.fetch;
  const originalBerlin = process.env.BERLIN_BASE_URL;
  const originalGrantSecret = process.env.AI_GRANT_HMAC_SECRET;
  const originalContext = (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
  const tokyoWrites: Array<Record<string, any>> = [];

  process.env.BERLIN_BASE_URL = 'https://berlin.test';
  process.env.AI_GRANT_HMAC_SECRET = 'test-secret';
  globalThis.fetch = async () =>
    jsonResponse({
      account: {
        l10nLocales: ['en', 'it'],
        l10nPolicy: {
          v: 1,
          baseLocale: 'en',
          ip: { countryToLocale: { IT: 'it' } },
        },
      },
    });

  (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = {
    env: {
      TOKYO_PRODUCT_CONTROL: {
        async fetch(input: RequestInfo | URL, init?: RequestInit) {
          const url = new URL(String(input));
          if (url.pathname === '/__internal/renders/widgets/catalog.json') {
            return jsonResponse(widgetsManifest);
          }
          if (url.pathname === '/__internal/overlays/languages/write.json') {
            tokyoWrites.push(init?.body ? JSON.parse(String(init.body)) : {});
            return jsonResponse({ overlayId: NEXT_OVERLAY_ID });
          }
          return jsonResponse({ error: { reasonKey: 'unexpected_tokyo_path', detail: url.pathname } }, 500);
        },
      },
    },
  };

  try {
    const result = await runInstanceTranslationFollowupAfterSave({
      authz: authz(),
      accessToken: 'access-token',
      accountCapsule: 'capsule',
      accountPublicId: ACCOUNT_PUBLIC_ID,
      instanceId: INSTANCE_ID,
      widgetType: 'faq',
      config: {
        header: { title: 'FAQs', subtitleHtml: 'Quick answers' },
        cta: { label: 'Book now' },
        sections: [],
      },
      previousConfig: null,
      requestId: 'req_103d_missing_previous',
    });

    assert.deepEqual(result, {
      ok: false,
      baseLocale: 'en',
      results: [
        {
          locale: 'it',
          ok: false,
          reasonKey: 'instance.translation.previous_config_missing',
          detail: 'previous saved FAQ config is required for changed-field translation',
        },
      ],
    });
    assert.deepEqual(tokyoWrites, []);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBerlin === undefined) delete process.env.BERLIN_BASE_URL;
    else process.env.BERLIN_BASE_URL = originalBerlin;
    if (originalGrantSecret === undefined) delete process.env.AI_GRANT_HMAC_SECRET;
    else process.env.AI_GRANT_HMAC_SECRET = originalGrantSecret;
    if (originalContext === undefined) delete (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
    else (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = originalContext;
  }
});

test('Roma generate translations translates all current FAQ fields without previous config', async () => {
  const currentConfig = {
    header: { title: 'FAQs', subtitleHtml: 'Quick answers' },
    cta: { label: 'Book now' },
    sections: [
      {
        id: 'rooms',
        title: 'Rooms',
        faqs: [
          {
            id: 'room-types',
            question: 'What rooms do you offer?',
            answer: 'We offer suites.',
          },
        ],
      },
    ],
  };
  const translatedValues = {
    'header.title': 'Domande frequenti',
    'header.subtitleHtml': 'Risposte rapide',
    'cta.label': 'Prenota ora',
    'sections.0.title': 'Camere',
    'sections.0.faqs.0.question': 'Che stanze offrite?',
    'sections.0.faqs.0.answer': 'Offriamo suite.',
  };
  const sanfranciscoBodies: Array<Record<string, any>> = [];
  const tokyoWrites: Array<Record<string, any>> = [];
  const originalFetch = globalThis.fetch;
  const originalBerlin = process.env.BERLIN_BASE_URL;
  const originalSanfrancisco = process.env.SANFRANCISCO_BASE_URL;
  const originalGrantSecret = process.env.AI_GRANT_HMAC_SECRET;
  const originalContext = (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];

  process.env.BERLIN_BASE_URL = 'https://berlin.test';
  process.env.SANFRANCISCO_BASE_URL = 'https://sanfrancisco.test';
  process.env.AI_GRANT_HMAC_SECRET = 'test-secret';

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    if (url.origin === 'https://berlin.test') {
      return jsonResponse({
        account: {
          l10nLocales: ['en', 'it'],
          l10nPolicy: {
            v: 1,
            baseLocale: 'en',
            ip: { countryToLocale: { IT: 'it' } },
          },
        },
      });
    }
    if (url.origin === 'https://sanfrancisco.test') {
      const body = JSON.parse(String(init?.body ?? '{}'));
      sanfranciscoBodies.push(body);
      return jsonResponse({
        v: 1,
        values: translatedValues,
      });
    }
    return jsonResponse({ error: { reasonKey: 'unexpected_fetch', detail: url.toString() } }, 500);
  };

  (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = {
    env: {
      TOKYO_PRODUCT_CONTROL: {
        async fetch(input: RequestInfo | URL, init?: RequestInit) {
          const url = new URL(String(input));
          const body = init?.body ? JSON.parse(String(init.body)) : null;
          if (url.pathname === '/__internal/renders/widgets/catalog.json') {
            return jsonResponse(widgetsManifest);
          }
          if (url.pathname === '/__internal/overlays/languages/list.json') {
            return jsonResponse({
              v: 1,
              baseLocale: body?.baseLocale ?? 'en',
              overlays: [],
            });
          }
          if (url.pathname === '/__internal/overlays/languages/write.json') {
            tokyoWrites.push(body);
            return jsonResponse({ overlayId: NEXT_OVERLAY_ID });
          }
          return jsonResponse({ error: { reasonKey: 'unexpected_tokyo_path', detail: url.pathname } }, 500);
        },
      },
    },
  };

  try {
    const result = await runInstanceTranslationFollowupAfterSave({
      authz: authz(),
      accessToken: 'access-token',
      accountCapsule: 'capsule',
      accountPublicId: ACCOUNT_PUBLIC_ID,
      instanceId: INSTANCE_ID,
      widgetType: 'faq',
      config: currentConfig,
      previousConfig: null,
      translateAllCurrentFields: true,
      requestId: 'req_103_generate',
    });

    assert.deepEqual(result, {
      ok: true,
      baseLocale: 'en',
      results: [{ locale: 'it', ok: true, overlayId: NEXT_OVERLAY_ID }],
    });
    assert.equal(sanfranciscoBodies.length, 1);
    assert.deepEqual(
      sanfranciscoBodies[0]?.currentSavedTextGraph.map((item: Record<string, unknown>) => item.path),
      [
        'header.title',
        'header.subtitleHtml',
        'cta.label',
        'sections.0.title',
        'sections.0.faqs.0.question',
        'sections.0.faqs.0.answer',
      ],
    );
    assert.equal(tokyoWrites.length, 1);
    assert.deepEqual(tokyoWrites[0]?.values, translatedValues);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalBerlin === undefined) delete process.env.BERLIN_BASE_URL;
    else process.env.BERLIN_BASE_URL = originalBerlin;
    if (originalSanfrancisco === undefined) delete process.env.SANFRANCISCO_BASE_URL;
    else process.env.SANFRANCISCO_BASE_URL = originalSanfrancisco;
    if (originalGrantSecret === undefined) delete process.env.AI_GRANT_HMAC_SECRET;
    else process.env.AI_GRANT_HMAC_SECRET = originalGrantSecret;
    if (originalContext === undefined) delete (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
    else (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = originalContext;
  }
});
