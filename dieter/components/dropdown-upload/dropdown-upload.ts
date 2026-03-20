import { createDropdownHydrator } from '../shared/dropdownToggle';
import { isUuid } from '@clickeen/ck-contracts';
import { dispatchAccountAssetUpsell, type AccountAssetsClient } from '../shared/account-assets';
import { resolveSingleAccountAsset } from '../shared/account-asset-resolve';

type Kind = 'empty' | 'image' | 'video' | 'doc' | 'unknown';

type UploadMeta = {
  name?: string;
  assetId?: string;
  source?: string;
};

type DropdownUploadState = {
  root: HTMLElement;
  accountAssets: AccountAssetsClient;
  input: HTMLInputElement;
  metaInput: HTMLInputElement | null;
  metaHasPath: boolean;
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
  resolveRequestId: number;
  nativeValue?: { get: () => string; set: (next: string) => void };
  internalWrite: boolean;
};

const states = new Map<HTMLElement, DropdownUploadState>();
const MISSING_ASSET_MESSAGE = 'Asset unavailable. Upload a new file to restore it.';
const PREVIEW_FAILED_MESSAGE = 'Preview failed to load.';
const META_PATH_REQUIRED_MESSAGE = 'Asset-backed dropdown-upload requires meta-path.';
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
    syncFromInputs(state);
  },
});

export function hydrateDropdownUpload(
  scope: Element | DocumentFragment,
  options: { accountAssets: AccountAssetsClient },
): void {
  const roots = Array.from(scope.querySelectorAll<HTMLElement>('.diet-dropdown-upload'));
  if (!roots.length) return;

  roots.forEach((root) => {
    if (states.has(root)) return;
    const state = createState(root, options.accountAssets);
    if (!state) return;
    states.set(root, state);
    installHandlers(state);
    const initialValue = state.input.value || state.input.getAttribute('value') || '';
    syncFromInputs(state, initialValue);
  });

  hydrateHost(scope);
}

