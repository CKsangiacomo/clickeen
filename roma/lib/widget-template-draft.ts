import { collectConfigMediaAssetRefs } from '@clickeen/ck-contracts';

export type WidgetTemplateDraftRequest =
  | { kind: 'account-template'; templateId: string }
  | { kind: 'catalog-template'; templateId: string };

export type CatalogTemplateDraftPreparation =
  | { kind: 'ready'; config: Record<string, unknown> }
  | { kind: 'asset-choice-required'; config: Record<string, unknown>; assetRefs: string[] };

export function resolveWidgetTemplateDraftRequest(args: {
  accountTemplateId: string;
  catalogTemplateId: string;
}): WidgetTemplateDraftRequest | null {
  const accountTemplateId = args.accountTemplateId.trim();
  const catalogTemplateId = args.catalogTemplateId.trim();
  if (Boolean(accountTemplateId) === Boolean(catalogTemplateId)) return null;
  return accountTemplateId
    ? { kind: 'account-template', templateId: accountTemplateId }
    : { kind: 'catalog-template', templateId: catalogTemplateId };
}

export function buildWidgetTemplateDraftRoute(request: WidgetTemplateDraftRequest): string {
  const key = request.kind === 'account-template' ? 'template' : 'catalogTemplate';
  return `/builder?${key}=${encodeURIComponent(request.templateId)}`;
}

export function prepareCatalogTemplateDraft(
  config: Record<string, unknown>,
): CatalogTemplateDraftPreparation {
  const assetRefs = collectConfigMediaAssetRefs(config);
  return assetRefs.length
    ? { kind: 'asset-choice-required', config, assetRefs }
    : { kind: 'ready', config };
}
