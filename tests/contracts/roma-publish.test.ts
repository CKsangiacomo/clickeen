import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolvePolicy } from '@clickeen/ck-policy';

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('Roma publish/live contract', () => {
  it('publishes through the widget domain and then runs Tokyo live sync', async () => {
    const policy = resolvePolicy({ profile: 'tier1', role: 'editor' });
    const updateAccountInstanceStatusRow = vi.fn(async (_args: unknown) => ({
      ok: true,
      row: {
        publicId: 'wgt_publish_contract',
        displayName: 'FAQ',
        status: 'published',
        updatedAt: '2026-03-18T12:00:00.000Z',
        widgetId: 'wid_faq',
        accountId: '11111111-1111-1111-1111-111111111111',
        widgetType: 'faq',
      },
    }));
    const runAccountInstanceSync = vi.fn(async (_args: unknown) => undefined);

    vi.doMock('../../roma/app/api/account/_lib/current-account-route', () => ({
      resolveCurrentAccountRouteContext: vi.fn(async () => ({
        ok: true,
        value: {
          accessToken: 'access-token',
          authzToken: 'capsule-token',
          authzPayload: {
            userId: '0a5f59f9-27b9-4b31-bd2b-f3795ee9490a',
            accountId: '11111111-1111-1111-1111-111111111111',
            role: 'editor',
            profile: 'tier1',
            entitlements: {
              flags: policy.flags,
              caps: policy.caps,
              budgets: policy.budgets,
            },
          },
          setCookies: [],
        },
      })),
      withSession: vi.fn((_request: Request, response: Response) => response),
    }));
    vi.doMock('@roma/lib/account-instance-direct', () => ({
      loadTokyoPreferredAccountInstance: vi.fn(async () => ({
        ok: true,
        value: {
          row: {
            publicId: 'wgt_publish_contract',
            status: 'unpublished',
            accountId: '11111111-1111-1111-1111-111111111111',
            widgetType: 'faq',
          },
          config: {
            hero: {
              cta: { text: 'Start now' },
            },
          },
        },
      })),
    }));
    vi.doMock('@roma/lib/account-instance-sync', () => ({
      runAccountInstanceSync,
    }));
    vi.doMock('@roma/lib/michael', () => ({
      loadAccountPublishContainment: vi.fn(async () => ({
        ok: true,
        containment: { active: false, reason: null },
      })),
      countPublishedAccountInstances: vi.fn(async () => ({ ok: true, count: 0 })),
      updateAccountInstanceStatusRow,
    }));
    vi.doMock('@roma/lib/env/tokyo', () => ({
      resolveTokyoBaseUrl: vi.fn(() => 'https://tokyo.test'),
    }));

    const { POST } = await import(
      '../../roma/app/api/account/instances/[publicId]/publish/route'
    );
    const response = await POST(
      new Request(
        'https://roma.test/api/account/instances/wgt_publish_contract/publish',
        {
          method: 'POST',
        },
      ) as any,
      {
        params: Promise.resolve({ publicId: 'wgt_publish_contract' }),
      },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      publicId: 'wgt_publish_contract',
      status: 'published',
      changed: true,
    });
    expect(updateAccountInstanceStatusRow).toHaveBeenCalledWith({
      accountId: '11111111-1111-1111-1111-111111111111',
      publicId: 'wgt_publish_contract',
      status: 'published',
      berlinAccessToken: 'access-token',
    });
    expect(runAccountInstanceSync).toHaveBeenCalledWith({
      accessToken: 'access-token',
      accountId: '11111111-1111-1111-1111-111111111111',
      publicId: 'wgt_publish_contract',
      accountCapsule: 'capsule-token',
      live: true,
    });
  });

  it('rolls the status back if Tokyo live sync fails', async () => {
    const policy = resolvePolicy({ profile: 'tier1', role: 'editor' });
    const updateAccountInstanceStatusRow = vi.fn(async (args: { status: string }) => ({
      ok: true,
      row: {
        publicId: 'wgt_publish_contract',
        displayName: 'FAQ',
        status: args.status,
        updatedAt: '2026-03-18T12:00:00.000Z',
        widgetId: 'wid_faq',
        accountId: '11111111-1111-1111-1111-111111111111',
        widgetType: 'faq',
      },
    }));
    const runAccountInstanceSync = vi.fn(async () => {
      throw new Error('tokyo_sync_failed');
    });

    vi.doMock('../../roma/app/api/account/_lib/current-account-route', () => ({
      resolveCurrentAccountRouteContext: vi.fn(async () => ({
        ok: true,
        value: {
          accessToken: 'access-token',
          authzToken: 'capsule-token',
          authzPayload: {
            userId: '0a5f59f9-27b9-4b31-bd2b-f3795ee9490a',
            accountId: '11111111-1111-1111-1111-111111111111',
            role: 'editor',
            profile: 'tier1',
            entitlements: {
              flags: policy.flags,
              caps: policy.caps,
              budgets: policy.budgets,
            },
          },
          setCookies: [],
        },
      })),
      withSession: vi.fn((_request: Request, response: Response) => response),
    }));
    vi.doMock('@roma/lib/account-instance-direct', () => ({
      loadTokyoPreferredAccountInstance: vi.fn(async () => ({
        ok: true,
        value: {
          row: {
            publicId: 'wgt_publish_contract',
            status: 'unpublished',
            accountId: '11111111-1111-1111-1111-111111111111',
            widgetType: 'faq',
          },
          config: { hero: { cta: { text: 'Start now' } } },
        },
      })),
    }));
    vi.doMock('@roma/lib/account-instance-sync', () => ({
      runAccountInstanceSync,
    }));
    vi.doMock('@roma/lib/michael', () => ({
      loadAccountPublishContainment: vi.fn(async () => ({
        ok: true,
        containment: { active: false, reason: null },
      })),
      countPublishedAccountInstances: vi.fn(async () => ({ ok: true, count: 0 })),
      updateAccountInstanceStatusRow,
    }));
    vi.doMock('@roma/lib/env/tokyo', () => ({
      resolveTokyoBaseUrl: vi.fn(() => 'https://tokyo.test'),
    }));

    const { POST } = await import(
      '../../roma/app/api/account/instances/[publicId]/publish/route'
    );
    const response = await POST(
      new Request(
        'https://roma.test/api/account/instances/wgt_publish_contract/publish',
        {
          method: 'POST',
        },
      ) as any,
      {
        params: Promise.resolve({ publicId: 'wgt_publish_contract' }),
      },
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: {
        kind: 'UPSTREAM_UNAVAILABLE',
        reasonKey: 'coreui.errors.db.writeFailed',
        detail: 'tokyo_sync_failed',
      },
    });
    expect(updateAccountInstanceStatusRow).toHaveBeenNthCalledWith(1, {
      accountId: '11111111-1111-1111-1111-111111111111',
      publicId: 'wgt_publish_contract',
      status: 'published',
      berlinAccessToken: 'access-token',
    });
    expect(updateAccountInstanceStatusRow).toHaveBeenNthCalledWith(2, {
      accountId: '11111111-1111-1111-1111-111111111111',
      publicId: 'wgt_publish_contract',
      status: 'unpublished',
      berlinAccessToken: 'access-token',
    });
  });
});
