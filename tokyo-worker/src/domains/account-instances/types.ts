export type AccountInstanceDocument = {
  id: string;
  accountId: string;
  widgetType: string;
  displayName: string | null;
  config: Record<string, unknown>;
  baseLocale: string;
  publishStatus: InstanceServeState;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AccountInstanceConfigDocument = {
  id: string;
  accountId: string;
  widgetType: string;
  displayName: string | null;
  config: Record<string, unknown>;
  baseLocale: string;
  createdAt: string;
  updatedAt: string;
};

export type AccountInstanceSourceStorageDocument = AccountInstanceConfigDocument & {
  content: AccountInstanceContentDocument;
};

export type AccountInstanceSummary = {
  accountId: string;
  instanceId: string;
  widgetType: string;
  displayName: string;
  publishStatus: InstanceServeState;
  updatedAt: string;
};

export type AccountInstanceContentFieldStatus = 'ok' | 'changed';

export type LocaleOverlayDocument = {
  values: Record<string, string>;
};

export type AccountInstanceContentDocument = {
  id: string;
  accountId: string;
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

export type AccountInstanceSourcePointer = {
  id: string;
  accountId: string;
  widgetType: string;
  displayName: string | null;
  baseLocale: string;
  publishStatus: InstanceServeState;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

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
