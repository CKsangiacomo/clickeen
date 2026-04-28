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

export type SavedRenderL10nStatus = 'queued' | 'working' | 'ready' | 'failed';

export type SavedRenderL10nFailure = {
  locale: string;
  reasonKey: string;
  detail?: string;
};

export type LiveRenderPointer = {
  v: 1;
  publicId: string;
  widgetType: string;
  configFp: string;
  localePolicy: LocalePolicy;
  l10n: {
    liveBase: string;
    packsBase: string;
  };
  seoGeo?: {
    metaLiveBase: string;
    metaPacksBase: string;
  };
};

export type SavedRenderPointer = {
  v: 1;
  publicId: string;
  accountId: string;
  widgetType: string;
  displayName: string | null;
  source: 'account' | 'curated';
  meta?: Record<string, unknown> | null;
  configFp: string;
  updatedAt: string;
  l10n?: {
    baseFingerprint: string;
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

export type L10nLivePointer = {
  v: 1;
  publicId: string;
  locale: string;
  textFp: string;
  baseFingerprint: string | null;
  updatedAt: string;
};

export type MetaLivePointer = {
  v: 1;
  publicId: string;
  locale: string;
  metaFp: string;
  updatedAt: string;
};

export type WriteConfigPackJob = {
  v: 1;
  kind: 'write-config-pack';
  publicId: string;
  accountId: string;
  widgetType: string;
  configFp: string;
  configPack: unknown;
};

export type WriteTextPackJob = {
  v: 1;
  kind: 'write-text-pack';
  publicId: string;
  accountId: string;
  locale: string;
  baseFingerprint: string;
  textPack: Record<string, string>;
};

export type WriteMetaPackJob = {
  v: 1;
  kind: 'write-meta-pack';
  publicId: string;
  accountId: string;
  locale: string;
  metaPack: Record<string, unknown>;
};

export type SyncLiveSurfaceJob = {
  v: 1;
  kind: 'sync-live-surface';
  publicId: string;
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
  publicId: string;
  accountId: string;
  localePolicy: LocalePolicy;
  seoGeo: boolean;
};

export type DeleteInstanceMirrorJob = {
  v: 1;
  kind: 'delete-instance-mirror';
  publicId: string;
  accountId: string;
};

export type SyncInstanceOverlaysJob = {
  v: 1;
  kind: 'sync-instance-overlays';
  publicId: string;
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
