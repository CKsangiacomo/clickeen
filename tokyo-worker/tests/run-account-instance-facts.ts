import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import {
  listAccountInstanceIds,
  readAccountInstanceSourcePointers,
} from '../src/domains/account-instances/source';
import {
  accountInstanceLocaleOverlayKey,
  accountInstanceLocaleOverlaysPrefix,
  accountInstanceRoot,
  accountInstanceServeStateKey,
  accountInstanceSourceKey,
} from '../src/domains/account-instances/keys';
import { tryHandleInternalInstanceRoutes } from '../src/routes/internal-instance-routes';
import type { TokyoRouteArgs } from '../src/route-helpers';
import type { Env } from '../src/types';

const workerPath = fileURLToPath(new URL('../src/index.ts', import.meta.url));

const workerBundle = await build({
  entryPoints: [workerPath],
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  write: false,
  plugins: [
    {
      name: 'accepted-roma-account-boundary',
      setup(buildApi) {
        buildApi.onResolve(
          { filter: /route-helpers$/ },
          () => ({ path: 'route-helpers', namespace: 'instance-facts-test' }),
        );
        buildApi.onLoad(
          { filter: /^route-helpers$/, namespace: 'instance-facts-test' },
          () => ({
            loader: 'js',
            contents: `
              export async function authorizeAccountInstanceControlRequest() {
                return null;
              }
              export async function authorizeRomaAccountScopedRequest() {
                return null;
              }
              export function isValidScopedInstance() {
                return true;
              }
              export function respondMethodNotAllowed(respond) {
                return respond(new Response(JSON.stringify({ error: 'METHOD_NOT_ALLOWED' }), {
                  status: 405,
                  headers: { 'content-type': 'application/json' },
                }));
              }
              export function respondValidation(respond, reasonKey, status = 422) {
                return respond(new Response(JSON.stringify({
                  error: { kind: 'VALIDATION', reasonKey },
                }), {
                  status,
                  headers: { 'content-type': 'application/json' },
                }));
              }
            `,
          }),
        );
      },
    },
  ],
});
const workerModule = await import(
  `data:text/javascript;base64,${Buffer.from(workerBundle.outputFiles[0].text).toString('base64')}`
);

class MemoryR2 {
  readonly objects = new Map<string, string>();
  readonly missingReads = new Set<string>();

  async get(key: string) {
    if (this.missingReads.has(key)) return null;
    const body = this.objects.get(key);
    if (body === undefined) return null;
    return {
      key,
      httpEtag: 'etag',
      json: async <T>() => JSON.parse(body) as T,
    };
  }

  async list(options?: R2ListOptions) {
    const prefix = options?.prefix ?? '';
    return {
      objects: Array.from(this.objects.keys())
        .filter((key) => key.startsWith(prefix))
        .map((key) => ({ key })),
      truncated: false,
      delimitedPrefixes: [],
    };
  }
}

const accountId = 'ACCOUNT1';
const r2 = new MemoryR2();
const env = {
  TOKYO_R2: r2 as unknown as R2Bucket,
  ACCOUNT_PUBLICATION_COORDINATOR: {} as DurableObjectNamespace,
} satisfies Env;

assert.equal(
  accountInstanceRoot(accountId, 'AAAAAAAAAA'),
  `accounts/${accountId}/instances/AAAAAAAAAA`,
);
assert.equal(
  accountInstanceSourceKey(accountId, 'AAAAAAAAAA'),
  `accounts/${accountId}/instances/AAAAAAAAAA/instance.source.json`,
);
assert.equal(
  accountInstanceServeStateKey(accountId, 'AAAAAAAAAA'),
  `accounts/${accountId}/instances/AAAAAAAAAA/serve-state.json`,
);
assert.equal(
  accountInstanceLocaleOverlayKey(accountId, 'AAAAAAAAAA', 'fr'),
  `accounts/${accountId}/instances/AAAAAAAAAA/overlays/locales/fr.json`,
);
assert.equal(
  accountInstanceLocaleOverlaysPrefix(accountId, 'AAAAAAAAAA'),
  `accounts/${accountId}/instances/AAAAAAAAAA/overlays/locales/`,
);

