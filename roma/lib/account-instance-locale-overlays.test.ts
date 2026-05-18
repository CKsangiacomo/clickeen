import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_OVERLAY_EXPERIMENT,
  DEFAULT_OVERLAY_PERSONALIZATION,
  buildOverlayId,
} from '@clickeen/ck-contracts/overlay-identity';
import { writeAccountInstanceLocaleOverlayValues } from './account-instance-locale-overlays';

const CLOUDFLARE_REQUEST_CONTEXT_SYMBOL = Symbol.for('__cloudflare-request-context__');
const ACCOUNT_PUBLIC_ID = 'A1B2C3D4';
const INSTANCE_ID = 'I1B2C3D4E5';
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

test('manual locale overlay write resolves active widget and writes full current language values', async () => {
  const originalContext = (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
  const tokyoWrites: Array<Record<string, any>> = [];

  (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = {
    env: {
      TOKYO_PRODUCT_CONTROL: {
        async fetch(input: RequestInfo | URL, init?: RequestInit) {
          const url = new URL(String(input));
          const body = init?.body ? JSON.parse(String(init.body)) : null;
          if (url.pathname === `/__internal/renders/widgets/${INSTANCE_ID}/saved.json`) {
            return jsonResponse({
              accountId: ACCOUNT_PUBLIC_ID,
              instanceId: INSTANCE_ID,
              widgetType: 'faq',
              displayName: 'FAQ',
              updatedAt: '2026-05-18T00:00:00.000Z',
              publishStatus: 'unpublished',
              config: {
                header: { title: 'FAQs', subtitleHtml: 'Quick answers' },
                cta: { label: 'Contact us' },
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
              },
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
    const values = {
      'header.title': 'Domande frequenti',
      'header.subtitleHtml': 'Risposte rapide',
      'cta.label': 'Contattaci',
      'sections.0.title': 'Camere',
      'sections.0.faqs.0.question': 'Che stanze offrite?',
      'sections.0.faqs.0.answer': 'Offriamo suite e camere familiari.',
    };
    const result = await writeAccountInstanceLocaleOverlayValues({
      accountId: ACCOUNT_PUBLIC_ID,
      instanceId: INSTANCE_ID,
      locale: 'it',
      values,
      accountCapsule: 'capsule',
      requestId: 'req_103f',
    });

    assert.deepEqual(result, { ok: true, value: { overlayId: NEXT_OVERLAY_ID } });
    assert.equal(tokyoWrites.length, 1);
    assert.deepEqual(tokyoWrites[0], {
      instanceId: INSTANCE_ID,
      widgetType: 'faq',
      languageCode: 'IT00',
      values,
    });
  } finally {
    if (originalContext === undefined) delete (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
    else (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = originalContext;
  }
});
