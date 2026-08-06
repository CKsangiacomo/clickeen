import assert from 'node:assert/strict';
import {
  createAccountInstanceFromSubmittedSource,
  deleteAccountInstanceTransition,
  publishAccountInstanceTransition,
  saveAccountInstanceTransition,
  unpublishAccountInstanceTransition,
} from '../src/domains/account-instances/operations';
import {
  listAccountInstanceIds,
  readAccountInstanceDocument,
  readAccountInstanceSource,
  renameAccountInstanceDisplay,
} from '../src/domains/account-instances/source';
import {
  listAccountInstanceTranslatedLocaleValues,
  readAccountInstanceTranslatedLocaleValues,
  writeAccountInstanceTranslatedLocaleValues,
} from '../src/domains/account-translations/values';
import { tryHandleClkLiveStaticRoutes } from '../src/routes/clk-live-routes';

type Stored = {
  body: string;
  httpMetadata?: { contentType?: string };
  httpEtag: string;
};

function createEnv() {
  const objects = new Map<string, Stored>();
  return {
    objects,
    env: {
      TOKYO_R2: {
        async put(key: string, body: string | Uint8Array, options?: { httpMetadata?: { contentType?: string } }) {
          const text = typeof body === 'string' ? body : new TextDecoder().decode(body);
          objects.set(key, {
            body: text,
            httpMetadata: options?.httpMetadata,
            httpEtag: `etag-${objects.size + 1}`,
          });
          return {};
        },
        async get(key: string) {
          const stored = objects.get(key);
          if (!stored) return null;
          return {
            body: new Response(stored.body).body,
            httpMetadata: stored.httpMetadata,
            httpEtag: stored.httpEtag,
            async text() { return stored.body; },
            async json() { return JSON.parse(stored.body); },
          };
        },
        async list(options?: { prefix?: string }) {
          const prefix = options?.prefix ?? '';
          return {
            objects: [...objects.keys()].filter((key) => key.startsWith(prefix)).map((key) => ({ key })),
            truncated: false,
          };
        },
        async delete(keys: string | string[]) {
          for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key);
        },
      },
      PUBLIC_SERVING_BASE_URL: 'https://dev.clk.live',
      CLOUDFLARE_ZONE_ID: 'zone',
      CLOUDFLARE_CACHE_PURGE_TOKEN: 'token',
    } as any,
  };
}

const accountId = 'CLICKEEN';
const templateId = 'TMPL123456';
const ordinaryId = 'ORDN123456';
const templateRoot = `accounts/${accountId}/instances/${templateId}`;
const ordinaryRoot = `accounts/${accountId}/instances/${ordinaryId}`;
const publicPackage = {
  indexHtml: '<!doctype html><html><body>Template</body></html>',
  stylesCss: '.template{}',
  runtimeJs: 'window.__template = true;',
};
const presentation = {
  thumbnailAssetRef: '/assets/account/CLICKEEN/widget-template.png',
  description: 'Reusable Widget template',
  category: 'Featured',
  displayOrder: 1,
};

const store = createEnv();
const env = store.env;

await createAccountInstanceFromSubmittedSource({
  env,
  accountId,
  instanceId: templateId,
  widgetType: 'cards',
  displayName: 'Cards template',
  config: { seoGeoAeoEnabled: true },
  content: { id: templateId, accountId, widgetType: 'cards', fields: {}, updatedAt: '2026-08-06T00:00:00.000Z' },
  isTemplate: true,
  catalogPresentation: presentation,
  publicPackage,
});

assert.deepEqual(
  [...store.objects.keys()].filter((key) => key.startsWith(`${templateRoot}/`)).sort(),
  [
    `${templateRoot}/index.html`,
    `${templateRoot}/instance.config.json`,
    `${templateRoot}/instance.content.json`,
    `${templateRoot}/runtime.js`,
    `${templateRoot}/styles.css`,
  ],
  'Widget template roots must contain only source/content and the exact three files',
);
const storedTemplateConfig = JSON.parse(store.objects.get(`${templateRoot}/instance.config.json`)!.body);
assert.equal(storedTemplateConfig.isTemplate, true);
assert.equal('baseLocale' in storedTemplateConfig, false);
assert.deepEqual(storedTemplateConfig.catalogPresentation, presentation);
assert.equal('catalogPresentation' in storedTemplateConfig.config, false);

const template = await readAccountInstanceSource({ env, accountId, instanceId: templateId });
assert.equal(template.ok, true);
if (!template.ok) throw new Error(template.reasonKey);
assert.equal(template.value.pointer.isTemplate, true);
assert.equal('baseLocale' in template.value.pointer, false);
assert.equal('publishStatus' in template.value.pointer, false);
assert.deepEqual(template.value.pointer.catalogPresentation, presentation);

const templateDocument = await readAccountInstanceDocument({ env, accountId, instanceId: templateId });
assert.equal(templateDocument.ok, true);
if (!templateDocument.ok) throw new Error(templateDocument.reasonKey);
assert.equal(templateDocument.value.isTemplate, true);
assert.equal('baseLocale' in templateDocument.value, false);
assert.equal('publishStatus' in templateDocument.value, false);