function seedInstance(args: {
  instanceId: string;
  widgetType: string;
  displayName: string | null;
  updatedAt: string;
  publishedAt?: string;
}): string {
  const root = `accounts/${accountId}/instances/${args.instanceId}`;
  const sourceKey = `${root}/instance.source.json`;
  r2.objects.set(
    sourceKey,
    JSON.stringify({
      id: args.instanceId,
      accountId,
      widgetType: args.widgetType,
      displayName: args.displayName,
      config: { core: { value: args.instanceId } },
      baseLocale: 'en',
      createdAt: '2026-08-20T00:00:00.000Z',
      updatedAt: args.updatedAt,
      content: {
        id: args.instanceId,
        accountId,
        fields: {},
        updatedAt: args.updatedAt,
      },
    }),
  );
  r2.objects.set(
    `${root}/serve-state.json`,
    JSON.stringify(
      args.publishedAt
        ? {
            accountId,
            instanceId: args.instanceId,
            status: 'published',
            publishedAt: args.publishedAt,
            publicPackage: {
              indexHtml: '<main></main>',
              stylesCss: '',
              runtimeJs: '',
            },
            updatedAt: args.publishedAt,
          }
        : {
            accountId,
            instanceId: args.instanceId,
            status: 'unpublished',
            updatedAt: args.updatedAt,
          },
    ),
  );
  return sourceKey;
}

const firstSourceKey = seedInstance({
  instanceId: 'AAAAAAAAAA',
  widgetType: 'faq',
  displayName: null,
  updatedAt: '2026-08-21T02:00:00.000Z',
});
const secondSourceKey = seedInstance({
  instanceId: 'BBBBBBBBBB',
  widgetType: 'cards',
  displayName: 'Cards instance',
  updatedAt: '2026-08-21T02:00:00.000Z',
  publishedAt: '2026-08-21T03:00:00.000Z',
});
seedInstance({
  instanceId: 'CCCCCCCCCC',
  widgetType: 'countdown',
  displayName: 'Countdown instance',
  updatedAt: '2026-08-21T04:00:00.000Z',
});
r2.objects.set(
  `accounts/${accountId}/instances/DDDDDDDDDD/serve-state.json`,
  JSON.stringify({ status: 'unpublished' }),
);

const instanceIds = await listAccountInstanceIds({ env, accountId });
assert.deepEqual(instanceIds, ['AAAAAAAAAA', 'BBBBBBBBBB', 'CCCCCCCCCC']);

const facts = await readAccountInstanceSourcePointers({ env, accountId, instanceIds });
assert.ok(facts.ok);
assert.deepEqual(
  facts.value.map((pointer) => ({
    accountId: pointer.accountId,
    instanceId: pointer.id,
    widgetType: pointer.widgetType,
    displayName: pointer.displayName,
    updatedAt: pointer.updatedAt,
    publishStatus: pointer.publishStatus,
    publishedAt: pointer.publishedAt,
  })),
  [
    {
      accountId,
      instanceId: 'CCCCCCCCCC',
      widgetType: 'countdown',
      displayName: 'Countdown instance',
      updatedAt: '2026-08-21T04:00:00.000Z',
      publishStatus: 'unpublished',
      publishedAt: null,
    },
    {
      accountId,
      instanceId: 'AAAAAAAAAA',
      widgetType: 'faq',
      displayName: null,
      updatedAt: '2026-08-21T02:00:00.000Z',
      publishStatus: 'unpublished',
      publishedAt: null,
    },
    {
      accountId,
      instanceId: 'BBBBBBBBBB',
      widgetType: 'cards',
      displayName: 'Cards instance',
      updatedAt: '2026-08-21T02:00:00.000Z',
      publishStatus: 'published',
      publishedAt: '2026-08-21T03:00:00.000Z',
    },
  ],
);

async function fetchAcceptedAccountFacts(
  selectedEnv: Env,
  pathAccountId = accountId,
  headerAccountId = accountId,
): Promise<Response> {
  return workerModule.default.fetch(
    new Request(
      `https://tokyo.internal/__internal/accounts/${pathAccountId}/instances/list-facts`,
      {
        headers: {
          'x-account-id': headerAccountId,
          'x-ck-internal-service': 'roma.edge',
        },
      },
    ),
    selectedEnv,
    { cache: undefined, waitUntil() {} },
  );
}

const aggregateResponse = await fetchAcceptedAccountFacts(env);
assert.equal(aggregateResponse.status, 200);
assert.deepEqual(await aggregateResponse.json(), {
  ok: true,
  accountId,
  instances: [
    {
      accountId,
      instanceId: 'CCCCCCCCCC',
      widgetType: 'countdown',
      displayName: 'Countdown instance',
      updatedAt: '2026-08-21T04:00:00.000Z',
      publishStatus: 'unpublished',
      publishedAt: null,
    },
    {
      accountId,
      instanceId: 'AAAAAAAAAA',
      widgetType: 'faq',
      displayName: null,
      updatedAt: '2026-08-21T02:00:00.000Z',
      publishStatus: 'unpublished',
      publishedAt: null,
    },
    {
      accountId,
      instanceId: 'BBBBBBBBBB',
      widgetType: 'cards',
      displayName: 'Cards instance',
      updatedAt: '2026-08-21T02:00:00.000Z',
      publishStatus: 'published',
      publishedAt: '2026-08-21T03:00:00.000Z',
    },
  ],
});

