import type { RomaAccountAuthzCapsulePayload } from '@clickeen/ck-policy';

export type LocalePolicy = {
  baseLocale: string;
  readyLocales: string[];
  ip: {
    enabled: boolean;
    countryToLocale: Record<string, string>;
  };
  switcher: {
    enabled: boolean;
    alwaysShowLocale?: string;
  };
};

export type WidgetStatus = 'active' | 'locked_over_plan';

export type AccountWidgetDocument = {
  v: 1;
  accountId: string;
  widgetType: string;
  status: WidgetStatus;
  lockedReason: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AccountInstanceDocument = {
  v: 1;
  id: string;
  accountId: string;
  widgetType: string;
  displayName: string | null;
  meta?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  l10n?: {
    baseFingerprint: string;
    // Derived from Berlin account locale policy for this saved instance. The
    // saved base config remains the base-locale source; non-base locales use overlays.
    summary?: {
      baseLocale: string;
      desiredLocales: string[];
    };
    generationId?: string;
    status?: SavedRenderL10nStatus;
    readyLocales?: string[];
    failedLocales?: SavedRenderL10nFailure[];
    updatedAt?: string;
    startedAt?: string;
    finishedAt?: string;
    lastError?: string;
  };
};

export type PublishDocument = {
  v: 1;
  id: string;
  accountId: string;
  widgetType: string;
  status: InstanceServeState;
  configFp: string | null;
  localePolicy?: LocalePolicy;
  seoGeo?: boolean;
  updatedAt: string;
};

export type PublishedWidgetLookupDocument = {
  v: 1;
  id: string;
  accountId: string;
  widgetType: string;
  status: 'published';
  updatedAt: string;
};

export type LiveRenderPointer = {
  v: 1;
  id: string;
  widgetType: string;
  configFp: string;
  localePolicy: LocalePolicy;
  seoGeo?: {
    metaLiveBase: string;
    metaPacksBase: string;
  };
};

export type SavedRenderL10nStatus = 'queued' | 'working' | 'ready' | 'failed';

export type SavedRenderL10nFailure = {
  locale: string;
  reasonKey: string;
  detail?: string;
};

export type SavedRenderPointer = {
  v: 1;
  id: string;
  accountId: string;
  widgetType: string;
  displayName: string | null;
  meta?: Record<string, unknown> | null;
  configFp: string;
  updatedAt: string;
  l10n?: AccountInstanceDocument['l10n'];
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

export type L10nOverlayDocument = {
  v: 1;
  type: 'l10n';
  locale: string;
  baseFingerprint: string;
  status: SavedRenderL10nStatus;
  ops: Array<{ op: 'set'; path: string; value: string }>;
  textPack?: Record<string, string>;
  updatedAt: string;
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
  widgetType: string;
  configFp: string;
  configPack: unknown;
};

export type WriteTextPackJob = {
  v: 1;
  kind: 'write-text-pack';
  instanceId: string;
  accountId: string;
  locale: string;
  baseFingerprint: string;
  textPack: Record<string, string>;
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
  widgetType?: string;
  configFp?: string;
  localePolicy?: LocalePolicy;
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

export type SyncInstanceOverlaysJob = {
  v: 1;
  kind: 'sync-instance-overlays';
  instanceId: string;
  accountId: string;
  baseFingerprint: string;
  generationId: string;
  live: boolean;
  accountAuthz: {
    profile: RomaAccountAuthzCapsulePayload['profile'];
    role: RomaAccountAuthzCapsulePayload['role'];
    entitlements: RomaAccountAuthzCapsulePayload['entitlements'] | null;
  };
  baseLocale: string;
  desiredLocales: string[];
  countryToLocale: Record<string, string>;
  previousBaseFingerprint?: string | null;
};

export type TokyoMirrorQueueJob =
  | WriteConfigPackJob
  | WriteTextPackJob
  | WriteMetaPackJob
  | SyncLiveSurfaceJob
  | EnforceLiveSurfaceJob
  | DeleteInstanceMirrorJob
  | SyncInstanceOverlaysJob;
