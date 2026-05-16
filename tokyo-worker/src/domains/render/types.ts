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

export type InstanceGenerationStatus =
  | 'not_generated'
  | 'queued'
  | 'building'
  | 'ready'
  | 'stale'
  | 'failed'
  | 'unavailable';

export type InstanceGenerationLane = {
  status: InstanceGenerationStatus;
  sourceVersion: number;
  requestedAt?: string;
  updatedAt: string;
  error?: string;
  files?: string[];
  startedAt?: string;
  finishedAt?: string;
  blockingReason?: string;
};

export type InstanceGenerationState = {
  translations: InstanceGenerationLane;
  embed: InstanceGenerationLane;
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
  sourceVersion: number;
  generation: InstanceGenerationState;
  publishStatus: InstanceServeState;
  createdAt: string;
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
  sourceVersion: number;
  generation: InstanceGenerationState;
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

export type DeleteInstanceMirrorJob = {
  v: 1;
  kind: 'delete-instance-mirror';
  instanceId: string;
  accountId: string;
};

export type TokyoMirrorQueueJob = DeleteInstanceMirrorJob;
