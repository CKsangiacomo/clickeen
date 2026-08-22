import assert from 'node:assert/strict';
import { readWidgetMaterializerArtifact } from '../generated/widget-materializer-artifacts';

const CLOUDFLARE_REQUEST_CONTEXT_SYMBOL = Symbol.for('__cloudflare-request-context__');

async function main(): Promise<void> {
  const globalRecord = globalThis as Record<PropertyKey, unknown>;
  const previous = globalRecord[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
  const requests: string[] = [];
  const exactArtifact = {
    widgetname: 'faq',
    displayName: 'FAQ',
    discovery: { widgetType: 'faq' },
    editableFields: { widgetType: 'faq', fields: [] },
    coreDefaults: {},
    widgetSoftware: { widgetHtml: '', coreHtml: '', styles: [], scripts: [] },
  };

  assert.equal(await readWidgetMaterializerArtifact('unknown-widget'), null);
  assert.equal(await readWidgetMaterializerArtifact('toString'), null);

  globalRecord[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = {
    env: {
      ASSETS: {
        async fetch(input: RequestInfo | URL) {
          const url = new URL(input instanceof Request ? input.url : input.toString());
          requests.push(url.pathname);
          if (url.pathname === '/widget-materializers/faq.json') {
            return Response.json(exactArtifact);
          }
          return new Response(null, { status: 503 });
        },
      },
    },
  };

  try {
    assert.deepEqual(await readWidgetMaterializerArtifact('faq'), exactArtifact);
    assert.deepEqual(requests, ['/widget-materializers/faq.json']);

    await assert.rejects(
      readWidgetMaterializerArtifact('cards'),
      /roma\.widgetMaterializer\.assetUnavailable:\/widget-materializers\/cards\.json:503/,
    );
    assert.deepEqual(requests, [
      '/widget-materializers/faq.json',
      '/widget-materializers/cards.json',
    ]);
  } finally {
    if (previous === undefined) delete globalRecord[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
    else globalRecord[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = previous;
  }

  console.log('PASS Roma reads one exact deploy-built Widget materializer asset');
}

void main();
