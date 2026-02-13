import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';

type InstancePayload = {
  publicId: string;
  widgetname: string;
  displayName?: string;
  config?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
};

type FetchMockOptions = {
  compiledByWidget?: Record<string, Record<string, unknown>>;
  themes?: Array<{ id: string; label?: string }>;
  onThemeUpdate?: (payload: { themeId?: string; values?: Record<string, unknown> }) => void;
};

const HTML_PATH = new URL('./dev-widget-workspace.html', import.meta.url);
const HTML_SOURCE = readFileSync(HTML_PATH, 'utf8');

function extractModuleScript(html: string): string {
  const match = html.match(/<script\s+type="module">([\s\S]*?)<\/script>/);
  if (!match) {
    throw new Error('DevStudio workspace tool script not found');
  }
  return match[1];
}

function ensureCrypto(win: Window & typeof globalThis) {
  const hasUuid = Boolean(win.crypto && typeof win.crypto.randomUUID === 'function');
  if (hasUuid) return;
  Object.defineProperty(win, 'crypto', {
    value: { randomUUID: () => 'test-uuid' },
    configurable: true,
  });
}

function ensureAbortController(win: Window & typeof globalThis) {
  if (typeof win.AbortController === 'function') return;
  Object.defineProperty(win, 'AbortController', {
    value: AbortController,
    configurable: true,
  });
}

function buildFetchMock(instances: InstancePayload[], options?: FetchMockOptions) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method =
      init?.method ||
      (input instanceof Request ? input.method : 'GET');
    if (url.includes('/api/paris/curated-instances')) {
      return new Response(JSON.stringify({ instances }), { status: 200 });
    }
    const compiledMatch = url.match(/\/api\/widgets\/([^/]+)\/compiled/);
    if (compiledMatch) {
      const widget = decodeURIComponent(compiledMatch[1] || '');
      const compiled = options?.compiledByWidget?.[widget] || { defaults: {} };
      return new Response(JSON.stringify(compiled), { status: 200 });
    }
    if (url.includes('/api/themes/list') && method === 'GET') {
      return new Response(
        JSON.stringify({
          themes: (options?.themes || []).map((theme) => ({
            id: theme.id,
            label: theme.label || theme.id,
          })),
        }),
        { status: 200 },
      );
    }
    if (url.includes('/api/themes/update') && method === 'POST') {
      let payload: { themeId?: string; values?: Record<string, unknown> } = {};
      try {
        payload = init?.body ? JSON.parse(String(init.body)) : {};
      } catch {}
      options?.onThemeUpdate?.(payload);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    if (url.includes('/api/paris/instances') && method === 'POST') {
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    if (url.includes('/api/paris/instance/')) {
      return new Response(JSON.stringify({ config: { title: 'ok' } }), { status: 200 });
    }
    return new Response('{}', { status: 404 });
  });
}

