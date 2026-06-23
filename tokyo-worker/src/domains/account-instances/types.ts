export type AccountInstanceDocument = {
    id: string;
  accountId: string;
  widgetCode: string;
  widgetType: string;
  displayName: string | null;
  meta?: Record<string, unknown> | null;
  config: Record<string, unknown>;
  baseLocale: string;
  publishStatus: InstanceServeState;
  createdAt: string;
  updatedAt: string;
};

export type AccountInstanceConfigDocument = {
  id: string;
  accountId: string;
  widgetCode: string;
  widgetType: string;
  displayName: string | null;
  meta?: Record<string, unknown> | null;
  config: Record<string, unknown>;
  baseLocale: string;
  publicPackageFingerprint?: string;
  createdAt: string;
  updatedAt: string;
};

export type AccountInstanceSummary = {
  accountId: string;
  instanceId: string;
  widgetCode: string;
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

export type AccountInstanceSourcePointer = {
    id: string;
  accountId: string;
  widgetCode: string;
  widgetType: string;
  displayName: string | null;
  meta?: Record<string, unknown> | null;
  baseLocale: string;
  publishStatus: InstanceServeState;
  publicPackageFingerprint?: string;
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
