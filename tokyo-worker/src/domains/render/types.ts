export type LocalePolicy = {
  baseLocale: string;
  ip: {
    enabled: boolean;
    countryToLocale: Record<string, string>;
  };
  switcher: {
    enabled: boolean;
    alwaysShowLocale?: string;
  };
};

export type AccountInstanceDocument = {
  v: 1;
  id: string;
  accountId: string;
  accountPublicId: string;
  widgetCode: string;
  widgetType: string;
  displayName: string | null;
  meta?: Record<string, unknown> | null;
  config: Record<string, unknown>;
  baseLocale: string;
  targetLocales: string[];
  embedBuildShape: {
    rendering: 'html' | 'iframe';
    seoMode: 'off' | 'lite' | 'full';
    locales: string[];
    clientSide: 'static' | 'minimal-js' | 'interactive';
  };
  publishStatus: InstanceServeState;
  createdAt: string;
  updatedAt: string;
};

export type AccountInstanceConfigDocument = {
  id: string;
  accountId: string;
  accountPublicId: string;
  widgetCode: string;
  widgetType: string;
  displayName: string | null;
  meta?: Record<string, unknown> | null;
  config: Record<string, unknown>;
  baseLocale: string;
  targetLocales: string[];
  embedBuildShape: AccountInstanceDocument['embedBuildShape'];
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

export type AccountInstanceContentDocument = {
  id: string;
  accountId: string;
  widgetType: string;
  fields: Record<string, {
    identityKey?: string;
    fieldPattern?: string;
    value: string;
    status: AccountInstanceContentFieldStatus;
    localeStatus?: Record<string, AccountInstanceContentFieldStatus>;
    translatedValues?: Record<string, string>;
  }>;
  updatedAt: string;
};

export type TranslationGenerationJobStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'superseded';

export type TranslationGenerationSummaryStatus =
  | 'idle'
  | TranslationGenerationJobStatus;

export type TranslationGenerationLocaleStatus =
  | 'queued'
  | 'completed'
  | 'failed'
  | 'superseded';

export type TranslationGenerationJobBasis = Array<{
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

export type TranslationGenerationLocaleState = {
  locale: string;
  status: TranslationGenerationLocaleStatus;
  paths: string[];
  updatedAt: string;
  reasonKey?: string;
  detail?: string;
};

export type TranslationGenerationJobDocument = {
  jobId: string;
  accountId: string;
  instanceId: string;
  widgetType: string;
  baseLocale: string;
  targetLocales: string[];
  status: TranslationGenerationJobStatus;
  requestedAt: string;
  updatedAt: string;
  totalLocales: number;
  completedLocales: string[];
  failedLocales: string[];
  supersededLocales: string[];
  pendingLocales: string[];
  currentReadyLocales: string[];
  locales: Record<string, TranslationGenerationLocaleState>;
  basis: TranslationGenerationJobBasis;
  previousJobId?: string;
  supersededJobIds?: string[];
  reasonKey?: string;
  detail?: string;
};

export type TranslationGenerationJobSummary = {
  instanceId: string;
  baseLocale: string;
  targetLocales: string[];
  status: TranslationGenerationSummaryStatus;
  requestedAt: string | null;
  updatedAt: string | null;
  totalLocales: number;
  completedLocales: string[];
  failedLocales: string[];
  supersededLocales: string[];
  pendingLocales: string[];
  currentReadyLocales: string[];
  jobId?: string;
  reasonKey?: string;
  detail?: string;
  locales?: Record<string, TranslationGenerationLocaleState>;
};

export type SavedRenderPointer = {
  v: 1;
  id: string;
  accountId: string;
  widgetCode: string;
  widgetType: string;
  displayName: string | null;
  meta?: Record<string, unknown> | null;
  publishStatus: InstanceServeState;
  updatedAt: string;
};

export type SavedRenderDocument = {
  pointer: SavedRenderPointer;
  config: Record<string, unknown>;
};

export type SavedRenderDocumentReadFailure = {
  ok: false;
  kind: 'NOT_FOUND' | 'VALIDATION';
  reasonKey: string;
};

export type SavedRenderDocumentReadResult =
  | {
      ok: true;
      value: SavedRenderDocument;
    }
  | SavedRenderDocumentReadFailure;

export type InstanceServeState = 'published' | 'unpublished';
