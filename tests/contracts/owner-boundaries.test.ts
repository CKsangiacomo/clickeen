import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BerlinBootstrapPayload } from '../../berlin/src/account-state.types';
import { resolvePolicy } from '@clickeen/ck-policy';
import type { AccountLocalizationSnapshot } from '@clickeen/ck-contracts';
import { buildL10nSnapshot, computeBaseFingerprint } from '@clickeen/l10n';
import type { LiveRenderPointer } from '../../tokyo-worker/src/domains/render';
import {
  l10nLivePointerKey,
  l10nTextPackKey,
  renderConfigPackKey,
  renderLivePointerKey,
} from '../../tokyo-worker/src/domains/render';
import {
  resolveAccountPolicyFromRomaAuthz,
  resolveActiveRomaAccount,
} from '../../roma/components/use-roma-me';

vi.mock('@clickeen/l10n/locales.json', () => ({
  default: ['en', 'fr', 'de'],
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

type StoredR2Object = {
  body: Uint8Array;
  httpMetadata?: {
    contentType?: string;
  };
};

function encodeBody(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (typeof value === 'string') return new TextEncoder().encode(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }
  return new TextEncoder().encode(JSON.stringify(value));
}

function createR2BucketStub() {
  const store = new Map<string, StoredR2Object>();

  const bucket = {
    async get(key: string) {
      const entry = store.get(key) ?? null;
      if (!entry) return null;
      return {
        body: entry.body,
        httpMetadata: entry.httpMetadata,
        async json() {
          return JSON.parse(new TextDecoder().decode(entry.body));
        },
        async text() {
          return new TextDecoder().decode(entry.body);
        },
      };
    },
    async head(key: string) {
      const entry = store.get(key) ?? null;
      if (!entry) return null;
      return {
        httpMetadata: entry.httpMetadata,
      };
    },
    async put(
      key: string,
      value: unknown,
      options?: {
        httpMetadata?: {
          contentType?: string;
        };
      },
    ) {
      store.set(key, {
        body: encodeBody(value),
        httpMetadata: options?.httpMetadata,
      });
    },
    async delete(keys: string | string[]) {
      const list = Array.isArray(keys) ? keys : [keys];
      for (const key of list) {
        store.delete(key);
      }
    },
    async list(options?: { prefix?: string; cursor?: string; limit?: number }) {
      const prefix = options?.prefix ?? '';
      const limit = options?.limit ?? 1000;
      const start = options?.cursor ? Number(options.cursor) : 0;
      const keys = [...store.keys()].filter((key) => key.startsWith(prefix)).sort();
      const slice = keys.slice(start, start + limit);
      const nextCursor = start + limit;
      return {
        objects: slice.map((key) => ({ key })),
        truncated: nextCursor < keys.length,
        cursor: nextCursor < keys.length ? String(nextCursor) : undefined,
      };
    },
  };

  return { bucket, store };
}

async function putJson(
  bucket: ReturnType<typeof createR2BucketStub>['bucket'],
  key: string,
  payload: unknown,
) {
  await bucket.put(key, JSON.stringify(payload), {
    httpMetadata: { contentType: 'application/json; charset=utf-8' },
  });
}

function createExecutionContextStub(): ExecutionContext {
  return {
    waitUntil() {},
    passThroughOnException() {},
  } as ExecutionContext;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
  delete process.env.TOKYO_URL;
  delete process.env.TOKYO_BASE_URL;
  delete process.env.NEXT_PUBLIC_TOKYO_URL;
});

describe('owner boundary contracts', () => {
  it('Berlin bootstrap authz payload remains consumable by Roma', () => {
    const policy = resolvePolicy({ profile: 'tier1', role: 'owner' });
    const activeAccount = {
      accountId: '11111111-1111-1111-1111-111111111111',
      role: 'owner' as const,
      name: 'Clickeen Labs',
      slug: 'clickeen-labs',
      status: 'active',
      isPlatform: false,
      tier: 'tier1' as const,
      websiteUrl: 'https://example.com',
      membershipVersion: 'membership-v3',
      lifecycleNotice: {
        tierChangedAt: null,
        tierChangedFrom: null,
        tierChangedTo: null,
        tierDropDismissedAt: null,
        tierDropEmailSentAt: null,
      },
      l10nLocales: ['en', 'fr'],
      l10nPolicy: {
        v: 1 as const,
        baseLocale: 'en',
        ip: {
          enabled: true,
          countryToLocale: { FR: 'fr' },
        },
        switcher: {
          enabled: true,
          locales: ['fr'],
        },
      },
    };
    const payload = {
      user: {
        id: '0a5f59f9-27b9-4b31-bd2b-f3795ee9490a',
        email: 'owner@example.com',
        role: 'authenticated',
      },
      profile: {
        userId: '0a5f59f9-27b9-4b31-bd2b-f3795ee9490a',
        primaryEmail: 'owner@example.com',
        emailVerified: true,
        givenName: 'Ada',
        familyName: 'Owner',
        primaryLanguage: 'en',
        country: 'US',
        timezone: 'America/Los_Angeles',
      },
      activeAccount,
      accounts: [activeAccount],
      defaults: {
        accountId: '11111111-1111-1111-1111-111111111111',
      },
      connectors: {
        linkedIdentities: [
          {
            identityId: 'google|owner@example.com',
            provider: 'google',
            providerSubject: 'owner@example.com',
          },
        ],
        traits: {
          linkedProviders: ['google'],
        },
      },
      authz: {
        accountCapsule: 'capsule-token',
        accountId: '11111111-1111-1111-1111-111111111111',
        role: 'owner',
        profile: 'tier1',
        authzVersion: 'membership-v3',
        issuedAt: '2026-03-18T12:00:00.000Z',
        expiresAt: '2026-03-18T12:15:00.000Z',
        entitlements: {
          flags: policy.flags,
          caps: policy.caps,
          budgets: policy.budgets,
        },
      },
    } satisfies BerlinBootstrapPayload;

    const resolvedActiveAccount = resolveActiveRomaAccount(payload);
    expect(resolvedActiveAccount).toMatchObject({
      accountId: activeAccount.accountId,
      role: activeAccount.role,
      name: activeAccount.name,
      slug: activeAccount.slug,
      tier: activeAccount.tier,
      l10nLocales: ['en', 'fr'],
    });

    const resolvedPolicy = resolveAccountPolicyFromRomaAuthz(
      payload,
      activeAccount.accountId,
    );
    expect(resolvedPolicy).toEqual({
      v: 1,
      profile: 'tier1',
      role: 'owner',
      flags: policy.flags,
      caps: policy.caps,
      budgets: policy.budgets,
    });

    expect(
      resolveAccountPolicyFromRomaAuthz(payload, '22222222-2222-2222-2222-222222222222'),
    ).toBeNull();
  });

  it('Roma builder-open envelope remains compatible with Tokyo saved-config and l10n snapshot contracts', async () => {
    const config = {
      hero: {
        title: 'Welcome',
        cta: {
          text: 'Start now',
        },
      },
    };
    const localization = {
      baseLocale: 'en',
      accountLocales: ['en', 'fr'],
      readyLocales: ['en', 'fr'],
      invalidAccountLocales: null,
      localeOverlays: [
        {
          locale: 'fr',
          source: 'agent',
          baseFingerprint: 'base-fp-1',
          baseUpdatedAt: '2026-03-18T12:00:00.000Z',
          hasUserOps: false,
          baseOps: [{ op: 'set', path: 'hero.cta.text', value: 'Commencer' }],
          userOps: [],
        },
      ],
      policy: {
        v: 1,
        baseLocale: 'en',
        ip: {
          enabled: true,
          countryToLocale: { FR: 'fr' },
        },
        switcher: {
          enabled: true,
          locales: ['fr'],
        },
      },
    } satisfies AccountLocalizationSnapshot;

    vi.doMock('../../roma/lib/account-instance-direct.ts', () => ({
      loadTokyoPreferredAccountInstance: vi.fn(async () => ({
        ok: true,
        value: {
          row: {
            publicId: 'wgt_123',
            displayName: 'Support FAQ',
            status: 'unpublished',
            accountId: '11111111-1111-1111-1111-111111111111',
            widgetType: 'faq',
          },
          config,
        },
      })),
    }));
    vi.doMock('../../roma/lib/account-localization-control.ts', () => ({
      loadAccountLocalizationSnapshot: vi.fn(async () => ({
        snapshot: localization,
        widgetType: 'faq',
        baseFingerprint: 'base-fp-1',
        saved: {
          config,
          updatedAt: '2026-03-18T12:00:00.000Z',
          published: false,
          seoGeoLive: false,
        },
      })),
    }));

    const { loadBuilderOpenEnvelope } = await import('../../roma/lib/builder-open');
    const result = await loadBuilderOpenEnvelope({
      berlinBaseUrl: 'https://berlin.test',
      tokyoBaseUrl: 'https://tokyo.test',
      accessToken: 'access-token',
      accountId: '11111111-1111-1111-1111-111111111111',
      publicId: 'wgt_123',
      accountCapsule: 'capsule-token',
    });

    expect(result).toEqual({
      ok: true,
      value: {
        accountId: '11111111-1111-1111-1111-111111111111',
        publicId: 'wgt_123',
        displayName: 'Support FAQ',
        ownerAccountId: '11111111-1111-1111-1111-111111111111',
        widgetType: 'faq',
        status: 'unpublished',
        config,
        localization,
      },
    });
  });

  it('Tokyo public and internal route headers enforce the new request boundary', async () => {
    const { default: tokyoWorker } = await import('../../tokyo-worker/src/index');
    const env = {
      ENV_STAGE: 'cloud-dev',
      TOKYO_DEV_JWT: 'dev-jwt',
      TOKYO_PUBLIC_BASE_URL: 'https://tokyo.test',
      TOKYO_R2: createR2BucketStub().bucket,
    } as any;
    const ctx = createExecutionContextStub();

    const publicResponse = await tokyoWorker.fetch(
      new Request('https://tokyo.test/healthz', { method: 'GET' }),
      env,
      ctx,
    );
    expect(publicResponse.status).toBe(200);
    expect(publicResponse.headers.get('access-control-allow-origin')).toBe('*');
    expect(publicResponse.headers.get('x-request-id')).toBeTruthy();

    const internalResponse = await tokyoWorker.fetch(
      new Request('https://tokyo.test/__internal/renders/instances/wgt_123/saved.json', {
        method: 'GET',
        headers: {
          'x-account-id': 'not-a-uuid',
        },
      }),
      env,
      ctx,
    );
    expect(internalResponse.status).toBe(422);
    expect(internalResponse.headers.get('access-control-allow-origin')).toBeNull();
    expect(internalResponse.headers.get('x-request-id')).toBeTruthy();
  });

  it('Tokyo saved-config control writes the canonical l10n fingerprint on save', async () => {
    const { default: tokyoWorker } = await import('../../tokyo-worker/src/index');
    const { bucket } = createR2BucketStub();
    const env = {
      ENV_STAGE: 'cloud-dev',
      TOKYO_DEV_JWT: 'dev-jwt',
      TOKYO_PUBLIC_BASE_URL: 'https://tokyo.test',
      TOKYO_R2: bucket,
    } as any;
    const ctx = createExecutionContextStub();
    const publicId = 'wgt_contract_u_owner';
    const accountId = '11111111-1111-1111-1111-111111111111';
    const config = {
      hero: {
        title: 'Welcome',
        cta: {
          text: 'Start now',
        },
      },
    };
    const allowlist = [{ path: 'hero.cta.text', type: 'string' as const }];
    const expectedBaseFingerprint = await computeBaseFingerprint(
      buildL10nSnapshot(config, allowlist),
    );

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = resolveUrl(input);
      if (url === 'https://tokyo.test/widgets/faq/localization.json') {
        return jsonResponse({ paths: allowlist });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await tokyoWorker.fetch(
      new Request(
        `https://tokyo.test/__internal/renders/instances/${publicId}/saved.json`,
        {
          method: 'PUT',
          headers: {
            authorization: 'Bearer dev-jwt',
            'content-type': 'application/json',
            'x-account-id': accountId,
            'x-ck-internal-service': 'devstudio.local',
          },
          body: JSON.stringify({
            widgetType: 'faq',
            displayName: 'Support FAQ',
            config,
          }),
        },
      ),
      env,
      ctx,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      publicId: string;
      accountId: string;
      widgetType: string;
      config: Record<string, unknown>;
      l10n?: { baseFingerprint?: string };
    };
    expect(body).toMatchObject({
      publicId,
      accountId,
      widgetType: 'faq',
      config,
    });
    expect(body.l10n?.baseFingerprint).toBe(expectedBaseFingerprint);

    const savedPointer = await bucket.get(
      `renders/instances/${publicId}/saved/r.json`,
    );
    expect(savedPointer).not.toBeNull();
    expect(
      (await savedPointer?.json()) as { l10n?: { baseFingerprint?: string } },
    ).toMatchObject({
      l10n: {
        baseFingerprint: expectedBaseFingerprint,
      },
    });

    const baseSnapshot = await bucket.get(
      `l10n/instances/${publicId}/bases/${expectedBaseFingerprint}.snapshot.json`,
    );
    expect(baseSnapshot).not.toBeNull();
  });

  it('Venice public instance route remains compatible with Tokyo-owned live public payload assembly', async () => {
    const { default: tokyoWorker } = await import('../../tokyo-worker/src/index');
    process.env.TOKYO_URL = 'https://tokyo.test';

    const publicId = 'wgt_main_faq';
    const config = {
      hero: {
        title: 'Welcome',
        cta: {
          text: 'Start now',
        },
      },
    };
    const allowlist = [{ path: 'hero.cta.text', type: 'string' as const }];
    const baseFingerprint = await computeBaseFingerprint(buildL10nSnapshot(config, allowlist));
    const livePointer = {
      v: 1,
      publicId,
      widgetType: 'faq',
      configFp: 'f'.repeat(64),
      localePolicy: {
        baseLocale: 'en',
        readyLocales: ['en', 'fr'],
        ip: {
          enabled: true,
          countryToLocale: { FR: 'fr', ZZ: 'de' },
        },
        switcher: {
          enabled: true,
          locales: ['fr', 'de'],
        },
      },
      l10n: {
        liveBase: `/l10n/instances/${publicId}/live`,
        packsBase: `/l10n/instances/${publicId}/packs`,
      },
    } satisfies LiveRenderPointer;

    const { bucket } = createR2BucketStub();
    await putJson(bucket, renderLivePointerKey(publicId), livePointer);
    await putJson(
      bucket,
      renderConfigPackKey(publicId, livePointer.configFp),
      { config },
    );
    await putJson(bucket, l10nLivePointerKey(publicId, 'fr'), {
      v: 1,
      publicId,
      locale: 'fr',
      textFp: 'a'.repeat(64),
      baseFingerprint,
      updatedAt: '2026-03-18T12:00:00.000Z',
    });
    await putJson(
      bucket,
      l10nTextPackKey(publicId, 'fr', 'a'.repeat(64)),
      {
        'hero.cta.text': 'Commencer',
      },
    );

    const env = {
      ENV_STAGE: 'cloud-dev',
      TOKYO_DEV_JWT: 'dev-jwt',
      TOKYO_PUBLIC_BASE_URL: 'https://tokyo.test',
      TOKYO_R2: bucket,
    } as any;
    const ctx = createExecutionContextStub();

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = resolveUrl(input);
      if (url === 'https://tokyo.test/widgets/faq/localization.json') {
        return jsonResponse({ paths: allowlist });
      }
      if (url === `https://tokyo.test/renders/instances/${publicId}/live/public-instance.json`) {
        return tokyoWorker.fetch(new Request(url, init), env, ctx);
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    vi.stubGlobal('fetch', fetchMock);

    const { GET } = await import('../../venice/app/api/instance/[publicId]/route');
    const response = await GET(new Request(`https://venice.test/api/instance/${publicId}`), {
      params: Promise.resolve({ publicId }),
    });
    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body).toMatchObject({
      publicId,
      status: 'published',
      widgetType: 'faq',
      config,
      baseFingerprint,
      localePolicy: {
        v: 1,
        baseLocale: 'en',
        ip: {
          enabled: true,
          countryToLocale: { FR: 'fr' },
        },
        switcher: {
          enabled: true,
          locales: ['fr'],
        },
      },
      localization: {
        baseLocale: 'en',
        accountLocales: ['fr'],
        readyLocales: ['en', 'fr'],
        invalidAccountLocales: null,
      },
    });
    expect(
      (body.localization as { localeOverlays: Array<Record<string, unknown>> }).localeOverlays,
    ).toEqual([
      {
        locale: 'fr',
        source: 'agent',
        baseFingerprint,
        baseUpdatedAt: '2026-03-18T12:00:00.000Z',
        hasUserOps: false,
        baseOps: [{ op: 'set', path: 'hero.cta.text', value: 'Commencer' }],
        userOps: [],
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      `https://tokyo.test/renders/instances/${publicId}/live/public-instance.json`,
      expect.objectContaining({
        method: 'GET',
      }),
    );
  });
});
