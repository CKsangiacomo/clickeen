import { createDropdownHydrator } from '../shared/dropdownToggle';

type ResolveResponse = {
  previewUrl?: string;
  mimeType?: string;
  ext?: string;
  fileName?: string;
};

type GrantResponse = {
  uploadUrl: string;
  fileKey: string;
};

type Kind = 'empty' | 'image' | 'video' | 'doc' | 'unknown';

type DropdownUploadState = {
  root: HTMLElement;
  input: HTMLInputElement;
  headerValue: HTMLElement | null;
  headerValueLabel: HTMLElement | null;
  previewPanel: HTMLElement;
  previewImg: HTMLImageElement;
  previewName: HTMLElement;
  previewExt: HTMLElement;
  previewError: HTMLElement;
  uploadButton: HTMLButtonElement;
  replaceButton: HTMLButtonElement;
  removeButton: HTMLButtonElement;
  fileInput: HTMLInputElement;
  resolveUrl: string;
  grantUrl: string;
  accept: string;
  maxSizeMb?: number;
  nativeValue?: { get: () => string; set: (next: string) => void };
  internalWrite: boolean;
};

const states = new Map<HTMLElement, DropdownUploadState>();

export function hydrateDropdownUpload(scope: Element | DocumentFragment): void {
  const roots = Array.from(scope.querySelectorAll<HTMLElement>('.diet-dropdown-upload'));
  if (!roots.length) return;

  const hydrateHost = createDropdownHydrator({
    rootSelector: '.diet-dropdown-upload',
    triggerSelector: '.diet-dropdown-upload__control',
    onOpen: (root) => {
      const state = states.get(root);
      if (!state) return;
      const key = (state.input.value || '').trim();
      if (!key) return;
      void resolveAndPreview(state, key);
    },
  });

  roots.forEach((root) => {
    if (states.has(root)) return;
    const state = createState(root);
    if (!state) return;
    states.set(root, state);
    installHandlers(state);
    const initialValue = state.input.value || state.input.getAttribute('value') || '';
    syncFromValue(state, initialValue);
  });

  hydrateHost(scope);
}

function createState(root: HTMLElement): DropdownUploadState | null {
  const input = root.querySelector<HTMLInputElement>('.diet-dropdown-upload__value-field');
  const headerValue = root.querySelector<HTMLElement>('.diet-dropdown-header-value');
  const headerValueLabel = root.querySelector<HTMLElement>('.diet-dropdown-upload__label');
  const previewPanel = root.querySelector<HTMLElement>('.diet-dropdown-upload__panel');
  const previewImg = root.querySelector<HTMLImageElement>('.diet-dropdown-upload__preview-img');
  const previewName = root.querySelector<HTMLElement>('[data-role="name"]');
  const previewExt = root.querySelector<HTMLElement>('[data-role="ext"]');
  const previewError = root.querySelector<HTMLElement>('[data-role="error"]');
  const uploadButton = root.querySelector<HTMLButtonElement>('.diet-dropdown-upload__upload-btn');
  const replaceButton = root.querySelector<HTMLButtonElement>('.diet-dropdown-upload__replace-btn');
  const removeButton = root.querySelector<HTMLButtonElement>('.diet-dropdown-upload__remove-btn');
  const fileInput = root.querySelector<HTMLInputElement>('.diet-dropdown-upload__file-input');

  if (
    !input ||
    !previewPanel ||
    !previewImg ||
    !previewName ||
    !previewExt ||
    !previewError ||
    !uploadButton ||
    !replaceButton ||
    !removeButton ||
    !fileInput
  ) {
    return null;
  }

  const resolveUrl = (input.dataset.resolveUrl || '/api/assets/resolve').trim();
  const grantUrl = (input.dataset.grantUrl || '/api/assets/grant').trim();
  const accept = (input.dataset.accept || fileInput.getAttribute('accept') || 'image/*').trim();
  const maxSizeMbRaw = (input.dataset.maxSizeMb || '').trim();
  const maxSizeMb = maxSizeMbRaw ? Number(maxSizeMbRaw) : undefined;

  if (accept) fileInput.setAttribute('accept', accept);

  return {
    root,
    input,
    headerValue,
    headerValueLabel,
    previewPanel,
    previewImg,
    previewName,
    previewExt,
    previewError,
    uploadButton,
    replaceButton,
    removeButton,
    fileInput,
    resolveUrl,
    grantUrl,
    accept,
    maxSizeMb: Number.isFinite(maxSizeMb as number) ? (maxSizeMb as number) : undefined,
    nativeValue: captureNativeValue(input),
    internalWrite: false,
  };
}

