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

function buildFetchMock(instances: InstancePayload[]) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method =
      init?.method ||
      (input instanceof Request ? input.method : 'GET');
    if (url.includes('/api/paris/curated-instances')) {
      return new Response(JSON.stringify({ instances }), { status: 200 });
    }
    if (url.includes('/api/widgets/faq/compiled')) {
      return new Response(JSON.stringify({ defaults: {} }), { status: 200 });
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
    onBobPostMessage?: (payload: unknown, origin: string, ctx: { dom: JSDOM; bobWindow: Window }) => void;
  }
) {
  const dom = new JSDOM(HTML_SOURCE, {
    url: 'http://localhost:5173/#/tools/dev-widget-workspace',
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });

  const fetchMock = buildFetchMock(instances);
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
        publicId: 'wgt_curated_faq.simple.v01',
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
    expect(urls.some((url) => url.includes('/api/paris/instance/wgt_curated_faq.simple.v01'))).toBe(true);

    dom.window.close();
  });

  it('requires a style name before enabling curated instance creation', async () => {
    const instances = [
      {
        publicId: 'wgt_curated_faq.simple.v01',
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

  it('creates a curated instance with slugged name and requests asset persistence from Bob', async () => {
    const instances = [
      {
        publicId: 'wgt_curated_faq.simple.v01',
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
    openBtn?.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
    const tagInput = dom.window.document.querySelector<HTMLInputElement>(
      'input[data-tag-group="icp"][value="saas"]'
    );
    if (nameField) {
      nameField.value = 'Clinic Friendly';
      nameField.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    }
    if (tagInput) {
      tagInput.checked = true;
      tagInput.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
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
    expect(createBody?.publicId).toBe('wgt_curated_faq.clinic_friendly.v01');
    expect(createBody?.meta?.styleName).toBe('Clinic Friendly');
    expect(createBody?.meta?.styleSlug).toBe('clinic_friendly');
    expect(createBody?.meta?.version).toBe(1);
    expect(createBody?.meta?.tags?.icp).toContain('saas');

    dom.window.close();
  });
});
