import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAccountInstanceInTokyo,
  deleteAccountInstanceFromTokyo,
  duplicateAccountInstanceInTokyo,
  listAccountInstancesInTokyo,
  loadTokyoAccountInstanceDocument,
  publishAccountInstanceInTokyo,
  renameAccountInstanceInTokyo,
  saveAccountInstanceInTokyo,
  unpublishAccountInstanceInTokyo,
} from './account-instance-direct';

const CLOUDFLARE_REQUEST_CONTEXT_SYMBOL = Symbol.for('__cloudflare-request-context__');
const ACCOUNT_PUBLIC_ID = 'A1B2C3D4';
const INSTANCE_ID = 'I1B2C3D4E5';
const PAGE_ID = 'P1B2C3D4E5';

function publicPackage(instanceId = INSTANCE_ID) {
  return {
    v: 1 as const,
    indexHtml: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="./styles.css" />
  </head>
  <body>
    <div data-ck-widget="faq" data-role="root" data-ck-instance-id="${instanceId}">FAQ</div>
    <script src="./runtime.js" defer></script>
  </body>
</html>`,
    stylesCss: '.ck-faq{display:block}',
    runtimeJs: 'window.CK_WIDGETS = window.CK_WIDGETS || {};',
  };
}

function pageComposablePackage(instanceId = INSTANCE_ID) {
  return {
    v: 1 as const,
    indexHtml: `<!doctype html>
<html lang="en">
  <head>
    <link rel="stylesheet" href="./styles.css">
  </head>
  <body>
    <section data-ck-widget="faq" data-role="root" data-ck-instance-id="${instanceId}">FAQ</section>
    <script src="./runtime.js" defer></script>
  </body>
</html>`,
    stylesCss: `/* ck-style-module:faq */
.faq{display:block}
/* ck-style-module:end */`,
    runtimeJs: `/* ck-runtime-payload:start */
(function () {
  window.CK_WIDGETS = Object.assign({}, window.CK_WIDGETS || {});
  window.CK_WIDGETS["${instanceId}"] = { instanceId: "${instanceId}", state: {} };
})();
/* ck-runtime-payload:end */
/* ck-runtime-module:faq */
window.__CK_FAQ = window.__CK_FAQ || {};
/* ck-runtime-module:end */`,
  };
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('account instance helpers use product operations for lifecycle calls', async () => {
  const originalContext = (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
  const calls: Array<{ method: string; path: string; body: unknown }> = [];

  (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = {
    env: {
      TOKYO_PRODUCT_CONTROL: {
        async fetch(input: RequestInfo | URL, init?: RequestInit) {
          const url = new URL(String(input));
          const method = String(init?.method || 'GET').toUpperCase();
          const body = init?.body ? JSON.parse(String(init.body)) : null;
          calls.push({ method, path: url.pathname, body });

          if (url.pathname === `/__internal/accounts/${ACCOUNT_PUBLIC_ID}/instances` && method === 'GET') {
            return jsonResponse({
              ok: true,
              accountId: ACCOUNT_PUBLIC_ID,
              accountInstances: [
                {
                  accountId: ACCOUNT_PUBLIC_ID,
                  instanceId: INSTANCE_ID,
                  widgetCode: 'FAQ',
                  widgetType: 'faq',
                  displayName: 'FAQ',
                  publishStatus: 'unpublished',
                  updatedAt: '2026-05-19T00:00:00.000Z',
                },
              ],
              publishedCount: 0,
            });
          }
          if (url.pathname === '/__internal/instances' && method === 'POST') {
            return jsonResponse({
              ok: true,
              accountId: ACCOUNT_PUBLIC_ID,
              instanceId: INSTANCE_ID,
              widgetType: 'faq',
              displayName: 'FAQ',
              publishStatus: 'unpublished',
              updatedAt: '2026-05-19T00:00:00.000Z',
              config: { header: { title: 'FAQ' } },
            }, 201);
          }
          if (url.pathname === `/__internal/instances/${INSTANCE_ID}` && method === 'GET') {
            return jsonResponse({
              ok: true,
              accountId: ACCOUNT_PUBLIC_ID,
              instanceId: INSTANCE_ID,
              widgetType: 'faq',
              displayName: 'FAQ',
              publishStatus: 'unpublished',
              updatedAt: '2026-05-19T00:00:00.000Z',
              meta: null,
              config: { header: { title: 'FAQ' } },
            });
          }
          if (url.pathname === `/__internal/instances/${INSTANCE_ID}` && method === 'PUT') {
            return jsonResponse({
              ok: true,
              live: false,
            });
          }
          if (url.pathname === `/__internal/instances/${INSTANCE_ID}/pages` && method === 'GET') {
            return jsonResponse({
              ok: true,
              accountId: ACCOUNT_PUBLIC_ID,
              instanceId: INSTANCE_ID,
              pageIds: [],
            });
          }
          if (url.pathname === `/__internal/instances/${INSTANCE_ID}/rename` && method === 'POST') {
            return jsonResponse({
              ok: true,
              instanceId: INSTANCE_ID,
              displayName: 'Renamed FAQ',
            });
          }
          if (url.pathname === `/__internal/instances/${INSTANCE_ID}/publish` && method === 'POST') {
            return jsonResponse({
              ok: true,
              instanceId: INSTANCE_ID,
              status: 'published',
              changed: true,
            });
          }
          if (url.pathname === `/__internal/instances/${INSTANCE_ID}/unpublish` && method === 'POST') {
            return jsonResponse({
              ok: true,
              instanceId: INSTANCE_ID,
              status: 'unpublished',
              changed: true,
            });
          }
          if (url.pathname === `/__internal/instances/${INSTANCE_ID}/duplicate` && method === 'POST') {
            return jsonResponse({
              ok: true,
              accountId: ACCOUNT_PUBLIC_ID,
              sourceInstanceId: INSTANCE_ID,
              instanceId: 'D1B2C3D4E5',
              widgetType: 'faq',
              status: 'unpublished',
            }, 201);
          }
          if (url.pathname === `/__internal/instances/${INSTANCE_ID}` && method === 'DELETE') {
            return jsonResponse({
              ok: true,
              deleted: true,
              existed: true,
            });
          }

          return jsonResponse({ error: { reasonKey: 'unexpected_tokyo_path', detail: url.pathname } }, 500);
        },
      },
    },
  };

  try {
    assert.equal((await listAccountInstancesInTokyo({
      accountId: ACCOUNT_PUBLIC_ID,
      accountCapsule: 'capsule',
      requestId: 'req_list',
    })).ok, true);

    assert.equal((await createAccountInstanceInTokyo({
      accountId: ACCOUNT_PUBLIC_ID,
      accountCapsule: 'capsule',
      widgetType: 'faq',
      displayName: 'FAQ',
      requestId: 'req_create',
    })).ok, true);

    assert.equal((await loadTokyoAccountInstanceDocument({
      accountId: ACCOUNT_PUBLIC_ID,
      instanceId: INSTANCE_ID,
      accountCapsule: 'capsule',
      requestId: 'req_open',
    })).ok, true);

    const saved = await saveAccountInstanceInTokyo({
      accountId: ACCOUNT_PUBLIC_ID,
      instanceId: INSTANCE_ID,
      accountCapsule: 'capsule',
      widgetType: 'faq',
      config: { header: { title: 'FAQ' } },
      publicPackage: publicPackage(),
      requestId: 'req_save',
    });
    assert.deepEqual(saved, { ok: true, value: { live: false } });

    assert.deepEqual(await renameAccountInstanceInTokyo({
      accountId: ACCOUNT_PUBLIC_ID,
      instanceId: INSTANCE_ID,
      accountCapsule: 'capsule',
      displayName: 'Renamed FAQ',
      requestId: 'req_rename',
    }), {
      ok: true,
      value: {
        instanceId: INSTANCE_ID,
        displayName: 'Renamed FAQ',
      },
    });

    assert.deepEqual(await publishAccountInstanceInTokyo({
      accountId: ACCOUNT_PUBLIC_ID,
      instanceId: INSTANCE_ID,
      accountCapsule: 'capsule',
      requestId: 'req_publish',
    }), {
      ok: true,
      value: {
        instanceId: INSTANCE_ID,
        status: 'published',
        changed: true,
      },
    });

    assert.deepEqual(await unpublishAccountInstanceInTokyo({
      accountId: ACCOUNT_PUBLIC_ID,
      instanceId: INSTANCE_ID,
      accountCapsule: 'capsule',
      requestId: 'req_unpublish',
    }), {
      ok: true,
      value: {
        instanceId: INSTANCE_ID,
        status: 'unpublished',
        changed: true,
      },
    });

    assert.deepEqual(await duplicateAccountInstanceInTokyo({
      accountId: ACCOUNT_PUBLIC_ID,
      sourceInstanceId: INSTANCE_ID,
      accountCapsule: 'capsule',
      requestId: 'req_duplicate',
    }), {
      ok: true,
      value: {
        accountId: ACCOUNT_PUBLIC_ID,
        sourceInstanceId: INSTANCE_ID,
        instanceId: 'D1B2C3D4E5',
        widgetType: 'faq',
        status: 'unpublished',
      },
    });

    assert.deepEqual(await deleteAccountInstanceFromTokyo({
      accountId: ACCOUNT_PUBLIC_ID,
      instanceId: INSTANCE_ID,
      accountCapsule: 'capsule',
      requestId: 'req_delete',
    }), { existed: true });

    assert.deepEqual(calls.map((call) => `${call.method} ${call.path}`), [
      `GET /__internal/accounts/${ACCOUNT_PUBLIC_ID}/instances`,
      'POST /__internal/instances',
      `GET /__internal/instances/${INSTANCE_ID}`,
      `PUT /__internal/instances/${INSTANCE_ID}`,
      `GET /__internal/instances/${INSTANCE_ID}/pages`,
      `POST /__internal/instances/${INSTANCE_ID}/rename`,
      `POST /__internal/instances/${INSTANCE_ID}/publish`,
      `POST /__internal/instances/${INSTANCE_ID}/unpublish`,
      `POST /__internal/instances/${INSTANCE_ID}/duplicate`,
      `DELETE /__internal/instances/${INSTANCE_ID}`,
    ]);
    assert.deepEqual(calls[5]?.body, { displayName: 'Renamed FAQ' });
  } finally {
    if (originalContext === undefined) delete (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
    else (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = originalContext;
  }
});

test('saving a widget refreshes pages that place the instance through Roma page save', async () => {
  const originalContext = (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
  const calls: Array<{ method: string; path: string; body: unknown }> = [];
  const pageSource = {
    v: 1 as const,
    id: PAGE_ID,
    head: {
      title: 'Home',
      description: '',
      robots: 'index,follow' as const,
    },
    placements: [{ instanceId: INSTANCE_ID }],
  };
  const pageSummary = {
    id: PAGE_ID,
    title: 'Home',
    description: '',
    robots: 'index,follow' as const,
    placementCount: 1,
    createdAt: '2026-06-03T00:00:00.000Z',
    updatedAt: '2026-06-03T00:00:00.000Z',
  };

  (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = {
    env: {
      TOKYO_PRODUCT_CONTROL: {
        async fetch(input: RequestInfo | URL, init?: RequestInit) {
          const url = new URL(String(input));
          const method = String(init?.method || 'GET').toUpperCase();
          const body = init?.body ? JSON.parse(String(init.body)) : null;
          calls.push({ method, path: url.pathname, body });

          if (url.pathname === `/__internal/instances/${INSTANCE_ID}` && method === 'PUT') {
            return jsonResponse({ ok: true, live: true });
          }
          if (url.pathname === `/__internal/instances/${INSTANCE_ID}/pages` && method === 'GET') {
            return jsonResponse({
              ok: true,
              accountId: ACCOUNT_PUBLIC_ID,
              instanceId: INSTANCE_ID,
              pageIds: [PAGE_ID],
            });
          }
          if (url.pathname === `/__internal/pages/${PAGE_ID}` && method === 'GET') {
            return jsonResponse({
              ok: true,
              accountId: ACCOUNT_PUBLIC_ID,
              pageId: PAGE_ID,
              source: pageSource,
              publishStatus: 'published',
            });
          }
          if (url.pathname === `/__internal/instances/${INSTANCE_ID}/package` && method === 'GET') {
            return jsonResponse({
              ok: true,
              accountId: ACCOUNT_PUBLIC_ID,
              instanceId: INSTANCE_ID,
              publicPackage: pageComposablePackage(),
            });
          }
          if (url.pathname === `/__internal/pages/${PAGE_ID}` && method === 'PUT') {
            return jsonResponse({
              ok: true,
              accountId: ACCOUNT_PUBLIC_ID,
              pageId: PAGE_ID,
              source: pageSource,
              summary: pageSummary,
            });
          }

          return jsonResponse({ error: { reasonKey: 'unexpected_tokyo_path', detail: url.pathname } }, 500);
        },
      },
    },
  };

  try {
    assert.deepEqual(await saveAccountInstanceInTokyo({
      accountId: ACCOUNT_PUBLIC_ID,
      instanceId: INSTANCE_ID,
      accountCapsule: 'capsule',
      widgetType: 'faq',
      config: { header: { title: 'FAQ' } },
      publicPackage: publicPackage(),
      requestId: 'req_save',
    }), { ok: true, value: { live: true } });

    assert.deepEqual(calls.map((call) => `${call.method} ${call.path}`), [
      `PUT /__internal/instances/${INSTANCE_ID}`,
      `GET /__internal/instances/${INSTANCE_ID}/pages`,
      `GET /__internal/pages/${PAGE_ID}`,
      `GET /__internal/instances/${INSTANCE_ID}/package`,
      `PUT /__internal/pages/${PAGE_ID}`,
    ]);
    const pageSave = calls[4]?.body as { pagePackage?: { indexHtml?: string } } | null;
    assert.match(pageSave?.pagePackage?.indexHtml ?? '', new RegExp(`data-ck-page="${PAGE_ID}"`));
    assert.match(pageSave?.pagePackage?.indexHtml ?? '', new RegExp(`data-ck-instance-id="${INSTANCE_ID}"`));
  } finally {
    if (originalContext === undefined) delete (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
    else (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = originalContext;
  }
});