function createState(root: HTMLElement, accountAssets: AccountAssetsClient): DropdownUploadState | null {
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
  const metaInput = root.querySelector<HTMLInputElement>('.diet-dropdown-upload__meta-field');
  const metaHasPath = Boolean(metaInput?.getAttribute('data-bob-path'));

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
    accountAssets,
    input,
    metaInput,
    metaHasPath,
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
    resolveRequestId: 0,
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

  state.input.addEventListener('external-sync', () => syncFromInputs(state));
  state.input.addEventListener('input', () => syncFromInputs(state));
  if (state.metaInput) {
    state.metaInput.addEventListener('external-sync', () => syncFromInputs(state));
    state.metaInput.addEventListener('input', () => syncFromInputs(state));
  }

  if (!state.metaHasPath) {
    state.uploadButton.disabled = true;
    state.replaceButton.disabled = true;
    state.removeButton.disabled = true;
    state.fileInput.disabled = true;
  }

  const handlePreviewMediaError = (kind: Kind, currentSrc: string) => {
    const expected = state.previewPanel.dataset.previewUrl || '';
    if (!expected) return;
    if (state.previewPanel.dataset.kind !== kind) return;
    if (!sameAssetUrl(currentSrc, expected)) return;
    setError(state, PREVIEW_FAILED_MESSAGE);
  };

  const handlePreviewMediaReady = (kind: Kind, currentSrc: string) => {
    const expected = state.previewPanel.dataset.previewUrl || '';
    if (!expected || state.previewPanel.dataset.kind !== kind) return;
    if (!sameAssetUrl(currentSrc, expected)) return;
    if ((state.previewError.textContent || '').trim() === PREVIEW_FAILED_MESSAGE) {
      clearError(state);
    }
  };

  state.previewImg.addEventListener('error', () => {
    handlePreviewMediaError('image', state.previewImg.currentSrc || state.previewImg.src || '');
  });
  state.previewImg.addEventListener('load', () => {
    handlePreviewMediaReady('image', state.previewImg.currentSrc || state.previewImg.src || '');
  });
  state.previewVideoEl.addEventListener('error', () => {
    handlePreviewMediaError('video', state.previewVideoEl.currentSrc || state.previewVideoEl.src || '');
  });
  state.previewVideoEl.addEventListener('loadeddata', () => {
    handlePreviewMediaReady('video', state.previewVideoEl.currentSrc || state.previewVideoEl.src || '');
  });

  const pickFile = (event: Event) => {
    event.preventDefault();
    state.fileInput.value = '';
    state.fileInput.click();
  };

  const uploadSelectedFile = async (file: File) => {
    const validationError = validateFileSelection(state, file);
    if (validationError) {
      setError(state, validationError);
      return;
    }

    setUploadingState(state, true);
    clearError(state);
    try {
      const asset = await state.accountAssets.uploadAsset(file, 'api');
      setMetaValue(
        state,
        {
          name: asset.filename,
          assetId: asset.assetId,
          source: 'user',
        },
        true,
      );
      setFileKey(state, 'transparent', true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'coreui.errors.assets.uploadFailed';
      if (dispatchAccountAssetUpsell(state.root, message)) {
      } else {
        setError(state, message);
      }
    } finally {
      setUploadingState(state, false);
    }
  };

  state.uploadButton.disabled = false;
  state.uploadButton.hidden = false;
  state.replaceButton.disabled = false;
  state.replaceButton.hidden = false;
  state.fileInput.disabled = false;
  state.uploadButton.addEventListener('click', pickFile);
  state.replaceButton.addEventListener('click', pickFile);
  state.fileInput.addEventListener('change', () => {
    const file = state.fileInput.files?.[0];
    if (!file) return;
    void uploadSelectedFile(file);
  });
  state.removeButton.addEventListener('click', (event) => {
    event.preventDefault();
    if (state.localObjectUrl) {
      URL.revokeObjectURL(state.localObjectUrl);
      state.localObjectUrl = null;
    }
    setMetaValue(state, null, true);
    setFileKey(state, 'transparent', true);
  });
}

function setUploadingState(state: DropdownUploadState, uploading: boolean) {
  state.root.dataset.uploading = uploading ? 'true' : 'false';
  state.uploadButton.disabled = uploading;
  state.replaceButton.disabled = uploading;
  state.removeButton.disabled = uploading;
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

function syncFromInputs(state: DropdownUploadState, fallbackValue?: string) {
  const value = fallbackValue ?? state.input.value;
  const meta = readMeta(state);
  syncFromValue(state, value, meta);
}

function readMeta(state: DropdownUploadState): UploadMeta | null {
  if (!state.metaInput) return null;
  const raw = state.metaInput.value || state.metaInput.getAttribute('value') || '';
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as UploadMeta;
  } catch {
    return null;
  }
}

function readMetaAssetId(meta: UploadMeta | null): string {
  const assetId = typeof meta?.assetId === 'string' ? meta.assetId.trim() : '';
  return isUuid(assetId) ? assetId : '';
}

function invalidateResolve(state: DropdownUploadState): void {
  state.resolveRequestId += 1;
}

function sameAssetUrl(leftRaw: string, rightRaw: string): boolean {
  const left = normalizeUrlForCompare(leftRaw);
  const right = normalizeUrlForCompare(rightRaw);
  if (!left || !right) return false;
  return left === right;
}

function normalizeUrlForCompare(raw: string): string {
  const value = String(raw || '').trim();
  if (!value) return '';
  try {
    const parsed = new URL(value, window.location.href);
    return parsed.toString();
  } catch {
    return value;
  }
}

function previewFromResolvedUrl(state: DropdownUploadState, url: string, name: string, kindName: string) {
  const normalizedUrl = String(url || '').trim();
  if (!normalizedUrl) return;
  const ext = (guessExtFromName(kindName) || '').toLowerCase();
  const kind = classifyByNameAndType(kindName || 'file', '').kind;
  setPreview(state, { kind, previewUrl: normalizedUrl, name, ext, hasFile: true });
}

function syncFromValue(state: DropdownUploadState, raw: string, meta: UploadMeta | null = null) {
  if (!state.metaHasPath) {
    invalidateResolve(state);
    setHeaderWithFile(state, 'Invalid control', true);
    setError(state, META_PATH_REQUIRED_MESSAGE);
    setPreview(state, { kind: 'empty', previewUrl: undefined, name: '', ext: '', hasFile: false });
    return;
  }

  let key = String(raw ?? '').trim();
  if (key === 'transparent') key = '';
  const placeholder = state.headerValue?.dataset.placeholder ?? '';
  const metaName = typeof meta?.name === 'string' ? meta.name.trim() : '';
  const assetId = readMetaAssetId(meta);
  const displayName = metaName || 'Uploaded file';
  const currentAssetId = assetId;

  if (!key && !currentAssetId && !metaName) {
    invalidateResolve(state);
    clearError(state);
    setHeaderEmpty(state, placeholder);
    state.root.dataset.hasFile = 'false';
    setPreview(state, { kind: 'empty', previewUrl: undefined, name: '', ext: '', hasFile: false });
    delete state.root.dataset.localName;
    return;
  }

  state.root.dataset.hasFile = 'true';
  if (currentAssetId) {
    setHeaderWithFile(state, displayName, false);
    setPreview(state, {
      kind: 'unknown',
      previewUrl: undefined,
      name: displayName,
      ext: guessExtFromName(displayName).toLowerCase(),
      hasFile: true,
    });
    clearError(state);
    void resolveStoredAssetPreview(state, currentAssetId, displayName);
    return;
  }

  setPreview(state, {
    kind: 'unknown',
    previewUrl: undefined,
    name: displayName,
    ext: guessExtFromName(displayName).toLowerCase(),
    hasFile: true,
  });
  invalidateResolve(state);
  setHeaderWithFile(state, displayName, true);
  setError(state, 'Missing asset identity. Upload a new file to restore it.');
}

async function resolveStoredAssetPreview(state: DropdownUploadState, assetId: string, displayName: string) {
  return resolveSingleAccountAsset({
    accountAssets: state.accountAssets,
    getAssetId: () => assetId,
    beginRequest: () => {
      state.resolveRequestId += 1;
      return state.resolveRequestId;
    },
    isCurrent: (requestId, currentAssetId) => {
      if (state.resolveRequestId !== requestId) return false;
      return readMetaAssetId(readMeta(state)) === currentAssetId;
    },
    onMissing: () => {
      setError(state, MISSING_ASSET_MESSAGE);
      setHeaderWithFile(state, displayName || 'Asset unavailable', true);
    },
    onResolved: (resolved) => {
      clearError(state);
      previewFromResolvedUrl(state, resolved.url, displayName, displayName);
    },
    onError: (message) => {
      setError(state, message);
    },
  });
}

function setFileKey(state: DropdownUploadState, fileKey: string, emit: boolean) {
  state.internalWrite = true;
  state.input.value = fileKey;
  state.internalWrite = false;
  if (emit) state.input.dispatchEvent(new Event('input', { bubbles: true }));
}

function setMetaValue(state: DropdownUploadState, meta: UploadMeta | null, emit: boolean) {
  if (!state.metaInput) return;
  const next = meta ? JSON.stringify(meta) : '';
  state.metaInput.value = next;
  if (emit) state.metaInput.dispatchEvent(new Event('input', { bubbles: true }));
}

function setPreview(
  state: DropdownUploadState,
  args: { kind: Kind; previewUrl?: string; name: string; ext: string; hasFile: boolean },
) {
  state.previewPanel.dataset.hasFile = args.hasFile ? 'true' : 'false';
  state.previewPanel.dataset.kind = args.kind;
  if (args.previewUrl) {
    state.previewPanel.dataset.previewUrl = args.previewUrl;
  } else {
    delete state.previewPanel.dataset.previewUrl;
  }
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
