import { isUuid, isWidgetPublicId, parseCanonicalAssetRef } from '@clickeen/ck-contracts';

type EditorAssetUploadContext = {
  accountId: string;
  workspaceId?: string;
  publicId?: string;
  widgetType?: string;
};

type UploadSource = 'api' | 'devstudio' | 'bob.publish' | 'bob.export' | 'promotion';

type UploadEditorAssetArgs = {
  file: File;
  variant?: string;
  source?: UploadSource;
  context?: EditorAssetUploadContext;
  endpoint?: string;
};

type ReplaceEditorAssetArgs = {
  file: File;
  accountId: string;
  assetId: string;
  variant?: string;
  source?: UploadSource;
  context?: EditorAssetUploadContext;
  endpoint?: string;
  idempotencyKey?: string;
};

type UpsertEditorAssetArgs = {
  file: File;
  currentSrc?: string | null;
  variant?: string;
  source?: UploadSource;
  context?: EditorAssetUploadContext;
  uploadEndpoint?: string;
  replaceEndpoint?: string;
  idempotencyKey?: string;
};

export type EditorAssetIdentity = {
  accountId: string;
  assetId: string;
};

function normalizeReasonKey(raw: string): string {
  return String(raw || '').trim().toLowerCase();
}

function isNotFoundReasonKey(raw: string): boolean {
  const value = normalizeReasonKey(raw);
  if (!value) return false;
  return value === 'coreui.errors.asset.notfound' || value.includes('coreui.errors.asset.notfound');
}

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

