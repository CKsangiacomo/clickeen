import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolvePolicy, type RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';
import {
  handleGetAccountLocalizationSnapshot,
  handleGetAccountL10nStatus,
} from '../../tokyo-worker/src/domains/account-localization';
import { handleSyncAccountInstance } from '../../tokyo-worker/src/domains/account-instance-sync';
import { writeSavedRenderConfig } from '../../tokyo-worker/src/domains/render';
import { createR2BucketStub, jsonResponse, resolveUrl } from './helpers';

vi.mock('@clickeen/l10n/locales.json', () => ({
  default: ['en', 'fr', 'de'],
}));

const ACCOUNT_ID = '11111111-1111-1111-1111-111111111111';
const PUBLIC_ID = 'wgt_faq_u_contract';
const USER_ID = '0a5f59f9-27b9-4b31-bd2b-f3795ee9490a';

function buildAccountAuthz(): RomaAccountAuthzCapsulePayload {
  const policy = resolvePolicy({ profile: 'tier1', role: 'editor' });
  const nowSec = Math.floor(Date.now() / 1000);
  return {
    v: 1,
    typ: 'roma.account',
    iss: 'berlin',
    aud: 'roma',
    sub: USER_ID,
    userId: USER_ID,
    accountId: ACCOUNT_ID,
    accountStatus: 'active',
    accountIsPlatform: false,
    accountName: 'Clickeen Labs',
    accountSlug: 'clickeen-labs',
    accountWebsiteUrl: 'https://example.com',
    entitlements: {
      flags: policy.flags,
      caps: policy.caps,
      budgets: policy.budgets,
    },
    profile: 'tier1',
    role: 'editor',
    authzVersion: 'membership-v1',
    iat: nowSec,
    exp: nowSec + 900,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('Tokyo explicit l10n sync / ready truth contract', () => {
  it('marks locales dirty before sync and succeeded after explicit sync writes current artifacts', async () => {
    const { bucket } = createR2BucketStub();
    const env = {
      TOKYO_R2: bucket,
      TOKYO_PUBLIC_BASE_URL: 'https://tokyo.test',
      BERLIN_BASE_URL: 'https://berlin.test',
      SANFRANCISCO_BASE_URL: 'https://sf.test',
      CK_INTERNAL_SERVICE_JWT: 'internal-service-token',
    } as any;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = resolveUrl(input);
      if (url === 'https://tokyo.test/widgets/faq/localization.json') {
        return jsonResponse([
          { path: 'hero.title', type: 'string' },
          { path: 'hero.cta.text', type: 'string' },
        ]);
      }
      if (url === `https://berlin.test/v1/accounts/${ACCOUNT_ID}`) {
        return jsonResponse({
          account: {
            l10nLocales: ['fr'],
            l10nPolicy: {
              v: 1,
              baseLocale: 'en',
              ip: {
                enabled: true,
                countryToLocale: {
                  FR: 'fr',
                },
              },
              switcher: {
                enabled: true,
                locales: ['fr'],
              },
            },
          },
        });
      }
      if (url === 'https://sf.test/v1/l10n/account/ops/generate') {
        return jsonResponse({
          results: [
            {
              locale: 'fr',
              ops: [
                { op: 'set', path: 'hero.title', value: 'Bienvenue' },
                { op: 'set', path: 'hero.cta.text', value: 'Commencer' },
              ],
            },
          ],
        });
      }
      throw new Error(`unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    await writeSavedRenderConfig({
      env,
      publicId: PUBLIC_ID,
      accountId: ACCOUNT_ID,
      widgetType: 'faq',
      config: {
        hero: {
          title: 'Welcome',
          cta: {
            text: 'Start now',
          },
        },
      },
    });

    const statusBefore = await handleGetAccountL10nStatus(
      new Request('https://tokyo.test/__internal/l10n/instances/status', {
        headers: {
          authorization: 'Bearer berlin-access-token',
        },
      }),
      env,
      PUBLIC_ID,
      ACCOUNT_ID,
    );
    expect(statusBefore.status).toBe(200);
    expect(await statusBefore.json()).toMatchObject({
      publicId: PUBLIC_ID,
      locales: [
        {
          locale: 'fr',
          status: 'dirty',
          attempts: 0,
        },
      ],
    });

    const syncResponse = await handleSyncAccountInstance(
      new Request(`https://tokyo.test/__internal/renders/instances/${PUBLIC_ID}/sync`, {
        method: 'POST',
        headers: {
          authorization: 'Bearer berlin-access-token',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ live: false }),
      }),
      env,
      PUBLIC_ID,
      ACCOUNT_ID,
      buildAccountAuthz(),
    );
    expect(syncResponse.status).toBe(200);
    expect(await syncResponse.json()).toMatchObject({
      ok: true,
      publicId: PUBLIC_ID,
      live: false,
      readyLocales: ['en', 'fr'],
    });

    const statusAfter = await handleGetAccountL10nStatus(
      new Request('https://tokyo.test/__internal/l10n/instances/status', {
        headers: {
          authorization: 'Bearer berlin-access-token',
        },
      }),
      env,
      PUBLIC_ID,
      ACCOUNT_ID,
    );
    expect(statusAfter.status).toBe(200);
    expect(await statusAfter.json()).toMatchObject({
      publicId: PUBLIC_ID,
      locales: [
        {
          locale: 'fr',
          status: 'succeeded',
          attempts: 1,
        },
      ],
    });

    const snapshotResponse = await handleGetAccountLocalizationSnapshot(
      new Request('https://tokyo.test/__internal/l10n/instances/snapshot', {
        headers: {
          authorization: 'Bearer berlin-access-token',
        },
      }),
      env,
      PUBLIC_ID,
      ACCOUNT_ID,
    );
    expect(snapshotResponse.status).toBe(200);
    expect(await snapshotResponse.json()).toMatchObject({
      snapshot: {
        baseLocale: 'en',
        accountLocales: ['fr'],
        readyLocales: ['en', 'fr'],
        localeOverlays: [
          {
            locale: 'fr',
            hasUserOps: false,
          },
        ],
      },
    });
  });
});
