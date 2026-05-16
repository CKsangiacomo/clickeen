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
  widgetCode: string;
  widgetType: string;
  displayName: string | null;
  meta?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type PublishDocument = {
  v: 1;
  id: string;
  accountId: string;
  widgetCode: string;
  widgetType: string;
  status: InstanceServeState;
  configFp: string | null;
  localePolicy?: LocalePolicy;
  overlays?: PublishedOverlayProjection;
  seoGeo?: boolean;
  updatedAt: string;
};

export type LiveRenderPointer = {
  v: 1;
  id: string;
  widgetCode: string;
  widgetType: string;
  configFp: string;
  localePolicy: LocalePolicy;
  overlays?: PublishedOverlayProjection;
  seoGeo?: {
    metaLiveBase: string;
    metaPacksBase: string;
  };
};

export type SavedRenderPointer = {
  v: 1;
  id: string;
  accountId: string;
  widgetCode: string;
  widgetType: string;
  displayName: string | null;
  meta?: Record<string, unknown> | null;
  configFp: string;
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

export type MetaLivePointer = {
  v: 1;
  id: string;
  locale: string;
  metaFp: string;
  updatedAt: string;
};

export type WriteConfigPackJob = {
  v: 1;
  kind: 'write-config-pack';
  instanceId: string;
  accountId: string;
  widgetCode: string;
  configFp: string;
  configPack: unknown;
};

export type WriteMetaPackJob = {
  v: 1;
  kind: 'write-meta-pack';
  instanceId: string;
  accountId: string;
  locale: string;
  metaPack: Record<string, unknown>;
};

export type SyncLiveSurfaceJob = {
  v: 1;
  kind: 'sync-live-surface';
  instanceId: string;
  accountId: string;
  live: boolean;
  widgetCode?: string;
  widgetType?: string;
  configFp?: string;
  localePolicy?: LocalePolicy;
  overlays?: PublishedOverlayProjection;
  seoGeo?: boolean;
};

export type EnforceLiveSurfaceJob = {
  v: 1;
  kind: 'enforce-live-surface';
  instanceId: string;
  accountId: string;
  localePolicy: LocalePolicy;
  seoGeo: boolean;
};

export type DeleteInstanceMirrorJob = {
  v: 1;
  kind: 'delete-instance-mirror';
  instanceId: string;
  accountId: string;
};

export type TokyoMirrorQueueJob =
  | WriteConfigPackJob
  | WriteMetaPackJob
  | SyncLiveSurfaceJob
  | EnforceLiveSurfaceJob
  | DeleteInstanceMirrorJob;