function installHandlers(state: DropdownUploadState) {
  if (state.nativeValue) {
    Object.defineProperty(state.input, 'value', {
      configurable: true,
      get: () => state.nativeValue?.get() ?? '',
      set: (next: string) => {
        state.nativeValue?.set(String(next ?? ''));
        if (!state.internalWrite) syncFromValue(state, String(next ?? ''));
      },
    });
  }

  state.input.addEventListener('external-sync', () => syncFromValue(state, state.input.value));
  state.input.addEventListener('input', () => syncFromValue(state, state.input.value));

  const pickFile = (event: Event) => {
    event.preventDefault();
    state.fileInput.value = '';
    state.fileInput.click();
  };
  state.uploadButton.addEventListener('click', pickFile);
  state.replaceButton.addEventListener('click', pickFile);
  state.removeButton.addEventListener('click', (event) => {
    event.preventDefault();
    setFileKey(state, '', true);
  });

  state.fileInput.addEventListener('change', async () => {
    const file = state.fileInput.files && state.fileInput.files[0];
    if (!file) return;

    const error = validateFileSelection(state, file);
    if (error) {
      setError(state, error);
      return;
    }
    clearError(state);

    // Optimistic local preview while upload happens.
    const objectUrl = URL.createObjectURL(file);
    const { kind, ext } = classifyByNameAndType(file.name, file.type);
    setPreview(state, {
      kind,
      previewUrl: kind === 'image' ? objectUrl : undefined,
      name: file.name,
      ext,
      hasFile: true,
    });

    try {
      const grant = await requestGrant(state, file);
      await uploadToSignedUrl(grant.uploadUrl, file);
      setFileKey(state, grant.fileKey, true);
    } catch (e) {
      setError(state, e instanceof Error ? e.message : 'Upload failed');
    }
  });
}

function validateFileSelection(state: DropdownUploadState, file: File): string | null {
  if (state.maxSizeMb && Number.isFinite(state.maxSizeMb)) {
    const maxBytes = state.maxSizeMb * 1024 * 1024;
    if (file.size > maxBytes) return `File too large (max ${state.maxSizeMb}MB)`;
  }

  const accept = state.accept;
  if (!accept) return null;
  const accepted = accept
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!accepted.length) return null;

  const nameLower = file.name.toLowerCase();
  const typeLower = (file.type || '').toLowerCase();
  const ok = accepted.some((rule) => {
    if (rule === '*/*') return true;
    if (rule.endsWith('/*')) {
      const prefix = rule.slice(0, -2).toLowerCase();
      return typeLower.startsWith(`${prefix}/`);
    }
    if (rule.startsWith('.')) {
      return nameLower.endsWith(rule.toLowerCase());
    }
    return typeLower === rule.toLowerCase();
  });

  return ok ? null : 'File type not allowed';
}

async function requestGrant(state: DropdownUploadState, file: File): Promise<GrantResponse> {
  const res = await fetch(state.grantUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text ? `Grant failed: ${text}` : `Grant failed (${res.status})`);
  }

  const json = (await res.json()) as unknown;
  if (!json || typeof json !== 'object') throw new Error('Grant failed: invalid response');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uploadUrl = (json as any).uploadUrl;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fileKey = (json as any).fileKey;
  if (typeof uploadUrl !== 'string' || typeof fileKey !== 'string') throw new Error('Grant failed: missing fields');
  return { uploadUrl, fileKey };
}

