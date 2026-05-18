import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_OVERLAY_EXPERIMENT,
  DEFAULT_OVERLAY_PERSONALIZATION,
  buildOverlayId,
} from '@clickeen/ck-contracts/overlay-identity';
import type { InstanceTranslationJob } from '@clickeen/ck-contracts/instance-translation-jobs';
import type { RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';
import widgetsManifest from '../../tokyo/product/widgets/manifest.json';
import { acceptInstanceTranslationJobs } from './account-instance-translation-jobs';

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

function previousConfig() {
  return {
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
}

function installFetchAndContext(args: {
  locales: string[];
  overlays: Array<{ locale: string; overlayId: string }>;
  overlayValues?: Record<string, string>;
  queue: InstanceTranslationJob[];
}) {
  const originalFetch = globalThis.fetch;
  const originalBerlin = process.env.BERLIN_BASE_URL;
  const originalSanfrancisco = process.env.SANFRANCISCO_BASE_URL;
  const originalGrantSecret = process.env.AI_GRANT_HMAC_SECRET;
  const originalContext = (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];

  process.env.BERLIN_BASE_URL = 'https://berlin.test';
  process.env.SANFRANCISCO_BASE_URL = 'https://sanfrancisco.test';
  process.env.AI_GRANT_HMAC_SECRET = 'test-secret';

  globalThis.fetch = async (input: RequestInfo | URL) => {
    const url = new URL(String(input));
    if (url.origin === 'https://berlin.test') {
      return jsonResponse({
        account: {
          l10nLocales: args.locales,
          l10nPolicy: {
            v: 1,
            baseLocale: 'en',
            ip: { countryToLocale: { IT: 'it', CZ: 'cs' } },
          },
        },
      });
    }
    if (url.origin === 'https://sanfrancisco.test' && url.pathname === '/v1/agents/instance-translation/runtime-status') {
      return jsonResponse({ ok: true, provider: 'deepseek', model: 'deepseek-chat' });
    }
    return jsonResponse({ error: { reasonKey: 'unexpected_fetch', detail: url.toString() } }, 500);
  };

  (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = {
    env: {
      INSTANCE_TRANSLATION_JOBS: {
        async send(job: InstanceTranslationJob) {
          args.queue.push(job);
        },
      },
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
              overlays: args.overlays,
            });
          }
          if (url.pathname === `/__internal/overlays/${PREVIOUS_OVERLAY_ID}.json`) {
            return jsonResponse({
              v: 1,
              overlayId: PREVIOUS_OVERLAY_ID,
              values: args.overlayValues ?? {},
            });
          }
          return jsonResponse({ error: { reasonKey: 'unexpected_tokyo_path', detail: url.pathname } }, 500);
        },
      },
    },
  };

  return () => {
    globalThis.fetch = originalFetch;
    if (originalBerlin === undefined) delete process.env.BERLIN_BASE_URL;
    else process.env.BERLIN_BASE_URL = originalBerlin;
    if (originalSanfrancisco === undefined) delete process.env.SANFRANCISCO_BASE_URL;
    else process.env.SANFRANCISCO_BASE_URL = originalSanfrancisco;
    if (originalGrantSecret === undefined) delete process.env.AI_GRANT_HMAC_SECRET;
    else process.env.AI_GRANT_HMAC_SECRET = originalGrantSecret;
    if (originalContext === undefined) delete (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
    else (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = originalContext;
  };
}

test('Roma save accepts a durable translation job for changed FAQ fields only', async () => {
  const before = previousConfig();
  const after = previousConfig();
  after.sections[0].faqs[0].answer = 'We offer suites and standard rooms.';
  const queued: InstanceTranslationJob[] = [];
  const cleanup = installFetchAndContext({
    locales: ['en', 'it'],
    overlays: [{ locale: 'it', overlayId: PREVIOUS_OVERLAY_ID }],
    overlayValues: {
      'header.title': 'Domande frequenti',
      'header.subtitleHtml': 'Risposte rapide',
      'cta.label': 'Prenota ora',
      'sections.0.title': 'Camere',
      'sections.0.faqs.0.question': 'Che stanze offrite?',
      'sections.0.faqs.0.answer': 'Offriamo suite.',
    },
    queue: queued,
  });

  try {
    const result = await acceptInstanceTranslationJobs({
      authz: authz(),
      accessToken: 'access-token',
      accountCapsule: 'capsule',
      accountPublicId: ACCOUNT_PUBLIC_ID,
      instanceId: INSTANCE_ID,
      widgetType: 'faq',
      config: after,
      previousConfig: before,
      sourceVersion: 2,
      requestId: 'req_queue_save',
    });

    assert.equal(result.ok, true);
    assert.equal(result.ok ? result.accepted : false, true);
    assert.equal(queued.length, 1);
    assert.equal(queued[0]?.sourceVersion, 2);
    assert.equal(queued[0]?.targetLocale, 'it');
    assert.deepEqual(
      queued[0]?.changedFields.map((field) => field.identity.path),
      ['sections.0.faqs.0.answer'],
    );
    assert.equal(queued[0]?.previousLanguageValues.length, 6);
  } finally {
    cleanup();
  }
});

test('Roma generate accepts jobs for every missing target locale without awaiting translation', async () => {
  const queued: InstanceTranslationJob[] = [];
  const cleanup = installFetchAndContext({
    locales: ['en', 'it', 'cs'],
    overlays: [],
    queue: queued,
  });

  try {
    const result = await acceptInstanceTranslationJobs({
      authz: authz(),
      accessToken: 'access-token',
      accountCapsule: 'capsule',
      accountPublicId: ACCOUNT_PUBLIC_ID,
      instanceId: INSTANCE_ID,
      widgetType: 'faq',
      config: previousConfig(),
      previousConfig: null,
      sourceVersion: 1,
      translateAllCurrentFields: true,
      skipReadyLocales: true,
      requestId: 'req_queue_generate',
    });

    assert.equal(result.ok, true);
    assert.deepEqual(queued.map((job) => job.targetLocale).sort(), ['cs', 'it']);
    assert.equal(queued[0]?.changedFields.length, 6);
    assert.equal(queued[1]?.changedFields.length, 6);
  } finally {
    cleanup();
  }
});
