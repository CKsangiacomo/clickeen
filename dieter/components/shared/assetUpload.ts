type EditorAssetUploadContext = {
  accountId: string;
  workspaceId: string;
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

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function isPublicId(value: string): boolean {
  if (!value) return false;
  if (/^wgt_curated_[a-z0-9]([a-z0-9_-]*[a-z0-9])?([.][a-z0-9]([a-z0-9_-]*[a-z0-9])?)*$/i.test(value)) return true;
  if (/^wgt_[a-z0-9][a-z0-9_-]*_(main|tmpl_[a-z0-9][a-z0-9_-]*|u_[a-z0-9][a-z0-9_-]*)$/i.test(value)) return true;
  return /^wgt_main_[a-z0-9][a-z0-9_-]*$/i.test(value);
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
  if (!workspaceId || !isUuid(workspaceId)) return null;

  const context: EditorAssetUploadContext = {
    accountId,
    workspaceId,
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

function normalizeUploadUrl(payload: Record<string, unknown>): string | null {
  const direct = typeof payload.url === 'string' ? payload.url.trim() : '';
  if (!direct) return null;

  if (/^https?:\/\//i.test(direct)) {
    try {
      const parsed = new URL(direct);
      if (!parsed.pathname.startsWith('/arsenale/o/')) return null;
      return direct;
    } catch {
      return null;
    }
  }

  if (!direct.startsWith('/')) return null;
  if (!direct.startsWith('/arsenale/o/')) return null;
  return direct;
}

function assertUploadContext(context: EditorAssetUploadContext): EditorAssetUploadContext {
  const accountId = String(context.accountId || '').trim();
  const workspaceId = String(context.workspaceId || '').trim();
  const publicId = String(context.publicId || '').trim();
  const widgetType = String(context.widgetType || '').trim().toLowerCase();
  if (!isUuid(accountId)) {
    throw new Error('coreui.errors.accountId.invalid');
  }
  if (!isUuid(workspaceId)) {
    throw new Error('coreui.errors.workspaceId.invalid');
  }
  if (publicId && !isPublicId(publicId)) {
    throw new Error('coreui.errors.publicId.invalid');
  }
  if (widgetType && !isWidgetType(widgetType)) {
    throw new Error('coreui.errors.widgetType.invalid');
  }
  return { accountId, workspaceId, publicId: publicId || undefined, widgetType: widgetType || undefined };
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
  headers.set('x-workspace-id', context.workspaceId);
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
  const url = normalizeUploadUrl(payload as Record<string, unknown>);
  if (!url) {
    throw new Error('coreui.errors.assets.uploadFailed');
  }
  return url;
}
