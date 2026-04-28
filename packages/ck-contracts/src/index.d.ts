export declare const WIDGET_PUBLIC_ID_MAIN_RE: RegExp;
export declare const WIDGET_PUBLIC_ID_CURATED_RE: RegExp;
export declare const WIDGET_PUBLIC_ID_USER_RE: RegExp;
export declare const WIDGET_PUBLIC_ID_RE: RegExp;
export declare const UUID_RE: RegExp;
export declare const ACCOUNT_ASSET_PATH_RE: RegExp;

export declare const WIDGET_PUBLIC_ID_CURATED_OR_MAIN_PATTERN: string;
export declare const ACCOUNT_ASSET_PATH_PATTERN: string;

export type WidgetPublicIdKind = 'main' | 'curated' | 'user';
export type AssetRefKind = 'account';
export type AssetRef = {
  accountId: string;
  assetId: string;
  kind: AssetRefKind;
  filename: string;
  key: string;
  pathname: string;
};

export type ResolvedAssetMaterialization = {
  assetId: string;
  assetRef: string;
  url: string;
};

export type AccountAssetRecord = {
  assetId: string;
  assetRef: string;
  assetType: string;
  filename: string;
  contentType: string;
  sizeBytes: number;
  createdAt: string;
};

export type ResolvedAccountAsset = {
  assetId: string;
  assetRef: string;
  url: string;
};

export type AccountAssetHostCommand = 'list-assets' | 'resolve-assets' | 'upload-asset';

export type AccountL10nPolicy = {
  v: 1;
  baseLocale: string;
  ip: {
    countryToLocale: Record<string, string>;
  };
};

export type LocalizationOp = { op: 'set'; path: string; value: string };

export type AccountOverlayEntry = {
  locale: string;
  source: string | null;
  baseFingerprint: string | null;
  baseUpdatedAt: string | null;
  hasUserOps: boolean;
  baseOps: LocalizationOp[];
  userOps: LocalizationOp[];
};

export type AccountLocalizationSnapshot = {
  baseLocale: string;
  accountLocales: string[];
  readyLocales: string[];
  invalidAccountLocales: string | null;
  localeOverlays: AccountOverlayEntry[];
  policy: AccountL10nPolicy;
};

export type WidgetLocaleSwitcherSettings = {
  enabled: boolean;
  byIp: boolean;
  alwaysShowLocale: string | null;
  attachTo: 'pod' | 'stage';
  position:
    | 'top-left'
    | 'top-center'
    | 'top-right'
    | 'right-middle'
    | 'bottom-right'
    | 'bottom-center'
    | 'bottom-left'
    | 'left-middle';
};

export type AccountL10nValidationIssue = {
  path: string;
  message: string;
};

export declare const CK_ERROR_CODE: Readonly<{
  VALIDATION: 'VALIDATION';
  NOT_FOUND: 'NOT_FOUND';
  DENY: 'DENY';
  INTERNAL: 'INTERNAL';
}>;

export declare const INSTANCE_PUBLISH_STATUS: Readonly<{
  PUBLISHED: 'published';
  UNPUBLISHED: 'unpublished';
}>;

export declare const RENDER_SNAPSHOT_ACTION: Readonly<{
  UPSERT: 'upsert';
  DELETE: 'delete';
}>;

export declare function normalizeWidgetPublicId(raw: unknown): string | null;
export declare function classifyWidgetPublicId(raw: unknown): WidgetPublicIdKind | null;
export declare function isWidgetPublicId(raw: unknown): raw is string;
export declare function isMainWidgetPublicId(raw: unknown): boolean;
export declare function isCuratedWidgetPublicId(raw: unknown): boolean;
export declare function isCuratedOrMainWidgetPublicId(raw: unknown): boolean;
export declare function isUserWidgetPublicId(raw: unknown): boolean;
export declare function isUuid(raw: unknown): boolean;
export declare function normalizeAccountAssetRecord(raw: unknown): AccountAssetRecord | null;
export declare function normalizeResolvedAccountAsset(raw: unknown): ResolvedAccountAsset | null;
export declare function parseAccountAssetRef(raw: unknown): AssetRef | null;
export declare function parseAccountAssetBlobKey(raw: unknown): AssetRef | null;
export declare function isAccountAssetRef(raw: unknown): boolean;
export declare function isAccountAssetBlobKey(raw: unknown): boolean;
export declare function toAccountAssetPublicPath(assetKey: unknown): string | null;
export declare function parseAccountLocaleListStrict(value: unknown): string[];
export declare function parseAccountL10nPolicyStrict(raw: unknown): AccountL10nPolicy;
export declare function normalizeLocalizationOps(raw: unknown): LocalizationOp[];
export declare function validateAccountLocaleList(
  value: unknown,
  path?: string,
  options?: { allowNull?: boolean },
): AccountL10nValidationIssue[];
export declare function validateAccountL10nPolicy(
  raw: unknown,
  path?: string,
): AccountL10nValidationIssue[];
export declare function normalizeWidgetLocaleSwitcherSettings(raw: unknown): WidgetLocaleSwitcherSettings;
export declare function collectConfigMediaAssetIds(config: unknown): string[];
export declare function materializeConfigMedia(
  config: unknown,
  resolvedAssets:
    | Map<string, { assetId?: unknown; assetRef?: unknown; url?: unknown }>
    | Record<string, { assetId?: unknown; assetRef?: unknown; url?: unknown } | undefined>
    | null
    | undefined,
): unknown;
export declare function configNonPersistableUrlIssues(
  config: unknown,
): Array<{ path: string; message: string }>;

export * from './user-settings-geo.js';
