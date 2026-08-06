import type { CatalogPresentation } from '@clickeen/ck-contracts/catalog';

type AccountInstanceIdentity = {
  id: string;
  accountId: string;
  widgetCode: string;
  widgetType: string;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AccountInstanceDocument = AccountInstanceIdentity & {
  config: Record<string, unknown>;
} & ({
  isTemplate: false;
  baseLocale: string;
  publishStatus: InstanceServeState;
  catalogPresentation?: never;
} | {
  isTemplate: true;
  baseLocale?: never;
  publishStatus?: never;
  catalogPresentation?: CatalogPresentation;
});

export type AccountInstanceConfigDocument = AccountInstanceIdentity & {
  config: Record<string, unknown>;
} & ({
  isTemplate: false;
  baseLocale: string;
  catalogPresentation?: never;
} | {
  isTemplate: true;
  baseLocale?: never;
  catalogPresentation?: CatalogPresentation;
});

type AccountInstanceSummaryIdentity = {
  accountId: string;
  instanceId: string;
  widgetCode: string;
  widgetType: string;
  displayName: string;
  updatedAt: string;
};

export type AccountInstanceSummary = AccountInstanceSummaryIdentity & ({
  isTemplate: false;
  publishStatus: InstanceServeState;
} | {
  isTemplate: true;
  publishStatus?: never;
  catalogPresentation?: CatalogPresentation;
});

export type AccountInstanceContentFieldStatus = 'ok' | 'changed';

export type LocaleOverlayDocument = {
    values: Record<string, string>;
};

export type AccountInstanceContentDocument = {
  id: string;
  accountId: string;
  widgetType: string;
  fields: Record<
    string,
    {
      identityKey?: string;
      fieldPattern?: string;
      value: string;
      status: AccountInstanceContentFieldStatus;
    }
  >;
  updatedAt: string;
};

type AccountInstanceSourcePointerIdentity = {
  id: string;
  accountId: string;
  widgetCode: string;
  widgetType: string;
  displayName: string | null;
  updatedAt: string;
};

export type AccountInstanceSourcePointer = AccountInstanceSourcePointerIdentity & ({
  isTemplate: false;
  baseLocale: string;
  publishStatus: InstanceServeState;
} | {
  isTemplate: true;
  baseLocale?: never;
  publishStatus?: never;
  catalogPresentation?: CatalogPresentation;
});

export type AccountInstanceSourceDocument = {
  pointer: AccountInstanceSourcePointer;
  config: Record<string, unknown>;
  content: AccountInstanceContentDocument;
};

export type AccountInstanceSourceReadFailure = {
  ok: false;
  kind: 'NOT_FOUND' | 'VALIDATION';
  reasonKey: string;
};

export type AccountInstanceSourceReadResult =
  | {
      ok: true;
      value: AccountInstanceSourceDocument;
    }
  | AccountInstanceSourceReadFailure;

export type InstanceServeState = 'published' | 'unpublished';
