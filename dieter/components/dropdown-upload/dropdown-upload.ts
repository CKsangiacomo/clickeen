import { createDropdownHydrator } from '../shared/dropdownToggle';

type Kind = 'empty' | 'image' | 'video' | 'doc' | 'unknown';

type DropdownUploadState = {
  root: HTMLElement;
  input: HTMLInputElement;
  headerLabel: HTMLElement | null;
  baseHeaderLabelText: string;
  headerValue: HTMLElement | null;
  headerValueLabel: HTMLElement | null;
  previewPanel: HTMLElement;
  previewImg: HTMLImageElement;
  previewVideoEl: HTMLVideoElement;
  previewName: HTMLElement;
  previewExt: HTMLElement;
  previewError: HTMLElement;
  uploadButton: HTMLButtonElement;
  replaceButton: HTMLButtonElement;
  removeButton: HTMLButtonElement;
  fileInput: HTMLInputElement;
  accept: string;
  maxImageKb?: number;
  maxVideoKb?: number;
  maxOtherKb?: number;
  localObjectUrl: string | null;
  nativeValue?: { get: () => string; set: (next: string) => void };
  internalWrite: boolean;
};

const states = new Map<HTMLElement, DropdownUploadState>();

// IMPORTANT: keep this at module scope.
// DevStudio (and some Bob flows) may call hydrators more than once over the same DOM.
// `createDropdownHydrator` uses an internal registry to avoid double-binding, but only
// if the same hydrator instance is reused.
const hydrateHost = createDropdownHydrator({
  rootSelector: '.diet-dropdown-upload',
  triggerSelector: '.diet-dropdown-upload__control',
  onOpen: (root) => {
    const state = states.get(root);
    if (!state) return;
    syncFromValue(state, state.input.value);
  },
});

export function hydrateDropdownUpload(scope: Element | DocumentFragment): void {
  const roots = Array.from(scope.querySelectorAll<HTMLElement>('.diet-dropdown-upload'));
  if (!roots.length) return;

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
  const headerLabel = root.querySelector<HTMLElement>('.diet-dropdown-header-label');
  const headerValue = root.querySelector<HTMLElement>('.diet-dropdown-header-value');
  const headerValueLabel = root.querySelector<HTMLElement>('.diet-dropdown-upload__label');
  const previewPanel = root.querySelector<HTMLElement>('.diet-dropdown-upload__panel');
  const previewImg = root.querySelector<HTMLImageElement>('.diet-dropdown-upload__preview-img');
  const previewVideoEl = root.querySelector<HTMLVideoElement>('[data-role="videoEl"]');
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
    !previewVideoEl ||
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

  const accept = (input.dataset.accept || fileInput.getAttribute('accept') || 'image/*').trim();
  const maxImageKbRaw = (input.dataset.maxImageKb || '').trim();
  const maxVideoKbRaw = (input.dataset.maxVideoKb || '').trim();
  const maxOtherKbRaw = (input.dataset.maxOtherKb || '').trim();
  const maxImageKb = maxImageKbRaw ? Number(maxImageKbRaw) : undefined;
  const maxVideoKb = maxVideoKbRaw ? Number(maxVideoKbRaw) : undefined;
  const maxOtherKb = maxOtherKbRaw ? Number(maxOtherKbRaw) : undefined;

  if (accept) fileInput.setAttribute('accept', accept);

  return {
    root,
    input,
    headerLabel,
    baseHeaderLabelText: (headerLabel?.textContent || '').trim(),
    headerValue,
    headerValueLabel,
    previewPanel,
    previewImg,
    previewVideoEl,
    previewName,
    previewExt,
    previewError,
    uploadButton,
    replaceButton,
    removeButton,
    fileInput,
    accept,
    maxImageKb: Number.isFinite(maxImageKb as number) ? (maxImageKb as number) : undefined,
    maxVideoKb: Number.isFinite(maxVideoKb as number) ? (maxVideoKb as number) : undefined,
    maxOtherKb: Number.isFinite(maxOtherKb as number) ? (maxOtherKb as number) : undefined,
    localObjectUrl: null,
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
    if (state.localObjectUrl) {
      URL.revokeObjectURL(state.localObjectUrl);
      state.localObjectUrl = null;
    }
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

    if (state.localObjectUrl) URL.revokeObjectURL(state.localObjectUrl);
    const objectUrl = URL.createObjectURL(file);
    state.localObjectUrl = objectUrl;
    const { kind, ext } = classifyByNameAndType(file.name, file.type);
    state.root.dataset.localName = file.name;
    state.root.dataset.localExt = ext || '';
    state.root.dataset.localKind = kind;
    // Update header immediately with the user-facing filename.
    setHeaderWithFile(state, file.name, false);
    setPreview(state, {
      kind,
      previewUrl: kind === 'image' || kind === 'video' ? objectUrl : undefined,
      name: file.name,
      ext,
      hasFile: true,
    });

    // Locked editor contract: keep uploads in-memory until publish.
    // Persisting is handled by the editor publish flow, which will convert blob/data
    // URLs into stable URLs.
    setFileKey(state, objectUrl, true);
  });
}

