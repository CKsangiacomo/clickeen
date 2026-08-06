import assert from 'node:assert/strict';
import { tryHandleClkLivePageRoutes } from '../src/routes/clk-live-page-routes';

type Stored = { body: string; httpMetadata?: { contentType?: string } };

const accountId = 'CLICKEEN';
const pageId = 'PAGE123456';
const root = `accounts/${accountId}/pages/${pageId}`;

function createEnv(published = true, needsUpdate = false, omitNeedsUpdate = false) {
  const objects = new Map<string, Stored>();
  const put = (key: string, value: unknown, contentType = 'application/json; charset=utf-8') => {
    objects.set(key, {
      body: typeof value === 'string' ? value : JSON.stringify(value),
      httpMetadata: { contentType },
    });
  };
  put(`${root}/source.json`, {
    pageId,
    displayName: 'Summer',
    isTemplate: false,
    baseLocale: 'en-US',
    values: { title: 'Summer' },
    robots: 'index-follow',
    placements: [{ placementId: 'hero', instanceId: 'ABCD123456' }],
  });
  put(`${root}/serve-state.json`, omitNeedsUpdate ? { published } : { published, needsUpdate });
  put(`${root}/overlays.json`, {
    'it-IT': {
      page: { title: 'Estate' },
      placements: { hero: {
        'header.title': 'Benvenuti',
        'faq.sections.0.faqs.0.question': 'Che cos’è Clickeen?',
        'faq.sections.0.faqs.0.answer': '<p>Una piattaforma globale di widget.</p>',
      } },
    },
  });
  put(`${root}/index.html`, `<!doctype html><html lang="en-US"><head>
    <title data-ck-field-path="values.title" data-ck-field-target="text">Summer</title>
    <meta property="og:title" content="Summer" data-ck-field-path="values.title" data-ck-field-target="attribute:content" />
    <link rel="canonical" href="__CK_PUBLIC_PAGE_URL__/en-US" data-ck-page-public-coordinate="canonical" />
    <meta property="og:url" content="__CK_PUBLIC_PAGE_URL__/en-US" data-ck-page-public-coordinate="social-url" />
    <link rel="alternate" hreflang="en-US" href="__CK_PUBLIC_PAGE_URL__/en-US" data-ck-page-public-coordinate="alternate" />
    <link rel="alternate" hreflang="it-IT" href="__CK_PUBLIC_PAGE_URL__/it-IT" data-ck-page-public-coordinate="alternate" />
    <script type="application/ld+json" data-ck-page-schema="webpage" data-ck-page-public-coordinate="webpage-jsonld">{"@context":"https://schema.org","@type":"WebPage","@id":"__CK_PUBLIC_PAGE_URL__/en-US#webpage","url":"__CK_PUBLIC_PAGE_URL__/en-US","name":"Summer","inLanguage":"en-US"}</script>
    <script type="application/ld+json" data-ck-page-schema="faq-page">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"What is Clickeen?","acceptedAnswer":{"@type":"Answer","text":"A global widget platform."}}]}</script>
    <link rel="stylesheet" href="./styles.css" /></head><body>
    <section data-ck-placement-id="hero" data-ck-instance-id="ABCD123456"><template shadowrootmode="open"><h1 data-ck-field-path="header.title" data-ck-field-target="text">Welcome</h1><h2 data-ck-field-path="faq.sections.0.faqs.0.question" data-ck-field-target="text">What is Clickeen?</h2><div data-ck-field-path="faq.sections.0.faqs.0.answer" data-ck-field-target="richtext"><p>A global widget platform.</p></div></template></section>
    <script src="./runtime.js" defer></script></body></html>`, 'text/html; charset=utf-8');
  put(`${root}/styles.css`, '.page{}', 'text/css; charset=utf-8');
  put(`${root}/runtime.js`, 'window.pageReady=true;', 'text/javascript; charset=utf-8');
  return {
    TOKYO_R2: {
      async get(key: string) {
        const stored = objects.get(key);
        if (!stored) return null;
        return {
          body: new Response(stored.body).body,
          httpMetadata: stored.httpMetadata,
          async text() { return stored.body; },
          async json() { return JSON.parse(stored.body); },
        };
      },
    },
  } as any;
}

async function request(path: string, env: any, headers?: HeadersInit, method = 'GET') {
  const url = new URL(`https://dev.clk.live${path}`);
  return tryHandleClkLivePageRoutes({
    req: new Request(url, { headers, method }),
    env,
    pathname: url.pathname,
    url,
    respond: (response) => response,
  });
}

async function main() {
  const env = createEnv();
  const stable = await request(`/${accountId}/pages/${pageId}`, env, { 'accept-language': 'it-IT,it;q=0.9' });
  assert.equal(stable?.status, 302);
  assert.equal(stable?.headers.get('location'), `https://dev.clk.live/${accountId}/pages/${pageId}/it-IT`);
  assert.equal(stable?.headers.get('cache-control'), 'no-store');

  const base = await request(`/${accountId}/pages/${pageId}/en-US`, env);
  assert.equal(base?.status, 200);
  const baseHtml = await base!.text();
  assert.match(baseHtml, />Summer<\/title>/);
  assert.match(baseHtml, />Welcome<\/h1>/);
  assert.match(baseHtml, new RegExp(`canonical" href="https://dev\\.clk\\.live/${accountId}/pages/${pageId}/en-US`));
  assert.doesNotMatch(baseHtml, /__CK_PUBLIC_PAGE_URL__/);
  assert.equal(base?.headers.get('cache-control'), 'public, max-age=0, s-maxage=300, must-revalidate');

  const italian = await request(`/${accountId}/pages/${pageId}/it-IT`, env);
  assert.equal(italian?.status, 200);
  const italianHtml = await italian!.text();
  assert.match(italianHtml, /<html lang="it-IT">/);
  assert.match(italianHtml, />Estate<\/title>/);
  assert.match(italianHtml, />Benvenuti<\/h1>/);
  assert.match(italianHtml, />Che cos’è Clickeen\?<\/h2>/);
  assert.doesNotMatch(italianHtml, />Summer<\/title>|>Welcome<\/h1>/);
  assert.match(italianHtml, /"inLanguage":"it-IT"/);
  assert.match(italianHtml, /"name":"Estate"/);
  assert.match(italianHtml, /"name":"Che cos’è Clickeen\?"/);
  assert.match(italianHtml, /"text":"Una piattaforma globale di widget\."/);
  assert.match(italianHtml, new RegExp(`"url":"https://dev\\.clk\\.live/${accountId}/pages/${pageId}/it-IT"`));

  assert.equal((await request(`/${accountId}/pages/${pageId}/fr-FR`, env))?.status, 404);
  assert.equal((await request(`/${accountId}/pages/${pageId}/styles.css`, env))?.status, 200);
  assert.equal((await request(`/${accountId}/pages/${pageId}/runtime.js`, env))?.status, 200);
  assert.equal(
    (await request(`/${accountId}/pages/${pageId}/en-US`, createEnv(true, true)))?.status,
    200,
    'the last published Page must remain public while it needs Update',
  );
  assert.equal(
    (await request(`/${accountId}/pages/${pageId}/en-US`, createEnv(true, false, true)))?.status,
    500,
    'missing Page currency must fail instead of silently becoming Current',
  );
  assert.equal((await request(`/${accountId}/pages/${pageId}/en-US`, createEnv(false)))?.status, 404);

  console.log('Tokyo Page public serving verification passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
