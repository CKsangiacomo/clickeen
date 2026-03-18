import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import faqSpecJson from '../../tokyo/widgets/faq/spec.json';

type FaqSpec = {
  defaults: Record<string, unknown>;
};

function cloneFaqDefaults() {
  return structuredClone((faqSpecJson as FaqSpec).defaults);
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('FAQ authoring boundary contracts', () => {
  it('rejects malformed FAQ config before save', async () => {
    vi.doMock('@clickeen/l10n/locales.json', () => ({
      default: ['en', 'fr', 'de'],
    }));
    const { validatePersistableConfig } = await import('../../roma/lib/account-instance-direct');
    const config = cloneFaqDefaults();
    (config.sections as Array<Record<string, unknown>>)[0].faqs = [
      {
        id: 'faq-bad',
        question: 'Broken',
        answer: 'Broken',
        defaultOpen: 'yes',
      },
    ];

    const result = validatePersistableConfig(
      config,
      '11111111-1111-1111-1111-111111111111',
      'faq',
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected validation failure');
    }
    expect(result.status).toBe(422);
    expect(result.error.reasonKey).toBe('coreui.errors.config.invalid');
    expect(result.error.paths).toContain('config.sections[0].faqs[0].defaultOpen');
  });

  it('rejects malformed saved FAQ config before builder open trusts it', async () => {
    vi.doMock('@clickeen/l10n/locales.json', () => ({
      default: ['en', 'fr', 'de'],
    }));
    const savedConfig = cloneFaqDefaults();
    (savedConfig.sections as Array<Record<string, unknown>>)[0].faqs = [
      {
        id: 'faq-bad',
        question: 'Broken',
        answer: 'Broken',
        defaultOpen: 'yes',
      },
    ];

    vi.doMock('../../roma/lib/tokyo-product-control', () => ({
      buildTokyoProductControlHeaders: vi.fn(() => new Headers()),
      fetchTokyoProductControl: vi.fn(async () =>
        jsonResponse({
          publicId: 'wgt_curated_faq_bad',
          accountId: '11111111-1111-1111-1111-111111111111',
          widgetType: 'faq',
          displayName: 'Broken FAQ',
          source: 'curated',
          meta: null,
          updatedAt: '2026-03-18T12:00:00.000Z',
          config: savedConfig,
        }),
      ),
    }));

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 404 })),
    );

    const { loadTokyoPreferredAccountInstance } = await import('../../roma/lib/account-instance-direct');
    const result = await loadTokyoPreferredAccountInstance({
      accountId: '11111111-1111-1111-1111-111111111111',
      publicId: 'wgt_curated_faq_bad',
      tokyoBaseUrl: 'https://tokyo.example.com',
      tokyoControlBaseUrl: 'https://tokyo-control.example.com',
      tokyoAccessToken: 'token',
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected validation failure');
    }
    expect(result.status).toBe(422);
    expect(result.error.reasonKey).toBe('coreui.errors.instance.config.invalid');
    expect(result.error.paths).toContain('config.sections[0].faqs[0].defaultOpen');
  });

  it('keeps canonical non-runtime FAQ fields persistable at the save/open boundary', async () => {
    vi.doMock('@clickeen/l10n/locales.json', () => ({
      default: ['en', 'fr', 'de'],
    }));
    const { validatePersistableConfig } = await import('../../roma/lib/account-instance-direct');
    const config = cloneFaqDefaults();
    (config.context as Record<string, unknown>).websiteUrl = 'https://venicewave.it';
    (config.appearance as Record<string, unknown>).theme = 'museum';

    const result = validatePersistableConfig(
      config,
      '11111111-1111-1111-1111-111111111111',
      'faq',
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('expected FAQ config with canonical non-runtime fields to remain persistable');
    }
    expect((result.value.config.context as Record<string, unknown>).websiteUrl).toBe('https://venicewave.it');
    expect((result.value.config.appearance as Record<string, unknown>).theme).toBe('museum');
  });

  it('fails closed on unsupported widget spec versions before compiling', async () => {
    vi.doMock('next/server', () => ({
      NextResponse: {
        json(body: unknown, init?: { status?: number; headers?: HeadersInit }) {
          return new Response(JSON.stringify(body), {
            status: init?.status ?? 200,
            headers: init?.headers,
          });
        },
      },
    }));
    vi.doMock('../../bob/lib/compiler.server', () => ({
      compileWidgetServer: vi.fn(async () => {
        throw new Error('compile should not run for unsupported spec versions');
      }),
    }));

    vi.doMock('../../bob/lib/compiler/assets', () => ({
      requireTokyoUrl: vi.fn(() => 'https://tokyo.example.com'),
    }));

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = typeof input === 'string' ? input : input.toString();
        if (url.endsWith('/widgets/faq/spec.json')) {
          return jsonResponse({
            v: 2,
            widgetname: 'faq',
            defaults: {},
            html: ["<bob-panel id='content'></bob-panel>"],
            normalization: { idRules: [], coerceRules: [] },
          });
        }
        if (url.endsWith('/widgets/faq/limits.json')) {
          return new Response('', { status: 404 });
        }
        return new Response('not found', { status: 404 });
      }),
    );

    const { GET } = await import('../../bob/app/api/widgets/[widgetname]/compiled/route');
    const response = await GET(
      {
        nextUrl: new URL('https://bob.example.com/api/widgets/faq/compiled'),
        headers: new Headers(),
      } as any,
      {
      params: Promise.resolve({ widgetname: 'faq' }),
      },
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      error: '[Bob] Unsupported widget spec version for faq',
    });
  });

  it('keeps the FAQ content panel literal inside spec.json', () => {
    const faqSpec = faqSpecJson as FaqSpec & { html: unknown[] };
    expect(Array.isArray(faqSpec.html)).toBe(true);
    expect(faqSpec.html[0]).toBe("<bob-panel id='content'>");
    expect(
      faqSpec.html.some((line) => typeof line === 'string' && line.includes("<tooldrawer-field-content-sections")),
    ).toBe(true);
    expect(
      faqSpec.html.some((line) => typeof line === 'string' && line.includes('@include:')),
    ).toBe(false);
  });

  it('keeps authoring-only FAQ metadata out of runtime dependencies', () => {
    const widgetRuntime = readFileSync(new URL('../../tokyo/widgets/faq/widget.client.js', import.meta.url), 'utf8');
    expect(widgetRuntime).not.toContain('state.context.websiteUrl');
    expect(widgetRuntime).not.toContain('appearance.theme');
  });
});