function validateFileSelection(state: DropdownUploadState, file: File): string | null {
  // Enforce per-kind caps (current product policy: images 512KB, video 1.5MB, other defaults to video cap).
  const { kind } = classifyByNameAndType(file.name, file.type);
  const capKb =
    kind === 'image'
      ? state.maxImageKb
      : kind === 'video'
        ? state.maxVideoKb
        : state.maxOtherKb;
  if (capKb && Number.isFinite(capKb)) {
    const maxBytes = capKb * 1024;
    if (file.size > maxBytes) return `File too large (max ${capKb}KB)`;
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

function extractPrimaryUrl(raw: string): string | null {
  const v = (raw || '').trim();
  if (!v) return null;
  if (/^data:/i.test(v) || /^blob:/i.test(v) || /^https?:\/\//i.test(v)) return v;
  // CSS fill string, e.g. url("data:...") center center / cover no-repeat
  const m = v.match(/url\(\s*(['"]?)([^'")]+)\1\s*\)/i);
  if (m && m[2]) return m[2];
  return null;
}

function isDataUrl(raw: string): boolean {
  const url = extractPrimaryUrl(raw);
  return Boolean(url && /^data:/i.test(url));
}

function looksLikeUrl(raw: string): boolean {
  const url = extractPrimaryUrl(raw);
  return Boolean(url && (/^https?:\/\//i.test(url) || /^blob:/i.test(url) || url.startsWith('/')));
}

function previewFromUrl(state: DropdownUploadState, raw: string) {
  const url = extractPrimaryUrl(raw);
  if (!url) return;
  const name = state.root.dataset.localName || 'Uploaded file';
  const ext = (state.root.dataset.localExt || guessExtFromName(name) || '').toLowerCase();
  const kind = classifyByNameAndType(name, '').kind;
  setPreview(state, { kind, previewUrl: url, name, ext, hasFile: true });
}

function previewFromDataUrl(state: DropdownUploadState, raw: string) {
  const url = extractPrimaryUrl(raw) || '';
  const mime = (url.split(';')[0] || '').slice('data:'.length);
  const name = state.root.dataset.localName || 'Uploaded file';
  const ext = (state.root.dataset.localExt || guessExtFromName(name) || '').toLowerCase();
  const kind = classifyByNameAndType(name, mime).kind;
  setPreview(state, { kind, previewUrl: kind === 'doc' ? undefined : url, name, ext, hasFile: true });
}

function syncFromValue(state: DropdownUploadState, raw: string) {
  const key = String(raw ?? '').trim();
  const placeholder = state.headerValue?.dataset.placeholder ?? '';

  if (!key) {
    clearError(state);
    setHeaderEmpty(state, placeholder);
    state.root.dataset.hasFile = 'false';
    setPreview(state, { kind: 'empty', previewUrl: undefined, name: '', ext: '', hasFile: false });
    delete state.root.dataset.localName;
    delete state.root.dataset.localExt;
    delete state.root.dataset.localKind;
    return;
  }

  state.root.dataset.hasFile = 'true';
  clearError(state);
  // Editor-time: local data URL (no network).
  if (isDataUrl(key)) {
    setHeaderWithFile(state, state.root.dataset.localName || 'Uploaded file', false);
    previewFromDataUrl(state, key);
    return;
  }
  // Persisted state may store a direct URL; render it (no resolve).
  if (looksLikeUrl(key)) {
    setHeaderWithFile(state, state.root.dataset.localName || key, false);
    previewFromUrl(state, key);
    return;
  }

  setPreview(state, { kind: 'unknown', previewUrl: undefined, name: '', ext: '', hasFile: true });
  setHeaderWithFile(state, 'Invalid value', true);
  setError(state, 'Unsupported value. Expected a URL (http/https) or an editor-only data URL.');
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

  // Keep the header value in sync with the preview name (user-facing).
  if (args.hasFile && args.name) setHeaderWithFile(state, args.name, false);

  if (args.kind === 'image' && args.previewUrl) {
    state.previewImg.src = args.previewUrl;
  } else {
    state.previewImg.removeAttribute('src');
  }

  if (args.kind === 'video' && args.previewUrl) {
    state.previewVideoEl.src = args.previewUrl;
    state.previewVideoEl.load();
  } else {
    state.previewVideoEl.removeAttribute('src');
  }
}

function setError(state: DropdownUploadState, message: string) {
  state.previewError.textContent = message;
}

function clearError(state: DropdownUploadState) {
  state.previewError.textContent = '';
}

function setHeaderEmpty(state: DropdownUploadState, placeholder: string) {
  if (state.headerLabel) state.headerLabel.textContent = placeholder;
  if (state.headerValueLabel) state.headerValueLabel.textContent = '';
  if (state.headerValue) {
    state.headerValue.hidden = true;
    state.headerValue.dataset.muted = 'true';
  }
}

function setHeaderWithFile(state: DropdownUploadState, rightText: string, muted: boolean) {
  if (state.headerLabel) state.headerLabel.textContent = state.baseHeaderLabelText || 'File';
  if (state.headerValueLabel) state.headerValueLabel.textContent = rightText;
  if (state.headerValue) {
    state.headerValue.hidden = false;
    state.headerValue.dataset.muted = muted ? 'true' : 'false';
  }
}

function classifyByNameAndType(name: string, mimeType: string): { kind: Kind; ext: string } {
  const ext = guessExtFromName(name);
  const mt = (mimeType || '').toLowerCase();
  const extLower = (ext || '').toLowerCase();
  const isImage = mt.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(extLower);
  if (isImage) return { kind: 'image', ext: extLower };
  const isVideo = mt.startsWith('video/') || ['mp4', 'webm', 'mov', 'm4v'].includes(extLower);
  if (isVideo) return { kind: 'video', ext: extLower };
  const isDoc =
    mt === 'application/pdf' ||
    mt === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mt === 'application/vnd.ms-excel' ||
    ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'csv', 'lottie', 'json'].includes(extLower);
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
