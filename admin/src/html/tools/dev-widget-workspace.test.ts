import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { describe, expect, it, vi } from 'vitest';
import { mountDevWidgetWorkspace } from '../../tools/dev-widget-workspace/main.js';

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
  localWidgets?: string[];
  contextStatus?: number;
  contextPayload?: Record<string, unknown>;
  devstudioInstancesStatus?: number;
  devstudioL10nUnavailable?: boolean;
};

const HTML_PATH = new URL('./dev-widget-workspace.html', import.meta.url);
const HTML_SOURCE = readFileSync(HTML_PATH, 'utf8');

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

function defineGlobal<K extends keyof typeof globalThis>(key: K, value: (typeof globalThis)[K]) {
  Object.defineProperty(globalThis, key, {
    value,
    configurable: true,
    writable: true,
  });
}

function buildFetchMock(instances: InstancePayload[], options?: FetchMockOptions) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method || (input instanceof Request ? input.method : 'GET');
    const parsed = new URL(url, 'http://localhost:5173');
    const pathname = parsed.pathname;
    const publicIdParam = parsed.searchParams.get('publicId');

    if (pathname === '/api/devstudio/context' && method === 'GET') {
      const status = options?.contextStatus ?? 200;
      if (status !== 200) {
        return new Response(
          JSON.stringify(
            options?.contextPayload || {
              error: { reasonKey: 'coreui.errors.auth.required' },
            },
          ),
          { status },
        );
      }
      return new Response(
        JSON.stringify({
          accountId: '00000000-0000-0000-0000-000000000100',
          scope: 'platform',
          mode: 'local-tool',
        }),
        { status: 200 },
      );
    }
    if (pathname === '/api/devstudio/widgets') {
      const widgets = (
        options?.localWidgets ||
        Array.from(new Set(instances.map((instance) => instance.widgetname)))
      )
        .map((widgetType) =>
          String(widgetType || '')
            .trim()
            .toLowerCase(),
        )
        .filter(Boolean)
        .map((widgetType) => ({ widgetType }));
      return new Response(JSON.stringify({ widgets }), { status: 200 });
    }
    if (pathname === '/api/devstudio/instances' && method === 'GET') {
      const status = options?.devstudioInstancesStatus ?? 200;
      if (status !== 200) {
        return new Response(
          JSON.stringify({
            error: { reasonKey: 'coreui.errors.devstudio.instanceProxyFailed' },
          }),
          { status },
        );
      }
      return new Response(
        JSON.stringify({
          widgetTypes: Array.from(new Set(instances.map((instance) => instance.widgetname))),
          instances: instances.map((instance) => ({
            publicId: instance.publicId,
            widgetType: instance.widgetname,
            displayName: instance.displayName,
            status: instance.publicId.startsWith('wgt_main_') ? 'published' : 'published',
            source: instance.publicId.startsWith('wgt_curated_') ? 'curated' : 'account',
          })),
        }),
        { status: 200 },
      );
    }
    const compiledMatch = pathname.match(/\/api\/widgets\/([^/]+)\/compiled/);
    if (compiledMatch) {
      const widget = decodeURIComponent(compiledMatch[1] || '');
      const compiled = options?.compiledByWidget?.[widget] || { defaults: {} };
      return new Response(JSON.stringify(compiled), { status: 200 });
    }
    if (pathname === '/api/themes/list' && method === 'GET') {
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
    if (pathname === '/api/themes/update' && method === 'POST') {
      let payload: { themeId?: string; values?: Record<string, unknown> } = {};
      try {
        payload = init?.body ? JSON.parse(String(init.body)) : {};
      } catch {}
      options?.onThemeUpdate?.(payload);
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }
    if (pathname === '/api/devstudio/instance' && method === 'GET') {
      const match = instances.find((instance) => instance.publicId === publicIdParam);
      const publicId = match?.publicId || publicIdParam || 'unknown';
      return new Response(
        JSON.stringify({
          publicId,
          widgetType: match?.widgetname || 'faq',
          displayName: match?.displayName || 'Untitled widget',
          ownerAccountId: '00000000-0000-0000-0000-000000000100',
          status: 'published',
          config: match?.config ?? { title: 'ok' },
          meta: match?.meta ?? null,
          localization: {
            accountLocales: ['en', 'fr'],
            invalidAccountLocales: [],
            localeOverlays: [],
            policy: { enabled: true, baseLocale: 'en' },
          },
          policy: {
            profile: 'account',
            role: 'owner',
            readOnly: false,
            permissions: {
              canEdit: true,
              canPublish: true,
              canManageLocales: true,
              canManageAssets: true,
            },
          },
        }),
        { status: 200 },
      );
    }
    if (pathname === '/api/devstudio/instance/localization' && method === 'GET') {
      return new Response(
        JSON.stringify({
          localization: {
            accountLocales: ['en', 'fr'],
            invalidAccountLocales: [],
            localeOverlays: [],
            policy: { enabled: true, baseLocale: 'en' },
          },
        }),
        { status: 200 },
      );
    }
    if (
      pathname.startsWith('/api/devstudio/instances/') &&
      pathname.endsWith('/l10n/status') &&
      method === 'GET'
    ) {
      if (options?.devstudioL10nUnavailable) {
        return new Response(
          JSON.stringify({
            unavailable: true,
            locales: [],
            error: { reasonKey: 'coreui.errors.devstudio.l10nStatusUnavailable' },
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          locales: [
            {
              locale: 'fr',
              status: 'succeeded',
              attempts: 1,
              nextAttemptAt: null,
              lastError: null,
            },
          ],
        }),
        { status: 200 },
      );
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

async function loadInstancesDom(
  instances: InstancePayload[],
  options?: {
    fetch?: FetchMockOptions;
    profile?: 'product' | 'source';
    onBobPostMessage?: (
      payload: unknown,
      origin: string,
      ctx: { dom: JSDOM; bobWindow: Window },
    ) => void;
  },
) {
  const profile = options?.profile === 'source' ? 'source' : 'product';
  const dom = new JSDOM(HTML_SOURCE, {
    url: `http://localhost:5173/?profile=${profile}#/tools/dev-widget-workspace`,
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
  defineGlobal('window', dom.window as never);
  defineGlobal('document', dom.window.document as never);
  defineGlobal('sessionStorage', dom.window.sessionStorage as never);
  defineGlobal('location', dom.window.location as never);
  defineGlobal('navigator', dom.window.navigator as never);
  defineGlobal('fetch', fetchMock as never);
  defineGlobal('Headers', Headers as never);
  defineGlobal('Response', Response as never);
  defineGlobal('Request', Request as never);
  defineGlobal('crypto', dom.window.crypto as never);
  defineGlobal('AbortController', dom.window.AbortController as never);
  defineGlobal('HTMLElement', dom.window.HTMLElement as never);
  defineGlobal('HTMLSelectElement', dom.window.HTMLSelectElement as never);
  defineGlobal('HTMLInputElement', dom.window.HTMLInputElement as never);
  defineGlobal('HTMLTextAreaElement', dom.window.HTMLTextAreaElement as never);
  defineGlobal('CustomEvent', dom.window.CustomEvent as never);
  defineGlobal('Event', dom.window.Event as never);
  defineGlobal('MessageEvent', dom.window.MessageEvent as never);
  defineGlobal('Node', dom.window.Node as never);

  const iframe = dom.window.document.getElementById('bob-iframe');
  let bobWindow: Window | null = null;
  const bobOrigin = 'http://localhost:3000';
  if (iframe) {
    bobWindow = {
      postMessage: vi.fn((payload: unknown, origin: string) => {
        options?.onBobPostMessage?.(payload, origin, { dom, bobWindow: bobWindow as Window });
      }),
    } as unknown as Window;
    Object.defineProperty(iframe, 'contentWindow', {
      value: bobWindow,
      configurable: true,
    });
  }

  mountDevWidgetWorkspace();
  if (bobWindow) {
    dom.window.dispatchEvent(
      new dom.window.MessageEvent('message', {
        data: {
          type: 'bob:session-ready',
          sessionId: 'test-session',
          bootMode: 'message',
        },
        origin: bobOrigin,
        source: bobWindow,
      }),
    );
  }
  await flushDom(dom);
  return { dom, fetchMock };
}

describe('DevStudio instances tool', () => {
  it('keeps only the theme action and hides the local toolbar in product profile', async () => {
    const { dom } = await loadInstancesDom([], { profile: 'product' });
    const actions = dom.window.document.getElementById('platform-actions') as HTMLElement | null;
    const updateThemeBtn = dom.window.document.getElementById(
      'platform-update-theme',
    ) as HTMLButtonElement | null;
    const removedButtons = [
      'platform-update-defaults',
      'platform-reset-from-json',
      'refresh-prague-preview',
      'create-curated-instance',
      'update-curated-instance',
      'promote-curated-cloud',
    ];

    expect(actions?.style.display).toBe('none');
    expect(updateThemeBtn).toBeTruthy();
    removedButtons.forEach((id) => {
      expect(dom.window.document.getElementById(id)).toBeNull();
    });

    dom.window.close();
  });

  it('shows the empty-state label when no instances exist', async () => {
    const { dom } = await loadInstancesDom([], {
      fetch: {
        localWidgets: ['faq'],
      },
    });
    const label = dom.window.document.getElementById('current-instance-label');
    const dropdown = dom.window.document.getElementById('instance-dropdown');
    const menu = dom.window.document.getElementById('instance-dropdown-menu');

    expect(label?.textContent).toBe('No instances yet');
    expect(dropdown?.getAttribute('style') || '').toContain('display: inline-block');
    expect(menu?.querySelectorAll('[data-public-id]').length).toBe(0);

    dom.window.close();
  });

  it('surfaces a context failure before opening a DevStudio instance', async () => {
    const instances = [
      {
        publicId: 'wgt_curated_faq_simple',
        widgetname: 'faq',
        displayName: 'FAQ Simple',
      },
    ];
    const { dom, fetchMock } = await loadInstancesDom(instances, {
      fetch: {
        localWidgets: ['faq'],
        contextStatus: 401,
        contextPayload: {
          error: { reasonKey: 'coreui.errors.auth.required' },
        },
      },
    });
    const label = dom.window.document.getElementById('current-instance-label');
    const urls = fetchMock.mock.calls.map(([input]) =>
      typeof input === 'string' ? input : input.toString(),
    );

    expect(urls.some((url) => url.includes('/api/devstudio/context'))).toBe(true);
    expect(label?.textContent).toBe('Error loading instances');

    dom.window.close();
  });

  it('boots product mode from instances and never calls the Roma starter route', async () => {
    const instances = [
      {
        publicId: 'wgt_curated_faq_simple',
        widgetname: 'faq',
        displayName: 'FAQ Simple',
      },
    ];
    const { dom, fetchMock } = await loadInstancesDom(instances, {
      fetch: { localWidgets: ['faq'] },
    });
    const label = dom.window.document.getElementById('current-instance-label');
    const menu = dom.window.document.getElementById('instance-dropdown-menu');

    expect(label?.textContent).toBe('FAQ Simple');
    expect(menu?.querySelectorAll('[data-public-id]').length).toBe(1);

    const urls = fetchMock.mock.calls.map(([input]) =>
      typeof input === 'string' ? input : input.toString(),
    );
    expect(urls.some((url) => url.includes('/api/devstudio/widgets'))).toBe(true);
    expect(urls.some((url) => url.includes('/api/widgets/faq/compiled'))).toBe(true);
    expect(
      urls.some(
        (url) =>
          url.includes('/api/devstudio/instances') &&
          !url.includes('/wgt_curated_faq_simple/l10n/status'),
      ),
    ).toBe(true);
    expect(urls.some((url) => url.includes('/api/roma/templates'))).toBe(false);

    dom.window.close();
  });

  it('passes DevStudio asset routes into the embedded Bob url', async () => {
    const instances = [
      {
        publicId: 'wgt_curated_faq_simple',
        widgetname: 'faq',
        displayName: 'FAQ Simple',
      },
    ];
    const { dom } = await loadInstancesDom(instances, {
      fetch: { localWidgets: ['faq'] },
    });
    const iframe = dom.window.document.getElementById('bob-iframe') as HTMLIFrameElement | null;
    const src = iframe?.getAttribute('src') || '';
    const parsed = new URL(src);

    expect(parsed.searchParams.has('surface')).toBe(false);
    expect(parsed.searchParams.get('assetApiBase')).toBe(
      'http://localhost:5173/api/devstudio/assets',
    );
    expect(parsed.searchParams.get('assetUploadEndpoint')).toBe(
      'http://localhost:5173/api/devstudio/assets/upload',
    );

    dom.window.close();
  });

  it('loads instance envelopes through explicit DevStudio instance routes', async () => {
    const instances = [
      {
        publicId: 'wgt_curated_faq_simple',
        widgetname: 'faq',
        displayName: 'FAQ Simple',
      },
    ];
    const { dom, fetchMock } = await loadInstancesDom(instances, {
      fetch: { localWidgets: ['faq'] },
    });
    const urls = fetchMock.mock.calls.map(([input]) =>
      typeof input === 'string' ? input : input.toString(),
    );
    expect(
      urls.some((url) =>
        url.includes(
          '/api/devstudio/instance?accountId=00000000-0000-0000-0000-000000000100&publicId=wgt_curated_faq_simple',
        ),
      ),
    ).toBe(true);
    expect(
      urls.some((url) =>
        url.includes(
          '/api/devstudio/instance/localization?accountId=00000000-0000-0000-0000-000000000100&publicId=wgt_curated_faq_simple',
        ),
      ),
    ).toBe(true);

    dom.window.close();
  });

  it('shows translations unavailable when status is unavailable', async () => {
    const instances = [
      {
        publicId: 'wgt_curated_faq_simple',
        widgetname: 'faq',
        displayName: 'FAQ Simple',
      },
    ];
    const { dom } = await loadInstancesDom(instances, {
      fetch: { localWidgets: ['faq'], devstudioL10nUnavailable: true },
    });
    const l10nValue = dom.window.document.getElementById('l10n-status-value');
    const l10nMeta = dom.window.document.getElementById('l10n-status-meta');

    expect(l10nValue?.textContent).toBe('Unavailable');
    expect(l10nMeta?.textContent).toBe('Translations status unavailable');

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
    const { dom, fetchMock } = await loadInstancesDom(instances, {
      fetch: { localWidgets: ['faq', 'logoshowcase'] },
    });
    const widgetSelect = dom.window.document.getElementById(
      'widget-select',
    ) as HTMLSelectElement | null;
    const menu = dom.window.document.getElementById('instance-dropdown-menu');

    expect(widgetSelect?.value).toBe('faq');
    expect(menu?.querySelectorAll('[data-public-id]').length).toBe(1);

    const initialUrls = fetchMock.mock.calls.map(([input]) =>
      typeof input === 'string' ? input : input.toString(),
    );
    expect(initialUrls.some((url) => url.includes('/api/widgets/faq/compiled'))).toBe(true);
    expect(initialUrls.some((url) => url.includes('/api/widgets/logoshowcase/compiled'))).toBe(
      false,
    );

    if (widgetSelect) {
      widgetSelect.value = 'logoshowcase';
      widgetSelect.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
    }
    await flushDom(dom, 2);

    const afterUrls = fetchMock.mock.calls.map(([input]) =>
      typeof input === 'string' ? input : input.toString(),
    );
    expect(afterUrls.some((url) => url.includes('/api/widgets/logoshowcase/compiled'))).toBe(true);

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

    const { dom } = await loadInstancesDom(instances, {
      fetch: {
        localWidgets: ['faq'],
        themes: [
          { id: 'light', label: 'Light' },
          { id: 'dark', label: 'Dark' },
        ],
      },
      profile: 'source',
      onBobPostMessage: (payload, origin, { dom: innerDom, bobWindow }) => {
        if (!payload || typeof payload !== 'object') return;
        const data = payload as { type?: string; requestId?: string };
        if (data.type !== 'host:export-instance-data') return;
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

    const updateThemeBtn = dom.window.document.getElementById('platform-update-theme');
    updateThemeBtn?.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
    await flushDom(dom, 4);

    const themeModal = dom.window.document.getElementById('theme-modal');
    const themeSelect = dom.window.document.getElementById(
      'theme-modal-select',
    ) as HTMLSelectElement | null;
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

    const { dom } = await loadInstancesDom(instances, {
      fetch: {
        localWidgets: ['faq'],
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
      profile: 'source',
      onBobPostMessage: (payload, origin, { dom: innerDom, bobWindow }) => {
        if (!payload || typeof payload !== 'object') return;
        const data = payload as { type?: string; requestId?: string };
        if (data.type !== 'host:export-instance-data') return;
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

    const updateThemeBtn = dom.window.document.getElementById('platform-update-theme');
    updateThemeBtn?.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
    await flushDom(dom, 3);

    const themeSelect = dom.window.document.getElementById(
      'theme-modal-select',
    ) as HTMLSelectElement | null;
    const themeConfirm = dom.window.document.getElementById('theme-modal-confirm');
    if (themeSelect) themeSelect.value = 'dark';
    themeConfirm?.dispatchEvent(new dom.window.Event('click', { bubbles: true }));
    await flushDom(dom, 4);

    expect(themeUpdatePayload).not.toBeNull();
    if (!themeUpdatePayload) {
      throw new Error('Expected theme update payload to be captured');
    }
    const payload: { themeId?: string; values?: Record<string, unknown> } = themeUpdatePayload;
    expect(payload.themeId).toBe('dark');
    expect(payload.values?.['stage.alignment']).toBe('center');
    expect(payload.values?.['typography.globalFamily']).toBe('Inter');
    expect(payload.values?.['typography.roles.button.weight']).toBe('600');
    expect(payload.values?.['appearance.ctaTextColor']).toEqual({
      type: 'color',
      color: 'var(--color-system-white)',
    });
    expect(payload.values?.['typography.roles.button.color']).toEqual({
      type: 'color',
      color: 'var(--color-system-white)',
    });
    expect(payload.values?.['typography.roles']).toBeUndefined();

    dom.window.close();
  });
});
