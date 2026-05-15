import { expect, test } from '@playwright/test';

const instanceId = process.env.CK_VENICE_TEST_INSTANCE_ID || 'INST000001';

function loaderUrl(baseURL: string, path: string): string {
  return new URL(path, baseURL).toString();
}

function requireBaseURL(baseURL: string | undefined): string {
  if (!baseURL) throw new Error('Venice runtime verification requires Playwright baseURL.');
  return baseURL;
}

test('default immutable loader mounts one iframe without host globals or console noise', async ({ page, baseURL }) => {
  const rootURL = requireBaseURL(baseURL);
  const messages: string[] = [];
  page.on('console', (message) => {
    const text = message.text();
    if (text.includes('Clickeen')) messages.push(text);
  });

  await page.setContent(`<!doctype html>
    <html><head><meta charset="utf-8" /></head><body>
    <script
      src="${loaderUrl(rootURL, '/embed/v2.0.0/loader.js')}"
      async
      data-instance-id="${instanceId}"
    ></script>
    </body></html>`);

  await expect(page.locator('iframe')).toHaveCount(1);
  await expect(page.locator('iframe')).toHaveAttribute('src', new RegExp(`/widget/${instanceId}$`));
  await expect
    .poll(() =>
      page.evaluate(() => ({
        clickeen: Boolean((window as any).Clickeen),
        ckeenBus: Boolean((window as any).ckeenBus),
        loaderState: Boolean((window as any).__CK_V2_EMBED_LOADER__),
      })),
    )
    .toEqual({ clickeen: false, ckeenBus: false, loaderState: false });
  expect(messages).toEqual([]);
});

test('placeholder loader mounts multiple widgets without shared host globals', async ({ page, baseURL }) => {
  const rootURL = requireBaseURL(baseURL);
  await page.setContent(`<!doctype html>
    <html><head><meta charset="utf-8" /></head><body>
    <div data-clickeen-id="${instanceId}"></div>
    <div data-clickeen-id="${instanceId}"></div>
    <script src="${loaderUrl(rootURL, '/embed/v2.0.0/loader.js')}" async></script>
    </body></html>`);

  await expect(page.locator('iframe')).toHaveCount(2);
  await expect
    .poll(() =>
      page.evaluate(() => ({
        clickeen: Boolean((window as any).Clickeen),
        ckeenBus: Boolean((window as any).ckeenBus),
        loaderState: Boolean((window as any).__CK_V2_EMBED_LOADER__),
      })),
    )
    .toEqual({ clickeen: false, ckeenBus: false, loaderState: false });
});

test('direct iframe snippet serves resolved widget html', async ({ page, baseURL }) => {
  const rootURL = requireBaseURL(baseURL);
  await page.setContent(`<!doctype html>
    <html><head><meta charset="utf-8" /></head><body>
    <iframe src="${loaderUrl(rootURL, `/widget/${instanceId}`)}"></iframe>
    </body></html>`);

  await expect(page.locator('iframe')).toHaveCount(1);
  await expect(page.frameLocator('iframe').locator('[data-ck-widget="faq"]')).toHaveCount(1);
});

test('direct iframe snippet applies selected published language overlay', async ({ page, baseURL }) => {
  const rootURL = requireBaseURL(baseURL);
  await page.setContent(`<!doctype html>
    <html><head><meta charset="utf-8" /></head><body>
    <iframe src="${loaderUrl(rootURL, `/widget/${instanceId}?locale=it`)}"></iframe>
    </body></html>`);

  const frame = page.frameLocator('iframe');
  await expect(frame.locator('[data-ck-field="title"]')).toHaveText('Domande frequenti B&B');
  await expect(frame.locator('[data-ck-field="cta"]')).toHaveText('Prenota ora');
  await expect(frame.locator('[data-ck-field="section"]')).toHaveText('Domande');
  await expect(frame.locator('[data-ck-field="question"]')).toHaveText('Quali camere offrite?');
  await expect(frame.locator('[data-ck-field="answer"]')).toHaveText('Offriamo camere standard e deluxe.');
});

test('seo geo loader preserves explicit metadata enhancement path', async ({ page, baseURL }) => {
  const rootURL = requireBaseURL(baseURL);
  await page.setContent(`<!doctype html>
    <html><head><meta charset="utf-8" /></head><body>
    <script
      src="${loaderUrl(rootURL, '/embed/v2.0.0/seo-geo-loader.js')}"
      async
      data-instance-id="${instanceId}"
      data-ck-optimization="seo-geo"
    ></script>
    </body></html>`);

  await expect(page.locator('iframe')).toHaveCount(1);
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(1);
});

test('csp frame blocking produces a host-page error card', async ({ page, baseURL }) => {
  const rootURL = requireBaseURL(baseURL);
  const hostUrl = loaderUrl(rootURL, '/__clickeen-csp-host');
  await page.route(hostUrl, async (route) => {
    await route.fulfill({
      contentType: 'text/html',
      headers: {
        'Content-Security-Policy': `script-src 'unsafe-inline' ${rootURL}; frame-src 'none'; child-src 'none'`,
      },
      body: `<!doctype html>
    <html><head><meta charset="utf-8" /></head><body>
    <script
      src="${loaderUrl(rootURL, '/embed/v2.0.0/loader.js')}"
      async
      data-instance-id="${instanceId}"
    ></script>
    </body></html>`,
    });
  });

  await page.goto(hostUrl);

  await expect(page.locator('[data-ck-embed-error="1"]')).toHaveCount(1, { timeout: 10_000 });
});