async function flushDom(dom: JSDOM, ticks = 2) {
  for (let i = 0; i < ticks; i += 1) {
    await new Promise<void>((resolve) => dom.window.requestAnimationFrame(() => resolve()));
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

async function loadWorkspaceDom(
  instances: InstancePayload[],
  options?: {
    fetch?: FetchMockOptions;
    onBobPostMessage?: (payload: unknown, origin: string, ctx: { dom: JSDOM; bobWindow: Window }) => void;
  }
) {
  const dom = new JSDOM(HTML_SOURCE, {
    url: 'http://localhost:5173/#/tools/dev-widget-workspace',
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });

  const fetchMock = buildFetchMock(instances, options?.fetch);
  dom.window.fetch = fetchMock as typeof fetch;
  dom.window.Headers = Headers;
  dom.window.Response = Response;
  dom.window.Request = Request;
  dom.window.alert = vi.fn();
  dom.window.confirm = vi.fn(() => true);
  dom.window.prompt = vi.fn(() => 'faq');

  ensureCrypto(dom.window);
  ensureAbortController(dom.window);

  const iframe = dom.window.document.getElementById('bob-iframe');
  if (iframe) {
    const bobWindow = {
      postMessage: vi.fn((payload: unknown, origin: string) => {
        options?.onBobPostMessage?.(payload, origin, { dom, bobWindow: bobWindow as unknown as Window });
      }),
    };
    Object.defineProperty(iframe, 'contentWindow', {
      value: bobWindow,
      configurable: true,
    });
  }

  dom.window.eval(extractModuleScript(HTML_SOURCE));
  await flushDom(dom);
  return { dom, fetchMock };
}

describe('DevStudio widget workspace tool', () => {
  it('shows the empty-state label when no curated instances exist', async () => {
    const { dom } = await loadWorkspaceDom([]);
    const label = dom.window.document.getElementById('current-instance-label');
    const dropdown = dom.window.document.getElementById('instance-dropdown');

    expect(label?.textContent).toBe('No instances yet');
    expect(dropdown?.getAttribute('style') || '').toContain('display: none');

    dom.window.close();
  });

  it('renders instance options and fetches compiled widget data', async () => {
    const instances = [
      {
        publicId: 'wgt_curated_faq_simple',
        widgetname: 'faq',
        displayName: 'FAQ Simple',
      },
    ];
    const { dom, fetchMock } = await loadWorkspaceDom(instances);
    const label = dom.window.document.getElementById('current-instance-label');
    const menu = dom.window.document.getElementById('instance-dropdown-menu');

    expect(label?.textContent).toBe('FAQ Simple');
    expect(menu?.querySelectorAll('[data-public-id]').length).toBe(1);

    const urls = fetchMock.mock.calls.map(([input]) => (typeof input === 'string' ? input : input.toString()));
    expect(urls.some((url) => url.includes('/api/widgets/faq/compiled'))).toBe(true);
    expect(urls.some((url) => url.includes('/api/paris/instance/wgt_curated_faq_simple'))).toBe(true);

    dom.window.close();
  });

  it('filters instances by widget and compiles on demand', async () => {
    const instances = [
      {
        publicId: 'wgt_curated_faq_simple',
        widgetname: 'faq',
        displayName: 'FAQ Simple',
      },
      {
        publicId: 'wgt_main_logoshowcase',
        widgetname: 'logoshowcase',
        displayName: 'Logo Main',
      },
    ];
    const { dom, fetchMock } = await loadWorkspaceDom(instances);
    const widgetSelect = dom.window.document.getElementById('widget-select') as HTMLSelectElement | null;
    const menu = dom.window.document.getElementById('instance-dropdown-menu');

    expect(widgetSelect?.value).toBe('faq');
    expect(menu?.querySelectorAll('[data-public-id]').length).toBe(1);

    const initialUrls = fetchMock.mock.calls.map(([input]) =>
      typeof input === 'string' ? input : input.toString()
    );
    expect(initialUrls.some((url) => url.includes('/api/widgets/faq/compiled'))).toBe(true);
    expect(initialUrls.some((url) => url.includes('/api/widgets/logoshowcase/compiled'))).toBe(
      false
    );

    if (widgetSelect) {
      widgetSelect.value = 'logoshowcase';
      widgetSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    }
    await flushDom(dom, 2);

    const afterUrls = fetchMock.mock.calls.map(([input]) =>
      typeof input === 'string' ? input : input.toString()
    );
    expect(afterUrls.some((url) => url.includes('/api/widgets/logoshowcase/compiled'))).toBe(true);

    dom.window.close();
  });

  it('requires an instance name before enabling curated instance creation', async () => {
    const instances = [
      {
        publicId: 'wgt_curated_faq_simple',
        widgetname: 'faq',
        displayName: 'FAQ Simple',
      },
    ];
    const { dom } = await loadWorkspaceDom(instances);
    const openBtn = dom.window.document.getElementById('create-curated-instance');
    const modal = dom.window.document.getElementById('curated-modal');
    const confirm = dom.window.document.getElementById('curated-modal-confirm') as HTMLButtonElement | null;
    const nameField = dom.window.document.getElementById('curated-style-name') as HTMLInputElement | null;

    expect(openBtn).toBeTruthy();
    openBtn?.dispatchEvent(new dom.window.Event('click', { bubbles: true }));

    expect(modal?.hasAttribute('hidden')).toBe(false);
    expect(confirm?.disabled).toBe(true);

    if (nameField) {
      nameField.value = 'Clinic Friendly';
      nameField.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    }

    expect(confirm?.disabled).toBe(false);

    dom.window.close();
  });

  it('creates a curated instance with composed slug and requests asset persistence from Bob', async () => {
    const instances = [
      {
        publicId: 'wgt_curated_faq_simple',
        widgetname: 'faq',
        displayName: 'FAQ Simple',
      },
    ];

    let exportRequest: any = null;
    const { dom, fetchMock } = await loadWorkspaceDom(instances, {
      onBobPostMessage: (payload, origin, { dom: innerDom, bobWindow }) => {
        if (!payload || typeof payload !== 'object') return;
        const data = payload as { type?: string; requestId?: string };
        if (data.type !== 'devstudio:export-instance-data') return;
        exportRequest = payload;
        innerDom.window.dispatchEvent(
          new innerDom.window.MessageEvent('message', {
            data: {
              type: 'bob:export-instance-data',
              requestId: data.requestId,
              ok: true,
              instanceData: { hero: { image: 'data:image/png;base64,abc' } },
              meta: { publicId: 'wgt_main_faq' },
            },
            origin,
            source: bobWindow,
          })
        );
      },
    });

    const openBtn = dom.window.document.getElementById('create-curated-instance');
    const confirm = dom.window.document.getElementById('curated-modal-confirm') as HTMLButtonElement | null;
    const nameField = dom.window.document.getElementById('curated-style-name') as HTMLInputElement | null;
    const primaryVariantField = dom.window.document.getElementById(
      'curated-variant-primary'
    ) as HTMLInputElement | null;
    const secondaryVariantField = dom.window.document.getElementById(
      'curated-variant-secondary'
    ) as HTMLInputElement | null;
    openBtn?.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
    if (nameField) {
      nameField.value = 'Lightblurs v01';
      nameField.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    }
    if (primaryVariantField) {
      primaryVariantField.value = 'Hospitality';
      primaryVariantField.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    }
    if (secondaryVariantField) {
      secondaryVariantField.value = 'Airbnb';
      secondaryVariantField.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    }
    confirm?.dispatchEvent(new dom.window.Event('click', { bubbles: true }));

    await flushDom(dom, 4);

    expect(exportRequest?.persistAssets).toBe(true);
    expect(exportRequest?.assetScope).toBe('curated');
    expect(exportRequest?.assetWidgetType).toBe('faq');

    const createCall = fetchMock.mock.calls.find(([input, init]) => {
      const url = typeof input === 'string' ? input : input.toString();
      return url.includes('/api/paris/instances') && (init?.method || 'GET') === 'POST';
    });
    expect(createCall).toBeTruthy();
    const createBody = createCall?.[1]?.body ? JSON.parse(String(createCall[1].body)) : null;
    expect(createBody?.publicId).toBe('wgt_curated_faq_lightblurs_hospitality_airbnb');
    expect(createBody?.meta?.styleName).toBe('Lightblurs.Hospitality.Airbnb');
    expect(createBody?.meta?.styleSlug).toBe('lightblurs_hospitality_airbnb');
    expect(createBody?.meta?.variants?.primary).toBe('Hospitality');
    expect(createBody?.meta?.variants?.secondary).toBe('Airbnb');

    dom.window.close();
  });

  it('requires explicit theme selection when current editor theme is custom', async () => {
    const instances = [
      {
        publicId: 'wgt_curated_faq_simple',
        widgetname: 'faq',
        displayName: 'FAQ Simple',
      },
    ];

    const { dom } = await loadWorkspaceDom(instances, {
      fetch: {
        themes: [
          { id: 'light', label: 'Light' },
          { id: 'dark', label: 'Dark' },
        ],
      },
      onBobPostMessage: (payload, origin, { dom: innerDom, bobWindow }) => {
        if (!payload || typeof payload !== 'object') return;
        const data = payload as { type?: string; requestId?: string };
        if (data.type !== 'devstudio:export-instance-data') return;
        innerDom.window.dispatchEvent(
          new innerDom.window.MessageEvent('message', {
            data: {
              type: 'bob:export-instance-data',
              requestId: data.requestId,
              ok: true,
              instanceData: { appearance: { theme: 'custom' } },
              meta: { publicId: 'wgt_curated_faq_simple' },
            },
            origin,
            source: bobWindow,
          }),
        );
      },
    });

    const updateThemeBtn = dom.window.document.getElementById('superadmin-update-theme');
    updateThemeBtn?.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
    await flushDom(dom, 4);

    const themeModal = dom.window.document.getElementById('theme-modal');
    const themeSelect = dom.window.document.getElementById('theme-modal-select') as HTMLSelectElement | null;
    expect(themeModal?.hasAttribute('hidden')).toBe(false);
    expect(themeSelect?.value).toBe('');
    expect(themeSelect?.options[0]?.value).toBe('');
    expect(themeSelect?.options[0]?.disabled).toBe(true);

    dom.window.close();
  });

  it('updates theme using compiled control paths and normalizes fill values', async () => {
    const instances = [
      {
        publicId: 'wgt_curated_faq_simple',
        widgetname: 'faq',
        displayName: 'FAQ Simple',
      },
    ];

    let themeUpdatePayload: { themeId?: string; values?: Record<string, unknown> } | null = null;

    const { dom } = await loadWorkspaceDom(instances, {
      fetch: {
        themes: [
          { id: 'light', label: 'Light' },
          { id: 'dark', label: 'Dark' },
        ],
        compiledByWidget: {
          faq: {
            defaults: {},
            controls: [
              { path: 'stage.alignment', type: 'dropdown-actions' },
              { path: 'appearance.ctaTextColor', type: 'dropdown-fill' },
              { path: 'typography.globalFamily', type: 'dropdown-actions' },
              { path: 'typography.roles.button.color', type: 'dropdown-fill' },
              { path: 'typography.roles.button.weight', type: 'dropdown-actions' },
            ],
          },
        },
        onThemeUpdate: (payload) => {
          themeUpdatePayload = payload;
        },
      },
      onBobPostMessage: (payload, origin, { dom: innerDom, bobWindow }) => {
        if (!payload || typeof payload !== 'object') return;
        const data = payload as { type?: string; requestId?: string };
        if (data.type !== 'devstudio:export-instance-data') return;
        innerDom.window.dispatchEvent(
          new innerDom.window.MessageEvent('message', {
            data: {
              type: 'bob:export-instance-data',
              requestId: data.requestId,
              ok: true,
              instanceData: {
                stage: { alignment: 'center' },
                appearance: {
                  theme: 'custom',
                  ctaTextColor: 'var(--color-system-white)',
                },
                typography: {
                  globalFamily: 'Inter',
                  roles: {
                    button: {
                      color: 'var(--color-system-white)',
                      weight: '600',
                    },
                  },
                },
              },
              meta: { publicId: 'wgt_curated_faq_simple' },
            },
            origin,
            source: bobWindow,
          }),
        );
      },
    });

    const updateThemeBtn = dom.window.document.getElementById('superadmin-update-theme');
    updateThemeBtn?.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
    await flushDom(dom, 3);

    const themeSelect = dom.window.document.getElementById('theme-modal-select') as HTMLSelectElement | null;
    const themeConfirm = dom.window.document.getElementById('theme-modal-confirm');
    if (themeSelect) themeSelect.value = 'dark';
    themeConfirm?.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
    await flushDom(dom, 4);

    expect(themeUpdatePayload?.themeId).toBe('dark');
    expect(themeUpdatePayload?.values?.['stage.alignment']).toBe('center');
    expect(themeUpdatePayload?.values?.['typography.globalFamily']).toBe('Inter');
    expect(themeUpdatePayload?.values?.['typography.roles.button.weight']).toBe('600');
    expect(themeUpdatePayload?.values?.['appearance.ctaTextColor']).toEqual({
      type: 'color',
      color: 'var(--color-system-white)',
    });
    expect(themeUpdatePayload?.values?.['typography.roles.button.color']).toEqual({
      type: 'color',
      color: 'var(--color-system-white)',
    });
    expect(themeUpdatePayload?.values?.['typography.roles']).toBeUndefined();

    dom.window.close();
  });
});
