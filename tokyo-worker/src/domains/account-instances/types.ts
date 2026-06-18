export type {
  TranslationGenerationSummaryStatus,
  TranslationProductLocaleState,
  TranslationGenerationSummary as TranslationGenerationOperationSummary,
} from '@clickeen/ck-contracts/translation-product-state';

export type AccountInstanceDocument = {
  v: 1;
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

export type LocaleOverlayStatus = 'inSync' | 'outOfSync' | 'failed';

export type LocaleOverlayDocument = {
  v: 1;
  locale: string;
  baseContentMarker: string;
  widgetContractHash: string;
  status: LocaleOverlayStatus;
  values: Record<string, string>;
  updatedAt: string;
  reasonKey?: string;
  detail?: string;
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

export type TranslationGenerationOperationStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'superseded';

export type TranslationGenerationLocaleStatus = 'queued' | 'completed' | 'failed' | 'superseded';

export type TranslationGenerationOperationBasis = Array<{
  locale: string;
  widgetContract?: {
    schemaVersion: 1;
    hash: string;
  };
  fields: Array<{
    identityKey?: string;
    fieldPattern?: string;
    path: string;
    baseText: string;
  }>;
}>;

export type TranslationGenerationOperationLocaleState = {
  locale: string;
  status: TranslationGenerationLocaleStatus;
  paths: string[];
  updatedAt: string;
  reasonKey?: string;
  detail?: string;
};

export type TranslationGenerationOperationDocument = {
  jobId: string;
  baseContentMarker?: string;
  generationRequestMarker?: string;
  accountId: string;
  instanceId: string;
  widgetType: string;
  baseLocale: string;
  targetLocales: string[];
  status: TranslationGenerationOperationStatus;
  requestedAt: string;
  updatedAt: string;
  totalLocales: number;
  completedLocales: string[];
  failedLocales: string[];
  supersededLocales: string[];
  pendingLocales: string[];
  currentReadyLocales: string[];
  locales: Record<string, TranslationGenerationOperationLocaleState>;
  basis: TranslationGenerationOperationBasis;
  reasonKey?: string;
  detail?: string;
};

export type AccountInstanceSourcePointer = {
  v: 1;
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
