import assert from 'node:assert/strict';
import { mintRomaAiGrant } from '@clickeen/ck-policy';
import worker from '../src/worker';

const REQUESTED_LOCALES = ['fr', 'de', 'it'];

async function createGrant(privateKeyPem: string): Promise<string> {
  return await mintRomaAiGrant({
    iss: 'roma',
    exp: Math.floor(Date.now() / 1000) + 60,
    caps: ['agent:widget.instance.translator'],
    ai: { agentId: 'widget.instance.translator' },
    trace: {
      accountPublicId: 'CLICKEEN',
      instanceId: 'UZ3JEJSHII',
      activeLocales: REQUESTED_LOCALES,
    },
  }, privateKeyPem);
}

async function run(): Promise<void> {
  const keys = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  const privateKeyBody = Buffer.from(await crypto.subtle.exportKey('pkcs8', keys.privateKey))
    .toString('base64').match(/.{1,64}/g)?.join('\n') || '';
  const publicKeyBody = Buffer.from(await crypto.subtle.exportKey('spki', keys.publicKey))
    .toString('base64').match(/.{1,64}/g)?.join('\n') || '';
  const privateKeyPem = `-----BEGIN PRIVATE KEY-----\n${privateKeyBody}\n-----END PRIVATE KEY-----`;
  const publicKeyPem = `-----BEGIN PUBLIC KEY-----\n${publicKeyBody}\n-----END PUBLIC KEY-----`;
  const writtenLocales: string[] = [];
  const response = await worker.fetch(
    new Request('https://translation-agent.test/translate-instance', {
      method: 'POST',
      headers: {
        accept: 'text/event-stream',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        grant: await createGrant(privateKeyPem),
        agentId: 'widget.instance.translator',
        accountPublicId: 'CLICKEEN',
        instanceId: 'UZ3JEJSHII',
        widgetType: 'faq',
        baseLocale: 'en',
        requestedLocales: REQUESTED_LOCALES,
        items: [{ path: 'header.title', type: 'string', value: 'Frequently asked questions' }],
      }),
    }),
    {
      ROMA_AI_GRANT_PUBLIC_KEY_PEM: publicKeyPem,
      SANFRANCISCO_AI_ENGINE: {
        async fetch(_input: RequestInfo | URL, init?: RequestInit) {
          const request = JSON.parse(String(init?.body)) as {
            trace: { locale: string };
            messages: Array<{ content: string }>;
          };
          if (request.trace.locale === 'de') {
            return Response.json(
              {
                error: {
                  code: 'PROVIDER_ERROR',
                  reasonKey: 'coreui.errors.translation.providerFailed',
                  message: 'German provider failure',
                },
              },
              { status: 502 },
            );
          }
          const items = JSON.parse(request.messages.at(-1)?.content.split('\n').at(-1) ?? '[]') as Array<{
            path: string;
            value: string;
          }>;
          // PRD 128E: /model/turn structured-mode response shape.
          // The output matches the TRANSLATION_OUTPUT_SCHEMA.
          return Response.json({
            ok: true,
            version: 1,
            modelStepId: crypto.randomUUID(),
            output: {
              translations: items.map((item) => ({
                path: item.path,
                value: `${item.value} ${request.trace.locale}`,
              })),
            },
            finish: {
              finishReason: 'stop',
              requestedProvider: 'openai',
              requestedModel: 'gpt-5.2',
              reportedModel: 'gpt-5.2-2025-12-11',
              promptTokens: 10,
              completionTokens: 5,
              latencyMs: 100,
            },
          });
        },
      },
      TOKYO_PRODUCT_CONTROL: {
        async fetch(input: RequestInfo | URL) {
          const locale = decodeURIComponent(new URL(String(input)).pathname.split('/').at(-1) ?? '');
          writtenLocales.push(locale);
          return Response.json({ ok: true, locale });
        },
      },
    } as never,
  );

  assert.equal(response.status, 200);
  const streamText = await response.text();
  const resultEvent = streamText
    .split('\n\n')
    .find((event) => event.startsWith('event: result\n'));
  assert.ok(resultEvent);
  const resultData = resultEvent
    .split('\n')
    .find((line) => line.startsWith('data: '))
    ?.slice('data: '.length);
  assert.ok(resultData);
  const result = JSON.parse(resultData) as {
    status: number;
    payload: {
      translation: {
        ok: boolean;
        requestedLocales: string[];
        results: Array<{ locale: string; ok: boolean; reasonKey?: string }>;
      };
    };
  };
  assert.equal(result.status, 200);
  const payload = result.payload;
  assert.equal(payload.translation.ok, false);
  assert.deepEqual(payload.translation.requestedLocales, REQUESTED_LOCALES);
  assert.deepEqual(
    payload.translation.results.map((result) => result.locale),
    REQUESTED_LOCALES,
  );
  assert.deepEqual(
    payload.translation.results.map((result) => result.ok),
    [true, false, true],
  );
  assert.equal(
    payload.translation.results[1]?.reasonKey,
    'coreui.errors.translation.providerFailed',
  );
  assert.deepEqual(writtenLocales.sort(), ['fr', 'it']);

  console.log('translation-agent worker outcomes: ok');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