assert.deepEqual(await listAccountInstanceIds({ env, accountId }), [templateId]);
await renameAccountInstanceDisplay({ env, accountId, instanceId: templateId, displayName: 'Renamed template' });
const renamed = await readAccountInstanceSource({ env, accountId, instanceId: templateId });
assert.ok(renamed.ok && renamed.value.pointer.isTemplate);
assert.equal(renamed.ok ? renamed.value.pointer.displayName : '', 'Renamed template');

await saveAccountInstanceTransition({
  env,
  accountId,
  instanceId: templateId,
  submittedWidgetType: 'cards',
  config: { seoGeoAeoEnabled: false },
  content: { id: templateId, accountId, widgetType: 'cards', fields: {}, updatedAt: '2026-08-06T01:00:00.000Z' },
  publicPackage: { ...publicPackage, stylesCss: '.template{display:block}' },
  displayName: 'Renamed template',
  isTemplate: true,
  catalogPresentation: presentation,
  hasDisplayName: true,
});
assert.equal(store.objects.has(`${templateRoot}/serve-state.json`), false);
assert.equal(store.objects.get(`${templateRoot}/styles.css`)?.body, '.template{display:block}');

await assert.rejects(
  saveAccountInstanceTransition({
    env,
    accountId,
    instanceId: templateId,
    submittedWidgetType: 'cards',
    config: {},
    content: { id: templateId, accountId, widgetType: 'cards', fields: {}, updatedAt: '2026-08-06T02:00:00.000Z' },
    publicPackage,
    isTemplate: false,
    baseLocale: 'en',
    hasDisplayName: false,
  }),
  /coreui\.errors\.instance\.templateMismatch/,
);
await assert.rejects(publishAccountInstanceTransition({ env, accountId, instanceId: templateId }), /templatePublicForbidden/);
await assert.rejects(unpublishAccountInstanceTransition({ env, accountId, instanceId: templateId }), /templatePublicForbidden/);
await assert.rejects(
  writeAccountInstanceTranslatedLocaleValues({ env, accountId, instanceId: templateId, locale: 'fr', values: {} }),
  /template_forbidden/,
);
await assert.rejects(
  listAccountInstanceTranslatedLocaleValues({ env, accountId, instanceId: templateId }),
  /template_forbidden/,
);
await assert.rejects(
  readAccountInstanceTranslatedLocaleValues({ env, accountId, instanceId: templateId, locale: 'fr' }),
  /template_forbidden/,
);

const publicResponse = await tryHandleClkLiveStaticRoutes({
  req: new Request(`https://dev.clk.live/${accountId}/${templateId}`),
  env,
  pathname: `/${accountId}/${templateId}`,
  url: new URL(`https://dev.clk.live/${accountId}/${templateId}`),
  respond: (response) => response,
});
assert.equal(publicResponse?.status, 404, 'clk.live must not serve template package files');

await createAccountInstanceFromSubmittedSource({
  env,
  accountId,
  instanceId: ordinaryId,
  widgetType: 'cards',
  displayName: 'Cards',
  config: {},
  content: { id: ordinaryId, accountId, widgetType: 'cards', fields: {}, updatedAt: '2026-08-06T00:00:00.000Z' },
  isTemplate: false,
  baseLocale: 'en',
  publicPackage,
});
assert.equal(store.objects.has(`${ordinaryRoot}/serve-state.json`), true);
const ordinaryConfig = JSON.parse(store.objects.get(`${ordinaryRoot}/instance.config.json`)!.body);
assert.equal(ordinaryConfig.isTemplate, false, 'every new ordinary write must persist the discriminator');
assert.equal(ordinaryConfig.baseLocale, 'en');
await assert.rejects(
  saveAccountInstanceTransition({
    env,
    accountId,
    instanceId: ordinaryId,
    submittedWidgetType: 'cards',
    config: {},
    content: { id: ordinaryId, accountId, widgetType: 'cards', fields: {}, updatedAt: '2026-08-06T02:00:00.000Z' },
    publicPackage,
    isTemplate: true,
    hasDisplayName: false,
  }),
  /coreui\.errors\.instance\.templateMismatch/,
);

const malformedConfig = { ...ordinaryConfig };
delete malformedConfig.isTemplate;
await env.TOKYO_R2.put(`${ordinaryRoot}/instance.config.json`, JSON.stringify(malformedConfig), {
  httpMetadata: { contentType: 'application/json; charset=utf-8' },
});
await assert.rejects(
  readAccountInstanceSource({ env, accountId, instanceId: ordinaryId }),
  /coreui\.errors\.instance\.config\.invalid/,
  'missing isTemplate must fail instead of becoming an ordinary Instance',
);

await deleteAccountInstanceTransition({ env, accountId, instanceId: templateId });
assert.equal([...store.objects.keys()].some((key) => key.startsWith(`${templateRoot}/`)), false);
assert.equal([...store.objects.keys()].some((key) => key.startsWith(`${ordinaryRoot}/`)), true);

console.log('Widget template contract verification passed.');
