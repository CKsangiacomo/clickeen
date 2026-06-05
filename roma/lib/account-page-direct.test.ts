import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createAccountPageInTokyo,
  deleteAccountPageFromTokyo,
  listAccountPagesInTokyo,
  loadAccountPageFromTokyo,
  publishAccountPageInTokyo,
  saveAccountPageInTokyo,
  unpublishAccountPageInTokyo,
} from './account-page-direct';

const CLOUDFLARE_REQUEST_CONTEXT_SYMBOL = Symbol.for('__cloudflare-request-context__');
const ACCOUNT_PUBLIC_ID = 'A1B2C3D4';
const PAGE_ID = 'P1B2C3D4E5';
const INSTANCE_ID = 'I1B2C3D4E5';

const source = {
  v: 1 as const,
  id: PAGE_ID,
  head: {
    title: 'Home',
    description: '',
    robots: 'index,follow' as const,
  },
  placements: [{ instanceId: INSTANCE_ID }],
};

const summary = {
  id: PAGE_ID,
  title: 'Home',
  description: '',
  robots: 'index,follow' as const,
  placementCount: 1,
  createdAt: '2026-06-03T00:00:00.000Z',
  updatedAt: '2026-06-03T00:00:00.000Z',
};

function publicPackage(instanceId = INSTANCE_ID) {
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

test('account page helpers compose packages in Roma before storing page bytes in Tokyo', async () => {
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

          if (url.pathname === `/__internal/accounts/${ACCOUNT_PUBLIC_ID}/pages` && method === 'GET') {
            return jsonResponse({ ok: true, accountId: ACCOUNT_PUBLIC_ID, pages: [summary] });
          }
          if (url.pathname === '/__internal/pages' && method === 'POST') {
            return jsonResponse({ ok: true, accountId: ACCOUNT_PUBLIC_ID, pageId: PAGE_ID, source, summary }, 201);
          }
          if (url.pathname === `/__internal/pages/${PAGE_ID}` && method === 'GET') {
            return jsonResponse({ ok: true, accountId: ACCOUNT_PUBLIC_ID, pageId: PAGE_ID, source, publishStatus: 'unpublished' });
          }
          if (url.pathname === `/__internal/instances/${INSTANCE_ID}/package` && method === 'GET') {
            return jsonResponse({ ok: true, accountId: ACCOUNT_PUBLIC_ID, instanceId: INSTANCE_ID, publicPackage: publicPackage() });
          }
          if (url.pathname === `/__internal/pages/${PAGE_ID}` && method === 'PUT') {
            return jsonResponse({ ok: true, accountId: ACCOUNT_PUBLIC_ID, pageId: PAGE_ID, source, summary });
          }
          if (url.pathname === `/__internal/pages/${PAGE_ID}` && method === 'DELETE') {
            return jsonResponse({ ok: true, accountId: ACCOUNT_PUBLIC_ID, pageId: PAGE_ID, deleted: true, existed: true });
          }
          if (url.pathname === `/__internal/pages/${PAGE_ID}/publish` && method === 'POST') {
            return jsonResponse({ ok: true, accountId: ACCOUNT_PUBLIC_ID, pageId: PAGE_ID, publishStatus: 'published', changed: true });
          }
          if (url.pathname === `/__internal/pages/${PAGE_ID}/unpublish` && method === 'POST') {
            return jsonResponse({ ok: true, accountId: ACCOUNT_PUBLIC_ID, pageId: PAGE_ID, publishStatus: 'unpublished', changed: true });
          }

          return jsonResponse({ error: { reasonKey: 'unexpected_tokyo_path', detail: url.pathname } }, 500);
        },
      },
    },
  };

  try {
    assert.deepEqual(await listAccountPagesInTokyo({
      accountId: ACCOUNT_PUBLIC_ID,
      accountCapsule: 'capsule',
      requestId: 'req_list',
    }), {
      ok: true,
      value: { accountId: ACCOUNT_PUBLIC_ID, pages: [summary] },
    });

    assert.deepEqual(await createAccountPageInTokyo({
      accountId: ACCOUNT_PUBLIC_ID,
      accountCapsule: 'capsule',
      source,
      requestId: 'req_create',
    }), {
      ok: true,
      value: { source, summary },
    });

    assert.deepEqual(await loadAccountPageFromTokyo({
      accountId: ACCOUNT_PUBLIC_ID,
      pageId: PAGE_ID,
      accountCapsule: 'capsule',
      requestId: 'req_open',
    }), {
      ok: true,
      value: { source, publishStatus: 'unpublished' },
    });

    assert.deepEqual(await saveAccountPageInTokyo({
      accountId: ACCOUNT_PUBLIC_ID,
      pageId: PAGE_ID,
      source,
      accountCapsule: 'capsule',
      requestId: 'req_save',
    }), {
      ok: true,
      value: { source, summary },
    });

    assert.deepEqual(await deleteAccountPageFromTokyo({
      accountId: ACCOUNT_PUBLIC_ID,
      pageId: PAGE_ID,
      accountCapsule: 'capsule',
      requestId: 'req_delete',
    }), { existed: true });

    assert.deepEqual(await publishAccountPageInTokyo({
      accountId: ACCOUNT_PUBLIC_ID,
      pageId: PAGE_ID,
      accountCapsule: 'capsule',
      requestId: 'req_publish',
    }), {
      ok: true,
      value: { accountId: ACCOUNT_PUBLIC_ID, pageId: PAGE_ID, publishStatus: 'published', changed: true },
    });

    assert.deepEqual(await unpublishAccountPageInTokyo({
      accountId: ACCOUNT_PUBLIC_ID,
      pageId: PAGE_ID,
      accountCapsule: 'capsule',
      requestId: 'req_unpublish',
    }), {
      ok: true,
      value: { accountId: ACCOUNT_PUBLIC_ID, pageId: PAGE_ID, publishStatus: 'unpublished', changed: true },
    });

    assert.deepEqual(calls.map((call) => `${call.method} ${call.path}`), [
      `GET /__internal/accounts/${ACCOUNT_PUBLIC_ID}/pages`,
      'POST /__internal/pages',
      `GET /__internal/pages/${PAGE_ID}`,
      `GET /__internal/instances/${INSTANCE_ID}/package`,
      `PUT /__internal/pages/${PAGE_ID}`,
      `DELETE /__internal/pages/${PAGE_ID}`,
      `POST /__internal/pages/${PAGE_ID}/publish`,
      `POST /__internal/pages/${PAGE_ID}/unpublish`,
    ]);
    const saveCall = calls.find((call) => call.method === 'PUT' && call.path === `/__internal/pages/${PAGE_ID}`);
    assert.equal(typeof saveCall?.body, 'object');
    const createCall = calls.find((call) => call.method === 'POST' && call.path === '/__internal/pages');
    assert.deepEqual((createCall?.body as { source?: unknown } | null)?.source, source);
    const saveBody = saveCall?.body as { pagePackage?: { indexHtml?: string; stylesCss?: string; runtimeJs?: string } } | null;
    assert.match(saveBody?.pagePackage?.indexHtml ?? '', new RegExp(`data-ck-page="${PAGE_ID}"`));
    assert.match(saveBody?.pagePackage?.indexHtml ?? '', new RegExp(`data-ck-instance-id="${INSTANCE_ID}"`));
    assert.match(saveBody?.pagePackage?.stylesCss ?? '', /\.faq/);
    assert.match(saveBody?.pagePackage?.runtimeJs ?? '', new RegExp(`CK_WIDGETS\\["${INSTANCE_ID}"\\]`));
  } finally {
    if (originalContext === undefined) delete (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL];
    else (globalThis as Record<PropertyKey, unknown>)[CLOUDFLARE_REQUEST_CONTEXT_SYMBOL] = originalContext;
  }
});