function resolveContextFromDocument(): EditorAssetUploadContext | null {
  const accountId = readDatasetValue('ckOwnerAccountId');
  const workspaceId = readDatasetValue('ckWorkspaceId');
  const publicId = readDatasetValue('ckPublicId');
  const widgetType = readDatasetValue('ckWidgetType');

  if (!accountId || !isUuid(accountId)) return null;

  const context: EditorAssetUploadContext = {
    accountId,
  };

  if (workspaceId && isUuid(workspaceId)) context.workspaceId = workspaceId;
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

function assertUploadContext(context: EditorAssetUploadContext): EditorAssetUploadContext {
  const accountId = String(context.accountId || '').trim();
  const workspaceId = String(context.workspaceId || '').trim();
  const publicId = String(context.publicId || '').trim();
  const widgetType = String(context.widgetType || '').trim().toLowerCase();
  if (!isUuid(accountId)) {
    throw new Error('coreui.errors.accountId.invalid');
  }
  if (workspaceId && !isUuid(workspaceId)) {
    throw new Error('coreui.errors.workspaceId.invalid');
  }
  if (publicId && !isPublicId(publicId)) {
    throw new Error('coreui.errors.publicId.invalid');
  }
  if (widgetType && !isWidgetType(widgetType)) {
    throw new Error('coreui.errors.widgetType.invalid');
  }
  return {
    accountId,
    workspaceId: workspaceId || undefined,
    publicId: publicId || undefined,
    widgetType: widgetType || undefined,
  };
}

export function parseEditorAssetIdentity(raw: string): EditorAssetIdentity | null {
  const parsed = parseCanonicalAssetRef(raw);
  if (!parsed || parsed.kind !== 'version') return null;
  return { accountId: parsed.accountId, assetId: parsed.assetId };
}

function normalizeIdempotencyKey(raw: string | undefined): string {
  const value = String(raw || '').trim();
  if (value) return value;
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `ck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildReplaceEndpoint(endpoint: string | undefined, accountId: string, assetId: string): string {
  const base = (endpoint || '/api/assets').trim().replace(/\/$/, '');
  return `${base}/${encodeURIComponent(accountId)}/${encodeURIComponent(assetId)}/content`;
}

export function isAssetNotFoundError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return isNotFoundReasonKey(error.message);
}

export async function uploadEditorAsset(args: UploadEditorAssetArgs): Promise<string> {
  const file = args.file;
  if (!(file instanceof File) || file.size <= 0) {
    throw new Error('coreui.errors.payload.empty');
  }

  const context = assertUploadContext(args.context ?? resolveContextFromDocument() ?? ({} as EditorAssetUploadContext));
  const source = args.source || 'api';
  const variant = args.variant || 'original';
  const endpoint = (args.endpoint || '/api/assets/upload').trim();

  const headers = new Headers();
  headers.set('content-type', file.type || 'application/octet-stream');
  headers.set('x-account-id', context.accountId);
  if (context.workspaceId) headers.set('x-workspace-id', context.workspaceId);
  headers.set('x-filename', file.name || 'upload.bin');
  headers.set('x-variant', variant);
  headers.set('x-source', source);
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
  const url = normalizeAssetUrl(payload as Record<string, unknown>);
  if (!url) {
    throw new Error('coreui.errors.assets.uploadFailed');
  }
  return url;
}

export async function replaceEditorAsset(args: ReplaceEditorAssetArgs): Promise<string> {
  const file = args.file;
  if (!(file instanceof File) || file.size <= 0) {
    throw new Error('coreui.errors.payload.empty');
  }

  const accountId = String(args.accountId || '').trim();
  const assetId = String(args.assetId || '').trim();
  if (!isUuid(accountId)) throw new Error('coreui.errors.accountId.invalid');
  if (!isUuid(assetId)) throw new Error('coreui.errors.assetId.invalid');

  const resolvedContext = args.context ?? resolveContextFromDocument() ?? { accountId };
  const context = assertUploadContext(resolvedContext);
  if (context.accountId !== accountId) {
    throw new Error('coreui.errors.accountId.invalid');
  }

  const source = args.source || 'api';
  const variant = args.variant || 'original';
  const endpoint = buildReplaceEndpoint(args.endpoint, accountId, assetId);
  const idempotencyKey = normalizeIdempotencyKey(args.idempotencyKey);

  const headers = new Headers();
  headers.set('content-type', file.type || 'application/octet-stream');
  headers.set('x-account-id', accountId);
  if (context.workspaceId) headers.set('x-workspace-id', context.workspaceId);
  headers.set('x-filename', file.name || 'upload.bin');
  headers.set('x-variant', variant);
  headers.set('x-source', source);
  headers.set('idempotency-key', idempotencyKey);
  if (context.publicId) headers.set('x-public-id', context.publicId);
  if (context.widgetType) headers.set('x-widget-type', context.widgetType);

  const executeReplace = async () =>
    fetch(`${endpoint}?_t=${Date.now()}`, {
      method: 'PUT',
      headers,
      body: file,
    });
  let response: Response;
  try {
    response = await executeReplace();
  } catch {
    // Keep the same idempotency key for safe retry semantics.
    response = await executeReplace();
  }
  const text = await response.text().catch(() => '');
  const payload = safeJsonParse(text);

  if (!response.ok) {
    const errorRecord =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? ((payload as Record<string, unknown>).error as Record<string, unknown> | undefined)
        : undefined;
    const reasonKey = typeof errorRecord?.reasonKey === 'string' ? errorRecord.reasonKey : '';
    const detail = typeof errorRecord?.detail === 'string' ? errorRecord.detail : '';
    throw new Error(reasonKey || detail || `coreui.errors.assets.replaceFailed (${response.status})`);
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new Error('coreui.errors.assets.replaceFailed');
  }
  const url = normalizeAssetUrl(payload as Record<string, unknown>);
  if (!url) {
    throw new Error('coreui.errors.assets.replaceFailed');
  }
  return url;
}

export async function upsertEditorAsset(args: UpsertEditorAssetArgs): Promise<string> {
  const currentSrc = String(args.currentSrc || '').trim();
  const identity = currentSrc ? parseEditorAssetIdentity(currentSrc) : null;
  if (!identity) {
    return uploadEditorAsset({
      file: args.file,
      variant: args.variant,
      source: args.source,
      context: args.context,
      endpoint: args.uploadEndpoint,
    });
  }

  try {
    return await replaceEditorAsset({
      file: args.file,
      accountId: identity.accountId,
      assetId: identity.assetId,
      variant: args.variant,
      source: args.source,
      context: args.context,
      endpoint: args.replaceEndpoint,
      idempotencyKey: args.idempotencyKey,
    });
  } catch (error) {
    if (!isAssetNotFoundError(error)) throw error;
    return uploadEditorAsset({
      file: args.file,
      variant: args.variant,
      source: args.source,
      context: args.context,
      endpoint: args.uploadEndpoint,
    });
  }
}
