import { isUuid, isWidgetPublicId, parseCanonicalAssetRef, toCanonicalAssetVersionPath } from '@clickeen/ck-contracts';

type EditorAssetUploadContext = {
  accountId: string;
  publicId?: string;
  widgetType?: string;
};

type UploadSource = 'api' | 'devstudio' | 'bob.publish' | 'bob.export' | 'promotion';

type UploadEditorAssetArgs = {
  file: File;
  source?: UploadSource;
  context?: EditorAssetUploadContext;
  endpoint?: string;
};

export type EditorAssetIdentity = {
  accountId: string;
  assetId: string;
};

export type EditorAssetUploadResult = {
  assetId: string;
  assetRef: string;
  url: string;
  assetType: string;
  contentType: string;
  sizeBytes: number;
  filename: string;
  createdAt: string;
};

function isPublicId(value: string): boolean {
  return isWidgetPublicId(value);
}

function isWidgetType(value: string): boolean {
  return /^[a-z0-9][a-z0-9_-]*$/i.test(value);
}

function readDatasetValue(name: string): string {
  if (typeof document === 'undefined') return '';
  const value = (document.documentElement.dataset as any)?.[name];
  return typeof value === 'string' ? value.trim() : '';
}

function resolveAssetUploadEndpoint(): string {
  return readDatasetValue('ckAssetUploadEndpoint').trim();
}

function isAccountScopedRomaUploadEndpoint(value: string): boolean {
  return /\/api\/accounts\/[0-9a-f-]{36}\/assets\/upload(?:\?|$)/i.test(value);
}

function isDevStudioUploadEndpoint(value: string): boolean {
  return /\/api\/devstudio\/assets\/upload(?:\?|$)/i.test(value);
}

function resolveContextFromDocument(): EditorAssetUploadContext | null {
  const accountId = readDatasetValue('ckOwnerAccountId');
  const publicId = readDatasetValue('ckPublicId');
  const widgetType = readDatasetValue('ckWidgetType');

  if (!accountId || !isUuid(accountId)) return null;

  const context: EditorAssetUploadContext = {
    accountId,
  };

  if (publicId && isPublicId(publicId)) context.publicId = publicId;
  if (widgetType && isWidgetType(widgetType)) context.widgetType = widgetType.toLowerCase();
  return context;
}