const emptyR2 = new MemoryR2();
const emptyEnv = {
  TOKYO_R2: emptyR2 as unknown as R2Bucket,
  ACCOUNT_PUBLICATION_COORDINATOR: {} as DurableObjectNamespace,
} satisfies Env;
const emptyResponse = await fetchAcceptedAccountFacts(emptyEnv);
assert.equal(emptyResponse.status, 200);
assert.deepEqual(await emptyResponse.json(), { ok: true, accountId, instances: [] });

const accountMismatchResponse = await fetchAcceptedAccountFacts(env, accountId, 'ACCOUNT2');
assert.equal(accountMismatchResponse.status, 403);

const malformedR2 = new MemoryR2();
malformedR2.objects.set(
  `accounts/${accountId}/instances/invalid/instance.source.json`,
  '{}',
);
const malformedEnv = {
  TOKYO_R2: malformedR2 as unknown as R2Bucket,
  ACCOUNT_PUBLICATION_COORDINATOR: {} as DurableObjectNamespace,
} satisfies Env;
const malformedResponse = await fetchAcceptedAccountFacts(malformedEnv);
assert.equal(malformedResponse.status, 422);
assert.deepEqual(await malformedResponse.json(), {
  error: {
    kind: 'VALIDATION',
    reasonKey: 'tokyo.errors.instance.malformedCoordinate',
    detail: `accounts/${accountId}/instances/invalid`,
    phase: 'account-instance-coordinate-enumeration',
  },
});

r2.missingReads.add(secondSourceKey);
const missing = await readAccountInstanceSourcePointers({ env, accountId, instanceIds });
assert.deepEqual(missing, {
  ok: false,
  kind: 'NOT_FOUND',
  reasonKey: 'coreui.errors.instance.notFound',
});
const missingResponse = await fetchAcceptedAccountFacts(env);
assert.equal(missingResponse.status, 404);
assert.deepEqual(await missingResponse.json(), {
  error: {
    kind: 'NOT_FOUND',
    reasonKey: 'coreui.errors.instance.notFound',
  },
});
r2.missingReads.delete(secondSourceKey);

const originalFirstSource = r2.objects.get(firstSourceKey);
assert.ok(originalFirstSource);
r2.objects.set(firstSourceKey, '{');
await assert.rejects(
  readAccountInstanceSourcePointers({ env, accountId, instanceIds }),
  /tokyo\.storage\.json_invalid:accounts\/ACCOUNT1\/instances\/AAAAAAAAAA\/instance\.source\.json/,
);
r2.objects.set(firstSourceKey, originalFirstSource);

const firstServeStateKey = `accounts/${accountId}/instances/AAAAAAAAAA/serve-state.json`;
const originalFirstServeState = r2.objects.get(firstServeStateKey);
assert.ok(originalFirstServeState);
r2.objects.set(firstServeStateKey, '{');
const corruptServeStateResponse = await fetchAcceptedAccountFacts(env);
assert.equal(corruptServeStateResponse.status, 500);
assert.deepEqual(await corruptServeStateResponse.json(), {
  error: {
    kind: 'INTERNAL',
    reasonKey: 'tokyo.errors.internal',
    detail: 'coreui.errors.instance.serveStateInvalid',
  },
});
r2.objects.set(firstServeStateKey, originalFirstServeState);

function routeArgs(request: Request): TokyoRouteArgs {
  const url = new URL(request.url);
  return {
    req: request,
    env,
    cache: undefined,
    waitUntil: () => undefined,
    pathname: url.pathname,
    url,
    respond: (response) => response,
  };
}

const methodResponse = await tryHandleInternalInstanceRoutes(
  routeArgs(
    new Request(
      `https://tokyo.internal/__internal/accounts/${accountId}/instances/list-facts`,
      { method: 'POST', headers: { 'x-account-id': accountId } },
    ),
  ),
);
assert.equal(methodResponse?.status, 405);

const authResponse = await tryHandleInternalInstanceRoutes(
  routeArgs(
    new Request(
      `https://tokyo.internal/__internal/accounts/${accountId}/instances/list-facts`,
      { headers: { 'x-account-id': accountId } },
    ),
  ),
);
assert.equal(authResponse?.status, 403);

console.log('PASS Tokyo returns complete, exact, deterministically ordered account instance facts');
