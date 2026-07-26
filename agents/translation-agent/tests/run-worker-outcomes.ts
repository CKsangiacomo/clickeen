import assert from 'node:assert/strict';
import worker from '../src/worker';

const SECRET = 'translation-agent-outcome-test-secret';
const REQUESTED_LOCALES = ['fr', 'de', 'it'];

function base64Url(value: Uint8Array | string): string {
  const bytes = typeof value === 'string' ? Buffer.from(value) : Buffer.from(value);
  return bytes.toString('base64url');
}

async function createGrant(): Promise<string> {
  const payload = {
    iss: 'roma',
    exp: Math.floor(Date.now() / 1000) + 60,
    caps: ['agent:widget.instance.translator'],
    ai: { agentId: 'widget.instance.translator' },
    trace: {
      accountPublicId: 'CLICKEEN',
      instanceId: 'UZ3JEJSHII',
      activeLocales: REQUESTED_LOCALES,
    },
  };
  const payloadB64 = base64Url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`ckgrant.${payloadB64}`)),
  );
  return `ckgrant.${payloadB64}.${base64Url(signature)}`;
}

async function run(): Promise<void> {
  const writtenLocales: string[] = [];
  const response = await worker.fetch(
    new Request('https://translation-agent.test/translate-instance', {
      method: 'POST',
      headers: {
        accept: 'text/event-stream',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        grant: await createGrant(),
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
      AI_GRANT_HMAC_SECRET: SECRET,
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
          return Response.json({
            content: JSON.stringify(
              items.map((item) => ({
                path: item.path,
                value: `${item.value} ${request.trace.locale}`,
              })),
            ),
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