async function uploadToSignedUrl(uploadUrl: string, file: File): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status})`);
}

async function resolveAndPreview(state: DropdownUploadState, fileKey: string): Promise<void> {
  clearError(state);
  const url = new URL(state.resolveUrl, window.location.origin);
  url.searchParams.set('key', fileKey);
  const res = await fetch(url.toString(), { method: 'GET' });
  if (!res.ok) {
    setError(state, `Resolve failed (${res.status})`);
    return;
  }
  const data = (await res.json()) as ResolveResponse;
  const name = data.fileName || fileKey;
  const ext = (data.ext || guessExtFromName(name) || '').toLowerCase();
  const kind = classifyByNameAndType(name, data.mimeType || '').kind;
  setPreview(state, {
    kind,
    previewUrl: data.previewUrl,
    name,
    ext,
    hasFile: true,
  });
}

function syncFromValue(state: DropdownUploadState, raw: string) {
  const key = String(raw ?? '').trim();
  const placeholder = state.headerValue?.dataset.placeholder ?? '';

  if (!key) {
    updateHeader(state, placeholder, true);
    state.root.dataset.hasFile = 'false';
    setPreview(state, { kind: 'empty', previewUrl: undefined, name: '', ext: '', hasFile: false });
    return;
  }

  updateHeader(state, key, false);
  state.root.dataset.hasFile = 'true';
  void resolveAndPreview(state, key);
}

function setFileKey(state: DropdownUploadState, fileKey: string, emit: boolean) {
  state.internalWrite = true;
  state.input.value = fileKey;
  state.internalWrite = false;
  if (emit) state.input.dispatchEvent(new Event('input', { bubbles: true }));
}

function setPreview(
  state: DropdownUploadState,
  args: { kind: Kind; previewUrl?: string; name: string; ext: string; hasFile: boolean },
) {
  state.previewPanel.dataset.hasFile = args.hasFile ? 'true' : 'false';
  state.previewPanel.dataset.kind = args.kind;
  state.previewName.textContent = args.name || '';
  state.previewExt.textContent = args.ext ? args.ext.toUpperCase() : '';

  if (args.kind === 'image' && args.previewUrl) {
    state.previewImg.src = args.previewUrl;
  } else {
    state.previewImg.removeAttribute('src');
  }
}

function setError(state: DropdownUploadState, message: string) {
  state.previewError.textContent = message;
}

function clearError(state: DropdownUploadState) {
  state.previewError.textContent = '';
}

function updateHeader(state: DropdownUploadState, text: string, muted: boolean) {
  if (state.headerValueLabel) state.headerValueLabel.textContent = text;
  if (state.headerValue) state.headerValue.dataset.muted = muted ? 'true' : 'false';
}

function classifyByNameAndType(name: string, mimeType: string): { kind: Kind; ext: string } {
  const ext = guessExtFromName(name);
  const mt = (mimeType || '').toLowerCase();
  const extLower = (ext || '').toLowerCase();
  const isImage = mt.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(extLower);
  if (isImage) return { kind: 'image', ext: extLower };
  const isVideo = mt.startsWith('video/') || ['mp4', 'webm', 'mov', 'm4v'].includes(extLower);
  if (isVideo) return { kind: 'video', ext: extLower };
  const isDoc = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip'].includes(extLower);
  if (isDoc) return { kind: 'doc', ext: extLower };
  return { kind: 'unknown', ext: extLower };
}

function guessExtFromName(name: string): string {
  const base = (name || '').split('?')[0];
  const parts = base.split('.').filter(Boolean);
  if (parts.length < 2) return '';
  return parts[parts.length - 1];
}

function captureNativeValue(input: HTMLInputElement): DropdownUploadState['nativeValue'] {
  const proto = Object.getPrototypeOf(input) as typeof HTMLInputElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, 'value');
  if (!desc?.get || !desc?.set) return undefined;
  return {
    get: () => String(desc.get?.call(input) ?? ''),
    set: (next: string) => {
      desc.set?.call(input, next);
    },
  };
}


