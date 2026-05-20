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

export type PublishedOverlayProjection = {
  languages: Record<string, string>;
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
  publishStatus: InstanceServeState;
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
    value: string;
    status: AccountInstanceContentFieldStatus;
    localeStatus?: Record<string, AccountInstanceContentFieldStatus>;
    translatedValues?: Record<string, string>;
  }>;
  updatedAt: string;
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

export type AccountInstanceIndexEntry = {
  accountId: string;
  id: string;
  widgetCode: string;
  widgetType: string;
  displayName: string;
  publishStatus: InstanceServeState;
  updatedAt: string;
};

export type AccountInstanceIndexDocument = {
  v: 1;
  accountId: string;
  entries: AccountInstanceIndexEntry[];
  updatedAt: string;
};

export type OverlayObjectDocument = {
  v: 1;
  values: Record<string, unknown>;
};

export type SelectedOverlayPointerDocument = {
  v: 1;
  overlayId: string;
};
