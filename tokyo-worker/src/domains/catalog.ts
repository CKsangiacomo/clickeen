import type { CatalogPresentation } from '@clickeen/ck-contracts/catalog';
import type { AccountPageTemplate } from '@clickeen/ck-contracts/pages';
import type { Env } from '../types';
import {
  listAccountInstanceIds,
  readAccountInstanceSource,
  readAccountInstanceSourcePointer,
} from './account-instances/source';
import { readInstancePublicPackage, type SubmittedInstancePublicPackage } from './account-instances/package-files';
import type { AccountInstanceContentDocument } from './account-instances/types';
import { listAccountPageSources, readAccountPageRecord } from './pages/source';
import type { PageGeneratedFiles } from './pages/types';

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

export type PageCatalogListItem = {
  pageId: string;
  displayName: string;
  catalogPresentation: CatalogPresentation;
};

export type PageCatalogTemplate = {
  source: AccountPageTemplate;
  files: PageGeneratedFiles;
};

export async function listClickeenPageCatalog(env: Env): Promise<PageCatalogListItem[]> {
  const listed = await listAccountPageSources({ env, accountId: CLICKEEN_CATALOG_ACCOUNT_ID });
  return listed.sources
    .filter((source): source is AccountPageTemplate => source.isTemplate)
    .map((source) => ({
      pageId: source.pageId,
      displayName: source.displayName,
      catalogPresentation: requirePresentation(source.catalogPresentation),
    }))
    .sort((left, right) => left.catalogPresentation.displayOrder - right.catalogPresentation.displayOrder || left.displayName.localeCompare(right.displayName) || left.pageId.localeCompare(right.pageId));
}

export async function readClickeenPageCatalogTemplate(env: Env, pageId: string): Promise<PageCatalogTemplate | null> {
  const stored = await readAccountPageRecord({ env, accountId: CLICKEEN_CATALOG_ACCOUNT_ID, pageId });
  if (!stored || !stored.source.isTemplate) return null;
  requirePresentation(stored.source.catalogPresentation);
  return { source: stored.source, files: stored.files };
}
