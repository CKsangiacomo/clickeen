import type { CatalogPresentation } from '@clickeen/ck-contracts/catalog';
import type { Env } from '../types';
import {
  listAccountInstanceIds,
  readAccountInstanceSource,
  readAccountInstanceSourcePointer,
} from './account-instances/source';
import { readInstancePublicPackage, type SubmittedInstancePublicPackage } from './account-instances/package-files';
import type { AccountInstanceContentDocument } from './account-instances/types';

export const CLICKEEN_CATALOG_ACCOUNT_ID = 'CLICKEEN';

export class CatalogReadError extends Error {
  status: number;
  reasonKey: string;

  constructor(status: number, reasonKey: string) {
    super(reasonKey);
    this.name = 'CatalogReadError';
    this.status = status;
    this.reasonKey = reasonKey;
  }
}

function requirePresentation(value: CatalogPresentation | undefined): CatalogPresentation {
  if (!value) throw new CatalogReadError(422, 'tokyo.errors.catalog.presentationMissing');
  return value;
}

function requireTemplateName(value: string | null): string {
  if (!value) throw new CatalogReadError(422, 'tokyo.errors.catalog.templateNameMissing');
  return value;
}

export type WidgetCatalogListItem = {
  templateId: string;
  templateName: string;
  widgetType: string;
  updatedAt: string;
  catalogPresentation: CatalogPresentation;
};

export type WidgetCatalogTemplate = WidgetCatalogListItem & {
  isTemplate: true;
  source: { config: Record<string, unknown>; content: AccountInstanceContentDocument };
  publicPackage: SubmittedInstancePublicPackage;
};

export async function listClickeenWidgetCatalog(env: Env): Promise<WidgetCatalogListItem[]> {
  const ids = await listAccountInstanceIds({ env, accountId: CLICKEEN_CATALOG_ACCOUNT_ID });
  const entries = await Promise.all(ids.map(async (templateId) => {
    const pointer = await readAccountInstanceSourcePointer({
      env,
      accountId: CLICKEEN_CATALOG_ACCOUNT_ID,
      instanceId: templateId,
    });
    if (!pointer.ok) throw new CatalogReadError(422, pointer.reasonKey);
    if (!pointer.value.isTemplate) return null;
    return {
      templateId,
      templateName: requireTemplateName(pointer.value.displayName),
      widgetType: pointer.value.widgetType,
      updatedAt: pointer.value.updatedAt,
      catalogPresentation: requirePresentation(pointer.value.catalogPresentation),
    } satisfies WidgetCatalogListItem;
  }));
  return entries
    .filter((entry): entry is WidgetCatalogListItem => entry !== null)
    .sort((left, right) => left.catalogPresentation.displayOrder - right.catalogPresentation.displayOrder || left.templateName.localeCompare(right.templateName) || left.templateId.localeCompare(right.templateId));
}

export async function readClickeenWidgetCatalogTemplate(env: Env, templateId: string): Promise<WidgetCatalogTemplate | null> {
  const stored = await readAccountInstanceSource({
    env,
    accountId: CLICKEEN_CATALOG_ACCOUNT_ID,
    instanceId: templateId,
  });
  if (!stored.ok) {
    if (stored.kind === 'NOT_FOUND') return null;
    throw new CatalogReadError(422, stored.reasonKey);
  }
  if (!stored.value.pointer.isTemplate) return null;
  const publicPackage = await readInstancePublicPackage({
    env,
    accountId: CLICKEEN_CATALOG_ACCOUNT_ID,
    instanceId: templateId,
  });
  if (!publicPackage) throw new CatalogReadError(422, 'tokyo.errors.catalog.packageMissing');
  return {
    templateId,
    templateName: requireTemplateName(stored.value.pointer.displayName),
    widgetType: stored.value.pointer.widgetType,
    updatedAt: stored.value.pointer.updatedAt,
    isTemplate: true,
    catalogPresentation: requirePresentation(stored.value.pointer.catalogPresentation),
    source: { config: stored.value.config, content: stored.value.content },
    publicPackage,
  };
}
