import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  buildWidgetTemplateDraftRoute,
  prepareCatalogTemplateDraft,
  resolveWidgetTemplateDraftRequest,
} from '../lib/widget-template-draft';

async function readRoma(path: string): Promise<string> {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

async function main() {
assert.deepEqual(
  resolveWidgetTemplateDraftRequest({ accountTemplateId: 'ABC1234567', catalogTemplateId: '' }),
  { kind: 'account-template', templateId: 'ABC1234567' },
);
assert.deepEqual(
  resolveWidgetTemplateDraftRequest({ accountTemplateId: '', catalogTemplateId: 'ZYX9876543' }),
  { kind: 'catalog-template', templateId: 'ZYX9876543' },
);
assert.equal(resolveWidgetTemplateDraftRequest({ accountTemplateId: '', catalogTemplateId: '' }), null);
assert.equal(
  resolveWidgetTemplateDraftRequest({ accountTemplateId: 'ABC1234567', catalogTemplateId: 'ZYX9876543' }),
  null,
);
assert.equal(
  buildWidgetTemplateDraftRoute({ kind: 'account-template', templateId: 'A B' }),
  '/builder?template=A%20B',
);
assert.equal(
  buildWidgetTemplateDraftRoute({ kind: 'catalog-template', templateId: 'A B' }),
  '/builder?catalogTemplate=A%20B',
);

const assetFreeConfig = { content: { title: 'Hello' } };
assert.deepEqual(prepareCatalogTemplateDraft(assetFreeConfig), {
  kind: 'ready',
  config: assetFreeConfig,
});

const assetConfig = {
  background: {
    type: 'image',
    image: { assetRef: 'hero.png' },
  },
};
assert.deepEqual(prepareCatalogTemplateDraft(assetConfig), {
  kind: 'asset-choice-required',
  config: assetConfig,
  assetRefs: ['hero.png'],
});

const [builderOpen, builderDomain, builderPage, instanceRoute] = await Promise.all([
  readRoma('lib/builder-open.ts'),
  readRoma('components/builder-domain.tsx'),
  readRoma('app/(authed)/builder/page.tsx'),
  readRoma('app/api/account/instances/[instanceId]/route.ts'),
]);
assert.match(builderOpen, /isTemplate: instance\.value\.row\.isTemplate/);
assert.match(builderDomain, /searchParams\.get\('template'\)/);
assert.match(builderDomain, /searchParams\.get\('catalogTemplate'\)/);
assert.match(builderDomain, /\/api\/account\/widget-catalog\/\$\{encodeURIComponent\(templateDraftRequest\.templateId\)\}/);
assert.match(builderDomain, /if \(!source\.isTemplate\) throw new Error\('coreui\.errors\.payload\.invalid'\)/);
assert.match(builderDomain, /isTemplate: false/);
assert.match(builderDomain, /templateDraft: true as const/);
assert.match(builderDomain, /resolveCanSaveAsTemplate/);
assert.match(builderDomain, /templateDraftRequest && !\(await resolveHasWidgetCapacity\(\)\)/);
assert.match(builderDomain, /setUpsellReason\("You've reached your plan limit\."\)/);
assert.match(builderDomain, /data\.action === 'save-as-template'/);
assert.match(builderDomain, /\/save-as-template`/);
assert.match(builderDomain, />Open template<\/span>/);
assert.match(builderDomain, /bobAppliedInstanceIdRef\.current = ''/);
assert.match(builderDomain, /prepared\.kind === 'asset-choice-required'/);
assert.doesNotMatch(builderDomain, /duplicate=\$\{encodeURIComponent\(template/);
const openDraftBody = builderDomain.slice(
  builderDomain.indexOf('const openDraftInBob ='),
  builderDomain.indexOf('const openActiveInstanceInBobRef ='),
);
assert.doesNotMatch(openDraftBody, /fetchRaw|method:\s*'POST'|update-instance/);
assert.match(builderPage, /catalogTemplate\?: string \| string\[\]/);
assert.match(instanceRoute, /isTemplate !== true && isTemplate !== false/);
assert.match(instanceRoute, /loadTokyoAccountInstanceSourceSnapshot/);
assert.match(instanceRoute, /savedSource\.value\.row\.isTemplate !== isTemplate/);
assert.match(instanceRoute, /if \(!isTemplate\) \{/);
assert.match(instanceRoute, /isTemplate,\s+\.\.\.\(baseLocale \?/s);
assert.match(instanceRoute, /savedSource\.value\.row\.catalogPresentation/);

console.log('PASS Widget template Builder uses explicit saved-edit and unsaved-draft modes');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
