export declare const WIDGET_PUBLIC_ID_MAIN_RE: RegExp;
export declare const WIDGET_PUBLIC_ID_CURATED_RE: RegExp;
export declare const WIDGET_PUBLIC_ID_USER_RE: RegExp;
export declare const WIDGET_PUBLIC_ID_RE: RegExp;
export declare const UUID_RE: RegExp;
export declare const ASSET_VERSION_PATH_RE: RegExp;

export declare const WIDGET_PUBLIC_ID_CURATED_OR_MAIN_PATTERN: string;
export declare const ASSET_VERSION_PATH_PATTERN: string;

export type WidgetPublicIdKind = 'main' | 'curated' | 'user';
export type AssetRefKind = 'version';
export type AssetRef = {
  accountId: string;
  assetId: string;
  kind: AssetRefKind;
  pathname: string;
  versionToken: string;
  versionKey: string;
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
export declare function parseCanonicalAssetRef(raw: unknown): AssetRef | null;
export declare function isCanonicalAssetVersionRef(raw: unknown): boolean;
export declare function isCanonicalAssetRef(raw: unknown): boolean;
export declare function toCanonicalAssetVersionPath(versionKey: unknown): string | null;
