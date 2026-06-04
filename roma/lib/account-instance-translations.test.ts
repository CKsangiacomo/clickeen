import assert from 'node:assert/strict';
import test from 'node:test';
import {
  generateAccountInstanceTranslations,
  loadAccountInstanceTranslations,
  readAccountInstanceTranslationGeneration,
  readAccountInstanceTranslationValues,
  writeAccountInstanceTranslationValues,
} from './account-instance-translations';

const CLOUDFLARE_REQUEST_CONTEXT_SYMBOL = Symbol.for('__cloudflare-request-context__');
const ACCOUNT_PUBLIC_ID = 'A1B2C3D4';
const INSTANCE_ID = 'I1B2C3D4E5';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('loads translated locales without exposing storage identities', async () => {
  const originalContext = (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
  const tokyoReads: string[] = [];

  (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = {
    env: {
      TOKYO_PRODUCT_CONTROL: {
        async fetch(input: RequestInfo | URL) {
          const url = new URL(String(input));
          tokyoReads.push(url.pathname);
          if (url.pathname === `/__internal/instances/${INSTANCE_ID}/translations`) {
            return jsonResponse({
              ok: true,
              v: 1,
              baseLocale: 'en',
              translations: [{ locale: 'it' }],
            });
          }
          return jsonResponse({ error: { reasonKey: 'unexpected_tokyo_path', detail: url.pathname } }, 500);
        },
      },
    },
  };

  try {
    const result = await loadAccountInstanceTranslations({
      accountId: ACCOUNT_PUBLIC_ID,
      instanceId: INSTANCE_ID,
      accountCapsule: 'capsule',
      requestId: 'req_translations_list',
    });

    assert.deepEqual(result, {
      ok: true,
      value: {
        v: 1,
        baseLocale: 'en',
        translations: [{ locale: 'it' }],
      },
    });
    assert.deepEqual(tokyoReads, [`/__internal/instances/${INSTANCE_ID}/translations`]);
  } finally {
    if (originalContext === undefined) delete (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
    else (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = originalContext;
  }
});

test('generates translations through one Tokyo product operation', async () => {
  const originalContext = (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
  const tokyoWrites: Array<{ path: string; body: Record<string, unknown> | null }> = [];

  (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = {
    env: {
      TOKYO_PRODUCT_CONTROL: {
        async fetch(input: RequestInfo | URL, init?: RequestInit) {
          const url = new URL(String(input));
          const body = init?.body ? JSON.parse(String(init.body)) : null;
          tokyoWrites.push({ path: url.pathname, body });
          if (url.pathname === `/__internal/instances/${INSTANCE_ID}/translations/generate`) {
            return jsonResponse({
              ok: true,
              translation: {
                ok: true,
                accepted: true,
                baseLocale: 'en',
                targetLocales: ['it', 'cs'],
                skippedLocales: ['cs'],
                generation: {
                  v: 2,
                  instanceId: INSTANCE_ID,
                  baseLocale: 'en',
                  targetLocales: ['it', 'cs'],
                  status: 'queued',
                  active: true,
                  requestedAt: '2026-05-20T00:00:00.000Z',
                  updatedAt: '2026-05-20T00:00:00.000Z',
                  totalLocales: 2,
                  isCurrentBaseContent: true,
                  baseContentMarker: 'base-1',
                  generationRequestMarker: 'request-1',
                  locales: [
                    { locale: 'cs', state: 'inSync', reviewable: true },
                    { locale: 'it', state: 'generating', reviewable: false },
                  ],
                },
              },
            }, 202);
          }
          return jsonResponse({ error: { reasonKey: 'unexpected_tokyo_path', detail: url.pathname } }, 500);
        },
      },
    },
  };

  try {
    const result = await generateAccountInstanceTranslations({
      accountId: ACCOUNT_PUBLIC_ID,
      instanceId: INSTANCE_ID,
      baseLocale: 'en',
      targetLocales: ['it', 'cs'],
      accountCapsule: 'capsule',
      requestId: 'req_translation_generate',
    });

    assert.deepEqual(result, {
      ok: true,
      status: 202,
      value: {
        ok: true,
        translation: {
          ok: true,
          accepted: true,
          baseLocale: 'en',
          targetLocales: ['it', 'cs'],
          skippedLocales: ['cs'],
          generation: {
            v: 2,
            instanceId: INSTANCE_ID,
            baseLocale: 'en',
            targetLocales: ['it', 'cs'],
            status: 'queued',
            active: true,
            requestedAt: '2026-05-20T00:00:00.000Z',
            updatedAt: '2026-05-20T00:00:00.000Z',
            totalLocales: 2,
            isCurrentBaseContent: true,
            baseContentMarker: 'base-1',
            generationRequestMarker: 'request-1',
            locales: [
              { locale: 'cs', state: 'inSync', reviewable: true },
              { locale: 'it', state: 'generating', reviewable: false },
            ],
          },
        },
      },
    });
    assert.deepEqual(tokyoWrites, [
      {
        path: `/__internal/instances/${INSTANCE_ID}/translations/generate`,
        body: { baseLocale: 'en', targetLocales: ['it', 'cs'] },
      },
    ]);
  } finally {
    if (originalContext === undefined) delete (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
    else (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = originalContext;
  }
});

test('reads translation generation state through one Tokyo product operation', async () => {
  const originalContext = (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
  const tokyoReads: string[] = [];

  (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = {
    env: {
      TOKYO_PRODUCT_CONTROL: {
        async fetch(input: RequestInfo | URL) {
          const url = new URL(String(input));
          tokyoReads.push(url.pathname);
          if (url.pathname === `/__internal/instances/${INSTANCE_ID}/translations/generation`) {
            return jsonResponse({
              ok: true,
              generation: {
                v: 2,
                instanceId: INSTANCE_ID,
                baseLocale: 'en',
                targetLocales: ['it', 'cs'],
                status: 'running',
                active: true,
                requestedAt: '2026-05-20T00:00:00.000Z',
                updatedAt: '2026-05-20T00:00:03.000Z',
                totalLocales: 2,
                isCurrentBaseContent: true,
                baseContentMarker: 'base-1',
                generationRequestMarker: 'request-1',
                locales: [
                  { locale: 'cs', state: 'generating', reviewable: false },
                  { locale: 'it', state: 'inSync', reviewable: true },
                ],
              },
            });
          }
          return jsonResponse({ error: { reasonKey: 'unexpected_tokyo_path', detail: url.pathname } }, 500);
        },
      },
    },
  };

  try {
    const result = await readAccountInstanceTranslationGeneration({
      accountId: ACCOUNT_PUBLIC_ID,
      instanceId: INSTANCE_ID,
      accountCapsule: 'capsule',
      requestId: 'req_translation_generation_read',
    });

    assert.deepEqual(result, {
      ok: true,
      value: {
        ok: true,
        generation: {
          v: 2,
          instanceId: INSTANCE_ID,
          baseLocale: 'en',
          targetLocales: ['it', 'cs'],
          status: 'running',
          active: true,
          requestedAt: '2026-05-20T00:00:00.000Z',
          updatedAt: '2026-05-20T00:00:03.000Z',
          totalLocales: 2,
          isCurrentBaseContent: true,
          baseContentMarker: 'base-1',
          generationRequestMarker: 'request-1',
          locales: [
            { locale: 'cs', state: 'generating', reviewable: false },
            { locale: 'it', state: 'inSync', reviewable: true },
          ],
        },
      },
    });
    assert.deepEqual(tokyoReads, [`/__internal/instances/${INSTANCE_ID}/translations/generation`]);
  } finally {
    if (originalContext === undefined) delete (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
    else (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = originalContext;
  }
});

test('reads v2 translation generation product state without legacy queue arrays', async () => {
  const originalContext = (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];

  (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = {
    env: {
      TOKYO_PRODUCT_CONTROL: {
        async fetch(input: RequestInfo | URL) {
          const url = new URL(String(input));
          if (url.pathname === `/__internal/instances/${INSTANCE_ID}/translations/generation`) {
            return jsonResponse({
              ok: true,
              generation: {
                v: 2,
                instanceId: INSTANCE_ID,
                baseLocale: 'en',
                targetLocales: ['it'],
                status: 'completed',
                active: false,
                requestedAt: '2026-05-20T00:00:00.000Z',
                updatedAt: '2026-05-20T00:00:03.000Z',
                totalLocales: 1,
                isCurrentBaseContent: true,
                baseContentMarker: 'base-1',
                generationRequestMarker: 'request-1',
                locales: [
                  { locale: 'it', state: 'inSync', reviewable: true },
                ],
              },
            });
          }
          return jsonResponse({ error: { reasonKey: 'unexpected_tokyo_path', detail: url.pathname } }, 500);
        },
      },
    },
  };

  try {
    const result = await readAccountInstanceTranslationGeneration({
      accountId: ACCOUNT_PUBLIC_ID,
      instanceId: INSTANCE_ID,
      accountCapsule: 'capsule',
      requestId: 'req_translation_generation_v2_read',
    });

    assert.deepEqual(result, {
      ok: true,
      value: {
        ok: true,
        generation: {
          v: 2,
          instanceId: INSTANCE_ID,
          baseLocale: 'en',
          targetLocales: ['it'],
          status: 'completed',
          active: false,
          requestedAt: '2026-05-20T00:00:00.000Z',
          updatedAt: '2026-05-20T00:00:03.000Z',
          totalLocales: 1,
          isCurrentBaseContent: true,
          baseContentMarker: 'base-1',
          generationRequestMarker: 'request-1',
          locales: [
            { locale: 'it', state: 'inSync', reviewable: true },
          ],
        },
      },
    });
  } finally {
    if (originalContext === undefined) delete (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
    else (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = originalContext;
  }
});

test('reads and writes translated locale values by locale', async () => {
  const originalContext = (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
  const tokyoWrites: Array<Record<string, any>> = [];

  (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = {
    env: {
      TOKYO_PRODUCT_CONTROL: {
        async fetch(input: RequestInfo | URL, init?: RequestInit) {
          const url = new URL(String(input));
          const body = init?.body ? JSON.parse(String(init.body)) : null;
          if (url.pathname === `/__internal/instances/${INSTANCE_ID}/translations/it` && init?.method === 'GET') {
            return jsonResponse({
              ok: true,
              v: 1,
              locale: 'it',
              values: {
                'header.title': 'Domande frequenti',
              },
            });
          }
          if (url.pathname === `/__internal/instances/${INSTANCE_ID}/translations/it` && init?.method === 'PUT') {
            tokyoWrites.push(body);
            return jsonResponse({ ok: true, v: 1, locale: 'it' });
          }
          return jsonResponse({ error: { reasonKey: 'unexpected_tokyo_path', detail: url.pathname } }, 500);
        },
      },
    },
  };

  try {
    const read = await readAccountInstanceTranslationValues({
      accountId: ACCOUNT_PUBLIC_ID,
      instanceId: INSTANCE_ID,
      locale: 'it',
      accountCapsule: 'capsule',
      requestId: 'req_translation_read',
    });
    assert.deepEqual(read, {
      ok: true,
      value: {
        v: 1,
        locale: 'it',
        values: {
          'header.title': 'Domande frequenti',
        },
      },
    });

    const values = {
      'header.title': 'Domande frequenti aggiornate',
    };
    const write = await writeAccountInstanceTranslationValues({
      accountId: ACCOUNT_PUBLIC_ID,
      instanceId: INSTANCE_ID,
      locale: 'it',
      values,
      accountCapsule: 'capsule',
      requestId: 'req_translation_write',
    });

    assert.deepEqual(write, { ok: true, value: { locale: 'it' } });
    assert.deepEqual(tokyoWrites, [{ values }]);
  } finally {
    if (originalContext === undefined) delete (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
    else (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = originalContext;
  }
});