function safeJsonParse(text: string): unknown | null {
  if (!text || typeof text !== 'string') return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function normalizeAssetUrl(payload: Record<string, unknown>): string | null {
  const direct = typeof payload.url === 'string' ? payload.url.trim() : '';
  if (!direct) return null;
  const parsed = parseCanonicalAssetRef(direct);
  if (!parsed || parsed.kind !== 'version') return null;
  if (/^https?:\/\//i.test(direct)) return direct;
  return parsed.pathname;
}

function normalizeAssetRef(payload: Record<string, unknown>): string | null {
  const direct = typeof payload.assetRef === 'string' ? payload.assetRef.trim() : '';
  if (!direct) return null;
  const parsed = parseCanonicalAssetRef(direct);
  if (!parsed || parsed.kind !== 'version') return null;
  return parsed.versionKey;
}

function assertUploadContext(context: EditorAssetUploadContext): EditorAssetUploadContext {
  const accountId = String(context.accountId || '').trim();
  const publicId = String(context.publicId || '').trim();
  const widgetType = String(context.widgetType || '').trim().toLowerCase();
  if (!isUuid(accountId)) {
    throw new Error('coreui.errors.accountId.invalid');
  }
  if (publicId && !isPublicId(publicId)) {
    throw new Error('coreui.errors.publicId.invalid');
  }
  if (widgetType && !isWidgetType(widgetType)) {
    throw new Error('coreui.errors.widgetType.invalid');
  }
  return {
    accountId,
    publicId: publicId || undefined,
    widgetType: widgetType || undefined,
  };
}

export function parseEditorAssetIdentity(raw: string): EditorAssetIdentity | null {
  const parsed = parseCanonicalAssetRef(raw);
  if (!parsed || parsed.kind !== 'version') return null;
  return { accountId: parsed.accountId, assetId: parsed.assetId };
}

export async function uploadEditorAsset(args: UploadEditorAssetArgs): Promise<EditorAssetUploadResult> {
  const file = args.file;
  if (!(file instanceof File) || file.size <= 0) {
    throw new Error('coreui.errors.payload.empty');
  }

  const context = assertUploadContext(args.context ?? resolveContextFromDocument() ?? ({} as EditorAssetUploadContext));
  const source = args.source || 'api';
  const endpoint = (
    args.endpoint ||
    resolveAssetUploadEndpoint() ||
    `/api/accounts/${encodeURIComponent(context.accountId)}/assets/upload`
  ).trim();
  if (!isAccountScopedRomaUploadEndpoint(endpoint) && !isDevStudioUploadEndpoint(endpoint)) {
    throw new Error('coreui.errors.assets.uploadEndpoint.invalid');
  }

  const headers = new Headers();
  headers.set('content-type', file.type || 'application/octet-stream');
  if (isDevStudioUploadEndpoint(endpoint)) {
    headers.set('x-account-id', context.accountId);
  }
  headers.set('x-filename', file.name || 'upload.bin');
  headers.set('x-source', source);
  headers.set('x-clickeen-surface', isDevStudioUploadEndpoint(endpoint) ? 'devstudio' : 'roma-assets');
  if (context.publicId) headers.set('x-public-id', context.publicId);
  if (context.widgetType) headers.set('x-widget-type', context.widgetType);

  const response = await fetch(`${endpoint.replace(/\/$/, '')}?_t=${Date.now()}`, {
    method: 'POST',
    headers,
    body: file,
  });
  const text = await response.text().catch(() => '');
  const payload = safeJsonParse(text);

  if (!response.ok) {
    const errorRecord =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? ((payload as Record<string, unknown>).error as Record<string, unknown> | undefined)
        : undefined;
    const reasonKey = typeof errorRecord?.reasonKey === 'string' ? errorRecord.reasonKey : '';
    const detail = typeof errorRecord?.detail === 'string' ? errorRecord.detail : '';
    throw new Error(reasonKey || detail || `coreui.errors.assets.uploadFailed (${response.status})`);
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('coreui.errors.assets.uploadFailed');
  }
  const payloadRecord = payload as Record<string, unknown>;
  const assetId = typeof payloadRecord.assetId === 'string' ? payloadRecord.assetId.trim() : '';
  const assetRef = normalizeAssetRef(payloadRecord);
  if (!assetId) {
    throw new Error('coreui.errors.assets.uploadFailed');
  }
  if (!assetRef) {
    throw new Error('coreui.errors.assets.uploadFailed');
  }
  const url = normalizeAssetUrl(payloadRecord) || toCanonicalAssetVersionPath(assetRef) || '';
  if (!url) throw new Error('coreui.errors.assets.uploadFailed');

  const assetType = typeof payloadRecord.assetType === 'string' ? payloadRecord.assetType.trim() : '';
  const contentType = typeof payloadRecord.contentType === 'string' ? payloadRecord.contentType.trim() : '';
  const sizeBytesRaw = Number(payloadRecord.sizeBytes);
  const filename = typeof payloadRecord.filename === 'string' ? payloadRecord.filename.trim() : '';
  const createdAt = typeof payloadRecord.createdAt === 'string' ? payloadRecord.createdAt.trim() : '';

  return {
    assetId,
    assetRef,
    url,
    assetType: assetType || 'other',
    contentType: contentType || file.type || 'application/octet-stream',
    sizeBytes: Number.isFinite(sizeBytesRaw) ? Math.max(0, Math.trunc(sizeBytesRaw)) : file.size,
    filename: filename || file.name || 'upload.bin',
    createdAt: createdAt || new Date().toISOString(),
  };
}
